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
  authKey: "MOLMI@AP1",
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

const importFromApi = async (req, res) => {
  try {
    const { date } = req.body; // Expecting date in YYYY-MM-DD
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
          "Ocp-Apim-Subscription-Key": SYNC_CONFIG.subscriptionKey, // Added for safety if required by APIM
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false, // Ignore SSL errors
        }),
      },
    );

    const apiData = response.data;
    const personnel = apiData.data?.PersonnelDetails_MOLMI || [];

    if (personnel.length === 0) {
      return res.status(200).json({
        message: "No new data found in API",
        stats: { inserted: 0, updated: 0, errors: 0 },
      });
    }

    const candidates = personnel.map((item) => {
      return {
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
        indos_number: "", // API doesn't seem to provide it directly in the same field names
        registration_type: "Other",
      };
    });

    const stats = await CandidateDao.bulkUpsert(candidates);

    await LogDao.createLog({
      user_id: req.user.id,
      action: "API_IMPORT_CANDIDATES",
      details: `Imported ${stats.inserted} new and updated ${stats.updated} candidates from API.`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });

    res.status(200).json({
      message: "API Import completed successfully",
      stats,
    });
  } catch (error) {
    console.error("API Import error details:", {
      message: error.message,
      response: error.response?.data,
      stack: error.stack,
    });

    if (error.response?.status === 403) {
      return res.status(403).json({
        message: "Access Forbidden by WAF (Azure Front Door)",
        error:
          "Your IP address is likely blocked by the external API firewall.",
        resolution:
          "Please use a VPN with a whitelisted IP or run this feature on the staging server.",
        details: error.response?.data,
      });
    }

    res.status(500).json({
      message: "Error importing from API",
      error: error.response?.data || error.message,
      details: error.stack,
    });
  }
};

module.exports = { importFromApi };
