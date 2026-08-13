const db = require("../config/db");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

class StudyMaterialDao {
  static async getAllStudyMaterials(filters = {}) {
    let baseQuery = `
      FROM study_materials sm 
      JOIN master_course mc ON sm.master_course_id = mc.id 
      WHERE sm.status = 1
    `;
    const params = [];

    if (filters.search) {
      baseQuery += " AND (sm.category LIKE ? OR mc.master_course_name LIKE ?)";
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm);
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as totalCount ${baseQuery}`;
    const [countResult] = await db.query(countQuery, params);
    const totalCount = countResult[0].totalCount;

    // Build data query - we also want to get the count of files for each study material
    let dataQuery = `
      SELECT sm.*, mc.master_course_name, 
             (SELECT COUNT(*) FROM study_material_files smf WHERE smf.study_material_id = sm.id) as files_count
      ${baseQuery}
    `;

    // Sorting
    const sortBy = filters.sort_by || "created_at";
    const sortOrder = filters.sort_order === "asc" ? "ASC" : "DESC";
    // Whitelist sortable columns to prevent SQL injection
    const allowedSortColumns = [
      "category",
      "user_type",
      "access_type",
      "created_at",
      "updated_at",
    ];
    if (allowedSortColumns.includes(sortBy)) {
      dataQuery += ` ORDER BY sm.${sortBy} ${sortOrder}`;
    } else {
      dataQuery += " ORDER BY sm.created_at DESC";
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

  static async getStudyMaterialById(id) {
    const query = `
      SELECT sm.*, mc.master_course_name 
      FROM study_materials sm
      JOIN master_course mc ON sm.master_course_id = mc.id 
      WHERE sm.id = ? AND sm.status = 1
    `;
    const [rows] = await db.query(query, [id]);
    
    if (rows.length === 0) return null;
    
    const studyMaterial = rows[0];
    
    // Fetch associated files
    const filesQuery = `
      SELECT * FROM study_material_files 
      WHERE study_material_id = ?
    `;
    const [files] = await db.query(filesQuery, [id]);
    
    studyMaterial.files = files;
    return studyMaterial;
  }

  static async createStudyMaterial(data, files = []) {
    const { master_course_id, category, user_type, access_type } = data;
    const id = uuidv4();
    
    // Insert main record
    await db.query(
      `INSERT INTO study_materials (id, master_course_id, category, user_type, access_type, status) 
       VALUES (?, ?, ?, ?, ?, 1)`,
      [id, master_course_id, category, user_type, access_type || 'view'],
    );
    
    // Insert files if any
    if (files && files.length > 0) {
      const fileInsertPromises = files.map(file => {
        const fileId = uuidv4();
        const fileNameToSave = `${user_type || 'both'}/${file.filename}`;
        return db.query(
          `INSERT INTO study_material_files (id, study_material_id, file_name, file_original_name, display_name) 
           VALUES (?, ?, ?, ?, ?)`,
          [fileId, id, fileNameToSave, file.originalname, file.display_name || file.originalname]
        );
      });
      await Promise.all(fileInsertPromises);
    }
    
    return id;
  }

  static async updateStudyMaterial(id, updateData, newFiles = [], removedFileIds = []) {
    const existing = await this.getStudyMaterialById(id);
    if (!existing) return false;

    // Detect user_type change
    const newUserType = updateData.user_type;
    const oldUserType = existing.user_type;
    const userTypeChanged = newUserType !== undefined && newUserType !== oldUserType;

    if (userTypeChanged) {
      const baseDir = "uploads/study_material";
      const newDir = path.join(baseDir, newUserType);
      
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true });
      }

      // Filter out files that are being removed in this same request
      const filesToMove = (existing.files || []).filter(f => !removedFileIds.includes(f.id));

      for (const file of filesToMove) {
        const basename = path.basename(file.file_name);
        const oldPath = path.join(baseDir, file.file_name);
        const newPath = path.join(newDir, basename);

        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
        }

        const newDbFileName = `${newUserType}/${basename}`;
        await db.query(
          `UPDATE study_material_files SET file_name = ? WHERE id = ?`,
          [newDbFileName, file.id]
        );
      }
    }

    // 1. Update main fields if provided
    const fields = [
      "master_course_id",
      "category",
      "user_type",
      "access_type",
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
      await db.query(
        `UPDATE study_materials SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );
    }
    
    // 2. Remove specified files
    if (removedFileIds && removedFileIds.length > 0) {
      // Create a string of placeholders for the IN clause
      const placeholders = removedFileIds.map(() => '?').join(',');
      await db.query(
        `DELETE FROM study_material_files WHERE study_material_id = ? AND id IN (${placeholders})`,
        [id, ...removedFileIds]
      );
    }
    
    // 3. Update existing file display names
    if (updateData.file_display_names_update && updateData.file_display_names_update.length > 0) {
       const updatePromises = updateData.file_display_names_update.map(file => {
         return db.query(
           `UPDATE study_material_files SET display_name = ? WHERE id = ? AND study_material_id = ?`,
           [file.display_name, file.id, id]
         );
       });
       await Promise.all(updatePromises);
     }
    
    // 4. Add new files
    if (newFiles && newFiles.length > 0) {
      const currentUserType = updateData.user_type || existing.user_type || 'both';
      const fileInsertPromises = newFiles.map(file => {
        const fileId = uuidv4();
        const fileNameToSave = `${currentUserType}/${file.filename}`;
        return db.query(
          `INSERT INTO study_material_files (id, study_material_id, file_name, file_original_name, display_name) 
           VALUES (?, ?, ?, ?, ?)`,
          [fileId, id, fileNameToSave, file.originalname, file.display_name || file.originalname]
        );
      });
      await Promise.all(fileInsertPromises);
    }

    return true;
  }

  static async deleteStudyMaterial(id) {
    const [result] = await db.query(
      "UPDATE study_materials SET status = 0 WHERE id = ?",
      [id],
    );
    return result.affectedRows > 0;
  }
}

module.exports = StudyMaterialDao;
