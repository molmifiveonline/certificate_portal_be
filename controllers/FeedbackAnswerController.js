const FeedbackAnswerDao = require("../dao/FeedbackAnswerDao");
const CandidateDao = require("../dao/candidateDao");

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
      const { candidateId, activeCourseId } = req.params;

      const answers = await FeedbackAnswerDao.getSubmissionDetails(
        candidateId,
        activeCourseId,
      );
      const candidate = await CandidateDao.getCandidateById(candidateId);

      res.json({
        candidate,
        active_course_id: activeCourseId,
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

      // Create PDF definition
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

      // Prepare feedback rows
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
            ans.type || "NA",
            answerText,
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
        },
        content: [
          {
            text: "Submitted Feedback Report",
            style: "header",
            alignment: "center",
            margin: [0, 0, 0, 20],
          },
          {
            columns: [
              {
                width: "50%",
                text: [
                  { text: "Candidate Details\n", style: "subheader" },
                  `Name: ${candidate.first_name} ${candidate.last_name}\n`,
                  `Email: ${candidate.email}\n`,
                  `Employee ID: ${candidate.employee_id || candidate.passport_no || "N/A"}\n`,
                  `Rank: ${candidate.rank || "N/A"}\n`,
                ],
              },
            ],
            margin: [0, 0, 0, 20],
          },
          {
            text: "Feedback Responses",
            style: "subheader",
            margin: [0, 0, 0, 10],
          },
          {
            table: {
              headerRows: 1,
              widths: ["auto", "*", "auto", "auto"],
              body: feedbackRows,
            },
            layout: "lightHorizontalLines",
          },
        ],
        styles: {
          header: {
            fontSize: 18,
            bold: true,
          },
          subheader: {
            fontSize: 14,
            bold: true,
            margin: [0, 5, 0, 5],
          },
          tableHeader: {
            bold: true,
            fillColor: "#f3f4f6",
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
            res
              .status(500)
              .json({
                message: "Error generating PDF buffer",
                error: err.message,
              });
          }
        });
    } catch (error) {
      console.error("PDF Generation Error:", error);
      res.status(500).json({
        message: "Error generating PDF",
        error: error.message,
      });
    }
  }
}

module.exports = FeedbackAnswerController;
