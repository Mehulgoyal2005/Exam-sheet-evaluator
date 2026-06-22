# import os
# from pathlib import Path
# from dotenv import load_dotenv
# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from routers import ocr

# # ── Load .env file ────────────────────────────────────────────────────────────
# # Same as require('dotenv').config() in Node.js
# # Must happen first before anything else
# env_path = Path(__file__).parent / '.env'
# load_dotenv(dotenv_path=env_path)

# # ── Set Google Vision credentials ─────────────────────────────────────────────
# # Read the path from .env and convert to absolute path
# # Absolute paths are more reliable than relative paths
# credentials_relative = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', './google-credentials.json')
# credentials_absolute = str(Path(__file__).parent / credentials_relative.lstrip('./'))

# if Path(credentials_absolute).exists():
#     os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_absolute
#     print(f"✅ Google Vision credentials loaded: {credentials_absolute}")
# else:
#     print(f"⚠️  WARNING: google-credentials.json not found at: {credentials_absolute}")
#     print(f"   Place the JSON file inside the ocr-service folder")

# # ── Create FastAPI app ────────────────────────────────────────────────────────
# app = FastAPI(
#     title="Paperly OCR Service",
#     description="PDF preprocessing and text extraction service for Paperly",
#     version="2.0.0"
# )

# # ── CORS middleware ───────────────────────────────────────────────────────────
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # ── Health check ──────────────────────────────────────────────────────────────
# @app.get("/health")
# async def health_check():
#     credentials_ok = Path(credentials_absolute).exists()
#     return {
#         "success": True,
#         "message": "Paperly OCR service is running ✅",
#         "service": "ocr",
#         "google_vision_credentials": "loaded ✅" if credentials_ok else "missing ⚠️",
#         "version": "2.0.0 — Google Cloud Vision"
#     }

# # ── Register OCR router ───────────────────────────────────────────────────────
# app.include_router(ocr.router, prefix="/ocr", tags=["OCR"])


import os
import json
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ocr

# ── Load .env file ────────────────────────────────────────────────────────────
# Same as require('dotenv').config() in Node.js
# Must happen first before anything else
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# ── Set Google Vision credentials ─────────────────────────────────────────────
# TWO WAYS this works:
#
# 1. LOCAL (your laptop): a real file named google-credentials.json sits in the
#    ocr-service folder, and GOOGLE_APPLICATION_CREDENTIALS points to it.
#
# 2. CLOUD (Render): there is no file in the repo (it's a secret, never committed).
#    Instead, we paste the ENTIRE contents of that JSON into an environment
#    variable called GOOGLE_CREDENTIALS_JSON. On startup we write it to a file
#    and point Google's library at that file. This is the standard way to handle
#    secret credential files on cloud hosts that don't let you upload files.
credentials_absolute = str(Path(__file__).parent / 'google-credentials.json')

# Cloud case first: if the JSON content was provided via env variable, write it to disk
google_creds_json = os.getenv('GOOGLE_CREDENTIALS_JSON')
if google_creds_json:
    try:
        # Validate it's real JSON before writing (catches copy-paste errors early)
        json.loads(google_creds_json)
        with open(credentials_absolute, 'w') as f:
            f.write(google_creds_json)
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_absolute
        print(f"✅ Google Vision credentials written from environment variable")
    except json.JSONDecodeError as e:
        print(f"❌ GOOGLE_CREDENTIALS_JSON is not valid JSON: {e}")
elif Path(credentials_absolute).exists():
    # Local case: the file already exists on disk
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_absolute
    print(f"✅ Google Vision credentials loaded: {credentials_absolute}")
else:
    print(f"⚠️  WARNING: No Google credentials found.")
    print(f"   Local: place google-credentials.json inside the ocr-service folder")
    print(f"   Cloud: set the GOOGLE_CREDENTIALS_JSON environment variable")

# ── Create FastAPI app ────────────────────────────────────────────────────────
app = FastAPI(
    title="Paperly OCR Service",
    description="PDF preprocessing and text extraction service for Paperly",
    version="2.0.0"
)

# ── CORS middleware ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    credentials_ok = Path(credentials_absolute).exists()
    return {
        "success": True,
        "message": "Paperly OCR service is running ✅",
        "service": "ocr",
        "google_vision_credentials": "loaded ✅" if credentials_ok else "missing ⚠️",
        "version": "2.0.0 — Google Cloud Vision"
    }

# ── Register OCR router ───────────────────────────────────────────────────────
app.include_router(ocr.router, prefix="/ocr", tags=["OCR"])
