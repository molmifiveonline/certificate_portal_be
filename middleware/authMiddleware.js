const jwt = require("jsonwebtoken");
const { error } = require("../utils/responseHandler");

const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return error(res, 401, "Access denied. No token provided.", {
      code: "TOKEN_MISSING",
    });
  }

  try {
    const verified = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback_secret",
    );
    req.user = verified;
    next();
  } catch (err) {
    return error(res, 403, "Invalid or expired token", {
      code: "TOKEN_INVALID",
      details: err.message,
    });
  }
};

module.exports = verifyToken;
