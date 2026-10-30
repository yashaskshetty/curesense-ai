module.exports = {
    testEnvironment: 'node',
    setupFiles: ['<rootDir>/tests/env.js'],
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    testMatch: ['<rootDir>/tests/**/*.test.js'],
    collectCoverageFrom: [
        'routes/**/*.js',
        'middleware/**/*.js',
        'models/**/*.js',
        'app.js',
    ],
    // mongodb-memory-server needs a moment to download/boot on first run
    testTimeout: 30000,
    // surface anything that keeps the event loop alive after tests finish
    detectOpenHandles: false,
    forceExit: true,
};
