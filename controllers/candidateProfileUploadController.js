const uploadProfileImage = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Construct the file URL (relative path)
    const fileUrl = `/uploads/candidate-profiles/${req.file.filename}`;

    res.status(200).json({
      message: "File uploaded successfully",
      filePath: fileUrl,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    res
      .status(500)
      .json({ message: "Server error during upload", error: error.message });
  }
};

module.exports = { uploadProfileImage };
