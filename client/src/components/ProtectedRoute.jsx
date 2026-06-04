import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // While we are checking localStorage and calling /api/auth/me
  // show a loading spinner so the page doesn't flash to /login incorrectly
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — send to login page
  // replace={true} replaces the history entry so the back button
  // does not bring them back to the protected page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace={true} />;
  }

  // Authenticated — render the actual page
  return children;
};

export default ProtectedRoute;