// server/models/Question.js

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  // Links this question to its exam
  // When we look up questions for an exam, we query by examId
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: [true, 'Exam ID is required'],
  },

  // The question number as it appears in the exam paper (1, 2, 3...)
  questionNumber: {
    type: Number,
    required: [true, 'Question number is required'],
  },

  // The full text of the question exactly as it appears in the question paper
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
  },

  // The correct answer from the model answer sheet
  // The LLM will compare each student's answer against this
  modelAnswer: {
    type: String,
    required: [true, 'Model answer is required'],
    trim: true,
  },

  // How many marks this question is worth
  marks: {
    type: Number,
    required: [true, 'Marks are required'],
    min: [0, 'Marks cannot be negative'],
  },

  // Grading strictness for this specific question
  // Overrides the exam-level defaultScheme for this question only
  // easy: award marks generously for similar meaning
  // medium: key concepts must be present
  // difficult: must closely match model answer
  scheme: {
    type: String,
    enum: ['easy', 'medium', 'difficult'],
    required: [true, 'Scheme is required'],
  },
});

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;