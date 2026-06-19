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
  overrideQuestion,
} = require('../controllers/submissionController');

// POST /api/exams/:examId/submissions/upload
router.post('/upload', auth, uploadMultiple, uploadSheets);

// GET /api/exams/:examId/submissions
router.get('/', auth, getSubmissions);

// ── Download routes — MUST come before /:submissionId ────
router.get('/download-all-reports', auth, downloadAllReports);
router.get('/download-excel', auth, downloadExcel);

// GET /api/exams/:examId/submissions/:submissionId
router.get('/:submissionId', auth, getSubmission);

// GET /api/exams/:examId/submissions/:submissionId/download-report
router.get('/:submissionId/download-report', auth, downloadStudentReport);

// PATCH /api/exams/:examId/submissions/:submissionId/override-question
// Placed after /:submissionId GET so there is no conflict — different HTTP method
router.patch('/:submissionId/override-question', auth, overrideQuestion);

module.exports = router;