"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

export default function TaskModal({
  task,
  onClose,
  onSave,
  availableAssignees = [],
  assigneeRoleMap = {},
  setError,
}) {
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

  const toggleAssignee = (user) => {
    const label = getAssigneeLabel(user);
    setAssignees((prev) =>
      prev.includes(label)
        ? prev.filter((assignee) => assignee !== label)
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
  }, [availableAssignees, assigneeRoleMap, assigneeSearch]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError?.("Task title is required");
      return;
    }

    if (!assignees.length) {
      setError?.("Please select at least one assignee");
      return;
    }

    if (!dueDate) {
      setError?.("Due date is required");
      return;
    }

    try {
      setSaving(true);
      setError?.("");

      const payload = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assignees,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        dueDate,
      };

      await onSave(payload, task);
      onClose?.();
    } catch (err) {
      setError?.(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to save task"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card w-[90%] max-w-md p-6"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title mb-1">
          {task ? "Edit Task" : "New Task"}
        </h2>
        <p className="modal-subtitle mb-4">
          Capture task details so your team can move fast.
        </p>

        <div className="space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task Title"
            className="modal-input"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Task Description"
            rows={4}
            className="modal-textarea"
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="modal-select flex-1"
            >
              <option>Todo</option>
              <option>In Progress</option>
              <option>Done</option>
            </select>

            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="modal-select flex-1"
            >
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>

          <div>
            <p className="mb-1 text-sm text-gray-400">Assignees</p>

            <div className="relative">
              <button
                type="button"
                onClick={() => setAssigneeDropdownOpen((prev) => !prev)}
                className="modal-input flex items-center justify-between text-left"
              >
                <span className="truncate text-sm">
                  {assignees.length > 0
                    ? assignees.join(", ")
                    : "Select assignees"}
                </span>

                <ChevronDown
                  size={16}
                  className={`transition ${
                    assigneeDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {assigneeDropdownOpen && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-700 bg-[#0f172a] shadow-xl">
                  <div className="border-b border-gray-700 p-3">
                    <input
                      value={assigneeSearch}
                      onChange={(e) => setAssigneeSearch(e.target.value)}
                      placeholder="Search assignees..."
                      className="modal-input text-sm"
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
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#1e293b]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm text-white">{label}</p>
                            <p className="truncate text-[11px] text-gray-400">
                              {assigneeRoleMap[getAssigneeKey(user)] || "Member"}
                            </p>
                          </div>

                          {selected && (
                            <Check
                              size={14}
                              className="shrink-0 text-indigo-400"
                            />
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
            className="modal-input"
          />

          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="modal-input"
          />
        </div>

        <div className="modal-actions">
          <button
            onClick={onClose}
            disabled={saving}
            className="modal-secondary disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="modal-primary disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
