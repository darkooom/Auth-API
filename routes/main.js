const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  return res.status(200).json({
    message: 'Auth API is running.',
    version: '2.0.0',
    docs: '/README.md',
  });
});

router.get('/health', (req, res) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
