
// server/workers/evaluationWorker.js

const fs = require('fs');
const path = require('path');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Exam = require('../models/Exam');
const Question = require('../models/Question');
const { downloadFromCloudinary, cloudinary } = require('../config/cloudinary');
const { callOcrService } = require('../utils/ocrService');
const { mapAnswersToQuestions, evaluateStudentAnswer } = require('../utils/llm');
const { generateStudentReport } = require('../utils/reportGenerator');
const streamifier = require('streamifier');

const OCR_CONFIDENCE_THRESHOLD = 0.50;

let _io = null;

const initializeWorker = (io) => {
  _io = io;
  console.log('⚡ Evaluation worker initialized with Socket.io');
};

const jobQueue = [];
let isProcessing = false;

// ─── HELPER: Upload a Buffer to Cloudinary ────────────────
// Same helper used in submissionController — uploads a Buffer as a raw file
const uploadBufferToCloudinary = (buffer, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        type: 'upload',
        public_id: publicId,
        overwrite: true,
        format: 'docx',
      },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// ─── HELPER: Finalize exam status when all submissions are done ────────────
// THE FIX: previously nothing ever moved the parent Exam from 'processing' to
// 'completed'. Each Submission was correctly marked 'completed', but the Exam
// itself stayed 'processing' forever, so the Previous Exams card kept showing
// "Processing" even after every student was evaluated.
//
// This helper runs after each submission reaches a terminal state (completed
// or failed). It checks whether ANY submission for this exam is still pending
// (queued or processing). If none are pending, the whole batch is done, so we
// flip the exam to 'completed'. We only do this for exams currently in
// 'processing' state — we never touch an exam in 'setup' or 'ready', and we
// don't downgrade an already-completed exam.
const finalizeExamIfDone = async (examId) => {
  try {
    // Count submissions still in a non-terminal state for this exam
    const pendingCount = await Submission.countDocuments({
      examId,
      status: { $in: ['queued', 'processing'] },
    });

    if (pendingCount > 0) {
      // Still more students to evaluate — leave the exam as 'processing'
      return;
    }

    // No pending submissions left. Make sure at least one submission exists
    // and that the exam is currently 'processing' before we mark it completed.
    const exam = await Exam.findById(examId);
    if (!exam) return;

    if (exam.status === 'processing') {
      const totalSubmissions = await Submission.countDocuments({ examId });
      if (totalSubmissions === 0) {
        // Edge case: no submissions at all — nothing to complete
        return;
      }

      exam.status = 'completed';
      await exam.save();

      console.log(`🏁 [Worker] Exam marked completed: ${exam.title} (${examId})`);

      // Tell any connected clients (e.g. the results / previous-exams pages)
      // that the exam itself is now complete, so the UI can update the badge.
      if (_io) {
        _io.to(examId.toString()).emit('exam-status-update', {
          examId: examId.toString(),
          status: 'completed',
        });
      }
    }
  } catch (error) {
    // Non-fatal — if this check fails we just log it. The exam can also be
    // finalized on a later submission completing, or fixed manually.
    console.warn(`⚠️  finalizeExamIfDone failed for exam ${examId}: ${error.message}`);
  }
};

// ─── REAL JOB PROCESSOR ──────────────────────────────────
const processJob = async (jobData) => {
  const { submissionId, examId, rollNumber } = jobData;

  console.log(`\n🎓 [Worker] Starting evaluation for: ${rollNumber}`);

  const tempFilePath = path.join(
    __dirname, '..', 'temp', `${rollNumber}-${Date.now()}.pdf`
  );

  try {
    // ── Step 1: Load all data ──────────────────────────────────────────────
    const submission = await Submission.findById(submissionId);
    if (!submission) throw new Error(`Submission not found: ${submissionId}`);

    const exam = await Exam.findById(examId);
    if (!exam) throw new Error(`Exam not found: ${examId}`);

    const questions = await Question.find({ examId }).sort({ questionNumber: 1 });
    if (questions.length === 0) throw new Error(`No questions found for exam: ${examId}`);

    console.log(`  📋 Found ${questions.length} questions for exam: ${exam.title}`);

    // ── Step 2: Mark as processing ─────────────────────────────────────────
    await Submission.findByIdAndUpdate(submissionId, { status: 'processing' });

    if (_io) {
      _io.to(examId).emit('submission-status-update', {
        submissionId, rollNumber, status: 'processing',
      });
    }

    // ── Step 3: Download PDF from Cloudinary ───────────────────────────────
    console.log(`  ⬇️  Downloading answer sheet for: ${rollNumber}`);
    await downloadFromCloudinary(submission.answerSheetUrl, tempFilePath);

    // ── Step 4: Run OCR ────────────────────────────────────────────────────
    console.log(`  🔍 Running OCR on answer sheet for: ${rollNumber}`);
    const ocrResult = await callOcrService(tempFilePath);
    const { extractedText, averageConfidence } = ocrResult;
    console.log(`  📊 OCR confidence: ${averageConfidence} | Text: ${extractedText.length} chars`);

    // ── Step 5: Map answers to questions ──────────────────────────────────
    console.log(`  🤖 Mapping answers to questions for: ${rollNumber}`);
    const answerMap = await mapAnswersToQuestions(extractedText, questions);

    // ── Step 6: Delete temp file ───────────────────────────────────────────
    try {
      await fs.promises.unlink(tempFilePath);
      console.log(`  🧹 Deleted temp file for: ${rollNumber}`);
    } catch (e) {
      console.warn(`  ⚠️  Could not delete temp file: ${e.message}`);
    }

    // ── Step 7: Evaluate each question ────────────────────────────────────
    console.log(`  ⚖️  Evaluating ${questions.length} questions for: ${rollNumber}`);

    const evaluationDocs = [];

    for (const question of questions) {
      const studentAnswerText = answerMap[String(question.questionNumber)] || '';

      console.log(`    Q${question.questionNumber}: answer length = ${studentAnswerText.length} chars`);

      try {
        const evalResult = await evaluateStudentAnswer(
          question.questionText,
          question.modelAnswer,
          studentAnswerText,
          question.marks,
          question.scheme,
          exam.customPrompt || ''
        );

        const isLowConfidence = averageConfidence < OCR_CONFIDENCE_THRESHOLD;

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
        console.log(`    ✅ Q${question.questionNumber}: ${evalResult.marksAwarded}/${question.marks} marks`);

      } catch (questionError) {
        console.error(`    ❌ Q${question.questionNumber} failed: ${questionError.message}`);

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
    const totalMarksAwarded = evaluationDocs.reduce((sum, e) => sum + e.marksAwarded, 0);
    const percentage = parseFloat(((totalMarksAwarded / exam.totalMarks) * 100).toFixed(2));
    const isFlagged = evaluationDocs.some((e) => e.isLowConfidence);

    await Submission.findByIdAndUpdate(submissionId, {
      status: 'completed',
      totalMarksAwarded,
      percentage,
      isFlagged,
    });

    console.log(`  ✅ Marks calculated: ${rollNumber} — ${totalMarksAwarded}/${exam.totalMarks} (${percentage}%)`);

    // ── Step 8b: Generate DOCX report and upload to Cloudinary ────────────
    // This is non-fatal — if DOCX generation fails we log a warning and
    // continue. The professor can still download on demand from the report page.
    try {
      console.log(`  📄 Generating DOCX report for: ${rollNumber}`);

      // We need the full submission object with updated marks for the report
      const updatedSubmission = await Submission.findById(submissionId);

      const docxBuffer = await generateStudentReport(updatedSubmission, evaluationDocs, exam);

      const docxUrl = await uploadBufferToCloudinary(
        docxBuffer,
        `evalai/reports/${examId}`,
        rollNumber
      );

      await Submission.findByIdAndUpdate(submissionId, { reportDocxUrl: docxUrl });

      console.log(`  📎 DOCX uploaded for: ${rollNumber} → ${docxUrl}`);

    } catch (docxError) {
      // Non-fatal — just log and continue
      console.warn(`  ⚠️  DOCX generation failed for ${rollNumber}: ${docxError.message}`);
    }

    // ── Step 9: Emit completion event ─────────────────────────────────────
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

    // ── Step 10: Finalize exam if this was the last pending submission ────
    // THE FIX — flip the parent Exam to 'completed' once no submissions remain
    // queued or processing.
    await finalizeExamIfDone(examId);

  } catch (error) {
    console.error(`  ❌ [Worker] Evaluation failed for ${rollNumber}: ${error.message}`);

    try {
      if (fs.existsSync(tempFilePath)) await fs.promises.unlink(tempFilePath);
    } catch (e) {}

    await Submission.findByIdAndUpdate(submissionId, {
      status: 'failed',
      processingError: error.message,
    });

    if (_io) {
      _io.to(examId).emit('submission-status-update', {
        submissionId, rollNumber, status: 'failed', error: error.message,
      });
    }

    // ── Finalize exam even on failure ─────────────────────────────────────
    // A failed LAST submission must still finalize the exam — otherwise one
    // failed student would leave the exam stuck on 'processing' forever.
    await finalizeExamIfDone(examId);
  }
};

// ─── QUEUE LOOP ───────────────────────────────────────────
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
    if (jobQueue.length > 0) runQueueLoop();
  }
};

// ─── ADD JOB ─────────────────────────────────────────────
const addJob = (jobData) => {
  jobQueue.push(jobData);
  console.log(`📋 [Queue] Job added for: ${jobData.rollNumber} — queue length: ${jobQueue.length}`);
  setImmediate(runQueueLoop);
};

console.log('📋 In-memory evaluation queue ready');

module.exports = { addJob, initializeWorker };