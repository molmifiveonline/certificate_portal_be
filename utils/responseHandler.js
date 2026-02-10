const ok = (res, message, data = {}) => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

const error = (res, statusCode, message, errors = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = { ok, error };
