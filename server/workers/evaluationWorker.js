// server/workers/evaluationWorker.js

const fs = require('fs');
const path = require('path');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const { downloadFromCloudinary } = require('../config/cloudinary');
const { callOcrService } = require('../utils/ocrService');
const { mapAnswersToQuestions, evaluateStudentAnswer } = require('../utils/llm');

// OCR confidence threshold — below this value the answer is flagged as low confidence
const OCR_CONFIDENCE_THRESHOLD = 0.50;

let _io = null;

const initializeWorker = (io) => {
  _io = io;
  console.log('⚡ Evaluation worker initialized with Socket.io');
};

// ─── IN-MEMORY QUEUE ─────────────────────────────────────
const jobQueue = [];
let isProcessing = false;

// ─── REAL JOB PROCESSOR ──────────────────────────────────
// This replaces the placeholder from Module 7.
// It runs the full evaluation pipeline for one student's answer sheet.
const processJob = async (jobData) => {
  const { submissionId, examId, rollNumber } = jobData;

  console.log(`\n🎓 [Worker] Starting evaluation for: ${rollNumber}`);

  // Temp file path — we download the student PDF here, OCR it, then delete it
  const tempFilePath = path.join(
    __dirname,
    '..',
    'temp',
    `${rollNumber}-${Date.now()}.pdf`
  );

  try {
    // ── Step 1: Load all data needed for evaluation ────────────────────────
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      throw new Error(`Exam not found: ${examId}`);
    }

    // Get all questions sorted by questionNumber ascending
    const questions = await Question.find({ examId }).sort({ questionNumber: 1 });
    if (questions.length === 0) {
      throw new Error(`No questions found for exam: ${examId}`);
    }

    console.log(`  📋 Found ${questions.length} questions for exam: ${exam.title}`);

    // ── Step 2: Mark as processing ─────────────────────────────────────────
    await Submission.findByIdAndUpdate(submissionId, { status: 'processing' });

    if (_io) {
      _io.to(examId).emit('submission-status-update', {
        submissionId,
        rollNumber,
        status: 'processing',
      });
    }

    // ── Step 3: Download student PDF from Cloudinary to local temp file ────
    // We cannot run OCR on a Cloudinary URL directly — we need a local file path
    console.log(`  ⬇️  Downloading answer sheet for: ${rollNumber}`);
    await downloadFromCloudinary(submission.answerSheetUrl, tempFilePath);

    // ── Step 4: Run OCR on the downloaded PDF ──────────────────────────────
    // callOcrService sends the PDF to the Python FastAPI service
    // and returns extractedText + averageConfidence
    console.log(`  🔍 Running OCR on answer sheet for: ${rollNumber}`);
    const ocrResult = await callOcrService(tempFilePath);

    const { extractedText, averageConfidence } = ocrResult;
    console.log(`  📊 OCR confidence: ${averageConfidence} | Text length: ${extractedText.length} chars`);

    // ── Step 5: Map OCR text to question numbers using LLM ─────────────────
    // The OCR gives us one big blob of text — this step splits it by question
    // Returns: { "1": "answer text", "2": "answer text", ... }
    console.log(`  🤖 Mapping answers to questions for: ${rollNumber}`);
    const answerMap = await mapAnswersToQuestions(extractedText, questions);

    // ── Step 6: Delete temp file — no longer needed after OCR ─────────────
    try {
      await fs.promises.unlink(tempFilePath);
      console.log(`  🧹 Deleted temp file for: ${rollNumber}`);
    } catch (unlinkError) {
      console.warn(`  ⚠️  Could not delete temp file: ${unlinkError.message}`);
    }

    // ── Step 7: Evaluate each question ────────────────────────────────────
    // One LLM call per question — gives reliable structured JSON every time
    console.log(`  ⚖️  Evaluating ${questions.length} questions for: ${rollNumber}`);

    const evaluationDocs = [];

    for (const question of questions) {
      // Get the student's answer for this question from the map
      // Use empty string if the LLM could not find an answer
      const studentAnswerText = answerMap[String(question.questionNumber)] || '';

      console.log(
        `    Q${question.questionNumber}: answer length = ${studentAnswerText.length} chars`
      );

      try {
        // Call LLM to evaluate this one question
        // evaluateStudentAnswer signature: (questionText, modelAnswer, studentAnswerText, marks, scheme, customPrompt)
        const evalResult = await evaluateStudentAnswer(
          question.questionText,
          question.modelAnswer,
          studentAnswerText,
          question.marks,
          question.scheme,
          exam.customPrompt || ''
        );

        // isLowConfidence is true if the whole sheet's OCR confidence is below 0.50
        // We use the sheet-level confidence as an approximation per question
        const isLowConfidence = averageConfidence < OCR_CONFIDENCE_THRESHOLD;

        // Create the Evaluation document in MongoDB
        const evaluation = await Evaluation.create({
          submissionId,
          questionId: question._id,
          questionNumber: question.questionNumber,
          studentAnswerText,
          marksAwarded: evalResult.marksAwarded,
          maxMarks: question.marks,
          correctParts: evalResult.correctParts,
          wrongParts: evalResult.wrongParts,
          aiFeedback: evalResult.feedback,
          ocrConfidence: averageConfidence,
          isLowConfidence,
        });

        evaluationDocs.push(evaluation);

        console.log(
          `    ✅ Q${question.questionNumber}: ${evalResult.marksAwarded}/${question.marks} marks`
        );

      } catch (questionError) {
        // If one question evaluation fails, save 0 marks and continue
        // We do not let one question failure abort the whole student evaluation
        console.error(
          `    ❌ Q${question.questionNumber} evaluation failed: ${questionError.message}`
        );

        const evaluation = await Evaluation.create({
          submissionId,
          questionId: question._id,
          questionNumber: question.questionNumber,
          studentAnswerText,
          marksAwarded: 0,
          maxMarks: question.marks,
          correctParts: '',
          wrongParts: 'Evaluation failed due to a processing error',
          aiFeedback: `Could not evaluate this answer: ${questionError.message}`,
          ocrConfidence: averageConfidence,
          isLowConfidence: true,
        });

        evaluationDocs.push(evaluation);
      }
    }

    // ── Step 8: Calculate totals and update Submission ─────────────────────
    const totalMarksAwarded = evaluationDocs.reduce(
      (sum, e) => sum + e.marksAwarded,
      0
    );

    const percentage = parseFloat(
      ((totalMarksAwarded / exam.totalMarks) * 100).toFixed(2)
    );

    // isFlagged is true if ANY question had low OCR confidence
    const isFlagged = evaluationDocs.some((e) => e.isLowConfidence);

    await Submission.findByIdAndUpdate(submissionId, {
      status: 'completed',
      totalMarksAwarded,
      percentage,
      isFlagged,
    });

    console.log(
      `  ✅ [Worker] Completed: ${rollNumber} — ${totalMarksAwarded}/${exam.totalMarks} (${percentage}%)`
    );

    // ── Step 9: Emit completion event with real marks ──────────────────────
    if (_io) {
      _io.to(examId).emit('submission-status-update', {
        submissionId,
        rollNumber,
        status: 'completed',
        totalMarksAwarded,
        totalMarks: exam.totalMarks,
        percentage,
        isFlagged,
      });
    }

  } catch (error) {
    console.error(
      `  ❌ [Worker] Evaluation failed for ${rollNumber}: ${error.message}`
    );

    // Clean up temp file if it still exists after an error
    try {
      if (fs.existsSync(tempFilePath)) {
        await fs.promises.unlink(tempFilePath);
      }
    } catch (e) {
      // ignore cleanup errors
    }

    // Mark submission as failed with error message stored
    await Submission.findByIdAndUpdate(submissionId, {
      status: 'failed',
      processingError: error.message,
    });

    if (_io) {
      _io.to(examId).emit('submission-status-update', {
        submissionId,
        rollNumber,
        status: 'failed',
        error: error.message,
      });
    }
  }
};

// ─── QUEUE LOOP ───────────────────────────────────────────
// Picks one job at a time, processes it, then picks the next.
// Concurrency of 1 prevents Groq rate limit errors from parallel LLM calls.
const runQueueLoop = async () => {
  if (isProcessing || jobQueue.length === 0) return;

  isProcessing = true;
  const job = jobQueue.shift();

  try {
    await processJob(job);
  } catch (error) {
    console.error(`❌ [Queue] Unhandled error: ${error.message}`);
  } finally {
    isProcessing = false;
    if (jobQueue.length > 0) {
      runQueueLoop();
    }
  }
};

// ─── ADD JOB ─────────────────────────────────────────────
const addJob = (jobData) => {
  jobQueue.push(jobData);
  console.log(
    `📋 [Queue] Job added for: ${jobData.rollNumber} — queue length: ${jobQueue.length}`
  );
  setImmediate(runQueueLoop);
};

console.log('📋 In-memory evaluation queue ready');

module.exports = { addJob, initializeWorker };