// server/controllers/analyticsController.js

const Exam = require('../models/Exam');
const Submission = require('../models/Submission');
const Evaluation = require('../models/Evaluation');
const Question = require('../models/Question');

/**
 * GET /api/exams/:examId/analytics
 * Returns class-level statistics and chart data for the Exam Results page.
 */
const getExamAnalytics = async (req, res, next) => {
  try {
    const { examId } = req.params;

    // ── Step 1: Validate exam exists and belongs to this professor ─────────
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    if (exam.professorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // ── Step 2: Fetch all submissions for this exam ────────────────────────
    const allSubmissions = await Submission.find({ examId }).sort({ rollNumber: 1 });

    // ── Step 3: Filter only completed submissions for stat calculations ────
    const completed = allSubmissions.filter((s) => s.status === 'completed');

    const totalStudents = allSubmissions.length;
    const completedCount = completed.length;

    // ── Step 4: Calculate summary statistics ──────────────────────────────

    // Class average — mean of percentage across completed submissions
    const classAverage =
      completedCount > 0
        ? parseFloat(
            (
              completed.reduce((sum, s) => sum + s.percentage, 0) / completedCount
            ).toFixed(2)
          )
        : 0;

    // Highest and lowest raw marks
    const highestScore =
      completedCount > 0
        ? Math.max(...completed.map((s) => s.totalMarksAwarded))
        : 0;

    const lowestScore =
      completedCount > 0
        ? Math.min(...completed.map((s) => s.totalMarksAwarded))
        : 0;

    // Pass count — percentage >= 40 is considered passing
    const passCount = completed.filter((s) => s.percentage >= 40).length;
    const passPercentage =
      completedCount > 0
        ? parseFloat(((passCount / completedCount) * 100).toFixed(1))
        : 0;

    // ── Step 5: Marks distribution for bar chart ───────────────────────────
    // Divide total marks into 5 equal buckets
    // e.g. for 100 marks: 0-20, 21-40, 41-60, 61-80, 81-100
    const bucketSize = Math.ceil(exam.totalMarks / 5);

    const marksDistribution = Array.from({ length: 5 }, (_, i) => {
      const low = i * bucketSize;
      // Last bucket goes up to totalMarks exactly
      const high = i === 4 ? exam.totalMarks : (i + 1) * bucketSize - 1;

      const count = completed.filter(
        (s) => s.totalMarksAwarded >= low && s.totalMarksAwarded <= high
      ).length;

      return {
        range: `${low}-${high}`,
        count,
      };
    });

    // ── Step 6: Question-wise average performance ──────────────────────────
    // For each question, find all evaluations and compute the average actual mark
    const questions = await Question.find({ examId }).sort({ questionNumber: 1 });

    // We only include evaluations from completed submissions
    const completedSubmissionIds = completed.map((s) => s._id);

    const questionWiseAverage = await Promise.all(
      questions.map(async (question) => {
        // Get all evaluations for this question from completed submissions only
        const evaluations = await Evaluation.find({
          questionId: question._id,
          submissionId: { $in: completedSubmissionIds },
        });

        if (evaluations.length === 0) {
          return {
            questionNumber: question.questionNumber,
            averageMarks: 0,
            maxMarks: question.marks,
          };
        }

        // Use overriddenMark if the professor overrode it, else use marksAwarded
        const totalAwarded = evaluations.reduce((sum, ev) => {
          return sum + (ev.isOverridden ? ev.overriddenMark : ev.marksAwarded);
        }, 0);

        const averageMarks = parseFloat(
          (totalAwarded / evaluations.length).toFixed(2)
        );

        return {
          questionNumber: question.questionNumber,
          averageMarks,
          maxMarks: question.marks,
        };
      })
    );

    // ── Step 7: Return all computed data ──────────────────────────────────
    return res.status(200).json({
      success: true,
      analytics: {
        totalStudents,
        completedCount,
        classAverage,
        highestScore,
        lowestScore,
        passCount,
        passPercentage,
        totalMarks: exam.totalMarks,
        marksDistribution,
        questionWiseAverage,
      },
    });

  } catch (error) {
    console.error('❌ getExamAnalytics error:', error.message);
    next(error);
  }
};

module.exports = { getExamAnalytics };