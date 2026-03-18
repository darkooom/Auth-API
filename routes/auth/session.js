const express = require('express');
const argon2 = require('argon2');
const db = require('../../utils/database');
const authenticate = require('../../middleware/authenticate');
const { buildAccessToken, buildRefreshToken, hashToken, verifyRefreshToken } = require('../../utils/auth/tokens');

const router = express.Router();

const readExpiryDate = (token) => {
  const decoded = verifyRefreshToken(token);
  return new Date(decoded.exp * 1000);
};

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'refreshToken is required.' });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const tokenRecord = await db.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at, u.username, u.email, u.is_active
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );

    if (tokenRecord.rowCount === 0) {
      return res.status(401).json({ message: 'Refresh token is invalid.' });
    }

    const currentToken = tokenRecord.rows[0];

    if (currentToken.revoked_at || new Date(currentToken.expires_at) <= new Date() || currentToken.user_id !== decoded.sub) {
      return res.status(401).json({ message: 'Refresh token is expired or revoked.' });
    }

    if (!currentToken.is_active) {
      return res.status(403).json({ message: 'User account is disabled.' });
    }

    await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [currentToken.id]);

    const accessToken = buildAccessToken({
      sub: currentToken.user_id,
      username: currentToken.username,
      email: currentToken.email,
    });
    const rotatedRefreshToken = buildRefreshToken({ sub: currentToken.user_id });

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [currentToken.user_id, hashToken(rotatedRefreshToken), readExpiryDate(rotatedRefreshToken)],
    );

    return res.status(200).json({
      message: 'Session refreshed.',
      accessToken,
      refreshToken: rotatedRefreshToken,
    });
  } catch (err) {
    return res.status(401).json({ message: 'Refresh token is invalid or expired.' });
  }
});

router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'refreshToken is required.' });
  }

  try {
    const tokenHash = hashToken(refreshToken);
    await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]);
    return res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while logging out.' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT id, username, email, is_active, created_at, updated_at, last_login
       FROM users WHERE id = $1 LIMIT 1`,
      [req.user.sub],
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({ user: userResult.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while loading profile.' });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'currentPassword and newPassword are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    return res.status(400).json({ message: 'New password must be at least 10 characters long.' });
  }

  try {
    const userResult = await db.query('SELECT id, password FROM users WHERE id = $1 LIMIT 1', [req.user.sub]);

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = userResult.rows[0];
    const valid = await argon2.verify(user.password, currentPassword);

    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const hash = await argon2.hash(newPassword);
    await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hash, user.id]);
    await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [user.id]);

    return res.status(200).json({ message: 'Password changed successfully. Please log in again.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while changing password.' });
  }
});

module.exports = router;
