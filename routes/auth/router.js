const express = require('express');
const validateApiKey = require('../../middleware/validateApiKey');

const registerRoute = require('./register');
const loginRoute = require('./login');
const sessionRoute = require('./session');
const recoveryRoute = require('./recovery');
const { authLimiter, credentialLimiter } = require('../../middleware/rateLimiters');

const router = express.Router();

router.use(validateApiKey);
router.use(authLimiter);

router.use('/register', credentialLimiter, registerRoute);
router.use('/login', credentialLimiter, loginRoute);
router.use('/', credentialLimiter, recoveryRoute);
router.use('/', sessionRoute);

module.exports = router;
