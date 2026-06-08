// server/middleware/upload.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const TEMP_FOLDER = path.join(__dirname, '..', 'temp');

// Create temp folder at module load time so it always exists before first upload
if (!fs.existsSync(TEMP_FOLDER)) {
  fs.mkdirSync(TEMP_FOLDER, { recursive: true });
  console.log(`📁 Created temp folder: ${TEMP_FOLDER}`);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_FOLDER);
  },
  filename: (req, file, cb) => {
    // Prepend timestamp to avoid filename collisions between concurrent uploads
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  },
});

// File filter for PDF only — used by uploadSingle and uploadDouble
const pdfOnlyFilter = (req, file, cb) => {
  const isPdf = file.mimetype === 'application/pdf' ||
    file.originalname.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// File filter for PDF and ZIP — used by uploadMultiple
// Students may upload individual PDFs or a ZIP containing PDFs
// We accept both here and sort them out in the controller
const pdfAndZipFilter = (req, file, cb) => {
  const name = file.originalname.toLowerCase();
  const mime = file.mimetype;

  const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
  const isZip =
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/octet-stream' ||
    name.endsWith('.zip');

  if (isPdf || isZip) {
    cb(null, true);
  } else {
    // Skip silently instead of throwing — don't let one bad file block the rest
    cb(null, false);
  }
};

// For single PDF uploads
const uploadSingle = multer({
  storage,
  fileFilter: pdfOnlyFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
}).single('file');

// For two PDFs with different field names (question paper + model answer)
const uploadDouble = multer({
  storage,
  fileFilter: pdfOnlyFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
}).fields([
  { name: 'questionPaper', maxCount: 1 },
  { name: 'modelAnswer', maxCount: 1 },
]);

// For multiple student answer sheets — accepts up to 100 PDFs or one ZIP
// Uses pdfAndZipFilter so ZIP files are accepted too
const uploadMultiple = multer({
  storage,
  fileFilter: pdfAndZipFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for ZIP files
}).array('sheets', 100);

module.exports = { uploadSingle, uploadDouble, uploadMultiple };