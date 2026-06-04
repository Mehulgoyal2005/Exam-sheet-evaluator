import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';

// ─── PLACEHOLDER PAGES ───────────────────────────────────
// These are temporary components so the router does not crash
// We will replace each one with the real page in later modules

const CreateExam = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-800">Create Exam</h1>
      <p className="text-gray-500 mt-2">Module 3 will build this page</p>
    </div>
  </div>
);

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

const PreviousExams = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-800">Previous Exams</h1>
      <p className="text-gray-500 mt-2">Module 11 will build this page</p>
    </div>
  </div>
);

// ─── LOGIN ROUTE WITH REDIRECT ────────────────────────────
// If professor is already logged in and visits /login,
// redirect them to home instead of showing login page again
const LoginRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Login />;
};

// ─── APP ROUTES ───────────────────────────────────────────
const AppRoutes = () => {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginRoute />} />

      {/* Protected routes — redirects to /login if not authenticated */}
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

      {/* Catch-all — any unknown URL goes to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────
// AuthProvider must be outermost so every component can access auth state
// BrowserRouter must wrap all Route components
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