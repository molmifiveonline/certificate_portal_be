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

const importFromApi = async (req, res) => {
  try {
    if (isSyncing) {
      return res.status(429).json({
        message: "An import is already in progress. Please wait.",
      });
    }

    const { date } = req.body;
    const userId = req.user.id;
    const userIp = req.ip;
    const userAgent = req.get("User-Agent");

    // Return immediate response
    res.status(202).json({
      message: "Import started in the background. You can check the logs or refresh the candidate list in a few minutes.",
    });

    // Start background process
    (async () => {
      isSyncing = true;
      console.log(`[Background Sync] Started for date: ${date || "1970-01-01"}`);
      
      try {
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
            timeout: 60000, // 60 seconds timeout for the API call
          },
        );

        const apiData = response.data;
        const personnel = apiData.data?.PersonnelDetails_MOLMI || [];

        if (personnel.length === 0) {
          console.log("[Background Sync] No new data found in API");
          return;
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
            indos_number: "",
            registration_type: "Other",
          };
        });

        const stats = await CandidateDao.bulkUpsert(candidates);

        await LogDao.createLog({
          user_id: userId,
          action: "API_IMPORT_CANDIDATES",
          details: `Imported ${stats.inserted} new and updated ${stats.updated} candidates from API.`,
          ip_address: userIp,
          user_agent: userAgent,
        });

        console.log(`[Background Sync] Completed: ${stats.inserted} inserted, ${stats.updated} updated.`);
      } catch (bgError) {
        console.error("[Background Sync] Error:", bgError.message);
        await LogDao.createLog({
          user_id: userId,
          action: "API_IMPORT_ERROR",
          details: `Background import failed: ${bgError.message}`,
          ip_address: userIp,
          user_agent: userAgent,
        });
      } finally {
        isSyncing = false;
      }
    })();

  } catch (error) {
    console.error("API Import trigger error:", error.message);
    res.status(500).json({
      message: "Error starting background import",
      error: error.message,
    });
  }
};

module.exports = { importFromApi };
