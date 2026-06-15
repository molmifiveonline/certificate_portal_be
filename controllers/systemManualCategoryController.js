const SystemManualCategoryDao = require("../dao/systemManualCategoryDao");
const LogDao = require("../dao/LogDao");
const { ok, error } = require("../utils/responseHandler");

const getCategories = async (req, res) => {
  try {
    const { search, page, limit, sort_by, sort_order } = req.query;
    const result = await SystemManualCategoryDao.getAllCategories({
      search,
      page,
      limit,
      sort_by,
      sort_order,
    });
    return ok(res, "System Manual Categories fetched successfully", result);
  } catch (err) {
    console.error("Get All System Manual Categories Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await SystemManualCategoryDao.getCategoryById(id);
    if (!category) {
      return error(res, 404, "System Manual Category not found");
    }
    return ok(res, "System Manual Category fetched successfully", category);
  } catch (err) {
    console.error("Get System Manual Category Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return error(res, 400, "Name is required");
    }

    const categoryId = await SystemManualCategoryDao.createCategory({
      name,
      description,
    });

    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "CREATE_SYSTEM_MANUAL_CATEGORY",
        details: `Created system manual category: ${name}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "System Manual Category created successfully", { id: categoryId });
  } catch (err) {
    console.error("Create System Manual Category Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;

    const existing = await SystemManualCategoryDao.getCategoryById(id);
    if (!existing) {
      return error(res, 404, "System Manual Category not found");
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;

    const updated = await SystemManualCategoryDao.updateCategory(id, updateData);
    if (!updated && Object.keys(updateData).length > 0) {
      return error(res, 400, "Failed to update System Manual Category");
    }

    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "UPDATE_SYSTEM_MANUAL_CATEGORY",
        details: `Updated system manual category ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "System Manual Category updated successfully");
  } catch (err) {
    console.error("Update System Manual Category Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await SystemManualCategoryDao.deleteCategory(id);
    if (!deleted) {
      return error(res, 404, "System Manual Category not found");
    }

    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "DELETE_SYSTEM_MANUAL_CATEGORY",
        details: `Deleted system manual category ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "System Manual Category deleted successfully");
  } catch (err) {
    console.error("Delete System Manual Category Error:", err);
    return error(res, 500, "Internal server error");
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
