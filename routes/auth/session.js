const express = require('express');
const argon2 = require('argon2');
const db = require('../../utils/database');
const authenticate = require('../../middleware/authenticate');
const { buildAccessToken, buildRefreshToken, hashToken, verifyRefreshToken } = require('../../utils/auth/tokens');
const { EMAIL_REGEX, normalizeEmail, normalizeUsername, USERNAME_REGEX, validatePassword } = require('../../utils/auth/validation');

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
       , u.role FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );

    if (tokenRecord.rowCount === 0) {
      return res.status(401).json({ message: 'Refresh token is invalid.' });
    }

    const currentToken = tokenRecord.rows[0];

    if (currentToken.revoked_at) {
      await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [currentToken.user_id]);
      return res.status(401).json({ message: 'Refresh token reuse detected. All sessions were revoked.' });
    }

    if (new Date(currentToken.expires_at) <= new Date() || currentToken.user_id !== decoded.sub) {
      return res.status(401).json({ message: 'Refresh token is expired or revoked.' });
    }

    if (!currentToken.is_active) {
      return res.status(403).json({ message: 'User account is disabled.' });
    }

    const revoked = await db.query('UPDATE refresh_tokens SET revoked_at = NOW(), last_used_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING id', [currentToken.id]);
    if (!revoked.rowCount) return res.status(401).json({ message: 'Refresh token has already been used.' });

    const accessToken = buildAccessToken({
      sub: currentToken.user_id,
      username: currentToken.username,
      email: currentToken.email,
      role: currentToken.role,
    });
    const rotatedRefreshToken = buildRefreshToken({ sub: currentToken.user_id });

    await db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [currentToken.user_id, hashToken(rotatedRefreshToken), readExpiryDate(rotatedRefreshToken), req.ip, String(req.get('user-agent') || '').slice(0, 500)],
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
      `SELECT id, username, email, role, is_active, email_verified_at, created_at, updated_at, last_login
       FROM users WHERE id = $1 LIMIT 1`,
      [req.user.sub],
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!userResult.rows[0].is_active) return res.status(403).json({ message: 'User account is disabled.' });

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

  const passwordError = validatePassword(newPassword);
  if (passwordError) return res.status(400).json({ message: passwordError });

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

router.patch('/me', authenticate, async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const email = normalizeEmail(req.body.email);
  if (username && !USERNAME_REGEX.test(username)) return res.status(400).json({ message: 'Invalid username.' });
  if (email && !EMAIL_REGEX.test(email)) return res.status(400).json({ message: 'Invalid email.' });
  if (!username && !email) return res.status(400).json({ message: 'username or email is required.' });
  try {
    const result = await db.query(
      `UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email),
       email_verified_at = CASE WHEN $2::text IS NOT NULL AND $2 <> email THEN NULL ELSE email_verified_at END, updated_at = NOW()
       WHERE id = $3 RETURNING id, username, email, role, email_verified_at, updated_at`,
      [username || null, email || null, req.user.sub],
    );
    return res.json({ message: 'Profile updated.', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Username or email is already in use.' });
    console.error(err);
    return res.status(500).json({ message: 'Server error while updating profile.' });
  }
});

router.get('/sessions', authenticate, async (req, res) => {
  const result = await db.query(
    `SELECT id, created_at, last_used_at, expires_at, ip_address, user_agent
     FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC`,
    [req.user.sub],
  );
  return res.json({ sessions: result.rows });
});

router.delete('/sessions/:id', authenticate, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Invalid session id.' });
  const result = await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id', [id, req.user.sub]);
  if (!result.rowCount) return res.status(404).json({ message: 'Active session not found.' });
  return res.json({ message: 'Session revoked.' });
});

router.post('/logout-all', authenticate, async (req, res) => {
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [req.user.sub]);
  return res.json({ message: 'All sessions revoked.' });
});

router.delete('/me', authenticate, async (req, res) => {
  if (!req.body.password) return res.status(400).json({ message: 'password is required.' });
  const result = await db.query('SELECT password FROM users WHERE id = $1', [req.user.sub]);
  if (!result.rowCount || !(await argon2.verify(result.rows[0].password, req.body.password))) return res.status(401).json({ message: 'Invalid password.' });
  await db.query('DELETE FROM users WHERE id = $1', [req.user.sub]);
  return res.json({ message: 'Account deleted.' });
});

module.exports = router;
