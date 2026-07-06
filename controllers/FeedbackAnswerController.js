const FeedbackAnswerDao = require("../dao/FeedbackAnswerDao");
const CandidateDao = require("../dao/candidateDao");
const ActiveCourseDao = require("../dao/ActiveCourseDao");
const MasterCourseDao = require("../dao/MasterCourseDao");
const TrainerDao = require("../dao/trainerDao");
const FeedbackQuestionDao = require("../dao/feedbackQuestionDao");

const getFeedbackCourseTypeForCourse = (course) => {
  const locationType = (course?.type_of_location || "").toLowerCase().trim();
  if (locationType === "online") return "Online";
  return "Offline";
};

class FeedbackAnswerController {
  static async submitFeedback(req, res) {
    try {
      const { candidate_id, active_course_id, answers } = req.body;

      if (
        !candidate_id ||
        !active_course_id ||
        !answers ||
        !Array.isArray(answers)
      ) {
        return res.status(400).json({ message: "Invalid input data" });
      }

      const results = [];
      for (const ans of answers) {
        const {
          question_id,
          answer,
          category_id,
          option_id,
          option_text,
          feedback_id,
        } = ans;

        if (question_id) {
          const question = await FeedbackQuestionDao.getById(question_id);
          if (question) {
            const questionType = String(question.type || "").toLowerCase();
            if (questionType === "rating" || questionType === "ratings") {
              const ratingVal = Number(answer);
              if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 10) {
                return res.status(400).json({ message: "Invalid rating value. Must be between 1 and 10." });
              }
            }
          }

          const id = await FeedbackAnswerDao.create({
            candidate_id,
            active_course_id,
            feedback_question_id: question_id,
            answer,
            feedback_category_id: category_id,
            feedback_question_option_id: option_id,
            feedback_question_option_text: option_text,
            feedback_id: feedback_id,
          });
          results.push(id);
        }
      }

      res
        .status(201)
        .json({ message: "Feedback submitted successfully", ids: results });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error submitting feedback", error: error.message });
    }
  }

  static async getFeedbackCourses(req, res) {
    try {
      const { page, limit, search } = req.query;
      const filters = { page, limit, search };

      if (
        req.user &&
        req.user.role &&
        req.user.role.toLowerCase() === "trainer"
      ) {
        filters.trainer_id = req.user.id;
      }

      const result = await FeedbackAnswerDao.getFeedbackCourses(filters);

      res.json({
        data: result.data,
        totalCount: result.totalCount,
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        totalPages: Math.ceil(result.totalCount / (Number(limit) || 10)),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Error fetching feedback courses",
        error: error.message,
      });
    }
  }

  static async getSubmissions(req, res) {
    try {
      const { page, limit, search, active_course_id } = req.query;
      const filters = { page, limit, search, active_course_id };

      if (
        req.user &&
        req.user.role &&
        req.user.role.toLowerCase() === "trainer"
      ) {
        filters.trainer_id = req.user.id;
      }

      const submissions =
        await FeedbackAnswerDao.getDistinctSubmissions(filters);
      const totalCount =
        await FeedbackAnswerDao.countDistinctSubmissions(filters);

      res.json({
        data: submissions,
        totalCount,
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        totalPages: Math.ceil(totalCount / (Number(limit) || 10)),
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error fetching submissions", error: error.message });
    }
  }

  static async getSubmissionDetails(req, res) {
    try {
      const { candidateId, activeCourseId, courseId } = req.params;
      const resolvedActiveCourseId = activeCourseId || courseId;

      const answers = await FeedbackAnswerDao.getSubmissionDetails(
        candidateId,
        resolvedActiveCourseId,
      );
      const candidate = await CandidateDao.getCandidateById(candidateId);

      res.json({
        candidate,
        active_course_id: resolvedActiveCourseId,
        feedback_type: answers[0]?.feedback_type || "N/A",
        answers,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Error fetching submission details",
        error: error.message,
      });
    }
  }

  static async downloadFeedbackPDF(req, res) {
    try {
      const { candidateId, activeCourseId } = req.params;

      const answers = await FeedbackAnswerDao.getSubmissionDetails(
        candidateId,
        activeCourseId,
      );
      const candidate = await CandidateDao.getCandidateById(candidateId);
      const courseDetails = await ActiveCourseDao.getById(activeCourseId);
      let trainerName = "N/A";
      let masterCourseName = "N/A";

      if (courseDetails) {
        if (courseDetails.primary_trainer_id) {
          const trainer = await TrainerDao.getTrainerById(
            courseDetails.primary_trainer_id,
          );
          if (trainer) {
            trainerName = `${trainer.first_name} ${trainer.last_name}`;
          }
        }
        if (courseDetails.master_course_id) {
          const masterCourse = await MasterCourseDao.getById(
            courseDetails.master_course_id,
          );
          if (masterCourse) {
            masterCourseName = masterCourse.master_course_name;
          }
        }
      }

      const fonts = {
        Helvetica: {
          normal: "Helvetica",
          bold: "Helvetica-Bold",
          italics: "Helvetica-Oblique",
          bolditalics: "Helvetica-BoldOblique",
        },
      };

      const pdfmake = require("pdfmake");
      pdfmake.setFonts(fonts);

      const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        const date = new Date(dateStr);
        return isNaN(date.getTime())
          ? "N/A"
          : date.toLocaleDateString("en-GB").replace(/\//g, "-");
      };

      const getFallbackText = (value, fallback = "N/A") =>
        value && String(value).trim() !== "" ? String(value) : fallback;

      const stripHtml = (value) =>
        String(value ?? "")
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&quot;/gi, '"')
          .replace(/&#39;/gi, "'")
          .replace(/\s+/g, " ")
          .trim();

      // Add soft break points for very long tokens so text doesn't get clipped in narrow cells.
      const softWrapLongTokens = (text, tokenLength = 18) =>
        String(text).replace(
          new RegExp(`(\\S{${tokenLength}})(?=\\S)`, "g"),
          `$1\u200B`,
        );

      const getPdfText = (value, fallback = "N/A") =>
        softWrapLongTokens(getFallbackText(stripHtml(value), fallback));

      const buildLabeledValue = (label, value, fallback = "N/A") => ({
        text: [
          { text: `${label}: `, bold: true },
          getPdfText(value, fallback),
        ],
        margin: [0, 0, 0, 8],
      });

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
          const answerText = getPdfText(
            ans.answer || ans.feedback_question_option_text,
            "No Answer",
          );

          feedbackRows.push([
            { text: (index + 1).toString(), style: "tableCell" },
            {
              text: getPdfText(ans.question, "Unknown Question"),
              style: "tableCell",
            },
            {
              text: getPdfText(ans.category_name, "NA"),
              style: "tableCell",
            },
            { text: answerText, style: "answerCell" },
          ]);
        });
      } else {
        feedbackRows.push([
          {
            colSpan: 4,
            text: "No feedback submitted.",
            alignment: "center",
            color: "#6c757d",
            style: "tableCell",
          },
          "",
          "",
          "",
        ]);
      }

      const candidateName = getFallbackText(
        [candidate?.first_name, candidate?.last_name].filter(Boolean).join(" "),
        "Unknown Candidate",
      );

      const docDefinition = {
        pageMargins: [60, 44, 60, 44],
        defaultStyle: {
          font: "Helvetica",
          fontSize: 13,
        },
        content: [
          {
            text: "Feedback Report",
            style: "header",
            alignment: "center",
            margin: [0, 0, 0, 28],
          },
          buildLabeledValue("Employee ID", candidate?.employee_id),
          buildLabeledValue("Candidate", candidateName, "Unknown Candidate"),
          buildLabeledValue("Active Course ID", courseDetails?.course_id),
          buildLabeledValue("Course Name", masterCourseName, "Unknown Course"),
          buildLabeledValue("Rank", candidate?.rank),
          buildLabeledValue("Trainer Name", trainerName),
          buildLabeledValue("Course Date", formatDate(courseDetails?.start_date)),
          buildLabeledValue("Course Location", courseDetails?.type_of_location),
          buildLabeledValue("Feedback Type", answers[0]?.feedback_type || "N/A"),
          buildLabeledValue("Name of Manager (last served)", candidate?.manager),
          {
            text: "Feedback Details",
            style: "subheader",
            margin: [0, 30, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: [26, "*", 125, 102],
              body: feedbackRows,
            },
            layout: {
              hLineWidth: () => 1,
              vLineWidth: () => 1,
              hLineColor: () => "#dee2e6",
              vLineColor: () => "#dee2e6",
              paddingLeft: () => 6,
              paddingRight: () => 6,
              paddingTop: () => 6,
              paddingBottom: () => 6,
            },
          },
        ],
        styles: {
          header: {
            fontSize: 46,
            bold: true,
          },
          subheader: {
            fontSize: 15,
            bold: true,
          },
          tableHeader: {
            bold: true,
            fillColor: "#343a40",
            color: "white",
            alignment: "center",
          },
          tableCell: {
            fontSize: 12,
            noWrap: false,
          },
          answerCell: {
            fontSize: 12,
            noWrap: false,
          },
        },
      };

      const pdf = pdfmake.createPdf(docDefinition);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Feedback_${candidate.first_name}_${candidate.last_name}.pdf`,
      );

      pdf
        .getBuffer()
        .then((buffer) => {
          res.end(buffer);
        })
        .catch((err) => {
          console.error("PDF Buffer Error:", err);
          if (!res.headersSent) {
            res.status(500).json({
              message: "Error generating PDF buffer",
              error: err.message,
            });
          }
        });
    } catch (error) {
      console.error("PDF Generation Error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          message: "Error generating PDF",
          error: error.message,
        });
      }
    }
  }
  static async getCandidateFeedbackStatus(req, res) {
    try {
      const { courseId } = req.params;
      const candidateId = req.user.id;

      const existingAnswers = await FeedbackAnswerDao.getSubmissionDetails(
        candidateId,
        courseId,
      );

      const hasSubmitted = existingAnswers && existingAnswers.length > 0;

      const course = await ActiveCourseDao.getById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      const FeedbackFormDao = require("../dao/FeedbackFormDao");
      const feedbackCourseType = getFeedbackCourseTypeForCourse(course);
      const form = await FeedbackFormDao.getByCourseType(feedbackCourseType);

      res.json({
        hasSubmitted,
        submittedDate: hasSubmitted ? existingAnswers[0].created_at : null,
        answers: hasSubmitted ? existingAnswers : null,
        form,
        feedbackCourseType,
        message: form
          ? undefined
          : `No active ${feedbackCourseType} feedback form configured`,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Error fetching feedback status",
        error: error.message,
      });
    }
  }

  static async submitCandidateFeedback(req, res) {
    try {
      const { active_course_id, answers } = req.body;
      const candidate_id = req.user.id;

      if (!active_course_id || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ message: "Invalid input data" });
      }

      const results = [];
      for (const ans of answers) {
        const {
          question_id,
          answer,
          category_id,
          option_id,
          option_text,
          feedback_id,
        } = ans;

        if (question_id) {
          const question = await FeedbackQuestionDao.getById(question_id);
          if (question) {
            const questionType = String(question.type || "").toLowerCase();
            if (questionType === "rating" || questionType === "ratings") {
              const ratingVal = Number(answer);
              if (isNaN(ratingVal) || ratingVal < 1 || ratingVal > 10) {
                return res.status(400).json({ message: "Invalid rating value. Must be between 1 and 10." });
              }
            }
          }

          const id = await FeedbackAnswerDao.create({
            candidate_id,
            active_course_id,
            feedback_question_id: question_id,
            answer,
            feedback_category_id: category_id,
            feedback_id: feedback_id,
            feedback_question_option_id: option_id,
            feedback_question_option_text: option_text,
          });
          results.push(id);
        }
      }

      res
        .status(201)
        .json({ message: "Feedback submitted successfully", ids: results });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Error submitting feedback", error: error.message });
    }
  }
}

module.exports = FeedbackAnswerController;
