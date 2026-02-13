const FeedbackQuestionDao = require("../dao/feedbackQuestionDao");

const createFeedbackQuestion = async (req, res) => {
  try {
    const { category_id, question, type } = req.body;
    if (!category_id || !question) {
      return res
        .status(400)
        .json({ message: "Category and Question are required" });
    }
    const id = await FeedbackQuestionDao.create({
      category_id,
      question,
      type,
    });
    res.status(201).json({ message: "Feedback question created", id });
  } catch (error) {
    console.error("Create Feedback Question Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getFeedbackQuestions = async (req, res) => {
  try {
    const result = await FeedbackQuestionDao.getAll(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Get Feedback Questions Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getFeedbackQuestionById = async (req, res) => {
  try {
    const question = await FeedbackQuestionDao.getById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: "Feedback question not found" });
    }
    res.status(200).json(question);
  } catch (error) {
    console.error("Get Feedback Question By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateFeedbackQuestion = async (req, res) => {
  try {
    const updated = await FeedbackQuestionDao.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Feedback question not found" });
    }
    res.status(200).json({ message: "Feedback question updated" });
  } catch (error) {
    console.error("Update Feedback Question Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteFeedbackQuestion = async (req, res) => {
  try {
    const deleted = await FeedbackQuestionDao.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Feedback question not found" });
    }
    res.status(200).json({ message: "Feedback question deleted" });
  } catch (error) {
    console.error("Delete Feedback Question Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createFeedbackQuestion,
  getFeedbackQuestions,
  getFeedbackQuestionById,
  updateFeedbackQuestion,
  deleteFeedbackQuestion,
};
