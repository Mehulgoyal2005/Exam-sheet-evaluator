// server/models/Submission.js

const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true,
  },
  rollNumber: {
    type: String,
    required: true,
    trim: true,
  },
  answerSheetUrl: {
    type: String,
    required: true,
  },
  // Filled in Module 9 when DOCX report is generated
  reportDocxUrl: {
    type: String,
    default: null,
  },
  totalMarksAwarded: {
    type: Number,
    default: 0,
  },
  // Copied from exam.totalMarks at upload time
  totalMarks: {
    type: Number,
    required: true,
  },
  percentage: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued',
  },
  // True if any question's OCR confidence is below 0.50
  isFlagged: {
    type: Boolean,
    default: false,
  },
  // Stores error message if status becomes 'failed'
  processingError: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent the same student from being submitted twice for the same exam
// If the same roll number is uploaded again, we upsert instead
submissionSchema.index({ examId: 1, rollNumber: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);