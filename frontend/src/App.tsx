import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { AudioProvider } from './context/AudioContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { VoterDashboard } from './pages/voter/VoterDashboard';
import { BallotPage } from './pages/voter/BallotPage';
import { SuccessPage } from './pages/voter/SuccessPage';

// Route Guards
const ProtectedRoute: React.FC<{ children: React.ReactElement; requiredRole?: 'ADMIN' | 'VOTER' }> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '5rem' }}>Verifying security session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppContent: React.FC = () => {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Voter Routes */}
          <Route
            path="/voter"
            element={
              <ProtectedRoute requiredRole="VOTER">
                <VoterDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/voter/ballot"
            element={
              <ProtectedRoute requiredRole="VOTER">
                <BallotPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/voter/success"
            element={
              <ProtectedRoute requiredRole="VOTER">
                <SuccessPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AudioProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </AuthProvider>
        </AudioProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
