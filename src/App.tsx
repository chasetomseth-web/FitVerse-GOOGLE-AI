import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SupabaseProvider, useSupabase } from './components/SupabaseProvider';
import { ToastProvider } from './components/ui/Toast';
import { Auth } from './pages/AuthSupabase';
import { Onboarding } from './pages/Onboarding';
import { Home } from './pages/Home';
import { Program } from './pages/Program';
import { Coach } from './pages/Coach';
import { Progress } from './pages/Progress';
import { Library } from './pages/Library';
import { Profile } from './pages/Profile';
import { Diet } from './pages/Diet';
import { WorkoutPlayer } from './pages/WorkoutPlayer';
import { BottomNav } from './components/BottomNav';
import { Logo } from './components/Logo';
import { AnimatePresence } from 'motion/react';

import { useUserProfile } from './hooks/useUserProfile';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading, authReady } = useSupabase();
  const { profile, loading: profileLoading } = useUserProfile();
  const location = useLocation();

  if (!authReady || authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <Logo size="xl" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  const isAuthPage = location.pathname === '/auth';
  const isOnboardingPage = location.pathname === '/onboarding';

  if (user && !profile && !profileLoading && !isOnboardingPage && !isAuthPage) {
    return <Navigate to="/onboarding" />;
  }

  if (profile && !profile.onboardingComplete && !isOnboardingPage) {
    return <Navigate to="/onboarding" />;
  }

  const isWorkoutPlayer = location.pathname === '/workout';

  return (
    <div className="min-h-screen bg-brand-black text-white pb-24">
      {children}
      {!isWorkoutPlayer && <BottomNav />}
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-brand-black">
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/program"
            element={
              <ProtectedRoute>
                <Program />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach"
            element={
              <ProtectedRoute>
                <Coach />
              </ProtectedRoute>
            }
          />
          <Route
            path="/diet"
            element={
              <ProtectedRoute>
                <Diet />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <Progress />
              </ProtectedRoute>
            }
          />
          <Route
            path="/library"
            element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workout"
            element={
              <ProtectedRoute>
                <WorkoutPlayer />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <SupabaseProvider>
      <ToastProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ToastProvider>
    </SupabaseProvider>
  );
}
