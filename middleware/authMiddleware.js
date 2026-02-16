const jwt = require("jsonwebtoken");
const { error } = require("../utils/responseHandler");

const protect = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "fallback_secret",
      );
      req.user = decoded;
      next();
      return; // Ensure we don't fall through to the next check
    } catch (err) {
      return error(res, 401, "Not authorized, token failed");
    }
  }

  if (!token) {
    return error(res, 401, "Not authorized, no token");
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 401, "User not authenticated");
    }

    // Check if user role matches any of the allowed roles
    const userRole = req.user.role;

    // Case-insensitive check just in case
    const allowedRoles = roles.map((r) => r.toLowerCase());
    if (!allowedRoles.includes(userRole.toLowerCase())) {
      return error(
        res,
        403,
        "User role is not authorized to access this route",
      );
    }
    next();
  };
};

// Hybrid export: Default export is 'protect' function, but it also has properties
module.exports = protect;
module.exports.protect = protect;
module.exports.authorize = authorize;
