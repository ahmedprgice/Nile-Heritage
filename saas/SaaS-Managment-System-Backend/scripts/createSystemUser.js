require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/createSystemUser.js <email> <password>");
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI in environment");
  process.exit(1);
}

const createSystemUser = async () => {
  await mongoose.connect(MONGO_URI);

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    console.log("Superuser already exists:", existing.email);
    await mongoose.disconnect();
    return;
  }

  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 20);

  const user = await User.create({
    email: normalizedEmail,
    password,
    name: "Superuser",
    role: "Superuser",
    companyId: "superuser",
    companyName: "Superuser",
    subscription: {
      status: "active",
      accountStatus: "active",
      paymentStatus: "paid",
      plan: "Free",
      subscriptionStartDate: new Date(),
      subscriptionEndDate: farFuture,
      activatedAt: new Date(),
      expiresAt: farFuture,
      paymentMethod: "Superuser",
      lastReference: "SUPERUSER",
    },
  });

  console.log("Created superuser:", user.email);
  await mongoose.disconnect();
};

createSystemUser().catch((error) => {
  console.error("Failed to create system user:", error);
  mongoose.disconnect();
  process.exit(1);
});
