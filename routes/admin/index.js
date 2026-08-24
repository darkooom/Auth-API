const express = require('express');
const db = require('../../utils/database');
const validateApiKey = require('../../middleware/validateApiKey');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');

const router = express.Router();

router.use(validateApiKey);
router.use(authenticate);
router.use(authorize('admin'));

router.get('/', (req, res) => {
  res.status(200).json({ message: 'Admin API ready.' });
});

router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, username, email, role, is_active, email_verified_at, created_at, updated_at, last_login
       FROM users
       ORDER BY id ASC`,
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.get('/users/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  try {
    const result = await db.query(
      `SELECT id, username, email, is_active, created_at, updated_at, last_login
       FROM users WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { username, email, isActive, role } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  const updates = [];
  const values = [];

  if (username) {
    updates.push(`username = $${updates.length + 1}`);
    values.push(username);
  }

  if (email) {
    updates.push(`email = $${updates.length + 1}`);
    values.push(email);
  }

  if (typeof isActive === 'boolean') {
    updates.push(`is_active = $${updates.length + 1}`);
    values.push(isActive);
  }

  if (role !== undefined) {
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ message: 'role must be user or admin.' });
    updates.push(`role = $${updates.length + 1}`);
    values.push(role);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No update fields provided.' });
  }

  values.push(id);

  try {
    const result = await db.query(
      `UPDATE users
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, username, email, role, is_active, updated_at`,
      values,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'User updated', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  try {
    const result = await db.query('DELETE FROM users WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
