const NotificationDao = require("../../dao/notificationDao");

exports.getAdminNotifications = async (req, res) => {
  try {
    const data = await NotificationDao.getAdminNotifications();
    res.status(200).json(data);
  } catch (error) {
    console.error("Get Admin Notifications Error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};
