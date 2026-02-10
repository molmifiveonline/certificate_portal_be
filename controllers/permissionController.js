const permissionDao = require("../dao/permissionDao");
const roleDao = require("../dao/roleDao");
const { ok, error } = require("../utils/responseHandler");

const getAllPermissions = async (req, res) => {
  try {
    const permissions = await permissionDao.getAllPermissions();
    return ok(res, "Permissions fetched successfully", permissions);
  } catch (err) {
    console.error("Get All Permissions Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const getAllRoles = async (req, res) => {
  try {
    const roles = await roleDao.getAllRoles();
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
    return ok(res, "Role permissions updated successfully");
  } catch (err) {
    console.error("Update Role Permissions Error:", err);
    return error(res, 500, "Internal server error");
  }
};

module.exports = {
  getAllPermissions,
  getAllRoles,
  getRolePermissions,
  updateRolePermissions,
};
