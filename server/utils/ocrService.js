// ocrService.js
// Bridge between the Node.js backend and the Python OCR microservice.
//
// Why this file exists:
// Node.js cannot run Python code directly. Whenever Node.js needs text
// extracted from a PDF, it calls this utility which sends the PDF file
// to the Python FastAPI service via HTTP and returns the result.
//
// This is called in two places:
// 1. Module 5 — when professor uploads question paper and model answer PDFs
// 2. Module 8 — when evaluating each student answer sheet
//
// Think of it like calling Groq or Cloudinary — an external service
// that does something our main server cannot do on its own.

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

/**
 * Sends a PDF file to the Python OCR service and returns extracted text.
 *
 * @param {string} filePath - Absolute path to the PDF file on disk
 * @returns {Promise<{
 *   extractedText: string,
 *   averageConfidence: number,
 *   pageConfidences: number[],
 *   pageCount: number
 * }>}
 */
const callOcrService = async (filePath) => {
  try {
    // ── Read the PDF file into memory ─────────────────────────────────────
    // We use synchronous readFileSync here because we need the complete
    // file buffer before building the FormData object.
    // There is no async advantage since we cannot proceed without the data.
    const fileBuffer = fs.readFileSync(filePath);

    // ── Build multipart form data ─────────────────────────────────────────
    // FormData is the same format a browser uses when submitting a file
    // upload form. It wraps the file bytes with boundary markers so the
    // receiving server knows where the file data starts and ends.
    // This is identical to what multer receives on the Express side.
    // The field name 'file' must match what FastAPI expects in ocr.py:
    // async def extract_text_from_pdf(file: UploadFile = File(...))
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: 'document.pdf',
      contentType: 'application/pdf',
    });

    const ocrServiceUrl = process.env.OCR_SERVICE_URL || 'http://localhost:8000';

    // ── Send PDF to Python service ────────────────────────────────────────
    // formData.getHeaders() gives us the Content-Type header with the
    // correct multipart boundary string — without this the Python service
    // cannot parse where the file data starts and ends in the request body.
    // Timeout is 3 minutes — large PDFs with many pages take time to
    // process through Google Vision API (each page is one API call).
    const response = await axios.post(
      `${ocrServiceUrl}/ocr/extract`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 180000,
        responseType: 'json',
      }
    );

    // ── Return the result ─────────────────────────────────────────────────
    // Python service returns:
    // {
    //   extractedText: string,      — combined text from all pages
    //   averageConfidence: number,  — overall confidence 0.0 to 1.0
    //   pageConfidences: number[],  — per page confidence scores
    //   pageCount: number           — total pages processed
    // }
    return response.data;

  } catch (error) {
    // ── Detailed error messages for easier debugging ───────────────────────
    const ocrServiceUrl = process.env.OCR_SERVICE_URL || 'http://localhost:8000';

    if (error.code === 'ECONNREFUSED') {
      // Python service is not running
      throw new Error(
        `OCR service is not running at ${ocrServiceUrl}. ` +
        `Start it with: cd ocr-service && uvicorn main:app --reload --port 8000`
      );
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      // PDF took too long to process
      throw new Error(
        `OCR service timed out after 3 minutes. ` +
        `The PDF may have too many pages or be too large. ` +
        `URL tried: ${ocrServiceUrl}`
      );
    }

    if (error.response) {
      // Python service responded but with an error status (4xx or 5xx)
      throw new Error(
        `OCR service returned error ${error.response.status}: ` +
        `${error.response.data?.detail || error.response.statusText}`
      );
    }

    // Unknown error
    throw new Error(
      `OCR service call failed: ${error.message}. ` +
      `Make sure Python service is running at ${ocrServiceUrl}`
    );
  }
};

module.exports = { callOcrService };