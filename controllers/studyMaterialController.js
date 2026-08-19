const StudyMaterialDao = require("../dao/StudyMaterialDao");
const LogDao = require("../dao/LogDao");
const { ok, error } = require("../utils/responseHandler");

const getStudyMaterials = async (req, res) => {
  try {
    const { search, page, limit, sort_by, sort_order, master_course_id, user_type } = req.query;
    const result = await StudyMaterialDao.getAllStudyMaterials({
      search,
      page,
      limit,
      sort_by,
      sort_order,
      master_course_id,
      user_type,
    });
    return ok(res, "Study Materials fetched successfully", result);
  } catch (err) {
    console.error("Get All Study Materials Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const getStudyMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const studyMaterial = await StudyMaterialDao.getStudyMaterialById(id);
    if (!studyMaterial) {
      return error(res, 404, "Study Material not found");
    }
    return ok(res, "Study Material fetched successfully", studyMaterial);
  } catch (err) {
    console.error("Get Study Material Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const addStudyMaterial = async (req, res) => {
  try {
    const { master_course_id, category, user_type, access_type, file_display_names } = req.body;

    if (!master_course_id || !category || !user_type) {
      return error(res, 400, "Master course, category, and user type are required");
    }

    // Process file display names sent from frontend
    let displayNamesArray = [];
    if (file_display_names) {
      try {
         displayNamesArray = JSON.parse(file_display_names);
      } catch (e) {
         console.warn("Could not parse file_display_names JSON", e);
      }
    }

    // Map files with their custom display names
    const filesToSave = (req.files || []).map((file, index) => {
       return {
          ...file,
          display_name: displayNamesArray[index] || file.originalname
       };
    });

    const materialId = await StudyMaterialDao.createStudyMaterial({
      master_course_id,
      category,
      user_type,
      access_type
    }, filesToSave);

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "CREATE_STUDY_MATERIAL",
        details: `Created study material for category: ${category}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "Study Material created successfully", { id: materialId });
  } catch (err) {
    console.error("Add Study Material Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const updateStudyMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      master_course_id, 
      category, 
      user_type, 
      access_type,
      removed_files,
      new_file_display_names,
      existing_file_display_names
    } = req.body;

    // Fetch existing
    const existing = await StudyMaterialDao.getStudyMaterialById(id);
    if (!existing) {
      return error(res, 404, "Study Material not found");
    }

    const updateData = {};
    if (master_course_id !== undefined) updateData.master_course_id = master_course_id;
    if (category !== undefined) updateData.category = category;
    if (user_type !== undefined) updateData.user_type = user_type;
    if (access_type !== undefined) updateData.access_type = access_type;

    // Parse removed files array
    let removedFilesArray = [];
    if (removed_files) {
      try {
         removedFilesArray = JSON.parse(removed_files);
      } catch (e) {
         console.warn("Could not parse removed_files JSON", e);
      }
    }

    // Parse existing file display name updates
    let existingFileDisplayNamesArray = [];
    if (existing_file_display_names) {
      try {
         existingFileDisplayNamesArray = JSON.parse(existing_file_display_names);
         updateData.file_display_names_update = existingFileDisplayNamesArray;
      } catch (e) {
         console.warn("Could not parse existing_file_display_names JSON", e);
      }
    }

    // Process display names for newly uploaded files
    let newDisplayNamesArray = [];
    if (new_file_display_names) {
      try {
         newDisplayNamesArray = JSON.parse(new_file_display_names);
      } catch (e) {
         console.warn("Could not parse new_file_display_names JSON", e);
      }
    }

    // Map new files with their custom display names
    const newFilesToSave = (req.files || []).map((file, index) => {
       return {
          ...file,
          display_name: newDisplayNamesArray[index] || file.originalname
       };
    });

    await StudyMaterialDao.updateStudyMaterial(
      id, 
      updateData, 
      newFilesToSave,
      removedFilesArray
    );

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "UPDATE_STUDY_MATERIAL",
        details: `Updated study material ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "Study Material updated successfully");
  } catch (err) {
    console.error("Update Study Material Error:", err);
    return error(res, 500, "Internal server error");
  }
};

const deleteStudyMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await StudyMaterialDao.deleteStudyMaterial(id);
    if (!deleted) {
      return error(res, 404, "Study Material not found");
    }

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "DELETE_STUDY_MATERIAL",
        details: `Deleted study material ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    return ok(res, "Study Material deleted successfully");
  } catch (err) {
    console.error("Delete Study Material Error:", err);
    return error(res, 500, "Internal server error");
  }
};

module.exports = {
  getStudyMaterials,
  getStudyMaterial,
  addStudyMaterial,
  updateStudyMaterial,
  deleteStudyMaterial,
};
