import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

// Create the context object
// This is what components will import to read auth state
const AuthContext = createContext(null);

// Provider component — wraps the whole app in App.jsx
// Every component inside this provider can access auth state
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // isAuthenticated is just a convenient boolean derived from user state
  const isAuthenticated = user !== null;

  // On app mount, check if there is a saved token in localStorage
  // If yes, verify it is still valid by calling /api/auth/me
  // This is what keeps the professor logged in after a page refresh
  useEffect(() => {
    const checkExistingToken = async () => {
      const savedToken = localStorage.getItem('professorToken');

      if (!savedToken) {
        // No token saved — professor needs to log in
        setIsLoading(false);
        return;
      }

      try {
        // Call /api/auth/me — the api.js interceptor will automatically
        // attach the token from localStorage to this request
        const response = await api.get('/auth/me');

        if (response.data.success) {
          setUser(response.data.user);
          setToken(savedToken);
        }
      } catch (error) {
        // Token is invalid or expired — clean up
        localStorage.removeItem('professorToken');
        setUser(null);
        setToken(null);
      } finally {
        // Whether success or failure, we are done loading
        setIsLoading(false);
      }
    };

    checkExistingToken();
  }, []);

  // Login function called from the Login page
  // Takes email and password, calls the API, saves token on success
  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });

    if (response.data.success) {
      const { token: newToken, user: newUser } = response.data;

      // Save token to localStorage so it survives page refreshes
      localStorage.setItem('professorToken', newToken);

      setToken(newToken);
      setUser(newUser);
    }

    // If the request fails, axios throws an error
    // The Login page catches that error and shows it to the professor
  };

  // Logout function — clears everything
  const logout = () => {
    localStorage.removeItem('professorToken');
    setUser(null);
    setToken(null);
    // Navigation is handled by ProtectedRoute — once user is null,
    // any protected page will redirect to /login automatically
  };

  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook — makes importing cleaner in components
// Instead of: import { useContext } and import AuthContext separately
// You just do: import { useAuth } from '../context/AuthContext'
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
};

export default AuthContext;