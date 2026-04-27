"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PlusCircle,
  UserPlus,
  X,
  Menu,
  MoreVertical,
  Trash2,
  SendHorizontal,
  Hash,
  MessageCircle,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { useQuill } from "react-quilljs";
import { chatApi } from "@/lib/chat/chatApi";
import {
  appendUniqueByMessageId,
  getConversationKey,
  getEntityId,
  normalizeMessage,
  toConversationRef,
  upsertByClientMessageId,
} from "@/lib/chat/chatUtils";
import { useChatSocket } from "@/hooks/useChatSocket";
import "quill/dist/quill.snow.css";

const messageTypeStyle = {
  update: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  question: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  announcement: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  action: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  message: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

const messageTypeLabel = {
  update: "Update",
  question: "Question",
  announcement: "Announcement",
  action: "Action",
  message: "Message",
};

const writingTemplates = [
  {
    id: "daily-update",
    label: "Daily Update",
    type: "update",
    content:
      "<p><strong>Today</strong></p><ul><li>Completed:</li><li>In progress:</li><li>Next:</li></ul>",
  },
  {
    id: "question",
    label: "Ask Question",
    type: "question",
    content:
      "<p><strong>Question</strong></p><p>Could someone clarify:</p><ul><li>Context:</li><li>What I already tried:</li><li>Needed by:</li></ul>",
  },
  {
    id: "announcement",
    label: "Announcement",
    type: "announcement",
    content:
      "<p><strong>Announcement</strong></p><p>Team, please note:</p><ul><li>What changed:</li><li>Impact:</li><li>Action required:</li></ul>",
  },
  {
    id: "action-items",
    label: "Action Items",
    type: "action",
    content:
      "<p><strong>Action Items</strong></p><ol><li>Owner - Task - Due date</li><li>Owner - Task - Due date</li></ol>",
  },
];

const createClientMessageId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

const sortMessagesByDate = (items) =>
  [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const getDraftKey = (userId, conversationKey) =>
  `nexora_chat_draft_${userId || "anon"}_${conversationKey || "none"}`;

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelVisibility, setChannelVisibility] = useState("public");
  const [channelAllowedSenders, setChannelAllowedSenders] = useState([]);
  const [senderDropdownOpen, setSenderDropdownOpen] = useState(false);
  const [senderSearch, setSenderSearch] = useState("");
  const [showPrivateMemberModal, setShowPrivateMemberModal] = useState(false);
  const [privateMemberSelection, setPrivateMemberSelection] = useState([]);
  const [privateMemberSearch, setPrivateMemberSearch] = useState("");
  const [privateMemberDropdownOpen, setPrivateMemberDropdownOpen] = useState(false);
  const [privateMemberAllowSend, setPrivateMemberAllowSend] = useState(true);
  const [privateMemberSaving, setPrivateMemberSaving] = useState(false);
  const [privateMemberError, setPrivateMemberError] = useState("");
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [showDeleteChannelModal, setShowDeleteChannelModal] = useState(false);
  const [deletingChannel, setDeletingChannel] = useState(false);
  const [inviteUserId, setInviteUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationFilter, setConversationFilter] = useState("all");
  const [composerType, setComposerType] = useState("update");
  const [composerChars, setComposerChars] = useState(0);
  const [sending, setSending] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);

  const [chatState, setChatState] = useState({
    currentUser: { id: null, name: "User", email: "", role: "" },
    channels: [],
    directs: [],
    users: [],
    activeConversation: null,
    messagesByConversation: {},
    messageCursors: {},
    typingByConversation: {},
    unreadCounts: {},
    presenceMap: {},
    pendingByClientId: {},
    loadingList: true,
    loadingMessages: false,
    error: "",
  });

  const typingTimerRef = useRef(null);
  const chatEndRef = useRef(null);
  const sendMessageRef = useRef(() => {});
  const listRequestInFlightRef = useRef(false);
  const messageRequestInFlightRef = useRef(new Set());
  const initialConversationRefreshRef = useRef(new Set());
  const reconnectSyncAtRef = useRef(0);
  const currentUserFetchedAtRef = useRef(0);
  const usersFetchedAtRef = useRef(0);
  const currentUserIdRef = useRef("");
  const hasUsersRef = useRef(false);
  const pendingByClientIdRef = useRef({});

  const { quill, quillRef } = useQuill({
    theme: "snow",
    modules: {
      toolbar: [
        [{ header: [1, 2, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block", "link"],
        ["clean"],
      ],
    },
    placeholder: "Write clearly for your team...",
  });

  const setError = useCallback((message) => {
    setChatState((prev) => ({ ...prev, error: message }));
  }, []);

  const activeConversation = chatState.activeConversation;
  const activeKey = activeConversation?.key || "";
  const currentMessages = activeKey ? chatState.messagesByConversation[activeKey] || [] : [];
  const currentTyping = activeKey ? chatState.typingByConversation[activeKey] || [] : [];
  const normalizedRole = String(chatState.currentUser?.role || "").toLowerCase();
  const canCreateChannel = ["owner", "admin", "manager", "member"].includes(normalizedRole);
  const canManagePrivateChannel = ["owner", "admin"].includes(normalizedRole);
  const currentCursor = activeKey ? chatState.messageCursors[activeKey] || {} : {};

  useEffect(() => {
    pendingByClientIdRef.current = chatState.pendingByClientId || {};
  }, [chatState.pendingByClientId]);

  useEffect(() => {
    currentUserIdRef.current = String(chatState.currentUser?.id || "");
    hasUsersRef.current = Array.isArray(chatState.users) && chatState.users.length > 0;
  }, [chatState.currentUser?.id, chatState.users]);

  const activeChannelDetails = useMemo(() => {
    if (!activeConversation || activeConversation.type !== "channel") return null;
    return chatState.channels.find(
      (item) => String(item.id) === String(activeConversation.id)
    );
  }, [activeConversation, chatState.channels]);

  const canDeleteActiveChannel = useMemo(() => {
    if (!activeChannelDetails) return false;
    const creator = String(activeChannelDetails.createdBy || "");
    return canManagePrivateChannel || creator === String(chatState.currentUser?.id || "");
  }, [activeChannelDetails, canManagePrivateChannel, chatState.currentUser?.id]);

  const filteredPrivateCandidates = useMemo(() => {
    if (!activeChannelDetails) return [];
    const query = privateMemberSearch.trim().toLowerCase();
    const isPrivate = activeChannelDetails?.visibility === "private";
    const existing = new Set(
      (
        isPrivate
          ? activeChannelDetails.allowedSenders || []
          : activeChannelDetails.members || []
      ).map((id) => String(id))
    );
    const currentUserId = String(chatState.currentUser?.id || "");
    return (chatState.users || [])
      .filter((user) => {
        const id = String(user?.id || user?._id || "");
        if (!id || existing.has(id) || id === currentUserId) return false;
        if (!query) return true;
        return `${user?.name || ""} ${user?.email || ""} ${user?.role || ""}`
          .toLowerCase()
          .includes(query);
      });
  }, [activeChannelDetails, chatState.users, privateMemberSearch, chatState.currentUser?.id]);

  const markConversationRead = useCallback(
    (conversation, emitReadUpdate) => {
      if (!conversation) return;
      const payload =
        conversation.type === "channel"
          ? {
              conversationType: "channel",
              channelId: conversation.id,
              lastReadAt: new Date().toISOString(),
            }
          : {
              conversationType: "direct",
            conversationId: conversation.id,
            lastReadAt: new Date().toISOString(),
          };
      emitReadUpdate(payload);
    },
    [],
  );

  const loadChatLists = useCallback(
    async (
      preferredConversation = null,
      { silent = false, includeUsers = true, includeCurrentUser = true } = {},
    ) => {
      if (listRequestInFlightRef.current) return;
      listRequestInFlightRef.current = true;
      if (!silent) {
        setChatState((prev) => ({ ...prev, loadingList: true, error: "" }));
      }
      try {
        const now = Date.now();
        const shouldFetchCurrentUser =
          includeCurrentUser &&
          (!currentUserIdRef.current || now - currentUserFetchedAtRef.current > 5 * 60 * 1000);
        const shouldFetchUsers =
          includeUsers &&
          (!hasUsersRef.current || now - usersFetchedAtRef.current > 60 * 1000);

        const [currentUserRaw, directsRaw, usersRaw, unreadRaw, channelsRaw] = await Promise.all([
          shouldFetchCurrentUser ? chatApi.getCurrentUser() : null,
          chatApi.listDirectConversations().catch(() => []),
          shouldFetchUsers ? chatApi.listUsers().catch(() => []) : null,
          chatApi.getUnreadCounts().catch(() => ({ channels: {}, directs: {} })),
          chatApi.listChannels().catch(() => []),
        ]);

        if (shouldFetchCurrentUser && currentUserRaw?.id) {
          currentUserFetchedAtRef.current = now;
        }
        if (shouldFetchUsers && Array.isArray(usersRaw)) {
          usersFetchedAtRef.current = now;
        }

        const channels = channelsRaw.map((ch) => ({
          ...ch,
          id: getEntityId(ch),
          unreadCount: unreadRaw.channels?.[getEntityId(ch)] || ch?.unreadCount || 0,
          lastPreview:
            ch?.lastMessage?.contentText ||
            (ch?.lastMessage?.contentHtml ? "Sent an update" : "Workspace channel"),
          lastActivityAt: ch?.lastActivityAt || ch?.updatedAt || ch?.createdAt || null,
        }));
        const directs = directsRaw.map((conv) => {
          const currentUserId = currentUserRaw?.id || currentUserIdRef.current || null;
          const dm = chatApi.toDirectDisplay(conv, currentUserId);
          return {
            ...dm,
            unreadCount: unreadRaw.directs?.[dm.conversationId] || dm.unreadCount || 0,
          };
        });

        const unreadCounts = {};
        for (const channel of channels) {
          unreadCounts[getConversationKey("channel", channel.id)] = channel.unreadCount || 0;
        }
        for (const dm of directs) {
          unreadCounts[getConversationKey("direct", dm.conversationId)] = dm.unreadCount || 0;
        }

        const findConversationRef = (conversation) => {
          if (!conversation?.type || !conversation?.id) return null;
          if (conversation.type === "channel") {
            const matched = channels.find(
              (item) =>
                String(item.id) === String(conversation.id) ||
                String(getEntityId(item)) === String(conversation.id),
            );
            return matched ? toConversationRef("channel", matched) : null;
          }
          const matched = directs.find(
            (item) =>
              String(item.conversationId || item.id || getEntityId(item)) ===
              String(conversation.id),
          );
          return matched ? toConversationRef("direct", matched) : null;
        };

        setChatState((prev) => {
          const resolvedActive =
            findConversationRef(preferredConversation) ||
            findConversationRef(prev.activeConversation) ||
            null;
          const keepPreviousActive =
            prev.activeConversation &&
            resolvedActive &&
            prev.activeConversation.key === resolvedActive.key;

          return {
            ...prev,
            currentUser: currentUserRaw || prev.currentUser,
            channels,
            directs,
            users: Array.isArray(usersRaw) ? usersRaw : prev.users,
            activeConversation: keepPreviousActive ? prev.activeConversation : resolvedActive,
            unreadCounts: { ...prev.unreadCounts, ...unreadCounts },
            loadingList: false,
            error: silent ? prev.error : "",
          };
        });
      } catch (error) {
        setChatState((prev) => ({
          ...prev,
          loadingList: false,
          error: silent
            ? prev.error
            : error?.response?.data?.message ||
              error?.message ||
              "Failed to load chat conversations.",
        }));
      } finally {
        listRequestInFlightRef.current = false;
      }
    },
    [],
  );

  const loadMessages = useCallback(
    async ({ conversation, cursor = null, prepend = false, force = false }) => {
      if (!conversation?.id) return;
      const requestKey = `${conversation.key || `${conversation.type}-${conversation.id}`}:${
        cursor || "root"
      }:${prepend ? "prepend" : "replace"}`;
      if (messageRequestInFlightRef.current.has(requestKey)) return;
      messageRequestInFlightRef.current.add(requestKey);

      setChatState((prev) => ({ ...prev, loadingMessages: !prepend && !force }));

      try {
        const result = await chatApi.listMessages({
          conversationType: conversation.type,
          channelId: conversation.type === "channel" ? conversation.id : undefined,
          conversationId: conversation.type === "direct" ? conversation.id : undefined,
          limit: 30,
          cursor,
        });

        const normalized = sortMessagesByDate(result.items.map((msg) => normalizeMessage(msg)));

        setChatState((prev) => {
          const existing = prev.messagesByConversation[conversation.key] || [];
          const currentUserId = String(prev.currentUser?.id || "");
          const resolvedExisting = existing.map((item) => ({ ...item }));

          // Reconcile optimistic pending own-messages with confirmed messages from polling/fetch.
          normalized.forEach((incoming) => {
            if (
              !incoming?.pending &&
              String(incoming.senderId || "") === currentUserId &&
              String(incoming.contentText || "").trim()
            ) {
              const incomingText = String(incoming.contentText || "").trim().toLowerCase();
              const incomingTs = new Date(incoming.createdAt || 0).getTime();
              const pendingIdx = resolvedExisting.findIndex((candidate) => {
                if (!candidate?.pending) return false;
                if (String(candidate.senderId || "") !== currentUserId) return false;
                const candidateText = String(candidate.contentText || "").trim().toLowerCase();
                if (!candidateText || candidateText !== incomingText) return false;
                const candidateTs = new Date(candidate.createdAt || 0).getTime();
                if (!Number.isFinite(candidateTs) || !Number.isFinite(incomingTs)) return true;
                return Math.abs(candidateTs - incomingTs) <= 5 * 60 * 1000;
              });

              if (pendingIdx !== -1) {
                resolvedExisting[pendingIdx] = {
                  ...incoming,
                  pending: false,
                  failed: false,
                  clientMessageId:
                    resolvedExisting[pendingIdx]?.clientMessageId || incoming.clientMessageId || null,
                };
              }
            }
          });

          const merged =
            force && !prepend
              ? sortMessagesByDate(
                  [
                    ...[...resolvedExisting, ...normalized].reduce((acc, item) => {
                      acc.set(item.id, item);
                      return acc;
                    }, new Map()).values(),
                  ],
                )
              : null;
          const combined = prepend
            ? sortMessagesByDate([...normalized, ...existing])
            : force
              ? merged
              : sortMessagesByDate(normalized);

          return {
            ...prev,
            loadingMessages: false,
            messagesByConversation: {
              ...prev.messagesByConversation,
              [conversation.key]: combined,
            },
            messageCursors: {
              ...prev.messageCursors,
              [conversation.key]: {
                nextCursor: result.nextCursor,
                hasMore: result.hasMore,
              },
            },
          };
        });
      } catch {
        setChatState((prev) => ({
          ...prev,
          loadingMessages: false,
          error: "Failed to load messages.",
        }));
      } finally {
        messageRequestInFlightRef.current.delete(requestKey);
      }
    },
    [],
  );

  const handleMessageNew = useCallback((incoming) => {
    const msg = normalizeMessage(incoming);
    if (!msg.conversationKey) return;
    let shouldNotify = false;
    let toastPayload = null;
    let shouldClearSendingState = false;

    setChatState((prev) => {
      const existing = prev.messagesByConversation[msg.conversationKey] || [];
      const pending = msg.clientMessageId ? prev.pendingByClientId[msg.clientMessageId] : null;
      const isOwn = String(msg.senderId) === String(prev.currentUser?.id);

      let matchedPendingMessage = null;
      if (!pending && isOwn) {
        const normalizedIncomingText = String(msg.contentText || "").trim().toLowerCase();
        matchedPendingMessage =
          existing.find(
            (item) =>
              item?.pending &&
              String(item.senderId) === String(prev.currentUser?.id) &&
              String(item.contentText || "").trim().toLowerCase() === normalizedIncomingText,
          ) || null;
      }

      const nextMessages = pending
        ? upsertByClientMessageId(existing, msg)
        : matchedPendingMessage
          ? existing.map((item) =>
              item.id === matchedPendingMessage.id
                ? {
                    ...msg,
                    pending: false,
                    failed: false,
                    clientMessageId:
                      matchedPendingMessage.clientMessageId || msg.clientMessageId || null,
                  }
                : item,
            )
          : appendUniqueByMessageId(existing, msg);

      const nextPendingByClientId = { ...prev.pendingByClientId };
      if (msg.clientMessageId) delete nextPendingByClientId[msg.clientMessageId];
      if (matchedPendingMessage?.clientMessageId) {
        delete nextPendingByClientId[matchedPendingMessage.clientMessageId];
      }
      if (pending || matchedPendingMessage) {
        shouldClearSendingState = true;
      }

      const isActive = prev.activeConversation?.key === msg.conversationKey;
      if (!isOwn && !isActive) shouldNotify = true;

      let nextDirects = prev.directs;
      let nextChannels = prev.channels;
      const preview = msg.contentText || "Sent a message";
      if (msg.conversationType === "direct" && msg.conversationId) {
        const conversationId = String(msg.conversationId);
        const exists = prev.directs.some(
          (item) => String(item.conversationId || item.id) === conversationId,
        );
        const dmName = isOwn
          ? prev.directs.find((item) => String(item.conversationId || item.id) === conversationId)
              ?.name || "Direct message"
          : msg.senderName || "Direct message";
        const dmPreview = isOwn
          ? `You: ${preview}`
          : `${msg.senderName || "User"}: ${preview}`;

        if (!exists) {
          nextDirects = [
            {
              id: msg.conversationId,
              conversationId: msg.conversationId,
              name: dmName,
              unreadCount: isActive || isOwn ? 0 : 1,
              lastPreview: dmPreview,
            },
            ...prev.directs,
          ];
        } else {
          nextDirects = prev.directs.map((item) =>
            String(item.conversationId || item.id) === conversationId
              ? { ...item, lastPreview: dmPreview, lastActivityAt: msg.createdAt }
              : item,
          );
        }

        if (!isOwn && !isActive) {
          toastPayload = {
            id: msg.id || msg.clientMessageId || `${Date.now()}-${Math.random()}`,
            type: "direct",
            raw: {
              conversationId: msg.conversationId,
              name: dmName,
              lastPreview: dmPreview,
            },
            sender: msg.senderName || dmName,
            title: dmName,
            preview: preview,
          };
        }
      }

      if (msg.conversationType === "channel" && msg.channelId) {
        const channelName =
          prev.channels.find((item) => String(item.id) === String(msg.channelId))?.name || "channel";
        nextChannels = prev.channels.map((item) =>
          String(item.id) === String(msg.channelId)
            ? {
                ...item,
                lastPreview: `${isOwn ? "You" : msg.senderName || "User"}: ${preview}`,
                lastActivityAt: msg.createdAt,
              }
            : item,
        );

        if (!isOwn && !isActive) {
          toastPayload = {
            id: msg.id || msg.clientMessageId || `${Date.now()}-${Math.random()}`,
            type: "channel",
            raw: { id: msg.channelId, name: channelName },
            sender: msg.senderName || "User",
            title: `# ${channelName}`,
            preview,
          };
        }
      }

      return {
        ...prev,
        channels: nextChannels,
        directs: nextDirects,
        messagesByConversation: {
          ...prev.messagesByConversation,
          [msg.conversationKey]: sortMessagesByDate(nextMessages),
        },
        pendingByClientId: nextPendingByClientId,
        unreadCounts: {
          ...prev.unreadCounts,
          [msg.conversationKey]:
            isActive || isOwn ? 0 : (prev.unreadCounts[msg.conversationKey] || 0) + 1,
        },
      };
    });

    if (shouldClearSendingState) {
      setSending(false);
    }

    if (shouldNotify && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nexora:message-received", {
          detail: toastPayload ? { toast: toastPayload } : undefined,
        }),
      );
    }
  }, []);

  const handleAddPrivateMembers = async () => {
    if (!activeChannelDetails?.id || privateMemberSelection.length === 0) return;
    try {
      setPrivateMemberSaving(true);
      setPrivateMemberError("");
      const memberIds = privateMemberSelection.map(
        (member) => member.id || member._id || member.email
      );
      const updated = await chatApi.addChannelMembers(activeChannelDetails.id, {
        members: memberIds,
        allowSend: privateMemberAllowSend,
      });
      setChatState((prev) => ({
        ...prev,
        channels: prev.channels.map((channel) =>
          String(channel.id) === String(updated.id) ? { ...channel, ...updated } : channel
        ),
      }));
      setPrivateMemberSelection([]);
      setPrivateMemberSearch("");
      setPrivateMemberDropdownOpen(false);
      setShowPrivateMemberModal(false);
    } catch (error) {
      setPrivateMemberError(
        error?.response?.data?.message || "Failed to add members."
      );
    } finally {
      setPrivateMemberSaving(false);
    }
  };

  const handleDeleteActiveChannel = async () => {
    if (!activeChannelDetails?.id) return;
    try {
      setDeletingChannel(true);
      await chatApi.deleteChannel(activeChannelDetails.id);
      setChatState((prev) => ({
        ...prev,
        channels: prev.channels.filter(
          (channel) => String(channel.id) !== String(activeChannelDetails.id)
        ),
        activeConversation: null,
      }));
      setShowDeleteChannelModal(false);
      setChannelMenuOpen(false);
    } catch (error) {
      setError(
        error?.response?.data?.message || "Failed to delete channel."
      );
    } finally {
      setDeletingChannel(false);
    }
  };

  const handleTypingUpdate = useCallback((payload) => {
    const type = payload?.conversationType === "channel" ? "channel" : "direct";
    const id = payload?.conversationType === "channel" ? payload?.channelId : payload?.conversationId;
    const key = getConversationKey(type, id);
    if (!key || !payload?.userId) return;

    setChatState((prev) => {
      if (String(payload.userId) === String(prev.currentUser?.id)) return prev;

      const existing = prev.typingByConversation[key] || [];
      const withoutUser = existing.filter((u) => String(u.userId) !== String(payload.userId));
      const nextTyping = payload.isTyping
        ? [...withoutUser, { userId: payload.userId, name: payload?.name || "Someone" }]
        : withoutUser;

      return {
        ...prev,
        typingByConversation: {
          ...prev.typingByConversation,
          [key]: nextTyping,
        },
      };
    });
  }, []);

  const handleReadUpdated = useCallback((payload) => {
    const type = payload?.conversationType === "channel" ? "channel" : "direct";
    const id = payload?.conversationType === "channel" ? payload?.channelId : payload?.conversationId;
    const key = getConversationKey(type, id);
    if (!key) return;

    setChatState((prev) => ({
      ...prev,
      unreadCounts: {
        ...prev.unreadCounts,
        [key]: payload?.unreadCount ?? prev.unreadCounts[key] ?? 0,
      },
    }));
  }, []);

  const handlePresenceUpdate = useCallback((payload) => {
    if (!payload?.userId) return;
    setChatState((prev) => ({
      ...prev,
      presenceMap: {
        ...prev.presenceMap,
        [payload.userId]: {
          status: payload.status || (payload.online ? "online" : "offline"),
          lastSeenAt: payload.lastSeenAt || null,
          online: payload.online ?? payload.status === "online",
        },
      },
    }));
  }, []);

  const {
    available: socketAvailable,
    connected,
    emitSendMessage,
    emitTypingStart,
    emitTypingStop,
    emitReadUpdate,
    emitJoinConversation,
    emitLeaveConversation,
  } = useChatSocket({
      enabled: true,
      onMessageNew: handleMessageNew,
      onTypingUpdate: handleTypingUpdate,
      onReadUpdated: handleReadUpdated,
      onPresenceUpdate: handlePresenceUpdate,
      onReconnect: () => {
        if (!isTabVisible) return;
        const now = Date.now();
        if (now - reconnectSyncAtRef.current < 15000) return;
        reconnectSyncAtRef.current = now;
        const active = chatState.activeConversation;
        loadChatLists(active, { silent: true, includeUsers: false, includeCurrentUser: false });
        if (active?.id) {
          loadMessages({ conversation: active, force: true });
        }
      },
    });

  useEffect(() => {
    const timer = setTimeout(() => {
      let preferred = null;
      try {
        const stored = localStorage.getItem("nexora_chat_open");
        if (stored) {
          preferred = JSON.parse(stored);
          localStorage.removeItem("nexora_chat_open");
        }
      } catch {
        preferred = null;
      }
      loadChatLists(preferred);
    }, 0);
    return () => clearTimeout(timer);
  }, [loadChatLists]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const updateVisibility = () => {
      setIsTabVisible(!document.hidden);
    };

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);

    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!activeConversation?.key) return undefined;
    const conversationKey = activeConversation.key;
    const cached = chatState.messagesByConversation[conversationKey];
    const hasCachedMessages = Array.isArray(cached) && cached.length > 0;

    if (cached) {
      markConversationRead(activeConversation, emitReadUpdate);
      if (hasCachedMessages && !initialConversationRefreshRef.current.has(conversationKey)) {
        initialConversationRefreshRef.current.add(conversationKey);
        // Keep cached conversation responsive but refresh it once in background.
        const timer = setTimeout(() => {
          loadMessages({ conversation: activeConversation, force: true });
        }, 120);
        return () => clearTimeout(timer);
      }
      return undefined;
    }

    const timer = setTimeout(() => {
      loadMessages({ conversation: activeConversation }).then(() => {
        markConversationRead(activeConversation, emitReadUpdate);
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [
    activeConversation?.id,
    activeConversation?.key,
    activeConversation?.type,
    emitReadUpdate,
    loadMessages,
    markConversationRead,
  ]);

  useEffect(() => {
    if (!activeConversation?.key || !currentMessages.length) return;
    markConversationRead(activeConversation, emitReadUpdate);
  }, [activeConversation, currentMessages.length, emitReadUpdate, markConversationRead]);

  useEffect(() => {
    if (!quill || !activeConversation?.key) return;
    const draftKey = getDraftKey(chatState.currentUser?.id, activeConversation.key);
    try {
      const saved = localStorage.getItem(draftKey);
      if (!saved) {
        quill.setText("");
        setComposerChars(0);
        return;
      }
      const parsed = JSON.parse(saved);
      const html = parsed?.html || "";
      const type = parsed?.type || "update";
      setComposerType(type);
      quill.clipboard.dangerouslyPasteHTML(html || "");
      setComposerChars(quill.getText().trim().length);
    } catch {
      quill.setText("");
      setComposerChars(0);
    }
  }, [activeConversation?.key, chatState.currentUser?.id, quill]);

  useEffect(() => {
    if (!activeConversation?.id) return undefined;

    const payload =
      activeConversation.type === "channel"
        ? { conversationType: "channel", channelId: activeConversation.id }
        : { conversationType: "direct", conversationId: activeConversation.id };

    emitJoinConversation(payload);

    return () => {
      emitLeaveConversation(payload);
    };
  }, [
    activeConversation?.id,
    activeConversation?.type,
    emitJoinConversation,
    emitLeaveConversation,
  ]);

  useEffect(() => {
    if (connected) return undefined;
    if (!isTabVisible) return undefined;
    if (!activeConversation?.id) return undefined;

    const interval = setInterval(() => {
      loadMessages({ conversation: activeConversation, force: true });
    }, socketAvailable ? 12000 : 8000);

    return () => clearInterval(interval);
  }, [
    activeConversation?.id,
    activeConversation?.type,
    connected,
    loadMessages,
    socketAvailable,
    isTabVisible,
  ]);

  useEffect(() => {
    if (connected) return undefined;
    if (!isTabVisible) return undefined;

    const interval = setInterval(() => {
      loadChatLists(activeConversation || null, {
        silent: true,
        includeUsers: false,
        includeCurrentUser: false,
      });
    }, socketAvailable ? 30000 : 20000);

    return () => clearInterval(interval);
  }, [
    activeConversation?.id,
    activeConversation?.type,
    connected,
    loadChatLists,
    socketAvailable,
    isTabVisible,
  ]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeKey, currentMessages.length]);

  useEffect(() => {
    if (!quill) return undefined;

    const handleTextChange = () => {
      setComposerChars(quill.getText().trim().length);

      if (!activeConversation?.id) return;
      const payload =
        activeConversation.type === "channel"
          ? { conversationType: "channel", channelId: activeConversation.id }
          : { conversationType: "direct", conversationId: activeConversation.id };

      emitTypingStart(payload);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        emitTypingStop(payload);
      }, 1200);

      const draftKey = getDraftKey(chatState.currentUser?.id, activeConversation.key);
      try {
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            html: quill.root.innerHTML,
            type: composerType,
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // ignore draft persistence errors
      }
    };

    quill.on("text-change", handleTextChange);

    return () => {
      quill.off("text-change", handleTextChange);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [quill, activeConversation, chatState.currentUser?.id, composerType, emitTypingStart, emitTypingStop]);

  const sendMessage = () => {
    if (!quill || !activeConversation || sending) return;
    const rawHtml = quill.root.innerHTML;
    const contentText = quill.getText().trim();
    if (!contentText) return;
    const contentHtml = rawHtml
      .replace(/^(?:\s*<p><br><\/p>\s*)+/gi, "")
      .replace(/(?:\s*<p><br><\/p>\s*)+$/gi, "")
      .trim();

    const clientMessageId = createClientMessageId();
    const payload =
      activeConversation.type === "channel"
        ? {
            conversationType: "channel",
            channelId: activeConversation.id,
            contentHtml,
            contentText,
            messageType: composerType,
            clientMessageId,
          }
        : {
            conversationType: "direct",
            conversationId: activeConversation.id,
            contentHtml,
            contentText,
            messageType: composerType,
            clientMessageId,
          };

    const optimistic = normalizeMessage({
      id: `pending-${clientMessageId}`,
      clientMessageId,
      senderId: chatState.currentUser.id,
      sender: { name: chatState.currentUser.name },
      contentHtml,
      contentText,
      messageType: composerType,
      conversationType: activeConversation.type,
      channelId: activeConversation.type === "channel" ? activeConversation.id : undefined,
      conversationId: activeConversation.type === "direct" ? activeConversation.id : undefined,
      createdAt: new Date().toISOString(),
      pending: true,
    });

    setSending(true);
    setChatState((prev) => {
      const existing = prev.messagesByConversation[activeConversation.key] || [];
      return {
        ...prev,
        error: "",
        pendingByClientId: {
          ...prev.pendingByClientId,
          [clientMessageId]: {
            conversationKey: activeConversation.key,
            id: optimistic.id,
          },
        },
        messagesByConversation: {
          ...prev.messagesByConversation,
          [activeConversation.key]: appendUniqueByMessageId(existing, optimistic),
        },
      };
    });
    pendingByClientIdRef.current = {
      ...pendingByClientIdRef.current,
      [clientMessageId]: {
        conversationKey: activeConversation.key,
        id: optimistic.id,
      },
    };

    let fallbackTimer = null;
    let fallbackStarted = false;

    const applySendFailure = (errorMessage) => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setSending(false);
      const nextPendingRef = { ...pendingByClientIdRef.current };
      delete nextPendingRef[clientMessageId];
      pendingByClientIdRef.current = nextPendingRef;
      setChatState((prev) => {
        const existing = prev.messagesByConversation[activeConversation.key] || [];
        const next = existing.map((msg) =>
          msg.clientMessageId === clientMessageId ? { ...msg, pending: false, failed: true } : msg,
        );
        const nextPending = { ...prev.pendingByClientId };
        delete nextPending[clientMessageId];

        return {
          ...prev,
          error: errorMessage || "Failed to send message.",
          pendingByClientId: nextPending,
          messagesByConversation: {
            ...prev.messagesByConversation,
            [activeConversation.key]: next,
          },
        };
      });
    };

    const applySendSuccess = (messagePayload) => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      setSending(false);
      const nextPendingRef = { ...pendingByClientIdRef.current };
      delete nextPendingRef[clientMessageId];
      pendingByClientIdRef.current = nextPendingRef;
      const confirmed = normalizeMessage({
        ...(messagePayload || {}),
        clientMessageId: messagePayload?.clientMessageId || clientMessageId,
      });
      setChatState((prev) => {
        const existing = prev.messagesByConversation[activeConversation.key] || [];
        const nextPending = { ...prev.pendingByClientId };
        delete nextPending[clientMessageId];
        const upserted = upsertByClientMessageId(existing, confirmed);
        const hasPendingMatch = upserted.some(
          (item) =>
            item?.pending &&
            String(item.contentText || "").trim().toLowerCase() ===
              String(confirmed.contentText || "").trim().toLowerCase(),
        );
        const stabilized = hasPendingMatch
          ? upserted.map((item) =>
              item?.pending &&
              String(item.contentText || "").trim().toLowerCase() ===
                String(confirmed.contentText || "").trim().toLowerCase()
                ? { ...confirmed, pending: false, failed: false }
                : item,
            )
          : upserted;

        return {
          ...prev,
          pendingByClientId: nextPending,
          messagesByConversation: {
            ...prev.messagesByConversation,
            [activeConversation.key]: stabilized,
          },
        };
      });

      const typingPayload =
        activeConversation.type === "channel"
          ? { conversationType: "channel", channelId: activeConversation.id }
          : { conversationType: "direct", conversationId: activeConversation.id };
      emitTypingStop(typingPayload);

      quill.setText("");
      setComposerChars(0);
      const draftKey = getDraftKey(chatState.currentUser?.id, activeConversation.key);
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore draft persistence errors
      }
    };

    const sendViaHttpFallback = async () => {
      if (!pendingByClientIdRef.current?.[clientMessageId]) return;
      try {
        const confirmed = await chatApi.sendMessage(payload);
        applySendSuccess(confirmed);
      } catch (error) {
        applySendFailure(error?.response?.data?.message || "Failed to send message.");
      }
    };

    const maybeSendHttpFallback = () => {
      if (fallbackStarted) return;
      fallbackStarted = true;
      void sendViaHttpFallback();
    };

    fallbackTimer = setTimeout(() => {
      if (pendingByClientIdRef.current?.[clientMessageId]) {
        maybeSendHttpFallback();
      }
    }, 1200);

    emitSendMessage(payload, (ack) => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (!ack?.ok || !ack?.message) {
        maybeSendHttpFallback();
        return;
      }

      applySendSuccess(ack.message);
    });
  };

  sendMessageRef.current = sendMessage;

  useEffect(() => {
    if (!quill) return undefined;

    const handleComposerKeyDown = (event) => {
      if (event.key !== "Enter") return;
      if (event.shiftKey || event.isComposing) return;
      event.preventDefault();
      sendMessageRef.current();
    };

    quill.root.addEventListener("keydown", handleComposerKeyDown);
    return () => {
      quill.root.removeEventListener("keydown", handleComposerKeyDown);
    };
  }, [quill]);

  const loadOlderMessages = async () => {
    if (!activeConversation || !currentCursor?.hasMore || !currentCursor?.nextCursor) return;
    await loadMessages({
      conversation: activeConversation,
      cursor: currentCursor.nextCursor,
      prepend: true,
    });
  };

  const applyTemplate = (template) => {
    if (!quill) return;
    setComposerType(template.type);
    quill.clipboard.dangerouslyPasteHTML(template.content);
    quill.focus();
  };

  useEffect(() => {
    if (!showChannelModal) return;
    setChannelVisibility("public");
    setChannelAllowedSenders(chatState.currentUser?.id ? [chatState.currentUser.id] : []);
    setSenderDropdownOpen(false);
    setSenderSearch("");
  }, [showChannelModal, chatState.currentUser?.id]);

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      const allowedSenders =
        channelVisibility === "private"
          ? [...new Set([...(channelAllowedSenders || []), chatState.currentUser?.id].filter(Boolean))]
          : [];
      const created = await chatApi.createChannel({
        name: newChannelName.trim(),
        visibility: channelVisibility,
        allowedSenders,
      });
      const createdChannel = {
        ...created,
        id: getEntityId(created),
        unreadCount: 0,
      };
      const nextActive = toConversationRef("channel", createdChannel);

      setChatState((prev) => ({
        ...prev,
        channels: [...prev.channels, createdChannel],
        activeConversation: nextActive,
        messagesByConversation: {
          ...prev.messagesByConversation,
          [nextActive.key]: [],
        },
      }));

      setShowChannelModal(false);
      setNewChannelName("");
    } catch {
      setError("Failed to create channel.");
    }
  };

  const startDirectConversation = async () => {
    try {
      let conversation = null;
      if (inviteUserId) {
        conversation = await chatApi.startDirectById(inviteUserId);
      } else {
        return;
      }

      const dm = chatApi.toDirectDisplay(conversation, chatState.currentUser.id);
      const ref = toConversationRef("direct", dm);

      setChatState((prev) => {
        const exists = prev.directs.some(
          (item) => String(item.conversationId) === String(dm.conversationId),
        );
        return {
          ...prev,
          directs: exists ? prev.directs : [...prev.directs, dm],
          activeConversation: ref,
          unreadCounts: {
            ...prev.unreadCounts,
            [ref.key]: 0,
          },
        };
      });

      setShowInviteModal(false);
      setInviteUserId("");
      setUserSearch("");
    } catch {
      setError("Failed to start direct message.");
    }
  };

  const openConversation = (type, raw) => {
    const ref = toConversationRef(type, raw);
    if (!ref) return;
    setChatState((prev) => ({
      ...prev,
      activeConversation: ref,
      error: "",
      unreadCounts: {
        ...prev.unreadCounts,
        [ref.key]: 0,
      },
    }));
    setSidebarOpen(false);
  };

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    const currentUserId = String(chatState.currentUser?.id || "");
    const pool = (chatState.users || []).filter((user) => {
      const id = String(user?.id || user?._id || "");
      return id && id !== currentUserId;
    });
    if (!query) return pool;
    return pool.filter((user) => {
      const name = (user?.name || "").toLowerCase();
      const email = (user?.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [chatState.users, userSearch, chatState.currentUser?.id]);

  const filteredSenderOptions = useMemo(() => {
    const query = senderSearch.trim().toLowerCase();
    const currentUserId = String(chatState.currentUser?.id || "");
    const pool = (chatState.users || []).filter((user) => {
      const id = String(user?.id || user?._id || "");
      return id && id !== currentUserId;
    });
    if (!query) return pool;
    return pool.filter((user) => {
      const name = (user?.name || "").toLowerCase();
      const email = (user?.email || "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [chatState.users, senderSearch, chatState.currentUser?.id]);

  const getUnreadFor = useCallback(
    (type, id) => chatState.unreadCounts[getConversationKey(type, id)] || 0,
    [chatState.unreadCounts],
  );

  const filterConversationList = useCallback(
    (items, type) => {
      const query = conversationSearch.trim().toLowerCase();
      return items.filter((item) => {
        const id = type === "channel" ? item.id : item.conversationId;
        const unread = getUnreadFor(type, id);
        const matchesFilter = conversationFilter === "all" || unread > 0;
        const matchesQuery =
          !query ||
          `${item.name || ""} ${item.lastPreview || ""} ${item.email || ""}`
            .toLowerCase()
            .includes(query);
        return matchesFilter && matchesQuery;
      });
    },
    [conversationFilter, conversationSearch, getUnreadFor],
  );

  const visibleChannels = useMemo(
    () => filterConversationList(chatState.channels, "channel"),
    [chatState.channels, filterConversationList],
  );

  const visibleDirects = useMemo(
    () => filterConversationList(chatState.directs, "direct"),
    [chatState.directs, filterConversationList],
  );

  const totalUnread = useMemo(
    () => Object.values(chatState.unreadCounts).reduce((sum, count) => sum + Number(count || 0), 0),
    [chatState.unreadCounts],
  );
  const hasActiveConversation = Boolean(activeConversation?.id);

  return (
    <div className="chat-page-theme h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] min-h-0 w-full overflow-hidden bg-[#0b1020]">
      <div className="flex h-full min-h-0 overflow-hidden bg-slate-950/80 text-slate-100">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`fixed lg:relative z-50 lg:z-auto flex h-full w-72 flex-col border-r border-slate-800/70 bg-slate-950/90 backdrop-blur-xl transform transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        >
          <div className="border-b border-slate-800/70 bg-slate-950/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="flex items-center gap-2 text-lg font-semibold">
                  <Sparkles size={16} className="text-indigo-300" />
                  Team Chat
                </h1>
                <p className="mt-1 text-xs text-slate-400">{chatState.users.length} members</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  placeholder="Search updates..."
                  className="w-full rounded-xl border border-slate-800/70 bg-slate-900/80 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-7">
            {chatState.loadingList ? (
              <p className="text-sm text-gray-400">Loading conversations...</p>
            ) : (
              <>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Channels</p>
                    {canCreateChannel && (
                      <PlusCircle
                      size={18}
                      className="cursor-pointer text-indigo-400 transition hover:text-indigo-300"
                      onClick={() => setShowChannelModal(true)}
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {visibleChannels.map((channel) => {
                    const id = channel.id;
                    const key = getConversationKey("channel", id);
                    const unread = getUnreadFor("channel", id);
                    const isActive = activeConversation?.key === key;

                    return (
                      <div
                        key={id}
                        onClick={() => openConversation("channel", channel)}
                        className={`cursor-pointer rounded-xl border px-3 py-2.5 transition flex items-center gap-2 justify-between ${
                          isActive
                            ? "border-indigo-400/60 bg-indigo-500/10 shadow-[0_12px_24px_rgba(59,130,246,0.18)]"
                            : "border-slate-800/70 bg-slate-900/70 hover:border-indigo-400/40 hover:bg-slate-900"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                            isActive ? "border-indigo-400/50 bg-indigo-500/10" : "border-slate-800/70 bg-slate-900"
                          }`}>
                            <Hash size={14} className="opacity-80" />
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {channel.name || "channel"}
                            </span>
                            <span className="block truncate text-[11px] text-slate-500">
                              {channel.lastPreview || "Workspace channel"}
                            </span>
                          </div>
                        </div>
                        {unread > 0 && (
                          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-100">
                            {unread}
                          </span>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Direct Messages</p>
                    <UserPlus
                      size={18}
                      className="cursor-pointer text-indigo-400 transition hover:text-indigo-300"
                      onClick={() => setShowInviteModal(true)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    {visibleDirects.map((dm) => {
                    const key = getConversationKey("direct", dm.conversationId);
                    const unread = getUnreadFor("direct", dm.conversationId);
                    const isActive = activeConversation?.key === key;

                    return (
                      <div
                        key={dm.conversationId}
                        onClick={() => openConversation("direct", dm)}
                        className={`cursor-pointer rounded-2xl border px-3 py-3 transition flex items-center gap-2 justify-between ${
                          isActive
                            ? "border-indigo-400/60 bg-gradient-to-r from-indigo-600/40 to-cyan-600/30 shadow-[0_12px_24px_rgba(37,99,235,0.24)]"
                            : "border-slate-800/70 bg-slate-900/70 hover:border-indigo-400/40 hover:bg-slate-900"
                        }`}
                      >
                        <div className="min-w-0 flex items-center gap-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${
                            isActive ? "border-white/20 bg-white/10" : "border-slate-800/70 bg-slate-900"
                          }`}>
                            <MessageCircle size={14} className="opacity-80" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{dm.name || "Direct chat"}</p>
                            <p className="truncate text-[10px] text-slate-500">
                              {dm.lastPreview || "No messages yet"}
                            </p>
                          </div>
                        </div>
                        {unread > 0 && (
                          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-100">
                            {unread}
                          </span>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex min-w-0 min-h-0 flex-1 flex-col bg-slate-950/40">
          <div className="flex h-20 items-center justify-between border-b border-slate-800/70 bg-slate-950/80 px-4 backdrop-blur md:px-6">
            <div className="flex items-center min-w-0">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-3">
                <Menu size={22} />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  {hasActiveConversation
                    ? activeConversation?.type === "channel"
                      ? "Channel"
                      : "Conversation"
                    : "Team Chat"}
                </p>
                <h2 className="truncate text-sm font-semibold md:text-lg">
                  {hasActiveConversation
                    ? activeConversation?.type === "channel"
                      ? `# ${activeConversation?.name || ""}`
                      : activeConversation?.name || "Direct Message"
                    : "Select a conversation"}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasActiveConversation && activeConversation?.type === "channel" && canDeleteActiveChannel && (
                <div className="relative">
                  <button
                    onClick={() => setChannelMenuOpen((prev) => !prev)}
                    className="rounded-full border border-slate-800/70 bg-slate-900/70 p-2 text-slate-300 hover:border-indigo-400/50"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {channelMenuOpen && (
                    <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950 shadow-xl">
                      <button
                        onClick={() => {
                          setShowDeleteChannelModal(true);
                          setChannelMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 size={14} />
                        Delete channel
                      </button>
                    </div>
                  )}
                </div>
              )}
              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  !socketAvailable
                    ? "bg-slate-500/10 text-slate-300 border-slate-500/30"
                    : connected
                    ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                }`}
              >
                {!socketAvailable
                  ? "Sync mode"
                  : connected
                    ? "Real-time"
                    : "Reconnecting..."}
              </span>
            </div>
          </div>

          {chatState.error && (
            <div className="mx-4 mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300 text-sm">
              {chatState.error}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12),_transparent_32%)] px-4 py-5 md:px-6 md:py-6 space-y-4">
            {!hasActiveConversation ? (
              <div className="flex h-full items-center justify-center">
                <div className="max-w-xl rounded-[24px] border border-slate-800/70 bg-slate-900/60 p-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-200">
                    <MessageCircle size={20} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100">Pick a conversation</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Choose a channel or direct message from the left to start chatting. Your
                    composer will appear here once a conversation is selected.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {currentCursor?.hasMore && (
                <button
                  onClick={loadOlderMessages}
                  className="mx-auto flex items-center gap-1 rounded-full border border-slate-800/70 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 shadow-sm hover:border-indigo-400/60"
                >
                  <ChevronUp size={14} />
                  Load older messages
                </button>
                )}

            {chatState.loadingMessages ? (
              <p className="text-sm text-slate-400">Loading messages...</p>
            ) : currentMessages.length === 0 ? (
              activeConversation?.type === "channel" ? (
                <div className="flex justify-start">
                  <div className="max-w-[88%] rounded-[22px] border border-slate-800/70 bg-slate-900/80 p-5 text-slate-100 shadow-[0_18px_48px_rgba(15,23,42,0.35)] md:max-w-[75%]">
                    <div className="flex items-center justify-between gap-3 text-xs mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold shrink-0">
                          B
                        </div>
                        <span className="font-semibold text-sm truncate">Nexora Bot</span>
                        <span className="px-2 py-0.5 rounded-full border text-[10px] bg-emerald-500/15 text-emerald-200 border-emerald-500/40">
                          Greeting
                        </span>
                      </div>
                      <span className="text-slate-400 shrink-0">Now</span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <p>
                        Welcome to <strong>#{activeConversation?.name || "channel"}</strong>.
                      </p>
                      <p>
                        This channel is global for your workspace. Start with an update or tag a
                        teammate to begin.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-800/70 bg-slate-900/60 p-8 text-center shadow-sm">
                  <p className="text-sm text-slate-200">No messages yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Send the first message to start this direct conversation.
                  </p>
                </div>
              )
            ) : (
              currentMessages.map((msg) => {
                const isSelf = String(msg.senderId) === String(chatState.currentUser.id);
                const badgeStyle = messageTypeStyle[msg.messageType] || messageTypeStyle.message;
                return (
                  <div key={msg.id} className={`flex ${isSelf ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[92%] overflow-hidden rounded-md border px-2.5 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.10)] md:max-w-[360px] ${
                        isSelf
                          ? "border-indigo-500/40 bg-indigo-500/10 text-slate-100"
                          : "border-slate-800/70 bg-slate-900/70 text-slate-100"
                      } ${msg.pending ? "opacity-70" : ""} ${msg.failed ? "border-red-500/50" : ""}`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-5 w-5 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {msg.senderName?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <span className="truncate text-xs font-semibold">{msg.senderName}</span>
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] ${badgeStyle}`}>
                            {messageTypeLabel[msg.messageType] || "Message"}
                          </span>
                        </div>
                        <span className="shrink-0 text-[10px] text-slate-500">{msg.timeLabel || "-"}</span>
                      </div>

                      <div
                        className="prose prose-invert prose-sm max-w-none break-words text-sm leading-snug [overflow-wrap:anywhere] prose-p:my-0.5 prose-headings:my-0.5 [&_*]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: msg.contentHtml }}
                      />

                      {msg.pending && <p className="mt-1 text-[10px] text-gray-400">Sending...</p>}
                      {msg.failed && <p className="mt-1 text-[10px] text-red-300">Failed to send</p>}
                    </div>
                  </div>
                );
              })
            )}

            {currentTyping.length > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 shadow-sm">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" />
                </span>
                {currentTyping.map((u) => u.name).join(", ")} typing...
              </div>
            ) : null}

            <div ref={chatEndRef} />
              </>
            )}
          </div>

          <div className="border-t border-slate-800/70 bg-slate-950/90 p-4 backdrop-blur-xl">
            {!hasActiveConversation ? (
              <div className="rounded-2xl border border-slate-800/70 bg-slate-900/60 px-4 py-3 text-sm text-slate-400">
                Select a conversation to start composing a message.
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Compose</p>
                    <p className="text-sm font-semibold text-slate-200">
                      {messageTypeLabel[composerType] || "Message"}
                    </p>
                  </div>
                  {activeConversation?.type === "channel" &&
                    activeChannelDetails?.visibility === "private" &&
                    canManagePrivateChannel && (
                      <button
                        onClick={() => {
                          setShowPrivateMemberModal(true);
                          setPrivateMemberSelection([]);
                          setPrivateMemberSearch("");
                          setPrivateMemberDropdownOpen(false);
                          setPrivateMemberAllowSend(true);
                          setPrivateMemberError("");
                        }}
                        className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-200 transition hover:border-indigo-400/70"
                      >
                        Add members
                      </button>
                    )}
                  <div className="flex flex-wrap gap-2">
                  {Object.entries(messageTypeLabel).map(([type, label]) => (
                    <button
                      key={type}
                      onClick={() => setComposerType(type)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        composerType === type
                          ? `${messageTypeStyle[type]}`
                          : "border-slate-800/70 bg-slate-950 text-slate-300 hover:border-indigo-400/50 hover:bg-indigo-500/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-[22px] border border-slate-800/70 bg-slate-950 shadow-[0_18px_48px_rgba(15,23,42,0.35)]">
                  <div className="border-b border-slate-800/70 bg-slate-900/70 px-3 py-2 text-xs text-slate-400">
                    Write your {composerType} update
                  </div>
                  <div ref={quillRef} className="min-h-[140px] text-slate-100" />
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-slate-400">
                    Tip: Keep it short and skimmable. Headings and bullets help.
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full border border-slate-800/70 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">
                      {composerChars} chars
                    </span>
                    <button
                      onClick={sendMessage}
                      disabled={!composerChars || sending || !activeConversation}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 px-4 py-2 font-medium shadow-[0_12px_24px_rgba(59,130,246,0.28)] disabled:opacity-50"
                    >
                      <SendHorizontal size={16} />
                      {sending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showChannelModal && canCreateChannel && (
        <div
          className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowChannelModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-700 bg-[#111827] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Create Channel</h3>
              <button onClick={() => setShowChannelModal(false)}>
                <X size={18} />
              </button>
            </div>
            <input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="e.g. product-updates"
              className="w-full px-3 py-2 rounded-lg bg-[#1e293b] border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-4 space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Channel visibility
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setChannelVisibility("public")}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    channelVisibility === "public"
                      ? "border-indigo-500/60 bg-indigo-500/15 text-slate-100"
                      : "border-slate-700 bg-[#0f172a] text-slate-300 hover:border-indigo-400/50"
                  }`}
                >
                  <p className="text-sm font-semibold">Public</p>
                  <p className="text-xs text-slate-400">
                    Anyone in the workspace can send messages.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setChannelVisibility("private")}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    channelVisibility === "private"
                      ? "border-indigo-500/60 bg-indigo-500/15 text-slate-100"
                      : "border-slate-700 bg-[#0f172a] text-slate-300 hover:border-indigo-400/50"
                  }`}
                >
                  <p className="text-sm font-semibold">Private</p>
                  <p className="text-xs text-slate-400">
                    Only selected members can send messages.
                  </p>
                </button>
              </div>

              {channelVisibility === "private" && (
                <div className="rounded-xl border border-slate-700 bg-[#0b1220] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Who can send?
                      </p>
                      <p className="text-xs text-slate-400">
                        Select members who can post in this channel.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSenderDropdownOpen((prev) => !prev)}
                      className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:border-indigo-400/50"
                    >
                      {channelAllowedSenders.length} selected
                    </button>
                  </div>

                  {senderDropdownOpen && (
                    <div className="mt-3 space-y-2">
                      <input
                        value={senderSearch}
                        onChange={(e) => setSenderSearch(e.target.value)}
                        placeholder="Search members..."
                        className="w-full rounded-lg border border-slate-700 bg-[#0f172a] px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-400/60"
                      />
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {filteredSenderOptions.map((user) => {
                          const userId = String(user?._id || user?.id || "");
                          if (!userId) return null;
                          const isSelf = String(userId) === String(chatState.currentUser?.id || "");
                          const isChecked = channelAllowedSenders.includes(userId);
                          return (
                            <label
                              key={userId}
                              className="flex items-center justify-between rounded-lg border border-slate-800/70 bg-[#0f172a] px-3 py-2 text-sm text-slate-200"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {user?.name || user?.email || "User"}
                                  {isSelf ? " (You)" : ""}
                                </p>
                                <p className="truncate text-xs text-slate-400">
                                  {user?.email || "No email"}
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-indigo-500"
                                checked={isChecked}
                                disabled={isSelf}
                                onChange={() => {
                                  setChannelAllowedSenders((prev) => {
                                    if (isSelf) return prev;
                                    if (prev.includes(userId)) {
                                      return prev.filter((id) => id !== userId);
                                    }
                                    return [...prev, userId];
                                  });
                                }}
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowChannelModal(false)}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivateMemberModal && activeChannelDetails && (
        <div
          className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowPrivateMemberModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-700 bg-[#111827] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Add members</h3>
                <p className="text-xs text-slate-400">
                  Invite people to join #{activeChannelDetails.name}
                </p>
              </div>
              <button onClick={() => setShowPrivateMemberModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPrivateMemberDropdownOpen((prev) => !prev)}
                  className="modal-input flex items-center justify-between text-left"
                >
                  <span className="truncate">
                    {privateMemberSelection.length > 0
                      ? privateMemberSelection
                          .map((member) => member.name || member.email)
                          .join(", ")
                      : "Select members"}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`ml-3 shrink-0 text-gray-400 transition ${
                      privateMemberDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {privateMemberDropdownOpen && (
                  <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-gray-700 bg-[#0f172a] shadow-xl">
                    <div className="border-b border-gray-700 p-3">
                      <input
                        value={privateMemberSearch}
                        onChange={(e) => setPrivateMemberSearch(e.target.value)}
                        placeholder="Search users..."
                        className="modal-input text-sm"
                      />
                    </div>

                    {filteredPrivateCandidates.length === 0 && (
                      <p className="px-4 py-3 text-sm text-gray-400">
                        No available users.
                      </p>
                    )}

                    {filteredPrivateCandidates.map((member) => {
                      const key = member.id || member._id || member.email;
                      const selected = privateMemberSelection
                        .map((m) => m.id || m._id || m.email)
                        .includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setPrivateMemberSelection((prev) => {
                              const ids = prev.map((m) => m.id || m._id || m.email);
                              if (ids.includes(key)) {
                                return prev.filter((m) => (m.id || m._id || m.email) !== key);
                              }
                              return [...prev, member];
                            });
                          }}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[#1e293b]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">
                              {member.name || member.email || "Member"}
                            </p>
                            <p className="truncate text-[11px] text-gray-400">
                              {member.role || member.email || "Member"}
                            </p>
                          </div>
                          <div
                            className={`h-4 w-4 rounded border ${
                              selected
                                ? "border-indigo-600 bg-indigo-600"
                                : "border-gray-500"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={privateMemberAllowSend}
                  onChange={(e) => setPrivateMemberAllowSend(e.target.checked)}
                  className="h-4 w-4"
                />
                Allow them to send messages
              </label>

              {privateMemberError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                  {privateMemberError}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowPrivateMemberModal(false)}
                  className="px-3 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPrivateMembers}
                  disabled={privateMemberSaving || privateMemberSelection.length === 0}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {privateMemberSaving ? "Adding..." : "Add members"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteChannelModal && activeChannelDetails && (
        <div
          className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowDeleteChannelModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-700 bg-[#111827] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Delete channel</h3>
              <button onClick={() => setShowDeleteChannelModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-slate-400">
              This will remove <span className="text-slate-200 font-semibold">#{activeChannelDetails.name}</span> for everyone in the company.
              Messages won’t be accessible after deletion.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteChannelModal(false)}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteActiveChannel}
                disabled={deletingChannel}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletingChannel ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showInviteModal && (
        <div
          className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-gray-700 bg-[#111827] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Start Direct Message</h3>
              <button onClick={() => setShowInviteModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-2">Choose user</p>
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search by name or email"
                  className="w-full px-3 py-2 rounded-lg bg-[#1e293b] border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-700">
                  {filteredUsers.map((user) => {
                    const id = getEntityId(user);
                    const isSelected = inviteUserId === String(id);
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => {
                          setInviteUserId(String(id));
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between text-sm transition ${
                          isSelected ? "bg-indigo-600/30" : "hover:bg-[#1f2937]"
                        }`}
                      >
                        <span className="truncate">{user?.name || user?.email}</span>
                      </button>
                    );
                  })}
                  {!filteredUsers.length && (
                    <p className="px-3 py-2 text-xs text-gray-400">No users found</p>
                  )}
                </div>
              </div>

            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowInviteModal(false)}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={startDirectConversation}
                disabled={!inviteUserId}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm disabled:opacity-50"
              >
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
