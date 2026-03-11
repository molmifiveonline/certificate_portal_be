const CertificateDao = require("../dao/CertificateDao");
const ActiveCourseDao = require("../dao/ActiveCourseDao");
const MasterCourseDao = require("../dao/MasterCourseDao");
const CourseEnrollmentDao = require("../dao/CourseEnrollmentDao");
const trainerDao = require("../dao/trainerDao");
const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

exports.listCertificates = async (req, res) => {
  try {
    const { search, status, active_course_id, trainer_id, page, limit } =
      req.query;
    const certificates = await CertificateDao.getAll(
      search,
      { status, active_course_id, trainer_id },
      page,
      limit,
    );
    res.status(200).json(certificates);
  } catch (error) {
    console.error("Error listing certificates:", error);
    res
      .status(500)
      .json({ message: "Error listing certificates", error: error.message });
  }
};

exports.getCertificateById = async (req, res) => {
  try {
    const certificate = await CertificateDao.getById(req.params.id);
    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    res.status(200).json(certificate);
  } catch (error) {
    console.error("Error fetching certificate:", error);
    res
      .status(500)
      .json({ message: "Error fetching certificate", error: error.message });
  }
};

exports.generateCertificate = async (req, res) => {
  try {
    const { activeCourseId, candidateId, issueDate } = req.body;

    if (!activeCourseId || !candidateId) {
      return res
        .status(400)
        .json({ message: "Active Course ID and Candidate ID are required" });
    }

    // Check if certificate already exists
    const existing = await CertificateDao.getByCandidateAndCourse(
      candidateId,
      activeCourseId,
    );
    if (existing) {
      return res
        .status(200)
        .json({ message: "Certificate already exists", data: existing });
    }

    // Fetch details for generation
    const course = await ActiveCourseDao.getById(activeCourseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    const masterCourse = await MasterCourseDao.getById(course.master_course_id);
    if (!masterCourse)
      return res.status(404).json({ message: "Master Course not found" });

    // In a real scenario, we'd fetch the candidate and trainer details to get nationality for LNG certificates
    // For now, let's use placeholders or fetch them if needed.
    // Let's fetch them to be accurate.
    const [candidateRows] = await pool.execute(
      "SELECT first_name, last_name, nationality FROM users WHERE id = ?",
      [candidateId],
    );
    if (candidateRows.length === 0)
      return res.status(404).json({ message: "Candidate not found" });
    const candidate = candidateRows[0];

    const trainer = await trainerDao.getTrainerById(course.primary_trainer_id);
    if (!trainer) return res.status(404).json({ message: "Trainer not found" });

    const type = masterCourse.certificate_type || "Others";
    const topic = course.topic;
    const generationDate = issueDate || new Date().toISOString().slice(0, 10);
    const year = new Date(generationDate).getFullYear();

    let certificate_no = "";
    let subid = 0;

    if (type === "Others" || type === "DNV-ST0029" || type === "DNV-ST008") {
      subid = await CertificateDao.getNextSubId(topic, year);
      const subidStr = subid.toString().padStart(4, "0");
      const shortDate =
        new Date(generationDate).toISOString().slice(2, 4) +
        new Date(generationDate).toISOString().slice(5, 7);
      certificate_no = `${topic.toUpperCase()}/${shortDate}/${subidStr}`;
    } else {
      // LNG Certificate logic
      subid = await CertificateDao.getNextSubIdByType(type);
      const subidStr = subid.toString().padStart(4, "0");
      const trainerNation = (trainer.nationality || "UN")
        .toUpperCase()
        .substring(0, 2);
      const candidateNation = (candidate.nationality || "UN")
        .toUpperCase()
        .substring(0, 2);
      certificate_no = `MOLTC (${trainerNation})- LNG${year}-(${candidateNation})${subidStr}`;
    }

    const certificateData = {
      certificate_no,
      type,
      topic,
      course_level: course.course_level || "Operational",
      course_id: course.master_course_id,
      active_course_id: activeCourseId,
      candidate_id: candidateId,
      trainer_id: course.primary_trainer_id,
      location:
        course.type_of_location === "Other"
          ? course.other_location
          : course.type_of_location,
      course_conduct: course.type_of_location === "Online" ? "ONL" : "ONS",
      from_date: course.start_date,
      to_date: course.end_date,
      days: course.no_of_days,
      issue_date: generationDate || new Date(),
      show_logo: 1,
      is_manual: 0,
      description1: masterCourse.description,
      remarks: "",
      subid,
    };

    const newCertificate = await CertificateDao.create(certificateData);

    // Update Course Enrollment
    await CourseEnrollmentDao.generateCertificate(
      activeCourseId,
      candidateId,
      newCertificate.id,
    );

    res.status(201).json({
      message: "Certificate generated successfully",
      data: newCertificate,
    });
  } catch (error) {
    console.error("Error generating certificate:", error);
    res
      .status(500)
      .json({ message: "Error generating certificate", error: error.message });
  }
};

exports.updateCertificate = async (req, res) => {
  try {
    const success = await CertificateDao.update(req.params.id, req.body);
    if (!success) {
      return res
        .status(404)
        .json({ message: "Certificate not found or update failed" });
    }
    res.status(200).json({ message: "Certificate updated successfully" });
  } catch (error) {
    console.error("Error updating certificate:", error);
    res
      .status(500)
      .json({ message: "Error updating certificate", error: error.message });
  }
};

exports.deleteCertificate = async (req, res) => {
  try {
    const success = await CertificateDao.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Certificate not found" });
    }
    res.status(200).json({ message: "Certificate deleted successfully" });
  } catch (error) {
    console.error("Error deleting certificate:", error);
    res
      .status(500)
      .json({ message: "Error deleting certificate", error: error.message });
  }
};
exports.createManualCertificate = async (req, res) => {
  try {
    const data = req.body;
    let candidateIdsStr = data.candidate_id;
    let candidateIds = [];

    // Parse candidate array
    if (typeof candidateIdsStr === "string") {
      try {
        candidateIds = JSON.parse(candidateIdsStr);
      } catch (e) {
        candidateIds = [candidateIdsStr];
      }
    } else if (Array.isArray(candidateIdsStr)) {
      candidateIds = candidateIdsStr;
    } else {
      candidateIds = [candidateIdsStr];
    }

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ message: "No candidates selected" });
    }

    const createdCertificates = [];

    for (let i = 0; i < candidateIds.length; i++) {
      const candidateId = candidateIds[i];

      let certData = { ...data, candidate_id: candidateId };

      // For manual certificates, we might need to generate the certificate number if not provided
      if (!certData.certificate_no) {
        if (
          certData.sample_cert === 1 ||
          certData.sample_cert === "1" ||
          certData.sample_cert === true
        ) {
          certData.certificate_no = "0001";
          certData.subid = 1;
        } else {
          const year = new Date(
            certData.issue_date || new Date(),
          ).getFullYear();
          let subid = await CertificateDao.getNextSubId(certData.topic, year);
          const subidStr = subid.toString().padStart(4, "0");
          const shortDate =
            new Date(certData.issue_date || new Date())
              .toISOString()
              .slice(2, 4) +
            new Date(certData.issue_date || new Date())
              .toISOString()
              .slice(5, 7);
          certData.certificate_no = `${(certData.topic || "UNKNOWN").toUpperCase()}/${shortDate}/${subidStr}`;
          certData.subid = subid;
        }
      }

      certData.is_manual = 1;

      // Remove the array string so it doesn't try to insert JSON into candidate_id
      const newCertificate = await CertificateDao.create(certData);
      createdCertificates.push(newCertificate);
    }

    res.status(201).json({
      message: "Certificates created manually",
      data: createdCertificates,
    });
  } catch (error) {
    console.error("Error creating manual certificate:", error);
    res.status(500).json({
      message: "Error creating manual certificate",
      error: error.message,
    });
  }
};
