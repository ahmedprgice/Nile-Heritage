import api from "@/lib/http";

const toDateInput = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const normalizeAction = (action) => ({
  id: action?._id || action?.id || "",
  _id: action?._id || action?.id || undefined,
  text: action?.text || "",
  done: Boolean(action?.done),
});

const normalizeNote = (note) => ({
  ...note,
  id: note?._id || note?.id,
  title: note?.title || "Untitled note",
  summary: note?.summary || "",
  body: note?.body || "",
  type: note?.type || "meeting",
  status: note?.status || "draft",
  priority: note?.priority || "medium",
  owner: note?.owner || "Team",
  dueDate: toDateInput(note?.dueDate),
  tags: Array.isArray(note?.tags) ? note.tags : [],
  actions: Array.isArray(note?.actions) ? note.actions.map(normalizeAction) : [],
  visibility: note?.visibility || "public",
  allowedUsers: Array.isArray(note?.allowedUsers)
    ? note.allowedUsers.map((user) => user?._id || user?.id || user).filter(Boolean)
    : [],
  createdAt: note?.createdAt || new Date().toISOString(),
  updatedAt: note?.updatedAt || note?.createdAt || new Date().toISOString(),
});

const toPayload = (note) => {
  const payload = {};
  for (const key of [
    "title",
    "summary",
    "body",
    "type",
    "status",
    "priority",
    "owner",
    "visibility",
  ]) {
    if (note[key] !== undefined) payload[key] = note[key];
  }
  if (note.dueDate !== undefined) payload.dueDate = note.dueDate || null;
  if (note.tags !== undefined) payload.tags = note.tags || [];
  if (note.actions !== undefined) {
    payload.actions = (note.actions || []).map((action) => ({
      _id: action._id || action.id,
      text: action.text,
      done: Boolean(action.done),
    }));
  }
  if (note.allowedUsers !== undefined) payload.allowedUsers = note.allowedUsers || [];
  return payload;
};

const list = async (params = {}) => {
  const res = await api.get("/api/notes", { params });
  return Array.isArray(res.data) ? res.data.map(normalizeNote) : [];
};

const create = async (note) => {
  const { workspaceId, ...rest } = note || {};
  const res = await api.post("/api/notes", toPayload(rest), {
    params: workspaceId ? { workspaceId } : undefined,
  });
  return normalizeNote(res.data);
};

const update = async (id, patch) => {
  const res = await api.put(`/api/notes/${id}`, toPayload(patch));
  return normalizeNote(res.data);
};

const remove = async (id) => {
  await api.delete(`/api/notes/${id}`);
};

export const notesApi = {
  list,
  create,
  update,
  remove,
  normalizeNote,
};
