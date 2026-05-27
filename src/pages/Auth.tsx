import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth, googleProvider, appleProvider, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, LogIn, UserPlus, Chrome, AlertCircle, X, Apple, Star, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { Logo } from '../components/Logo';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  
  const navigate = useNavigate();

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Let's get after it";
    if (hour < 18) return "Stay focused, finish strong";
    return "Recover and reset";
  };

  const syncProfile = async (user: any, customName?: string): Promise<boolean> => {
    const profileRef = doc(db, 'users', user.uid);
    const profileSnap = await getDoc(profileRef);
    
    if (!profileSnap.exists()) {
      const initialProfile: UserProfile = {
        uid: user.uid,
        name: customName || user.displayName || 'Athlete',
        email: user.email!,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        age: 26,
        birthDate: '2000-01-01',
        unitSystem: 'imperial',
        gender: 'male',
        heightCm: 0,
        weightKg: 0,
        bodyweightGoalKg: 0,
        primaryGoal: 'muscle_gain',
        selectedGoals: [],
        fitnessLevel: 'beginner',
        availableEquipment: [],
        preferredWorkoutDuration: 45,
        preferredWorkoutDays: [1, 3, 5],
        trainingEnvironment: 'mixed',
        coachNotes: '',
        knownIntolerances: [],
        mealPreferences: [],
        injuryLog: [],
        strengthBaselines: {},
        onboardingComplete: false,
        photoURL: user.photoURL || undefined
      };
      await setDoc(profileRef, initialProfile);
      return false; // New user, onboarding not complete
    } else {
      const profileData = profileSnap.data() as UserProfile;
      const updates: any = {
        lastActiveAt: new Date().toISOString()
      };

      // Sync photoURL if missing in profile but available in auth
      if (user.photoURL && !profileData.photoURL) {
        updates.photoURL = user.photoURL;
      }

      // Sync name if current name is 'Athlete' and provider has a name
      if (profileData.name === 'Athlete' && user.displayName) {
        updates.name = user.displayName;
      }

      await setDoc(profileRef, updates, { merge: true });
      return profileData.onboardingComplete || false;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let onboardingComplete = false;
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onboardingComplete = await syncProfile(userCredential.user);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        onboardingComplete = await syncProfile(userCredential.user, name);
      }
      navigate(onboardingComplete ? '/' : '/onboarding');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const onboardingComplete = await syncProfile(result.user);
      navigate(onboardingComplete ? '/' : '/onboarding');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, appleProvider);
      const onboardingComplete = await syncProfile(result.user);
      navigate(onboardingComplete ? '/' : '/onboarding');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail) return;
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center relative overflow-hidden">
      {/* Premium Background with Image Overlay */}
      <div className="absolute inset-0 z-0">
        <motion.img 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1.2 }}
          transition={{ 
            duration: 20, 
            repeat: Infinity, 
            repeatType: "reverse", 
            ease: "linear" 
          }}
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=1920" 
          alt="Athlete Training"
          className="w-full h-full object-cover opacity-30 blur-[2px]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-black via-brand-black/80 to-brand-black" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-pink/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-gold/10 blur-[150px] rounded-full animate-pulse delay-700" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md z-10 px-6 space-y-12"
      >
        {/* Instant Emotional Hook */}
        <div className="text-center space-y-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Logo size="md" className="mb-6" />
          </motion.div>
          
          <div className="space-y-3">
            <h1 className="text-5xl font-display font-black text-white uppercase tracking-tighter italic leading-none">
              Your Entire<br />
              Fitness Universe.<br />
              <span className="text-brand-gold">One App.</span>
            </h1>
            <p className="text-white/60 text-base font-medium tracking-tight max-w-[280px] mx-auto">
              Strength. Focus. Recovery — in one system.
            </p>
          </div>
        </div>

        {/* Social Proof - Join 120k athletes */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-4"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex -space-x-3">
              {[
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100&h=100',
                'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=100&h=100',
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100&h=100',
                'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100&h=100'
              ].map((url, i) => (
                <motion.div 
                  key={i}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.6 + (i * 0.1) }}
                  className="w-10 h-10 rounded-full border-2 border-brand-black bg-white/10 overflow-hidden shadow-xl"
                >
                  <img src={url} alt="Athlete" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </motion.div>
              ))}
            </div>
            <p className="text-[11px] font-black text-white/50 uppercase tracking-[0.2em]">
              Join <span className="text-white">120,000+ athletes</span> • 4.9★ rating
            </p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {!showEmailForm ? (
            <motion.div 
              key="social-login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <button 
                onClick={handleAppleSignIn}
                className="w-full bg-white text-brand-black rounded-2xl py-4 font-display font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-white/90 transition-all active:scale-95 shadow-xl shadow-white/5"
              >
                <Apple className="w-5 h-5" />
                <span>Continue with Apple</span>
              </button>

              <button 
                onClick={handleGoogleSignIn}
                className="w-full bg-white/5 text-white border border-white/10 rounded-2xl py-4 font-display font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"
              >
                <Chrome className="w-5 h-5" />
                <span>Continue with Google</span>
              </button>

              <button 
                onClick={() => setShowEmailForm(true)}
                className="w-full py-4 text-[10px] font-black text-white/40 uppercase tracking-[0.2em] hover:text-white transition-colors"
              >
                Continue with Email
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="email-form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-card p-8 space-y-6 relative"
            >
              <button 
                onClick={() => setShowEmailForm(false)}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex bg-white/5 p-1 rounded-xl">
                <button 
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-brand-pink text-white shadow-lg shadow-brand-pink/20' : 'text-white/40'}`}
                >
                  Login
                </button>
                <button 
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-brand-pink text-white shadow-lg shadow-brand-pink/20' : 'text-white/40'}`}
                >
                  Sign Up
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Athlete Name"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-2">
                    <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Password</label>
                    {isLogin && (
                      <button 
                        type="button"
                        onClick={() => setShowResetModal(true)}
                        className="text-[8px] font-bold text-brand-pink uppercase tracking-widest hover:underline"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                    <AlertCircle className="w-4 h-4" />
                    <span>{error}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-4"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      <span>{isLogin ? 'Access Hub' : 'Create Account'}</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Embedded Value Reminder */}
        <div className="text-center space-y-8">
          <div className="space-y-2">
            <p className="text-[11px] font-black text-white uppercase tracking-[0.2em] italic">
              Day 1 starts now.
            </p>
            <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.1em]">
              Built for athletes who refuse average
            </p>
          </div>
          
          <div className="flex items-center justify-center gap-6 text-[9px] font-black text-white/30 uppercase tracking-[0.15em]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
              <span>Hyper-personalized training</span>
            </div>
            <div className="w-1 h-1 rounded-full bg-white/10" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Secure by design</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-full max-w-md p-8 space-y-6 relative"
            >
              <button 
                onClick={() => setShowResetModal(false)}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter italic">Reset Access</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Enter your email to receive a recovery link</p>
              </div>

              {resetSent ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Mail className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-sm text-white/60">Recovery link sent to your inbox.</p>
                  <button onClick={() => setShowResetModal(false)} className="btn-primary w-full">Back to Login</button>
                </div>
              ) : (
                <div className="space-y-4">
                  <input 
                    type="email" 
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                  />
                  <button onClick={handleResetPassword} className="btn-primary w-full py-4">Send Link</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
