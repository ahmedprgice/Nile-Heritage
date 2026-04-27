/*tasks/page*/
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Trash2, Edit3, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/http";
import { useRouter } from "next/navigation";
import Skeleton from "../components/Skeleton";

export default function Tasks() {
  const router = useRouter();
  const API = "/api/tasks";

  /* ================= STATE ================= */
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("Kanban");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [currentTask, setCurrentTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [swimlaneBy, setSwimlaneBy] = useState("none");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [inlineSavingId, setInlineSavingId] = useState(null);
  const [companyUsers, setCompanyUsers] = useState([]);

  /* ================= USER HELPERS ================= */
  const getStoredUser = useCallback(() => {
    try {
      const rawUser = localStorage.getItem("user");
      if (!rawUser) return null;
      return JSON.parse(rawUser);
    } catch (err) {
      console.error("Error parsing user from localStorage:", err);
      return null;
    }
  }, []);

  const toTaskPayload = useCallback(
    (task) => ({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "Todo",
      priority: task.priority || "Medium",
      assignees: task.assignees || [],
      tags: task.tags || [],
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : null,
    }),
    []
  );

  /* ================= LOAD TASKS ================= */
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get(API);
      const normalized = Array.isArray(res.data)
        ? res.data.map((task) => ({
            ...task,
            assignees: Array.isArray(task.assignees)
              ? task.assignees.map((assignee) => getAssigneeLabel(assignee)).filter(Boolean)
              : [],
          }))
        : [];
      setTasks(normalized);
    } catch (err) {
      console.error("Error loading tasks:", err);
      setError(err.response?.data?.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCompanyUsers = useCallback(async () => {
    try {
      const savedUser = getStoredUser();
      const currentCompanyId =
        savedUser?.companyId ||
        savedUser?.company?._id ||
        savedUser?.company?.id ||
        "";

      const res = await api.get("/api/auth/company-members");
      const members = Array.isArray(res?.data?.members) ? res.data.members : [];

      const filteredMembers = currentCompanyId
        ? members.filter((member) => {
            const memberCompanyId =
              member?.companyId ||
              member?.company?._id ||
              member?.company?.id ||
              "";
            return !memberCompanyId || memberCompanyId === currentCompanyId;
          })
        : members;

      setCompanyUsers(filteredMembers);
    } catch (err) {
      console.error("Error loading company users:", err);
      setCompanyUsers([]);
    }
  }, [getStoredUser]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }

    const init = async () => {
      await Promise.all([loadTasks(), loadCompanyUsers()]);
    };

    init();
  }, [loadTasks, loadCompanyUsers, router]);

  /* ================= HELPERS ================= */
  const getPriorityColor = (priority) => {
    if (priority === "High") return "bg-red-500/20 text-red-400";
    if (priority === "Medium") return "bg-yellow-500/20 text-yellow-400";
    return "bg-green-500/20 text-green-400";
  };

  const getAssigneeLabel = (user) => {
    if (!user) return "Member";
    if (typeof user === "string") return user;
    return user.name || user.email || user.role || "Member";
  };

  const getAssigneeKey = (user) => {
    if (!user) return "member";
    if (typeof user === "string") return user;
    return user.id || user._id || user.email || user.name || "member";
  };

  const normalizeAssignee = (user) => getAssigneeLabel(user);

  const filteredTasks =
    filterStatus === "All"
      ? tasks
      : tasks.filter((t) => t.status === filterStatus);

  const statusFilters = ["All", "Todo", "In Progress", "Done"];
  const kanbanStatuses =
    filterStatus === "All" ? ["Todo", "In Progress", "Done"] : [filterStatus];

  const availableAssignees = useMemo(() => {
    const map = new Map();
    companyUsers.forEach((user) => {
      const key = getAssigneeKey(user);
      if (!map.has(key)) {
        map.set(key, user);
      }
    });
    return Array.from(map.values());
  }, [companyUsers]);

  const assigneeRoleMap = useMemo(() => {
    const roleMap = {};
    companyUsers.forEach((user) => {
      const key = getAssigneeKey(user);
      if (key) {
        roleMap[key] = user?.role || "Member";
      }
    });
    return roleMap;
  }, [companyUsers]);

  const formatDate = (date) => {
    if (!date) return "";
    return String(date).slice(0, 10);
  };

  const kanbanGridMinWidthClass =
    kanbanStatuses.length > 1 ? "min-w-[980px] lg:min-w-0" : "min-w-0";

  const handleDeleteTask = async (taskId) => {
    const previousTasks = tasks;
    setTasks((prev) => prev.filter((task) => task._id !== taskId));
    if (currentTask?._id === taskId) {
      setShowTaskModal(false);
      setCurrentTask(null);
    }

    try {
      setError("");
      await api.delete(`${API}/${taskId}`);
    } catch (err) {
      setTasks(previousTasks);
      console.error("Error deleting task:", err);
      setError(err.response?.data?.message || "Failed to delete task");
    }
  };

  const updateTaskInline = async (taskId, changes) => {
    const originalTask = tasks.find((t) => t._id === taskId);
    if (!originalTask) return;

    const updatedTask = { ...originalTask, ...changes };
    setTasks((prev) => prev.map((t) => (t._id === taskId ? updatedTask : t)));
    setInlineSavingId(taskId);

    try {
      const payload = toTaskPayload(updatedTask);
      await api.put(`${API}/${taskId}`, payload);
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t._id === taskId ? originalTask : t)));
      setError(
        err.response?.data?.message || err.message || "Failed to update task"
      );
    } finally {
      setInlineSavingId(null);
    }
  };

  const handleStatusDrop = async (taskId, newStatus) => {
    try {
      setError("");

      const taskToUpdate = tasks.find((t) => t._id === taskId);
      if (!taskToUpdate || taskToUpdate.status === newStatus) return;

      const updatedTask = { ...taskToUpdate, status: newStatus };
      const payload = toTaskPayload(updatedTask);
      await api.put(`${API}/${taskId}`, payload);

      await loadTasks();
    } catch (err) {
      console.error("Error updating task status:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update task status"
      );
    }
  };

  const getLaneOrder = (tasksByStatus) => {
    if (swimlaneBy === "priority") return ["High", "Medium", "Low"];
    if (swimlaneBy === "assignee") {
      const keys = new Set();
      tasksByStatus.forEach((task) =>
        keys.add(task.assignees?.[0] || "Unassigned")
      );
      return Array.from(keys);
    }
    return ["All"];
  };

  /* ================= TASK MODAL ================= */
  const TaskModal = ({ task, onClose }) => {
    const [description, setDescription] = useState(task?.description || "");
    const [title, setTitle] = useState(task?.title || "");
    const [status, setStatus] = useState(task?.status || "Todo");
    const [priority, setPriority] = useState(task?.priority || "Medium");
    const [assignees, setAssignees] = useState(
      (task?.assignees || []).map(normalizeAssignee).filter(Boolean)
    );
    const [tags, setTags] = useState(task?.tags?.join(", ") || "");
    const [dueDate, setDueDate] = useState(
      task?.dueDate ? String(task.dueDate).slice(0, 10) : ""
    );
    const [saving, setSaving] = useState(false);
    const [assigneeSearch, setAssigneeSearch] = useState("");
    const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
    const isFormValid =
      title.trim().length > 0 && assignees.length > 0 && Boolean(dueDate);

    const toggleAssignee = (user) => {
      const label = getAssigneeLabel(user);
      setAssignees((prev) =>
        prev.includes(label)
          ? prev.filter((a) => a !== label)
          : [...prev, label]
      );
    };

    const filteredAssignees = useMemo(() => {
      const query = assigneeSearch.trim().toLowerCase();

      return availableAssignees.filter((user) => {
        if (!query) return true;
        const label = getAssigneeLabel(user);
        const role = assigneeRoleMap[getAssigneeKey(user)] || "Member";
        return `${label} ${role}`
          .toLowerCase()
          .includes(query);
      });
    }, [assigneeSearch]);

    const saveTask = async () => {
      if (!title.trim()) {
        setError("Task title is required");
        return;
      }

      if (!assignees.length) {
        setError("Please select at least one assignee");
        return;
      }

      if (!dueDate) {
        setError("Due date is required");
        return;
      }

      try {
        setSaving(true);
        setError("");

        const draftTask = {
          title: title.trim(),
          description: description.trim(),
          status,
          priority,
          assignees,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          dueDate,
        };

        const payload = toTaskPayload(draftTask);

        if (task?._id) {
          await api.put(`${API}/${task._id}`, payload);
        } else {
          await api.post(API, payload);
        }

        await loadTasks();
        onClose();
      } catch (err) {
        console.error("Error saving task:", err.response?.data || err.message);
        setError(
          err.response?.data?.error ||
            err.response?.data?.message ||
            err.message ||
            "Failed to save task"
        );
      } finally {
        setSaving(false);
      }
    };

    return (
      <motion.div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#111827] p-4 sm:p-6 w-[95%] max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-gray-700 shadow-2xl"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl font-semibold mb-4">
            {task ? "Edit Task" : "New Task"}
          </h2>

          <div className="space-y-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task Title"
              className="w-full px-4 py-2.5 rounded-xl bg-[#1e293b] border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div>
              <label className="text-xs uppercase tracking-wide text-gray-400">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write the full task description here..."
                rows={8}
                className="mt-2 w-full px-4 py-3 rounded-xl bg-[#1e293b] border border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#1e293b] border border-gray-700"
              >
                <option>Todo</option>
                <option>In Progress</option>
                <option>Done</option>
              </select>

              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-[#1e293b] border border-gray-700"
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>

            <div>
              <p className="text-gray-400 text-sm mb-1">Assignees</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAssigneeDropdownOpen((prev) => !prev)}
                  className="w-full rounded-lg border border-gray-700 bg-[#1e293b] px-3 py-2 text-left flex items-center justify-between"
                >
                  <span className="truncate text-sm">
                    {assignees.length > 0
                      ? assignees.join(", ")
                      : "Select assignees"}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition ${assigneeDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {assigneeDropdownOpen && (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-700 bg-[#0f172a] shadow-xl overflow-hidden">
                    <div className="p-3 border-b border-gray-700">
                      <input
                        value={assigneeSearch}
                        onChange={(e) => setAssigneeSearch(e.target.value)}
                        placeholder="Search assignees..."
                        className="w-full rounded-lg border border-gray-700 bg-[#111827] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="max-h-44 overflow-y-auto">
                      {filteredAssignees.map((user) => {
                        const label = getAssigneeLabel(user);
                        const selected = assignees.includes(label);
                        return (
                          <button
                            type="button"
                            key={getAssigneeKey(user)}
                            onClick={() => toggleAssignee(user)}
                            className="w-full px-4 py-3 text-left hover:bg-[#1e293b] transition flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">{label}</p>
                              <p className="text-[11px] text-gray-400 truncate">
                                {assigneeRoleMap[getAssigneeKey(user)] || "Member"}
                              </p>
                            </div>
                            {selected && (
                              <Check size={14} className="text-indigo-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}

                      {filteredAssignees.length === 0 && (
                        <p className="px-4 py-3 text-sm text-gray-400">
                          No matching users
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma separated)"
              className="w-full px-3 py-2 rounded-lg bg-[#1e293b] border border-gray-700"
            />

            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#1e293b] border border-gray-700"
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white"
            >
              Cancel
            </button>

            <button
              onClick={saveTask}
              disabled={saving || !isFormValid}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          {!isFormValid && (
            <p className="mt-3 text-xs text-amber-300">
              Please add a title, at least one assignee, and a due date.
            </p>
          )}
        </motion.div>
      </motion.div>
    );
  };

  /* ================= UI ================= */
  return (
    <div className="tasks-page-theme">
      <section className="mb-3 rounded-xl border border-gray-800 bg-[#0f172a] px-3 py-2.5">
        <div className="flex flex-col gap-2">
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white sm:text-xl">Task</h1>
            <p className="mt-0.5 max-w-2xl text-xs text-gray-400">
              Manage your team work, track progress, and keep every task moving
              forward.
            </p>
          </div>
        </div>
        <div className="my-2 h-px w-full bg-gray-800" />
        <div className="mb-0.5 flex flex-col gap-2 px-0.5 py-0.5 xl:flex-row xl:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-x-auto">
            <div className="flex min-w-0 items-end gap-1 border-b border-gray-700/70 pb-1">
              {["Kanban", "List"].map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                    view === v
                      ? "border-b-2 border-indigo-400 text-white"
                      : "border-b-2 border-transparent text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {v} View
                </button>
              ))}
            </div>
          </div>

          <div className="ml-0 flex w-full flex-col gap-0.5 xl:ml-auto xl:w-auto">
            <div className="flex flex-wrap items-center justify-start gap-1.5 p-0.5 xl:justify-end">
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-700 bg-[#0f172a] p-1">
                {statusFilters.map((s) => (
                  <motion.button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    layout
                    whileTap={{ scale: 0.96 }}
                    className={`relative overflow-hidden rounded-lg px-3 py-2 text-sm font-medium transition ${
                      filterStatus === s
                        ? "text-white"
                        : "text-gray-300 hover:bg-[#1e293b] hover:text-white"
                    }`}
                  >
                    {filterStatus === s ? (
                      <motion.span
                        layoutId="task-status-filter"
                        className="absolute inset-0 rounded-lg bg-indigo-600 shadow-lg shadow-indigo-600/20"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      />
                    ) : null}
                    <span className="relative z-10">{s}</span>
                  </motion.button>
                ))}
              </div>

              {view === "Kanban" && (
                <label className="flex items-center gap-2 rounded-md border border-gray-700 bg-[#0f172a] px-3 py-2 text-sm text-gray-300">
                  <span className="text-xs uppercase tracking-wide text-gray-400">
                    Filter View
                  </span>
                  <select
                    value={swimlaneBy}
                    onChange={(event) => setSwimlaneBy(event.target.value)}
                    className="w-full rounded-md border border-gray-700 bg-[#1e293b] px-2 py-1 text-sm text-white outline-none focus:border-indigo-500 sm:w-auto"
                  >
                    <option value="none">No Swimlane</option>
                    <option value="assignee">By Assignee</option>
                    <option value="priority">By Priority</option>
                  </select>
                </label>
              )}

              <button
                onClick={() => {
                  setCurrentTask(null);
                  setError("");
                  setShowTaskModal(true);
                }}
                className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                + Add Task
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-gray-800 mb-8"></div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((col) => (
            <div
              key={col}
              className="bg-[#111827]/50 p-4 rounded-xl min-h-[300px] border border-gray-800"
            >
              <Skeleton className="h-5 w-28 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((card) => (
                  <div
                    key={`${col}-${card}`}
                    className="bg-[#1e293b] p-4 rounded-xl border border-gray-700"
                  >
                    <Skeleton className="h-4 w-2/3 mb-3" />
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-3 w-3/4 mb-3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {view === "Kanban" ? (
            <div className="overflow-x-auto pb-2">
              <motion.div
                layout
                className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${kanbanGridMinWidthClass}`}
              >
              <AnimatePresence mode="popLayout">
                {kanbanStatuses.map((status) => (
                <motion.div
                  key={status}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.98 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className={`flex min-h-[320px] max-h-[calc(100dvh-260px)] flex-col rounded-2xl border border-gray-800 bg-[#111827] p-4 shadow-sm ${
                    filterStatus === "All" ? "" : "md:col-span-2 lg:col-span-3"
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async () => {
                    if (draggedTaskId) {
                      await handleStatusDrop(draggedTaskId, status);
                      setDraggedTaskId(null);
                    }
                  }}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-white">{status}</h3>
                    <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-200">
                      {filteredTasks.filter((t) => t.status === status).length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                    {getLaneOrder(filteredTasks.filter((t) => t.status === status)).map(
                      (lane) => (
                        <div key={`${status}-${lane}`} className="space-y-3">
                          {swimlaneBy !== "none" && (
                            <div className="flex items-center justify-between px-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                {lane}
                              </p>
                              <span className="text-xs text-gray-500">
                                {
                                  filteredTasks.filter((t) => {
                                    if (t.status !== status) return false;
                                    if (swimlaneBy === "priority") {
                                      return (t.priority || "Medium") === lane;
                                    }
                                    if (swimlaneBy === "assignee") {
                                      return (t.assignees?.[0] || "Unassigned") === lane;
                                    }
                                    return true;
                                  }).length
                                }
                              </span>
                            </div>
                          )}

                          {filteredTasks
                            .filter((t) => {
                              if (t.status !== status) return false;
                              if (swimlaneBy === "priority") {
                                return (t.priority || "Medium") === lane;
                              }
                              if (swimlaneBy === "assignee") {
                                return (t.assignees?.[0] || "Unassigned") === lane;
                              }
                              return true;
                            })
                            .map((task) => (
                              <motion.div
                                key={task._id}
                                layout
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.18 }}
                                draggable
                                onDragStart={() => setDraggedTaskId(task._id)}
                                onDragEnd={() => setDraggedTaskId(null)}
                                onClick={() => {
                                  setCurrentTask(task);
                                  setShowTaskModal(true);
                                }}
                                className="bg-[#111827] p-4 rounded-2xl border border-gray-700 hover:border-indigo-500 transition active:cursor-grabbing shadow-sm cursor-pointer"
                              >
                                <div className="flex justify-between items-start gap-3 mb-3">
                                  <input
                                    value={task.title || ""}
                                    onChange={(e) =>
                                      setTasks((prev) =>
                                        prev.map((t) =>
                                          t._id === task._id
                                            ? { ...t, title: e.target.value }
                                            : t
                                        )
                                      )
                                    }
                                    onBlur={(e) =>
                                      updateTaskInline(task._id, {
                                        title: e.target.value.trim() || "Untitled Task",
                                      })
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="font-semibold text-white text-base truncate bg-transparent border-b border-transparent focus:border-indigo-500 outline-none w-full"
                                  />

                                  <Trash2
                                    size={16}
                                    className="text-red-400 hover:text-red-600 shrink-0"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await handleDeleteTask(task._id);
                                    }}
                                  />
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300 mb-3">
                                  <span
                                    className={`px-2 py-0.5 rounded-full ${getPriorityColor(
                                      task.priority
                                    )}`}
                                  >
                                    {task.priority}
                                  </span>

                                  <select
                                    value={task.assignees?.[0] || ""}
                                    onChange={(e) => {
                                      const assignee = e.target.value;
                                      updateTaskInline(task._id, {
                                        assignees: assignee ? [assignee] : [],
                                      });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="bg-[#0f172a] border border-gray-700 rounded-lg px-2 py-1 text-xs"
                                  >
                                    <option value="">Unassigned</option>
                                    {availableAssignees.map((user) => {
                                      const label = getAssigneeLabel(user);
                                      return (
                                        <option key={getAssigneeKey(user)} value={label}>
                                          {label} - {assigneeRoleMap[getAssigneeKey(user)] || "Member"}
                                        </option>
                                      );
                                    })}
                                  </select>

                                  <input
                                    type="date"
                                    value={task.dueDate ? formatDate(task.dueDate) : ""}
                                    onChange={(e) =>
                                      updateTaskInline(task._id, {
                                        dueDate: e.target.value || null,
                                      })
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                    className="bg-[#0f172a] border border-gray-700 rounded-lg px-2 py-1 text-xs text-gray-300"
                                  />
                                </div>

                                {task.tags?.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {task.tags.map((tag, index) => (
                                      <span
                                        key={index}
                                        className="px-2 py-0.5 rounded-full bg-slate-700 text-gray-200 text-xs"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <p className="text-sm text-gray-400 line-clamp-3 border-t border-gray-700 pt-3">
                                  {task.description || "No description provided."}
                                </p>

                                {inlineSavingId === task._id && (
                                  <p className="text-[11px] text-indigo-300 mt-2">
                                    Saving changes...
                                  </p>
                                )}
                              </motion.div>
                            ))}
                        </div>
                      )
                    )}
                  </div>
                </motion.div>
              ))}
              </AnimatePresence>
              </motion.div>
            </div>
          ) : (
            <div className="bg-[#111827]/50 rounded-xl p-4 overflow-x-auto">
              <div className="grid grid-cols-8 min-w-[980px] gap-4 font-semibold mb-3 text-sm">
                <span>Title</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Assignees</span>
                <span>Due Date</span>
                <span>Tags</span>
                <span>Description</span>
                <span>Actions</span>
              </div>

              <motion.div layout className="space-y-3">
                <AnimatePresence mode="popLayout">
                {filteredTasks.map((task) => (
                  <motion.div
                    key={task._id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => {
                      setCurrentTask(task);
                      setShowTaskModal(true);
                    }}
                    className="grid grid-cols-8 min-w-[980px] gap-4 p-3 bg-[#1e293b] rounded-xl border border-gray-700 hover:border-indigo-500 items-center text-sm cursor-pointer"
                  >
                    <input
                      value={task.title || ""}
                      onChange={(e) =>
                        setTasks((prev) =>
                          prev.map((t) =>
                            t._id === task._id ? { ...t, title: e.target.value } : t
                          )
                        )
                      }
                      onBlur={(e) =>
                        updateTaskInline(task._id, {
                          title: e.target.value.trim() || "Untitled Task",
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="whitespace-nowrap bg-transparent border-b border-transparent focus:border-indigo-500 outline-none"
                    />

                    <span>{task.status}</span>

                    <span
                      className={`px-2 py-0.5 rounded-full w-fit ${getPriorityColor(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>

                    <select
                      value={task.assignees?.[0] || ""}
                      onChange={(e) =>
                        updateTaskInline(task._id, {
                          assignees: e.target.value ? [e.target.value] : [],
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="truncate bg-[#0f172a] border border-gray-700 rounded px-2 py-1"
                    >
                      <option value="">Unassigned</option>
                      {availableAssignees.map((user) => {
                        const label = getAssigneeLabel(user);
                        return (
                          <option key={getAssigneeKey(user)} value={label}>
                            {label} - {assigneeRoleMap[getAssigneeKey(user)] || "Member"}
                          </option>
                        );
                      })}
                    </select>

                    <input
                      type="date"
                      value={task.dueDate ? formatDate(task.dueDate) : ""}
                      onChange={(e) =>
                        updateTaskInline(task._id, {
                          dueDate: e.target.value || null,
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      className="bg-[#0f172a] border border-gray-700 rounded px-2 py-1"
                    />

                    <span className="truncate">
                      {task.tags?.length ? task.tags.join(", ") : "No tags"}
                    </span>

                    <span className="truncate">
                      {task.description || "No description"}
                    </span>

                    <div className="flex gap-2">
                      <Edit3
                        size={16}
                        className="text-yellow-400 cursor-pointer"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCurrentTask(task);
                          setShowTaskModal(true);
                        }}
                      />

                      <Trash2
                        size={16}
                        className="text-red-400 cursor-pointer"
                        onClick={async (event) => {
                          event.stopPropagation();
                          await handleDeleteTask(task._id);
                        }}
                      />
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
              </motion.div>
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {showTaskModal && (
          <TaskModal
            task={currentTask}
            onClose={() => {
              setShowTaskModal(false);
              setError("");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
