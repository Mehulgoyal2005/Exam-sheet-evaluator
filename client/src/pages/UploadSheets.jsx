// client/src/pages/UploadSheets.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  X,
} from 'lucide-react';
import api from '../utils/api';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';

// ─── STATUS BADGE COMPONENT ───────────────────────────────
// Renders a colored pill badge for each submission's status
const StatusBadge = ({ status }) => {
  const config = {
    queued: {
      bg: 'bg-gray-100',
      text: 'text-gray-600',
      label: 'Queued',
      icon: <Clock size={12} className="mr-1" />,
    },
    processing: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'Processing',
      icon: <Loader2 size={12} className="mr-1 animate-spin" />,
    },
    completed: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Completed',
      icon: <CheckCircle2 size={12} className="mr-1" />,
    },
    failed: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Failed',
      icon: <XCircle size={12} className="mr-1" />,
    },
  };

  const { bg, text, label, icon } = config[status] || config.queued;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      {icon}
      {label}
    </span>
  );
};

// ─── PROGRESS BAR COMPONENT ───────────────────────────────
const ProgressBar = ({ completed, total }) => {
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">
          Processing student sheets...
        </span>
        <span className="text-sm text-gray-500">
          {completed} of {total} completed
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-right text-xs text-gray-400 mt-1">{percentage}%</p>
    </div>
  );
};

// ─── MAIN PAGE COMPONENT ──────────────────────────────────
const UploadSheets = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  // Exam details fetched on mount
  const [exam, setExam] = useState(null);
  const [isLoadingExam, setIsLoadingExam] = useState(true);

  // 'upload' = show dropzone, 'processing' = show live status table
  const [pageState, setPageState] = useState('upload');

  // Files selected in the dropzone (before upload)
  const [selectedFiles, setSelectedFiles] = useState([]);

  // Uploading state — true while the POST request is in flight
  const [isUploading, setIsUploading] = useState(false);

  // All submissions for this exam — populated from upload response and socket events
  const [submissions, setSubmissions] = useState([]);

  // Socket ref — we keep it in a ref so we can disconnect on unmount
  const socketRef = useRef(null);

  // ─── FETCH EXAM DETAILS ────────────────────────────────
  useEffect(() => {
    const fetchExam = async () => {
      try {
        const [examRes, submissionsRes] = await Promise.all([
          api.get(`/exams/${examId}`),
          api.get(`/exams/${examId}/submissions`),
        ]);

        setExam(examRes.data.exam);

        // If submissions already exist (professor returning to this page),
        // jump straight to the processing state
        if (submissionsRes.data.submissions.length > 0) {
          setSubmissions(submissionsRes.data.submissions);
          setPageState('processing');
        }
      } catch (error) {
        toast.error('Failed to load exam details');
        console.error('fetchExam error:', error);
      } finally {
        setIsLoadingExam(false);
      }
    };

    fetchExam();
  }, [examId]);

  // ─── SOCKET.IO SETUP ──────────────────────────────────
  useEffect(() => {
    // Connect to Socket.io server
    // The base URL is the API URL without the /api path
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api')
      .replace('/api', '');

    const socket = io(baseUrl, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('⚡ Socket connected:', socket.id);
      // Join the exam room so we receive updates for this exam only
      socket.emit('join-exam', examId);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    // Server emits this when a new submission is queued
    // We add it to the submissions array so the row appears immediately
    socket.on('submission-queued', (data) => {
      setSubmissions((prev) => {
        // Avoid duplicates if we already have this submission from the HTTP response
        const exists = prev.some((s) => s._id === data._id);
        if (exists) return prev;
        // Insert and keep sorted by rollNumber
        return [...prev, data].sort((a, b) =>
          a.rollNumber.localeCompare(b.rollNumber)
        );
      });
    });

    // Server emits this when a job's status changes (queued → processing → completed/failed)
    socket.on('submission-status-update', (data) => {
      setSubmissions((prev) =>
        prev.map((s) => {
          if (s._id === data.submissionId || s._id?.toString() === data.submissionId) {
            return {
              ...s,
              status: data.status,
              totalMarksAwarded: data.totalMarksAwarded ?? s.totalMarksAwarded,
              percentage: data.percentage ?? s.percentage,
            };
          }
          return s;
        })
      );
    });

    // Cleanup: disconnect socket when the component unmounts
    return () => {
      socket.disconnect();
    };
  }, [examId]);

  // ─── DROPZONE CONFIGURATION ───────────────────────────
  const onDrop = useCallback((acceptedFiles) => {
    setSelectedFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    multiple: true,
  });

  // Remove a file from the selected list
  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── FORMAT FILE SIZE ──────────────────────────────────
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // ─── HANDLE UPLOAD ────────────────────────────────────
  const handleStartEvaluation = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      // uploadMultiple middleware expects the field name 'sheets'
      selectedFiles.forEach((file) => {
        formData.append('sheets', file);
      });

      const response = await api.post(
        `/exams/${examId}/submissions/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      if (response.data.success) {
        // Switch to processing state — the socket events will populate the table
        setPageState('processing');
        toast.success(
          `${response.data.count} student sheet(s) queued for evaluation`
        );
      }
    } catch (error) {
      const message =
        error.response?.data?.message || 'Upload failed. Please try again.';
      toast.error(message);
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // ─── COMPUTED VALUES ──────────────────────────────────
  const completedCount = submissions.filter(
    (s) => s.status === 'completed' || s.status === 'failed'
  ).length;

  const allDone =
    submissions.length > 0 && completedCount === submissions.length;

  // ─── LOADING STATE ────────────────────────────────────
  if (isLoadingExam) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">

            {/* Page Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Upload Student Answer Sheets
              </h1>
              {exam && (
                <p className="text-gray-500 mt-1">
                  {exam.title} — {exam.subject}
                </p>
              )}
            </div>

            {/* ── UPLOAD STATE ──────────────────────────── */}
            {pageState === 'upload' && (
              <div className="space-y-6">

                {/* Yellow Warning Box */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                  <AlertTriangle
                    size={20}
                    className="text-amber-500 flex-shrink-0 mt-0.5"
                  />
                  <div>
                    <p className="font-semibold text-amber-800">
                      Important: Files must be named by roll number
                    </p>
                    <p className="text-amber-700 text-sm mt-1">
                      Each PDF must be named with the student's roll number — for
                      example{' '}
                      <span className="font-mono bg-amber-100 px-1 rounded">
                        2021CSE045.pdf
                      </span>
                      . The system reads the filename to identify each student.
                      Files named incorrectly will be skipped.
                    </p>
                  </div>
                </div>

                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                    ${
                      isDragActive
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-300 bg-white hover:border-blue-300 hover:bg-gray-50'
                    }`}
                >
                  <input {...getInputProps()} />
                  <Upload
                    size={40}
                    className={`mx-auto mb-4 ${
                      isDragActive ? 'text-blue-500' : 'text-gray-400'
                    }`}
                  />
                  {isDragActive ? (
                    <p className="text-blue-600 font-medium text-lg">
                      Drop files here...
                    </p>
                  ) : (
                    <>
                      <p className="text-gray-700 font-medium text-lg">
                        Drag &amp; drop files here
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        Upload a ZIP containing PDFs, or select multiple PDFs directly
                      </p>
                      <button
                        type="button"
                        className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Browse Files
                      </button>
                    </>
                  )}
                </div>

                {/* Selected Files List */}
                {selectedFiles.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">
                        {selectedFiles.length} file(s) selected
                      </span>
                      <button
                        onClick={() => setSelectedFiles([])}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Clear all
                      </button>
                    </div>
                    {selectedFiles.slice(0, 10).map((file, index) => (
                      <div
                        key={index}
                        className="px-4 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={16} className="text-blue-500 flex-shrink-0" />
                          <span className="text-sm text-gray-700 font-mono">
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({formatBytes(file.size)})
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-gray-300 hover:text-gray-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {selectedFiles.length > 10 && (
                      <div className="px-4 py-2 text-xs text-gray-400">
                        ...and {selectedFiles.length - 10} more file(s)
                      </div>
                    )}
                  </div>
                )}

                {/* Start Evaluation Button */}
                <button
                  onClick={handleStartEvaluation}
                  disabled={selectedFiles.length === 0 || isUploading}
                  className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl
                    hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                    transition-colors flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Uploading and queueing...
                    </>
                  ) : selectedFiles.length > 0 ? (
                    <>
                      <Upload size={18} />
                      Start Evaluation ({selectedFiles.length} file
                      {selectedFiles.length !== 1 ? 's' : ''})
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Start Evaluation
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-gray-400">
                  Processing happens in the background. You will see live status
                  updates for each student after clicking Start Evaluation.
                </p>
              </div>
            )}

            {/* ── PROCESSING STATE ──────────────────────── */}
            {pageState === 'processing' && (
              <div className="space-y-6">

                {/* Progress Bar */}
                <ProgressBar
                  completed={completedCount}
                  total={submissions.length}
                />

                {/* View Results Button — shown when all done */}
                {allDone && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={20} className="text-green-600" />
                      <p className="font-medium text-green-800">
                        All {submissions.length} student(s) have been processed!
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/exam/${examId}/results`)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white
                        rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      View Results
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                {/* Live Status Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900">
                      Student Processing Status
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Updates in real time as each sheet is evaluated
                    </p>
                  </div>

                  {submissions.length === 0 ? (
                    <div className="px-6 py-10 text-center text-gray-400">
                      <Loader2
                        size={24}
                        className="animate-spin mx-auto mb-2"
                      />
                      <p>Waiting for submissions...</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Roll Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Marks
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {submissions.map((submission) => (
                          <tr
                            key={submission._id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <span className="font-mono text-sm font-medium text-gray-900">
                                {submission.rollNumber}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={submission.status} />
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {submission.status === 'completed' ? (
                                <span className="font-medium text-gray-900">
                                  {submission.totalMarksAwarded} /{' '}
                                  {submission.totalMarks}
                                </span>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Upload More button */}
                {allDone && (
                  <button
                    onClick={() => {
                      setPageState('upload');
                      setSelectedFiles([]);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 underline"
                  >
                    Upload more sheets for this exam
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default UploadSheets;