const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── LOGIN ────────────────────────────────────────────────
// POST /api/auth/login
// Public route — no auth middleware needed
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Basic validation — make sure both fields were sent
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // Find the professor by email using our static method
    const user = await User.findByEmail(email);

    // IMPORTANT: We return the same error message whether the email
    // doesn't exist OR the password is wrong. This is a security practice
    // called "not revealing whether an account exists."
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Compare the plain text password against the stored bcrypt hash
    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Create JWT token
    // Payload: data we want encoded inside the token
    // JWT_SECRET: a long random string only the server knows, stored in .env
    // expiresIn: '7d' means the token expires after 7 days
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return token and user info (never return passwordHash)
    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET ME ───────────────────────────────────────────────
// GET /api/auth/me
// Protected route — auth middleware runs first, attaches req.user
const getMe = async (req, res, next) => {
  try {
    // req.user is already attached by the auth middleware
    // The auth middleware already did: .select('-passwordHash')
    // so passwordHash is not in the object
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { login, getMe };