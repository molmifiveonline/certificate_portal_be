const pool = require("../config/db");

const getAllRoles = async (page, limit) => {
  let query = "SELECT * FROM roles";
  const params = [];

  if (page && limit) {
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM roles",
    );
    const total = countResult[0].total;

    const offset = (page - 1) * limit;
    query += " LIMIT ? OFFSET ?";
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(query, params);
    return {
      data: rows,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  const [rows] = await pool.query(query);
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
