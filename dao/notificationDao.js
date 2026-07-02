const db = require("../config/db");

class NotificationDao {
  static async getPendingReimbursementNotifications() {
    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.claim_number,
        r.status,
        r.created_at,
        r.updated_at,
        r.claim_date,
        r.amount,
        c.course_name AS active_course_name,
        CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) AS candidate_name,
        u.email AS candidate_email
      FROM reimbursements r
      LEFT JOIN users u ON u.id = r.candidate_id
      LEFT JOIN courses c ON c.id = r.active_course_id
      WHERE r.status IN ('submitted', 'resubmitted')
      ORDER BY r.updated_at DESC, r.created_at DESC
      `,
    );

    return rows.map((row) => ({
      id: row.id,
      sourceType: "candidate_reimbursement",
      title: row.claim_number || "Reimbursement Claim",
      message: `${row.candidate_name || row.candidate_email || "Candidate"} submitted a reimbursement claim${row.active_course_name ? ` for ${row.active_course_name}` : ""}.`,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      actionUrl: `/admin/reimbursements/${row.id}`,
      metadata: row,
    }));
  }

  static async getPendingCandidateApprovalNotifications() {
    const [rows] = await db.query(
      `
      SELECT
        ce.id,
        ce.course_id,
        ce.candidate_id,
        ce.created_at,
        ce.updated_at,
        ce.candidate_approval_status,
        ce.candidate_remark,
        ce.admin_approval_status,
        c.course_name,
        CONCAT_WS(' ', u.first_name, NULLIF(u.middle_name, ''), u.last_name) AS candidate_name,
        u.email AS candidate_email,
        COALESCE(NULLIF(CONCAT_WS(' ', n.first_name, n.last_name), ''), n.name, n.email) AS nominator_name
      FROM courses_enrollment ce
      INNER JOIN courses c ON c.id = ce.course_id
      INNER JOIN users u ON u.id = ce.candidate_id
      LEFT JOIN nominators n ON n.id = ce.nominator_id
      WHERE ce.candidate_approval_status IN ('Approved', 'Rejected')
        AND COALESCE(ce.admin_approval_status, 'Pending') = 'Pending'
      ORDER BY ce.updated_at DESC, ce.created_at DESC
      `,
    );

    return rows.map((row) => ({
      id: row.id,
      sourceType: "candidate_course_approval",
      title: row.course_name || "Candidate Approval",
      message: `${row.candidate_name || row.candidate_email || "Candidate"} responded ${row.candidate_approval_status.toLowerCase()} and is waiting for admin action.`,
      status: row.candidate_approval_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      actionUrl: `/pre-active-courses/${row.course_id}/approvals`,
      metadata: row,
    }));
  }

  static async getAdminNotifications() {
    const [reimbursements, candidateApprovals] = await Promise.all([
      this.getPendingReimbursementNotifications(),
      this.getPendingCandidateApprovalNotifications(),
    ]);

    const trainerRequests = [];
    const notifications = [
      ...reimbursements,
      ...candidateApprovals,
      ...trainerRequests,
    ].sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });

    return {
      summary: {
        totalPending: notifications.length,
        candidateReimbursements: reimbursements.length,
        candidateApprovals: candidateApprovals.length,
        trainerRequests: trainerRequests.length,
      },
      sections: {
        candidateReimbursements: reimbursements,
        candidateApprovals,
        trainerRequests,
      },
      notifications,
    };
  }
}

module.exports = NotificationDao;
