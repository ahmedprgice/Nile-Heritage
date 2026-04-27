"use client";

import { useEffect, useMemo, useRef, useState, useDeferredValue } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  Filter,
  Layers,
  Lightbulb,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  X,
} from "lucide-react";
import { notesApi } from "@/lib/notesApi";
import api from "@/lib/http";
import { listDirectoryUsers } from "@/lib/users";

const STORAGE_KEY = "nexora_workspace_notes_v2";
const STATUSES = ["draft", "review", "published", "action"];
const SERVER_ID_PATTERN = /^[a-f\d]{24}$/i;
const TYPES = [
  { value: "other", label: "Other", icon: FileText },
  { value: "meeting", label: "Meeting", icon: MessageSquareText },
  { value: "decision", label: "Decision", icon: ShieldCheck },
  { value: "process", label: "Process", icon: BookOpen },
  { value: "risk", label: "Risk", icon: AlertCircle },
  { value: "idea", label: "Idea", icon: Lightbulb },
];
const WORKFLOW_TYPES = TYPES.filter((type) => type.value !== "idea");

const NOTE_TEMPLATES = {
  other: {
    title: "New note",
    summary: "Capture anything on your mind.",
    body: "",
    status: "draft",
    priority: "low",
    tags: [],
    actions: [],
  },
  meeting: {
    title: "Meeting notes",
    summary: "Capture the agenda, decisions, blockers, and follow-up owners.",
    body:
      "Agenda:\n- \n\nDecisions:\n- \n\nRisks / blockers:\n- \n\nFollow-up actions:\n- ",
    status: "action",
    priority: "medium",
    tags: ["meeting", "follow-up"],
    actions: [{ id: "template-meeting-action", text: "Share meeting recap with the team", done: false }],
  },
  decision: {
    title: "Decision record",
    summary: "Document what was decided, why, and what changes next.",
    body: "Decision:\n- \n\nContext:\n- \n\nOptions considered:\n- \n\nImpact:\n- \n\nOwner / next step:\n- ",
    status: "review",
    priority: "high",
    tags: ["decision", "leadership"],
    actions: [{ id: "template-decision-action", text: "Confirm decision with stakeholders", done: false }],
  },
  process: {
    title: "Process document",
    summary: "Create a repeatable checklist or SOP for the team.",
    body: "Purpose:\n- \n\nWhen to use this process:\n- \n\nSteps:\n1. \n2. \n3. \n\nDefinition of done:\n- ",
    status: "draft",
    priority: "medium",
    tags: ["process", "sop"],
    actions: [{ id: "template-process-action", text: "Review process with the team", done: false }],
  },
  risk: {
    title: "Risk note",
    summary: "Track a risk, its impact, and the mitigation plan.",
    body: "Risk:\n- \n\nImpact:\n- \n\nLikelihood:\n- \n\nMitigation plan:\n- \n\nOwner:\n- ",
    status: "action",
    priority: "high",
    tags: ["risk", "mitigation"],
    actions: [{ id: "template-risk-action", text: "Assign risk owner and mitigation date", done: false }],
  },
  idea: {
    title: "Idea note",
    summary: "Capture an opportunity and decide whether to explore it.",
    body: "Idea:\n- \n\nWhy it matters:\n- \n\nPotential value:\n- \n\nNext experiment:\n- ",
    status: "draft",
    priority: "low",
    tags: ["idea", "opportunity"],
    actions: [{ id: "template-idea-action", text: "Decide whether to explore this idea", done: false }],
  },
};

const NOTE_BODY_LABELS = {
  other: "Note",
  meeting: "Agenda, decisions, and blockers",
  decision: "Decision details",
  process: "Process details",
  risk: "Risk details",
  idea: "Idea details",
};

const NOTE_BODY_PLACEHOLDERS = {
  other: "Write your note...",
  meeting: "Capture agenda, decisions, blockers, and follow-ups.",
  decision: "Document the decision, context, and next steps.",
  process: "Outline the process steps and definition of done.",
  risk: "Capture the risk, impact, and mitigation plan.",
  idea: "Capture the idea and how to explore it.",
};

const SEED_NOTES = [
  {
    id: "seed-kickoff",
    title: "Client kickoff notes",
    summary: "Confirm scope, owners, risks, and first milestones.",
    body: "Agenda:\n- Align project goals\n- Confirm workstream owners\n- Capture risks and questions\n\nDecision:\nReview progress every Monday morning.",
    type: "meeting",
    status: "action",
    priority: "high",
    owner: "Sarah",
    dueDate: "2026-04-10",
    tags: ["client", "delivery"],
    actions: [
      { id: "a1", text: "Send meeting recap to the client", done: false },
      { id: "a2", text: "Prepare first milestone board", done: true },
    ],
    createdAt: "2026-04-03T09:00:00.000Z",
    updatedAt: "2026-04-06T12:30:00.000Z",
  },
  {
    id: "seed-release",
    title: "Release checklist",
    summary: "Reusable process for shipping product updates safely.",
    body: "Before release:\n- Confirm acceptance criteria\n- Review QA notes\n- Notify the team in chat\n- Update docs if workflows changed",
    type: "process",
    status: "published",
    priority: "medium",
    owner: "Adham",
    dueDate: "",
    tags: ["release", "qa", "docs"],
    actions: [{ id: "a3", text: "Review checklist after next release", done: false }],
    createdAt: "2026-04-01T08:00:00.000Z",
    updatedAt: "2026-04-05T15:15:00.000Z",
  },
  {
    id: "seed-priorities",
    title: "Q2 product priorities",
    summary: "Track decisions the leadership team agreed on.",
    body: "Priority decisions:\n1. Improve board permissions\n2. Make notes useful for company knowledge\n3. Polish subscription flow",
    type: "decision",
    status: "review",
    priority: "high",
    owner: "Nex",
    dueDate: "2026-04-15",
    tags: ["strategy", "q2"],
    actions: [],
    createdAt: "2026-04-02T10:00:00.000Z",
    updatedAt: "2026-04-06T10:20:00.000Z",
  },
];

function makeId(prefix = "note") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getWorkspaceId(workspace) {
  return workspace?._id || workspace?.id || "";
}

function normalizeMember(member) {
  if (!member) return null;
  const id = String(member.id || member._id || member.userId || "").trim();
  const email = String(member.email || "").trim();
  const name = String(member.name || member.fullName || member.username || "").trim();
  const role = String(member.role || member.userRole || member.position || member.title || "Member").trim();
  const derivedName = name || (email ? email.split("@")[0] : "") || "User";
  const key = id || email || derivedName;
  if (!key) return null;
  return { id, email, name: derivedName, role };
}

function memberValue(member) {
  return String(member?.id || member?.email || member?.name || "").trim();
}

function addToken(set, value) {
  const token = String(value || "").trim();
  if (!token) return;
  set.add(token);
  set.add(token.toLowerCase());
}

function buildWorkspaceMemberTokens(workspace) {
  const tokens = new Set();
  if (!workspace) return tokens;
  addToken(tokens, workspace.owner);
  (workspace.members || []).forEach((member) => addToken(tokens, member));
  (workspace.memberUsers || []).forEach((member) => {
    addToken(tokens, member?.id || member?._id || member?.userId);
    addToken(tokens, member?.email);
    addToken(tokens, member?.name);
  });
  return tokens;
}

function typeMeta(type) {
  return TYPES.find((item) => item.value === type) || TYPES[0];
}

function isHiddenPlaceholder(note) {
  return Boolean(note?._isNewPlaceholder);
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function chipClass(kind, value) {
  if (kind === "priority") {
    if (value === "high") return "border-rose-500/30 bg-rose-500/15 text-rose-300";
    if (value === "medium") return "border-amber-500/30 bg-amber-500/15 text-amber-300";
    return "border-cyan-500/30 bg-cyan-500/15 text-cyan-300";
  }
  if (value === "published") return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
  if (value === "review") return "border-amber-500/30 bg-amber-500/15 text-amber-300";
  if (value === "action") return "border-indigo-500/30 bg-indigo-500/15 text-indigo-300";
  return "border-slate-500/30 bg-slate-500/15 text-slate-300";
}

export default function Notes({ currentWorkspace, workspaces, currentUser, memberOptions = [] }) {
  const activeWorkspace = useMemo(() => {
    if (getWorkspaceId(currentWorkspace)) return currentWorkspace;
    if (!Array.isArray(workspaces) || workspaces.length === 0) return null;
    return workspaces.find((workspace) => getWorkspaceId(workspace) && workspace?.isActive) || workspaces[0] || null;
  }, [currentWorkspace, workspaces]);
  const [fallbackWorkspaceId, setFallbackWorkspaceId] = useState("");
  const [directoryMembers, setDirectoryMembers] = useState([]);
  const activeWorkspaceId = getWorkspaceId(activeWorkspace) || fallbackWorkspaceId;

  const storageKey = STORAGE_KEY;
  const [notes, setNotes] = useState(SEED_NOTES);
  const [activeNote, setActiveNote] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [view, setView] = useState("board");
  const [showFilters, setShowFilters] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState(null);
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const [syncState, setSyncState] = useState({
    loading: true,
    saving: false,
    backendReady: false,
    error: "",
  });
  const deferredSearch = useDeferredValue(search);
  const suppressCardClickRef = useRef(false);
  const pendingSaveTimersRef = useRef({});
  const pendingSavePatchesRef = useRef({});

  const getOwnerLabel = (owner) => {
    if (!owner) return "Team";
    if (typeof owner === "string") return owner;
    return owner.name || owner.email || owner.role || "Team";
  };

  useEffect(() => {
    let mounted = true;
    listDirectoryUsers()
      .then((users) => {
        if (!mounted) return;
        setDirectoryMembers(Array.isArray(users) ? users : []);
      })
      .catch(() => {
        if (!mounted) return;
        setDirectoryMembers([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const teamMemberOptions = useMemo(() => {
    const merged = [...(Array.isArray(memberOptions) ? memberOptions : []), ...directoryMembers];
    const dedup = new Map();
    merged.forEach((raw) => {
      const normalized = normalizeMember(raw);
      if (!normalized) return;
      const key = memberValue(normalized);
      if (!key || dedup.has(key)) return;
      dedup.set(key, normalized);
    });

    const creatorTokens = new Set(
      [
        String(currentUser?.id || "").toLowerCase(),
        String(currentUser?._id || "").toLowerCase(),
        String(currentUser?.email || "").toLowerCase(),
        String(currentUser?.name || "").toLowerCase(),
      ].filter(Boolean)
    );

    const allMembers = Array.from(dedup.values()).filter((member) => {
      const candidateTokens = [
        String(member.id || "").toLowerCase(),
        String(member.email || "").toLowerCase(),
        String(member.name || "").toLowerCase(),
      ].filter(Boolean);
      return !candidateTokens.some((token) => creatorTokens.has(token));
    });
    const workspaceTokens = buildWorkspaceMemberTokens(activeWorkspace);
    if (!workspaceTokens.size) return allMembers;

    const filtered = allMembers.filter((member) => {
      const id = String(member.id || "");
      return (
        workspaceTokens.has(id) ||
        workspaceTokens.has(id.toLowerCase()) ||
        workspaceTokens.has(member.email) ||
        workspaceTokens.has(String(member.email || "").toLowerCase()) ||
        workspaceTokens.has(member.name) ||
        workspaceTokens.has(String(member.name || "").toLowerCase())
      );
    });

    return filtered.length ? filtered : allMembers;
  }, [memberOptions, directoryMembers, activeWorkspace, currentUser]);

  const isPrivateVisibility = activeNote?.visibility === "private";
  const [allowedUserPicker, setAllowedUserPicker] = useState("");


  const loadNotesFromStorage = () => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      setNotes(SEED_NOTES);
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      setNotes(Array.isArray(parsed) ? parsed : SEED_NOTES);
    } catch {
      window.localStorage.removeItem(storageKey);
      setNotes(SEED_NOTES);
    }
  };

  useEffect(() => {
    let mounted = true;
    const knownWorkspaceId = getWorkspaceId(activeWorkspace);
    if (knownWorkspaceId) {
      return () => {
        mounted = false;
      };
    }

    api
      .get("/api/workspaces")
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        const fallback =
          list.find((workspace) => workspace?.isActive && getWorkspaceId(workspace)) ||
          list.find((workspace) => getWorkspaceId(workspace)) ||
          null;
        setFallbackWorkspaceId(getWorkspaceId(fallback));
      })
      .catch(() => {
        if (!mounted) return;
        setFallbackWorkspaceId("");
      });

    return () => {
      mounted = false;
    };
  }, [activeWorkspace]);

  useEffect(() => {
    let mounted = true;

    if (!activeWorkspaceId) {
      const timer = window.setTimeout(() => {
        if (!mounted) return;
        setNotes([]);
        setSyncState({
          loading: false,
          saving: false,
          backendReady: false,
          error: "Select a workspace to load notes.",
        });
      }, 0);
      return () => {
        mounted = false;
        window.clearTimeout(timer);
      };
    }

    const loadingTimer = window.setTimeout(() => {
      if (!mounted) return;
      setSyncState((prev) => ({ ...prev, loading: true, error: "" }));
    }, 0);
    notesApi
      .list({ workspaceId: activeWorkspaceId })
      .then((serverNotes) => {
        if (!mounted) return;
        setNotes(serverNotes);
        setSyncState({ loading: false, saving: false, backendReady: true, error: "" });
      })
      .catch(() => {
        if (!mounted) return;
        loadNotesFromStorage();
        setSyncState({
          loading: false,
          saving: false,
          backendReady: false,
          error: "Notes are running in offline mode. Changes are saved on this browser until the backend is available.",
        });
      });

    return () => {
      mounted = false;
      window.clearTimeout(loadingTimer);
    };
  }, [activeWorkspaceId, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(storageKey, JSON.stringify(notes));
  }, [notes, storageKey]);

  useEffect(
    () => () => {
      Object.values(pendingSaveTimersRef.current).forEach((timer) => clearTimeout(timer));
    },
    []
  );

  useEffect(() => {
    const sync = (event) => {
      if (event.key !== storageKey || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        if (Array.isArray(next)) setNotes(next);
      } catch {
        // Ignore invalid data from older note versions.
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const visibleNotes = useMemo(
    () => notes.filter((note) => !isHiddenPlaceholder(note)),
    [notes]
  );

  const focusItems = useMemo(() => {
    const openActions = visibleNotes
      .flatMap((note) =>
        (note.actions || [])
          .filter((action) => !action.done)
          .map((action) => ({
            id: `${note.id}-${action.id}`,
            noteId: note.id,
            title: action.text,
            context: note.title,
            type: "Action",
          }))
      )
      .slice(0, 4);

    const decisions = visibleNotes
      .filter((note) => note.type === "decision" || note.status === "review")
      .slice(0, 3)
      .map((note) => ({
        id: note.id,
        noteId: note.id,
        title: note.title,
        context: note.summary,
        type: "Decision",
      }));

    return [...openActions, ...decisions].slice(0, 5);
  }, [visibleNotes]);

  const filteredNotes = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return visibleNotes
      .filter((note) => {
        const text = [note.title, note.summary, note.body, getOwnerLabel(note.owner), ...(note.tags || [])].join(" ").toLowerCase();
        return !query || text.includes(query);
      })
      .filter((note) => typeFilter === "all" || note.type === typeFilter)
      .filter((note) => statusFilter === "all" || note.status === statusFilter)
      .sort((a, b) => {
        if (sortBy === "due") return (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
        if (sortBy === "priority") return { high: 3, medium: 2, low: 1 }[b.priority] - { high: 3, medium: 2, low: 1 }[a.priority];
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
  }, [visibleNotes, deferredSearch, sortBy, statusFilter, typeFilter]);

  const groupedNotes = useMemo(
    () => STATUSES.map((status) => ({ status, items: filteredNotes.filter((note) => note.status === status) })),
    [filteredNotes]
  );

  const isServerNote = (id) => SERVER_ID_PATTERN.test(String(id || ""));

  const persistNotePatch = (id, patch) => {
    if (!syncState.backendReady || !isServerNote(id)) return;

    pendingSavePatchesRef.current[id] = {
      ...(pendingSavePatchesRef.current[id] || {}),
      ...patch,
    };

    if (pendingSaveTimersRef.current[id]) clearTimeout(pendingSaveTimersRef.current[id]);

    pendingSaveTimersRef.current[id] = window.setTimeout(async () => {
      const pendingPatch = pendingSavePatchesRef.current[id] || {};
      delete pendingSavePatchesRef.current[id];
      delete pendingSaveTimersRef.current[id];

      setSyncState((prev) => ({ ...prev, saving: true, error: "" }));
      try {
        const saved = await notesApi.update(id, pendingPatch);
        setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...saved } : note)));
        setActiveNote((prev) => (prev?.id === id ? { ...prev, ...saved } : prev));
        setSyncState((prev) => ({ ...prev, saving: false, backendReady: true, error: "" }));
      } catch {
        setSyncState((prev) => ({
          ...prev,
          saving: false,
          error: "Could not sync the latest note change. It is saved locally and will stay visible in this browser.",
        }));
      }
    }, 450);
  };

  const updateNote = (id, patch) => {
    const updatedAt = new Date().toISOString();
    setNotes((prev) =>
      prev.map((note) =>
        note.id === id
          ? { ...note, ...patch, updatedAt, _isNewPlaceholder: false }
          : note
      )
    );
    setActiveNote((prev) =>
      prev?.id === id
        ? { ...prev, ...patch, updatedAt, _isNewPlaceholder: false }
        : prev
    );
    persistNotePatch(id, patch);
  };

  const saveNoteNow = async () => {
    if (!activeNote) return;
    const id = activeNote.id;

    if (!syncState.backendReady || !isServerNote(id)) {
      setSyncState((prev) => ({
        ...prev,
        error: "This note is saved locally. Connect to sync with the server.",
      }));
      return;
    }

    if (pendingSaveTimersRef.current[id]) {
      clearTimeout(pendingSaveTimersRef.current[id]);
      delete pendingSaveTimersRef.current[id];
    }

    const pendingPatch = pendingSavePatchesRef.current[id] || {};
    delete pendingSavePatchesRef.current[id];

    setSyncState((prev) => ({ ...prev, saving: true, error: "" }));
    try {
      const saved = await notesApi.update(id, { ...activeNote, ...pendingPatch });
      setNotes((prev) => prev.map((note) => (note.id === id ? { ...note, ...saved } : note)));
      setActiveNote((prev) => (prev?.id === id ? { ...prev, ...saved } : prev));
      setSyncState((prev) => ({ ...prev, saving: false, backendReady: true, error: "" }));
    } catch {
      setSyncState((prev) => ({
        ...prev,
        saving: false,
        error: "Could not save this note. It is stored locally in this browser.",
      }));
    }
  };

  const addNote = async (type = "other") => {
    setSyncState((prev) => ({ ...prev, error: "" }));
    const now = new Date().toISOString();
    const template = NOTE_TEMPLATES[type] || NOTE_TEMPLATES.other;
    const note = {
      id: makeId(),
      title: template.title,
      summary: template.summary,
      body: template.body,
      type,
      status: template.status,
      priority: template.priority,
      owner: "Team",
      dueDate: "",
      tags: template.tags,
      actions: template.actions.map((action) => ({ ...action, id: makeId("action") })),
      visibility: "public",
      allowedUsers: [],
      createdAt: now,
      updatedAt: now,
      _isNewPlaceholder: true,
    };
    setNotes((prev) => [note, ...prev]);
    setActiveNote(note);
    if (!activeWorkspaceId) {
      setSyncState((prev) => ({
        ...prev,
        saving: false,
        error: "Select a workspace to save notes.",
      }));
      return;
    }

    setSyncState((prev) => ({ ...prev, saving: true, error: "" }));
    try {
      const saved = await notesApi.create({
        ...note,
        workspaceId: activeWorkspaceId,
      });
      setNotes((prev) =>
        prev.map((item) =>
          item.id === note.id
            ? { ...saved, _isNewPlaceholder: true }
            : item
        )
      );
      setActiveNote((prev) =>
        prev?.id === note.id
          ? { ...saved, _isNewPlaceholder: true }
          : prev
      );
      setSyncState((prev) => ({ ...prev, saving: false, backendReady: true, error: "" }));
    } catch {
      setSyncState((prev) => ({
        ...prev,
        saving: false,
        error: "Could not create this note on the server. It is saved locally in this browser.",
      }));
    }
  };

  const deleteNote = async (id) => {
    setNotes((prev) => prev.filter((note) => note.id !== id));
    setActiveNote((prev) => (prev?.id === id ? null : prev));
    if (!syncState.backendReady || !isServerNote(id)) return;

    if (pendingSaveTimersRef.current[id]) {
      clearTimeout(pendingSaveTimersRef.current[id]);
      delete pendingSaveTimersRef.current[id];
      delete pendingSavePatchesRef.current[id];
    }

    setSyncState((prev) => ({ ...prev, saving: true, error: "" }));
    try {
      await notesApi.remove(id);
      setSyncState((prev) => ({ ...prev, saving: false, backendReady: true, error: "" }));
    } catch {
      setSyncState((prev) => ({
        ...prev,
        saving: false,
        error: "Could not delete this note on the server. Refresh to confirm the server state.",
      }));
    }
  };

  const closeActiveNote = () => {
    if (!activeNote) return;
    const noteId = activeNote.id;
    const shouldDiscard = isHiddenPlaceholder(activeNote);
    if (shouldDiscard) {
      setActiveNote(null);
      void deleteNote(noteId);
      return;
    }
    setActiveNote(null);
  };

  const updateAction = (note, actionId, patch) => {
    updateNote(note.id, { actions: (note.actions || []).map((item) => (item.id === actionId ? { ...item, ...patch } : item)) });
  };

  const moveNoteToStatus = (noteId, status) => {
    if (!noteId || !STATUSES.includes(status)) return;
    const updatedAt = new Date().toISOString();
    setNotes((prev) =>
      prev.map((note) => (note.id === noteId && note.status !== status ? { ...note, status, updatedAt } : note))
    );
    setActiveNote((prev) => (prev?.id === noteId && prev.status !== status ? { ...prev, status, updatedAt } : prev));
  };

  const handleCardDragStart = (event, note) => {
    suppressCardClickRef.current = true;
    setDraggedNoteId(note.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", note.id);
  };

  const handleCardDragEnd = () => {
    setDraggedNoteId(null);
    setDragOverStatus(null);
    window.setTimeout(() => {
      suppressCardClickRef.current = false;
    }, 0);
  };

  const handleColumnDrop = (event, status) => {
    event.preventDefault();
    const noteId = event.dataTransfer.getData("text/plain") || draggedNoteId;
    moveNoteToStatus(noteId, status);
    handleCardDragEnd();
  };

  const renderCard = (note) => {
    const meta = typeMeta(note.type);
    const Icon = meta.icon;
    const openActions = (note.actions || []).filter((item) => !item.done).length;
    return (
      <motion.button
        key={note.id}
        layout
        draggable
        whileHover={{ y: -3 }}
        onDragStart={(event) => handleCardDragStart(event, note)}
        onDragEnd={handleCardDragEnd}
        onClick={() => {
          if (suppressCardClickRef.current) return;
          setActiveNote(note);
        }}
        className={`w-full cursor-grab rounded-2xl border border-gray-800 bg-[#111827] p-5 text-left shadow-lg transition hover:border-indigo-500 hover:bg-[#162033] active:cursor-grabbing ${
          draggedNoteId === note.id ? "scale-[0.98] opacity-60 ring-2 ring-indigo-500/50" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30">
              <Icon size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{meta.label}</p>
              <h3 className="mt-1 truncate font-semibold text-white">{note.title || "Untitled note"}</h3>
            </div>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${chipClass("priority", note.priority)}`}>
            {note.priority}
          </span>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-300">{note.summary || note.body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${chipClass("status", note.status)}`}>{note.status}</span>
          {(note.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300">#{tag}</span>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-gray-800 pt-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5 truncate"><User size={14} />{getOwnerLabel(note.owner)}</span>
          <span className="flex items-center gap-1.5 truncate"><CalendarDays size={14} />{formatDate(note.dueDate || note.updatedAt)}</span>
          <span className="flex items-center justify-end gap-1.5"><CheckCircle2 size={14} />{openActions} open</span>
        </div>
      </motion.button>
    );
  };

  return (
    <div className="w-full space-y-6">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Real-Time Notes
            </h1>
            <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200">
              .docx system
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400 sm:text-base">
            Capture meeting notes, decisions, process docs, risks, and follow-up actions for your company workspace.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`rounded-full border px-2.5 py-1 ${
                syncState.backendReady
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {syncState.loading
                ? "Loading notes..."
                : syncState.backendReady
                  ? syncState.saving
                    ? "Saving..."
                    : "Synced to company workspace"
                  : "Offline browser mode"}
            </span>
            {syncState.error && <span className="text-amber-300">{syncState.error}</span>}
          </div>
        </div>
        <button onClick={() => addNote("other")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
          <Plus size={16} />
          Add Note
        </button>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-white">Start from a company workflow</h2>
              <p className="text-sm text-gray-400">
                Use notes as meeting records, decision logs, SOPs, risk registers, and idea backlog.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            {WORKFLOW_TYPES.map((type) => {
              const Icon = type.icon;
              const template = NOTE_TEMPLATES[type.value];
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => addNote(type.value)}
                  className="flex min-h-[78px] items-start gap-3 rounded-xl border border-gray-800 bg-[#1e293b] p-3 text-left transition hover:border-indigo-500 hover:bg-[#24324a]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0">
                    <p className="font-semibold text-white">{type.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400">
                      {template.summary}
                    </p>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-[#111827] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">Focus queue</h2>
              <p className="mt-1 text-sm text-gray-400">Actions and decisions that need attention.</p>
            </div>
            <span className="rounded-full bg-[#1e293b] px-2.5 py-1 text-xs text-gray-300">
              {focusItems.length}
            </span>
          </div>
          <div className="max-h-[204px] space-y-2 overflow-y-auto pr-1">
            {focusItems.map((item) => {
              const note = notes.find((entry) => entry.id === item.noteId);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => note && setActiveNote(note)}
                  className="w-full rounded-xl border border-gray-800 bg-[#1e293b] p-3 text-left transition hover:border-indigo-500"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                      {item.type}
                    </span>
                    <span className="text-[11px] text-gray-500">{note?.owner || "Team"}</span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-gray-400">{item.context}</p>
                </button>
              );
            })}
            {focusItems.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-500">
                No open actions or review decisions yet.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 border-t border-gray-800 pt-6 lg:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes, decisions, owners, tags..." className="w-full rounded-lg border border-gray-700 bg-[#1e293b] py-2.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setShowFilters((prev) => !prev)} className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-sm text-gray-200 transition hover:border-indigo-500"><Filter size={16} />Filter</button>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500">
            <option value="updated">Recently updated</option>
            <option value="priority">Priority</option>
            <option value="due">Due date</option>
          </select>
          {["board", "list"].map((mode) => (
            <button key={mode} onClick={() => setView(mode)} className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition ${view === mode ? "bg-indigo-600 text-white" : "border border-gray-700 bg-[#1e293b] text-gray-300 hover:border-indigo-500"}`}>{mode}</button>
          ))}
        </div>
      </section>

      <AnimatePresence>
        {showFilters && (
          <motion.section initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="grid gap-4 rounded-2xl border border-gray-800 bg-[#111827] p-4 md:grid-cols-3">
            <label className="space-y-2 text-sm text-gray-300"><span className="flex items-center gap-2"><Layers size={16} />Type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-white outline-none focus:border-indigo-500"><option value="all">All types</option>{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
            <label className="space-y-2 text-sm text-gray-300"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-white outline-none focus:border-indigo-500"><option value="all">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <div className="space-y-2 text-sm text-gray-300"><span className="flex items-center gap-2"><Plus size={16} />Quick templates</span><div className="flex flex-wrap gap-2">{TYPES.map((type) => <button key={type.value} onClick={() => addNote(type.value)} className="rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-xs text-gray-200 transition hover:border-indigo-500">{type.label}</button>)}</div></div>
          </motion.section>
        )}
      </AnimatePresence>

      {view === "board" ? (
        <section className="grid gap-4 xl:grid-cols-4">
          {groupedNotes.map((group) => (
            <div
              key={group.status}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dragOverStatus !== group.status) setDragOverStatus(group.status);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragOverStatus(group.status);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setDragOverStatus(null);
              }}
              onDrop={(event) => handleColumnDrop(event, group.status)}
              className={`rounded-2xl border bg-[#111827] p-4 transition ${
                dragOverStatus === group.status
                  ? "border-indigo-400 bg-indigo-500/10 shadow-[0_0_0_1px_rgba(129,140,248,0.45),0_18px_45px_rgba(79,70,229,0.18)]"
                  : "border-gray-800"
              }`}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold capitalize text-white">{group.status}</h2>
                <span className="rounded-full bg-[#1e293b] px-2.5 py-1 text-xs text-gray-300">{group.items.length}</span>
              </div>
              <div className="min-h-[120px] max-h-[560px] space-y-4 overflow-y-auto overscroll-contain pr-1">
                {group.items.map((note) => renderCard(note))}
                {group.items.length === 0 && (
                  <div
                    className={`rounded-xl border border-dashed p-5 text-sm transition ${
                      dragOverStatus === group.status
                        ? "border-indigo-400/70 bg-indigo-500/10 text-indigo-200"
                        : "border-gray-700 text-gray-500"
                    }`}
                  >
                    {draggedNoteId ? `Drop here to move to ${group.status}.` : `No ${group.status} notes yet.`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-gray-800 bg-[#111827]">
          <div className="max-h-[560px] overflow-y-auto overscroll-contain">
            {filteredNotes.map((note) => {
              const meta = typeMeta(note.type);
              const Icon = meta.icon;
              return (
                <button key={note.id} onClick={() => setActiveNote(note)} className="grid w-full gap-4 border-b border-gray-800 p-5 text-left transition hover:bg-[#162033] md:grid-cols-[1fr_160px_140px_120px]">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300"><Icon size={18} /></span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-white">{note.title}</h3>
                      <p className="mt-1 line-clamp-1 text-sm text-slate-400">{note.summary}</p>
                    </div>
                  </div>
                  <span className="text-sm text-slate-300">{getOwnerLabel(note.owner)}</span>
                  <span className={`h-fit w-fit rounded-full border px-2.5 py-1 text-xs capitalize ${chipClass("status", note.status)}`}>{note.status}</span>
                  <span className="text-sm text-slate-400">{formatDate(note.dueDate || note.updatedAt)}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {filteredNotes.length === 0 && (
        <section className="rounded-2xl border border-dashed border-gray-700 bg-[#111827] p-10 text-center">
          <FileText className="mx-auto text-slate-500" size={42} />
          <h2 className="mt-4 text-xl font-semibold text-white">No matching notes</h2>
          <p className="mt-2 text-sm text-slate-400">Try changing the filters or create a new note.</p>
        </section>
      )}

      <AnimatePresence>
        {activeNote && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeActiveNote}>
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-gray-700 bg-[#111827] shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-800 p-5">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Workspace note</p>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-indigo-500/35 bg-indigo-500/10 px-3 py-2 focus-within:border-indigo-400">
                    <Pencil size={16} className="shrink-0 text-indigo-300" />
                    <input
                      value={activeNote.title}
                      onChange={(event) => updateNote(activeNote.id, { title: event.target.value })}
                      placeholder="Note title"
                      className="w-full bg-transparent text-2xl font-bold text-white outline-none placeholder:text-slate-500"
                    />
                  </div>
                  <p className="mt-1 text-xs text-indigo-200/70">Click to edit title</p>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <button
                    onClick={() => deleteNote(activeNote.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                  >
                    <Trash2 size={15} />
                    Delete note
                  </button>
                  <button onClick={closeActiveNote} className="rounded-lg border border-gray-700 p-2 text-gray-300 hover:text-white"><X size={18} /></button>
                </div>
              </div>

              <div className="grid max-h-[calc(92vh-88px)] overflow-y-auto lg:grid-cols-[1fr_320px]">
                <div className="space-y-5 p-5">
                  <label className="block space-y-2"><span className="text-sm font-semibold text-gray-300">Executive summary</span><input value={activeNote.summary} onChange={(event) => updateNote(activeNote.id, { summary: event.target.value })} className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" /></label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-gray-300">
                      {NOTE_BODY_LABELS[activeNote.type] || "Details"}
                    </span>
                    <textarea
                      value={activeNote.body}
                      onChange={(event) => updateNote(activeNote.id, { body: event.target.value })}
                      placeholder={NOTE_BODY_PLACEHOLDERS[activeNote.type] || ""}
                      className="min-h-[300px] w-full resize-y rounded-lg border border-gray-700 bg-[#1e293b] px-4 py-4 text-sm leading-7 text-white outline-none focus:border-indigo-500"
                    />
                  </label>

                  <div className="rounded-2xl border border-gray-800 bg-[#111827] p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-semibold text-white">Follow-up actions</h3>
                      <button onClick={() => updateNote(activeNote.id, { actions: [...(activeNote.actions || []), { id: makeId("action"), text: "New follow-up action", done: false }] })} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"><Plus size={14} />Add action</button>
                    </div>
                    <div className="space-y-3">
                      {(activeNote.actions || []).map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-[#1e293b] p-3">
                          <input type="checkbox" checked={item.done} onChange={(event) => updateAction(activeNote, item.id, { done: event.target.checked })} className="h-4 w-4" />
                          <input value={item.text} onChange={(event) => updateAction(activeNote, item.id, { text: event.target.value })} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" />
                          <button onClick={() => updateNote(activeNote.id, { actions: (activeNote.actions || []).filter((action) => action.id !== item.id) })} className="text-slate-500 hover:text-red-400"><Trash2 size={16} /></button>
                        </div>
                      ))}
                      {(activeNote.actions || []).length === 0 && <p className="rounded-lg border border-dashed border-gray-700 p-4 text-sm text-gray-500">No actions yet. Add decisions and follow-ups so work does not get lost after meetings.</p>}
                    </div>
                  </div>
                </div>

                <aside className="space-y-4 border-t border-gray-800 bg-[#0f172a] p-5 lg:border-l lg:border-t-0">
                  <label className="block space-y-2 text-sm text-gray-300"><span>Type</span><select value={activeNote.type} onChange={(event) => updateNote(activeNote.id, { type: event.target.value })} className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-white outline-none">{TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                  <label className="block space-y-2 text-sm text-gray-300"><span>Status</span><select value={activeNote.status} onChange={(event) => updateNote(activeNote.id, { status: event.target.value })} className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-white outline-none">{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  <label className="block space-y-2 text-sm text-gray-300"><span>Priority</span><select value={activeNote.priority} onChange={(event) => updateNote(activeNote.id, { priority: event.target.value })} className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-white outline-none"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></label>
                  <label className="block space-y-2 text-sm text-gray-300">
                    <span>Visibility</span>
                    <span className="flex items-center gap-3 rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2.5 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={isPrivateVisibility}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          updateNote(activeNote.id, {
                            visibility: checked ? "private" : "public",
                            allowedUsers: checked ? activeNote.allowedUsers || [] : [],
                          });
                        }}
                        className="h-4 w-4"
                      />
                      <span>Private (only you & selected)</span>
                    </span>
                  </label>
                  {isPrivateVisibility && (
                    <label className="block space-y-2 text-sm text-gray-300">
                      <span>Allowed users</span>
                      <select
                        value={allowedUserPicker}
                        onChange={(event) => {
                          const picked = String(event.target.value || "").trim();
                          setAllowedUserPicker("");
                          if (!picked) return;
                          const existing = (activeNote.allowedUsers || []).map(String);
                          if (existing.includes(picked)) return;
                          updateNote(activeNote.id, { allowedUsers: [...existing, picked] });
                        }}
                        className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-white outline-none"
                      >
                        <option value="">Select a user...</option>
                        {teamMemberOptions.map((member) => (
                          <option
                            key={memberValue(member)}
                            value={memberValue(member)}
                          >
                            {member.name || member.email || "Member"}
                          </option>
                        ))}
                      </select>
                      {(activeNote.allowedUsers || []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(activeNote.allowedUsers || []).map((userId) => {
                            const userKey = String(userId || "");
                            const match = teamMemberOptions.find((member) => {
                              const value = memberValue(member);
                              return (
                                value === userKey ||
                                String(value).toLowerCase() === userKey.toLowerCase() ||
                                String(member.id || "").toLowerCase() === userKey.toLowerCase() ||
                                String(member.email || "").toLowerCase() === userKey.toLowerCase() ||
                                String(member.name || "").toLowerCase() === userKey.toLowerCase()
                              );
                            });
                            return (
                              <button
                                key={userKey}
                                type="button"
                                onClick={() =>
                                  updateNote(activeNote.id, {
                                    allowedUsers: (activeNote.allowedUsers || [])
                                      .map(String)
                                      .filter((id) => id !== userKey),
                                  })
                                }
                                className="rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1 text-xs text-indigo-200"
                              >
                                {(match?.name || match?.email || "Team member")} ×
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-[11px] text-gray-500">
                        Select who can view this note. You always keep access.
                      </p>
                    </label>
                  )}
                  <label className="block space-y-2 text-sm text-gray-300"><span className="flex items-center gap-2"><User size={15} />Owner</span><input value={getOwnerLabel(activeNote.owner)} onChange={(event) => updateNote(activeNote.id, { owner: event.target.value })} className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-white outline-none" /></label>
                  <label className="block space-y-2 text-sm text-gray-300"><span className="flex items-center gap-2"><CalendarDays size={15} />Due date</span><input type="date" value={activeNote.dueDate} onChange={(event) => updateNote(activeNote.id, { dueDate: event.target.value })} className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-white outline-none" /></label>
                  <label className="block space-y-2 text-sm text-gray-300"><span className="flex items-center gap-2"><Tag size={15} />Tags</span><input value={(activeNote.tags || []).join(", ")} onChange={(event) => updateNote(activeNote.id, { tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })} className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-white outline-none" /></label>
                  <div className="rounded-2xl border border-gray-800 bg-[#111827] p-4 text-sm text-gray-400">
                    <p>Created: {formatDate(activeNote.createdAt)}</p>
                    <p className="mt-1">Last updated: {formatDate(activeNote.updatedAt)}</p>
                    <p className="mt-3 text-xs leading-5">Notes are auto-saved locally and synced between open browser tabs.</p>
                  </div>
                  <button
                    onClick={saveNoteNow}
                    disabled={syncState.saving}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-3 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {syncState.saving ? "Saving..." : "Save changes"}
                  </button>
                </aside>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
