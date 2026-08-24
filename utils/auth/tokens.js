const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { getConfig } = require('../config');

const getSecrets = () => {
  const { jwtAccessSecret: accessSecret, jwtRefreshSecret: refreshSecret } = getConfig();

  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment variables.');
  }

  return { accessSecret, refreshSecret };
};

const buildAccessToken = (payload) => {
  const { accessSecret } = getSecrets();
  return jwt.sign(payload, accessSecret, { expiresIn: getConfig().accessTokenTtl, issuer: 'auth-api', audience: 'auth-api-client' });
};

const buildRefreshToken = (payload) => {
  const { refreshSecret } = getSecrets();
  return jwt.sign(payload, refreshSecret, { expiresIn: getConfig().refreshTokenTtl, issuer: 'auth-api', audience: 'auth-api-client', jwtid: crypto.randomUUID() });
};

const verifyAccessToken = (token) => {
  const { accessSecret } = getSecrets();
  return jwt.verify(token, accessSecret, { issuer: 'auth-api', audience: 'auth-api-client' });
};

const verifyRefreshToken = (token) => {
  const { refreshSecret } = getSecrets();
  return jwt.verify(token, refreshSecret, { issuer: 'auth-api', audience: 'auth-api-client' });
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
  buildAccessToken,
  buildRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
