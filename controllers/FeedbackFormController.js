const FeedbackFormDao = require("../dao/FeedbackFormDao");

const FEEDBACK_COURSE_TYPES = new Set(["Online", "Offline"]);

const normalizeFeedbackCourseType = (typeOfCourse) => {
  const normalized = String(typeOfCourse || "").trim();
  if (!FEEDBACK_COURSE_TYPES.has(normalized)) return null;
  return normalized;
};

const hasCategoryQuestions = (categoryQuestions) => {
  if (
    !categoryQuestions ||
    typeof categoryQuestions !== "object" ||
    Array.isArray(categoryQuestions)
  ) {
    return false;
  }

  return Object.values(categoryQuestions).some(
    (questions) => Array.isArray(questions) && questions.length > 0,
  );
};

const buildFeedbackFormPayload = (body) => {
  const { title, type_of_course, category_questions } = body;
  const courseType = normalizeFeedbackCourseType(type_of_course);

  if (!title || !String(title).trim()) {
    return { error: "Title is required" };
  }

  if (!courseType) {
    return { error: "type_of_course must be Online or Offline" };
  }

  if (!hasCategoryQuestions(category_questions)) {
    return { error: "category_questions must contain at least one question" };
  }

  return {
    payload: {
      ...body,
      title: String(title).trim(),
      type_of_course: courseType,
    },
  };
};

class FeedbackFormController {
  static async create(req, res) {
    try {
      const { error, payload } = buildFeedbackFormPayload(req.body);
      if (error) {
        return res.status(400).json({ message: error });
      }

      await FeedbackFormDao.create(payload);
      res.status(201).json({ message: "Feedback Form created successfully" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({
          message: "Error creating feedback form",
          error: error.message,
        });
    }
  }

  static async getAll(req, res) {
    try {
      const result = await FeedbackFormDao.getAll(req.query);
      res.json(result);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({
          message: "Error fetching feedback forms",
          error: error.message,
        });
    }
  }

  static async getById(req, res) {
    try {
      const form = await FeedbackFormDao.getById(req.params.id);
      if (!form) {
        return res.status(404).json({ message: "Feedback Form not found" });
      }
      res.json(form);
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({
          message: "Error fetching feedback form",
          error: error.message,
        });
    }
  }

  static async update(req, res) {
    try {
      const { error, payload } = buildFeedbackFormPayload(req.body);
      if (error) {
        return res.status(400).json({ message: error });
      }

      await FeedbackFormDao.update(req.params.id, payload);
      res.json({ message: "Feedback Form updated successfully" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({
          message: "Error updating feedback form",
          error: error.message,
        });
    }
  }

  static async delete(req, res) {
    try {
      await FeedbackFormDao.delete(req.params.id);
      res.json({ message: "Feedback Form deleted successfully" });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({
          message: "Error deleting feedback form",
          error: error.message,
        });
    }
  }
}

module.exports = FeedbackFormController;
