const fs = require("fs");
const csv = require("csv-parser");
const CandidateDao = require("../dao/candidateDao");
const LogDao = require("../dao/LogDao");

const uploadCandidates = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  const results = [];
  const errors = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      try {
        const candidates = results.map((row, index) => {
          // Mapping logic based on expected CSV headers or indices
          // For simplicity, we assume headers roughly match staging
          return {
            first_name: row.first_name || row["First Name"] || "",
            last_name: row.last_name || row["Surname"] || "",
            email: row.email || row["E-mail"] || row.Email || "",
            mobile: row.mobile || row.Mobile || "",
            middle_name: row.middle_name || row["Middle Name"] || "",
            prefix: row.prefix || row.Prefix || "",
            gender: row.gender || row.Gender || "",
            dob: row.dob || row["Birth Date"] || null,
            nationality:
              row.nationality || row.Country || row.Nationality || "",
            passport_no: row.passport_no || row["Passport No"] || "",
            employee_id: row.employee_id || row["Employee No"] || "",
            manager: row.manager || row.Manager || "",
            rank: row.rank || row.Rank || row.Position || "",
            whatsapp_number: row.whatsapp || row.Mobile || "",
            alternate_mobile: row.alternate_mobile || row["Mobile 1"] || "",
            indos_number: row.indos_no || row["INDOS Number"] || "",
            registration_type:
              row.registration_type || row.registrationType || "Others",
          };
        });

        const stats = await CandidateDao.bulkUpsert(candidates);

        // Remove temp file
        fs.unlinkSync(req.file.path);

        await LogDao.createLog({
          user_id: req.user.id,
          action: "BULK_UPLOAD_CANDIDATES",
          details: `Uploaded ${stats.inserted} new and updated ${stats.updated} candidates. Errors: ${stats.errors}`,
          ip_address: req.ip,
          user_agent: req.get("User-Agent"),
        });
      req.skipActivityLog = true;

        res.status(200).json({
          message: "Upload processed successfully",
          stats,
        });
      } catch (error) {
        console.error("Upload processing error:", error);
        res
          .status(500)
          .json({ message: "Error processing upload", error: error.message });
      }
    });
};

module.exports = { uploadCandidates };
