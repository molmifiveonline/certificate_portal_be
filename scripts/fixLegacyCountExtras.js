const mysql = require("mysql2/promise");
require("dotenv").config();

function parseArgs() {
  const apply = process.argv.includes("--apply");
  return { apply, dryRun: !apply };
}

function getTargetConfig() {
  return {
    host: process.env.TARGET_DB_HOST || process.env.DB_HOST,
    user: process.env.TARGET_DB_USER || process.env.DB_USER,
    password: process.env.TARGET_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.TARGET_DB_NAME || process.env.DB_NAME,
    port: Number(process.env.TARGET_DB_PORT || process.env.DB_PORT || 3306),
    dateStrings: true,
  };
}

function getLegacyConfig() {
  return {
    host: process.env.LEGACY_DB_HOST,
    user: process.env.LEGACY_DB_USER,
    password: process.env.LEGACY_DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME,
    port: Number(process.env.LEGACY_DB_PORT || 3306),
    dateStrings: true,
  };
}

function quoteId(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

async function createTemp(conn, table) {
  await conn.query(`DROP TEMPORARY TABLE IF EXISTS ${quoteId(table)}`);
  await conn.query(`
    CREATE TEMPORARY TABLE ${quoteId(table)} (
      id VARBINARY(255) NOT NULL PRIMARY KEY
    ) ENGINE=InnoDB
  `);
}

async function insertIds(conn, table, ids) {
  const unique = [...new Set(ids.filter(Boolean).map((id) => String(id)))];
  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    if (!batch.length) continue;
    await conn.query(
      `INSERT IGNORE INTO ${quoteId(table)} (id) VALUES ${batch.map(() => "(CAST(? AS BINARY))").join(",")}`,
      batch,
    );
  }
}

async function tempCount(conn, table) {
  const [[row]] = await conn.query(`SELECT COUNT(*) AS total FROM ${quoteId(table)}`);
  return Number(row.total || 0);
}

async function countWhere(conn, table, whereSql) {
  const [[row]] = await conn.query(
    `SELECT COUNT(*) AS total FROM ${quoteId(table)} WHERE ${whereSql}`,
  );
  return Number(row.total || 0);
}

async function deleteWhere(conn, report, table, whereSql, label) {
  const count = await countWhere(conn, table, whereSql);
  const op = { table, label, count, deleted: 0 };
  if (count && report.apply) {
    const [result] = await conn.query(`DELETE FROM ${quoteId(table)} WHERE ${whereSql}`);
    op.deleted = Number(result.affectedRows || 0);
  }
  report.operations.push(op);
}

async function updateWhere(conn, report, table, setSql, whereSql, label) {
  const count = await countWhere(conn, table, whereSql);
  const op = { table, label, count, updated: 0 };
  if (count && report.apply) {
    const [result] = await conn.query(
      `UPDATE ${quoteId(table)} SET ${setSql} WHERE ${whereSql}`,
    );
    op.updated = Number(result.affectedRows || 0);
  }
  report.operations.push(op);
}

async function one(conn, sql, params = []) {
  const [[row]] = await conn.query(sql, params);
  return Number(row.total || 0);
}

async function getLegacySets(legacy) {
  const [candidateRows] = await legacy.query("SELECT id FROM candidate");
  const [trainerRows] = await legacy.query("SELECT id FROM trainer");
  const [courseRows] = await legacy.query("SELECT id, status FROM course");

  const candidateIds = new Set(candidateRows.map((row) => String(row.id)));
  const trainerIds = new Set(trainerRows.map((row) => String(row.id)));
  const courseIds = new Set(courseRows.map((row) => String(row.id)));
  const inactiveCourseIds = new Set(
    courseRows
      .filter((row) => String(row.status) !== "1")
      .map((row) => String(row.id)),
  );

  return { candidateIds, trainerIds, courseIds, inactiveCourseIds };
}

async function buildTempSets(target, legacySets) {
  const tempTables = [
    "fix_candidate_users",
    "fix_trainer_users",
    "fix_courses",
    "fix_inactive_courses",
    "fix_enrollments",
    "fix_assessments",
    "fix_assessment_results",
    "fix_assessment_answers",
    "fix_feedback_answers",
    "fix_hotel_files",
    "fix_reimbursements",
    "fix_course_tokens",
    "fix_certificates",
  ];
  for (const table of tempTables) await createTemp(target, table);

  const [candidateMaps] = await target.query(
    "SELECT legacy_id, new_id FROM legacy_id_map WHERE entity_type = 'candidate'",
  );
  const obsoleteCandidateUserIds = candidateMaps
    .filter((row) => !legacySets.candidateIds.has(String(row.legacy_id)))
    .map((row) => row.new_id);

  const [nonLegacyCandidates] = await target.query(`
    SELECT u.id
    FROM candidate_profiles cp
    JOIN users u ON u.id = cp.user_id
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN legacy_id_map lim ON lim.entity_type = 'candidate' AND CAST(lim.new_id AS BINARY) = CAST(u.id AS BINARY)
    WHERE LOWER(r.name) = 'candidate' AND lim.new_id IS NULL
  `);

  await insertIds(target, "fix_candidate_users", [
    ...obsoleteCandidateUserIds,
    ...nonLegacyCandidates.map((row) => row.id),
  ]);

  const [trainerMaps] = await target.query(
    "SELECT legacy_id, new_id FROM legacy_id_map WHERE entity_type = 'trainer'",
  );
  const obsoleteTrainerUserIds = trainerMaps
    .filter((row) => !legacySets.trainerIds.has(String(row.legacy_id)))
    .map((row) => row.new_id);

  const [nonLegacyTrainerUsers] = await target.query(`
    SELECT u.id
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN legacy_id_map lim ON lim.entity_type = 'trainer' AND CAST(lim.new_id AS BINARY) = CAST(u.id AS BINARY)
    WHERE LOWER(r.name) = 'trainer'
      AND lim.new_id IS NULL
      AND u.admin_role_id IS NULL
  `);

  await insertIds(target, "fix_trainer_users", [
    ...obsoleteTrainerUserIds,
    ...nonLegacyTrainerUsers.map((row) => row.id),
  ]);

  const [courseMaps] = await target.query(`
    SELECT lim.legacy_id, lim.new_id, c.status, c.is_pre_active, c.is_outhouse
    FROM legacy_id_map lim
    JOIN courses c ON CAST(c.id AS BINARY) = CAST(lim.new_id AS BINARY)
    WHERE lim.entity_type = 'course'
  `);
  const obsoleteCourseIds = courseMaps
    .filter((row) => !legacySets.courseIds.has(String(row.legacy_id)))
    .map((row) => row.new_id);
  const inactiveVisibleCourseIds = courseMaps
    .filter(
      (row) =>
        legacySets.inactiveCourseIds.has(String(row.legacy_id)) &&
        row.status !== "Deleted" &&
        Number(row.is_pre_active || 0) === 0 &&
        Number(row.is_outhouse || 0) === 0,
    )
    .map((row) => row.new_id);

  const [nonLegacyCourses] = await target.query(`
    SELECT c.id
    FROM courses c
    LEFT JOIN legacy_id_map lim ON lim.entity_type = 'course' AND CAST(lim.new_id AS BINARY) = CAST(c.id AS BINARY)
    WHERE lim.new_id IS NULL
  `);

  await insertIds(target, "fix_courses", [
    ...obsoleteCourseIds,
    ...nonLegacyCourses.map((row) => row.id),
  ]);
  await insertIds(target, "fix_inactive_courses", inactiveVisibleCourseIds);

  await target.query(`
    INSERT IGNORE INTO fix_enrollments (id)
    SELECT CAST(ce.id AS BINARY)
    FROM courses_enrollment ce
    WHERE CAST(ce.course_id AS BINARY) IN (SELECT id FROM fix_courses)
      OR CAST(ce.candidate_id AS BINARY) IN (SELECT id FROM fix_candidate_users)
      OR CAST(ce.trainer_id AS BINARY) IN (SELECT id FROM fix_trainer_users)
  `);

  await target.query(`
    INSERT IGNORE INTO fix_assessments (id)
    SELECT CAST(a.id AS BINARY)
    FROM assessment a
    WHERE CAST(a.course_id AS BINARY) IN (SELECT id FROM fix_courses)
  `);

  await target.query(`
    INSERT IGNORE INTO fix_assessment_results (id)
    SELECT CAST(ar.id AS BINARY)
    FROM assessment_results ar
    WHERE CAST(ar.assessment_id AS BINARY) IN (SELECT id FROM fix_assessments)
      OR CAST(ar.course_id AS BINARY) IN (SELECT id FROM fix_courses)
      OR CAST(ar.candidate_id AS BINARY) IN (SELECT id FROM fix_candidate_users)
  `);

  await target.query(`
    INSERT IGNORE INTO fix_assessment_answers (id)
    SELECT CAST(aa.id AS BINARY)
    FROM assessment_answers aa
    WHERE CAST(aa.assessment_result_id AS BINARY) IN (SELECT id FROM fix_assessment_results)
  `);

  await target.query(`
    INSERT IGNORE INTO fix_feedback_answers (id)
    SELECT CAST(fqa.id AS BINARY)
    FROM feedback_question_answer fqa
    WHERE CAST(fqa.candidate_id AS BINARY) IN (SELECT id FROM fix_candidate_users)
      OR CAST(fqa.active_course_id AS BINARY) IN (SELECT id FROM fix_courses)
  `);

  await target.query(`
    INSERT IGNORE INTO fix_hotel_files (id)
    SELECT CAST(CAST(hf.id AS CHAR) AS BINARY)
    FROM hotel_files hf
    WHERE CAST(hf.ce_id AS BINARY) IN (SELECT id FROM fix_enrollments)
      OR CAST(hf.candidate_id AS BINARY) IN (SELECT id FROM fix_candidate_users)
  `);

  await target.query(`
    INSERT IGNORE INTO fix_reimbursements (id)
    SELECT CAST(r.id AS BINARY)
    FROM reimbursements r
    WHERE CAST(r.candidate_id AS BINARY) IN (SELECT id FROM fix_candidate_users)
      OR CAST(r.active_course_id AS BINARY) IN (SELECT id FROM fix_courses)
  `);

  await target.query(`
    INSERT IGNORE INTO fix_course_tokens (id)
    SELECT CAST(ct.id AS BINARY)
    FROM course_tokens ct
    WHERE CAST(ct.course_id AS BINARY) IN (SELECT id FROM fix_courses)
      OR CAST(ct.entity_id AS BINARY) IN (SELECT id FROM fix_candidate_users)
      OR CAST(ct.entity_id AS BINARY) IN (SELECT id FROM fix_trainer_users)
  `);

  await target.query(`
    INSERT IGNORE INTO fix_certificates (id)
    SELECT CAST(cert.id AS BINARY)
    FROM certificates cert
    WHERE CAST(cert.active_course_id AS BINARY) IN (SELECT id FROM fix_courses)
      OR CAST(cert.candidate_id AS BINARY) IN (SELECT id FROM fix_candidate_users)
      OR CAST(cert.trainer_id AS BINARY) IN (SELECT id FROM fix_trainer_users)
  `);

  const selection = {};
  for (const table of tempTables) selection[table.replace(/^fix_/, "")] = await tempCount(target, table);
  selection.obsoleteCandidateMaps = obsoleteCandidateUserIds.length;
  selection.nonLegacyCandidates = nonLegacyCandidates.length;
  selection.nonLegacyTrainerUsers = nonLegacyTrainerUsers.length;
  selection.nonLegacyCourses = nonLegacyCourses.length;
  selection.inactiveVisibleLegacyCourses = inactiveVisibleCourseIds.length;
  return selection;
}

async function rebuildCertificateSequences(target, report) {
  const count =
    (await one(
      target,
      `SELECT COUNT(*) AS total FROM (
        SELECT topic, YEAR(issue_date)
        FROM certificates
        WHERE type IN ('Others', 'DNV-ST0029', 'DNV-ST008')
          AND topic IS NOT NULL AND issue_date IS NOT NULL
        GROUP BY topic, YEAR(issue_date)
      ) x`,
    )) +
    (await one(
      target,
      `SELECT COUNT(*) AS total FROM (
        SELECT type
        FROM certificates
        WHERE type NOT IN ('Others', 'DNV-ST0029', 'DNV-ST008')
          AND type IS NOT NULL
        GROUP BY type
      ) x`,
    ));
  report.operations.push({ table: "certificate_sequences", label: "rebuild", count });
  if (!report.apply) return;
  await target.query("DELETE FROM certificate_sequences");
  await target.query(`
    INSERT INTO certificate_sequences (scope_type, scope_key, sequence_year, next_subid)
    SELECT 'topic_year', topic, YEAR(issue_date), COALESCE(MAX(subid), 0) + 1
    FROM certificates
    WHERE type IN ('Others', 'DNV-ST0029', 'DNV-ST008')
      AND topic IS NOT NULL
      AND issue_date IS NOT NULL
    GROUP BY topic, YEAR(issue_date)
  `);
  await target.query(`
    INSERT INTO certificate_sequences (scope_type, scope_key, sequence_year, next_subid)
    SELECT 'type', type, 0, COALESCE(MAX(subid), 0) + 1
    FROM certificates
    WHERE type NOT IN ('Others', 'DNV-ST0029', 'DNV-ST008')
      AND type IS NOT NULL
    GROUP BY type
    ON DUPLICATE KEY UPDATE next_subid = VALUES(next_subid)
  `);
}

async function runFix(target, report) {
  await deleteWhere(target, report, "reimbursement_activity_logs", "CAST(reimbursement_id AS BINARY) IN (SELECT id FROM fix_reimbursements)", "extra reimbursement logs");
  await deleteWhere(target, report, "reimbursement_attachments", "CAST(reimbursement_id AS BINARY) IN (SELECT id FROM fix_reimbursements)", "extra reimbursement attachments");
  await deleteWhere(target, report, "assessment_answers", "CAST(id AS BINARY) IN (SELECT id FROM fix_assessment_answers)", "extra assessment answers");
  await deleteWhere(target, report, "assessment_results", "CAST(id AS BINARY) IN (SELECT id FROM fix_assessment_results)", "extra assessment results");
  await deleteWhere(target, report, "feedback_question_answer", "CAST(id AS BINARY) IN (SELECT id FROM fix_feedback_answers)", "extra feedback answers");
  await deleteWhere(target, report, "hotel_files", "CAST(CAST(id AS CHAR) AS BINARY) IN (SELECT id FROM fix_hotel_files)", "extra hotel files");
  await deleteWhere(target, report, "course_attendance", "CAST(course_id AS BINARY) IN (SELECT id FROM fix_courses) OR CAST(candidate_id AS BINARY) IN (SELECT id FROM fix_candidate_users)", "extra attendance");
  await deleteWhere(target, report, "certificates", "CAST(id AS BINARY) IN (SELECT id FROM fix_certificates)", "extra certificates");
  await deleteWhere(target, report, "course_tokens", "CAST(id AS BINARY) IN (SELECT id FROM fix_course_tokens)", "extra course tokens");
  await deleteWhere(target, report, "reimbursements", "CAST(id AS BINARY) IN (SELECT id FROM fix_reimbursements)", "extra reimbursements");
  await deleteWhere(target, report, "courses_enrollment", "CAST(id AS BINARY) IN (SELECT id FROM fix_enrollments)", "extra enrollments");
  await deleteWhere(target, report, "assessment", "CAST(id AS BINARY) IN (SELECT id FROM fix_assessments)", "extra assessments");
  await updateWhere(target, report, "courses", "status = 'Deleted', updated_at = NOW()", "CAST(id AS BINARY) IN (SELECT id FROM fix_inactive_courses)", "hide legacy inactive courses");
  await deleteWhere(target, report, "courses", "CAST(id AS BINARY) IN (SELECT id FROM fix_courses)", "extra courses");
  await deleteWhere(target, report, "logs", "CAST(user_id AS BINARY) IN (SELECT id FROM fix_candidate_users) OR CAST(user_id AS BINARY) IN (SELECT id FROM fix_trainer_users)", "extra user logs");
  await deleteWhere(target, report, "user_otp_verifications", "CAST(user_id AS BINARY) IN (SELECT id FROM fix_candidate_users) OR CAST(user_id AS BINARY) IN (SELECT id FROM fix_trainer_users)", "extra user OTP rows");
  await deleteWhere(target, report, "candidate_profiles", "CAST(user_id AS BINARY) IN (SELECT id FROM fix_candidate_users)", "extra candidate profiles");
  await deleteWhere(target, report, "trainer_profiles", "CAST(user_id AS BINARY) IN (SELECT id FROM fix_trainer_users)", "extra trainer profiles");
  await deleteWhere(target, report, "users", "CAST(id AS BINARY) IN (SELECT id FROM fix_candidate_users) OR CAST(id AS BINARY) IN (SELECT id FROM fix_trainer_users)", "extra candidate/trainer users");
  await deleteWhere(
    target,
    report,
    "legacy_id_map",
    `CAST(new_id AS BINARY) IN (SELECT id FROM fix_candidate_users)
      OR CAST(new_id AS BINARY) IN (SELECT id FROM fix_trainer_users)
      OR CAST(new_id AS BINARY) IN (SELECT id FROM fix_courses)
      OR CAST(new_id AS BINARY) IN (SELECT id FROM fix_enrollments)
      OR CAST(new_id AS BINARY) IN (SELECT id FROM fix_assessment_results)
      OR CAST(new_id AS BINARY) IN (SELECT id FROM fix_assessment_answers)
      OR CAST(new_id AS BINARY) IN (SELECT id FROM fix_feedback_answers)
      OR CAST(new_id AS BINARY) IN (SELECT id FROM fix_certificates)
      OR CAST(CAST(new_id AS CHAR) AS BINARY) IN (SELECT id FROM fix_hotel_files)`,
    "legacy maps for removed rows",
  );
  await rebuildCertificateSequences(target, report);
}

async function finalCounts(legacy, target) {
  return {
    legacyCandidates: await one(legacy, "SELECT COUNT(*) AS total FROM candidate"),
    targetCandidateProfiles: await one(target, "SELECT COUNT(*) AS total FROM candidate_profiles"),
    legacyActiveCourses: await one(legacy, "SELECT COUNT(*) AS total FROM course WHERE status = 1"),
    targetActiveCourses: await one(
      target,
      "SELECT COUNT(*) AS total FROM courses WHERE status != 'Deleted' AND COALESCE(is_pre_active,0)=0 AND COALESCE(is_outhouse,0)=0",
    ),
    legacyTrainers: await one(legacy, "SELECT COUNT(*) AS total FROM trainer"),
    targetTrainerProfiles: await one(target, "SELECT COUNT(*) AS total FROM trainer_profiles"),
  };
}

async function main() {
  const args = parseArgs();
  const legacy = await mysql.createConnection(getLegacyConfig());
  const target = await mysql.createConnection(getTargetConfig());
  const report = {
    mode: args.apply ? "apply" : "dry-run",
    apply: args.apply,
    selection: {},
    operations: [],
    before: {},
    after: {},
  };

  try {
    report.before = await finalCounts(legacy, target);
    report.selection = await buildTempSets(target, await getLegacySets(legacy));
    if (args.apply) await target.beginTransaction();
    try {
      await runFix(target, report);
      if (args.apply) await target.commit();
    } catch (error) {
      if (args.apply) await target.rollback();
      throw error;
    }
    report.after = await finalCounts(legacy, target);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await legacy.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
