const {
  isSuperuser,
  canCreateWorkspace,
  canManageWorkspace,
  canManageWorkspaceMembers,
  canManageBoards,
  canCreateBoard,
  canCreateChatChannel,
} = require("../utils/permissions");

const isAuthenticatedRole = (role) => Boolean(role);

const permissionChecks = {
  "workspace:create": canCreateWorkspace,
  "workspace:update": canManageWorkspace,
  "workspace:delete": canManageWorkspace,
  "workspace:members": canManageWorkspaceMembers,
  "workspace:activate": () => true,
  "board:create": canCreateBoard,
  "board:update": canManageBoards,
  "board:delete": canManageBoards,
  "board:access": canCreateBoard,
  // Any authenticated workspace user can manage board structure and columns/tasks.
  "board:structure": isAuthenticatedRole,
  "task:edit": isAuthenticatedRole,
  "chat:channel:create": canCreateChatChannel,
};

const requirePermission = (permission) => (req, res, next) => {
  const role = req.user?.role;
  if (isSuperuser(role)) {
    return res.status(403).json({
      message: "Superuser access is restricted to the admin panel and billing.",
    });
  }

  const checker = permissionChecks[permission];
  if (!checker) return next();

  if (!checker(role)) {
    return res.status(403).json({
      message: "You do not have permission to perform this action.",
    });
  }

  return next();
};

module.exports = requirePermission;
