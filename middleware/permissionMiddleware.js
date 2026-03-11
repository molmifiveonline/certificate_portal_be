const permissionDao = require("../dao/permissionDao");
const { error } = require("../utils/responseHandler");

const checkPermission = (requiredPermission, allowRoles = []) => {
  return async (req, res, next) => {
    try {
      const userRole = (req.user.role || "").toLowerCase();

      // Superadmin and admin always have full access — skip DB check
      if (userRole === "superadmin" || userRole === "admin") {
        return next();
      }

      // Optional role-level bypass for specific endpoints (read-only utility calls, etc.)
      const normalizedAllowRoles = (allowRoles || []).map((r) =>
        String(r).toLowerCase(),
      );
      if (normalizedAllowRoles.includes(userRole)) {
        return next();
      }

      const roleId = req.user.roleId; // from authMiddleware

      // OPTIMIZATION: In a high-load app, cache this.
      // For now, DB query is fine for accuracy.
      const permissions = await permissionDao.getPermissionsByRoleId(roleId);

      if (permissions.includes(requiredPermission)) {
        next();
      } else {
        return error(res, 403, "Access denied. Insufficient permissions.", {
          code: "PERMISSION_DENIED",
          required: requiredPermission,
        });
      }
    } catch (err) {
      console.error("Permission Check Error:", err);
      return error(res, 500, "Internal server error during permission check");
    }
  };
};

module.exports = checkPermission;
