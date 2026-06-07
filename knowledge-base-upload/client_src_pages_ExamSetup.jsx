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
  Plus,
  Trash2,
  Save,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import api from '../utils/api';

// Messages shown in rotation while the server is processing
const LOADING_MESSAGES = [
  'Uploading files to secure storage...',
  'Sending to OCR service...',
  'Google Vision is reading the documents...',
  'AI is mapping questions to answers...',
  'Almost done...',
];

// ── FileUploadBox sub-component ──────────────────────────────────────────────
// Handles drag-and-drop and click-to-browse for a single PDF file
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
        <>
          <CheckCircle className="text-green-500 mb-2" size={32} />
          <p className="text-green-700 font-medium text-sm text-center">{file.name}</p>
          <p className="text-green-500 text-xs mt-1">{formatFileSize(file.size)}</p>
          <p className="text-gray-400 text-xs mt-2">Click to change file</p>
        </>
      ) : (
        <>
          <Upload className="text-gray-400 mb-2" size={32} />
          <p className="text-gray-700 font-medium text-sm text-center">{label}</p>
          <p className="text-gray-400 text-xs mt-1">Drop PDF here or click to browse</p>
        </>
      )}
    </div>
  );
};

// ── StepIndicator sub-component ──────────────────────────────────────────────
const StepIndicator = ({ currentStep }) => (
  <div className="flex items-center justify-center mb-8">
    <div className="flex flex-col items-center">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
          currentStep === 1 ? 'bg-blue-600 text-white' : 'bg-green-500 text-white'
        }`}
      >
        {currentStep > 1 ? <CheckCircle size={18} /> : '1'}
      </div>
      <p className={`text-xs mt-1 font-medium ${currentStep === 1 ? 'text-blue-600' : 'text-green-600'}`}>
        Upload Papers
      </p>
    </div>

    <div className={`h-0.5 w-20 mx-2 transition-colors ${currentStep > 1 ? 'bg-green-400' : 'bg-gray-300'}`} />

    <div className="flex flex-col items-center">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
          currentStep === 2 ? 'bg-blue-600 text-white' : 'border-2 border-gray-300 text-gray-400'
        }`}
      >
        2
      </div>
      <p className={`text-xs mt-1 font-medium ${currentStep === 2 ? 'text-blue-600' : 'text-gray-400'}`}>
        Verify Questions
      </p>
    </div>
  </div>
);

// ── Main ExamSetup component ─────────────────────────────────────────────────
const ExamSetup = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  // Ref for scrolling to the bottom of the table when a new question is added
  const tableBottomRef = useRef(null);

  // ── State ──────────────────────────────────────────────────────────────
  const [exam, setExam] = useState(null);
  const [isLoadingExam, setIsLoadingExam] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 state
  const [questionPaperFile, setQuestionPaperFile] = useState(null);
  const [modelAnswerFile, setModelAnswerFile] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [processingError, setProcessingError] = useState('');

  // Step 2 state
  // 'questions' is the editable array — the single source of truth for the table.
  // Every input in the table reads from this array and writes back to it via
  // handleQuestionChange. When professor clicks Confirm, we send this array to the API.
  const [questions, setQuestions] = useState([]);
  const [qpConfidence, setQpConfidence] = useState(null);
  const [maConfidence, setMaConfidence] = useState(null);

  // validationErrors maps question index to an error message string
  // Example: { 0: 'Question text is required', 2: 'Marks must be greater than 0' }
  const [validationErrors, setValidationErrors] = useState({});

  // isSaving prevents double-clicks and shows spinner on the Confirm button
  const [isSaving, setIsSaving] = useState(false);

  // saveError shows the API error below the table if the POST fails
  const [saveError, setSaveError] = useState('');

  // ── Fetch exam on mount ────────────────────────────────────────────────
  useEffect(() => {
    const fetchExam = async () => {
      try {
        const response = await api.get(`/exams/${examId}`);
        if (response.data.success) {
          setExam(response.data.exam);
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

  // ── Cycle loading messages during processing ───────────────────────────
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) =>
        prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // ── Step 1: Process papers ─────────────────────────────────────────────
  const handleProcessPapers = async () => {
    if (!questionPaperFile || !modelAnswerFile) return;

    setIsProcessing(true);
    setProcessingError('');
    setLoadingMessageIndex(0);

    try {
      const formData = new FormData();
      formData.append('questionPaper', questionPaperFile);
      formData.append('modelAnswer', modelAnswerFile);
      formData.append('customPrompt', customPrompt);

      const response = await api.post(
        `/exams/${examId}/questions/process-papers`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 180000,
        }
      );

      if (response.data.success) {
        // Load the returned questions into the editable state array
        setQuestions(response.data.questions);
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

  // ── Step 2: Edit a field in one question row ───────────────────────────
  // React compares state by reference, so we MUST create a new array — not mutate.
  // Array.map returns a new array. Spread operator {...q} creates a new question object.
  // [field] is a computed property name — it uses the value of 'field' as the key,
  // so handleQuestionChange(0, 'marks', 10) sets questions[0].marks = 10.
  const handleQuestionChange = (index, field, value) => {
    const updated = questions.map((q, i) => {
      if (i === index) {
        return { ...q, [field]: value };
      }
      return q;
    });
    setQuestions(updated);

    // Clear the validation error for this row as soon as the professor starts fixing it
    if (validationErrors[index]) {
      const updatedErrors = { ...validationErrors };
      delete updatedErrors[index];
      setValidationErrors(updatedErrors);
    }
  };

  // ── Step 2: Add a blank question row ──────────────────────────────────
  const handleAddQuestion = () => {
    const newQuestion = {
      questionNumber: questions.length + 1,
      questionText: '',
      modelAnswer: '',
      // Default to 1 instead of 0 so the running total doesn't look confusing
      // and to avoid the "marks must be greater than 0" validation error on a fresh row
      marks: 1,
      scheme: exam?.defaultScheme || 'medium',
    };
    setQuestions([...questions, newQuestion]);

    // Scroll to the new row after React re-renders so the professor sees it
    setTimeout(() => {
      tableBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // ── Step 2: Delete a question row ─────────────────────────────────────
  const handleDeleteQuestion = (index) => {
    if (questions.length <= 1) {
      toast.error('You must have at least one question.');
      return;
    }

    const updated = questions
      .filter((_, i) => i !== index)
      // After deleting, renumber sequentially from 1 so there are no gaps.
      // If we delete Q2 from [Q1, Q2, Q3], we want [Q1, Q2] not [Q1, Q3].
      // Gaps in question numbers would confuse the evaluation worker.
      .map((q, i) => ({ ...q, questionNumber: i + 1 }));

    setQuestions(updated);

    // Clean up any validation error that was on the deleted row
    const updatedErrors = { ...validationErrors };
    delete updatedErrors[index];
    setValidationErrors(updatedErrors);
  };

  // ── Step 2: Validate before saving ────────────────────────────────────
  // Client-side validation gives the professor instant feedback without a network
  // round trip. We highlight exactly which row has the problem so they can fix it.
  const validateQuestions = () => {
    const errors = {};

    questions.forEach((q, index) => {
      if (!q.questionText || !q.questionText.trim()) {
        errors[index] = 'Question text is required';
      } else if (!q.modelAnswer || !q.modelAnswer.trim()) {
        errors[index] = 'Model answer is required';
      } else if (!q.marks || Number(q.marks) <= 0) {
        errors[index] = 'Marks must be greater than 0';
      }
    });

    setValidationErrors(errors);
    // Return true only if there are zero errors
    return Object.keys(errors).length === 0;
  };

  // ── Step 2: Confirm and save to MongoDB ───────────────────────────────
  // On the backend, saveQuestions deletes old Question documents for this exam,
  // inserts all new ones, and sets exam.status = 'ready'.
  const handleConfirmSave = async () => {
    // Step 1: Validate — return early if any field is invalid
    // The table will show red errors on the failing rows automatically
    if (!validateQuestions()) return;

    setIsSaving(true);
    setSaveError('');

    try {
      // Step 2: Ensure marks are numbers not strings.
      // HTML number inputs return string values. parseInt converts "12" → 12.
      const preparedQuestions = questions.map((q) => ({
        ...q,
        marks: Number(q.marks),
        questionNumber: Number(q.questionNumber),
      }));

      // Step 3: POST to saveQuestions endpoint
      const response = await api.post(`/exams/${examId}/questions`, {
        questions: preparedQuestions,
      });

      if (response.data.success) {
        toast.success(`${response.data.count} questions saved successfully!`);
        // Navigate to the Upload Sheets page — Module 7 will build this page
        navigate(`/exam/${examId}/upload`);
      }
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        'Failed to save questions. Please try again.';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Computed values ────────────────────────────────────────────────────
  // reduce loops through the questions array accumulating a running sum of marks.
  // Number() handles the case where marks is still a string from the input element.
  const totalMarksSum = questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  const isLowConfidence =
    qpConfidence !== null &&
    maConfidence !== null &&
    (qpConfidence < 0.5 || maConfidence < 0.5);

  const marksMatch = totalMarksSum === Number(exam?.totalMarks);

  // ── Loading screen while fetching exam ────────────────────────────────
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

  // ── Main render ───────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Toast notifications — needed for success and error messages */}
      <Toaster position="top-right" />
      <Sidebar />

      <div className="flex-1 flex flex-col ml-64">
        <TopBar pageTitle={exam ? `Setup: ${exam.title}` : 'Exam Setup'} />

        <div className="flex-1 p-8 max-w-5xl mx-auto w-full">
          <StepIndicator currentStep={currentStep} />

          {/* ════════════════════════════════════════════════════════════
              STEP 1 — Upload Papers (unchanged from Module 5)
          ════════════════════════════════════════════════════════════ */}
          {currentStep === 1 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Upload Exam Papers</h2>
              <p className="text-gray-500 text-sm mb-6">
                Upload both PDFs. The AI will extract all questions and map them
                to their correct answers automatically.
              </p>

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

              {processingError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-red-700 text-sm font-medium">Processing Failed</p>
                    <p className="text-red-600 text-sm mt-0.5">{processingError}</p>
                  </div>
                </div>
              )}

              {isProcessing ? (
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

          {/* ════════════════════════════════════════════════════════════
              STEP 2 — Verify and Edit Questions (Module 6)
          ════════════════════════════════════════════════════════════ */}
          {currentStep === 2 && (
            <div className="space-y-4">

              {/* Instruction box — tells professor what to do on this step */}
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg px-5 py-4">
                <p className="text-blue-800 font-semibold text-sm">Verify Extracted Questions</p>
                <p className="text-blue-700 text-xs mt-1">
                  The AI has extracted the following questions from your uploaded documents.
                  Please review each question carefully. Correct any mistakes, add questions
                  that were missed, or remove any that were incorrectly detected. Click
                  <strong> Confirm and Save</strong> when everything looks correct.
                </p>
              </div>

              {/* OCR Confidence banner */}
              {isLowConfidence ? (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 flex items-center gap-2">
                  <AlertTriangle className="text-yellow-600 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-yellow-800 font-medium text-sm">Low OCR Confidence Detected</p>
                    <p className="text-yellow-700 text-xs mt-0.5">
                      Question Paper: {Math.round((qpConfidence || 0) * 100)}% | Model Answer:{' '}
                      {Math.round((maConfidence || 0) * 100)}% — The OCR may have misread some
                      content. Please carefully review and correct every field below.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-300 rounded-lg px-4 py-3 flex items-center gap-2">
                  <CheckCircle className="text-green-600 flex-shrink-0" size={18} />
                  <div>
                    <p className="text-green-800 font-medium text-sm">OCR Confidence: Good</p>
                    <p className="text-green-700 text-xs mt-0.5">
                      Question Paper: {Math.round((qpConfidence || 0) * 100)}% | Model Answer:{' '}
                      {Math.round((maConfidence || 0) * 100)}% — Please verify the extracted
                      content below before confirming.
                    </p>
                  </div>
                </div>
              )}

              {/* Total marks indicator
                  This is a WARNING only — not a blocking error. Professors sometimes
                  have bonus marks or deliberately leave some questions unweighted. */}
              <div className={`rounded-lg px-4 py-3 flex items-center justify-between border ${
                marksMatch
                  ? 'bg-green-50 border-green-300'
                  : 'bg-yellow-50 border-yellow-300'
              }`}>
                <div className="flex items-center gap-2">
                  {marksMatch ? (
                    <CheckCircle className="text-green-600" size={16} />
                  ) : (
                    <AlertTriangle className="text-yellow-600" size={16} />
                  )}
                  <span className={`text-sm font-medium ${marksMatch ? 'text-green-800' : 'text-yellow-800'}`}>
                    Total Marks in Table:{' '}
                    <span className="font-bold">{totalMarksSum}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${marksMatch ? 'text-green-700' : 'text-yellow-700'}`}>
                    Exam Total: <span className="font-bold">{exam?.totalMarks}</span>
                  </span>
                  {marksMatch ? (
                    <span className="text-xs text-green-600 font-medium">✓ Marks match!</span>
                  ) : (
                    <span className="text-xs text-yellow-600 font-medium">
                      Warning: doesn't match
                    </span>
                  )}
                </div>
              </div>

              {/* ── Editable Questions Table ── */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Table scroll container — max height prevents buttons going off screen */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-14">
                          Q No
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Question Text
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Model Answer
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-20">
                          Marks
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-36">
                          Scheme
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-16">
                          Del
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {questions.map((q, index) => (
                        <React.Fragment key={index}>
                          {/* Main question row */}
                          <tr className={`${validationErrors[index] ? 'bg-red-50' : 'bg-white hover:bg-gray-50'} transition-colors`}>

                            {/* Question number — read only */}
                            <td className="px-3 py-3 text-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 font-bold text-xs rounded-full font-mono">
                                {q.questionNumber}
                              </span>
                            </td>

                            {/* Question text — editable textarea
                                We use textarea (not input) because questions often have
                                multiple sub-parts like (a), (b), (c) that span multiple lines */}
                            <td className="px-3 py-3">
                              <textarea
                                value={q.questionText}
                                onChange={(e) =>
                                  handleQuestionChange(index, 'questionText', e.target.value)
                                }
                                rows={3}
                                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y ${
                                  validationErrors[index] &&
                                  validationErrors[index].includes('Question text')
                                    ? 'border-red-400 bg-red-50'
                                    : 'border-gray-300'
                                }`}
                                placeholder="Enter question text..."
                              />
                            </td>

                            {/* Model answer — editable textarea */}
                            <td className="px-3 py-3">
                              <textarea
                                value={q.modelAnswer}
                                onChange={(e) =>
                                  handleQuestionChange(index, 'modelAnswer', e.target.value)
                                }
                                rows={3}
                                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y ${
                                  validationErrors[index] &&
                                  validationErrors[index].includes('Model answer')
                                    ? 'border-red-400 bg-red-50'
                                    : 'border-gray-300'
                                }`}
                                placeholder="Enter model answer..."
                              />
                            </td>

                            {/* Marks — number input, allows 0.5 increments */}
                            <td className="px-3 py-3 text-center">
                              <input
                                type="number"
                                value={q.marks}
                                onChange={(e) =>
                                  handleQuestionChange(index, 'marks', e.target.value)
                                }
                                min="0"
                                step="0.5"
                                className={`w-16 px-2 py-1.5 text-xs border rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  validationErrors[index] &&
                                  validationErrors[index].includes('Marks')
                                    ? 'border-red-400 bg-red-50'
                                    : 'border-gray-300'
                                }`}
                              />
                            </td>

                            {/* Scheme dropdown with helper text below */}
                            <td className="px-3 py-3">
                              <select
                                value={q.scheme}
                                onChange={(e) =>
                                  handleQuestionChange(index, 'scheme', e.target.value)
                                }
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="difficult">Difficult</option>
                              </select>
                              {/* Helper text changes based on selected scheme */}
                              <p className={`text-xs mt-1 text-center ${
                                q.scheme === 'easy'
                                  ? 'text-gray-400'
                                  : q.scheme === 'medium'
                                  ? 'text-blue-500'
                                  : 'text-orange-500'
                              }`}>
                                {q.scheme === 'easy' && 'Similar meaning accepted'}
                                {q.scheme === 'medium' && 'Key concepts required'}
                                {q.scheme === 'difficult' && 'Close match required'}
                              </p>
                            </td>

                            {/* Delete button — disabled if only one question remains */}
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => handleDeleteQuestion(index)}
                                disabled={questions.length <= 1}
                                title={
                                  questions.length <= 1
                                    ? 'Cannot delete the only question'
                                    : 'Delete this question'
                                }
                                className={`p-1.5 rounded-md transition-colors ${
                                  questions.length <= 1
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                                }`}
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>

                          {/* Row-level error bar — full width, spans all columns */}
                          {validationErrors[index] && (
                            <tr>
                              <td colSpan={6} className="px-4 py-2 bg-red-100 border-t border-red-200">
                                <div className="flex items-center gap-1.5">
                                  <AlertTriangle size={13} className="text-red-600 flex-shrink-0" />
                                  <span className="text-red-700 text-xs font-medium">
                                    Question {q.questionNumber}: {validationErrors[index]}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Scroll anchor — handleAddQuestion scrolls here after adding a row */}
                <div ref={tableBottomRef} />

                {/* Add Question button — dashed outline style, below the table */}
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={handleAddQuestion}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-500 rounded-lg text-sm transition-colors w-full justify-center"
                  >
                    <Plus size={16} />
                    Add Question
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-1">
                    Use this if the AI missed a question or you want to add one manually
                  </p>
                </div>
              </div>

              {/* API save error — shown below table if POST fails */}
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <div>
                    <p className="text-red-700 text-sm font-medium">Failed to Save</p>
                    <p className="text-red-600 text-sm mt-0.5">{saveError}</p>
                  </div>
                </div>
              )}

              {/* ── Bottom action bar ── */}
              <div className="flex items-center justify-between pt-2 pb-6">
                {/* Back button — lets professor re-upload if extraction was completely wrong */}
                <button
                  onClick={() => {
                    setCurrentStep(1);
                    setProcessingError('');
                    setSaveError('');
                    setValidationErrors({});
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 hover:border-gray-400 text-gray-600 hover:text-gray-800 rounded-lg text-sm font-medium transition-colors"
                >
                  <ChevronLeft size={16} />
                  Back to Step 1
                </button>

                {/* Confirm and Save — the most important button in the whole setup flow */}
                <button
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors shadow-sm hover:shadow-md"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Confirm and Save Questions
                    </>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamSetup;