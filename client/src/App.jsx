// client/src/App.jsx

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CreateExam from './pages/CreateExam';
import PreviousExams from './pages/PreviousExams';
import ExamSetup from './pages/ExamSetup';
import UploadSheets from './pages/UploadSheets';

// ─── PLACEHOLDER PAGES ───────────────────────────────────
// These will be replaced in their respective modules
const ExamResults = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-800">Exam Results</h1>
      <p className="text-gray-500 mt-2">Module 11 will build this page</p>
    </div>
  </div>
);

const StudentReport = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-800">Student Report</h1>
      <p className="text-gray-500 mt-2">Module 10 will build this page</p>
    </div>
  </div>
);

// ─── PUBLIC ROUTE WITH REDIRECT ───────────────────────────
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
};

// ─── APP ROUTES ───────────────────────────────────────────
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <CreateExam />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam/:examId/setup"
        element={
          <ProtectedRoute>
            <ExamSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam/:examId/upload"
        element={
          <ProtectedRoute>
            <UploadSheets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam/:examId/results"
        element={
          <ProtectedRoute>
            <ExamResults />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam/:examId/student/:submissionId"
        element={
          <ProtectedRoute>
            <StudentReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/previous-exams"
        element={
          <ProtectedRoute>
            <PreviousExams />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────
const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;