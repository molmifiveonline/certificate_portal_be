const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

const createAdminRole = async (data) => {
  const { role_name, description, status } = data;
  const id = uuidv4();
  const query = `
    INSERT INTO admin_roles (id, role_name, description, status)
    VALUES (?, ?, ?, ?)
  `;
  await pool.query(query, [
    id,
    role_name,
    description,
    status !== undefined ? status : 1,
  ]);
  return id;
};

const getAllAdminRoles = async (search, page, limit) => {
  let query = "SELECT * FROM admin_roles WHERE 1=1";
  let countQuery = "SELECT COUNT(*) as total FROM admin_roles WHERE 1=1";
  const params = [];
  const countParams = [];

  if (search) {
    query += " AND role_name LIKE ?";
    countQuery += " AND role_name LIKE ?";
    params.push(`%${search}%`);
    countParams.push(`%${search}%`);
  }

  if (page && limit) {
    const [countResult] = await pool.query(countQuery, countParams);
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

  const [rows] = await pool.query(query, params);
  return rows;
};

const getAdminRoleById = async (id) => {
  const [rows] = await pool.query("SELECT * FROM admin_roles WHERE id = ?", [
    id,
  ]);
  return rows[0];
};

const updateAdminRole = async (id, data) => {
  const { role_name, description, status } = data;
  const query = `
    UPDATE admin_roles
    SET role_name = ?, description = ?, status = ?
    WHERE id = ?
  `;
  const [result] = await pool.query(query, [
    role_name,
    description,
    status,
    id,
  ]);
  return result.affectedRows;
};

const deleteAdminRole = async (id) => {
  // Soft delete or hard delete; doing hard delete as requested if no dependencies, but sticking to standard pattern here
  const [result] = await pool.query("DELETE FROM admin_roles WHERE id = ?", [
    id,
  ]);
  return result.affectedRows;
};

module.exports = {
  createAdminRole,
  getAllAdminRoles,
  getAdminRoleById,
  updateAdminRole,
  deleteAdminRole,
};
