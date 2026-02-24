const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");

class HotelDetailDao {
  static async getAllHotels(filters = {}) {
    let baseQuery = " FROM hotel_details WHERE status = 1";
    const params = [];

    if (filters.search) {
      baseQuery +=
        " AND (venue_name LIKE ? OR venue_address LIKE ? OR email LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as totalCount ${baseQuery}`;
    const [countResult] = await db.query(countQuery, params);
    const totalCount = countResult[0].totalCount;

    // Build data query
    let dataQuery = `SELECT * ${baseQuery}`;

    // Sorting
    const sortBy = filters.sort_by || "created_at";
    const sortOrder = filters.sort_order === "asc" ? "ASC" : "DESC";
    // Whitelist sortable columns to prevent SQL injection
    const allowedSortColumns = ["venue_name", "created_at", "updated_at"];
    if (allowedSortColumns.includes(sortBy)) {
      dataQuery += ` ORDER BY ${sortBy} ${sortOrder}`;
    } else {
      dataQuery += " ORDER BY created_at DESC";
    }

    // Pagination
    const dataParams = [...params];
    let page = null;
    let limit = null;

    if (filters.page && filters.limit) {
      page = Math.max(1, Number(filters.page));
      limit = Number(filters.limit);
      const offset = (page - 1) * limit;
      dataQuery += ` LIMIT ? OFFSET ?`;
      dataParams.push(limit, offset);
    }

    const [rows] = await db.query(dataQuery, dataParams);
    return {
      data: rows,
      total: totalCount,
      page: page || 1,
      limit: limit || totalCount,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
    };
  }

  static async getHotelById(id) {
    const query = "SELECT * FROM hotel_details WHERE id = ? AND status = 1";
    const [rows] = await db.query(query, [id]);
    return rows[0];
  }

  static async createHotel(hotelData) {
    const { venue_name, venue_address, venue_contact, venue_map_link, email } =
      hotelData;
    const id = uuidv4();
    await db.query(
      `INSERT INTO hotel_details (id, venue_name, venue_address, venue_contact, venue_map_link, email) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, venue_name, venue_address, venue_contact, venue_map_link, email],
    );
    return id;
  }

  static async updateHotel(id, updateData) {
    const fields = [
      "venue_name",
      "venue_address",
      "venue_contact",
      "venue_map_link",
      "email",
      "status",
    ];
    const updates = [];
    const params = [];

    fields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updateData[field]);
      }
    });

    if (updates.length > 0) {
      params.push(id);
      const [result] = await db.query(
        `UPDATE hotel_details SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );
      return result.affectedRows > 0;
    }
    return false;
  }

  static async deleteHotel(id) {
    const [result] = await db.query(
      "UPDATE hotel_details SET status = 0 WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }

  static async createHotelFile(fileData) {
    const { hotel_id, file_name, file_type } = fileData;
    const id = uuidv4();
    await db.query(
      "INSERT INTO hotel_files (id, hotel_id, file_name, file_type) VALUES (?, ?, ?, ?)",
      [id, hotel_id, file_name, file_type],
    );
    return id;
  }

  static async getHotelFiles(hotelId) {
    const [rows] = await db.query(
      "SELECT * FROM hotel_files WHERE hotel_id = ? AND status = 1",
      [hotelId],
    );
    return rows;
  }

  static async deleteHotelFile(fileId) {
    const [result] = await db.query(
      "UPDATE hotel_files SET status = 0 WHERE id = ?",
      [fileId],
    );
    return result.affectedRows > 0;
  }
}

module.exports = HotelDetailDao;
