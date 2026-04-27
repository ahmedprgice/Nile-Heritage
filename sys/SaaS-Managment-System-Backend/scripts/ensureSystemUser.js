require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: node scripts/ensureSystemUser.js <email> <password>");
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI in environment");
  process.exit(1);
}

const ensureSystemUser = async () => {
  await mongoose.connect(MONGO_URI);

  const normalizedEmail = String(email).toLowerCase().trim();
  let user = await User.findOne({ email: normalizedEmail });
  const farFuture = new Date();
  farFuture.setFullYear(farFuture.getFullYear() + 20);

  if (!user) {
    user = await User.create({
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
  } else {
    user.name = user.name || "Superuser";
    user.role = "Superuser";
    user.companyId = user.companyId || "superuser";
    user.companyName = user.companyName || "Superuser";
    user.password = password;
    user.subscription = {
      ...(user.subscription || {}),
      status: "active",
      accountStatus: "active",
      paymentStatus: "paid",
      plan: user.subscription?.plan || "Free",
      subscriptionStartDate: user.subscription?.subscriptionStartDate || new Date(),
      subscriptionEndDate: user.subscription?.subscriptionEndDate || farFuture,
      activatedAt: user.subscription?.activatedAt || new Date(),
      expiresAt: user.subscription?.expiresAt || farFuture,
      paymentMethod: "Superuser",
      lastReference: "SUPERUSER",
    };
    await user.save();
    console.log("Updated superuser:", user.email);
  }

  await mongoose.disconnect();
};

ensureSystemUser().catch((error) => {
  console.error("Failed to ensure system user:", error);
  mongoose.disconnect();
  process.exit(1);
});
