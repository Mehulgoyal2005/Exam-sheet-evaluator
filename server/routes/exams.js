const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createExam,
  getAllExams,
  getExamById,
  deleteExam,
} = require('../controllers/examController');

// All exam routes are protected — professor must be logged in
// auth middleware runs first on every route here

router.post('/', auth, createExam);
router.get('/', auth, getAllExams);
router.get('/:id', auth, getExamById);
router.delete('/:id', auth, deleteExam);

module.exports = router;