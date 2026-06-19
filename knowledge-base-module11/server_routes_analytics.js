// server/routes/analytics.js

const express = require('express');
// mergeParams: true because :examId comes from the parent mount in index.js
const router = express.Router({ mergeParams: true });

const auth = require('../middleware/auth');
const { getExamAnalytics } = require('../controllers/analyticsController');

// GET /api/exams/:examId/analytics
router.get('/', auth, getExamAnalytics);

module.exports = router;