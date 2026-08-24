const getFrontendUrl = (fallback = "http://localhost:3000") => {
  const rawUrl = process.env.PORTAL_URL || process.env.FRONTEND_URL;
  if (rawUrl) {
    return rawUrl.split(",")[0].trim();
  }
  return fallback;
};

module.exports = { getFrontendUrl };

