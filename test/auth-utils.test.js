const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_ACCESS_SECRET = 'access-secret-that-is-long-enough-for-tests';
process.env.JWT_REFRESH_SECRET = 'refresh-secret-that-is-long-enough-for-tests';

const { createOneTimeToken, hashOneTimeToken } = require('../utils/auth/oneTimeTokens');
const { buildAccessToken, buildRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../utils/auth/tokens');
const { normalizeEmail, validatePassword } = require('../utils/auth/validation');
const validateConfig = require('../utils/validateConfig');

test('one-time tokens are random and stored as deterministic hashes', () => {
  const first = createOneTimeToken();
  const second = createOneTimeToken();
  assert.notEqual(first, second);
  assert.equal(hashOneTimeToken(first), hashOneTimeToken(first));
  assert.notEqual(hashOneTimeToken(first), first);
});

test('access and refresh tokens are purpose-separated', () => {
  const access = buildAccessToken({ sub: 1, role: 'user' });
  const refresh = buildRefreshToken({ sub: 1 });
  assert.equal(verifyAccessToken(access).sub, 1);
  assert.equal(verifyRefreshToken(refresh).sub, 1);
  assert.throws(() => verifyRefreshToken(access));
  assert.throws(() => verifyAccessToken(refresh));
});

test('password policy and email normalization are enforced', () => {
  assert.equal(normalizeEmail(' User@Example.COM '), 'user@example.com');
  assert.match(validatePassword('weak'), /between 12 and 128/);
  assert.match(validatePassword('alllowercase123!'), /uppercase/);
  assert.equal(validatePassword('StrongPassword123!'), null);
});

test('configuration rejects shared signing secrets', () => {
  Object.assign(process.env, {
    DB_HOST: 'localhost', DB_NAME: 'auth', DB_USER: 'postgres', API_KEY: 'a'.repeat(32),
    JWT_ACCESS_SECRET: 's'.repeat(32), JWT_REFRESH_SECRET: 's'.repeat(32),
  });
  assert.throws(validateConfig, /must be different/);
  process.env.JWT_REFRESH_SECRET = 'r'.repeat(32);
  assert.doesNotThrow(validateConfig);
});

test('auth module embeds into Express and initializes an injected database', async () => {
  const queries = [];
  const fakeDatabase = { query: async (sql) => { queries.push(sql); return { rowCount: 0, rows: [] }; } };
  const { createAuthModule } = require('../auth-module');
  const auth = createAuthModule({
    database: fakeDatabase,
    apiKey: 'k'.repeat(32),
    jwtAccessSecret: 'a'.repeat(32),
    jwtRefreshSecret: 'r'.repeat(32),
    exposeAdminApi: false,
  });
  assert.equal(typeof auth.router, 'function');
  assert.equal(typeof auth.middleware.authenticate, 'function');
  await auth.initialize();
  assert.ok(queries.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS users')));
  await auth.close();
});
