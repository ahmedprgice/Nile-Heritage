"use client";

import { useRouter, usePathname } from "next/navigation";
import "../globals.css";
import Link from "next/link";
import api from "@/lib/http";
import { listDirectoryUsers } from "@/lib/users";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from "react";
import React from "react";
import { Menu } from "lucide-react";
import { useChatSocket } from "@/hooks/useChatSocket";
import { normalizeMessage } from "@/lib/chat/chatUtils";
import { getCachedRequest, invalidateRequestCache } from "@/lib/requestCache";

import {
  Bell,
  LayoutDashboard,
  Kanban,
  CheckSquare,
  MessageCircle,
  FileText,
  Search,
  ChevronDown,
  Plus,
  Settings,
  LogOut,
  Trash2,
  Pencil,
  MoreVertical,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  ShieldCheck,
  Moon,
  Sun,
  X,
  Loader2,
} from "lucide-react";

const WORKSPACE_API = "/api/workspaces";

const getOwnerLabel = (owner) => {
  if (!owner) return "No owner";
  if (typeof owner === "string") return owner;
  return owner.name || owner.email || owner.role || "No owner";
};

const getMemberLabel = (member) => {
  if (!member) return "Member";
  if (typeof member === "string") return member;
  return member.name || member.email || member.role || "Member";
};

const getMemberKey = (member) => {
  if (!member) return "member";
  if (typeof member === "string") return member;
  return member.id || member._id || member.email || member.name || "member";
};

const toMemberTokens = (member) => {
  if (!member) return [];
  if (typeof member === "string") {
    const raw = String(member).trim();
    if (!raw) return [];
    return [raw, raw.toLowerCase()];
  }

  const rawTokens = [
    member.id,
    member._id,
    member.email,
    member.name,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const lowered = rawTokens.map((token) => token.toLowerCase());
  return [...new Set([...rawTokens, ...lowered])];
};

function CreateWorkspaceModal({
  newWorkspace,
  setNewWorkspace,
  setShowCreateModal,
  createWorkspace,
  creatingWorkspace,
  memberOptions,
  ownerName,
}) {
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const toggleMember = (member) => {
    const memberKey = getMemberKey(member);
    setNewWorkspace((prev) => {
      const safePrev = {
        ...prev,
        members: Array.isArray(prev?.members) ? prev.members : [],
      };
      const selectedKeys = new Set(safePrev.members.map(getMemberKey));
      const alreadySelected = selectedKeys.has(memberKey);

      return {
        ...safePrev,
        members: alreadySelected
          ? safePrev.members.filter((m) => getMemberKey(m) !== memberKey)
          : [...safePrev.members, member],
      };
    });
  };

  const filteredMembers = memberOptions.filter((member) => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return true;
    return `${member.name} ${member.email} ${member.role}`
      .toLowerCase()
      .includes(query);
  });

  return (
    <motion.div
      className="modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setShowCreateModal(false)}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="modal-card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold">Create Workspace</h2>
          <button
            onClick={() => setShowCreateModal(false)}
            className="text-gray-400 hover:text-white"
          >
            <span className="text-lg">×</span>
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={newWorkspace.name}
            onChange={(e) =>
              setNewWorkspace((prev) => ({
                ...prev,
                name: e.target.value,
              }))
            }
            placeholder="Workspace Name"
            className="modal-input"
          />

          <textarea
            value={newWorkspace.description}
            onChange={(e) =>
              setNewWorkspace((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            placeholder="Workspace Description"
            rows={4}
            className="modal-textarea"
          />

          <div className="modal-section">
            <p className="text-xs text-gray-400">Owner</p>
            <p className="text-sm text-white mt-0.5">
              {ownerName || "Current user"}
            </p>
          </div>

          <div className="relative">
            <label className="block text-sm text-gray-400 mb-2">Members</label>

            <button
              type="button"
              onClick={() => setMemberDropdownOpen((prev) => !prev)}
              className="modal-input flex items-center justify-between text-left"
            >
              <span className="truncate">
                {newWorkspace.members.length > 0
                  ? newWorkspace.members.map(getMemberLabel).join(", ")
                  : "Select members"}
              </span>

              <ChevronDown
                size={16}
                className={`ml-3 shrink-0 text-gray-400 transition ${
                  memberDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {memberDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute z-50 mt-2 w-full rounded-xl border border-gray-700 bg-[#0f172a] shadow-xl overflow-hidden"
                >
                  <div className="p-3 border-b border-gray-700">
                    <input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search users..."
                          className="modal-input text-sm"
                        />
                  </div>

                {memberOptions.length === 0 && (
                  <p className="px-4 py-3 text-sm text-gray-400">
                    No users found
                  </p>
                )}

                <div className="max-h-48 overflow-y-auto">
                  {filteredMembers.map((member) => {
                    const selected = newWorkspace.members
                      .map(getMemberKey)
                      .includes(getMemberKey(member));

                    return (
                      <button
                        key={getMemberKey(member)}
                        type="button"
                        onClick={() => toggleMember(member)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#1e293b] transition"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">
                            {getMemberLabel(member)}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {member.role || member.email || "Member"}
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded border ${
                            selected
                              ? "bg-indigo-600 border-indigo-600"
                              : "border-gray-500"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>

                  {memberOptions.length > 0 && filteredMembers.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-400">
                      No matching users
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {newWorkspace.members.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {newWorkspace.members.map((member) => (
                  <span
                    key={getMemberKey(member)}
                    className="px-2 py-1 rounded-full text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  >
                    {getMemberLabel(member)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Workspace Color
            </label>
            <input
              type="color"
              value={newWorkspace.color}
              onChange={(e) =>
                setNewWorkspace((prev) => ({
                  ...prev,
                  color: e.target.value,
                }))
              }
              className="h-10 w-20 rounded border border-gray-700 bg-[#1e293b]"
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={newWorkspace.isActive}
              onChange={(e) =>
                setNewWorkspace((prev) => ({
                  ...prev,
                  isActive: e.target.checked,
                }))
              }
            />
            Set as active workspace
          </label>
        </div>

              <div className="modal-actions">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingWorkspace}
                  className="modal-secondary"
                >
                  Cancel
                </button>

                <button
                  onClick={createWorkspace}
                  disabled={creatingWorkspace}
                  className="modal-primary inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creatingWorkspace ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
      </motion.div>
    </motion.div>
  );
}

export default function RootLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState([]);
  const [currentUser, setCurrentUser] = useState({
    id: "",
    name: "User",
    email: "",
    role: "",
  });
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [effectiveRole, setEffectiveRole] = useState("");
  const [theme, setTheme] = useState("light");
  const [memberOptions, setMemberOptions] = useState([]);
  const searchRef = useRef(null);
  const workspacesRequestRef = useRef(null);
  const normalizedRole = String(effectiveRole || currentUser.role || "").toLowerCase();
  const isSuperuser = normalizedRole === "superuser";
  const isSubscriptionRequiredPage = pathname.startsWith(
    "/dashboard/subscription-required"
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    const roleFromUser = String(currentUser.role || "").toLowerCase();
    if (roleFromUser) {
      setEffectiveRole(roleFromUser);
      return;
    }
    const stored = localStorage.getItem("user");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      const storedRole = String(parsed?.role || "").toLowerCase();
      if (storedRole) setEffectiveRole(storedRole);
    } catch {
      // Ignore stored user parse errors
    }
  }, [currentUser.role]);

  useEffect(() => {
    const handleThemeChange = () => {
      const savedTheme = localStorage.getItem("theme");
      const nextTheme = savedTheme === "dark" ? "dark" : "light";
      setTheme(nextTheme);
    };

    window.addEventListener("theme-change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);

    return () => {
      window.removeEventListener("theme-change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
    document.body.classList.toggle("light-theme", theme === "light");
    document.body.classList.toggle("dark-theme", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!isSuperuser) return;
    const allowed = ["/dashboard/admin-panel", "/dashboard/admin/subscriptions"];
    if (!allowed.includes(pathname)) {
      router.replace("/dashboard/admin-panel");
    }
  }, [isSuperuser, pathname, router]);

  useEffect(() => {
    const hydrateUser = async () => {
      const fallback = { id: "", name: "User", email: "", role: "" };
      try {
        const token = localStorage.getItem("token");
        if (token) {
          try {
            const meData = await getCachedRequest(
              "auth:me",
              async () => (await api.get("/api/auth/me")).data,
              { ttlMs: 15000 },
            );
            const user = meData?.user || meData?.profile || {};
            if (user?.name || user?.email) {
              setCurrentUser({
                id: user._id || user.id || "",
                name: user.name || (user.email ? user.email.split("@")[0] : fallback.name),
                email: user.email || "",
                role: user.role || "",
              });
              setCurrentSubscription(
                meData?.profile?.subscription || meData?.user?.subscription || null
              );
              return;
            }
          } catch (profileError) {
            console.error("Unable to hydrate user profile:", profileError);
          }
        }

        const savedUser = localStorage.getItem("user");
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          const name =
            parsed?.name || parsed?.username || parsed?.fullName || "";
          const email = parsed?.email || "";
            if (name || email) {
              setCurrentUser({
                id: parsed?._id || parsed?.id || parsed?.userId || "",
                name: name || (email ? email.split("@")[0] : fallback.name),
                email,
                role: parsed?.role || "",
              });
              setCurrentSubscription(parsed?.subscription || null);
              return;
            }
        }

        if (!token) {
          setCurrentUser(fallback);
          return;
        }

        const payload = token.split(".")[1];
        if (!payload) {
          setCurrentUser(fallback);
          return;
        }

        const decoded = window.atob(
          payload.replace(/-/g, "+").replace(/_/g, "/")
        );
        const claims = JSON.parse(decoded);
        const claimEmail = claims?.email || "";
        const claimName =
          claims?.name || claims?.username || claims?.fullName || "";

        setCurrentUser({
          id: claims?.id || claims?._id || claims?.userId || "",
          name:
            claimName ||
            (claimEmail ? claimEmail.split("@")[0] : fallback.name),
          email: claimEmail,
          role: claims?.role || "",
        });
        setCurrentSubscription(claims?.subscription || null);
      } catch {
        setCurrentUser(fallback);
      }
    };

    hydrateUser();
  }, []);

  const userInitials = useMemo(() => {
    const initials = currentUser.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
    return initials || "U";
  }, [currentUser.name]);

  const isChatPage = pathname === "/dashboard/chat";
  const canManageSubscriptions = isSuperuser;
  const canAccessSubscription = ["owner", "admin"].includes(normalizedRole);
  const canAccessAdminPanel = isSuperuser;
  const roleCanManageBoardMembers = ["owner", "admin", "manager"].includes(
    normalizedRole,
  );
  const subscriptionStatus = String(
    currentSubscription?.accountStatus || currentSubscription?.status || ""
  ).toLowerCase();
  const subscriptionGateReady = isSuperuser || currentSubscription !== null;
  const hasSubscriptionAccess = isSuperuser
    ? true
    : !currentSubscription
      ? false
      : currentSubscription?.hasAccess === false
        ? false
        : !["expired", "suspended"].includes(subscriptionStatus);
  const links = canAccessAdminPanel
    ? [{ name: "Admin Panel", href: "/dashboard/admin-panel", icon: ShieldCheck }]
    : [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Workspace", href: "/dashboard/workspace", icon: Kanban },
        { name: "Real-Time Notes", href: "/dashboard/notes", icon: FileText },
        { name: "Task Management", href: "/dashboard/tasks", icon: CheckSquare },
        { name: "Chat", href: "/dashboard/chat", icon: MessageCircle },
      ];

  const [workspaces, setWorkspaces] = useState([]);
  const [activeBoardSummary, setActiveBoardSummary] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [markingNotificationId, setMarkingNotificationId] = useState(null);
  const [messageToasts, setMessageToasts] = useState([]);
  const [open, setOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [newBoard, setNewBoard] = useState("");
  const [boardModalError, setBoardModalError] = useState("");
  const [boardCategory, setBoardCategory] = useState("tasks");
  const [boardPrivacy, setBoardPrivacy] = useState("main");
  const [boardMembers, setBoardMembers] = useState([]);
  const [boardMemberSearch, setBoardMemberSearch] = useState("");
  const [boardMemberDropdownOpen, setBoardMemberDropdownOpen] = useState(false);
  const [boardImportFile, setBoardImportFile] = useState(null);
  const [boardImportName, setBoardImportName] = useState("");
  const [boardImportMode, setBoardImportMode] = useState("empty");
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [boardMenuOpenId, setBoardMenuOpenId] = useState(null);
  const [showRenameBoardModal, setShowRenameBoardModal] = useState(false);
  const [boardToRename, setBoardToRename] = useState(null);
  const [renameBoardValue, setRenameBoardValue] = useState("");

  const sidebarBoards = useMemo(() => {
    const base = Array.isArray(currentWorkspace?.boards) ? currentWorkspace.boards : [];
    if (!activeBoardSummary?._id) return base;
    if (!currentWorkspace?._id) return base;

    const sameWorkspace =
      !activeBoardSummary.workspaceId ||
      String(activeBoardSummary.workspaceId) === String(currentWorkspace._id);
    if (!sameWorkspace) return base;

    const exists = base.some(
      (board) => String(board?._id || board?.id) === String(activeBoardSummary._id),
    );
    if (exists) return base;

    return [...base, activeBoardSummary];
  }, [activeBoardSummary, currentWorkspace?._id, currentWorkspace?.boards]);
  const [showBoardAccessModal, setShowBoardAccessModal] = useState(false);
  const [boardToManageAccess, setBoardToManageAccess] = useState(null);
  const [boardAccessMembers, setBoardAccessMembers] = useState([]);
  const [boardAccessSearch, setBoardAccessSearch] = useState("");
  const [boardAccessDropdownOpen, setBoardAccessDropdownOpen] = useState(false);
  const [boardAccessError, setBoardAccessError] = useState("");
  const [boardAccessNotice, setBoardAccessNotice] = useState("");

  const canEditPrivateBoardMembers = useCallback(
    (board) => {
      if (!board?._id) return false;
      const creatorId = String(board?.createdBy?._id || board?.createdBy || "").trim();
      const currentUserId = String(currentUser?.id || "").trim();
      if (creatorId && currentUserId && creatorId === currentUserId) return true;
      return roleCanManageBoardMembers;
    },
    [currentUser?.id, roleCanManageBoardMembers],
  );

  const canEditBoardAccessMembers = useMemo(
    () => canEditPrivateBoardMembers(boardToManageAccess),
    [boardToManageAccess, canEditPrivateBoardMembers],
  );
  const [savingBoardAccess, setSavingBoardAccess] = useState(false);

  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    description: "",
    color: "#7c3aed",
    members: [],
    isActive: true,
  });

  const deferredWorkspaceSearch = useDeferredValue(workspaceSearch);
  const deferredGlobalSearch = useDeferredValue(globalSearch);

  const filteredWorkspaces = workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(deferredWorkspaceSearch.toLowerCase())
  );

  const recentWorkspaces = filteredWorkspaces.slice(0, 3);
  const myWorkspaces = filteredWorkspaces;

  const memberOptionsWithoutCurrentUser = useMemo(() => {
    const creatorTokens = new Set(toMemberTokens(currentUser));
    return (memberOptions || []).filter((member) => {
      const memberTokens = toMemberTokens(member);
      return !memberTokens.some((token) => creatorTokens.has(token));
    });
  }, [memberOptions, currentUser]);

  const workspaceBoardMemberOptions = useMemo(() => {
    const workspace = currentWorkspace || null;
    if (!workspace) return [];

    const allowedTokens = new Set();

    const ownerTokens = toMemberTokens(workspace.owner);
    ownerTokens.forEach((token) => allowedTokens.add(token));

    (Array.isArray(workspace.members) ? workspace.members : [])
      .flatMap((member) => toMemberTokens(member))
      .forEach((token) => allowedTokens.add(token));

    (Array.isArray(workspace.memberUsers) ? workspace.memberUsers : [])
      .flatMap((member) => toMemberTokens(member))
      .forEach((token) => allowedTokens.add(token));

    if (!allowedTokens.size) return [];

    const creatorTokens = new Set(toMemberTokens(currentUser));

    const filtered = (memberOptionsWithoutCurrentUser || []).filter((member) => {
      const memberTokens = toMemberTokens(member);
      const isInWorkspace = memberTokens.some((token) => allowedTokens.has(token));
      const isCreator = memberTokens.some((token) => creatorTokens.has(token));
      return isInWorkspace && !isCreator;
    });

    return filtered.sort((a, b) =>
      String(getMemberLabel(a)).localeCompare(String(getMemberLabel(b)))
    );
  }, [currentWorkspace, memberOptionsWithoutCurrentUser, currentUser]);

  const filteredBoardMemberOptions = useMemo(() => {
    const query = boardMemberSearch.trim().toLowerCase();
    if (!query) return workspaceBoardMemberOptions;
    return workspaceBoardMemberOptions.filter((member) =>
      `${member?.name || ""} ${member?.email || ""} ${member?.role || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [workspaceBoardMemberOptions, boardMemberSearch]);

  const filteredBoardAccessMemberOptions = useMemo(() => {
    const query = boardAccessSearch.trim().toLowerCase();
    if (!query) return workspaceBoardMemberOptions;
    return workspaceBoardMemberOptions.filter((member) =>
      `${member?.name || ""} ${member?.email || ""} ${member?.role || ""}`
        .toLowerCase()
        .includes(query),
    );
  }, [workspaceBoardMemberOptions, boardAccessSearch]);

  useEffect(() => {
    if (boardPrivacy !== "private") return;
    const allowedKeys = new Set(
      workspaceBoardMemberOptions.map((member) => getMemberKey(member))
    );
    setBoardMembers((prev) => {
      const next = prev.filter((member) => allowedKeys.has(getMemberKey(member)));
      if (next.length === prev.length) return prev;
      return next;
    });
  }, [boardPrivacy, currentWorkspace?._id, workspaceBoardMemberOptions]);

  const searchItems = useMemo(() => {
    if (!searchOpen && !deferredGlobalSearch.trim()) return [];
    const baseItems = [
      {
        id: "notes-root",
        label: "Notes",
        description: "Open notes board",
        href: "/dashboard/notes",
        section: "Notes",
      },
      {
        id: "tasks-root",
        label: "Tasks",
        description: "Open task manager",
        href: "/dashboard/tasks",
        section: "Tasks",
      },
      {
        id: "workspace-root",
        label: "Workspace",
        description: "Open workspace home",
        href: "/dashboard/workspace",
        section: "Workspace",
      },
    ];

    const workspaceItems = workspaces.map((workspace) => ({
      id: `workspace-${workspace._id}`,
      label: workspace.name || "Untitled workspace",
      description: workspace.description || "Workspace",
      href: `/dashboard/workspace/${workspace._id}`,
      section: "Workspace",
    }));

    const taskItems = taskIndex.map((task) => ({
      id: `task-${task._id}`,
      label: task.title || "Untitled task",
      description: `${task.status || "Todo"}${
        task.priority ? ` • ${task.priority}` : ""
      }`,
      href: "/dashboard/tasks",
      section: "Tasks",
    }));

    return [...baseItems, ...workspaceItems, ...taskItems];
  }, [taskIndex, workspaces, searchOpen, deferredGlobalSearch]);

  const filteredSearchItems = useMemo(() => {
    const query = deferredGlobalSearch.trim().toLowerCase();
    if (!query) return searchItems.slice(0, 8);

    return searchItems
      .filter((item) =>
        `${item.label} ${item.description} ${item.section}`
          .toLowerCase()
          .includes(query)
      )
      .slice(0, 10);
  }, [deferredGlobalSearch, searchItems]);

  const formatNotificationTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "success":
        return <CheckCircle size={16} className="text-green-400" />;
      case "warning":
        return <AlertTriangle size={16} className="text-yellow-400" />;
      default:
        return <Bell size={16} className="text-blue-400" />;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/auth");
    setProfileOpen(false);
  };

  const loadWorkspaces = useCallback(async ({ force = false } = {}) => {
    if (isSuperuser || !hasSubscriptionAccess || !subscriptionGateReady) return;
    if (workspacesRequestRef.current) {
      if (!force) return workspacesRequestRef.current;
      try {
        await workspacesRequestRef.current;
      } catch {
        // Ignore prior request errors and continue with a forced refresh.
      }
    }

    const request = (async () => {
      try {
        const payload = await getCachedRequest(
          "dashboard:workspaces",
          async () => {
            const res = await api.get(`${WORKSPACE_API}?view=minimal`);
            return Array.isArray(res.data) ? res.data : [];
          },
          { ttlMs: 10000, force },
        );
        setWorkspaces(payload);

        const activeWorkspace =
          payload.find((ws) => ws.isActive) || payload[0] || null;

        setCurrentWorkspace(activeWorkspace);
      } catch (error) {
        if (error?.response?.status === 402) return;
        console.error("Error loading workspaces:", error);
      } finally {
        workspacesRequestRef.current = null;
      }
    })();

    workspacesRequestRef.current = request;
    return request;
  }, [hasSubscriptionAccess, isSuperuser, subscriptionGateReady]);

  useEffect(() => {
    const match = String(pathname || "").match(/^\/dashboard\/board\/([^/?#]+)/);
    const boardId = match?.[1] || "";
    if (!boardId) {
      setActiveBoardSummary(null);
      return undefined;
    }

    const alreadyInSidebar =
      Array.isArray(currentWorkspace?.boards) &&
      currentWorkspace.boards.some(
        (board) => String(board?._id || board?.id) === String(boardId),
      );
    if (alreadyInSidebar) {
      setActiveBoardSummary(null);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(`/api/boards/${boardId}`);
        if (cancelled) return;

        const board = res?.data || {};
        const summary = {
          _id: board._id || board.id || boardId,
          name: board.name || "Board",
          privacy: board.privacy || "main",
          members: Array.isArray(board.members) ? board.members : [],
          createdBy: board.createdBy || null,
          workspaceId: board.workspace || null,
          updatedAt: board.updatedAt || null,
          createdAt: board.createdAt || null,
        };

        setActiveBoardSummary(summary);

        if (
          currentWorkspace?._id &&
          String(summary.workspaceId || "") === String(currentWorkspace._id)
        ) {
          setCurrentWorkspace((prev) => {
            if (!prev?._id) return prev;
            if (String(prev._id) !== String(summary.workspaceId || "")) return prev;
            const boards = Array.isArray(prev.boards) ? prev.boards : [];
            const exists = boards.some(
              (item) => String(item?._id || item?.id) === String(summary._id),
            );
            if (exists) return prev;
            return { ...prev, boards: [...boards, summary] };
          });

          setWorkspaces((prev) =>
            (Array.isArray(prev) ? prev : []).map((workspace) => {
              if (String(workspace?._id) !== String(summary.workspaceId || "")) return workspace;
              const boards = Array.isArray(workspace?.boards) ? workspace.boards : [];
              const exists = boards.some(
                (item) => String(item?._id || item?.id) === String(summary._id),
              );
              if (exists) return workspace;
              return { ...workspace, boards: [...boards, summary] };
            }),
          );
        }
      } catch {
        // Keep sidebar stable when board summary cannot be fetched.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, currentWorkspace?._id, currentWorkspace?.boards]);

  const loadTaskIndex = useCallback(async ({ force = false } = {}) => {
    if (isSuperuser || !hasSubscriptionAccess || !subscriptionGateReady) return;
    try {
      const taskData = await getCachedRequest(
        "dashboard:tasks",
        async () => {
          const res = await api.get("/api/tasks");
          return Array.isArray(res.data) ? res.data : [];
        },
        { ttlMs: 10000, force },
      );
      setTaskIndex(taskData);
    } catch (error) {
      if (error?.response?.status === 403 || error?.response?.status === 402) {
        setTaskIndex([]);
        return;
      }
      console.error("Error loading tasks search index:", error);
    }
  }, [hasSubscriptionAccess, isSuperuser, subscriptionGateReady]);

  const loadMemberOptions = useCallback(async () => {
    try {
      const users = await listDirectoryUsers();
      setMemberOptions(users);
    } catch (error) {
      if (error?.response?.status === 402) return;
      console.error("Error loading users directory:", error);
      setMemberOptions([]);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (isSuperuser || !hasSubscriptionAccess || !subscriptionGateReady) return;
    try {
      setNotificationsLoading(true);
      setNotificationsError("");

      const notificationData = await getCachedRequest(
        "dashboard:notifications",
        async () => {
          const res = await api.get("/api/notifications");
          return Array.isArray(res.data) ? res.data : [];
        },
        { ttlMs: 3000 },
      );
      setNotifications(notificationData);
    } catch (error) {
      if (error?.response?.status === 402) return;
      console.error("Error loading notifications:", error);
      setNotificationsError(
        error?.response?.data?.message || "Failed to load notifications"
      );
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }, [hasSubscriptionAccess, isSuperuser, subscriptionGateReady]);

  const audioUnlockedRef = useRef(false);
  const lastSoundAtRef = useRef(0);

  useEffect(() => {
    const unlockAudio = () => {
      audioUnlockedRef.current = true;
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    if (!audioUnlockedRef.current || typeof window === "undefined") return;
    const now = Date.now();
    if (now - lastSoundAtRef.current < 800) return;
    lastSoundAtRef.current = now;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.25);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.3);
      oscillator.onended = () => {
        context.close();
      };
    } catch {
      // Ignore audio errors (autoplay restrictions, etc.)
    }
  }, []);

  const pushMessageToast = useCallback((payload) => {
    if (!payload) return;
    setMessageToasts((prev) => {
      if (prev.some((item) => item.id === payload.id)) return prev;
      return [payload];
    });
    window.setTimeout(() => {
      setMessageToasts((prev) => prev.filter((item) => item.id !== payload.id));
    }, 6000);
  }, []);

  const openChatFromToast = useCallback(
    (toast) => {
      if (!toast) return;
      try {
        const type = toast.type === "channel" ? "channel" : "direct";
        const id =
          type === "channel"
            ? toast?.raw?.id || toast?.raw?.channelId
            : toast?.raw?.conversationId || toast?.raw?.id;
        if (id) {
          localStorage.setItem(
            "nexora_chat_open",
            JSON.stringify({ type, id })
          );
        }
      } catch {
        // ignore storage errors
      }
      router.push("/dashboard/chat");
    },
    [router]
  );

  const handleGlobalMessage = useCallback(
    (incoming) => {
      if (isSuperuser) return;
      const msg = normalizeMessage(incoming);
      if (!msg?.conversationKey) return;
      const isOwn = String(msg.senderId) === String(currentUser?.id || "");
      if (isOwn) return;

      const preview = msg.contentText || "Sent a message";
      const channelName =
        incoming?.channelName ||
        incoming?.channel?.name ||
        incoming?.channelId?.name ||
        "channel";
      const dmName =
        incoming?.conversationName ||
        incoming?.directName ||
        msg.senderName ||
        "Direct message";

      const toast =
        msg.conversationType === "channel"
          ? {
              id: msg.id,
              type: "channel",
              raw: { id: msg.channelId, name: channelName },
              sender: msg.senderName || "User",
              title: `# ${channelName}`,
              preview,
            }
          : {
              id: msg.id,
              type: "direct",
              raw: { conversationId: msg.conversationId, name: dmName },
              sender: msg.senderName || dmName,
              title: dmName,
              preview,
            };

      pushMessageToast(toast);
      loadNotifications();
      playNotificationSound();
    },
    [
      currentUser?.id,
      isSuperuser,
      loadNotifications,
      playNotificationSound,
      pushMessageToast,
    ]
  );

  useChatSocket({
    enabled: !isSuperuser,
    onMessageNew: handleGlobalMessage,
  });

  const deleteNotification = async (id) => {
    try {
      setMarkingNotificationId(id);
      await api.delete(`/api/notifications/${id}`);
      invalidateRequestCache("dashboard:notifications");
      setNotifications((prev) =>
        prev.filter(
          (notification) => (notification._id || notification.id) !== id
        )
      );
    } catch (error) {
      console.error("Error deleting notification:", error);
      setNotificationsError(
        error?.response?.data?.message || "Failed to delete notification"
      );
    } finally {
      setMarkingNotificationId(null);
    }
  };

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await api.put("/api/notifications/read-all");
      invalidateRequestCache("dashboard:notifications");
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, []);

  const handleToggleNotifications = useCallback(async () => {
    setShowNotifications((prev) => !prev);
    if (!showNotifications) {
      await loadNotifications();
      await markAllNotificationsRead();
    } else {
      setNotifications([]);
    }
  }, [loadNotifications, markAllNotificationsRead, showNotifications]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/auth");
      return;
    }

    const init = async () => {
      if (isSuperuser) {
        return;
      }
      if (!subscriptionGateReady || !hasSubscriptionAccess) {
        return;
      }
      await Promise.all([
        loadWorkspaces(),
        loadTaskIndex(),
        loadNotifications(),
      ]);
    };

    init();
  }, [
    loadNotifications,
    loadTaskIndex,
    loadWorkspaces,
    router,
    isSuperuser,
    hasSubscriptionAccess,
    subscriptionGateReady,
  ]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || isSuperuser) return;
    loadMemberOptions();
  }, [isSuperuser, loadMemberOptions]);

  useEffect(() => {
    if (isSuperuser) return;
    if (!subscriptionStatus) return;
    if (!["expired", "suspended"].includes(subscriptionStatus)) return;
    const allowedPaths = ["/dashboard/subscription-required", "/dashboard/subscription"];
    if (allowedPaths.some((path) => pathname.startsWith(path))) return;
    router.replace("/dashboard/subscription-required");
  }, [isSuperuser, pathname, router, subscriptionStatus]);

  useEffect(() => {
    if (isSuperuser) return;
    if (!pathname.startsWith("/dashboard/subscription-required")) return;
    if (hasSubscriptionAccess) {
      router.replace("/dashboard");
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await getCachedRequest(
          "auth:me",
          async () => ({ data: (await api.get("/api/auth/me")).data }),
          { ttlMs: 5000, force: true },
        );
        const nextSubscription =
          res?.data?.profile?.subscription || res?.data?.user?.subscription || null;
        if (nextSubscription) {
          setCurrentSubscription(nextSubscription);
          const nextStatus = String(
            nextSubscription?.accountStatus || nextSubscription?.status || ""
          ).toLowerCase();
          const nextHasAccess =
            nextSubscription?.hasAccess === false
              ? false
              : !["expired", "suspended"].includes(nextStatus);
          if (nextHasAccess) {
            router.replace("/dashboard");
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [hasSubscriptionAccess, isSuperuser, pathname, router]);


  useEffect(() => {
    if (isSuperuser) return;
    if (!pathname.startsWith("/dashboard/workspace")) return;

    const syncWorkspaceState = async () => {
      invalidateRequestCache("dashboard:workspaces");
      await loadWorkspaces({ force: true });
    };

    syncWorkspaceState();
  }, [loadWorkspaces, pathname, isSuperuser]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateFromSearch = (item) => {
    if (!item) return;
    setSearchOpen(false);
    setGlobalSearch("");
    router.push(item.href);
  };

  const createWorkspace = async () => {
    if (!newWorkspace.name.trim()) return;

    const loadingStart = Date.now();
    try {
      setCreatingWorkspace(true);
      const res = await api.post(WORKSPACE_API, {
        name: newWorkspace.name.trim(),
        description: newWorkspace.description.trim(),
        color: newWorkspace.color,
        owner: currentUser.name || "User",
        members: newWorkspace.members,
        isActive: newWorkspace.isActive,
      });

      invalidateRequestCache("dashboard:workspaces");

      await loadWorkspaces({ force: true });
      setCurrentWorkspace(res.data);

      setNewWorkspace({
        name: "",
        description: "",
        color: "#7c3aed",
        members: [],
        isActive: true,
      });

      setShowCreateModal(false);
      router.push(`/dashboard/workspace/${res.data._id}`);
    } catch (error) {
      console.error("Error creating workspace:", error);
    } finally {
      const elapsed = Date.now() - loadingStart;
      const minVisibleMs = 350;
      if (elapsed < minVisibleMs) {
        await new Promise((resolve) => setTimeout(resolve, minVisibleMs - elapsed));
      }
      setCreatingWorkspace(false);
    }
  };

  const getBoardFromPayload = (payload) => payload?.board || payload;

  const ensureBoardHasStarterItem = async (createdBoard) => {
    if (!createdBoard?._id) return createdBoard;

    let nextBoard = createdBoard;

    if (!nextBoard.groups?.length) {
      const groupRes = await api.post(`/api/boards/${createdBoard._id}/groups`, {
        title: "New Group",
      });
      nextBoard = getBoardFromPayload(groupRes.data) || nextBoard;
    }

    const firstGroup = nextBoard.groups?.[0];
    if (firstGroup && !firstGroup.tasks?.length) {
      const taskRes = await api.post(
        `/api/boards/${createdBoard._id}/groups/${firstGroup._id}/tasks`,
        { name: "New Item" },
      );
      nextBoard = getBoardFromPayload(taskRes.data) || nextBoard;
    }

    return nextBoard;
  };

  const readFileText = (file) =>
    new Promise((resolve, reject) => {
      if (!file) return resolve("");
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsText(file);
    });

  const parseCsvText = (text) => {
    const rows = [];
    let current = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === "\"") {
        if (inQuotes && nextChar === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        row.push(current);
        current = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") {
          i += 1;
        }
        row.push(current);
        rows.push(row);
        row = [];
        current = "";
      } else {
        current += char;
      }
    }

    if (current.length || row.length) {
      row.push(current);
      rows.push(row);
    }

    return rows;
  };

  const buildImportPayloadFromCsv = (csvText) => {
    const parsedRows = parseCsvText(csvText || "");
    if (!parsedRows.length) return null;

    const rawHeaders = parsedRows[0] || [];
    const headerMap = new Map();
    const headers = rawHeaders.map((header, index) => {
      const base = String(header || "").trim() || `Column ${index + 1}`;
      const key = base.toLowerCase();
      const count = headerMap.get(key) || 0;
      headerMap.set(key, count + 1);
      return count ? `${base} (${count + 1})` : base;
    });

    const normalized = (value) => String(value || "").trim();
    const lower = (value) => normalized(value).toLowerCase();

    const nameHeader =
      headers.find((header) =>
        ["name", "item", "task", "title"].includes(lower(header))
      ) || null;
    const groupHeader =
      headers.find((header) =>
        ["group", "section", "lane"].includes(lower(header))
      ) || null;

    const valueHeaders = headers.filter(
      (header) => header !== nameHeader && header !== groupHeader
    );

    const dataRows = parsedRows
      .slice(1)
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some((cell) => cell !== ""));

    if (!dataRows.length) return null;

    const detectType = (header, values) => {
      const headerKey = lower(header);
      if (headerKey.includes("status")) return "status";
      if (headerKey.includes("date") || headerKey.includes("due")) return "date";
      const numericValues = values.filter((value) => value !== "");
      if (
        numericValues.length &&
        numericValues.every((value) => Number.isFinite(Number(value)))
      ) {
        return "numbers";
      }
      return "text";
    };

    const columns = valueHeaders.map((header, index) => {
      const values = dataRows.map((row) => row[headers.indexOf(header)] || "");
      const type = detectType(header, values);
      const options =
        type === "status"
          ? [...new Set(values.map(normalized).filter(Boolean))]
          : [];
      return {
        name: header || `Column ${index + 1}`,
        type,
        options,
      };
    });

    const rows = dataRows.map((row, index) => {
      const values = {};
      valueHeaders.forEach((header) => {
        const columnIndex = headers.indexOf(header);
        values[header] = row[columnIndex] ?? "";
      });

      const nameIndex = nameHeader ? headers.indexOf(nameHeader) : -1;
      const groupIndex = groupHeader ? headers.indexOf(groupHeader) : -1;

      return {
        name: nameIndex >= 0 ? row[nameIndex] : "",
        group: groupIndex >= 0 ? row[groupIndex] : "",
        values,
        rowIndex: index + 1,
      };
    });

    return { columns, rows };
  };

  const buildImportPayloadFromFile = async (file) => {
    const fileName = String(file?.name || "").toLowerCase().trim();
    if (!fileName) return null;

    if (fileName.endsWith(".csv")) {
      const csvText = await readFileText(file);
      return buildImportPayloadFromCsv(csvText);
    }

    throw new Error("Unsupported file format. Use CSV.");
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

    const createBoard = async () => {
      if (!currentWorkspace?._id) {
        setBoardModalError("Please select a workspace before creating a board.");
        return;
      }

      if (!newBoard.trim()) {
        setBoardModalError("Board name is required.");
        return;
      }

      const loadingStart = Date.now();
      try {
        setCreatingBoard(true);
        setBoardModalError("");
        const memberIds = boardMembers
          .map((member) => member?.id || member?._id || member?.email || member?.name)
          .filter(Boolean);

      const res = await api.post("/api/boards", {
        name: newBoard.trim(),
        workspaceId: currentWorkspace._id,
        category: boardCategory,
        boardCategory,
        privacy: boardPrivacy,
        members: boardPrivacy === "private" ? memberIds : [],
      });

      let createdBoard = res.data;

      if (boardImportMode === "import" && boardImportFile) {
        try {
          const payload = await buildImportPayloadFromFile(boardImportFile);
          if (payload) {
            await api.post(`/api/boards/${createdBoard._id}/import`, payload);
            const refreshed = await api.get(`/api/boards/${createdBoard._id}`);
            createdBoard = refreshed.data || createdBoard;
          } else {
            createdBoard = await ensureBoardHasStarterItem(createdBoard);
          }
        } catch (importError) {
          console.error("Error importing board data:", importError);
          createdBoard = await ensureBoardHasStarterItem(createdBoard);
        }
      } else {
        createdBoard = await ensureBoardHasStarterItem(createdBoard);
      }

      invalidateRequestCache("dashboard:workspaces");

      // Immediately reflect the newly created board in the sidebar list,
      // then follow up with a forced server refresh.
      setWorkspaces((prev) =>
        (Array.isArray(prev) ? prev : []).map((workspace) => {
          if (String(workspace?._id) !== String(currentWorkspace?._id)) return workspace;
          const existingBoards = Array.isArray(workspace?.boards) ? workspace.boards : [];
          const boardExists = existingBoards.some(
            (board) => String(board?._id) === String(createdBoard?._id),
          );
          return {
            ...workspace,
            boards: boardExists ? existingBoards : [...existingBoards, createdBoard],
          };
        }),
      );
      setCurrentWorkspace((prev) => {
        if (!prev || String(prev?._id) !== String(currentWorkspace?._id)) return prev;
        const existingBoards = Array.isArray(prev?.boards) ? prev.boards : [];
        const boardExists = existingBoards.some(
          (board) => String(board?._id) === String(createdBoard?._id),
        );
        return {
          ...prev,
          boards: boardExists ? existingBoards : [...existingBoards, createdBoard],
        };
      });

      await loadWorkspaces({ force: true });
      setNewBoard("");
      setBoardCategory("tasks");
      setBoardPrivacy("main");
      setBoardMembers([]);
      setBoardMemberSearch("");
      setBoardMemberDropdownOpen(false);
      setBoardImportFile(null);
      setBoardImportName("");
        setBoardImportMode("empty");
        setShowBoardModal(false);

        router.push(`/dashboard/board/${createdBoard._id}`);
      } catch (error) {
        console.error("Error creating board:", error);
        setBoardModalError(error?.response?.data?.message || "Failed to create board.");
      } finally {
        const elapsed = Date.now() - loadingStart;
        const minVisibleMs = 350;
        if (elapsed < minVisibleMs) {
          await new Promise((resolve) => setTimeout(resolve, minVisibleMs - elapsed));
        }
        setCreatingBoard(false);
      }
    };

  const closeBoardModal = () => {
    setShowBoardModal(false);
    setNewBoard("");
    setBoardModalError("");
    setBoardCategory("tasks");
    setBoardPrivacy("main");
    setBoardMembers([]);
    setBoardMemberSearch("");
    setBoardMemberDropdownOpen(false);
    setBoardImportFile(null);
    setBoardImportName("");
    setBoardImportMode("empty");
  };

  const openCreateBoardModal = useCallback((workspaceOverride = null) => {
    if (workspaceOverride && (workspaceOverride._id || workspaceOverride.id)) {
      setCurrentWorkspace(workspaceOverride);
    }
    setBoardModalError("");
    setShowBoardModal(true);
  }, []);

  useEffect(() => {
    const handleExternalCreateBoardOpen = (event) => {
      const detail = event?.detail || {};
      const eventWorkspace = detail?.workspace;
      const workspaceId = String(detail?.workspaceId || "");
      const matchedWorkspace =
        eventWorkspace && (eventWorkspace._id || eventWorkspace.id)
          ? eventWorkspace
          : (workspaces || []).find(
              (workspace) =>
                String(workspace?._id || workspace?.id) === workspaceId,
            ) || null;
      openCreateBoardModal(matchedWorkspace);
    };

    window.addEventListener("nexora:create-board-modal", handleExternalCreateBoardOpen);
    return () => {
      window.removeEventListener(
        "nexora:create-board-modal",
        handleExternalCreateBoardOpen,
      );
    };
  }, [openCreateBoardModal, workspaces]);

  const openRenameBoardModal = (board) => {
    setBoardToRename(board);
    setRenameBoardValue(board?.name || "");
    setShowRenameBoardModal(true);
    setBoardMenuOpenId(null);
  };

  const closeBoardAccessModal = useCallback(() => {
    setShowBoardAccessModal(false);
    setBoardToManageAccess(null);
    setBoardAccessMembers([]);
    setBoardAccessSearch("");
    setBoardAccessDropdownOpen(false);
    setBoardAccessError("");
    setBoardAccessNotice("");
  }, []);

  const openBoardAccessModal = useCallback(
    (board) => {
      if (!board?._id) return;

      const selected = (Array.isArray(board.members) ? board.members : [])
        .map((memberRef) => {
          const rawMember = String(memberRef || "").trim();
          if (!rawMember) return null;
          const matched = workspaceBoardMemberOptions.find((member) =>
            toMemberTokens(member).some(
              (token) => token === rawMember || token === rawMember.toLowerCase(),
            ),
          );
          return matched || null;
        })
        .filter(Boolean);

      setBoardToManageAccess(board);
      setBoardAccessMembers(selected);
      setBoardAccessSearch("");
      setBoardAccessDropdownOpen(false);
      setBoardAccessError("");
      setBoardAccessNotice("");
      setShowBoardAccessModal(true);
      setBoardMenuOpenId(null);
    },
    [workspaceBoardMemberOptions],
  );

  const handleRenameBoard = async () => {
    const nextName = renameBoardValue.trim();
    if (!boardToRename?._id || !nextName) return;

    try {
      await api.put(`/api/boards/${boardToRename._id}`, { name: nextName });
      invalidateRequestCache("dashboard:workspaces");
      await loadWorkspaces({ force: true });
      setShowRenameBoardModal(false);
      setBoardToRename(null);
      setRenameBoardValue("");
    } catch (error) {
      console.error("Error renaming board:", error);
    }
  };

  const handleDeleteBoard = async (board) => {
    if (!board?._id) return;

    try {
      const res = await api.delete(`/api/boards/${board._id}`);
      const workspaceId = res.data?.workspaceId || currentWorkspace?._id;

      invalidateRequestCache("dashboard:workspaces");

      await loadWorkspaces({ force: true });
      setBoardMenuOpenId(null);

      if (pathname === `/dashboard/board/${board._id}`) {
        router.push(
          workspaceId ? `/dashboard/workspace/${workspaceId}` : "/dashboard/workspace",
        );
      }
    } catch (error) {
      console.error("Error deleting board:", error);
    }
  };

  const handleSaveBoardAccess = useCallback(async () => {
    if (!boardToManageAccess?._id) return;
    if (!canEditBoardAccessMembers) {
      setBoardAccessError("You do not have permission to update board members.");
      return;
    }

    const memberIds = boardAccessMembers
      .map((member) =>
        String(
          member?._id || member?.id || member?.email || member?.name || "",
        ).trim(),
      )
      .filter(Boolean);

    try {
      setSavingBoardAccess(true);
      setBoardAccessError("");
      setBoardAccessNotice("");
      await api.patch(`/api/boards/${boardToManageAccess._id}/access`, {
        privacy: "private",
        members: memberIds,
      });
      invalidateRequestCache("dashboard:workspaces");
      await loadWorkspaces({ force: true });
      closeBoardAccessModal();
    } catch (error) {
      console.error("Error updating private board members:", error);
      setBoardAccessError(
        error?.response?.data?.message || "Failed to update board members.",
      );
    } finally {
      setSavingBoardAccess(false);
    }
  }, [
    boardAccessMembers,
    boardToManageAccess,
    canEditBoardAccessMembers,
    closeBoardAccessModal,
    loadWorkspaces,
  ]);

  const handleRemoveBoardAccessMember = useCallback(
    (memberToRemove) => {
      if (!canEditBoardAccessMembers) {
        setBoardAccessError("You do not have permission to remove members.");
        return;
      }
      setBoardAccessMembers((prev) =>
        prev.filter(
          (current) => getMemberKey(current) !== getMemberKey(memberToRemove),
        ),
      );
      setBoardAccessError("");
      setBoardAccessNotice(
        `${getMemberLabel(memberToRemove)} removed. Click "Save members" to apply.`,
      );
    },
    [canEditBoardAccessMembers],
  );

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#0b1120] via-[#0f172a] to-[#020617] text-white">
        <>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] lg:hidden"
              >
                <div
                  className="absolute inset-0 bg-black/60"
                  onClick={() => setSidebarOpen(false)}
                />

                <motion.div
                  initial={{ x: -300 }}
                  animate={{ x: 0 }}
                  exit={{ x: -300 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="absolute left-0 top-0 flex h-full w-[234px] flex-col overflow-hidden border-r border-gray-800 bg-[#111827]"
                >
                  <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-4">
                    <div className="mb-8">
                      <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
                        NEXORA
                      </h1>
                      <p className="text-gray-400 text-sm mt-1">
                        Enterprise Workspace Suite
                      </p>
                    </div>

                    <nav className="space-y-2.5">
                      {links.map((link, index) => {
                        const Icon = link.icon;
                        const isActive = pathname === link.href;

                        return (
                          <Link
                            key={index}
                            href={link.href}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <div
                              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
                                isActive
                                  ? "bg-gradient-to-r from-indigo-600 to-purple-600"
                                  : "hover:bg-gray-800 text-gray-300"
                              }`}
                            >
                              <Icon size={18} />
                              <span>{link.name}</span>
                            </div>
                          </Link>
                        );
                      })}
                    </nav>

                    {!canAccessAdminPanel && (
                      <>
                        <div className="mt-6 relative">
                          <button
                            onClick={() => setOpen((prev) => !prev)}
                            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#1e293b]/70 border border-gray-700 hover:border-indigo-500 transition"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {currentWorkspace?.name?.charAt(0)?.toUpperCase() || "W"}
                              </div>

                              <span className="text-[13px] font-medium text-gray-300 truncate">
                                {currentWorkspace ? currentWorkspace.name : "Workspace"}
                              </span>
                            </div>

                            <ChevronDown
                              size={16}
                              className={`text-gray-400 transition ${
                                open ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          <AnimatePresence>
                            {open && (
                              <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="mt-2 overflow-hidden rounded-2xl border border-gray-700 bg-[#0f172a] shadow-2xl"
                              >
                                <div className="border-b border-gray-800 p-3">
                                  <div className="relative">
                                    <Search
                                      size={13}
                                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                                    />
                                    <input
                                      type="text"
                                      value={workspaceSearch}
                                      onChange={(e) => setWorkspaceSearch(e.target.value)}
                                      placeholder="Search workspace"
                                      className="w-full rounded-lg border border-gray-700 bg-[#111827] py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                </div>

                            <div className="max-h-60 overflow-y-auto p-2">
                              <p className="px-2 pb-1 text-[11px] text-gray-500">
                                Workspaces
                              </p>

                              <div className="space-y-1">
                                {myWorkspaces.length > 0 ? (
                                  myWorkspaces.map((workspace) => (
                                    <button
                                      key={`mobile-workspace-${workspace._id}`}
                                      onClick={async () => {
                                        try {
                                          await api.patch(
                                            `${WORKSPACE_API}/${workspace._id}/activate`,
                                          );
                                          invalidateRequestCache("dashboard:workspaces");
                                          await loadWorkspaces({ force: true });
                                          setCurrentWorkspace(workspace);
                                          setOpen(false);
                                          setSidebarOpen(false);
                                          router.push(`/dashboard/workspace/${workspace._id}`);
                                        } catch (error) {
                                          console.error("Error activating workspace:", error);
                                        }
                                      }}
                                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                                        currentWorkspace?._id === workspace._id
                                          ? "border border-indigo-500/30 bg-indigo-500/15"
                                          : "hover:bg-[#1f2937]"
                                      }`}
                                    >
                                      <div
                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                                        style={{
                                          backgroundColor: workspace.color || "#7c3aed",
                                        }}
                                      >
                                        {workspace.name?.charAt(0)?.toUpperCase() || "W"}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-medium text-white">
                                          {workspace.name}
                                        </p>
                                        <p className="truncate text-[10px] leading-3 text-gray-500">
                                          {getOwnerLabel(workspace.owner)}
                                        </p>
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <p className="px-2 py-2 text-xs text-gray-500">
                                    No workspaces found
                                  </p>
                                )}
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setOpen(false);
                                setSidebarOpen(false);
                                setShowCreateModal(true);
                              }}
                              className="flex w-full items-center gap-2 border-t border-gray-800 px-4 py-3 text-left text-xs text-indigo-300 transition hover:bg-[#1f2937]"
                            >
                              <Plus size={13} />
                              Add workspace
                            </button>
                          </motion.div>
                        )}
          </AnimatePresence>
                    </div>

                    <div className="mt-6">
                      <p className="mb-2 px-2 text-xs uppercase tracking-[0.16em] text-gray-500">
                        Boards
                      </p>

                      {!currentWorkspace ? (
                        <p className="rounded-xl border border-dashed border-gray-700 px-3 py-3 text-sm text-gray-500">
                          Select or create a workspace to see boards.
                        </p>
                      ) : currentWorkspace?.boards?.length ? (
                        <div className="space-y-1">
                          {currentWorkspace.boards.map((board) => (
                            <div
                              key={board._id}
                              className={`group flex items-center gap-2 rounded-lg px-2 py-1 transition ${
                                pathname === `/dashboard/board/${board._id}`
                                  ? "border border-indigo-500/20 bg-indigo-500/10"
                                  : "hover:bg-gray-800/60"
                              }`}
                            >
                              <Link
                                href={`/dashboard/board/${board._id}`}
                                onClick={() => setSidebarOpen(false)}
                                className={`workspace-board-item block min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-sm transition ${
                                  pathname === `/dashboard/board/${board._id}`
                                    ? "workspace-board-item-active text-white"
                                    : "text-gray-300 hover:text-white"
                                }`}
                              >
                                {board.name}
                              </Link>

                              <div className="relative shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setBoardMenuOpenId((prev) =>
                                      prev === board._id ? null : board._id,
                                    );
                                  }}
                                  className="rounded-md border border-transparent p-1.5 text-gray-400 transition hover:border-gray-700 hover:bg-[#1f2937] hover:text-white"
                                  aria-label={`Board actions for ${board.name}`}
                                >
                                  <MoreVertical size={14} />
                                </button>

                                {boardMenuOpenId === board._id && (
                                  <div className="absolute right-0 z-40 mt-2 w-44 overflow-hidden rounded-xl border border-gray-700 bg-[#111827] shadow-2xl">
                                    <button
                                      onClick={() => {
                                        openRenameBoardModal(board);
                                        setSidebarOpen(false);
                                      }}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-[#1f2937]"
                                    >
                                      <Pencil size={14} className="text-yellow-400" />
                                      Rename board
                                    </button>

                                    {String(board?.privacy || "") === "private" && (
                                      <button
                                        onClick={() => {
                                          openBoardAccessModal(board);
                                          setSidebarOpen(false);
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-[#1f2937]"
                                      >
                                        <ShieldCheck size={14} className="text-indigo-300" />
                                        Manage members
                                      </button>
                                    )}

                                    <button
                                      onClick={() => {
                                        handleDeleteBoard(board);
                                        setSidebarOpen(false);
                                      }}
                                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-300 transition hover:bg-[#1f2937]"
                                    >
                                      <Trash2 size={14} />
                                      Delete board
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-gray-700 px-3 py-3 text-sm text-gray-500">
                          No boards in this workspace yet.
                        </p>
                      )}

                      {currentWorkspace ? (
                        <button
                          onClick={() => {
                            setSidebarOpen(false);
                            setShowBoardModal(true);
                          }}
                          className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-indigo-400 hover:bg-gray-800/60"
                        >
                          + Create Board
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </div>

              <div className="m-4 mt-0 flex shrink-0 items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#1e293b]/70 p-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-sm font-bold">
                    {userInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{currentUser.name}</p>
                    {!canAccessAdminPanel && (
                      <p className="text-[11px] text-gray-400 truncate">
                        Active: {currentWorkspace?.name}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-[11px] text-red-400 hover:text-red-300"
                >
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.aside
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex fixed left-0 top-0 h-screen w-[234px] bg-[#111827]/80 backdrop-blur-xl border-r border-gray-800 p-5 flex-col z-40"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-10">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
              NEXORA
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Enterprise Workspace Suite
            </p>
          </div>

          <nav className="space-y-3">
            {links.map((link, index) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={index}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                >
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                      isActive
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600"
                        : "hover:bg-gray-800 text-gray-300"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{link.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          {!canAccessAdminPanel && (
          <div className="mt-6 relative">
            <button
              onClick={() => setOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#1e293b]/70 border border-gray-700 hover:border-indigo-500 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {currentWorkspace?.name?.charAt(0)?.toUpperCase() || "W"}
                </div>

                <span className="text-sm font-medium text-gray-300 truncate">
                  {currentWorkspace ? currentWorkspace.name : "Workspace"}
                </span>
              </div>

              <ChevronDown
                size={16}
                className={`text-gray-400 transition ${open ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.98 }}
                  className="absolute mt-2 w-full bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50"
                >
                  <div className="p-3 border-b border-gray-800">
                    <div className="relative">
                      <Search
                        size={13}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        type="text"
                        value={workspaceSearch}
                        onChange={(e) => setWorkspaceSearch(e.target.value)}
                        placeholder="Search for a workspace"
                        className="w-full rounded-lg border border-gray-700 bg-[#0f172a] py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-[26rem] overflow-y-auto">
                    <div className="px-2.5 pt-2 pb-1.5">
                      <p className="mb-1.5 text-[11px] text-gray-500">Recent workspaces</p>

                      <div className="space-y-0.5">
                        {recentWorkspaces.length > 0 ? (
                          recentWorkspaces.map((workspace) => (
                            <button
                              key={`recent-${workspace._id}`}
                              onClick={async () => {
                                try {
                                  await api.patch(
                                    `${WORKSPACE_API}/${workspace._id}/activate`
                                  );
                                  invalidateRequestCache("dashboard:workspaces");
                                  await loadWorkspaces({ force: true });
                                  setCurrentWorkspace(workspace);
                                  setOpen(false);
                                  router.push(`/dashboard/workspace/${workspace._id}`);
                                } catch (error) {
                                  console.error("Error activating workspace:", error);
                                }
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition ${
                                currentWorkspace?._id === workspace._id
                                  ? "bg-indigo-500/15 border border-indigo-500/30"
                                  : "hover:bg-[#1f2937]"
                              }`}
                            >
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                                style={{
                                  backgroundColor: workspace.color || "#7c3aed",
                                }}
                              >
                                {workspace.name?.charAt(0)?.toUpperCase() || "W"}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-white">
                                  {workspace.name}
                                </p>
                              </div>

                              {currentWorkspace?._id === workspace._id && (
                                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                              )}
                            </button>
                          ))
                        ) : (
                          <p className="px-2.5 py-1.5 text-xs text-gray-500">
                            No recent workspaces
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="px-2.5 pt-1.5 pb-2">
                      <p className="mb-1.5 text-[11px] text-gray-500">My workspaces</p>

                      <div className="space-y-0.5">
                        {myWorkspaces.length > 0 ? (
                          myWorkspaces.map((workspace) => (
                            <button
                              key={`all-${workspace._id}`}
                              onClick={async () => {
                                try {
                                  await api.patch(
                                    `${WORKSPACE_API}/${workspace._id}/activate`
                                  );
                                  invalidateRequestCache("dashboard:workspaces");
                                  await loadWorkspaces({ force: true });
                                  setCurrentWorkspace(workspace);
                                  setOpen(false);
                                  router.push(`/dashboard/workspace/${workspace._id}`);
                                } catch (error) {
                                  console.error("Error activating workspace:", error);
                                }
                              }}
                              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition ${
                                currentWorkspace?._id === workspace._id
                                  ? "bg-indigo-500/15 border border-indigo-500/30"
                                  : "hover:bg-[#1f2937]"
                              }`}
                            >
                              <div
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                                style={{
                                  backgroundColor: workspace.color || "#7c3aed",
                                }}
                              >
                                {workspace.name?.charAt(0)?.toUpperCase() || "W"}
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-white">
                                  {workspace.name}
                                </p>
                                <p className="truncate text-[10px] leading-3 text-gray-500">
                                  {getOwnerLabel(workspace.owner)}
                                </p>
                              </div>

                              {currentWorkspace?._id === workspace._id && (
                                <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                              )}
                            </button>
                          ))
                        ) : (
                          <p className="px-2.5 py-1.5 text-xs text-gray-500">
                            No workspaces found
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-gray-800 px-2.5 py-2">
                    <button
                      onClick={() => {
                        setOpen(false);
                        setShowCreateModal(true);
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-indigo-400 transition hover:bg-[#1f2937]"
                    >
                      <Plus size={13} />
                      Add workspace
                    </button>

                    <button
                      onClick={() => {
                        setOpen(false);
                        router.push("/dashboard/workspace");
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 transition hover:bg-[#1f2937]"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}

          {!canAccessAdminPanel && (
            <div className="mt-6 flex min-h-0 flex-1 flex-col">
              <p className="text-xs text-gray-500 uppercase mb-2 px-2">Boards</p>

              {!currentWorkspace && (
                <p className="text-gray-500 text-sm px-2">
                  Create a workspace to start
                </p>
              )}

              {currentWorkspace && (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                      {sidebarBoards.map((board) => (
                        <div
                          key={board._id}
                          className={`group flex items-center gap-2 rounded-lg px-2 py-1 transition ${
                            pathname === `/dashboard/board/${board._id}`
                              ? "bg-indigo-500/10 border border-indigo-500/20"
                              : "hover:bg-gray-800/60"
                          }`}
                        >
                          <Link
                            href={`/dashboard/board/${board._id}`}
                            className="workspace-board-item flex-1 truncate px-1 py-1 text-sm text-gray-300"
                          >
                            {board.name}
                          </Link>

                        <div className="relative shrink-0">
                          <button
                            onClick={() =>
                              setBoardMenuOpenId((prev) =>
                                prev === board._id ? null : board._id,
                              )
                            }
                            className="rounded-md border border-transparent p-1.5 text-gray-400 transition hover:border-gray-700 hover:bg-[#1f2937] hover:text-white"
                            aria-label={`Board actions for ${board.name}`}
                          >
                            <MoreVertical size={14} />
                          </button>

                          {boardMenuOpenId === board._id && (
                            <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-gray-700 bg-[#111827] shadow-2xl">
                              <button
                                onClick={() => openRenameBoardModal(board)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-[#1f2937]"
                              >
                                <Pencil size={14} className="text-yellow-400" />
                                Rename board
                              </button>

                              {String(board?.privacy || "") === "private" &&
                                canEditPrivateBoardMembers(board) && (
                                <button
                                  onClick={() => openBoardAccessModal(board)}
                                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-[#1f2937]"
                                >
                                  <ShieldCheck size={14} className="text-indigo-300" />
                                  Manage members
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteBoard(board)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-red-300 transition hover:bg-[#1f2937]"
                              >
                                <Trash2 size={14} />
                                Delete board
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowBoardModal(true)}
                    className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-indigo-400 hover:bg-gray-800/60"
                  >
                    + Create Board
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 bg-[#1e293b]/70 border border-gray-800 p-4 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center font-bold">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              {!canAccessAdminPanel && (
                <p className="text-xs text-gray-400 truncate">
                  Active: {currentWorkspace?.name}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Logout
          </button>
        </div>
      </motion.aside>

      <div className="flex flex-col flex-1 min-w-0 lg:ml-[234px]">
        <div className="h-16 bg-[#111827]/80 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-4 md:px-6 relative z-40">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
              <Menu size={22} />
            </button>

            {!isSuperuser && (
            <div ref={searchRef} className="relative w-full min-w-0 max-w-[560px] sm:min-w-[260px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setSearchOpen(true);
                  setSearchActiveIndex(0);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(e) => {
                  if (!filteredSearchItems.length) return;

                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSearchActiveIndex((prev) =>
                      prev === filteredSearchItems.length - 1 ? 0 : prev + 1
                    );
                  }

                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSearchActiveIndex((prev) =>
                      prev === 0 ? filteredSearchItems.length - 1 : prev - 1
                    );
                  }

                  if (e.key === "Enter") {
                    e.preventDefault();
                    navigateFromSearch(filteredSearchItems[searchActiveIndex]);
                  }

                  if (e.key === "Escape") {
                    setSearchOpen(false);
                  }
                }}
                placeholder='Search "notes", "tasks", "workspace".'
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-[#0b1220] border border-gray-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
              />

              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    className="absolute mt-2 w-full min-w-0 sm:min-w-[300px] max-w-[520px] bg-[#111827] border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-[9999]"
                  >
                    <div className="px-3 py-2 border-b border-gray-800 text-xs text-gray-400 flex items-center justify-between">
                      <span>Search</span>
                      <span className="text-gray-500">Enter to open</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {filteredSearchItems.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-gray-400">
                          No results for &quot;{globalSearch}&quot;
                        </p>
                      ) : (
                        filteredSearchItems.map((item, idx) => (
                          <button
                            key={item.id}
                            onClick={() => navigateFromSearch(item)}
                            className={`w-full px-3 py-3 text-left transition border-b border-gray-800/60 last:border-b-0 ${
                              idx === searchActiveIndex
                                ? "bg-indigo-500/15"
                                : "hover:bg-[#1f2937]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm text-white truncate">
                                {item.label}
                              </p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full border border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
                                {item.section}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 truncate mt-1">
                              {item.description}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/*
              Top-right controls need to adapt to light/dark themes to avoid washed
              out icons on light surfaces.
            */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              className={`rounded-xl border p-2 transition ${
                theme === "light"
                  ? "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-slate-50"
                  : "border-gray-700/80 bg-[#101827] text-gray-300 hover:border-indigo-500/60 hover:bg-[#1e293b]"
              }`}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {!isSuperuser && (
              <div className="relative">
                <button
                  onClick={handleToggleNotifications}
                  className={`relative rounded-xl border p-2 transition ${
                    theme === "light"
                      ? "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-slate-50"
                      : "border-gray-700/80 bg-[#101827] text-gray-300 hover:border-indigo-500/60 hover:bg-[#1e293b]"
                  }`}
                >
                  <Bell size={18} className={theme === "light" ? "text-slate-600" : "text-gray-300"} />

                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                      {notifications.length}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-3 w-80 bg-[#111827] border border-gray-800 rounded-xl shadow-xl overflow-hidden z-[9999]"
                    >
                      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                        <span className="font-semibold">Notifications</span>
                        <button
                          onClick={loadNotifications}
                          disabled={notificationsLoading}
                          className="text-gray-400 hover:text-white disabled:opacity-50"
                        >
                          <RefreshCw
                            size={15}
                            className={notificationsLoading ? "animate-spin" : ""}
                          />
                        </button>
                      </div>

                      {notificationsError && (
                        <div className="px-4 py-3 text-sm text-red-300 bg-red-500/10 border-b border-red-500/20">
                          {notificationsError}
                        </div>
                      )}

                      {notificationsLoading ? (
                        <p className="p-4 text-gray-400 text-sm">
                          Loading notifications...
                        </p>
                      ) : notifications.length === 0 ? (
                        <p className="p-4 text-gray-400 text-sm">
                          No new notifications
                        </p>
                      ) : (
                        <div className="max-h-[420px] overflow-y-auto">
                          {notifications.map((note) => {
                            const noteId = note._id || note.id;

                            return (
                              <div
                                key={noteId}
                                className="flex justify-between items-center px-4 py-3 hover:bg-gray-800 transition"
                              >
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="mt-0.5 shrink-0">
                                    {getNotificationIcon(note.type)}
                                  </div>

                                  <div className="min-w-0">
                                    <p className="text-sm truncate">{note.text}</p>
                                    <span className="text-xs text-gray-400">
                                      {formatNotificationTime(
                                        note.createdAt || note.time
                                      )}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => deleteNotification(noteId)}
                                  disabled={markingNotificationId === noteId}
                                  className="text-gray-400 hover:text-red-400 disabled:opacity-50"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                )}
              </AnimatePresence>
            </div>
            )}

            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className={`flex items-center gap-2 rounded-full border px-2 py-1.5 text-xs transition ${
                  theme === "light"
                    ? "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-slate-50"
                    : "border-gray-700/80 bg-[#101827] text-gray-200 hover:border-indigo-500/60"
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-[11px] font-bold">
                  {userInitials}
                </div>

                <ChevronDown
                  size={14}
                  className={`hidden sm:block text-gray-400 transition ${
                    profileOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-3 w-64 bg-[#111827] border border-gray-800 rounded-xl shadow-xl overflow-hidden z-[9999]"
                  >
                    <div className="px-4 py-3 border-b border-gray-800">
                      <p className="text-sm font-semibold truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {currentUser.email || "No email"}
                      </p>
                    </div>

                    {!isSuperuser && (
                      <button
                        onClick={() => {
                          router.push("/dashboard/profile");
                          setProfileOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-[#1f2937]"
                      >
                        <Settings size={16} />
                        Settings
                      </button>
                    )}

                    {canAccessSubscription && (
                      <button
                        onClick={() => {
                          router.push("/dashboard/subscription");
                          setProfileOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-[#1f2937]"
                      >
                        <CreditCard size={16} />
                        Subscription
                      </button>
                    )}

                    {canAccessAdminPanel ? (
                      <button
                        onClick={() => {
                          router.push("/dashboard/admin-panel");
                          setProfileOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-[#1f2937]"
                      >
                        <ShieldCheck size={16} />
                        Admin Panel
                      </button>
                    ) : null}

                    {canManageSubscriptions ? (
                      <button
                        onClick={() => {
                          router.push("/dashboard/admin/subscriptions");
                          setProfileOpen(false);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm hover:bg-[#1f2937]"
                      >
                        <ShieldCheck size={16} />
                        Admin Billing
                      </button>
                    ) : null}

                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-[#1f2937]"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <main className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col overflow-y-auto bg-gradient-to-br from-[#0b1120] via-[#0f172a] to-[#020617]">
          {isChatPage ? (
            React.isValidElement(children)
              ? React.cloneElement(children, {
                  currentWorkspace,
                  workspaces,
                  setWorkspaces,
                  setCurrentWorkspace,
                  openCreateBoardModal,
                  currentUser,
                  memberOptions: memberOptionsWithoutCurrentUser,
                })
              : children
          ) : (
            <div className="page-shell">
              {React.isValidElement(children)
                ? React.cloneElement(children, {
                    currentWorkspace,
                    workspaces,
                    setWorkspaces,
                    setCurrentWorkspace,
                    openCreateBoardModal,
                    currentUser,
                    memberOptions: memberOptionsWithoutCurrentUser,
                  })
                : children}
            </div>
          )}
        </main>
      </div>

      {messageToasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9998] flex w-[min(320px,calc(100vw-2rem))] flex-col gap-3">
          {messageToasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-2xl border border-slate-800/70 bg-slate-950/95 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.45)] backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/40 via-sky-500/30 to-emerald-500/30 text-indigo-100">
                    <MessageCircle size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      New message
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {toast.title}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      From {toast.sender || "User"}
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-200">
                      “{toast.preview || "Sent a message"}”
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setMessageToasts((prev) => prev.filter((item) => item.id !== toast.id))
                  }
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    openChatFromToast(toast);
                    setMessageToasts((prev) => prev.filter((item) => item.id !== toast.id));
                  }}
                  className="rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs font-medium text-indigo-100 transition hover:bg-indigo-500/25"
                >
                  Reply
                </button>
                <button
                  onClick={() =>
                    setMessageToasts((prev) => prev.filter((item) => item.id !== toast.id))
                  }
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showCreateModal && (
          <CreateWorkspaceModal
            newWorkspace={newWorkspace}
            setNewWorkspace={setNewWorkspace}
            setShowCreateModal={setShowCreateModal}
            createWorkspace={createWorkspace}
            creatingWorkspace={creatingWorkspace}
            memberOptions={memberOptionsWithoutCurrentUser}
            ownerName={currentUser.name}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBoardModal && (
          <motion.div
            className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeBoardModal}
          >
            <motion.div
              className="modal-card w-full max-w-md p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-semibold">Create Board</h2>
                <button
                  onClick={closeBoardModal}
                  className="text-gray-400 hover:text-white"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  value={newBoard}
                  onChange={(e) => {
                    setNewBoard(e.target.value);
                    if (boardModalError) setBoardModalError("");
                  }}
                  placeholder="Board Name"
                  aria-invalid={Boolean(boardModalError)}
                  className={`modal-input ${
                    boardModalError
                      ? "border-red-500/70 focus:border-red-400 focus:ring-red-500/20"
                      : ""
                  }`}
                />
                {boardModalError ? (
                  <p className="text-xs text-red-300">{boardModalError}</p>
                ) : null}

                <div className="modal-section">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    Select what you&apos;re managing in this board
                  </p>
                  <div className="flex flex-wrap items-center gap-4">
                    {[
                      { value: "tasks", label: "Tasks" },
                      { value: "sales", label: "Sales" },
                      { value: "items", label: "Items" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="board-category"
                          value={option.value}
                          checked={boardCategory === option.value}
                          onChange={() => setBoardCategory(option.value)}
                          className="h-4 w-4"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="modal-section">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    Privacy
                  </p>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={boardPrivacy === "main"}
                        onChange={() => {
                          setBoardPrivacy("main");
                          setBoardMembers([]);
                        }}
                        className="h-4 w-4"
                      />
                      Main
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={boardPrivacy === "private"}
                        onChange={() => setBoardPrivacy("private")}
                        className="h-4 w-4"
                      />
                      Private
                    </label>
                  </div>
                </div>

                <div className="modal-section">
                  <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
                    Start with data
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBoardImportMode("empty");
                        setBoardImportFile(null);
                        setBoardImportName("");
                      }}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        boardImportMode === "empty"
                          ? "border-indigo-500/60 bg-indigo-500/15 text-slate-100"
                          : "border-slate-700 bg-[#0f172a] text-slate-300 hover:border-indigo-400/50"
                      }`}
                    >
                      <p className="text-sm font-semibold">Start empty</p>
                      <p className="text-xs text-slate-400">
                        Create a blank board and add rows later.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBoardImportMode("import")}
                      className={`rounded-xl border px-3 py-3 text-left transition ${
                        boardImportMode === "import"
                          ? "border-indigo-500/60 bg-indigo-500/15 text-slate-100"
                          : "border-slate-700 bg-[#0f172a] text-slate-300 hover:border-indigo-400/50"
                      }`}
                    >
                      <p className="text-sm font-semibold">Import data</p>
                      <p className="text-xs text-slate-400">
                        Upload a CSV file.
                      </p>
                    </button>
                  </div>

                  {boardImportMode === "import" && (
                    <div className="mt-3 rounded-xl border border-gray-700 bg-[#0f172a] p-3">
                      <p className="text-xs text-gray-400 mb-3">
                        Accepted formats: `.csv`
                      </p>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setBoardImportFile(file);
                          setBoardImportName(file?.name || "");
                        }}
                        className="block w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600/80 file:px-3 file:py-1.5 file:text-xs file:text-white hover:file:bg-indigo-500"
                      />
                      {boardImportName && (
                        <p className="mt-2 text-xs text-indigo-300 truncate">
                          Selected: {boardImportName}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {boardPrivacy === "private" && (
                  <div className="relative">
                    <label className="block text-sm text-gray-400 mb-2">
                      Add members
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setBoardMemberDropdownOpen((prev) => !prev)
                      }
                      className="modal-input flex items-center justify-between text-left"
                    >
                      <span className="truncate">
                        {boardMembers.length > 0
                          ? boardMembers.map(getMemberLabel).join(", ")
                          : "Select members"}
                      </span>

                      <ChevronDown
                        size={16}
                        className={`ml-3 shrink-0 text-gray-400 transition ${
                          boardMemberDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                      <AnimatePresence>
                        {boardMemberDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute z-50 mt-2 w-full max-h-72 overflow-hidden rounded-xl border border-gray-700 bg-[#0f172a] shadow-xl"
                          >
                            <div className="border-b border-gray-700 p-3">
                              <input
                                value={boardMemberSearch}
                                onChange={(e) => setBoardMemberSearch(e.target.value)}
                                placeholder="Search users..."
                                className="modal-input text-sm"
                              />
                            </div>

                            {workspaceBoardMemberOptions.length === 0 && (
                              <p className="px-4 py-3 text-sm text-gray-400">
                                No eligible members in this workspace.
                              </p>
                            )}

                            {workspaceBoardMemberOptions.length > 0 &&
                              filteredBoardMemberOptions.length === 0 && (
                                <p className="px-4 py-3 text-sm text-gray-400">
                                  No matching users found.
                                </p>
                              )}

                            <div className="max-h-48 overflow-y-auto">
                              {filteredBoardMemberOptions.map((member) => {
                                  const selected = boardMembers
                                    .map(getMemberKey)
                                    .includes(getMemberKey(member));

                                  return (
                                    <button
                                      key={getMemberKey(member)}
                                      type="button"
                                      onClick={() => {
                                        const memberKey = getMemberKey(member);
                                        setBoardMembers((prev) => {
                                          const prevKeys = prev.map(getMemberKey);
                                          if (prevKeys.includes(memberKey)) {
                                            return prev.filter(
                                              (m) => getMemberKey(m) !== memberKey
                                            );
                                          }
                                          return [...prev, member];
                                        });
                                      }}
                                      className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[#1e293b]"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate text-sm text-white">
                                          {getMemberLabel(member)}
                                        </p>
                                        <p className="truncate text-[11px] text-gray-400">
                                          {member?.role || member?.email || "Member"}
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
                          </motion.div>
                        )}
                      </AnimatePresence>

                    {boardMembers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {boardMembers.map((member) => (
                          <span
                            key={getMemberKey(member)}
                            className="px-2 py-1 rounded-full text-xs bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                          >
                            {getMemberLabel(member)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  onClick={closeBoardModal}
                  className="modal-secondary"
                >
                  Cancel
                </button>

                  <button
                    onClick={createBoard}
                    disabled={creatingBoard}
                    className="modal-primary inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {creatingBoard ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBoardAccessModal && (
          <motion.div
            className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeBoardAccessModal}
          >
            <motion.div
              className="modal-card w-full max-w-md p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Private Board Members</h2>
                  <p className="mt-1 text-xs text-gray-400">
                    Update who can access {boardToManageAccess?.name || "this board"}.
                  </p>
                </div>
                <button
                  onClick={closeBoardAccessModal}
                  className="text-gray-400 hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <label className="mb-2 block text-sm text-gray-400">Add members</label>
                  <button
                    type="button"
                    onClick={() => setBoardAccessDropdownOpen((prev) => !prev)}
                    disabled={!canEditBoardAccessMembers}
                    className="modal-input flex items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="truncate">
                      {boardAccessMembers.length > 0
                        ? boardAccessMembers.map(getMemberLabel).join(", ")
                        : "Select members"}
                    </span>

                    <ChevronDown
                      size={16}
                      className={`ml-3 shrink-0 text-gray-400 transition ${
                        boardAccessDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {boardAccessDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute z-50 mt-2 w-full max-h-72 overflow-hidden rounded-xl border border-gray-700 bg-[#0f172a] shadow-xl"
                      >
                        <div className="border-b border-gray-700 p-3">
                          <input
                            value={boardAccessSearch}
                            onChange={(e) => setBoardAccessSearch(e.target.value)}
                            placeholder="Search users..."
                            className="modal-input text-sm"
                          />
                        </div>

                        {workspaceBoardMemberOptions.length === 0 && (
                          <p className="px-4 py-3 text-sm text-gray-400">
                            No eligible members in this workspace.
                          </p>
                        )}

                        {workspaceBoardMemberOptions.length > 0 &&
                          filteredBoardAccessMemberOptions.length === 0 && (
                            <p className="px-4 py-3 text-sm text-gray-400">
                              No matching users found.
                            </p>
                          )}

                        <div className="max-h-48 overflow-y-auto">
                          {filteredBoardAccessMemberOptions.map((member) => {
                            const selected = boardAccessMembers
                              .map(getMemberKey)
                              .includes(getMemberKey(member));

                            return (
                              <button
                                key={getMemberKey(member)}
                                type="button"
                                disabled={!canEditBoardAccessMembers}
                                onClick={() => {
                                  const memberKey = getMemberKey(member);
                                  setBoardAccessMembers((prev) => {
                                    const prevKeys = prev.map(getMemberKey);
                                    if (prevKeys.includes(memberKey)) {
                                      return prev.filter(
                                        (m) => getMemberKey(m) !== memberKey,
                                      );
                                    }
                                    return [...prev, member];
                                  });
                                }}
                                className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[#1e293b] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm text-white">
                                    {getMemberLabel(member)}
                                  </p>
                                  <p className="truncate text-[11px] text-gray-400">
                                    {member?.role || member?.email || "Member"}
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <p className="mb-2 text-sm text-gray-400">Current members</p>
                  {boardAccessMembers.length > 0 ? (
                    <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl border border-gray-700 bg-[#0f172a] p-3">
                      {boardAccessMembers.map((member) => (
                        <div
                          key={getMemberKey(member)}
                          className="flex items-center justify-between rounded-lg border border-gray-700 bg-[#111827] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">
                              {getMemberLabel(member)}
                            </p>
                            <p className="truncate text-[11px] text-gray-400">
                              {member?.role || member?.email || "Member"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveBoardAccessMember(member)}
                            disabled={!canEditBoardAccessMembers}
                            className="ml-3 shrink-0 rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-300 transition hover:border-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-gray-700 px-3 py-2 text-sm text-gray-400">
                      No members selected.
                    </p>
                  )}
                </div>

                {boardAccessError ? (
                  <p className="text-xs text-red-300">{boardAccessError}</p>
                ) : null}
                {boardAccessNotice ? (
                  <p className="text-xs text-emerald-300">{boardAccessNotice}</p>
                ) : null}
                {!canEditBoardAccessMembers ? (
                  <p className="text-xs text-amber-300">
                    You can view members, but only board creator, owner, admin, or manager can edit.
                  </p>
                ) : null}
              </div>

              <div className="modal-actions mt-5">
                <button onClick={closeBoardAccessModal} className="modal-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleSaveBoardAccess}
                  disabled={savingBoardAccess || !canEditBoardAccessMembers}
                  className="modal-primary inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingBoardAccess ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save members"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRenameBoardModal && (
          <motion.div
            className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowRenameBoardModal(false);
              setBoardToRename(null);
              setRenameBoardValue("");
            }}
          >
            <motion.div
              className="modal-card w-full max-w-md p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Rename Board</h2>
                <button
                  onClick={() => {
                    setShowRenameBoardModal(false);
                    setBoardToRename(null);
                    setRenameBoardValue("");
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>

              <input
                type="text"
                value={renameBoardValue}
                onChange={(e) => setRenameBoardValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleRenameBoard();
                  }
                }}
                placeholder="Board name"
                className="modal-input"
              />

              <div className="modal-actions">
                <button
                  onClick={() => {
                    setShowRenameBoardModal(false);
                    setBoardToRename(null);
                    setRenameBoardValue("");
                  }}
                  className="modal-secondary"
                >
                  Cancel
                </button>

                <button
                  onClick={handleRenameBoard}
                  className="modal-primary"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </>
    </div>
  );
}


