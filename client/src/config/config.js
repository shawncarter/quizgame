/**
 * Application Configuration
 * Centralizes all configuration values and environment variables
 */

// Base URLs for API and Socket connections
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
export const API_URL = import.meta.env.VITE_API_URL || `${SERVER_URL}/api`;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || SERVER_URL;

// Feature flags
export const SUPPRESS_404_ERRORS = import.meta.env.VITE_SUPPRESS_404_ERRORS === 'true';
export const ENABLE_DEBUG = import.meta.env.VITE_ENABLE_DEBUG === 'true';

// Determine if we're in development mode
export const IS_DEV = import.meta.env.DEV;

// Get the base URL for the application (for QR codes, etc.)
export const getBaseUrl = () => {
  console.log('🔍 getBaseUrl() called');
  console.log('Environment check:');
  console.log('  VITE_APP_URL:', import.meta.env.VITE_APP_URL);
  console.log('  VITE_SERVER_URL:', import.meta.env.VITE_SERVER_URL);
  console.log('  window.location.origin:', window.location.origin);

  // For QR codes, we should always use the environment variable if available
  // This ensures mobile devices can connect properly
  if (import.meta.env.VITE_APP_URL) {
    console.log('✅ Using VITE_APP_URL:', import.meta.env.VITE_APP_URL);
    return import.meta.env.VITE_APP_URL;
  }

  // If no APP_URL is set, use SERVER_URL without the API path
  if (import.meta.env.VITE_SERVER_URL) {
    // Extract the base URL (protocol + host) from SERVER_URL
    const serverUrl = import.meta.env.VITE_SERVER_URL;
    // Return the server URL without any path components
    const cleanUrl = serverUrl.replace(/\/api\/?$/, '');
    console.log('⚠️ Using VITE_SERVER_URL (cleaned):', cleanUrl);
    return cleanUrl;
  }

  // Fallback to window.location.origin
  console.log('❌ Fallback to window.location.origin:', window.location.origin);
  return window.location.origin;
};

// Export a default config object with all settings
export default {
  SERVER_URL,
  API_URL,
  SOCKET_URL,
  SUPPRESS_404_ERRORS,
  ENABLE_DEBUG,
  IS_DEV,
  getBaseUrl
};
