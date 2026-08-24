const { rateLimit } = require('express-rate-limit');

const common = { standardHeaders: 'draft-7', legacyHeaders: false };
const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 100 });
const credentialLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { message: 'Too many attempts. Please try again later.' },
});

module.exports = { authLimiter, credentialLimiter };
