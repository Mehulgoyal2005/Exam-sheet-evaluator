import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, X, Loader2 } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import TopBar from '../components/Layout/TopBar';
import api from '../utils/api';

const CreateExam = () => {
  const navigate = useNavigate();

  // Controls whether the modal popup is visible
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Stores all the form field values as a single object
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    date: '',
    totalMarks: '',
    defaultScheme: 'medium',
  });

  // Tracks loading state while the API call is in flight
  const [isLoading, setIsLoading] = useState(false);

  // Stores the API-level error message (e.g. server error)
  const [error, setError] = useState('');

  // Tracks per-field validation errors
  const [fieldErrors, setFieldErrors] = useState({});

  // Updates a single field in formData when the professor types
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear the field error for this field as soon as they start typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Resets everything and closes the modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      title: '',
      subject: '',
      date: '',
      totalMarks: '',
      defaultScheme: 'medium',
    });
    setError('');
    setFieldErrors({});
  };

  // Validates all required fields — returns true if valid, false if not
  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Exam name is required';
    if (!formData.subject.trim()) errors.subject = 'Subject is required';
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.totalMarks) {
      errors.totalMarks = 'Total marks is required';
    } else if (Number(formData.totalMarks) < 1) {
      errors.totalMarks = 'Total marks must be at least 1';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Called when professor clicks Create Exam inside the modal
  const handleSubmit = async () => {
    if (!validate()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/exams', {
        title: formData.title,
        subject: formData.subject,
        date: formData.date,
        totalMarks: Number(formData.totalMarks),
        defaultScheme: formData.defaultScheme,
      });

      if (response.data.success) {
        const examId = response.data.exam._id;
        handleCloseModal();
        // Navigate to exam setup page — built in Module 5
        navigate(`/exam/${examId}/setup`);
      }
    } catch (err) {
      const message =
        err.response?.data?.message || 'Failed to create exam. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Left Sidebar */}
      <Sidebar />

      {/* Right Content — offset by sidebar width */}
      <div className="flex-1 flex flex-col ml-64">

        {/* Top Bar */}
        <TopBar pageTitle="Create Exam" />

        {/* Main Content Area */}
        <div className="flex-1 flex items-center justify-center p-8">

          {/* Centered Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-md text-center">

            {/* Plus Icon Circle */}
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <PlusCircle className="text-blue-600" size={32} />
            </div>

            {/* Heading */}
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              Start a New Exam
            </h2>

            {/* Subtext */}
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              Upload question papers and automatically evaluate student answer
              sheets using AI
            </p>

            {/* Create Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors flex items-center gap-2 mx-auto"
            >
              <PlusCircle size={18} />
              Create New Exam
            </button>

          </div>
        </div>
      </div>

      {/* ── Modal Overlay ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">

          {/* Modal Card */}
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800">Create New Exam</h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
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
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g. Mid-Term Examination 2025"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                {fieldErrors.title && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.title}</p>
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
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="e.g. Computer Networks"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                {fieldErrors.subject && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.subject}</p>
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
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  {fieldErrors.date && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.date}</p>
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
                    value={formData.totalMarks}
                    onChange={handleChange}
                    placeholder="e.g. 100"
                    min="1"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                  {fieldErrors.totalMarks && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.totalMarks}</p>
                  )}
                </div>

              </div>

              {/* Default Marking Scheme */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Marking Scheme
                </label>
                <select
                  name="defaultScheme"
                  value={formData.defaultScheme}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white"
                >
                  <option value="easy">Easy — Award marks for similar meaning</option>
                  <option value="medium">Medium — Key concepts must be present</option>
                  <option value="difficult">Difficult — Must closely match model answer</option>
                </select>
                <p className="text-gray-400 text-xs mt-1">
                  You can override this per question in the next step.
                </p>
              </div>

              {/* API Error */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">

              {/* Cancel */}
              <button
                onClick={handleCloseModal}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              {/* Create Exam */}
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Exam'
                )}
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CreateExam;