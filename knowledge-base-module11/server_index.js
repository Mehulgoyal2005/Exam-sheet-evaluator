
// // server/index.js

// const express = require('express');
// const http = require('http');
// const socketio = require('socket.io');
// const cors = require('cors');
// const dotenv = require('dotenv');
// const connectDB = require('./config/db');
// const errorHandler = require('./middleware/errorHandler');

// // Load environment variables — must happen before anything else
// dotenv.config();

// // Connect to MongoDB Atlas
// connectDB();

// const app = express();

// // Create HTTP server — Socket.io attaches to this, not to Express directly
// const server = http.createServer(app);

// // Set up Socket.io with CORS
// const io = socketio(server, {
//   cors: {
//     origin: process.env.CLIENT_URL,
//     methods: ['GET', 'POST'],
//   },
// });

// // Make io accessible in controllers via req.app.get('io')
// app.set('io', io);

// // Socket.io connection handler
// io.on('connection', (socket) => {
//   console.log(`⚡ Client connected: ${socket.id}`);

//   // Professor joins a room named after the examId when they open the upload page
//   // This ensures status updates only go to the right professor
//   socket.on('join-exam', (examId) => {
//     socket.join(examId);
//     console.log(`📋 Socket ${socket.id} joined exam room: ${examId}`);
//   });

//   socket.on('disconnect', () => {
//     console.log(`❌ Client disconnected: ${socket.id}`);
//   });
// });

// // ─── INITIALIZE EVALUATION WORKER ────────────────────────
// // Pass the io instance to the worker so it can emit socket events
// // when job status changes (processing → completed → failed)
// const { initializeWorker } = require('./workers/evaluationWorker');
// initializeWorker(io);

// // ─── MIDDLEWARE ───────────────────────────────────────────
// app.use(
//   cors({
//     origin: process.env.CLIENT_URL,
//     credentials: true,
//     allowedHeaders: ['Content-Type', 'Authorization'],
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//   })
// );

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // ─── ROUTES ──────────────────────────────────────────────
// const authRoutes = require('./routes/auth');
// const examRoutes = require('./routes/exams');
// const questionRoutes = require('./routes/questions');
// const submissionRoutes = require('./routes/submissions');

// // Auth routes — public
// app.use('/api/auth', authRoutes);

// // Question routes mounted BEFORE exam routes (Deviation 6)
// // This prevents the /:id catch-all in exams.js from swallowing question requests
// app.use('/api/exams/:examId/questions', questionRoutes);

// // Submission routes mounted BEFORE exam routes for the same reason
// app.use('/api/exams/:examId/submissions', submissionRoutes);

// // Exam routes — the /:id catch-all must come last
// app.use('/api/exams', examRoutes);

// // ─── HEALTH CHECK ────────────────────────────────────────
// app.get('/api/health', (req, res) => {
//   res.json({
//     success: true,
//     message: 'Paperly server is running ✅',
//     timestamp: new Date().toISOString(),
//   });
// });

// // ─── ERROR HANDLER ───────────────────────────────────────
// // Must be the LAST middleware registered
// app.use(errorHandler);

// // ─── START SERVER ────────────────────────────────────────
// const PORT = process.env.PORT || 5000;

// server.listen(PORT, () => {
//   console.log(`🚀 Paperly server running on port ${PORT}`);
//   console.log(`🌍 Environment: development`);
//   console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
// });

// server/index.js

const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

const io = socketio(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);
  socket.on('join-exam', (examId) => {
    socket.join(examId);
    console.log(`📋 Socket ${socket.id} joined exam room: ${examId}`);
  });
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

const { initializeWorker } = require('./workers/evaluationWorker');
initializeWorker(io);

// ─── CORS ─────────────────────────────────────────────────
const corsOptions = {
  origin: process.env.CLIENT_URL,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── BODY PARSERS ────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── ROUTES ──────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exams');
const questionRoutes = require('./routes/questions');
const submissionRoutes = require('./routes/submissions');
const analyticsRoutes = require('./routes/analytics');

// Auth routes — public
app.use('/api/auth', authRoutes);

// Specific nested routes mounted BEFORE exam routes (Deviation 6)
// This prevents the /:id catch-all in exams.js from swallowing these requests
app.use('/api/exams/:examId/questions', questionRoutes);
app.use('/api/exams/:examId/submissions', submissionRoutes);
app.use('/api/exams/:examId/analytics', analyticsRoutes);

// Exam routes last — /:id catch-all must come after all specific nested routes
app.use('/api/exams', examRoutes);

// ─── HEALTH CHECK ────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Paperly server is running ✅',
    timestamp: new Date().toISOString(),
  });
});

// ─── ERROR HANDLER ───────────────────────────────────────
app.use(errorHandler);

// ─── START SERVER ────────────────────────────────────────
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Paperly server running on port ${PORT}`);
  console.log(`🌍 Environment: development`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});