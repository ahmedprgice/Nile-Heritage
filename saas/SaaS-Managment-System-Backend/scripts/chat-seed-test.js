require("dotenv").config();

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { io } = require("socket.io-client");

const User = require("../models/User");
const Channel = require("../models/Channel");
const { getJwtSecret } = require("../utils/security");

const API_URL = process.env.API_URL || "http://localhost:5000";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensureUser = async ({ email, name, password }) => {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, name, password });
  }
  return user;
};

const createToken = (userId) =>
  jwt.sign({ id: userId }, getJwtSecret(), {
    expiresIn: "1d",
  });

const waitForConnect = (socket, label) =>
  new Promise((resolve, reject) => {
    socket.once("connect", () => {
      console.log(`${label} connected (${socket.id})`);
      resolve();
    });

    socket.once("connect_error", (error) => {
      reject(error);
    });
  });

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const userA = await ensureUser({
    email: "chat.user.a@example.com",
    name: "Chat User A",
    password: "password123",
  });

  const userB = await ensureUser({
    email: "chat.user.b@example.com",
    name: "Chat User B",
    password: "password123",
  });

  let channel = await Channel.findOne({ name: "mvp-chat-test" });
  if (!channel) {
    channel = await Channel.create({
      name: "mvp-chat-test",
      createdBy: userA._id,
      members: [userA._id, userB._id],
    });
  } else {
    channel.members = [userA._id, userB._id];
    channel.createdBy = userA._id;
    await channel.save();
  }

  const tokenA = createToken(userA._id);
  const tokenB = createToken(userB._id);

  const socketA = io(API_URL, { auth: { token: tokenA }, transports: ["websocket"] });
  const socketB = io(API_URL, { auth: { token: tokenB }, transports: ["websocket"] });

  await Promise.all([waitForConnect(socketA, "UserA"), waitForConnect(socketB, "UserB")]);

  socketB.on("message:new", (payload) => {
    console.log("UserB received message:new", payload.id, payload.contentText || payload.contentHtml);
  });

  socketB.on("typing:update", (payload) => {
    console.log("UserB received typing:update", payload);
  });

  socketB.on("read:updated", (payload) => {
    console.log("UserB received read:updated", payload);
  });

  await new Promise((resolve) => {
    socketA.emit(
      "typing:start",
      { conversationType: "channel", channelId: String(channel._id) },
      (ack) => {
        console.log("typing:start ack", ack);
        resolve();
      }
    );
  });

  let sentMessage = null;
  await new Promise((resolve) => {
    socketA.emit(
      "message:send",
      {
        conversationType: "channel",
        channelId: String(channel._id),
        contentHtml: "<p>Hello from UserA</p>",
        contentText: "Hello from UserA",
        messageType: "message",
        clientMessageId: `seed-${Date.now()}`,
      },
      (ack) => {
        console.log("message:send ack", ack);
        sentMessage = ack.message;
        resolve();
      }
    );
  });

  await new Promise((resolve) => {
    socketA.emit(
      "read:update",
      {
        conversationType: "channel",
        channelId: String(channel._id),
        lastReadMessageId: sentMessage?.id,
      },
      (ack) => {
        console.log("read:update ack", ack);
        resolve();
      }
    );
  });

  await new Promise((resolve) => {
    socketA.emit(
      "typing:stop",
      { conversationType: "channel", channelId: String(channel._id) },
      (ack) => {
        console.log("typing:stop ack", ack);
        resolve();
      }
    );
  });

  await delay(1000);

  socketA.disconnect();
  socketB.disconnect();
  await mongoose.disconnect();

  console.log("Chat seed/test script finished successfully");
}

main().catch(async (error) => {
  console.error("chat-seed-test failed:", error);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error("disconnect error:", disconnectError);
  }
  process.exit(1);
});
