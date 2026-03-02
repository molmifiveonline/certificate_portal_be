const LogDao = require("../dao/LogDao");

const activityLogger = (req, res, next) => {
  // We only care about mutations, ignore GET, OPTIONS, HEAD
  const trackedMethods = ["POST", "PUT", "PATCH", "DELETE"];

  if (!trackedMethods.includes(req.method)) {
    return next();
  }

  // Hook into the 'finish' event of the response.
  // This ensures we know if the request was successful and any auth middleware has run.
  res.on("finish", async () => {
    // Only log successful actions (status 2xx or 3xx)
    if (res.statusCode >= 400) {
      return;
    }

    try {
      // Extract User ID.
      // Protect middleware usually populates req.user.
      // Sometimes it might be in body or query depending on how the route is designed.
      let userId = req.user ? req.user.id : null;
      if (!userId && req.body && req.body.user_id) {
        userId = req.body.user_id;
      }

      // If we still don't have a user, it might be a public mutation (like login itself).
      // We can choose to log it without a user, or ignore. We'll log it.

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get("User-Agent");

      // Construct a readable Action string
      let actionPrefix = "";
      switch (req.method) {
        case "POST":
          actionPrefix = "Create";
          break;
        case "PUT":
        case "PATCH":
          actionPrefix = "Update";
          break;
        case "DELETE":
          actionPrefix = "Delete";
          break;
      }

      // Attempt to extract the module name from the URL
      // E.g., /api/trainer -> trainer
      const pathParts = req.originalUrl.split("?")[0].split("/");
      let moduleName = "Unknown";

      // Usually URLs look like /api/trainer or /api/hotel-details/123
      const apiIndex = pathParts.indexOf("api");
      if (apiIndex !== -1 && pathParts.length > apiIndex + 1) {
        moduleName = pathParts[apiIndex + 1];
        // Clean up the module name (e.g., hotel-details -> Hotel Details)
        moduleName = moduleName
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }

      const actionString = `${actionPrefix} ${moduleName}`;

      // Basic details representing the footprint
      const details = `Method: ${req.method}, URL: ${req.originalUrl}, Status: ${res.statusCode}`;

      // Insert Log
      await LogDao.createLog({
        user_id: userId,
        action: actionString,
        details: details,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    } catch (error) {
      console.error("Activity Logger Error:", error);
    }
  });

  next();
};

module.exports = activityLogger;
