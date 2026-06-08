// server/routes/submissions.js

const express = require('express');
// mergeParams: true passes :examId from the parent route into this router
const router = express.Router({ mergeParams: true });

const auth = require('../middleware/auth');
const { uploadMultiple } = require('../middleware/upload');
const {
  uploadSheets,
  getSubmissions,
  getSubmission,
} = require('../controllers/submissionController');

// POST /api/exams/:examId/submissions/upload
// uploadMultiple runs first — it parses the uploaded ZIP or PDFs and saves
// them to server/temp/. Then uploadSheets processes them.
router.post('/upload', auth, uploadMultiple, uploadSheets);

// GET /api/exams/:examId/submissions
router.get('/', auth, getSubmissions);

// GET /api/exams/:examId/submissions/:submissionId
router.get('/:submissionId', auth, getSubmission);

module.exports = router;