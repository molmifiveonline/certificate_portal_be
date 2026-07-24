const express = require("express");
const router = express.Router();
const {
  registerCandidate,
  login,
  forgotPassword,
  resetPassword,
  verifyOtp,
  resendOtp,
} = require("../controllers/authController");

router.post("/register/candidate", registerCandidate);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

module.exports = router;

