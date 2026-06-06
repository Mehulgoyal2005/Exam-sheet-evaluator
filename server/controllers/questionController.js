// server/controllers/questionController.js

const fs = require('fs');
const path = require('path');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const { uploadToCloudinary } = require('../config/cloudinary');
const { callOcrService } = require('../utils/ocrService');
const { extractQuestionsFromText } = require('../utils/llm');

/**
 * POST /api/exams/:examId/process-papers
 *
 * THE FIX: Run OCR on the local multer temp files FIRST, then upload to Cloudinary.
 * Previously we uploaded first (which deleted the local file), then tried to download
 * back from Cloudinary — but Cloudinary blocks downloads with 401 because files are private.
 * New order: OCR (local files) → Upload to Cloudinary → Save URLs → Return results.
 */
const processPapers = async (req, res, next) => {
  // Track the multer temp file paths so we can clean them up in finally
  // (uploadToCloudinary deletes them after upload, but if OCR fails before upload
  //  we still need to clean up manually)
  const tempFilesToCleanup = [];

  try {
    // ── Step 1: Validate both files are present ────────────────────────────
    if (!req.files || !req.files['questionPaper'] || !req.files['modelAnswer']) {
      const missing = [];
      if (!req.files?.['questionPaper']) missing.push('Question Paper PDF');
      if (!req.files?.['modelAnswer']) missing.push('Model Answer PDF');
      return res.status(400).json({
        success: false,
        message: `Missing required files: ${missing.join(' and ')}`,
      });
    }

    // ── Step 2: Get exam and verify ownership ──────────────────────────────
    const exam = await Exam.findById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this exam' });
    }

    // ── Step 3: Get local file paths from multer ───────────────────────────
    // Multer has already saved both PDFs to server/temp/ for us
    const questionPaperLocalPath = req.files['questionPaper'][0].path;
    const modelAnswerLocalPath = req.files['modelAnswer'][0].path;

    // Track these paths — if anything fails before uploadToCloudinary runs,
    // we need to delete them manually in the finally block
    tempFilesToCleanup.push(questionPaperLocalPath, modelAnswerLocalPath);

    console.log(`📄 Processing papers for exam: ${exam.title}`);
    console.log(`   Question paper: ${questionPaperLocalPath}`);
    console.log(`   Model answer: ${modelAnswerLocalPath}`);

    // ── Step 4: Run OCR on local files FIRST (before uploading) ───────────
    // This is the key fix — we use the local multer temp files directly.
    // No download from Cloudinary needed. Files are already on disk.
    console.log('🔍 Running OCR on question paper...');
    const qpOcrResult = await callOcrService(questionPaperLocalPath);

    console.log('🔍 Running OCR on model answer...');
    const maOcrResult = await callOcrService(modelAnswerLocalPath);

    console.log(`📊 Question paper OCR confidence: ${qpOcrResult.averageConfidence}`);
    console.log(`📊 Model answer OCR confidence: ${maOcrResult.averageConfidence}`);

    // Validate OCR actually extracted something readable
    if (!qpOcrResult.extractedText || qpOcrResult.extractedText.trim().length < 10) {
      return res.status(422).json({
        success: false,
        message: 'Could not extract text from the question paper PDF. Please ensure it is a readable PDF and try again.',
      });
    }

    if (!maOcrResult.extractedText || maOcrResult.extractedText.trim().length < 10) {
      return res.status(422).json({
        success: false,
        message: 'Could not extract text from the model answer PDF. Please ensure it is a readable PDF and try again.',
      });
    }

    // ── Step 5: Now upload to Cloudinary for permanent storage ─────────────
    // uploadToCloudinary deletes the local temp files after uploading —
    // so after this step, the files are gone from disk (which is what we want)
    console.log('☁️  Uploading to Cloudinary...');

    const [questionPaperUrl, modelAnswerUrl] = await Promise.all([
      uploadToCloudinary(questionPaperLocalPath, 'evalai/question-papers'),
      uploadToCloudinary(modelAnswerLocalPath, 'evalai/model-answers'),
    ]);

    // uploadToCloudinary deleted the local files — remove from cleanup list
    // so the finally block doesn't try to delete already-deleted files
    tempFilesToCleanup.length = 0;

    console.log(`✅ Uploaded question paper: ${questionPaperUrl}`);
    console.log(`✅ Uploaded model answer: ${modelAnswerUrl}`);

    // ── Step 6: Save Cloudinary URLs to exam document ─────────────────────
    exam.questionPaperUrl = questionPaperUrl;
    exam.modelAnswerUrl = modelAnswerUrl;

    if (req.body.customPrompt) {
      exam.customPrompt = req.body.customPrompt;
    }

    await exam.save();

    // ── Step 7: Send both OCR texts to Groq LLM ───────────────────────────
    console.log('🤖 Sending to Groq LLM for question mapping...');

    const extractedQuestions = await extractQuestionsFromText(
      qpOcrResult.extractedText,
      maOcrResult.extractedText,
      exam.defaultScheme
    );

    console.log(`✅ LLM extracted ${extractedQuestions.length} questions`);

    // ── Step 8: Return results to frontend ────────────────────────────────
    return res.status(200).json({
      success: true,
      questions: extractedQuestions,
      questionPaperConfidence: qpOcrResult.averageConfidence,
      modelAnswerConfidence: maOcrResult.averageConfidence,
    });

  } catch (error) {
    console.error('❌ processPapers error:', error.message);
    next(error);
  } finally {
    // ── Cleanup: delete any local temp files that were not already deleted ─
    // This handles the case where OCR failed before uploadToCloudinary ran
    for (const filePath of tempFilesToCleanup) {
      try {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`🧹 Cleaned up temp file: ${filePath}`);
        }
      } catch (cleanupError) {
        console.warn(`⚠️  Could not clean up temp file ${filePath}: ${cleanupError.message}`);
      }
    }
  }
};

/**
 * POST /api/exams/:examId/questions
 * Saves the professor-verified questions to MongoDB after they confirm the table.
 */
const saveQuestions = async (req, res, next) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a non-empty array of questions',
      });
    }

    const exam = await Exam.findById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Delete existing questions first — professor may have re-processed the papers
    await Question.deleteMany({ examId: req.params.examId });

    const questionsWithExamId = questions.map((q) => ({
      ...q,
      examId: req.params.examId,
    }));

    const savedQuestions = await Question.insertMany(questionsWithExamId);

    exam.status = 'ready';
    await exam.save();

    console.log(`✅ Saved ${savedQuestions.length} questions for exam: ${exam.title}`);

    return res.status(201).json({
      success: true,
      count: savedQuestions.length,
      questions: savedQuestions,
    });

  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/exams/:examId/questions
 * Returns all questions for an exam sorted by question number.
 */
const getQuestions = async (req, res, next) => {
  try {
    const exam = await Exam.findById(req.params.examId);

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const questions = await Question.find({ examId: req.params.examId })
      .sort({ questionNumber: 1 });

    return res.status(200).json({
      success: true,
      count: questions.length,
      questions,
    });

  } catch (error) {
    next(error);
  }
};

module.exports = { processPapers, saveQuestions, getQuestions };