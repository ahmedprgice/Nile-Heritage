const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const { Server } = require("socket.io");
require("dotenv").config();

const taskRoutes = require("./routes/tasks");
const workspaceRoutes = require("./routes/workspaces");
const activitiesRoutes = require("./routes/activities");
const chatRoutes = require("./routes/chat");
const authRoutes = require("./routes/auth");
const requireAuth = require("./middleware/requireAuth");
const { initChatSocket } = require("./socket/chat.socket");
const notificationsRoutes = require("./routes/notifications");
const boardRoutes = require("./routes/boards");
const noteRoutes = require("./routes/notes");
const subscriptionRoutes = require("./routes/subscriptions");
const { backfillCompanyScope } = require("./scripts/backfillCompanyScope");

const app = express();
app.disable("x-powered-by");

const isVercelRuntime = Boolean(process.env.VERCEL);
const MONGO_URI = process.env.MONGO_URI;
const PORT = Number(process.env.PORT || 5000);
const DEFAULT_FRONTEND_URL = "https://saa-s-project-management-system-1vi.vercel.app";

const normalizeOrigin = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  process.env.APP_URL,
  process.env.CORS_ORIGIN,
  DEFAULT_FRONTEND_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]
  .map(normalizeOrigin)
  .filter(Boolean);

const originMatches = (origin) => {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return true;
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  if (/^https:\/\/.*\.vercel\.app$/i.test(normalizedOrigin)) return true;
  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (originMatches(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin not allowed: ${origin || "unknown"}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};

let server = null;
let io = null;

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.set("etag", "strong");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (req.method === "GET") {
    if (req.path.startsWith("/api/auth/") || req.path.startsWith("/api/chat/")) {
      res.setHeader("Cache-Control", "private, no-store");
    } else if (
      req.path.startsWith("/api/workspaces") ||
      req.path.startsWith("/api/tasks") ||
      req.path.startsWith("/api/notifications")
    ) {
      res.setHeader("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
    }
  }
  next();
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= 800) {
      console.log(
        `[perf] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${elapsedMs}ms`
      );
    }
  });
  next();
});

// Compress JSON/text responses to reduce transfer time.
app.use(compression());
app.use(express.json());

let mongoConnectPromise = null;
let backfillPromise = null;

const connectDatabaseOnce = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }
  if (!mongoConnectPromise) {
    mongoConnectPromise = mongoose
      .connect(MONGO_URI)
      .then(() => {
        console.log("MongoDB Connected");
      })
      .catch((error) => {
        mongoConnectPromise = null;
        throw error;
      });
  }
  await mongoConnectPromise;
};

const runBackfillOnce = async () => {
  if (!backfillPromise) {
    backfillPromise = backfillCompanyScope().catch((error) => {
      console.error("Company scope backfill error:", error);
    });
  }
  await backfillPromise;
};

if (isVercelRuntime) {
  app.use(async (req, res, next) => {
    try {
      await connectDatabaseOnce();
      await runBackfillOnce();
      next();
    } catch (error) {
      console.error("Database bootstrap error:", error);
      res.status(500).json({ message: "Server bootstrap failed" });
    }
  });
}

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    dbReadyState: mongoose.connection.readyState,
  });
});

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use(requireAuth);
app.use("/api/tasks", taskRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/boards", boardRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

if (!isVercelRuntime) {
  server = http.createServer(app);
  io = new Server(server, { cors: corsOptions });
  initChatSocket(io);
  connectDatabaseOnce()
    .then(() => runBackfillOnce())
    .then(() => {
      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Startup failed:", error);
      process.exit(1);
    });
}

module.exports = app;
