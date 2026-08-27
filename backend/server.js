const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const startScheduler = require('./services/scheduler.service');
const requestLogger = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

dotenv.config();

const app = express();

// Start Scheduler
startScheduler();

// Middleware
app.use(express.json());
app.use(cors());
app.use(requestLogger);

// Database Connection
connectDB();

// Routes
app.use('/api/health', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/contact-doctor', require('./routes/contact'));

app.get('/', (req, res) => {
    res.send('CureSenseAI API is running...');
});

// Must be registered last: catches unmatched routes, then any error thrown
// or passed to next() by the routes above.
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
