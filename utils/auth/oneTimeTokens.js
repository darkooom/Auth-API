const crypto = require('node:crypto');

const createOneTimeToken = () => crypto.randomBytes(32).toString('base64url');
const hashOneTimeToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { createOneTimeToken, hashOneTimeToken };
