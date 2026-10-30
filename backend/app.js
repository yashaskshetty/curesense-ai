const express = require('express');
const cors = require('cors');
const requestLogger = require('./middleware/requestLogger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// The Express app is built here and exported WITHOUT calling listen() or
// starting the cron scheduler. Those are side effects owned by server.js,
// the process entry point.
//
// Previously server.js did all three in one file, so simply requiring it to
// get at the routes would bind a TCP port and start firing reminder emails —
// which made the API untestable. Supertest can now mount this app directly.
const app = express();

app.use(express.json());
app.use(cors());
app.use(requestLogger);

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

module.exports = app;
