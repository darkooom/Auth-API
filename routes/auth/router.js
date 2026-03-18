const express = require('express');
const validateApiKey = require('../../middleware/validateApiKey');

const registerRoute = require('./register');
const loginRoute = require('./login');
const sessionRoute = require('./session');

const router = express.Router();

router.use(validateApiKey);

router.use('/register', registerRoute);
router.use('/login', loginRoute);
router.use('/', sessionRoute);

module.exports = router;
