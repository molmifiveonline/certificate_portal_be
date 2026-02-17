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

    const courses = await DashboardDao.getCourses(filters);
    res.status(200).json(courses);
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
    const alerts = await DashboardDao.getExpiryAlerts();
    res.status(200).json(alerts);
  } catch (error) {
    console.error("Error fetching expiry alerts:", error);
    res
      .status(500)
      .json({ message: "Error fetching expiry alerts", error: error.message });
  }
};
