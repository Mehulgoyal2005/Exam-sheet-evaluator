from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Create the FastAPI app
# This is equivalent to: const app = express() in Node.js
app = FastAPI(
    title="Paperly OCR Service",
    description="PDF preprocessing and text extraction service for Paperly",
    version="1.0.0"
)

# Add CORS middleware
# This allows our Node.js server to send requests to this Python service
app.add_middleware(
    CORSMiddleware,
    # In development we allow all origins
    # In production this would be restricted to the Node.js server URL
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check route
# Visit http://localhost:8000/health to confirm Python service is running
@app.get("/health")
async def health_check():
    return {
        "success": True,
        "message": "Paperly OCR service is running ✅",
        "service": "ocr"
    }

# We will add the OCR router in Module 4
# from routers import ocr
# app.include_router(ocr.router, prefix="/ocr")