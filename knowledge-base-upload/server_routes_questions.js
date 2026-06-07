// server/routes/questions.js

const express = require('express');
// mergeParams: true is required here — without it, req.params.examId would be
// undefined in our controllers because :examId is defined in the parent router (exams.js)
// mergeParams tells Express to pass parent route parameters down to child routers
const router = express.Router({ mergeParams: true });

const auth = require('../middleware/auth');
const { uploadDouble } = require('../middleware/upload');
const { processPapers, saveQuestions, getQuestions } = require('../controllers/questionController');

// POST /api/exams/:examId/process-papers
// uploadDouble runs first — it parses the two PDF files from the multipart request
// and saves them to server/temp/. Then processPapers runs with req.files populated.
router.post('/process-papers', auth, uploadDouble, processPapers);

// POST /api/exams/:examId/questions
// Professor has verified the extracted questions and clicks Confirm
// No file upload needed here — just a JSON body with the questions array
router.post('/', auth, saveQuestions);

// GET /api/exams/:examId/questions
// Fetch saved questions for an exam — used when professor returns to the setup page
router.get('/', auth, getQuestions);

module.exports = router;