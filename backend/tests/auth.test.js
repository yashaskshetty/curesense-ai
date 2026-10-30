const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const User = require('../models/User');

const VALID_USER = {
    name: 'Yashas K',
    email: 'yashas@example.com',
    password: 'correct-horse-battery',
};

const register = (overrides = {}) =>
    request(app).post('/api/auth/register').send({ ...VALID_USER, ...overrides });

const login = (email, password) =>
    request(app).post('/api/auth/login').send({ email, password });

describe('POST /api/auth/register', () => {
    it('creates a user and returns a token', async () => {
        const res = await register();

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({ name: VALID_USER.name, email: VALID_USER.email });
        expect(res.body.token).toBeDefined();
        expect(res.body.password).toBeUndefined();
    });

    it('issues a token that decodes to the new user id', async () => {
        const res = await register();
        const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);

        expect(decoded.id).toBe(res.body._id);
    });

    it('stores the password hashed, never in plain text', async () => {
        await register();
        const stored = await User.findOne({ email: VALID_USER.email });

        expect(stored.password).not.toBe(VALID_USER.password);
        expect(stored.password).toMatch(/^\$2[aby]\$/); // bcrypt prefix
    });

    it('rejects a duplicate email with 400', async () => {
        await register();
        const res = await register();

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/already exists/i);
    });

    // Regression: a missing field used to reach User.create(), whose
    // ValidationError was swallowed and reported as a 500 "Server Error".
    it.each([
        ['name', { name: undefined }],
        ['email', { email: undefined }],
        ['password', { password: undefined }],
    ])('returns 400, not 500, when %s is missing', async (_field, override) => {
        const res = await register(override);

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/required/i);
    });

    it('returns 400 when the body is entirely empty', async () => {
        const res = await request(app).post('/api/auth/register').send({});

        expect(res.status).toBe(400);
    });
});

describe('POST /api/auth/login', () => {
    beforeEach(async () => {
        await register();
    });

    it('authenticates a valid email and password', async () => {
        const res = await login(VALID_USER.email, VALID_USER.password);

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.email).toBe(VALID_USER.email);
    });

    it('rejects a wrong password with 401', async () => {
        const res = await login(VALID_USER.email, 'wrong-password');

        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it('rejects an unknown email with 401', async () => {
        const res = await login('nobody@example.com', VALID_USER.password);

        expect(res.status).toBe(401);
    });

    it('does not leak whether the email exists', async () => {
        const unknown = await login('nobody@example.com', 'whatever');
        const wrongPassword = await login(VALID_USER.email, 'whatever');

        expect(unknown.body.message).toBe(wrongPassword.body.message);
    });
});

// Characterisation tests for the pre-save hook.
//
// The original guard — `if (!this.isModified('password')) { next(); }` — was
// missing a `return`, so execution continued into the hash block on saves
// that did not touch the password. These tests were written expecting that to
// corrupt the stored hash, but they pass against the unfixed code too: the
// early next() resolves the hook and Mongoose persists the existing value
// before the second bcrypt call completes, so nothing wrong is written.
//
// The missing `return` is therefore a latent fragility (two code paths racing
// to define one document's state), not an observable defect. The `return` was
// added to make the intent explicit; these tests stay as a guard on the
// behaviour that matters — that an unrelated update can't break a login.
describe('password hashing on re-save', () => {
    it('keeps login working after an unrelated field is updated', async () => {
        await register();

        const user = await User.findOne({ email: VALID_USER.email });
        const hashBefore = user.password;

        user.name = 'Yashas Kumar';
        await user.save();

        const reloaded = await User.findOne({ email: VALID_USER.email });
        expect(reloaded.password).toBe(hashBefore); // not re-hashed

        const res = await login(VALID_USER.email, VALID_USER.password);
        expect(res.status).toBe(200);
    });

    it('re-hashes only when the password actually changes', async () => {
        await register();

        const user = await User.findOne({ email: VALID_USER.email });
        const hashBefore = user.password;

        user.password = 'a-brand-new-password';
        await user.save();

        const reloaded = await User.findOne({ email: VALID_USER.email });
        expect(reloaded.password).not.toBe(hashBefore);

        expect((await login(VALID_USER.email, 'a-brand-new-password')).status).toBe(200);
        expect((await login(VALID_USER.email, VALID_USER.password)).status).toBe(401);
    });
});

describe('GET /api/auth/me', () => {
    it('returns the current user for a valid Bearer token', async () => {
        const { body } = await register();

        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${body.token}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe(VALID_USER.email);
        expect(res.body.password).toBeUndefined();
    });

    it('accepts the x-auth-token header the frontend also uses', async () => {
        const { body } = await register();

        const res = await request(app)
            .get('/api/auth/me')
            .set('x-auth-token', body.token);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe(VALID_USER.email);
    });
});
