const getFrontendUrl = (fallback = "http://localhost:3000") => {
  return (
    process.env.PORTAL_URL ||
    (process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",")[0].trim() : null) ||
    fallback
  );
};

module.exports = { getFrontendUrl };
