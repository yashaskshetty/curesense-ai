// Loaded before the test framework and before any app code, so modules that
// read process.env at require time see a complete, deterministic config.
// The suite never touches a real database, mail server or AI provider.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/curesense-test-placeholder';
