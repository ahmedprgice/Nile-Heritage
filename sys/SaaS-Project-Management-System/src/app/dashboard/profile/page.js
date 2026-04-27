"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/http";
import { useRouter } from "next/navigation";
import Skeleton from "../components/Skeleton";
import { listDirectoryUsers } from "@/lib/users";
import {
  User,
  Shield,
  Settings,
  Edit,
  Briefcase,
  Mail,
  CheckCircle,
  Users
} from "lucide-react";

export default function Profile() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordMessage, setChangePasswordMessage] = useState(null);
  const [profileUpdateMessage, setProfileUpdateMessage] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Singapore"
  );
  const [language, setLanguage] = useState("English (US)");
  const [workspaceDefault, setWorkspaceDefault] = useState("Last active");
  const [exportingData, setExportingData] = useState(false);
  const [accountActionMessage, setAccountActionMessage] = useState("");
  const [directoryUsers, setDirectoryUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const valueOrDash = (value) =>
    value === undefined || value === null || value === "" ? "-" : value;

  const normalizeRoleValue = (role) => {
    const key = String(role || "").trim().toLowerCase();
    if (key === "owner") return "Owner";
    if (key === "admin") return "Admin";
    if (key === "manager") return "Manager";
    if (key === "member") return "Member";
    if (key === "superuser") return "Superuser";
    return "Member";
  };

  const profileData = useMemo(
    () => profile?.profile || profile?.data?.profile || null,
    [profile],
  );
  const userData = useMemo(
    () => profile?.user || profile?.data?.user || profile?.data || profile,
    [profile],
  );

  const profileName = valueOrDash(
    profileData?.name ||
      profileData?.fullName ||
      profileData?.username ||
      userData?.name ||
      userData?.fullName ||
      userData?.username,
  );
  const profileEmail = valueOrDash(profileData?.email || userData?.email);
  const normalizedUserRole = String(profileData?.role || userData?.role || "").trim().toLowerCase();
  const profileRole = valueOrDash(profileData?.role || userData?.role);
  const isOwner = normalizedUserRole === "owner";
  const canAssignSuperuserRole = ["owner", "superuser"].includes(
    String(profileData?.role || userData?.role || "").toLowerCase()
  );
  const canChangeRoles = ["owner", "admin", "superuser"].includes(
    String(profileData?.role || userData?.role || "").toLowerCase()
  );
  const profileInitial = profileName !== "-" ? profileName.charAt(0).toUpperCase() : "-";
  const activeProjects = valueOrDash(
    profileData?.stats?.activeProjects ??
      userData?.stats?.activeProjects ??
      profileData?.activeProjects ??
      userData?.activeProjects,
  );
  const completedTasks = valueOrDash(
    profileData?.stats?.completedTasks ??
      userData?.stats?.completedTasks ??
      profileData?.completedTasks ??
      userData?.completedTasks,
  );
  const teamMembers = valueOrDash(
    profileData?.stats?.teamMembers ??
      userData?.stats?.teamMembers ??
      profileData?.teamMembers ??
      userData?.teamMembers,
  );
  const rawPasswordLastChanged =
    profileData?.passwordLastChanged ??
    userData?.passwordLastChanged ??
    profileData?.passwordChangedAt ??
    userData?.passwordChangedAt;

  const passwordLastChangedText = useMemo(() => {
    if (!rawPasswordLastChanged) return "Never changed";
    const parsed = new Date(rawPasswordLastChanged);
    if (Number.isNaN(parsed.getTime())) return "Never changed";
    return parsed.toLocaleString();
  }, [rawPasswordLastChanged]);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (!newPassword) {
      return { score: 0, label: "Too weak", color: "bg-red-500" };
    }
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 10) score += 1;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 1;
    if (/\d/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 1) return { score, label: "Too weak", color: "bg-red-500" };
    if (score <= 3) return { score, label: "Medium", color: "bg-yellow-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  }, [newPassword]);

  const loadProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }

    setLoadingProfile(true);
    setProfileError("");

    const endpoints = ["/api/auth/me", "/api/users/me", "/api/profile/me"];

    for (const url of endpoints) {
      try {
        const res = await api.get(url);

        setProfile(res.data);
        const current = res.data?.profile || res.data?.user || {};
        localStorage.setItem("user", JSON.stringify(current));
        setLoadingProfile(false);
        return;
      } catch (err) {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          router.push("/auth");
          return;
        }
      }
    }

    setProfileError("Unable to load profile data from backend.");
    setLoadingProfile(false);
  }, [router]);

  const loadDirectoryUsers = useCallback(async () => {
    setLoadingUsers(true);
    setUsersError("");
    try {
      const users = await listDirectoryUsers();
      setDirectoryUsers(users);
    } catch (error) {
      console.error("Error loading users:", error);
      setUsersError("Unable to load users right now.");
      setDirectoryUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const updateMemberRole = useCallback(async (userId, nextRole) => {
    if (!userId || !nextRole) return;
    try {
      setUpdatingUserId(userId);
      await api.patch(`/api/auth/company-members/${userId}/role`, { role: nextRole });
      setDirectoryUsers((prev) =>
        prev.map((member) =>
          String(member.id) === String(userId) ? { ...member, role: nextRole } : member
        )
      );
    } catch (error) {
      console.error("Error updating role:", error);
      setUsersError(
        error?.response?.data?.message || "Failed to update user role."
      );
    } finally {
      setUpdatingUserId(null);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (activeTab !== "users") return;
    loadDirectoryUsers();
  }, [activeTab, loadDirectoryUsers]);

  useEffect(() => {
    if (!isOwner && activeTab === "users") {
      setActiveTab("overview");
    }
  }, [activeTab, isOwner]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const isDark = savedTheme === "dark";
    setDarkModeEnabled(isDark);
    const storedEmail = localStorage.getItem("pref_email_notifications");
    const storedTimezone = localStorage.getItem("pref_timezone");
    const storedLanguage = localStorage.getItem("pref_language");
    const storedWorkspaceDefault = localStorage.getItem("pref_workspace_default");
    if (storedEmail !== null) {
      setEmailNotifications(storedEmail === "true");
    }
    if (storedTimezone) {
      setTimezone(storedTimezone);
    }
    if (storedLanguage) {
      setLanguage(storedLanguage);
    }
    if (storedWorkspaceDefault) {
      setWorkspaceDefault(storedWorkspaceDefault);
    }
  }, []);

  useEffect(() => {
    if (!userData && !profileData) return;
    const nextName =
      profileData?.name ||
      profileData?.fullName ||
      profileData?.username ||
      userData?.name ||
      userData?.fullName ||
      userData?.username ||
      "";
    const nextEmail = profileData?.email || userData?.email || "";
    const nextRole = profileData?.role || userData?.role || "";
    setEditName(nextName);
    setEditEmail(nextEmail);
    setEditRole(nextRole);

    if (profileData?.preferences?.emailNotifications !== undefined) {
      setEmailNotifications(!!profileData.preferences.emailNotifications);
    } else if (userData?.preferences?.emailNotifications !== undefined) {
      setEmailNotifications(!!userData.preferences.emailNotifications);
    }
  }, [profileData, userData]);

  const tabs = [
    { id: "overview", label: "Overview", icon: User },
    { id: "edit", label: "Profile Details", icon: Edit },
    ...(isOwner ? [{ id: "users", label: "Users", icon: Users }] : []),
    { id: "security", label: "Security", icon: Shield },
    { id: "preferences", label: "Preferences", icon: Settings },
  ];

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePasswordMessage(null);

    if (!currentPassword || !newPassword) {
      setChangePasswordMessage({
        type: "error",
        text: "Current password and new password are required.",
      });
      return;
    }

    if (newPassword.length < 6) {
      setChangePasswordMessage({
        type: "error",
        text: "New password must be at least 6 characters long.",
      });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }

    try {
      setChangingPassword(true);
      const res = await api.patch("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });

      setChangePasswordMessage({
        type: "success",
        text: res.data?.message || "Password updated successfully.",
      });
      await loadProfile();
      setCurrentPassword("");
      setNewPassword("");
      setTimeout(() => {
        setShowPasswordModal(false);
        setChangePasswordMessage(null);
      }, 900);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        router.push("/auth");
        return;
      }

      setChangePasswordMessage({
        type: "error",
        text: err.response?.data?.message || "Failed to update password.",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileUpdateMessage(null);

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth");
      return;
    }

    if (!editName?.trim()) {
      setProfileUpdateMessage({
        type: "error",
        text: "Name is required.",
      });
      return;
    }

    try {
      setEditingProfile(true);
      const payload = {
        name: editName.trim(),
        fullName: editName.trim(),
        username: editName.trim(),
        role: canChangeRoles ? editRole?.trim() || undefined : undefined,
      };

      const endpoints = ["/api/auth/update-profile", "/api/profile/me", "/api/users/me"];
      let updated = false;

      for (const url of endpoints) {
        try {
          const res = await api.patch(url, payload);
          if (res?.data) {
            setProfile(res.data);
            updated = true;
            break;
          }
        } catch (err) {
          if (err.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            router.push("/auth");
            return;
          }
        }
      }

      if (!updated) {
        throw new Error("Unable to update profile.");
      }

      await loadProfile();
      setProfileUpdateMessage({
        type: "success",
        text: "Profile updated successfully.",
      });
    } catch (err) {
      setProfileUpdateMessage({
        type: "error",
        text: err.response?.data?.message || err.message || "Failed to update profile.",
      });
    } finally {
      setEditingProfile(false);
    }
  };

  const applyTheme = (isDark) => {
    const nextTheme = isDark ? "dark" : "light";
    localStorage.setItem("theme", nextTheme);
    document.body.classList.toggle("dark-theme", isDark);
    document.body.classList.toggle("light-theme", !isDark);
    window.dispatchEvent(new Event("theme-change"));
  };

  const updateEmailNotifications = (nextValue) => {
    setEmailNotifications(nextValue);
    localStorage.setItem("pref_email_notifications", String(nextValue));
    api
      .patch("/api/auth/preferences", { emailNotifications: nextValue })
      .then((res) => {
        const nextProfile = res.data?.profile || res.data?.user || res.data;
        if (nextProfile?.preferences?.emailNotifications !== undefined) {
          setEmailNotifications(!!nextProfile.preferences.emailNotifications);
        }
      })
      .catch((error) => {
        console.error("Error updating preferences:", error);
        setUsersError(
          error?.response?.data?.message || "Failed to update preferences."
        );
      });
  };


  const handleExportData = async () => {
    if (exportingData) return;
    setExportingData(true);
    setAccountActionMessage("");
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      setAccountActionMessage("We are preparing your export. You'll get an email once it's ready.");
    } finally {
      setExportingData(false);
    }
  };

  const handleDeactivateAccount = () => {
    setAccountActionMessage(
      "Account deactivation is not enabled yet. Please contact support to proceed."
    );
  };

  return (

    <div className="w-full">
      {loadingProfile && !profile && (
        <div className="space-y-6">
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-6 w-40 mb-3" />
                <Skeleton className="h-4 w-52 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((card) => (
              <div
                key={card}
                className="bg-[#111827] border border-gray-800 rounded-xl p-6"
              >
                <Skeleton className="h-5 w-24 mb-4" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loadingProfile || profile ? (
        <>
      {profileError && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
          {profileError}
        </div>
      )}
      {changePasswordMessage && !showPasswordModal && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 ${
            changePasswordMessage.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {changePasswordMessage.text}
        </div>
      )}
      {profileUpdateMessage && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 ${
            profileUpdateMessage.type === "success"
              ? "border-green-500/30 bg-green-500/10 text-green-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {profileUpdateMessage.text}
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-8">

        {/* SIDEBAR */}

        <div className="w-full xl:w-64 flex-shrink-0">

          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <div className="space-y-2">

              {tabs.map((tab) => {

                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                      isActive
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                        : "hover:bg-[#1f2937] text-gray-300"
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );

              })}

            </div>

          </div>

        </div>


        {/* MAIN CONTENT */}

        <div className="flex-1 min-w-0">

          <AnimatePresence mode="wait">

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >

              {/* ================= OVERVIEW ================= */}

              {activeTab === "overview" && (
                <>

                  {/* PROFILE HEADER */}

                  <div className="bg-[#111827] border border-gray-800 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">

                    <div className="flex items-center gap-5">

                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-xl font-bold">
                        {loadingProfile ? "..." : profileInitial}
                      </div>

                      <div>
                        <h1 className="text-xl font-semibold">
                          {loadingProfile ? "Loading..." : profileName}
                        </h1>

                        <p className="text-gray-400 text-sm flex items-center gap-2">
                          <Briefcase size={14} />
                          {loadingProfile ? "Loading..." : profileRole}
                        </p>

                        <p className="text-gray-500 text-sm flex items-center gap-2 mt-1">
                          <Mail size={14} />
                          {loadingProfile ? "Loading..." : profileEmail}
                        </p>
                      </div>

                    </div>

                    <button
                      onClick={() => setActiveTab("edit")}
                      className="px-5 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 transition"
                    >
                       Profile Details
                    </button>

                  </div>


                  {/* STATS */}

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">

                    <div className="bg-[#111827] border border-gray-800 rounded-xl p-6 flex items-center gap-4">

                      <div className="w-10 h-10 rounded-lg bg-indigo-600/20 flex items-center justify-center">
                        <Briefcase size={18} />
                      </div>

                      <div>
                        <p className="text-xl font-semibold">
                          {loadingProfile ? "..." : activeProjects}
                        </p>
                        <p className="text-gray-400 text-sm">Active Projects</p>
                      </div>

                    </div>


                    <div className="bg-[#111827] border border-gray-800 rounded-xl p-6 flex items-center gap-4">

                      <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
                        <CheckCircle size={18} />
                      </div>

                      <div>
                        <p className="text-xl font-semibold">
                          {loadingProfile ? "..." : completedTasks}
                        </p>
                        <p className="text-gray-400 text-sm">Completed Tasks</p>
                      </div>

                    </div>


                    <div className="bg-[#111827] border border-gray-800 rounded-xl p-6 flex items-center gap-4">

                      <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                        <Users size={18} />
                      </div>

                      <div>
                        <p className="text-xl font-semibold">
                          {loadingProfile ? "..." : teamMembers}
                        </p>
                        <p className="text-gray-400 text-sm">Team Members</p>
                      </div>

                    </div>

                  </div>

                </>
              )}


              {/* ================= EDIT PROFILE ================= */}

              {activeTab === "edit" && (

                <form
                  onSubmit={handleProfileSave}
                  className="bg-[#111827] border border-gray-800 rounded-xl p-8 space-y-6"
                >

                  <h2 className="text-xl font-semibold">
                    Profile Details
                  </h2>
                  <p className="text-sm text-gray-400">
                    Profile fields are managed by your admin and can’t be edited here.
                  </p>

                  <div className="grid md:grid-cols-2 gap-6">

                    <div>
                      <label className="text-sm text-gray-400">
                        Full Name
                      </label>

                      <input
                        className="w-full mt-2 p-3 rounded-lg bg-[#1e293b] border border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={loadingProfile ? "Loading..." : editName}
                        onChange={(e) => setEditName(e.target.value)}
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-400">
                        Email
                      </label>

                      <input
                        className="w-full mt-2 p-3 rounded-lg bg-[#1e293b] border border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={loadingProfile ? "Loading..." : editEmail}
                        readOnly
                      />
                    </div>

                  </div>

                  <div>
                    <label className="text-sm text-gray-400">
                      Role
                    </label>

                    <select
                      className="w-full mt-2 p-3 rounded-lg bg-[#1e293b] border border-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={loadingProfile ? "" : editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      disabled
                    >
                      <option value="" disabled>
                        Select role
                      </option>
                      <option value="Owner">Owner</option>
                      <option value="Admin">Admin</option>
                      <option value="Manager">Manager</option>
                      <option value="Member">Member</option>
                      <option value="Viewer">Viewer</option>
                      {canAssignSuperuserRole ? <option value="Superuser">Superuser</option> : null}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled
                    className="px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 opacity-60 cursor-not-allowed"
                  >
                    Save Changes
                  </button>

                </form>

              )}

              {/* ================= USERS ================= */}

              {activeTab === "users" && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Users</h2>
                      <p className="text-sm text-gray-400">
                        All users in your company directory.
                      </p>
                    </div>
                    <button
                      onClick={loadDirectoryUsers}
                      className="rounded-lg border border-gray-700 bg-[#1e293b] px-4 py-2 text-sm text-gray-200 transition hover:border-indigo-500"
                    >
                      Refresh
                    </button>
                  </div>

                  {!isOwner && (
                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-200">
                      Only the company owner can access this section.
                    </div>
                  )}

                  {usersError && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
                      {usersError}
                    </div>
                  )}

                  {isOwner && (
                    <div className="rounded-2xl border border-gray-800 bg-[#111827]">
                      <div className="grid grid-cols-[1.3fr_1.4fr_0.8fr] gap-4 border-b border-gray-800 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                        <span>Name</span>
                        <span>Email</span>
                        <span>Role</span>
                      </div>

                      {loadingUsers ? (
                        <div className="p-5 text-sm text-gray-400">Loading users...</div>
                      ) : directoryUsers.length === 0 ? (
                        <div className="p-5 text-sm text-gray-400">No users found.</div>
                      ) : (
                        <div className="divide-y divide-gray-800">
                          {directoryUsers.map((member) => {
                            const normalizedMemberRole = normalizeRoleValue(member.role);
                            const isMemberOwner =
                              String(normalizedMemberRole).toLowerCase() === "owner";
                            return (
                              <div
                                key={member.id || member.email || member.name}
                                className="grid grid-cols-[1.3fr_1.4fr_0.8fr] gap-4 px-5 py-4 text-sm text-gray-200"
                              >
                                <span className="font-medium text-white">
                                  {member.name || "User"}
                                </span>
                                <span className="text-gray-300">
                                  {member.email || "-"}
                                </span>
                                {!isMemberOwner ? (
                                <select
                                  value={normalizedMemberRole}
                                  onChange={(event) =>
                                    updateMemberRole(
                                      member.id,
                                      normalizeRoleValue(event.target.value)
                                    )
                                  }
                                  disabled={updatingUserId === member.id}
                                  className="role-select w-fit rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-100 outline-none"
                                  style={{ colorScheme: "dark" }}
                                >
                                    <option value="Admin">Admin</option>
                                    <option value="Manager">Manager</option>
                                    <option value="Member">Member</option>
                                  </select>
                                ) : (
                                  <span className="inline-flex w-fit items-center rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-200">
                                    {member.role || "Member"}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}


              {/* ================= SECURITY ================= */}

              {activeTab === "security" && (

                <div className="space-y-5">

                  <h2 className="text-xl font-semibold">Security</h2>

                  <div className="bg-[#111827] border border-gray-800 rounded-xl p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">

                    <div>
                      <p className="font-semibold">Password</p>
                      <p className="text-gray-400 text-sm">
                        Last changed{" "}
                        {loadingProfile ? "Loading..." : passwordLastChangedText}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setChangePasswordMessage(null);
                        setCurrentPassword("");
                        setNewPassword("");
                        setShowPasswordModal(true);
                      }}
                      className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700"
                    >
                      Change Password
                    </button>

                  </div>


                  <div className="bg-[#111827] border border-gray-800 rounded-xl p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">

                    <div>
                      <p className="font-semibold">
                        Two-Factor Authentication
                      </p>

                      <p className="text-gray-400 text-sm">
                        Not enabled
                      </p>
                    </div>

                    <button className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">
                      Enable
                    </button>

                  </div>

                </div>

              )}


              {/* ================= PREFERENCES ================= */}

              {activeTab === "preferences" && (

                <div className="bg-[#111827] border border-gray-800 rounded-xl p-8 space-y-6">

                  <h2 className="text-xl font-semibold">
                    Preferences
                  </h2>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-gray-700 bg-[#1e293b] p-5">
                      <h3 className="text-sm font-semibold text-white mb-1">
                        Appearance
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        Set your preferred theme for the dashboard.
                      </p>
                      <div className="flex items-center justify-between rounded-lg border border-gray-700/60 bg-[#111827] px-4 py-3">
                        <div>
                          <p className="text-sm text-white">Dark mode</p>
                          <p className="text-xs text-gray-400">
                            Toggle between light and dark UI.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          className="w-5 h-5"
                          checked={darkModeEnabled}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setDarkModeEnabled(next);
                            applyTheme(next);
                          }}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-700 bg-[#1e293b] p-5">
                      <h3 className="text-sm font-semibold text-white mb-1">
                        Notifications
                      </h3>
                      <p className="text-xs text-gray-400 mb-4">
                        Manage how we keep you updated.
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg border border-gray-700/60 bg-[#111827] px-4 py-3">
                          <div>
                            <p className="text-sm text-white">Email notifications</p>
                            <p className="text-xs text-gray-400">
                              Updates about boards, tasks, and mentions.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            className="w-5 h-5"
                            checked={emailNotifications}
                            onChange={(e) => updateEmailNotifications(e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>

                  </div>


                </div>

              )}

            </motion.div>

          </AnimatePresence>

        </div>

      </div>

      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            className="modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowPasswordModal(false);
              setChangePasswordMessage(null);
            }}
          >
            <motion.div
              className="modal-card w-full max-w-md p-6"
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="modal-title mb-1">Change Password</h3>
              <p className="modal-subtitle mb-4">
                Update your password to keep your account secure.
              </p>

              {changePasswordMessage && (
                <div
                  className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                    changePasswordMessage.type === "success"
                      ? "border-green-500/30 bg-green-500/10 text-green-300"
                      : "border-red-500/30 bg-red-500/10 text-red-300"
                  }`}
                >
                  {changePasswordMessage.text}
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="modal-input mt-2"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    className="modal-input mt-2"
                    required
                  />
                  <div className="mt-3 rounded-xl border border-white/10 bg-[#020617]/60 px-3 py-3">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-gray-400">Password Strength</span>
                      <span
                        className={`font-medium ${
                          passwordStrength.label === "Strong"
                            ? "text-emerald-400"
                            : passwordStrength.label === "Medium"
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map((step) => (
                        <div
                          key={step}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            passwordStrength.score >= step
                              ? passwordStrength.color
                              : "bg-white/10"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Must be at least 6 characters.
                  </p>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setChangePasswordMessage(null);
                    }}
                    className="modal-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="modal-primary disabled:opacity-60"
                  >
                    {changingPassword ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        </>
      ) : null}
    </div>
  );
}
