const Exam = require('../models/Exam');

// ─── CREATE EXAM ──────────────────────────────────────────
// POST /api/exams
// Professor fills in the modal form and submits — this saves it to MongoDB Atlas
const createExam = async (req, res, next) => {
  try {
    const { title, subject, date, totalMarks, defaultScheme, customPrompt } = req.body;

    // Validate required fields — return 400 if any are missing
    if (!title || !subject || !date || !totalMarks) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, subject, date, and total marks',
      });
    }

    // professorId always comes from req.user._id (set by auth middleware)
    // We NEVER trust professorId from the request body — that would be a security hole
    const exam = await Exam.create({
      professorId: req.user._id,
      title,
      subject,
      date,
      totalMarks,
      defaultScheme: defaultScheme || 'medium',
      customPrompt: customPrompt || '',
    });

    res.status(201).json({
      success: true,
      exam,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET ALL EXAMS ────────────────────────────────────────
// GET /api/exams
// Returns all exams belonging to the logged-in professor, newest first
const getAllExams = async (req, res, next) => {
  try {
    const exams = await Exam.find({ professorId: req.user._id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: exams.length,
      exams,
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET EXAM BY ID ───────────────────────────────────────
// GET /api/exams/:id
// Returns a single exam — also verifies the professor owns it
const getExamById = async (req, res, next) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Ownership check — this is a security requirement because without it,
    // any logged-in professor could access any other professor's exam just by
    // guessing or knowing the exam ID. MongoDB IDs are not secret.
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this exam',
      });
    }

    res.status(200).json({
      success: true,
      exam,
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE EXAM ──────────────────────────────────────────
// DELETE /api/exams/:id
// Deletes an exam after verifying ownership
const deleteExam = async (req, res, next) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Same ownership check as getExamById
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this exam',
      });
    }

    await Exam.findByIdAndDelete(req.params.id);

    // Question and Submission cascade delete will be added in Module 5 and Module 7
    // For now we only delete the exam document itself

    res.status(200).json({
      success: true,
      message: 'Exam deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createExam, getAllExams, getExamById, deleteExam };