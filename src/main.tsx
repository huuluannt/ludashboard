import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App';
import './index.css';
import { GOOGLE_CLIENT_ID } from './auth/googleAuth';

// If no client ID is provided, use a dummy one to prevent the provider from crashing,
// but the actual login will fail. A real ID should be put in .env
const clientId = GOOGLE_CLIENT_ID || 'dummy-client-id.apps.googleusercontent.com';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
