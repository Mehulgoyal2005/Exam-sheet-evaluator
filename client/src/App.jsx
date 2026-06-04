import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CreateExam from './pages/CreateExam';
import PreviousExams from './pages/PreviousExams';

// ─── PLACEHOLDER PAGES ───────────────────────────────────
const ExamSetup = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-800">Exam Setup</h1>
      <p className="text-gray-500 mt-2">Module 5 will build this page</p>
    </div>
  </div>
);

const UploadSheets = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-800">Upload Student Sheets</h1>
      <p className="text-gray-500 mt-2">Module 7 will build this page</p>
    </div>
  </div>
);

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
// If already logged in and visiting /login or /signup, redirect to home
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
      {/* Public routes — redirect to home if already logged in */}
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