// server/controllers/submissionController.js

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const streamifier = require('streamifier');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const { cloudinary } = require('../config/cloudinary');
const { addJob } = require('../workers/evaluationWorker');

// ─── HELPER: Upload a Buffer to Cloudinary ────────────────
// Cloudinary's regular upload() only accepts file paths.
// For buffers (like ZIP entries in memory) we must use upload_stream.
// We wrap it in a Promise so we can await it cleanly.
const uploadBufferToCloudinary = (buffer, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'raw',
        type: 'upload',
        public_id: publicId,
        overwrite: true,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
        } else {
          resolve(result.secure_url);
        }
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// ─── UPLOAD SHEETS ────────────────────────────────────────
// POST /api/exams/:examId/submissions/upload
const uploadSheets = async (req, res, next) => {
  try {
    const { examId } = req.params;

    // ── Step 1: Validate exam ──────────────────────────────────────────────
    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this exam',
      });
    }

    if (exam.status === 'setup') {
      return res.status(400).json({
        success: false,
        message: 'Please complete exam setup and confirm questions before uploading student sheets.',
      });
    }

    // ── Step 2: Check files received ──────────────────────────────────────
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded. Please upload a ZIP or individual PDF files.',
      });
    }

    // ── Step 3: Determine ZIP or individual PDFs ───────────────────────────
    const isZip =
      req.files.length === 1 &&
      req.files[0].originalname.toLowerCase().endsWith('.zip');

    const pdfsToProcess = [];

    if (isZip) {
      const zipBuffer = await fs.promises.readFile(req.files[0].path);
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryName = path.basename(entry.entryName);
        if (!entryName.toLowerCase().endsWith('.pdf')) continue;

        pdfsToProcess.push({
          filename: entryName,
          buffer: entry.getData(),
        });
      }

      try {
        await fs.promises.unlink(req.files[0].path);
      } catch (e) {
        console.warn(`⚠️  Could not delete ZIP temp file: ${e.message}`);
      }

    } else {
      for (const file of req.files) {
        if (!file.originalname.toLowerCase().endsWith('.pdf')) continue;

        const buffer = await fs.promises.readFile(file.path);
        pdfsToProcess.push({
          filename: file.originalname,
          buffer,
        });

        try {
          await fs.promises.unlink(file.path);
        } catch (e) {
          console.warn(`⚠️  Could not delete temp file ${file.path}: ${e.message}`);
        }
      }
    }

    if (pdfsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid PDF files found. Ensure files are named by roll number (e.g. 2021CSE045.pdf).',
      });
    }

    console.log(`📂 Processing ${pdfsToProcess.length} student PDF(s) for exam: ${exam.title}`);

    // ── Step 4: Process each PDF ──────────────────────────────────────────
    const results = [];
    const io = req.app.get('io');

    for (const { filename, buffer } of pdfsToProcess) {
      const rollNumber = filename.replace(/\.pdf$/i, '').trim();

      if (!rollNumber) {
        console.warn(`⚠️  Skipping file with empty roll number: ${filename}`);
        continue;
      }

      try {
        console.log(`  ☁️  Uploading ${rollNumber}...`);

        const cloudinaryFolder = `evalai/student-sheets/${examId}`;
        const answerSheetUrl = await uploadBufferToCloudinary(
          buffer,
          cloudinaryFolder,
          rollNumber
        );

        console.log(`  ✅ Uploaded: ${rollNumber} → ${answerSheetUrl}`);

        // Upsert — create new or update existing submission for this roll number
        const submission = await Submission.findOneAndUpdate(
          { examId, rollNumber },
          {
            examId,
            rollNumber,
            answerSheetUrl,
            status: 'queued',
            totalMarks: exam.totalMarks,
            totalMarksAwarded: 0,
            percentage: 0,
            isFlagged: false,
            processingError: null,
            reportDocxUrl: null,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        // Add to in-memory queue — replaces Bull queue
        addJob({
          submissionId: submission._id.toString(),
          examId: examId.toString(),
          rollNumber,
        });

        console.log(`  📋 Queued job for: ${rollNumber}`);

        // Emit socket event so the table row appears immediately in the browser
        if (io) {
          io.to(examId).emit('submission-queued', {
            _id: submission._id,
            rollNumber,
            status: 'queued',
            totalMarksAwarded: 0,
            percentage: 0,
          });
        }

        results.push({
          rollNumber,
          submissionId: submission._id,
          status: 'queued',
        });

      } catch (fileError) {
        console.error(`❌ Failed to process ${rollNumber}: ${fileError.message}`);
        results.push({
          rollNumber,
          status: 'error',
          error: fileError.message,
        });
      }
    }

    // ── Step 5: Update exam status to processing ──────────────────────────
    if (results.some((r) => r.status === 'queued')) {
      exam.status = 'processing';
      await exam.save();
    }

    console.log(
      `✅ Upload complete: ${results.filter((r) => r.status === 'queued').length} queued, ` +
      `${results.filter((r) => r.status === 'error').length} errors`
    );

    return res.status(200).json({
      success: true,
      count: results.filter((r) => r.status === 'queued').length,
      results,
    });

  } catch (error) {
    console.error('❌ uploadSheets error:', error.message);
    next(error);
  }
};

// ─── GET ALL SUBMISSIONS ──────────────────────────────────
// GET /api/exams/:examId/submissions
const getSubmissions = async (req, res, next) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const submissions = await Submission.find({ examId }).sort({ rollNumber: 1 });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET SINGLE SUBMISSION ────────────────────────────────
// GET /api/exams/:examId/submissions/:submissionId
const getSubmission = async (req, res, next) => {
  try {
    const { examId, submissionId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    if (submission.examId.toString() !== examId) {
      return res.status(403).json({
        success: false,
        message: 'Submission does not belong to this exam',
      });
    }

    return res.status(200).json({
      success: true,
      submission,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadSheets, getSubmissions, getSubmission };