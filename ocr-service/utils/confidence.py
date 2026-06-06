# confidence.py
# Helper functions for working with OCR confidence scores.
# These helpers are used by the router to decide whether to flag an answer
# for manual review on the Student Report page.

# Below this confidence level, the OCR text is unreliable enough that the
# professor should verify the answer manually before trusting the AI evaluation.
# Set to 0.50 for handwritten answer sheets — Google Vision on clear handwriting
# typically returns 0.75-0.85, so 0.50 catches only genuinely unreadable scans.
LOW_CONFIDENCE_THRESHOLD = 0.50


def is_low_confidence(confidence: float) -> bool:
    """
    Returns True if the OCR confidence is below 0.50.
    The evaluation worker calls this per question to set isLowConfidence
    on the Evaluation record.
    If any question on a submission is low confidence, the whole submission
    gets isFlagged = True and shows a yellow warning badge in the UI.
    """
    return confidence < LOW_CONFIDENCE_THRESHOLD


def calculate_overall_confidence(page_confidences: list) -> float:
    """
    Takes a list of per-page confidence floats and returns their average.
    We track per-page confidence because a multi-page answer sheet might
    have one clear page and one blurry page — averaging gives a fair score.
    Returns 0.0 if the list is empty to avoid division by zero.
    """
    if not page_confidences:
        return 0.0
    return sum(page_confidences) / len(page_confidences)