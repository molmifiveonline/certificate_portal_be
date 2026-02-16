const express = require("express");
const router = express.Router();
const FeedbackFormController = require("../controllers/FeedbackFormController");

router.post("/", FeedbackFormController.create);
router.get("/", FeedbackFormController.getAll);
router.get("/:id", FeedbackFormController.getById);
router.put("/:id", FeedbackFormController.update);
router.delete("/:id", FeedbackFormController.delete);

module.exports = router;
