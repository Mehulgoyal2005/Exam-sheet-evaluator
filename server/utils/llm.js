// server/utils/llm.js

const Groq = require('groq-sdk');

// Initialize the Groq client with our API key from environment variables
// This client is reused for all LLM calls — we do not create a new one per request
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/**
 * Sends extracted text from both PDFs to the LLM and gets back a structured
 * array of questions with their answers, marks, and difficulty scheme.
 *
 * @param {string} questionPaperText - OCR-extracted text from the question paper PDF
 * @param {string} modelAnswerText - OCR-extracted text from the model answer sheet PDF
 * @param {string} defaultScheme - 'easy' | 'medium' | 'difficult' — used when LLM cannot determine scheme
 * @returns {Promise<Array>} - Array of { questionNumber, questionText, modelAnswer, marks, scheme }
 */
const extractQuestionsFromText = async (questionPaperText, modelAnswerText, defaultScheme) => {
  // Build the prompt — this is the instruction we send to the LLM
  // The more specific and structured the prompt, the more reliable the output
  const prompt = `You are an expert at analyzing exam documents. You will be given text extracted from a question paper and a model answer sheet. Your job is to map each question to its correct answer.

QUESTION PAPER TEXT:
${questionPaperText}

MODEL ANSWER SHEET TEXT:
${modelAnswerText}

INSTRUCTIONS:
1. Identify each question from the question paper
2. Find the corresponding answer from the model answer sheet
3. Extract the marks allocated to each question (look for numbers like "5 marks", "[5]", "(5 marks)" near each question)
4. If marks cannot be found for a question, assign a reasonable default based on the total content
5. Assign a difficulty scheme to each question based on its complexity:
   - easy: factual recall, definitions, simple calculations
   - medium: application of concepts, moderate explanation required
   - difficult: complex analysis, detailed derivation, multi-step reasoning
6. The default scheme if unsure is: ${defaultScheme}

IMPORTANT: Return ONLY a valid JSON array. No explanation text before or after. No markdown code blocks. No backticks. Just the raw JSON array starting with [ and ending with ]

JSON FORMAT:
[
  {
    "questionNumber": 1,
    "questionText": "full question text here",
    "modelAnswer": "full correct answer here",
    "marks": 5,
    "scheme": "medium"
  }
]`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      // temperature controls how creative/random the LLM's output is
      // 0.0 = fully deterministic and consistent, 1.0 = highly creative and varied
      // We use 0.1 (very low) because we need consistent structured JSON output —
      // higher temperature would make the LLM more likely to deviate from the format
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          // System message sets the LLM's persona and hard constraints
          content: 'You are a precise exam document analyzer. Always respond with valid JSON only. Never add explanatory text before or after the JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = completion.choices[0].message.content.trim();

    // Attempt 1: Try parsing the response directly as JSON
    // This works when the LLM behaves perfectly and returns raw JSON
    try {
      const parsed = JSON.parse(responseText);
      return validateAndReturnQuestions(parsed);
    } catch (directParseError) {
      // Direct parse failed — the LLM probably added some text around the JSON
    }

    // Attempt 2: Use regex to find the JSON array within the response text
    // This handles cases like: "Here is the result: [...]" or "[...]\nDone!"
    // The regex looks for content that starts with [ and ends with ]
    // We use a greedy match to capture the outermost array
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateAndReturnQuestions(parsed);
      } catch (regexParseError) {
        // Regex found something array-shaped but it was not valid JSON
      }
    }

    // Both attempts failed — throw with the raw response so we can debug
    throw new Error(
      `LLM returned malformed JSON. Raw response was:\n${responseText.substring(0, 500)}`
    );

  } catch (error) {
    // Re-throw with context so the controller can show a meaningful error
    if (error.message.includes('LLM returned malformed JSON')) {
      throw error;
    }
    throw new Error(`Groq API call failed for question extraction: ${error.message}`);
  }
};

/**
 * Validates that the parsed LLM response is a proper array of questions.
 * Throws a descriptive error if the structure is wrong.
 */
const validateAndReturnQuestions = (parsed) => {
  if (!Array.isArray(parsed)) {
    throw new Error('LLM response is not an array');
  }

  if (parsed.length === 0) {
    throw new Error('LLM returned an empty array — no questions were extracted');
  }

  // Validate each question has the required fields
  parsed.forEach((q, index) => {
    if (!q.questionNumber && q.questionNumber !== 0) {
      throw new Error(`Question at index ${index} is missing questionNumber`);
    }
    if (!q.questionText) {
      throw new Error(`Question ${q.questionNumber} is missing questionText`);
    }
    if (!q.modelAnswer) {
      throw new Error(`Question ${q.questionNumber} is missing modelAnswer`);
    }
    if (q.marks === undefined || q.marks === null) {
      throw new Error(`Question ${q.questionNumber} is missing marks`);
    }
    if (!q.scheme) {
      throw new Error(`Question ${q.questionNumber} is missing scheme`);
    }
  });

  return parsed;
};

/**
 * Evaluates one student answer against the model answer using the LLM.
 * Called once per question per student in the evaluation worker (Module 8).
 *
 * @param {string} questionText - The question text
 * @param {string} modelAnswer - The correct answer
 * @param {string} studentAnswerText - What the student wrote (may be empty)
 * @param {number} marks - Maximum marks for this question
 * @param {string} scheme - 'easy' | 'medium' | 'difficult'
 * @param {string} customPrompt - Professor's special instructions for the whole exam
 * @returns {Promise<{ marksAwarded, correctParts, wrongParts, feedback }>}
 */
const evaluateStudentAnswer = async (
  questionText,
  modelAnswer,
  studentAnswerText,
  marks,
  scheme,
  customPrompt
) => {
  const prompt = `You are an expert exam evaluator. Evaluate the student's answer against the model answer.

QUESTION: ${questionText}

MODEL ANSWER: ${modelAnswer}

STUDENT'S ANSWER: ${studentAnswerText || 'No answer provided'}

MAXIMUM MARKS: ${marks}

DIFFICULTY SCHEME: ${scheme}
${scheme === 'easy' ? '- Easy: Award marks generously if the student shows understanding of the concept, even with different wording' : ''}
${scheme === 'medium' ? '- Medium: Key concepts and important terms must be present. Award partial marks for partial understanding.' : ''}
${scheme === 'difficult' ? '- Difficult: Answer must closely match the model answer with correct terminology and complete explanation.' : ''}

ADDITIONAL PROFESSOR INSTRUCTIONS: ${customPrompt || 'None'}

IMPORTANT RULES:
1. marksAwarded cannot exceed ${marks}
2. marksAwarded cannot be negative
3. If student answer is empty or says "No answer provided", marksAwarded must be 0
4. Return ONLY valid JSON, no other text

Return this exact JSON format:
{
  "marksAwarded": <number>,
  "correctParts": "<what the student got right, empty string if nothing>",
  "wrongParts": "<what the student missed or got wrong, empty string if nothing>",
  "feedback": "<specific actionable feedback for the student>"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: 'You are a strict exam evaluator. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = completion.choices[0].message.content.trim();

    // Try direct parse first
    try {
      const parsed = JSON.parse(responseText);
      return sanitizeEvaluation(parsed, marks);
    } catch (e) {
      // Try extracting JSON object from text
    }

    // Try finding JSON object in response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return sanitizeEvaluation(parsed, marks);
    }

    throw new Error(`LLM returned malformed evaluation JSON: ${responseText.substring(0, 200)}`);

  } catch (error) {
    if (error.message.includes('LLM returned malformed')) {
      throw error;
    }
    throw new Error(`Groq API call failed for answer evaluation: ${error.message}`);
  }
};

/**
 * Ensures the evaluation result has valid values within acceptable ranges.
 * Protects against the LLM returning marks above the maximum or negative marks.
 */
const sanitizeEvaluation = (evaluation, maxMarks) => {
  return {
    marksAwarded: Math.min(Math.max(Number(evaluation.marksAwarded) || 0, 0), maxMarks),
    correctParts: evaluation.correctParts || '',
    wrongParts: evaluation.wrongParts || '',
    feedback: evaluation.feedback || '',
  };
};

module.exports = { extractQuestionsFromText, evaluateStudentAnswer };