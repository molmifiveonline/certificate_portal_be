const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const { v4: uuidv4, v5: uuidv5 } = require("uuid");
require("dotenv").config();

const UUID_NAMESPACE =
  process.env.LEGACY_UUID_NAMESPACE || "7dd9fb68-23dc-55d9-8b8a-9ae4a47d5551";
const REPORT_DIR = path.join(__dirname, "..", "generated");
const DEFAULT_PASSWORD_HASH_ROUNDS = 10;

const ENTITY = {
  candidate: "candidate",
  trainer: "trainer",
  masterCourse: "master_course",
  course: "course",
  enrollment: "courses_enrollment",
  certificate: "certificate",
  question: "question_bank",
  assessment: "assessment",
  assessmentResult: "assessment_result",
  assessmentAnswer: "assessment_answer",
  feedbackCategory: "feedback_category",
  feedbackForm: "feedback",
  feedbackQuestion: "feedback_question",
  feedbackOption: "feedback_question_option",
  feedbackAnswer: "feedback_question_answer",
  hotelFile: "hotel_file",
  hotelDetail: "hotel_detail",
  role: "role",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const resumeFromArg = args.find((arg) => arg.startsWith("--resume-from="));
  const mode = args.includes("--reset-imported")
      ? "reset-imported"
      : args.includes("--copy-files-only")
        ? "copy-files-only"
        : args.includes("--apply")
          ? "apply"
          : "dry-run";

  return {
    mode,
    dryRun:
      args.includes("--dry-run") ||
      (mode !== "apply" && mode !== "reset-imported" && mode !== "copy-files-only"),
    reset: mode === "reset-imported",
    resumeFrom: resumeFromArg ? resumeFromArg.split("=")[1] : null,
  };
}

function getEnv(name, fallback) {
  return process.env[name] || fallback;
}

function getDbConfig(prefix, fallbackToDefault = false) {
  const fallbackPrefix = fallbackToDefault ? "DB" : prefix;
  return {
    host: getEnv(`${prefix}_HOST`, getEnv(`${fallbackPrefix}_HOST`, undefined)),
    user: getEnv(`${prefix}_USER`, getEnv(`${fallbackPrefix}_USER`, undefined)),
    password: getEnv(
      `${prefix}_PASSWORD`,
      getEnv(`${fallbackPrefix}_PASSWORD`, undefined),
    ),
    database: getEnv(`${prefix}_NAME`, getEnv(`${fallbackPrefix}_NAME`, undefined)),
    port: Number(getEnv(`${prefix}_PORT`, getEnv(`${fallbackPrefix}_PORT`, 3306))),
    multipleStatements: false,
    dateStrings: true,
  };
}

function assertConfig(config, label) {
  const missing = Object.entries(config)
    .filter(([key, value]) => key !== "password" && (value === undefined || value === ""))
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`${label} database config missing: ${missing.join(", ")}`);
  }
}

function legacyUuid(entityType, legacyId) {
  return uuidv5(`${entityType}:${legacyId}`, UUID_NAMESPACE);
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function normalizeStatus(value, activeWords = ["active", "1"]) {
  if (value === undefined || value === null) return 1;
  const normalized = String(value).trim().toLowerCase();
  return activeWords.includes(normalized) ? 1 : 0;
}

function dateOrNull(value) {
  const text = normalizeText(value);
  if (!text || text === "0000-00-00" || text.startsWith("0000-00-00")) return null;
  return text.slice(0, 10);
}

function dateTimeOrNull(value) {
  const text = normalizeText(value);
  if (!text || text === "0000-00-00 00:00:00") return null;
  return text;
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Legacy", lastName: "Trainer" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function registrationType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "MOLMI_EMPLOYEE" || normalized === "MOLMI EMPLOYEE") {
    return "MOLMI Employee";
  }
  return "Others";
}

function courseDisplayName(row) {
  const courseId = normalizeText(row.course_id);
  const courseName = normalizeText(row.course_name);
  if (!courseId) return courseName || `Legacy Course ${row.id}`;
  if (!courseName) return courseId;

  const idMatch = courseId.match(/^([A-Z]+)-(\d{4})-(\d+)$/i);
  const nameMatch = courseName.match(/^([A-Z]+)-(\d{4})-(\d+)$/i);
  if (idMatch && nameMatch) {
    const sameFamily =
      idMatch[1].toUpperCase() === nameMatch[1].toUpperCase() ||
      (idMatch[1].toUpperCase() === "HAZM" &&
        nameMatch[1].toUpperCase() === "HAZMAT");
    const sameYear = idMatch[2] === nameMatch[2];
    const sameNumber = Number(idMatch[3]) === Number(nameMatch[3]);
    if (sameFamily && sameYear && !sameNumber) return courseId;
  }

  return courseName;
}

function sanitizeFileName(name) {
  const baseName = path.basename(String(name || "").replace(/\\/g, "/"));
  return baseName
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 180);
}

function makeFileStats() {
  return {
    copied: 0,
    skipped: 0,
    missing: 0,
    invalid: 0,
    samples: [],
  };
}

function noteFile(stats, status, detail) {
  stats[status] += 1;
  if (stats.samples.length < 100) {
    stats.samples.push({ status, ...detail });
  }
}

class MigrationContext {
  constructor({ legacy, target, dryRun, mode, resumeFrom }) {
    this.legacy = legacy;
    this.target = target;
    this.dryRun = dryRun;
    this.mode = mode;
    this.resumeFrom = resumeFrom;
    this.columnCache = new Map();
    this.legacyTableCache = new Map();
    this.mappedIdCache = new Map();
    this.fileIndex = null;
    this.oldUploadRoot = process.env.OLD_UPLOAD_ROOT || "";
    this.fileMode = process.env.MIGRATION_FILE_MODE || "copy";
    this.summary = {
      mode,
      resume_from: resumeFrom,
      started_at: new Date().toISOString(),
      counts: {},
      skipped: {},
      warnings: [],
      files: makeFileStats(),
    };
  }

  async targetColumns(tableName) {
    if (this.columnCache.has(tableName)) return this.columnCache.get(tableName);
    const [rows] = await this.target.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const columns = new Map(rows.map((row) => [row.Field, row]));
    this.columnCache.set(tableName, columns);
    return columns;
  }

  async targetHasColumn(tableName, columnName) {
    const columns = await this.targetColumns(tableName);
    return columns.has(columnName);
  }

  async isTextColumn(tableName, columnName) {
    const columns = await this.targetColumns(tableName);
    const column = columns.get(columnName);
    return Boolean(column && /char|text|varchar/i.test(column.Type));
  }

  async legacyHasTable(tableName) {
    if (this.legacyTableCache.has(tableName)) {
      return this.legacyTableCache.get(tableName);
    }
    const [rows] = await this.legacy.query("SHOW TABLES LIKE ?", [tableName]);
    const exists = rows.length > 0;
    this.legacyTableCache.set(tableName, exists);
    return exists;
  }

  async countLegacy(tableName) {
    if (!(await this.legacyHasTable(tableName))) return 0;
    const [rows] = await this.legacy.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
    return rows[0].total || 0;
  }

  async selectLegacy(tableName, orderBy = "id") {
    if (!(await this.legacyHasTable(tableName))) {
      this.summary.warnings.push(`Legacy table not found: ${tableName}`);
      return [];
    }
    const [rows] = await this.legacy.query(
      `SELECT * FROM \`${tableName}\` ORDER BY \`${orderBy}\``,
    );
    return rows;
  }

  increment(key, amount = 1) {
    this.summary.counts[key] = (this.summary.counts[key] || 0) + amount;
  }

  skip(key, amount = 1) {
    this.summary.skipped[key] = (this.summary.skipped[key] || 0) + amount;
  }

  async upsert(tableName, row, map = null) {
    const columns = await this.targetColumns(tableName);
    const filtered = Object.entries(row).filter(([key, value]) => {
      if (value === undefined || !columns.has(key)) return false;
      const column = columns.get(key);
      if (value === null && column.Null === "NO" && column.Default !== null) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) return;
    if (this.dryRun) return;

    const names = filtered.map(([key]) => key);
    const values = filtered.map(([, value]) => value);
    const placeholders = names.map(() => "?").join(", ");
    const updates = names
      .filter((name) => name !== "id")
      .map((name) => `\`${name}\` = VALUES(\`${name}\`)`);

    await this.target.execute(
      `INSERT INTO \`${tableName}\` (${names.map((name) => `\`${name}\``).join(", ")})
       VALUES (${placeholders})
       ON DUPLICATE KEY UPDATE ${updates.length ? updates.join(", ") : "`id` = `id`"}`,
      values,
    );

    if (map) await this.mapLegacyId(map.entityType, map.legacyId, map.newId);
  }

  async mapLegacyId(entityType, legacyId, newId) {
    if (this.dryRun || legacyId === undefined || legacyId === null || !newId) return;
    await this.target.execute(
      `INSERT INTO legacy_id_map (entity_type, legacy_id, new_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE new_id = VALUES(new_id)`,
      [entityType, String(legacyId), String(newId)],
    );
  }

  async mappedLegacyIds(entityType) {
    if (this.mappedIdCache.has(entityType)) return this.mappedIdCache.get(entityType);
    if (this.dryRun) {
      this.mappedIdCache.set(entityType, new Set());
      return this.mappedIdCache.get(entityType);
    }

    const [rows] = await this.target.query(
      "SELECT legacy_id FROM legacy_id_map WHERE entity_type = ?",
      [entityType],
    );
    const ids = new Set(rows.map((row) => String(row.legacy_id)));
    this.mappedIdCache.set(entityType, ids);
    return ids;
  }

  async upsertMany(tableName, rows, maps = [], batchSize = 500) {
    if (rows.length === 0) return;

    const columns = await this.targetColumns(tableName);
    const names = Object.keys(rows[0]).filter((key) => {
      if (!columns.has(key)) return false;
      const column = columns.get(key);
      const allRowsUseDefault = rows.every(
        (row) =>
          (row[key] === null || row[key] === undefined) &&
          column.Null === "NO" &&
          column.Default !== null,
      );
      return !allRowsUseDefault;
    });

    if (names.length === 0 || this.dryRun) return;

    const updates = names
      .filter((name) => name !== "id")
      .map((name) => `\`${name}\` = VALUES(\`${name}\`)`);
    const columnSql = names.map((name) => `\`${name}\``).join(", ");
    const rowPlaceholder = `(${names.map(() => "?").join(", ")})`;

    for (let index = 0; index < rows.length; index += batchSize) {
      const batch = rows.slice(index, index + batchSize);
      const placeholders = batch.map(() => rowPlaceholder).join(", ");
      const values = batch.flatMap((row) => names.map((name) => row[name] ?? null));

      await this.target.execute(
        `INSERT INTO \`${tableName}\` (${columnSql})
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE ${updates.length ? updates.join(", ") : "`id` = `id`"}`,
        values,
      );

      const mapBatch = maps.slice(index, index + batchSize).filter(Boolean);
      if (mapBatch.length) {
        const mapPlaceholders = mapBatch.map(() => "(?, ?, ?)").join(", ");
        const mapValues = mapBatch.flatMap((map) => [
          map.entityType,
          String(map.legacyId),
          String(map.newId),
        ]);
        await this.target.execute(
          `INSERT INTO legacy_id_map (entity_type, legacy_id, new_id)
           VALUES ${mapPlaceholders}
           ON DUPLICATE KEY UPDATE new_id = VALUES(new_id)`,
          mapValues,
        );
      }
    }
  }

  buildFileIndex() {
    if (this.fileIndex) return this.fileIndex;
    this.fileIndex = new Map();

    if (!this.oldUploadRoot) return this.fileIndex;
    if (!fs.existsSync(this.oldUploadRoot)) {
      this.summary.warnings.push(`OLD_UPLOAD_ROOT does not exist: ${this.oldUploadRoot}`);
      return this.fileIndex;
    }

    const stack = [this.oldUploadRoot];
    while (stack.length) {
      const current = stack.pop();
      let entries = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else {
          this.fileIndex.set(entry.name.toLowerCase(), fullPath);
        }
      }
    }

    return this.fileIndex;
  }

  findLegacyFile(value) {
    const text = normalizeText(value);
    if (!text) return null;

    const normalized = text.replace(/\\/g, "/");
    if (path.isAbsolute(normalized) && fs.existsSync(normalized)) return normalized;

    if (this.oldUploadRoot) {
      const joined = path.join(this.oldUploadRoot, normalized);
      if (fs.existsSync(joined)) return joined;
    }

    const fileIndex = this.buildFileIndex();
    return fileIndex.get(path.basename(normalized).toLowerCase()) || null;
  }

  copyLegacyFile(value, destinationDir, storedPrefix, filePrefix) {
    const text = normalizeText(value);
    if (!text) {
      noteFile(this.summary.files, "skipped", { source: value, reason: "empty" });
      return null;
    }

    const sourceName = sanitizeFileName(text);
    if (!sourceName) {
      noteFile(this.summary.files, "invalid", { source: text, reason: "invalid name" });
      return null;
    }

    const targetName = `${filePrefix}-${sourceName}`;
    const targetPath = path.join(__dirname, "..", destinationDir, targetName);
    const storedValue = storedPrefix ? `${storedPrefix}/${targetName}` : targetName;

    if (!this.oldUploadRoot) {
      noteFile(this.summary.files, "skipped", {
        source: text,
        target: storedValue,
        reason: "OLD_UPLOAD_ROOT not set",
      });
      return storedValue;
    }

    const sourcePath = this.findLegacyFile(text);
    if (!sourcePath) {
      noteFile(this.summary.files, "missing", { source: text, target: storedValue });
      return storedValue;
    }

    if (this.dryRun || this.fileMode !== "copy") {
      noteFile(this.summary.files, "skipped", {
        source: sourcePath,
        target: storedValue,
        reason: this.dryRun ? "dry-run" : "copy disabled",
      });
      return storedValue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
    noteFile(this.summary.files, "copied", { source: sourcePath, target: storedValue });
    return storedValue;
  }
}

async function createConnections() {
  const legacyConfig = getDbConfig("LEGACY_DB");
  const targetConfig = getDbConfig("TARGET_DB", true);
  assertConfig(legacyConfig, "LEGACY_DB");
  assertConfig(targetConfig, "TARGET_DB");

  return {
    legacy: await mysql.createConnection(legacyConfig),
    target: await mysql.createConnection(targetConfig),
  };
}

async function ensureSupportTables(ctx) {
  if (ctx.dryRun) return;
  await ctx.target.execute(`
    CREATE TABLE IF NOT EXISTS legacy_id_map (
      entity_type VARCHAR(100) NOT NULL,
      legacy_id VARCHAR(100) NOT NULL,
      new_id VARCHAR(100) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_type, legacy_id),
      KEY legacy_id_map_new_id_idx (new_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  await ctx.target.execute(`
    CREATE TABLE IF NOT EXISTS legacy_migration_runs (
      id CHAR(36) NOT NULL,
      mode VARCHAR(50) NOT NULL,
      started_at DATETIME NOT NULL,
      finished_at DATETIME NULL,
      status VARCHAR(50) NOT NULL,
      summary_json JSON NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  await ctx.target.execute(`
    CREATE TABLE IF NOT EXISTS certificate_sequences (
      scope_type VARCHAR(50) NOT NULL,
      scope_key VARCHAR(255) NOT NULL,
      sequence_year INT NOT NULL DEFAULT 0,
      next_subid INT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (scope_type, scope_key, sequence_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

async function resetImported(ctx) {
  await ensureSupportTables(ctx);
  if (ctx.dryRun) return;

  await ctx.target.execute("SET FOREIGN_KEY_CHECKS = 0");
  try {
    const deletionOrder = [
      ["feedback_question_answer", ENTITY.feedbackAnswer],
      ["feedback_question_options", ENTITY.feedbackOption],
      ["feedback_questions", ENTITY.feedbackQuestion],
      ["feedback_forms", ENTITY.feedbackForm],
      ["feedback_categories", ENTITY.feedbackCategory],
      ["assessment_answers", ENTITY.assessmentAnswer],
      ["assessment_results", ENTITY.assessmentResult],
      ["assessment", ENTITY.assessment],
      ["question_bank", ENTITY.question],
      ["certificates", ENTITY.certificate],
      ["hotel_files", ENTITY.hotelFile],
      ["hotel_details", ENTITY.hotelDetail],
      ["courses_enrollment", ENTITY.enrollment],
      ["courses", ENTITY.course],
      ["master_course", ENTITY.masterCourse],
      ["trainer_profiles", ENTITY.trainer],
      ["candidate_profiles", ENTITY.candidate],
      ["users", ENTITY.trainer],
      ["users", ENTITY.candidate],
    ];

    for (const [tableName, entityType] of deletionOrder) {
      if (tableName === "hotel_files") {
        await ctx.target.execute(
          "DELETE FROM hotel_files WHERE file_name LIKE 'hotel-file-%'",
        );
        continue;
      }

      const idColumn =
        tableName === "trainer_profiles" || tableName === "candidate_profiles"
          ? "user_id"
          : "id";
      await ctx.target.execute(
        `DELETE target
         FROM \`${tableName}\` target
         JOIN legacy_id_map lim
           ON lim.entity_type = ? AND lim.new_id = target.\`${idColumn}\``,
        [entityType],
      );
    }

    await ctx.target.execute("DELETE FROM certificate_sequences");
    await ctx.target.execute("DELETE FROM legacy_id_map");
  } finally {
    await ctx.target.execute("SET FOREIGN_KEY_CHECKS = 1");
  }
}

async function seedRoles(ctx) {
  const roles = [
    { legacy: "candidate", name: "candidate" },
    { legacy: "trainer", name: "trainer" },
  ];

  for (const role of roles) {
    const id = legacyUuid(ENTITY.role, role.legacy);
    await ctx.upsert(
      "roles",
      {
        id,
        name: role.name,
        status: 1,
      },
      { entityType: ENTITY.role, legacyId: role.legacy, newId: id },
    );
    ctx.increment("roles");
  }
}

async function roleId(ctx, roleName) {
  const [rows] = await ctx.target.query("SELECT id FROM roles WHERE name = ? LIMIT 1", [
    roleName,
  ]);
  if (rows[0]?.id) return rows[0].id;
  return legacyUuid(ENTITY.role, roleName);
}

async function importMasterCourses(ctx) {
  const rows = await ctx.selectLegacy("master_course");
  for (const row of rows) {
    const id = legacyUuid(ENTITY.masterCourse, row.id);
    await ctx.upsert(
      "master_course",
      {
        id,
        topic: row.topic || "UNKNOWN",
        master_course_name: row.master_course_name || row.topic || "Legacy Course",
        certificate_type: row.certificate_type || null,
        expiry_date: row.expiry_date || null,
        description: row.description || null,
        remarks: row.remark || null,
        status: normalizeStatus(row.status),
        created_at: dateTimeOrNull(row.created_at),
        updated_at: dateTimeOrNull(row.updated_at),
      },
      { entityType: ENTITY.masterCourse, legacyId: row.id, newId: id },
    );
    ctx.increment("master_course");
  }
  return new Map(rows.map((row) => [String(row.id), row]));
}

async function importCandidates(ctx) {
  const candidateRoleId = await roleId(ctx, "candidate");
  const rows = await ctx.selectLegacy("candidate");
  const passwordHash = await bcrypt.hash(
    process.env.LEGACY_TEMP_PASSWORD || uuidv4(),
    DEFAULT_PASSWORD_HASH_ROUNDS,
  );

  for (const row of rows) {
    const userId = legacyUuid(ENTITY.candidate, row.id);
    const profileId = legacyUuid("candidate_profile", row.id);
    const firstName = normalizeText(row.first_name) || normalizeText(row.candidate_name) || "Legacy";
    const lastName = normalizeText(row.last_name) || "";
    const email =
      normalizeText(row.email) || `legacy-candidate-${row.id}@migration.local`;
    const profileImage = ctx.copyLegacyFile(
      row.profile_image,
      "uploads/candidate-profiles",
      "/uploads/candidate-profiles",
      `candidate-${row.id}`,
    );

    await ctx.upsert(
      "users",
      {
        id: userId,
        prefix: row.prefix || null,
        role_id: candidateRoleId,
        user_type: registrationType(row.registration_type),
        first_name: firstName,
        middle_name: row.middle_name || null,
        last_name: lastName,
        gender: row.gender || null,
        email,
        password: passwordHash,
        mobile: row.mobile || null,
        alternate_mobile: row.mobile_1 || null,
        status: normalizeStatus(row.is_active),
        created_at: dateTimeOrNull(row.created_at),
        updated_at: dateTimeOrNull(row.updated_at),
      },
      { entityType: ENTITY.candidate, legacyId: row.id, newId: userId },
    );

    await ctx.upsert("candidate_profiles", {
      id: profileId,
      user_id: userId,
      prefix: row.prefix || null,
      middle_name: row.middle_name || null,
      dob: dateOrNull(row.dob),
      gender: row.gender || null,
      nationality: row.nationality || null,
      passport_no: row.cdc_passport || null,
      designation: row.designation || row.position || null,
      profile_image: profileImage,
      indos_number: row.indos_no || null,
      employee_id: row.empId || row.employee_id_api || null,
      manager: row.manager || null,
      rank: row.rank || row.position || null,
      whatsapp_number: row.whatsapp || null,
      alternate_mobile: row.alternate_mobile || row.mobile_1 || null,
      registration_type: registrationType(row.registration_type),
      vessel_type: row.vessel_type || null,
      last_vessel_name: row.vessel_name || null,
      manning_company: row.manning_company || null,
      sign_on_date: dateOrNull(row.sign_on),
      sign_off_date: dateOrNull(row.sign_off),
      officer: row.officer || null,
      seaman_book_no: row.seaman_book_no || null,
    });
    ctx.increment("candidate");
  }
}

async function importTrainers(ctx) {
  const trainerRoleId = await roleId(ctx, "trainer");
  const rows = await ctx.selectLegacy("trainer");
  const emailCounts = rows.reduce((counts, row) => {
    const email = normalizeText(row.email)?.toLowerCase();
    if (email) counts.set(email, (counts.get(email) || 0) + 1);
    return counts;
  }, new Map());
  const passwordHash = await bcrypt.hash(
    process.env.LEGACY_TEMP_PASSWORD || uuidv4(),
    DEFAULT_PASSWORD_HASH_ROUNDS,
  );

  for (const row of rows) {
    const userId = legacyUuid(ENTITY.trainer, row.id);
    const profileId = legacyUuid("trainer_profile", row.id);
    const { firstName, lastName } = splitName(row.trainer_name);
    const signature = ctx.copyLegacyFile(
      row.digital_signature,
      "uploads/trainer",
      "",
      `trainer-signature-${row.id}`,
    );
    const photo = ctx.copyLegacyFile(
      row.profile_photo,
      "uploads/trainer",
      "",
      `trainer-photo-${row.id}`,
    );

    const trainerEmail = normalizeText(row.email);
    const safeTrainerEmail =
      trainerEmail && emailCounts.get(trainerEmail.toLowerCase()) === 1
        ? trainerEmail
        : `legacy-trainer-${row.id}@migration.local`;

    await ctx.upsert(
      "users",
      {
        id: userId,
        prefix: row.prefix || null,
        role_id: trainerRoleId,
        first_name: firstName,
        last_name: lastName,
        email: safeTrainerEmail,
        password: passwordHash,
        status: normalizeStatus(row.status),
      },
      { entityType: ENTITY.trainer, legacyId: row.id, newId: userId },
    );

    await ctx.upsert("trainer_profiles", {
      id: profileId,
      user_id: userId,
      rank: row.rank || null,
      digital_signature: signature,
      profile_photo: photo,
      prefix: row.prefix || null,
      officer: row.officer || null,
      other_officer: row.other_officer || null,
      designation: row.designation || null,
      nationality: row.nationality || null,
      status: normalizeStatus(row.status),
    });
    ctx.increment("trainer");
  }
}

function mapTrainerList(value) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => legacyUuid(ENTITY.trainer, id))
    .join(",");
}

async function importCourses(ctx, masterCourses) {
  const rows = await ctx.selectLegacy("course");
  for (const row of rows) {
    const id = legacyUuid(ENTITY.course, row.id);
    const master = masterCourses.get(String(row.master_course_name || row.topic));
    const masterId = legacyUuid(
      ENTITY.masterCourse,
      row.master_course_name || row.topic,
    );
    const typeOfLocation = row.type_of_location || null;

    await ctx.upsert(
      "courses",
      {
        id,
        course_id: row.course_id || `LEGACY-${row.id}`,
        master_course_id: masterId,
        master_course_name: master?.master_course_name || row.course_name || "Legacy Course",
        topic: master?.topic || row.topic || "UNKNOWN",
        course_name: courseDisplayName(row),
        description: row.description1 || null,
        start_date: dateTimeOrNull(row.start_date),
        end_date: dateTimeOrNull(row.end_date),
        type_of_location: typeOfLocation,
        other_location: row.other_location || null,
        course_type: row.type_of_course || null,
        remarks: row.remarks || null,
        status: row.type_of_status || (normalizeStatus(row.status) ? "Initiated" : "Deleted"),
        course_level: row.course_level || null,
        primary_trainer_id: row.primary_trainer_id
          ? legacyUuid(ENTITY.trainer, row.primary_trainer_id)
          : null,
        secondary_trainer_ids: mapTrainerList(row.secondary_trainer_id),
        whatsapp_link: row.whatsapp_group_link || null,
        zoom_link: row.zoom_link || null,
        no_of_days: row.no_of_days || null,
        cancelation_reason: row.cancelation_reason || null,
        completion_reason: row.completion_reason || null,
        trainer_evaluation: row.trainer_evaluation || null,
        created_at: dateTimeOrNull(row.created_at),
        updated_at: dateTimeOrNull(row.updated_at),
      },
      { entityType: ENTITY.course, legacyId: row.id, newId: id },
    );
    ctx.increment("course");
  }
}

async function importEnrollments(ctx) {
  const rows = await ctx.selectLegacy("courses_enrollment");
  for (const row of rows) {
    const id = legacyUuid(ENTITY.enrollment, row.id);
    await ctx.upsert(
      "courses_enrollment",
      {
        id,
        course_id: legacyUuid(ENTITY.course, row.course_id),
        candidate_id: legacyUuid(ENTITY.candidate, row.candidate_id),
        trainer_id: row.trainer_id ? legacyUuid(ENTITY.trainer, row.trainer_id) : null,
        venue_name: row.venue_name || null,
        venue_address: row.venue_address || null,
        venue_contact: row.venue_contact || null,
        venue_map_link: row.venue_map_link || null,
        certficate_generated: row.certificate_id
          ? legacyUuid(ENTITY.certificate, row.certificate_id)
          : null,
        candidate_email_status: Number(row.candidate_email_status || 0),
        email_type: row.email_type || null,
        remarks: row.remarks || null,
        status: row.status || "Active",
        status_pool: row.status_pool || null,
        created_at: dateTimeOrNull(row.created_at),
        updated_at: dateTimeOrNull(row.updated_at),
      },
      { entityType: ENTITY.enrollment, legacyId: row.id, newId: id },
    );
    ctx.increment("courses_enrollment");
  }
}

async function importHotelFiles(ctx) {
  const rows = await ctx.selectLegacy("hotel_files");
  if (rows.length === 0) return;

  const idIsText = await ctx.isTextColumn("hotel_files", "id");
  const ceIsText = await ctx.isTextColumn("hotel_files", "ce_id");
  const candidateIsText = await ctx.isTextColumn("hotel_files", "candidate_id");

  for (const row of rows) {
    const copiedName = ctx.copyLegacyFile(
      row.file_name,
      "uploads/venues",
      "",
      `hotel-file-${row.id}`,
    );
    const newId = legacyUuid(ENTITY.hotelFile, row.id);
    await ctx.upsert(
      "hotel_files",
      {
        id: idIsText ? newId : undefined,
        ce_id: ceIsText ? legacyUuid(ENTITY.enrollment, row.ce_id) : row.ce_id,
        candidate_id: candidateIsText
          ? legacyUuid(ENTITY.candidate, row.candidate_id)
          : row.candidate_id,
        file_name: copiedName,
        file_type: row.file_type || null,
        uploaded_at: dateTimeOrNull(row.uploaded_at),
        status: row.status === undefined ? 1 : row.status,
      },
      idIsText ? { entityType: ENTITY.hotelFile, legacyId: row.id, newId } : null,
    );
    ctx.increment("hotel_files");
  }
}

async function importHotelDetails(ctx) {
  const rows = await ctx.selectLegacy("hotel_details");
  for (const row of rows) {
    const id = legacyUuid(ENTITY.hotelDetail, row.id);
    await ctx.upsert(
      "hotel_details",
      {
        id,
        venue_name: row.venue_name || `Legacy Hotel ${row.id}`,
        venue_address: row.venue_address || "",
        venue_contact: row.venue_contact || null,
        venue_map_link: row.venue_map_link || null,
        email: row.email || row.email1 || null,
        status: normalizeStatus(row.status),
        created_at: dateTimeOrNull(row.created_at),
        updated_at: dateTimeOrNull(row.updated_at),
      },
      { entityType: ENTITY.hotelDetail, legacyId: row.id, newId: id },
    );
    ctx.increment("hotel_details");
  }
}

async function importCertificates(ctx) {
  const rows = await ctx.selectLegacy("certificate");
  for (const row of rows) {
    const id = legacyUuid(ENTITY.certificate, row.id);
    await ctx.upsert(
      "certificates",
      {
        id,
        certificate_no: String(row.certificate_no || "").trim(),
        type: row.type || "Others",
        topic: row.topic || "UNKNOWN",
        course_level: row.course_level || "Operational",
        course_id: legacyUuid(ENTITY.masterCourse, row.course_id),
        active_course_id: row.active_course_id
          ? legacyUuid(ENTITY.course, row.active_course_id)
          : null,
        candidate_id: legacyUuid(ENTITY.candidate, row.candidate_id),
        trainer_id: row.trainer_id ? legacyUuid(ENTITY.trainer, row.trainer_id) : null,
        location: row.location || null,
        course_conduct: row.course_conduct || null,
        status: row.status || 0,
        from_date: dateOrNull(row.from_date),
        to_date: dateOrNull(row.to_date),
        days: Number(row.days || 0),
        issue_date: dateOrNull(row.issue_date),
        added_date: dateOrNull(row.added_date),
        show_logo: row.show_logo === null ? 1 : row.show_logo,
        is_manual: row.is_manual || 0,
        description1: row.description1 || null,
        remarks: row.remarks || null,
        subid: row.subid || 0,
      },
      { entityType: ENTITY.certificate, legacyId: row.id, newId: id },
    );
    ctx.increment("certificate");
  }
}

async function importQuestionBank(ctx) {
  const rows = await ctx.selectLegacy("question_bank");
  for (const row of rows) {
    const id = legacyUuid(ENTITY.question, row.id);
    const filePrefix = `question-${row.id}`;
    await ctx.upsert(
      "question_bank",
      {
        id,
        question: row.question || "",
        master_course_id: row.master_course_id
          ? legacyUuid(ENTITY.masterCourse, row.master_course_id)
          : null,
        type_of_test: row.type_of_test || null,
        option_a: row.option_a || null,
        option_b: row.option_b || null,
        option_c: row.option_c || null,
        option_d: row.option_d || null,
        correct_option: row.correct_option || null,
        image: ctx.copyLegacyFile(row.image, "uploads/question", "uploads/question", filePrefix),
        opt_img_a: ctx.copyLegacyFile(
          row.opt_img_a,
          "uploads/question",
          "uploads/question",
          `${filePrefix}-a`,
        ),
        opt_img_b: ctx.copyLegacyFile(
          row.opt_img_b,
          "uploads/question",
          "uploads/question",
          `${filePrefix}-b`,
        ),
        opt_img_c: ctx.copyLegacyFile(
          row.opt_img_c,
          "uploads/question",
          "uploads/question",
          `${filePrefix}-c`,
        ),
        opt_img_d: ctx.copyLegacyFile(
          row.opt_img_d,
          "uploads/question",
          "uploads/question",
          `${filePrefix}-d`,
        ),
        status: row.status === undefined ? 1 : row.status,
        created_at: dateTimeOrNull(row.created_at),
        updated_at: dateTimeOrNull(row.updated_at),
      },
      { entityType: ENTITY.question, legacyId: row.id, newId: id },
    );
    ctx.increment("question_bank");
  }
}

async function copyLegacyUploadedFiles(ctx) {
  if (!ctx.oldUploadRoot) {
    ctx.summary.warnings.push(
      "OLD_UPLOAD_ROOT is not set; no uploaded files can be copied.",
    );
  }

  for (const row of await ctx.selectLegacy("candidate")) {
    ctx.copyLegacyFile(
      row.profile_image,
      "uploads/candidate-profiles",
      "/uploads/candidate-profiles",
      `candidate-${row.id}`,
    );
    ctx.increment("candidate_profile_files_checked");
  }

  for (const row of await ctx.selectLegacy("trainer")) {
    ctx.copyLegacyFile(
      row.digital_signature,
      "uploads/trainer",
      "",
      `trainer-signature-${row.id}`,
    );
    ctx.copyLegacyFile(
      row.profile_photo,
      "uploads/trainer",
      "",
      `trainer-photo-${row.id}`,
    );
    ctx.increment("trainer_files_checked");
  }

  for (const row of await ctx.selectLegacy("question_bank")) {
    const filePrefix = `question-${row.id}`;
    ctx.copyLegacyFile(row.image, "uploads/question", "uploads/question", filePrefix);
    ctx.copyLegacyFile(
      row.opt_img_a,
      "uploads/question",
      "uploads/question",
      `${filePrefix}-a`,
    );
    ctx.copyLegacyFile(
      row.opt_img_b,
      "uploads/question",
      "uploads/question",
      `${filePrefix}-b`,
    );
    ctx.copyLegacyFile(
      row.opt_img_c,
      "uploads/question",
      "uploads/question",
      `${filePrefix}-c`,
    );
    ctx.copyLegacyFile(
      row.opt_img_d,
      "uploads/question",
      "uploads/question",
      `${filePrefix}-d`,
    );
    ctx.increment("question_files_checked");
  }

  for (const row of await ctx.selectLegacy("hotel_files")) {
    ctx.copyLegacyFile(row.file_name, "uploads/venues", "", `hotel-file-${row.id}`);
    ctx.increment("hotel_files_checked");
  }
}

function mapCsvIds(value, entityType) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((id) => legacyUuid(entityType, id))
    .join(",");
}

async function importAssessments(ctx) {
  const rows = await ctx.selectLegacy("assessment");
  const assessmentCourseMap = new Map();
  for (const row of rows) {
    const id = legacyUuid(ENTITY.assessment, row.id);
    const courseId = legacyUuid(ENTITY.course, row.course_id);
    assessmentCourseMap.set(String(row.id), courseId);
    await ctx.upsert(
      "assessment",
      {
        id,
        title: row.title || `Legacy Assessment ${row.id}`,
        course_id: courseId,
        type_of_test: String(row.type_of_test || ""),
        candidate_ids: mapCsvIds(row.candidate_ids, ENTITY.candidate),
        num_of_questions: row.num_of_questions || 10,
        questions_choice: row.questions_choice || "auto",
        question_ids: mapCsvIds(row.question_ids, ENTITY.question),
        status: row.status === undefined ? 1 : row.status,
        created_at: dateTimeOrNull(row.created_at),
        updated_at: dateTimeOrNull(row.updated_at),
      },
      { entityType: ENTITY.assessment, legacyId: row.id, newId: id },
    );
    ctx.increment("assessment");
  }
  return assessmentCourseMap;
}

async function importAssessmentResults(ctx, assessmentCourseMap) {
  const rows = await ctx.selectLegacy("assessment_score");
  const answerResultMap = new Map();
  for (const row of rows) {
    const id = legacyUuid(ENTITY.assessmentResult, row.id);
    String(row.assess_que_ans_ids || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((answerId) => answerResultMap.set(answerId, id));
    const total = Number(row.num_of_questions || 0);
    const score = Number(row.score || 0);
    await ctx.upsert(
      "assessment_results",
      {
        id,
        assessment_id: legacyUuid(ENTITY.assessment, row.assessment_id),
        candidate_id: legacyUuid(ENTITY.candidate, row.candidate_id),
        course_id: assessmentCourseMap.get(String(row.assessment_id)) || null,
        score,
        total_questions: total,
        correct_answers: total ? Math.round((score / 100) * total) : 0,
        status: "Completed",
        attempt_number: row.attempt_number || 1,
        created_at: dateTimeOrNull(row.created_at),
      },
      { entityType: ENTITY.assessmentResult, legacyId: row.id, newId: id },
    );
    ctx.increment("assessment_results");
  }
  return answerResultMap;
}

async function importAssessmentAnswers(ctx, answerResultMap) {
  const rows = await ctx.selectLegacy("assessment_question_answer");
  const alreadyMapped = await ctx.mappedLegacyIds(ENTITY.assessmentAnswer);
  const batchRows = [];
  const batchMaps = [];

  for (const row of rows) {
    if (alreadyMapped.has(String(row.id))) {
      ctx.skip("assessment_answers_already_imported");
      continue;
    }

    const assessmentResultId = answerResultMap.get(String(row.id));
    if (!assessmentResultId) {
      ctx.skip("assessment_answers_without_result");
      continue;
    }

    const id = legacyUuid(ENTITY.assessmentAnswer, row.id);
    batchRows.push({
      id,
      assessment_result_id: assessmentResultId,
      question_id: legacyUuid(ENTITY.question, row.question_bank_id),
      selected_option: row.question_bank_option || null,
      is_correct: 0,
      created_at: dateTimeOrNull(row.created_at),
    });
    batchMaps.push({ entityType: ENTITY.assessmentAnswer, legacyId: row.id, newId: id });
    ctx.increment("assessment_answers");
  }

  await ctx.upsertMany("assessment_answers", batchRows, batchMaps);
}

function feedbackQuestionType(format) {
  const normalized = String(format || "").toLowerCase();
  if (normalized.includes("rating")) return "rating";
  if (normalized.includes("radio")) return "radio";
  if (normalized.includes("drop")) return "dropdown";
  return "text";
}

async function importFeedback(ctx) {
  const mappedCategories = await ctx.mappedLegacyIds(ENTITY.feedbackCategory);
  const categoryRows = [];
  const categoryMaps = [];

  for (const row of await ctx.selectLegacy("feedback_category")) {
    if (mappedCategories.has(String(row.id))) {
      ctx.skip("feedback_categories_already_imported");
      continue;
    }

    const id = legacyUuid(ENTITY.feedbackCategory, row.id);
    categoryRows.push({
      id,
      name: row.name || `Legacy Category ${row.id}`,
      description: row.description || null,
      status: row.status === undefined || row.status === 0 ? 1 : row.status,
      created_at: dateTimeOrNull(row.created_at),
      updated_at: dateTimeOrNull(row.updated_at),
    });
    categoryMaps.push({ entityType: ENTITY.feedbackCategory, legacyId: row.id, newId: id });
    ctx.increment("feedback_categories");
  }

  await ctx.upsertMany("feedback_categories", categoryRows, categoryMaps);

  const mappedForms = await ctx.mappedLegacyIds(ENTITY.feedbackForm);
  const formRows = [];
  const formMaps = [];

  for (const row of await ctx.selectLegacy("feedback")) {
    if (mappedForms.has(String(row.id))) {
      ctx.skip("feedback_forms_already_imported");
      continue;
    }

    const id = legacyUuid(ENTITY.feedbackForm, row.id);
    formRows.push({
      id,
      title: row.title || `Legacy Feedback ${row.id}`,
      type_of_course: row.type_of_course || "Others",
      status:
        row.active_status === "Inactive"
          ? 0
          : row.status === undefined || row.status === 0
            ? 1
            : row.status,
      created_at: dateTimeOrNull(row.created_at),
      updated_at: dateTimeOrNull(row.updated_at),
    });
    formMaps.push({ entityType: ENTITY.feedbackForm, legacyId: row.id, newId: id });
    ctx.increment("feedback_forms");
  }

  await ctx.upsertMany("feedback_forms", formRows, formMaps);

  const mappedQuestions = await ctx.mappedLegacyIds(ENTITY.feedbackQuestion);
  const questionRows = [];
  const questionMaps = [];

  for (const row of await ctx.selectLegacy("feedback_question")) {
    if (mappedQuestions.has(String(row.id))) {
      ctx.skip("feedback_questions_already_imported");
      continue;
    }

    const id = legacyUuid(ENTITY.feedbackQuestion, row.id);
    questionRows.push({
      id,
      category_id: row.feedback_category_id
        ? legacyUuid(ENTITY.feedbackCategory, row.feedback_category_id)
        : null,
      question: row.question || "",
      type: feedbackQuestionType(row.question_format),
      status: row.status === undefined || row.status === 0 ? 1 : row.status,
      feedback_form_id: row.feedback_id
        ? legacyUuid(ENTITY.feedbackForm, row.feedback_id)
        : null,
    });
    questionMaps.push({ entityType: ENTITY.feedbackQuestion, legacyId: row.id, newId: id });
    ctx.increment("feedback_questions");
  }

  await ctx.upsertMany("feedback_questions", questionRows, questionMaps);

  const mappedOptions = await ctx.mappedLegacyIds(ENTITY.feedbackOption);
  const optionRows = [];
  const optionMaps = [];

  for (const row of await ctx.selectLegacy("feedback_question_option")) {
    if (mappedOptions.has(String(row.id))) {
      ctx.skip("feedback_question_options_already_imported");
      continue;
    }

    const id = legacyUuid(ENTITY.feedbackOption, row.id);
    optionRows.push({
      id,
      feedback_question_id: legacyUuid(
        ENTITY.feedbackQuestion,
        row.feedback_question_id,
      ),
      option_text: row.option || "",
      status: row.status === undefined || row.status === 0 ? 1 : row.status,
    });
    optionMaps.push({ entityType: ENTITY.feedbackOption, legacyId: row.id, newId: id });
    ctx.increment("feedback_question_options");
  }

  await ctx.upsertMany("feedback_question_options", optionRows, optionMaps);

  const alreadyMapped = await ctx.mappedLegacyIds(ENTITY.feedbackAnswer);
  const batchRows = [];
  const batchMaps = [];

  for (const row of await ctx.selectLegacy("feedback_question_answer")) {
    if (alreadyMapped.has(String(row.id))) {
      ctx.skip("feedback_question_answer_already_imported");
      continue;
    }

    const id = legacyUuid(ENTITY.feedbackAnswer, row.id);
    batchRows.push({
      id,
      candidate_id: legacyUuid(ENTITY.candidate, row.candidate_id),
      active_course_id: legacyUuid(ENTITY.course, row.active_course_id),
      feedback_question_id: legacyUuid(
        ENTITY.feedbackQuestion,
        row.feedback_question_id,
      ),
      feedback_category_id: row.feedback_category_id
        ? legacyUuid(ENTITY.feedbackCategory, row.feedback_category_id)
        : null,
      feedback_id: row.feedback_id
        ? legacyUuid(ENTITY.feedbackForm, row.feedback_id)
        : null,
      feedback_question_option_id: row.feedback_question_option_id
        ? legacyUuid(ENTITY.feedbackOption, row.feedback_question_option_id)
        : null,
      feedback_question_option_text:
        row.feedback_question_option_text || null,
      answer: row.answer || null,
      created_at: dateTimeOrNull(row.created_at),
    });
    batchMaps.push({ entityType: ENTITY.feedbackAnswer, legacyId: row.id, newId: id });
    ctx.increment("feedback_question_answer");
  }

  await ctx.upsertMany("feedback_question_answer", batchRows, batchMaps);
}

async function initializeCertificateSequences(ctx) {
  if (ctx.dryRun) return;
  await ctx.target.execute("DELETE FROM certificate_sequences");
  await ctx.target.execute(`
    INSERT INTO certificate_sequences (scope_type, scope_key, sequence_year, next_subid)
    SELECT 'topic_year', topic, YEAR(issue_date), COALESCE(MAX(subid), 0) + 1
    FROM certificates
    WHERE type IN ('Others', 'DNV-ST0029', 'DNV-ST008')
      AND topic IS NOT NULL
      AND issue_date IS NOT NULL
    GROUP BY topic, YEAR(issue_date)
  `);
  await ctx.target.execute(`
    INSERT INTO certificate_sequences (scope_type, scope_key, sequence_year, next_subid)
    SELECT 'type', type, 0, COALESCE(MAX(subid), 0) + 1
    FROM certificates
    WHERE type NOT IN ('Others', 'DNV-ST0029', 'DNV-ST008')
      AND type IS NOT NULL
    GROUP BY type
    ON DUPLICATE KEY UPDATE next_subid = VALUES(next_subid)
  `);
}

async function validate(ctx) {
  const tables = [
    "candidate",
    "trainer",
    "master_course",
    "course",
    "courses_enrollment",
    "certificate",
    "assessment",
    "assessment_score",
    "assessment_question_answer",
    "question_bank",
    "feedback_question_answer",
    "hotel_details",
    "hotel_files",
  ];

  for (const table of tables) {
    ctx.summary.counts[`legacy_${table}`] = await ctx.countLegacy(table);
  }

  const [duplicateCertificates] = await ctx.legacy.query(`
    SELECT certificate_no, COUNT(*) AS total
    FROM certificate
    GROUP BY certificate_no
    HAVING COUNT(*) > 1
    LIMIT 20
  `);
  if (duplicateCertificates.length) {
    ctx.summary.warnings.push(
      `Duplicate legacy certificate numbers found: ${JSON.stringify(duplicateCertificates)}`,
    );
  }
}

async function runMigration(ctx) {
  await validate(ctx);
  await ensureSupportTables(ctx);

  if (!ctx.dryRun) await ctx.target.execute("SET FOREIGN_KEY_CHECKS = 0");

  try {
    let assessmentCourseMap;

    if (ctx.resumeFrom === "assessment") {
      ctx.summary.warnings.push(
        "Resuming from assessment phase; earlier import phases were skipped.",
      );
      assessmentCourseMap = await importAssessments(ctx);
    } else {
      await seedRoles(ctx);
      const masterCourses = await importMasterCourses(ctx);
      await importCandidates(ctx);
      await importTrainers(ctx);
      await importCourses(ctx, masterCourses);
      await importEnrollments(ctx);
      await importHotelDetails(ctx);
      await importHotelFiles(ctx);
      await importCertificates(ctx);
      await importQuestionBank(ctx);
      assessmentCourseMap = await importAssessments(ctx);
    }

    const answerResultMap = await importAssessmentResults(ctx, assessmentCourseMap);
    await importAssessmentAnswers(ctx, answerResultMap);
    await importFeedback(ctx);
    await initializeCertificateSequences(ctx);
  } finally {
    if (!ctx.dryRun) await ctx.target.execute("SET FOREIGN_KEY_CHECKS = 1");
  }
}

async function writeReport(ctx, status, runId) {
  ctx.summary.finished_at = new Date().toISOString();
  ctx.summary.status = status;
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `legacy-migration-${runId}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(ctx.summary, null, 2));

  if (!ctx.dryRun) {
    await ctx.target.execute(
      `INSERT INTO legacy_migration_runs
         (id, mode, started_at, finished_at, status, summary_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         finished_at = VALUES(finished_at),
         status = VALUES(status),
         summary_json = VALUES(summary_json)`,
      [
        runId,
        ctx.mode,
        ctx.summary.started_at.replace("T", " ").slice(0, 19),
        ctx.summary.finished_at.replace("T", " ").slice(0, 19),
        status,
        JSON.stringify(ctx.summary),
      ],
    );
  }

  console.log(`Migration ${status}. Report: ${reportPath}`);
  console.log(JSON.stringify(ctx.summary.counts, null, 2));
  if (ctx.summary.warnings.length) {
    console.warn("Warnings:");
    ctx.summary.warnings.forEach((warning) => console.warn(`- ${warning}`));
  }
}

async function main() {
  const args = parseArgs();
  const runId = uuidv4();
  const { legacy, target } = await createConnections();
  const ctx = new MigrationContext({
    legacy,
    target,
    dryRun: args.dryRun,
    mode: args.mode,
    resumeFrom: args.resumeFrom,
  });

  try {
    if (args.reset) {
      await resetImported(ctx);
    } else if (args.mode === "copy-files-only") {
      await copyLegacyUploadedFiles(ctx);
    } else {
      await runMigration(ctx);
    }
    await writeReport(ctx, "success", runId);
  } catch (error) {
    ctx.summary.error = error.stack || error.message;
    await writeReport(ctx, "failed", runId).catch(() => {});
    throw error;
  } finally {
    await legacy.end();
    await target.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
