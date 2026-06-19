// server/routes/submissions.js

const express = require('express');
const router = express.Router({ mergeParams: true });

const auth = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const {
  uploadSheets,
  getSubmissions,
  getSubmission,
  downloadStudentReport,
  downloadAllReports,
  downloadExcel,
} = require('../controllers/submissionController');

// POST /api/exams/:examId/submissions/upload
router.post('/upload', auth, uploadMultiple, uploadSheets);

// GET /api/exams/:examId/submissions
router.get('/', auth, getSubmissions);

// ── Download routes — MUST come before /:submissionId ────
// If these were placed after /:submissionId, Express would treat
// "download-all-reports" and "download-excel" as submissionId values
// and call getSubmission instead of the download handlers.

// GET /api/exams/:examId/submissions/download-all-reports
router.get('/download-all-reports', auth, downloadAllReports);

// GET /api/exams/:examId/submissions/download-excel
router.get('/download-excel', auth, downloadExcel);

// GET /api/exams/:examId/submissions/:submissionId
router.get('/:submissionId', auth, getSubmission);

// GET /api/exams/:examId/submissions/:submissionId/download-report
router.get('/:submissionId/download-report', auth, downloadStudentReport);

module.exports = router;