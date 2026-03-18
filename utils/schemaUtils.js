const pool = require("../config/db");

const columnCache = new Map();
const tableCache = new Map();

async function hasColumn(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey);
  }

  const safeTableName = String(tableName).replace(/[^a-zA-Z0-9_]/g, "");
  const [rows] = await pool.query(
    `SHOW COLUMNS FROM \`${safeTableName}\` LIKE ?`,
    [columnName],
  );
  const exists = rows.length > 0;
  columnCache.set(cacheKey, exists);
  return exists;
}

async function hasTable(tableName) {
  const cacheKey = String(tableName);
  if (tableCache.has(cacheKey)) {
    return tableCache.get(cacheKey);
  }

  const [rows] = await pool.query("SHOW TABLES LIKE ?", [tableName]);
  const exists = rows.length > 0;
  tableCache.set(cacheKey, exists);
  return exists;
}

module.exports = {
  hasColumn,
  hasTable,
};
