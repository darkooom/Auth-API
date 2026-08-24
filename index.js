require('dotenv').config();

const express = require('express');
const cors = require('cors');
const logger = require('morgan');
const helmet = require('helmet');

const { createAuthModule } = require('./auth-module');
const mainRoute = require('./routes/main');

const server = express();
const port = process.env.PORT || 5000;
const auth = createAuthModule();

if (process.env.TRUST_PROXY) server.set('trust proxy', Number(process.env.TRUST_PROXY));

const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);

server.disable('x-powered-by');
server.use(express.json({ limit: '32kb' }));
server.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : false,
  credentials: allowedOrigins.length > 0,
}));
server.use(logger('dev'));
server.use(helmet());
server.use(express.urlencoded({ extended: false }));

server.use('/', mainRoute);
server.use('/', auth.router);

server.use((req, res) => res.status(404).json({ message: 'Route not found.' }));
server.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ message: 'Internal server error.' });
});

const start = async () => {
  try {
    await auth.initialize();
    server.listen(port, () => {
      console.info(`[√] Server is listening on port ${port}`);
    });
  } catch (err) {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

if (require.main === module) start();

module.exports = server;
