// client/src/pages/ExamSetup.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import api from '../utils/api';

// Messages shown in rotation while the server is processing
// The whole pipeline (upload + OCR + LLM) takes 15-30 seconds
// These messages reassure the professor the system is still working
const LOADING_MESSAGES = [
  'Uploading files to secure storage...',
  'Sending to OCR service...',
  'Google Vision is reading the documents...',
  'AI is mapping questions to answers...',
  'Almost done...',
];

// Simple component to show one upload box
// Accepts a file, shows file info after selection, supports drag-and-drop
const FileUploadBox = ({ label, file, onFileChange, accept = '.pdf' }) => {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      onFileChange(droppedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[160px] ${
        isDragOver
          ? 'border-blue-400 bg-blue-50'
          : file
          ? 'border-green-400 bg-green-50'
          : 'border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'
      }`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files[0]) onFileChange(e.target.files[0]);
        }}
      />

      {file ? (
        // File selected state
        <>
          <CheckCircle className="text-green-500 mb-2" size={32} />
          <p className="text-green-700 font-medium text-sm text-center">{file.name}</p>
          <p className="text-green-500 text-xs mt-1">{formatFileSize(file.size)}</p>
          <p className="text-gray-400 text-xs mt-2">Click to change file</p>
        </>
      ) : (
        // Empty state
        <>
          <Upload className="text-gray-400 mb-2" size={32} />
          <p className="text-gray-700 font-medium text-sm text-center">{label}</p>
          <p className="text-gray-400 text-xs mt-1">Drop PDF here or click to browse</p>
        </>
      )}
    </div>
  );
};

// Step indicator at the top of the page
const StepIndicator = ({ currentStep }) => (
  <div className="flex items-center justify-center mb-8">
    {/* Step 1 */}
    <div className="flex flex-col items-center">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
          currentStep === 1
            ? 'bg-blue-600 text-white'
            : 'bg-green-500 text-white'
        }`}
      >
        {currentStep > 1 ? <CheckCircle size={18} /> : '1'}
      </div>
      <p
        className={`text-xs mt-1 font-medium ${
          currentStep === 1 ? 'text-blue-600' : 'text-green-600'
        }`}
      >
        Upload Papers
      </p>
    </div>

    {/* Connector line */}
    <div
      className={`h-0.5 w-20 mx-2 transition-colors ${
        currentStep > 1 ? 'bg-green-400' : 'bg-gray-300'
      }`}
    />

    {/* Step 2 */}
    <div className="flex flex-col items-center">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
          currentStep === 2
            ? 'bg-blue-600 text-white'
            : 'border-2 border-gray-300 text-gray-400'
        }`}
      >
        2
      </div>
      <p
        className={`text-xs mt-1 font-medium ${
          currentStep === 2 ? 'text-blue-600' : 'text-gray-400'
        }`}
      >
        Verify Questions
      </p>
    </div>
  </div>
);

const ExamSetup = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  // ── State ────────────────────────────────────────────────────────────────
  const [exam, setExam] = useState(null);
  const [isLoadingExam, setIsLoadingExam] = useState(true);

  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 form state
  const [questionPaperFile, setQuestionPaperFile] = useState(null);
  const [modelAnswerFile, setModelAnswerFile] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [processingError, setProcessingError] = useState('');

  // Step 2 state — extracted questions from LLM
  const [extractedQuestions, setExtractedQuestions] = useState([]);
  const [qpConfidence, setQpConfidence] = useState(null);
  const [maConfidence, setMaConfidence] = useState(null);

  // ── Fetch exam on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchExam = async () => {
      try {
        const response = await api.get(`/exams/${examId}`);
        if (response.data.success) {
          setExam(response.data.exam);
          // Pre-fill custom prompt if exam already has one saved
          if (response.data.exam.customPrompt) {
            setCustomPrompt(response.data.exam.customPrompt);
          }
        }
      } catch (error) {
        console.error('Failed to fetch exam:', error);
      } finally {
        setIsLoadingExam(false);
      }
    };

    fetchExam();
  }, [examId]);

  // ── Cycle through loading messages during processing ─────────────────────
  // We show animated messages because the OCR + LLM pipeline takes 15-30 seconds
  // Without feedback, the professor might think the page is frozen
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [isProcessing]);

  // ── Handle Process Papers button click ───────────────────────────────────
  const handleProcessPapers = async () => {
    if (!questionPaperFile || !modelAnswerFile) return;

    setIsProcessing(true);
    setProcessingError('');
    setLoadingMessageIndex(0);

    try {
      // Build multipart form data — this is how we send files via HTTP
      const formData = new FormData();
      formData.append('questionPaper', questionPaperFile);
      formData.append('modelAnswer', modelAnswerFile);
      formData.append('customPrompt', customPrompt);

      // We use api.post but override Content-Type header
      // When sending FormData, the browser sets Content-Type to multipart/form-data
      // automatically — we must not set it manually or the boundary string gets lost
      const response = await api.post(
        `/exams/${examId}/process-papers`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          // This is a long operation — extend timeout to 3 minutes
          timeout: 180000,
        }
      );

      if (response.data.success) {
        setExtractedQuestions(response.data.questions);
        setQpConfidence(response.data.questionPaperConfidence);
        setMaConfidence(response.data.modelAnswerConfidence);
        setCurrentStep(2);
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Processing failed. Please try again.';
      setProcessingError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Confidence banner logic ───────────────────────────────────────────────
  const isLowConfidence =
    qpConfidence !== null &&
    maConfidence !== null &&
    (qpConfidence < 0.5 || maConfidence < 0.5);

  // ── Loading state while fetching exam ────────────────────────────────────
  if (isLoadingExam) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="text-blue-600 animate-spin" size={36} />
            <p className="text-gray-500 text-sm">Loading exam...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <div className="flex-1 flex flex-col ml-64">
        <TopBar pageTitle={exam ? `Setup: ${exam.title}` : 'Exam Setup'} />

        <div className="flex-1 p-8 max-w-3xl mx-auto w-full">
          {/* Step Indicator */}
          <StepIndicator currentStep={currentStep} />

          {/* ── STEP 1: Upload Papers ── */}
          {currentStep === 1 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-1">
                Upload Exam Papers
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                Upload both PDFs. The AI will extract all questions and map them
                to their correct answers automatically.
              </p>

              {/* Two upload boxes side by side */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Paper PDF
                  </label>
                  <FileUploadBox
                    label="Question Paper PDF"
                    file={questionPaperFile}
                    onFileChange={setQuestionPaperFile}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model Answer Sheet PDF
                  </label>
                  <FileUploadBox
                    label="Model Answer Sheet PDF"
                    file={modelAnswerFile}
                    onFileChange={setModelAnswerFile}
                  />
                </div>
              </div>

              {/* Custom Prompt textarea */}
              <div className="mb-6">
                <div className="flex items-baseline justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Custom Checking Instructions{' '}
                    <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <span className="text-xs text-gray-400">
                    Applies to all questions when evaluating student answers
                  </span>
                </div>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={4}
                  placeholder="Example: Be strict with numerical calculations. Award partial marks if the student shows correct methodology even if the final answer is wrong. Diagrams are not required for full marks."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none"
                />
              </div>

              {/* Error message */}
              {processingError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-red-700 text-sm font-medium">Processing Failed</p>
                    <p className="text-red-600 text-sm mt-0.5">{processingError}</p>
                  </div>
                </div>
              )}

              {/* Process Papers button / Loading state */}
              {isProcessing ? (
                // Animated loading display — shows while the 15-30 second pipeline runs
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 flex items-center gap-3">
                  <Loader2 className="text-blue-600 animate-spin flex-shrink-0" size={20} />
                  <div>
                    <p className="text-blue-700 font-medium text-sm">
                      {LOADING_MESSAGES[loadingMessageIndex]}
                    </p>
                    <p className="text-blue-500 text-xs mt-0.5">
                      This takes about 15-30 seconds. Please do not close this page.
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleProcessPapers}
                  disabled={!questionPaperFile || !modelAnswerFile}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FileText size={18} />
                  {!questionPaperFile || !modelAnswerFile
                    ? 'Select both PDF files to continue'
                    : 'Process Papers with AI'}
                </button>
              )}
            </div>
          )}

          {/* ── STEP 2: Verify Questions (preview — full version in Module 6) ── */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Confidence banner */}
              {isLowConfidence ? (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 flex items-center gap-2">
                  <AlertTriangle className="text-yellow-600 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-yellow-800 font-medium text-sm">
                      Low OCR Confidence Detected
                    </p>
                    <p className="text-yellow-700 text-xs mt-0.5">
                      OCR confidence: Question Paper {Math.round((qpConfidence || 0) * 100)}% /
                      Model Answer {Math.round((maConfidence || 0) * 100)}%. Please carefully
                      review and correct the extracted text below.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-300 rounded-lg px-4 py-3 flex items-center gap-2">
                  <CheckCircle className="text-green-600 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-green-800 font-medium text-sm">
                      OCR Confidence: Good
                    </p>
                    <p className="text-green-700 text-xs mt-0.5">
                      Question Paper {Math.round((qpConfidence || 0) * 100)}% /
                      Model Answer {Math.round((maConfidence || 0) * 100)}%. Please verify the
                      extracted content below before confirming.
                    </p>
                  </div>
                </div>
              )}

              {/* Extracted questions preview */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">
                      Extracted Questions ({extractedQuestions.length})
                    </h2>
                    <p className="text-gray-500 text-sm mt-0.5">
                      The full editable table with confirm functionality will be completed in
                      Module 6. Below is a preview of what was extracted.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentStep(1);
                      setProcessingError('');
                    }}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <ChevronLeft size={16} />
                    Back to Step 1
                  </button>
                </div>

                {/* Question list */}
                <div className="space-y-4">
                  {extractedQuestions.map((q, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      {/* Question header */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-blue-100 text-blue-700 font-bold text-xs px-2 py-0.5 rounded-full">
                          Q{q.questionNumber}
                        </span>
                        <span className="text-xs text-gray-500">
                          {q.marks} marks · {q.scheme}
                        </span>
                      </div>

                      {/* Question text */}
                      <p className="text-gray-800 text-sm font-medium mb-2">
                        {q.questionText}
                      </p>

                      {/* Model answer */}
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-600 font-medium mb-1">
                          Model Answer:
                        </p>
                        <p className="text-gray-700 text-sm">{q.modelAnswer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamSetup;