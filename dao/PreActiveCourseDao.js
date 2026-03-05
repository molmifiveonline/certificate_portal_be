const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// ==========================================
// Pre-Active Course Operations
// ==========================================

const createPreActiveCourse = async (courseData) => {
  const {
    topic, // This is master_course_id from frontend
    course_name,
    description,
    start_date,
    end_date,
    days,
    type_of_location,
    location_id,
    other_location,
    type_of_course,
    remarks,
  } = courseData;

  // Resolve Master Course Details if topic is a UUID
  let master_course_id = topic;
  let master_course_name = course_name; // default
  let actual_topic = "General"; // default

  if (topic && topic.length === 36) {
    const [mcRows] = await pool.execute(
      "SELECT master_course_name, topic FROM master_course WHERE id = ?",
      [topic],
    );
    if (mcRows.length > 0) {
      master_course_name = mcRows[0].master_course_name;
      actual_topic = mcRows[0].topic;
    }
  }

  const id = uuidv4();
  // Generate a temporary course_id if not provided
  const course_id = "PRE-" + Date.now().toString().slice(-6);

  const query = `
    INSERT INTO courses (
      id, course_id, master_course_id, master_course_name, topic, course_name, 
      description, start_date, end_date, no_of_days, type_of_location, 
      location_id, other_location, course_type, remarks, status, is_pre_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pre-Active', 1)
  `;

  const [result] = await pool.execute(query, [
    id,
    course_id,
    master_course_id || null,
    master_course_name || null,
    actual_topic || null,
    course_name || null,
    description || null,
    start_date || null,
    end_date || null,
    days || null, // Map from frontend 'days'
    type_of_location || null,
    location_id || null,
    other_location || null,
    type_of_course || null, // Map from frontend 'type_of_course'
    remarks || null,
  ]);

  if (result.affectedRows > 0) {
    const [rows] = await pool.execute("SELECT * FROM courses WHERE id = ?", [
      id,
    ]);
    return rows[0];
  }
  return null;
};

const getAllPreActiveCourses = async (
  search = "",
  page = 1,
  limit = 10,
  filters = {},
) => {
  let query = "SELECT * FROM courses WHERE is_pre_active = 1";
  let countQuery =
    "SELECT count(*) as total FROM courses WHERE is_pre_active = 1";
  const params = [];
  const countParams = [];

  if (search) {
    query += " AND (course_name LIKE ? OR course_id LIKE ? OR topic LIKE ?)";
    countQuery +=
      " AND (course_name LIKE ? OR course_id LIKE ? OR topic LIKE ?)";
    const searchVal = `%${search}%`;
    params.push(searchVal, searchVal, searchVal);
    countParams.push(searchVal, searchVal, searchVal);
  }

  if (filters.status) {
    query += " AND status = ?";
    countQuery += " AND status = ?";
    params.push(filters.status);
    countParams.push(filters.status);
  }

  if (filters.from_date && filters.to_date) {
    query += " AND DATE(start_date) BETWEEN ? AND ?";
    countQuery += " AND DATE(start_date) BETWEEN ? AND ?";
    params.push(filters.from_date, filters.to_date);
    countParams.push(filters.from_date, filters.to_date);
  } else if (filters.from_date) {
    query += " AND DATE(start_date) >= ?";
    countQuery += " AND DATE(start_date) >= ?";
    params.push(filters.from_date);
    countParams.push(filters.from_date);
  } else if (filters.to_date) {
    query += " AND DATE(start_date) <= ?";
    countQuery += " AND DATE(start_date) <= ?";
    params.push(filters.to_date);
    countParams.push(filters.to_date);
  }

  query += " ORDER BY created_at DESC";

  if (page && limit) {
    const offset = (page - 1) * limit;
    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [countResult] = await pool.execute(countQuery, countParams);
    const [rows] = await pool.execute(query, params);

    return {
      data: rows,
      meta: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult[0].total / limit),
      },
    };
  } else {
    const [rows] = await pool.execute(query, params);
    return rows;
  }
};

const getPreActiveCourseById = async (id) => {
  const [rows] = await pool.execute(
    "SELECT * FROM courses WHERE id = ? AND is_pre_active = 1",
    [id],
  );
  return rows[0];
};

const updatePreActiveCourse = async (id, updateData) => {
  const fields = [];
  const values = [];

  // Map frontend fields if present
  const data = { ...updateData };
  if (data.days !== undefined) {
    data.no_of_days = data.days;
    delete data.days;
  }
  if (data.type_of_course !== undefined) {
    data.course_type = data.type_of_course;
    delete data.type_of_course;
  }
  if (data.topic !== undefined) {
    data.master_course_id = data.topic;
    delete data.topic;
  }

  for (const [key, value] of Object.entries(data)) {
    // Only allow updating specific fields to avoid malicious injects
    if (
      [
        "master_course_id",
        "master_course_name",
        "topic",
        "course_name",
        "start_date",
        "end_date",
        "no_of_days",
        "type_of_location",
        "location_id",
        "other_location",
        "course_type",
        "description",
        "remarks",
      ].includes(key)
    ) {
      fields.push(`${key} = ?`);
      values.push(value === undefined ? null : value);
    }
  }

  if (fields.length === 0) return null;

  // Special logic: If master_course_id was changed, we might want to update master_course_name and topic too
  // But for now, we'll assume the frontend/controller might pass those or we update them manually if needed.
  // Given how the form works, let's just make it work for the standard fields.

  values.push(id);
  const query = `UPDATE courses SET ${fields.join(", ")} WHERE id = ? AND is_pre_active = 1 AND status = 'Pre-Active'`;
  const [result] = await pool.execute(query, values);

  if (result.affectedRows > 0) {
    return getPreActiveCourseById(id);
  }
  return null;
};

const deletePreActiveCourse = async (id) => {
  const [result] = await pool.execute(
    "DELETE FROM courses WHERE id = ? AND is_pre_active = 1 AND status = 'Pre-Active'",
    [id],
  );
  return result.affectedRows > 0;
};

// ==========================================
// Token Management
// ==========================================

const createToken = async (course_id, entity_id, entity_type) => {
  // Check if token already exists and is valid
  const [existing] = await pool.execute(
    "SELECT token, expires_at FROM course_tokens WHERE course_id = ? AND entity_id = ? AND entity_type = ? AND status = 1",
    [course_id, entity_id, entity_type],
  );

  if (existing.length > 0 && new Date(existing[0].expires_at) > new Date()) {
    return existing[0].token;
  }

  const id = uuidv4();
  const token = uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, ""); // Long random string
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + 7); // Token valid for 7 days

  const query = `
    INSERT INTO course_tokens (id, course_id, entity_id, entity_type, token, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  await pool.execute(query, [
    id,
    course_id,
    entity_id,
    entity_type,
    token,
    expires_at,
  ]);
  return token;
};

const getTokenDetails = async (token) => {
  const [rows] = await pool.execute(
    "SELECT * FROM course_tokens WHERE token = ? AND status = 1 AND expires_at > NOW()",
    [token],
  );
  return rows[0] || null;
};

const revokeToken = async (token) => {
  const [result] = await pool.execute(
    "UPDATE course_tokens SET status = 0 WHERE token = ?",
    [token],
  );
  return result.affectedRows > 0;
};

// ==========================================
// Candidate Enrollment (Public Portal)
// ==========================================

const enrollCandidateByNominator = async (
  course_id,
  nominator_id,
  candidateData,
) => {
  // Check if candidate exists, if not create 'Others' candidate
  let candidateId = candidateData.candidate_id;

  if (!candidateId && candidateData.email) {
    // See if user exists
    const [users] = await pool.execute(
      "SELECT id FROM users WHERE email = ? AND role_type = 'Candidate'",
      [candidateData.email],
    );
    if (users.length > 0) {
      candidateId = users[0].id;
    } else {
      // Create user
      candidateId = uuidv4();
      await pool.execute(
        "INSERT INTO users (id, first_name, last_name, email, indos_number, mobile_no, date_of_birth, registration_type, role_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Others', 'Candidate', 1)",
        [
          candidateId,
          candidateData.first_name,
          candidateData.last_name || "",
          candidateData.email,
          candidateData.indos_number || null,
          candidateData.mobile_no || null,
          candidateData.date_of_birth || null,
        ],
      );
    }
  }

  if (!candidateId) throw new Error("Could not determine or create candidate.");

  // Check if already enrolled
  const [enrolled] = await pool.execute(
    "SELECT id FROM courses_enrollment WHERE course_id = ? AND candidate_id = ?",
    [course_id, candidateId],
  );

  if (enrolled.length > 0) {
    throw new Error("Candidate is already nominated for this course.");
  }

  const enrollmentId = uuidv4();
  await pool.execute(
    "INSERT INTO courses_enrollment (id, course_id, candidate_id, nominator_id, candidate_approval_status, status) VALUES (?, ?, ?, ?, 'Pending', 'Active')",
    [enrollmentId, course_id, candidateId, nominator_id],
  );

  return enrollmentId;
};

const getCandidateEnrollmentById = async (candidateId, courseId) => {
  const [rows] = await pool.execute(
    "SELECT ce.*, u.first_name, u.last_name, u.email FROM courses_enrollment ce JOIN users u ON ce.candidate_id = u.id WHERE ce.candidate_id = ? AND ce.course_id = ?",
    [candidateId, courseId],
  );
  return rows[0];
};

// ==========================================
// Approvals
// ==========================================

const updateCandidateApproval = async (
  course_id,
  candidate_id,
  status,
  remark,
) => {
  const [result] = await pool.execute(
    "UPDATE courses_enrollment SET candidate_approval_status = ?, candidate_remark = ? WHERE course_id = ? AND candidate_id = ?",
    [status, remark || null, course_id, candidate_id],
  );
  return result.affectedRows > 0;
};

const updateAdminApproval = async (enrollmentId, status, remark) => {
  const [result] = await pool.execute(
    "UPDATE courses_enrollment SET admin_approval_status = ?, admin_remark = ?, admin_action_date = NOW() WHERE id = ?",
    [status, remark || null, enrollmentId],
  );
  return result.affectedRows > 0;
};

const getPendingAdminApprovals = async (course_id) => {
  const [rows] = await pool.execute(
    `SELECT ce.id, ce.course_id, ce.candidate_id, ce.candidate_approval_status, ce.candidate_remark, 
                ce.admin_approval_status, ce.admin_remark, ce.admin_action_date, ce.nominator_id,
                u.first_name, u.last_name, u.email, u.indos_number,
                n.name as nominator_name
         FROM courses_enrollment ce
         JOIN users u ON ce.candidate_id = u.id
         LEFT JOIN nominators n ON ce.nominator_id = n.id
         WHERE ce.course_id = ? AND ce.candidate_approval_status IN ('Approved', 'Rejected')`,
    [course_id],
  );
  return rows;
};

// ==========================================
// Convert and Reports
// ==========================================

const convertToActiveCourse = async (id) => {
  const [result] = await pool.execute(
    "UPDATE courses SET is_pre_active = 0, status = 'Initiated' WHERE id = ? AND is_pre_active = 1",
    [id],
  );
  return result.affectedRows > 0;
};

const getAdminRemarksReport = async (filters = {}) => {
  let query = `
        SELECT ce.id, c.course_name, c.start_date, c.end_date, 
               u.first_name, u.last_name, u.email,
               ce.candidate_approval_status, ce.candidate_remark,
               ce.admin_approval_status, ce.admin_remark, ce.admin_action_date
        FROM courses_enrollment ce
        JOIN courses c ON ce.course_id = c.id
        JOIN users u ON ce.candidate_id = u.id
        WHERE c.is_pre_active = 1 OR ce.admin_remark IS NOT NULL
    `;
  const params = [];

  if (filters.course_id) {
    query += " AND ce.course_id = ?";
    params.push(filters.course_id);
  }
  if (filters.candidate_id) {
    query += " AND ce.candidate_id = ?";
    params.push(filters.candidate_id);
  }

  query += " ORDER BY ce.admin_action_date DESC";

  const [rows] = await pool.execute(query, params);
  return rows;
};

module.exports = {
  createPreActiveCourse,
  getAllPreActiveCourses,
  getPreActiveCourseById,
  updatePreActiveCourse,
  deletePreActiveCourse,
  createToken,
  getTokenDetails,
  revokeToken,
  enrollCandidateByNominator,
  getCandidateEnrollmentById,
  updateCandidateApproval,
  updateAdminApproval,
  getPendingAdminApprovals,
  convertToActiveCourse,
  getAdminRemarksReport,
};
