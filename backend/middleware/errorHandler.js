// Centralized error handling: every route previously caught (or forgot to
// catch) errors on its own with an inconsistent response shape. These two
// handlers guarantee (a) unknown routes return a clear 404 instead of hanging,
// and (b) any thrown/unhandled error returns a consistent JSON error shape
// and gets logged with a stack trace, instead of crashing the process or
// silently returning an empty response.

const notFound = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

    console.error(`[${new Date().toISOString()}] Unhandled error on ${req.method} ${req.originalUrl}:`, err.stack || err.message);

    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal server error',
    });
};

module.exports = { notFound, errorHandler };
