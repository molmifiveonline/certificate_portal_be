const CandidateDao = require("../dao/candidateDao");
const LogDao = require("../dao/LogDao");
const { Parser } = require("json2csv");

const getAllCandidates = async (req, res) => {
  try {
    const {
      search,
      page,
      limit,
      sort_by,
      sort_order,
      manager,
      rank,
      nationality,
      status,
      registration_type,
    } = req.query;
    const result = await CandidateDao.getAllCandidates({
      search,
      page,
      limit,
      sort_by,
      sort_order,
      manager,
      rank,
      nationality,
      status,
      registration_type,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error("Get All Candidates Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CandidateDao.softDeleteCandidate(id);
    if (!deleted) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "DELETE_CANDIDATE",
        details: `Soft deleted candidate ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    res.status(200).json({ message: "Candidate deleted successfully" });
  } catch (error) {
    console.error("Delete Candidate Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getCandidateById = async (req, res) => {
  try {
    const candidate = await CandidateDao.getCandidateById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }
    res.status(200).json(candidate);
  } catch (error) {
    console.error("Get Candidate By ID Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateCandidate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await CandidateDao.updateCandidate(id, updateData);
    if (!updated) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    // Log the action
    if (req.user && req.user.id) {
      await LogDao.createLog({
        user_id: req.user.id,
        action: "UPDATE_CANDIDATE",
        details: `Updated candidate ID: ${id}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;
    }

    res.status(200).json({ message: "Candidate updated successfully" });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      let detailMessage = "A record with this information already exists.";
      if (error.sqlMessage && error.sqlMessage.includes('users.email')) {
        detailMessage = "This email is already in use by another user.";
      }
      return res.status(400).json({ 
        message: detailMessage, 
        error: detailMessage 
      });
    }
    console.error("Update Candidate Error:", error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ 
      message: statusCode < 500 ? error.message : "Server error", 
      error: error.message 
    });
  }
};

const exportCandidates = async (req, res) => {
  try {
    const {
      search,
      manager,
      rank,
      nationality,
      status,
      registration_type,
    } = req.query;

    const data = await CandidateDao.exportCandidates({
      search,
      manager,
      rank,
      nationality,
      status,
      registration_type,
    });

    if (!data || data.length === 0) {
      return res.status(404).json({ message: "No candidates found to export" });
    }

    const fields = [
      "first_name",
      "last_name",
      "middle_name",
      "email",
      "mobile",
      "prefix",
      "gender",
      "dob",
      "nationality",
      "passport_no",
      "employee_id",
      "manager",
      "rank",
      "whatsapp_number",
      "registration_type",
      "designation",
      "vessel_type",
      "last_vessel_name",
      "next_vessel_name",
      "manning_company",
      "sign_on_date",
      "sign_off_date",
      "officer",
      "seaman_book_no",
      "profile_image",
      "created_at",
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);

    res.header("Content-Type", "text/csv");
    res.attachment("candidates.csv");
    res.status(200).send(csv);
  } catch (error) {
    console.error("Export Candidates Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getAllCandidates,
  deleteCandidate,
  getCandidateById,
  updateCandidate,
  exportCandidates,
};
