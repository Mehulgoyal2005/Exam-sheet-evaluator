// // server/routes/exams.js

// const express = require('express');
// const router = express.Router();
// const auth = require('../middleware/auth');
// const {
//   createExam,
//   getAllExams,
//   getExamById,
//   deleteExam,
// } = require('../controllers/examController');

// // Import question routes — mounted under /:examId so mergeParams works correctly
// const questionRoutes = require('./questions');

// // All exam routes are protected — professor must be logged in
// router.post('/', auth, createExam);
// router.get('/', auth, getAllExams);
// router.get('/:id', auth, getExamById);
// router.delete('/:id', auth, deleteExam);

// // Mount question routes under /:examId
// // This means POST /api/exams/abc123/questions hits saveQuestions correctly
// // Putting it here instead of index.js avoids the /:id catch-all conflict
// router.use('/:examId', questionRoutes);

// module.exports = router;

// server/routes/exams.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createExam,
  getAllExams,
  getExamById,
  deleteExam,
} = require('../controllers/examController');

router.post('/', auth, createExam);
router.get('/', auth, getAllExams);
router.get('/:id', auth, getExamById);
router.delete('/:id', auth, deleteExam);

module.exports = router;