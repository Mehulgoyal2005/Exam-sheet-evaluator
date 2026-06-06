
# # preprocessor.py
# # Takes a raw PIL Image and cleans it for Tesseract OCR.
# # Key insight: bleed-through loses its color when seen through paper.
# # Real ink (blue/black/red) retains color. We use this to separate them.

# import cv2
# import numpy as np
# from PIL import Image
# import logging

# logger = logging.getLogger(__name__)


# def preprocess_image(pil_image: Image.Image) -> Image.Image:
#     """
#     Accepts a PIL Image, applies preprocessing, returns a cleaned PIL Image
#     ready for Tesseract. Falls back to original image if anything fails.
#     """
#     try:
#         # Convert PIL to numpy array — keep RGB, do NOT convert to BGR yet
#         # We need the original RGB colors for ink isolation
#         img_rgb = np.array(pil_image)

#         # Ensure we have a 3-channel color image
#         if len(img_rgb.shape) == 2:
#             # Already grayscale — skip color-based isolation
#             gray = img_rgb
#         else:
#             # Step 1: Isolate real ink using color information
#             # This is the key step that handles bleed-through
#             gray = _isolate_ink_by_color(img_rgb)

#         # Step 2: Deskew
#         deskewed = _deskew(gray)

#         # Step 3: Binarize with Otsu thresholding
#         # Otsu automatically finds the best threshold value for this specific image
#         # It works better than adaptive thresholding when the image is already clean
#         _, binarized = cv2.threshold(
#             deskewed,
#             0,      # threshold value ignored when using Otsu
#             255,
#             cv2.THRESH_BINARY + cv2.THRESH_OTSU
#         )

#         # Step 4: Light denoise only — handwriting strokes are thin,
#         # aggressive denoising blurs them into unreadable blobs
#         denoised = cv2.fastNlMeansDenoising(binarized, h=7)

#         result_image = Image.fromarray(denoised)
#         return result_image

#     except Exception as e:
#         logger.error(f"Preprocessing failed: {str(e)}. Returning original.")
#         return pil_image


# def _isolate_ink_by_color(img_rgb: np.ndarray) -> np.ndarray:
#     """
#     Separates real ink from bleed-through using color properties.

#     Why this works:
#     When ink on the back of a page bleeds through thin paper, the paper
#     fibers scatter and absorb the color. What you see is a faded gray ghost
#     with almost no color saturation — like a photocopy of a photocopy.

#     Real ink on the front keeps its original color:
#     - Blue ballpoint pen:  high blue channel, low red channel
#     - Black ink:           all channels low (dark)
#     - Red ink:             high red channel, low blue channel
#     - Pencil:              all channels medium-low, gray

#     Bleed-through:         all channels similar, medium value (gray/brown)

#     We convert to HSV color space and look at Saturation.
#     Real colored ink has HIGH saturation.
#     Bleed-through gray has LOW saturation.
#     We combine this with a simple darkness check to catch black ink too.
#     """
#     try:
#         # Convert to HSV — Hue/Saturation/Value
#         # HSV separates color (Hue, Saturation) from brightness (Value)
#         # This makes it much easier to detect "is this pixel colored ink?"
#         img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
#         hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

#         # Extract the three channels
#         hue = hsv[:, :, 0]        # color type (0-180 in OpenCV)
#         saturation = hsv[:, :, 1]  # color intensity (0=gray, 255=vivid)
#         value = hsv[:, :, 2]       # brightness (0=black, 255=white)

#         # --- Mask 1: Colored ink (blue pen, red pen) ---
#         # High saturation means real colored ink, not gray bleed-through
#         # Threshold 40 catches even faded ink while rejecting gray bleed-through
#         colored_ink_mask = saturation > 40

#         # --- Mask 2: Dark pixels (black ink, pencil, dark bleed-through edges) ---
#         # Very dark pixels are real ink regardless of color
#         # Value < 100 means the pixel is quite dark (0=black, 255=white)
#         dark_ink_mask = value < 100

#         # --- Mask 3: Exclude very bright pixels (paper background) ---
#         # Paper is bright — value > 200 is background, not ink
#         not_background = value < 200

#         # Combine: a pixel is real ink if it is:
#         # (colored OR very dark) AND not background
#         real_ink_mask = (colored_ink_mask | dark_ink_mask) & not_background

#         # Convert original to grayscale for the output
#         gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

#         # Create clean white image
#         result = np.ones_like(gray) * 255

#         # Paste only the real ink pixels into the white image
#         # Everything else (bleed-through, background) becomes white
#         result[real_ink_mask] = gray[real_ink_mask]

#         return result

#     except Exception as e:
#         logger.error(f"Color ink isolation failed: {str(e)}. Using grayscale.")
#         img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
#         return cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)


# def _deskew(gray_image: np.ndarray) -> np.ndarray:
#     """
#     Straightens a tilted scanned page using Hough line detection.
#     Uses median angle to avoid being thrown off by diagonal arrows or signatures.
#     """
#     try:
#         edges = cv2.Canny(gray_image, 50, 150, apertureSize=3)
#         lines = cv2.HoughLinesP(
#             edges,
#             rho=1,
#             theta=np.pi / 180,
#             threshold=100,
#             minLineLength=100,
#             maxLineGap=10
#         )

#         if lines is None:
#             return gray_image

#         angles = []
#         for line in lines:
#             x1, y1, x2, y2 = line[0]
#             if x2 - x1 != 0:
#                 angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
#                 angles.append(angle)

#         if not angles:
#             return gray_image

#         median_angle = np.median(angles)

#         if median_angle > 45:
#             median_angle -= 90
#         elif median_angle < -45:
#             median_angle += 90

#         if abs(median_angle) < 0.5:
#             return gray_image

#         h, w = gray_image.shape
#         center = (w // 2, h // 2)
#         rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, scale=1.0)
#         rotated = cv2.warpAffine(
#             gray_image,
#             rotation_matrix,
#             (w, h),
#             flags=cv2.INTER_LINEAR,
#             borderMode=cv2.BORDER_REPLICATE
#         )

#         return rotated

#     except Exception as e:
#         logger.error(f"Deskew failed: {str(e)}. Returning original.")
#         return gray_image














# preprocessor.py
# When using Google Cloud Vision API, preprocessing is NOT needed.
# Google Vision's deep learning models handle:
# - Bleed-through automatically
# - Skew correction automatically  
# - Color normalization automatically
# - Noise removal automatically
# Sending the original color image gives BETTER results than preprocessed images.
# Our OpenCV preprocessing was designed for Tesseract which needs clean B&W images.
# Google Vision is the opposite — it prefers rich color information.

from PIL import Image
import logging

logger = logging.getLogger(__name__)


def preprocess_image(pil_image: Image.Image) -> Image.Image:
    """
    When using Google Vision, we return the original image unchanged.
    Google Vision's neural networks perform their own internal preprocessing
    that is far more sophisticated than our OpenCV pipeline.
    Sending a color image gives Google Vision maximum information to work with.
    """
    logger.info(
        f"Passing original image to Google Vision: "
        f"{pil_image.size[0]}x{pil_image.size[1]}, mode: {pil_image.mode}"
    )
    return pil_image