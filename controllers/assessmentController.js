const AssessmentDao = require("../dao/AssessmentDao");
const AssessmentResultDao = require("../dao/AssessmentResultDao");

exports.createAssessment = async (req, res) => {
  try {
    const {
      title,
      course_id,
      type_of_test,
      candidate_ids,
      num_of_questions,
      questions_choice,
      question_ids,
    } = req.body;

    if (!title || !course_id || !type_of_test) {
      return res.status(400).json({
        success: false,
        message: "Title, Course, and Type of Test are required",
      });
    }

    // For pre/post tests, auto-populate candidates from course
    let finalCandidateIds = candidate_ids;
    if (type_of_test === "1" || type_of_test === "2") {
      const candidates = await AssessmentDao.getCandidatesByCourse(course_id);
      finalCandidateIds = candidates.map((c) => c.id).join(",");
    }

    const newAssessment = await AssessmentDao.create({
      title,
      course_id,
      type_of_test,
      candidate_ids: finalCandidateIds || null,
      num_of_questions: num_of_questions || 10,
      questions_choice: questions_choice || "auto",
      question_ids: questions_choice === "manual" ? question_ids : null,
    });

    res.status(201).json({
      success: true,
      message: "Assessment created successfully",
      data: newAssessment,
    });
  } catch (error) {
    console.error("Error creating assessment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAllAssessments = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await AssessmentDao.getAll(search, page, limit);
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    console.error("Error fetching assessments:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAssessmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const assessment = await AssessmentDao.getById(id);
    if (!assessment) {
      return res
        .status(404)
        .json({ success: false, message: "Assessment not found" });
    }
    res.status(200).json({ success: true, data: assessment });
  } catch (error) {
    console.error("Error fetching assessment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updateAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      course_id,
      type_of_test,
      candidate_ids,
      num_of_questions,
      questions_choice,
      question_ids,
    } = req.body;

    // For pre/post tests, auto-populate candidates from course
    let finalCandidateIds = candidate_ids;
    if (type_of_test === "1" || type_of_test === "2") {
      const candidates = await AssessmentDao.getCandidatesByCourse(course_id);
      finalCandidateIds = candidates.map((c) => c.id).join(",");
    }

    const updated = await AssessmentDao.update(id, {
      title,
      course_id,
      type_of_test,
      candidate_ids: finalCandidateIds || null,
      num_of_questions: num_of_questions || 10,
      questions_choice: questions_choice || "auto",
      question_ids: questions_choice === "manual" ? question_ids : null,
    });

    if (updated) {
      res
        .status(200)
        .json({ success: true, message: "Assessment updated successfully" });
    } else {
      res.status(404).json({
        success: false,
        message: "Assessment not found or no changes made",
      });
    }
  } catch (error) {
    console.error("Error updating assessment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.deleteAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AssessmentDao.delete(id);
    if (deleted) {
      res
        .status(200)
        .json({ success: true, message: "Assessment deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Assessment not found" });
    }
  } catch (error) {
    console.error("Error deleting assessment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getActiveCourses = async (req, res) => {
  try {
    const { type_of_test } = req.query;
    const courses = await AssessmentDao.getActiveCourses(type_of_test || null);
    res.status(200).json({ success: true, data: courses });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getCandidatesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const candidates = await AssessmentDao.getCandidatesByCourse(courseId);
    res.status(200).json({ success: true, data: candidates });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getQuestionsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { type_of_test } = req.query;

    // Get course to find master_course_name
    const pool = require("../config/db");
    const [courseRows] = await pool.execute(
      "SELECT master_course_id, master_course_name FROM courses WHERE id = ?",
      [courseId],
    );

    if (courseRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    const masterCourseId = courseRows[0].master_course_name;
    const questions = await AssessmentDao.getQuestionsByMasterCourse(
      masterCourseId,
      type_of_test,
    );

    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ==========================================
// Submitted Assessment Controllers
// ==========================================

exports.getSubmittedCourses = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await AssessmentResultDao.getCoursesWithSubmissions(
      search,
      page || 1,
      limit || 10,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      totalCount: result.totalCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error fetching submitted courses:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getCourseSubmissions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { search, page, limit } = req.query;
    const result = await AssessmentResultDao.getSubmissionsByCourse(
      courseId,
      search,
      page || 1,
      limit || 10,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      totalCount: result.totalCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error fetching course submissions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getSubmissionDetail = async (req, res) => {
  try {
    const { resultId } = req.params;
    const detail = await AssessmentResultDao.getSubmissionDetail(resultId);
    if (!detail) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    console.error("Error fetching submission detail:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
