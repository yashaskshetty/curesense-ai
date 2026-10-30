const request = require('supertest');
const app = require('../app');
const Reminder = require('../models/Reminder');

const VALID_REMINDER = {
    medicineName: 'Metformin',
    dosage: '500mg',
    frequency: 'Twice a day',
    time: '08:00 AM',
    instructions: 'After food',
};

const makeUser = async (email = 'yashas@example.com') => {
    const res = await request(app).post('/api/auth/register').send({
        name: 'Yashas K',
        email,
        password: 'correct-horse-battery',
    });
    return res.body;
};

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

describe('POST /api/reminders', () => {
    it('creates a reminder owned by the caller', async () => {
        const user = await makeUser();

        const res = await request(app).post('/api/reminders').set(auth(user)).send(VALID_REMINDER);

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject(VALID_REMINDER);
        expect(res.body.user).toBe(user._id);
    });

    it('requires authentication', async () => {
        const res = await request(app).post('/api/reminders').send(VALID_REMINDER);

        expect(res.status).toBe(401);
    });

    it.each(['medicineName', 'dosage', 'frequency'])(
        'rejects a reminder missing %s with 400',
        async (field) => {
            const user = await makeUser();
            const payload = { ...VALID_REMINDER, [field]: undefined };

            const res = await request(app).post('/api/reminders').set(auth(user)).send(payload);

            expect(res.status).toBe(400);
        }
    );

    it('ignores a user id supplied in the body and uses the token owner', async () => {
        const owner = await makeUser('owner@example.com');
        const attacker = await makeUser('attacker@example.com');

        const res = await request(app)
            .post('/api/reminders')
            .set(auth(attacker))
            .send({ ...VALID_REMINDER, user: owner._id });

        expect(res.status).toBe(201);
        expect(res.body.user).toBe(attacker._id);
    });
});

describe('GET /api/reminders', () => {
    it('returns an empty list for a new user', async () => {
        const user = await makeUser();

        const res = await request(app).get('/api/reminders').set(auth(user));

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns only the calling user’s reminders', async () => {
        const alice = await makeUser('alice@example.com');
        const bob = await makeUser('bob@example.com');

        await request(app).post('/api/reminders').set(auth(alice)).send(VALID_REMINDER);
        await request(app)
            .post('/api/reminders')
            .set(auth(bob))
            .send({ ...VALID_REMINDER, medicineName: 'Aspirin' });

        const res = await request(app).get('/api/reminders').set(auth(alice));

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].medicineName).toBe('Metformin');
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/reminders');

        expect(res.status).toBe(401);
    });
});

describe('DELETE /api/reminders/:id', () => {
    it('deletes the caller’s own reminder', async () => {
        const user = await makeUser();
        const created = await request(app).post('/api/reminders').set(auth(user)).send(VALID_REMINDER);

        const res = await request(app).delete(`/api/reminders/${created.body._id}`).set(auth(user));

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/removed/i);
        expect(await Reminder.countDocuments()).toBe(0);
    });

    it('refuses to delete another user’s reminder', async () => {
        const owner = await makeUser('owner@example.com');
        const attacker = await makeUser('attacker@example.com');
        const created = await request(app).post('/api/reminders').set(auth(owner)).send(VALID_REMINDER);

        const res = await request(app)
            .delete(`/api/reminders/${created.body._id}`)
            .set(auth(attacker));

        expect(res.status).toBe(401);
        expect(await Reminder.countDocuments()).toBe(1); // still there
    });

    it('returns 404 for an id that does not exist', async () => {
        const user = await makeUser();

        const res = await request(app)
            .delete('/api/reminders/64b7f1c2a4d3e5f6a7b8c9d0')
            .set(auth(user));

        expect(res.status).toBe(404);
    });

    it('requires authentication', async () => {
        const res = await request(app).delete('/api/reminders/64b7f1c2a4d3e5f6a7b8c9d0');

        expect(res.status).toBe(401);
    });
});
