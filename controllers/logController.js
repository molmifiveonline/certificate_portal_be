const LogDao = require("../dao/LogDao");

const createLog = async (req, res) => {
  try {
    const { action, details } = req.body;
    // Assuming req.user is populated by authMiddleware, but if not authenticated, user_id can be null or maybe from body if internal call
    const userId = req.user ? req.user.id : req.body.user_id || null;

    // Get IP address
    const ipAddress = req.ip || req.connection.remoteAddress;
    // Get User Agent
    const userAgent = req.get("User-Agent");

    if (!action) {
      return res.status(400).json({ message: "Action is required" });
    }

    const result = await LogDao.createLog({
      user_id: userId,
      action,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    res.status(201).json({
      message: "Log created successfully",
      logId: result.insertId,
    });
  } catch (error) {
    console.error("Create Log Error:", error);
    res.status(500).json({
      message: "Server error creating log",
      error: error.message,
    });
  }
};

const getLogs = async (req, res) => {
  try {
    // Optional: Add pagination and filters from query params
    // const { page = 1, limit = 10, userId } = req.query;

    let logs;
    if (req.query.userId) {
      logs = await LogDao.getLogsByUserId(req.query.userId);
    } else {
      logs = await LogDao.getLogs();
    }

    res.json(logs);
  } catch (error) {
    console.error("Get Logs Error:", error);
    res.status(500).json({
      message: "Server error fetching logs",
      error: error.message,
    });
  }
};

const deleteLog = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Log ID is required" });
    }

    const result = await LogDao.deleteLog(id);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Log not found" });
    }

    res.json({ message: "Log deleted successfully" });
  } catch (error) {
    console.error("Delete Log Error:", error);
    res.status(500).json({
      message: "Server error deleting log",
      error: error.message,
    });
  }
};

module.exports = { createLog, getLogs, deleteLog };
