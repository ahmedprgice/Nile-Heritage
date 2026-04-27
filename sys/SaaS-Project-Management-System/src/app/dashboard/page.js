"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { fetchActivityFeed } from "@/lib/activity";
import api from "@/lib/http";
import { getCachedRequest } from "@/lib/requestCache";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarClock,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Kanban,
  MessageCircle,
  PlusCircle,
  ShieldCheck,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";

const InviteMemberModal = dynamic(() => import("./components/InviteMemberModal"), {
  ssr: false,
});
const NewTaskModal = dynamic(() => import("./components/NewTaskModal"), {
  ssr: false,
});

const cardBase =
  "rounded-2xl border border-gray-800 bg-[#111827]/90 shadow-xl shadow-black/20";

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function formatRelativeDeadline(value) {
  if (!value) return "No due date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return formatDate(value);
}

function getStoredUser() {
  try {
    const rawUser = localStorage.getItem("user");
    return rawUser ? JSON.parse(rawUser) : null;
  } catch (error) {
    console.error("Error reading user from localStorage:", error);
    return null;
  }
}

function resolveNormalizedUserRole(payload) {
  const source = payload || {};
  const role =
    source?.profile?.role ||
    source?.user?.role ||
    source?.data?.profile?.role ||
    source?.data?.user?.role ||
    source?.data?.role ||
    source?.role ||
    "";
  return String(role || "").trim().toLowerCase();
}

function getPriorityClass(priority) {
  if (priority === "High") {
    return "border-red-500/30 bg-red-500/10 text-red-300";
  }
  if (priority === "Medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

const StatCard = memo(function StatCard({ label, value, hint, icon: Icon, tone = "indigo" }) {
  const toneClasses = {
    indigo: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    rose: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`${cardBase} p-5 transition`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">{value}</h2>
        </div>

        <div
          className={`rounded-xl border p-3 ${
            toneClasses[tone] || toneClasses.indigo
          }`}
        >
          <Icon size={20} />
        </div>
      </div>

      {hint ? <p className="mt-4 text-xs text-gray-500">{hint}</p> : null}
    </motion.div>
  );
});

export default function Dashboard() {
  const [firstName, setFirstName] = useState("there");
  const [tasks, setTasks] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const [taskModalError, setTaskModalError] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [currentRole, setCurrentRole] = useState("");

  useEffect(() => {
    const savedUser = getStoredUser();
    const fullName = savedUser?.name || savedUser?.fullName || savedUser?.username || "";
    const email = savedUser?.email || "";
    setFirstName(
      fullName.split(" ").filter(Boolean)[0] ||
        (email ? email.split("@")[0] : "there"),
    );
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      setDashboardLoading(true);
      setDashboardError("");

      const [tasksData, membersData, workspaceData, subscriptionData, authData] =
        await Promise.all([
          getCachedRequest(
            "dashboard:tasks",
            async () => (await api.get("/api/tasks")).data,
            { ttlMs: 10000 },
          ),
          getCachedRequest(
            "directory:company-members:data",
            async () => (await api.get("/api/auth/company-members")).data,
            { ttlMs: 15000 },
          ).catch(() => ({ members: [] })),
          getCachedRequest(
            "dashboard:workspaces",
            async () => (await api.get("/api/workspaces")).data,
            { ttlMs: 10000 },
          ).catch(() => []),
          getCachedRequest(
            "dashboard:subscription",
            async () => (await api.get("/api/subscriptions/me")).data,
            { ttlMs: 10000 },
          ).catch(() => null),
          getCachedRequest(
            "auth:me",
            async () => (await api.get("/api/auth/me")).data,
            { ttlMs: 15000 },
          ).catch(() => null),
        ]);

      const profile = authData;

      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setTeamMembers(
        Array.isArray(membersData?.members) ? membersData.members : [],
      );
      setWorkspaces(Array.isArray(workspaceData) ? workspaceData : []);
      setSubscription(subscriptionData || null);
      const storedUser = getStoredUser();
      const resolvedRole =
        resolveNormalizedUserRole(profile) ||
        resolveNormalizedUserRole(storedUser);
      setCurrentRole(resolvedRole);
    } catch (err) {
      if (err?.response?.status === 402) {
        setSubscription(err?.response?.data?.subscription || null);
        setDashboardError("");
        setTasks([]);
        setTeamMembers([]);
        setWorkspaces([]);
        const storedUser = getStoredUser();
        setCurrentRole(resolveNormalizedUserRole(storedUser));
        return;
      }
      console.error("Error loading dashboard data:", err);
      setDashboardError(
        err?.response?.data?.message || "Failed to load dashboard data",
      );
      setTasks([]);
      setTeamMembers([]);
      setWorkspaces([]);
      const storedUser = getStoredUser();
      setCurrentRole(resolveNormalizedUserRole(storedUser));
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    const loadActivity = async () => {
      setActivityLoading(true);
      setActivityError("");
      const result = await fetchActivityFeed();

      if (!result.endpoint) {
        setActivityError("Could not load activity timeline.");
      }

      setActivity(result.activities || []);
      setActivityLoading(false);
    };

    loadActivity();
  }, []);

  const metrics = useMemo(() => {
    const todo = tasks.filter((task) => task.status === "Todo").length;
    const progress = tasks.filter((task) => task.status === "In Progress").length;
    const completed = tasks.filter((task) => task.status === "Done").length;
    const open = todo + progress;
    const totalBoards = workspaces.reduce(
      (count, workspace) =>
        count + (Array.isArray(workspace.boards) ? workspace.boards.length : 0),
      0,
    );
    const completionRate = tasks.length
      ? Math.round((completed / tasks.length) * 100)
      : 0;

    return {
      todo,
      progress,
      completed,
      open,
      totalBoards,
      completionRate,
      team: teamMembers.length,
      workspaces: workspaces.length,
    };
  }, [tasks, teamMembers.length, workspaces]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace?.isActive) || workspaces[0] || null,
    [workspaces],
  );

  const workspaceCards = useMemo(
    () => workspaces.slice(0, 3),
    [workspaces],
  );

  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks
      .filter((task) => {
        if (!task?.dueDate || task.status === "Done") return false;
        const due = new Date(task.dueDate);
        due.setHours(0, 0, 0, 0);
        return due < today;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  }, [tasks]);

  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks
      .filter((task) => {
        if (!task?.dueDate || task.status === "Done") return false;
        const due = new Date(task.dueDate);
        due.setHours(0, 0, 0, 0);
        return due >= today;
      })
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      ;
  }, [tasks]);

  const focusTasks = useMemo(() => {
    const urgentTasks = tasks
      .filter((task) => task.status !== "Done")
      .sort((a, b) => {
        const priorityScore = { High: 0, Medium: 1, Low: 2 };
        const aPriority = priorityScore[a.priority] ?? 3;
        const bPriority = priorityScore[b.priority] ?? 3;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return new Date(a.dueDate || 8640000000000000) - new Date(b.dueDate || 8640000000000000);
      });

    return urgentTasks.slice(0, 4);
  }, [tasks]);

  const availableAssignees = useMemo(
    () => Array.from(new Set(teamMembers.map((user) => user?.name).filter(Boolean))),
    [teamMembers],
  );

  const assigneeRoleMap = useMemo(() => {
    const roleMap = {};
    teamMembers.forEach((user) => {
      if (user?.name) roleMap[user.name] = user.role || "Member";
    });
    return roleMap;
  }, [teamMembers]);

  const subscriptionStatus =
    subscription?.status ||
    subscription?.accountStatus ||
    subscription?.subscription?.status ||
    "trial";

  const subscriptionEndDate =
    subscription?.subscriptionEndDate ||
    subscription?.trialEndDate ||
    subscription?.subscription?.subscriptionEndDate ||
    subscription?.subscription?.trialEndDate ||
    null;

  const handleSaveTask = async (payload) => {
    try {
      setTaskModalError("");

      const savedUser = getStoredUser();
      const createdBy = savedUser?._id || savedUser?.id || "";
      const companyId =
        savedUser?.companyId ||
        savedUser?.company?._id ||
        savedUser?.company?.id ||
        "";
      const companyName = savedUser?.companyName || savedUser?.company?.name || "";

      if (!createdBy || !companyId) {
        throw new Error("Missing company or user information. Please sign in again.");
      }

      await api.post("/api/tasks", {
        ...payload,
        companyId,
        companyName,
        createdBy,
      });

      await loadDashboardData();
      setShowTaskModal(false);
    } catch (err) {
      console.error("Error saving task:", err);
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save task";
      setTaskModalError(message);
      throw err;
    }
  };

  const handleInviteSuccess = async () => {
    await loadDashboardData();
  };

  const statusRows = [
    { label: "Todo", value: metrics.todo, color: "bg-sky-500" },
    { label: "In Progress", value: metrics.progress, color: "bg-amber-500" },
    { label: "Done", value: metrics.completed, color: "bg-emerald-500" },
  ];
  const isOwner = currentRole === "owner";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative space-y-8"
    >
      <div className="pointer-events-none absolute -top-32 left-0 h-72 w-72 rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-48 h-72 w-72 rounded-full bg-purple-600/20 blur-[120px]" />

      <section className={`${cardBase} relative overflow-hidden p-6 md:p-8`}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/70 to-transparent" />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-indigo-200">
              Command Center
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-400 md:text-base">
              Monitor tasks, boards, team access, workspace activity, and subscription status from one professional overview.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button
              onClick={() => {
                setTaskModalError("");
                setShowTaskModal(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:opacity-90"
            >
              <PlusCircle size={18} />
              Create task
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-[#0f172a] px-5 py-3 text-sm font-semibold text-white transition hover:border-indigo-500"
            >
              <UserPlus size={18} />
              Invite team
            </button>
          </div>
        </div>
      </section>

      {dashboardError ? (
        <div className="relative z-10 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {dashboardError}
        </div>
      ) : null}

      {taskModalError ? (
        <div className="relative z-10 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {taskModalError}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Workspaces"
          value={dashboardLoading ? "..." : metrics.workspaces}
          hint={activeWorkspace ? `Active: ${activeWorkspace.name}` : "Create a workspace to start"}
          icon={Kanban}
          tone="indigo"
        />
        <StatCard
          label="Boards"
          value={dashboardLoading ? "..." : metrics.totalBoards}
          hint="Boards across all accessible workspaces"
          icon={WalletCards}
          tone="purple"
        />
        <StatCard
          label="Open tasks"
          value={dashboardLoading ? "..." : metrics.open}
          hint={`${metrics.progress} in progress`}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Completion"
          value={dashboardLoading ? "..." : `${metrics.completionRate}%`}
          hint={`${metrics.completed} completed tasks`}
          icon={CheckCircle}
          tone="emerald"
        />
        <StatCard
          label="Team"
          value={dashboardLoading ? "..." : metrics.team}
          hint="Company members available for work"
          icon={Users}
          tone="rose"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={`${cardBase} p-6 ${isOwner ? "xl:col-span-2" : "xl:col-span-3"}`}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Work overview</h2>
              <p className="mt-1 text-sm text-gray-400">
                Task distribution and priority focus for daily execution.
              </p>
            </div>
            <Link
              href="/dashboard/tasks"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:border-indigo-500"
            >
              Open task management
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              {statusRows.map((row) => {
                const percentage = tasks.length
                  ? Math.round((row.value / tasks.length) * 100)
                  : 0;

                return (
                  <div key={row.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-gray-300">{row.label}</span>
                      <span className="text-gray-500">
                        {row.value} tasks - {percentage}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className={`h-full rounded-full ${row.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-gray-800 bg-[#0f172a] p-4">
              <div className="mb-4 flex items-center gap-2">
                <AlertCircle className="text-amber-300" size={18} />
                <h3 className="font-semibold text-white">Priority focus</h3>
              </div>
              <div className="space-y-3">
                {focusTasks.length > 0 ? (
                  focusTasks.map((task) => (
                    <div
                      key={task._id || task.title}
                      className="rounded-lg border border-gray-800 bg-[#111827] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">
                            {task.title || "Untitled task"}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {task.status || "Todo"} - {formatRelativeDeadline(task.dueDate)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-1 text-[11px] ${getPriorityClass(
                            task.priority,
                          )}`}
                        >
                          {task.priority || "Low"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No open tasks need attention.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {isOwner ? (
          <div className={`${cardBase} p-6`}>
            <div className="mb-5 flex items-center gap-2">
              <ShieldCheck className="text-indigo-300" size={18} />
              <h2 className="text-xl font-semibold text-white">Access status</h2>
            </div>

            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-200">
                Subscription
              </p>
              <p className="mt-2 text-2xl font-semibold capitalize text-white">
                {subscriptionStatus}
              </p>
              <p className="mt-2 text-sm text-gray-400">
                {subscriptionEndDate
                  ? `Access valid until ${formatDate(subscriptionEndDate)}`
                  : "Subscription details are available in billing."}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <Link
                href="/dashboard/subscription"
                className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#0f172a] px-4 py-3 text-sm text-gray-200 transition hover:border-indigo-500"
              >
                <span className="inline-flex items-center gap-2">
                  <CreditCard size={16} />
                  Manage subscription
                </span>
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/dashboard/workspace"
                className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#0f172a] px-4 py-3 text-sm text-gray-200 transition hover:border-indigo-500"
              >
                <span className="inline-flex items-center gap-2">
                  <Kanban size={16} />
                  Manage workspaces
                </span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={`${cardBase} p-6 xl:col-span-2`}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Workspace command center</h2>
              <p className="mt-1 text-sm text-gray-400">
                Jump into boards, review workspace ownership, and continue active work.
              </p>
            </div>
            <Link
              href="/dashboard/workspace"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:border-indigo-500"
            >
              View all
              <ArrowRight size={15} />
            </Link>
          </div>

          {workspaceCards.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {workspaceCards.map((workspace) => (
                <Link
                  key={workspace._id || workspace.name}
                  href={`/dashboard/workspace/${workspace._id}`}
                  className="rounded-xl border border-gray-800 bg-[#0f172a] p-4 transition hover:border-indigo-500 hover:bg-[#111827]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-3 flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: workspace.color || "#7c3aed" }}
                        />
                        <p className="truncate font-semibold text-white">
                          {workspace.name}
                        </p>
                      </div>
                      <p className="line-clamp-2 min-h-[40px] text-sm text-gray-400">
                        {workspace.description || "Workspace for team boards and collaboration."}
                      </p>
                    </div>
                    {workspace.isActive ? (
                      <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[10px] text-indigo-200">
                        Active
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                    <span>{Array.isArray(workspace.boards) ? workspace.boards.length : 0} boards</span>
                    <span>{Array.isArray(workspace.members) ? workspace.members.length : 0} members</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-700 p-6 text-sm text-gray-400">
              No workspaces yet. Create your first workspace to organize boards.
            </div>
          )}
        </div>

        <div className={`${cardBase} p-6`}>
          <h2 className="text-xl font-semibold text-white">System shortcuts</h2>
          <p className="mt-1 text-sm text-gray-400">
            Direct access to the core tools in Nexora.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3">
            {[
              { href: "/dashboard/workspace", label: "Boards and workspaces", icon: Kanban },
              { href: "/dashboard/tasks", label: "Task management", icon: CheckCircle },
              { href: "/dashboard/notes", label: "Real-time notes", icon: FileText },
              { href: "/dashboard/chat", label: "Team chat", icon: MessageCircle },
              { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#0f172a] px-4 py-3 text-sm text-gray-200 transition hover:border-indigo-500"
                >
                  <span className="inline-flex items-center gap-3">
                    <Icon size={16} className="text-indigo-300" />
                    {item.label}
                  </span>
                  <ArrowRight size={15} className="text-gray-500" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className={`${cardBase} p-6`}>
          <div className="mb-5 flex items-center gap-2">
            <CalendarClock className="text-indigo-300" size={18} />
            <h2 className="text-xl font-semibold text-white">Deadlines</h2>
          </div>

          {overdueTasks.length > 0 ? (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-200">
                {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}
              </p>
              <Link
                href="/dashboard/tasks"
                className="mt-2 inline-flex items-center gap-2 text-xs text-red-200 hover:text-white"
              >
                Review overdue work
                <ArrowRight size={13} />
              </Link>
            </div>
          ) : null}

          <div className="max-h-[430px] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((task) => (
                <div
                  key={task._id || task.title}
                  className="rounded-xl border border-gray-800 bg-[#0f172a] p-4"
                >
                  <p className="truncate text-sm font-medium text-white">
                    {task.title || "Untitled task"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatRelativeDeadline(task.dueDate)} - {task.status || "Todo"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No upcoming deadlines.</p>
            )}
          </div>
        </div>

        <div className={`${cardBase} p-6`}>
          <div className="mb-5 flex items-center gap-2">
            <Activity className="text-indigo-300" size={18} />
            <h2 className="text-xl font-semibold text-white">Recent activity</h2>
          </div>

          <div className="max-h-[430px] space-y-4 overflow-y-auto overscroll-contain pr-1">
            {activityLoading ? (
              <p className="text-sm text-gray-400">Loading activity...</p>
            ) : activity.length > 0 ? (
              activity.map((item) => (
                <div
                  key={item.id}
                  className="border-b border-gray-800 pb-3 last:border-b-0 last:pb-0"
                >
                  <p className="line-clamp-2 text-sm text-gray-200">
                    {item.actor ? `${item.actor}: ` : ""}
                    {item.text}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {item.time
                      ? new Date(item.time).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recently"}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">
                {activityError || "No recent activity yet."}
              </p>
            )}
          </div>
        </div>

        <div className={`${cardBase} p-6`}>
          <div className="mb-5 flex items-center gap-2">
            <BarChart3 className="text-indigo-300" size={18} />
            <h2 className="text-xl font-semibold text-white">Team capacity</h2>
          </div>

          <div className="max-h-[430px] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {teamMembers.length > 0 ? (
              teamMembers.map((member) => (
                <div
                  key={member.id || member._id || member.email || member.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#0f172a] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {member.name || member.email || "Team member"}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {member.email || "No email"}
                    </p>
                  </div>
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-200">
                    {member.role || "Member"}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-gray-700 p-5 text-sm text-gray-400">
                Invite your first team member to start collaborating.
              </div>
            )}
          </div>

          <button
            onClick={() => setShowInviteModal(true)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/20"
          >
            <UserPlus size={16} />
            Invite member
          </button>
        </div>
      </section>

      {showInviteModal && (
        <InviteMemberModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      {showTaskModal && (
        <NewTaskModal
          onClose={() => {
            setShowTaskModal(false);
            setTaskModalError("");
          }}
          onSave={handleSaveTask}
          availableAssignees={availableAssignees}
          assigneeRoleMap={assigneeRoleMap}
          setError={setTaskModalError}
        />
      )}
    </motion.div>
  );
}
