const FeedbackCategoryDao = require("../dao/feedbackCategoryDao");

const createFeedbackCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }
    const id = await FeedbackCategoryDao.create({ name, description });
    res.status(201).json({ message: "Feedback category created", id });
  } catch (error) {
    console.error("Create Feedback Category Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getFeedbackCategories = async (req, res) => {
  try {
    const result = await FeedbackCategoryDao.getAll(req.query);
    res.status(200).json(result);
  } catch (error) {
    console.error("Get Feedback Categories Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getFeedbackCategoryById = async (req, res) => {
  try {
    const category = await FeedbackCategoryDao.getById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: "Feedback category not found" });
    }
    res.status(200).json(category);
  } catch (error) {
    console.error("Get Feedback Category By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateFeedbackCategory = async (req, res) => {
  try {
    const updated = await FeedbackCategoryDao.update(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ message: "Feedback category not found" });
    }
    res.status(200).json({ message: "Feedback category updated" });
  } catch (error) {
    console.error("Update Feedback Category Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteFeedbackCategory = async (req, res) => {
  try {
    const deleted = await FeedbackCategoryDao.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Feedback category not found" });
    }
    res.status(200).json({ message: "Feedback category deleted" });
  } catch (error) {
    console.error("Delete Feedback Category Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  createFeedbackCategory,
  getFeedbackCategories,
  getFeedbackCategoryById,
  updateFeedbackCategory,
  deleteFeedbackCategory,
};
