const AssessmentDao = require("../dao/AssessmentDao");
const AssessmentResultDao = require("../dao/AssessmentResultDao");

exports.createAssessment = async (req, res) => {
  try {
    const {
      title,
      course_id,
      type_of_test,
      candidate_ids,
      num_of_questions,
      questions_choice,
      question_ids,
    } = req.body;

    const user = req.user;
    const trainerId =
      user.role.toLowerCase() === "trainer" ? user.id : null;

    if (!title || !course_id || !type_of_test) {
      return res.status(400).json({
        success: false,
        message: "Title, Course, and Type of Test are required",
      });
    }

    // Verify course ownership if trainer
    if (trainerId) {
      const pool = require("../config/db");
      const [courseRows] = await pool.execute(
        "SELECT primary_trainer_id, master_course_id FROM courses WHERE id = ?",
        [course_id],
      );

      if (courseRows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      }

      if (courseRows[0].primary_trainer_id !== trainerId) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to create assessments for this course",
        });
      }

      // Validate question count for 'auto' choice
      if (questions_choice === "auto") {
        const questions = await AssessmentDao.getQuestionsByMasterCourse(
          courseRows[0].master_course_id,
          type_of_test,
        );
        if (questions.length < (num_of_questions || 10)) {
          return res.status(400).json({
            success: false,
            message: `Not enough questions available for auto selection. Available: ${questions.length}, Requested: ${num_of_questions || 10}`,
          });
        }
      }
    }

    // Check if Pre/Post assessment already exists for the course
    if (type_of_test === "1" || type_of_test === "2") {
      const existingAssessments = await AssessmentDao.getAssessmentsByCourseId(
        course_id,
        type_of_test,
      );
      if (existingAssessments.length > 0) {
        return res.status(400).json({
          success: false,
          message: `A ${type_of_test === "1" ? "Pre" : "Post"} Course assessment already exists for this course.`,
        });
      }
    }

    // For pre/post tests, auto-populate candidates from course
    let finalCandidateIds = candidate_ids;
    if (type_of_test === "1" || type_of_test === "2") {
      const candidates = await AssessmentDao.getCandidatesByCourse(course_id);
      finalCandidateIds = candidates.map((c) => c.id).join(",");
    } else if (type_of_test === "3" && Array.isArray(candidate_ids)) {
      // For daily, candidates should be multi-select (passed as array from UI)
      finalCandidateIds = candidate_ids.join(",");
    }

    const newAssessment = await AssessmentDao.create({
      title,
      course_id,
      type_of_test,
      candidate_ids: finalCandidateIds || null,
      num_of_questions: num_of_questions || 10,
      questions_choice: questions_choice || "auto",
      question_ids:
        questions_choice === "manual"
          ? Array.isArray(question_ids)
            ? question_ids.join(",")
            : question_ids
          : null,
    });

    // Send email notifications to candidates
    try {
      const pool = require("../config/db");
      const [courseRows] = await pool.execute(
        "SELECT course_name FROM courses WHERE id = ?",
        [course_id],
      );
      const courseName = courseRows[0]?.course_name || "Course";

      const emailService = require("../utils/emailService");
      const { getAssessmentCreationTemplate } = require("../utils/emailTemplates");

      if (finalCandidateIds) {
        const ids = finalCandidateIds.split(",");
        const [candidateRows] = await pool.execute(
          `SELECT id, first_name, last_name, email FROM users WHERE id IN (${ids.map(() => "?").join(",")})`,
          ids,
        );

        for (const candidate of candidateRows) {
          if (candidate.email) {
            const html = getAssessmentCreationTemplate(
              `${candidate.first_name} ${candidate.last_name}`,
              courseName,
              title,
              type_of_test,
            );
            await emailService.sendEmail(
              candidate.email,
              `New Assessment Assigned - ${courseName}`,
              html,
            );
          }
        }
      }
    } catch (emailError) {
      console.error("Error sending assessment creation emails:", emailError);
      // We don't fail the request if email sending fails
    }

    res.status(201).json({
      success: true,
      message: "Assessment created successfully",
      data: newAssessment,
    });
  } catch (error) {
    console.error("Error creating assessment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAllAssessments = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const user = req.user;
    const trainerId =
      user.role.toLowerCase() === "trainer" ? user.id : null;

    const result = await AssessmentDao.getAll(search, page, limit, trainerId);
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    console.error("Error fetching assessments:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAssessmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const assessment = await AssessmentDao.getById(id);
    if (!assessment) {
      return res
        .status(404)
        .json({ success: false, message: "Assessment not found" });
    }
    res.status(200).json({ success: true, data: assessment });
  } catch (error) {
    console.error("Error fetching assessment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updateAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      course_id,
      type_of_test,
      candidate_ids,
      num_of_questions,
      questions_choice,
      question_ids,
    } = req.body;

    const user = req.user;
    const trainerId =
      user.role.toLowerCase() === "trainer" ? user.id : null;

    // Verify course ownership if trainer
    if (trainerId) {
      const pool = require("../config/db");
      const [courseRows] = await pool.execute(
        "SELECT primary_trainer_id, master_course_id FROM courses WHERE id = ?",
        [course_id],
      );

      if (courseRows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      }

      if (courseRows[0].primary_trainer_id !== trainerId) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to update assessments for this course",
        });
      }

      // Validate question count for 'auto' choice
      if (questions_choice === "auto") {
        const questions = await AssessmentDao.getQuestionsByMasterCourse(
          courseRows[0].master_course_id,
          type_of_test,
        );
        if (questions.length < (num_of_questions || 10)) {
          return res.status(400).json({
            success: false,
            message: `Not enough questions available for auto selection. Available: ${questions.length}, Requested: ${num_of_questions || 10}`,
          });
        }
      }
    }

    // Check if Pre/Post assessment already exists for the course (excluding current one)
    if (type_of_test === "1" || type_of_test === "2") {
      const existingAssessments = await AssessmentDao.getAssessmentsByCourseId(
        course_id,
        type_of_test,
      );
      const conflict = existingAssessments.find((a) => a.id !== id);
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: `A ${type_of_test === "1" ? "Pre" : "Post"} Course assessment already exists for this course.`,
        });
      }
    }

    // For pre/post tests, auto-populate candidates from course
    let finalCandidateIds = candidate_ids;
    if (type_of_test === "1" || type_of_test === "2") {
      const candidates = await AssessmentDao.getCandidatesByCourse(course_id);
      finalCandidateIds = candidates.map((c) => c.id).join(",");
    } else if (type_of_test === "3" && Array.isArray(candidate_ids)) {
      finalCandidateIds = candidate_ids.join(",");
    }

    const updated = await AssessmentDao.update(id, {
      title,
      course_id,
      type_of_test,
      candidate_ids: finalCandidateIds || null,
      num_of_questions: num_of_questions || 10,
      questions_choice: questions_choice || "auto",
      question_ids:
        questions_choice === "manual"
          ? Array.isArray(question_ids)
            ? question_ids.join(",")
            : question_ids
          : null,
    });

    if (updated) {
      res
        .status(200)
        .json({ success: true, message: "Assessment updated successfully" });
    } else {
      res.status(404).json({
        success: false,
        message: "Assessment not found or no changes made",
      });
    }
  } catch (error) {
    console.error("Error updating assessment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.deleteAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AssessmentDao.delete(id);
    if (deleted) {
      res
        .status(200)
        .json({ success: true, message: "Assessment deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Assessment not found" });
    }
  } catch (error) {
    console.error("Error deleting assessment:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getActiveCourses = async (req, res) => {
  try {
    const { type_of_test, assessment_id } = req.query;
    const user = req.user;
    const trainerId =
      user.role.toLowerCase() === "trainer" ? user.id : null;

    const courses = await AssessmentDao.getActiveCourses(
      type_of_test || null,
      assessment_id || null,
      trainerId,
    );
    res.status(200).json({ success: true, data: courses });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getCandidatesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const candidates = await AssessmentDao.getCandidatesByCourse(courseId);
    res.status(200).json({ success: true, data: candidates });
  } catch (error) {
    console.error("Error fetching candidates:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getQuestionsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { type_of_test } = req.query;

    // Get course to find master_course_name
    const pool = require("../config/db");
    const [courseRows] = await pool.execute(
      "SELECT master_course_id, master_course_name FROM courses WHERE id = ?",
      [courseId],
    );

    if (courseRows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    const masterCourseId = courseRows[0].master_course_id;
    const questions = await AssessmentDao.getQuestionsByMasterCourse(
      masterCourseId,
      type_of_test,
    );

    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ==========================================
// Submitted Assessment Controllers
// ==========================================

exports.getSubmittedCourses = async (req, res) => {
  try {
    const { search, page, limit, type_of_test } = req.query;
    const result = await AssessmentResultDao.getCoursesWithSubmissions(
      search,
      page || 1,
      limit || 10,
      type_of_test,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      totalCount: result.totalCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error fetching submitted courses:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getPaginatedSubmissions = async (req, res) => {
  try {
    const { 
      search, 
      page, 
      limit, 
      type_of_test: typeOfTest, 
      course_id: courseId,
      type,
      course
    } = req.query;

    const result = await AssessmentResultDao.getAllSubmissionsPaginated(
      search,
      page || 1,
      limit || 10,
      typeOfTest || type,
      courseId || course,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      totalCount: result.totalCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error fetching paginated submissions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getCourseSubmissions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { search, page, limit } = req.query;
    const result = await AssessmentResultDao.getSubmissionsByCourse(
      courseId,
      search,
      page || 1,
      limit || 10,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      totalCount: result.totalCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error fetching course submissions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getSubmissionDetail = async (req, res) => {
  try {
    const { resultId } = req.params;
    const detail = await AssessmentResultDao.getSubmissionDetail(resultId);
    if (!detail) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    console.error("Error fetching submission detail:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAssessmentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { type_of_test } = req.query;
    const assessments = await AssessmentDao.getAssessmentsByCourseId(
      courseId,
      type_of_test,
    );
    res.status(200).json({ success: true, data: assessments });
  } catch (error) {
    console.error("Error fetching course assessments:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAssessmentSubmissions = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { search, page, limit } = req.query;
    const result = await AssessmentResultDao.getSubmissionsByAssessment(
      assessmentId,
      search,
      page || 1,
      limit || 10,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      totalCount: result.totalCount,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error fetching assessment submissions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getPlayAssessmentQuestions = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch assessment details
    const assessment = await AssessmentDao.getAssessmentDetailsForPlay(id);
    if (!assessment) {
      return res
        .status(404)
        .json({ success: false, message: "Assessment not found or inactive" });
    }

    const {
      questions_choice,
      question_ids,
      num_of_questions,
      master_course_id,
      type_of_test,
    } = assessment;

    let questions = [];

    // 2. Fetch questions based on 'auto' or 'manual' mode
    if (questions_choice === "auto") {
      // Fetch all questions from the Master course for this test type
      questions = await AssessmentDao.getQuestionsByMasterCourse(
        master_course_id,
        type_of_test,
      );
    } else if (questions_choice === "manual") {
      // Decode the saved comma-separated question IDs
      if (question_ids) {
        const idsArray = question_ids
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean);
        questions = await AssessmentDao.getQuestionsByIds(idsArray);
      }
    }

    if (!questions || questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No questions found for this assessment.",
      });
    }

    // 3. Robust Shuffle Array algorithm (Fisher-Yates)
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    // 4. Limit questions exactly to `num_of_questions`
    const finalQuestions = questions.slice(0, num_of_questions || 10);

    // Return randomized questions
    res.status(200).json({
      success: true,
      assessment: {
        id: assessment.id,
        title: assessment.title,
        num_of_questions: finalQuestions.length,
        type_of_test: assessment.type_of_test,
        master_course_name: assessment.master_course_name,
      },
      data: finalQuestions,
    });
  } catch (error) {
    console.error("Error fetching play assessment questions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.downloadSubmissionById = async (req, res) => {
  try {
    const { resultId } = req.params;
    const detail = await AssessmentResultDao.getSubmissionDetail(resultId);

    if (!detail) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const PDFDocument = require("pdfkit");
    const { result, answers } = detail;

    const typeLabel =
      { 1: "Pre Course", 2: "Post Course", 3: "Daily" }[result.type_of_test] ||
      result.type_of_test ||
      "N/A";

    const percentage =
      result.total_questions > 0
        ? ((result.correct_answers / result.total_questions) * 100).toFixed(1)
        : 0;
    const resultStatus = percentage >= 50 ? "PASS" : "FAIL";

    const formattedDate = result.created_at
      ? new Date(result.created_at).toLocaleString("en-GB")
      : "N/A";

    const candidateName =
      `${result.first_name || ""} ${result.last_name || ""}`.trim() ||
      "Candidate";
    const fileNameCandidate = candidateName.replace(/ /g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Assessment_Result_${fileNameCandidate}_${dateStr}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    // Header band
    doc.rect(40, 40, doc.page.width - 80, 60).fill("#1a237e");
    doc
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .fontSize(16)
      .text("MOLMI - Assessment Result", 55, 55);
    doc
      .fillColor("#c5cae9")
      .font("Helvetica")
      .fontSize(10)
      .text(result.assessment_title || "Assessment", 55, 75);
    doc
      .fillColor(resultStatus === "PASS" ? "#a5d6a7" : "#ef9a9a")
      .font("Helvetica-Bold")
      .fontSize(20)
      .text(resultStatus, doc.page.width - 120, 58, {
        width: 80,
        align: "right",
      });

    doc.moveDown(3.5);

    // Info section
    const infoY = doc.y;
    const colW = (doc.page.width - 80) / 4;
    const infoItems = [
      ["Candidate", candidateName],
      ["Employee ID", result.employee_id || "N/A"],
      ["Rank", result.rank || "N/A"],
      ["Email", result.email || "N/A"],
      ["Course", result.course_name || "N/A"],
      ["Type", typeLabel],
      [
        "Score",
        `${result.correct_answers ?? 0} / ${result.total_questions ?? 0} (${percentage}%)`,
      ],
      ["Date", formattedDate],
    ];

    infoItems.forEach(([label, value], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 40 + col * colW;
      const y = infoY + row * 44;
      const bgColor = row % 2 === 0 ? "#f0f3fa" : "#ffffff";
      doc.rect(x, y, colW, 44).fill(bgColor).stroke("#dde1e7");
      doc
        .fillColor("#555")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(label, x + 4, y + 6, { width: colW - 8 });
      doc
        .fillColor("#222")
        .font("Helvetica")
        .fontSize(8)
        .text(value, x + 4, y + 20, { width: colW - 8 });
    });

    doc.y = infoY + Math.ceil(infoItems.length / 4) * 44 + 16;

    // Q&A section heading
    doc
      .fillColor("#1a237e")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(
        `Questions & Answers (${answers.length} question${answers.length !== 1 ? "s" : ""})`,
        40,
        doc.y,
        { underline: true, width: doc.page.width - 80 },
      );
    doc.moveDown(0.5);

    const optionKeys = ["option_a", "option_b", "option_c", "option_d"];
    const optionLabels = ["A", "B", "C", "D"];

    if (answers && answers.length > 0) {
      answers.forEach((ans, idx) => {
        if (doc.y > doc.page.height - 120) doc.addPage();

        doc
          .fillColor("#1a237e")
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(`Q${idx + 1}.  ${ans.question || ""}`, 40, doc.y, {
            width: doc.page.width - 80,
          });
        doc.moveDown(0.3);

        optionKeys.forEach((key, i) => {
          const optText = ans[key];
          if (!optText) return;

          const isCorrect = ans.correct_option === key;
          const isSelected = ans.selected_option === key;

          let bgColor = "#f9f9f9";
          let textColor = "#333";
          let suffix = "";

          if (isCorrect && isSelected) {
            bgColor = "#d4edda";
            textColor = "#155724";
            suffix = "  Correct";
          } else if (isSelected && !isCorrect) {
            bgColor = "#f8d7da";
            textColor = "#721c24";
            suffix = "  Wrong";
          } else if (isCorrect && !isSelected) {
            bgColor = "#d4edda";
            textColor = "#155724";
            suffix = "  (Correct Answer)";
          }

          const optY = doc.y;
          doc
            .rect(40, optY, doc.page.width - 80, 18)
            .fill(bgColor)
            .stroke("#e0e0e0");
          doc
            .fillColor(textColor)
            .font("Helvetica")
            .fontSize(9)
            .text(`${optionLabels[i]}.  ${optText}${suffix}`, 46, optY + 4, {
              width: doc.page.width - 92,
            });
          doc.y = optY + 20;
        });

        doc.moveDown(0.4);

        if (idx < answers.length - 1) {
          doc
            .moveTo(40, doc.y)
            .lineTo(doc.page.width - 40, doc.y)
            .strokeColor("#e0e0e0")
            .lineWidth(0.5)
            .stroke();
          doc.moveDown(0.4);
        }
      });
    } else {
      doc
        .fillColor("#888")
        .font("Helvetica-Oblique")
        .fontSize(10)
        .text("No answers recorded for this submission.");
    }

    doc.end();
  } catch (error) {
    console.error("Download Submission PDF Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.exportSubmittedAssessments = async (req, res) => {
  try {
    const { 
      search, 
      type_of_test: typeOfTest, 
      course_id: courseId,
      type,
      course
    } = req.query;
    const xlsx = require("xlsx");

    const submissions = await AssessmentResultDao.getAllSubmissions(
      search, 
      typeOfTest || type, 
      courseId || course
    );

    if (submissions.length === 0) {
      return res.status(404).json({ message: "No submissions found." });
    }

    const headers = [
      "Sr. No.",
      "Date",
      "Candidate Name",
      "Employee ID / Passport",
      "Rank",
      "Email",
      "Course Name",
      "Course Code",
      "Assessment Title",
      "Type",
      "Score",
      "Total Questions",
      "Result",
    ];

    const rows = submissions.map((sub, index) => {
      const typeLabel =
        { 1: "Pre Course", 2: "Post Course", 3: "Daily" }[sub.type_of_test] ||
        sub.type_of_test;

      const percentage = (sub.score / sub.total_questions) * 100;
      const resultStatus = percentage >= 50 ? "PASS" : "FAIL";

      return [
        index + 1,
        new Date(sub.created_at).toLocaleDateString("en-GB") +
          " " +
          new Date(sub.created_at).toLocaleTimeString("en-GB"),
        `${sub.first_name} ${sub.last_name}`,
        sub.employee_id || sub.passport_no || "--",
        sub.rank || "--",
        sub.email,
        sub.course_name,
        sub.course_code,
        sub.assessment_title,
        typeLabel,
        `${sub.score} / ${sub.total_questions}`,
        sub.total_questions,
        resultStatus,
      ];
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);

    const wscols = headers.map((h) => ({ wch: h.length + 5 }));
    ws["!cols"] = wscols;

    xlsx.utils.book_append_sheet(wb, ws, "Submitted Assessments");

    const wbout = xlsx.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Submitted_Assessments.xlsx"',
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(wbout);
  } catch (error) {
    console.error("Export Submitted Assessments Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};
exports.getCandidateAssessmentsByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const candidateId = req.user.id;

    const assessments = await AssessmentDao.getCandidateAssessmentsByCourse(
      courseId,
      candidateId,
    );
    res.status(200).json({ success: true, data: assessments });
  } catch (error) {
    console.error("Error fetching candidate assessments:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.submitAssessment = async (req, res) => {
  try {
    const { assessment_id, course_id, answers } = req.body;
    const candidate_id = req.user.id;

    if (!assessment_id || !course_id || !answers) {
      return res.status(400).json({
        success: false,
        message: "Assessment ID, Course ID, and answers are required",
      });
    }

    // 1. Fetch assessment details to verify questions
    const assessment = await AssessmentDao.getById(assessment_id);
    if (!assessment) {
      return res
        .status(404)
        .json({ success: false, message: "Assessment not found" });
    }

    // 2. Fetch correct answers for scoring
    const questionIds = answers.map((a) => a.question_id);
    const questions = await AssessmentDao.getQuestionsByIds(questionIds);

    let correctCount = 0;
    const processedAnswers = answers.map((ans) => {
      const question = questions.find((q) => q.id === ans.question_id);
      const isCorrect = question
        ? question.correct_option === ans.selected_option
        : false;
      if (isCorrect) correctCount++;
      return {
        ...ans,
        is_correct: isCorrect,
      };
    });

    const totalQuestions = questionIds.length;
    if (totalQuestions > 0 && answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one answer is required to submit the assessment",
      });
    }
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // 3. Save submission
    const result = await AssessmentResultDao.saveSubmission({
      assessment_id,
      candidate_id,
      course_id,
      score,
      total_questions: totalQuestions,
      correct_answers: correctCount,
      answers: processedAnswers,
    });

    res.status(200).json({
      success: true,
      message: "Assessment submitted successfully",
      data: {
        result_id: result.id,
        score,
        correct_answers: correctCount,
        total_questions: totalQuestions,
        attempt_number: result.attempt_number,
      },
    });
  } catch (error) {
    console.error("Error submitting assessment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during submission",
    });
  }
};
