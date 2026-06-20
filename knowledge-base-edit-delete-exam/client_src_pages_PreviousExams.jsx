// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { PlusCircle, Calendar, Award, Loader2, AlertCircle, Clock } from 'lucide-react';
// import Sidebar from '../components/Layout/Sidebar';
// import TopBar from '../components/Layout/TopBar';
// import api from '../utils/api';

// // Helper function to format a date nicely
// // Example: "2025-01-15" becomes "15 January 2025"
// const formatDate = (dateString) => {
//   const date = new Date(dateString);
//   return date.toLocaleDateString('en-IN', {
//     day: 'numeric',
//     month: 'long',
//     year: 'numeric',
//   });
// };

// // Status badge component — shows a colored pill based on exam status
// const StatusBadge = ({ status }) => {
//   const styles = {
//     setup: 'bg-gray-100 text-gray-600',
//     ready: 'bg-blue-100 text-blue-700',
//     processing: 'bg-yellow-100 text-yellow-700',
//     completed: 'bg-green-100 text-green-700',
//   };

//   const labels = {
//     setup: 'Setting Up',
//     ready: 'Ready',
//     processing: 'Processing',
//     completed: 'Completed',
//   };

//   return (
//     <span
//       className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.setup}`}
//     >
//       {status === 'processing' && (
//         <Loader2 size={10} className="animate-spin" />
//       )}
//       {labels[status] || 'Setting Up'}
//     </span>
//   );
// };

// const PreviousExams = () => {
//   const navigate = useNavigate();
//   const [exams, setExams] = useState([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState('');

//   // Fetch all exams when the page loads
//   const fetchExams = async () => {
//     setIsLoading(true);
//     setError('');
//     try {
//       const response = await api.get('/exams');
//       if (response.data.success) {
//         setExams(response.data.exams);
//       }
//     } catch (err) {
//       setError('Failed to load exams. Please try again.');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchExams();
//   }, []);

//   // Navigate to the right page based on exam status
//   const handleCardClick = (exam) => {
//     if (exam.status === 'setup' || exam.status === 'ready') {
//       navigate(`/exam/${exam._id}/setup`);
//     } else if (exam.status === 'processing') {
//       navigate(`/exam/${exam._id}/upload`);
//     } else if (exam.status === 'completed') {
//       navigate(`/exam/${exam._id}/results`);
//     }
//   };

//   return (
//     <div className="flex min-h-screen bg-gray-50">

//       {/* Left Sidebar */}
//       <Sidebar />

//       {/* Right Content */}
//       <div className="flex-1 flex flex-col ml-64">

//         {/* Top Bar */}
//         <TopBar pageTitle="Previous Exams" />

//         {/* Main Content */}
//         <div className="flex-1 p-8">

//           {/* ── Loading State ── */}
//           {isLoading && (
//             <div className="flex items-center justify-center h-64">
//               <div className="flex flex-col items-center gap-3">
//                 <Loader2 className="text-blue-600 animate-spin" size={36} />
//                 <p className="text-gray-500 text-sm">Loading exams...</p>
//               </div>
//             </div>
//           )}

//           {/* ── Error State ── */}
//           {!isLoading && error && (
//             <div className="flex items-center justify-center h-64">
//               <div className="text-center">
//                 <AlertCircle className="text-red-400 mx-auto mb-3" size={36} />
//                 <p className="text-red-600 font-medium mb-1">Something went wrong</p>
//                 <p className="text-gray-500 text-sm mb-4">{error}</p>
//                 <button
//                   onClick={fetchExams}
//                   className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
//                 >
//                   Try Again
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* ── Empty State ── */}
//           {!isLoading && !error && exams.length === 0 && (
//             <div className="flex items-center justify-center h-64">
//               <div className="text-center">
//                 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
//                   <Clock className="text-gray-400" size={28} />
//                 </div>
//                 <h3 className="text-gray-700 font-semibold text-lg mb-1">
//                   No exams created yet
//                 </h3>
//                 <p className="text-gray-400 text-sm mb-5">
//                   Create your first exam to get started
//                 </p>
//                 <button
//                   onClick={() => navigate('/')}
//                   className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
//                 >
//                   <PlusCircle size={16} />
//                   Create New Exam
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* ── Exams Grid ── */}
//           {!isLoading && !error && exams.length > 0 && (
//             <>
//               {/* Header row */}
//               <div className="flex items-center justify-between mb-6">
//                 <p className="text-gray-500 text-sm">
//                   {exams.length} exam{exams.length !== 1 ? 's' : ''} found
//                 </p>
//                 <button
//                   onClick={() => navigate('/')}
//                   className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
//                 >
//                   <PlusCircle size={16} />
//                   New Exam
//                 </button>
//               </div>

//               {/* Grid */}
//               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
//                 {exams.map((exam) => (
//                   <div
//                     key={exam._id}
//                     onClick={() => handleCardClick(exam)}
//                     className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-shadow p-5 flex flex-col gap-4"
//                   >
//                     {/* Card Top — title and subject */}
//                     <div>
//                       <h3 className="text-gray-800 font-semibold text-base leading-snug mb-1">
//                         {exam.title}
//                       </h3>
//                       <p className="text-gray-500 text-sm">{exam.subject}</p>
//                     </div>

//                     {/* Card Middle — date and marks */}
//                     <div className="flex items-center gap-4 text-sm text-gray-500">
//                       <span className="flex items-center gap-1.5">
//                         <Calendar size={14} />
//                         {formatDate(exam.date)}
//                       </span>
//                       <span className="flex items-center gap-1.5">
//                         <Award size={14} />
//                         {exam.totalMarks} Marks
//                       </span>
//                     </div>

//                     {/* Card Bottom — status badge */}
//                     <div className="flex items-center justify-between">
//                       <StatusBadge status={exam.status} />
//                       <span className="text-xs text-gray-400">
//                         {formatDate(exam.createdAt)}
//                       </span>
//                     </div>

//                   </div>
//                 ))}
//               </div>
//             </>
//           )}

//         </div>
//       </div>
//     </div>
//   );
// };

// export default PreviousExams;


import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Calendar,
  Award,
  Loader2,
  AlertCircle,
  Clock,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
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

// Helper to format a Date object into 'YYYY-MM-DD' for the <input type="date"> field
// exam.date comes back from MongoDB as a full ISO string — the date input needs
// just the date portion or it won't populate correctly
const toDateInputValue = (dateString) => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  // ── Edit modal state ──────────────────────────────────────
  const [editingExam, setEditingExam] = useState(null); // holds the exam object being edited, or null
  const [editFormData, setEditFormData] = useState({
    title: '',
    subject: '',
    date: '',
    totalMarks: '',
  });
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // ── Delete confirmation state ──────────────────────────────
  const [deletingExam, setDeletingExam] = useState(null); // holds the exam object pending delete, or null
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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

  // ── EDIT: open modal pre-filled with this exam's current values ──
  const openEditModal = (e, exam) => {
    e.stopPropagation(); // don't trigger handleCardClick navigation
    setEditingExam(exam);
    setEditFormData({
      title: exam.title,
      subject: exam.subject,
      date: toDateInputValue(exam.date),
      totalMarks: String(exam.totalMarks),
    });
    setEditFieldErrors({});
    setEditError('');
  };

  const closeEditModal = () => {
    setEditingExam(null);
    setEditFormData({ title: '', subject: '', date: '', totalMarks: '' });
    setEditFieldErrors({});
    setEditError('');
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
    if (editFieldErrors[name]) {
      setEditFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateEditForm = () => {
    const errors = {};
    if (!editFormData.title.trim()) errors.title = 'Exam name is required';
    if (!editFormData.subject.trim()) errors.subject = 'Subject is required';
    if (!editFormData.date) errors.date = 'Date is required';
    if (!editFormData.totalMarks) {
      errors.totalMarks = 'Total marks is required';
    } else if (Number(editFormData.totalMarks) < 1) {
      errors.totalMarks = 'Total marks must be at least 1';
    }
    setEditFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditSubmit = async () => {
    if (!validateEditForm()) return;

    setIsSavingEdit(true);
    setEditError('');

    try {
      const response = await api.put(`/exams/${editingExam._id}`, {
        title: editFormData.title,
        subject: editFormData.subject,
        date: editFormData.date,
        totalMarks: Number(editFormData.totalMarks),
      });

      if (response.data.success) {
        // Update this exam in the local list instead of refetching everything
        setExams((prev) =>
          prev.map((ex) => (ex._id === editingExam._id ? response.data.exam : ex))
        );
        closeEditModal();
      }
    } catch (err) {
      const message =
        err.response?.data?.message || 'Failed to update exam. Please try again.';
      setEditError(message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ── DELETE: open confirmation, then call API ──────────────
  const openDeleteConfirm = (e, exam) => {
    e.stopPropagation(); // don't trigger handleCardClick navigation
    setDeletingExam(exam);
    setDeleteError('');
  };

  const closeDeleteConfirm = () => {
    setDeletingExam(null);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError('');

    try {
      const response = await api.delete(`/exams/${deletingExam._id}`);
      if (response.data.success) {
        // Remove the deleted exam from local state instead of refetching everything
        setExams((prev) => prev.filter((ex) => ex._id !== deletingExam._id));
        closeDeleteConfirm();
      }
    } catch (err) {
      const message =
        err.response?.data?.message || 'Failed to delete exam. Please try again.';
      setDeleteError(message);
    } finally {
      setIsDeleting(false);
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
                    {/* Card Top — title, subject, and edit/delete icons */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-gray-800 font-semibold text-base leading-snug mb-1">
                          {exam.title}
                        </h3>
                        <p className="text-gray-500 text-sm">{exam.subject}</p>
                      </div>

                      {/* Edit/Delete icon buttons — stopPropagation so they
                          don't trigger the card's navigate-on-click */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => openEditModal(e, exam)}
                          title="Edit exam"
                          className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={(e) => openDeleteConfirm(e, exam)}
                          title="Delete exam"
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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

      {/* ── Edit Exam Modal ── */}
      {editingExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Edit Exam</h3>
              <button
                onClick={closeEditModal}
                disabled={isSavingEdit}
                className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">

              {/* Exam Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exam Name
                </label>
                <input
                  type="text"
                  name="title"
                  value={editFormData.title}
                  onChange={handleEditChange}
                  placeholder="e.g. Mid-Term Examination 2025"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                {editFieldErrors.title && (
                  <p className="text-red-500 text-xs mt-1">{editFieldErrors.title}</p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  name="subject"
                  value={editFormData.subject}
                  onChange={handleEditChange}
                  placeholder="e.g. Computer Networks"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                {editFieldErrors.subject && (
                  <p className="text-red-500 text-xs mt-1">{editFieldErrors.subject}</p>
                )}
              </div>

              {/* Date and Total Marks side by side */}
              <div className="grid grid-cols-2 gap-3">

                {/* Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={editFormData.date}
                    onChange={handleEditChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  {editFieldErrors.date && (
                    <p className="text-red-500 text-xs mt-1">{editFieldErrors.date}</p>
                  )}
                </div>

                {/* Total Marks */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    name="totalMarks"
                    value={editFormData.totalMarks}
                    onChange={handleEditChange}
                    placeholder="e.g. 100"
                    min="1"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  {editFieldErrors.totalMarks && (
                    <p className="text-red-500 text-xs mt-1">{editFieldErrors.totalMarks}</p>
                  )}
                </div>

              </div>

              {/* API Error */}
              {editError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-red-600 text-sm">{editError}</p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={closeEditModal}
                disabled={isSavingEdit}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={isSavingEdit}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingExam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">

            <div className="px-6 py-5">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                Delete this exam?
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                This will permanently delete{' '}
                <span className="font-medium text-gray-700">"{deletingExam.title}"</span>
                {' '}along with all its questions, student submissions, and evaluation
                records. This action cannot be undone.
              </p>

              {deleteError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4">
                  <p className="text-red-600 text-sm">{deleteError}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={closeDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-400 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Exam'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PreviousExams;