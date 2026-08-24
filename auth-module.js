const express = require('express');
const { configure, getConfig, resetConfig } = require('./utils/config');
const database = require('./utils/database');
const initDatabase = require('./utils/initDatabase');
const validateConfig = require('./utils/validateConfig');
const authenticate = require('./middleware/authenticate');
const authorize = require('./middleware/authorize');
const validateApiKey = require('./middleware/validateApiKey');
const authRouter = require('./routes/auth/router');
const adminRouter = require('./routes/admin');

/**
 * Creates an embeddable authentication module for an existing Express app.
 * The returned router owns no HTTP server and can be mounted at any path.
 */
const createAuthModule = (options = {}) => {
  const {
    database: externalDatabase,
    authPath = '/auth',
    adminPath = '/admin',
    exposeAdminApi = true,
    ...authConfig
  } = options;

  configure(authConfig);
  if (externalDatabase) database.usePool(externalDatabase);

  const router = express.Router();
  router.use(authPath, authRouter);
  if (exposeAdminApi) router.use(adminPath, adminRouter);

  return Object.freeze({
    router,
    config: getConfig(),
    initialize: async () => {
      validateConfig({ requireDatabaseEnv: !externalDatabase });
      await initDatabase();
    },
    middleware: Object.freeze({ authenticate, authorize, validateApiKey }),
    close: async () => {
      await database.close();
      resetConfig();
    },
  });
};

module.exports = { createAuthModule };
