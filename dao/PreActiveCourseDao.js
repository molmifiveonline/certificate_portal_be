const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const { hasColumn } = require("../utils/schemaUtils");

const normalizeCourseType = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const isOuthouseCourseType = (value) =>
  normalizeCourseType(value) === "outhouse";

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

    const [countResult] = await pool.query(countQuery, countParams);
    const [rows] = await pool.query(query, params);

    return {
      data: rows,
      meta: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult[0].total / (parseInt(limit) || 10)),
      },
    };
  } else {
    const [rows] = await pool.query(query, params);
    return rows;
  }
};

const getPreActiveCourseById = async (id) => {
  const [rows] = await pool.execute(
    `SELECT c.*, l.location_name 
     FROM courses c
     LEFT JOIN locations l ON c.location_id = l.id COLLATE utf8mb4_general_ci
     WHERE c.id = ? AND c.is_pre_active = 1`,
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
    // Fetch candidate role ID
    const [roles] = await pool.execute(
      "SELECT id FROM roles WHERE name = 'candidate'",
    );
    if (roles.length === 0) throw new Error("Candidate role not found");
    const roleId = roles[0].id;

    // See if user exists
    const [users] = await pool.execute(
      "SELECT id FROM users WHERE email = ? AND role_id = ?",
      [candidateData.email, roleId],
    );

    if (users.length > 0) {
      candidateId = users[0].id;
    } else {
      // Create user
      candidateId = uuidv4();
      await pool.execute(
        "INSERT INTO users (id, role_id, first_name, last_name, email, mobile, status) VALUES (?, ?, ?, ?, ?, ?, 1)",
        [
          candidateId,
          roleId,
          candidateData.first_name,
          candidateData.last_name || "",
          candidateData.email,
          candidateData.mobile_no || null,
        ],
      );

      // Create Candidate Profile
      const profileId = uuidv4();
      await pool.execute(
        "INSERT INTO candidate_profiles (id, user_id, dob, indos_number, registration_type) VALUES (?, ?, ?, ?, 'Others')",
        [
          profileId,
          candidateId,
          candidateData.date_of_birth || null,
          candidateData.indos_number || null,
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

const enrollCandidateByAdmin = async (
  course_id,
  admin_user_id,
  admin_user_name,
  candidateData,
) => {
  // Check if candidate exists, if not create 'Others' candidate
  let candidateId = candidateData.candidate_id;

  if (!candidateId && candidateData.email) {
    // Fetch candidate role ID
    const [roles] = await pool.execute(
      "SELECT id FROM roles WHERE name = 'candidate'",
    );
    if (roles.length === 0) throw new Error("Candidate role not found");
    const roleId = roles[0].id;

    // See if user exists
    const [users] = await pool.execute(
      "SELECT id FROM users WHERE email = ? AND role_id = ?",
      [candidateData.email, roleId],
    );

    if (users.length > 0) {
      candidateId = users[0].id;
    } else {
      // Create user
      candidateId = uuidv4();
      await pool.execute(
        "INSERT INTO users (id, role_id, first_name, last_name, email, mobile, status) VALUES (?, ?, ?, ?, ?, ?, 1)",
        [
          candidateId,
          roleId,
          candidateData.first_name,
          candidateData.last_name || "",
          candidateData.email,
          candidateData.mobile_no || null,
        ],
      );

      // Create Candidate Profile
      const profileId = uuidv4();
      await pool.execute(
        "INSERT INTO candidate_profiles (id, user_id, dob, indos_number, registration_type) VALUES (?, ?, ?, ?, 'Others')",
        [
          profileId,
          candidateId,
          candidateData.date_of_birth || null,
          candidateData.indos_number || null,
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
  // Admin adds candidate: admin approval status is set to Approved, admin_user_id and admin_user_name are saved if fields exist, otherwise we just save it.
  // Wait, let's see if admin_user_id exists in courses_enrollment table. Let's write standard fields.
  // Actually, updateAdminApproval uses admin_approval_status, admin_remark, admin_action_date.
  // Let's check courses_enrollment schema to see if admin_user_id/name exist. Wait, earlier I saw:
  // "nominator_name", and in AdminPreActiveApprovals.jsx: "appr.admin_remark || appr.admin_user_name || """
  // Wait, does "courses_enrollment" have "admin_user_name"? In sql it's not selected in getPendingAdminApprovals.
  // Oh, wait, in getPendingAdminApprovals (lines 388-410):
  // It selects:
  // `ce.id, ce.course_id, ce.candidate_id, ce.candidate_approval_status, ce.candidate_remark,
  // ce.candidate_rejection_reason, ce.candidate_available_date,
  // ce.admin_approval_status, ce.admin_remark, ce.admin_action_date, ce.nominator_id,
  // u.first_name, u.middle_name, u.last_name, u.email, cp.indos_number,
  // ...`
  // It does not select `admin_user_name` or `admin_user_id` from `courses_enrollment`. Let's check if there are columns.
  // Wait! Where did `admin_user_name` come from? Maybe it's not in the DB, or maybe it's in another table, or we just write it if the column exists.
  // Let's check the schema for courses_enrollment in `database_changes.sql` if it contains `admin_user_name` or similar.
  // Actually, we can run a simple node script to describe the `courses_enrollment` table. Let's do that!
  
  await pool.execute(
    "INSERT INTO courses_enrollment (id, course_id, candidate_id, admin_approval_status, admin_remark, admin_action_date, candidate_approval_status, status) VALUES (?, ?, ?, 'Approved', 'Added by Admin', NOW(), 'Pending', 'Active')",
    [enrollmentId, course_id, candidateId],
  );

  return enrollmentId;
};

const getCandidateEnrollmentById = async (candidateId, courseId) => {
  const [rows] = await pool.execute(
    "SELECT ce.*, u.first_name, u.middle_name, u.last_name, u.email FROM courses_enrollment ce JOIN users u ON ce.candidate_id = u.id WHERE ce.candidate_id = ? AND ce.course_id = ?",
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
  rejection_reason,
  available_date,
) => {
  const [result] = await pool.execute(
    "UPDATE courses_enrollment SET candidate_approval_status = ?, candidate_remark = ?, candidate_rejection_reason = ?, candidate_available_date = ? WHERE course_id = ? AND candidate_id = ?",
    [status, remark || null, rejection_reason || null, available_date || null, course_id, candidate_id],
  );
  return result.affectedRows > 0;
};

const updateCandidateApprovalByEnrollment = async (
  enrollmentId,
  candidate_id,
  status,
  remark,
  rejection_reason,
  available_date,
) => {
  const [result] = await pool.execute(
    "UPDATE courses_enrollment SET candidate_approval_status = ?, candidate_remark = ?, candidate_rejection_reason = ?, candidate_available_date = ? WHERE id = ? AND candidate_id = ?",
    [status, remark || null, rejection_reason || null, available_date || null, enrollmentId, candidate_id],
  );
  return result.affectedRows > 0;
};

const getCandidateNominations = async (candidateId, options = {}) => {
  const { status, search } = options;
  let query = `
    SELECT 
      ce.id as enrollment_id,
      ce.course_id,
      ce.candidate_id,
      ce.candidate_approval_status,
      ce.candidate_remark,
      ce.candidate_rejection_reason,
      ce.candidate_available_date,
      ce.created_at as nominated_at,
      c.course_id as course_code,
      c.course_name,
      c.topic,
      c.start_date,
      c.end_date,
      c.days,
      c.type_of_course,
      c.type_of_location,
      c.other_location,
      c.description,
      c.is_pre_active,
      l.name as location_name,
      COALESCE(NULLIF(CONCAT_WS(' ', n.first_name, n.last_name), ''), n.name, n.email, 'Admin') as nominated_by
    FROM courses_enrollment ce
    JOIN courses c ON ce.course_id = c.id
    LEFT JOIN locations l ON c.location_id = l.id
    LEFT JOIN nominators n ON ce.nominator_id = n.id
    WHERE ce.candidate_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)
  `;
  const params = [candidateId];

  if (status && status !== "All") {
    query += ` AND ce.candidate_approval_status = ?`;
    params.push(status);
  }

  if (search) {
    query += ` AND (c.course_name LIKE ? OR c.course_id LIKE ? OR c.topic LIKE ?)`;
    const searchVal = `%${search}%`;
    params.push(searchVal, searchVal, searchVal);
  }

  query += ` ORDER BY ce.created_at DESC, c.start_date DESC`;

  const [rows] = await pool.execute(query, params);
  return rows;
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
                ce.candidate_rejection_reason, ce.candidate_available_date,
                ce.admin_approval_status, ce.admin_remark, ce.admin_action_date, ce.nominator_id,
                u.first_name, u.middle_name, u.last_name, u.email, cp.indos_number,
                (
                  SELECT MAX(cert.issue_date)
                  FROM certificates cert
                  WHERE cert.candidate_id = ce.candidate_id
                    AND cert.active_course_id <> ce.course_id
                    AND cert.issue_date IS NOT NULL
                ) as previous_certificate_date,
                COALESCE(NULLIF(CONCAT_WS(' ', n.first_name, n.last_name), ''), n.name, n.email) as nominator_name
         FROM courses_enrollment ce
         JOIN users u ON ce.candidate_id = u.id
         LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
         LEFT JOIN nominators n ON ce.nominator_id = n.id
         WHERE ce.course_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)`,
    [course_id],
  );
  return rows;
};

const getRejectedCandidateApprovals = async (options = {}) => {
  const {
    search = "",
    page = 1,
    limit = 10,
    admin_status,
    sort_by = "created_at",
    sort_order = "desc",
  } = options;

  const sortColumns = {
    course_id: "c.course_id",
    course_name: "c.course_name",
    start_date: "c.start_date",
    candidate_name: "u.first_name",
    candidate_email: "u.email",
    rejection_reason: "ce.candidate_rejection_reason",
    available_date: "ce.candidate_available_date",
    admin_status: "COALESCE(ce.admin_approval_status, 'Pending')",
    admin_action_date: "ce.admin_action_date",
    created_at: "ce.created_at",
  };
  const sortColumn = sortColumns[sort_by] || sortColumns.created_at;
  const sortDirection =
    String(sort_order).toLowerCase() === "asc" ? "ASC" : "DESC";

  let whereClause = `
    WHERE ce.candidate_approval_status = 'Rejected'
      AND (ce.status != 'Deleted' OR ce.status IS NULL)
  `;
  const params = [];
  const countParams = [];

  if (
    admin_status &&
    ["Pending", "Approved", "Rejected"].includes(admin_status)
  ) {
    whereClause += " AND COALESCE(ce.admin_approval_status, 'Pending') = ?";
    params.push(admin_status);
    countParams.push(admin_status);
  }

  if (search) {
    whereClause += `
      AND (
        c.course_id LIKE ?
        OR c.course_name LIKE ?
        OR u.first_name LIKE ?
        OR u.middle_name LIKE ?
        OR u.last_name LIKE ?
        OR CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) LIKE ?
        OR u.email LIKE ?
        OR COALESCE(NULLIF(CONCAT_WS(' ', n.first_name, n.last_name), ''), n.name, n.email) LIKE ?
        OR ce.candidate_rejection_reason LIKE ?
      )
    `;
    const searchValue = `%${search}%`;
    params.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
    );
    countParams.push(
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
      searchValue,
    );
  }

  const parsedLimit = Math.max(parseInt(limit, 10) || 10, 1);
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (parsedPage - 1) * parsedLimit;

  const countQuery = `
    SELECT COUNT(*) as total
    FROM courses_enrollment ce
    JOIN courses c ON ce.course_id = c.id
    JOIN users u ON ce.candidate_id = u.id
    LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
    LEFT JOIN nominators n ON ce.nominator_id = n.id
    ${whereClause}
  `;

  const query = `
    SELECT ce.id, ce.course_id, ce.candidate_id,
           ce.candidate_approval_status, ce.candidate_remark,
           ce.candidate_rejection_reason, ce.candidate_available_date,
           COALESCE(ce.admin_approval_status, 'Pending') as admin_approval_status,
           ce.admin_remark, ce.admin_action_date,
           ce.nominator_id, ce.created_at,
           c.course_id as course_code, c.course_name, c.start_date, c.end_date,
           u.first_name, u.middle_name, u.last_name, u.email, cp.indos_number,
           (
             SELECT MAX(cert.issue_date)
             FROM certificates cert
             WHERE cert.candidate_id = ce.candidate_id
               AND cert.active_course_id <> ce.course_id
               AND cert.issue_date IS NOT NULL
           ) as previous_certificate_date,
           COALESCE(NULLIF(CONCAT_WS(' ', n.first_name, n.last_name), ''), n.name, n.email) as nominator_name
    FROM courses_enrollment ce
    JOIN courses c ON ce.course_id = c.id
    JOIN users u ON ce.candidate_id = u.id
    LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
    LEFT JOIN nominators n ON ce.nominator_id = n.id
    ${whereClause}
    ORDER BY ${sortColumn} ${sortDirection}
    LIMIT ? OFFSET ?
  `;

  const [countRows] = await pool.query(countQuery, countParams);
  const [rows] = await pool.query(query, [...params, parsedLimit, offset]);
  const total = countRows[0]?.total || 0;

  return {
    data: rows,
    meta: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
    },
  };
};

// ==========================================
// Convert and Reports
// ==========================================

const convertToActiveCourse = async (id, courseType) => {
  const setParts = ["is_pre_active = 0", "status = 'Initiated'"];
  const params = [];

  if (await hasColumn("courses", "is_outhouse")) {
    setParts.push("is_outhouse = ?");
    params.push(isOuthouseCourseType(courseType) ? 1 : 0);
  }

  params.push(id);

  const [result] = await pool.execute(
    `UPDATE courses SET ${setParts.join(", ")} WHERE id = ? AND is_pre_active = 1`,
    params,
  );
  return result.affectedRows > 0;
};

const getAdminRemarksReport = async (filters = {}) => {
  let query = `
        SELECT ce.id, c.course_name, c.start_date, c.end_date, 
               u.first_name, u.middle_name, u.last_name, u.email,
               ce.candidate_approval_status, ce.candidate_remark,
               ce.candidate_rejection_reason, ce.candidate_available_date,
               ce.admin_approval_status, ce.admin_remark, ce.admin_action_date
        FROM courses_enrollment ce
        JOIN courses c ON ce.course_id = c.id
        JOIN users u ON ce.candidate_id = u.id
        WHERE (c.is_pre_active = 1 OR ce.admin_remark IS NOT NULL)
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
  if (filters.search) {
    query +=
      " AND (c.course_name LIKE ? OR u.first_name LIKE ? OR u.middle_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)";
    const searchParam = `%${filters.search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam, searchParam);
  }

  query += " ORDER BY ce.admin_action_date DESC";

  const [rows] = await pool.execute(query, params);
  return rows;
};

/**
 * Returns non-MOLMI candidates that are not already nominated for the course.
 */
const getAvailableOthersCandidates = async (courseId) => {
  const hasMergedIntoColumn = await hasColumn("users", "merged_into_user_id");
  const query = `
    SELECT 
      u.id, u.first_name, u.middle_name, u.last_name, u.email, u.mobile,
      CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) as candidate_name,
      cp.middle_name as profile_middle_name, cp.gender, cp.dob, cp.indos_number, cp.registration_type
    FROM users u
    JOIN candidate_profiles cp ON u.id = cp.user_id
    JOIN roles r ON u.role_id = r.id
    WHERE r.name = 'candidate' 
      AND u.status = 1
      ${hasMergedIntoColumn ? "AND u.merged_into_user_id IS NULL" : ""}
      AND u.id NOT IN (
        SELECT candidate_id FROM courses_enrollment WHERE course_id = ?
      )
    ORDER BY u.first_name ASC
  `;
  const [rows] = await pool.execute(query, [courseId]);
  return rows;
};

/**
 * Returns pre-active courses that the given nominator has been notified about,
 * i.e. courses for which a course_token entry exists for this nominator.
 */
const getNominatorNotifiedCourses = async (nominatorId) => {
  const [rows] = await pool.execute(
    `SELECT DISTINCT c.*, l.location_name,
       (SELECT COUNT(*) FROM courses_enrollment ce WHERE ce.course_id = c.id AND ce.nominator_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)) as nominated_count
     FROM courses c
     INNER JOIN course_tokens ct ON ct.course_id = c.id
     LEFT JOIN locations l ON c.location_id = l.id COLLATE utf8mb4_general_ci
     WHERE c.is_pre_active = 1
       AND ct.entity_id = ?
       AND ct.entity_type = 'Nominator'
     ORDER BY c.created_at DESC`,
    [nominatorId, nominatorId],
  );
  return rows;
};

const getNominatorEnrollments = async (courseId, nominatorId) => {
  const [rows] = await pool.execute(
    `SELECT ce.id, u.first_name, u.middle_name, u.last_name, u.email, u.mobile as mobile_no, 
            CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) as candidate_name,
            cp.dob as date_of_birth, cp.indos_number, ce.candidate_id, ce.candidate_approval_status as status
     FROM courses_enrollment ce
     JOIN users u ON ce.candidate_id = u.id
     LEFT JOIN candidate_profiles cp ON u.id = cp.user_id
     WHERE ce.course_id = ? AND ce.nominator_id = ? AND (ce.status != 'Deleted' OR ce.status IS NULL)`,
    [courseId, nominatorId],
  );
  return rows;
};

const getExistingCourseIds = async (courseIds) => {
  if (!courseIds || courseIds.length === 0) return [];
  const [rows] = await pool.query(
    "SELECT course_id FROM courses WHERE course_id IN (?)",
    [courseIds],
  );
  return rows.map((r) => String(r.course_id));
};

const bulkUpsert = async (courses) => {
  const connection = await pool.getConnection();
  const stats = { inserted: 0, updated: 0, errors: 0 };

  try {
    await connection.beginTransaction();

    const courseIds = courses
      .map((c) => String(c.course_id))
      .filter((id) => id);
    if (courseIds.length === 0) return stats;

    const [existingRows] = await connection.query(
      "SELECT id, course_id FROM courses WHERE course_id IN (?)",
      [courseIds],
    );

    const existingMap = new Map(
      existingRows.map((r) => [String(r.course_id), r.id]),
    );

    for (const courseData of courses) {
      if (!courseData.course_id) {
        stats.errors++;
        continue;
      }

      const cid = String(courseData.course_id);
      const existingId = existingMap.get(cid);

      if (existingId) {
        // Update
        const updateQuery = `
          UPDATE courses SET 
            course_name = ?, 
            start_date = ?, 
            end_date = ?, 
            no_of_days = ?, 
            type_of_location = ?, 
            location_id = ?, 
            course_type = ?, 
            description = ?, 
            remarks = ?,
            master_course_name = ?,
            topic = ?
          WHERE id = ?
        `;
        await connection.execute(updateQuery, [
          courseData.course_name || null,
          courseData.start_date || null,
          courseData.end_date || null,
          courseData.days || 0,
          courseData.type_of_location || "Onsite",
          courseData.location_id || null,
          courseData.course_type || "Offline",
          courseData.description || "",
          courseData.remarks || "",
          courseData.master_course_name || null,
          courseData.topic || null,
          existingId,
        ]);
        stats.updated++;
      } else {
        // Insert
        const id = uuidv4();
        const insertQuery = `
          INSERT INTO courses (
            id, course_id, course_name, start_date, end_date, no_of_days, 
            type_of_location, location_id, course_type, description, 
            remarks, master_course_name, topic, status, is_pre_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pre-Active', 1)
        `;
        await connection.execute(insertQuery, [
          id,
          cid,
          courseData.course_name || null,
          courseData.start_date || null,
          courseData.end_date || null,
          courseData.days || 0,
          courseData.type_of_location || "Onsite",
          courseData.location_id || null,
          courseData.course_type || "Offline",
          courseData.description || "",
          courseData.remarks || "",
          courseData.master_course_name || null,
          courseData.topic || null,
        ]);
        stats.inserted++;
      }
    }

    await connection.commit();
    return stats;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  enrollCandidateByAdmin,
  getCandidateEnrollmentById,
  updateCandidateApproval,
  updateCandidateApprovalByEnrollment,
  getCandidateNominations,
  updateAdminApproval,
  getPendingAdminApprovals,
  getRejectedCandidateApprovals,
  convertToActiveCourse,
  isOuthouseCourseType,
  getAdminRemarksReport,
  getNominatorNotifiedCourses,
  getNominatorEnrollments,
  getAvailableOthersCandidates,
  getExistingCourseIds,
  bulkUpsert,
};
