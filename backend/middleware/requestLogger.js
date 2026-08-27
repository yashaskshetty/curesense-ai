// Minimal request logger: every request gets one structured log line with a
// timestamp, method, path, status code, and duration. Previously the only
// logging was ad hoc console.error calls scattered inside individual routes,
// which made it hard to tell which requests were even failing.
const requestLogger = (req, res, next) => {
    const start = Date.now();

    res.on('finish', () => {
        const durationMs = Date.now() - start;
        const line = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`;

        if (res.statusCode >= 500) {
            console.error(line);
        } else if (res.statusCode >= 400) {
            console.warn(line);
        } else {
            console.log(line);
        }
    });

    next();
};

module.exports = requestLogger;
