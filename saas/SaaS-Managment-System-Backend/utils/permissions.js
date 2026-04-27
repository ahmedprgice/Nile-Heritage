const ROLE_OWNER = "Owner";
const ROLE_ADMIN = "Admin";
const ROLE_MANAGER = "Manager";
const ROLE_MEMBER = "Member";
const ROLE_SUPERUSER = "Superuser";

const normalizeRole = (role) => {
  const normalized = String(role || "").trim().toLowerCase();
  // Backward-compatibility for older records that stored regular users as "User".
  if (normalized === "user") return "member";
  return normalized;
};
const hasAnyRole = (role, allowedRoles = []) =>
  allowedRoles.map((item) => normalizeRole(item)).includes(normalizeRole(role));

const isSuperuser = (role) => normalizeRole(role) === normalizeRole(ROLE_SUPERUSER);

const canCreateWorkspace = (role) =>
  hasAnyRole(role, [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER, ROLE_MEMBER]);

const canManageWorkspace = (role) =>
  hasAnyRole(role, [ROLE_OWNER, ROLE_ADMIN]);

const canManageWorkspaceMembers = (role) =>
  hasAnyRole(role, [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER]);

const canManageBoards = (role) =>
  hasAnyRole(role, [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER, ROLE_MEMBER]);

const canCreateBoard = (role) =>
  hasAnyRole(role, [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER, ROLE_MEMBER]);

const canEditTasks = (role) =>
  hasAnyRole(role, [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER, ROLE_MEMBER]);

const canManageUsersAndRoles = (role) =>
  hasAnyRole(role, [ROLE_OWNER, ROLE_ADMIN]);

const canCreateChatChannel = (role) =>
  hasAnyRole(role, [ROLE_OWNER, ROLE_ADMIN, ROLE_MANAGER, ROLE_MEMBER]);

module.exports = {
  ROLE_OWNER,
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_MEMBER,
  ROLE_SUPERUSER,
  normalizeRole,
  isSuperuser,
  canCreateWorkspace,
  canManageWorkspace,
  canManageWorkspaceMembers,
  canManageBoards,
  canCreateBoard,
  canEditTasks,
  canManageUsersAndRoles,
  canCreateChatChannel,
};
