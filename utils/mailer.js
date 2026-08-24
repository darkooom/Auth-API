const nodemailer = require('nodemailer');
const { getConfig } = require('./config');

let transporter;

const getTransporter = () => {
  const { smtp } = getConfig();
  if (!smtp?.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port || 587),
      secure: smtp.secure === true,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
    });
  }
  return transporter;
};

const sendAuthEmail = async ({ to, subject, text }) => {
  const mailer = getTransporter();
  if (!mailer) {
    if (getConfig().nodeEnv === 'production') throw new Error('SMTP is not configured.');
    console.info(`[development email] To: ${to}\n${text}`);
    return;
  }
  await mailer.sendMail({ from: getConfig().mailFrom, to, subject, text });
};

module.exports = { sendAuthEmail };
