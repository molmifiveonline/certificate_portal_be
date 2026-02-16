const db = require("./config/db");

async function checkAllCandidates() {
  try {
    const query = `
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.status as user_status,
        cp.registration_type, 
        cp.employee_id
      FROM users u
      JOIN candidate_profiles cp ON u.id = cp.user_id
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'candidate'
    `;
    const [rows] = await db.query(query);
    console.log("Total Candidates:", rows.length);
    console.table(rows);
    process.exit();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkAllCandidates();
