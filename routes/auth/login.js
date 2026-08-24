const express = require('express');
const argon2 = require('argon2');
const db = require('../../utils/database');
const { buildAccessToken, buildRefreshToken, hashToken, verifyRefreshToken } = require('../../utils/auth/tokens');
const { normalizeEmail } = require('../../utils/auth/validation');
const { getConfig } = require('../../utils/config');

const router = express.Router();

const getRefreshExpiryDate = (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);
  return new Date(decoded.exp * 1000);
};

router.post('/', async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const { password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: 'identifier and password are required.' });
  }

  try {
    const result = await db.query(
      'SELECT id, username, email, password, role, is_active, email_verified_at FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [identifier, normalizeEmail(identifier)],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'User account is disabled.' });
    }

    if (!user.email_verified_at && getConfig().requireEmailVerification) {
      return res.status(403).json({ message: 'Please verify your email address before logging in.' });
    }

    const validPassword = await argon2.verify(user.password, password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const tokenPayload = { sub: user.id, username: user.username, email: user.email, role: user.role };
    const accessToken = buildAccessToken(tokenPayload);
    const refreshToken = buildRefreshToken({ sub: user.id });

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [user.id, hashToken(refreshToken), getRefreshExpiryDate(refreshToken), req.ip, String(req.get('user-agent') || '').slice(0, 500)],
    );

    await db.query('UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);

    return res.status(200).json({
      message: 'Logged in successfully.',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while logging in.' });
  }
});

module.exports = router;
