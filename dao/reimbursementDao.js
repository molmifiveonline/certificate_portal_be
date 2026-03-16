const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class ReimbursementDao {
  static async getCandidateReimbursements(candidateId, filters = {}) {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.max(Number(filters.limit) || 10, 1);
    const offset = (page - 1) * limit;

    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.claim_number,
        r.active_course_id,
        c.course_name AS active_course_name,
        r.claim_date,
        r.status,
        r.created_at,
        r.updated_at
      FROM reimbursements r
      LEFT JOIN courses c ON c.id = r.active_course_id
      WHERE r.candidate_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [candidateId, limit, offset],
    );

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM reimbursements WHERE candidate_id = ?`,
      [candidateId],
    );

    return {
      data: rows,
      total: countRows[0]?.total || 0,
      page,
      limit,
      totalPages: Math.ceil((countRows[0]?.total || 0) / limit) || 1,
    };
  }

  static async getAdminReimbursements(filters = {}) {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.max(Number(filters.limit) || 10, 1);
    const offset = (page - 1) * limit;
    const where = [];
    const params = [];

    if (filters.search) {
      where.push(
        `(r.claim_number LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ? OR c.course_name LIKE ?)`,
      );
      const search = `%${filters.search}%`;
      params.push(search, search, search);
    }

    if (filters.status) {
      where.push(`r.status = ?`);
      params.push(filters.status);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.claim_number,
        r.active_course_id,
        c.course_name AS active_course_name,
        r.claim_date,
        r.status,
        r.created_at,
        r.updated_at,
        CONCAT(u.first_name, ' ', u.last_name) AS candidate_name,
        u.email AS candidate_email
      FROM reimbursements r
      LEFT JOIN users u ON u.id = r.candidate_id
      LEFT JOIN courses c ON c.id = r.active_course_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset],
    );

    const [countRows] = await db.query(
      `
      SELECT COUNT(*) AS total
      FROM reimbursements r
      LEFT JOIN users u ON u.id = r.candidate_id
      LEFT JOIN courses c ON c.id = r.active_course_id
      ${whereClause}
      `,
      params,
    );

    return {
      data: rows,
      total: countRows[0]?.total || 0,
      page,
      limit,
      totalPages: Math.ceil((countRows[0]?.total || 0) / limit) || 1,
    };
  }

  static async getById(id) {
    const [rows] = await db.query(
      `
      SELECT
        r.*,
        CONCAT(u.first_name, ' ', u.last_name) AS candidate_name,
        u.email AS candidate_email,
        c.course_name AS active_course_name
      FROM reimbursements r
      LEFT JOIN users u ON u.id = r.candidate_id
      LEFT JOIN courses c ON c.id = r.active_course_id
      WHERE r.id = ?
      LIMIT 1
      `,
      [id],
    );

    if (!rows.length) {
      return null;
    }

    const reimbursement = rows[0];
    const [attachments] = await db.query(
      `
      SELECT id, reimbursement_id, file_name, file_path, file_url, mime_type, size, created_at
      FROM reimbursement_attachments
      WHERE reimbursement_id = ?
      ORDER BY created_at DESC
      `,
      [id],
    );

    reimbursement.attachments = attachments;
    return reimbursement;
  }

  static async candidateIsEnrolled(candidateId, activeCourseId) {
    const [rows] = await db.query(
      `
      SELECT id
      FROM courses_enrollment
      WHERE candidate_id = ? AND course_id = ? AND (status IS NULL OR status != 'Deleted')
      LIMIT 1
      `,
      [candidateId, activeCourseId],
    );
    return rows.length > 0;
  }

  static async create(payload, files = []) {
    const id = uuidv4();
    const claimNumber = await this.generateClaimNumber();

    await db.query(
      `
      INSERT INTO reimbursements (
        id,
        claim_number,
        candidate_id,
        active_course_id,
        claim_date,
        expense_category,
        expense_description,
        amount,
        payment_mode,
        bank_account_holder_name,
        bank_name,
        account_number,
        ifsc_code,
        candidate_notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        claimNumber,
        payload.candidate_id,
        payload.active_course_id,
        payload.claim_date,
        payload.expense_category,
        payload.expense_description,
        payload.amount,
        payload.payment_mode,
        payload.bank_account_holder_name || null,
        payload.bank_name || null,
        payload.account_number || null,
        payload.ifsc_code || null,
        payload.candidate_notes || null,
        payload.status || "draft",
      ],
    );

    if (files.length) {
      await this.insertAttachments(id, files);
    }

    return this.getById(id);
  }

  static async update(id, payload, files = []) {
    await db.query(
      `
      UPDATE reimbursements
      SET
        active_course_id = ?,
        claim_date = ?,
        expense_category = ?,
        expense_description = ?,
        amount = ?,
        payment_mode = ?,
        bank_account_holder_name = ?,
        bank_name = ?,
        account_number = ?,
        ifsc_code = ?,
        candidate_notes = ?
      WHERE id = ?
      `,
      [
        payload.active_course_id,
        payload.claim_date,
        payload.expense_category,
        payload.expense_description,
        payload.amount,
        payload.payment_mode,
        payload.bank_account_holder_name || null,
        payload.bank_name || null,
        payload.account_number || null,
        payload.ifsc_code || null,
        payload.candidate_notes || null,
        id,
      ],
    );

    if (files.length) {
      await this.insertAttachments(id, files);
    }

    return this.getById(id);
  }

  static async updateStatus(id, status) {
    await db.query(`UPDATE reimbursements SET status = ? WHERE id = ?`, [status, id]);
  }

  static async markApproved(id, remarks, approvedPdfUrl) {
    await db.query(
      `
      UPDATE reimbursements
      SET
        status = 'approved',
        admin_remarks = ?,
        approved_pdf_url = ?,
        accounts_email_sent_at = NOW()
      WHERE id = ?
      `,
      [remarks || null, approvedPdfUrl || null, id],
    );
  }

  static async markDisapproved(id, remarks) {
    await db.query(
      `
      UPDATE reimbursements
      SET
        status = 'disapproved',
        disapproval_remarks = ?
      WHERE id = ?
      `,
      [remarks || null, id],
    );
  }

  static async markResubmissionRequested(id, remarks) {
    await db.query(
      `
      UPDATE reimbursements
      SET
        status = 'resubmission_requested',
        resubmission_remarks = ?
      WHERE id = ?
      `,
      [remarks || null, id],
    );
  }

  static async createActivityLog(reimbursementId, action, remarks, userId, role) {
    await db.query(
      `
      INSERT INTO reimbursement_activity_logs (
        id,
        reimbursement_id,
        action,
        remarks,
        action_by,
        action_by_role
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [uuidv4(), reimbursementId, action, remarks || null, userId, role || null],
    );
  }

  static async insertAttachments(reimbursementId, files) {
    for (const file of files) {
      await db.query(
        `
        INSERT INTO reimbursement_attachments (
          id,
          reimbursement_id,
          file_name,
          file_path,
          file_url,
          mime_type,
          size
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          uuidv4(),
          reimbursementId,
          file.originalname,
          file.path,
          `/uploads/reimbursements/attachments/${file.filename}`,
          file.mimetype,
          file.size,
        ],
      );
    }
  }

  static async generateClaimNumber() {
    const [rows] = await db.query(
      `SELECT claim_number FROM reimbursements ORDER BY created_at DESC LIMIT 1`,
    );

    const lastClaim = rows[0]?.claim_number || "";
    const lastNumber = Number(String(lastClaim).split("-").pop()) || 0;
    return `RC-${String(lastNumber + 1).padStart(5, "0")}`;
  }
}

module.exports = ReimbursementDao;
