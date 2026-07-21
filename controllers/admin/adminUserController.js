const bcrypt = require("bcryptjs");
const AdminUserDao = require("../../dao/adminUserDao");
const LogDao = require("../../dao/LogDao");
const db = require("../../config/db");
const { getFrontendUrl } = require("../../utils/urlUtils");

const getAdmins = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const result = await AdminUserDao.getAllAdmins(page, limit, search);
    res.json(result);
  } catch (error) {
    console.error("Error fetching admin users:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getAdminById = async (req, res) => {
  try {
    const { id } = req.params;
    const admin = await AdminUserDao.getAdminById(id);
    if (!admin) {
      return res.status(404).json({ message: "Admin user not found" });
    }
    res.json(admin);
  } catch (error) {
    console.error("Error fetching admin user by id:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const createAdmin = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      mobile,
      gender,
      status,
      admin_role_id,
    } = req.body;

    if (!first_name || !email || !password || !mobile) {
      return res.status(400).json({
        message: "First name, email, password, and mobile are required",
      });
    }

    const existingUser = await AdminUserDao.findUserByEmail(email);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    const [roles] = await db.query("SELECT id FROM roles WHERE name = 'admin'");
    if (roles.length === 0) {
      return res.status(500).json({ message: "Admin role not configured" });
    }
    const roleId = roles[0].id;

    const hashedPassword = await bcrypt.hash(password, 10);

    const userId = await AdminUserDao.createAdmin({
      role_id: roleId,
      admin_role_id: admin_role_id || null,
      first_name,
      last_name,
      email,
      password: hashedPassword,
      mobile,
      gender,
      status: status !== undefined ? status : 1,
    });

    // Send Welcome Email with credentials
    if (process.env.SMTP_USER || true) {
      try {
        const { sendEmail } = require("../../utils/emailService");
        const subject = "Welcome - Admin Account Created";
        const frontendUrl = getFrontendUrl();

        const html = `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .content { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
                .header { text-align: center; background-color: #f4f4f4; padding: 10px; }
                .footer { text-align: center; font-size: 12px; color: #aaa; margin-top: 20px; }
                .info { margin-bottom: 15px; }
              </style>
            </head>
            <body>
              <div class='content'>
                <div class='header'>
                  <h2>Admin Account Created</h2>
                </div>
                <p>Dear ${first_name} ${last_name || ""},</p>
                <p>An administrative account has been created for you. Below are your login credentials:</p>
                <div class='info'>
                  <p><strong>URL:</strong> <a href='${frontendUrl}/login'>${frontendUrl}/login</a></p>
                  <p><strong>Username (Email):</strong> ${email}</p>
                  <p><strong>Password:</strong> ${password}</p>
                </div>
                <p>Please log in and update your password for security reasons.</p>
                <div class='footer'>
                  <p>&copy; ${new Date().getFullYear()} Molmi. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        if (process.env.SMTP_USER) {
          await sendEmail(email, subject, html);
        } else {
          console.log(`[DEV] Admin Email for ${email}: URL=${frontendUrl}/login, PW=${password}`);
        }
      } catch (emailError) {
        console.error("Failed to send admin creation email:", emailError);
      }
    }

    await LogDao.createLog({
      user_id: req.user ? req.user.id : userId,
      action: "CREATE_ADMIN",
      details: `Admin user created: ${first_name} ${last_name} (${email})`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });
      req.skipActivityLog = true;

    res
      .status(201)
      .json({ message: "Admin user created successfully", id: userId });

  } catch (error) {
    console.error("Error creating admin user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      password,
      mobile,
      gender,
      status,
      admin_role_id,
    } = req.body;

    if (!first_name || !email || !mobile) {
      return res
        .status(400)
        .json({ message: "First name, email, and mobile are required" });
    }

    const existingUser = await AdminUserDao.findUserByEmail(email, id);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Another user already exists with this email" });
    }

    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const success = await AdminUserDao.updateAdmin(id, {
      first_name,
      last_name,
      email,
      password: hashedPassword,
      mobile,
      gender,
      status: status !== undefined ? status : 1,
      admin_role_id: admin_role_id || null,
    });

    if (!success) {
      return res
        .status(404)
        .json({ message: "Admin user not found or not updated" });
    }

    await LogDao.createLog({
      user_id: req.user ? req.user.id : "system",
      action: "UPDATE_ADMIN",
      details: `Admin user updated: ${email}`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });
      req.skipActivityLog = true;

    res.json({ message: "Admin user updated successfully" });
  } catch (error) {
    console.error("Error updating admin user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if the user is trying to delete themselves
    if (req.user && req.user.id === id) {
      return res
        .status(400)
        .json({ message: "You cannot delete your own account" });
    }

    const admin = await AdminUserDao.getAdminById(id);
    if (!admin) {
      return res.status(404).json({ message: "Admin user not found" });
    }

    const success = await AdminUserDao.deleteAdmin(id);

    if (!success) {
      return res
        .status(404)
        .json({ message: "Admin user not found or not deleted" });
    }

    await LogDao.createLog({
      user_id: req.user ? req.user.id : "system",
      action: "DELETE_ADMIN",
      details: `Admin user deleted: ${admin.email}`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });
      req.skipActivityLog = true;

    res.json({ message: "Admin user deleted successfully" });
  } catch (error) {
    console.error("Error deleting admin user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
};
