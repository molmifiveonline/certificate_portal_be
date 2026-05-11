const QuestionBankDao = require("../dao/QuestionBankDao");
const MasterCourseDao = require("../dao/MasterCourseDao");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const fs = require("fs");

const QUESTION_TEMPLATE_HEADERS = [
  "Question",
  "Master Course ID",
  "Type of Test",
  "Option A",
  "Option B",
  "Option C",
  "Option D",
  "Correct Option",
];
const MASTER_COURSE_DROPDOWN_START_ROW = 2;
const MASTER_COURSE_DROPDOWN_END_ROW = 1001;
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const buildMasterCourseDisplayValue = (course) =>
  `${course.topic || "-"} - ${course.master_course_name || "-"} (${course.id})`;

const extractMasterCourseId = (value) => {
  const normalizedValue = (value || "").toString().trim();
  const match = normalizedValue.match(UUID_PATTERN);
  return match ? match[0] : normalizedValue;
};

exports.createQuestion = async (req, res) => {
  try {
    const {
      question,
      master_course_id,
      type_of_test,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
    } = req.body;

    if (
      !option_a?.trim() ||
      !option_b?.trim() ||
      !option_c?.trim() ||
      !option_d?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "All 4 option text entries are mandatory",
      });
    }

    const files = req.files || {};
    const questionData = {
      question,
      master_course_id,
      type_of_test,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      image: files.image ? `uploads/question/${files.image[0].filename}` : null,
      opt_img_a: files.opt_img_a
        ? `uploads/question/${files.opt_img_a[0].filename}`
        : null,
      opt_img_b: files.opt_img_b
        ? `uploads/question/${files.opt_img_b[0].filename}`
        : null,
      opt_img_c: files.opt_img_c
        ? `uploads/question/${files.opt_img_c[0].filename}`
        : null,
      opt_img_d: files.opt_img_d
        ? `uploads/question/${files.opt_img_d[0].filename}`
        : null,
    };

    const newQuestion = await QuestionBankDao.create(questionData);
    res.status(201).json({
      success: true,
      message: "Question added successfully",
      data: newQuestion,
    });
  } catch (error) {
    console.error("Error creating question:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getAllQuestions = async (req, res) => {
  try {
    const { search, masterCourseId, page, limit } = req.query;
    const result = await QuestionBankDao.getAll(search, masterCourseId, page, limit);
    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    const question = await QuestionBankDao.getById(id);
    if (!question) {
      return res
        .status(404)
        .json({ success: false, message: "Question not found" });
    }
    res.status(200).json({ success: true, data: question });
  } catch (error) {
    console.error("Error fetching question:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      question,
      master_course_id,
      type_of_test,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
    } = req.body;

    if (
      !option_a?.trim() ||
      !option_b?.trim() ||
      !option_c?.trim() ||
      !option_d?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "All 4 option text entries are mandatory",
      });
    }

    const files = req.files || {};
    const updateData = {
      question,
      master_course_id,
      type_of_test,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
    };

    if (files.image)
      updateData.image = `uploads/question/${files.image[0].filename}`;
    if (files.opt_img_a)
      updateData.opt_img_a = `uploads/question/${files.opt_img_a[0].filename}`;
    if (files.opt_img_b)
      updateData.opt_img_b = `uploads/question/${files.opt_img_b[0].filename}`;
    if (files.opt_img_c)
      updateData.opt_img_c = `uploads/question/${files.opt_img_c[0].filename}`;
    if (files.opt_img_d)
      updateData.opt_img_d = `uploads/question/${files.opt_img_d[0].filename}`;

    const updated = await QuestionBankDao.update(id, updateData);
    if (updated) {
      res
        .status(200)
        .json({ success: true, message: "Question updated successfully" });
    } else {
      res.status(404).json({
        success: false,
        message: "Question not found or no changes made",
      });
    }
  } catch (error) {
    console.error("Error updating question:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await QuestionBankDao.delete(id);
    if (deleted) {
      res
        .status(200)
        .json({ success: true, message: "Question deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Question not found" });
    }
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.downloadSampleTemplate = async (req, res) => {
  try {
    const masterCourses = await MasterCourseDao.getOptions();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Certificate Portal";
    workbook.created = new Date();

    const questionsSheet = workbook.addWorksheet("Questions");
    questionsSheet.addRow(QUESTION_TEMPLATE_HEADERS);
    questionsSheet.addRow([
      "What is food safety?",
      masterCourses[0]
        ? buildMasterCourseDisplayValue(masterCourses[0])
        : "<paste-course-uuid>",
      "1,2",
      "Handling food properly",
      "Cooking only",
      "Cleaning only",
      "None of the above",
      "opt_a",
    ]);

    questionsSheet.columns = [
      { width: 45 },
      { width: 80 },
      { width: 18 },
      { width: 28 },
      { width: 24 },
      { width: 24 },
      { width: 24 },
      { width: 18 },
    ];

    questionsSheet.getRow(1).font = { bold: true };
    questionsSheet.getRow(1).alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    const lookupSheet = workbook.addWorksheet("_MasterCourses");
    lookupSheet.state = "veryHidden";
    lookupSheet.addRow(["ID", "Topic", "Master Course Name", "Dropdown Value"]);
    masterCourses.forEach((course) => {
      lookupSheet.addRow([
        course.id,
        course.topic || "",
        course.master_course_name || "",
        buildMasterCourseDisplayValue(course),
      ]);
    });

    lookupSheet.columns = [
      { width: 40 },
      { width: 30 },
      { width: 40 },
      { width: 80 },
    ];

    if (masterCourses.length > 0) {
      const lastLookupRow = masterCourses.length + 1;
      for (
        let row = MASTER_COURSE_DROPDOWN_START_ROW;
        row <= MASTER_COURSE_DROPDOWN_END_ROW;
        row++
      ) {
        questionsSheet.getCell(`B${row}`).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`'_MasterCourses'!$D$2:$D$${lastLookupRow}`],
          showErrorMessage: true,
          errorTitle: "Invalid Master Course",
          error: "Please select a Master Course from the dropdown list.",
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=question_bank_template.xlsx",
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating question bank template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate sample template",
      error: error.message,
    });
  }
};

exports.bulkUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const workbook = XLSX.readFile(req.file.path);
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      if (req.file.path) fs.unlink(req.file.path, () => {});
      return res
        .status(400)
        .json({ success: false, message: "Excel file has no sheets" });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      if (req.file.path) fs.unlink(req.file.path, () => {});
      return res
        .status(400)
        .json({ success: false, message: "Excel sheet is empty or invalid" });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (rows.length === 0) {
      if (req.file.path) fs.unlink(req.file.path, () => {});
      return res
        .status(400)
        .json({ success: false, message: "No data found in Excel file" });
    }

    const masterCourses = await MasterCourseDao.getOptions();
    const activeMasterCourseIds = new Set(
      masterCourses.map((course) => course.id.toLowerCase()),
    );
    const results = { success: 0, failed: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (header is row 1)

      const question = (row["Question"] || row["question"] || "")
        .toString()
        .trim();
      const masterCourseInput = (
        row["Master Course ID"] ||
        row["master_course_id"] ||
        ""
      )
        .toString()
        .trim();
      const master_course_id = extractMasterCourseId(
        masterCourseInput,
      ).toLowerCase();
      const type_of_test = (row["Type of Test"] || row["type_of_test"] || "")
        .toString()
        .trim();
      const option_a = (row["Option A"] || row["option_a"] || "")
        .toString()
        .trim();
      const option_b = (row["Option B"] || row["option_b"] || "")
        .toString()
        .trim();
      const option_c = (row["Option C"] || row["option_c"] || "")
        .toString()
        .trim();
      const option_d = (row["Option D"] || row["option_d"] || "")
        .toString()
        .trim();
      const correct_option = (
        row["Correct Option"] ||
        row["correct_option"] ||
        ""
      )
        .toString()
        .trim();

      if (!question) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Question is required`);
        continue;
      }
      if (!master_course_id) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Master Course ID is required`);
        continue;
      }
      if (!activeMasterCourseIds.has(master_course_id)) {
        results.failed++;
        results.errors.push(
          `Row ${rowNum}: Master Course ID is invalid or inactive`,
        );
        continue;
      }
      if (!correct_option) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: Correct Option is required`);
        continue;
      }
      if (!option_a || !option_b || !option_c || !option_d) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: All 4 options are required`);
        continue;
      }

      try {
        await QuestionBankDao.create({
          question,
          master_course_id,
          type_of_test: type_of_test || null,
          option_a: option_a || null,
          option_b: option_b || null,
          option_c: option_c || null,
          option_d: option_d || null,
          correct_option,
          image: null,
          opt_img_a: null,
          opt_img_b: null,
          opt_img_c: null,
          opt_img_d: null,
        });
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`Row ${rowNum}: ${err.message}`);
      }
    }

    // Clean up uploaded file
    if (req.file.path) {
      fs.unlink(req.file.path, () => {});
    }

    res.status(200).json({
      success: true,
      message: `Bulk upload complete. ${results.success} added, ${results.failed} failed.`,
      data: results,
    });
  } catch (error) {
    console.error("Error in bulk upload:", error);
    // Unlink file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({
      success: false,
      message: "Failed to process Excel file",
      error: error.message,
    });
  }
};
