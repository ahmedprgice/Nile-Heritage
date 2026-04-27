const jwt = require("jsonwebtoken");
const User = require("../models/User");
const chatService = require("../services/chat.service");
const { getJwtSecret } = require("../utils/security");

const userConnectionCounts = new Map();
const rateLimitStore = new Map();
const SOCKET_LOG_SCOPE = "chat-socket";

const createRateLimiter = (key, limit, intervalMs) => {
  const now = Date.now();
  const bucket = rateLimitStore.get(key) || [];
  const recent = bucket.filter((ts) => now - ts < intervalMs);

  if (recent.length >= limit) {
    rateLimitStore.set(key, recent);
    return false;
  }

  recent.push(now);
  rateLimitStore.set(key, recent);
  return true;
};

const makeAck = (ack) => {
  if (typeof ack !== "function") {
    return () => {};
  }

  let called = false;
  const timeout = setTimeout(() => {
    if (called) return;
    called = true;
    ack({ ok: false, error: "Request timeout" });
  }, 8000);

  return (payload) => {
    if (called) return;
    called = true;
    clearTimeout(timeout);
    ack(payload);
  };
};

const emitPresenceUpdate = (io, rooms, presence) => {
  const uniqueRooms = new Set([rooms.userRoom, ...rooms.channelRooms, ...rooms.directRooms]);

  uniqueRooms.forEach((room) => {
    io.to(room).emit("presence:update", presence);
  });
};

const emitToParticipantRooms = (io, participantUserIds, eventName, payload) => {
  const uniqueUserIds = new Set((participantUserIds || []).map((id) => String(id)));
  uniqueUserIds.forEach((id) => {
    io.to(`user:${id}`).emit(eventName, payload);
  });
};

const logSocketEvent = (event, data = {}) => {
  console.log(
    JSON.stringify({
      scope: SOCKET_LOG_SCOPE,
      event,
      timestamp: new Date().toISOString(),
      ...data,
    })
  );
};

const normalizeConversationPayload = (payload = {}, fallbackType = null) => {
  const normalized = { ...(payload || {}) };
  const room = typeof normalized.room === "string" ? normalized.room.trim() : "";

  if (room.startsWith("channel:") && !normalized.channelId) {
    normalized.channelId = room.slice("channel:".length);
    normalized.conversationType = "channel";
  }

  if (room.startsWith("direct:") && !normalized.conversationId) {
    normalized.conversationId = room.slice("direct:".length);
    normalized.conversationType = "direct";
  }

  if (!normalized.conversationType && fallbackType) {
    normalized.conversationType = fallbackType;
  }
  return normalized;
};

const getTokenFromHandshake = (socket) => {
  const tokenFromAuth = socket.handshake.auth?.token;
  if (tokenFromAuth) return tokenFromAuth;

  const header = socket.handshake.headers?.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7);

  return null;
};

const initChatSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = getTokenFromHandshake(socket);
      if (!token) {
        logSocketEvent("socket.auth.failure", {
          reason: "missing_token",
          socketId: socket.id,
        });
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, getJwtSecret());
      const user = await User.findById(decoded.id).select("-password").lean();

      if (!user) {
        logSocketEvent("socket.auth.failure", {
          reason: "user_not_found",
          socketId: socket.id,
        });
        return next(new Error("Unauthorized"));
      }

      socket.user = user;
      return next();
    } catch (error) {
      logSocketEvent("socket.auth.failure", {
        reason: error.message,
        socketId: socket.id,
      });
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = String(socket.user._id);
    const userName = socket.user.name || socket.user.email || "Unknown user";

    try {
      const rooms = await chatService.getSocketRoomsForUser(socket.user);

      socket.join(rooms.userRoom);
      rooms.channelRooms.forEach((room) => socket.join(room));
      rooms.directRooms.forEach((room) => socket.join(room));

      userConnectionCounts.set(userId, (userConnectionCounts.get(userId) || 0) + 1);

      const presence = await chatService.setPresence(socket.user._id, "online");
      emitPresenceUpdate(io, rooms, presence);

      logSocketEvent("socket.connect", { userId, socketId: socket.id });
    } catch (error) {
      console.error("Socket connect init error:", error);
      socket.disconnect(true);
      return;
    }

    socket.on("message:send", async (payload, ack) => {
      const respond = makeAck(ack);

      if (!createRateLimiter(`msg:${userId}`, 30, 10000)) {
        return respond({ ok: false, error: "Rate limit exceeded" });
      }

      try {
        const result = await chatService.sendMessage(socket.user, payload || {});
        io.to(result.room).emit("message:new", result.message);
        emitToParticipantRooms(io, result.participantUserIds, "message:new", result.message);
        const socketsInRoom = await io.in(result.room).allSockets();
        logSocketEvent("message.send.success", {
          userId,
          socketId: socket.id,
          channelId: result.message?.channelId || null,
          conversationId: result.message?.conversationId || null,
          room: result.room,
          socketsInRoom: socketsInRoom.size,
          messageId: result.message?.id || null,
        });
        return respond({ ok: true, message: result.message });
      } catch (error) {
        logSocketEvent("message.send.failure", {
          userId,
          socketId: socket.id,
          channelId: payload?.channelId || null,
          conversationId: payload?.conversationId || null,
          error: error.message,
        });
        if (error instanceof chatService.ChatError) {
          return respond({ ok: false, error: error.message });
        }
        return respond({ ok: false, error: "Failed to send message" });
      }
    });

    socket.on("typing:start", async (payload, ack) => {
      const respond = makeAck(ack);

      if (!createRateLimiter(`typing:${userId}`, 60, 10000)) {
        return respond({ ok: false, error: "Rate limit exceeded" });
      }

      try {
        const scope = await chatService.ensureConversationScope(
          socket.user._id,
          normalizeConversationPayload(payload)
        );
        const typingPayload = {
          conversationType: scope.conversationType,
          channelId: scope.channelId,
          conversationId: scope.conversationId,
          userId,
          name: userName,
          isTyping: true,
        };
        socket.to(scope.room).emit("typing:update", typingPayload);
        (scope.participantUserIds || [])
          .filter((id) => String(id) !== userId)
          .forEach((id) => io.to(`user:${String(id)}`).emit("typing:update", typingPayload));
        return respond({ ok: true });
      } catch (error) {
        if (error instanceof chatService.ChatError) {
          return respond({ ok: false, error: error.message });
        }
        return respond({ ok: false, error: "Failed to update typing state" });
      }
    });

    socket.on("typing:stop", async (payload, ack) => {
      const respond = makeAck(ack);

      try {
        const scope = await chatService.ensureConversationScope(
          socket.user._id,
          normalizeConversationPayload(payload)
        );
        const typingPayload = {
          conversationType: scope.conversationType,
          channelId: scope.channelId,
          conversationId: scope.conversationId,
          userId,
          name: userName,
          isTyping: false,
        };
        socket.to(scope.room).emit("typing:update", typingPayload);
        (scope.participantUserIds || [])
          .filter((id) => String(id) !== userId)
          .forEach((id) => io.to(`user:${String(id)}`).emit("typing:update", typingPayload));
        return respond({ ok: true });
      } catch (error) {
        if (error instanceof chatService.ChatError) {
          return respond({ ok: false, error: error.message });
        }
        return respond({ ok: false, error: "Failed to update typing state" });
      }
    });

    socket.on("read:update", async (payload, ack) => {
      const respond = makeAck(ack);

      try {
        const result = await chatService.updateRead(
          socket.user._id,
          normalizeConversationPayload(payload)
        );
        io.to(result.room).emit("read:updated", result.read);
        emitToParticipantRooms(io, result.participantUserIds, "read:updated", result.read);
        return respond({ ok: true, read: result.read });
      } catch (error) {
        if (error instanceof chatService.ChatError) {
          return respond({ ok: false, error: error.message });
        }
        return respond({ ok: false, error: "Failed to update read receipt" });
      }
    });

    const handleJoinConversation = async (payload, ack) => {
      const respond = makeAck(ack);
      try {
        const scope = await chatService.ensureConversationScope(
          socket.user._id,
          normalizeConversationPayload(payload)
        );
        socket.join(scope.room);
        logSocketEvent("conversation.join", {
          userId,
          socketId: socket.id,
          channelId: scope.channelId || null,
          conversationId: scope.conversationId || null,
          room: scope.room,
        });
        return respond({
          ok: true,
          room: scope.room,
          conversationType: scope.conversationType,
          channelId: scope.channelId || null,
          conversationId: scope.conversationId || null,
        });
      } catch (error) {
        logSocketEvent("conversation.join.failure", {
          userId,
          socketId: socket.id,
          channelId: payload?.channelId || null,
          conversationId: payload?.conversationId || null,
          error: error.message,
        });
        if (error instanceof chatService.ChatError) {
          return respond({ ok: false, error: error.message });
        }
        return respond({ ok: false, error: "Failed to join conversation" });
      }
    };

    const handleLeaveConversation = async (payload, ack) => {
      const respond = makeAck(ack);
      try {
        const scope = await chatService.ensureConversationScope(
          socket.user._id,
          normalizeConversationPayload(payload)
        );
        socket.leave(scope.room);
        logSocketEvent("conversation.leave", {
          userId,
          socketId: socket.id,
          channelId: scope.channelId || null,
          conversationId: scope.conversationId || null,
          room: scope.room,
        });
        return respond({
          ok: true,
          room: scope.room,
        });
      } catch (error) {
        if (error instanceof chatService.ChatError) {
          return respond({ ok: false, error: error.message });
        }
        return respond({ ok: false, error: "Failed to leave conversation" });
      }
    };

    socket.on("conversation:join", handleJoinConversation);
    socket.on("conversation:leave", handleLeaveConversation);
    socket.on("channel:join", (payload, ack) =>
      handleJoinConversation(normalizeConversationPayload(payload, "channel"), ack)
    );
    socket.on("channel:leave", (payload, ack) =>
      handleLeaveConversation(normalizeConversationPayload(payload, "channel"), ack)
    );
    socket.on("room:join", handleJoinConversation);
    socket.on("room:leave", handleLeaveConversation);

    socket.on("disconnect", async () => {
      try {
        const current = userConnectionCounts.get(userId) || 0;
        const next = Math.max(current - 1, 0);

        if (next === 0) {
          userConnectionCounts.delete(userId);
          const rooms = await chatService.getSocketRoomsForUser(socket.user);
          const presence = await chatService.setPresence(socket.user._id, "offline");
          emitPresenceUpdate(io, rooms, presence);
        } else {
          userConnectionCounts.set(userId, next);
        }
      } catch (error) {
        console.error("Socket disconnect handling error:", error);
      }

      logSocketEvent("socket.disconnect", { userId, socketId: socket.id });
    });
  });
};

module.exports = { initChatSocket };
