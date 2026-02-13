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

  static async getSubmissions(req, res) {
    try {
      const { page, limit, search, active_course_id } = req.query;
      const filters = { page, limit, search, active_course_id };

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
}

module.exports = FeedbackAnswerController;
