const pool = require("../config/db");

class ReportDao {
  static async getDistinctTopics() {
    const query = `SELECT DISTINCT topic FROM courses WHERE topic IS NOT NULL AND topic != '' ORDER BY topic ASC`;
    const [rows] = await pool.execute(query);
    return rows.map((r) => r.topic);
  }

  static async getDistinctManagers() {
    const query = `SELECT DISTINCT manager FROM candidate_profiles WHERE manager IS NOT NULL AND manager != '' ORDER BY manager ASC`;
    const [rows] = await pool.execute(query);
    return rows.map((r) => r.manager);
  }

  static async getDistinctCompanies() {
    const query = `SELECT DISTINCT manning_company FROM candidate_profiles WHERE manning_company IS NOT NULL AND manning_company != '' ORDER BY manning_company ASC`;
    const [rows] = await pool.execute(query);
    return rows.map((r) => r.manning_company);
  }

  static async getFeedbackQuestionIds(startDate, endDate) {
    if (endDate.length === 10) endDate += " 23:59:59";

    const query = `
            SELECT DISTINCT feedback_question_id 
            FROM feedback_question_answer 
            WHERE created_at >= ? AND created_at <= ?
        `;
    const [rows] = await pool.execute(query, [startDate, endDate]);
    return rows.map((r) => r.feedback_question_id);
  }

  static async getAllFeedbackQuestionsCombined(status = 1) {
    let query = `SELECT * FROM feedback_question`;
    const params = [];
    if (status) {
      query += ` WHERE status = ?`;
      params.push(status);
    }

    const [rows] = await pool.execute(query, params);

    const ratings = [];
    const nonRatings = [];

    rows.forEach((row) => {
      if (
        row.question_format &&
        row.question_format.toLowerCase() === "ratings"
      ) {
        ratings.push(row);
      } else {
        nonRatings.push(row);
      }
    });

    return { ratings, nonRatings };
  }

  static async getQuestionsWithCategories(questionIds) {
    if (!questionIds || questionIds.length === 0) return [];

    // Dynamic placeholders for IN clause
    const placeholders = questionIds.map(() => "?").join(",");
    const query = `
            SELECT fq.id, fq.question, fq.feedback_category_id, fq.question_format, fc.name as category_name 
            FROM feedback_question fq 
            LEFT JOIN feedback_category fc ON fq.feedback_category_id = fc.id 
            WHERE fq.id IN (${placeholders})
        `;

    const [rows] = await pool.execute(query, questionIds);
    return rows;
  }

  static async getCandidateCoursePairs(startDate, endDate, filters = {}) {
    if (endDate.length === 10) endDate += " 23:59:59";

    let query = `
            SELECT fqa.candidate_id, fqa.active_course_id, MAX(fqa.created_at) as created_at 
            FROM feedback_question_answer fqa`;
    const params = [];

    if (filters.topic) {
      query += ` JOIN courses ac ON fqa.active_course_id = ac.id`;
    }
    if (filters.manager) {
      query += ` JOIN candidate_profiles cp ON fqa.candidate_id = cp.user_id`;
    }

    query += ` WHERE fqa.created_at >= ? AND fqa.created_at <= ?`;
    params.push(startDate, endDate);

    if (filters.topic) {
      query += ` AND ac.topic = ?`;
      params.push(filters.topic);
    }
    if (filters.manager) {
      query += ` AND cp.manager = ?`;
      params.push(filters.manager);
    }

    query += ` GROUP BY fqa.candidate_id, fqa.active_course_id ORDER BY MAX(fqa.created_at) DESC`;

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async getAllFeedbackAnswersChunk(candidateIds, courseIds) {
    if (candidateIds.length === 0 || courseIds.length === 0) return [];

    const candPlaceholders = candidateIds.map(() => "?").join(",");
    const coursePlaceholders = courseIds.map(() => "?").join(",");

    const query = `
            SELECT candidate_id, active_course_id, feedback_question_id, answer, feedback_question_option_text 
            FROM feedback_question_answer 
            WHERE candidate_id IN (${candPlaceholders}) 
            AND active_course_id IN (${coursePlaceholders})
        `;

    const params = [...candidateIds, ...courseIds];
    const [rows] = await pool.execute(query, params);
    return rows;
  }

  // Helper to fetch Candidate info (Users + Profiles)
  static async getCandidatesByIds(candidateIds) {
    if (candidateIds.length === 0) return [];
    const placeholders = candidateIds.map(() => "?").join(",");

    const query = `
            SELECT 
                u.id, u.first_name, u.last_name, u.email, 
                cp.passport_no, cp.employee_id, cp.manager, cp.rank
            FROM users u
            JOIN candidate_profiles cp ON u.id = cp.user_id
            WHERE u.id IN (${placeholders})
        `;

    const [rows] = await pool.execute(query, candidateIds);
    return rows;
  }

  // Helper to fetch Course info
  static async getCoursesByIds(courseIds) {
    if (courseIds.length === 0) return [];
    const placeholders = courseIds.map(() => "?").join(",");
    const query = `SELECT * FROM courses WHERE id IN (${placeholders})`;
    const [rows] = await pool.execute(query, courseIds);
    return rows;
  }

  // Helper to fetch Trainer info (Users + Profiles)
  static async getTrainersByIds(trainerIds) {
    if (trainerIds.length === 0) return [];
    const placeholders = trainerIds.map(() => "?").join(",");

    const query = `
            SELECT 
                u.id, u.first_name, u.last_name, 
                tp.prefix, tp.designation
            FROM users u
            JOIN trainer_profiles tp ON u.id = tp.user_id
            WHERE u.id IN (${placeholders})
        `;

    const [rows] = await pool.execute(query, trainerIds);
    return rows;
  }

  // Helper to fetch Master Course info
  static async getMasterCoursesByIds(names) {
    if (names.length === 0) return [];
    const placeholders = names.map(() => "?").join(",");
    // Note: PHP used 'master_course_name' as ID in some places, check schema if needed.
    // Assuming courses.master_course_name stores the ID or Name.
    // Based on ActiveCourseDao: master_course_name seems to be just a name string or ID.
    // ActiveCourseDao: req.body.topic = topicName; // Store Name in DB, not UUID
    // But let's check MasterCourseDao if possible.
    // For now, assuming we select by ID if names are IDs, or generic SELECT * FROM master_courses
    const query = `SELECT * FROM master_courses WHERE id IN (${placeholders})`;
    const [rows] = await pool.execute(query, names);
    return rows;
  }

  static async getParticipantCounts(courseIds) {
    if (courseIds.length === 0) return [];
    const placeholders = courseIds.map(() => "?").join(",");
    const query = `
            SELECT course_id, COUNT(DISTINCT candidate_id) as total_participants 
            FROM courses_enrollment 
            WHERE course_id IN (${placeholders}) 
            GROUP BY course_id
        `;
    const [rows] = await pool.execute(query, courseIds);
    return rows;
  }

  // Retrieve full data for Certificate Report
  // This replicates the complex join from PHP logic but adapted for new schema (Users/Profiles)
  static async getCertificateReport(startDate, endDate, filters = {}) {
    if (endDate.length === 10) endDate += " 23:59:59";

    let query = `
            SELECT 
                c.id as certificate_id,
                c.candidate_id,
                c.active_course_id,
                c.course_id as master_course_id,
                c.trainer_id,
                c.certificate_no,
                c.issued_date,
                c.from_date,
                c.to_date,
                c.days,
                c.status,
                c.show_logo,
                c.topic,
                c.location,
                c.description1,
                c.remarks,
                
                u_cand.first_name as cand_first_name,
                u_cand.last_name as cand_last_name,
                curr_cp.passport_no,
                curr_cp.employee_id as empId,
                curr_cp.rank,
                curr_cp.manager,
                
                course.course_name,
                course.type_of_course,
                course.course_id as active_course_code,
                course.secondary_trainer_ids,
                
                mc.master_course_name,
                
                u_trainer.first_name as trainer_first_name,
                u_trainer.last_name as trainer_last_name,
                tp.prefix as trainer_prefix
                
            FROM certificates c
            LEFT JOIN users u_cand ON c.candidate_id = u_cand.id
            LEFT JOIN candidate_profiles curr_cp ON u_cand.id = curr_cp.user_id
            LEFT JOIN courses course ON c.active_course_id = course.id
            LEFT JOIN master_courses mc ON c.course_id = mc.id
            LEFT JOIN users u_trainer ON c.trainer_id = u_trainer.id
            LEFT JOIN trainer_profiles tp ON u_trainer.id = tp.user_id
            
            WHERE c.created_at >= ? AND c.created_at <= ?`;
    const params = [startDate, endDate];

    if (filters.topic) {
      query += ` AND c.topic = ?`;
      params.push(filters.topic);
    }
    if (filters.manager) {
      query += ` AND curr_cp.manager = ?`;
      params.push(filters.manager);
    }
    if (filters.company) {
      query += ` AND curr_cp.manning_company = ?`;
      params.push(filters.company);
    }

    query += ` ORDER BY c.created_at DESC`;

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async getHotelReport(filters = {}) {
    let query = `
      SELECT 
        ce.id as enrollment_id,
        ce.venue_name as hotel_name,
        c.course_name,
        c.start_date,
        c.end_date,
        c.course_type,
        u.id as candidate_id,
        u.first_name,
        u.last_name,
        cp.employee_id
      FROM courses_enrollment ce
      JOIN users u ON ce.candidate_id = u.id
      JOIN candidate_profiles cp ON u.id = cp.user_id
      JOIN courses c ON ce.course_id = c.id
      WHERE ce.venue_name IS NOT NULL AND ce.venue_name != ''
    `;
    const params = [];

    if (filters.hotel_name) {
      query += ` AND ce.venue_name LIKE ?`;
      params.push(`%${filters.hotel_name}%`);
    }

    if (filters.employee) {
      query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR cp.employee_id LIKE ?)`;
      params.push(`%${filters.employee}%`, `%${filters.employee}%`, `%${filters.employee}%`);
    }

    if (filters.course_name) {
      query += ` AND c.course_name LIKE ?`;
      params.push(`%${filters.course_name}%`);
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as totalCount FROM (${query}) as subquery`;
    const [countResult] = await pool.execute(countQuery, params);
    const totalCount = countResult[0].totalCount;

    query += ` ORDER BY ce.created_at DESC`;

    let page = null;
    let limit = null;

    if (filters.page && filters.limit) {
      page = Math.max(1, Number(filters.page));
      limit = Number(filters.limit);
      const offset = (page - 1) * limit;
      query += ` LIMIT ${limit} OFFSET ${offset}`;
    }

    const [rows] = await pool.execute(query, params);
    return {
      data: rows,
      total: totalCount,
      page: page || 1,
      limit: limit || totalCount,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
    };
  }
}

module.exports = ReportDao;
