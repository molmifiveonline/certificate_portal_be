const adminRoleDao = require("../dao/adminRoleDao");

const createAdminRole = async (req, res) => {
  try {
    const { role_name, description, status } = req.body;
    if (!role_name) {
      return res
        .status(400)
        .json({ success: false, message: "Role Name is required" });
    }

    const id = await adminRoleDao.createAdminRole({
      role_name,
      description,
      status,
    });
    res.status(201).json({
      success: true,
      message: "Admin Role created successfully",
      data: { id },
    });
  } catch (error) {
    console.error("Error creating Admin Role:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to create Admin Role" });
  }
};

const getAllAdminRoles = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await adminRoleDao.getAllAdminRoles(search, page, limit);

    if (page && limit) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } else {
      res.status(200).json({
        success: true,
        data: result,
      });
    }
  } catch (error) {
    console.error("Error fetching Admin Roles:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch Admin Roles" });
  }
};

const getAdminRoleById = async (req, res) => {
  try {
    const role = await adminRoleDao.getAdminRoleById(req.params.id);
    if (!role) {
      return res
        .status(404)
        .json({ success: false, message: "Admin Role not found" });
    }
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    console.error("Error fetching Admin Role:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch Admin Role" });
  }
};

const updateAdminRole = async (req, res) => {
  try {
    const { role_name, description, status } = req.body;
    if (!role_name) {
      return res
        .status(400)
        .json({ success: false, message: "Role Name is required" });
    }

    const affectedRows = await adminRoleDao.updateAdminRole(req.params.id, {
      role_name,
      description,
      status,
    });

    if (affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Admin Role not found" });
    }

    res.status(200).json({
      success: true,
      message: "Admin Role updated successfully",
    });
  } catch (error) {
    console.error("Error updating Admin Role:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update Admin Role" });
  }
};

const deleteAdminRole = async (req, res) => {
  try {
    const affectedRows = await adminRoleDao.deleteAdminRole(req.params.id);
    if (affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Admin Role not found" });
    }

    res.status(200).json({
      success: true,
      message: "Admin Role deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting Admin Role:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete Admin Role" });
  }
};

module.exports = {
  createAdminRole,
  getAllAdminRoles,
  getAdminRoleById,
  updateAdminRole,
  deleteAdminRole,
};
