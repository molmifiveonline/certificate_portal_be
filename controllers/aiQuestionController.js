const axios = require("axios");

const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard", "mixed"]);
const ALLOWED_TEST_TYPES = new Set(["1", "2", "3"]);
const CORRECT_OPTIONS = new Set(["opt_a", "opt_b", "opt_c", "opt_d"]);

const normalizeString = (value) => String(value || "").trim();

const getOpenAIConfig = () => ({
  apiKey: normalizeString(process.env.OPENAI_API_KEY),
  baseUrl: normalizeString(process.env.OPENAI_BASE_URL),
  model: normalizeString(
    process.env.OPENAI_QUESTION_GENERATION_MODEL ||
      process.env.OPENAI_DEFAULT_MODEL,
  ),
  maxOutputTokens:
    Number(process.env.OPENAI_QUESTION_GENERATION_MAX_TOKENS) > 0
      ? Number(process.env.OPENAI_QUESTION_GENERATION_MAX_TOKENS)
      : 2500,
});

const buildResponsesUrl = (baseUrl) => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return normalizedBaseUrl.endsWith("/responses")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/responses`;
};

const buildQuestionSchema = (numberOfQuestions) => ({
  name: "ai_question_generation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["questions"],
    properties: {
      questions: {
        type: "array",
        minItems: numberOfQuestions,
        maxItems: numberOfQuestions,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "question",
            "option_a",
            "option_b",
            "option_c",
            "option_d",
            "correct_option",
          ],
          properties: {
            question: { type: "string" },
            option_a: { type: "string" },
            option_b: { type: "string" },
            option_c: { type: "string" },
            option_d: { type: "string" },
            correct_option: {
              type: "string",
              enum: ["opt_a", "opt_b", "opt_c", "opt_d"],
            },
          },
        },
      },
    },
  },
});

const buildPrompt = ({
  masterCourseName,
  topic,
  difficulty,
  numberOfQuestions,
  typeOfTest,
}) => {
  const testTypeLabels = typeOfTest
    .map((type) => {
      if (type === "1") return "Pre Course";
      if (type === "2") return "Post Course";
      return "Daily";
    })
    .join(", ");

  return [
    "Generate multiple-choice assessment questions for the Certificate Portal.",
    "",
    `Master Course: ${masterCourseName}`,
    `Topic: ${topic}`,
    `Type of Test: ${testTypeLabels}`,
    `Difficulty: ${difficulty}`,
    `Number of Questions: ${numberOfQuestions}`,
    "",
    "Requirements:",
    "- Return exactly the requested number of questions.",
    "- Every question must have exactly 4 answer options.",
    "- Use option_a, option_b, option_c, and option_d.",
    "- correct_option must be exactly one of opt_a, opt_b, opt_c, or opt_d.",
    "- Keep questions relevant to the course, topic, test type, and difficulty.",
    "- Avoid duplicate or near-duplicate questions.",
    "- Avoid ambiguous wording and avoid trick questions.",
    "- Do not include explanations or answer rationales.",
  ].join("\n");
};

const extractOutputText = (responseData) => {
  if (typeof responseData.output_text === "string") {
    return responseData.output_text;
  }

  const output = Array.isArray(responseData.output) ? responseData.output : [];
  const textParts = [];

  output.forEach((item) => {
    const content = Array.isArray(item.content) ? item.content : [];
    content.forEach((contentItem) => {
      if (
        contentItem.type === "output_text" &&
        typeof contentItem.text === "string"
      ) {
        textParts.push(contentItem.text);
      }
    });
  });

  return textParts.join("").trim();
};

const parseOpenAIQuestions = (responseData) => {
  const outputText = extractOutputText(responseData);
  if (!outputText) {
    return [];
  }

  const parsed = JSON.parse(outputText);
  return Array.isArray(parsed.questions) ? parsed.questions : [];
};

const validateGeneratedQuestions = (questions, numberOfQuestions) => {
  if (!Array.isArray(questions) || questions.length !== numberOfQuestions) {
    return false;
  }

  return questions.every((question) => {
    return (
      normalizeString(question.question) &&
      normalizeString(question.option_a) &&
      normalizeString(question.option_b) &&
      normalizeString(question.option_c) &&
      normalizeString(question.option_d) &&
      CORRECT_OPTIONS.has(normalizeString(question.correct_option))
    );
  });
};

exports.generateQuestions = async (req, res) => {
  try {
    const masterCourseId = normalizeString(req.body.master_course_id);
    const masterCourseName = normalizeString(req.body.master_course_name);
    const topic = normalizeString(req.body.topic);
    const difficulty = normalizeString(req.body.difficulty).toLowerCase();
    const numberOfQuestions = Number(req.body.number_of_questions);
    const typeOfTest = Array.isArray(req.body.type_of_test)
      ? req.body.type_of_test.map((type) => normalizeString(type))
      : [];

    if (!masterCourseId) {
      return res.status(400).json({
        success: false,
        message: "Master Course is required",
      });
    }

    if (!masterCourseName) {
      return res.status(400).json({
        success: false,
        message: "Master Course name is required",
      });
    }

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: "Topic is required",
      });
    }

    if (!ALLOWED_DIFFICULTIES.has(difficulty)) {
      return res.status(400).json({
        success: false,
        message: "Difficulty must be easy, medium, hard, or mixed",
      });
    }

    if (!Number.isInteger(numberOfQuestions) || numberOfQuestions < 1 || numberOfQuestions > 20) {
      return res.status(400).json({
        success: false,
        message: "Number of questions must be between 1 and 20",
      });
    }

    if (
      typeOfTest.length === 0 ||
      typeOfTest.some((type) => !ALLOWED_TEST_TYPES.has(type))
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one valid Type of Test is required",
      });
    }

    const openAIConfig = getOpenAIConfig();
    if (!openAIConfig.apiKey || !openAIConfig.baseUrl || !openAIConfig.model) {
      return res.status(503).json({
        success: false,
        message:
          "AI question generation is not configured. Please set OPENAI_API_KEY, OPENAI_BASE_URL, and OPENAI_QUESTION_GENERATION_MODEL.",
      });
    }

    let openAIResponse;
    try {
      openAIResponse = await axios.post(
        buildResponsesUrl(openAIConfig.baseUrl),
        {
          model: openAIConfig.model,
          input: buildPrompt({
            masterCourseName,
            topic,
            difficulty,
            numberOfQuestions,
            typeOfTest,
          }),
          max_output_tokens: openAIConfig.maxOutputTokens,
          store: false,
          text: {
            format: {
              type: "json_schema",
              ...buildQuestionSchema(numberOfQuestions),
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${openAIConfig.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        },
      );
    } catch (error) {
      console.error("OpenAI question generation request failed:", {
        status: error.response?.status,
        message: error.response?.data?.error?.message || error.message,
      });
      return res.status(502).json({
        success: false,
        message: "AI service request failed. Please try again.",
      });
    }

    let questions = [];
    try {
      questions = parseOpenAIQuestions(openAIResponse.data);
    } catch (error) {
      console.error("Failed to parse AI question response:", error.message);
    }

    if (!validateGeneratedQuestions(questions, numberOfQuestions)) {
      return res.status(502).json({
        success: false,
        message: "AI returned an invalid question format. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Questions generated successfully.",
      data: {
        source: "openai",
        master_course_id: masterCourseId,
        master_course_name: masterCourseName,
        type_of_test: typeOfTest,
        difficulty,
        questions,
      },
    });
  } catch (error) {
    console.error("Error generating AI questions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate questions",
    });
  }
};
