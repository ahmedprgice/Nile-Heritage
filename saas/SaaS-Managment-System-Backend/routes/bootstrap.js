const express = require("express");
const Workspace = require("../models/Workspace");
const Notification = require("../models/Notification");

const router = express.Router();

const userWorkspaceTokens = (user) =>
  [
    user?._id ? String(user._id) : "",
    user?.email ? String(user.email).toLowerCase() : "",
    user?.name ? String(user.name) : "",
  ].filter(Boolean);

const workspaceAccessScope = (user) => ({
  companyId: user.companyId,
  $or: [
    { owner: user._id },
    { members: { $in: userWorkspaceTokens(user) } },
  ],
});

router.get("/", async (req, res) => {
  try {
    const [workspaces, unreadCount] = await Promise.all([
      Workspace.find(workspaceAccessScope(req.user))
        .select("_id name color isActive owner boards updatedAt createdAt")
        .sort({ updatedAt: -1 })
        .limit(25)
        .lean(),
      Notification.countDocuments({
        userId: req.user._id,
        companyId: req.user.companyId,
        isRead: false,
      }),
    ]);

    // Small private cache window to reduce repeated dashboard round-trips.
    res.setHeader("Cache-Control", "private, max-age=10, stale-while-revalidate=30");

    return res.status(200).json({
      data: {
        me: {
          id: String(req.user._id),
          name: req.user.name || "",
          email: req.user.email || "",
          role: req.user.role || "Member",
          companyId: req.user.companyId || "",
          companyName: req.user.companyName || "",
          subscription: req.user.subscription || null,
        },
        workspaces: Array.isArray(workspaces) ? workspaces : [],
        notifications: {
          unreadCount: Number(unreadCount || 0),
        },
      },
      meta: {
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/bootstrap error:", error);
    return res.status(500).json({ message: "Failed to fetch bootstrap data" });
  }
});

module.exports = router;

