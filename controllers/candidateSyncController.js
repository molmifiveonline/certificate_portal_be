const axios = require("axios");
const https = require("https");
const CandidateDao = require("../dao/candidateDao");
const LogDao = require("../dao/LogDao");

const SYNC_CONFIG = {
  tokenUrl: "https://apim-mts-prod.azure-api.net/MOLMI-Training/api/Token",
  apiUrl:
    "https://apim-mts-prod.azure-api.net/MOLMI-Training/api/ShipmateWebService",
  username: "apiuser@sbntech.com",
  password: "u$eR@apI123",
  subscriptionKey: "d292c094732f423c8f5f7547aa98453a",
  authKey: "MOLMI_SBNT",
  serviceName: "PersonnelDetails_MOLMI",
};

const getAccessToken = async () => {
  const params = new URLSearchParams();
  params.append("grant_type", "password");
  params.append("username", SYNC_CONFIG.username);
  params.append("Password", SYNC_CONFIG.password);

  const response = await axios.post(SYNC_CONFIG.tokenUrl, params, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Ocp-Apim-Subscription-Key": SYNC_CONFIG.subscriptionKey,
    },
    httpsAgent: new https.Agent({
      rejectUnauthorized: false, // Ignore SSL errors
    }),
  });
  return response.data;
};

let isSyncing = false;

/**
 * Step 1: Fetch data from external API and return for preview
 */
const fetchExternalPreview = async (req, res) => {
  try {
    const { date } = req.body;
    const tokenData = await getAccessToken();
    const token = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || "";

    const response = await axios.post(
      `${SYNC_CONFIG.apiUrl}?grant_type=refresh_token&refresh_token=${refreshToken}`,
      JSON.stringify({
        ServiceName: SYNC_CONFIG.serviceName,
        AuthorizationKey: SYNC_CONFIG.authKey,
        FromUTCDateTime: date || "1970-01-01",
      }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": SYNC_CONFIG.subscriptionKey,
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
        timeout: 60000,
      },
    );

    const apiData = response.data;
    const personnel = apiData.data?.PersonnelDetails_MOLMI || [];

    if (personnel.length === 0) {
      return res.json({ data: [], message: "No data found for the selected date." });
    }

    // Map to our candidate format
    const candidates = personnel.map((item) => ({
      first_name: item["First Name"] || "",
      last_name: item["Surname"] || "",
      email: (item["E-mail"] || "").replace(/\.invalid$/, ""),
      mobile: item["Mobile"] || "",
      middle_name: item["Middle Name"] || "",
      prefix: item["title"] || "",
      gender: item["Gender"] === "M" ? "Male" : item["Gender"] === "F" ? "Female" : null,
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

    // Check which ones already exist
    const emails = candidates.map(c => c.email).filter(e => e);
    const existingEmails = await CandidateDao.getExistingEmails(emails);
    
    const dataWithStatus = candidates.map(c => ({
      ...c,
      isExisting: existingEmails.includes(c.email.toLowerCase())
    }));

    res.json({ data: dataWithStatus, total: dataWithStatus.length });
  } catch (error) {
    console.error("Fetch external preview error:", error.message);
    res.status(500).json({ message: "Error fetching data from external API", error: error.message });
  }
};

/**
 * Step 2: Confirm and perform bulk import
 */
const confirmBulkImport = async (req, res) => {
  try {
    if (isSyncing) {
      return res.status(429).json({ message: "An import is already in progress." });
    }

    const { candidates } = req.body;
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ message: "No candidates provided for import." });
    }

    isSyncing = true;
    const userId = req.user.id;
    const userIp = req.ip;
    const userAgent = req.get("User-Agent");

    const stats = await CandidateDao.bulkUpsert(candidates);

    await LogDao.createLog({
      user_id: userId,
      action: "API_IMPORT_CANDIDATES",
      details: `Imported ${stats.inserted} new and updated ${stats.updated} candidates from API confirm.`,
      ip_address: userIp,
      user_agent: userAgent,
    });

    res.json({ message: "Import completed successfully", stats });
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
    const tokenData = await getAccessToken();
    const token = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || "";

    const response = await axios.post(
      `${SYNC_CONFIG.apiUrl}?grant_type=refresh_token&refresh_token=${refreshToken}`,
      JSON.stringify({
        ServiceName: SYNC_CONFIG.serviceName,
        AuthorizationKey: SYNC_CONFIG.authKey,
        FromUTCDateTime: date || "1970-01-01",
      }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": SYNC_CONFIG.subscriptionKey,
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
        timeout: 60000,
      },
    );

    const personnel = response.data?.data?.PersonnelDetails_MOLMI || [];
    if (personnel.length === 0) {
      return res.json({ message: "No data found to import.", stats: { inserted: 0, updated: 0 } });
    }

    // Map to our candidate format
    const candidates = personnel.map((item) => ({
      first_name: item["First Name"] || "",
      last_name: item["Surname"] || "",
      email: (item["E-mail"] || "").replace(/\.invalid$/, ""),
      mobile: item["Mobile"] || "",
      middle_name: item["Middle Name"] || "",
      prefix: item["title"] || "",
      gender: item["Gender"] === "M" ? "Male" : item["Gender"] === "F" ? "Female" : null,
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

    isSyncing = true;
    const stats = await CandidateDao.bulkUpsert(candidates);

    // Optional: Log the background/direct sync
    await LogDao.createLog({
      user_id: req.user?.id || 1, // Default to admin if triggered externally/automated
      action: "API_DIRECT_IMPORT",
      details: `Direct import: ${stats.inserted} new, ${stats.updated} updated via import-api endpoint.`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });

    res.json({ message: "Direct import completed successfully", stats });
  } catch (error) {
    console.error("Direct import error:", error.message);
    res.status(500).json({ message: "Error performing direct import", error: error.message });
  } finally {
    isSyncing = false;
  }
};

module.exports = { importFromApi, fetchExternalPreview, confirmBulkImport };

