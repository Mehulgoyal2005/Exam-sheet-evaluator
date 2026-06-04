const mongoose = require('mongoose');

// This schema defines the structure of every exam document in MongoDB Atlas
// Every field here maps directly to a column if you think of it like a spreadsheet row
const examSchema = new mongoose.Schema({
  // Links this exam to the professor who created it
  // ObjectId is MongoDB's unique ID type — we store a reference to the User document
  professorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Professor ID is required'],
  },

  title: {
    type: String,
    required: [true, 'Exam title is required'],
    trim: true,
  },

  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
  },

  date: {
    type: Date,
    required: [true, 'Exam date is required'],
  },

  totalMarks: {
    type: Number,
    required: [true, 'Total marks is required'],
    min: [1, 'Total marks must be at least 1'],
  },

  // defaultScheme controls how strictly the LLM evaluates answers for this exam
  // easy   → award marks if meaning is similar, generous interpretation
  // medium → key concepts must be present, some strictness
  // difficult → answer must closely match model answer, strict keyword matching
  defaultScheme: {
    type: String,
    enum: ['easy', 'medium', 'difficult'],
    default: 'medium',
  },

  // These two URLs are null when exam is first created
  // They get filled in Module 5 when professor uploads PDFs to Cloudinary
  questionPaperUrl: {
    type: String,
    default: null,
  },

  modelAnswerUrl: {
    type: String,
    default: null,
  },

  // Single paragraph of special instructions for the whole paper
  // Example: "This is a networking paper. Award marks for correct protocol names even
  // if the explanation is slightly off. Be strict about OSI layer numbers."
  customPrompt: {
    type: String,
    default: '',
  },

  // Tracks where this exam is in the workflow
  // setup      → exam created, professor has not uploaded papers yet
  // ready      → papers uploaded, questions verified, ready for student sheets
  // processing → student sheets uploaded, evaluation running via Bull queue
  // completed  → all student sheets evaluated, results available
  status: {
    type: String,
    enum: ['setup', 'ready', 'processing', 'completed'],
    default: 'setup',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Exam = mongoose.model('Exam', examSchema);

module.exports = Exam;