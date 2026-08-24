const defaults = {
  accessTokenTtl: '15m',
  refreshTokenTtl: '30d',
  requireEmailVerification: true,
  appUrl: 'http://localhost:3000',
  mailFrom: 'Auth API <no-reply@example.com>',
};

let configured = {};

const envConfig = () => ({
  apiKey: process.env.API_KEY,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL,
  refreshTokenTtl: process.env.REFRESH_TOKEN_TTL,
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION !== 'false',
  appUrl: process.env.APP_URL,
  nodeEnv: process.env.NODE_ENV,
  smtp: process.env.SMTP_HOST ? {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
  mailFrom: process.env.MAIL_FROM,
});

const configure = (options = {}) => {
  configured = { ...configured, ...options };
};

const getConfig = () => {
  const withoutUndefined = (value) => Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
  return { ...defaults, ...withoutUndefined(envConfig()), ...withoutUndefined(configured) };
};

const resetConfig = () => { configured = {}; };

module.exports = { configure, getConfig, resetConfig };
