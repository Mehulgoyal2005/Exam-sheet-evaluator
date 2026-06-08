// server/models/Evaluation.js

const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  // Links to which student submission this evaluation belongs to
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
  },

  // Links to which question is being evaluated
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question',
    required: true,
  },

  // Stored directly so we can sort without joining Question collection
  questionNumber: {
    type: Number,
    required: true,
  },

  // What the student actually wrote — extracted by OCR
  studentAnswerText: {
    type: String,
    default: '',
  },

  // Marks given by the LLM for this question
  marksAwarded: {
    type: Number,
    required: true,
    default: 0,
  },

  // Maximum possible marks for this question — copied from Question.marks
  maxMarks: {
    type: Number,
    required: true,
  },

  // LLM-generated feedback strings
  correctParts: {
    type: String,
    default: '',
  },
  wrongParts: {
    type: String,
    default: '',
  },
  aiFeedback: {
    type: String,
    default: '',
  },

  // OCR confidence for this answer — we use averageConfidence from the whole sheet
  ocrConfidence: {
    type: Number,
    default: 0,
  },

  // True if ocrConfidence is below 0.50 — triggers yellow flag on Student Report page
  isLowConfidence: {
    type: Boolean,
    default: false,
  },

  // These fields are used in Module 10 when professor manually edits marks
  isOverridden: {
    type: Boolean,
    default: false,
  },
  overriddenMark: {
    type: Number,
    default: null,
  },
  overrideReason: {
    type: String,
    default: '',
  },
  overriddenAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('Evaluation', evaluationSchema);