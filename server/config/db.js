const mongoose = require('mongoose');

// This function connects to MongoDB Atlas
// We call it once when the server starts in index.js
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    // Exit the process with failure code
    // This stops the server if database is unreachable
    process.exit(1);
  }
};

module.exports = connectDB;