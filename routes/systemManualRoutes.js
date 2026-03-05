const express = require("express");
const router = express.Router();
const systemManualController = require("../controllers/systemManualController");
const uploadSystemManual = require("../middleware/systemManualUploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");

// All routes are protected
router.use(authMiddleware);

// Routes
router.get("/", systemManualController.getSystemManuals);
router.get("/:id", systemManualController.getSystemManual);
router.post(
  "/",
  uploadSystemManual.single("document_file"),
  systemManualController.addSystemManual,
);
router.put(
  "/:id",
  uploadSystemManual.single("document_file"),
  systemManualController.updateSystemManual,
);
router.delete("/:id", systemManualController.deleteSystemManual);

module.exports = router;
