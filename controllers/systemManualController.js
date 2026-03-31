const SystemManualDao = require("../dao/systemManualDao");
const LogDao = require("../dao/LogDao");
const { ok, error } = require("../utils/responseHandler");

const getSystemManuals = async (req, res) => {
  try {
    const { search, page, limit, sort_by, sort_order } = req.query;
    const result = await SystemManualDao.getAllSystemManuals({
      search,
      page,
      limit,
      sort_by,
      sort_order,
    });
    return ok(res, "System Manuals fetched successfully", result);
  } catch (err) {
    console.error("Get All System Manuals Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const getSystemManual = async (req, res) => {
  try {
    const { id } = req.params;
    const manual = await SystemManualDao.getSystemManualById(id);
    if (!manual) {
      return error(res, 404, "System Manual not found");
    }

    return ok(res, "System Manual fetched successfully", manual);
  } catch (err) {
    console.error("Get System Manual Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const addSystemManual = async (req, res) => {
  try {
    const { title, document_type, url_link } = req.body;

    if (!title) {
      return error(res, 400, "Title is required");
    }

    if (!document_type || !["file", "url"].includes(document_type)) {
      return error(
        res,
        400,
        "Valid document type ('file' or 'url') is required",
      );
    }

    let file_name = null;
    let file_original_name = null;
    let final_url_link = null;

    if (document_type === "file") {
      if (!req.file) {
        return error(res, 400, "File is required when document type is 'file'");
      }
      file_name = req.file.filename;
      file_original_name = req.file.originalname;
    } else {
      if (!url_link) {
        return error(res, 400, "URL is required when document type is 'url'");
      }
      final_url_link = url_link;
    }

    const manualId = await SystemManualDao.createSystemManual({
      title,
      document_type,
      file_name,
      file_original_name,
      url_link: final_url_link,
    });

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "CREATE_SYSTEM_MANUAL",
        details: `Created system manual: ${title}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "System Manual created successfully", { id: manualId });
  } catch (err) {
    console.error("Add System Manual Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const updateSystemManual = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, document_type, url_link } = req.body;

    // Fetch existing logic to maintain state if needed
    const existing = await SystemManualDao.getSystemManualById(id);
    if (!existing) {
      return error(res, 404, "System Manual not found");
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;

    if (document_type !== undefined) {
      if (!["file", "url"].includes(document_type)) {
        return error(
          res,
          400,
          "Valid document type ('file' or 'url') is required",
        );
      }
      updateData.document_type = document_type;

      if (document_type === "file") {
        if (req.file) {
          updateData.file_name = req.file.filename;
          updateData.file_original_name = req.file.originalname;
          updateData.url_link = null; // Clear URL if switching to file
        }
        // If no req.file but moving to 'file', we might want to keep old file if it existed, or throw an error based on frontend logic.
        // Here we assume if they send form with 'file' type, they must provide file OR the old file continues.
      } else if (document_type === "url") {
        if (!url_link) {
          // Keep old URL if new is blank, or override? We assume override since it's an update
          if (url_link !== undefined) updateData.url_link = url_link;
        } else {
          updateData.url_link = url_link;
        }
        updateData.file_name = null; // Clear files if switching to url
        updateData.file_original_name = null;
      }
    } else {
      // document_type not changed in request body
      if (req.file) {
        updateData.file_name = req.file.filename;
        updateData.file_original_name = req.file.originalname;
        if (existing.document_type !== "file") {
          updateData.document_type = "file";
          updateData.url_link = null;
        }
      } else if (url_link !== undefined && existing.document_type === "url") {
        updateData.url_link = url_link;
      }
    }

    const updated = await SystemManualDao.updateSystemManual(id, updateData);
    if (!updated && Object.keys(updateData).length > 0) {
      return error(res, 400, "Failed to update System Manual");
    }

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "UPDATE_SYSTEM_MANUAL",
        details: `Updated system manual ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "System Manual updated successfully");
  } catch (err) {
    console.error("Update System Manual Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const deleteSystemManual = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await SystemManualDao.deleteSystemManual(id);
    if (!deleted) {
      return error(res, 404, "System Manual not found");
    }

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "DELETE_SYSTEM_MANUAL",
        details: `Deleted system manual ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "System Manual deleted successfully");
  } catch (err) {
    console.error("Delete System Manual Error:", err);
    return error(res, 500, "Internal server error");
  }
};

module.exports = {
  getSystemManuals,
  getSystemManual,
  addSystemManual,
  updateSystemManual,
  deleteSystemManual,
};
