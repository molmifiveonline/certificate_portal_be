const permissionDao = require("../dao/permissionDao");
const { error } = require("../utils/responseHandler");

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const userRole = (req.user.role || "").toLowerCase();

      // Superadmin and admin always have full access — skip DB check
      if (userRole === "superadmin" || userRole === "admin") {
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
