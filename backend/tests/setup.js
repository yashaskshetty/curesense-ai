const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Each test run gets a throwaway in-memory MongoDB, so the suite needs no
// live database, no .env file and no network. Collections are cleared between
// tests so no test can depend on another's leftover data.
let mongod;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
    const { collections } = mongoose.connection;
    await Promise.all(
        Object.values(collections).map((collection) => collection.deleteMany({}))
    );
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (mongod) {
        await mongod.stop();
    }
});
