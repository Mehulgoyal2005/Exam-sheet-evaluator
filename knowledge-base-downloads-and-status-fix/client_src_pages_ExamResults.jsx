// client/src/pages/ExamResults.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Award,
  AlertTriangle,
  Download,
  Loader2,
  ChevronRight,
  FileSpreadsheet,
  FolderDown,
} from 'lucide-react';
import api from '../utils/api';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';

// ─── STATUS BADGE ─────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const config = {
    queued:     { bg: 'bg-gray-100',  text: 'text-gray-600',  label: 'Queued' },
    processing: { bg: 'bg-blue-100',  text: 'text-blue-700',  label: 'Processing' },
    completed:  { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' },
    failed:     { bg: 'bg-red-100',   text: 'text-red-700',   label: 'Failed' },
  };
  const { bg, text, label } = config[status] || config.queued;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
};

// ─── STATS CARD ───────────────────────────────────────────
const StatsCard = ({ title, value, subtitle, icon: Icon, iconColor, bgColor }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-2.5 rounded-lg ${bgColor}`}>
        <Icon size={20} className={iconColor} />
      </div>
    </div>
  </div>
);

// ─── MAIN PAGE ────────────────────────────────────────────
const ExamResults = () => {
  const { examId } = useParams();
  const navigate = useNavigate();

  const [exam, setExam] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // ─── FETCH ALL DATA ON MOUNT ───────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        // All three requests in parallel — faster than sequential
        const [examRes, submissionsRes, analyticsRes] = await Promise.all([
          api.get(`/exams/${examId}`),
          api.get(`/exams/${examId}/submissions`),
          api.get(`/exams/${examId}/analytics`),
        ]);

        setExam(examRes.data.exam);
        setSubmissions(submissionsRes.data.submissions || []);
        setAnalytics(analyticsRes.data.analytics);

      } catch (error) {
        toast.error('Failed to load exam results');
        console.error('ExamResults fetchAll error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [examId]);

  // // ─── DOWNLOAD HELPER ──────────────────────────────────
  // // Reusable function for binary file downloads that need auth header.
  // // Same pattern as DOCX download in StudentReport.jsx.
  // const downloadFile = async (url, filename, mimeType, setLoading) => {
  //   setLoading(true);
  //   try {
  //     const token = localStorage.getItem('token');
  //     const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  //     const response = await axios.get(`${baseURL}${url}`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //       responseType: 'arraybuffer',
  //     });

  //     const blob = new Blob([response.data], { type: mimeType });
  //     const objectUrl = URL.createObjectURL(blob);
  //     const link = document.createElement('a');
  //     link.href = objectUrl;
  //     link.download = filename;
  //     document.body.appendChild(link);
  //     link.click();
  //     document.body.removeChild(link);
  //     URL.revokeObjectURL(objectUrl);

  //     toast.success(`${filename} downloaded`);
  //   } catch (error) {
  //     toast.error(`Failed to download ${filename}`);
  //     console.error('downloadFile error:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // ─── DOWNLOAD HELPER ──────────────────────────────────
  // Reusable function for binary file downloads that need auth header.
  // Same pattern as DOCX download in StudentReport.jsx.
  const downloadFile = async (url, filename, mimeType, setLoading) => {
    setLoading(true);
    try {
      // FIX: the app stores the JWT under the key 'professorToken'
      // (see api.js and AuthContext.jsx). This function previously read
      // localStorage.getItem('token') — the wrong key — which returned null,
      // sent "Authorization: Bearer null", and the backend rejected every
      // download with 401. That is why Excel / ZIP downloads silently failed.
      const token = localStorage.getItem('professorToken');
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      const response = await axios.get(`${baseURL}${url}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'arraybuffer',
      });

      const blob = new Blob([response.data], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);

      toast.success(`${filename} downloaded`);
    } catch (error) {
      // The server may have returned a JSON error (e.g. "No submissions found"),
      // but because we requested responseType 'arraybuffer', that JSON arrives as
      // binary. Decode it so we can show the real reason instead of a generic message.
      let message = `Failed to download ${filename}`;
      try {
        if (error.response?.data) {
          const text = new TextDecoder().decode(error.response.data);
          const parsed = JSON.parse(text);
          if (parsed.message) message = parsed.message;
        }
      } catch (decodeError) {
        // response wasn't JSON — keep the generic message
      }
      toast.error(message);
      console.error('downloadFile error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    const safeTitle = exam?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'exam';
    downloadFile(
      `/exams/${examId}/submissions/download-excel`,
      `${safeTitle}-results.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      setIsDownloadingExcel
    );
  };

  const handleDownloadZip = () => {
    const safeTitle = exam?.title?.replace(/[^a-zA-Z0-9]/g, '_') || 'exam';
    downloadFile(
      `/exams/${examId}/submissions/download-all-reports`,
      `${safeTitle}-reports.zip`,
      'application/zip',
      setIsDownloadingZip
    );
  };

  // ─── FORMAT DATE ──────────────────────────────────────
  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

  // ─── CLASS AVERAGE COLOR ──────────────────────────────
  const avgColor =
    analytics?.classAverage >= 60 ? 'text-green-600' :
    analytics?.classAverage >= 40 ? 'text-yellow-600' : 'text-red-600';

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

  // ─── RENDER ───────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* ── Page Header ─────────────────────────── */}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {exam?.title}
                </h1>
                <p className="text-gray-500 mt-1">
                  {exam?.subject} &nbsp;·&nbsp;
                  {exam?.date && formatDate(exam.date)} &nbsp;·&nbsp;
                  Total Marks: {exam?.totalMarks}
                </p>
              </div>

              {/* Download buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadExcel}
                  disabled={isDownloadingExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300
                    text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDownloadingExcel
                    ? <Loader2 size={15} className="animate-spin" />
                    : <FileSpreadsheet size={15} />
                  }
                  Download Excel
                </button>

                <button
                  onClick={handleDownloadZip}
                  disabled={isDownloadingZip}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white
                    text-sm font-medium rounded-lg hover:bg-blue-700
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDownloadingZip
                    ? <Loader2 size={15} className="animate-spin" />
                    : <FolderDown size={15} />
                  }
                  Download All Reports
                </button>
              </div>
            </div>

            {/* ── Stats Cards ─────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Students"
                value={analytics?.completedCount ?? 0}
                subtitle={`${analytics?.totalStudents ?? 0} uploaded`}
                icon={Users}
                iconColor="text-blue-600"
                bgColor="bg-blue-50"
              />
              <StatsCard
                title="Class Average"
                value={<span className={avgColor}>{analytics?.classAverage ?? 0}%</span>}
                subtitle={`${analytics?.passCount ?? 0} students passed`}
                icon={TrendingUp}
                iconColor="text-purple-600"
                bgColor="bg-purple-50"
              />
              <StatsCard
                title="Highest Score"
                value={`${analytics?.highestScore ?? 0} / ${exam?.totalMarks ?? 0}`}
                subtitle="Best performance"
                icon={Award}
                iconColor="text-green-600"
                bgColor="bg-green-50"
              />
              <StatsCard
                title="Lowest Score"
                value={`${analytics?.lowestScore ?? 0} / ${exam?.totalMarks ?? 0}`}
                subtitle="Needs attention"
                icon={AlertTriangle}
                iconColor="text-red-500"
                bgColor="bg-red-50"
              />
            </div>

            {/* ── Charts ──────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Chart 1 — Marks Distribution */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Marks Distribution
                </h2>
                {analytics?.marksDistribution?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={analytics.marksDistribution}
                      margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="range"
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        label={{
                          value: 'Students',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 11, fill: '#9CA3AF' },
                        }}
                      />
                      <Tooltip
                        formatter={(value) => [`${value} student(s)`, 'Count']}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #E5E7EB',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                    No completed submissions yet
                  </div>
                )}
              </div>

              {/* Chart 2 — Question-wise Average */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-base font-semibold text-gray-900 mb-4">
                  Question-wise Average Performance
                </h2>
                {analytics?.questionWiseAverage?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={analytics.questionWiseAverage}
                      margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="questionNumber"
                        tickFormatter={(v) => `Q${v}`}
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#6B7280' }}
                        label={{
                          value: 'Avg Marks',
                          angle: -90,
                          position: 'insideLeft',
                          style: { fontSize: 11, fill: '#9CA3AF' },
                        }}
                      />
                      <Tooltip
                        formatter={(value, name, props) => [
                          `${value} / ${props.payload.maxMarks}`,
                          'Average Marks',
                        ]}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #E5E7EB',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="averageMarks" radius={[4, 4, 0, 0]}>
                        {analytics.questionWiseAverage.map((entry, index) => {
                          const pct = entry.maxMarks > 0
                            ? (entry.averageMarks / entry.maxMarks) * 100
                            : 0;
                          const color =
                            pct >= 70 ? '#16A34A' :
                            pct >= 40 ? '#D97706' : '#DC2626';
                          return <Cell key={index} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
                    No evaluation data yet
                  </div>
                )}
              </div>
            </div>

            {/* ── Submissions Table ────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">
                  All Students
                </h2>
                <span className="text-sm text-gray-400">
                  {submissions.length} student{submissions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {submissions.length === 0 ? (
                <div className="px-6 py-12 text-center text-gray-400">
                  No submissions found for this exam.
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Roll Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Marks Obtained
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Percentage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Flagged
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {submissions.map((submission) => (
                      <tr
                        key={submission._id}
                        onClick={() =>
                          navigate(`/exam/${examId}/student/${submission._id}`)
                        }
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {submission.rollNumber}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {submission.status === 'completed' ? (
                            <span className="font-medium">
                              {submission.totalMarksAwarded} / {submission.totalMarks}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {submission.status === 'completed' ? (
                            <span className={
                              submission.percentage >= 60 ? 'text-green-600 font-medium' :
                              submission.percentage >= 40 ? 'text-yellow-600 font-medium' :
                              'text-red-600 font-medium'
                            }>
                              {submission.percentage}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={submission.status} />
                        </td>
                        <td className="px-6 py-4">
                          {submission.isFlagged && (
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle size={14} className="text-amber-500" />
                              <span className="text-xs text-amber-600">Low confidence</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <ChevronRight size={16} className="text-gray-300" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default ExamResults;