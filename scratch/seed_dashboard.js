const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  try {
    console.log("Starting dashboard seeding...");

    // 1. Get some basic data
    const [trainers] = await pool.query("SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'trainer' LIMIT 3");
    const [candidates] = await pool.query("SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'candidate' LIMIT 5");
    const [masterCourses] = await pool.query("SELECT id, master_course_name, topic FROM master_course LIMIT 3");

    if (trainers.length === 0 || candidates.length === 0 || masterCourses.length === 0) {
      console.error("Missing baseline data (trainers, candidates, or master courses). Please seed them first.");
      process.exit(1);
    }

    const trainerId = trainers[0].id;
    const candidateIds = candidates.map(c => c.id);

    // 2. Create Dummy Courses
    const dummyCourses = [
      {
        id: uuidv4(),
        course_id: 'COURSE-2026-001',
        master_course_id: masterCourses[0].id,
        master_course_name: masterCourses[0].master_course_name,
        topic: masterCourses[0].topic,
        course_name: 'Advanced Navigation Workshop',
        start_date: '2026-05-10 09:00:00',
        end_date: '2026-05-12 17:00:00',
        status: 'Active',
        primary_trainer_id: trainerId
      },
      {
        id: uuidv4(),
        course_id: 'COURSE-2026-002',
        master_course_id: masterCourses[1].id,
        master_course_name: masterCourses[1].master_course_name,
        topic: masterCourses[1].topic,
        course_name: 'Marine Engineering Refresher',
        start_date: '2026-06-01 10:00:00',
        end_date: '2026-06-03 16:00:00',
        status: 'Initiated',
        primary_trainer_id: trainerId
      },
      {
        id: uuidv4(),
        course_id: 'COURSE-2026-003',
        master_course_id: masterCourses[2].id,
        master_course_name: masterCourses[2].master_course_name,
        topic: masterCourses[2].topic,
        course_name: 'Fire Safety Drill',
        start_date: '2026-04-15 08:30:00',
        end_date: '2026-04-16 17:30:00',
        status: 'Completed',
        primary_trainer_id: trainerId
      },
      {
        id: uuidv4(),
        course_id: 'COURSE-2026-004',
        master_course_id: masterCourses[0].id,
        master_course_name: masterCourses[0].master_course_name,
        topic: masterCourses[0].topic,
        course_name: 'Electronic Chart Systems',
        start_date: '2026-05-20 09:00:00',
        end_date: '2026-05-22 17:00:00',
        status: 'Active',
        primary_trainer_id: trainerId
      }
    ];

    for (const course of dummyCourses) {
      await pool.query(
        `INSERT INTO courses (id, course_id, master_course_id, master_course_name, topic, course_name, start_date, end_date, status, primary_trainer_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE course_name = VALUES(course_name)`,
        [course.id, course.course_id, course.master_course_id, course.master_course_name, course.topic, course.course_name, course.start_date, course.end_date, course.status, course.primary_trainer_id]
      );

      // Enroll candidates
      for (const candidateId of candidateIds.slice(0, 3)) {
        await pool.query(
          `INSERT INTO courses_enrollment (id, course_id, candidate_id, status)
           VALUES (?, ?, ?, 'Active')
           ON DUPLICATE KEY UPDATE status = 'Active'`,
          [uuidv4(), course.id, candidateId]
        );
      }

      // Add feedback for completed courses
      if (course.status === 'Completed') {
          // Find or create a feedback form/question to avoid errors
          const [questions] = await pool.query("SELECT id FROM feedback_questions LIMIT 1");
          if (questions.length > 0) {
              for (const candidateId of candidateIds.slice(0, 3)) {
                  await pool.query(
                      `INSERT INTO feedback_question_answer (id, candidate_id, active_course_id, feedback_question_id, answer)
                       VALUES (?, ?, ?, ?, ?)`,
                      [uuidv4(), candidateId, course.id, questions[0].id, (Math.random() * 2 + 3).toFixed(1)] // Random rating between 3 and 5
                  );
              }
          }
      }
    }

    // 3. Create Expiry Alerts (Next 6 Months)
    console.log("Seeding expiry alerts...");
    const now = new Date();
    const expiryDates = [
      new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
      new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000), // 4 months from now
    ];

    for (let i = 0; i < expiryDates.length; i++) {
        const expiryDate = expiryDates[i].toISOString().split('T')[0];
        const candidateId = candidateIds[i % candidateIds.length];
        const courseId = dummyCourses[i % dummyCourses.length].id;

        await pool.query(
            `INSERT INTO course_attendance (id, course_id, candidate_id, attendance_date, status, certificate_issue_date, certificate_expiry_date, mark_as_read)
             VALUES (?, ?, ?, ?, 'Present', ?, ?, 0)`,
            [uuidv4(), courseId, candidateId, '2026-01-01', '2026-01-05', expiryDate]
        );
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seed();
