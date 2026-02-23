const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class LocationDao {
  static async getAllLocations({
    search,
    page = 1,
    limit = 10,
    sort_by = "created_at",
    sort_order = "desc",
  }) {
    let query = "SELECT * FROM locations WHERE status = 1";
    const params = [];

    if (search) {
      query +=
        " AND (location_name LIKE ? OR short_code LIKE ? OR address LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Add sorting
    const allowedSortColumns = [
      "location_name",
      "short_code",
      "email",
      "created_at",
    ];
    const finalSortBy = allowedSortColumns.includes(sort_by)
      ? sort_by
      : "created_at";
    const finalSortOrder = sort_order.toLowerCase() === "asc" ? "ASC" : "DESC";
    query += ` ORDER BY ${finalSortBy} ${finalSortOrder}`;

    // Get total count for pagination
    let countQuery = "SELECT COUNT(*) as total FROM locations WHERE status = 1";
    const countParams = [];
    if (search) {
      countQuery +=
        " AND (location_name LIKE ? OR short_code LIKE ? OR address LIKE ?)";
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0].total;

    // Add pagination if provided
    let pageNum = page ? Number(page) : null;
    let limitNum = limit ? Number(limit) : null;

    if (pageNum && limitNum) {
      const offset = (pageNum - 1) * limitNum;
      query += " LIMIT ? OFFSET ?";
      params.push(limitNum, offset);
    }

    const [rows] = await db.query(query, params);

    return {
      data: rows,
      total,
      page: pageNum || 1,
      limit: limitNum || total,
      totalPages: limitNum ? Math.ceil(total / limitNum) : 1,
    };
  }

  static async getLocationById(id) {
    const [rows] = await db.query(
      "SELECT * FROM locations WHERE id = ? AND status = 1",
      [id],
    );
    return rows[0];
  }

  static async createLocation(data) {
    const id = uuidv4();
    const {
      location_name,
      type,
      short_code,
      email,
      phone_number,
      address,
      google_map_link,
    } = data;

    await db.query(
      "INSERT INTO locations (id, location_name, type, short_code, email, phone_number, address, google_map_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        location_name,
        type || "Inhouse" /** Default to Inhouse if not provided */,
        short_code,
        email,
        phone_number,
        address,
        google_map_link,
      ],
    );

    return { id, ...data };
  }

  static async updateLocation(id, data) {
    const {
      location_name,
      type,
      short_code,
      email,
      phone_number,
      address,
      google_map_link,
    } = data;

    await db.query(
      "UPDATE locations SET location_name = ?, type = ?, short_code = ?, email = ?, phone_number = ?, address = ?, google_map_link = ? WHERE id = ?",
      [
        location_name,
        type,
        short_code,
        email,
        phone_number,
        address,
        google_map_link,
        id,
      ],
    );

    return { id, ...data };
  }

  static async deleteLocation(id) {
    await db.query("UPDATE locations SET status = 0 WHERE id = ?", [id]);
    return true;
  }
}

module.exports = LocationDao;
