export const getEntityId = (item) =>
  item?._id || item?.id || item?.channelId || item?.conversationId || "";

export const getConversationKey = (type, id) => {
  if (!type || !id) return "";
  return `${type}-${id}`;
};

export const toConversationRef = (type, raw) => {
  if (!raw) return null;
  const id = type === "channel" ? getEntityId(raw) : raw?.conversationId || getEntityId(raw);
  if (!id) return null;
  return {
    type,
    id,
    key: getConversationKey(type, id),
    name: raw?.name || (type === "channel" ? "channel" : "Direct message"),
    raw,
  };
};

export const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const normalizeMessage = (msg = {}) => {
  const channelId = msg?.channelId?._id || msg?.channelId || null;
  const conversationId = msg?.conversationId?._id || msg?.conversationId || null;
  const conversationType = msg?.conversationType || (channelId ? "channel" : "direct");
  const conversationRefId = conversationType === "channel" ? channelId : conversationId;

  return {
    id: msg?._id || msg?.id || `${Date.now()}-${Math.random()}`,
    clientMessageId: msg?.clientMessageId || null,
    senderId: msg?.senderId?._id || msg?.senderId || msg?.sender?.id || null,
    senderName:
      msg?.senderId?.name ||
      msg?.sender?.name ||
      msg?.user?.name ||
      msg?.author ||
      "User",
    contentHtml:
      msg?.contentHtml ||
      msg?.content ||
      (msg?.contentText ? `<p>${msg.contentText}</p>` : "<p></p>"),
    contentText: msg?.contentText || "",
    createdAt: msg?.createdAt || msg?.timestamp || msg?.time || new Date().toISOString(),
    timeLabel: formatTime(msg?.createdAt || msg?.timestamp || msg?.time),
    messageType: msg?.messageType || msg?.type || "message",
    conversationType,
    channelId,
    conversationId,
    conversationKey: getConversationKey(conversationType, conversationRefId),
    pending: Boolean(msg?.pending),
    failed: Boolean(msg?.failed),
  };
};

export const appendUniqueByMessageId = (items, incoming) => {
  if (!incoming?.id) return [...items, incoming];
  if (items.some((item) => item.id === incoming.id)) return items;
  return [...items, incoming];
};

export const upsertByClientMessageId = (items, incoming) => {
  if (!incoming?.clientMessageId) return appendUniqueByMessageId(items, incoming);
  const idx = items.findIndex((item) => item.clientMessageId === incoming.clientMessageId);
  if (idx === -1) return appendUniqueByMessageId(items, incoming);
  const next = [...items];
  next[idx] = { ...incoming, pending: false, failed: false };
  return next;
};
