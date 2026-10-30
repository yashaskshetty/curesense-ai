const request = require('supertest');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');

// /api/auth/me is the simplest route behind protect(), so it stands in for
// "any protected endpoint" here.
const PROTECTED = '/api/auth/me';

const makeUser = async () => {
    const res = await request(app).post('/api/auth/register').send({
        name: 'Yashas K',
        email: 'yashas@example.com',
        password: 'correct-horse-battery',
    });
    return res.body;
};

describe('protect() — token presence', () => {
    it('rejects a request with no auth headers at all', async () => {
        const res = await request(app).get(PROTECTED);

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/no token/i);
    });

    // Regression: `Authorization: Bearer` with no token left `token`
    // undefined, so the Bearer catch sent a 401 and the fallback block sent
    // a SECOND 401 — crashing the request with ERR_HTTP_HEADERS_SENT.
    it('returns a single clean 401 for a Bearer header with no token', async () => {
        const res = await request(app).get(PROTECTED).set('Authorization', 'Bearer');

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/no token/i);
    });

    it('returns a single clean 401 for "Bearer " with trailing space only', async () => {
        const res = await request(app).get(PROTECTED).set('Authorization', 'Bearer ');

        expect(res.status).toBe(401);
    });

    it('rejects a malformed (non-JWT) Bearer token', async () => {
        const res = await request(app).get(PROTECTED).set('Authorization', 'Bearer not-a-jwt');

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/token failed/i);
    });

    it('rejects an auth scheme other than Bearer', async () => {
        const res = await request(app).get(PROTECTED).set('Authorization', 'Basic abc123');

        expect(res.status).toBe(401);
    });
});

describe('protect() — token validity', () => {
    it('accepts a valid Bearer token', async () => {
        const user = await makeUser();

        const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${user.token}`);

        expect(res.status).toBe(200);
    });

    it('rejects a token signed with the wrong secret', async () => {
        const user = await makeUser();
        const forged = jwt.sign({ id: user._id }, 'not-the-real-secret');

        const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${forged}`);

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/token failed/i);
    });

    it('rejects an expired token', async () => {
        const user = await makeUser();
        const expired = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '-1s' });

        const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${expired}`);

        expect(res.status).toBe(401);
    });

    // Regression: findById() returns null for a deleted user. The old code
    // called next() anyway, so the route dereferenced req.user._id and threw
    // a TypeError, surfacing as a 500 instead of a 401.
    it('returns 401, not 500, for a valid token whose user was deleted', async () => {
        const user = await makeUser();
        await User.findByIdAndDelete(user._id);

        const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${user.token}`);

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/no longer exists/i);
    });

    it('returns 401 for a token referencing a well-formed but unknown id', async () => {
        const token = jwt.sign({ id: new mongoose.Types.ObjectId().toString() }, process.env.JWT_SECRET);

        const res = await request(app).get(PROTECTED).set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(401);
    });
});

describe('protect() — x-auth-token fallback', () => {
    it('accepts a valid x-auth-token header', async () => {
        const user = await makeUser();

        const res = await request(app).get(PROTECTED).set('x-auth-token', user.token);

        expect(res.status).toBe(200);
    });

    it('rejects an invalid x-auth-token header', async () => {
        const res = await request(app).get(PROTECTED).set('x-auth-token', 'garbage');

        expect(res.status).toBe(401);
    });

    it('prefers the Bearer token when both headers are present', async () => {
        const user = await makeUser();

        const res = await request(app)
            .get(PROTECTED)
            .set('Authorization', `Bearer ${user.token}`)
            .set('x-auth-token', 'garbage');

        expect(res.status).toBe(200);
    });
});
