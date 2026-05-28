import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../components/SupabaseProvider';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { 
  format, 
  subDays, 
  isSameDay, 
  startOfDay, 
  differenceInDays, 
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths
} from 'date-fns';
import { Flame, Zap, Clock, Dumbbell, ChevronRight, ChevronLeft, Activity, Moon, Battery, Wind, Trophy, ArrowUpRight, CircleCheck as CheckCircle2, X, Scale, Footprints, Calendar as CalendarIcon } from 'lucide-react';
import { WorkoutSession, Achievement, DailyLog, DailyWorkoutState } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  calculateReadinessScore, 
  getReadinessAdjustments, 
  getReadinessColor, 
  getSliderDescriptor,
  getOptimalSleepRange
} from '../services/readinessEngine';
import { calculateDailyNutrition, calculateTrendAdjustedNutrition } from '../services/nutritionEngine';
import { generateWorkout } from '../services/workoutGenerationService';
import { BottomNav } from '../components/BottomNav';
import { useDailyLog } from '../hooks/useDailyLog';
import { useActiveProgram } from '../hooks/useActiveProgram';
import { useDailyWorkout } from '../hooks/useDailyWorkout';
import { ensureDailyWorkoutState, swapWorkoutStates } from '../services/workoutSynchronizationService';
import { useUserProfile } from '../hooks/useUserProfile';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { StatCard } from '../components/ui/StatCard';
import { ProgressRing } from '../components/ui/ProgressRing';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/utils';
import { formatWeight, formatHeight } from '../lib/units';

export const Home: React.FC = () => {
  const { user } = useSupabase();
  const { profile, loading: profileLoading, updateProfile } = useUserProfile();
  const { log: todayLog, loading: logLoading, setLog } = useDailyLog();
  const { activeProgram, loading: programLoading, updateProgram } = useActiveProgram();
  const { workoutState, loading: workoutLoading } = useDailyWorkout();
  const [achievements, setAchievements] = React.useState<Achievement[]>([]);
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [streak, setStreak] = useState<number>(0);
  const [isCalculatingStreak, setIsCalculatingStreak] = useState(false);
  const [selectedSwapDate, setSelectedSwapDate] = useState<Date | null>(null);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(new Date());
  const [calendarStates, setCalendarStates] = useState<DailyWorkoutState[]>([]);

  const calendarDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(currentCalendarMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentCalendarMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentCalendarMonth]);

  // Show loading state if profile is not yet loaded
  if (profileLoading || !profile) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-16 h-16 border-4 border-brand-pink/20 border-t-brand-pink rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-bold uppercase tracking-widest">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Fetch workout states for the calendar month
  useEffect(() => {
    if (!user || !showSwapModal) return;

    const start = format(startOfMonth(currentCalendarMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentCalendarMonth), 'yyyy-MM-dd');

    const fetchStates = async () => {
      try {
        const { data, error } = await supabase
          .from('daily_workout_states')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', start)
          .lte('date', end);

        if (error) throw error;
        if (data) {
          setCalendarStates(data as DailyWorkoutState[]);
        }
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, 'daily_workout_states');
      }
    };

    fetchStates();

    const channel = supabase
      .channel(`daily_workout_states:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_workout_states', filter: `user_id=eq.${user.id}` }, () => {
        fetchStates();
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, currentCalendarMonth, showSwapModal]);
  
  // Daily Check-In form state
  const [readinessForm, setReadinessForm] = useState({
    sleepHours: 7.5,
    sleepQuality: 4,
    sorenessLevel: 5, // 5 is best (Fresh)
    energyLevel: 4,
    stressLevel: 5, // 5 is best (Relaxed)
    weight: 0
  });

  const [weightStats, setWeightStats] = useState<{
    current: number;
    change: number;
    avg7Day: number;
  } | null>(null);

  // Sync weight from profile
  React.useEffect(() => {
    if (profile?.weightKg && readinessForm.weight === 0) {
      setReadinessForm(prev => ({ ...prev, weight: profile.weightKg }));
    }
  }, [profile]);

  // Fetch weight stats
  React.useEffect(() => {
    if (!user || !profile) return;

    const fetchWeightStats = async () => {
      try {
        const { data, error } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(14);

        if (error) throw error;

        if (data && data.length > 0) {
          const logs = data as any[];
          const current = logs[0].weight_kg || profile.weightKg;
          let change = 0;

          // Find the most recent log before today that has weight
          const previousWithWeight = logs.slice(1).find(l => l.weight_kg !== undefined && l.weight_kg !== null);
          if (logs[0].weight_kg && previousWithWeight?.weight_kg) {
            change = logs[0].weight_kg - previousWithWeight.weight_kg;
          }

          // Calculate 7-day average
          const last7Days = logs.slice(0, 7);
          const weights7Day = last7Days.filter(l => l.weight_kg !== undefined && l.weight_kg !== null).map(l => l.weight_kg);
          const avg7Day = weights7Day.length > 0
            ? weights7Day.reduce((a: number, b: number) => a + b, 0) / weights7Day.length
            : profile.weightKg;

          setWeightStats({ current, change, avg7Day });
        } else {
          setWeightStats({ current: profile.weightKg, change: 0, avg7Day: profile.weightKg });
        }
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, 'daily_logs');
      }
    };

    fetchWeightStats();

    const channel = supabase
      .channel(`daily_logs:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs', filter: `user_id=eq.${user.id}` }, () => {
        fetchWeightStats();
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  const liveScore = profile ? calculateReadinessScore(
    readinessForm.sleepHours,
    readinessForm.sleepQuality,
    readinessForm.sorenessLevel,
    readinessForm.energyLevel,
    readinessForm.stressLevel,
    profile
  ) : { total: 0, status: 'Stable' as const };

  const navigate = useNavigate();
  const { toast } = useToast();

  // Ensure Daily Workout State exists
  React.useEffect(() => {
    if (user && activeProgram && !workoutLoading && !workoutState) {
      ensureDailyWorkoutState(user.uid, new Date(), activeProgram);
    }
  }, [user, activeProgram, workoutLoading, workoutState]);

  // Sync streak from profile
  React.useEffect(() => {
    if (profileLoading) return;
    
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    
    if (profile?.currentStreak !== undefined) {
      const lastWorkout = profile.lastWorkoutDate;
      const isValid = lastWorkout === todayStr || lastWorkout === yesterdayStr;
      setStreak(isValid ? profile.currentStreak : 0);
    } else if (user && profile && !isCalculatingStreak) {
      // Initialize streak if missing
      calculateStreak();
    }
  }, [profile, profileLoading, user]);

  // Streak Calculation
  const calculateStreak = async () => {
    if (!user || isCalculatingStreak) return;
    setIsCalculatingStreak(true);

    try {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(365);

      if (error) throw error;

      const logs = (data || []) as any[];
      let currentStreak = 0;
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // Start checking from yesterday
      let checkDate = subDays(new Date(), 1);

      while (true) {
        const dateStr = format(checkDate, 'yyyy-MM-dd');
        const log = logs.find(l => l.date === dateStr);

        if (log && log.workout_completed) {
          currentStreak++;
          checkDate = subDays(checkDate, 1);
        } else {
          break;
        }

        if (currentStreak >= 365) break;
      }

      // Add today if completed
      const todayLogData = logs.find(l => l.date === todayStr);
      let lastWorkoutDate = undefined;
      if (todayLogData && todayLogData.workout_completed) {
        currentStreak++;
        lastWorkoutDate = todayStr;
      } else if (currentStreak > 0) {
        // Find the most recent workout date
        const mostRecentLog = logs.find(l => l.workout_completed);
        lastWorkoutDate = mostRecentLog?.date;
      }

      setStreak(currentStreak);

      // Update profile
      const updates: any = { current_streak: currentStreak };
      if (lastWorkoutDate) {
        updates.last_workout_date = lastWorkoutDate;
      }
      await updateProfile(updates);
    } catch (error) {
      console.error('Error calculating streak:', error);
    } finally {
      setIsCalculatingStreak(false);
    }
  };

  React.useEffect(() => {
    if (!user) return;

    const fetchAchievements = async () => {
      try {
        const { data, error } = await supabase
          .from('achievements')
          .select('*')
          .eq('user_id', user.id)
          .order('earned_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        if (data) {
          // Convert snake_case to camelCase for frontend
          const normalizedData = data.map((d: any) => ({
            id: d.id,
            achievementId: d.achievement_id,
            name: d.name,
            description: d.description,
            earnedAt: d.earned_at,
            userId: d.user_id
          }));
          setAchievements(normalizedData as Achievement[]);
        }
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, 'achievements');
      }
    };

    fetchAchievements();

    const channel = supabase
      .channel(`achievements:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'achievements', filter: `user_id=eq.${user.id}` }, () => {
        fetchAchievements();
      });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLogReadiness = async () => {
    if (!user || !profile || !activeProgram) return;
    const { total, status } = calculateReadinessScore(
      readinessForm.sleepHours,
      readinessForm.sleepQuality,
      readinessForm.sorenessLevel,
      readinessForm.energyLevel,
      readinessForm.stressLevel,
      profile
    );
    
    let nutrition = calculateDailyNutrition(
      profile,
      profile.preferredWorkoutDays?.length || 0,
      0, // Average steps placeholder
      total
    );

    // Apply trend-based adjustments
    nutrition = calculateTrendAdjustedNutrition(nutrition, profile, weightStats);

    const logData: Partial<DailyLog> = {
      readinessScore: total,
      readinessStatus: status,
      sleepHours: readinessForm.sleepHours,
      sleepQuality: readinessForm.sleepQuality,
      sorenessLevel: readinessForm.sorenessLevel,
      energyLevel: readinessForm.energyLevel,
      stressLevel: readinessForm.stressLevel,
      weightKg: readinessForm.weight,
      calorieBudget: nutrition.calories,
      proteinTargetG: nutrition.proteinG,
      carbTargetG: nutrition.carbsG,
      fatTargetG: nutrition.fatG,
      caloriesConsumed: 0,
      proteinConsumedG: 0,
      carbsConsumedG: 0,
      fatConsumedG: 0,
      mealLog: [],
      waterGlasses: 0,
      stepCount: 0,
      activeCaloriesBurned: 0,
      workoutCompleted: false
    };

    try {
      await setLog(logData);
      await updateProfile({ weightKg: readinessForm.weight });
      setShowReadinessModal(false);
      toast('Daily check-in logged. You can now generate your workout.', 'success');
    } catch (error) {
      console.error('Error logging readiness:', error);
      toast('Failed to log readiness. Please try again.', 'error');
    }
  };

  const handleGenerateWorkout = async () => {
    if (!user || !profile || !activeProgram || !todayLog) return;

    try {
      setIsGeneratingWorkout(true);

      // Fetch History for Workout Generation
      const last7Days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), i + 1), 'yyyy-MM-dd'));

      const { data: logsData, error: logsError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .in('date', last7Days);

      if (logsError) throw logsError;

      const historyReadiness = (logsData || []).map(d => ({
        date: d.date,
        score: d.readiness_score || 70,
        tier: d.readiness_status || 'Stable'
      }));

      const { data: sessionsData, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .in('date', last7Days);

      if (sessionsError) throw sessionsError;

      const historyWorkouts = (sessionsData || []).map(d => ({
        date: d.date,
        sessionType: d.session_focus,
        completed: d.status === 'completed'
      }));

      // Performance history (simplified for now)
      const historyPerformance = (sessionsData || []).flatMap(d => {
        const exercises = d.exercises || [];
        return exercises.map((ex: any) => ({
          date: d.date,
          exercise: ex.exerciseName || ex.exercise_name,
          weight: ex.sets?.[0]?.weight || 0,
          reps: ex.sets?.[0]?.reps || 0,
          rpe: ex.sets?.[0]?.rpe || 7
        }));
      });

      // Generate the workout on the spot
      const session = await generateWorkout({
        profile,
        program: activeProgram,
        checkIn: {
          sleepHours: todayLog.sleepHours,
          sleepQuality: todayLog.sleepQuality,
          muscleSoreness: todayLog.sorenessLevel,
          energyLevel: todayLog.energyLevel,
          stressLevel: todayLog.stressLevel,
          weight: todayLog.weightKg || profile.weightKg
        },
        history: {
          last7DaysReadiness: historyReadiness,
          last7DaysWorkouts: historyWorkouts,
          last7DaysPerformance: historyPerformance
        },
        equipment: profile.availableEquipment as any || 'Full Gym',
        time: 'Full Session',
        dayName: format(new Date(), 'EEEE')
      });

      // Update the Daily Workout State with generated blocks
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const { error: updateError } = await supabase
        .from('daily_workout_states')
        .update({
          exercise_blocks: session.blocks,
          workout_title: session.sessionFocus,
          workout_focus: session.sessionFocus,
          workout_duration: session.plannedDuration,
          status: 'assigned'
        })
        .eq('user_id', user.id)
        .eq('date', todayStr);

      if (updateError) throw updateError;

      toast(`Workout Generated: Your ${session.sessionFocus} session is ready.`, 'success');

      // Automatically navigate to the workout page
      navigate('/workout');

    } catch (error) {
      console.error('Error generating workout:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('JSON')) {
        toast('Response was interrupted. Please try generating again.', 'error');
      } else {
        toast('Failed to generate your personalized workout. Please try again.', 'error');
      }
    } finally {
      setIsGeneratingWorkout(false);
    }
  };

  const handleLogSmartRest = async () => {
    if (!user) return;
    try {
      await setLog({ 
        isSmartRest: true,
        workoutCompleted: true 
      });
      toast('Smart rest day logged. Consistency maintained!', 'success');
    } catch (error) {
      console.error('Error logging smart rest:', error);
      toast('Failed to log smart rest.', 'error');
    }
  };

  const handleSwapWorkout = async (targetDate: Date) => {
    if (!user || !activeProgram) return;
    setIsSwapping(true);

    try {
      const success = await swapWorkoutStates(user.uid, new Date(), targetDate, activeProgram);
      if (success) {
        setShowSwapModal(false);
        toast('Workout Swapped: Your training schedule has been updated.', 'success');
      } else {
        toast('Swap Failed: Could not swap workouts. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error swapping workout:', error);
      toast('Swap Failed: An error occurred during the swap.', 'error');
    } finally {
      setIsSwapping(false);
    }
  };

  const readinessAdjustments = todayLog?.readinessStatus ? getReadinessAdjustments(todayLog.readinessScore) : null;

  const upcomingSessions = React.useMemo(() => {
    if (!activeProgram?.weeks || !activeProgram.startDate) return [];
    
    const startDate = new Date(activeProgram.startDate);
    const today = startOfDay(new Date());
    const sessions = [];
    
    // Show next 28 days of workouts
    for (let i = 1; i <= 28; i++) {
      const date = addDays(today, i);
      const diffDays = differenceInDays(date, startOfDay(startDate));
      const weekNum = Math.floor(diffDays / 7) + 1;
      const dayName = format(date, 'EEEE');
      
      const weekData = activeProgram.weeks.find(w => w.weekNumber === weekNum);
      const session = weekData?.sessions.find(s => s.dayName === dayName);
      
      if (session && session.sessionType.toLowerCase() !== 'rest') {
        sessions.push({
          ...session,
          date,
          dateStr: format(date, 'MMM d')
        });
      }
    }
    return sessions;
  }, [activeProgram]);

  // Show loading state while fetching critical data
  if (!profile || profileLoading || logLoading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-brand-pink/20 border-t-brand-pink rounded-full animate-spin mx-auto" />
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black pb-32">
      <header className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigate('/profile')}
              className="w-12 h-12 rounded-2xl bg-brand-pink/10 border border-brand-pink/20 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            >
              {profile?.photo_url ? (
                <img
                  src={profile.photo_url}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Dumbbell className="w-6 h-6 text-brand-pink" />
              )}
            </div>
            <div className="space-y-0.5">
              <h1 className="text-xl font-display font-black text-white uppercase tracking-tighter italic leading-none">
                Hey, <span className="text-brand-gold">{profile?.name ? profile.name.split(' ')[0] : 'Athlete'}</span>
              </h1>
              <p className="text-white/40 text-[8px] font-bold uppercase tracking-widest">{format(new Date(), 'EEEE, MMMM do')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
            <Flame className={`w-4 h-4 ${streak > 0 ? 'text-brand-gold fill-brand-gold' : 'text-white/20'}`} />
            <span className={`text-sm font-display font-black italic ${streak > 0 ? 'text-brand-gold' : 'text-white/40'}`}>
              {streak > 0 ? `${streak} DAY STREAK` : 'START YOUR FIRST STREAK'}
            </span>
          </div>
        </div>
      </header>

      <main className="px-6 space-y-10 max-w-4xl mx-auto">
        {/* 1. DAILY CHECK-IN (Top Priority) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Daily Check-In</h3>
            {todayLog?.readinessStatus && (
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Completed</span>
            )}
          </div>
          
          <GlassCard 
            glow={!todayLog?.readinessStatus ? "gold" : undefined}
            className={cn(
              "p-6 border-white/5 transition-all",
              !todayLog?.readinessStatus && "border-brand-gold/30 bg-brand-gold/5"
            )}
          >
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Readiness</span>
                    <p className="text-lg font-display font-black text-white italic">
                      {todayLog?.readinessStatus ? `${todayLog.readinessScore}%` : '--'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Weight</span>
                    <p className="text-lg font-display font-black text-white italic">
                      {profile ? formatWeight(weightStats?.current || profile.weightKg, profile.unitSystem) : '--'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Sleep</span>
                    <p className="text-lg font-display font-black text-white italic">
                      {todayLog?.readinessStatus ? `${todayLog.sleepHours}h` : '--'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Steps</span>
                    <p className="text-lg font-display font-black text-white italic">
                      {todayLog?.readinessStatus ? todayLog.stepCount.toLocaleString() : '0'}
                    </p>
                  </div>
                </div>
                
                {todayLog?.readinessStatus && (
                  <button 
                    onClick={() => setShowReadinessModal(true)}
                    className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-white/5 text-white/40 hover:bg-white/10"
                  >
                    Update Log
                  </button>
                )}
              </div>
              
              <div className="hidden sm:block">
                <ProgressRing 
                  value={todayLog?.readinessStatus ? todayLog.readinessScore : undefined} 
                  size={100} 
                  label="Score"
                />
              </div>
            </div>
          </GlassCard>
        </section>

        {/* 2. TODAY'S FOCUS & ACTION (Primary Action) */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-[10px] font-black text-brand-pink uppercase tracking-[0.2em]">Today's Focus</h3>
            <h2 className="text-2xl font-display font-black text-white uppercase italic tracking-tighter">
              {workoutState ? workoutState.workoutFocus : 'Recovery & Mobility'}
            </h2>
          </div>

          <GlassCard glow="pink" className="p-6 space-y-6 relative overflow-hidden group border-brand-pink/20">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:scale-110 transition-transform -rotate-12">
              <Dumbbell className="w-40 h-40 text-white" />
            </div>

            <div className="space-y-4 relative z-10">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Today's Workout</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-display font-black text-white uppercase italic tracking-tight">
                      {workoutState?.workoutTitle || 'Active Recovery'}
                    </span>
                    <span className="text-white/20 text-xl font-display font-black italic">•</span>
                    <span className="text-sm font-display font-black text-brand-pink uppercase italic">
                      {workoutState?.programPhase || 'Phase 1'}
                    </span>
                  </div>
                </div>
                {todayLog?.readinessStatus && (
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                    todayLog.readinessScore >= 80 ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                    todayLog.readinessScore >= 60 ? "bg-brand-gold/10 text-brand-gold border-brand-gold/20" :
                    "bg-red-500/10 text-red-500 border-red-500/20"
                  )}>
                    {todayLog.readinessStatus} Recovery
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-white/60 uppercase tracking-tight italic">
                  {todayLog?.readinessStatus ? (
                    readinessAdjustments?.reason || "Execute planned session at target intensity"
                  ) : (
                    "Log readiness to personalize today's intensity"
                  )}
                </p>
                
                {/* Simplified Overview */}
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-white/20" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      {workoutState?.workoutDuration || 60} Min
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-white/20" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      {workoutState?.targetIntensity || 'RPE 8'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-white/20" />
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                      {workoutState?.exerciseBlocks?.length || 0} Blocks
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {workoutState?.status === 'completed' || todayLog?.workoutCompleted ? (
                  <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Session Complete</span>
                  </div>
                ) : (!todayLog?.readinessScore || !todayLog?.readinessStatus) ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] text-brand-gold font-bold uppercase tracking-widest italic animate-pulse text-center bg-brand-gold/5 py-3 rounded-xl border border-brand-gold/10">
                      Check-in required to authorize training session
                    </p>
                    <GradientButton 
                      onClick={() => setShowReadinessModal(true)}
                      className="w-full py-4 shadow-[0_0_20px_rgba(255,184,0,0.15)]"
                    >
                      <Activity className="w-4 h-4 fill-brand-black" />
                      <span>Execute Daily Check-In</span>
                    </GradientButton>
                  </div>
                ) : (
                  <>
                    <GradientButton 
                      onClick={() => {
                        if (workoutState?.exerciseBlocks && workoutState.exerciseBlocks.length > 0) {
                          navigate('/workout');
                        } else {
                          handleGenerateWorkout();
                        }
                      }}
                      className="flex-[2] py-4"
                      disabled={isGeneratingWorkout}
                    >
                      <Zap className="w-4 h-4 fill-brand-black" />
                      <span>
                        {isGeneratingWorkout 
                          ? 'Generating...' 
                          : (workoutState?.status === 'assigned' || (workoutState?.exerciseBlocks?.length || 0) > 0)
                            ? 'Start Today\'s Workout' 
                            : 'Generate Today\'s Workout'}
                      </span>
                    </GradientButton>
                    <button 
                      onClick={() => setShowSwapModal(true)}
                      className="flex-1 py-4 bg-white/5 border border-white/10 rounded-2xl text-white/60 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Swap
                    </button>
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        </section>

        {/* 3. TODAY'S STATS */}
        <section className="space-y-4">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Today's Stats</h3>
          <GlassCard className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-brand-pink" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Calories</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-display font-black text-white italic">
                    {todayLog?.caloriesConsumed || 0} <span className="text-[10px] text-white/20">/ {todayLog?.calorieBudget || 0}</span>
                  </p>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-pink transition-all duration-1000"
                      style={{ width: `${Math.min(100, ((todayLog?.caloriesConsumed || 0) / (todayLog?.calorieBudget || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Weight</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-display font-black text-white italic">
                    {profile ? formatWeight(weightStats?.current || profile.weightKg, profile.unitSystem) : '--'}
                  </p>
                  <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                    Avg: {weightStats ? formatWeight(weightStats.avg7Day, profile?.unitSystem || 'imperial') : '--'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Footprints className="w-4 h-4 text-brand-gold" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Steps</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-display font-black text-white italic">
                    {todayLog?.stepCount?.toLocaleString() || '0'}
                  </p>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-gold transition-all duration-1000"
                      style={{ width: `${Math.min(100, ((todayLog?.stepCount || 0) / 10000) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Sleep</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-display font-black text-white italic">
                    {todayLog?.sleepHours || 0}h
                  </p>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-400 transition-all duration-1000"
                      style={{ width: `${Math.min(100, ((todayLog?.sleepHours || 0) / 8) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* 4. ACHIEVEMENTS */}
        <section className="space-y-4 pb-8">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Achievements</h3>
            <Trophy className="w-5 h-5 text-brand-gold" />
          </div>
          <div className="space-y-3">
            {achievements.length > 0 ? (
              achievements.map((ach) => (
                <GlassCard key={ach.id} className="p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-brand-gold/10 rounded-2xl group-hover:scale-110 transition-transform">
                      <Trophy className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-white uppercase tracking-widest">{ach.name}</h5>
                      <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">{ach.description}</p>
                    </div>
                  </div>
                  <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">{format(new Date(ach.earnedAt), 'MMM d')}</span>
                </GlassCard>
              ))
            ) : (
              <GlassCard className="p-6 border-dashed border-white/10">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/5 rounded-2xl">
                    <Trophy className="w-5 h-5 text-white/10" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white/40 uppercase tracking-widest italic">Next Achievement</h5>
                    <p className="text-[10px] text-brand-gold font-bold uppercase tracking-widest">Complete your first workout</p>
                  </div>
                </div>
              </GlassCard>
            )}
          </div>
        </section>
      </main>

      {/* Readiness Modal */}
      <AnimatePresence>
        {showReadinessModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-card w-full max-w-md flex flex-col relative max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-8 pb-4 text-center space-y-2 relative">
                <button 
                  onClick={() => setShowReadinessModal(false)}
                  className="absolute top-4 right-4 p-2 text-white/40 hover:text-white z-10"
                >
                  <X className="w-6 h-6" />
                </button>
                <h3 className="text-3xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Daily Check-In</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Log today's readiness & body stats</p>
                
                {/* Live Score Preview */}
                <div className="pt-4 flex flex-col items-center">
                  <div className="relative">
                    <ProgressRing 
                      value={liveScore.total} 
                      size={100} 
                      label="Score"
                    />
                  </div>
                  <span className={`mt-2 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white/5`} style={{ color: getReadinessColor(liveScore.total) }}>
                    {liveScore.status} Status
                  </span>
                </div>
              </div>

              {/* Scrollable Inputs */}
              <div className="flex-1 overflow-y-auto px-8 py-4 space-y-10 custom-scrollbar">
                {/* Weight Input */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Current Weight</span>
                    </div>
                    <span className="text-xl font-display font-black text-white">
                      {formatWeight(readinessForm.weight, profile?.unitSystem || 'imperial')}
                    </span>
                  </div>
                  <div className="relative pt-2">
                    <input 
                      type="range" 
                      min={profile?.unitSystem === 'imperial' ? 80 : 40} 
                      max={profile?.unitSystem === 'imperial' ? 400 : 200} 
                      step={0.1}
                      value={profile?.unitSystem === 'imperial' ? readinessForm.weight * 2.20462 : readinessForm.weight}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const weightKg = profile?.unitSystem === 'imperial' ? val / 2.20462 : val;
                        setReadinessForm({ ...readinessForm, weight: weightKg });
                      }}
                      className="readiness-slider"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                        {profile?.unitSystem === 'imperial' ? '80 lbs' : '40 kg'}
                      </span>
                      <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">
                        {profile?.unitSystem === 'imperial' ? '400 lbs' : '200 kg'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sleep Hours */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4 text-indigo-400" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Sleep Duration</span>
                    </div>
                    <span className="text-xl font-display font-black text-white">{readinessForm.sleepHours}h</span>
                  </div>
                  <input 
                    type="range" min="4" max="12" step="0.5"
                    value={readinessForm.sleepHours}
                    onChange={(e) => setReadinessForm({ ...readinessForm, sleepHours: parseFloat(e.target.value) })}
                    className="readiness-slider"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Low</span>
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest italic">
                      {profile ? (
                        readinessForm.sleepHours < getOptimalSleepRange(profile).min ? 'Insufficient' : 
                        readinessForm.sleepHours > 10 ? 'Excessive' : 'Optimal'
                      ) : 'Optimal'}
                    </span>
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">High</span>
                  </div>
                </div>

                {/* Sleep Quality */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Battery className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Sleep Quality</span>
                    </div>
                    <span className="text-xl font-display font-black text-white">{readinessForm.sleepQuality}/5</span>
                  </div>
                  <input 
                    type="range" min="1" max="5" step="1"
                    value={readinessForm.sleepQuality}
                    onChange={(e) => setReadinessForm({ ...readinessForm, sleepQuality: parseInt(e.target.value) })}
                    className="readiness-slider"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Terrible</span>
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest italic">
                      {getSliderDescriptor('sleepQuality', readinessForm.sleepQuality)}
                    </span>
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Excellent</span>
                  </div>
                </div>

                {/* Muscle Soreness */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-brand-gold" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Muscle Soreness</span>
                    </div>
                    <span className="text-xl font-display font-black text-white">{readinessForm.sorenessLevel}/5</span>
                  </div>
                  <input 
                    type="range" min="1" max="5" step="1"
                    value={readinessForm.sorenessLevel}
                    onChange={(e) => setReadinessForm({ ...readinessForm, sorenessLevel: parseInt(e.target.value) })}
                    className="readiness-slider"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Max Sore</span>
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest italic">
                      {getSliderDescriptor('sorenessLevel', readinessForm.sorenessLevel)}
                    </span>
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Fresh</span>
                  </div>
                </div>

                {/* Energy Level */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-brand-pink" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Energy Level</span>
                    </div>
                    <span className="text-xl font-display font-black text-white">{readinessForm.energyLevel}/5</span>
                  </div>
                  <input 
                    type="range" min="1" max="5" step="1"
                    value={readinessForm.energyLevel}
                    onChange={(e) => setReadinessForm({ ...readinessForm, energyLevel: parseInt(e.target.value) })}
                    className="readiness-slider"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Drained</span>
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest italic">
                      {getSliderDescriptor('energyLevel', readinessForm.energyLevel)}
                    </span>
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">High</span>
                  </div>
                </div>

                {/* Stress Level */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-white/40" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Stress Level</span>
                    </div>
                    <span className="text-xl font-display font-black text-white">{readinessForm.stressLevel}/5</span>
                  </div>
                  <input 
                    type="range" min="1" max="5" step="1"
                    value={readinessForm.stressLevel}
                    onChange={(e) => setReadinessForm({ ...readinessForm, stressLevel: parseInt(e.target.value) })}
                    className="readiness-slider"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">High Stress</span>
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest italic">
                      {getSliderDescriptor('stressLevel', readinessForm.stressLevel)}
                    </span>
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Relaxed</span>
                  </div>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="p-8 pt-4 bg-brand-surface/50 backdrop-blur-md border-t border-white/5">
                <GradientButton 
                  onClick={handleLogReadiness}
                  className="w-full py-5"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Submit Daily Check-In</span>
                </GradientButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Swap Workout Modal */}
      <AnimatePresence>
        {showSwapModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-lg glass-card p-8 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-3xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Swap Mission</h2>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Select a day from the calendar to swap sessions</p>
                </div>
                <button 
                  onClick={() => setShowSwapModal(false)}
                  className="p-2 bg-white/5 rounded-xl text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Calendar Control */}
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl">
                  <button 
                    onClick={() => setCurrentCalendarMonth(subMonths(currentCalendarMonth, 1))}
                    className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <p className="text-xs font-black text-white uppercase tracking-widest italic">
                    {format(currentCalendarMonth, 'MMMM yyyy')}
                  </p>
                  <button 
                    onClick={() => setCurrentCalendarMonth(addMonths(currentCalendarMonth, 1))}
                    className="p-2 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <div key={`day-label-${i}`} className="text-center py-2">
                      <span className="text-[8px] font-black text-white/20 uppercase">{day}</span>
                    </div>
                  ))}
                  {calendarDays.map((date) => {
                    const isTodayLocal = isSameDay(date, new Date());
                    const isSelected = selectedSwapDate && isSameDay(date, selectedSwapDate);
                    const isOtherMonth = !isSameMonth(date, currentCalendarMonth);
                                       // Logic to find if this day has a workout
                    const dayStr = format(date, 'yyyy-MM-dd');
                    const existingState = calendarStates.find(s => s.date === dayStr);
                    
                    let hasWorkout = false;
                    let sessionInfo = null;

                    if (existingState) {
                      hasWorkout = existingState.status !== 'rest';
                      sessionInfo = {
                        sessionFocus: existingState.workoutFocus || existingState.workoutTitle,
                        sessionType: existingState.programDayType
                      };
                    } else {
                      // Fallback to program logic if state not yet generated
                      const diffDays = activeProgram?.startDate ? differenceInDays(startOfDay(date), startOfDay(new Date(activeProgram.startDate))) : -1;
                      const weekNum = Math.floor(diffDays / 7) + 1;
                      const dayName = format(date, 'EEEE');
                      const weekData = activeProgram?.weeks?.find(w => w.weekNumber === weekNum);
                      const session = weekData?.sessions.find(s => s.dayName === dayName);
                      hasWorkout = session && session.sessionType.toLowerCase() !== 'rest';
                      sessionInfo = session;
                    }

                    return (
                      <button
                        key={date.toISOString()}
                        disabled={isSwapping || isTodayLocal}
                        onClick={() => setSelectedSwapDate(date)}
                        className={cn(
                          "aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all relative group",
                          isSelected ? "bg-brand-pink border-brand-pink text-white" : 
                          isTodayLocal ? "bg-white/10 border-brand-gold text-brand-gold" :
                          hasWorkout ? "bg-white/5 border-white/10 text-white hover:border-brand-pink/50" :
                          "bg-transparent border-transparent text-white/20 hover:bg-white/5",
                          isOtherMonth && !isSelected && "opacity-20"
                        )}
                      >
                        <span className="text-[10px] font-black">{format(date, 'd')}</span>
                        {hasWorkout && !isSelected && (
                          <div className={`w-1 h-1 rounded-full ${isTodayLocal ? 'bg-brand-gold' : 'bg-brand-pink'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Session Details */}
              <AnimatePresence mode="wait">
                {selectedSwapDate ? (() => {
                  const dayStr = format(selectedSwapDate, 'yyyy-MM-dd');
                  const existingState = calendarStates.find(s => s.date === dayStr);
                  
                  let hasWorkout = false;
                  let displayFocus = 'Rest & Recovery';
                  let displayType = 'REST';

                  if (existingState) {
                    hasWorkout = existingState.status !== 'rest';
                    displayFocus = existingState.workoutFocus || existingState.workoutTitle;
                    displayType = existingState.programDayType;
                  } else {
                    const diffDays = activeProgram?.startDate ? differenceInDays(startOfDay(selectedSwapDate), startOfDay(new Date(activeProgram.startDate))) : -1;
                    const weekNum = Math.floor(diffDays / 7) + 1;
                    const dayName = format(selectedSwapDate, 'EEEE');
                    const weekData = activeProgram?.weeks?.find(w => w.weekNumber === weekNum);
                    const session = weekData?.sessions.find(s => s.dayName === dayName);
                    hasWorkout = session && session.sessionType.toLowerCase() !== 'rest';
                    displayFocus = hasWorkout ? session.sessionFocus : 'Rest & Recovery';
                    displayType = hasWorkout ? session.sessionType : 'REST';
                  }

                  return (
                    <motion.div 
                      key={selectedSwapDate.toISOString()}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 pt-4 border-t border-white/5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Selected Session • {format(selectedSwapDate, 'MMM d')}</p>
                          <h4 className="text-xl font-display font-black text-white uppercase italic tracking-tighter">
                            {displayFocus}
                          </h4>
                        </div>
                        {hasWorkout && (
                          <div className="px-3 py-1 bg-brand-pink/10 border border-brand-pink/20 rounded-full">
                            <span className="text-[8px] font-black text-brand-pink uppercase tracking-[0.2em]">{displayType}</span>
                          </div>
                        )}
                      </div>

                      <GradientButton
                        onClick={() => handleSwapWorkout(selectedSwapDate)}
                        disabled={isSwapping || !hasWorkout}
                        className="w-full py-4"
                      >
                        {isSwapping ? 'Executing Swap...' : hasWorkout ? `Swap with ${format(selectedSwapDate, 'EEEE')}` : 'No Session to Swap'}
                      </GradientButton>
                    </motion.div>
                  );
                })() : (
                  <div className="text-center py-6 bg-white/5 rounded-2xl border border-white/5">
                    <CalendarIcon className="w-8 h-8 text-white/10 mx-auto mb-2" />
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Select an active training day to swap</p>
                  </div>
                )}
              </AnimatePresence>

              <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest text-center">
                Today's session will be exchanged with the selected future workout.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
};
