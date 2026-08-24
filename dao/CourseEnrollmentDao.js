const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { hasColumn } = require("../utils/schemaUtils");
const { ACKNOWLEDGMENT_COLUMNS } = require("../utils/constants");

async function assertAcknowledgmentColumns() {
  const checks = await Promise.all(
    ACKNOWLEDGMENT_COLUMNS.map(async (columnName) => ({
      columnName,
      exists: await hasColumn("courses_enrollment", columnName),
    })),
  );

  const missingColumns = checks
    .filter((check) => !check.exists)
    .map((check) => check.columnName);

  if (missingColumns.length > 0) {
    throw new Error(
      `Database schema missing courses_enrollment acknowledgment columns (${missingColumns.join(", ")}). Apply database_changes.sql active course migration.`,
    );
  }
}

class CourseEnrollmentDao {
  static async enrollCandidates(courseId, candidateIds, trainerId) {
    if (!candidateIds || candidateIds.length === 0)
      return { success: true, message: "No candidates to enroll" };

    const placeholders = candidateIds
      .map(() => "(?, ?, ?, ?, ?, ?)")
      .join(", ");
    const values = [];

    for (const candidateId of candidateIds) {
      // Check if already enrolled to avoid duplicates if not handled by unique constraint logic app-side
      // But for bulk insert efficiency, we might rely on IGNORE or check first.
      // Let's do a check first for safety or INSERT IGNORE/ON DUPLICATE KEY UPDATE logic?
      // Since uuid is primary key, ON DUPLICATE doesn't work well for "same course-candidate pair".
      // We should check existence first or assume strict checks before calling.

      // Let's implement check inside loop for now or filter before insert.
      // A better approach for bulk: get existing enrollments for this course and filter out.

      values.push(
        uuidv4(),
        courseId,
        candidateId,
        trainerId,
        "Active",
        "Initiated",
      ); // status defaults
    }

    // Actually, let's do one by one to use INSERT IGNORE logic if we had unique index on course_id + candidate_id
    // But we don't know if there is a unique index.
    // Let's stick to simple individual inserts with checks or a filtered bulk insert.

    // Improved Strategy:
    // 1. Get existing candidate IDs for course
    // 2. Filter out already enrolled
    // 3. Insert remaining

    const [existing] = await pool.execute(
      "SELECT candidate_id FROM courses_enrollment WHERE course_id = ?",
      [courseId],
    );
    const existingIds = new Set(existing.map((row) => row.candidate_id));

    const toInsert = candidateIds.filter((id) => !existingIds.has(id));

    if (toInsert.length === 0)
      return { success: true, message: "All candidates already enrolled" };

    const insertPlaceholders = toInsert
      .map(() => "(?, ?, ?, ?, 'Active')")
      .join(", ");
    const insertValues = [];
    toInsert.forEach((id) => {
      insertValues.push(uuidv4(), courseId, id, trainerId);
    });

    const query = `INSERT INTO courses_enrollment (id, course_id, candidate_id, trainer_id, status) VALUES ${insertPlaceholders}`;
    await pool.execute(query, insertValues);

    return { success: true, message: `${toInsert.length} candidates enrolled` };
  }

  static async getEnrolledCandidates(courseId) {
    const query = `
      SELECT 
        ce.*, ce.is_observer,
        u.first_name, u.middle_name, u.last_name, u.email, u.mobile, 
        CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) as candidate_name,
        cp.employee_id as empId, cp.passport_no as cdc_passport, cp.rank, cp.seaman_book_no, cp.manning_company as manager,
        cp.dob, cp.nationality, cp.designation, ce.trainer_comment,
        (
          SELECT MAX(cert.issue_date)
          FROM certificates cert
          WHERE cert.candidate_id = ce.candidate_id
            AND cert.active_course_id <> ce.course_id
            AND cert.issue_date IS NOT NULL
        ) as previous_certificate_date
      FROM courses_enrollment ce
      JOIN users u ON ce.candidate_id = u.id
      JOIN candidate_profiles cp ON u.id = cp.user_id
      WHERE ce.course_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)
    `;
    const [rows] = await pool.execute(query, [courseId]);
    return rows;
  }

  static async removeCandidate(courseId, candidateId, remark) {
    const query =
      "UPDATE courses_enrollment SET status = 'Deleted', delete_remark = ? WHERE course_id = ? AND candidate_id = ?";
    const [result] = await pool.execute(query, [remark, courseId, candidateId]);
    return result.affectedRows > 0;
  }

  static async updateStatusPool(courseId, candidateId, statusPool) {
    const query =
      "UPDATE courses_enrollment SET status_pool = ? WHERE course_id = ? AND candidate_id = ?";
    const [result] = await pool.execute(query, [
      statusPool,
      courseId,
      candidateId,
    ]);
    return result.affectedRows > 0;
  }

  static async updateEmailStatus(courseId, candidateId, status, emailType) {
    const query =
      "UPDATE courses_enrollment SET candidate_email_status = ?, email_type = ? WHERE course_id = ? AND candidate_id = ?";
    const [result] = await pool.execute(query, [
      status,
      emailType,
      courseId,
      candidateId,
    ]);
    return result.affectedRows > 0;
  }

  static async getAvailableCandidates(courseId) {
    const query = `
        SELECT u.id, u.first_name, u.middle_name, u.last_name, cp.rank, cp.employee_id as empId
        FROM users u
        JOIN candidate_profiles cp ON u.id = cp.user_id
        JOIN roles r ON u.role_id = r.id
        WHERE r.id = 4  -- Assuming 4 is candidate role id based on context, or use join on name
        AND u.status = 1
        AND u.id NOT IN (SELECT candidate_id FROM courses_enrollment WHERE course_id = ?)
    `;
    // Note: The previous query used role name which is safer if IDs change, but standardizing.
    // Reverting to role name join for safety as per previous snippet.
    const safeQuery = `
        SELECT u.id, u.first_name, u.middle_name, u.last_name, cp.rank, cp.employee_id as empId, cp.passport_no as cdc_passport, cp.seaman_book_no, cp.manning_company as manager,
        (
          SELECT MAX(cert.issue_date)
          FROM certificates cert
          WHERE cert.candidate_id = u.id
            AND cert.issue_date IS NOT NULL
        ) as previous_certificate_date
        FROM users u
        JOIN candidate_profiles cp ON u.id = cp.user_id
        JOIN roles r ON u.role_id = r.id
        WHERE r.name = 'candidate'
        AND u.status = 1
        AND u.id NOT IN (SELECT candidate_id FROM courses_enrollment WHERE course_id = ?)
    `;
    const [rows] = await pool.execute(safeQuery, [courseId]);
    return rows;
  }

  static async getAllActiveCandidates() {
    const query = `
        SELECT u.id
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name = 'candidate'
        AND u.status = 1
    `;
    const [rows] = await pool.execute(query);
    return rows;
  }

  static async getCandidateVenueDetails(courseId, candidateId) {
    const hasCost = await hasColumn("courses_enrollment", "cost");
    const query = `
      SELECT 
        id, venue_name, venue_address, venue_contact, venue_map_link, venue_email, offline_date, from_date, to_date, remarks
        ${hasCost ? ", cost" : ""}
      FROM courses_enrollment
      WHERE course_id = ? AND candidate_id = ?
    `;
    const [rows] = await pool.execute(query, [courseId, candidateId]);
    return rows[0];
  }

  static async updateVenueDetails(courseId, candidateId, details) {
    const hasOfflineDate = Object.prototype.hasOwnProperty.call(
      details,
      "offline_date",
    );
    const hasFromDate = Object.prototype.hasOwnProperty.call(
      details,
      "from_date",
    );
    const hasToDate = Object.prototype.hasOwnProperty.call(details, "to_date");
    const hasCost = await hasColumn("courses_enrollment", "cost");
    const {
      venue_name,
      venue_address,
      venue_contact,
      venue_map_link,
      venue_email,
      offline_date,
      from_date,
      to_date,
      cost,
      remarks,
    } = details;
    const query = `
      UPDATE courses_enrollment
      SET venue_name = ?, venue_address = ?, venue_contact = ?, venue_map_link = ?, venue_email = ?,
          offline_date = CASE WHEN ? THEN ? ELSE offline_date END,
          from_date = CASE WHEN ? THEN ? ELSE from_date END,
          to_date = CASE WHEN ? THEN ? ELSE to_date END,
          ${hasCost ? "cost = ?," : ""}
          remarks = ?
      WHERE course_id = ? AND candidate_id = ?
    `;
    const values = [
      venue_name === undefined ? null : venue_name,
      venue_address === undefined ? null : venue_address,
      venue_contact === undefined ? null : venue_contact,
      venue_map_link === undefined ? null : venue_map_link,
      venue_email === undefined ? null : venue_email,
      hasOfflineDate,
      offline_date || null,
      hasFromDate,
      from_date || null,
      hasToDate,
      to_date || null,
    ];
    if (hasCost) {
      values.push(cost === undefined || cost === "" ? null : cost);
    }
    values.push(
      remarks === undefined ? null : remarks,
      courseId,
      candidateId,
    );
    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  }

  // ==========================================
  // Attendance Tab Methods
  // ==========================================

  static async getAttendanceData(courseId) {
    const query = `
      SELECT 
        ce.candidate_id, ce.is_present, ce.holidays, ce.absent_reasons,
        u.first_name, u.middle_name, u.last_name,
        cp.employee_id as empId,
        CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) as candidate_name
      FROM courses_enrollment ce
      JOIN users u ON ce.candidate_id = u.id
      JOIN candidate_profiles cp ON u.id = cp.user_id
      WHERE ce.course_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)
    `;
    const [rows] = await pool.execute(query, [courseId]);
    return rows;
  }

  static async saveAttendanceSingle(
    courseId,
    candidateId,
    date,
    status,
    reason = null,
  ) {
    const [rows] = await pool.execute(
      "SELECT is_present, holidays, absent_reasons FROM courses_enrollment WHERE course_id = ? AND candidate_id = ?",
      [courseId, candidateId],
    );
    if (rows.length === 0) return false;

    const record = rows[0];
    let presentDates = record.is_present
      ? record.is_present.split(",").filter(Boolean)
      : [];
    let holidayDates = record.holidays
      ? record.holidays.split(",").filter(Boolean)
      : [];
    let absentReasons = record.absent_reasons
      ? JSON.parse(record.absent_reasons)
      : {};

    if (status === "present") {
      if (!presentDates.includes(date)) presentDates.push(date);
      holidayDates = holidayDates.filter((d) => d !== date);
      delete absentReasons[date];
    } else if (status === "absent") {
      presentDates = presentDates.filter((d) => d !== date);
      holidayDates = holidayDates.filter((d) => d !== date);
      absentReasons[date] = reason || "Absent";
    } else if (status === "holiday") {
      if (!holidayDates.includes(date)) holidayDates.push(date);
      presentDates = presentDates.filter((d) => d !== date);
      if (reason) {
        absentReasons[date] = reason;
      } else {
        delete absentReasons[date];
      }
    }

    const [result] = await pool.execute(
      "UPDATE courses_enrollment SET is_present = ?, holidays = ?, absent_reasons = ? WHERE course_id = ? AND candidate_id = ?",
      [
        presentDates.join(","),
        holidayDates.join(","),
        JSON.stringify(absentReasons),
        courseId,
        candidateId,
      ],
    );
    return result.affectedRows > 0;
  }

  static async saveAbsentReason(courseId, absentReasons, status) {
    let allSuccess = true;
    for (const [candidateId, dates] of Object.entries(absentReasons)) {
      const [rows] = await pool.execute(
        "SELECT is_present, holidays, absent_reasons FROM courses_enrollment WHERE course_id = ? AND candidate_id = ?",
        [courseId, candidateId],
      );
      if (rows.length === 0) {
        allSuccess = false;
        continue;
      }

      const record = rows[0];
      let existingReasons = record.absent_reasons
        ? JSON.parse(record.absent_reasons)
        : {};
      let presentDates = record.is_present
        ? record.is_present.split(",").filter(Boolean)
        : [];
      let holidayDates = record.holidays
        ? record.holidays.split(",").filter(Boolean)
        : [];

      for (const [date, reason] of Object.entries(dates)) {
        if (status === "holiday") {
          if (!holidayDates.includes(date)) holidayDates.push(date);
          presentDates = presentDates.filter((d) => d !== date);
        } else {
          presentDates = presentDates.filter((d) => d !== date);
          holidayDates = holidayDates.filter((d) => d !== date);
        }
        existingReasons[date] = reason;
      }

      const [result] = await pool.execute(
        "UPDATE courses_enrollment SET is_present = ?, holidays = ?, absent_reasons = ? WHERE course_id = ? AND candidate_id = ?",
        [
          presentDates.join(","),
          holidayDates.join(","),
          JSON.stringify(existingReasons),
          courseId,
          candidateId,
        ],
      );
      if (result.affectedRows === 0) allSuccess = false;
    }
    return allSuccess;
  }

  // ==========================================
  // Assessment Tab Methods
  // ==========================================

  static async getAssessmentScores(courseId) {
    const query = `
      SELECT 
        ce.candidate_id,
        u.first_name, u.middle_name, u.last_name,
        cp.employee_id as empId,
        CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) as candidate_name,
        ce.trainer_comment,
        ce.is_observer,
        ce.is_present,
        ce.absent_reasons,
        pre_res.assessment_id as pre_assessment_id,
        pre_res.score as pre_score,
        pre_res.total_questions as pre_total,
        post_res.assessment_id as post_assessment_id,
        post_res.score as post_score,
        post_res.total_questions as post_total
      FROM courses_enrollment ce
      JOIN users u ON ce.candidate_id = u.id
      JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN (
        SELECT ar.candidate_id, ar.assessment_id, ar.score, ar.total_questions
        FROM assessment_results ar
        JOIN assessment a ON ar.assessment_id = a.id
        WHERE ar.course_id = ? AND a.type_of_test IN ('Pre', '1') AND ar.status = 'Completed'
      ) pre_res ON ce.candidate_id = pre_res.candidate_id
      LEFT JOIN (
        SELECT ar.candidate_id, ar.assessment_id, ar.score, ar.total_questions
        FROM assessment_results ar
        JOIN assessment a ON ar.assessment_id = a.id
        WHERE ar.course_id = ? AND a.type_of_test IN ('Post', '2') AND ar.status = 'Completed'
      ) post_res ON ce.candidate_id = post_res.candidate_id
      WHERE ce.course_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)
    `;
    const [rows] = await pool.execute(query, [courseId, courseId, courseId]);
    return rows;
  }

  static async updateTrainerComment(courseId, candidateId, comment) {
    const query =
      "UPDATE courses_enrollment SET trainer_comment = ? WHERE course_id = ? AND candidate_id = ?";
    const [result] = await pool.execute(query, [comment, courseId, candidateId]);
    return result.affectedRows > 0;
  }

  // ==========================================
  // Feedback Tab Methods
  // ==========================================

  static async getFeedbackStatus(courseId) {
    const query = `
      SELECT 
        ce.candidate_id,
        u.first_name, u.middle_name, u.last_name,
        cp.employee_id as empId,
        CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) as candidate_name,
        CASE WHEN fqa.candidate_id IS NOT NULL THEN 1 ELSE 0 END as feedback_completed
      FROM courses_enrollment ce
      JOIN users u ON ce.candidate_id = u.id
      JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN (
        SELECT DISTINCT candidate_id FROM feedback_question_answer WHERE active_course_id = ?
      ) fqa ON ce.candidate_id = fqa.candidate_id
      WHERE ce.course_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)
    `;
    const [rows] = await pool.execute(query, [courseId, courseId]);
    return rows;
  }

  static async updateObserverStatus(courseId, candidateId, isObserver) {
    const query =
      "UPDATE courses_enrollment SET is_observer = ? WHERE course_id = ? AND candidate_id = ?";
    const [result] = await pool.execute(query, [
      isObserver ? 1 : 0,
      courseId,
      candidateId,
    ]);
    return result.affectedRows > 0;
  }

  // ==========================================
  // Certificate Tab Methods
  // ==========================================

  static async getCertificateData(courseId) {
    const query = `
      SELECT 
        ce.candidate_id, ce.is_present, ce.holidays, 
        COALESCE(ce.certficate_generated, cert.id) AS certficate_generated, 
        COALESCE(ce.generated_date, cert.issue_date) AS generated_date, 
        ce.active,
        cert.id as certificate_id, cert.is_hidden,
        u.first_name, u.middle_name, u.last_name,
        cp.employee_id as empId,
        CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) as candidate_name,
        post_res.score as post_score,
        post_res.attempt_number as post_score_attempt,
        CASE WHEN fqa.candidate_id IS NOT NULL THEN 1 ELSE 0 END as feedback_completed
      FROM courses_enrollment ce
      JOIN users u ON ce.candidate_id = u.id
      JOIN candidate_profiles cp ON u.id = cp.user_id
      LEFT JOIN certificates cert ON ce.candidate_id = cert.candidate_id AND ce.course_id = cert.active_course_id
      LEFT JOIN (
        SELECT ar1.candidate_id, ar1.score, ar1.attempt_number
        FROM assessment_results ar1
        JOIN assessment a1 ON ar1.assessment_id = a1.id
        WHERE ar1.course_id = ? AND a1.type_of_test IN ('Post', '2') AND ar1.status = 'Completed'
          AND ar1.attempt_number = (
            SELECT MAX(ar2.attempt_number)
            FROM assessment_results ar2
            JOIN assessment a2 ON ar2.assessment_id = a2.id
            WHERE ar2.candidate_id = ar1.candidate_id 
              AND ar2.course_id = ar1.course_id 
              AND a2.type_of_test IN ('Post', '2') 
              AND ar2.status = 'Completed'
          )
      ) post_res ON ce.candidate_id = post_res.candidate_id
      LEFT JOIN (
        SELECT DISTINCT candidate_id FROM feedback_question_answer WHERE active_course_id = ?
      ) fqa ON ce.candidate_id = fqa.candidate_id
      WHERE ce.course_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)
        AND (ce.is_observer = 0 OR ce.is_observer IS NULL)
    `;
    const [rows] = await pool.execute(query, [courseId, courseId, courseId]);
    return rows;
  }

  static async generateCertificate(courseId, candidateId, certificateId) {
    const currentDate = new Date().toISOString().slice(0, 10);
    const [result] = await pool.execute(
      "UPDATE courses_enrollment SET certficate_generated = ?, generated_date = ? WHERE course_id = ? AND candidate_id = ?",
      [certificateId, currentDate, courseId, candidateId],
    );
    return result.affectedRows > 0;
  }

  static async updateCertificateActive(courseId, candidateId, value) {
    const [result] = await pool.execute(
      "UPDATE courses_enrollment SET active = ? WHERE course_id = ? AND candidate_id = ?",
      [value, courseId, candidateId],
    );
    return result.affectedRows > 0;
  }

  static async updateCertificateHide(certificateId, value) {
    const [result] = await pool.execute(
      "UPDATE certificates SET is_hidden = ? WHERE id = ?",
      [value, certificateId],
    );
    return result.affectedRows > 0;
  }

  static async saveAcknowledgmentToken(courseId, candidateId, token) {
    await assertAcknowledgmentColumns();
    const [result] = await pool.execute(
      "UPDATE courses_enrollment SET ack_token = ?, ack_status = 'Pending', ack_date = NULL, ack_remark = NULL WHERE course_id = ? AND candidate_id = ?",
      [token, courseId, candidateId],
    );
    return result.affectedRows > 0;
  }

  static async updateAcknowledgmentStatus(token, status, remark = null) {
    await assertAcknowledgmentColumns();
    const [result] = await pool.execute(
      "UPDATE courses_enrollment SET ack_status = ?, ack_date = NOW(), ack_remark = ? WHERE ack_token = ?",
      [status, remark, token],
    );
    return result.affectedRows > 0;
  }

  static async getByAckToken(token) {
    await assertAcknowledgmentColumns();
    const [rows] = await pool.execute(
      "SELECT * FROM courses_enrollment WHERE ack_token = ?",
      [token],
    );
    return rows[0];
  }

  static async getEnrollmentById(id) {
    const [rows] = await pool.execute(
      `SELECT ce.*, u.first_name, u.middle_name, u.last_name, u.email
       FROM courses_enrollment ce
       JOIN users u ON u.id = ce.candidate_id
       WHERE ce.id = ?`,
      [id],
    );
    return rows[0];
  }

  static async getCandidateAttendance(courseId, candidateId) {
    const [courseRows] = await pool.execute(
      "SELECT start_date, end_date FROM courses WHERE id = ?",
      [courseId],
    );
    if (courseRows.length === 0) return [];

    const { start_date, end_date } = courseRows[0];

    const [enrollmentRows] = await pool.execute(
      "SELECT is_present, holidays, absent_reasons FROM courses_enrollment WHERE course_id = ? AND candidate_id = ?",
      [courseId, candidateId],
    );
    if (enrollmentRows.length === 0) return [];

    const record = enrollmentRows[0];
    const presentDates = record.is_present
      ? record.is_present.split(",").filter(Boolean)
      : [];
    const holidayDates = record.holidays
      ? record.holidays.split(",").filter(Boolean)
      : [];
    const absentReasons = record.absent_reasons
      ? JSON.parse(record.absent_reasons)
      : {};

    const attendanceLog = [];
    let start = new Date(start_date);
    let end = new Date(end_date);

    // Filter out potential invalid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      let status = "";
      let reason = "";

      if (presentDates.includes(dateStr)) {
        status = "present";
      } else if (holidayDates.includes(dateStr)) {
        status = "holiday";
      } else if (absentReasons[dateStr]) {
        status = "absent";
        reason = absentReasons[dateStr];
      }

      attendanceLog.push({
        attendance_date: dateStr,
        status: status,
        absent_reason: reason,
      });
    }

    return attendanceLog;
  }
}

module.exports = CourseEnrollmentDao;
