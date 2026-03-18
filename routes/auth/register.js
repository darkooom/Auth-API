const express = require('express');
const argon2 = require('argon2');
const db = require('../../utils/database');

const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'username, email and password are required.' });
  }

  if (!USERNAME_REGEX.test(username)) {
    return res.status(400).json({ message: 'Username must be 3-30 characters (letters, numbers, underscore).' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  if (typeof password !== 'string' || password.length < 10) {
    return res.status(400).json({ message: 'Password must be at least 10 characters long.' });
  }

  try {
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      [username, email],
    );

    if (existingUser.rowCount > 0) {
      return res.status(409).json({ message: 'User already exists.' });
    }

    const passwordHash = await argon2.hash(password);

    const createdUser = await db.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash],
    );

    return res.status(201).json({
      message: 'User created successfully.',
      user: createdUser.rows[0],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while creating user.' });
  }
});

module.exports = router;
