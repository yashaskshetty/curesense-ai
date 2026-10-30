const request = require('supertest');
const app = require('../app');

// The health route reads process.env on every request, so each test sets the
// environment it wants and the original is restored afterwards.
const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
});

describe('GET /api/health', () => {
    it('reports every dependency it knows about', async () => {
        const res = await request(app).get('/api/health');

        expect(res.body.checks).toHaveProperty('mongodb');
        expect(res.body.checks).toHaveProperty('email');
        expect(res.body.checks).toHaveProperty('jwt');
        expect(res.body.checks).toHaveProperty('ai');
    });

    it('includes a timestamp and uptime', async () => {
        const res = await request(app).get('/api/health');

        expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
        expect(typeof res.body.uptimeSeconds).toBe('number');
    });

    it('reports mongodb as connected while the test DB is up', async () => {
        const res = await request(app).get('/api/health');

        expect(res.body.checks.mongodb).toEqual({ status: 'ok', state: 'connected' });
    });

    it('reports 200 and "ok" when every dependency is configured', async () => {
        process.env.EMAIL_USER = 'a@b.com';
        process.env.EMAIL_PASS = 'secret';
        process.env.JWT_SECRET = 'secret';
        process.env.GEMINI_API_KEY = 'key';

        const res = await request(app).get('/api/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    // This is the behaviour the health endpoint exists for: booting with
    // nothing configured should produce a precise diagnosis, not a crash.
    it('reports 503 and names the exact missing pieces when unconfigured', async () => {
        delete process.env.EMAIL_USER;
        delete process.env.EMAIL_PASS;
        delete process.env.JWT_SECRET;
        delete process.env.GEMINI_API_KEY;
        delete process.env.GOOGLE_API_KEY;

        const res = await request(app).get('/api/health');

        expect(res.status).toBe(503);
        expect(res.body.status).toBe('degraded');
        expect(res.body.checks.email.status).toBe('not_configured');
        expect(res.body.checks.email.note).toMatch(/EMAIL_USER/);
        expect(res.body.checks.jwt.status).toBe('not_configured');
        expect(res.body.checks.ai.status).toBe('not_configured');
    });

    it('accepts GOOGLE_API_KEY as an alternative to GEMINI_API_KEY', async () => {
        delete process.env.GEMINI_API_KEY;
        process.env.GOOGLE_API_KEY = 'key';

        const res = await request(app).get('/api/health');

        expect(res.body.checks.ai.status).toBe('ok');
    });

    it('omits the note field for a dependency that is healthy', async () => {
        process.env.JWT_SECRET = 'secret';

        const res = await request(app).get('/api/health');

        expect(res.body.checks.jwt.note).toBeUndefined();
    });

    it('treats a half-configured email setup as not configured', async () => {
        process.env.EMAIL_USER = 'a@b.com';
        delete process.env.EMAIL_PASS;

        const res = await request(app).get('/api/health');

        expect(res.body.checks.email.status).toBe('not_configured');
    });
});

describe('error handling', () => {
    it('serves the root liveness string', async () => {
        const res = await request(app).get('/');

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/CureSenseAI API is running/);
    });

    it('returns a structured 404 for an unknown route instead of hanging', async () => {
        const res = await request(app).get('/api/definitely-not-a-route');

        expect(res.status).toBe(404);
        expect(res.body).toMatchObject({ success: false });
        expect(res.body.message).toMatch(/Route not found: GET \/api\/definitely-not-a-route/);
    });

    it('names the method in the 404 message', async () => {
        const res = await request(app).post('/api/nope');

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/POST/);
    });

    it('returns JSON, not HTML, for unknown routes', async () => {
        const res = await request(app).get('/api/nope');

        expect(res.headers['content-type']).toMatch(/application\/json/);
    });
});
