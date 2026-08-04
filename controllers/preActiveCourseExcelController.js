const ExcelJS = require("exceljs");
const XLSX = require("xlsx");
const fs = require("fs");
const pool = require("../config/db");
const PreActiveCourseDao = require("../dao/PreActiveCourseDao");
const LocationDao = require("../dao/LocationDao");
const MasterCourseDao = require("../dao/MasterCourseDao");
const LogDao = require("../dao/LogDao");

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const buildMasterCourseDisplayValue = (course) =>
  `${course.topic || "-"} - ${course.master_course_name || "-"} (${course.id})`;

const extractIdFromDisplayValue = (value) => {
  const normalizedValue = (value || "").toString().trim();
  const match = normalizedValue.match(UUID_PATTERN);
  return match ? match[0] : null;
};

const parseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val.toISOString().split("T")[0];
  }
  const dateStr = String(val).trim();
  // Check if it's a serial number (from Excel)
  if (/^\d+(\.\d+)?$/.test(dateStr)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const days = parseFloat(dateStr);
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }
  // Try parsing YYYY-MM-DD
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  
  // Try normal JS Date parse
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return null;
};

const getDurationDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
};

exports.downloadSampleTemplate = async (req, res) => {
  try {
    const [masterCourses] = await pool.execute(
      "SELECT id, topic, master_course_name, description FROM master_course WHERE status = 1 ORDER BY topic, master_course_name"
    );
    
    // Fetch locations
    const locationsResult = await LocationDao.getAllLocations({ limit: 1000 });
    const locations = locationsResult.data || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Certificate Portal";
    workbook.created = new Date();

    const coursesSheet = workbook.addWorksheet("Pre-Active Courses");
    
    // Set headers
    const headers = [
      "Course Topic*",
      "Master Course Name",
      "Start Date* (YYYY-MM-DD)",
      "End Date* (YYYY-MM-DD)",
      "Course Type*",
      "Location Type*",
      "Training Venue",
      "Other Location",
      "Course Description",
      "Remarks"
    ];
    coursesSheet.addRow(headers);

    // Style headers
    coursesSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    coursesSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" } // Indigo background
    };
    coursesSheet.getRow(1).alignment = {
      vertical: "middle",
      horizontal: "left"
    };

    // Columns width setup
    coursesSheet.columns = [
      { width: 45 }, // Course Topic
      { width: 45 }, // Master Course Name
      { width: 25 }, // Start Date
      { width: 25 }, // End Date
      { width: 25 }, // Course Type
      { width: 20 }, // Location Type
      { width: 35 }, // Training Venue
      { width: 25 }, // Other Location
      { width: 50 }, // Course Description
      { width: 40 }  // Remarks
    ];

    // Create lookup sheet for Master Courses
    const mcLookupSheet = workbook.addWorksheet("_MasterCourses");
    mcLookupSheet.state = "veryHidden";
    mcLookupSheet.addRow(["Display", "ID", "Topic", "Name", "Description"]);
    masterCourses.forEach((c) => {
      mcLookupSheet.addRow([
        buildMasterCourseDisplayValue(c),
        c.id,
        c.topic,
        c.master_course_name,
        c.description || ""
      ]);
    });

    // Create lookup sheet for Locations
    const locLookupSheet = workbook.addWorksheet("_Locations");
    locLookupSheet.state = "veryHidden";
    locLookupSheet.addRow(["ID", "Name", "Display"]);
    locations.forEach((l) => {
      locLookupSheet.addRow([l.id, l.location_name, `${l.location_name} (${l.id})`]);
    });
    // Add "Other" option to locations lookup
    locLookupSheet.addRow(["other", "Other", "Other (other)"]);

    // Add list validations to cells
    const rowCount = 100; // Apply validation to first 100 rows
    for (let r = 2; r <= rowCount + 1; r++) {
      // Course Topic validation
      if (masterCourses.length > 0) {
        coursesSheet.getCell(`A${r}`).dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`'_MasterCourses'!$A$2:$A$${masterCourses.length + 1}`],
          showErrorMessage: true,
          errorTitle: "Invalid Course Topic",
          error: "Please select a Course Topic from the dropdown list."
        };
      }

      // Auto-fill formulas for Master Course Name and Course Description
      coursesSheet.getCell(`B${r}`).value = {
        formula: `IF(ISBLANK(A${r}), "", VLOOKUP(A${r}, _MasterCourses!$A$2:$E$${masterCourses.length + 1}, 4, FALSE))`
      };

      coursesSheet.getCell(`I${r}`).value = {
        formula: `IF(ISBLANK(A${r}), "", VLOOKUP(A${r}, _MasterCourses!$A$2:$E$${masterCourses.length + 1}, 5, FALSE))`
      };

      // Course Type validation
      coursesSheet.getCell(`E${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"In house,Out house,CBT,Inhouse (third party)"'],
        showErrorMessage: true,
        errorTitle: "Invalid Course Type",
        error: "Please select a valid Course Type from the list."
      };

      // Location Type validation
      coursesSheet.getCell(`F${r}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"Online,Offline,Hybrid"'],
        showErrorMessage: true,
        errorTitle: "Invalid Location Type",
        error: "Please select Online, Offline, or Hybrid."
      };

      // Training Venue validation
      if (locations.length > 0) {
        coursesSheet.getCell(`G${r}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'_Locations'!$C$2:$C$${locations.length + 2}`],
          showErrorMessage: true,
          errorTitle: "Invalid Training Venue",
          error: "Please select a Training Venue from the list or 'Other'."
        };
      }
    }

    // Add a sample row as guidance
    if (masterCourses.length > 0) {
      coursesSheet.addRow([
        buildMasterCourseDisplayValue(masterCourses[0]),
        { formula: `IF(ISBLANK(A2), "", VLOOKUP(A2, _MasterCourses!$A$2:$E$${masterCourses.length + 1}, 4, FALSE))` },
        new Date().toISOString().split("T")[0],
        new Date().toISOString().split("T")[0],
        "In house",
        "Offline",
        locations[0] ? `${locations[0].location_name} (${locations[0].id})` : "",
        "",
        { formula: `IF(ISBLANK(A2), "", VLOOKUP(A2, _MasterCourses!$A$2:$E$${masterCourses.length + 1}, 5, FALSE))` },
        "Sample Remarks"
      ]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=pre_active_courses_template.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    console.error("Error generating Pre-Active Course template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate sample template",
      error: error.message
    });
  }
};

exports.bulkUploadFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const workbook = XLSX.readFile(req.file.path);
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      if (req.file.path) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: "Excel file has no sheets" });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      if (req.file.path) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: "Excel sheet is empty or invalid" });
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (rows.length === 0) {
      if (req.file.path) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: "No data found in Excel file" });
    }

    // Get existing courses to identify duplicates (skip if matches course_name + start_date + end_date)
    const [existingCourses] = await pool.execute(
      "SELECT course_name, start_date, end_date FROM courses WHERE is_pre_active = 1"
    );
    const existingSet = new Set(
      existingCourses.map(c => {
        const sDate = c.start_date ? new Date(c.start_date).toISOString().split("T")[0] : "";
        const eDate = c.end_date ? new Date(c.end_date).toISOString().split("T")[0] : "";
        return `${c.course_name.toLowerCase().trim()}_${sDate}_${eDate}`;
      })
    );

    // Fetch master courses and locations mapping for name resolving/validation
    const [masterCourses] = await pool.execute(
      "SELECT id, topic, master_course_name, description FROM master_course WHERE status = 1"
    );
    const mcMap = new Map(masterCourses.map(c => [c.id.toLowerCase(), c]));

    const locationsResult = await LocationDao.getAllLocations({ limit: 1000 });
    const locMap = new Map((locationsResult.data || []).map(l => [l.id.toLowerCase(), l]));

    const parsedCourses = [];
    const errors = [];
    let validCount = 0;
    let invalidCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row number (header is row 1)

      // Skip sample/template/guide rows if any
      const firstColVal = String(row["Course Topic*"] || row["Course Topic"] || "").trim();
      if (!firstColVal || firstColVal.startsWith("Display - ") || firstColVal.includes("<paste-")) {
        continue;
      }

      const courseTopicInput = firstColVal;
      const start_date_raw = row["Start Date* (YYYY-MM-DD)"] || row["Start Date"] || "";
      const end_date_raw = row["End Date* (YYYY-MM-DD)"] || row["End Date"] || "";
      const course_type = String(row["Course Type*"] || row["Course Type"] || "").trim();
      const location_type = String(row["Location Type*"] || row["Location Type"] || "").trim();
      const training_venue_input = String(row["Training Venue"] || "").trim();
      const other_location = String(row["Other Location"] || "").trim();
      const remarks = String(row["Remarks"] || "").trim();

      const master_course_id = extractIdFromDisplayValue(courseTopicInput);
      const parsedStart = parseDate(start_date_raw);
      const parsedEnd = parseDate(end_date_raw);

      const rowErrors = [];

      // 1. Validation: Course Topic
      let resolvedMc = null;
      if (!master_course_id) {
        rowErrors.push("Course Topic is required (select from dropdown)");
      } else {
        resolvedMc = mcMap.get(master_course_id.toLowerCase());
        if (!resolvedMc) {
          rowErrors.push("Selected Course Topic does not exist in database");
        }
      }

      // 2. Validation: Dates
      if (!parsedStart) {
        rowErrors.push("Valid Start Date is required (format: YYYY-MM-DD)");
      }
      if (!parsedEnd) {
        rowErrors.push("Valid End Date is required (format: YYYY-MM-DD)");
      }
      if (parsedStart && parsedEnd && new Date(parsedEnd) < new Date(parsedStart)) {
        rowErrors.push("End Date cannot be earlier than Start Date");
      }

      // 3. Validation: Course Type
      const validCourseTypes = ["In house", "Out house", "CBT", "Inhouse (third party)"];
      if (!course_type) {
        rowErrors.push("Course Type is required");
      } else if (!validCourseTypes.includes(course_type)) {
        rowErrors.push(`Course Type must be one of: ${validCourseTypes.join(", ")}`);
      }

      // 4. Validation: Location Type
      const validLocationTypes = ["Online", "Offline", "Hybrid"];
      if (!location_type) {
        rowErrors.push("Location Type is required");
      } else if (!validLocationTypes.includes(location_type)) {
        rowErrors.push(`Location Type must be one of: ${validLocationTypes.join(", ")}`);
      }

      // 5. Validation: Location / Venue
      let location_id = null;
      if (location_type === "Offline" || location_type === "Hybrid") {
        if (!training_venue_input) {
          rowErrors.push("Training Venue is required for Offline/Hybrid location types");
        } else {
          const matchedLocId = extractIdFromDisplayValue(training_venue_input);
          if (matchedLocId === "other" || training_venue_input.toLowerCase().startsWith("other")) {
            location_id = "other";
            if (!other_location) {
              rowErrors.push("Other Location must be specified when Training Venue is 'Other'");
            }
          } else if (matchedLocId) {
            const resolvedLoc = locMap.get(matchedLocId.toLowerCase());
            if (!resolvedLoc) {
              rowErrors.push("Selected Training Venue does not exist in database");
            } else {
              location_id = resolvedLoc.id;
            }
          } else {
            rowErrors.push("Invalid Training Venue selection format");
          }
        }
      }

      // Check if duplicate in DB
      const courseName = resolvedMc ? resolvedMc.master_course_name : "";
      const description = resolvedMc ? (resolvedMc.description || "") : "";
      let isDuplicate = false;
      if (courseName && parsedStart && parsedEnd) {
        const key = `${courseName.toLowerCase().trim()}_${parsedStart}_${parsedEnd}`;
        if (existingSet.has(key)) {
          isDuplicate = true;
        }
      }

      const days = getDurationDays(parsedStart, parsedEnd);

      const parsedRow = {
        rowNum,
        master_course_id,
        master_course_name: courseName,
        topic: resolvedMc ? resolvedMc.topic : "",
        course_name: courseName,
        start_date: parsedStart,
        end_date: parsedEnd,
        days,
        type_of_course: course_type,
        type_of_location: location_type,
        location_id,
        other_location,
        description,
        remarks,
        isDuplicate,
        hasError: rowErrors.length > 0
      };

      if (rowErrors.length > 0) {
        invalidCount++;
        errors.push({ rowNum, errors: rowErrors });
      } else {
        validCount++;
      }

      parsedCourses.push(parsedRow);
    }

    // Clean up temp file
    if (req.file.path) fs.unlink(req.file.path, () => {});

    res.json({
      success: true,
      data: parsedCourses,
      errors,
      stats: {
        total: parsedCourses.length,
        valid: validCount,
        invalid: invalidCount
      }
    });

  } catch (error) {
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
    console.error("Bulk upload preview error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process Excel file",
      error: error.message
    });
  }
};

exports.confirmExcelImport = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { courses } = req.body;
    if (!courses || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ success: false, message: "No course data provided" });
    }

    await connection.beginTransaction();
    
    let insertedCount = 0;
    let skippedCount = 0;

    // Fetch existing pre-active courses to double-check duplicates inside transaction
    const [existingCourses] = await connection.execute(
      "SELECT course_name, start_date, end_date FROM courses WHERE is_pre_active = 1"
    );
    const existingSet = new Set(
      existingCourses.map(c => {
        const sDate = c.start_date ? new Date(c.start_date).toISOString().split("T")[0] : "";
        const eDate = c.end_date ? new Date(c.end_date).toISOString().split("T")[0] : "";
        return `${c.course_name.toLowerCase().trim()}_${sDate}_${eDate}`;
      })
    );

    const { v4: uuidv4 } = require("uuid");

    for (const c of courses) {
      // Basic check: skip rows with errors or duplicates
      if (c.hasError) {
        continue;
      }

      const key = `${c.course_name.toLowerCase().trim()}_${c.start_date}_${c.end_date}`;
      if (existingSet.has(key)) {
        skippedCount++;
        continue;
      }

      const id = uuidv4();
      const course_id = "PRE-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 10);

      const query = `
        INSERT INTO courses (
          id, course_id, master_course_id, master_course_name, topic, course_name, 
          description, start_date, end_date, no_of_days, type_of_location, 
          location_id, other_location, course_type, remarks, status, is_pre_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pre-Active', 1)
      `;

      await connection.execute(query, [
        id,
        course_id,
        c.master_course_id || null,
        c.master_course_name || null,
        c.topic || null,
        c.course_name || null,
        c.description || null,
        c.start_date || null,
        c.end_date || null,
        c.days || 0,
        c.type_of_location || null,
        c.location_id === "other" ? null : c.location_id,
        c.location_id === "other" ? c.other_location : null,
        c.type_of_course || null,
        c.remarks || null
      ]);

      insertedCount++;
      // Add to set to prevent duplicate insertion of rows in the same Excel payload
      existingSet.add(key);
    }

    await connection.commit();

    // Log action
    await LogDao.createLog({
      user_id: req.user.id,
      action: "EXCEL_IMPORT_PRE_ACTIVE_COURSES",
      details: `Imported ${insertedCount} pre-active courses via Excel upload. Skipped ${skippedCount} duplicates.`,
      ip_address: req.ip,
      user_agent: req.get("User-Agent")
    });

    res.json({
      success: true,
      message: "Import complete",
      stats: {
        inserted: insertedCount,
        skipped: skippedCount
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error("Confirm Excel import error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import course data",
      error: error.message
    });
  } finally {
    connection.release();
  }
};
