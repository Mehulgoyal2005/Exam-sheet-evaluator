// Global error handler for Express
// Any controller that does: next(error)
// or throws inside async code lands here
// Express knows this is an error handler because it has 4 parameters

const errorHandler = (err, req, res, next) => {
  // Always log the full error in the terminal for debugging
  console.error('❌ Error:', err.stack || err.message);

  // Mongoose validation error
  // Example: professor submits exam form with missing required field
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages,
    });
  }

  // Mongoose duplicate key error
  // Example: trying to register with an email that already exists
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
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

  // JWT token has expired
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired. Please log in again.',
    });
  }

  // Default error - use whatever status code was set, or 500
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

module.exports = errorHandler;