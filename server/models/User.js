const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
  },
  role: {
    type: String,
    default: 'professor',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Instance method — called on a specific user document
// Example: const isMatch = await user.comparePassword('admin123')
// bcrypt.compare hashes the plain text and compares to stored hash
// We never store plain text passwords — only the bcrypt hash
userSchema.methods.comparePassword = async function (plainTextPassword) {
  return await bcrypt.compare(plainTextPassword, this.passwordHash);
};

// Static method — called on the User model itself
// Example: const user = await User.findByEmail('professor@nitj.ac.in')
userSchema.statics.findByEmail = async function (email) {
  return await this.findOne({ email: email.toLowerCase().trim() });
};

const User = mongoose.model('User', userSchema);

module.exports = User;