<div align="center">

# 📝 Eval AI

### AI-Powered Automated Answer Sheet Evaluation

*Upload handwritten exam sheets. Let AI grade them. Edit, review, and export — in minutes, not hours.*

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel)](https://exam-sheet-evaluator.vercel.app)
[![GitHub](https://img.shields.io/badge/Source-GitHub-181717?style=for-the-badge&logo=github)](https://github.com/Mehulgoyal2005/Exam-sheet-evaluator)

![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Google Cloud Vision](https://img.shields.io/badge/Cloud_Vision-4285F4?style=flat&logo=googlecloud&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-47A248?style=flat&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Upstash_Redis-DC382D?style=flat&logo=redis&logoColor=white)

</div>

---

## 📖 Overview

**Eval AI** is a full-stack platform that automates the grading of handwritten and typed exam answer sheets. A professor creates an exam, uploads the question paper and a model answer key, and the system extracts everything with OCR, maps each question to its answer using an LLM, and then grades every student's sheet against the model answer according to a configurable difficulty scheme.

The professor stays fully in control: every AI-generated mark is reviewable and editable on screen before anything is exported. Final results can be downloaded as per-student Word reports, a bundled ZIP of all reports, or a single Excel mark sheet.

> **Built as a final-year B.Tech project at MNIT Jaipur.** Professor-only — there is no student login or student portal by design.

---

## ✨ Key Features

- **Exam creation & setup** — Create an exam with title, subject, date, total marks, and a default marking scheme.
- **Dual-PDF ingestion** — Upload a question paper PDF and a model answer PDF (handwritten or typed).
- **Dedicated OCR microservice** — A separate Python/FastAPI service converts PDF pages to images (pdf2image at 300 DPI) and extracts handwritten text with **Google Cloud Vision API** (`document_text_detection`), returning per-page confidence scores. Vision's deep-learning models handle deskew, denoise, and color normalization internally, achieving far higher accuracy on handwriting than classical OCR.
- **LLM question mapping** — Groq (Llama 3.1) reads the OCR'd text and returns a structured list of questions with model answers, marks, and per-question difficulty.
- **Human-in-the-loop verification** — The professor reviews and edits the extracted mapping in a table before confirming.
- **Single custom prompt per exam** — One free-text instruction field lets the professor define special grading rules for the whole paper.
- **Bulk student upload** — Drop a ZIP of PDFs or multiple individual PDFs. Each file is named by roll number (e.g. `2021CSE045.pdf`), which is parsed automatically.
- **Asynchronous evaluation** — Every sheet is processed through a Bull + Redis job queue, so large batches never time out.
- **Real-time progress** — Live per-student status (Queued → Processing → Completed / Failed) streamed over Socket.IO.
- **Confidence flagging** — Any answer with OCR confidence below `0.70` is flagged so the professor knows where to double-check.
- **Editable reports** — Marks can be overridden directly on the student report screen; totals recalculate instantly and persist to the database.
- **Rich exports** — Download individual DOCX reports, a ZIP of all reports, or an Excel sheet of roll numbers mapped to marks.
- **Analytics dashboard** — Class average, highest/lowest scores, a marks-distribution chart, and a question-wise performance chart (Recharts).

---

## 🏗️ Architecture

Eval AI runs as three application services backed by managed MongoDB Atlas and Upstash Redis. The Node.js backend orchestrates everything; the Python service is isolated specifically for document handling, where pdf2image and the Google Cloud Vision SDK provide a clean, reliable path from scanned PDF to high-accuracy text.

```
                        ┌──────────────────────────────┐
                        │      React Frontend (Vite)    │
                        │  Tailwind · Recharts · Socket │
                        └───────────────┬──────────────┘
                                        │  REST + WebSocket
                                        ▼
        ┌───────────────────────────────────────────────────────────┐
        │                  Node.js Backend (Express)                 │
        │   Auth · Exams · Questions · Submissions · Analytics       │
        │   Bull queue producer · Socket.IO server · Cloudinary      │
        └───┬─────────────────┬───────────────────┬─────────────────┘
            │                 │                   │
            ▼                 ▼                   ▼
   ┌────────────────┐  ┌──────────────┐   ┌────────────────────┐
   │ MongoDB Atlas  │  │ Upstash Redis│   │  Python OCR Service │
   │  (Mongoose)    │  │  (Bull jobs) │   │  FastAPI · pdf2image│
   └────────────────┘  └──────┬───────┘   │  Google Cloud Vision│
                              │           └─────────┬───────────┘
                              ▼                     │
                   ┌────────────────────┐           │ HTTP multipart
                   │ Evaluation Worker  │───────────┘
                   │ OCR → LLM map →    │
                   │ LLM grade → DOCX   │──────► Groq API (Llama 3.1)
                   └────────────────────┘
```

### How the two main flows work

**1. Answer-key processing**
The backend uploads both PDFs to Cloudinary, sends them to the Python OCR service, feeds the extracted text to Groq, and returns a structured question→answer→marks→difficulty mapping for the professor to verify.

**2. Student-sheet evaluation**
Each uploaded sheet becomes a queued Bull job. The worker downloads the PDF, OCRs it, asks Groq to map the raw text to question numbers, then asks Groq to grade each answer against the model answer using the question's difficulty and the exam's custom prompt. It saves an `Evaluation` per question, aggregates the total, generates a DOCX report, and emits a live Socket.IO update.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React, React Router v6, Tailwind CSS, Recharts, Axios, Socket.io-client, react-dropzone, react-hot-toast |
| **Backend** | Node.js, Express, Mongoose, JWT, bcryptjs, Multer, Bull, ioredis, Socket.IO, Cloudinary, docx, ExcelJS, archiver, adm-zip |
| **OCR Service** | Python, FastAPI, Uvicorn, Google Cloud Vision API, pdf2image, Pillow, OpenCV |
| **LLM** | Groq API — `llama-3.1` |
| **Data & Storage** | MongoDB Atlas (database), Upstash Redis (queue), Cloudinary (file storage) |
| **Deployment** | Render (Node + Python services), Vercel (frontend) |

---

## 📁 Project Structure

```
exam-sheet-evaluator/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── components/     # Layout, ExamCard, QuestionRow, ProgressBar, ...
│       ├── pages/          # Login, CreateExam, ExamSetup, UploadSheets,
│       │                   # ExamResults, StudentReport, PreviousExams
│       ├── context/        # AuthContext
│       ├── hooks/          # useSocket
│       └── utils/          # configured Axios instance
│
├── server/                 # Node.js backend (MVC)
│   ├── config/             # db.js, cloudinary.js
│   ├── controllers/        # auth, exam, question, submission, analytics
│   ├── middleware/         # auth (JWT), upload (multer), errorHandler
│   ├── models/             # User, Exam, Question, Submission, Evaluation
│   ├── routes/             # auth, exams, questions, submissions, analytics
│   ├── workers/            # evaluationWorker.js (Bull consumer)
│   ├── utils/              # ocrService, llm, reportGenerator, excelGenerator
│   └── index.js
│
└── ocr-service/            # Python FastAPI OCR microservice
    ├── routers/            # ocr.py  →  POST /ocr/extract
    ├── services/           # preprocessor.py, extractor.py (Google Vision)
    ├── utils/              # confidence.py
    └── main.py
```

---

## 🗄️ Data Model

| Collection | Purpose |
|-----------|---------|
| **User** | Professor accounts (name, email, passwordHash, role) |
| **Exam** | Exam metadata, paper URLs, custom prompt, status (`setup → ready → processing → completed`) |
| **Question** | Per-question text, model answer, marks, difficulty scheme |
| **Submission** | One per student sheet — roll number, totals, percentage, status, `isFlagged` |
| **Evaluation** | One per question per student — student answer, marks awarded, AI feedback, OCR confidence, override fields |

---

## 🔌 API Reference

All routes except `POST /api/auth/login` require an `Authorization: Bearer <token>` header.

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Log in, returns JWT |
| `GET`  | `/api/auth/me` | Get current professor |

### Exams
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST`   | `/api/exams` | Create an exam |
| `GET`    | `/api/exams` | List exams (newest first) |
| `GET`    | `/api/exams/:id` | Get one exam |
| `DELETE` | `/api/exams/:id` | Delete an exam |
| `POST`   | `/api/exams/:examId/process-papers` | Upload papers → OCR → LLM → extracted questions |

### Questions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/exams/:examId/questions` | Save confirmed mapping (sets status `ready`) |
| `GET`  | `/api/exams/:examId/questions` | List questions |

### Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST`  | `/api/exams/:examId/submissions/upload` | Upload ZIP / PDFs, queue jobs |
| `GET`   | `/api/exams/:examId/submissions` | List submissions (roll number asc) |
| `GET`   | `/api/exams/:examId/submissions/:id` | Submission + evaluations |
| `PATCH` | `/api/exams/:examId/submissions/:id/override-question` | Override a question's mark |
| `GET`   | `/api/exams/:examId/submissions/:id/download-report` | Download student DOCX |
| `GET`   | `/api/exams/:examId/download-excel` | Download Excel mark sheet |
| `GET`   | `/api/exams/:examId/download-all-reports` | Download all reports as ZIP |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/exams/:examId/analytics` | Stats + chart data |

### OCR Microservice
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ocr/extract` | Multipart PDF → `{ extractedText, averageConfidence, pageConfidences }` |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 18+** and **Python 3.11+**
- **`poppler`** installed locally (required by pdf2image for PDF → image conversion)
- A free **[MongoDB Atlas](https://www.mongodb.com/atlas)** cluster (database)
- A free **[Upstash Redis](https://upstash.com)** database (Bull queue)
- Free accounts for **[Cloudinary](https://cloudinary.com)** (file storage) and **[Groq](https://console.groq.com)** (LLM)
- A **Google Cloud** project with the **Vision API** enabled and a service-account key saved as `google-credentials.json` in the `ocr-service/` folder

### 1. Clone the repository

```bash
git clone https://github.com/Mehulgoyal2005/Exam-sheet-evaluator.git
cd Exam-sheet-evaluator
```

### 2. OCR microservice (Python)

```bash
cd ocr-service
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# poppler is required by pdf2image:
#   Ubuntu:  sudo apt-get install poppler-utils
#   macOS:   brew install poppler
#   Windows: download poppler binaries and add them to PATH

# Place your Google Cloud service-account key in this folder as:
#   google-credentials.json
.\.venv\Scripts\Activate.ps1
uvicorn main:app --host 0.0.0.0 --port 8000
```

The OCR service runs at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

### 3. Backend (Node.js)

```bash
cd server
npm install
cp .env.example .env            # fill in the values (see below)
npm run seed                    # create the professor account
npm run dev                     # http://localhost:5000
```

### 4. Frontend (React)

```bash
cd client
npm install
npm run dev                     # http://localhost:5173
```

### Default login

After running the seed script, log in with the professor credentials defined in `server/scripts/seedAdmin.js`. Change the password before any real use.

---

## 🔐 Environment Variables

**`server/.env`** (copy from `server/.env.example`):

| Variable | Description |
|----------|-------------|
| `PORT` | Express server port (default `5000`) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string for signing JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GROQ_API_KEY` | Groq API key (starts with `gsk_`) |
| `REDIS_URL` | Upstash Redis connection URL (`rediss://...`) |
| `OCR_SERVICE_URL` | URL of the Python OCR service (e.g. `http://localhost:8000`) |
| `CLIENT_URL` | Frontend origin for CORS |

**`ocr-service/.env`:**

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the Google Vision service-account key (e.g. `./google-credentials.json`) |
| `OCR_SERVICE_HOST` | Host to bind (e.g. `0.0.0.0`) |
| `OCR_SERVICE_PORT` | Port to bind (e.g. `8000`) |

**`client/.env`:**

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost:5000/api`) |

---

## 🔄 End-to-End Workflow

1. **Log in** as the professor.
2. **Create an exam** — name, subject, date, total marks, default scheme.
3. **Upload papers** — question paper PDF + model answer PDF, plus an optional custom grading prompt.
4. **Verify questions** — the extracted mapping appears in an editable table; fix anything the OCR got wrong and confirm.
5. **Upload student sheets** — drop a ZIP or individual PDFs, each named by roll number.
6. **Watch live progress** — each student's row updates in real time as the queue processes sheets.
7. **Review results** — stats cards, distribution charts, and a full results table; flagged rows highlight low-confidence OCR.
8. **Edit & export** — open any student report, adjust marks if needed, and download DOCX / ZIP / Excel.
9. **Revisit** — completed exams live in **Previous Exams**, sorted by date.

---

## 🌐 Deployment

| Component | Platform |
|-----------|----------|
| Frontend | **Vercel** (root: `client`, `VITE_API_URL` → backend URL) |
| Node backend | **Render** Web Service (root: `server`, start: `node index.js`) |
| Python OCR | **Render** Web Service (root: `ocr-service`, start: `uvicorn main:app --host 0.0.0.0 --port $PORT`) |
| Database | **MongoDB Atlas** (free M0 cluster) |
| Queue | **Upstash Redis** (free tier) |
| File storage | **Cloudinary** (free tier) |

On Render, set the OCR service's root directory to `ocr-service` with build command `pip install -r requirements.txt`, and provide the Google Vision credentials (the contents of `google-credentials.json`) as a secret file or environment variable. Point the Node backend's `OCR_SERVICE_URL` at the deployed Python service URL.

---

## 🧠 Design Decisions

- **Why a separate Python service?** Isolating OCR keeps the Node backend lean and lets text extraction scale independently. Python also has the cleanest tooling for the job — `pdf2image` for reliable PDF rasterization and the official Google Cloud Vision SDK.
- **Why Google Cloud Vision for OCR?** Handwritten answer sheets are the hardest OCR case. Vision's `document_text_detection` runs deep-learning models that handle skew, noise, bleed-through, and varied handwriting internally, reaching roughly 90–95% accuracy versus the 20–40% typical of classical engines on the same input — a difference that directly determines whether automated grading is usable.
- **Why Groq + Llama 3.1?** Generous free tier, fast inference, and strong enough reasoning for answer evaluation. All LLM calls request structured JSON output for reliable parsing.
- **Why no RAG?** At this scale, a well-crafted prompt that includes the model answer is sufficient. RAG would add infrastructure and latency without meaningful accuracy gains.
- **Why a single prompt per exam?** Simpler and more flexible than per-question instructions, and it matches how examiners actually describe grading rules.
- **Why a job queue?** Grading a class of sheets sequentially in a request would time out. Bull + Upstash Redis makes evaluation resilient, observable, and restartable.
- **Why a confidence flag at 0.70?** OCR on handwriting is imperfect; surfacing low-confidence answers keeps the professor in the loop exactly where the machine is least sure.

---

## 👤 Author

**Mehul Goyal** — B.Tech CSE, MNIT Jaipur

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/mehul-goyal-995688293/)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/Mehulgoyal2005)

---

<div align="center">

⭐ If this project helped you, consider giving it a star on GitHub!

</div>
