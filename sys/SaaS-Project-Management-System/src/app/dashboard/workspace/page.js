"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Plus, Layout, Sparkles, Users, ChevronDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/apiBaseUrl";

const API = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

API.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

const defaultWorkspaceForm = {
  name: "",
  description: "",
  color: "#7c3aed",
  members: [],
  isActive: true,
};

function formatBoardUpdatedAt(dateValue) {
  if (!dateValue) return "Last updated recently";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Last updated recently";

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute));
    return `Last updated ${mins} minute${mins > 1 ? "s" : ""} ago`;
  }

  if (diffMs < day) {
    const hours = Math.max(1, Math.floor(diffMs / hour));
    return `Last updated ${hours} hour${hours > 1 ? "s" : ""} ago`;
  }

  const days = Math.max(1, Math.floor(diffMs / day));
  return `Last updated ${days} day${days > 1 ? "s" : ""} ago`;
}

const getWorkspaceId = (workspace) => workspace?._id || workspace?.id || "";

function CreateWorkspaceModal({
  newWorkspace = defaultWorkspaceForm,
  setNewWorkspace = () => { },
  setShowCreateModal = () => { },
  onCreateWorkspace = async () => { },
  memberOptions = [],
  ownerName = "Current user",
  creatingWorkspace = false,
}) {
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

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

  const safeWorkspace = {
    ...defaultWorkspaceForm,
    ...(newWorkspace || {}),
    members: Array.isArray(newWorkspace?.members) ? newWorkspace.members : [],
  };

  const toggleMember = (member) => {
    const memberKey = getMemberKey(member);
    setNewWorkspace((prev) => {
      const safePrev = {
        ...defaultWorkspaceForm,
        ...(prev || {}),
        members: Array.isArray(prev?.members) ? prev.members : [],
      };

      const memberKeys = new Set(safePrev.members.map(getMemberKey));
      const alreadySelected = memberKeys.has(memberKey);

      return {
        ...safePrev,
        members: alreadySelected
          ? safePrev.members.filter(
            (m) => getMemberKey(m) !== memberKey
          )
          : [...safePrev.members, member],
      };
    });
  };

  const filteredMembers = memberOptions.filter((member) => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return true;

    return `${member?.name || ""} ${member?.email || ""} ${member?.role || ""}`
      .toLowerCase()
      .includes(query);
  });

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setShowCreateModal(false)}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl dark:border-gray-700 dark:bg-[#111827] dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Create Workspace</h2>
          <button
            type="button"
            onClick={() => setShowCreateModal(false)}
            className="text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
          >
            <span className="text-lg">×</span>
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={safeWorkspace.name}
            onChange={(e) =>
              setNewWorkspace((prev) => ({
                ...defaultWorkspaceForm,
                ...(prev || {}),
                name: e.target.value,
              }))
            }
            placeholder="Workspace Name"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-[#1e293b] dark:text-white dark:placeholder:text-gray-500"
          />

          <textarea
            value={safeWorkspace.description}
            onChange={(e) =>
              setNewWorkspace((prev) => ({
                ...defaultWorkspaceForm,
                ...(prev || {}),
                description: e.target.value,
              }))
            }
            placeholder="Workspace Description"
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-[#1e293b] dark:text-white dark:placeholder:text-gray-500"
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-gray-700 dark:bg-[#1e293b]">
            <p className="text-xs text-slate-500 dark:text-gray-400">Owner</p>
            <p className="mt-0.5 text-sm text-slate-900 dark:text-white">{ownerName}</p>
          </div>

          <div className="relative">
            <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">Members</label>

            <button
              type="button"
              onClick={() => setMemberDropdownOpen((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-[#1e293b] dark:text-white"
            >
              <span className="truncate">
                {safeWorkspace.members.length > 0
                  ? safeWorkspace.members.map(getMemberLabel).join(", ")
                  : "Select members"}
              </span>

              <ChevronDown
                size={16}
                className={`ml-3 shrink-0 text-slate-400 transition dark:text-gray-400 ${memberDropdownOpen ? "rotate-180" : ""
                  }`}
              />
            </button>

            <AnimatePresence>
              {memberDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-gray-700 dark:bg-[#0f172a]"
                >
                  <div className="border-b border-slate-200 p-3 dark:border-gray-700">
                    <input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search users..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-[#111827] dark:text-white dark:placeholder:text-gray-500"
                    />
                  </div>

                  {memberOptions.length === 0 && (
                    <p className="px-4 py-3 text-sm text-slate-500 dark:text-gray-400">
                      No users found
                    </p>
                  )}

                  {filteredMembers.map((member) => {
                    const memberName = getMemberLabel(member);
                    const selected = safeWorkspace.members
                      .map(getMemberKey)
                      .includes(getMemberKey(member));

                    return (
                      <button
                        key={member?.id || member?._id || member?.email || memberName}
                        type="button"
                        onClick={() => toggleMember(member)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-[#1e293b]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-slate-900 dark:text-white">
                            {memberName}
                          </p>
                          <p className="truncate text-[11px] text-slate-500 dark:text-gray-400">
                            {member?.role || member?.email || "Member"}
                          </p>
                        </div>

                        <div
                          className={`h-4 w-4 rounded border ${selected
                              ? "border-indigo-600 bg-indigo-600"
                              : "border-slate-300 dark:border-gray-500"
                            }`}
                        />
                      </button>
                    );
                  })}

                  {memberOptions.length > 0 && filteredMembers.length === 0 && (
                    <p className="px-4 py-3 text-sm text-slate-500 dark:text-gray-400">
                      No matching users
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {safeWorkspace.members.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {safeWorkspace.members.map((member) => (
                  <span
                    key={getMemberKey(member)}
                    className="rounded-full border border-indigo-500/30 bg-indigo-600/15 px-2 py-1 text-xs text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-300"
                  >
                    {getMemberLabel(member)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-500 dark:text-gray-400">
              Workspace Color
            </label>
            <input
              type="color"
              value={safeWorkspace.color}
              onChange={(e) =>
                setNewWorkspace((prev) => ({
                  ...defaultWorkspaceForm,
                  ...(prev || {}),
                  color: e.target.value,
                }))
              }
              className="h-10 w-20 rounded border border-slate-200 bg-white dark:border-gray-700 dark:bg-[#1e293b]"
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={!!safeWorkspace.isActive}
              onChange={(e) =>
                setNewWorkspace((prev) => ({
                  ...defaultWorkspaceForm,
                  ...(prev || {}),
                  isActive: e.target.checked,
                }))
              }
            />
            Set as active workspace
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowCreateModal(false)}
            className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onCreateWorkspace}
            disabled={creatingWorkspace}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
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

export default function WorkspacePage({
  currentWorkspace = null,
  workspaces = [],
  setWorkspaces = () => { },
  setCurrentWorkspace = () => { },
  memberOptions = null,
  currentUser = { name: "User" },
}) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pageWorkspace, setPageWorkspace] = useState(defaultWorkspaceForm);
  const [resolvedMemberOptions, setResolvedMemberOptions] = useState(
    Array.isArray(memberOptions) ? memberOptions : []
  );

  const [backendWorkspaces, setBackendWorkspaces] = useState([]);
  const [backendCurrentWorkspace, setBackendCurrentWorkspace] = useState(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const hasResolvedMembers = resolvedMemberOptions.length > 0;

  useEffect(() => {
    const nextOptions = Array.isArray(memberOptions) ? memberOptions : [];
    setResolvedMemberOptions((prev) => {
      if (prev === nextOptions) return prev;
      if (prev.length !== nextOptions.length) return nextOptions;

      const hasChanged = prev.some((member, index) => {
        const currentKey =
          member?.id || member?._id || member?.email || member?.name || "";
        const nextMember = nextOptions[index];
        const nextKey =
          nextMember?.id || nextMember?._id || nextMember?.email || nextMember?.name || "";
        return String(currentKey) !== String(nextKey);
      });

      return hasChanged ? nextOptions : prev;
    });
  }, [memberOptions]);

  useEffect(() => {
    if (!showCreateModal) return;
    if (hasResolvedMembers) return;

    const loadMembersForModal = async () => {
      try {
        const response = await API.get("/auth/company-members");
        const payload = response?.data;
        const rawMembers = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.members)
            ? payload.members
            : [];
        setResolvedMemberOptions((prev) => {
          if (prev === rawMembers) return prev;
          if (prev.length !== rawMembers.length) return rawMembers;

          const changed = prev.some((member, index) => {
            const prevKey =
              member?.id || member?._id || member?.email || member?.name || "";
            const next = rawMembers[index];
            const nextKey =
              next?.id || next?._id || next?.email || next?.name || "";
            return String(prevKey) !== String(nextKey);
          });

          return changed ? rawMembers : prev;
        });
      } catch (error) {
        console.error("Error loading members for workspace modal:", error);
      }
    };

    loadMembersForModal();
  }, [hasResolvedMembers, showCreateModal]);

  const modalMemberOptions = useMemo(() => {
    const creatorTokens = new Set(
      [
        String(currentUser?.id || "").toLowerCase(),
        String(currentUser?._id || "").toLowerCase(),
        String(currentUser?.email || "").toLowerCase(),
        String(currentUser?.name || "").toLowerCase(),
      ].filter(Boolean)
    );

    return (resolvedMemberOptions || []).filter((member) => {
      const memberTokens = [
        String(member?.id || member?._id || "").toLowerCase(),
        String(member?.email || "").toLowerCase(),
        String(member?.name || "").toLowerCase(),
      ].filter(Boolean);
      return !memberTokens.some((token) => creatorTokens.has(token));
    });
  }, [resolvedMemberOptions, currentUser]);
  const [hasLoadedFromBackend, setHasLoadedFromBackend] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [activeTab, setActiveTab] = useState("recents");
  const workspacesRequestRef = useRef(null);
  const hasLoadedFromBackendRef = useRef(false);
  const workspacesSnapshotRef = useRef(workspaces);
  const currentWorkspaceRef = useRef(currentWorkspace);
  const setCurrentWorkspaceRef = useRef(setCurrentWorkspace);

  useEffect(() => {
    workspacesSnapshotRef.current = workspaces;
  }, [workspaces]);

  useEffect(() => {
    currentWorkspaceRef.current = currentWorkspace;
  }, [currentWorkspace]);

  useEffect(() => {
    setCurrentWorkspaceRef.current = setCurrentWorkspace;
  }, [setCurrentWorkspace]);

  const markBackendLoaded = useCallback(() => {
    hasLoadedFromBackendRef.current = true;
    setHasLoadedFromBackend(true);
  }, []);

  const loadWorkspaces = useCallback(async ({ force = false } = {}) => {
    const snapshot = Array.isArray(workspacesSnapshotRef.current)
      ? workspacesSnapshotRef.current
      : [];
    const currentSnapshot = currentWorkspaceRef.current;
    const setCurrent = setCurrentWorkspaceRef.current;

    if (!force && (hasLoadedFromBackendRef.current || snapshot.length > 0)) {
      setBackendWorkspaces(snapshot);
      const nextCurrent =
        currentSnapshot ||
        snapshot.find((workspace) => workspace?.isActive) ||
        snapshot[0] ||
        null;
      setBackendCurrentWorkspace((prev) =>
        getWorkspaceId(prev) === getWorkspaceId(nextCurrent) ? prev : nextCurrent
      );
      setSelectedWorkspace((current) =>
        getWorkspaceId(current) === getWorkspaceId(nextCurrent)
          ? current
          : current || nextCurrent
      );
      markBackendLoaded();
      setLoadingWorkspaces(false);
      return;
    }

    if (workspacesRequestRef.current) return workspacesRequestRef.current;

    const request = (async () => {
      try {
        setLoadingWorkspaces(true);

        const response = await API.get("/workspaces?view=minimal");
        const fetchedWorkspaces = Array.isArray(response.data) ? response.data : [];

        setBackendWorkspaces(fetchedWorkspaces);
        markBackendLoaded();

        const activeWorkspace =
          fetchedWorkspaces.find((workspace) => workspace?.isActive) ||
          fetchedWorkspaces[0] ||
          null;

        setBackendCurrentWorkspace(activeWorkspace);
        setSelectedWorkspace(activeWorkspace);

        if (
          activeWorkspace &&
          typeof setCurrent === "function" &&
          getWorkspaceId(activeWorkspace) !== getWorkspaceId(currentSnapshot)
        ) {
          setCurrent(activeWorkspace);
        }
      } catch (error) {
        console.error("Error fetching workspaces:", error);
        if (snapshot.length > 0) {
          setBackendWorkspaces(snapshot);
          const nextCurrent =
            currentSnapshot ||
            snapshot.find((workspace) => workspace?.isActive) ||
            snapshot[0] ||
            null;
          setBackendCurrentWorkspace((prev) =>
            getWorkspaceId(prev) === getWorkspaceId(nextCurrent) ? prev : nextCurrent
          );
        }
        markBackendLoaded();
      } finally {
        setLoadingWorkspaces(false);
        workspacesRequestRef.current = null;
      }
    })();

    workspacesRequestRef.current = request;
    return request;
  }, [markBackendLoaded]);

  useEffect(() => {
    loadWorkspaces();
    // intentionally run once to avoid update loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!workspaces.length) return;

    setBackendWorkspaces(workspaces);
    const nextCurrent =
      currentWorkspace ||
      workspaces.find((workspace) => workspace?.isActive) ||
      workspaces[0] ||
      null;
    setBackendCurrentWorkspace((prev) =>
      getWorkspaceId(prev) === getWorkspaceId(nextCurrent) ? prev : nextCurrent
    );
    setSelectedWorkspace((current) => {
      if (
        current &&
        workspaces.some(
          (workspace) => getWorkspaceId(workspace) === getWorkspaceId(current),
        )
      ) {
        return current;
      }
      return nextCurrent;
    });
    markBackendLoaded();
    setLoadingWorkspaces(false);
  }, [currentWorkspace, workspaces, markBackendLoaded]);

  const effectiveWorkspaces = useMemo(() => {
    const combined = [
      ...(Array.isArray(backendWorkspaces) ? backendWorkspaces : []),
      ...(Array.isArray(workspaces) ? workspaces : []),
    ];
    const map = new Map();
    combined.forEach((workspace) => {
      const key = workspace?._id || workspace?.id;
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, workspace);
      }
    });
    return Array.from(map.values());
  }, [backendWorkspaces, workspaces]);

  const effectiveCurrentWorkspace =
    backendCurrentWorkspace ||
    currentWorkspace ||
    effectiveWorkspaces.find((workspace) => workspace?.isActive) ||
    effectiveWorkspaces[0] ||
    null;

  const detailsWorkspace = selectedWorkspace || effectiveCurrentWorkspace;
  const recentBoardsWorkspace = selectedWorkspace || effectiveCurrentWorkspace;

  const recentWorkspaces = useMemo(() => {
    return (effectiveWorkspaces || [])
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 3);
  }, [effectiveWorkspaces]);

  const recentBoards = useMemo(() => {
    const boards = Array.isArray(recentBoardsWorkspace?.boards)
      ? recentBoardsWorkspace.boards
      : [];

    return boards
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
        const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 4);
  }, [recentBoardsWorkspace]);

  const handleCreateWorkspace = async () => {
    try {
      if (!pageWorkspace?.name?.trim()) {
        return;
      }

      setCreatingWorkspace(true);

      const payload = {
        name: pageWorkspace.name.trim(),
        description: pageWorkspace.description?.trim() || "",
        color: pageWorkspace.color || "#7c3aed",
        members: Array.isArray(pageWorkspace.members) ? pageWorkspace.members : [],
        isActive: !!pageWorkspace.isActive,
      };

      const response = await API.post("/workspaces", payload);
      const createdWorkspace = response.data;

      if (payload.isActive) {
        const createdWorkspaceId = getWorkspaceId(createdWorkspace);
        const updatedWorkspaces = [
          createdWorkspace,
          ...effectiveWorkspaces
            .filter((workspace) => getWorkspaceId(workspace) !== createdWorkspaceId)
            .map((workspace) => ({ ...workspace, isActive: false })),
        ];

        setBackendWorkspaces(updatedWorkspaces);
        setWorkspaces(updatedWorkspaces);
        setBackendCurrentWorkspace(createdWorkspace);
        setSelectedWorkspace(createdWorkspace);

        if (typeof setCurrentWorkspace === "function") {
          setCurrentWorkspace(createdWorkspace);
        }
      } else {
        const updatedWorkspaces = [createdWorkspace, ...effectiveWorkspaces];
        setBackendWorkspaces(updatedWorkspaces);
        setWorkspaces(updatedWorkspaces);

        if (!effectiveCurrentWorkspace) {
          setBackendCurrentWorkspace(createdWorkspace);
          setSelectedWorkspace(createdWorkspace);

          if (typeof setCurrentWorkspace === "function") {
            setCurrentWorkspace(createdWorkspace);
          }
        }
      }

      setHasLoadedFromBackend(true);
      setPageWorkspace(defaultWorkspaceForm);
      setShowCreateModal(false);
    } catch (error) {
      console.error("Error creating workspace from page modal:", error);
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleWorkspacePreview = async (workspace) => {
    setSelectedWorkspace(workspace);
    const workspaceId = getWorkspaceId(workspace);
    if (!workspaceId) return;

    try {
      const response = await API.get(`/workspaces/${workspaceId}`);
      const freshWorkspace = response.data;

      setSelectedWorkspace(freshWorkspace);
      setBackendWorkspaces((prev) =>
        (prev.length ? prev : effectiveWorkspaces).map((item) =>
          getWorkspaceId(item) === getWorkspaceId(freshWorkspace)
            ? freshWorkspace
            : item,
        ),
      );
      setWorkspaces((prev) =>
        (Array.isArray(prev) ? prev : []).map((item) =>
          getWorkspaceId(item) === getWorkspaceId(freshWorkspace)
            ? freshWorkspace
            : item,
        ),
      );
    } catch (error) {
      console.error("Error loading workspace boards:", error);
    }
  };

  const handleOpenWorkspace = async (workspace) => {
    try {
      const workspaceId = getWorkspaceId(workspace);
      if (!workspaceId) return;
      const response = await API.patch(`/workspaces/${workspaceId}/activate`);
      const activatedWorkspace = response.data;

      const activatedId = getWorkspaceId(activatedWorkspace);
      const updatedWorkspaces = effectiveWorkspaces.map((item) => ({
        ...item,
        isActive: getWorkspaceId(item) === activatedId,
      }));

      setBackendWorkspaces(updatedWorkspaces);
      setWorkspaces(updatedWorkspaces);
      setBackendCurrentWorkspace(activatedWorkspace);
      setSelectedWorkspace(activatedWorkspace);

      if (typeof setCurrentWorkspace === "function") {
        setCurrentWorkspace(activatedWorkspace);
      }

      router.push(`/dashboard/workspace/${workspaceId}`);
    } catch (error) {
      console.error("Error activating workspace:", error);

      setBackendCurrentWorkspace(workspace);
      setSelectedWorkspace(workspace);

      if (typeof setCurrentWorkspace === "function") {
        setCurrentWorkspace(workspace);
      }

      router.push(`/dashboard/workspace/${getWorkspaceId(workspace)}`);
    }
  };

  const cards = [
    {
      title: "Add new Workspace",
      description: effectiveCurrentWorkspace
        ? `Create a workspace for ${effectiveCurrentWorkspace.name}`
        : "Create a new workspace",
      icon: Plus,
      highlight: true,
      onClick: () => setShowCreateModal(true),
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

  return (
    <>
      <div className="w-full max-w-10xl mx-auto">
        <div className="mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">Workspace</h1>

          <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-gray-400">
            Manage your boards and collaborate with your team
          </p>

          {effectiveCurrentWorkspace && (
            <div className="mt-4 inline-flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: effectiveCurrentWorkspace.color || "#7c3aed",
                }}
              />
              <span className="text-sm text-indigo-700 dark:text-indigo-300">
                Active Workspace:{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {effectiveCurrentWorkspace.name}
                </span>
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-6 border-b border-slate-200 pb-3 mb-8 overflow-x-auto text-sm dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("recents")}
            className={`whitespace-nowrap pb-2 transition ${activeTab === "recents"
                ? "border-b-2 border-indigo-600 text-slate-900 dark:border-indigo-500 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
          >
            Recents
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("content")}
            className={`whitespace-nowrap pb-2 transition ${activeTab === "content"
                ? "border-b-2 border-indigo-600 text-slate-900 dark:border-indigo-500 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              }`}
          >
            Content
          </button>
        </div>

        {activeTab === "recents" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 mb-10 sm:mb-12">
              {cards.map((card, i) => {
                const Icon = card.icon;

                return (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.04 }}
                    onClick={card.comingSoon ? undefined : card.onClick}
                    className={`relative p-5 sm:p-6 rounded-xl border transition ${card.comingSoon
                        ? "cursor-not-allowed opacity-80"
                        : "cursor-pointer"
                      } ${card.highlight
                        ? "border-dashed border-indigo-300 bg-white dark:border-indigo-500 dark:bg-[#111827]"
                        : "border-slate-200 bg-white dark:border-gray-800 dark:bg-[#111827]"
                      }`}
                  >
                    {card.comingSoon && (
                      <span className="absolute top-3 right-3 text-[10px] px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-600/20 dark:text-indigo-400">
                        Coming Soon
                      </span>
                    )}

                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                      <Icon size={18} />
                    </div>

                    <h3 className="font-semibold mb-1 text-sm sm:text-base text-slate-900 dark:text-white">
                      {card.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-gray-400">
                      {card.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "recents" && (
          <div className="mb-10">
            <h2 className="text-base sm:text-lg font-semibold mb-5 sm:mb-6 text-slate-900 dark:text-white">
              Recent Workspaces
            </h2>

            {loadingWorkspaces && effectiveWorkspaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-slate-500 dark:border-gray-700 dark:bg-[#111827] dark:text-gray-400">
                Loading workspaces...
              </div>
            ) : !effectiveWorkspaces || effectiveWorkspaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-slate-500 dark:border-gray-700 dark:bg-[#111827] dark:text-gray-400">
                No workspaces created yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {recentWorkspaces.map((workspace) => (
                  <motion.div
                    key={getWorkspaceId(workspace)}
                    whileHover={{ y: -3 }}
                    onClick={() => handleWorkspacePreview(workspace)}
                    className={`flex min-h-[170px] flex-col rounded-xl bg-white border p-5 sm:p-6 cursor-pointer transition dark:bg-[#111827] ${getWorkspaceId(recentBoardsWorkspace) === getWorkspaceId(workspace)
                        ? "border-indigo-400 ring-1 ring-indigo-300/60 dark:border-indigo-500 dark:ring-indigo-500/40"
                        : "border-slate-200 dark:border-gray-800"
                      }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{
                            backgroundColor: workspace.color || "#7c3aed",
                          }}
                        />
                        <h3 className="font-medium text-sm sm:text-base truncate text-slate-900 dark:text-white">
                          {workspace.name}
                        </h3>
                      </div>

                      {(getWorkspaceId(effectiveCurrentWorkspace) === getWorkspaceId(workspace) ||
                        workspace?.isActive) && (
                          <span className="text-[10px] px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 shrink-0 dark:border-indigo-500/30 dark:bg-indigo-600/20 dark:text-indigo-400">
                            Active
                          </span>
                        )}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 mb-5 min-h-[40px] dark:text-gray-400">
                      {workspace.description || "No description provided"}
                    </p>

                    <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0 text-xs leading-5 text-slate-500 dark:text-gray-500">
                        Owner: {workspace.owner?.name || workspace.owner || "Unknown"}
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenWorkspace(workspace);
                        }}
                        className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/20"
                      >
                        Open
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "recents" && (
          <div className="mb-10">
            <h2 className="text-base sm:text-lg font-semibold mb-5 sm:mb-6 text-slate-900 dark:text-white">
              Recent Boards
            </h2>

            {recentBoards.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
                {recentBoards.map((board, index) => (
                  <motion.div
                    key={board?._id || board?.id || index}
                    whileHover={{ scale: 1.03 }}
                    className="p-5 sm:p-6 rounded-xl bg-white border border-slate-200 dark:bg-[#111827] dark:border-gray-800"
                  >
                    <h3 className="font-medium text-sm sm:text-base text-slate-900 dark:text-white">
                      {board?.name || board?.title || `Board ${index + 1}`}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-500 mt-1 dark:text-gray-500">
                      {recentBoardsWorkspace?.name || "Workspace"}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2 dark:text-gray-400">
                      {formatBoardUpdatedAt(board?.updatedAt || board?.createdAt)}
                    </p>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-6 text-slate-500 dark:border-gray-700 dark:bg-[#111827] dark:text-gray-400">
                No boards in {recentBoardsWorkspace?.name || "this workspace"} yet.
              </div>
            )}
          </div>
        )}

        {activeTab === "content" && (
          <div className="mt-10">
            <h2 className="text-base sm:text-lg font-semibold mb-5 sm:mb-6 text-slate-900 dark:text-white">
              Available Workspaces
            </h2>

            {loadingWorkspaces && effectiveWorkspaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-slate-500 dark:border-gray-700 dark:bg-[#111827] dark:text-gray-400">
                Loading workspaces...
              </div>
            ) : !effectiveWorkspaces || effectiveWorkspaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-slate-500 dark:border-gray-700 dark:bg-[#111827] dark:text-gray-400">
                No workspaces created yet.
              </div>
            ) : (
              <div className="max-h-[370px] overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                  {effectiveWorkspaces.map((workspace) => (
                    <motion.div
                      key={getWorkspaceId(workspace)}
                      whileHover={{ y: -3 }}
                      onClick={() => handleWorkspacePreview(workspace)}
                      className={`flex min-h-[170px] flex-col rounded-xl bg-white border p-5 sm:p-6 cursor-pointer transition dark:bg-[#111827] ${getWorkspaceId(recentBoardsWorkspace) === getWorkspaceId(workspace)
                          ? "border-indigo-400 ring-1 ring-indigo-300/60 dark:border-indigo-500 dark:ring-indigo-500/40"
                          : "border-slate-200 dark:border-gray-800"
                        }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-4 h-4 rounded-full shrink-0"
                            style={{
                              backgroundColor: workspace.color || "#7c3aed",
                            }}
                          />
                          <h3 className="font-medium text-sm sm:text-base truncate text-slate-900 dark:text-white">
                            {workspace.name}
                          </h3>
                        </div>

                        {(getWorkspaceId(effectiveCurrentWorkspace) === getWorkspaceId(workspace) ||
                          workspace?.isActive) && (
                            <span className="text-[10px] px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 shrink-0 dark:border-indigo-500/30 dark:bg-indigo-600/20 dark:text-indigo-400">
                              Active
                            </span>
                          )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 mb-5 min-h-[40px] dark:text-gray-400">
                        {workspace.description || "No description provided"}
                      </p>

                      <div className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0 text-xs leading-5 text-slate-500 dark:text-gray-500">
                          Owner: {workspace.owner?.name || workspace.owner || "Unknown"}
                        </div>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenWorkspace(workspace);
                          }}
                          className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:border-indigo-400 dark:hover:bg-indigo-500/20"
                        >
                          Open
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            <h2 className="mt-10 text-base sm:text-lg font-semibold mb-5 sm:mb-6 text-slate-900 dark:text-white">
              Workspace Details
            </h2>

            {detailsWorkspace ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-gray-800 dark:bg-[#111827] dark:text-gray-300">
                  <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-gray-500">Workspace</p>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {detailsWorkspace.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                    {detailsWorkspace.description || "No description provided."}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-gray-800 dark:bg-[#111827] dark:text-gray-300">
                  <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-gray-500">Owner</p>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {detailsWorkspace.owner?.name || detailsWorkspace.owner || "Unknown"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                    {detailsWorkspace.owner?.email || "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-gray-800 dark:bg-[#111827] dark:text-gray-300">
                  <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-gray-500">Created</p>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {detailsWorkspace.createdAt
                      ? new Date(detailsWorkspace.createdAt).toLocaleDateString("en-US")
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-gray-800 dark:bg-[#111827] dark:text-gray-300">
                  <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-gray-500">Members</p>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {Array.isArray(detailsWorkspace.members)
                      ? detailsWorkspace.members.length
                      : detailsWorkspace.membersCount || 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-gray-800 dark:bg-[#111827] dark:text-gray-300">
                  <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-gray-500">Boards</p>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {Array.isArray(detailsWorkspace.boards)
                      ? detailsWorkspace.boards.length
                      : 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-gray-800 dark:bg-[#111827] dark:text-gray-300">
                  <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-gray-500">Active board</p>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {detailsWorkspace.boards?.[0]?.name || "No active board"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-slate-500 dark:border-gray-700 dark:bg-[#111827] dark:text-gray-400">
                No workspace selected yet.
              </div>
            )}

          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateWorkspaceModal
            newWorkspace={pageWorkspace}
            setNewWorkspace={setPageWorkspace}
            setShowCreateModal={setShowCreateModal}
            onCreateWorkspace={handleCreateWorkspace}
            memberOptions={modalMemberOptions}
            ownerName={currentUser?.name || "User"}
            creatingWorkspace={creatingWorkspace}
          />
        )}
      </AnimatePresence>

    </>
  );
}
