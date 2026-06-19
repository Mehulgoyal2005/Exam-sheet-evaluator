// client/src/pages/StudentReport.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Save,
  ArrowLeft,
  Edit3,
} from 'lucide-react';
import api from '../utils/api';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';

// ─── STUDENT REPORT PAGE ──────────────────────────────────
const StudentReport = () => {
  const { examId, submissionId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [evaluations, setEvaluations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // editedMarks maps evaluationId → current mark value shown in the input
  // Initialized from evaluations — uses overriddenMark if already overridden
  const [editedMarks, setEditedMarks] = useState({});

  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // ─── FETCH DATA ON MOUNT ───────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examRes, submissionRes] = await Promise.all([
          api.get(`/exams/${examId}`),
          api.get(`/exams/${examId}/submissions/${submissionId}`),
        ]);

        setExam(examRes.data.exam);
        setSubmission(submissionRes.data.submission);

        const evs = submissionRes.data.evaluations || [];
        setEvaluations(evs);

        // Initialize editedMarks from fetched evaluations
        // Use overriddenMark if the professor already overrode this question
        const initialMarks = {};
        evs.forEach((ev) => {
          initialMarks[ev._id] = ev.isOverridden ? ev.overriddenMark : ev.marksAwarded;
        });
        setEditedMarks(initialMarks);

      } catch (error) {
        toast.error('Failed to load student report');
        console.error('fetchData error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [examId, submissionId]);

  // ─── LIVE TOTAL CALCULATION ────────────────────────────
  // Computed from editedMarks state — updates as professor types
  // This is what shows in the header, not submission.totalMarksAwarded
  const liveTotalMarks = Object.values(editedMarks).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  );

  const livePercentage = submission
    ? parseFloat(((liveTotalMarks / submission.totalMarks) * 100).toFixed(1))
    : 0;

  // ─── DETECT CHANGES ───────────────────────────────────
  // Compare editedMarks against the saved state of each evaluation
  const hasChanges = evaluations.some((ev) => {
    const savedMark = ev.isOverridden ? ev.overriddenMark : ev.marksAwarded;
    return Number(editedMarks[ev._id]) !== savedMark;
  });

  // ─── HANDLE MARK INPUT CHANGE ─────────────────────────
  const handleMarkChange = (evaluationId, value, maxMarks) => {
    // Allow empty string while typing — we validate on save
    // Clamp value between 0 and maxMarks silently
    let parsed = value === '' ? '' : Number(value);
    if (parsed !== '' && parsed > maxMarks) parsed = maxMarks;
    if (parsed !== '' && parsed < 0) parsed = 0;

    setEditedMarks((prev) => ({ ...prev, [evaluationId]: parsed }));
  };

  // ─── SAVE CHANGES ─────────────────────────────────────
  // Only sends PATCH for evaluations where the mark actually changed
  const handleSaveChanges = async () => {
    setIsSaving(true);

    try {
      // Find only the evaluations that have changed
      const changedEvaluations = evaluations.filter((ev) => {
        const savedMark = ev.isOverridden ? ev.overriddenMark : ev.marksAwarded;
        return Number(editedMarks[ev._id]) !== savedMark;
      });

      if (changedEvaluations.length === 0) {
        toast('No changes to save');
        setIsSaving(false);
        return;
      }

      // Send one PATCH request per changed evaluation
      // We do them sequentially to avoid race conditions on total recalculation
      let lastResponse = null;
      for (const ev of changedEvaluations) {
        const response = await api.patch(
          `/exams/${examId}/submissions/${submissionId}/override-question`,
          {
            evaluationId: ev._id,
            overriddenMark: Number(editedMarks[ev._id]),
            overrideReason: '',
          }
        );
        lastResponse = response;
      }

      // The last PATCH response contains the fully updated submission and evaluations
      if (lastResponse && lastResponse.data.success) {
        const updatedEvaluations = lastResponse.data.evaluations;
        setSubmission(lastResponse.data.submission);
        setEvaluations(updatedEvaluations);

        // Re-initialize editedMarks from the server response
        const refreshedMarks = {};
        updatedEvaluations.forEach((ev) => {
          refreshedMarks[ev._id] = ev.isOverridden ? ev.overriddenMark : ev.marksAwarded;
        });
        setEditedMarks(refreshedMarks);
      }

      toast.success(`${changedEvaluations.length} mark(s) updated successfully`);

    } catch (error) {
      const message = error.response?.data?.message || 'Failed to save changes';
      toast.error(message);
      console.error('handleSaveChanges error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── DOWNLOAD DOCX ────────────────────────────────────
  // We cannot use a plain <a> tag because the endpoint needs an auth header.
  // We use axios with responseType arraybuffer, convert to Blob, then trigger
  // a programmatic download using URL.createObjectURL.
  const handleDownloadDocx = async () => {
    setIsDownloading(true);

    try {
      const token = localStorage.getItem('token');
      const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api');

      const response = await axios.get(
        `${baseURL}/exams/${examId}/submissions/${submissionId}/download-report`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'arraybuffer',
        }
      );

      // Convert arraybuffer to Blob then trigger browser download
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${submission?.rollNumber || 'report'}-report.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Report downloaded');

    } catch (error) {
      toast.error('Failed to download report');
      console.error('handleDownloadDocx error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── LOADING STATE ────────────────────────────────────
  if (isLoading) {
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

  if (!submission || !exam) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-500">Submission not found.</p>
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

        {/* Scrollable content area — leave room for sticky bottom bar */}
        <main className="flex-1 overflow-y-auto pb-24 p-6">
          <div className="max-w-4xl mx-auto">

            {/* ── Breadcrumb ──────────────────────────── */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
              <button
                onClick={() => navigate(`/exam/${examId}/results`)}
                className="hover:text-blue-600 transition-colors font-medium"
              >
                {exam.title}
              </button>
              <ChevronRight size={14} />
              <span className="text-gray-900 font-medium">{submission.rollNumber}</span>
            </div>

            {/* ── Header Card ─────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 font-mono">
                    {submission.rollNumber}
                  </h1>
                  <p className="text-gray-500 mt-1">{exam.subject}</p>
                </div>

                <div className="text-right">
                  {/* Live total — updates as professor edits marks inputs */}
                  <div className="text-3xl font-bold text-gray-900">
                    <span className={
                      livePercentage >= 75 ? 'text-green-600' :
                      livePercentage >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }>
                      {liveTotalMarks}
                    </span>
                    <span className="text-gray-400 text-xl"> / {submission.totalMarks}</span>
                  </div>
                  <p className="text-gray-500 text-sm mt-1">{livePercentage}%</p>
                </div>
              </div>

              {/* Flagged badge */}
              {submission.isFlagged && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5
                  bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <span className="text-amber-700 text-sm font-medium">
                    Low OCR Confidence — some answers may need manual verification
                  </span>
                </div>
              )}
            </div>

            {/* ── Question Evaluation Cards ────────────── */}
            <div className="space-y-4">
              {evaluations.map((evaluation) => (
                <div
                  key={evaluation._id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  {/* Question Header */}
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-100
                    flex items-center justify-between">
                    <h2 className="font-bold text-gray-900">
                      Question {evaluation.questionNumber}
                    </h2>

                    {/* Marks input — professor edits here */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={evaluation.maxMarks}
                        value={editedMarks[evaluation._id] ?? 0}
                        onChange={(e) =>
                          handleMarkChange(evaluation._id, e.target.value, evaluation.maxMarks)
                        }
                        className="w-16 text-center border border-gray-300 rounded-lg px-2 py-1
                          text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500
                          focus:border-transparent"
                      />
                      <span className="text-gray-400 text-sm">/ {evaluation.maxMarks}</span>

                      {/* Changed indicator dot */}
                      {Number(editedMarks[evaluation._id]) !==
                        (evaluation.isOverridden ? evaluation.overriddenMark : evaluation.marksAwarded) && (
                        <span className="w-2 h-2 rounded-full bg-blue-500" title="Unsaved change" />
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-4 space-y-4">

                    {/* Low confidence warning */}
                    {evaluation.isLowConfidence && (
                      <div className="flex items-center gap-2 px-3 py-2
                        bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                        <span className="text-amber-700 text-xs font-medium">
                          Low OCR Confidence — verify this answer manually
                        </span>
                      </div>
                    )}

                    {/* Override indicator */}
                    {evaluation.isOverridden && (
                      <div className="flex items-center gap-2 px-3 py-2
                        bg-purple-50 border border-purple-200 rounded-lg">
                        <Edit3 size={14} className="text-purple-500 flex-shrink-0" />
                        <span className="text-purple-700 text-xs font-medium">
                          Manually overridden to {evaluation.overriddenMark} marks
                          {evaluation.overrideReason && ` — "${evaluation.overrideReason}"`}
                        </span>
                      </div>
                    )}

                    {/* Student Answer */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase
                        tracking-wider mb-2">
                        Student Answer
                      </p>
                      <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                        {evaluation.studentAnswerText ? (
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">
                            {evaluation.studentAnswerText}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No answer provided</p>
                        )}
                      </div>
                    </div>

                    {/* Model Answer */}
                    <div>
                      <p className="text-xs font-semibold text-blue-500 uppercase
                        tracking-wider mb-2">
                        Model Answer
                      </p>
                      <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-100">
                        <p className="text-sm text-blue-900 whitespace-pre-wrap">
                          {evaluation.modelAnswer || '—'}
                        </p>
                      </div>
                    </div>

                    {/* Correct Parts */}
                    {evaluation.correctParts && evaluation.correctParts.trim() && (
                      <div className="flex gap-2">
                        <CheckCircle2 size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-green-600 mb-0.5">Correct</p>
                          <p className="text-sm text-green-700">{evaluation.correctParts}</p>
                        </div>
                      </div>
                    )}

                    {/* Wrong Parts */}
                    {evaluation.wrongParts && evaluation.wrongParts.trim() && (
                      <div className="flex gap-2">
                        <XCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-600 mb-0.5">
                            Needs Improvement
                          </p>
                          <p className="text-sm text-red-700">{evaluation.wrongParts}</p>
                        </div>
                      </div>
                    )}

                    {/* AI Feedback */}
                    {evaluation.aiFeedback && evaluation.aiFeedback.trim() && (
                      <div className="border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase
                          tracking-wider mb-1">
                          AI Feedback
                        </p>
                        <p className="text-sm text-gray-500 italic">{evaluation.aiFeedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </main>

        {/* ── Sticky Bottom Action Bar ─────────────────── */}
        {/* Fixed at bottom — always visible while professor reviews */}
        <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200
          px-6 py-4 flex items-center justify-between z-10">

          <button
            onClick={() => navigate(`/exam/${examId}/results`)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700
              transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Results
          </button>

          <div className="flex items-center gap-3">
            {/* Download DOCX */}
            <button
              onClick={handleDownloadDocx}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300
                text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isDownloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Download DOCX
            </button>

            {/* Save Changes */}
            <button
              onClick={handleSaveChanges}
              disabled={!hasChanges || isSaving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white
                text-sm font-medium rounded-lg hover:bg-blue-700
                disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentReport;