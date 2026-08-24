const express = require('express');
const argon2 = require('argon2');
const db = require('../../utils/database');
const { createOneTimeToken, hashOneTimeToken } = require('../../utils/auth/oneTimeTokens');
const { normalizeEmail, validatePassword } = require('../../utils/auth/validation');
const { sendAuthEmail } = require('../../utils/mailer');
const { getConfig } = require('../../utils/config');

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

const issueToken = async (user, purpose, ttl, path, subject) => {
  const token = createOneTimeToken();
  await db.query('UPDATE one_time_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL', [user.id, purpose]);
  await db.query(
    `INSERT INTO one_time_tokens (user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, NOW() + $4::interval)`,
    [user.id, purpose, hashOneTimeToken(token), ttl],
  );
  const url = `${getConfig().appUrl}${path}?token=${encodeURIComponent(token)}`;
  await sendAuthEmail({ to: user.email, subject, text: `${subject}: ${url}` });
  return token;
};

router.post('/verify-email', asyncRoute(async (req, res) => {
  if (!req.body.token) return res.status(400).json({ message: 'token is required.' });
  const result = await db.query(
    `UPDATE one_time_tokens ot SET used_at = NOW()
     FROM users u WHERE ot.user_id = u.id AND ot.token_hash = $1 AND ot.purpose = 'verify_email'
       AND ot.used_at IS NULL AND ot.expires_at > NOW()
     RETURNING u.id`,
    [hashOneTimeToken(req.body.token)],
  );
  if (!result.rowCount) return res.status(400).json({ message: 'Verification token is invalid or expired.' });
  await db.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $1', [result.rows[0].id]);
  return res.json({ message: 'Email address verified successfully.' });
}));

router.post('/resend-verification', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const result = await db.query('SELECT id, email, email_verified_at FROM users WHERE email = $1 LIMIT 1', [email]);
  if (result.rowCount && !result.rows[0].email_verified_at) {
    const token = await issueToken(result.rows[0], 'verify_email', '24 hours', '/verify-email', 'Verify your email');
    return res.json({ message: 'If the account exists, a verification email has been sent.', ...(getConfig().nodeEnv !== 'production' && { verificationToken: token }) });
  }
  return res.json({ message: 'If the account exists, a verification email has been sent.' });
}));

router.post('/forgot-password', asyncRoute(async (req, res) => {
  const result = await db.query('SELECT id, email FROM users WHERE email = $1 AND is_active = true LIMIT 1', [normalizeEmail(req.body.email)]);
  if (result.rowCount) {
    const token = await issueToken(result.rows[0], 'reset_password', '1 hour', '/reset-password', 'Reset your password');
    return res.json({ message: 'If the account exists, a password reset email has been sent.', ...(getConfig().nodeEnv !== 'production' && { resetToken: token }) });
  }
  return res.json({ message: 'If the account exists, a password reset email has been sent.' });
}));

router.post('/reset-password', asyncRoute(async (req, res) => {
  const error = validatePassword(req.body.newPassword);
  if (!req.body.token || error) return res.status(400).json({ message: error || 'token is required.' });
  const result = await db.query(
    `UPDATE one_time_tokens SET used_at = NOW() WHERE token_hash = $1 AND purpose = 'reset_password'
       AND used_at IS NULL AND expires_at > NOW() RETURNING user_id`,
    [hashOneTimeToken(req.body.token)],
  );
  if (!result.rowCount) return res.status(400).json({ message: 'Reset token is invalid or expired.' });
  const hash = await argon2.hash(req.body.newPassword, { type: argon2.argon2id });
  await db.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hash, result.rows[0].user_id]);
  await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL', [result.rows[0].user_id]);
  return res.json({ message: 'Password reset successfully. Please log in again.' });
}));

module.exports = router;
