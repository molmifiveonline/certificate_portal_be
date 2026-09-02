const ReportDao = require("../../dao/ReportDao");
const ExcelJS = require("exceljs");
const archiver = require("archiver");
const pdfmake = require("pdfmake");
const FeedbackAnswerDao = require("../../dao/FeedbackAnswerDao");
const CandidateDao = require("../../dao/candidateDao");
const ActiveCourseDao = require("../../dao/ActiveCourseDao");
const MasterCourseDao = require("../../dao/MasterCourseDao");
const TrainerDao = require("../../dao/trainerDao");

const {
  TRAINING_RECORD_MONTH_HEADERS,
  TRAINING_RECORD_SECTION_ORDER,
  TRG219_DOCUMENT_CODE,
  TRG219_DOCUMENT_REVISION,
  TRG219_DOCUMENT_DATE,
  TRG219_SECTION_DEFINITIONS,
  TRG219_SECTION_ORDER,
} = require("../../utils/constants");

const LEGACY_FEEDBACK_META_HEADERS = [
  "Sr. No.",
  "Date and time of Feedback submission",
  "Name of the participant : Use capital letters (First Name- Middle name- Surname)",
  "Employee Number - (Non MOLMI/ New Candidate enter your passport number)",
  "Start date of course",
  "End date of course",
  "Rank Last served on vessel before this course",
  "Name of the manager (last served)",
  "Course Name",
  "INHOUSE/OUTHOUSE",
  "No. of Participants",
  "Course No. (This information will be provided in your welcome letter)",
  "Location of course conducted",
  "Instructors Name(s)",
];

const LEGACY_FEEDBACK_RATING_COLUMNS = [
  { question: "Clarity of objectives.", category: "TRAINING COURSE OBJECTIVE" },
  { question: "Need of participants based on objective", category: "TRAINING COURSE OBJECTIVE" },
  { question: "Relevance to job at hand", category: "TRAINING COURSE OBJECTIVE" },
  { question: "Training objectives were clearly communicated and met", category: "TRAINING COURSE OBJECTIVE" },
  { question: "Value / importance of content", category: "TRAINING COURSE DESIGN" },
  { question: "Depth and detail of coverage", category: "TRAINING COURSE DESIGN" },
  { question: "Time allocation", category: "TRAINING COURSE DESIGN" },
  { question: "Determine the level of engagement and interaction during the training", category: "TRAINING COURSE DESIGN" },
  { question: "Evaluate the effectiveness of activities, exercises, and discussions", category: "TRAINING COURSE DESIGN" },
  { question: "Training provide a good balance between theory and practical application", category: "TRAINING COURSE DESIGN" },
  { question: "Clarity / relevance of illustration or examples", category: "TRAINING COURSE DELIVERY" },
  {
    question: "Effectiveness of presentation techniques",
    category: "TRAINING COURSE DELIVERY",
    header: "Effectiveness of presentation techniques  ( TRAINING COURSE DELIVERY )",
  },
  { question: "Adherence to time schedule", category: "TRAINING COURSE DELIVERY" },
  { question: "Measure the extent to which participants feel they have learned new skills", category: "TRAINING COURSE DELIVERY" },
  { question: "Assess confidence levels in applying the learned skills", category: "TRAINING COURSE DELIVERY" },
  { question: "Training equipment exposure", category: "TRAINING EQUIPMENT & TRAINING MATERIALS" },
  { question: "Course materials easy to understand and follow", category: "TRAINING EQUIPMENT & TRAINING MATERIALS" },
  { question: "Ease to reference", category: "TRAINING EQUIPMENT & TRAINING MATERIALS" },
  { question: "Clarity of linkages between topics", category: "TRAINING EQUIPMENT & TRAINING MATERIALS" },
  { question: "Usefulness of the content for practical application", category: "TRAINING EQUIPMENT & TRAINING MATERIALS" },
  { question: "Online learning", category: "TRAINING COURSE VENUE" },
  { question: "Conductive to learning (ventilation/illumination/space)", category: "TRAINING COURSE VENUE" },
  { question: "Comfort and convenience", category: "TRAINING COURSE VENUE" },
  { question: "Transport/Accommodation/Meals (as applicable)", category: "TRAINING COURSE VENUE" },
  { question: "Did you fully understand the content of this training and is the course adequate.", category: "TRAINING COURSE MODULE EVALUATION" },
  { question: "Assess confidence levels in applying the learned skills", category: "TRAINING COURSE MODULE EVALUATION" },
  { question: "level of engagement and interaction during the training", category: "TRAINING PARTICIPANT ENGAGEMENT" },
  { question: "effectiveness of activities, exercises, and discussions.", category: "TRAINING PARTICIPANT ENGAGEMENT" },
  { question: "confident in your ability to apply these skills", category: "TRAINING PARTICIPANT ENGAGEMENT" },
  { question: "trainer's knowledge, engagement, and ability to facilitate learning.", category: "TRAINING FACULTY EVALUATION" },
  { question: "Does the instructor regularly check all trainees understanding", category: "TRAINING FACULTY EVALUATION" },
  { question: "Focus on highlights / key elements", category: "TRAINING FACULTY EVALUATION" },
  { question: "Clarity of speech", category: "TRAINING FACULTY EVALUATION" },
  { question: "trainer's presentation style and communication skills.", category: "TRAINING FACULTY EVALUATION" },
  { question: "overall satisfaction with the training experience.", category: "OVERALL TRAINING SATISFACTION" },
  { question: "whether participants would recommend the training to others.", category: "OVERALL TRAINING SATISFACTION" },
];

const LEGACY_FEEDBACK_COMMENT_COLUMNS = [
  {
    question: "TRAINING ASPECTS THAT NEEDS IMPROVEMENT & SUGGESTIONS .(BE HONEST ).",
    category: "RECOMMENDATIONS / COMMENTS ON HOW TO IMPROVE.",
  },
  {
    question: "BENEFITS EARNED FROM THIS TRAINING WHICH WILL CONTRIBUTE TO YOUR WORK/COMPANY.",
    category: "RECOMMENDATIONS / COMMENTS ON HOW TO IMPROVE.",
  },
];

const normalizeFeedbackText = (value = "") =>
  String(value).trim().replace(/\s+/g, " ").toLowerCase();

const getFeedbackColumnHeader = ({ question, category, header }) =>
  header || `${question} ( ${category} )`;

const getFeedbackColumnKey = ({ question, category }) =>
  `${normalizeFeedbackText(question)}|${normalizeFeedbackText(category)}`;

const getFeedbackAnswerValue = (answerRow) => {
  if (!answerRow) return "--";
  const value = answerRow.answer ?? answerRow.feedback_question_option_text;
  return value === undefined || value === null || value === "" ? "--" : value;
};

exports.getFilterOptions = async (req, res) => {
  try {
    const [topics, managers, companies] = await Promise.all([
      ReportDao.getDistinctTopics(),
      ReportDao.getDistinctManagers(),
      ReportDao.getDistinctCompanies(),
    ]);
    res.json({ topics, managers, companies });
  } catch (error) {
    console.error("Get Filter Options Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.exportFeedbackReport = async (req, res) => {
  try {
    const { start_date, end_date, topic, manager } = req.body;
    const filters = {};
    if (topic) filters.topic = topic;
    if (manager) filters.manager = manager;

    if (!start_date || !end_date) {
      return res
        .status(400)
        .json({ message: "Please provide both start and end dates." });
    }

    // 1. Get Questions
    const feedbackQuestionIds = await ReportDao.getFeedbackQuestionIds(
      start_date,
      end_date,
    );

    if (feedbackQuestionIds.length === 0) {
      return res.status(404).json({
        message: "No feedback data found for the specified date range.",
      });
    }

    const questionsData =
      await ReportDao.getQuestionsWithCategories(feedbackQuestionIds);

    const legacyQuestionKeys = new Set(
      [
        ...LEGACY_FEEDBACK_RATING_COLUMNS,
        ...LEGACY_FEEDBACK_COMMENT_COLUMNS,
      ].map(getFeedbackColumnKey),
    );
    const questionIdsByLegacyKey = {};
    questionsData.forEach((q) => {
      const key = getFeedbackColumnKey({
        question: q.question,
        category: q.category_name,
      });
      if (!legacyQuestionKeys.has(key)) return;
      if (!questionIdsByLegacyKey[key]) questionIdsByLegacyKey[key] = [];
      questionIdsByLegacyKey[key].push(q.id);
    });

    // 2. Prepare Excel Header
    const headers = [
      ...LEGACY_FEEDBACK_META_HEADERS,
      ...LEGACY_FEEDBACK_RATING_COLUMNS.map(getFeedbackColumnHeader),
      "Average",
      "Overall Course evaluation average",
      ...LEGACY_FEEDBACK_COMMENT_COLUMNS.map(getFeedbackColumnHeader),
    ];

    // 3. Fetch Data
    const allPairs = await ReportDao.getCandidateCoursePairs(
      start_date,
      end_date,
      filters,
    );
    if (allPairs.length === 0) {
      return res.status(404).json({ message: "No feedback data found." });
    }

    const allCourseIds = [...new Set(allPairs.map((p) => p.active_course_id))];
    const allCandidateIds = [...new Set(allPairs.map((p) => p.candidate_id))];

    const courses = await ReportDao.getCoursesByIds(allCourseIds);
    const candidates = await ReportDao.getCandidatesByIds(allCandidateIds);

    // Trainers
    let trainerIds = [];
    courses.forEach((c) => {
      if (c.primary_trainer_id) trainerIds.push(c.primary_trainer_id);
      if (
        c.secondary_trainer_ids &&
        typeof c.secondary_trainer_ids === "string"
      ) {
        const ids = c.secondary_trainer_ids
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id);
        trainerIds.push(...ids);
      }
    });
    trainerIds = [...new Set(trainerIds)];
    const trainers = await ReportDao.getTrainersByIds(trainerIds);

    const masterCourseIds = [
      ...new Set(
        courses
          .map((c) => c.master_course_id || c.master_course_name)
          .filter(Boolean),
      ),
    ];
    const masterCourses =
      await ReportDao.getMasterCoursesByIds(masterCourseIds);

    const participantCounts =
      await ReportDao.getParticipantCounts(allCourseIds);

    const chunkAnswers = await ReportDao.getAllFeedbackAnswersChunk(
      allCandidateIds,
      allCourseIds,
    );

    // 4. Map Data
    const coursesMap = {};
    courses.forEach((c) => (coursesMap[c.id] = c));

    const candidatesMap = {};
    candidates.forEach((c) => (candidatesMap[c.id] = c));

    const trainersMap = {};
    trainers.forEach((t) => (trainersMap[t.id] = t));

    const masterCoursesMap = {};
    masterCourses.forEach(
      (mc) => (masterCoursesMap[mc.id] = mc.master_course_name),
    );

    const participantMap = {};
    participantCounts.forEach(
      (p) => (participantMap[p.course_id] = p.total_participants),
    );

    const answersMap = {};
    chunkAnswers.forEach((ans) => {
      if (!answersMap[ans.candidate_id]) answersMap[ans.candidate_id] = {};
      if (!answersMap[ans.candidate_id][ans.active_course_id])
        answersMap[ans.candidate_id][ans.active_course_id] = {};
      answersMap[ans.candidate_id][ans.active_course_id][
        ans.feedback_question_id
      ] = ans;
    });

    const getAnswerForLegacyColumn = (candidateId, courseId, column) => {
      const questionIds = questionIdsByLegacyKey[getFeedbackColumnKey(column)] || [];
      const answerRows = answersMap[candidateId]?.[courseId] || {};
      for (const questionId of questionIds) {
        const value = getFeedbackAnswerValue(answerRows[questionId]);
        if (value !== "--") return value;
      }
      return "--";
    };

    // 5. Build Rows
    const dataRows = [];
    const courseAverages = {};

    let rowCount = 1;

    for (const pair of allPairs) {
      const course = coursesMap[pair.active_course_id];
      const candidate = candidatesMap[pair.candidate_id];
      const submissionDate = pair.created_at;

      if (!course || !candidate) continue;

      const trainer = trainersMap[course.primary_trainer_id];
      const trainerName = trainer
        ? `${trainer.prefix || ""}.${trainer.first_name} ${trainer.last_name || ""}`
        : "";

      const masterCourseName =
        course.course_name ||
        masterCoursesMap[course.master_course_id] ||
        masterCoursesMap[course.master_course_name] ||
        course.master_course_name ||
        course.course_id ||
        "";

      // Secondary Trainers
      let secondaryTrainerNames = [];
      if (
        course.secondary_trainer_ids &&
        typeof course.secondary_trainer_ids === "string"
      ) {
        const sIds = course.secondary_trainer_ids
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id);
        sIds.forEach((id) => {
          const t = trainersMap[id];
          if (t) {
            secondaryTrainerNames.push(
              `${t.prefix || ""}.${t.first_name} ${t.last_name || ""}`.toUpperCase(),
            );
          }
        });
      }
      const secondaryTrainerString = secondaryTrainerNames.join(" / ");
      const fullTrainerString =
        trainerName +
        (secondaryTrainerString ? " / " + secondaryTrainerString : "");

      const row = [];
      row.push(rowCount++);
      row.push(new Date(submissionDate).toLocaleDateString("en-GB"));
      row.push(`${candidate.first_name} ${candidate.last_name}`);
      row.push(candidate.employee_id || candidate.passport_no);
      row.push(new Date(course.start_date).toLocaleDateString("en-GB"));
      row.push(new Date(course.end_date).toLocaleDateString("en-GB"));
      row.push(getCandidatePositionLabel(candidate.rank));
      row.push(candidate.manager);
      row.push(masterCourseName);
      row.push(getCourseHouseType(course));
      row.push(participantMap[course.id] || "--");
      row.push(course.course_id);
      row.push(course.type_of_location);
      row.push(fullTrainerString);

      // Ratings
      let ratingSum = 0;
      let ratingCount = 0;

      LEGACY_FEEDBACK_RATING_COLUMNS.forEach((column) => {
        const val = getAnswerForLegacyColumn(
          pair.candidate_id,
          pair.active_course_id,
          column,
        );
        row.push(val);
        if (!isNaN(parseFloat(val))) {
          ratingSum += parseFloat(val);
          ratingCount++;
        }
      });

      const avg = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(2) : 0;
      row.push(avg);

      if (!courseAverages[masterCourseName])
        courseAverages[masterCourseName] = {
          total: 0,
          count: 0,
          rowsIndices: [],
        };
      courseAverages[masterCourseName].total += parseFloat(avg);
      courseAverages[masterCourseName].count++;
      courseAverages[masterCourseName].rowsIndices.push(dataRows.length);

      row.push(""); // Placeholder for Overall Avg

      LEGACY_FEEDBACK_COMMENT_COLUMNS.forEach((column) => {
        row.push(
          getAnswerForLegacyColumn(
            pair.candidate_id,
            pair.active_course_id,
            column,
          ),
        );
      });

      dataRows.push(row);
    }

    // Fill Overall Averages
    const overallAvgIdx = headers.indexOf("Overall Course evaluation average");
    Object.keys(courseAverages).forEach((cName) => {
      const stats = courseAverages[cName];
      const overall =
        stats.count > 0 ? (stats.total / stats.count).toFixed(2) : 0;
      stats.rowsIndices.forEach((idx) => {
        dataRows[idx][overallAvgIdx] = overall;
      });
    });

    // 6. Generate Excel with Styling
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Feedback Report");

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "0060AA" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFFFFFFF" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    dataRows.forEach((row) => {
      worksheet.addRow(row);
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxColumnLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxColumnLength) {
          maxColumnLength = columnLength;
        }
      });
      column.width = maxColumnLength < 10 ? 10 : maxColumnLength + 2;
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Feedback_Report.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Feedback Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.exportCertificateReport = async (req, res) => {
  try {
    const { start_date, end_date, topic, manager, company } = req.body;
    if (!start_date || !end_date) {
      return res
        .status(400)
        .json({ message: "Please provide both start and end dates." });
    }

    const filters = {};
    if (topic) filters.topic = topic;
    if (manager) filters.manager = manager;
    if (company) filters.company = company;

    const data = await ReportDao.getCertificateReport(
      start_date,
      end_date,
      filters,
    );

    if (data.length === 0) {
      return res.status(404).json({
        message: "No certificates found for the specified date range.",
      });
    }

    // Fetch all trainers to map secondary trainer names
    const allTrainerIds = [];
    data.forEach(item => {
        if (item.trainer_id) allTrainerIds.push(item.trainer_id);
        if (item.secondary_trainer_ids) {
            const sIds = item.secondary_trainer_ids.split(",").map(id => id.trim()).filter(id => id);
            allTrainerIds.push(...sIds);
        }
    });
    const trainers = await ReportDao.getTrainersByIds([...new Set(allTrainerIds)]);
    const trainersMap = {};
    trainers.forEach(t => trainersMap[t.id] = t);

    const headers = [
      "Sr. No.",
      "Employee Id",
      "Name as per Shipmate/platform/registry",
      "Rank",
      "Last manager",
      "Last vessel",
      "Status Pool",
      "Topic",
      "Master Course Name",
      "INHOUSE/OUTHOUSE",
      "Location",
      "Actual course conducted no. for the ongoing year",
      "From Date",
      "To Date",
      "No. of Days",
      "Trainers",
      "Certificate No.",
      "Certificate Status",
      "Course Name from Active Courses",
    ];

    const rows = data.map((item, index) => {
      // Format Trainers
      const mainTrainer = trainersMap[item.trainer_id];
      let trainerStr = mainTrainer ? `${mainTrainer.prefix || ""}.${mainTrainer.first_name} ${mainTrainer.last_name || ""}` : "";
      
      if (item.secondary_trainer_ids) {
        const sIds = item.secondary_trainer_ids.split(",").map(id => id.trim()).filter(id => id);
        const sTrainerNames = [];
        sIds.forEach(id => {
            const t = trainersMap[id];
            if (t) {
                sTrainerNames.push(`${t.prefix || ""}.${t.first_name} ${t.last_name || ""}`.toUpperCase());
            }
        });
        if (sTrainerNames.length > 0) {
            trainerStr += " / " + sTrainerNames.join(" / ");
        }
      }

      return [
        index + 1,
        getCertificateReportCandidateIdentifier(item),
        getCertificateReportCandidateName(item),
        getCandidatePositionLabel(item.rank),
        getCertificateReportManager(item),
        item.last_vessel_name || "",
        item.status_pool || "",
        item.topic,
        item.master_course_name,
        getCourseHouseType(item),
        item.location,
        getCertificateReportCourseSequence(item.active_course_code),
        new Date(item.from_date).toLocaleDateString("en-GB").replace(/\//g, "-"),
        new Date(item.to_date).toLocaleDateString("en-GB").replace(/\//g, "-"),
        item.days,
        trainerStr,
        item.certificate_no,
        Number(item.status) === 0 ? "Valid" : "Invalid",
        item.course_name,
      ];
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Certificate Report");

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "0060AA" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFFFFFFF" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    rows.forEach((row) => {
      const rowInstance = worksheet.addRow(row);
      rowInstance.eachCell(cell => {
          cell.alignment = { vertical: "middle" };
      });
    });

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxColumnLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxColumnLength) {
          maxColumnLength = columnLength;
        }
      });
      column.width = maxColumnLength < 10 ? 10 : maxColumnLength + 2;
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Certificate_Report.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Certificate Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

function getCertificateReportCandidateIdentifier(item) {
  return [item.empId, item.passport_no]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

function getCertificateReportCandidateName(item) {
  return [
    item.cand_first_name,
    item.cand_middle_name,
    item.cand_last_name,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
}

function getCertificateReportManager(item) {
  const manager = String(item.manager || "").trim();
  const hasManagerValue = manager.replace(/[()\s]/g, "").length > 0;

  return hasManagerValue ? manager : "New Candidate";
}

function getCourseHouseType(item = {}) {
  const value = String(
    item.type_of_course || item.course_type || "",
  ).trim();
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "");

  if (normalized.includes("outhouse") || Number(item.is_outhouse) === 1) {
    return "OUTHOUSE";
  }

  if (!value || normalized.includes("inhouse")) {
    return "INHOUSE";
  }

  return value;
}

function getCertificateReportCourseSequence(courseCode) {
  return String(courseCode || "")
    .trim()
    .split(/[/-]/)
    .filter(Boolean)
    .pop() || "";
}

function getCandidatePositionLabel(rank) {
  const value = String(rank || "").trim();
  if (!value) return "";

  const compactValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const directRankMap = {
    MASTER: "Master",
    MSTR: "Master",
    CAPT: "Captain",
    COFF: "Chief Officer",
    COF: "Chief Officer",
    CHOFF: "Chief Officer",
    CHIEFOFFICER: "Chief Officer",
    ACOFF: "Addl Chief Officer",
    ACOF: "Addl Chief Officer",
    ADDLCHIEFOFFICER: "Addl Chief Officer",
    "2OFF": "2nd Officer",
    "2NDOFFICER": "2nd Officer",
    "3OFF": "3rd Officer",
    "3RDOFFICER": "3rd Officer",
    "4MTE": "4th Mate",
    "4THMATE": "4th Mate",
    CENG: "Chief Engineer",
    CHIEFENGINEER: "Chief Engineer",
    "1AEN": "1st Asst Engineer",
    "1STASSTENGINEER": "1st Asst Engineer",
    A1AEN: "Addl 1st Asst Engineer",
    ADDL1STASSTENGINEER: "Addl 1st Asst Engineer",
    "2AEN": "2nd Asst Engineer",
    "2NDASSTENGINEER": "2nd Asst Engineer",
    "3AEN": "3rd Asst Engineer",
    "3RDASSTENGINEER": "3rd Asst Engineer",
    TUIE: "Asst. Engineer (TUIE)",
    ASSTENGINEERTUIE: "Asst. Engineer (TUIE)",
    ASSTENGINEERENGCADET: "Asst. Engineer (TUIE)",
    OFFICERINTRAININGENGINE: "Asst. Engineer (TUIE)",
    TUID: "Deck Cadet (TUID)",
    DECKCADETTUID: "Deck Cadet (TUID)",
    OFFICERINTRAININGDECK: "Deck Cadet (TUID)",
    ETO: "Electro Technical Officer",
    ELTOF: "Electro Technical Officer",
    ELECTROTECHNICALOFFICER: "Electro Technical Officer",
    OSMN: "Ordinary Seaman",
    ORDINARYSEAMAN: "Ordinary Seaman",
    ABSM: "Able Body Seaman",
    ABLEBODYSEAMAN: "Able Body Seaman",
    MSMN: "Messman",
    OILR: "Oiler",
    ENGTR: "Engine Trainee",
    DKTR: "Deck Trainee",
  };

  return directRankMap[compactValue] || value;
}

exports.exportTrainingRecordReport = async (req, res) => {
  try {
    const { year } = req.body;
    const parsedYear = Number(year);
    const currentYear = new Date().getUTCFullYear();

    if (
      !year ||
      !Number.isInteger(parsedYear) ||
      parsedYear < 2000 ||
      parsedYear > currentYear
    ) {
      return res.status(400).json({
        message: "Please provide a valid year.",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const reportData = await ReportDao.getTrainingRecordReport(parsedYear, today);

    if (reportData.length === 0) {
      return res.status(404).json({
        message: "No completed training data found for the specified year.",
      });
    }

    const normalizedRows = normalizeTrainingRecordRows(reportData);
    const workbook = buildTrainingRecordWorkbook(parsedYear, normalizedRows);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="TRG-218_Training_Record_${parsedYear}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Training Record Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.exportTrainingActivitiesReport = async (req, res) => {
  try {
    const { start_month, year } = req.body;
    const parsedMonth = Number(start_month);
    const parsedYear = Number(year);

    if (
      !start_month ||
      !Number.isInteger(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12
    ) {
      return res.status(400).json({
        message: "Please provide a valid start_month between 1 and 12.",
      });
    }

    if (
      !year ||
      !Number.isInteger(parsedYear) ||
      parsedYear < 2000 ||
      parsedYear > 2100
    ) {
      return res.status(400).json({
        message: "Please provide a valid year.",
      });
    }

    const windowBounds = getTrainingActivitiesWindow(parsedYear, parsedMonth);
    const reportData = await ReportDao.getTrainingActivitiesReport(
      windowBounds.windowStart,
      windowBounds.windowEnd,
    );

    if (reportData.length === 0) {
      return res.status(404).json({
        message: "No training activity data found for the selected period.",
      });
    }

    const normalizedRows = normalizeTrainingActivitiesRows(
      reportData,
      windowBounds.weeks,
    );
    const workbook = buildTrainingActivitiesWorkbook(
      normalizedRows,
      windowBounds,
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="TRG-219_Training_Activities_${windowBounds.fileLabel}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Training Activities Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.bulkDownloadFeedbackPDFs = async (req, res) => {
  try {
    const { start_date, end_date, topic, manager } = req.body;
    const filters = {};
    if (topic) filters.topic = topic;
    if (manager) filters.manager = manager;

    if (!start_date || !end_date) {
      return res
        .status(400)
        .json({ message: "Please provide both start and end dates." });
    }

    const allPairs = await ReportDao.getCandidateCoursePairs(
      start_date,
      end_date,
      filters,
    );

    if (allPairs.length === 0) {
      return res.status(404).json({ message: "No feedback data found." });
    }

    const archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    });

    res.attachment("Feedback_PDFs.zip");
    archive.pipe(res);

    const fonts = {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique",
      },
    };
    pdfmake.setFonts(fonts);

    const candidatesMap = {};
    const coursesMap = {};
    const trainersMap = {};
    const masterCoursesMap = {};

    const formatDate = (dateStr) => {
      if (!dateStr) return "N/A";
      const date = new Date(dateStr);
      return isNaN(date.getTime())
        ? "N/A"
        : date.toLocaleDateString("en-GB").replace(/\//g, "-");
    };

    for (const pair of allPairs) {
      const { candidate_id, active_course_id } = pair;

      const answers = await FeedbackAnswerDao.getSubmissionDetails(
        candidate_id,
        active_course_id,
      );

      let candidate = candidatesMap[candidate_id];
      if (!candidate) {
        candidate = await CandidateDao.getCandidateById(candidate_id);
        candidatesMap[candidate_id] = candidate;
      }

      if (!candidate) {
        console.warn(`Candidate not found for ID: ${candidate_id}, skipping.`);
        continue;
      }

      let courseDetails = coursesMap[active_course_id];
      if (!courseDetails) {
        courseDetails = await ActiveCourseDao.getById(active_course_id);
        coursesMap[active_course_id] = courseDetails;
      }

      let trainerName = "N/A";
      let masterCourseName = "N/A";

      if (courseDetails) {
        if (courseDetails.primary_trainer_id) {
          if (!trainersMap[courseDetails.primary_trainer_id]) {
            const trainer = await TrainerDao.getTrainerById(
              courseDetails.primary_trainer_id,
            );
            trainersMap[courseDetails.primary_trainer_id] = trainer
              ? `${trainer.first_name} ${trainer.last_name}`
              : "N/A";
          }
          trainerName = trainersMap[courseDetails.primary_trainer_id];
        }

        if (courseDetails.master_course_id) {
          if (!masterCoursesMap[courseDetails.master_course_id]) {
            const masterCourse = await MasterCourseDao.getById(
              courseDetails.master_course_id,
            );
            masterCoursesMap[courseDetails.master_course_id] = masterCourse
              ? masterCourse.master_course_name
              : "N/A";
          }
        }

        const resolvedMasterCourseName =
          courseDetails.master_course_id &&
          masterCoursesMap[courseDetails.master_course_id]
            ? masterCoursesMap[courseDetails.master_course_id]
            : "N/A";

        masterCourseName =
          courseDetails.course_name ||
          (resolvedMasterCourseName !== "N/A"
            ? resolvedMasterCourseName
            : "") ||
          courseDetails.master_course_name ||
          "N/A";
      }

      const feedbackRows = [
        [
          { text: "#", style: "tableHeader" },
          { text: "Question", style: "tableHeader" },
          { text: "Category", style: "tableHeader" },
          { text: "Answer", style: "tableHeader" },
        ],
      ];

      if (answers && answers.length > 0) {
        answers.forEach((ans, index) => {
          const answerText =
            ans.answer || ans.feedback_question_option_text || "No Answer";
          feedbackRows.push([
            (index + 1).toString(),
            ans.question || "Unknown Question",
            ans.category_name || ans.type || "NA",
            { text: answerText, alignment: "left" },
          ]);
        });
      } else {
        feedbackRows.push([
          { colSpan: 4, text: "No feedback submitted.", alignment: "center" },
          "",
          "",
          "",
        ]);
      }

      const docDefinition = {
        defaultStyle: {
          font: "Helvetica",
          fontSize: 10,
        },
        content: [
          {
            text: "Feedback Report",
            style: "header",
            alignment: "center",
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              widths: ["auto", "*", "auto", "*"],
              body: [
                [
                  { text: "Employee ID:", bold: true },
                  candidate.employee_id || candidate.passport_no || "N/A",
                  { text: "Candidate:", bold: true },
                  `${candidate.first_name} ${candidate.last_name}`,
                ],
                [
                  { text: "Active Course ID:", bold: true },
                  courseDetails?.course_id || "N/A",
                  { text: "Course Name:", bold: true },
                  masterCourseName,
                ],
                [
                  { text: "Rank:", bold: true },
                  candidate.rank || "N/A",
                  { text: "Trainer Name:", bold: true },
                  trainerName,
                ],
                [
                  { text: "Course Date:", bold: true },
                  formatDate(courseDetails?.start_date),
                  { text: "Course Location:", bold: true },
                  courseDetails?.type_of_location || "N/A",
                ],
                [
                  {
                    text: "Name of Manager (last served):",
                    bold: true,
                    colSpan: 2,
                  },
                  "",
                  { text: candidate.manager || "N/A", colSpan: 2 },
                  "",
                ],
              ],
            },
            layout: "noBorders",
            margin: [0, 0, 0, 20],
          },
          {
            text: "Feedback Details",
            style: "subheader",
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: [20, "*", 80, 80],
              body: feedbackRows,
            },
            layout: {
              hLineWidth: function (i, node) {
                return 1;
              },
              vLineWidth: function (i, node) {
                return 1;
              },
              hLineColor: function (i, node) {
                return "#dee2e6";
              },
              vLineColor: function (i, node) {
                return "#dee2e6";
              },
              paddingLeft: function (i, node) {
                return 4;
              },
              paddingRight: function (i, node) {
                return 4;
              },
              paddingTop: function (i, node) {
                return 4;
              },
              paddingBottom: function (i, node) {
                return 4;
              },
            },
          },
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
          },
          subheader: {
            fontSize: 12,
            bold: true,
            margin: [0, 5, 0, 5],
          },
          tableHeader: {
            bold: true,
            fillColor: "#343a40",
            color: "white",
          },
        },
      };

      const pdfDoc = pdfmake.createPdf(docDefinition);
      const buffer = await pdfDoc.getBuffer();

      const fileName = `Feedback_${candidate.first_name}_${candidate.last_name}_${active_course_id}.pdf`;
      archive.append(buffer, { name: fileName });
    }

    await archive.finalize();
  } catch (error) {
    console.error("Bulk Download Feedback Error:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: "Internal Server Error", error: error.message });
    } else {
      // If headers sent, we must destroy the archive to avoid hanging the connection
      console.error("Headers already sent, destroying archive.");
      archive.abort(); // or finalize if appropriate, but abort is safer for error
      res.end();
    }
  }
};

exports.getHotelReport = async (req, res) => {
  try {
    const { page, limit, hotel_name, employee, course_name } = req.query;
    const filters = {
      page: page || 1,
      limit: limit || 10,
      hotel_name,
      employee,
      course_name,
    };

    const data = await ReportDao.getHotelReport(filters);

    return res.status(200).json({
      message: "Hotel report fetched successfully",
      data: data.data,
      total: data.total,
      totalCount: data.totalCount || data.total,
      page: data.page,
      limit: data.limit,
      totalPages: data.totalPages,
    });
  } catch (error) {
    console.error("Get Hotel Report Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.exportHotelReport = async (req, res) => {
  try {
    const { hotel_name, employee, course_name } = req.body;
    const filters = {
      hotel_name,
      employee,
      course_name,
    };

    const data = await ReportDao.getHotelReport(filters);
    const reportData = data.data;

    if (!reportData || reportData.length === 0) {
      return res.status(404).json({
        message: "No hotel allocations found for the selected filters.",
      });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Hotel Report");

    const headers = [
      "Sr. No.",
      "Hotel Name",
      "Employee ID",
      "Employee Name",
      "Course Name",
      "Course Start Date",
      "Course End Date",
      "Hotel Start Date",
      "Hotel End Date"
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "0060AA" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFFFFFFF" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    reportData.forEach((row, index) => {
      const dataRow = worksheet.addRow([
        index + 1,
        row.hotel_name || "-",
        row.employee_id || "-",
        `${row.first_name || ""} ${row.last_name || ""}`.trim(),
        row.course_name || "-",
        row.start_date ? new Date(row.start_date).toLocaleDateString("en-GB") : "-",
        row.end_date ? new Date(row.end_date).toLocaleDateString("en-GB") : "-",
        row.hotel_from_date ? new Date(row.hotel_from_date).toLocaleDateString("en-GB") : "-",
        row.hotel_to_date ? new Date(row.hotel_to_date).toLocaleDateString("en-GB") : "-"
      ]);
      dataRow.eachCell(cell => {
          cell.alignment = { vertical: "middle" };
      });
    });

    worksheet.columns.forEach((column) => {
      let maxColumnLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxColumnLength) {
          maxColumnLength = columnLength;
        }
      });
      column.width = maxColumnLength < 10 ? 10 : maxColumnLength + 2;
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Hotel_Report.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export Hotel Report Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

function normalizeTrainingRecordRows(courseInstances) {
  const grouped = new Map();

  courseInstances.forEach((item) => {
    const courseName = normalizeTrainingRecordCourseName(item.course_name);
    const trainingPeriodDays = Number(item.training_period_days) || 0;
    const monthIndex = Math.max(0, (Number(item.end_month) || 1) - 1);
    const traineeCount = Number(item.trainee_count) || 0;
    const section = getTrainingRecordSection(item);
    const key = `${section}__${courseName.toLowerCase()}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        section,
        courseName,
        trainingPeriodDays: new Set(),
        monthlyTime: Array(12).fill(0),
        monthlyTrainees: Array(12).fill(0),
        monthlyMandays: Array(12).fill(0),
      });
    }

    const current = grouped.get(key);
    if (trainingPeriodDays) {
      current.trainingPeriodDays.add(trainingPeriodDays);
    }
    current.monthlyTime[monthIndex] += 1;
    current.monthlyTrainees[monthIndex] += traineeCount;
    current.monthlyMandays[monthIndex] += traineeCount * trainingPeriodDays;
  });

  return Array.from(grouped.values())
    .map((item, index) => {
      const totalTime = item.monthlyTime.reduce((sum, value) => sum + value, 0);
      const totalTrainees = item.monthlyTrainees.reduce(
        (sum, value) => sum + value,
        0,
      );

      return {
        serialNo: index + 1,
        section: item.section,
        courseName: item.courseName,
        trainingPeriodDays: formatTrainingPeriodDays(item.trainingPeriodDays),
        monthlyTime: item.monthlyTime,
        monthlyTrainees: item.monthlyTrainees,
        monthlyMandays: item.monthlyMandays,
        totalTime,
        totalTrainees,
        totalMandays: item.monthlyMandays.reduce((sum, value) => sum + value, 0),
      };
    })
    .sort((a, b) => {
      const sectionDifference =
        TRAINING_RECORD_SECTION_ORDER.indexOf(a.section) -
        TRAINING_RECORD_SECTION_ORDER.indexOf(b.section);
      if (sectionDifference !== 0) {
        return sectionDifference;
      }
      if (a.courseName !== b.courseName) {
        return a.courseName.localeCompare(b.courseName);
      }
      return 0;
    })
    .map((item, index) => ({
      ...item,
      serialNo: index + 1,
    }));
}

function normalizeTrainingRecordCourseName(value) {
  return String(value || "Untitled Course").trim().replace(/\s+/g, " ");
}

function formatTrainingPeriodDays(values) {
  const days = Array.from(values)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (days.length === 0) return "";
  if (days.length === 1) return days[0];
  return days.join(" / ");
}

function buildTrainingRecordWorkbook(year, rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("SFGMO - Monthly Completed list");

  worksheet.views = [{ state: "frozen", ySplit: 9, xSplit: 0 }];

  worksheet.columns = [
    { width: 14 },
    { width: 52.11 },
    { width: 12.33 },
    { width: 20.11 },
    { width: 10.66 },
    { width: 10.11 },
    { width: 9 },
    { width: 10.66 },
    { width: 10.11 },
    { width: 10 },
    { width: 10.44 },
    { width: 10.33 },
    { width: 10.78 },
    { width: 10.33 },
    { width: 10 },
    { width: 10.11 },
    { width: 10.33 },
    { width: 12.78 },
    { width: 13.44 },
    { width: 9.33 },
  ];

  addTrainingRecordHeader(worksheet, year);
  addTrainingRecordRows(worksheet, rows);
  const totalRowNumbers = addTrainingRecordTotals(worksheet, rows);
  styleTrainingRecordSheet(worksheet, totalRowNumbers);

  return workbook;
}

function addTrainingRecordHeader(worksheet, year) {
  worksheet.getCell("A1").value = "MOL Maritime (India) Pvt. Ltd.";
  worksheet.mergeCells("A1:L2");
  worksheet.getCell("S1").value = "TRG/218";
  worksheet.getCell("S2").value = "Rev. No. 6.0";

  worksheet.getCell("A3").value = `TRAINING RECORD ${year}`;
  worksheet.mergeCells("A3:R4");
  worksheet.getCell("S3").value = "02 May 2019";
  worksheet.getCell("S4").value = "Page 2 of 2";

  worksheet.getCell("A5").value = "Venue: MOLMI";
  worksheet.getCell("A6").value =
    "THESE FIGURES DO NOT INCLUDE MAKER SPECIFIC TRAINING";
  worksheet.getCell("A7").value =
    "Training Location: ONLINE / OFFLINE / OUTHOUSE";
}

function addTrainingRecordTableHeader(worksheet) {
  const rowNumber = worksheet.rowCount + 1;
  worksheet.addRow([
    "No",
    "Course name",
    "Training \r\nPeriod\r\n (day)",
    "",
    ...TRAINING_RECORD_MONTH_HEADERS,
    "Total\r\nTime",
    "Total \r\nTrainees",
    "TOTAL MANDAYS",
    "",
  ]);
  return rowNumber;
}

function addTrainingRecordRows(worksheet, rows) {
  let currentSection = "";

  rows.forEach((item) => {
    if (item.section !== currentSection) {
      currentSection = item.section;
      addTrainingRecordSectionHeader(worksheet, currentSection);
      addTrainingRecordTableHeader(worksheet);
    }

    const timeRowNumber = worksheet.rowCount + 1;
    const traineeRowNumber = timeRowNumber + 1;

    worksheet.addRow([
      item.serialNo,
      item.courseName,
      item.trainingPeriodDays,
      " Time of Training",
      ...item.monthlyTime.map(toDisplayValue),
      toDisplayValue(item.totalTime),
      "",
      "",
      "",
    ]);

    worksheet.addRow([
      "",
      "",
      "",
      " Total trainees",
      ...item.monthlyTrainees.map(toDisplayValue),
      "",
      toDisplayValue(item.totalTrainees),
      toDisplayValue(item.totalMandays),
      "",
    ]);

    worksheet.mergeCells(`A${timeRowNumber}:A${traineeRowNumber}`);
    worksheet.mergeCells(`B${timeRowNumber}:B${traineeRowNumber}`);
    worksheet.getCell(`A${timeRowNumber}`).alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    worksheet.getCell(`B${timeRowNumber}`).alignment = {
      vertical: "middle",
      wrapText: true,
    };
  });
}

function addTrainingRecordSectionHeader(worksheet, section) {
  const rowNumber = worksheet.rowCount + 1;
  worksheet.addRow([getTrainingRecordSectionLabel(section)]);
  worksheet.mergeCells(`A${rowNumber}:T${rowNumber}`);
  const cell = worksheet.getCell(`A${rowNumber}`);
  cell.font = { name: "Arial", bold: true, size: 11 };
  cell.alignment = { horizontal: "left", vertical: "middle" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9EEF9" },
  };
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

function addTrainingRecordTotals(worksheet, rows) {
  const monthlyTimeTotals = Array(12).fill(0);
  const monthlyTraineeTotals = Array(12).fill(0);
  const monthlyMandaysTotals = Array(12).fill(0);

  let totalTime = 0;
  let totalTrainees = 0;
  let totalMandays = 0;

  rows.forEach((item) => {
    totalTime += item.totalTime;
    totalTrainees += item.totalTrainees;
    totalMandays += item.totalMandays;

    item.monthlyTime.forEach((value, index) => {
      monthlyTimeTotals[index] += value;
    });

    item.monthlyTrainees.forEach((value, index) => {
      monthlyTraineeTotals[index] += value;
      monthlyMandaysTotals[index] += item.monthlyMandays[index] || 0;
    });
  });

  const totalTimeRowNumber = worksheet.rowCount + 1;
  worksheet.addRow([
    "TOTAL TIME",
    "",
    "",
    "",
    ...monthlyTimeTotals.map(toDisplayValue),
    toDisplayValue(totalTime),
    "",
    "",
    "",
  ]);

  const totalTraineesRowNumber = worksheet.rowCount + 1;
  worksheet.addRow([
    "Total \r\nTrainees",
    "",
    "",
    "",
    ...monthlyTraineeTotals.map(toDisplayValue),
    toDisplayValue(totalTime),
    toDisplayValue(totalTrainees),
    toDisplayValue(totalMandays),
    "",
  ]);

  const spacerRowNumber = worksheet.rowCount + 1;
  worksheet.addRow([]);

  const totalMandaysRowNumber = worksheet.rowCount + 1;
  worksheet.addRow([
    "",
    "TOTAL MAN DAYS",
    "",
    "Outhouse",
    ...monthlyMandaysTotals.map(toDisplayValue),
    "",
    "",
    toDisplayValue(totalMandays),
    "",
  ]);

  return {
    totalTimeRowNumber,
    totalTraineesRowNumber,
    spacerRowNumber,
    totalMandaysRowNumber,
  };
}

function styleTrainingRecordSheet(worksheet, totalRowNumbers) {
  [1, 2, 3, 4, 5, 6, 7].forEach((rowNumber) => {
    worksheet.getRow(rowNumber).font = { name: "Arial", bold: rowNumber <= 7 };
  });

  worksheet.getCell("A1").font = { name: "Arial", bold: true, size: 18 };
  worksheet.getCell("A3").font = { name: "Arial", bold: true, size: 18 };
  worksheet.getCell("S1").font = { name: "Arial", bold: true, size: 12 };
  worksheet.getCell("S2").font = { name: "Arial", bold: true, size: 12 };
  worksheet.getCell("S3").font = { name: "Arial", bold: true, size: 12 };
  worksheet.getCell("S4").font = { name: "Arial", bold: true, size: 12 };
  worksheet.getCell("A6").font = { name: "Arial", bold: true, italic: true };

  for (let rowNumber = 8; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const rowLabel = row.getCell(1).value;
      const isSectionHeader =
        typeof rowLabel === "string" &&
        rowLabel.startsWith("Training Location:");
      const isTableHeader = isTrainingRecordTableHeaderRow(row);

      cell.font = cell.font || { name: "Arial", size: 10 };
      if (isSectionHeader) {
        return;
      }
      if (isTableHeader) {
        cell.font = { name: "Arial", bold: true, size: 10 };
      }
      cell.alignment = {
        horizontal:
          columnNumber === 2 || columnNumber === 4 ? "left" : "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    if (isTrainingRecordTableHeaderRow(row)) {
      row.height = 34;
    }
  }

  worksheet.getRow(totalRowNumbers.totalTimeRowNumber).font = {
    name: "Arial",
    bold: true,
    size: 10,
  };
  worksheet.getRow(totalRowNumbers.totalTraineesRowNumber).font = {
    name: "Arial",
    bold: true,
    size: 10,
  };
  worksheet.getRow(totalRowNumbers.totalMandaysRowNumber).font = {
    name: "Arial",
    bold: true,
    size: 10,
  };
  worksheet.getRow(totalRowNumbers.spacerRowNumber).eachCell(
    { includeEmpty: true },
    (cell) => {
      cell.border = {};
    },
  );

  for (let rowNumber = 9; rowNumber <= worksheet.rowCount; rowNumber += 2) {
    const row = worksheet.getRow(rowNumber);
    if (row.getCell(4).value === " Time of Training") {
      row.height = 20;
    }
  }
}

function toDisplayValue(value) {
  return value ? value : "";
}

function getTrainingRecordSection(item) {
  const courseType = (item.course_type || "").trim().toLowerCase();
  const location = (item.type_of_location || "").trim().toLowerCase();

  if (courseType.includes("out house") || courseType.includes("outhouse")) {
    return "Outhouse";
  }

  if (location === "online") {
    return "Online";
  }

  return "Offline";
}

function getTrainingRecordSectionLabel(section) {
  if (section === "Online") {
    return "Training Location:MOLMI - ONLINE";
  }

  if (section === "Outhouse") {
    return "Training Location: OUTHOUSE";
  }

  return "Training Location:MOLMI - OFFLINE";
}

function isTrainingRecordTableHeaderRow(row) {
  return (
    row.getCell(1).value === "No" &&
    row.getCell(2).value === "Course name" &&
    row.getCell(3).value === "Training \r\nPeriod\r\n (day)"
  );
}

function getTrainingActivitiesWindow(year, startMonth) {
  const monthIndex = startMonth - 1;
  const startDate = new Date(Date.UTC(year, monthIndex, 1));
  const endDate = new Date(Date.UTC(year, monthIndex + 3, 0));
  const gridStartDate = new Date(startDate);
  gridStartDate.setUTCDate(gridStartDate.getUTCDate() - gridStartDate.getUTCDay());

  const gridEndDate = new Date(endDate);
  gridEndDate.setUTCDate(gridEndDate.getUTCDate() + (6 - gridEndDate.getUTCDay()));

  const weeks = [];
  const cursor = new Date(gridStartDate);
  while (cursor <= gridEndDate) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    weeks.push({
      start: weekStart,
      end: weekEnd,
      label: `${padDate(weekStart.getUTCDate())}-${padDate(weekEnd.getUTCDate())}`,
      monthKey: `${weekStart.getUTCFullYear()}-${weekStart.getUTCMonth()}`,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return {
    windowStart: toIsoDate(startDate),
    windowEnd: toIsoDate(endDate),
    asOnDate: toDisplayDate(startDate),
    pageLabel: "Page 1 of 1",
    fileLabel: `${getShortMonthName(monthIndex)}_to_${getShortMonthName(endDate.getUTCMonth())}_${year}`,
    weeks,
  };
}

function normalizeTrainingActivitiesRows(courseInstances, weeks) {
  const grouped = new Map();

  courseInstances.forEach((item) => {
    const normalizedCode = normalizeTrainingActivitiesCode(item.topic || item.course_id);
    const sectionKey = getTrainingActivitiesSectionKey(item, normalizedCode);
    const durationDays =
      normalizeTrainingActivitiesDuration(
        item.no_of_days,
        item.start_date,
        item.end_date,
      );
    const isCancelled = item.status === "Cancelled";
    const isPreActive =
      Number(item.is_pre_active) === 1 || item.status === "Pre-Active";
    const statusCategory = isCancelled
      ? "Cancelled"
      : isPreActive
        ? "Pre-Active"
        : "Active";

    const rowKey = [
      sectionKey,
      normalizedCode,
      (item.master_course_name || item.course_name || "Untitled Course").trim(),
      normalizeTrainingActivitiesMode(item.type_of_location),
      durationDays,
      statusCategory,
    ].join("__");

    if (!grouped.has(rowKey)) {
      grouped.set(rowKey, {
        sectionKey,
        courseCode: (item.topic || item.course_id || "").trim(),
        courseName: (item.master_course_name || item.course_name || "Untitled Course").trim(),
        mode: normalizeTrainingActivitiesMode(item.type_of_location),
        durationDays,
        status: item.status,
        isCancelled,
        isPreActive,
        weeklyEntries: weeks.map(() => []),
      });
    }

    const current = grouped.get(rowKey);
    if (item.start_date && item.end_date) {
      weeks.forEach((week, index) => {
        const overlap = getDateRangeOverlap(
          item.start_date,
          item.end_date,
          week.start,
          week.end,
        );
        if (overlap) {
          current.weeklyEntries[index].push(
            `${padDate(overlap.start.getUTCDate())}-${padDate(overlap.end.getUTCDate())}`,
          );
        }
      });
    }
  });

  const rows = Array.from(grouped.values())
    .map((item) => ({
      ...item,
      weeklyEntries: item.weeklyEntries.map((weekEntries) =>
        weekEntries.join("\n"),
      ),
    }))
    .sort((a, b) => {
      const sectionDifference =
        TRG219_SECTION_ORDER.indexOf(a.sectionKey) -
        TRG219_SECTION_ORDER.indexOf(b.sectionKey);
      if (sectionDifference !== 0) {
        return sectionDifference;
      }
      if (a.courseCode !== b.courseCode) {
        return a.courseCode.localeCompare(b.courseCode);
      }
      return a.courseName.localeCompare(b.courseName);
    });

  let serialNo = 1;
  let lastSection = null;
  return rows.map((row) => {
    const nextRow = {
      ...row,
      serialNo: row.sectionKey === lastSection ? serialNo++ : 1,
    };
    if (row.sectionKey !== lastSection) {
      serialNo = 2;
      nextRow.serialNo = 1;
      lastSection = row.sectionKey;
    }
    return nextRow;
  });
}

function buildTrainingActivitiesWorkbook(rows, windowBounds) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("TRG-219");
  const weekCount = windowBounds.weeks.length;
  const totalColumns = 7 + weekCount;
  const lastColumnLetter = worksheet.getColumn(totalColumns).letter;

  worksheet.columns = [
    { width: 12 },
    { width: 18 },
    { width: 42 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    ...windowBounds.weeks.map(() => ({ width: 12 })),
  ];

  worksheet.mergeCells(`A1:${worksheet.getColumn(totalColumns - 1).letter}1`);
  worksheet.getCell("A1").value = sanitizeExcelText("MOL Maritime (India) Pvt. Ltd.");
  worksheet.getCell(`${lastColumnLetter}1`).value = sanitizeExcelText(TRG219_DOCUMENT_CODE);
  worksheet.getCell(`${lastColumnLetter}2`).value = sanitizeExcelText(TRG219_DOCUMENT_REVISION);
  worksheet.getCell(`${lastColumnLetter}3`).value = sanitizeExcelText(TRG219_DOCUMENT_DATE);
  worksheet.getCell(`${lastColumnLetter}4`).value = sanitizeExcelText(windowBounds.pageLabel);

  worksheet.mergeCells(`B5:E5`);
  worksheet.getCell("B5").value = sanitizeExcelText(`As on: ${windowBounds.asOnDate}`);

  addTrainingActivitiesHeaderRows(worksheet, windowBounds.weeks);
  addTrainingActivitiesDataRows(worksheet, rows, weekCount);
  styleTrainingActivitiesSheet(worksheet, totalColumns, weekCount);

  return workbook;
}

function addTrainingActivitiesHeaderRows(worksheet, weeks) {
  const monthRow = worksheet.addRow([
    sanitizeExcelText("Sr. No."),
    sanitizeExcelText("Course Code"),
    sanitizeExcelText("Course Name"),
    sanitizeExcelText("Mode"),
    sanitizeExcelText("Duration Days"),
    sanitizeExcelText("Status"),
    sanitizeExcelText("Month"),
    ...weeks.map((week) => sanitizeExcelText(formatMonthHeaderLabel(week.start))),
  ]);
  const weekRow = worksheet.addRow([
    "",
    "",
    "",
    "",
    "",
    "",
    sanitizeExcelText("Week"),
    ...weeks.map((week) => sanitizeExcelText(week.label)),
  ]);

  mergeRepeatedMonthCells(worksheet, monthRow.number, weeks);
  mergeFixedHeaderCells(worksheet, monthRow.number, weekRow.number);
}

function addTrainingActivitiesDataRows(worksheet, rows, weekCount) {
  let currentSection = "";

  rows.forEach((item) => {
    if (item.sectionKey !== currentSection) {
      currentSection = item.sectionKey;
      const sectionTitle = sanitizeExcelText(
        getTrainingActivitiesSectionTitle(currentSection),
      );
      const sectionRow = worksheet.addRow([sectionTitle]);
      worksheet.mergeCells(
        `A${sectionRow.number}:${worksheet.getColumn(7 + weekCount).letter}${sectionRow.number}`,
      );
    }

    let statusLabel = "Active";
    if (item.isCancelled) {
      statusLabel = "Cancelled";
    } else if (item.isPreActive) {
      statusLabel = "Pre-Active";
    }

    const dataRow = worksheet.addRow([
      item.serialNo,
      sanitizeExcelText(item.courseCode),
      sanitizeExcelText(item.courseName),
      sanitizeExcelText(item.mode),
      item.durationDays,
      sanitizeExcelText(statusLabel),
      "",
      ...item.weeklyEntries.map((entry) => sanitizeExcelText(entry)),
    ]);
    if (item.isCancelled) {
      dataRow.isCancelled = true;
    }
    if (item.isPreActive) {
      dataRow.isPreActive = true;
    }
  });
}

function styleTrainingActivitiesSheet(worksheet, totalColumns, weekCount) {
  worksheet.views = [{ state: "frozen", ySplit: 7, xSplit: 7 }];

  worksheet.getCell("A1").font = { name: "Arial", bold: true, size: 16 };
  worksheet.getCell("B5").font = { name: "Arial", bold: true, size: 11 };

  for (let rowNumber = 1; rowNumber <= 4; rowNumber++) {
    const cell = worksheet.getCell(`${worksheet.getColumn(totalColumns).letter}${rowNumber}`);
    cell.font = { name: "Arial", bold: true, size: 11 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }

  [6, 7].forEach((rowNumber) => {
    const row = worksheet.getRow(rowNumber);
    row.font = { name: "Arial", bold: true, size: 10 };
    row.height = 22;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "D9EEF9" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  for (let rowNumber = 8; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const firstCellValue = row.getCell(1).value;
    const isSectionHeader =
      typeof firstCellValue === "string" &&
      TRG219_SECTION_DEFINITIONS.some(
        (section) => section.title === firstCellValue,
      );
    const isCancelled = Boolean(row.isCancelled);
    const isPreActive = Boolean(row.isPreActive);

    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      let fontColor = undefined;
      if (isCancelled) {
        fontColor = { argb: "FFFF0000" };
      } else if (columnNumber === 6) {
        if (isPreActive) {
          fontColor = { argb: "FFED7D31" }; // Orange for Pre-Active
        } else {
          fontColor = { argb: "FF00B050" }; // Green for Active
        }
      }

      cell.font = {
        name: "Arial",
        size: 10,
        bold: columnNumber === 6 && !isSectionHeader,
        ...(fontColor ? { color: fontColor } : {}),
      };
      cell.alignment = {
        horizontal: columnNumber === 3 ? "left" : "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    if (isSectionHeader) {
      row.font = { name: "Arial", bold: true, size: 11 };
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = {
          horizontal: "left",
          vertical: "middle",
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "E2F0D9" },
        };
      });
      row.height = 20;
    } else {
      row.height = 32;
    }
  }
}

function mergeRepeatedMonthCells(worksheet, rowNumber, weeks) {
  let startIndex = 0;

  while (startIndex < weeks.length) {
    const monthKey = weeks[startIndex].monthKey;
    let endIndex = startIndex;
    while (
      endIndex + 1 < weeks.length &&
      weeks[endIndex + 1].monthKey === monthKey
    ) {
      endIndex++;
    }

    const startColumn = worksheet.getColumn(8 + startIndex).letter;
    const endColumn = worksheet.getColumn(8 + endIndex).letter;
    if (startIndex !== endIndex) {
      worksheet.mergeCells(`${startColumn}${rowNumber}:${endColumn}${rowNumber}`);
    }

    startIndex = endIndex + 1;
  }
}

function mergeFixedHeaderCells(worksheet, monthRowNumber, weekRowNumber) {
  ["A", "B", "C", "D", "E", "F"].forEach((columnLetter) => {
    worksheet.mergeCells(
      `${columnLetter}${monthRowNumber}:${columnLetter}${weekRowNumber}`,
    );
  });
}

function getTrainingActivitiesSectionKey(item, normalizedCode) {
  if (Number(item.is_outhouse) === 1) {
    return "MOLMI_OUTHOUSE_COURSES";
  }

  const matchedSection = TRG219_SECTION_DEFINITIONS.find(
    (section) =>
      section.key !== "MOLMI_OUTHOUSE_COURSES" &&
      section.key !== "OTHER_COURSES" &&
      section.codes.includes(normalizedCode),
  );

  return matchedSection ? matchedSection.key : "OTHER_COURSES";
}

function getTrainingActivitiesSectionTitle(sectionKey) {
  const section = TRG219_SECTION_DEFINITIONS.find(
    (item) => item.key === sectionKey,
  );
  return section ? section.title : "OTHER COURSES";
}

function normalizeTrainingActivitiesCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function normalizeTrainingActivitiesMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Offline";
  if (normalized.includes("online") && normalized.includes("offline")) {
    return "Online/ Offline";
  }
  if (normalized.includes("online")) return "Online";
  if (normalized.includes("offline")) return "Offline";
  return String(value).trim();
}

function calculateDurationDays(startDate, endDate) {
  const start = toUtcDateOnly(startDate);
  const end = toUtcDateOnly(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  return Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
}

function getDateRangeOverlap(startA, endA, startB, endB) {
  const normalizedStartA = toUtcDateOnly(startA);
  const normalizedEndA = toUtcDateOnly(endA);
  const normalizedStartB = toUtcDateOnly(startB);
  const normalizedEndB = toUtcDateOnly(endB);

  if (
    Number.isNaN(normalizedStartA.getTime()) ||
    Number.isNaN(normalizedEndA.getTime()) ||
    Number.isNaN(normalizedStartB.getTime()) ||
    Number.isNaN(normalizedEndB.getTime())
  ) {
    return null;
  }

  const start = new Date(
    Math.max(normalizedStartA.getTime(), normalizedStartB.getTime()),
  );
  const end = new Date(
    Math.min(normalizedEndA.getTime(), normalizedEndB.getTime()),
  );

  if (start.getTime() > end.getTime()) {
    return null;
  }

  return { start, end };
}

function formatMonthHeaderLabel(date) {
  return date.toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getShortMonthName(monthIndex) {
  return new Date(Date.UTC(2000, monthIndex, 1)).toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
}

function padDate(value) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function toDisplayDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function sanitizeExcelText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}

function toUtcDateOnly(value) {
  if (!value) {
    return new Date(NaN);
  }

  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  if (typeof value === "string") {
    const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(NaN);
  }

  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

function normalizeTrainingActivitiesDuration(noOfDays, startDate, endDate) {
  const numericDays = Number(noOfDays);
  if (Number.isFinite(numericDays) && numericDays > 0) {
    return numericDays;
  }

  const calculatedDays = calculateDurationDays(startDate, endDate);
  return Number.isFinite(calculatedDays) && calculatedDays > 0
    ? calculatedDays
    : 0;
}
