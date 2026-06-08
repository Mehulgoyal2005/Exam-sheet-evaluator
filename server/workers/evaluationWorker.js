// server/workers/evaluationWorker.js
// Uses a simple in-memory queue instead of Bull+Redis for local development.
// Upstash Redis does not support the blocking commands Bull needs (BRPOPLPUSH).
// In production on Render, we will use a proper Redis instance.
// Module 8 will replace the processJob function body with real OCR + LLM logic.

const Submission = require('../models/Submission');

let _io = null;

const initializeWorker = (io) => {
  _io = io;
  console.log('⚡ Evaluation worker initialized with Socket.io');
};

// ─── IN-MEMORY QUEUE ─────────────────────────────────────
// A simple array acting as a queue. Jobs are added by uploadSheets controller
// and processed one at a time by the worker loop below.
// This works perfectly for development and single-server production deployments.
const jobQueue = [];
let isProcessing = false;

// ─── JOB PROCESSOR ───────────────────────────────────────
const processJob = async (jobData) => {
  const { submissionId, examId, rollNumber } = jobData;

  console.log(`\n🔄 [Worker] Starting job for roll number: ${rollNumber}`);

  try {
    await Submission.findByIdAndUpdate(submissionId, { status: 'processing' });

    if (_io) {
      _io.to(examId).emit('submission-status-update', {
        submissionId,
        rollNumber,
        status: 'processing',
      });
    }

    // Simulate work — Module 8 replaces this with real OCR + LLM
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const updatedSubmission = await Submission.findByIdAndUpdate(
      submissionId,
      { status: 'completed', totalMarksAwarded: 0, percentage: 0 },
      { new: true }
    );

    if (_io) {
      _io.to(examId).emit('submission-status-update', {
        submissionId,
        rollNumber,
        status: 'completed',
        totalMarksAwarded: updatedSubmission.totalMarksAwarded,
        percentage: updatedSubmission.percentage,
      });
    }

    console.log(`✅ [Worker] Completed job for roll number: ${rollNumber}`);

  } catch (error) {
    console.error(`❌ [Worker] Job failed for roll number: ${rollNumber} — ${error.message}`);

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
// Runs continuously — picks up one job at a time, processes it, then picks the next.
// isProcessing flag prevents two jobs running simultaneously.
const runQueueLoop = async () => {
  if (isProcessing || jobQueue.length === 0) return;

  isProcessing = true;
  const job = jobQueue.shift(); // Take first job from queue

  try {
    await processJob(job);
  } catch (error) {
    console.error(`❌ [Queue] Unhandled error in processJob: ${error.message}`);
  } finally {
    isProcessing = false;
    // Check if more jobs are waiting
    if (jobQueue.length > 0) {
      runQueueLoop();
    }
  }
};

// ─── ADD JOB ─────────────────────────────────────────────
// Called by submissionController instead of evaluationQueue.add()
// Adds job to in-memory array and triggers the queue loop
const addJob = (jobData) => {
  jobQueue.push(jobData);
  console.log(`📋 [Queue] Job added for: ${jobData.rollNumber} — queue length: ${jobQueue.length}`);
  // Use setImmediate so the HTTP response is sent BEFORE processing starts
  // This means the professor sees the Queued status before Processing starts
  setImmediate(runQueueLoop);
};

console.log('📋 In-memory evaluation queue ready');

module.exports = { addJob, initializeWorker };