const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '30d';

const getSecrets = () => {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment variables.');
  }

  return { accessSecret, refreshSecret };
};

const buildAccessToken = (payload) => {
  const { accessSecret } = getSecrets();
  return jwt.sign(payload, accessSecret, { expiresIn: ACCESS_TOKEN_TTL });
};

const buildRefreshToken = (payload) => {
  const { refreshSecret } = getSecrets();
  return jwt.sign(payload, refreshSecret, { expiresIn: REFRESH_TOKEN_TTL });
};

const verifyAccessToken = (token) => {
  const { accessSecret } = getSecrets();
  return jwt.verify(token, accessSecret);
};

const verifyRefreshToken = (token) => {
  const { refreshSecret } = getSecrets();
  return jwt.verify(token, refreshSecret);
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
  buildAccessToken,
  buildRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};
