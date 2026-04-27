import api from "@/lib/http";
import { getEntityId } from "@/lib/chat/chatUtils";

const pickArray = (data, keys) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};

const pickValue = (data, keys, fallback = null) => {
  for (const key of keys) {
    if (data?.[key] !== undefined && data?.[key] !== null) return data[key];
  }
  return fallback;
};

const getCurrentUser = async () => {
  const res = await api.get("/api/auth/me");
  const user = pickValue(res.data, ["user"], {});
  return {
    id: user?.id || user?._id || null,
    name: user?.name || user?.email?.split("@")[0] || "User",
    email: user?.email || "",
    role: user?.role || "",
  };
};

const listChannels = async () => {
  const res = await api.get("/api/chat/channels");
  return pickArray(res.data, ["items", "channels"]);
};

const createChannel = async (payload) => {
  const body =
    typeof payload === "string" ? { name: payload } : { ...(payload || {}) };
  const res = await api.post("/api/chat/channels", body);
  return pickValue(res.data, ["channel"], res.data);
};

const addChannelMembers = async (channelId, payload = {}) => {
  const res = await api.post(`/api/chat/channels/${channelId}/members`, payload);
  return pickValue(res.data, ["channel"], res.data);
};

const deleteChannel = async (channelId) => {
  const res = await api.delete(`/api/chat/channels/${channelId}`);
  return pickValue(res.data, ["channel"], res.data);
};

const listDirectConversations = async () => {
  const res = await api.get("/api/chat/conversations/direct");
  return pickArray(res.data, ["items", "conversations"]);
};

const listUsers = async () => {
  try {
    const res = await api.get("/api/chat/users");
    return pickArray(res.data, ["items", "users", "members"]);
  } catch {
    const res = await api.get("/api/auth/company-members");
    return pickArray(res.data, ["items", "users", "members"]);
  }
};

const startDirectById = async (targetUserId) => {
  const res = await api.post("/api/chat/direct/start", { targetUserId });
  return pickValue(res.data, ["conversation"], res.data);
};

const startDirectByEmail = async (email) => {
  const res = await api.post("/api/chat/direct/invite-email", { email });
  return pickValue(res.data, ["conversation"], res.data);
};

const listMessages = async ({ conversationType, channelId, conversationId, limit = 30, cursor }) => {
  const params = { conversationType, limit };
  if (cursor) params.cursor = cursor;
  if (conversationType === "channel") params.channelId = channelId;
  if (conversationType === "direct") params.conversationId = conversationId;

  const res = await api.get("/api/chat/messages", { params });
  const items = pickArray(res.data, ["items", "messages"]);
  return {
    items,
    nextCursor: pickValue(res.data, ["nextCursor", "cursor", "next"], null),
    hasMore: Boolean(pickValue(res.data, ["hasMore"], Boolean(items.length >= limit))),
  };
};

const sendMessage = async (payload = {}) => {
  const res = await api.post("/api/chat/messages", payload);
  return pickValue(res.data, ["message"], res.data);
};

const toDirectDisplay = (conversation, currentUserId) => {
  const members = conversation?.members || [];
  const other =
    conversation?.otherMember ||
    members.find((m) => String(getEntityId(m)) !== String(currentUserId)) ||
    members[0] ||
    {};
  const conversationId = conversation?._id || conversation?.id;
  const lastMessage = conversation?.lastMessage || conversation?.latestMessage || null;
  return {
    ...conversation,
    id: conversationId,
    conversationId,
    name: other?.name || other?.email || "Direct message",
    email: other?.email || "",
    avatarUrl: other?.avatarUrl || "",
    unreadCount: conversation?.unreadCount || 0,
    lastPreview:
      lastMessage?.contentText ||
      lastMessage?.text ||
      (lastMessage?.contentHtml ? "Sent a message" : ""),
    lastMessage,
    lastActivityAt: conversation?.lastActivityAt || lastMessage?.createdAt || conversation?.updatedAt || conversation?.createdAt || null,
  };
};

const getUnreadCounts = async () => {
  const res = await api.get("/api/chat/unread-counts");
  return {
    channels: res.data?.channels || {},
    directs: res.data?.directs || {},
  };
};

export const chatApi = {
  getCurrentUser,
  listChannels,
  createChannel,
  addChannelMembers,
  deleteChannel,
  listDirectConversations,
  listUsers,
  startDirectById,
  startDirectByEmail,
  listMessages,
  sendMessage,
  getUnreadCounts,
  toDirectDisplay,
};
