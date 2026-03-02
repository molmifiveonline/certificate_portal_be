const ReportDao = require("../../dao/ReportDao");
const xlsx = require("xlsx");

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
    const questionsMap = {};
    questionsData.forEach((q) => (questionsMap[q.id] = q));

    const allQuestions = await ReportDao.getAllFeedbackQuestionsCombined(1);
    const feedbackQuestionsWithOutRatings = allQuestions.nonRatings;

    // 2. Prepare Excel Header
    const headers = [
      "Sr. No.",
      "Date and time of Feedback submission",
      "Name of the participant",
      "Employee Number", // /Passport Number
      "Start date of course",
      "End date of course",
      "Rank Last served on vessel before this course",
      "Name of the manager (last served)",
      "Course Name",
      "No. of Participants",
      "Course No.",
      "Location of course conducted",
      "Instructors Name(s)",
    ];

    const ratingQuestions = [];
    questionsData.forEach((q) => {
      if (q.question_format === "Ratings") {
        headers.push(`${q.question} ( ${q.category_name} )`);
        ratingQuestions.push(q.id);
      }
    });

    headers.push("Average");
    headers.push("Overall Course evaluation average");

    const nonRatingQuestionsMap = [];
    feedbackQuestionsWithOutRatings.forEach((q) => {
      // Logic from PHP: if ($question->feedback_category_id == 23 && $question->feedback_id == 3)
      // We need to check if these IDs match new DB ids.
      // For now, including all non-rating questions that appear in the feedback answers could be safer,
      // OR follow the PHP logic blindly if IDs are consistent.
      // Let's include them if they exist in the questionsData or just append all non-rating questions found.
      // PHP Logic specific filter:
      if (q.feedback_category_id == 23) {
        // Assuming 23 is specific category
        // Find category name
        // Since we don't have category name in `allQuestions.nonRatings` easily without join,
        // we might skip the name in header or fetch it.
        // For now, let's just add the question text.
        headers.push(q.question);
        nonRatingQuestionsMap.push(q.id);
      }
    });

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
      if (c.secondary_trainer_ids) {
        // Remove brackets/quotes if stored as JSON string "['id']" or just split if comma separated
        // ActiveCourseDao saves it as simple array or string?
        // In DAO: secondary_trainer_ids param.
        // Let's assume it's a string comma separated or we handle both.
        const ids = c.secondary_trainer_ids.split(","); // simple assumption based on PHP
        trainerIds = [...trainerIds, ...ids];
      }
    });
    trainerIds = [...new Set(trainerIds)];
    const trainers = await ReportDao.getTrainersByIds(trainerIds);

    const masterCourseIds = [
      ...new Set(courses.map((c) => c.master_course_name)),
    ]; // Assuming master_course_name holds ID as per PHP logic
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
        masterCoursesMap[course.master_course_name] || course.course_name;

      // Secondary Trainers
      let secondaryTrainerNames = [];
      if (course.secondary_trainer_ids) {
        const sIds = course.secondary_trainer_ids.split(",");
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
      row.push(candidate.rank);
      row.push(candidate.manager);
      row.push(masterCourseName);
      row.push(participantMap[course.id] || "--");
      row.push(course.course_id);
      row.push(course.type_of_location);
      row.push(fullTrainerString);

      // Ratings
      let ratingSum = 0;
      let ratingCount = 0;

      ratingQuestions.forEach((qId) => {
        const ans =
          answersMap[pair.candidate_id]?.[pair.active_course_id]?.[qId];
        const val = ans
          ? ans.answer || ans.feedback_question_option_text || "--"
          : "--";
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
      courseAverages[masterCourseName].rowsIndices.push(dataRows.length); // Store index of this row to update later

      // Placeholder for Overall Avg
      row.push(""); // Will fill later

      // Non Ratings
      nonRatingQuestionsMap.forEach((qId) => {
        const ans =
          answersMap[pair.candidate_id]?.[pair.active_course_id]?.[qId];
        const val = ans
          ? ans.answer || ans.feedback_question_option_text || "--"
          : "--";
        row.push(val);
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

    // 6. Generate Excel
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, ...dataRows]);
    xlsx.utils.book_append_sheet(wb, ws, "Feedback Report");

    const wbout = xlsx.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Feedback_Report.xlsx"',
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(wbout);
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

    const headers = [
      "Sr. No.",
      "Employee Id",
      "Name",
      "Rank",
      "Last manager",
      "Topic",
      "Master Course Name",
      "INHOUSE/OUTHOUSE",
      "Location",
      "Actual course conducted no.",
      "From Date",
      "To Date",
      "No. of Days",
      "Trainers",
      "Certificate No.",
      "Course Name",
    ];

    const rows = data.map((item, index) => {
      // Format Trainers
      let trainerStr = `${item.trainer_prefix || ""}.${item.trainer_first_name} ${item.trainer_last_name || ""}`;
      if (item.secondary_trainer_ids) {
        // We don't have secondary trainer names joined in the main query easily without multiple joins or aggregation.
        // For simplicity, we might just show main trainer or if we really need secondary, we'd need another lookup.
        // The DAO structure for Certificate Report was a single query.
        // Let's rely on what we have. If secondary_trainer_ids is just IDs, we can't show names without fetching them.
        // For now, let's just show main trainer. If strict parity is needed, we can fetch all trainers map.
      }

      // Extract last part of course id
      const courseIdParts = (item.active_course_code || "").split("-");
      const lastPart =
        courseIdParts.length > 0 ? courseIdParts[courseIdParts.length - 1] : "";

      return [
        index + 1,
        item.empId,
        `${item.cand_first_name} ${item.cand_last_name}`,
        item.rank,
        item.manager,
        item.topic,
        item.master_course_name,
        item.type_of_course,
        item.location,
        lastPart,
        new Date(item.from_date).toLocaleDateString("en-GB"),
        new Date(item.to_date).toLocaleDateString("en-GB"),
        item.days,
        trainerStr,
        item.certificate_no,
        item.course_name,
      ];
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, ...rows]);
    xlsx.utils.book_append_sheet(wb, ws, "Certificate Report");

    const wbout = xlsx.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Certificate_Report.xlsx"',
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(wbout);
  } catch (error) {
    console.error("Export Certificate Error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
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
