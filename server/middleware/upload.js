// server/middleware/upload.js

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Temp folder where uploaded files are saved before we process them
// We use __dirname to build an absolute path — relative paths can break
// depending on which directory Node.js is started from
const TEMP_FOLDER = path.join(__dirname, '..', 'temp');

// Create the temp folder immediately when this module is loaded
// We do this at module load time (not inside a request handler) so the folder
// always exists before the first upload request ever arrives
// recursive: true means it will not throw an error if the folder already exists
if (!fs.existsSync(TEMP_FOLDER)) {
  fs.mkdirSync(TEMP_FOLDER, { recursive: true });
  console.log(`📁 Created temp folder: ${TEMP_FOLDER}`);
}

// Configure where and how multer saves uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // cb(error, destination) — null means no error
    cb(null, TEMP_FOLDER);
  },
  filename: (req, file, cb) => {
    // A naming collision happens when two different files have the same name
    // and one overwrites the other. For example, two professors both uploading
    // "question-paper.pdf" at the same time would collide without this prefix.
    // Prepending Date.now() (milliseconds since 1970) makes every filename unique.
    const uniqueFilename = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueFilename);
  },
});

// File filter — only accept PDF files
// If a professor accidentally uploads a Word doc or image, we reject it here
// with a clear error message instead of letting it fail silently later
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Only PDF files are allowed'), false); // Reject the file
  }
};

// Base multer configuration shared by all three variants below
const multerConfig = multer({
  storage,
  fileFilter,
  limits: {
    // 50MB limit — large scanned PDFs can be big but anything over 50MB
    // is almost certainly an error (wrong file type or uncompressed scan)
    fileSize: 50 * 1024 * 1024,
  },
});

// For uploading a single file with field name 'file'
// Used when sending one PDF to the OCR service or similar single-file scenarios
const uploadSingle = multerConfig.single('file');

// For uploading two files with different field names simultaneously
// 'questionPaper' and 'modelAnswer' are the form field names the frontend must use
// This is the one used in this module (Module 5)
const uploadDouble = multerConfig.fields([
  { name: 'questionPaper', maxCount: 1 },
  { name: 'modelAnswer', maxCount: 1 },
]);

// For uploading multiple student answer sheets at once
// Accepts up to 100 PDFs under the field name 'sheets'
// This will be used in Module 7 when the professor uploads student answer sheets
const uploadMultiple = multerConfig.array('sheets', 100);

module.exports = { uploadSingle, uploadDouble, uploadMultiple };