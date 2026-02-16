const MasterCourseDao = require("../dao/MasterCourseDao");

exports.createMasterCourse = async (req, res) => {
  try {
    const { topic, master_course_name } = req.body;
    if (!topic || !master_course_name) {
      return res
        .status(400)
        .json({ message: "Topic and Master Course Name are required" });
    }
    const newCourse = await MasterCourseDao.create(req.body);
    res
      .status(201)
      .json({ message: "Master Course created successfully", data: newCourse });
  } catch (error) {
    console.error("Error creating master course:", error);
    res
      .status(500)
      .json({ message: "Error creating master course", error: error.message });
  }
};

exports.getAllMasterCourses = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await MasterCourseDao.getAll(search, page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching master courses:", error);
    res
      .status(500)
      .json({ message: "Error fetching master courses", error: error.message });
  }
};

exports.getMasterCourseById = async (req, res) => {
  try {
    const course = await MasterCourseDao.getById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Master Course not found" });
    }
    res.status(200).json(course);
  } catch (error) {
    console.error("Error fetching master course:", error);
    res
      .status(500)
      .json({ message: "Error fetching master course", error: error.message });
  }
};

exports.updateMasterCourse = async (req, res) => {
  try {
    const updatedCourse = await MasterCourseDao.update(req.params.id, req.body);
    if (!updatedCourse) {
      return res
        .status(404)
        .json({ message: "Master Course not found or update failed" });
    }
    res
      .status(200)
      .json({
        message: "Master Course updated successfully",
        data: updatedCourse,
      });
  } catch (error) {
    console.error("Error updating master course:", error);
    res
      .status(500)
      .json({ message: "Error updating master course", error: error.message });
  }
};

exports.deleteMasterCourse = async (req, res) => {
  try {
    const success = await MasterCourseDao.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Master Course not found" });
    }
    res.status(200).json({ message: "Master Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting master course:", error);
    res
      .status(500)
      .json({ message: "Error deleting master course", error: error.message });
  }
};
