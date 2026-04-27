const express = require("express");
const router = express.Router();
const Workspace = require("../models/Workspace");

const safeString = (value) => (typeof value === "string" ? value.trim() : "");

const getActorName = (user) => {
  const name = safeString(user?.name);
  if (name) return name;

  const email = safeString(user?.email);
  if (email) return email;

  return "Unknown user";
};

router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const visibilityFilter = {
      companyId: req.user.companyId,
      $or: [
        { owner: req.user._id },
        { members: req.user.email },
        { members: req.user.name },
        { members: String(req.user._id) },
      ],
    };

    const workspaces = await Workspace.find(visibilityFilter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const actorName = getActorName(req.user);

    const activities = workspaces.map((workspace) => {
      const updatedAt = workspace.updatedAt || workspace.createdAt || new Date();
      const wasUpdated =
        workspace.updatedAt &&
        workspace.createdAt &&
        new Date(workspace.updatedAt).getTime() !== new Date(workspace.createdAt).getTime();

      return {
        id: `workspace:${String(workspace._id)}:${new Date(updatedAt).getTime()}`,
        text: wasUpdated
          ? `Updated workspace "${workspace.name}"`
          : `Created workspace "${workspace.name}"`,
        createdAt: new Date(updatedAt).toISOString(),
        actor: { name: actorName },
      };
    });

    return res.status(200).json({
      activities,
      pagination: {
        page,
        limit,
        hasMore: workspaces.length === limit,
      },
    });
  } catch (error) {
    console.error("GET activities error:", error);
    return res.status(500).json({ message: "Failed to fetch activities" });
  }
});

module.exports = router;
