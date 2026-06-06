# ocr.py
# FastAPI router that exposes POST /ocr/extract.
# Node.js sends a PDF file to this endpoint via multipart HTTP POST.
# This router converts the PDF to images, preprocesses each page,
# extracts text, and returns everything as JSON.
# Similar to an Express controller — it receives the request and
# calls the service functions to do the actual work.

import os
import tempfile
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from pdf2image import convert_from_path

from services.preprocessor import preprocess_image
from services.extractor import extract_text_from_image
from utils.confidence import calculate_overall_confidence

logger = logging.getLogger(__name__)

# APIRouter is FastAPI's equivalent of express.Router()
# We register this router in main.py with a prefix of /ocr
# so this endpoint becomes POST /ocr/extract
router = APIRouter()


@router.post("/extract")
async def extract_text_from_pdf(file: UploadFile = File(...)):
    """
    Accepts a PDF file upload, processes every page through the OCR pipeline,
    and returns extracted text with confidence scores.

    UploadFile is FastAPI's file upload type — similar to how multer gives you
    req.file in Express. FastAPI handles the multipart parsing automatically.
    We just declare the parameter type and FastAPI does the rest.
    """

    # ── Validate file type ────────────────────────────────────────────────────
    is_pdf = (
        (file.filename and file.filename.lower().endswith('.pdf')) or
        file.content_type == 'application/pdf'
    )
    if not is_pdf:
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF files are accepted. Received: {file.content_type}"
        )

    # We create the temp file outside the try block so we can reference it
    # in the finally block for cleanup regardless of what happens
    temp_file_path = None

    try:
        # ── Step 1: Save uploaded file to a temp location ─────────────────────
        # pdf2image.convert_from_path needs a file path on disk — it cannot work
        # with file bytes held in memory. So we write the uploaded bytes to a
        # temporary file first.
        # tempfile.mkstemp creates a file and returns (file_descriptor, path).
        # The suffix='.pdf' is important — pdf2image checks the extension.
        fd, temp_file_path = tempfile.mkstemp(suffix='.pdf')

        # fd is a low-level file descriptor (integer), not a file object.
        # We wrap it with os.fdopen to get a normal writable file object.
        with os.fdopen(fd, 'wb') as temp_file:
            contents = await file.read()
            temp_file.write(contents)

        logger.info(f"Processing PDF: {file.filename}, size: {len(contents)} bytes")

        # ── Step 2: Convert PDF pages to images ───────────────────────────────
        # dpi=300 means 300 dots per inch — the industry standard for document
        # scanning quality. At 300 DPI an A4 page becomes roughly 2480x3508 pixels.
        # Lower DPI (like 150) is faster but misses fine details in handwriting.
        # Higher DPI (like 600) is unnecessarily slow with minimal accuracy gain.
        pages = convert_from_path(temp_file_path, dpi=300)
        logger.info(f"PDF has {len(pages)} page(s)")

        # ── Step 3: Process each page ─────────────────────────────────────────
        page_texts = []
        page_confidences = []

        for page_number, page_image in enumerate(pages, start=1):
            logger.info(f"Processing page {page_number}/{len(pages)}")

            # Run the OpenCV preprocessing pipeline on this page
            preprocessed = preprocess_image(page_image)

            # Run Tesseract OCR on the preprocessed image
            result = extract_text_from_image(preprocessed)

            page_texts.append(result['text'])
            page_confidences.append(result['confidence'])

            logger.info(
                f"Page {page_number} confidence: {result['confidence']:.2f}, "
                f"text length: {len(result['text'])} chars"
            )

        # ── Step 4: Combine results ───────────────────────────────────────────
        # Join page texts with a clear separator so downstream code (the LLM)
        # can see where one page ends and the next begins if needed
        combined_text = '\n\n--- PAGE BREAK ---\n\n'.join(page_texts)

        overall_confidence = calculate_overall_confidence(page_confidences)

        logger.info(
            f"Extraction complete. Overall confidence: {overall_confidence:.2f}, "
            f"Total text length: {len(combined_text)} chars"
        )

        return {
            "extractedText": combined_text,
            "averageConfidence": round(overall_confidence, 4),
            "pageConfidences": page_confidences,
            "pageCount": len(pages)
        }

    except HTTPException:
        # Re-raise HTTP exceptions (like our 400 validation above) unchanged
        raise

    except Exception as e:
        logger.error(f"PDF processing failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process PDF: {str(e)}"
        )

    finally:
        # ── Step 5: Always clean up the temp file ─────────────────────────────
        # The finally block runs whether the request succeeded or failed.
        # Without this, temp files would pile up on disk over time.
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception as cleanup_error:
                logger.warning(f"Could not delete temp file {temp_file_path}: {cleanup_error}")