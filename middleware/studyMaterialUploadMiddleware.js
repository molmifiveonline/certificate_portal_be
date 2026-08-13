const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = "uploads/study_material";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userType = req.body.user_type || 'both';
    const dynamicUploadDir = path.join(uploadDir, userType);
    if (!fs.existsSync(dynamicUploadDir)) {
      fs.mkdirSync(dynamicUploadDir, { recursive: true });
    }
    cb(null, dynamicUploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp-originalName
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

// File filter (restrict to standard document formats and images)
const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx|ppt|pptx/;
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];

  const extname = allowedExts.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype =
    allowedMimes.includes(file.mimetype) || allowedExts.test(file.mimetype);

  if (extname) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        "Only images and standard documents (PDF, Word, Excel, PPT) are allowed!",
      ),
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

module.exports = upload;
