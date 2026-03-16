const DashboardDao = require("../dao/DashboardDao");

exports.getStats = async (req, res) => {
  try {
    const stats = await DashboardDao.getStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    res
      .status(500)
      .json({ message: "Error fetching stats", error: error.message });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const filters = {
      trainer_id: req.query.trainer_id,
      master_course_id: req.query.master_course_id,
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      status: req.query.status,
    };

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await DashboardDao.getCourses(filters, page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching dashboard courses:", error);
    res
      .status(500)
      .json({
        message: "Error fetching dashboard courses",
        error: error.message,
      });
  }
};

exports.getExpiryAlerts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await DashboardDao.getExpiryAlerts(page, limit);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching expiry alerts:", error);
    res
      .status(500)
      .json({ message: "Error fetching expiry alerts", error: error.message });
  }
};
