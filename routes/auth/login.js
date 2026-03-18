const express = require('express');
const argon2 = require('argon2');
const db = require('../../utils/database');
const { buildAccessToken, buildRefreshToken, hashToken, verifyRefreshToken } = require('../../utils/auth/tokens');

const router = express.Router();

const getRefreshExpiryDate = (refreshToken) => {
  const decoded = verifyRefreshToken(refreshToken);
  return new Date(decoded.exp * 1000);
};

router.post('/', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: 'identifier and password are required.' });
  }

  try {
    const result = await db.query(
      'SELECT id, username, email, password, is_active FROM users WHERE username = $1 OR email = $1 LIMIT 1',
      [identifier],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ message: 'User account is disabled.' });
    }

    const validPassword = await argon2.verify(user.password, password);

    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const tokenPayload = { sub: user.id, username: user.username, email: user.email };
    const accessToken = buildAccessToken(tokenPayload);
    const refreshToken = buildRefreshToken({ sub: user.id });

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, hashToken(refreshToken), getRefreshExpiryDate(refreshToken)],
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
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while logging in.' });
  }
});

module.exports = router;
