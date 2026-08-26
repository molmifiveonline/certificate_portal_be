const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserDao = require("../dao/userDao");
const NominatorDao = require("../dao/nominatorDao");
const LogDao = require("../dao/LogDao");
const db = require("../config/db");
const { getFrontendUrl } = require("../utils/urlUtils");
const OtpDao = require("../dao/otpDao");
const { v4: uuidv4 } = require("uuid");

// Nominators can ONLY see pre-active courses that the admin has notified them about.
// Master, Active, and Outhouse courses are NOT accessible to nominators.
const { NOMINATOR_ADMIN_PERMISSIONS } = require("../utils/constants");
const fs = require("fs");
const path = require("path");

const writeOtpToScratch = (email, code) => {
  try {
    const scratchDir = path.join(__dirname, "../scratch");
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir);
    }
    fs.writeFileSync(path.join(scratchDir, "last_otp.txt"), `${email}:${code}`);
  } catch (err) {
    console.error("Failed to write OTP to scratch file:", err);
  }
};

const signAuthToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "1d",
  });

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
      designation,
      vessel_type,
      last_vessel_name,
      next_vessel_name,
      manning_company,
      sign_on_date,
      sign_off_date,
      officer,
      seaman_book_no,
      profile_image,
      status,
    } = req.body;

    // Validation
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
      finalPassword = "12345";
      isSelfRegistration = true;
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Create User
    const userId = await UserDao.createUser({
      role_id: roleId,
      first_name,
      middle_name,
      last_name,
      email,
      password: hashedPassword,
      mobile,
      status: status !== undefined ? status : 0,
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
      indos_number,
      registration_type,
      designation,
      vessel_type,
      last_vessel_name,
      next_vessel_name,
      manning_company,
      sign_on_date,
      sign_off_date,
      officer,
      seaman_book_no,
      profile_image,
    });

    // Send Welcome Email
    if (process.env.SMTP_USER || true) {
      try {
        const { sendEmail } = require("../utils/emailService");
        const { getCandidateRegistrationHtml } = require("../utils/emailTemplateRenderer");
        const subject = "Welcome Aboard! Your Registration Details";
        const formattedDob = new Date(dob).toLocaleDateString("en-GB"); // dd-mm-yyyy

        // Generate Reset Link
        const frontendUrl = getFrontendUrl();
        const resetLink = `${frontendUrl}/reset-password?id=${userId}`;

        const html = getCandidateRegistrationHtml({
          first_name,
          middle_name,
          last_name,
          empId: employee_id,
          rank,
          prefix,
          gender,
          cdc_passport: passport_no,
          dob: formattedDob,
          nationality,
          whatsapp: whatsapp_number,
          alternate_mobile,
          email,
          isSelfRegistration,
          resetLink,
          frontendUrl
        });

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
    req.skipActivityLog = true;

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
    const { email, password, device_trust_token } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await UserDao.findUserByEmail(email);
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.status !== 1) {
        return res.status(403).json({ message: "Account is inactive" });
      }

      // Check device trust
      let skipOtp = process.env.DISABLE_2FA === "true";
      if (!skipOtp && device_trust_token) {

        const trustRecord = await OtpDao.findByDeviceTrustToken(device_trust_token);
        if (
          trustRecord &&
          trustRecord.user_id === user.id &&
          new Date(trustRecord.device_trust_expires_at) > new Date()
        ) {
          skipOtp = true;
        }
      }

      if (!skipOtp) {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcrypt.hash(otpCode, 10);
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        const otpSessionId = await OtpDao.upsertOtp(user.id, null, otpHash, otpExpiresAt);
        writeOtpToScratch(user.email, otpCode);


        // Send email
        try {
          const { sendEmail } = require("../utils/emailService");
          const { getOtpEmailTemplate } = require("../utils/emailTemplates");
          const subject = "Your Two-Step Verification Code";
          const html = getOtpEmailTemplate(user.first_name, otpCode);
          if (process.env.SMTP_USER) {
            await sendEmail(user.email, subject, html);
          } else {
            console.log(`[DEV] Verification Code for ${user.email}: ${otpCode}`);
          }
        } catch (err) {
          console.error("Failed to send OTP email:", err);
        }

        return res.json({
          requiresOtp: true,
          otpSessionId,
          email: user.email,
        });
      }

      const [roles] = await db.query("SELECT name FROM roles WHERE id = ?", [
        user.role_id,
      ]);
      const roleName = roles[0]?.name || "unknown";
      const candidateId =
        roleName.toLowerCase() === "candidate" ? user.id : null;

      let registrationType = null;
      if (roleName.toLowerCase() === "candidate") {
        const [candidateRows] = await db.query(
          "SELECT registration_type FROM candidate_profiles WHERE user_id = ?",
          [user.id]
        );
        registrationType = candidateRows[0]?.registration_type || null;
      }

      const [permissions] = await db.query(
        `SELECT p.slug FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [user.role_id],
      );
      const permissionSlugs = permissions.map((p) => p.slug);

      let adminRolePermissions = null;
      const isSuperAdmin = roleName.toLowerCase() === "superadmin";

      if (!isSuperAdmin && user.admin_role_id) {
        const [adminRolePerms] = await db.query(
          `SELECT p.slug FROM permissions p
           JOIN role_permissions rp ON p.id = rp.permission_id
           WHERE rp.role_id = ?`,
          [user.admin_role_id],
        );
        adminRolePermissions = adminRolePerms.map((p) => p.slug);
      }

      const token = signAuthToken({
        id: user.id,
        role: roleName,
        roleId: user.role_id,
        email: user.email,
        candidate_id: candidateId,
        registration_type: registrationType,
        adminRolePermissions,
      });

      await LogDao.createLog({
        user_id: user.id,
        action: "LOGIN",
        details: `User logged in: ${user.email}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;

      return res.json({
        message: "Login successful",
        token,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: roleName,
          candidate_id: candidateId,
          registration_type: registrationType,
          permissions: permissionSlugs,
          adminRolePermissions,
        },
      });
    }

    const nominator = await NominatorDao.findNominatorByEmail(email);
    if (!nominator) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, nominator.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (Number(nominator.status) !== 1) {
      return res.status(403).json({ message: "Account is inactive" });
    }

    // Check device trust
    let skipOtp = process.env.DISABLE_2FA === "true";
    if (!skipOtp && device_trust_token) {

      const trustRecord = await OtpDao.findByDeviceTrustToken(device_trust_token);
      if (
        trustRecord &&
        trustRecord.nominator_id === nominator.id &&
        new Date(trustRecord.device_trust_expires_at) > new Date()
      ) {
        skipOtp = true;
      }
    }

    if (!skipOtp) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otpCode, 10);
      const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

      const otpSessionId = await OtpDao.upsertOtp(null, nominator.id, otpHash, otpExpiresAt);
      writeOtpToScratch(nominator.email, otpCode);


      // Send email
      try {
        const { sendEmail } = require("../utils/emailService");
        const { getOtpEmailTemplate } = require("../utils/emailTemplates");
        const subject = "Your Two-Step Verification Code";
        const html = getOtpEmailTemplate(nominator.first_name, otpCode);
        if (process.env.SMTP_USER) {
          await sendEmail(nominator.email, subject, html);
        } else {
          console.log(`[DEV] Verification Code for ${nominator.email}: ${otpCode}`);
        }
      } catch (err) {
        console.error("Failed to send OTP email:", err);
      }

      return res.json({
        requiresOtp: true,
        otpSessionId,
        email: nominator.email,
      });
    }

    const token = signAuthToken({
      id: nominator.id,
      role: "admin",
      roleId: null,
      email: nominator.email,
      nominator_id: nominator.id,
      adminRolePermissions: NOMINATOR_ADMIN_PERMISSIONS,
    });

    await LogDao.createLog({
      user_id: null,
      action: "LOGIN",
      details: `Nominator logged in: ${nominator.email}`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent"),
    });
    req.skipActivityLog = true;

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: nominator.id,
        first_name: nominator.first_name,
        last_name: nominator.last_name,
        email: nominator.email,
        role: "admin",
        nominator_id: nominator.id, // Flag to identify nominator sessions on frontend
        permissions: [],
        adminRolePermissions: NOMINATOR_ADMIN_PERMISSIONS,
      },
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
      return res
        .status(404)
        .json({ message: "This email address does not exist." });
    }

    const frontendUrl = getFrontendUrl();
    const resetLink = `${frontendUrl}/reset-password?id=${user.id}`;
    const subject = "Reset Password Link";
    const { getTrainerForgotPasswordHtml } = require("../utils/emailTemplateRenderer");
    const html = getTrainerForgotPasswordHtml({
      trainer_name: `${user.first_name} ${user.last_name || ''}`,
      reset_link: resetLink
    });

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
    req.skipActivityLog = true;

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
      const user = await UserDao.findUserById(userId);
      if (user && process.env.SMTP_USER) {
        const { sendEmail } = require("../utils/emailService");
        const { getTrainerResetPasswordHtml } = require("../utils/emailTemplateRenderer");
        const subject = "Password Reset Successful";
        const html = getTrainerResetPasswordHtml({
          trainer_name: `${user.first_name} ${user.last_name || ''}`
        });
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
      req.skipActivityLog = true;

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

const verifyOtp = async (req, res) => {
  try {
    const { otpSessionId, otpCode } = req.body;

    if (!otpSessionId || !otpCode) {
      return res.status(400).json({ message: "OTP session ID and verification code are required" });
    }

    const [rows] = await db.query("SELECT * FROM user_otp_verifications WHERE id = ?", [otpSessionId]);
    const record = rows[0];

    if (!record) {
      return res.status(400).json({ message: "Invalid verification session" });
    }

    if (record.otp_attempts >= 5) {
      return res.status(400).json({ message: "Too many failed attempts. Please request a new OTP." });
    }

    if (!record.otp_hash || !record.otp_expires_at || new Date(record.otp_expires_at) < new Date()) {
      return res.status(400).json({ message: "Verification code has expired. Please request a new OTP." });
    }

    const isMatch = await bcrypt.compare(otpCode, record.otp_hash);
    if (!isMatch) {
      await OtpDao.incrementAttempts(record.id);
      const remaining = 5 - (record.otp_attempts + 1);
      return res.status(400).json({ 
        message: remaining > 0 
          ? `Invalid verification code. ${remaining} attempts remaining.` 
          : "Too many failed attempts. Please request a new OTP." 
      });
    }

    // OTP matches! Clear it
    await OtpDao.clearOtp(record.id);

    // Create a 7-day device trust token
    const newTrustToken = uuidv4();
    const trustExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await OtpDao.saveDeviceTrust(record.id, newTrustToken, trustExpiresAt);

    // Perform successful login flow
    if (record.user_id) {
      const user = await UserDao.findUserById(record.user_id);
      if (!user || user.status !== 1) {
        return res.status(403).json({ message: "User account is inactive or not found" });
      }

      const [roles] = await db.query("SELECT name FROM roles WHERE id = ?", [user.role_id]);
      const roleName = roles[0]?.name || "unknown";
      const candidateId = roleName.toLowerCase() === "candidate" ? user.id : null;

      let registrationType = null;
      if (roleName.toLowerCase() === "candidate") {
        const [candidateRows] = await db.query(
          "SELECT registration_type FROM candidate_profiles WHERE user_id = ?",
          [user.id]
        );
        registrationType = candidateRows[0]?.registration_type || null;
      }

      const [permissions] = await db.query(
        `SELECT p.slug FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [user.role_id]
      );
      const permissionSlugs = permissions.map((p) => p.slug);

      let adminRolePermissions = null;
      const isSuperAdmin = roleName.toLowerCase() === "superadmin";

      if (!isSuperAdmin && user.admin_role_id) {
        const [adminRolePerms] = await db.query(
          `SELECT p.slug FROM permissions p
           JOIN role_permissions rp ON p.id = rp.permission_id
           WHERE rp.role_id = ?`,
          [user.admin_role_id]
        );
        adminRolePermissions = adminRolePerms.map((p) => p.slug);
      }

      const token = signAuthToken({
        id: user.id,
        role: roleName,
        roleId: user.role_id,
        email: user.email,
        candidate_id: candidateId,
        registration_type: registrationType,
        adminRolePermissions,
      });

      await LogDao.createLog({
        user_id: user.id,
        action: "LOGIN_2FA",
        details: `User logged in with 2FA: ${user.email}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;

      return res.json({
        message: "Verification successful",
        token,
        device_trust_token: newTrustToken,
        user: {
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: roleName,
          candidate_id: candidateId,
          registration_type: registrationType,
          permissions: permissionSlugs,
          adminRolePermissions,
        },
      });
    } else if (record.nominator_id) {
      const nominator = await NominatorDao.getNominatorById(record.nominator_id);
      if (!nominator || Number(nominator.status) !== 1) {
        return res.status(403).json({ message: "Nominator account is inactive or not found" });
      }

      const token = signAuthToken({
        id: nominator.id,
        role: "admin",
        roleId: null,
        email: nominator.email,
        nominator_id: nominator.id,
        adminRolePermissions: NOMINATOR_ADMIN_PERMISSIONS,
      });

      await LogDao.createLog({
        user_id: null,
        action: "LOGIN_2FA",
        details: `Nominator logged in with 2FA: ${nominator.email}`,
        ip_address: req.ip,
        user_agent: req.get("User-Agent"),
      });
      req.skipActivityLog = true;

      return res.json({
        message: "Verification successful",
        token,
        device_trust_token: newTrustToken,
        user: {
          id: nominator.id,
          first_name: nominator.first_name,
          last_name: nominator.last_name,
          email: nominator.email,
          role: "admin",
          nominator_id: nominator.id,
          permissions: [],
          adminRolePermissions: NOMINATOR_ADMIN_PERMISSIONS,
        },
      });
    }

    return res.status(400).json({ message: "Invalid session owner" });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ message: "Server error during verification", error: error.message });
  }
};

const resendOtp = async (req, res) => {
  try {
    const { otpSessionId } = req.body;

    if (!otpSessionId) {
      return res.status(400).json({ message: "OTP session ID is required" });
    }

    const [rows] = await db.query("SELECT * FROM user_otp_verifications WHERE id = ?", [otpSessionId]);
    const record = rows[0];

    if (!record) {
      return res.status(400).json({ message: "Invalid session ID" });
    }

    const timeSinceLastUpdate = Date.now() - new Date(record.updated_at).getTime();
    if (timeSinceLastUpdate < 60000) {
      const remainingSeconds = Math.ceil((60000 - timeSinceLastUpdate) / 1000);
      return res.status(429).json({ message: `Please wait ${remainingSeconds} seconds before requesting a new code.` });
    }

    let email, firstName, userId, nominatorId;

    if (record.user_id) {
      const user = await UserDao.findUserById(record.user_id);
      if (!user) return res.status(404).json({ message: "User not found" });
      email = user.email;
      firstName = user.first_name;
      userId = user.id;
    } else if (record.nominator_id) {
      const nominator = await NominatorDao.getNominatorById(record.nominator_id);
      if (!nominator) return res.status(404).json({ message: "Nominator not found" });
      email = nominator.email;
      firstName = nominator.first_name;
      nominatorId = nominator.id;
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otpCode, 10);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await OtpDao.upsertOtp(userId, nominatorId, otpHash, otpExpiresAt);
    writeOtpToScratch(email, otpCode);


    // Send email
    try {
      const { sendEmail } = require("../utils/emailService");
      const { getOtpEmailTemplate } = require("../utils/emailTemplates");
      const subject = "Your Two-Step Verification Code";
      const html = getOtpEmailTemplate(firstName, otpCode);

      if (process.env.SMTP_USER) {
        await sendEmail(email, subject, html);
      } else {
        console.log(`[DEV] Resent Verification Code for ${email}: ${otpCode}`);
      }
    } catch (err) {
      console.error("Failed to resend OTP email:", err);
    }

    res.json({ message: "Verification code resent successfully" });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(500).json({ message: "Server error during resend", error: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (req.user.nominator_id) {
      const nominator = await NominatorDao.getNominatorById(req.user.nominator_id);
      if (!nominator) {
        return res.status(404).json({ message: "Nominator not found" });
      }
      return res.json({
        user: {
          id: nominator.id,
          first_name: nominator.first_name,
          last_name: nominator.last_name,
          email: nominator.email,
          role: "admin",
          nominator_id: nominator.id,
          permissions: NOMINATOR_ADMIN_PERMISSIONS,
          adminRolePermissions: NOMINATOR_ADMIN_PERMISSIONS,
        },
      });
    }

    const user = await UserDao.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [roles] = await db.query("SELECT name FROM roles WHERE id = ?", [
      user.role_id,
    ]);
    const roleName = roles[0]?.name || "unknown";
    const candidateId = roleName.toLowerCase() === "candidate" ? user.id : null;

    let registrationType = null;
    if (roleName.toLowerCase() === "candidate") {
      const [candidateRows] = await db.query(
        "SELECT registration_type FROM candidate_profiles WHERE user_id = ?",
        [user.id]
      );
      registrationType = candidateRows[0]?.registration_type || null;
    }

    const [permissions] = await db.query(
      `SELECT p.slug FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
      [user.role_id]
    );
    const permissionSlugs = permissions.map((p) => p.slug);

    let adminRolePermissions = null;
    const isSuperAdmin = roleName.toLowerCase() === "superadmin";
    if (!isSuperAdmin && user.admin_role_id) {
      const [adminRolePerms] = await db.query(
        `SELECT p.slug FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         WHERE rp.role_id = ?`,
        [user.admin_role_id]
      );
      adminRolePermissions = adminRolePerms.map((p) => p.slug);
    }

    return res.json({
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: roleName,
        candidate_id: candidateId,
        registration_type: registrationType,
        permissions: permissionSlugs,
        adminRolePermissions,
      },
    });
  } catch (error) {
    console.error("GetMe Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { registerCandidate, login, forgotPassword, resetPassword, verifyOtp, resendOtp, getMe };

