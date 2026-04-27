const crypto = require("crypto");

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  throw new Error(`${name} is not configured`);
};

const getJwtSecret = () => getRequiredEnv("JWT_SECRET");

const getAppUrl = () => {
  const candidates = [
    process.env.APP_URL,
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    "http://localhost:3000",
  ];

  const valid = candidates.find((candidate) => {
    return typeof candidate === "string" && candidate.trim();
  });

  return String(valid).trim().replace(/\/+$/, "");
};

const hashInvitationToken = (token) =>
  crypto.createHash("sha256").update(String(token || "").trim()).digest("hex");

module.exports = {
  getJwtSecret,
  getAppUrl,
  hashInvitationToken,
};
