

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

// router.post('/', auth, createExam);
// router.get('/', auth, getAllExams);
// router.get('/:id', auth, getExamById);
// router.delete('/:id', auth, deleteExam);

// module.exports = router;


// server/routes/exams.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
} = require('../controllers/examController');

router.post('/', auth, createExam);
router.get('/', auth, getAllExams);
router.get('/:id', auth, getExamById);
router.put('/:id', auth, updateExam);
router.delete('/:id', auth, deleteExam);

module.exports = router;