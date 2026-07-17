const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");
const { v4: uuidv4, v5: uuidv5 } = require("uuid");
require("dotenv").config();
const {
  TRAINER_ROLE_PERMISSIONS,
  ensureTrainerRolePermissions,
} = require("./trainerRolePermissions");

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
  courseAttendance: "course_attendance",
  feedbackCategory: "feedback_category",
  feedbackForm: "feedback",
  feedbackQuestion: "feedback_question",
  feedbackOption: "feedback_question_option",
  feedbackAnswer: "feedback_question_answer",
  hotelFile: "hotel_file",
  hotelDetail: "hotel_detail",
  location: "location",
  role: "role",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const resumeFromArg = args.find((arg) => arg.startsWith("--resume-from="));
  let mode = "dry-run";
  if (args.includes("--reset-imported")) mode = "reset-imported";
  else if (args.includes("--source-counts")) mode = "source-counts";
  else if (args.includes("--incremental")) mode = "incremental";
  else if (args.includes("--audit")) mode = "audit";
  else if (args.includes("--copy-files-only")) mode = "copy-files-only";
  else if (args.includes("--repair-all")) mode = "repair-all";
  else if (args.includes("--repair-passwords")) mode = "repair-passwords";
  else if (args.includes("--repair-trainer-permissions")) mode = "repair-trainer-permissions";
  else if (args.includes("--repair-attendance")) mode = "repair-attendance";
  else if (args.includes("--repair-course-dates")) mode = "repair-course-dates";
  else if (args.includes("--repair-locations")) mode = "repair-locations";
  else if (args.includes("--repair-candidate-names")) mode = "repair-candidate-names";
  else if (args.includes("--apply")) mode = "apply";

  return {
    mode,
    dryRun:
      mode === "source-counts" ||
      mode === "audit" ||
      args.includes("--dry-run") ||
      (mode === "repair-candidate-names" ||
      mode === "repair-locations" ||
      mode === "repair-course-dates" ||
      mode === "repair-attendance" ||
      mode === "repair-passwords" ||
      mode === "repair-trainer-permissions" ||
      mode === "repair-all" ||
      mode === "incremental" ||
      mode === "audit"
        ? !args.includes("--apply")
        : mode !== "apply" && mode !== "reset-imported" && mode !== "copy-files-only"),
    reset: mode === "reset-imported",
    incremental: mode === "incremental",
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

function placeholderEmail(entityLabel, legacyId) {
  return `legacy-${entityLabel}-${legacyId}@migration.local`;
}

async function resolveLegacyUserEmail(ctx, entityLabel, legacyId, rawEmail, expectedUserId) {
  const normalizedEmail = normalizeText(rawEmail);
  const fallbackEmail = placeholderEmail(entityLabel, legacyId);
  const candidateEmail = normalizedEmail || fallbackEmail;

  const ownerId = async (email) => {
    const [rows] = await ctx.target.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
      email,
    ]);
    return rows[0]?.id || null;
  };

  const candidateOwnerId = await ownerId(candidateEmail);
  if (!candidateOwnerId || candidateOwnerId === expectedUserId) return candidateEmail;

  ctx.skip(`${entityLabel}_duplicate_email_placeholder`);
  const fallbackOwnerId = await ownerId(fallbackEmail);
  if (!fallbackOwnerId || fallbackOwnerId === expectedUserId) {
    if (ctx.summary.warnings.length < 200) {
      ctx.summary.warnings.push(
        `Using placeholder email ${fallbackEmail} for legacy ${entityLabel} ${legacyId}; ${candidateEmail} already belongs to another user.`,
      );
    }
    return fallbackEmail;
  }

  const uniqueFallbackEmail = `legacy-${entityLabel}-${legacyId}-${String(expectedUserId).slice(0, 8)}@migration.local`;
  if (ctx.summary.warnings.length < 200) {
    ctx.summary.warnings.push(
      `Using placeholder email ${uniqueFallbackEmail} for legacy ${entityLabel} ${legacyId}; ${candidateEmail} and ${fallbackEmail} already belong to other users.`,
    );
  }
  return uniqueFallbackEmail;
}

function looksLikeBcryptHash(value) {
  return /^\$2[aby]\$\d{2}\$/.test(String(value || ""));
}

async function legacyPasswordHash(value, cache, fallback = null) {
  const password = normalizeText(value) || normalizeText(fallback);
  if (!password) return null;
  if (looksLikeBcryptHash(password)) return password;
  if (cache.has(password)) return cache.get(password);
  const hash = await bcrypt.hash(password, DEFAULT_PASSWORD_HASH_ROUNDS);
  cache.set(password, hash);
  return hash;
}

function normalizeNamePart(value) {
  const text = normalizeText(value);
  return text ? text.replace(/\s+/g, " ") : null;
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

function legacyAttendanceDateOrNull(value) {
  const text = normalizeText(value);
  if (!text || text === "[]" || text === "{}") return null;
  const direct = dateOrNull(text);
  if (direct && /^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;

  const match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/);
  if (!match) return null;
  const [, day, month, yearPart] = match;
  const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function dateTimeOrNull(value) {
  const text = normalizeText(value);
  if (!text || text === "0000-00-00 00:00:00") return null;
  return text;
}

function courseDateTimeOrNull(value) {
  const text = dateOrNull(value);
  return text ? `${text} 00:00:00` : null;
}

function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Legacy", lastName: "Trainer" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function splitCandidateFullName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "Legacy", middleName: null, lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], middleName: null, lastName: "" };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], middleName: null, lastName: parts[1] };
  }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function parseCandidateName(row) {
  const candidateName = normalizeNamePart(row.candidate_name);
  const firstName = normalizeNamePart(row.first_name);
  const middleName = normalizeNamePart(row.middle_name);
  const lastName = normalizeNamePart(row.last_name);
  const explicitLooksClean =
    firstName && lastName && !/\s/.test(firstName) && (!middleName || !/\s{2,}/.test(middleName));

  if (explicitLooksClean) {
    return { firstName, middleName, lastName };
  }

  const sourceName =
    candidateName || [firstName, middleName, lastName].filter(Boolean).join(" ");
  return splitCandidateFullName(sourceName);
}

function registrationType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "MOLMI_EMPLOYEE" || normalized === "MOLMI EMPLOYEE") {
    return "MOLMI Employee";
  }
  return "Others";
}

function candidateUserType(value) {
  return registrationType(value) === "MOLMI Employee" ? "" : "others";
}

function normalizeLocationKey(value) {
  const text = normalizeNamePart(value);
  return text ? text.toUpperCase() : null;
}

function fallbackLocationShortCode(row) {
  const existing = normalizeText(row.short_code);
  if (existing) return existing.slice(0, 50);

  const name = normalizeText(row.location_name) || `Legacy Location ${row.id}`;
  const code = name
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, 12);
  return code || `LOC${row.id}`;
}

function legacyLocationType(row) {
  const name = String(row.location_name || "").toLowerCase();
  if (name.includes("outhouse")) return "Outhouse";
  return "Inhouse";
}

function buildLocationLookup(rows) {
  const lookup = new Map();
  const add = (key, id) => {
    const normalized = normalizeLocationKey(key);
    if (normalized && !lookup.has(normalized)) lookup.set(normalized, id);
  };

  for (const row of rows) {
    const id = legacyUuid(ENTITY.location, row.id);
    add(row.location_name, id);
    add(row.short_code, id);
  }

  const nameToId = (name) => lookup.get(normalizeLocationKey(name));
  const aliases = {
    Online: nameToId("MOLTCI-ONLINE"),
    Mumbai: nameToId("MOLMI-MUMBAI"),
    MOLTC: nameToId("MOLTC-MUMBAI"),
    "MOLTCI-MOLTC": nameToId("MOLTC-MUMBAI"),
    "MOLTCI-MOLTCMUM": nameToId("MOLTC-MUMBAI"),
    "MOLTCI-MOLMI": nameToId("MOLMI-MUMBAI"),
  };

  for (const [alias, id] of Object.entries(aliases)) {
    if (id) add(alias, id);
  }

  return lookup;
}

function resolveCourseLocationId(row, locationLookup) {
  const locationValue = normalizeLocationKey(row.type_of_location);
  if (!locationValue) return null;
  return locationLookup.get(locationValue) || null;
}

function courseDisplayName(row) {
  const courseId = normalizeText(row.course_id);
  const courseName = normalizeText(row.course_name);
  if (courseName) return courseName;
  if (courseId) return courseId;
  return `Legacy Course ${row.id}`;
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
  constructor({ legacy, target, dryRun, mode, resumeFrom, incremental = false }) {
    this.legacy = legacy;
    this.target = target;
    this.dryRun = dryRun;
    this.mode = mode;
    this.incremental = incremental;
    this.resumeFrom = resumeFrom;
    this.columnCache = new Map();
    this.legacyTableCache = new Map();
    this.mappedIdCache = new Map();
    this.fileIndex = null;
    this.oldUploadRoot = process.env.OLD_UPLOAD_ROOT || "";
    this.fileMode = process.env.MIGRATION_FILE_MODE || "copy";
    this.summary = {
      mode,
      incremental,
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

  async targetHasTable(tableName) {
    const [rows] = await this.target.query("SHOW TABLES LIKE ?", [tableName]);
    return rows.length > 0;
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

  async hasLegacyMap(entityType, legacyId) {
    if (!entityType || legacyId === undefined || legacyId === null) return false;
    const ids = await this.mappedLegacyIds(entityType);
    return ids.has(String(legacyId));
  }

  async skipExistingLegacyMap(map) {
    if (!this.incremental || !map) return false;
    if (!(await this.hasLegacyMap(map.entityType, map.legacyId))) return false;
    this.skip(`${map.entityType}_incremental_existing`);
    return true;
  }

  noteIncrementalNew(map) {
    if (!this.incremental || !map) return;
    this.increment(`${map.entityType}_incremental_new`);
  }

  async upsert(tableName, row, map = null) {
    if (await this.skipExistingLegacyMap(map)) return false;

    const columns = await this.targetColumns(tableName);
    const filtered = Object.entries(row).filter(([key, value]) => {
      if (value === undefined || !columns.has(key)) return false;
      const column = columns.get(key);
      if (value === null && column.Null === "NO" && column.Default !== null) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) return false;
    this.noteIncrementalNew(map);
    if (this.dryRun) return true;

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
    return true;
  }

  async mapLegacyId(entityType, legacyId, newId) {
    if (this.dryRun || legacyId === undefined || legacyId === null || !newId) return;
    await this.target.execute(
      `INSERT INTO legacy_id_map (entity_type, legacy_id, new_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE new_id = VALUES(new_id)`,
      [entityType, String(legacyId), String(newId)],
    );
    this.mappedIdCache.delete(entityType);
  }

  async mappedLegacyIds(entityType) {
    if (this.mappedIdCache.has(entityType)) return this.mappedIdCache.get(entityType);
    if (
      this.dryRun &&
      !this.incremental &&
      this.mode !== "audit" &&
      this.mode !== "source-counts"
    ) {
      this.mappedIdCache.set(entityType, new Set());
      return this.mappedIdCache.get(entityType);
    }

    if (!(await this.targetHasTable("legacy_id_map"))) {
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

    if (this.incremental && maps.length) {
      const filteredRows = [];
      const filteredMaps = [];
      for (let index = 0; index < rows.length; index += 1) {
        const map = maps[index] || null;
        if (await this.skipExistingLegacyMap(map)) continue;
        filteredRows.push(rows[index]);
        filteredMaps.push(map);
        this.noteIncrementalNew(map);
      }
      rows = filteredRows;
      maps = filteredMaps;
      if (rows.length === 0) return;
    } else if (this.incremental && !maps.length) {
      this.increment(`${tableName}_incremental_unmapped_rows`, rows.length);
    }

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
        for (const map of mapBatch) this.mappedIdCache.delete(map.entityType);
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

  legacyFileStoredValue(value, storedPrefix, filePrefix) {
    const text = normalizeText(value);
    if (!text) return null;
    const sourceName = sanitizeFileName(text);
    if (!sourceName) return null;
    const targetName = `${filePrefix}-${sourceName}`;
    return storedPrefix ? `${storedPrefix}/${targetName}` : targetName;
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
      ["course_attendance", ENTITY.courseAttendance],
      ["hotel_files", ENTITY.hotelFile],
      ["hotel_details", ENTITY.hotelDetail],
      ["courses_enrollment", ENTITY.enrollment],
      ["courses", ENTITY.course],
      ["locations", ENTITY.location],
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

async function seedTrainerPermissions(ctx) {
  const result = await ensureTrainerRolePermissions(ctx.target, {
    dryRun: ctx.dryRun,
  });

  if (result.missingRole) {
    ctx.summary.warnings.push(
      "Trainer role was not found; trainer permissions were not assigned.",
    );
    return;
  }

  ctx.increment("trainer_role_permissions", result.assignedPermissions.length);
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
  const passwordCache = new Map();
  const fallbackPassword = process.env.LEGACY_TEMP_PASSWORD || uuidv4();

  for (const row of rows) {
    if (ctx.incremental && (await ctx.hasLegacyMap(ENTITY.candidate, row.id))) {
      ctx.skip(`${ENTITY.candidate}_incremental_existing`);
      ctx.skip("candidate_profile_incremental_existing");
      continue;
    }

    const userId = legacyUuid(ENTITY.candidate, row.id);
    const profileId = legacyUuid("candidate_profile", row.id);
    const { firstName, middleName, lastName } = parseCandidateName(row);
    const email = await resolveLegacyUserEmail(
      ctx,
      "candidate",
      row.id,
      row.email,
      userId,
    );
    const profileImage = ctx.copyLegacyFile(
      row.profile_image,
      "uploads/candidate-profiles",
      "/uploads/candidate-profiles",
      `candidate-${row.id}`,
    );

    const userImported = await ctx.upsert(
      "users",
      {
        id: userId,
        prefix: row.prefix || null,
        role_id: candidateRoleId,
        user_type: candidateUserType(row.registration_type),
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        gender: row.gender || null,
        email,
        password: await legacyPasswordHash(
          row.password,
          passwordCache,
          fallbackPassword,
        ),
        mobile: row.mobile || null,
        alternate_mobile: row.mobile_1 || null,
        status: normalizeStatus(row.is_active),
        created_at: dateTimeOrNull(row.created_at),
        updated_at: dateTimeOrNull(row.updated_at),
      },
      { entityType: ENTITY.candidate, legacyId: row.id, newId: userId },
    );
    if (!userImported) {
      ctx.skip("candidate_profile_incremental_existing");
      continue;
    }

    await ctx.upsert("candidate_profiles", {
      id: profileId,
      user_id: userId,
      prefix: row.prefix || null,
      middle_name: middleName,
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

function sameNameValue(current, desired) {
  return (normalizeNamePart(current) || "") === (normalizeNamePart(desired) || "");
}

async function repairCandidateNames(ctx) {
  const legacyRows = await ctx.selectLegacy("candidate");
  const candidateRoleId = await roleId(ctx, "candidate");
  const passwordCache = new Map();
  const fallbackPassword = process.env.LEGACY_TEMP_PASSWORD || uuidv4();
  const [mappedRows] = await ctx.target.query(
    `SELECT
       lim.legacy_id,
       lim.new_id,
       u.id AS user_id,
       r.name AS role_name,
       u.email,
       u.status,
       u.first_name,
       u.middle_name,
       u.last_name,
        cp.id AS profile_id,
        cp.middle_name AS profile_middle_name,
        cp.registration_type AS profile_registration_type
     FROM legacy_id_map lim
     LEFT JOIN users u ON u.id = lim.new_id
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN candidate_profiles cp ON cp.user_id = lim.new_id
     WHERE lim.entity_type = ?`,
    [ENTITY.candidate],
  );
  const mappedByLegacyId = new Map(
    mappedRows.map((row) => [String(row.legacy_id), row]),
  );
  const repairSummary = {
    checked: 0,
    changed: 0,
    unchanged: 0,
    missing_map: 0,
    missing_user: 0,
    recreated_users: 0,
    created_profiles: 0,
    registration_type_updates: 0,
    samples: [],
  };

  for (const legacyRow of legacyRows) {
    repairSummary.checked += 1;
    const mapped = mappedByLegacyId.get(String(legacyRow.id));
    if (!mapped) {
      repairSummary.missing_map += 1;
      continue;
    }

    const desired = parseCandidateName(legacyRow);
    const desiredRegistrationType = registrationType(legacyRow.registration_type);
    const desiredStatus = normalizeStatus(legacyRow.is_active);
    const userId = mapped.new_id;
    const desiredEmail = await resolveLegacyUserEmail(
      ctx,
      "candidate",
      legacyRow.id,
      legacyRow.email,
      userId,
    );
    const userMissing = !mapped.user_id;
    const profileMissing = !mapped.profile_id;
    if (userMissing) {
      repairSummary.missing_user += 1;
    }
    const roleMismatch = normalizeText(mapped.role_name) !== "candidate";
    const userChanged =
      userMissing ||
      roleMismatch ||
      Number(mapped.status ?? 1) !== desiredStatus ||
      !sameNameValue(mapped.first_name, desired.firstName) ||
      !sameNameValue(mapped.middle_name, desired.middleName) ||
      !sameNameValue(mapped.last_name, desired.lastName);
    const profileChanged =
      profileMissing ||
      !sameNameValue(mapped.profile_middle_name, desired.middleName) ||
      normalizeText(mapped.profile_registration_type) !== desiredRegistrationType;

    if (!userChanged && !profileChanged) {
      repairSummary.unchanged += 1;
      continue;
    }

    repairSummary.changed += 1;
    if (repairSummary.samples.length < 50) {
      repairSummary.samples.push({
        legacy_id: String(legacyRow.id),
        candidate_name: normalizeNamePart(legacyRow.candidate_name),
        before: {
          role_name: mapped.role_name,
          status: mapped.status,
          email: mapped.email,
          first_name: mapped.first_name,
          middle_name: mapped.middle_name,
          last_name: mapped.last_name,
          profile_middle_name: mapped.profile_middle_name,
          profile_registration_type: mapped.profile_registration_type,
        },
        after: {
          role_name: "candidate",
          status: desiredStatus,
          email: desiredEmail,
          first_name: desired.firstName,
          middle_name: desired.middleName,
          last_name: desired.lastName,
          profile_middle_name: desired.middleName,
          profile_registration_type: desiredRegistrationType,
        },
      });
    }

    if (ctx.dryRun) continue;

    if (userMissing) {
      repairSummary.recreated_users += 1;
      await ctx.upsert(
        "users",
        {
          id: userId,
          prefix: legacyRow.prefix || null,
          role_id: candidateRoleId,
          user_type: candidateUserType(legacyRow.registration_type),
          first_name: desired.firstName,
          middle_name: desired.middleName,
          last_name: desired.lastName,
          gender: legacyRow.gender || null,
          email: desiredEmail,
          password: await legacyPasswordHash(
            legacyRow.password,
            passwordCache,
            fallbackPassword,
          ),
          mobile: legacyRow.mobile || null,
          alternate_mobile: legacyRow.mobile_1 || null,
          status: desiredStatus,
          created_at: dateTimeOrNull(legacyRow.created_at),
          updated_at: dateTimeOrNull(legacyRow.updated_at),
        },
        { entityType: ENTITY.candidate, legacyId: legacyRow.id, newId: userId },
      );
    } else {
      await ctx.target.execute(
        `UPDATE users
         SET role_id = ?, first_name = ?, middle_name = ?, last_name = ?,
             gender = ?, email = ?, password = ?, mobile = ?, alternate_mobile = ?, status = ?
         WHERE id = ?`,
        [
          candidateRoleId,
          desired.firstName,
          desired.middleName,
          desired.lastName,
          legacyRow.gender || null,
          desiredEmail,
          await legacyPasswordHash(legacyRow.password, passwordCache, fallbackPassword),
          legacyRow.mobile || null,
          legacyRow.mobile_1 || null,
          desiredStatus,
          mapped.user_id,
        ],
      );
    }

    if (profileMissing) {
      repairSummary.created_profiles += 1;
      await ctx.upsert("candidate_profiles", {
        id: legacyUuid("candidate_profile", legacyRow.id),
        user_id: userId,
        prefix: legacyRow.prefix || null,
        middle_name: desired.middleName,
        dob: dateOrNull(legacyRow.dob),
        gender: legacyRow.gender || null,
        nationality: legacyRow.nationality || null,
        passport_no: legacyRow.cdc_passport || null,
        designation: legacyRow.designation || legacyRow.position || null,
        profile_image: ctx.copyLegacyFile(
          legacyRow.profile_image,
          "uploads/candidate-profiles",
          "/uploads/candidate-profiles",
          `candidate-${legacyRow.id}`,
        ),
        indos_number: legacyRow.indos_no || null,
        employee_id: legacyRow.empId || legacyRow.employee_id_api || null,
        manager: legacyRow.manager || null,
        rank: legacyRow.rank || legacyRow.position || null,
        whatsapp_number: legacyRow.whatsapp || null,
        alternate_mobile: legacyRow.alternate_mobile || legacyRow.mobile_1 || null,
        registration_type: desiredRegistrationType,
        vessel_type: legacyRow.vessel_type || null,
        last_vessel_name: legacyRow.vessel_name || null,
        manning_company: legacyRow.manning_company || null,
        sign_on_date: dateOrNull(legacyRow.sign_on),
        sign_off_date: dateOrNull(legacyRow.sign_off),
        officer: legacyRow.officer || null,
        seaman_book_no: legacyRow.seaman_book_no || null,
      });
    } else {
      await ctx.target.execute(
        `UPDATE candidate_profiles
         SET middle_name = ?, registration_type = ?
         WHERE id = ?`,
        [desired.middleName, desiredRegistrationType, mapped.profile_id],
      );
      if (normalizeText(mapped.profile_registration_type) !== desiredRegistrationType) {
        repairSummary.registration_type_updates += 1;
      }
    }
  }

  ctx.summary.candidate_name_repair = repairSummary;
  ctx.increment("candidate_name_repair_checked", repairSummary.checked);
  ctx.increment("candidate_name_repair_changed", repairSummary.changed);
  ctx.increment("candidate_name_repair_missing_map", repairSummary.missing_map);
  ctx.increment("candidate_name_repair_missing_user", repairSummary.missing_user);
}

async function importTrainers(ctx) {
  const trainerRoleId = await roleId(ctx, "trainer");
  const rows = await ctx.selectLegacy("trainer");
  const emailCounts = rows.reduce((counts, row) => {
    const email = normalizeText(row.email)?.toLowerCase();
    if (email) counts.set(email, (counts.get(email) || 0) + 1);
    return counts;
  }, new Map());
  const passwordCache = new Map();
  const fallbackPassword = process.env.LEGACY_TEMP_PASSWORD || uuidv4();

  for (const row of rows) {
    if (ctx.incremental && (await ctx.hasLegacyMap(ENTITY.trainer, row.id))) {
      ctx.skip(`${ENTITY.trainer}_incremental_existing`);
      ctx.skip("trainer_profile_incremental_existing");
      continue;
    }

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
    const legacySafeTrainerEmail =
      trainerEmail && emailCounts.get(trainerEmail.toLowerCase()) === 1
        ? trainerEmail
        : placeholderEmail("trainer", row.id);
    const safeTrainerEmail = await resolveLegacyUserEmail(
      ctx,
      "trainer",
      row.id,
      legacySafeTrainerEmail,
      userId,
    );

    const userImported = await ctx.upsert(
      "users",
      {
        id: userId,
        prefix: row.prefix || null,
        role_id: trainerRoleId,
        first_name: firstName,
        last_name: lastName,
        email: safeTrainerEmail,
        password: await legacyPasswordHash(
          row.password,
          passwordCache,
          fallbackPassword,
        ),
        status: normalizeStatus(row.status),
      },
      { entityType: ENTITY.trainer, legacyId: row.id, newId: userId },
    );
    if (!userImported) {
      ctx.skip("trainer_profile_incremental_existing");
      continue;
    }

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

async function repairLegacyPasswordsForEntity(ctx, entityType, tableName, options = {}) {
  const allRows = await ctx.selectLegacy(tableName);
  const quickDryRun = Boolean(options.quickDryRun && ctx.dryRun);
  const rows = quickDryRun ? allRows.slice(0, options.sampleSize || 50) : allRows;
  const [mappedRows] = await ctx.target.query(
    `SELECT lim.legacy_id, lim.new_id, u.id AS user_id, u.email, u.password
     FROM legacy_id_map lim
     LEFT JOIN users u ON u.id = lim.new_id
     WHERE lim.entity_type = ?`,
    [entityType],
  );
  const mappedByLegacyId = new Map(
    mappedRows.map((row) => [String(row.legacy_id), row]),
  );
  const passwordCache = new Map();
  const summary = {
    checked: quickDryRun ? allRows.length : 0,
    sampled: quickDryRun ? rows.length : undefined,
    quick_dry_run: quickDryRun || undefined,
    changed: 0,
    unchanged: 0,
    blank_legacy_password: 0,
    missing_map: 0,
    missing_user: 0,
    samples: [],
  };

  for (const row of rows) {
    if (!quickDryRun) summary.checked += 1;
    const legacyPassword = normalizeText(row.password);
    if (!legacyPassword) {
      summary.blank_legacy_password += 1;
      continue;
    }

    const mapped = mappedByLegacyId.get(String(row.id));
    if (!mapped) {
      summary.missing_map += 1;
      continue;
    }
    if (!mapped.user_id) {
      summary.missing_user += 1;
      continue;
    }

    const alreadyMatches = ctx.dryRun
      ? looksLikeBcryptHash(legacyPassword)
        ? mapped.password === legacyPassword
        : await bcrypt.compare(legacyPassword, mapped.password || "")
      : false;

    if (alreadyMatches) {
      summary.unchanged += 1;
      continue;
    }

    summary.changed += 1;
    if (summary.samples.length < 50) {
      summary.samples.push({
        entity_type: entityType,
        legacy_id: String(row.id),
        email: mapped.email,
      });
    }

    if (ctx.dryRun) continue;
    const desiredHash = await legacyPasswordHash(legacyPassword, passwordCache);
    await ctx.target.execute("UPDATE users SET password = ? WHERE id = ?", [
      desiredHash,
      mapped.new_id,
    ]);
  }

  return summary;
}

async function repairLegacyPasswords(ctx) {
  const quickDryRun = ctx.mode === "repair-all";
  const candidateSummary = await repairLegacyPasswordsForEntity(
    ctx,
    ENTITY.candidate,
    "candidate",
    { quickDryRun, sampleSize: 50 },
  );
  const trainerSummary = await repairLegacyPasswordsForEntity(
    ctx,
    ENTITY.trainer,
    "trainer",
    { quickDryRun, sampleSize: 50 },
  );
  const totals = {
    checked: candidateSummary.checked + trainerSummary.checked,
    changed: candidateSummary.changed + trainerSummary.changed,
    unchanged: candidateSummary.unchanged + trainerSummary.unchanged,
    blank_legacy_password:
      candidateSummary.blank_legacy_password + trainerSummary.blank_legacy_password,
    missing_map: candidateSummary.missing_map + trainerSummary.missing_map,
    missing_user: candidateSummary.missing_user + trainerSummary.missing_user,
  };

  ctx.summary.legacy_password_repair = {
    totals,
    candidate: candidateSummary,
    trainer: trainerSummary,
  };
  ctx.increment("legacy_password_repair_checked", totals.checked);
  ctx.increment("legacy_password_repair_changed", totals.changed);
  ctx.increment(
    "legacy_password_repair_blank_legacy_password",
    totals.blank_legacy_password,
  );
  ctx.increment("legacy_password_repair_missing_map", totals.missing_map);
  ctx.increment("legacy_password_repair_missing_user", totals.missing_user);
}

async function importLocations(ctx) {
  const rows = await ctx.selectLegacy("location");
  const lookup = buildLocationLookup(rows);

  for (const row of rows) {
    const id = legacyUuid(ENTITY.location, row.id);
    await ctx.upsert(
      "locations",
      {
        id,
        location_name: normalizeText(row.location_name) || `Legacy Location ${row.id}`,
        type: legacyLocationType(row),
        short_code: fallbackLocationShortCode(row),
        email: row.email || null,
        phone_number: row.phone_number || null,
        address: row.address || null,
        google_map_link: row.google_map_link || null,
        status: normalizeStatus(row.status),
        created_at: dateTimeOrNull(row.created_at),
        updated_at: dateTimeOrNull(row.updated_at),
      },
      { entityType: ENTITY.location, legacyId: row.id, newId: id },
    );
    ctx.increment("location");
  }

  return lookup;
}

function mapTrainerList(value) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => legacyUuid(ENTITY.trainer, id))
    .join(",");
}

function parseLegacyDateList(value) {
  const text = normalizeText(value);
  if (!text || text === "[]" || text === "{}") return [];
  return text
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .map(legacyAttendanceDateOrNull)
    .filter(Boolean);
}

function parseLegacyAbsentReasons(value) {
  const text = normalizeText(value);
  if (!text || text === "[]" || text === "{}") return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return {};
    return Object.entries(parsed).reduce((result, [date, reason]) => {
      const normalizedDate = legacyAttendanceDateOrNull(date);
      if (normalizedDate) result[normalizedDate] = normalizeText(reason) || "Absent";
      return result;
    }, {});
  } catch {
    return {};
  }
}

async function importCourses(ctx, masterCourses, locationLookup = new Map()) {
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
        start_date: courseDateTimeOrNull(row.start_date),
        end_date: courseDateTimeOrNull(row.end_date),
        type_of_location: typeOfLocation,
        location_id: resolveCourseLocationId(row, locationLookup),
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

async function repairLocations(ctx) {
  const locationLookup = await importLocations(ctx);
  const courseRows = await ctx.selectLegacy("course");
  const [mappedRows] = await ctx.target.query(
    `SELECT lim.legacy_id, lim.new_id, c.location_id
     FROM legacy_id_map lim
     LEFT JOIN courses c ON c.id = lim.new_id
     WHERE lim.entity_type = ?`,
    [ENTITY.course],
  );
  const mappedByLegacyId = new Map(
    mappedRows.map((row) => [String(row.legacy_id), row]),
  );
  const repairSummary = {
    checked: 0,
    changed: 0,
    unchanged: 0,
    missing_map: 0,
    missing_course: 0,
    unmapped_location_values: {},
    samples: [],
  };

  for (const legacyRow of courseRows) {
    repairSummary.checked += 1;
    const mapped = mappedByLegacyId.get(String(legacyRow.id));
    if (!mapped) {
      repairSummary.missing_map += 1;
      continue;
    }
    if (!mapped.new_id) {
      repairSummary.missing_course += 1;
      continue;
    }

    const desiredLocationId = resolveCourseLocationId(legacyRow, locationLookup);
    const locationValue = normalizeNamePart(legacyRow.type_of_location);
    if (locationValue && !desiredLocationId) {
      repairSummary.unmapped_location_values[locationValue] =
        (repairSummary.unmapped_location_values[locationValue] || 0) + 1;
    }

    if ((mapped.location_id || null) === (desiredLocationId || null)) {
      repairSummary.unchanged += 1;
      continue;
    }

    repairSummary.changed += 1;
    if (repairSummary.samples.length < 50) {
      repairSummary.samples.push({
        legacy_course_id: String(legacyRow.id),
        course_id: legacyRow.course_id,
        type_of_location: locationValue,
        before_location_id: mapped.location_id,
        after_location_id: desiredLocationId,
      });
    }

    if (ctx.dryRun) continue;
    await ctx.target.execute("UPDATE courses SET location_id = ? WHERE id = ?", [
      desiredLocationId,
      mapped.new_id,
    ]);
  }

  ctx.summary.location_repair = repairSummary;
  ctx.increment("location_repair_checked", repairSummary.checked);
  ctx.increment("location_repair_changed", repairSummary.changed);
  ctx.increment("location_repair_missing_map", repairSummary.missing_map);
  ctx.increment("location_repair_missing_course", repairSummary.missing_course);
}

function sameDateTimeValue(current, desired) {
  return (normalizeText(current) || null) === (normalizeText(desired) || null);
}

async function repairCourseDates(ctx) {
  const courseRows = await ctx.selectLegacy("course");
  const [mappedRows] = await ctx.target.query(
    `SELECT lim.legacy_id, lim.new_id, c.start_date, c.end_date, c.course_name
     FROM legacy_id_map lim
     LEFT JOIN courses c ON c.id = lim.new_id
     WHERE lim.entity_type = ?`,
    [ENTITY.course],
  );
  const mappedByLegacyId = new Map(
    mappedRows.map((row) => [String(row.legacy_id), row]),
  );
  const repairSummary = {
    checked: 0,
    changed: 0,
    unchanged: 0,
    missing_map: 0,
    missing_course: 0,
    samples: [],
  };

  for (const legacyRow of courseRows) {
    repairSummary.checked += 1;
    const mapped = mappedByLegacyId.get(String(legacyRow.id));
    if (!mapped) {
      repairSummary.missing_map += 1;
      continue;
    }
    if (!mapped.new_id) {
      repairSummary.missing_course += 1;
      continue;
    }

    const desiredStartDate = courseDateTimeOrNull(legacyRow.start_date);
    const desiredEndDate = courseDateTimeOrNull(legacyRow.end_date);
    const desiredCourseName = courseDisplayName(legacyRow);
    const changed =
      !sameDateTimeValue(mapped.start_date, desiredStartDate) ||
      !sameDateTimeValue(mapped.end_date, desiredEndDate) ||
      !sameNameValue(mapped.course_name, desiredCourseName);

    if (!changed) {
      repairSummary.unchanged += 1;
      continue;
    }

    repairSummary.changed += 1;
    if (repairSummary.samples.length < 50) {
      repairSummary.samples.push({
        legacy_course_id: String(legacyRow.id),
        course_id: legacyRow.course_id,
        before: {
          start_date: mapped.start_date,
          end_date: mapped.end_date,
          course_name: mapped.course_name,
        },
        after: {
          start_date: desiredStartDate,
          end_date: desiredEndDate,
          course_name: desiredCourseName,
        },
      });
    }

    if (ctx.dryRun) continue;
    await ctx.target.execute(
      "UPDATE courses SET start_date = ?, end_date = ?, course_name = ? WHERE id = ?",
      [desiredStartDate, desiredEndDate, desiredCourseName, mapped.new_id],
    );
  }

  ctx.summary.course_date_repair = repairSummary;
  ctx.increment("course_date_repair_checked", repairSummary.checked);
  ctx.increment("course_date_repair_changed", repairSummary.changed);
  ctx.increment("course_date_repair_missing_map", repairSummary.missing_map);
  ctx.increment("course_date_repair_missing_course", repairSummary.missing_course);
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

async function importCourseAttendance(ctx) {
  const rows = await ctx.selectLegacy("course_attendance");
  const summary = {
    checked: 0,
    attendance_rows: 0,
    enrollment_updates: 0,
    missing_enrollment: 0,
    samples: [],
  };

  for (const row of rows) {
    summary.checked += 1;
    const courseId = legacyUuid(ENTITY.course, row.course_id);
    const candidateId = legacyUuid(ENTITY.candidate, row.candidate_id);
    const presentDates = parseLegacyDateList(row.is_present);
    const holidayDates = parseLegacyDateList(row.holidays);
    const absentReasons = parseLegacyAbsentReasons(row.absent_reasons);
    const generatedDate = legacyAttendanceDateOrNull(row.generated_date);
    const certificateExpiryDate = legacyAttendanceDateOrNull(row.certificate_expiry_date);
    const markAsRead = Number(row.mark_as_read || 0) ? 1 : 0;
    const attendanceByDate = new Map();

    for (const date of presentDates) {
      attendanceByDate.set(date, { status: "Present", reason: null });
    }
    for (const date of holidayDates) {
      attendanceByDate.set(date, { status: "Holiday", reason: null });
    }
    for (const [date, reason] of Object.entries(absentReasons)) {
      attendanceByDate.set(date, { status: "Absent", reason });
    }

    if (!ctx.dryRun) {
      const [result] = await ctx.target.execute(
        `UPDATE courses_enrollment
         SET is_present = ?, holidays = ?, absent_reasons = ?,
             generated_date = COALESCE(generated_date, ?),
             certificate_issue_date = COALESCE(certificate_issue_date, ?),
             active = COALESCE(active, ?)
         WHERE course_id = ? AND candidate_id = ?`,
        [
          presentDates.join(","),
          holidayDates.join(","),
          JSON.stringify(absentReasons),
          generatedDate,
          generatedDate,
          row.active === null || row.active === undefined ? null : Number(row.active || 0),
          courseId,
          candidateId,
        ],
      );
      if (result.affectedRows > 0) {
        summary.enrollment_updates += 1;
      } else {
        summary.missing_enrollment += 1;
      }
    } else {
      summary.enrollment_updates += 1;
    }

    for (const [date, attendance] of attendanceByDate.entries()) {
      const attendanceId = legacyUuid(
        ENTITY.courseAttendance,
        `${row.id}:${date}`,
      );
      await ctx.upsert(
        "course_attendance",
        {
          id: attendanceId,
          course_id: courseId,
          candidate_id: candidateId,
          attendance_date: date,
          status: attendance.status,
          absent_reasons: attendance.reason,
          certificate_issue_date: generatedDate,
          certificate_expiry_date: certificateExpiryDate,
          mark_as_read: markAsRead,
          created_at: dateTimeOrNull(row.created_at),
          updated_at: dateTimeOrNull(row.updated_at),
        },
        {
          entityType: ENTITY.courseAttendance,
          legacyId: `${row.id}:${date}`,
          newId: attendanceId,
        },
      );
      summary.attendance_rows += 1;
      if (summary.samples.length < 50) {
        summary.samples.push({
          legacy_attendance_id: row.id,
          course_id: row.course_id,
          candidate_id: row.candidate_id,
          attendance_date: date,
          status: attendance.status,
          absent_reasons: attendance.reason,
        });
      }
    }
  }

  ctx.summary.course_attendance = summary;
  ctx.increment("course_attendance_checked", summary.checked);
  ctx.increment("course_attendance_rows", summary.attendance_rows);
  ctx.increment("course_attendance_enrollment_updates", summary.enrollment_updates);
  ctx.increment("course_attendance_missing_enrollment", summary.missing_enrollment);
}

async function importHotelFiles(ctx) {
  const rows = await ctx.selectLegacy("hotel_files");
  if (rows.length === 0) return;

  const idIsText = await ctx.isTextColumn("hotel_files", "id");
  const ceIsText = await ctx.isTextColumn("hotel_files", "ce_id");
  const candidateIsText = await ctx.isTextColumn("hotel_files", "candidate_id");

  for (const row of rows) {
    if (ctx.incremental && (await ctx.hasLegacyMap(ENTITY.hotelFile, row.id))) {
      ctx.skip(`${ENTITY.hotelFile}_incremental_existing`);
      continue;
    }

    const plannedName = ctx.legacyFileStoredValue(
      row.file_name,
      "",
      `hotel-file-${row.id}`,
    );
    const newId = legacyUuid(ENTITY.hotelFile, row.id);
    const hotelFileRow = {
      id: idIsText ? newId : undefined,
      ce_id: ceIsText ? legacyUuid(ENTITY.enrollment, row.ce_id) : row.ce_id,
      candidate_id: candidateIsText
        ? legacyUuid(ENTITY.candidate, row.candidate_id)
        : row.candidate_id,
      file_name: plannedName,
      file_type: row.file_type || null,
      uploaded_at: dateTimeOrNull(row.uploaded_at),
      status: row.status === undefined ? 1 : row.status,
    };

    if (idIsText) {
      hotelFileRow.file_name = ctx.copyLegacyFile(
        row.file_name,
        "uploads/venues",
        "",
        `hotel-file-${row.id}`,
      );
      await ctx.upsert(
        "hotel_files",
        hotelFileRow,
        { entityType: ENTITY.hotelFile, legacyId: row.id, newId },
      );
    } else {
      const [existingRows] = await ctx.target.query(
        `SELECT id
         FROM hotel_files
         WHERE ce_id <=> ?
           AND candidate_id <=> ?
           AND file_name <=> ?
         LIMIT 1`,
        [hotelFileRow.ce_id, hotelFileRow.candidate_id, hotelFileRow.file_name],
      );
      if (existingRows[0]?.id) {
        ctx.skip(`${ENTITY.hotelFile}_incremental_existing`);
        if (!ctx.dryRun) {
          await ctx.mapLegacyId(ENTITY.hotelFile, row.id, existingRows[0].id);
        }
      } else {
        hotelFileRow.file_name = ctx.copyLegacyFile(
          row.file_name,
          "uploads/venues",
          "",
          `hotel-file-${row.id}`,
        );
        ctx.noteIncrementalNew({
          entityType: ENTITY.hotelFile,
          legacyId: row.id,
          newId,
        });
        if (!ctx.dryRun) {
          const columns = await ctx.targetColumns("hotel_files");
          const filtered = Object.entries(hotelFileRow).filter(
            ([key, value]) => value !== undefined && columns.has(key),
          );
          const names = filtered.map(([key]) => key);
          const values = filtered.map(([, value]) => value);
          const placeholders = names.map(() => "?").join(", ");
          const [result] = await ctx.target.execute(
            `INSERT INTO hotel_files (${names.map((name) => `\`${name}\``).join(", ")})
             VALUES (${placeholders})`,
            values,
          );
          await ctx.mapLegacyId(ENTITY.hotelFile, row.id, result.insertId);
        }
      }
    }
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
  const fallbackResultMap = new Map();

  for (const row of rows) {
    if (alreadyMapped.has(String(row.id))) {
      ctx.skip("assessment_answers_already_imported");
      continue;
    }

    let assessmentResultId = answerResultMap.get(String(row.id));
    if (!assessmentResultId) {
      const fallbackKey = `${row.candidate_id}:${row.assessment_id}`;
      if (!fallbackResultMap.has(fallbackKey)) {
        const [resultRows] = await ctx.target.query(
          `SELECT id
           FROM assessment_results
           WHERE candidate_id = ? AND assessment_id = ?
           ORDER BY created_at, id`,
          [
            legacyUuid(ENTITY.candidate, row.candidate_id),
            legacyUuid(ENTITY.assessment, row.assessment_id),
          ],
        );
        fallbackResultMap.set(
          fallbackKey,
          resultRows.length === 1 ? resultRows[0].id : null,
        );
      }
      assessmentResultId = fallbackResultMap.get(fallbackKey) || null;
    }
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

function addAuditCheck(audit, name, status, severity, details = {}) {
  const check = { name, status, severity, ...details };
  audit.checks.push(check);
  audit.summary[status] = (audit.summary[status] || 0) + 1;
  if (status === "fail" && severity === "critical") {
    audit.critical_blockers.push(check);
  }
  return check;
}

async function scalar(connection, sql, params = [], fallback = 0) {
  const [rows] = await connection.query(sql, params);
  const first = rows[0] || {};
  const key = Object.keys(first)[0];
  return key ? first[key] : fallback;
}

async function legacyCountIfPresent(ctx, tableName) {
  if (!(await ctx.legacyHasTable(tableName))) return 0;
  return scalar(ctx.legacy, `SELECT COUNT(*) AS total FROM \`${tableName}\``);
}

async function targetCountIfPresent(ctx, tableName) {
  if (!(await ctx.targetHasTable(tableName))) return 0;
  return scalar(ctx.target, `SELECT COUNT(*) AS total FROM \`${tableName}\``);
}

async function mappedCount(ctx, entityType) {
  if (!(await ctx.targetHasTable("legacy_id_map"))) return 0;
  return scalar(
    ctx.target,
    "SELECT COUNT(*) AS total FROM legacy_id_map WHERE entity_type = ?",
    [entityType],
  );
}

async function auditRowCounts(ctx, audit) {
  const modules = [
    ["candidate", ENTITY.candidate, "users", true],
    ["trainer", ENTITY.trainer, "users", true],
    ["master_course", ENTITY.masterCourse, "master_course", true],
    ["course", ENTITY.course, "courses", true],
    ["courses_enrollment", ENTITY.enrollment, "courses_enrollment", true],
    ["course_attendance", ENTITY.courseAttendance, "course_attendance", true],
    ["hotel_details", ENTITY.hotelDetail, "hotel_details", true],
    ["hotel_files", ENTITY.hotelFile, "hotel_files", false],
    ["certificate", ENTITY.certificate, "certificates", true],
    ["question_bank", ENTITY.question, "question_bank", true],
    ["assessment", ENTITY.assessment, "assessment", true],
    ["assessment_score", ENTITY.assessmentResult, "assessment_results", true],
    ["assessment_question_answer", ENTITY.assessmentAnswer, "assessment_answers", true],
    ["feedback_category", ENTITY.feedbackCategory, "feedback_categories", true],
    ["feedback", ENTITY.feedbackForm, "feedback_forms", true],
    ["feedback_question", ENTITY.feedbackQuestion, "feedback_questions", true],
    ["feedback_question_option", ENTITY.feedbackOption, "feedback_question_options", true],
    ["feedback_question_answer", ENTITY.feedbackAnswer, "feedback_question_answer", true],
  ];

  const rows = [];
  for (const [legacyTable, entityType, targetTable, requiresMap] of modules) {
    const legacyTotal = await legacyCountIfPresent(ctx, legacyTable);
    const targetTotal = await targetCountIfPresent(ctx, targetTable);
    const mappedTotal = await mappedCount(ctx, entityType);
    rows.push({
      legacyTable,
      targetTable,
      legacyTotal,
      targetTotal,
      mappedTotal,
      requiresMap,
    });
  }

  const mismatches = rows.filter(
    (row) =>
      row.legacyTotal > 0 &&
      (row.requiresMap
        ? row.mappedTotal < row.legacyTotal
        : row.targetTotal < row.legacyTotal),
  );
  addAuditCheck(
    audit,
    "legacy row counts mapped into target",
    mismatches.length ? "warn" : "pass",
    "warning",
    { rows, mismatches: mismatches.slice(0, 25) },
  );
}

async function auditMappedUsers(ctx, audit) {
  const [rows] = await ctx.target.query(
    `SELECT lim.entity_type, COUNT(*) AS mapped_total, SUM(u.id IS NULL) AS missing_user
     FROM legacy_id_map lim
     LEFT JOIN users u ON u.id = lim.new_id
     WHERE lim.entity_type IN (?, ?)
     GROUP BY lim.entity_type`,
    [ENTITY.candidate, ENTITY.trainer],
  );
  const missing = rows.reduce((sum, row) => sum + Number(row.missing_user || 0), 0);
  addAuditCheck(
    audit,
    "candidate/trainer legacy maps have users",
    missing ? "fail" : "pass",
    "critical",
    { rows },
  );
}

async function auditCandidateRegistrationTypes(ctx, audit) {
  const legacyRows = await ctx.selectLegacy("candidate");
  const [targetRows] = await ctx.target.query(
    `SELECT lim.legacy_id, cp.registration_type
     FROM legacy_id_map lim
     LEFT JOIN candidate_profiles cp ON cp.user_id = lim.new_id
     WHERE lim.entity_type = ?`,
    [ENTITY.candidate],
  );
  const targetByLegacyId = new Map(
    targetRows.map((row) => [String(row.legacy_id), row.registration_type]),
  );
  const desiredCounts = {};
  const actualCounts = {};
  const samples = [];
  let mismatches = 0;

  for (const row of legacyRows) {
    const desired = registrationType(row.registration_type);
    const actual = targetByLegacyId.get(String(row.id));
    desiredCounts[desired] = (desiredCounts[desired] || 0) + 1;
    actualCounts[actual || "missing"] = (actualCounts[actual || "missing"] || 0) + 1;
    if (actual !== desired) {
      mismatches += 1;
      if (samples.length < 25) {
        samples.push({
          legacy_id: row.id,
          email: row.email,
          legacy_registration_type: row.registration_type,
          expected: desired,
          actual,
        });
      }
    }
  }

  addAuditCheck(
    audit,
    "candidate registration type labels",
    mismatches ? "fail" : "pass",
    "critical",
    { mismatches, desiredCounts, actualCounts, samples },
  );
}

async function auditCandidateNames(ctx, audit) {
  const legacyRows = await ctx.selectLegacy("candidate");
  const [targetRows] = await ctx.target.query(
    `SELECT lim.legacy_id, u.first_name, u.middle_name, u.last_name, cp.middle_name AS profile_middle_name
     FROM legacy_id_map lim
     LEFT JOIN users u ON u.id = lim.new_id
     LEFT JOIN candidate_profiles cp ON cp.user_id = lim.new_id
     WHERE lim.entity_type = ?`,
    [ENTITY.candidate],
  );
  const targetByLegacyId = new Map(
    targetRows.map((row) => [String(row.legacy_id), row]),
  );
  const samples = [];
  let mismatches = 0;

  for (const row of legacyRows) {
    const target = targetByLegacyId.get(String(row.id));
    if (!target) continue;
    const expected = parseCandidateName(row);
    const changed =
      !sameNameValue(target.first_name, expected.firstName) ||
      !sameNameValue(target.middle_name, expected.middleName) ||
      !sameNameValue(target.last_name, expected.lastName) ||
      !sameNameValue(target.profile_middle_name, expected.middleName);
    if (!changed) continue;
    mismatches += 1;
    if (samples.length < 25) {
      samples.push({
        legacy_id: row.id,
        candidate_name: row.candidate_name,
        expected,
        actual: {
          firstName: target.first_name,
          middleName: target.middle_name,
          lastName: target.last_name,
          profileMiddleName: target.profile_middle_name,
        },
      });
    }
  }

  addAuditCheck(
    audit,
    "candidate names split into first/middle/last",
    mismatches ? "fail" : "pass",
    "critical",
    { mismatches, samples },
  );
}

async function auditCourseDatesAndLocations(ctx, audit) {
  const courseRows = await ctx.selectLegacy("course");
  const locationLookup = buildLocationLookup(await ctx.selectLegacy("location"));
  const [targetRows] = await ctx.target.query(
    `SELECT lim.legacy_id, c.id, c.course_id, c.course_name, c.start_date, c.end_date, c.location_id
     FROM legacy_id_map lim
     LEFT JOIN courses c ON c.id = lim.new_id
     WHERE lim.entity_type = ?`,
    [ENTITY.course],
  );
  const targetByLegacyId = new Map(
    targetRows.map((row) => [String(row.legacy_id), row]),
  );
  const dateSamples = [];
  const locationSamples = [];
  let dateMismatches = 0;
  let locationMismatches = 0;

  for (const row of courseRows) {
    const target = targetByLegacyId.get(String(row.id));
    if (!target) continue;
    const expectedStart = courseDateTimeOrNull(row.start_date);
    const expectedEnd = courseDateTimeOrNull(row.end_date);
    if (
      !sameDateTimeValue(target.start_date, expectedStart) ||
      !sameDateTimeValue(target.end_date, expectedEnd)
    ) {
      dateMismatches += 1;
      if (dateSamples.length < 25) {
        dateSamples.push({
          legacy_id: row.id,
          course_id: row.course_id,
          expected: { start_date: expectedStart, end_date: expectedEnd },
          actual: { start_date: target.start_date, end_date: target.end_date },
        });
      }
    }

    const expectedLocationId = resolveCourseLocationId(row, locationLookup);
    if ((target.location_id || null) !== (expectedLocationId || null)) {
      locationMismatches += 1;
      if (locationSamples.length < 25) {
        locationSamples.push({
          legacy_id: row.id,
          course_id: row.course_id,
          type_of_location: row.type_of_location,
          expected_location_id: expectedLocationId,
          actual_location_id: target.location_id,
        });
      }
    }
  }

  addAuditCheck(
    audit,
    "course start/end dates match legacy",
    dateMismatches ? "fail" : "pass",
    "critical",
    { mismatches: dateMismatches, samples: dateSamples },
  );
  addAuditCheck(
    audit,
    "course locations mapped from legacy",
    locationMismatches ? "warn" : "pass",
    "warning",
    { mismatches: locationMismatches, samples: locationSamples },
  );
}

async function auditKnownCourses(ctx, audit) {
  const knownCourses = ["BBS-2026-036", "HAZM-2026-11", "LNGRS-2026-005"];
  const rows = [];
  for (const code of knownCourses) {
    const [legacyRows] = await ctx.legacy.query(
      "SELECT id, course_id, course_name, start_date, end_date FROM course WHERE course_id = ? OR course_name = ? LIMIT 5",
      [code, code],
    );
    const [targetRows] = await ctx.target.query(
      "SELECT id, course_id, course_name, start_date, end_date FROM courses WHERE course_id = ? OR course_name = ? LIMIT 5",
      [code, code],
    );
    rows.push({ code, legacyRows, targetRows });
  }
  const missing = rows.filter(
    (row) => row.legacyRows.length > 0 && row.targetRows.length === 0,
  );
  addAuditCheck(
    audit,
    "known active courses searchable in target",
    missing.length ? "fail" : "pass",
    "critical",
    { rows },
  );
}

async function auditAttendance(ctx, audit) {
  const legacyRows = await ctx.selectLegacy("course_attendance");
  const expected = new Map();
  for (const row of legacyRows) {
    const dates = Object.keys(parseLegacyAbsentReasons(row.absent_reasons));
    if (!dates.length) continue;
    const key = `${legacyUuid(ENTITY.course, row.course_id)}:${legacyUuid(
      ENTITY.candidate,
      row.candidate_id,
    )}`;
    expected.set(key, (expected.get(key) || 0) + dates.length);
  }

  const [targetRows] = await ctx.target.query(
    `SELECT course_id, candidate_id, COUNT(*) AS absent_total
     FROM course_attendance
     WHERE LOWER(status) = 'absent'
     GROUP BY course_id, candidate_id`,
  );
  const actual = new Map(
    targetRows.map((row) => [`${row.course_id}:${row.candidate_id}`, Number(row.absent_total)]),
  );
  const samples = [];
  let mismatches = 0;
  for (const [key, expectedCount] of expected.entries()) {
    const actualCount = actual.get(key) || 0;
    if (actualCount === expectedCount) continue;
    mismatches += 1;
    if (samples.length < 25) samples.push({ key, expectedCount, actualCount });
  }

  addAuditCheck(
    audit,
    "attendance absent counts match legacy",
    mismatches ? "fail" : "pass",
    "critical",
    {
      legacy_absent_pairs: expected.size,
      mismatches,
      samples,
    },
  );
}

async function auditPasswords(ctx, audit) {
  const [nonHashRows] = await ctx.target.query(
    `SELECT u.email, r.name AS role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     JOIN legacy_id_map lim ON lim.new_id = u.id AND lim.entity_type IN (?, ?)
     WHERE r.name IN ('candidate', 'trainer') AND u.password NOT REGEXP '^\\\\$2[aby]\\\\$'
     LIMIT 25`,
    [ENTITY.candidate, ENTITY.trainer],
  );

  const samples = [];
  for (const [entityType, tableName] of [
    [ENTITY.candidate, "candidate"],
    [ENTITY.trainer, "trainer"],
  ]) {
    const [rows] = await ctx.target.query(
      `SELECT lim.legacy_id, u.email, u.password
       FROM legacy_id_map lim
       JOIN users u ON u.id = lim.new_id
       WHERE lim.entity_type = ?
       LIMIT 20`,
      [entityType],
    );
    for (const row of rows) {
      const [legacyRows] = await ctx.legacy.query(
        `SELECT password FROM \`${tableName}\` WHERE id = ? LIMIT 1`,
        [row.legacy_id],
      );
      const legacyPassword = normalizeText(legacyRows[0]?.password);
      if (!legacyPassword) continue;
      const matches = looksLikeBcryptHash(legacyPassword)
        ? row.password === legacyPassword
        : await bcrypt.compare(legacyPassword, row.password || "");
      samples.push({ entityType, email: row.email, matches });
    }
  }

  const failedSamples = samples.filter((sample) => !sample.matches);
  addAuditCheck(
    audit,
    "legacy passwords hashed and sample-match",
    nonHashRows.length || failedSamples.length ? "fail" : "pass",
    "critical",
    { nonHashSamples: nonHashRows, comparedSamples: samples, failedSamples },
  );
}

async function auditTrainerPermissions(ctx, audit) {
  const expectedSlugs = TRAINER_ROLE_PERMISSIONS.map((permission) => permission.slug);
  const [rows] = await ctx.target.query(
    `SELECT p.slug
     FROM roles r
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE LOWER(r.name) = 'trainer'`,
  );
  const actual = new Set(rows.map((row) => row.slug));
  const missing = expectedSlugs.filter((slug) => !actual.has(slug));
  addAuditCheck(
    audit,
    "trainer role has portal menu permissions",
    missing.length ? "fail" : "pass",
    "critical",
    { expectedSlugs, actualSlugs: [...actual].sort(), missing },
  );
}

async function auditUploads(ctx, audit) {
  if (!ctx.oldUploadRoot) {
    addAuditCheck(audit, "legacy upload folder configured", "warn", "warning", {
      message: "OLD_UPLOAD_ROOT is not set; file existence audit skipped.",
    });
    return;
  }

  const sources = [
    ["candidate", "candidate", ["profile_image"]],
    ["trainer", "trainer", ["digital_signature", "profile_photo"]],
    ["question_bank", "question_bank", ["image", "opt_img_a", "opt_img_b", "opt_img_c", "opt_img_d"]],
    ["hotel_files", "hotel_files", ["file_name"]],
  ];
  const samples = [];
  let checked = 0;
  let missing = 0;
  for (const [label, tableName, columns] of sources) {
    if (!(await ctx.legacyHasTable(tableName))) continue;
    const [rows] = await ctx.legacy.query(`SELECT * FROM \`${tableName}\``);
    for (const row of rows) {
      for (const column of columns) {
        const value = normalizeText(row[column]);
        if (!value) continue;
        checked += 1;
        if (ctx.findLegacyFile(value)) continue;
        missing += 1;
        if (samples.length < 50) {
          samples.push({ label, legacy_id: row.id, column, value });
        }
      }
    }
  }
  addAuditCheck(
    audit,
    "legacy upload files are available",
    missing ? "warn" : "pass",
    "warning",
    { checked, missing, samples },
  );
}

async function auditFeedbackStatus(ctx, audit) {
  const [rows] = await ctx.target.query(
    `SELECT COUNT(*) AS mismatches
     FROM legacy_id_map lim
     JOIN feedback_questions fq ON fq.id = lim.new_id
     JOIN ${ctx.legacy.config?.database ? `\`${ctx.legacy.config.database}\`.` : ""}feedback_question legacy_fq
       ON legacy_fq.id = lim.legacy_id
     WHERE lim.entity_type = ? AND COALESCE(fq.status, 1) <> COALESCE(legacy_fq.status, 1)`,
    [ENTITY.feedbackQuestion],
  ).catch(async () => {
    const legacyRows = await ctx.selectLegacy("feedback_question");
    const [targetRows] = await ctx.target.query(
      `SELECT lim.legacy_id, fq.status
       FROM legacy_id_map lim
       JOIN feedback_questions fq ON fq.id = lim.new_id
       WHERE lim.entity_type = ?`,
      [ENTITY.feedbackQuestion],
    );
    const targetByLegacyId = new Map(
      targetRows.map((row) => [String(row.legacy_id), row.status]),
    );
    let mismatches = 0;
    for (const row of legacyRows) {
      if (Number(targetByLegacyId.get(String(row.id)) ?? 1) !== Number(row.status ?? 1)) {
        mismatches += 1;
      }
    }
    return [[{ mismatches }]];
  });
  const mismatches = Number(rows[0]?.mismatches || 0);
  addAuditCheck(
    audit,
    "feedback question active/inactive status preserved",
    mismatches ? "warn" : "pass",
    "warning",
    { mismatches },
  );
}

async function auditCertificates(ctx, audit) {
  const legacyCertificates = await legacyCountIfPresent(ctx, "certificate");
  const mappedCertificates = await mappedCount(ctx, ENTITY.certificate);
  const [duplicateRows] = await ctx.target.query(
    `SELECT certificate_no, COUNT(*) AS total
     FROM certificates
     WHERE certificate_no IS NOT NULL AND certificate_no <> ''
     GROUP BY certificate_no
     HAVING COUNT(*) > 1
     LIMIT 25`,
  );
  addAuditCheck(
    audit,
    "certificate rows and numbers migrated",
    mappedCertificates < legacyCertificates || duplicateRows.length ? "fail" : "pass",
    "critical",
    { legacyCertificates, mappedCertificates, duplicateRows },
  );

  const [sequenceMismatches] = await ctx.target.query(
    `SELECT expected.scope_type, expected.scope_key, expected.sequence_year,
            expected.expected_next_subid, cs.next_subid
     FROM (
       SELECT 'topic_year' AS scope_type, topic AS scope_key, YEAR(issue_date) AS sequence_year,
              COALESCE(MAX(subid), 0) + 1 AS expected_next_subid
       FROM certificates
       WHERE type IN ('Others', 'DNV-ST0029', 'DNV-ST008')
         AND topic IS NOT NULL AND issue_date IS NOT NULL
       GROUP BY topic, YEAR(issue_date)
       UNION ALL
       SELECT 'type' AS scope_type, type AS scope_key, 0 AS sequence_year,
              COALESCE(MAX(subid), 0) + 1 AS expected_next_subid
       FROM certificates
       WHERE type NOT IN ('Others', 'DNV-ST0029', 'DNV-ST008')
         AND type IS NOT NULL
       GROUP BY type
     ) expected
     LEFT JOIN certificate_sequences cs
       ON cs.scope_type = expected.scope_type
      AND cs.scope_key = expected.scope_key
      AND cs.sequence_year = expected.sequence_year
     WHERE cs.next_subid IS NULL OR cs.next_subid <> expected.expected_next_subid
     LIMIT 25`,
  );
  addAuditCheck(
    audit,
    "certificate sequence table matches imported certificates",
    sequenceMismatches.length ? "fail" : "pass",
    "critical",
    { sequenceMismatches },
  );
}

async function runLegacyAudit(ctx) {
  const audit = {
    started_at: new Date().toISOString(),
    summary: { pass: 0, warn: 0, fail: 0 },
    checks: [],
    critical_blockers: [],
  };

  await auditRowCounts(ctx, audit);
  await auditMappedUsers(ctx, audit);
  await auditCandidateRegistrationTypes(ctx, audit);
  await auditCandidateNames(ctx, audit);
  await auditCourseDatesAndLocations(ctx, audit);
  await auditKnownCourses(ctx, audit);
  await auditAttendance(ctx, audit);
  await auditPasswords(ctx, audit);
  await auditTrainerPermissions(ctx, audit);
  await auditUploads(ctx, audit);
  await auditFeedbackStatus(ctx, audit);
  await auditCertificates(ctx, audit);

  audit.finished_at = new Date().toISOString();
  audit.has_critical_blockers = audit.critical_blockers.length > 0;
  ctx.summary.audit = audit;
  ctx.auditHasCriticalBlockers = audit.has_critical_blockers;
  ctx.increment("audit_checks", audit.checks.length);
  ctx.increment("audit_critical_blockers", audit.critical_blockers.length);
}

async function groupedCounts(connection, tableName, columnName, tableExists) {
  if (!(await tableExists(tableName))) return [];
  const [rows] = await connection
    .query(
      `SELECT COALESCE(NULLIF(TRIM(CAST(\`${columnName}\` AS CHAR)), ''), 'missing') AS value,
              COUNT(*) AS total
       FROM \`${tableName}\`
       GROUP BY COALESCE(NULLIF(TRIM(CAST(\`${columnName}\` AS CHAR)), ''), 'missing')
       ORDER BY total DESC, value ASC`,
    )
    .catch(() => [[]]);
  return rows;
}

async function runSourceCounts(ctx) {
  const modules = [
    ["candidate", ENTITY.candidate, "candidate_profiles"],
    ["trainer", ENTITY.trainer, "trainer_profiles"],
    ["master_course", ENTITY.masterCourse, "master_course"],
    ["location", ENTITY.location, "locations"],
    ["course", ENTITY.course, "courses"],
    ["courses_enrollment", ENTITY.enrollment, "courses_enrollment"],
    ["course_attendance", ENTITY.courseAttendance, "course_attendance"],
    ["hotel_details", ENTITY.hotelDetail, "hotel_details"],
    ["hotel_files", ENTITY.hotelFile, "hotel_files"],
    ["certificate", ENTITY.certificate, "certificates"],
    ["question_bank", ENTITY.question, "question_bank"],
    ["assessment", ENTITY.assessment, "assessment"],
    ["assessment_score", ENTITY.assessmentResult, "assessment_results"],
    ["assessment_question_answer", ENTITY.assessmentAnswer, "assessment_answers"],
    ["feedback_category", ENTITY.feedbackCategory, "feedback_categories"],
    ["feedback", ENTITY.feedbackForm, "feedback_forms"],
    ["feedback_question", ENTITY.feedbackQuestion, "feedback_questions"],
    ["feedback_question_option", ENTITY.feedbackOption, "feedback_question_options"],
    ["feedback_question_answer", ENTITY.feedbackAnswer, "feedback_question_answer"],
  ];

  const byModule = [];
  for (const [legacyTable, entityType, targetTable] of modules) {
    const legacyTotal = await legacyCountIfPresent(ctx, legacyTable);
    const targetTotal = await targetCountIfPresent(ctx, targetTable);
    const mappedTotal = await mappedCount(ctx, entityType);
    byModule.push({
      legacyTable,
      entityType,
      targetTable,
      legacyTotal,
      targetTotal,
      mappedTotal,
      unmappedLegacyRows: Math.max(legacyTotal - mappedTotal, 0),
    });
  }

  const usersHasMergedInto = await ctx.targetHasColumn("users", "merged_into_user_id");
  const mergedCondition = usersHasMergedInto ? "AND u.merged_into_user_id IS NULL" : "";
  const visibleCandidateTotal = await scalar(
    ctx.target,
    `SELECT COUNT(*) AS total
     FROM users u
     JOIN roles r ON r.id = u.role_id
     JOIN candidate_profiles cp ON cp.user_id = u.id
     WHERE LOWER(r.name) = 'candidate'
       AND COALESCE(u.status, 1) = 1
       ${mergedCondition}`,
  );
  const visibleTrainerTotal = await scalar(
    ctx.target,
    `SELECT COUNT(*) AS total
     FROM users u
     JOIN roles r ON r.id = u.role_id
     JOIN trainer_profiles tp ON tp.user_id = u.id
     WHERE LOWER(r.name) = 'trainer'
       AND COALESCE(u.status, 1) = 1
       AND COALESCE(tp.status, 1) = 1`,
  );
  const activeCourseTotal = await scalar(
    ctx.target,
    `SELECT COUNT(*) AS total
     FROM courses
     WHERE COALESCE(status, '') <> 'Deleted'`,
  );

  const [mapRows] = (await ctx.targetHasTable("legacy_id_map"))
    ? await ctx.target.query(
        `SELECT entity_type, COUNT(*) AS total
         FROM legacy_id_map
         GROUP BY entity_type
         ORDER BY entity_type`,
      )
    : [[]];

  ctx.summary.source_counts = {
    generated_at: new Date().toISOString(),
    note:
      "Read-only report. Restore the latest PHP legacy dump before trusting these counts for incremental migration.",
    byModule,
    legacyBreakdowns: {
      candidateIsActive: await groupedCounts(
        ctx.legacy,
        "candidate",
        "is_active",
        (table) => ctx.legacyHasTable(table),
      ),
      candidateRegistrationType: await groupedCounts(
        ctx.legacy,
        "candidate",
        "registration_type",
        (table) => ctx.legacyHasTable(table),
      ),
      trainerStatus: await groupedCounts(
        ctx.legacy,
        "trainer",
        "status",
        (table) => ctx.legacyHasTable(table),
      ),
      courseStatus: await groupedCounts(
        ctx.legacy,
        "course",
        "status",
        (table) => ctx.legacyHasTable(table),
      ),
      courseTypeOfStatus: await groupedCounts(
        ctx.legacy,
        "course",
        "type_of_status",
        (table) => ctx.legacyHasTable(table),
      ),
      certificateStatus: await groupedCounts(
        ctx.legacy,
        "certificate",
        "status",
        (table) => ctx.legacyHasTable(table),
      ),
    },
    targetVisibleCounts: {
      candidates: visibleCandidateTotal,
      trainers: visibleTrainerTotal,
      activeCourses: activeCourseTotal,
      certificates: await targetCountIfPresent(ctx, "certificates"),
    },
    targetMappedCounts: mapRows,
    incrementalPreview: byModule
      .filter((row) => row.unmappedLegacyRows > 0)
      .map((row) => ({
        entityType: row.entityType,
        legacyTable: row.legacyTable,
        unmappedLegacyRows: row.unmappedLegacyRows,
      })),
  };

  for (const row of byModule) {
    ctx.increment(`source_${row.legacyTable}`, row.legacyTotal);
    ctx.increment(`mapped_${row.entityType}`, row.mappedTotal);
  }
}

async function repairAll(ctx) {
  await ensureSupportTables(ctx);
  await repairCandidateNames(ctx);
  await repairLocations(ctx);
  await repairCourseDates(ctx);
  await importCourseAttendance(ctx);
  await repairLegacyPasswords(ctx);
  await seedTrainerPermissions(ctx);

  ctx.summary.certificate_sequence_repair = {
    would_reinitialize: ctx.dryRun,
    reinitialized: !ctx.dryRun,
  };
  if (!ctx.dryRun) {
    await initializeCertificateSequences(ctx);
    ctx.increment("certificate_sequences_reinitialized");
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
      await seedTrainerPermissions(ctx);
      const masterCourses = await importMasterCourses(ctx);
      await importCandidates(ctx);
      await importTrainers(ctx);
      const locationLookup = await importLocations(ctx);
      await importCourses(ctx, masterCourses, locationLookup);
      await importEnrollments(ctx);
      await importCourseAttendance(ctx);
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
  const reportName =
    ctx.mode === "audit"
      ? `legacy-migration-audit-${ctx.summary.started_at.replace(/[:.]/g, "-")}.json`
      : ctx.mode === "source-counts"
        ? `legacy-migration-source-counts-${ctx.summary.started_at.replace(/[:.]/g, "-")}.json`
      : ctx.mode === "incremental"
        ? `legacy-migration-incremental-${runId}.json`
      : `legacy-migration-${runId}.json`;
  const reportPath = path.join(REPORT_DIR, reportName);
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
    incremental: args.incremental,
    resumeFrom: args.resumeFrom,
  });

  try {
    if (args.reset) {
      await resetImported(ctx);
    } else if (args.mode === "source-counts") {
      await runSourceCounts(ctx);
    } else if (args.mode === "audit") {
      await runLegacyAudit(ctx);
    } else if (args.mode === "copy-files-only") {
      await copyLegacyUploadedFiles(ctx);
    } else if (args.mode === "repair-all") {
      await repairAll(ctx);
    } else if (args.mode === "repair-candidate-names") {
      await ensureSupportTables(ctx);
      await repairCandidateNames(ctx);
    } else if (args.mode === "repair-locations") {
      await ensureSupportTables(ctx);
      await repairLocations(ctx);
    } else if (args.mode === "repair-course-dates") {
      await ensureSupportTables(ctx);
      await repairCourseDates(ctx);
    } else if (args.mode === "repair-attendance") {
      await ensureSupportTables(ctx);
      await importCourseAttendance(ctx);
    } else if (args.mode === "repair-passwords") {
      await ensureSupportTables(ctx);
      await repairLegacyPasswords(ctx);
    } else if (args.mode === "repair-trainer-permissions") {
      await seedTrainerPermissions(ctx);
    } else {
      await runMigration(ctx);
    }
    await writeReport(ctx, "success", runId);
    if (args.mode === "audit" && ctx.auditHasCriticalBlockers) {
      process.exitCode = 1;
    }
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
