

const Exam = require('../models/Exam');
const Question = require('../models/Question');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');

// ─── CREATE EXAM ──────────────────────────────────────────
// POST /api/exams
// Professor fills in the modal form and submits — this saves it to MongoDB Atlas
const createExam = async (req, res, next) => {
  try {
    const { title, subject, date, totalMarks, customPrompt } = req.body;

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

// ─── UPDATE EXAM ──────────────────────────────────────────
// PUT /api/exams/:id
// Lets the professor edit exam name, subject, date, and total marks
// from the Previous Exams page without redoing the whole setup flow.
//
// Deliberately NOT editable here: questionPaperUrl, modelAnswerUrl, customPrompt,
// status — those are set by the Exam Setup flow (process-papers / questions) and
// editing them here would desync them from the Questions already saved in DB.
// If the professor wants to change the question paper or model answer, they
// should use the existing Exam Setup re-processing flow instead.
const updateExam = async (req, res, next) => {
  try {
    const { title, subject, date, totalMarks } = req.body;

    // Validate required fields — same rule as createExam, an exam can't exist
    // without these basics
    if (!title || !subject || !date || !totalMarks) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, subject, date, and total marks',
      });
    }

    if (Number(totalMarks) < 1) {
      return res.status(400).json({
        success: false,
        message: 'Total marks must be at least 1',
      });
    }

    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    // Same ownership check as getExamById/deleteExam
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this exam',
      });
    }

    exam.title = title;
    exam.subject = subject;
    exam.date = date;
    exam.totalMarks = Number(totalMarks);

    await exam.save();

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
// Deletes an exam after verifying ownership, along with everything that
// belongs to it — Questions, Submissions, and Evaluations. Without this
// cascade, deleting an exam would leave orphaned Question/Submission/
// Evaluation documents in MongoDB forever (invisible garbage that still
// takes up space and could resurface in buggy queries later).
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

    // Step 1: find every Submission for this exam, so we know which
    // Evaluations belong to it (Evaluation only links to submissionId,
    // not examId directly).
    const submissions = await Submission.find({ examId: exam._id }).select('_id');
    const submissionIds = submissions.map((s) => s._id);

    // Step 2: delete all Evaluations belonging to those submissions
    if (submissionIds.length > 0) {
      await Evaluation.deleteMany({ submissionId: { $in: submissionIds } });
    }

    // Step 3: delete all Submissions for this exam
    await Submission.deleteMany({ examId: exam._id });

    // Step 4: delete all Questions for this exam
    await Question.deleteMany({ examId: exam._id });

    // Step 5: finally delete the exam itself
    await Exam.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Exam deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createExam, getAllExams, getExamById, updateExam, deleteExam };