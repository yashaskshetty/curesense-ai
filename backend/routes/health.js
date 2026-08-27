const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Mongoose connection.readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
const MONGO_STATES = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
};

// @route   GET api/health
// @desc    Report the live status of every dependency this API relies on, so
//          an issue (missing env var, dropped DB connection, misconfigured
//          email/AI credentials) can be diagnosed from one place instead of
//          reading scattered server logs.
// @access  Public
router.get('/', (req, res) => {
    const mongoState = mongoose.connection.readyState;

    const checks = {
        mongodb: {
            status: mongoState === 1 ? 'ok' : 'down',
            state: MONGO_STATES[mongoState] || 'unknown',
        },
        email: {
            status: (process.env.EMAIL_USER && process.env.EMAIL_PASS) ? 'ok' : 'not_configured',
            note: (process.env.EMAIL_USER && process.env.EMAIL_PASS)
                ? undefined
                : 'EMAIL_USER/EMAIL_PASS missing — emails will be mocked (logged, not sent)',
        },
        jwt: {
            status: process.env.JWT_SECRET ? 'ok' : 'not_configured',
            note: process.env.JWT_SECRET ? undefined : 'JWT_SECRET missing — authenticated routes will fail',
        },
        ai: {
            status: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) ? 'ok' : 'not_configured',
            note: (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
                ? undefined
                : 'No Gemini/Google API key found — symptom checker will fail',
        },
    };

    const overallStatus = Object.values(checks).every(c => c.status === 'ok') ? 'ok' : 'degraded';

    res.status(overallStatus === 'ok' ? 200 : 503).json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        checks,
    });
});

module.exports = router;
