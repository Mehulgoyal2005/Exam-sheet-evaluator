// Global error handler for Express
// Any controller that does: next(error)
// or throws inside async code wrapped in try-catch that calls next(error) lands here
// Express knows this is an error handler because it has 4 parameters (err, req, res, next)

const errorHandler = (err, req, res, next) => {
  // Always log the full error in the terminal for debugging
  console.error('❌ Error:', err.stack || err.message);

  // Mongoose validation error
  // Example: professor submits exam form with missing required field
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join(', '),
    });
  }

  // Mongoose duplicate key error
  // Example: trying to create a user with an email that already exists
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // JWT token is invalid or tampered with
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please log in again.',
    });
  }

  // JWT token has expired (lived past the 7 day window)
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired. Please log in again.',
    });
  }

  // Invalid MongoDB ObjectId
  // Example: GET /api/exams/not-a-valid-id
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Resource not found. Invalid ID format.',
    });
  }

  // Default fallback for everything else
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;