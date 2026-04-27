"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Copy, Mail, Shield } from "lucide-react";
import api from "@/lib/http";

export default function InviteMemberModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Member");
  const [canInvite, setCanInvite] = useState(true);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const [inviteLink, setInviteLink] = useState("");
  const permissionMessage = "Only owners and admins can invite members.";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("user");
      const parsed = raw ? JSON.parse(raw) : {};
      const roleValue = String(parsed?.role || "").toLowerCase();
      const allowed = ["owner", "admin"].includes(roleValue);
      setCanInvite(allowed);
      if (!allowed) {
        setError(permissionMessage);
      }
    } catch {
      setCanInvite(false);
      setError(permissionMessage);
    }
  }, []);

  const createInvitation = async (e) => {
    e.preventDefault();
    setError("");
    setCopied(false);

    if (!canInvite) {
      setError(permissionMessage);
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/api/auth/invitations", {
        email: email.trim(),
        role,
      });

      const backendInviteLink =
        res?.data?.inviteLink ||
        res?.data?.invitation?.inviteLink ||
        res?.data?.invitationUrl ||
        "";

      setInviteLink(backendInviteLink);
      setSuccess(true);
    } catch (err) {
      console.error("Create invitation error:", err);
      setError(
        err?.response?.data?.message || "Failed to create invitation."
      );
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Failed to copy invite link.");
    }
  };

  const handleClose = () => {
    setEmail("");
    setRole("Member");
    setLoading(false);
    setSuccess(false);
    setCopied(false);
    setError("");
    setInviteLink("");
    onClose?.();
  };

  return (
    <div
      className="modal-overlay fixed inset-0 flex items-center justify-center z-50 px-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="modal-card w-full max-w-[420px] p-8 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {!success && (
          <form onSubmit={createInvitation} className="w-full flex flex-col gap-4">
            <div className="text-center">
              <h2 className="modal-title">Invite Member</h2>
              <p className="modal-subtitle mt-2">
                Send a real company invitation to a team member.
              </p>
            </div>

            <div className="w-full">
              <label className="text-sm text-gray-300 mb-2 flex items-center gap-2">
                <Mail size={16} />
                Member Email
              </label>
              <input
                type="email"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="modal-input"
                disabled={!canInvite || loading}
              />
            </div>

            <div className="w-full">
              <label className="text-sm text-gray-300 mb-2 flex items-center gap-2">
                <Shield size={16} />
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="modal-select"
                disabled={!canInvite || loading}
              >
                <option value="Member">Member</option>
                <option value="Manager">Manager</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {error && (
              <div className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="modal-actions w-full">
              <button
                type="button"
                onClick={handleClose}
                className="modal-secondary flex-1"
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="modal-primary flex-1 disabled:opacity-60"
                disabled={loading || !canInvite}
              >
                {loading ? "Creating..." : "Send Invite"}
              </button>
            </div>
          </form>
        )}

        {loading && !success && (
          <div className="flex flex-col items-center gap-4 mt-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"
            />
          </div>
        )}

        {success && (
          <div className="flex flex-col items-center gap-4 w-full">
            <CheckCircle className="text-green-400 w-14 h-14" />
            <p className="text-gray-300 font-medium text-center">
              Invitation created successfully!
            </p>

            <div className="flex gap-2 w-full">
              <input
                value={inviteLink}
                readOnly
                className="modal-input flex-1"
              />
              <button
                onClick={copyToClipboard}
                className="modal-primary flex items-center gap-1"
              >
                <Copy size={16} /> Copy
              </button>
            </div>

            {copied && <p className="text-green-400 text-sm mt-2">Copied!</p>}

            {!inviteLink && (
              <p className="text-yellow-400 text-sm text-center">
                Invite was created, but no invite link was returned by the backend.
              </p>
            )}

            <button
              onClick={handleClose}
              className="mt-4 text-sm text-gray-400 hover:text-white transition"
            >
              Close
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
