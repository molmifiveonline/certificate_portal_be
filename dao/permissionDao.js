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

const getAllPermissions = async (page, limit) => {
  let query = "SELECT * FROM permissions ORDER BY group_name, name";
  const params = [];

  // Check if pagination is requested (both page and limit must be present)
  if (page && limit) {
    // Get total count first
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM permissions",
    );
    const total = countResult[0].total;

    // Add LIMIT and OFFSET
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

  // No pagination, return all rows as array (backward compatibility or default)
  const [rows] = await pool.query(query);
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

    // Insert new permissions, filtering out any IDs that don't exist in the permissions table
    if (permissionIds && permissionIds.length > 0) {
      const [existingPerms] = await connection.query(
        `SELECT id FROM permissions WHERE id IN (${permissionIds.map(() => "?").join(",")})`,
        permissionIds,
      );
      const validIds = existingPerms.map((p) => p.id);

      if (validIds.length > 0) {
        const values = validIds.map((permId) => [roleId, permId]);
        await connection.query(
          "INSERT INTO role_permissions (role_id, permission_id) VALUES ?",
          [values],
        );
      }
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
