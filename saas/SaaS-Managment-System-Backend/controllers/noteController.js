const mongoose = require("mongoose");
const Note = require("../models/Note");
const Workspace = require("../models/Workspace");

const NOTE_TYPES = ["other", "meeting", "decision", "process", "risk", "idea"];
const NOTE_STATUSES = ["draft", "review", "published", "action"];
const NOTE_PRIORITIES = ["low", "medium", "high"];
const NOTE_VISIBILITY = ["public", "private"];

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

const resolveWorkspaceAccess = async (workspaceId, user) => {
  if (!workspaceId || !mongoose.Types.ObjectId.isValid(String(workspaceId))) {
    return null;
  }
  return Workspace.findOne({
    _id: workspaceId,
    ...workspaceAccessScope(user),
  })
    .select("_id")
    .lean();
};

const resolveDefaultWorkspaceAccess = async (user) => {
  const workspace = await Workspace.findOne(workspaceAccessScope(user))
    .sort({ isActive: -1, updatedAt: -1 })
    .select("_id")
    .lean();
  return workspace || null;
};

const normalizeTags = (value) => {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => String(item || "").trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 20)
    ),
  ];
};

const normalizeActions = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      _id: mongoose.Types.ObjectId.isValid(String(item?._id || item?.id || ""))
        ? item._id || item.id
        : undefined,
      text: String(item?.text || "").trim(),
      done: Boolean(item?.done),
    }))
    .filter((item) => item.text)
    .slice(0, 50);
};

const normalizeAllowedUsers = (value) => {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => {
          const raw = item?._id || item?.id || item;
          if (!raw) return "";
          return mongoose.Types.ObjectId.isValid(String(raw)) ? String(raw) : "";
        })
        .filter(Boolean)
    ),
  ];
};

const parseDate = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "INVALID_DATE";
  return parsed;
};

const buildNotePayload = (body, { isCreate = false } = {}) => {
  const payload = {};

  if (isCreate || body.title !== undefined) payload.title = String(body.title || "").trim();
  if (body.summary !== undefined) payload.summary = String(body.summary || "").trim();
  if (body.body !== undefined) payload.body = String(body.body || "");
  if (body.owner !== undefined) payload.owner = String(body.owner || "Team").trim() || "Team";

  if (body.type !== undefined) payload.type = body.type;
  if (body.status !== undefined) payload.status = body.status;
  if (body.priority !== undefined) payload.priority = body.priority;
  if (body.tags !== undefined) payload.tags = normalizeTags(body.tags);
  if (body.actions !== undefined) payload.actions = normalizeActions(body.actions);
  if (body.dueDate !== undefined) payload.dueDate = parseDate(body.dueDate);
  if (body.visibility !== undefined) payload.visibility = body.visibility;
  if (body.allowedUsers !== undefined) payload.allowedUsers = normalizeAllowedUsers(body.allowedUsers);

  return payload;
};

const validatePayload = (payload, { isCreate = false } = {}) => {
  if ((isCreate || payload.title !== undefined) && !payload.title) return "Title is required";
  if (payload.type !== undefined && !NOTE_TYPES.includes(payload.type)) return "Invalid note type";
  if (payload.status !== undefined && !NOTE_STATUSES.includes(payload.status)) return "Invalid note status";
  if (payload.priority !== undefined && !NOTE_PRIORITIES.includes(payload.priority)) return "Invalid note priority";
  if (payload.visibility !== undefined && !NOTE_VISIBILITY.includes(payload.visibility)) return "Invalid note visibility";
  if (payload.dueDate === "INVALID_DATE") return "Invalid due date";
  return null;
};

const hasNoteAccess = async (note, user) => {
  if (!note) return false;
  if (note.workspaceId) {
    const workspace = await resolveWorkspaceAccess(note.workspaceId, user);
    if (!workspace) return false;
  } else if (String(note.createdBy) !== String(user._id)) {
    return false;
  }

  if (note.visibility === "private") {
    if (String(note.createdBy) === String(user._id)) return true;
    return (note.allowedUsers || []).some(
      (id) => String(id) === String(user._id),
    );
  }

  return true;
};

const listNotes = async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId;
    const filter = { companyId: req.user.companyId };

    if (workspaceId) {
      const workspace = await resolveWorkspaceAccess(workspaceId, req.user);
      if (!workspace) {
        return res.status(403).json({ message: "You do not have access to this workspace" });
      }
      filter.workspaceId = workspace._id;
      filter.$or = [
        { visibility: "public" },
        { createdBy: req.user._id },
        { allowedUsers: req.user._id },
      ];
    } else {
      const accessibleWorkspaces = await Workspace.find(
        workspaceAccessScope(req.user)
      )
        .select("_id")
        .lean();
      const workspaceIds = accessibleWorkspaces.map((item) => item._id);

      filter.$or = [
        { workspaceId: { $in: workspaceIds }, visibility: "public" },
        { workspaceId: { $in: workspaceIds }, createdBy: req.user._id },
        { workspaceId: { $in: workspaceIds }, allowedUsers: req.user._id },
        { workspaceId: null, createdBy: req.user._id },
        { workspaceId: { $exists: false }, createdBy: req.user._id },
      ];
    }
    if (NOTE_TYPES.includes(req.query.type)) filter.type = req.query.type;
    if (NOTE_STATUSES.includes(req.query.status)) filter.status = req.query.status;

    const notes = await Note.find(filter).sort({ updatedAt: -1 }).lean();
    return res.json(notes);
  } catch (error) {
    console.error("GET notes error:", error);
    return res.status(500).json({ message: "Failed to fetch notes" });
  }
};

const createNote = async (req, res) => {
  try {
    const requestedWorkspaceId = req.body.workspaceId || req.query.workspaceId;
    const workspace = requestedWorkspaceId
      ? await resolveWorkspaceAccess(requestedWorkspaceId, req.user)
      : await resolveDefaultWorkspaceAccess(req.user);
    if (!workspace) {
      return res.status(400).json({ message: "Workspace is required for notes" });
    }

    const payload = buildNotePayload(req.body, { isCreate: true });
    const validationError = validatePayload(payload, { isCreate: true });
    if (validationError) return res.status(400).json({ message: validationError });

    const visibility = payload.visibility || "public";
    const allowedUsers = normalizeAllowedUsers(payload.allowedUsers || []);
    if (visibility === "private" && !allowedUsers.includes(String(req.user._id))) {
      allowedUsers.push(String(req.user._id));
    }

    const note = await Note.create({
      ...payload,
      companyId: req.user.companyId,
      companyName: req.user.companyName || "",
      workspaceId: workspace._id,
      createdBy: req.user._id,
      visibility,
      allowedUsers,
    });

    return res.status(201).json(note);
  } catch (error) {
    console.error("POST note error:", error);
    return res.status(500).json({ message: "Failed to create note", error: error.message });
  }
};

const updateNote = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const payload = buildNotePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ message: validationError });

    const existing = await Note.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!existing) return res.status(404).json({ message: "Note not found" });

    if (!(await hasNoteAccess(existing, req.user))) {
      return res.status(403).json({ message: "You do not have access to this note" });
    }

    if (payload.visibility === "private") {
      const nextAllowed =
        payload.allowedUsers?.length ? payload.allowedUsers : existing.allowedUsers || [];
      const normalizedAllowed = normalizeAllowedUsers(nextAllowed);
      if (!normalizedAllowed.includes(String(req.user._id))) {
        normalizedAllowed.push(String(req.user._id));
      }
      payload.allowedUsers = normalizedAllowed;
    } else if (payload.visibility === "public") {
      payload.allowedUsers = [];
    }

    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      payload,
      { returnDocument: 'after', runValidators: true }
    );

    if (!note) return res.status(404).json({ message: "Note not found" });
    return res.json(note);
  } catch (error) {
    console.error("PUT note error:", error);
    return res.status(500).json({ message: "Failed to update note", error: error.message });
  }
};

const deleteNote = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const existing = await Note.findOne({
      _id: req.params.id,
      companyId: req.user.companyId,
    });

    if (!existing) return res.status(404).json({ message: "Note not found" });

    if (!(await hasNoteAccess(existing, req.user))) {
      return res.status(403).json({ message: "You do not have access to this note" });
    }

    const note = await Note.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    if (!note) return res.status(404).json({ message: "Note not found" });

    return res.json({ message: "Note deleted successfully" });
  } catch (error) {
    console.error("DELETE note error:", error);
    return res.status(500).json({ message: "Failed to delete note" });
  }
};

module.exports = {
  listNotes,
  createNote,
  updateNote,
  deleteNote,
};
