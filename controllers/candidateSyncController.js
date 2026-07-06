const axios = require("axios");
const https = require("https");
const { v4: uuidv4 } = require("uuid");
const CandidateDao = require("../dao/candidateDao");
const CandidateSyncLogDao = require("../dao/CandidateSyncLogDao");
const LogDao = require("../dao/LogDao");

const { CANDIDATE_SYNC_CONFIG } = require("../utils/constants");

const getAccessToken = async () => {
  const params = new URLSearchParams();
  params.append("grant_type", "password");
  params.append("username", CANDIDATE_SYNC_CONFIG.username);
  params.append("Password", CANDIDATE_SYNC_CONFIG.password);

  const response = await axios.post(CANDIDATE_SYNC_CONFIG.tokenUrl, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Ocp-Apim-Subscription-Key": CANDIDATE_SYNC_CONFIG.subscriptionKey,
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
    }),
  });
  return response.data;
};

let isSyncing = false;

const normalizeSyncDate = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const directMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (directMatch) return directMatch[0];
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return null;

  return parsedDate.toISOString().split("T")[0];
};

const mapPersonnelToCandidates = (personnel = []) =>
  personnel.map((item) => ({
    first_name: item["First Name"] || "",
    last_name: item["Surname"] || "",
    email: (item["E-mail"] || "").replace(/\.invalid$/, ""),
    mobile: item["Mobile"] || "",
    middle_name: item["Middle Name"] || "",
    prefix: item["title"] || "",
    gender:
      item["Gender"] === "M"
        ? "Male"
        : item["Gender"] === "F"
          ? "Female"
          : null,
    dob: item["Birth Date"] || null,
    nationality: item["Country"] || "",
    passport_no: item["Passport No"] || "",
    employee_id: item["Employee No"] || "",
    manager: item["Manager"] || "",
    rank: item["Position"] || "",
    whatsapp_number: item["Mobile"] || "",
    alternate_mobile: item["Mobile 1"] || "",
    indos_number: "",
    registration_type: "MOLMI Employee",
  }));

const enrichWithExistingFlag = async (candidates) => {
  const emails = candidates.map((candidate) => candidate.email).filter(Boolean);
  const existingEmails = await CandidateDao.getExistingEmails(emails);

  return candidates.map((candidate) => ({
    ...candidate,
    isExisting: existingEmails.includes(candidate.email.toLowerCase()),
  }));
};

const persistSyncHistory = async (changes = [], syncDate) => {
  if (!Array.isArray(changes) || changes.length === 0) return;

  const syncBatchId = uuidv4();
  const normalizedSyncDate = normalizeSyncDate(syncDate);

  await CandidateSyncLogDao.createMany(
    changes.map((change) => ({
      ...change,
      sync_batch_id: syncBatchId,
      source_sync_date: normalizedSyncDate,
    })),
  );
};

const fetchExternalPreview = async (req, res) => {
  try {
    const { date } = req.body;
    const normalizedSyncDate = normalizeSyncDate(date);
    const tokenData = await getAccessToken();
    const token = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || "";

    const response = await axios.post(
      `${CANDIDATE_SYNC_CONFIG.apiUrl}?grant_type=refresh_token&refresh_token=${refreshToken}`,
      JSON.stringify({
        ServiceName: CANDIDATE_SYNC_CONFIG.serviceName,
        AuthorizationKey: CANDIDATE_SYNC_CONFIG.authKey,
        FromUTCDateTime: normalizedSyncDate || "1970-01-01",
      }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": CANDIDATE_SYNC_CONFIG.subscriptionKey,
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
        timeout: 60000,
      },
    );

    const personnel = response.data?.data?.PersonnelDetails_MOLMI || [];

    if (personnel.length === 0) {
      return res.json({
        data: [],
        message: "No data found for the selected date.",
        lastSyncedDate: normalizedSyncDate,
      });
    }

    const candidates = mapPersonnelToCandidates(personnel);
    const dataWithStatus = await enrichWithExistingFlag(candidates);

    res.json({
      data: dataWithStatus,
      total: dataWithStatus.length,
      lastSyncedDate: normalizedSyncDate,
    });
  } catch (error) {
    console.error("Fetch external preview error:", error.message);
    res
      .status(500)
      .json({ message: "Error fetching data from external API", error: error.message });
  }
};

const confirmBulkImport = async (req, res) => {
  try {
    if (isSyncing) {
      return res.status(429).json({ message: "An import is already in progress." });
    }

    const { candidates, syncDate } = req.body;
    const normalizedSyncDate = normalizeSyncDate(syncDate);

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ message: "No candidates provided for import." });
    }

    isSyncing = true;
    const userId = req.user.id;
    const userIp = req.ip;
    const userAgent = req.get("User-Agent");

    const syncResult = await CandidateDao.bulkUpsert(candidates, {
      captureChanges: true,
    });
    const { changes = [], ...stats } = syncResult;

    await persistSyncHistory(changes, normalizedSyncDate);

    await LogDao.createLog({
      user_id: userId,
      action: "API_IMPORT_CANDIDATES",
      details: `Imported ${stats.inserted} new and updated ${stats.updated} candidates from API confirm.`,
      ip_address: userIp,
      user_agent: userAgent,
    });
    req.skipActivityLog = true;

    res.json({
      message: "Import completed successfully",
      stats,
      lastSyncedDate: normalizedSyncDate,
    });
  } catch (error) {
    console.error("Confirm bulk import error:", error.message);
    res.status(500).json({ message: "Error performing bulk import", error: error.message });
  } finally {
    isSyncing = false;
  }
};

const importFromApi = async (req, res) => {
  try {
    if (isSyncing) {
      return res.status(429).json({ message: "An import is already in progress." });
    }

    const { date } = req.body;
    const normalizedSyncDate = normalizeSyncDate(date);
    const tokenData = await getAccessToken();
    const token = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || "";

    const response = await axios.post(
      `${CANDIDATE_SYNC_CONFIG.apiUrl}?grant_type=refresh_token&refresh_token=${refreshToken}`,
      JSON.stringify({
        ServiceName: CANDIDATE_SYNC_CONFIG.serviceName,
        AuthorizationKey: CANDIDATE_SYNC_CONFIG.authKey,
        FromUTCDateTime: normalizedSyncDate || "1970-01-01",
      }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": CANDIDATE_SYNC_CONFIG.subscriptionKey,
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
        timeout: 60000,
      },
    );

    const personnel = response.data?.data?.PersonnelDetails_MOLMI || [];
    if (personnel.length === 0) {
      return res.json({
        message: "No data found to import.",
        stats: { inserted: 0, updated: 0 },
        lastSyncedDate: normalizedSyncDate,
      });
    }

    const candidates = mapPersonnelToCandidates(personnel);

    isSyncing = true;
    const syncResult = await CandidateDao.bulkUpsert(candidates, {
      captureChanges: true,
    });
    const { changes = [], ...stats } = syncResult;

    await persistSyncHistory(changes, normalizedSyncDate);

    await LogDao.createLog({
      user_id: req.user?.id || 1,
      action: "API_DIRECT_IMPORT",
      details: `Direct import: ${stats.inserted} new, ${stats.updated} updated via import-api endpoint.`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });
    req.skipActivityLog = true;

    res.json({
      message: "Direct import completed successfully",
      stats,
      lastSyncedDate: normalizedSyncDate,
    });
  } catch (error) {
    console.error("Direct import error:", error.message);
    res.status(500).json({ message: "Error performing direct import", error: error.message });
  } finally {
    isSyncing = false;
  }
};

const getSyncHistory = async (req, res) => {
  try {
    const result = await CandidateSyncLogDao.getHistory({
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      days: req.query.days,
      registration_type: "MOLMI Employee",
    });

    res.json(result);
  } catch (error) {
    console.error("Get candidate sync history error:", error.message);
    res.status(500).json({
      message: "Error fetching candidate sync history",
      error: error.message,
    });
  }
};

module.exports = {
  importFromApi,
  fetchExternalPreview,
  confirmBulkImport,
  getSyncHistory,
};
