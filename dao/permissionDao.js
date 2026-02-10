const pool = require("../config/db");

const getPermissionsByRoleId = async (roleId) => {
  const query = `
    SELECT p.slug 
    FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ?
  `;
  const [rows] = await pool.query(query, [roleId]);
  return rows.map((row) => row.slug);
};

const getAllPermissions = async () => {
  const [rows] = await pool.query(
    "SELECT * FROM permissions ORDER BY group_name, name",
  );
  return rows;
};

const getRolePermissionsFull = async (roleId) => {
  // Returns full permission objects, not just slugs
  const query = `
      SELECT p.*
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `;
  const [rows] = await pool.query(query, [roleId]);
  return rows;
};

const updateRolePermissions = async (roleId, permissionIds) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Remove existing permissions
    await connection.query("DELETE FROM role_permissions WHERE role_id = ?", [
      roleId,
    ]);

    // Insert new permissions
    if (permissionIds && permissionIds.length > 0) {
      const values = permissionIds.map((permId) => [roleId, permId]);
      await connection.query(
        "INSERT INTO role_permissions (role_id, permission_id) VALUES ?",
        [values],
      );
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getPermissionsByRoleId,
  getAllPermissions,
  updateRolePermissions,
  getRolePermissionsFull,
};
