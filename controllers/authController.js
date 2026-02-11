const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserDao = require("../dao/userDao");
const LogDao = require("../dao/LogDao");
const db = require("../config/db");

const registerCandidate = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      mobile,
      // Profile fields
      middle_name,
      prefix,
      gender,
      dob,
      nationality,
      passport_no,
      employee_id,
      manager,
      other_manager,
      rank,
      other_rank,
      whatsapp_number,
      alternate_mobile,
      indos_number,
      registration_type,
    } = req.body;

    // Basic Validation
    if (!email || !first_name || !last_name || !registration_type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Check if user exists
    const existingUser = await UserDao.findUserByEmail(email);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email" });
    }

    // Get Candidate Role ID
    const [roles] = await db.query(
      "SELECT id FROM roles WHERE name = 'candidate'",
    );
    if (roles.length === 0) {
      return res.status(500).json({ message: "Candidate role not configured" });
    }
    const roleId = roles[0].id;

    // Password Handling
    let finalPassword = password;
    let isSelfRegistration = false;

    if (!finalPassword) {
      // Generate random secure password for database (user will reset it)
      const { randomBytes } = require("crypto");
      finalPassword = randomBytes(16).toString("hex");
      isSelfRegistration = true;
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Create User
    const userId = await UserDao.createUser({
      role_id: roleId,
      first_name,
      last_name,
      email,
      password: hashedPassword,
      mobile,
    });

    // Create Profile
    await UserDao.createCandidateProfile({
      user_id: userId,
      middle_name,
      prefix,
      gender,
      dob,
      nationality,
      passport_no,
      employee_id,
      manager,
      other_manager,
      rank,
      other_rank,
      whatsapp_number,
      alternate_mobile,
      indos_number,
      registration_type,
    });

    // Send Welcome Email
    if (process.env.SMTP_USER || true) {
      // Allow logging even if SMTP not set for dev
      try {
        const { sendEmail } = require("../utils/emailService");
        const subject = "Welcome Aboard! Your Registration Details";
        const year = new Date().getFullYear();
        const formattedDob = new Date(dob).toLocaleDateString("en-GB"); // dd-mm-yyyy

        // Generate Reset Link
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?id=${userId}`;

        // Account Info Section based on registration type
        let accountInfoHtml = "";
        if (isSelfRegistration) {
          console.log(`[DEV] Generated Reset Link for ${email}: ${resetLink}`);
          accountInfoHtml = `
             <div class='info'>
                <p><strong>Email Address:</strong> ${email}</p>
                <p><strong>Action Required:</strong> Please set your password to access your account.</p>
                <p><a href='${resetLink}' style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Set Your Password</a></p>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">Link expires in 24 hours.</p>
             </div>
           `;
        } else {
          // Admin created (Password provided)
          accountInfoHtml = `
             <div class='info'>
                <p><strong>Email Address:</strong> ${email}</p>
                <p><strong>Password:</strong> (As set by Administrator)</p>
                <p>You can login <a href='${process.env.FRONTEND_URL}/login'>here</a>.</p>
             </div>
           `;
        }

        const html = `
          <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; }
                    .content { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
                    .header { text-align: center; background-color: #f4f4f4; padding: 10px; }
                    .footer { text-align: center; font-size: 12px; color: #aaa; margin-top: 20px; }
                    .info { margin-bottom: 15px; }
                    .button { display: inline-block; padding: 10px 20px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class='content'>
                    <div class='header'>
                        <h2>Candidate Registration</h2>
                    </div>
                    <p>Dear ${first_name} ${middle_name || ""} ${last_name},</p>
                    <p>Congratulations on your registration! We are pleased to welcome you. Below are your registration details:</p>
                    <div class='info'>
                        <p><strong>Employee ID:</strong> ${employee_id || "-"}</p>
                        <p><strong>Rank Last Served on Vessel:</strong> ${rank || "-"}</p>
                        <p><strong>Prefix:</strong> ${prefix || "-"}</p>
                        <p><strong>Surname:</strong> ${last_name}</p>
                        <p><strong>First Name:</strong> ${first_name}</p>
                        <p><strong>Middle Name:</strong> ${middle_name || "-"}</p>
                        <p><strong>Gender:</strong> ${gender || "-"}</p>
                        <p><strong>C.D.C / Passport:</strong> ${passport_no || "-"}</p>
                        <p><strong>Vessel Type:</strong> -</p>
                        <p><strong>Vessel Name:</strong> -</p>
                        <p><strong>Birth Date:</strong> ${formattedDob}</p>
                        <p><strong>Nationality:</strong> ${nationality || "-"}</p>
                        <p><strong>Seaman Book No.:</strong> -</p>
                        <p><strong>WhatsApp Number:</strong> ${whatsapp_number || "-"}</p>
                        <p><strong>Alternate Number:</strong> ${alternate_mobile || "-"}</p>
                    </div>
                    
                    <h3>Account Information</h3>
                    ${accountInfoHtml}

                    <div class='info'>
                        <p>Please review your details carefully. If you notice any discrepancies or have any questions, don’t hesitate to reach out.</p>
                        <p>We look forward to supporting you on your maritime journey!</p>
                    </div>
                    <div class='footer'>
                        <p>&copy; ${year} MOL Maritime (India) Pvt. Ltd. All rights reserved.</p>
                    </div>
                </div>
            </body>
          </html>
        `;

        // Only send if SMTP configured, otherwise we just logged the link above
        if (process.env.SMTP_USER) {
          await sendEmail(email, subject, html);
        }
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
      }
    }

    // Log the action
    await LogDao.createLog({
      user_id: userId,
      action: "REGISTER_CANDIDATE",
      details: `Candidate registered: ${first_name} ${last_name} (${email})`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });

    res.status(201).json({ message: "Candidate registered successfully" });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({
      message: "Server error during registration",
      error: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await UserDao.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check status
    if (user.status !== 1) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    // Fetch Role Name
    const [roles] = await db.query("SELECT name FROM roles WHERE id = ?", [
      user.role_id,
    ]);
    const roleName = roles[0]?.name || "unknown";

    // Fetch User Permissions
    const [permissions] = await db.query(
      `SELECT p.slug FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [user.role_id],
    );
    const permissionSlugs = permissions.map((p) => p.slug);

    const token = jwt.sign(
      { id: user.id, role: roleName, roleId: user.role_id, email: user.email },
      process.env.JWT_SECRET || "fallback_secret",
      { expiresIn: "1d" },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: roleName,
        permissions: permissionSlugs,
        permissions: permissionSlugs,
      },
    });

    // Log the action (After successful response to avoid blocking, or before if critical)
    // We'll await it to ensure it's logged.
    await LogDao.createLog({
      user_id: user.id,
      action: "LOGIN",
      details: `User logged in: ${user.email}`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });
  } catch (error) {
    console.error("Login Error:", error);
    res
      .status(500)
      .json({ message: "Server error during login", error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await UserDao.findUserByEmail(email);
    if (!user) {
      // For security, do not reveal if user exists or not, but for now we follow the reference which prompts if email not found
      return res
        .status(404)
        .json({ message: "This email address does not exist." });
    }

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?id=${user.id}`;
    const subject = "Reset Password Link";
    const html = `
      <div style="font-family: Arial, sans-serif;">
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center;">
            <h2>Reset Password Link</h2>
        </div>
        <div style="padding: 20px;">
            <p>Hi ${user.first_name} ${user.last_name},</p>
            <p>You requested to reset your password. Click the link below to reset it:</p>
            <p><a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
            <p>If you didn't request this, you can ignore this email.</p>
        </div>
        <div style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; color: #666;">
            &copy; ${new Date().getFullYear()} Molmi. All rights reserved.
        </div>
      </div>
    `;

    // Only attempt to send email if SMTP is configured, else just log it for dev
    if (process.env.SMTP_USER) {
      const { sendEmail } = require("../utils/emailService");
      await sendEmail(email, subject, html);
    } else {
      console.log(`[DEV] Forgot Password Link for ${email}: ${resetLink}`);
    }

    // Log the action
    await LogDao.createLog({
      user_id: user.id,
      action: "FORGOT_PASSWORD",
      details: `Password reset requested for: ${user.email}`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });

    res.json({ message: "A password reset link has been sent to your email." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { userId, password, confirm_password } = req.body;

    if (!userId || !password || !confirm_password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password !== confirm_password) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const updated = await UserDao.updateUserPassword(userId, hashedPassword);

    if (updated) {
      // Optionally send a confirmation email like in the reference
      const user = await UserDao.findUserById(userId);
      if (user && process.env.SMTP_USER) {
        const { sendEmail } = require("../utils/emailService");
        const subject = "Password Reset Successful";
        const html = `<p>Hi ${user.first_name},</p><p>Your password has been successfully updated.</p>`;
        await sendEmail(user.email, subject, html);
      }

      // Log the action
      await LogDao.createLog({
        user_id: userId,
        action: "RESET_PASSWORD",
        details: `Password reset successful for user ID: ${userId}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });

      res.json({ message: "Your password has been successfully updated." });
    } else {
      res
        .status(400)
        .json({ message: "Failed to update password. User not found." });
    }
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { registerCandidate, login, forgotPassword, resetPassword };
