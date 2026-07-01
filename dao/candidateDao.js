const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { hasColumn, hasTable } = require("../utils/schemaUtils");

const USER_MERGE_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "mobile",
  "status",
];

const PROFILE_MERGE_FIELDS = [
  "middle_name",
  "prefix",
  "gender",
  "dob",
  "nationality",
  "passport_no",
  "employee_id",
  "manager",
  "rank",
  "whatsapp_number",
  "alternate_mobile",
  "indos_number",
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
];

const MERGEABLE_FIELDS = [...USER_MERGE_FIELDS, ...PROFILE_MERGE_FIELDS];

const RELATED_COUNT_QUERIES = {
  courses_enrollment: {
    table: "courses_enrollment",
    column: "candidate_id",
  },
  assessment_results: {
    table: "assessment_results",
    column: "candidate_id",
  },
  feedback_question_answer: {
    table: "feedback_question_answer",
    column: "candidate_id",
  },
  certificates: {
    table: "certificates",
    column: "candidate_id",
  },
  hotel_files: {
    table: "hotel_files",
    column: "candidate_id",
  },
  reimbursements: {
    table: "reimbursements",
    column: "candidate_id",
  },
  candidate_sync_logs: {
    table: "candidate_sync_logs",
    column: "candidate_user_id",
  },
};

function normalizeIdList(ids = []) {
  return [...new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean))];
}

function mergeRemark(remarks) {
  return remarks
    ? `Merged duplicate candidate. ${remarks}`
    : "Merged duplicate candidate.";
}

class CandidateDao {
  static getMergeableFields() {
    return {
      user: USER_MERGE_FIELDS,
      profile: PROFILE_MERGE_FIELDS,
      all: MERGEABLE_FIELDS,
    };
  }

  static async getAllCandidates(filters = {}) {
    const hasMergedIntoColumn = await hasColumn("users", "merged_into_user_id");
    let baseQuery = `
      FROM users u
      JOIN candidate_profiles cp ON u.id = cp.user_id
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'candidate'
    `;

    if (hasMergedIntoColumn) {
      baseQuery += " AND u.merged_into_user_id IS NULL";
    }

    const params = [];

    if (filters.search) {
      baseQuery += ` AND (u.first_name LIKE ? OR u.middle_name LIKE ? OR cp.middle_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR cp.passport_no LIKE ? OR cp.employee_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.manager) {
      baseQuery += ` AND cp.manager LIKE ?`;
      params.push(`%${filters.manager}%`);
    }

    if (filters.rank) {
      baseQuery += ` AND cp.rank LIKE ?`;
      params.push(`%${filters.rank}%`);
    }

    if (filters.nationality) {
      baseQuery += ` AND cp.nationality = ?`;
      params.push(filters.nationality);
    }

    if (filters.registration_type) {
      baseQuery += ` AND cp.registration_type = ?`;
      params.push(filters.registration_type);
    }

    if (
      filters.status !== undefined &&
      filters.status !== "" &&
      filters.status !== "all"
    ) {
      baseQuery += ` AND u.status = ?`;
      params.push(filters.status);
    } else if (filters.status === "all") {
    } else {
      baseQuery += ` AND u.status = 1`;
    }

    const countQuery = `SELECT COUNT(*) as totalCount ${baseQuery}`;
    const [countResult] = await db.query(countQuery, params);
    const totalCount = countResult[0].totalCount;

    let dataQuery = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile, u.status,
        cp.middle_name, cp.prefix, cp.gender, cp.dob, cp.nationality,
        cp.passport_no, cp.employee_id, cp.manager, cp.rank, 
        cp.whatsapp_number, cp.alternate_mobile, cp.indos_number, cp.registration_type,
        cp.designation, cp.vessel_type, cp.last_vessel_name, cp.next_vessel_name, 
        cp.manning_company, cp.sign_on_date, cp.sign_off_date, cp.officer, cp.seaman_book_no, cp.profile_image, u.created_at
      ${baseQuery}
    `;

    const allowedSortFields = {
      first_name: "u.first_name",
      last_name: "u.last_name",
      email: "u.email",
      employee_id: "cp.employee_id",
      rank: "cp.rank",
      nationality: "cp.nationality",
      registration_type: "cp.registration_type",
      created_at: "u.created_at",
    };

    const sortBy = allowedSortFields[filters.sort_by] || "u.created_at";
    const sortOrder = filters.sort_order === "asc" ? "ASC" : "DESC";
    dataQuery += ` ORDER BY ${sortBy} ${sortOrder}`;

    const dataParams = [...params];
    let page = null;
    let limit = null;

    if (filters.page && filters.limit) {
      page = Math.max(1, Number(filters.page));
      limit = Number(filters.limit);
      const offset = (page - 1) * limit;
      dataQuery += ` LIMIT ? OFFSET ?`;
      dataParams.push(limit, offset);
    }

    const [rows] = await db.query(dataQuery, dataParams);

    return {
      data: rows,
      total: totalCount,
      page: page || 1,
      limit: limit || totalCount,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
    };
  }

  static async softDeleteCandidate(id) {
    const [result] = await db.query(
      "UPDATE users SET status = 0 WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }

  static async getCandidateById(id) {
    const query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile, u.status,
        cp.middle_name, cp.prefix, cp.gender, cp.dob, cp.nationality,
        cp.passport_no, cp.employee_id, cp.manager, cp.rank, 
        cp.whatsapp_number, cp.alternate_mobile, cp.indos_number, cp.registration_type,
        cp.designation, cp.vessel_type, cp.last_vessel_name, cp.next_vessel_name, 
        cp.manning_company, cp.sign_on_date, cp.sign_off_date, cp.officer, cp.seaman_book_no, cp.profile_image, u.created_at
      FROM users u
      JOIN candidate_profiles cp ON u.id = cp.user_id
      WHERE u.id = ?
    `;
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async updateCandidate(id, updateData) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // Check if email already exists for another user
      if (updateData.email) {
        const [existingEmail] = await connection.query(
          "SELECT id FROM users WHERE email = ? AND id != ?",
          [updateData.email, id]
        );
        if (existingEmail.length > 0) {
          const error = new Error(`Email '${updateData.email}' is already in use by another user.`);
          error.statusCode = 400;
          throw error;
        }
      }

      // Update User fields
      const userFields = [
        "first_name",
        "middle_name",
        "last_name",
        "email",
        "mobile",
        "status",
      ];
      const userUpdates = [];
      const userParams = [];

      for (const field of userFields) {
        if (updateData[field] !== undefined) {
          userUpdates.push(`\`${field}\` = ?`);
          userParams.push(updateData[field]);
        }
      }

      // Handle Password update
      if (updateData.password) {
        const hashedPassword = await bcrypt.hash(updateData.password, 10);
        userUpdates.push("password = ?");
        userParams.push(hashedPassword);
      }

      if (userUpdates.length > 0) {
        userParams.push(id);
        await connection.query(
          `UPDATE users SET ${userUpdates.join(", ")} WHERE id = ?`,
          userParams,
        );
      }

      // Update Profile fields
      const profileFields = [
        "middle_name",
        "prefix",
        "gender",
        "dob",
        "nationality",
        "passport_no",
        "employee_id",
        "manager",
        "rank",
        "whatsapp_number",
        "alternate_mobile",
        "indos_number",
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
      ];
      const profileUpdates = [];
      const profileParams = [];

      profileFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          profileUpdates.push(`\`${field}\` = ?`);
          profileParams.push(updateData[field]);
        }
      });

      if (profileUpdates.length > 0) {
        profileParams.push(id);
        await connection.query(
          `UPDATE candidate_profiles SET ${profileUpdates.join(", ")} WHERE user_id = ?`,
          profileParams,
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async exportCandidates(filters = {}) {
    const hasMergedIntoColumn = await hasColumn("users", "merged_into_user_id");
    let baseQuery = `
      FROM users u
      JOIN candidate_profiles cp ON u.id = cp.user_id
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'candidate'
    `;

    if (hasMergedIntoColumn) {
      baseQuery += " AND u.merged_into_user_id IS NULL";
    }

    const params = [];

    if (filters.search) {
      baseQuery += ` AND (u.first_name LIKE ? OR u.middle_name LIKE ? OR cp.middle_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR cp.passport_no LIKE ? OR cp.employee_id LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.manager) {
      baseQuery += ` AND cp.manager LIKE ?`;
      params.push(`%${filters.manager}%`);
    }

    if (filters.rank) {
      baseQuery += ` AND cp.rank LIKE ?`;
      params.push(`%${filters.rank}%`);
    }

    if (filters.nationality) {
      baseQuery += ` AND cp.nationality = ?`;
      params.push(filters.nationality);
    }

    if (filters.registration_type) {
      baseQuery += ` AND cp.registration_type = ?`;
      params.push(filters.registration_type);
    }

    if (
      filters.status !== undefined &&
      filters.status !== "" &&
      filters.status !== "all"
    ) {
      baseQuery += ` AND u.status = ?`;
      params.push(filters.status);
    } else if (filters.status === "all") {
      // no status filter
    } else {
      baseQuery += ` AND u.status = 1`;
    }

    const query = `
      SELECT 
        u.first_name, u.last_name, u.email, u.mobile,
        cp.middle_name, cp.prefix, cp.gender, cp.dob, cp.nationality,
        cp.passport_no, cp.employee_id, cp.manager, cp.rank, 
        cp.whatsapp_number, cp.alternate_mobile, cp.indos_number, cp.registration_type,
        cp.designation, cp.vessel_type, cp.last_vessel_name, cp.next_vessel_name, 
        cp.manning_company, cp.sign_on_date, cp.sign_off_date, cp.officer, cp.seaman_book_no, cp.profile_image,
        u.created_at
      ${baseQuery}
      ORDER BY u.created_at DESC
    `;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async bulkUpsert(candidates, options = {}) {
    const { captureChanges = false } = options;
    const connection = await db.getConnection();
    const stats = { inserted: 0, updated: 0, errors: 0 };
    const changes = [];

    const emails = candidates
      .map((c) => c.email)
      .filter((e) => e && e.trim() !== "");
    if (emails.length === 0) {
      return captureChanges ? { ...stats, changes } : stats;
    }

    try {
      await connection.beginTransaction();

      const [roles] = await connection.query(
        "SELECT id FROM roles WHERE name = 'candidate'",
      );
      if (roles.length === 0) throw new Error("Candidate role not found");
      const roleId = roles[0].id;

      const [existingUsersRows] = await connection.query(
        "SELECT id, email FROM users WHERE email IN (?)",
        [emails],
      );

      const existingUsersMap = new Map(
        existingUsersRows.map((u) => [u.email.toLowerCase(), u.id]),
      );

      const tempPassword = crypto.randomBytes(8).toString("hex");
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      for (const candidate of candidates) {
        const {
          email,
          first_name,
          last_name,
          mobile,
          middle_name,
          prefix,
          gender,
          dob,
          nationality,
          passport_no,
          employee_id,
          manager,
          rank,
          whatsapp_number,
          alternate_mobile,
          indos_number,
          registration_type,
        } = candidate;

        if (!email) {
          stats.errors++;
          continue;
        }

        const normalizedEmail = email.toLowerCase();
        const existingUserId = existingUsersMap.get(normalizedEmail);

        if (existingUserId) {
          await connection.query(
            "UPDATE users SET first_name = ?, middle_name = ?, last_name = ?, mobile = ? WHERE id = ?",
            [first_name, middle_name ?? null, last_name, mobile, existingUserId],
          );

          const [profiles] = await connection.query(
            "SELECT id FROM candidate_profiles WHERE user_id = ?",
            [existingUserId],
          );

          if (profiles.length > 0) {
            await connection.query(
              `UPDATE candidate_profiles SET 
                middle_name = ?, prefix = ?, gender = ?, dob = ?, nationality = ?, 
                passport_no = ?, employee_id = ?, manager = ?, \`rank\` = ?, 
                whatsapp_number = ?, alternate_mobile = ?, indos_number = ?, 
                registration_type = ?, manager_last_served = ?, rank_last_served = ? 
              WHERE user_id = ?`,
              [
                middle_name,
                prefix,
                gender,
                dob,
                nationality,
                passport_no,
                employee_id,
                manager,
                rank,
                whatsapp_number,
                alternate_mobile,
                indos_number,
                registration_type,
                manager,
                rank,
                existingUserId,
              ],
            );
          } else {
            const profileId = uuidv4();
            await connection.query(
              `INSERT INTO candidate_profiles 
                (id, user_id, middle_name, prefix, gender, dob, nationality, 
                passport_no, employee_id, manager, \`rank\`, whatsapp_number, 
                alternate_mobile, indos_number, registration_type, manager_last_served, rank_last_served) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                profileId,
                existingUserId,
                middle_name,
                prefix,
                gender,
                dob,
                nationality,
                passport_no,
                employee_id,
                manager,
                rank,
                whatsapp_number,
                alternate_mobile,
                indos_number,
                registration_type,
                manager,
                rank,
              ],
            );
          }

          stats.updated++;
          if (captureChanges) {
            changes.push({
              candidate_user_id: existingUserId,
              sync_status: "Updated",
              employee_id: employee_id || "",
              first_name: first_name || "",
              last_name: last_name || "",
              email: email || "",
              mobile: mobile || "",
              nationality: nationality || "",
              passport_no: passport_no || "",
              manager: manager || "",
              rank: rank || "",
              registration_type: registration_type || "",
            });
          }
        } else {
          const userId = uuidv4();
          await connection.query(
            "INSERT INTO users (id, role_id, first_name, middle_name, last_name, email, password, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              userId,
              roleId,
              first_name,
              middle_name ?? null,
              last_name,
              email,
              hashedPassword,
              mobile,
              1,
            ],
          );

          const profileId = uuidv4();
          await connection.query(
            `INSERT INTO candidate_profiles 
              (id, user_id, middle_name, prefix, gender, dob, nationality, 
              passport_no, employee_id, manager, \`rank\`, whatsapp_number, 
              alternate_mobile, indos_number, registration_type, manager_last_served, rank_last_served) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              profileId,
              userId,
              middle_name,
              prefix,
              gender,
              dob,
              nationality,
              passport_no,
              employee_id,
              manager,
              rank,
              whatsapp_number,
              alternate_mobile,
              indos_number,
              registration_type,
              manager,
              rank,
            ],
          );

          stats.inserted++;
          if (captureChanges) {
            changes.push({
              candidate_user_id: userId,
              sync_status: "Created",
              employee_id: employee_id || "",
              first_name: first_name || "",
              last_name: last_name || "",
              email: email || "",
              mobile: mobile || "",
              nationality: nationality || "",
              passport_no: passport_no || "",
              manager: manager || "",
              rank: rank || "",
              registration_type: registration_type || "",
            });
          }
        }
      }

      await connection.commit();
      return captureChanges ? { ...stats, changes } : stats;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getExistingEmails(emails) {
    if (!emails || emails.length === 0) return [];
    const [rows] = await db.query(
      "SELECT email FROM users WHERE email IN (?)",
      [emails],
    );
    return rows.map((r) => r.email.toLowerCase());
  }

  static async ensureMergeAuditTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS candidate_merge_audits (
        id CHAR(36) PRIMARY KEY,
        master_candidate_id CHAR(36) NOT NULL,
        duplicate_candidate_ids JSON NOT NULL,
        selected_field_sources JSON NOT NULL,
        moved_record_counts JSON NOT NULL,
        remarks TEXT NULL,
        merged_by CHAR(36) NOT NULL,
        merged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
  }

  static async getMergeCandidates(candidateIds = []) {
    const ids = normalizeIdList(candidateIds);
    if (ids.length < 2) {
      const error = new Error("At least two candidates are required for merge.");
      error.statusCode = 400;
      throw error;
    }

    const placeholders = ids.map(() => "?").join(",");
    const query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.mobile, u.status,
        cp.middle_name, cp.prefix, cp.gender, cp.dob, cp.nationality,
        cp.passport_no, cp.employee_id, cp.manager, cp.\`rank\`,
        cp.whatsapp_number, cp.alternate_mobile, cp.indos_number, cp.registration_type,
        cp.designation, cp.vessel_type, cp.last_vessel_name, cp.next_vessel_name,
        cp.manning_company, cp.sign_on_date, cp.sign_off_date, cp.officer,
        cp.seaman_book_no, cp.profile_image
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN candidate_profiles cp ON cp.user_id = u.id
      WHERE r.name = 'candidate' AND u.id IN (${placeholders})
    `;

    const [rows] = await db.query(query, ids);
    if (rows.length !== ids.length) {
      const foundIds = new Set(rows.map((row) => row.id));
      const missingIds = ids.filter((id) => !foundIds.has(id));
      const error = new Error(`Candidate not found or not candidate role: ${missingIds.join(", ")}`);
      error.statusCode = 404;
      throw error;
    }

    const relatedCounts = await this.getRelatedCounts(ids);
    return ids.map((id) => ({
      ...rows.find((row) => row.id === id),
      related_counts: relatedCounts[id] || {},
    }));
  }

  static async getMergePreview(candidateIds = []) {
    const candidates = await this.getMergeCandidates(candidateIds);
    return {
      mergeable_fields: this.getMergeableFields(),
      candidates,
    };
  }

  static async getRelatedCounts(candidateIds = []) {
    const ids = normalizeIdList(candidateIds);
    const countsByCandidate = ids.reduce((acc, id) => {
      acc[id] = {};
      return acc;
    }, {});

    if (ids.length === 0) return countsByCandidate;

    for (const [key, config] of Object.entries(RELATED_COUNT_QUERIES)) {
      if (!(await hasTable(config.table))) {
        ids.forEach((id) => {
          countsByCandidate[id][key] = 0;
        });
        continue;
      }

      const placeholders = ids.map(() => "?").join(",");
      const [rows] = await db.query(
        `SELECT \`${config.column}\` AS candidate_id, COUNT(*) AS total
         FROM \`${config.table}\`
         WHERE \`${config.column}\` IN (${placeholders})
         GROUP BY \`${config.column}\``,
        ids,
      );
      const countMap = new Map(rows.map((row) => [row.candidate_id, Number(row.total) || 0]));
      ids.forEach((id) => {
        countsByCandidate[id][key] = countMap.get(id) || 0;
      });
    }

    return countsByCandidate;
  }

  static validateMergePayload(payload = {}) {
    const masterId = String(payload.master_candidate_id || "").trim();
    const duplicateIds = normalizeIdList(payload.duplicate_candidate_ids || []);
    const allIds = normalizeIdList([masterId, ...duplicateIds]);

    if (!masterId) {
      const error = new Error("master_candidate_id is required.");
      error.statusCode = 400;
      throw error;
    }

    if (duplicateIds.length === 0) {
      const error = new Error("At least one duplicate candidate is required.");
      error.statusCode = 400;
      throw error;
    }

    if (duplicateIds.includes(masterId)) {
      const error = new Error("Master candidate cannot also be a duplicate candidate.");
      error.statusCode = 400;
      throw error;
    }

    if (allIds.length < 2) {
      const error = new Error("At least two unique candidates are required for merge.");
      error.statusCode = 400;
      throw error;
    }

    return { masterId, duplicateIds, allIds };
  }

  static buildMergeUpdates(fieldValues = {}) {
    const userUpdates = {};
    const profileUpdates = {};
    const selectedFieldSources = {};

    for (const [field, selection] of Object.entries(fieldValues || {})) {
      if (!MERGEABLE_FIELDS.includes(field)) continue;
      const selectedValue =
        selection && Object.prototype.hasOwnProperty.call(selection, "value")
          ? selection.value
          : selection;

      if (USER_MERGE_FIELDS.includes(field)) {
        userUpdates[field] = selectedValue;
      } else {
        profileUpdates[field] = selectedValue;
      }

      selectedFieldSources[field] = {
        value: selectedValue,
        source_candidate_id:
          selection && typeof selection === "object"
            ? selection.source_candidate_id || null
            : null,
      };
    }

    return { userUpdates, profileUpdates, selectedFieldSources };
  }

  static async assertMergeEmailAvailable(connection, email, mergedCandidateIds) {
    if (!email) return;

    const placeholders = mergedCandidateIds.map(() => "?").join(",");
    const [rows] = await connection.query(
      `SELECT id FROM users WHERE email = ? AND id NOT IN (${placeholders}) LIMIT 1`,
      [email, ...mergedCandidateIds],
    );

    if (rows.length > 0) {
      const error = new Error("This email is already in use by another user.");
      error.statusCode = 400;
      throw error;
    }
  }

  static async mergeDuplicateCandidates(payload = {}, adminUserId) {
    const { masterId, duplicateIds, allIds } = this.validateMergePayload(payload);
    const candidates = await this.getMergeCandidates(allIds);

    if (!candidates.some((candidate) => candidate.id === masterId)) {
      const error = new Error("Master candidate was not found in selected candidates.");
      error.statusCode = 400;
      throw error;
    }

    const { userUpdates, profileUpdates, selectedFieldSources } =
      this.buildMergeUpdates(payload.field_values || {});

    await this.ensureMergeAuditTable();

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const movedRecordCounts = {};

      await this.assertMergeEmailAvailable(
        connection,
        userUpdates.email,
        allIds,
      );

      if (Object.keys(userUpdates).length > 0) {
        const fields = Object.keys(userUpdates);
        const setClause = fields.map((field) => `\`${field}\` = ?`).join(", ");
        const values = fields.map((field) => userUpdates[field]);
        await connection.query(
          `UPDATE users SET ${setClause} WHERE id = ?`,
          [...values, masterId],
        );
      }

      if (Object.keys(profileUpdates).length > 0) {
        const [profileRows] = await connection.query(
          "SELECT id FROM candidate_profiles WHERE user_id = ?",
          [masterId],
        );

        if (profileRows.length === 0) {
          const insertFields = Object.keys(profileUpdates);
          await connection.query(
            `INSERT INTO candidate_profiles (id, user_id, ${insertFields.map((field) => `\`${field}\``).join(", ")})
             VALUES (?, ?, ${insertFields.map(() => "?").join(", ")})`,
            [uuidv4(), masterId, ...insertFields.map((field) => profileUpdates[field])],
          );
        } else {
          const fields = Object.keys(profileUpdates);
          const setClause = fields.map((field) => `\`${field}\` = ?`).join(", ");
          const values = fields.map((field) => profileUpdates[field]);
          await connection.query(
            `UPDATE candidate_profiles SET ${setClause} WHERE user_id = ?`,
            [...values, masterId],
          );
        }
      }

      movedRecordCounts.courses_enrollment =
        await this.mergeCourseEnrollments(
          connection,
          masterId,
          duplicateIds,
          payload.remarks,
        );

      movedRecordCounts.assessment_results = await this.updateCandidateReference(
        connection,
        "assessment_results",
        "candidate_id",
        masterId,
        duplicateIds,
      );
      movedRecordCounts.feedback_question_answer = await this.updateCandidateReference(
        connection,
        "feedback_question_answer",
        "candidate_id",
        masterId,
        duplicateIds,
      );
      movedRecordCounts.certificates = await this.updateCandidateReference(
        connection,
        "certificates",
        "candidate_id",
        masterId,
        duplicateIds,
      );
      movedRecordCounts.hotel_files = await this.updateCandidateReference(
        connection,
        "hotel_files",
        "candidate_id",
        masterId,
        duplicateIds,
      );
      movedRecordCounts.reimbursements = await this.updateCandidateReference(
        connection,
        "reimbursements",
        "candidate_id",
        masterId,
        duplicateIds,
      );
      movedRecordCounts.candidate_sync_logs = await this.updateCandidateReference(
        connection,
        "candidate_sync_logs",
        "candidate_user_id",
        masterId,
        duplicateIds,
      );

      await this.softDeleteMergedUsers(
        connection,
        masterId,
        duplicateIds,
      );

      await connection.query(
        `INSERT INTO candidate_merge_audits (
          id,
          master_candidate_id,
          duplicate_candidate_ids,
          selected_field_sources,
          moved_record_counts,
          remarks,
          merged_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          masterId,
          JSON.stringify(duplicateIds),
          JSON.stringify(selectedFieldSources),
          JSON.stringify(movedRecordCounts),
          payload.remarks || null,
          adminUserId,
        ],
      );

      await connection.commit();
      return {
        master_candidate_id: masterId,
        duplicate_candidate_ids: duplicateIds,
        moved_record_counts: movedRecordCounts,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async mergeCourseEnrollments(connection, masterId, duplicateIds, remarks) {
    if (!(await hasTable("courses_enrollment"))) {
      return { moved: 0, soft_deleted_collisions: 0 };
    }

    const duplicatePlaceholders = duplicateIds.map(() => "?").join(",");
    const [masterRows] = await connection.query(
      "SELECT course_id FROM courses_enrollment WHERE candidate_id = ?",
      [masterId],
    );
    const masterCourseIds = masterRows.map((row) => row.course_id);
    let moved = 0;
    let softDeletedCollisions = 0;

    if (masterCourseIds.length > 0) {
      const coursePlaceholders = masterCourseIds.map(() => "?").join(",");
      const [collisionResult] = await connection.query(
        `UPDATE courses_enrollment
         SET status = 'Deleted', delete_remark = ?
         WHERE candidate_id IN (${duplicatePlaceholders})
           AND course_id IN (${coursePlaceholders})`,
        [mergeRemark(remarks), ...duplicateIds, ...masterCourseIds],
      );
      softDeletedCollisions = collisionResult.affectedRows || 0;

      const [moveResult] = await connection.query(
        `UPDATE courses_enrollment
         SET candidate_id = ?
         WHERE candidate_id IN (${duplicatePlaceholders})
           AND course_id NOT IN (${coursePlaceholders})`,
        [masterId, ...duplicateIds, ...masterCourseIds],
      );
      moved = moveResult.affectedRows || 0;
    } else {
      const [moveResult] = await connection.query(
        `UPDATE courses_enrollment
         SET candidate_id = ?
         WHERE candidate_id IN (${duplicatePlaceholders})`,
        [masterId, ...duplicateIds],
      );
      moved = moveResult.affectedRows || 0;
    }

    return { moved, soft_deleted_collisions: softDeletedCollisions };
  }

  static async updateCandidateReference(
    connection,
    tableName,
    columnName,
    masterId,
    duplicateIds,
  ) {
    if (!(await hasTable(tableName))) return 0;

    const placeholders = duplicateIds.map(() => "?").join(",");
    const [result] = await connection.query(
      `UPDATE \`${tableName}\`
       SET \`${columnName}\` = ?
       WHERE \`${columnName}\` IN (${placeholders})`,
      [masterId, ...duplicateIds],
    );
    return result.affectedRows || 0;
  }

  static async softDeleteMergedUsers(connection, masterId, duplicateIds) {
    const hasMergedIntoColumn = await hasColumn("users", "merged_into_user_id");
    const hasMergedAtColumn = await hasColumn("users", "merged_at");
    const placeholders = duplicateIds.map(() => "?").join(",");

    if (hasMergedIntoColumn && hasMergedAtColumn) {
      const [result] = await connection.query(
        `UPDATE users
         SET status = 0, merged_into_user_id = ?, merged_at = NOW()
         WHERE id IN (${placeholders})`,
        [masterId, ...duplicateIds],
      );
      return result.affectedRows || 0;
    }

    const [result] = await connection.query(
      `UPDATE users SET status = 0 WHERE id IN (${placeholders})`,
      duplicateIds,
    );
    return result.affectedRows || 0;
  }
}

module.exports = CandidateDao;



