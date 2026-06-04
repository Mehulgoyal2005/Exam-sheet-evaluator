const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const auth = require('../middleware/auth');

// POST /api/auth/register — public, no middleware
router.post('/register', register);

// POST /api/auth/login — public, no middleware
router.post('/login', login);

// GET /api/auth/me — protected
router.get('/me', auth, getMe);

module.exports = router;