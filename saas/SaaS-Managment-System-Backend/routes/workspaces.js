const express = require("express");
const router = express.Router();
const Workspace = require("../models/Workspace");
const Board = require("../models/Board");
const User = require("../models/User");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");
const requirePermission = require("../middleware/requirePermission");
const { canManageWorkspaceMembers } = require("../utils/permissions");

const workspaceScope = (req) => ({ companyId: req.user.companyId });

const userWorkspaceTokens = (user) =>
  [
    user?._id ? String(user._id) : "",
    user?.email ? String(user.email).toLowerCase() : "",
    user?.name ? String(user.name) : "",
  ].filter(Boolean);

const workspaceAccessScope = (req) => ({
  companyId: req.user.companyId,
  $or: [
    { owner: req.user._id },
    { members: { $in: userWorkspaceTokens(req.user) } },
  ],
});

const normalizeMembersForCompany = async (members, companyId) => {
  if (!Array.isArray(members) || !companyId) return [];

  const cleaned = [...new Set(members.map((member) => String(member || "").trim()).filter(Boolean))];
  if (!cleaned.length) return [];

  const objectIds = cleaned.filter((member) => mongoose.Types.ObjectId.isValid(member));
  const emails = cleaned
    .filter((member) => !mongoose.Types.ObjectId.isValid(member) && member.includes("@"))
    .map((member) => member.toLowerCase());
  const names = cleaned.filter(
    (member) => !mongoose.Types.ObjectId.isValid(member) && !member.includes("@")
  );

  const orConditions = [];
  if (objectIds.length) orConditions.push({ _id: { $in: objectIds } });
  if (emails.length) orConditions.push({ email: { $in: emails } });
  if (names.length) orConditions.push({ name: { $in: names } });
  if (!orConditions.length) return [];

  const users = await User.find({
    companyId,
    $or: orConditions,
  })
    .select("_id")
    .lean();

  return [...new Set(users.map((user) => String(user._id)).filter(Boolean))];
};

const notifyWorkspaceMembers = async ({
  memberIds = [],
  companyId,
  workspaceName,
  actorId,
}) => {
  if (!companyId || !memberIds.length) return;
  const recipients = memberIds
    .map((id) => String(id))
    .filter((id) => id && id !== String(actorId || ""));
  if (!recipients.length) return;

  await Notification.insertMany(
    recipients.map((userId) => ({
      userId,
      companyId,
      text: `You were added to workspace: ${workspaceName}`,
      type: "info",
      isRead: false,
    }))
  );
};

const canManageWorkspace = (req, workspace) =>
  String(workspace.owner) === String(req.user?._id) ||
  (canManageWorkspaceMembers(req.user?.role) &&
    (workspace.members || []).some((member) =>
      userWorkspaceTokens(req.user).includes(String(member))
    ));

const userCanAccessBoard = (board, user) => {
  if (!board || !user) return false;
  if (board.privacy !== "private") return true;
  const userId = String(user._id || "");
  if (!userId) return false;
  const members = (board.members || []).map((member) => String(member));
  return members.includes(userId) || String(board.createdBy || "") === userId;
};

const filterBoardsForUser = (workspace, user) => {
  if (!workspace) return workspace;
  const plain = workspace?.toObject ? workspace.toObject() : workspace;
  return {
    ...plain,
    boards: (plain.boards || []).filter((board) => userCanAccessBoard(board, user)),
  };
};

const attachMemberUsers = async (workspaceOrWorkspaces, companyId) => {
  const workspaces = Array.isArray(workspaceOrWorkspaces)
    ? workspaceOrWorkspaces
    : [workspaceOrWorkspaces];

  const memberTokens = [
    ...new Set(
      workspaces.flatMap((workspace) =>
        (workspace?.members || []).map((member) => String(member || "").trim()).filter(Boolean)
      )
    ),
  ];

  if (!memberTokens.length) return workspaceOrWorkspaces;

  const objectIds = memberTokens.filter((member) => mongoose.Types.ObjectId.isValid(member));
  const emails = memberTokens
    .filter((member) => !mongoose.Types.ObjectId.isValid(member) && member.includes("@"))
    .map((member) => member.toLowerCase());
  const names = memberTokens.filter(
    (member) => !mongoose.Types.ObjectId.isValid(member) && !member.includes("@")
  );

  const orConditions = [];
  if (objectIds.length) orConditions.push({ _id: { $in: objectIds } });
  if (emails.length) orConditions.push({ email: { $in: emails } });
  if (names.length) orConditions.push({ name: { $in: names } });
  if (!orConditions.length) return workspaceOrWorkspaces;

  const users = await User.find({ companyId, $or: orConditions })
    .select("_id name email role")
    .lean();
  const usersByToken = new Map();

  users.forEach((user) => {
    usersByToken.set(String(user._id), user);
    if (user.email) usersByToken.set(String(user.email).toLowerCase(), user);
    if (user.name) usersByToken.set(String(user.name), user);
  });

  const addMembers = (workspace) => {
    const plain = workspace?.toObject ? workspace.toObject() : workspace;
    return {
      ...plain,
      memberUsers: (plain.members || [])
        .map((member) => usersByToken.get(String(member).trim()))
        .filter(Boolean),
    };
  };

  return Array.isArray(workspaceOrWorkspaces)
    ? workspaces.map(addMembers)
    : addMembers(workspaceOrWorkspaces);
};

/* ================= GET ALL WORKSPACES ================= */
router.get("/", async (req, res) => {
  try {
    const minimalView = String(req.query?.view || "").toLowerCase() === "minimal";
    const workspaces = await Workspace.find(workspaceAccessScope(req))
      .select("name description color owner members boards isActive companyId createdAt updatedAt")
      .populate({
        path: "boards",
        match: { companyId: req.user.companyId },
        select:
          minimalView
            ? "_id name privacy members createdBy updatedAt createdAt"
            : "_id name description privacy category members createdBy itemColumnVisible itemColumnName itemColumnPosition updatedAt createdAt workspace",
      })
      .populate({ path: "owner", select: "name email role" })
      .sort({ createdAt: -1 })
      .lean();

    const scoped = await attachMemberUsers(workspaces, req.user.companyId);
    const filtered = Array.isArray(scoped)
      ? scoped.map((workspace) => filterBoardsForUser(workspace, req.user))
      : filterBoardsForUser(scoped, req.user);
    res.json(filtered);
  } catch (error) {
    console.error("GET workspaces error:", error);
    res.status(500).json({ message: "Failed to fetch workspaces" });
  }
});

/* ================= GET SINGLE WORKSPACE ================= */
router.get("/:id", async (req, res) => {
  try {
    const minimalView = String(req.query?.view || "").toLowerCase() === "minimal";
    const workspace = await Workspace.findOne({
      _id: req.params.id,
      ...workspaceAccessScope(req),
    })
      .select("name description color owner members boards isActive companyId createdAt updatedAt")
      .populate({
        path: "boards",
        match: { companyId: req.user.companyId },
        select:
          minimalView
            ? "_id name privacy members createdBy updatedAt createdAt"
            : "_id name description privacy category members createdBy itemColumnVisible itemColumnName itemColumnPosition updatedAt createdAt workspace",
      })
      .populate({ path: "owner", select: "name email role" })
      .lean();

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const scoped = await attachMemberUsers(workspace, req.user.companyId);
    res.json(filterBoardsForUser(scoped, req.user));
  } catch (error) {
    console.error("GET workspace error:", error);
    res.status(500).json({ message: "Failed to fetch workspace" });
  }
});

/* ================= CREATE WORKSPACE ================= */
router.post("/", requirePermission("workspace:create"), async (req, res) => {
  try {
    const { name, description, color, members, isActive } = req.body;
    const normalizedMembers = await normalizeMembersForCompany(
      members,
      req.user.companyId
    );

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Workspace name is required" });
    }

    if (isActive) {
      await Workspace.updateMany(workspaceScope(req), { isActive: false });
    }

    const workspace = new Workspace({
      name: name.trim(),
      description: description?.trim() || "",
      color: color || "#7c3aed",
      owner: req.user?._id,
      companyId: req.user.companyId,
      companyName: req.user.companyName || "",
      members: normalizedMembers,
      boards: [],
      isActive: !!isActive,
    });

    await workspace.save();

    const populatedWorkspace = await Workspace.findOne({
      _id: workspace._id,
      ...workspaceScope(req),
    })
      .populate({ path: "boards", match: { companyId: req.user.companyId } })
      .populate({ path: "owner", select: "name email role" });

    const scoped = await attachMemberUsers(populatedWorkspace, req.user.companyId);
    res.status(201).json(filterBoardsForUser(scoped, req.user));
  } catch (error) {
    console.error("POST workspace error:", error);
    res.status(500).json({
      message: "Failed to create workspace",
      error: error.message,
    });
  }
});

/* ================= UPDATE WORKSPACE ================= */
router.put("/:id", requirePermission("workspace:update"), async (req, res) => {
  try {
    const { name, description, color, members, isActive } = req.body;

    const workspace = await Workspace.findOne({
      _id: req.params.id,
      ...workspaceAccessScope(req),
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (!canManageWorkspace(req, workspace)) {
      return res.status(403).json({ message: "Only the workspace owner or company admin can manage this workspace" });
    }

    if (isActive) {
      await Workspace.updateMany(
        { companyId: req.user.companyId, _id: { $ne: req.params.id } },
        { isActive: false }
      );
    }

    workspace.name = typeof name === "string" ? name : workspace.name;
    workspace.description =
      typeof description === "string" ? description : workspace.description;
    workspace.color = typeof color === "string" ? color : workspace.color;
    let previousMembers = [];
    if (Array.isArray(members)) {
      previousMembers = await normalizeMembersForCompany(
        workspace.members,
        req.user.companyId
      );
      workspace.members = await normalizeMembersForCompany(
        members,
        req.user.companyId
      );
    }
    workspace.isActive = typeof isActive === "boolean" ? isActive : workspace.isActive;

    await workspace.save();

    if (Array.isArray(members)) {
      const nextMembers = await normalizeMembersForCompany(
        workspace.members,
        req.user.companyId
      );
      const previousSet = new Set(previousMembers.map((id) => String(id)));
      const newlyAdded = nextMembers.filter((id) => !previousSet.has(String(id)));
      if (newlyAdded.length) {
        await notifyWorkspaceMembers({
          memberIds: newlyAdded,
          companyId: req.user.companyId,
          workspaceName: workspace.name,
          actorId: req.user?._id,
        });
      }
    }

    const updatedWorkspace = await Workspace.findOne({
      _id: workspace._id,
      ...workspaceScope(req),
    })
      .populate({ path: "boards", match: { companyId: req.user.companyId } })
      .populate({ path: "owner", select: "name email role" });

    if (!updatedWorkspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const scoped = await attachMemberUsers(updatedWorkspace, req.user.companyId);
    res.json(filterBoardsForUser(scoped, req.user));
  } catch (error) {
    console.error("PUT workspace error:", error);
    res.status(500).json({
      message: "Failed to update workspace",
      error: error.message,
    });
  }
});

/* ================= SET ACTIVE WORKSPACE ================= */
router.patch("/:id/activate", requirePermission("workspace:activate"), async (req, res) => {
  try {
    await Workspace.updateMany(workspaceScope(req), { isActive: false });

    const workspace = await Workspace.findOneAndUpdate(
      {
        _id: req.params.id,
        ...workspaceAccessScope(req),
      },
      { isActive: true },
      { returnDocument: 'after' }
    ).populate({ path: "boards", match: { companyId: req.user.companyId } });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    res.json(workspace);
  } catch (error) {
    console.error("ACTIVATE workspace error:", error);
    res.status(500).json({ message: "Failed to activate workspace" });
  }
});

/* ================= DELETE WORKSPACE ================= */
router.delete("/:id", requirePermission("workspace:delete"), async (req, res) => {
  try {
    const deletedWorkspace = await Workspace.findOneAndDelete({
      _id: req.params.id,
      companyId: req.user.companyId,
      owner: req.user?._id,
    });

    if (!deletedWorkspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    await Board.deleteMany({
      workspace: deletedWorkspace._id,
      companyId: req.user.companyId,
    });

    let nextActiveWorkspace = null;

    if (deletedWorkspace.isActive) {
      nextActiveWorkspace = await Workspace.findOneAndUpdate(
        {
          owner: req.user?._id,
          companyId: req.user.companyId,
        },
        { isActive: true },
        {
          sort: { updatedAt: -1 },
          returnDocument: 'after',
        }
      ).populate({ path: "boards", match: { companyId: req.user.companyId } });
    }

    res.json({
      message: "Workspace deleted successfully",
      deletedWorkspaceId: String(deletedWorkspace._id),
      currentWorkspace: nextActiveWorkspace,
    });
  } catch (error) {
    console.error("DELETE workspace error:", error);
    res.status(500).json({ message: "Failed to delete workspace" });
  }
});

module.exports = router;
