const path = require("path");
// Override process.cwd() so config can resolve correctly
process.cwd = () => path.join(__dirname, "..");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const pool = require("../config/db");
const CertificateDao = require("../dao/CertificateDao");

async function seed() {
  try {
    console.log("Seeding dummy certificates...");

    // 1. Get 20 random candidates (or less if not enough exist)
    const [candidates] = await pool.query(
      "SELECT user_id as id FROM candidate_profiles ORDER BY RAND() LIMIT 20",
    );

    // 2. Get a random valid active course
    const [activeCourses] = await pool.query(
      "SELECT c.id as active_course_id, c.master_course_id, c.primary_trainer_id, c.location_id, c.start_date, c.end_date FROM courses c JOIN master_course mc ON c.master_course_id = mc.id ORDER BY RAND() LIMIT 1",
    );
    const course = activeCourses[0];

    if (!course || candidates.length === 0) {
      console.log("Not enough data to seed.");
      process.exit(1);
    }

    // 3. Get master course details
    const [masterCourses] = await pool.query(
      "SELECT topic, certificate_type FROM master_course WHERE id = ?",
      [course.master_course_id],
    );
    const master = masterCourses[0];

    const issueDate = new Date().toISOString().split("T")[0];
    const year = new Date().getFullYear();

    for (let i = 0; i < candidates.length; i++) {
      const candidateId = candidates[i].id;

      const certData = {
        type: master?.certificate_type || "Others",
        topic: master?.topic || "General",
        course_level: "Operational",
        course_id: course.master_course_id,
        candidate_id: candidateId,
        active_course_id: course.active_course_id,
        location: "Mumbai",
        course_conduct: "ONS",
        trainer_id: course.primary_trainer_id || 1,
        status: 0,
        from_date: course.start_date,
        to_date: course.end_date,
        days: 3,
        issue_date: issueDate,
        description1: "This is a seeded certificate for testing purposes.",
        remarks: "Seeded data",
        show_logo: 1,
        sample_cert: 0,
        is_manual: 1,
      };

      // Generate number matching controller logic
      let subid = 0;
      if (
        certData.type === "Others" ||
        certData.type === "DNV-ST0029" ||
        certData.type === "DNV-ST008"
      ) {
        subid = await CertificateDao.getNextSubId(certData.topic, year);
        const subidStr = subid.toString().padStart(4, "0");
        const shortDate =
          new Date(certData.issue_date).toISOString().slice(2, 4) +
          new Date(certData.issue_date).toISOString().slice(5, 7);
        certData.certificate_no = `${certData.topic.toUpperCase()}/${shortDate}/${subidStr}`;
      } else {
        subid = await CertificateDao.getNextSubIdByType(certData.type);
        const subidStr = subid.toString().padStart(4, "0");
        certData.certificate_no = `MANUAL-${certData.type}-${year}-${subidStr}`;
      }
      certData.subid = subid;

      await CertificateDao.create(certData);
      console.log(
        `Inserted certificate: ${certData.certificate_no} for candidate ${candidateId}`,
      );
    }

    console.log("Done seeding dummy certificates.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
