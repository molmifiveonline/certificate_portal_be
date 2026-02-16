const FeedbackFormDao = require("../dao/FeedbackFormDao");

class FeedbackFormController {
  static async create(req, res) {
    try {
      const { title, type_of_course, status, category_questions } = req.body;

      if (!title || !type_of_course || !category_questions) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      await FeedbackFormDao.create(req.body);
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
      const { title, type_of_course, status, category_questions } = req.body;
      if (!title || !type_of_course || !category_questions) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      await FeedbackFormDao.update(req.params.id, req.body);
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
