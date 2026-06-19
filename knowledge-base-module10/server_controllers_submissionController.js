// // server/controllers/submissionController.js

// const fs = require('fs');
// const path = require('path');
// const AdmZip = require('adm-zip');
// const streamifier = require('streamifier');
// const Exam = require('../models/Exam');
// const Submission = require('../models/Submission');
// const Evaluation = require('../models/Evaluation');
// const { cloudinary } = require('../config/cloudinary');
// const { addJob } = require('../workers/evaluationWorker');

// // ─── HELPER: Upload a Buffer to Cloudinary ────────────────
// const uploadBufferToCloudinary = (buffer, folder, publicId) => {
//   return new Promise((resolve, reject) => {
//     const uploadStream = cloudinary.uploader.upload_stream(
//       {
//         folder,
//         resource_type: 'raw',
//         type: 'upload',
//         public_id: publicId,
//         overwrite: true,
//       },
//       (error, result) => {
//         if (error) {
//           reject(new Error(`Cloudinary upload failed: ${error.message}`));
//         } else {
//           resolve(result.secure_url);
//         }
//       }
//     );
//     streamifier.createReadStream(buffer).pipe(uploadStream);
//   });
// };

// // ─── UPLOAD SHEETS ────────────────────────────────────────
// const uploadSheets = async (req, res, next) => {
//   try {
//     const { examId } = req.params;

//     const exam = await Exam.findById(examId);
//     if (!exam) {
//       return res.status(404).json({ success: false, message: 'Exam not found' });
//     }
//     if (exam.professorId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized to access this exam' });
//     }
//     if (exam.status === 'setup') {
//       return res.status(400).json({
//         success: false,
//         message: 'Please complete exam setup and confirm questions before uploading student sheets.',
//       });
//     }

//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No files uploaded. Please upload a ZIP or individual PDF files.',
//       });
//     }

//     const isZip =
//       req.files.length === 1 &&
//       req.files[0].originalname.toLowerCase().endsWith('.zip');

//     const pdfsToProcess = [];

//     if (isZip) {
//       const zipBuffer = await fs.promises.readFile(req.files[0].path);
//       const zip = new AdmZip(zipBuffer);
//       const entries = zip.getEntries();

//       for (const entry of entries) {
//         if (entry.isDirectory) continue;
//         const entryName = path.basename(entry.entryName);
//         if (!entryName.toLowerCase().endsWith('.pdf')) continue;
//         pdfsToProcess.push({ filename: entryName, buffer: entry.getData() });
//       }

//       try { await fs.promises.unlink(req.files[0].path); } catch (e) {}

//     } else {
//       for (const file of req.files) {
//         if (!file.originalname.toLowerCase().endsWith('.pdf')) continue;
//         const buffer = await fs.promises.readFile(file.path);
//         pdfsToProcess.push({ filename: file.originalname, buffer });
//         try { await fs.promises.unlink(file.path); } catch (e) {}
//       }
//     }

//     if (pdfsToProcess.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No valid PDF files found. Ensure files are named by roll number (e.g. 2021CSE045.pdf).',
//       });
//     }

//     console.log(`📂 Processing ${pdfsToProcess.length} student PDF(s) for exam: ${exam.title}`);

//     const results = [];
//     const io = req.app.get('io');

//     for (const { filename, buffer } of pdfsToProcess) {
//       const rollNumber = filename.replace(/\.pdf$/i, '').trim();
//       if (!rollNumber) continue;

//       try {
//         console.log(`  ☁️  Uploading ${rollNumber}...`);
//         const cloudinaryFolder = `evalai/student-sheets/${examId}`;
//         const answerSheetUrl = await uploadBufferToCloudinary(buffer, cloudinaryFolder, rollNumber);
//         console.log(`  ✅ Uploaded: ${rollNumber}`);

//         const submission = await Submission.findOneAndUpdate(
//           { examId, rollNumber },
//           {
//             examId,
//             rollNumber,
//             answerSheetUrl,
//             status: 'queued',
//             totalMarks: exam.totalMarks,
//             totalMarksAwarded: 0,
//             percentage: 0,
//             isFlagged: false,
//             processingError: null,
//             reportDocxUrl: null,
//           },
//           { upsert: true, new: true, setDefaultsOnInsert: true }
//         );

//         addJob({
//           submissionId: submission._id.toString(),
//           examId: examId.toString(),
//           rollNumber,
//         });

//         if (io) {
//           io.to(examId).emit('submission-queued', {
//             _id: submission._id,
//             rollNumber,
//             status: 'queued',
//             totalMarksAwarded: 0,
//             percentage: 0,
//           });
//         }

//         results.push({ rollNumber, submissionId: submission._id, status: 'queued' });

//       } catch (fileError) {
//         console.error(`❌ Failed to process ${rollNumber}: ${fileError.message}`);
//         results.push({ rollNumber, status: 'error', error: fileError.message });
//       }
//     }

//     if (results.some((r) => r.status === 'queued')) {
//       exam.status = 'processing';
//       await exam.save();
//     }

//     return res.status(200).json({
//       success: true,
//       count: results.filter((r) => r.status === 'queued').length,
//       results,
//     });

//   } catch (error) {
//     console.error('❌ uploadSheets error:', error.message);
//     next(error);
//   }
// };

// // ─── GET ALL SUBMISSIONS ──────────────────────────────────
// const getSubmissions = async (req, res, next) => {
//   try {
//     const { examId } = req.params;

//     const exam = await Exam.findById(examId);
//     if (!exam) {
//       return res.status(404).json({ success: false, message: 'Exam not found' });
//     }
//     if (exam.professorId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized' });
//     }

//     const submissions = await Submission.find({ examId }).sort({ rollNumber: 1 });

//     return res.status(200).json({
//       success: true,
//       count: submissions.length,
//       submissions,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ─── GET SINGLE SUBMISSION ────────────────────────────────
// // Updated in Module 8 — now also returns all Evaluation documents for this
// // submission sorted by questionNumber. This is what the Student Report page
// // in Module 10 needs to show question-by-question results.
// const getSubmission = async (req, res, next) => {
//   try {
//     const { examId, submissionId } = req.params;

//     const exam = await Exam.findById(examId);
//     if (!exam) {
//       return res.status(404).json({ success: false, message: 'Exam not found' });
//     }
//     if (exam.professorId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized' });
//     }

//     const submission = await Submission.findById(submissionId);
//     if (!submission) {
//       return res.status(404).json({ success: false, message: 'Submission not found' });
//     }
//     if (submission.examId.toString() !== examId) {
//       return res.status(403).json({
//         success: false,
//         message: 'Submission does not belong to this exam',
//       });
//     }

//     // Fetch all evaluation documents for this submission sorted by question number
//     // This gives the Student Report page all the data it needs in one request
//     const evaluations = await Evaluation.find({ submissionId })
//       .sort({ questionNumber: 1 });

//     return res.status(200).json({
//       success: true,
//       submission,
//       evaluations,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// module.exports = { uploadSheets, getSubmissions, getSubmission };

// server/controllers/submissionController.js




























// // server/controllers/submissionController.js

// const fs = require('fs');
// const path = require('path');
// const AdmZip = require('adm-zip');
// const archiver = require('archiver');
// const streamifier = require('streamifier');
// const axios = require('axios');
// const Exam = require('../models/Exam');
// const Submission = require('../models/Submission');
// const Evaluation = require('../models/Evaluation');
// const { cloudinary } = require('../config/cloudinary');
// const { addJob } = require('../workers/evaluationWorker');
// const { generateStudentReport } = require('../utils/reportGenerator');
// const { generateExcelReport } = require('../utils/excelGenerator');
// const { downloadFromCloudinary } = require('../config/cloudinary');

// // ─── HELPER: Upload a Buffer to Cloudinary ────────────────
// const uploadBufferToCloudinary = (buffer, folder, publicId) => {
//   return new Promise((resolve, reject) => {
//     const uploadStream = cloudinary.uploader.upload_stream(
//       { folder, resource_type: 'raw', type: 'upload', public_id: publicId, overwrite: true },
//       (error, result) => {
//         if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
//         else resolve(result.secure_url);
//       }
//     );
//     streamifier.createReadStream(buffer).pipe(uploadStream);
//   });
// };

// // ─── UPLOAD SHEETS ────────────────────────────────────────
// const uploadSheets = async (req, res, next) => {
//   try {
//     const { examId } = req.params;

//     const exam = await Exam.findById(examId);
//     if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
//     if (exam.professorId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized to access this exam' });
//     }
//     if (exam.status === 'setup') {
//       return res.status(400).json({
//         success: false,
//         message: 'Please complete exam setup and confirm questions before uploading student sheets.',
//       });
//     }
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No files uploaded. Please upload a ZIP or individual PDF files.',
//       });
//     }

//     const isZip =
//       req.files.length === 1 &&
//       req.files[0].originalname.toLowerCase().endsWith('.zip');

//     const pdfsToProcess = [];

//     if (isZip) {
//       const zipBuffer = await fs.promises.readFile(req.files[0].path);
//       const zip = new AdmZip(zipBuffer);
//       const entries = zip.getEntries();
//       for (const entry of entries) {
//         if (entry.isDirectory) continue;
//         const entryName = path.basename(entry.entryName);
//         if (!entryName.toLowerCase().endsWith('.pdf')) continue;
//         pdfsToProcess.push({ filename: entryName, buffer: entry.getData() });
//       }
//       try { await fs.promises.unlink(req.files[0].path); } catch (e) {}
//     } else {
//       for (const file of req.files) {
//         if (!file.originalname.toLowerCase().endsWith('.pdf')) continue;
//         const buffer = await fs.promises.readFile(file.path);
//         pdfsToProcess.push({ filename: file.originalname, buffer });
//         try { await fs.promises.unlink(file.path); } catch (e) {}
//       }
//     }

//     if (pdfsToProcess.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No valid PDF files found. Ensure files are named by roll number (e.g. 2021CSE045.pdf).',
//       });
//     }

//     console.log(`📂 Processing ${pdfsToProcess.length} student PDF(s) for exam: ${exam.title}`);

//     const results = [];
//     const io = req.app.get('io');

//     for (const { filename, buffer } of pdfsToProcess) {
//       const rollNumber = filename.replace(/\.pdf$/i, '').trim();
//       if (!rollNumber) continue;

//       try {
//         console.log(`  ☁️  Uploading ${rollNumber}...`);
//         const cloudinaryFolder = `evalai/student-sheets/${examId}`;
//         const answerSheetUrl = await uploadBufferToCloudinary(buffer, cloudinaryFolder, rollNumber);
//         console.log(`  ✅ Uploaded: ${rollNumber}`);

//         const submission = await Submission.findOneAndUpdate(
//           { examId, rollNumber },
//           {
//             examId, rollNumber, answerSheetUrl,
//             status: 'queued', totalMarks: exam.totalMarks,
//             totalMarksAwarded: 0, percentage: 0,
//             isFlagged: false, processingError: null, reportDocxUrl: null,
//           },
//           { upsert: true, new: true, setDefaultsOnInsert: true }
//         );

//         addJob({
//           submissionId: submission._id.toString(),
//           examId: examId.toString(),
//           rollNumber,
//         });

//         if (io) {
//           io.to(examId).emit('submission-queued', {
//             _id: submission._id, rollNumber,
//             status: 'queued', totalMarksAwarded: 0, percentage: 0,
//           });
//         }

//         results.push({ rollNumber, submissionId: submission._id, status: 'queued' });

//       } catch (fileError) {
//         console.error(`❌ Failed to process ${rollNumber}: ${fileError.message}`);
//         results.push({ rollNumber, status: 'error', error: fileError.message });
//       }
//     }

//     if (results.some((r) => r.status === 'queued')) {
//       exam.status = 'processing';
//       await exam.save();
//     }

//     return res.status(200).json({
//       success: true,
//       count: results.filter((r) => r.status === 'queued').length,
//       results,
//     });

//   } catch (error) {
//     console.error('❌ uploadSheets error:', error.message);
//     next(error);
//   }
// };

// // ─── GET ALL SUBMISSIONS ──────────────────────────────────
// const getSubmissions = async (req, res, next) => {
//   try {
//     const { examId } = req.params;
//     const exam = await Exam.findById(examId);
//     if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
//     if (exam.professorId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized' });
//     }
//     const submissions = await Submission.find({ examId }).sort({ rollNumber: 1 });
//     return res.status(200).json({ success: true, count: submissions.length, submissions });
//   } catch (error) {
//     next(error);
//   }
// };

// // ─── GET SINGLE SUBMISSION ────────────────────────────────
// const getSubmission = async (req, res, next) => {
//   try {
//     const { examId, submissionId } = req.params;
//     const exam = await Exam.findById(examId);
//     if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
//     if (exam.professorId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized' });
//     }
//     const submission = await Submission.findById(submissionId);
//     if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
//     if (submission.examId.toString() !== examId) {
//       return res.status(403).json({ success: false, message: 'Submission does not belong to this exam' });
//     }
//     const evaluations = await Evaluation.find({ submissionId }).sort({ questionNumber: 1 });
//     return res.status(200).json({ success: true, submission, evaluations });
//   } catch (error) {
//     next(error);
//   }
// };

// // ─── DOWNLOAD STUDENT REPORT ──────────────────────────────
// // GET /api/exams/:examId/submissions/:submissionId/download-report
// // If the DOCX was already generated and saved to Cloudinary, redirect there.
// // If not (e.g. generation failed during evaluation), generate it on the fly
// // and stream it directly to the browser.
// const downloadStudentReport = async (req, res, next) => {
//   try {
//     const { examId, submissionId } = req.params;

//     const exam = await Exam.findById(examId);
//     if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
//     if (exam.professorId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized' });
//     }

//     const submission = await Submission.findById(submissionId);
//     if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

//     if (submission.status !== 'completed') {
//       return res.status(400).json({
//         success: false,
//         message: 'Report is not available yet — evaluation has not completed for this student.',
//       });
//     }

//     const evaluations = await Evaluation.find({ submissionId }).sort({ questionNumber: 1 });

//     // Generate fresh DOCX on the fly — always reflects latest marks including overrides
//     const docxBuffer = await generateStudentReport(submission, evaluations, exam);

//     const filename = `${submission.rollNumber}-report.docx`;

//     res.setHeader(
//       'Content-Type',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
//     );
//     res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
//     res.setHeader('Content-Length', docxBuffer.length);

//     return res.send(docxBuffer);

//   } catch (error) {
//     console.error('❌ downloadStudentReport error:', error.message);
//     next(error);
//   }
// };

// // ─── DOWNLOAD ALL REPORTS AS ZIP ─────────────────────────
// // GET /api/exams/:examId/download-all-reports
// // Generates a DOCX for each completed student and bundles them into a ZIP.
// // Uses archiver to stream the ZIP directly to the browser without saving to disk.
// const downloadAllReports = async (req, res, next) => {
//   try {
//     const { examId } = req.params;

//     const exam = await Exam.findById(examId);
//     if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
//     if (exam.professorId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized' });
//     }

//     // Only include completed submissions in the ZIP
//     const submissions = await Submission.find({
//       examId,
//       status: 'completed',
//     }).sort({ rollNumber: 1 });

//     if (submissions.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No completed submissions found for this exam.',
//       });
//     }

//     const safeTitle = exam.title.replace(/[^a-zA-Z0-9]/g, '_');
//     const zipFilename = `${safeTitle}-reports.zip`;

//     res.setHeader('Content-Type', 'application/zip');
//     res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);

//     // Create archiver ZIP stream and pipe it directly to the HTTP response
//     // This means we never store the full ZIP in memory — each file is written
//     // to the response as it is generated
//     const archive = archiver('zip', { zlib: { level: 6 } });

//     archive.on('error', (err) => {
//       console.error('❌ Archiver error:', err.message);
//       // Can't send a JSON error here since headers are already sent
//       // Just destroy the connection
//       res.destroy();
//     });

//     archive.pipe(res);

//     // Generate DOCX for each student and append to ZIP
//     for (const submission of submissions) {
//       try {
//         const evaluations = await Evaluation.find({
//           submissionId: submission._id,
//         }).sort({ questionNumber: 1 });

//         const docxBuffer = await generateStudentReport(submission, evaluations, exam);
//         const filename = `${submission.rollNumber}.docx`;

//         // archive.append() adds the buffer to the ZIP with the given filename
//         archive.append(docxBuffer, { name: filename });

//         console.log(`  📎 Added to ZIP: ${filename}`);

//       } catch (studentError) {
//         // Skip this student if their report fails — don't abort the whole ZIP
//         console.warn(
//           `  ⚠️  Skipped ${submission.rollNumber} in ZIP: ${studentError.message}`
//         );
//       }
//     }

//     // finalize() signals archiver to write the ZIP end-of-file markers
//     // After this, the ZIP is complete and the response is finished
//     await archive.finalize();

//   } catch (error) {
//     console.error('❌ downloadAllReports error:', error.message);
//     next(error);
//   }
// };

// // ─── DOWNLOAD EXCEL ───────────────────────────────────────
// // GET /api/exams/:examId/download-excel
// // Generates an Excel file with all students' marks and streams it to the browser.
// const downloadExcel = async (req, res, next) => {
//   try {
//     const { examId } = req.params;

//     const exam = await Exam.findById(examId);
//     if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
//     if (exam.professorId.toString() !== req.user._id.toString()) {
//       return res.status(403).json({ success: false, message: 'Not authorized' });
//     }

//     const submissions = await Submission.find({ examId }).sort({ rollNumber: 1 });

//     if (submissions.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No submissions found for this exam.',
//       });
//     }

//     const excelBuffer = await generateExcelReport(exam, submissions);

//     const safeTitle = exam.title.replace(/[^a-zA-Z0-9]/g, '_');
//     const filename = `${safeTitle}-results.xlsx`;

//     res.setHeader(
//       'Content-Type',
//       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//     );
//     res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
//     res.setHeader('Content-Length', excelBuffer.length);

//     return res.send(excelBuffer);

//   } catch (error) {
//     console.error('❌ downloadExcel error:', error.message);
//     next(error);
//   }
// };

// module.exports = {
//   uploadSheets,
//   getSubmissions,
//   getSubmission,
//   downloadStudentReport,
//   downloadAllReports,
//   downloadExcel,
// };



// server/controllers/submissionController.js

const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const streamifier = require('streamifier');
const axios = require('axios');
const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const { cloudinary } = require('../config/cloudinary');
const { addJob } = require('../workers/evaluationWorker');
const { generateStudentReport } = require('../utils/reportGenerator');
const { generateExcelReport } = require('../utils/excelGenerator');
const { downloadFromCloudinary } = require('../config/cloudinary');

// ─── HELPER: Upload a Buffer to Cloudinary ────────────────
const uploadBufferToCloudinary = (buffer, folder, publicId) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'raw', type: 'upload', public_id: publicId, overwrite: true },
      (error, result) => {
        if (error) reject(new Error(`Cloudinary upload failed: ${error.message}`));
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// ─── UPLOAD SHEETS ────────────────────────────────────────
const uploadSheets = async (req, res, next) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this exam' });
    }
    if (exam.status === 'setup') {
      return res.status(400).json({
        success: false,
        message: 'Please complete exam setup and confirm questions before uploading student sheets.',
      });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded. Please upload a ZIP or individual PDF files.',
      });
    }

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
        pdfsToProcess.push({ filename: entryName, buffer: entry.getData() });
      }
      try { await fs.promises.unlink(req.files[0].path); } catch (e) {}
    } else {
      for (const file of req.files) {
        if (!file.originalname.toLowerCase().endsWith('.pdf')) continue;
        const buffer = await fs.promises.readFile(file.path);
        pdfsToProcess.push({ filename: file.originalname, buffer });
        try { await fs.promises.unlink(file.path); } catch (e) {}
      }
    }

    if (pdfsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid PDF files found. Ensure files are named by roll number (e.g. 2021CSE045.pdf).',
      });
    }

    console.log(`📂 Processing ${pdfsToProcess.length} student PDF(s) for exam: ${exam.title}`);

    const results = [];
    const io = req.app.get('io');

    for (const { filename, buffer } of pdfsToProcess) {
      const rollNumber = filename.replace(/\.pdf$/i, '').trim();
      if (!rollNumber) continue;

      try {
        console.log(`  ☁️  Uploading ${rollNumber}...`);
        const cloudinaryFolder = `evalai/student-sheets/${examId}`;
        const answerSheetUrl = await uploadBufferToCloudinary(buffer, cloudinaryFolder, rollNumber);
        console.log(`  ✅ Uploaded: ${rollNumber}`);

        const submission = await Submission.findOneAndUpdate(
          { examId, rollNumber },
          {
            examId, rollNumber, answerSheetUrl,
            status: 'queued', totalMarks: exam.totalMarks,
            totalMarksAwarded: 0, percentage: 0,
            isFlagged: false, processingError: null, reportDocxUrl: null,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        addJob({
          submissionId: submission._id.toString(),
          examId: examId.toString(),
          rollNumber,
        });

        if (io) {
          io.to(examId).emit('submission-queued', {
            _id: submission._id, rollNumber,
            status: 'queued', totalMarksAwarded: 0, percentage: 0,
          });
        }

        results.push({ rollNumber, submissionId: submission._id, status: 'queued' });

      } catch (fileError) {
        console.error(`❌ Failed to process ${rollNumber}: ${fileError.message}`);
        results.push({ rollNumber, status: 'error', error: fileError.message });
      }
    }

    if (results.some((r) => r.status === 'queued')) {
      exam.status = 'processing';
      await exam.save();
    }

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
const getSubmissions = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const submissions = await Submission.find({ examId }).sort({ rollNumber: 1 });
    return res.status(200).json({ success: true, count: submissions.length, submissions });
  } catch (error) {
    next(error);
  }
};

// ─── GET SINGLE SUBMISSION ────────────────────────────────
const getSubmission = async (req, res, next) => {
  try {
    const { examId, submissionId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const submission = await Submission.findById(submissionId);
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
    if (submission.examId.toString() !== examId) {
      return res.status(403).json({ success: false, message: 'Submission does not belong to this exam' });
    }
    const evaluations = await Evaluation.find({ submissionId }).sort({ questionNumber: 1 });
    return res.status(200).json({ success: true, submission, evaluations });
  } catch (error) {
    next(error);
  }
};

// ─── DOWNLOAD STUDENT REPORT ──────────────────────────────
const downloadStudentReport = async (req, res, next) => {
  try {
    const { examId, submissionId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const submission = await Submission.findById(submissionId);
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
    if (submission.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Report is not available yet — evaluation has not completed for this student.',
      });
    }
    const evaluations = await Evaluation.find({ submissionId }).sort({ questionNumber: 1 });
    const docxBuffer = await generateStudentReport(submission, evaluations, exam);
    const filename = `${submission.rollNumber}-report.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', docxBuffer.length);
    return res.send(docxBuffer);
  } catch (error) {
    console.error('❌ downloadStudentReport error:', error.message);
    next(error);
  }
};

// ─── DOWNLOAD ALL REPORTS AS ZIP ─────────────────────────
const downloadAllReports = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const submissions = await Submission.find({ examId, status: 'completed' }).sort({ rollNumber: 1 });
    if (submissions.length === 0) {
      return res.status(400).json({ success: false, message: 'No completed submissions found for this exam.' });
    }
    const safeTitle = exam.title.replace(/[^a-zA-Z0-9]/g, '_');
    const zipFilename = `${safeTitle}-reports.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => { console.error('❌ Archiver error:', err.message); res.destroy(); });
    archive.pipe(res);
    for (const submission of submissions) {
      try {
        const evaluations = await Evaluation.find({ submissionId: submission._id }).sort({ questionNumber: 1 });
        const docxBuffer = await generateStudentReport(submission, evaluations, exam);
        archive.append(docxBuffer, { name: `${submission.rollNumber}.docx` });
        console.log(`  📎 Added to ZIP: ${submission.rollNumber}.docx`);
      } catch (studentError) {
        console.warn(`  ⚠️  Skipped ${submission.rollNumber} in ZIP: ${studentError.message}`);
      }
    }
    await archive.finalize();
  } catch (error) {
    console.error('❌ downloadAllReports error:', error.message);
    next(error);
  }
};

// ─── DOWNLOAD EXCEL ───────────────────────────────────────
const downloadExcel = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const submissions = await Submission.find({ examId }).sort({ rollNumber: 1 });
    if (submissions.length === 0) {
      return res.status(400).json({ success: false, message: 'No submissions found for this exam.' });
    }
    const excelBuffer = await generateExcelReport(exam, submissions);
    const safeTitle = exam.title.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${safeTitle}-results.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);
    return res.send(excelBuffer);
  } catch (error) {
    console.error('❌ downloadExcel error:', error.message);
    next(error);
  }
};

// ─── OVERRIDE QUESTION MARK ───────────────────────────────
// PATCH /api/exams/:examId/submissions/:submissionId/override-question
// Professor disagrees with an AI mark and changes it manually.
// We log the override and recalculate the student's total from scratch.
const overrideQuestion = async (req, res, next) => {
  try {
    const { examId, submissionId } = req.params;
    const { evaluationId, overriddenMark, overrideReason } = req.body;

    // ── Step 1: Validate exam ownership ───────────────────────────────────
    const exam = await Exam.findById(examId);
    if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // ── Step 2: Validate submission belongs to this exam ──────────────────
    const submission = await Submission.findById(submissionId);
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
    if (submission.examId.toString() !== examId) {
      return res.status(403).json({ success: false, message: 'Submission does not belong to this exam' });
    }

    // ── Step 3: Find and validate the evaluation ──────────────────────────
    const evaluation = await Evaluation.findById(evaluationId);
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation not found' });
    }
    // Make sure this evaluation belongs to this submission — not another student's
    if (evaluation.submissionId.toString() !== submissionId) {
      return res.status(403).json({
        success: false,
        message: 'Evaluation does not belong to this submission',
      });
    }

    // ── Step 4: Validate the new mark is within range ─────────────────────
    const newMark = Number(overriddenMark);
    if (isNaN(newMark) || newMark < 0 || newMark > evaluation.maxMarks) {
      return res.status(400).json({
        success: false,
        message: `Mark must be a number between 0 and ${evaluation.maxMarks}`,
      });
    }

    // ── Step 5: Save the override on the Evaluation document ──────────────
    await Evaluation.findByIdAndUpdate(evaluationId, {
      isOverridden: true,
      overriddenMark: newMark,
      overrideReason: overrideReason || '',
      overriddenAt: new Date(),
    });

    // ── Step 6: Recalculate total marks from all evaluations ───────────────
    // We re-fetch ALL evaluations fresh from DB so we have the latest state
    // For each evaluation: use overriddenMark if overridden, else marksAwarded
    const allEvaluations = await Evaluation.find({ submissionId }).sort({ questionNumber: 1 });

    const newTotalMarksAwarded = allEvaluations.reduce((sum, ev) => {
      return sum + (ev.isOverridden ? ev.overriddenMark : ev.marksAwarded);
    }, 0);

    // ── Step 7: Calculate new percentage ──────────────────────────────────
    const newPercentage = parseFloat(
      ((newTotalMarksAwarded / submission.totalMarks) * 100).toFixed(2)
    );

    // ── Step 8: Update Submission with recalculated totals ────────────────
    const updatedSubmission = await Submission.findByIdAndUpdate(
      submissionId,
      { totalMarksAwarded: newTotalMarksAwarded, percentage: newPercentage },
      { new: true }
    );

    console.log(
      `✏️  Override saved: Q${evaluation.questionNumber} → ${newMark}/${evaluation.maxMarks} | ` +
      `New total: ${newTotalMarksAwarded}/${submission.totalMarks} (${newPercentage}%)`
    );

    // ── Step 9: Return updated data ────────────────────────────────────────
    return res.status(200).json({
      success: true,
      submission: updatedSubmission,
      evaluations: allEvaluations,
    });

  } catch (error) {
    console.error('❌ overrideQuestion error:', error.message);
    next(error);
  }
};

module.exports = {
  uploadSheets,
  getSubmissions,
  getSubmission,
  downloadStudentReport,
  downloadAllReports,
  downloadExcel,
  overrideQuestion,
};