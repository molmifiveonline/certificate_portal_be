const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  createQuestion,
  getAllQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  bulkUpload,
} = require("../controllers/questionBankController");
const { protect, authorize } = require("../middleware/authMiddleware");
const checkPermission = require("../middleware/permissionMiddleware");

// Dedicated upload config for question bank images
const questionUploadDir = "uploads/question";
if (!fs.existsSync(questionUploadDir)) {
  fs.mkdirSync(questionUploadDir, { recursive: true });
}

const questionStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, questionUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const questionUpload = multer({
  storage: questionStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      return cb(null, true);
    }
    cb(new Error("Only image files are allowed!"));
  },
});

const uploadFields = questionUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "opt_img_a", maxCount: 1 },
  { name: "opt_img_b", maxCount: 1 },
  { name: "opt_img_c", maxCount: 1 },
  { name: "opt_img_d", maxCount: 1 },
]);

// Wrapper to catch multer errors and return proper JSON response
const handleUpload = (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// All question bank routes require auth
router.use(protect);

router.post("/create", checkPermission("create_question"), handleUpload, createQuestion);
router.get("/", checkPermission("view_questions"), getAllQuestions);
router.get("/sample-template", checkPermission("view_questions"), (req, res) => {
  const XLSX = require("xlsx");
  const wb = XLSX.utils.book_new();
  const sampleData = [
    {
      Question: "What is food safety?",
      "Master Course ID": "<paste-course-uuid>",
      "Type of Test": "1,2",
      "Option A": "Handling food properly",
      "Option B": "Cooking only",
      "Option C": "Cleaning only",
      "Option D": "None of the above",
      "Correct Option": "opt_a",
    },
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws, "Questions");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=question_bank_template.xlsx",
  );
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.send(buf);
});
router.post(
  "/bulk-upload",
  checkPermission("create_question"),
  multer({ dest: "uploads/temp/" }).single("file"),
  bulkUpload,
);
router.get("/:id", checkPermission("view_questions"), getQuestionById);
router.put("/update/:id", checkPermission("edit_question"), handleUpload, updateQuestion);
router.delete("/delete/:id", checkPermission("delete_question"), deleteQuestion);

module.exports = router;
