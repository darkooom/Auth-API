const db = require('../utils/database');

const authorize = (...roles) => async (req, res, next) => {
  try {
    const result = await db.query('SELECT role, is_active FROM users WHERE id = $1 LIMIT 1', [req.user?.sub]);
    if (!result.rowCount || !result.rows[0].is_active || !roles.includes(result.rows[0].role)) {
      return res.status(403).json({ message: 'You do not have permission to access this resource.' });
    }
    req.user.role = result.rows[0].role;
    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = authorize;
