const { getConfig } = require('./config');

const validateConfig = ({ requireDatabaseEnv = true } = {}) => {
  const config = getConfig();
  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'API_KEY'];
  if (requireDatabaseEnv) required.push('DB_HOST', 'DB_NAME', 'DB_USER');
  const values = {
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    JWT_ACCESS_SECRET: config.jwtAccessSecret,
    JWT_REFRESH_SECRET: config.jwtRefreshSecret,
    API_KEY: config.apiKey,
  };
  const missing = required.filter((name) => !values[name]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);

  for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'API_KEY']) {
    const key = { JWT_ACCESS_SECRET: 'jwtAccessSecret', JWT_REFRESH_SECRET: 'jwtRefreshSecret', API_KEY: 'apiKey' }[name];
    if (config[key].length < 32) throw new Error(`${name} must contain at least 32 characters.`);
  }
  if (config.jwtAccessSecret === config.jwtRefreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different.');
  }
  if (config.nodeEnv === 'production' && !config.smtp?.host) {
    throw new Error('SMTP_HOST is required in production.');
  }
};

module.exports = validateConfig;
