const axios = require("axios");
const https = require("https");
const PreActiveCourseDao = require("../dao/PreActiveCourseDao");
const LogDao = require("../dao/LogDao");
const { PRE_ACTIVE_COURSE_SYNC_CONFIG } = require("../utils/constants");

const getAccessToken = async () => {
  const response = await axios.post(
    PRE_ACTIVE_COURSE_SYNC_CONFIG.tokenUrl,
    {
      client_id: PRE_ACTIVE_COURSE_SYNC_CONFIG.clientId,
      client_secret: PRE_ACTIVE_COURSE_SYNC_CONFIG.clientSecret,
    },
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    }
  );
  const data = response.data;
  return data.data ? data.data.access_token : (data.access_token || data.token);
};

let isSyncing = false;

/**
 * Step 1: Fetch data from external API and return for preview
 */
const fetchExternalPreview = async (req, res) => {
  try {
    const token = await getAccessToken();

    const response = await axios.post(
      PRE_ACTIVE_COURSE_SYNC_CONFIG.apiUrl,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
        timeout: 60000,
      }
    );

    const apiResponse = response.data;
    const externalCourses = apiResponse.data || [];

    if (!Array.isArray(externalCourses) || externalCourses.length === 0) {
      return res.json({
        data: [],
        message: "No scheduled courses found in external API.",
      });
    }

    // Map to our course format
    const mappedCourses = externalCourses.map((item) => ({
      course_id: String(item.id || ""),
      course_name: item.course_name || "",
      start_date: item.start_date || null,
      end_date: item.end_date || null,
      days: item.duration || 0,
      type_of_location: item.location || "Onsite",
      location_id: item.loc_id || null,
      course_type: item.course_type || "In house", // Default to one of the requested types
      description: item.description || "",
      remarks: item.remarks || "",
      master_course_name: item.course_name || "",
      topic: item.topic || (item.location === "ONLINE" ? "Online" : "General"),
    }));

    // Check which ones already exist
    const courseIds = mappedCourses.map((c) => c.course_id).filter((id) => id);
    const existingCourseIds = await PreActiveCourseDao.getExistingCourseIds(courseIds);

    const dataWithStatus = mappedCourses.map((c) => ({
      ...c,
      isExisting: existingCourseIds.includes(String(c.course_id)),
    }));

    res.json({ data: dataWithStatus, total: dataWithStatus.length });
  } catch (error) {
    console.error("Fetch external courses preview error:", error.message);
    res.status(500).json({
      message: "Error fetching courses from external API",
      error: error.message,
    });
  }
};

/**
 * Step 2: Confirm and perform bulk import
 */
const confirmBulkImport = async (req, res) => {
  try {
    if (isSyncing) {
      return res
        .status(429)
        .json({ message: "A course sync is already in progress." });
    }

    const { courses } = req.body;
    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ message: "No courses provided for import." });
    }

    isSyncing = true;
    const userId = req.user.id;
    const userIp = req.ip;
    const userAgent = req.get("User-Agent");

    const stats = await PreActiveCourseDao.bulkUpsert(courses);

    await LogDao.createLog({
      user_id: userId,
      action: "API_IMPORT_COURSES",
      details: `Imported ${stats.inserted} new and updated ${stats.updated} pre-active courses from API.`,
      ip_address: userIp,
      user_agent: userAgent,
    });
      req.skipActivityLog = true;

    res.json({ message: "Course sync completed successfully", stats });
  } catch (error) {
    console.error("Confirm bulk course import error:", error.message);
    res.status(500).json({
      message: "Error performing bulk course import",
      error: error.message,
    });
  } finally {
    isSyncing = false;
  }
};

module.exports = { fetchExternalPreview, confirmBulkImport };
