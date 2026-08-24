const express = require('express');
const argon2 = require('argon2');
const db = require('../../utils/database');
const { createOneTimeToken, hashOneTimeToken } = require('../../utils/auth/oneTimeTokens');
const { sendAuthEmail } = require('../../utils/mailer');
const { USERNAME_REGEX, EMAIL_REGEX, normalizeEmail, normalizeUsername, validatePassword } = require('../../utils/auth/validation');
const { getConfig } = require('../../utils/config');

const router = express.Router();

router.post('/', async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'username, email and password are required.' });
  }

  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({ message: 'Username must be 3-30 characters (letters, numbers, underscore).' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) return res.status(400).json({ message: passwordError });

  try {
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [username, email],
    );

    if (existingUser.rowCount > 0) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    const createdUser = await db.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, role, email_verified_at, created_at`,
      [username, email, passwordHash],
    );

    const user = createdUser.rows[0];
    const verificationToken = createOneTimeToken();
    await db.query(
      `INSERT INTO one_time_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'verify_email', $2, NOW() + INTERVAL '24 hours')`,
      [user.id, hashOneTimeToken(verificationToken)],
    );
    const config = getConfig();
    const verifyUrl = `${config.appUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;
    await sendAuthEmail({ to: email, subject: 'Verify your email', text: `Verify your email address: ${verifyUrl}` });

    return res.status(201).json({
      message: 'User created successfully. Please verify your email address.',
      user,
      ...(config.nodeEnv !== 'production' && { verificationToken }),
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Username or email is already in use.' });
    console.error(err);
    return res.status(500).json({ message: 'Server error while creating user.' });
  }
});

module.exports = router;
