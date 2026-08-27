const mongoose = require('mongoose');

// Previously this called process.exit(1) on any connection failure, which took
// the entire API down (including routes that don't touch the DB) whenever Mongo
// was briefly unreachable. It now logs the failure and lets the process stay up
// in a degraded state, so /api/health can report the real status instead of the
// server being unreachable entirely.
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB connection failed: ${error.message}`);
        console.error('Server will continue running in degraded mode (DB-dependent routes will fail until this is resolved).');
    }
};

module.exports = connectDB;
