const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load .env file from the server directory
// path.join(__dirname, '..', '.env') goes one level up from utils/ to server/
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// We require the User model after dotenv so mongoose connection string is available
const User = require('../models/User');

const seedProfessor = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if professor already exists
    const existingUser = await User.findByEmail('professor@nitj.ac.in');

    if (existingUser) {
      console.log('ℹ️  Professor account already exists. No action taken.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Hash the password — saltRounds 10 is the standard secure value
    // bcrypt is a one-way hash — you cannot reverse it to get the original password
    // That's why we use comparePassword to check — we hash the input and compare hashes
    const passwordHash = await bcrypt.hash('admin123', 10);

    // Create the professor user document
    const professor = new User({
      name: 'Professor',
      email: 'professor@nitj.ac.in',
      passwordHash,
      role: 'professor',
    });

    await professor.save();

    console.log('✅ Professor account created successfully');
    console.log('   Email: professor@nitj.ac.in');
    console.log('   Password: admin123');
    console.log('   Change the password after first login in production!');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
};

seedProfessor();