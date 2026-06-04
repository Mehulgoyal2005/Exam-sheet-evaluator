const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // The Authorization header looks like: "Bearer eyJhbGciOiJIUzI1NiJ9..."
    // We split by space and take the second part (index 1)
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please log in.',
      });
    }

    const token = authHeader.split(' ')[1];

    // jwt.verify throws an error if token is expired or tampered with
    // If valid, it returns the payload we encoded when creating the token
    // Our payload is: { userId: user._id, role: user.role }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check the user still exists in the database
    // This handles the case where an account was deleted but token still valid
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists. Please log in again.',
      });
    }

    // Attach user to request object so controllers can use it
    // Example in controller: req.user._id, req.user.email
    req.user = user;
    next();
  } catch (error) {
    // jwt.verify throws JsonWebTokenError for invalid tokens
    // and TokenExpiredError for expired tokens
    // Our global errorHandler in index.js will handle these
    next(error);
  }
};

module.exports = auth;