require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/updateSystemPassword.js <email> <password>");
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI in environment");
  process.exit(1);
}

const updatePassword = async () => {
  await mongoose.connect(MONGO_URI);

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    console.error("User not found:", normalizedEmail);
    await mongoose.disconnect();
    process.exit(1);
  }

  user.password = password;
  await user.save();

  console.log("Password updated for:", user.email);
  await mongoose.disconnect();
};

updatePassword().catch((error) => {
  console.error("Failed to update password:", error);
  mongoose.disconnect();
  process.exit(1);
});
