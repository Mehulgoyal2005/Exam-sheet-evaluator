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
 */
const extractQuestionsFromText = async (questionPaperText, modelAnswerText, defaultScheme) => {
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
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: 'You are a precise exam document analyzer. Always respond with valid JSON only. Never add explanatory text before or after the JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = completion.choices[0].message.content.trim();

    // Attempt 1: direct parse
    try {
      const parsed = JSON.parse(responseText);
      return validateAndReturnQuestions(parsed);
    } catch (directParseError) {
      // continue to attempt 2
    }

    // Attempt 2: regex to find JSON array
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateAndReturnQuestions(parsed);
      } catch (regexParseError) {
        // continue to throw
      }
    }

    throw new Error(
      `LLM returned malformed JSON. Raw response was:\n${responseText.substring(0, 500)}`
    );

  } catch (error) {
    if (error.message.includes('LLM returned malformed JSON')) {
      throw error;
    }
    throw new Error(`Groq API call failed for question extraction: ${error.message}`);
  }
};

/**
 * Validates that the parsed LLM response is a proper array of questions.
 */
const validateAndReturnQuestions = (parsed) => {
  if (!Array.isArray(parsed)) {
    throw new Error('LLM response is not an array');
  }
  if (parsed.length === 0) {
    throw new Error('LLM returned an empty array — no questions were extracted');
  }
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
 * Called once per question per student in the evaluation worker.
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

    try {
      const parsed = JSON.parse(responseText);
      return sanitizeEvaluation(parsed, marks);
    } catch (e) {
      // continue
    }

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
 * Ensures evaluation result has valid values within acceptable ranges.
 */
const sanitizeEvaluation = (evaluation, maxMarks) => {
  return {
    marksAwarded: Math.min(Math.max(Number(evaluation.marksAwarded) || 0, 0), maxMarks),
    correctParts: evaluation.correctParts || '',
    wrongParts: evaluation.wrongParts || '',
    feedback: evaluation.feedback || '',
  };
};

// ─── NEW FUNCTION: mapAnswersToQuestions ──────────────────
/**
 * Takes raw OCR text from a student's answer sheet and maps each portion
 * of text to the question it answers.
 *
 * The LLM reads the full OCR text and figures out which part of the text
 * corresponds to which question number. This is necessary because OCR gives
 * us one big blob of text — we need it split by question.
 *
 * @param {string} rawOcrText - Full extracted text from student's answer sheet
 * @param {Array} questions - Array of { questionNumber, questionText } objects
 * @returns {Promise<Object>} - e.g. { "1": "student answer for Q1", "2": "..." }
 */
const mapAnswersToQuestions = async (rawOcrText, questions) => {
  // Build a numbered list of questions so the LLM knows what to look for
  const questionList = questions
    .map((q) => `Question ${q.questionNumber}: ${q.questionText}`)
    .join('\n');

  const prompt = `You are analyzing a student's handwritten exam answer sheet. The text below was extracted via OCR from the answer sheet.

QUESTIONS IN THIS EXAM:
${questionList}

RAW OCR TEXT FROM STUDENT'S ANSWER SHEET:
${rawOcrText}

TASK:
Identify which part of the OCR text answers each question. Students typically write the question number before their answer (e.g. "Q1", "1.", "Ans 1", "Answer 1" etc).

Return ONLY a valid JSON object mapping question numbers as string keys to the student's answer text as string values.
If you cannot find an answer for a question, return an empty string for that key.
Do not include any explanation — return ONLY the JSON object.

REQUIRED FORMAT:
{
  "1": "student's full answer text for question 1 here",
  "2": "student's full answer text for question 2 here"
}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 3000,
      messages: [
        {
          role: 'system',
          content: 'You are a precise exam answer extractor. Always respond with valid JSON only. Never add text before or after the JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = completion.choices[0].message.content.trim();

    // Attempt 1: direct parse
    try {
      return JSON.parse(responseText);
    } catch (e) {
      // continue
    }

    // Attempt 2: extract JSON object from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // If LLM fails completely, return empty strings for all questions
    // so evaluation can continue — student just gets 0 for all questions
    console.warn('⚠️  mapAnswersToQuestions: LLM returned malformed JSON, defaulting to empty answers');
    const fallback = {};
    questions.forEach((q) => {
      fallback[String(q.questionNumber)] = '';
    });
    return fallback;

  } catch (error) {
    // On API error, return empty answers rather than failing the whole evaluation
    console.error(`❌ mapAnswersToQuestions failed: ${error.message}`);
    const fallback = {};
    questions.forEach((q) => {
      fallback[String(q.questionNumber)] = '';
    });
    return fallback;
  }
};

module.exports = {
  extractQuestionsFromText,
  evaluateStudentAnswer,
  mapAnswersToQuestions,
};