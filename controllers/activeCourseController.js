const ActiveCourseDao = require("../dao/ActiveCourseDao");

const MasterCourseDao = require("../dao/MasterCourseDao");

exports.createCourse = async (req, res) => {
  try {
    const {
      topic: topicId,
      master_course_name,
      start_date,
      type_of_course,
    } = req.body;

    // Fetch Master Course to get the Topic Name
    const masterCourse = await MasterCourseDao.getById(topicId);
    if (!masterCourse) {
      return res.status(404).json({ message: "Master Course not found" });
    }
    const topicName = masterCourse.topic;

    // Generate Course ID using Topic Name
    const year = new Date().getFullYear();
    const count = await ActiveCourseDao.getLastCourseId(topicName);
    const nextId = (count + 1).toString().padStart(3, "0");
    const course_id = `${topicName}-${year}-${nextId}`;

    req.body.course_id = course_id;
    req.body.topic = topicName; // Store Name in DB, not UUID
    // Ensure master_course_id is set correctly (it should be in body, but safeguard)
    req.body.master_course_id = topicId;

    // Map type_of_course to course_type if present
    if (type_of_course) {
      req.body.course_type = type_of_course;
    }

    const newCourse = await ActiveCourseDao.create(req.body);
    res
      .status(201)
      .json({ message: "Course created successfully", data: newCourse });
  } catch (error) {
    console.error("Error creating course:", error);
    res
      .status(500)
      .json({ message: "Error creating course", error: error.message });
  }
};

exports.getAllCourses = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await ActiveCourseDao.getAll(search, page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res
      .status(500)
      .json({ message: "Error fetching courses", error: error.message });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const course = await ActiveCourseDao.getById(req.params.id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.status(200).json(course);
  } catch (error) {
    console.error("Error fetching course:", error);
    res
      .status(500)
      .json({ message: "Error fetching course", error: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    // Map type_of_course to course_type if present, and remove the original key
    if (req.body.type_of_course) {
      req.body.course_type = req.body.type_of_course;
      delete req.body.type_of_course;
    }

    const updatedCourse = await ActiveCourseDao.update(req.params.id, req.body);
    if (!updatedCourse) {
      return res
        .status(404)
        .json({ message: "Course not found or update failed" });
    }
    res
      .status(200)
      .json({ message: "Course updated successfully", data: updatedCourse });
  } catch (error) {
    console.error("Error updating course:", error);
    res
      .status(500)
      .json({ message: "Error updating course", error: error.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const success = await ActiveCourseDao.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Course not found" });
    }
    res.status(200).json({ message: "Course deleted successfully" });
  } catch (error) {
    console.error("Error deleting course:", error);
    res
      .status(500)
      .json({ message: "Error deleting course", error: error.message });
  }
};
