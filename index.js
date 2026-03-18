const $console = require('Console');
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const logger = require('morgan');
const helmet = require('helmet');

const initDatabase = require('./utils/initDatabase');
const routes = require('./routes/router');

const server = express();
const port = process.env.PORT || 5000;

server.use(express.json());
server.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
server.use(logger('dev'));
server.use(helmet());
server.use(express.urlencoded({ extended: false }));

routes(server);

const start = async () => {
  try {
    await initDatabase();
    server.listen(port, () => {
      $console.success(`[√] Server is listening on port ${port}`);
    });
  } catch (err) {
    $console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

start();

module.exports = server;
