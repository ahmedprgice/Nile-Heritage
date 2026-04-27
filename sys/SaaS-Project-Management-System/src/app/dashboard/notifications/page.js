"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2, CheckCircle, Bell, AlertTriangle } from "lucide-react";
import api from "@/lib/http";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/api/notifications");
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading notifications:", err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to load notifications"
      );
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (id) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.filter((n) => n._id !== id && n.id !== id)
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
      setError(
        err?.response?.data?.message || "Failed to mark notification as read"
      );
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "info":
        return "bg-blue-500/10 border-blue-500/30 text-blue-300";
      case "success":
        return "bg-green-500/10 border-green-500/30 text-green-300";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/30 text-yellow-300";
      default:
        return "bg-gray-500/10 border-gray-500/30 text-gray-300";
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "info":
        return <Bell className="text-blue-400" size={18} />;
      case "success":
        return <CheckCircle className="text-green-400" size={18} />;
      case "warning":
        return <AlertTriangle className="text-yellow-400" size={18} />;
      default:
        return <Bell className="text-gray-400" size={18} />;
    }
  };

  const formatTime = (value) => {
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

  return (
    <div>
      <h1 className="text-4xl font-bold mb-10">Notifications</h1>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {loading && <p className="text-gray-400">Loading notifications...</p>}

        {!loading && notifications.length === 0 && (
          <p className="text-gray-500">No notifications.</p>
        )}

        {notifications.map((note) => (
          <div
            key={note._id || note.id}
            className={`flex justify-between items-center p-5 rounded-xl border transition ${getTypeColor(
              note.type
            )}`}
          >
            <div className="flex items-center gap-3">
              {getTypeIcon(note.type)}

              <div>
                <p className="text-sm">{note.text}</p>
                <span className="text-xs text-gray-400">
                  {formatTime(note.createdAt || note.time)}
                </span>
              </div>
            </div>

            <button
              onClick={() => markAsRead(note._id || note.id)}
              className="text-gray-400 hover:text-red-400 transition"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}