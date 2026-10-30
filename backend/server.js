const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const startScheduler = require('./services/scheduler.service');
const app = require('./app');

// Process entry point. Everything with a side effect lives here — the DB
// connection, the reminder scheduler and the TCP listener — so that app.js
// stays a pure Express app that tests can mount directly.
connectDB();
startScheduler();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
