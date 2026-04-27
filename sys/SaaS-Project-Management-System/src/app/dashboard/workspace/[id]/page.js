/*workspace/[id]/page.js*/
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/http";
import { listDirectoryUsers } from "@/lib/users";
import { motion, AnimatePresence } from "framer-motion";
import Skeleton from "../../components/Skeleton";
import {
  Plus,
  Layout,
  Sparkles,
  Users,
  CalendarDays,
  ArrowLeft,
  FolderKanban,
  User,
  MoreVertical,
  Pencil,
  Trash2,
  CheckCircle,
  ShieldCheck,
  UserPlus,
  X,
  ArrowUpDown,
  Loader2,
} from "lucide-react";

function getWorkspaceMemberIds(workspace) {
  const memberUsers = workspace?.memberUsers || [];
  const userIds = memberUsers
    .map((member) => member?._id || member?.id)
    .filter(Boolean)
    .map(String);

  if (userIds.length) return [...new Set(userIds)];

  return [...new Set((workspace?.members || []).map(String).filter(Boolean))];
}

const normalizeToken = (value) => String(value || "").trim().toLowerCase();
const FALLBACK_CURRENT_USER = { id: "", name: "User", email: "", role: "" };

export default function SingleWorkspacePage({
  setWorkspaces,
  setCurrentWorkspace,
  openCreateBoardModal,
  currentUser = FALLBACK_CURRENT_USER,
  memberOptions = [],
}) {
  const { id } = useParams();
  const router = useRouter();
  const WORKSPACE_API = "/api/workspaces";

  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const [activeTab, setActiveTab] = useState("recents");
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionAction, setPermissionAction] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteDropdownOpen, setInviteDropdownOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteSelection, setInviteSelection] = useState([]);
  const [savingInvite, setSavingInvite] = useState(false);
  const [localUser, setLocalUser] = useState(currentUser);
  const [localMemberOptions, setLocalMemberOptions] = useState(memberOptions);
  const memberLoadRequestedRef = useRef(false);

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get(`${WORKSPACE_API}/${id}`);
      setWorkspace(res.data);
      setRenameValue(res.data.name || "");
    } catch (err) {
      console.error("Error loading workspace:", err);
      setError(err.response?.data?.message || "Failed to load workspace");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }

    if (id) loadWorkspace();
  }, [id, loadWorkspace, router]);

  useEffect(() => {
    const hydrateLocalUser = async () => {
      if (currentUser?.name && currentUser.name !== "User") {
        setLocalUser(currentUser);
        return;
      }

      try {
        const res = await api.get("/api/auth/me");
        const user = res.data?.user || res.data?.profile || {};
        setLocalUser({
          id: user.id || user._id || "",
          name: user.name || (user.email ? user.email.split("@")[0] : "User"),
          email: user.email || "",
          role: user.role || "",
        });
      } catch {
        setLocalUser(currentUser);
      }
    };

    hydrateLocalUser();
  }, [currentUser?.id, currentUser?.name, currentUser?.email, currentUser?.role]);

  useEffect(() => {
    if (memberOptions.length) {
      setLocalMemberOptions(memberOptions);
    }
  }, [memberOptions]);

  const refreshMemberOptions = useCallback(async () => {
    try {
      const users = await listDirectoryUsers();
      setLocalMemberOptions(users);
      return users;
    } catch (err) {
      console.error("Error loading team members:", err);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!localMemberOptions.length && !memberLoadRequestedRef.current) {
      memberLoadRequestedRef.current = true;
      refreshMemberOptions();
    }
  }, [localMemberOptions.length, refreshMemberOptions]);

  const handleDeleteWorkspace = async () => {
    try {
      await api.delete(`${WORKSPACE_API}/${id}`);

      if (setWorkspaces && setCurrentWorkspace) {
        const refreshed = await api.get(WORKSPACE_API);
        const nextWorkspaces = Array.isArray(refreshed.data)
          ? refreshed.data
          : [];
        setWorkspaces(nextWorkspaces);
        const nextCurrent =
          nextWorkspaces.find((ws) => ws.isActive) || nextWorkspaces[0] || null;
        setCurrentWorkspace(nextCurrent);
      } else if (setWorkspaces) {
        setWorkspaces((prev) =>
          prev.filter((ws) => ws._id !== id && ws.id !== id),
        );
      } else if (setCurrentWorkspace) {
        setCurrentWorkspace((prev) =>
          prev?._id === id || prev?.id === id ? null : prev,
        );
      }

      router.push("/dashboard/workspace");
    } catch (err) {
      console.error("Error deleting workspace:", err);
      setError(err.response?.data?.message || "Failed to delete workspace");
    }
  };

  const handleRenameWorkspace = async () => {
    if (!renameValue.trim() || !workspace) return;

    try {
      setSavingRename(true);

      const res = await api.put(`${WORKSPACE_API}/${id}`, {
        name: renameValue.trim(),
        description: workspace.description || "",
        color: workspace.color || "#7c3aed",
        members: getWorkspaceMemberIds(workspace),
        isActive: workspace.isActive || false,
      });

      setWorkspace(res.data);
      setShowRenameModal(false);
      setMenuOpen(false);
    } catch (err) {
      console.error("Error renaming workspace:", err);
      setError(err.response?.data?.message || "Failed to rename workspace");
    } finally {
      setSavingRename(false);
    }
  };

  const ownerToken = workspace?.owner?._id || workspace?.owner?.id || workspace?.owner || "";
  const findUserByToken = useCallback((token) => {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) return null;

    return localMemberOptions.find((member) =>
      [member.id, member.email, member.name]
        .filter(Boolean)
        .some((value) => normalizeToken(value) === normalizedToken),
    ) || null;
  }, [localMemberOptions]);
  const resolvedCurrentUser = localUser?.name && localUser.name !== "User" ? localUser : currentUser;
  const ownerUser = workspace?.owner?.name
    ? workspace.owner
    : findUserByToken(ownerToken);
  const ownerId = ownerUser?._id || ownerUser?.id || ownerToken;
  const ownerMatchesCurrentUser = [ownerId, ownerToken, ownerUser?.email, ownerUser?.name]
    .filter(Boolean)
    .some(
      (value) =>
        normalizeToken(value) === normalizeToken(resolvedCurrentUser?.id) ||
        normalizeToken(value) === normalizeToken(resolvedCurrentUser?.email) ||
        normalizeToken(value) === normalizeToken(resolvedCurrentUser?.name),
    );
  const ownerName =
    ownerUser?.name ||
    workspace?.owner?.name ||
    (ownerMatchesCurrentUser && resolvedCurrentUser?.name !== "User" ? resolvedCurrentUser?.name : "") ||
    "Workspace owner";
  const ownerEmail =
    ownerUser?.email ||
    workspace?.owner?.email ||
    (ownerMatchesCurrentUser ? resolvedCurrentUser?.email : "") ||
    "Owner";
  const createdAtLabel = workspace?.createdAt
    ? new Date(workspace.createdAt).toLocaleDateString()
    : "Unknown";
  const activeBoardName = workspace?.boards?.[0]?.name || "";
  const isWorkspaceOwner = [ownerId, ownerToken, ownerEmail, ownerName]
    .filter(Boolean)
    .some(
      (value) =>
        normalizeToken(value) === normalizeToken(resolvedCurrentUser?.id) ||
        normalizeToken(value) === normalizeToken(resolvedCurrentUser?.email) ||
        normalizeToken(value) === normalizeToken(resolvedCurrentUser?.name),
    );
  const canManagePermissions =
    isWorkspaceOwner || ["Owner", "Admin"].includes(resolvedCurrentUser?.role);
  const rawWorkspaceMemberIds = getWorkspaceMemberIds(workspace);
  const workspaceMembers = useMemo(
    () =>
      rawWorkspaceMemberIds
        .map((memberId) => {
          const memberUser =
            (workspace?.memberUsers || []).find((member) =>
              [member._id, member.id, member.email, member.name]
                .filter(Boolean)
                .some((value) => normalizeToken(value) === normalizeToken(memberId)),
            ) || findUserByToken(memberId);

          if (!memberUser) return null;

          const resolvedId = memberUser._id || memberUser.id || memberUser.email || memberUser.name;
          if (normalizeToken(resolvedId) === normalizeToken(ownerId)) return null;

          return {
            id: String(resolvedId),
            name: memberUser.name || memberUser.email || "Team member",
            email: memberUser.email || "",
            role: memberUser.role || "Member",
          };
        })
        .filter(Boolean),
    [rawWorkspaceMemberIds, workspace?.memberUsers, findUserByToken, ownerId],
  );
  const workspaceMemberIds = workspaceMembers.map((member) => member.id);
  const workspaceMemberIdSet = new Set(workspaceMemberIds.map(String));
  const availableMembers = localMemberOptions.filter(
    (member) => normalizeToken(member.id) !== normalizeToken(ownerId),
  );
  const membersAvailableToAdd = availableMembers.filter(
    (member) => !workspaceMemberIdSet.has(String(member.id)),
  );

  const invitedWorkspaceMembers = workspaceMembers;

  async function updateWorkspaceMembers(nextMemberIds, action = "") {
    if (!workspace) return;

    try {
      setPermissionAction(action);
      setSavingPermissions(true);
      setError("");

      const res = await api.put(`${WORKSPACE_API}/${id}`, {
        name: workspace.name || "Workspace",
        description: workspace.description || "",
        color: workspace.color || "#7c3aed",
        members: [...new Set(nextMemberIds.map(String))],
        isActive: !!workspace.isActive,
      });

      setWorkspace(res.data);
      setWorkspaces?.((prev) =>
        (prev || []).map((item) =>
          String(item._id || item.id) === String(id) ? res.data : item,
        ),
      );
      setCurrentWorkspace?.((prev) =>
        String(prev?._id || prev?.id) === String(id) ? res.data : prev,
      );
    } catch (err) {
      console.error("Error updating workspace permissions:", err);
      setError(err.response?.data?.message || "Failed to update workspace permissions");
    } finally {
      setSavingPermissions(false);
      setPermissionAction("");
    }
  }

  const grantWorkspaceAccess = async (memberId) => {
    if (!memberId || workspaceMemberIdSet.has(String(memberId))) return;
    await updateWorkspaceMembers([...workspaceMemberIds, memberId], "add");
    setSelectedMemberId("");
  };

  const removeWorkspaceAccess = async (memberId) => {
    await updateWorkspaceMembers(
      workspaceMemberIds.filter((idValue) => String(idValue) !== String(memberId)),
      "remove",
    );
  };

  const handleSaveWorkspaceInvites = async () => {
    if (!inviteSelection.length || savingInvite) return;
    try {
      setSavingInvite(true);
      const nextIds = [
        ...new Set([...workspaceMemberIds, ...inviteSelection.map((member) => member.id)]),
      ];
      await updateWorkspaceMembers(nextIds);
      setInviteSelection([]);
      setInviteDropdownOpen(false);
      setInviteSearch("");
      setShowInviteModal(false);
    } finally {
      setSavingInvite(false);
    }
  };

  const filteredMembersToInvite = membersAvailableToAdd.filter((member) => {
    const query = inviteSearch.trim().toLowerCase();
    if (!query) return true;
    return `${member?.name || ""} ${member?.email || ""} ${member?.role || ""}`
      .toLowerCase()
      .includes(query);
  });

  const cards = [
    {
      title: "Add new board",
      description: workspace
        ? `Start a board in ${workspace.name}`
        : "Start from scratch",
      icon: Plus,
      highlight: true,
      onClick: () => {
        if (typeof openCreateBoardModal === "function") {
          openCreateBoardModal(workspace);
        } else {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("nexora:create-board-modal", {
                detail: {
                  workspace,
                  workspaceId: workspace?._id || workspace?.id || "",
                },
              }),
            );
          } else {
            setError("Create board modal is unavailable. Please refresh and try again.");
          }
        }
      },
    },
    {
      title: "Invite your team",
      description: workspace
        ? `Invite members to ${workspace.name}`
        : "Collaborate together",
      icon: Users,
      onClick: () => setShowInviteModal(true),
    },
    {
      title: "Start with AI",
      description: "Let AI create your board",
      icon: Sparkles,
      comingSoon: true,
    },
    {
      title: "Start with template",
      description: "Choose from 100+ templates",
      icon: Layout,
      comingSoon: true,
    },
  ];

  if (loading) {
    return (
      <div className="w-full max-w-10xl mx-auto">
        <Skeleton className="h-10 w-40 mb-6" />
        <div className="mb-8 sm:mb-10">
          <Skeleton className="h-8 w-72 mb-3" />
          <Skeleton className="h-4 w-full max-w-xl mb-2" />
          <Skeleton className="h-4 w-2/3 max-w-md" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 mb-10 sm:mb-12">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="p-5 sm:p-6 rounded-xl border border-gray-800 bg-[#111827]"
            >
              <Skeleton className="h-10 w-10 rounded-lg mb-4" />
              <Skeleton className="h-4 w-2/3 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
        {error}
      </div>
    );
  }

  if (!workspace) {
    return <div className="text-gray-400">Workspace not found.</div>;
  }

  return (
    <div className="w-full max-w-10xl mx-auto">
      <button
        onClick={() => router.push("/dashboard/workspace")}
        className="mb-6 inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-[#111827] px-4 py-2 text-sm text-gray-300 hover:bg-[#1f2937] transition"
      >
        <ArrowLeft size={16} />
        Back to Workspaces
      </button>

      <div className="mb-8 sm:mb-10 relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: workspace.color || "#7c3aed" }}
              />
              <h1 className="text-2xl sm:text-3xl font-bold">
                {workspace.name}
              </h1>
            </div>

            <p className="text-gray-400 mt-2 text-sm sm:text-base">
              {workspace.description ||
                "Manage your boards and collaborate with your team"}
            </p>
          </div>

          {/* 3 dots button */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-2 rounded-lg border border-gray-700 bg-[#111827] hover:bg-[#1f2937] transition"
            >
              <MoreVertical size={18} className="text-gray-300" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-gray-700 bg-[#0f172a] shadow-xl overflow-hidden z-20"
                >
                  <button
                    onClick={() => {
                      setRenameValue(workspace.name || "");
                      setShowRenameModal(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[#1e293b] transition"
                  >
                    <Pencil size={15} className="text-yellow-400" />
                    Rename workspace
                  </button>

                  <button
                    onClick={handleDeleteWorkspace}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-[#1e293b] transition text-red-400"
                  >
                    <Trash2 size={15} />
                    Delete workspace
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="flex gap-6 border-b border-gray-800 pb-3 mb-8 overflow-x-auto text-sm">
        {[
          ["recents", "Recents"],
          ["content", "Content"],
          ["permissions", "Permissions"],
        ].map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap border-b-2 pb-2 transition ${
              activeTab === tab
                ? "border-indigo-500 text-white"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "permissions" ? (
        <section className="mb-10 rounded-2xl border border-gray-800 bg-[#111827] p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck size={18} className="text-indigo-400" />
                <h2 className="text-lg font-semibold">Workspace permissions</h2>
              </div>
              <p className="max-w-2xl text-sm text-gray-400">
                Control who can see and work inside this workspace. Members added here can access the workspace and its boards.
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
              canManagePermissions
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}>
              {canManagePermissions ? "You can manage access" : "View only"}
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-gray-800 bg-[#0f172a] p-4">
              <h3 className="mb-4 font-semibold">Current access</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-3">
                  <div>
                    <p className="font-medium">{ownerName}</p>
                    <p className="text-xs text-gray-400">{ownerEmail}</p>
                  </div>
                  <span className="rounded-full bg-indigo-600 px-2 py-1 text-xs text-white">Owner</span>
                </div>

                {workspaceMembers.length ? (
                  workspaceMembers.map((member) => (
                    <div key={member.id || member.email || member.name} className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#111827] p-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{member.name}</p>
                        <p className="truncate text-xs text-gray-400">{member.email || member.role}</p>
                      </div>
                      {canManagePermissions ? (
                        <button
                          onClick={() => removeWorkspaceAccess(member.id)}
                          disabled={savingPermissions}
                          className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      ) : (
                        <span className="rounded-full border border-gray-700 px-2 py-1 text-xs text-gray-400">
                          Member
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-400">
                    No members have been granted access yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#0f172a] p-4">
              <div className="mb-4 flex items-center gap-2">
                <UserPlus size={17} className="text-indigo-400" />
                <h3 className="font-semibold">Add team members</h3>
              </div>

              {!canManagePermissions ? (
                <div className="rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-400">
                  Only the workspace owner, company Owner, or Admin can change permissions.
                </div>
              ) : availableMembers.length ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-sm text-gray-300">
                      Select a team member
                    </label>
                    <select
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                      disabled={savingPermissions || !membersAvailableToAdd.length}
                      className="w-full rounded-xl border border-gray-700 bg-[#111827] px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="">
                        {membersAvailableToAdd.length ? "Choose a member" : "All members already have access"}
                      </option>
                      {membersAvailableToAdd.map((member) => (
                        <option key={member.id || member.email || member.name} value={member.id}>
                          {member.name} {member.email ? `(${member.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => grantWorkspaceAccess(selectedMemberId)}
                    disabled={savingPermissions || !selectedMemberId}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingPermissions && permissionAction === "add" ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} />
                        Add member
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-700 p-4">
                  <p className="text-sm text-gray-400">
                    No team members found. Invite users first, then grant workspace access here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(true)}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
                  >
                    <UserPlus size={16} />
                    Invite team member
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 mb-10 sm:mb-12">
            {cards.map((card, i) => {
              const Icon = card.icon;

              return (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.04 }}
                  onClick={card.onClick}
                  className={`relative p-5 sm:p-6 rounded-xl border transition cursor-pointer ${card.highlight
                    ? "border-dashed border-indigo-500 bg-[#111827]"
                    : "border-gray-800 bg-[#111827]"
                    }`}
                >
                  {card.comingSoon && (
                    <span className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                      Coming Soon
                    </span>
                  )}

                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mb-4 bg-gradient-to-r from-indigo-600 to-purple-600">
                    <Icon size={18} />
                  </div>

                  <h3 className="font-semibold mb-1 text-sm sm:text-base">
                    {card.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-400">
                    {card.description}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {activeTab === "content" && (
            <div className="mb-10">
              <h2 className="text-base sm:text-lg font-semibold mb-5 sm:mb-6">
                Workspace Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-5 sm:p-6 rounded-xl bg-[#111827] border border-gray-800"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Layout size={18} className="text-indigo-400" />
                    <h3 className="font-medium text-sm sm:text-base">Workspace</h3>
                  </div>
                  <p className="text-sm text-gray-100 font-semibold">
                    {workspace?.name || "Workspace"}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-2">
                    {workspace?.description || "No description provided."}
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-5 sm:p-6 rounded-xl bg-[#111827] border border-gray-800"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <User size={18} className="text-indigo-400" />
                    <h3 className="font-medium text-sm sm:text-base">Owner</h3>
                  </div>
                  <p className="text-sm text-gray-100 font-semibold">
                    {ownerName}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-400 mt-2">
                    {ownerEmail}
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-5 sm:p-6 rounded-xl bg-[#111827] border border-gray-800"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <CalendarDays size={18} className="text-indigo-400" />
                    <h3 className="font-medium text-sm sm:text-base">Created</h3>
                  </div>
                  <p className="text-sm text-gray-300">
                    {createdAtLabel}
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-5 sm:p-6 rounded-xl bg-[#111827] border border-gray-800"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Users size={18} className="text-indigo-400" />
                    <h3 className="font-medium text-sm sm:text-base">Members</h3>
                  </div>
                  <p className="text-sm text-gray-300">
                    {workspaceMembers.length} members
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-5 sm:p-6 rounded-xl bg-[#111827] border border-gray-800"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <FolderKanban size={18} className="text-indigo-400" />
                    <h3 className="font-medium text-sm sm:text-base">Boards</h3>
                  </div>
                  <p className="text-sm text-gray-300">
                    {workspace.boards?.length || 0} boards
                  </p>
                </motion.div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="p-5 sm:p-6 rounded-xl bg-[#111827] border border-gray-800"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle size={18} className="text-indigo-400" />
                    <h3 className="font-medium text-sm sm:text-base">Active board</h3>
                  </div>
                  <p className="text-sm text-gray-300">
                    {activeBoardName || "No active board"}
                  </p>
                </motion.div>
              </div>
            </div>
          )}

          {activeTab === "recents" && (
            <div>
              <h2 className="text-base sm:text-lg font-semibold mb-5 sm:mb-6">
                Recent Boards
              </h2>

              {workspace.boards?.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
                  {workspace.boards.map((board, index) => (
                    <motion.div
                      key={board._id || board.id || `${board.name || "board"}-${index}`}
                      whileHover={{ scale: 1.03 }}
                      className="p-5 sm:p-6 rounded-xl bg-[#111827] border border-gray-800 cursor-pointer"
                    >
                      <h3 className="font-medium text-sm sm:text-base">
                        {board.name}
                      </h3>

                      <p className="text-xs sm:text-sm text-gray-400 mt-2">
                        Board inside {workspace.name}
                      </p>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-700 bg-[#111827] p-6 text-gray-400">
                  No boards created in this workspace yet.
                </div>
              )}
            </div>
          )}
        </>
      )}

      

      {/* Invite workspace modal */}
      <AnimatePresence>
        {showInviteModal && (
          <motion.div
            className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowInviteModal(false)}
          >
            <motion.div
              className="modal-card w-full max-w-lg p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="modal-title">Workspace access</h2>
                  <p className="modal-subtitle mt-1">
                    Members invited here can see the workspace and any public boards.
                  </p>
                </div>
                <button
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-400 hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                    Invited people
                  </p>
                  {invitedWorkspaceMembers.length > 0 ? (
                    <div className="max-h-28 space-y-2 overflow-y-auto rounded-xl border border-gray-700 bg-[#0f172a] p-2.5">
                      {invitedWorkspaceMembers.map((member) => (
                        <div
                          key={member.id || member.email || member.name}
                          className="flex items-center justify-between rounded-lg border border-gray-700 bg-[#111827] px-2.5 py-2"
                        >
                          <span className="truncate text-sm text-slate-100">
                            {member.name || member.email || "Member"}
                          </span>
                          <span className="ml-3 shrink-0 text-xs text-slate-400">
                            {member.role || "Member"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No invited members yet.</p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Add more people
                  </label>
                  <button
                    type="button"
                    onClick={() => setInviteDropdownOpen((prev) => !prev)}
                    className="modal-input flex items-center justify-between text-left"
                  >
                    <span className="truncate">
                      {inviteSelection.length > 0
                        ? inviteSelection.map((m) => m.name || m.email).join(", ")
                        : "Select members"}
                    </span>
                    <ArrowUpDown size={16} className="text-gray-400" />
                  </button>

                  <AnimatePresence>
                    {inviteDropdownOpen && (
                      <div className="mt-2 overflow-hidden rounded-xl border border-gray-700 bg-[#0f172a] shadow-xl">
                        <div className="border-b border-gray-700 p-3">
                          <input
                            value={inviteSearch}
                            onChange={(e) => setInviteSearch(e.target.value)}
                            placeholder="Search members..."
                            className="modal-input text-sm"
                          />
                          <p className="mt-2 text-xs text-slate-400">
                            {filteredMembersToInvite.length} member{filteredMembersToInvite.length === 1 ? "" : "s"} found
                          </p>
                        </div>

                        <div className="max-h-56 overflow-y-auto">
                          {filteredMembersToInvite.length ? (
                            filteredMembersToInvite.map((member) => {
                              const selected = inviteSelection
                                .map((item) => item.id)
                                .includes(member.id);
                              return (
                                <button
                                  key={member.id || member.email || member.name}
                                  type="button"
                                  onClick={() => {
                                    setInviteSelection((prev) => {
                                      const ids = prev.map((item) => item.id);
                                      if (ids.includes(member.id)) {
                                        return prev.filter((item) => item.id !== member.id);
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
                                      selected ? "border-indigo-600 bg-indigo-600" : "border-gray-500"
                                    }`}
                                  />
                                </button>
                              );
                            })
                          ) : membersAvailableToAdd.length === 0 ? (
                            <p className="px-4 py-3 text-sm text-gray-400">
                              Everyone already has access.
                            </p>
                          ) : (
                            <p className="px-4 py-3 text-sm text-gray-400">
                              No matching members.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="modal-actions">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="modal-secondary"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleSaveWorkspaceInvites}
                    disabled={savingInvite || inviteSelection.length === 0}
                    className="modal-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingInvite ? "Saving..." : "Add members"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename modal */}
      <AnimatePresence>
        {showRenameModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowRenameModal(false);
              setRenameValue(workspace.name || "");
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-gray-700 bg-[#111827] p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-semibold mb-5">Rename Workspace</h2>

              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Workspace name"
                className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRenameModal(false);
                    setRenameValue(workspace.name || "");
                  }}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  onClick={handleRenameWorkspace}
                  disabled={savingRename}
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {savingRename ? "Saving..." : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
