const permissionDao = require("../dao/permissionDao");
const roleDao = require("../dao/roleDao");
const adminRoleDao = require("../dao/adminRoleDao");
const LogDao = require("../dao/LogDao");
const { ok, error } = require("../utils/responseHandler");

const getAllPermissions = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const permissions = await permissionDao.getAllPermissions(page, limit);
    return ok(res, "Permissions fetched successfully", permissions);
  } catch (err) {
    console.error("Get All Permissions Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const getAllRoles = async (req, res) => {
  try {
    // Return admin_roles instead of static roles (trainer/candidate removed)
    const roles = await adminRoleDao.getAllAdminRoles();
    return ok(res, "Roles fetched successfully", roles);
  } catch (err) {
    console.error("Get All Roles Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const getRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const permissions = await permissionDao.getRolePermissionsFull(roleId);
    return ok(res, "Role permissions fetched successfully", permissions);
  } catch (err) {
    console.error("Get Role Permissions Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const updateRolePermissions = async (req, res) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body; // Array of permission IDs

    if (!Array.isArray(permissionIds)) {
      return error(res, 400, "permissionIds must be an array");
    }

    await permissionDao.updateRolePermissions(roleId, permissionIds);

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "UPDATE_ROLE_PERMISSIONS",
        details: `Updated permissions for role ID: ${roleId}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
    }

    return ok(res, "Role permissions updated successfully");
  } catch (err) {
    console.error("Update Role Permissions Error CODE:", err.code);
    console.error("Update Role Permissions Error MSG:", err.message);
    console.error("Update Role Permissions Error SQL:", err.sql);
    return error(res, 500, "Internal server error");
  }
};

module.exports = {
  getAllPermissions,
  getAllRoles,
  getRolePermissions,
  updateRolePermissions,
};
