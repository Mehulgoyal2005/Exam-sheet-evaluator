# extractor.py
# Extracts text from a preprocessed PIL Image using Google Cloud Vision API.
# Google Vision achieves 90-95% accuracy on handwritten text vs Tesseract's 20-40%.
# preprocessor.py passes the original color image directly — Google Vision
# performs its own internal preprocessing using deep learning models.

import io
import logging
from PIL import Image

logger = logging.getLogger(__name__)


def _get_vision_client():
    """
    Creates Google Vision client fresh each call.
    Lazy initialization ensures credentials are set in main.py
    before the Vision SDK initializes its internal auth state.
    """
    try:
        from google.cloud import vision
        client = vision.ImageAnnotatorClient()
        return client, vision
    except Exception as e:
        logger.error(f"Failed to create Google Vision client: {str(e)}")
        logger.error("Make sure google-credentials.json is in the ocr-service folder")
        return None, None


def extract_text_from_image(pil_image: Image.Image) -> dict:
    """
    Sends a PIL Image to Google Cloud Vision API.
    Returns { 'text': str, 'confidence': float }

    Uses document_text_detection — optimized for dense documents like
    answer sheets. Understands paragraphs, line breaks, and handwriting
    better than generic text_detection mode.
    """

    # ── Initialize client ─────────────────────────────────────────────────────
    vision_client, vision = _get_vision_client()

    if vision_client is None:
        logger.error("Google Vision client unavailable")
        return {'text': '', 'confidence': 0.0}

    try:
        # ── Convert PIL Image to PNG bytes ────────────────────────────────────
        # Google Vision needs raw bytes — not a PIL object.
        # BytesIO is an in-memory buffer — no file written to disk.
        # PNG is lossless — no quality loss unlike JPEG.
        img_byte_buffer = io.BytesIO()
        pil_image.save(img_byte_buffer, format='PNG')
        img_bytes = img_byte_buffer.getvalue()

        logger.info(
            f"Sending to Google Vision: {len(img_bytes)} bytes, "
            f"size: {pil_image.size[0]}x{pil_image.size[1]}"
        )

        # ── Create Vision Image object ────────────────────────────────────────
        image = vision.Image(content=img_bytes)

        # ── Call document_text_detection ──────────────────────────────────────
        # document_text_detection = dense text in documents (answer sheets)
        # text_detection = sparse text in photos (signs, labels)
        response = vision_client.document_text_detection(image=image)

        # ── Check for API errors ──────────────────────────────────────────────
        if response.error.message:
            logger.error(f"Google Vision API error: {response.error.message}")
            return {'text': '', 'confidence': 0.0}

        # ── Check if text was found ───────────────────────────────────────────
        if not response.full_text_annotation:
            logger.warning("No text found — page may be blank")
            return {'text': '', 'confidence': 0.0}

        # ── Extract full text ─────────────────────────────────────────────────
        full_text = response.full_text_annotation.text

        # ── Calculate confidence ──────────────────────────────────────────────
        # Navigate pages → blocks → paragraphs → words → confidence
        # Google Vision gives 0.0-1.0 float per word directly
        word_confidences = []
        for page in response.full_text_annotation.pages:
            for block in page.blocks:
                for paragraph in block.paragraphs:
                    for word in paragraph.words:
                        if word.confidence > 0:
                            word_confidences.append(word.confidence)

        if word_confidences:
            average_confidence = sum(word_confidences) / len(word_confidences)
        else:
            # Fallback to block confidence
            for page in response.full_text_annotation.pages:
                for block in page.blocks:
                    if block.confidence > 0:
                        word_confidences.append(block.confidence)
            average_confidence = (
                sum(word_confidences) / len(word_confidences)
                if word_confidences else 0.0
            )

        # ── Clean up text ─────────────────────────────────────────────────────
        # Collapse multiple consecutive blank lines into one
        lines = full_text.splitlines()
        cleaned_lines = []
        prev_blank = False
        for line in lines:
            is_blank = not line.strip()
            if is_blank and prev_blank:
                continue
            cleaned_lines.append(line)
            prev_blank = is_blank
        cleaned_text = '\n'.join(cleaned_lines).strip()

        logger.info(
            f"Extracted {len(cleaned_text)} chars, "
            f"confidence: {average_confidence:.3f}, "
            f"words: {len(word_confidences)}"
        )

        return {
            'text': cleaned_text,
            'confidence': round(average_confidence, 4)
        }

    except Exception as e:
        logger.error(f"Google Vision extraction failed: {str(e)}")
        return {'text': '', 'confidence': 0.0}