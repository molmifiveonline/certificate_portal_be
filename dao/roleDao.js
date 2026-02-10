const pool = require("../config/db");

const getAllRoles = async () => {
  const [rows] = await pool.query("SELECT * FROM roles");
  return rows;
};

const getRoleById = async (id) => {
  const [rows] = await pool.query("SELECT * FROM roles WHERE id = ?", [id]);
  return rows[0];
};

module.exports = {
  getAllRoles,
  getRoleById,
};
