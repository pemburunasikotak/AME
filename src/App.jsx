import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import StudioShell from './components/StudioShell';
import './App.css';

const AUTH_KEY = 'arus_auth_session';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved =
        localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (userData, remember) => {
    setUser(userData);
    const json = JSON.stringify(userData);
    if (remember) {
      localStorage.setItem(AUTH_KEY, json);
    } else {
      sessionStorage.setItem(AUTH_KEY, json);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
    setUser(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<LandingPage user={user} />}
        />
        <Route
          path="/login"
          element={
            !user ? (
              <Login onLogin={handleLogin} />
            ) : (
              <Navigate to="/resistance" replace />
            )
          }
        />
        <Route
          path="/*"
          element={
            user ? (
              <StudioShell onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
