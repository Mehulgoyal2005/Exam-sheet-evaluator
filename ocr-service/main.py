import os
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
# Read the path from .env and convert to absolute path
# Absolute paths are more reliable than relative paths
credentials_relative = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', './google-credentials.json')
credentials_absolute = str(Path(__file__).parent / credentials_relative.lstrip('./'))

if Path(credentials_absolute).exists():
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_absolute
    print(f"✅ Google Vision credentials loaded: {credentials_absolute}")
else:
    print(f"⚠️  WARNING: google-credentials.json not found at: {credentials_absolute}")
    print(f"   Place the JSON file inside the ocr-service folder")

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