const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables from .env file
// This must happen before anything else
dotenv.config();

// Connect to MongoDB Atlas
connectDB();

const app = express();

// Create HTTP server from Express app
// We need this because Socket.io attaches to the HTTP server
// not directly to Express
const server = http.createServer(app);

// Set up Socket.io with CORS
// This allows our React frontend to connect for real time updates
const io = socketio(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in our route controllers
// We attach it to the app so any controller can use it
// by doing: req.app.get('io')
app.set('io', io);

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  // When a professor opens the upload page
  // they join a room named after the examId
  // so we only send updates to the right professor
  socket.on('join-exam', (examId) => {
    socket.join(examId);
    console.log(`📋 Socket ${socket.id} joined exam room: ${examId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

// ─── MIDDLEWARE ───────────────────────────────────────────

// CORS - Allow requests from React frontend
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// Parse incoming JSON request bodies
// Example: when frontend sends { email, password } on login
app.use(express.json());

// Parse URL encoded bodies
app.use(express.urlencoded({ extended: true }));

// ─── ROUTES ──────────────────────────────────────────────
// We will uncomment these one by one as we build each module
// For now they are commented out so the server can start

// const authRoutes = require('./routes/auth');
// const examRoutes = require('./routes/exams');
// const questionRoutes = require('./routes/questions');
// const submissionRoutes = require('./routes/submissions');
// const analyticsRoutes = require('./routes/analytics');

// app.use('/api/auth', authRoutes);
// app.use('/api/exams', examRoutes);
// app.use('/api/exams', questionRoutes);
// app.use('/api/exams', submissionRoutes);
// app.use('/api/exams', analyticsRoutes);

// ─── HEALTH CHECK ────────────────────────────────────────
// A simple route to confirm the server is running
// Visit http://localhost:5000/api/health in your browser to test
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Paperly server is running ✅',
    timestamp: new Date().toISOString(),
  });
});

// ─── ERROR HANDLER ───────────────────────────────────────
// This must be the LAST middleware registered
// Express identifies it as error handler because it has 4 params
app.use(errorHandler);

// ─── START SERVER ────────────────────────────────────────
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Paperly server running on port ${PORT}`);
  console.log(`🌍 Environment: development`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});