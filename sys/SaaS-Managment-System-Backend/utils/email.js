const nodemailer = require("nodemailer");

let cachedTransporter = null;

const hasEmailConfig = () =>
  process.env.EMAIL_HOST &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS;

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  if (!hasEmailConfig()) return null;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return cachedTransporter;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("Email config missing. Skipping email send.");
    return { skipped: true };
  }

  if (!to) {
    return { skipped: true };
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    html,
    text,
  });

  return { sent: true };
};

module.exports = {
  sendEmail,
  hasEmailConfig,
};
