import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Calendar, Award, Loader2, AlertCircle, Clock } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import api from '../utils/api';

// Helper function to format a date nicely
// Example: "2025-01-15" becomes "15 January 2025"
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

// Status badge component — shows a colored pill based on exam status
const StatusBadge = ({ status }) => {
  const styles = {
    setup: 'bg-gray-100 text-gray-600',
    ready: 'bg-blue-100 text-blue-700',
    processing: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
  };

  const labels = {
    setup: 'Setting Up',
    ready: 'Ready',
    processing: 'Processing',
    completed: 'Completed',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.setup}`}
    >
      {status === 'processing' && (
        <Loader2 size={10} className="animate-spin" />
      )}
      {labels[status] || 'Setting Up'}
    </span>
  );
};

const PreviousExams = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch all exams when the page loads
  const fetchExams = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.get('/exams');
      if (response.data.success) {
        setExams(response.data.exams);
      }
    } catch (err) {
      setError('Failed to load exams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  // Navigate to the right page based on exam status
  const handleCardClick = (exam) => {
    if (exam.status === 'setup' || exam.status === 'ready') {
      navigate(`/exam/${exam._id}/setup`);
    } else if (exam.status === 'processing') {
      navigate(`/exam/${exam._id}/upload`);
    } else if (exam.status === 'completed') {
      navigate(`/exam/${exam._id}/results`);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Left Sidebar */}
      <Sidebar />

      {/* Right Content */}
      <div className="flex-1 flex flex-col ml-64">

        {/* Top Bar */}
        <TopBar pageTitle="Previous Exams" />

        {/* Main Content */}
        <div className="flex-1 p-8">

          {/* ── Loading State ── */}
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="text-blue-600 animate-spin" size={36} />
                <p className="text-gray-500 text-sm">Loading exams...</p>
              </div>
            </div>
          )}

          {/* ── Error State ── */}
          {!isLoading && error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="text-red-400 mx-auto mb-3" size={36} />
                <p className="text-red-600 font-medium mb-1">Something went wrong</p>
                <p className="text-gray-500 text-sm mb-4">{error}</p>
                <button
                  onClick={fetchExams}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* ── Empty State ── */}
          {!isLoading && !error && exams.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="text-gray-400" size={28} />
                </div>
                <h3 className="text-gray-700 font-semibold text-lg mb-1">
                  No exams created yet
                </h3>
                <p className="text-gray-400 text-sm mb-5">
                  Create your first exam to get started
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
                >
                  <PlusCircle size={16} />
                  Create New Exam
                </button>
              </div>
            </div>
          )}

          {/* ── Exams Grid ── */}
          {!isLoading && !error && exams.length > 0 && (
            <>
              {/* Header row */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-gray-500 text-sm">
                  {exams.length} exam{exams.length !== 1 ? 's' : ''} found
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <PlusCircle size={16} />
                  New Exam
                </button>
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {exams.map((exam) => (
                  <div
                    key={exam._id}
                    onClick={() => handleCardClick(exam)}
                    className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-shadow p-5 flex flex-col gap-4"
                  >
                    {/* Card Top — title and subject */}
                    <div>
                      <h3 className="text-gray-800 font-semibold text-base leading-snug mb-1">
                        {exam.title}
                      </h3>
                      <p className="text-gray-500 text-sm">{exam.subject}</p>
                    </div>

                    {/* Card Middle — date and marks */}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        {formatDate(exam.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Award size={14} />
                        {exam.totalMarks} Marks
                      </span>
                    </div>

                    {/* Card Bottom — status badge */}
                    <div className="flex items-center justify-between">
                      <StatusBadge status={exam.status} />
                      <span className="text-xs text-gray-400">
                        {formatDate(exam.createdAt)}
                      </span>
                    </div>

                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default PreviousExams;