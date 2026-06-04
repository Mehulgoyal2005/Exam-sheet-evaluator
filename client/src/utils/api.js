import axios from 'axios';

// Create an axios instance with a base URL
// All API calls use this instance so we never repeat the base URL
// VITE_API_URL is set in client/.env as http://localhost:5000/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// REQUEST INTERCEPTOR
// Runs before every outgoing API call
// Reads the token from localStorage and attaches it to the Authorization header
// This means we never have to manually add the token in our controllers or pages
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('professorToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// RESPONSE INTERCEPTOR
// Runs after every incoming response
// If the server returns 401 (unauthorized), it means the token is invalid or expired
// We clear the token and redirect to login
api.interceptors.response.use(
  (response) => {
    // Successful response — just return it unchanged
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token is invalid or expired
      // Clear it from localStorage and force the professor to log in again
      localStorage.removeItem('professorToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;