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

// File filter (documents, images, videos, audio, archives)
const fileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|webp|gif|svg|bmp|tiff|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf|odt|ods|odp|mp4|webm|mkv|avi|mov|wmv|flv|m4v|3gp|mp3|wav|ogg|aac|m4a|flac|wma|zip|rar|7z|tar|gz/i;

  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  const isValidExt = allowedExts.test(ext);

  if (isValidExt) {
    return cb(null, true);
  } else {
    cb(
      new Error(
        `File type '.${ext}' is not supported for study materials. Allowed formats include PDF, Word, Excel, PowerPoint, Images, Videos (MP4/WebM/MOV), Audio, and Archives.`,
      ),
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500 MB max per file
  },
});

module.exports = upload;
