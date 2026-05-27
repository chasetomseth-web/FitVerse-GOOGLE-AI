import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Logo } from '../components/Logo';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const syncProfile = async (user: any): Promise<boolean> => {
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      const initialProfile = {
        id: user.id,
        name: 'Athlete',
        email: user.email!,
        onboarding_complete: false,
        unit_system: 'imperial',
        gender: 'male',
        height_cm: 0,
        weight_kg: 0,
        bodyweight_goal_kg: 0,
        primary_goal: 'muscle_gain',
        fitness_level: 'beginner',
        available_equipment: [],
        preferred_workout_duration: 45,
        preferred_workout_days: [1, 3, 5],
        training_environment: 'full_gym',
        coach_notes: '',
        known_intolerances: [],
        meal_preferences: [],
        selected_goals: [],
        photo_url: user.user_metadata?.avatar_url || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert(initialProfile);

      if (insertError) {
        console.error('Error creating profile:', insertError);
        return false;
      }

      return false;
    } else {
      await supabase
        .from('user_profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', user.id);

      return existingProfile.onboarding_complete || false;
    }
  };

  const handleAutoLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // Create a random email for anonymous user
      const randomId = Math.random().toString(36).substring(2, 15);
      const email = `user_${randomId}@fitverse.app`;
      const password = `FitVerse_${randomId}`;

      // Sign up the user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw signUpError;
      if (!data.user) throw new Error('Failed to create user');

      const onboardingComplete = await syncProfile(data.user);
      navigate(onboardingComplete ? '/' : '/onboarding');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center relative overflow-hidden">
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

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 p-3 rounded-xl border border-red-500/20">
            <span>{error}</span>
          </div>
        )}

        <motion.div>
          <button
            onClick={handleAutoLogin}
            disabled={loading}
            className="w-full bg-brand-pink text-white rounded-2xl py-4 font-display font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-brand-pink/90 transition-all active:scale-95 shadow-xl shadow-brand-pink/20"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <span>Get Started</span>
            )}
          </button>
        </motion.div>

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
              <span>Secure by design</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
