import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../components/SupabaseProvider';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { ChevronLeft, ChevronRight, Calendar, Zap, Clock, Dumbbell, CircleCheck as CheckCircle2, Circle, Circle as XCircle, ArrowUpRight, Info, Moon, Play, ChevronDown, ChevronUp, ArrowRight, Activity, X, CircleChevronLeft as ChevronLeftCircle, CircleChevronRight as ChevronRightCircle, Calendar as CalendarIcon, LayoutGrid, List } from 'lucide-react';
import { WorkoutSession, DailyLog, DailyWorkoutState } from '../types';
import { 
  format, 
  isSameDay, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addDays, 
  isAfter, 
  isBefore, 
  startOfDay,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  addMonths,
  subMonths,
  getDay,
  differenceInDays
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { BottomNav } from '../components/BottomNav';
import { useActiveProgram } from '../hooks/useActiveProgram';
import { useUserProfile } from '../hooks/useUserProfile';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { ProgressRing } from '../components/ui/ProgressRing';
import { useToast } from '../components/ui/Toast';
import { ExerciseMedia } from '../components/ExerciseMedia';
import { adaptProgramForNextWeek } from '../services/adaptationService';
import { ensureDailyWorkoutState } from '../services/workoutSynchronizationService';

export const Program: React.FC = () => {
  const { user } = useSupabase();
  const { profile } = useUserProfile();
  const { activeProgram, loading: programLoading } = useActiveProgram();
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<WorkoutSession[]>([]);
  const [dailyLogs, setDailyLogs] = useState<Record<string, DailyLog>>({});
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthWorkouts, setMonthWorkouts] = useState<WorkoutSession[]>([]);
  const [monthLogs, setMonthLogs] = useState<Record<string, DailyLog>>({});
  const [workoutStates, setWorkoutStates] = useState<Record<string, DailyWorkoutState>>({});
  const [isAdapting, setIsAdapting] = useState(false);
  const [showAdaptationModal, setShowAdaptationModal] = useState(false);
  const [adaptationResult, setAdaptationResult] = useState<any>(null);
  const { toast } = useToast();
  
  const navigate = useNavigate();

  const sanitizeExerciseName = (name: string): string => {
    const n = name.toLowerCase().trim();
    if (n === 'arm circles' || n.includes('arm circle')) {
      return 'Air Squat'; // Safe default from library
    }
    return name;
  };

  const handleRunAdaptation = async () => {
    if (!user || !profile || !activeProgram) return;
    setIsAdapting(true);
    try {
      const result = await adaptProgramForNextWeek(profile, activeProgram);
      if (result) {
        setAdaptationResult(result);
        setShowAdaptationModal(true);
        toast("Program Optimized: Your coach has adjusted next week's training.", "success");
      } else {
        toast("Your current plan is already optimal for your progress.", "info");
      }
    } catch (error) {
      console.error("Adaptation Error:", error);
      toast("There was an error adjusting your program. Please try again.", "error");
    } finally {
      setIsAdapting(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);

    // Extend range to include start/end of weeks that overlap with month boundaries
    const fetchStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const fetchEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    setLoadingLogs(true);

    const fetchData = async () => {
      try {
        // Fetch workouts for the month range
        const { data: workoutData, error: workoutError } = await supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', format(fetchStart, 'yyyy-MM-dd'))
          .lte('date', format(fetchEnd, 'yyyy-MM-dd'));

        if (workoutError) throw workoutError;

        const workouts = (workoutData || []).map(d => ({ id: d.id, ...d } as WorkoutSession));
        setMonthWorkouts(workouts);
        setWeeklyWorkouts(workouts.filter(w => {
          const d = new Date(w.date);
          return d >= startOfWeek(new Date(), { weekStartsOn: 1 }) && d <= endOfWeek(new Date(), { weekStartsOn: 1 });
        }));

        // Fetch daily logs
        const { data: logsData, error: logsError } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', format(fetchStart, 'yyyy-MM-dd'))
          .lte('date', format(fetchEnd, 'yyyy-MM-dd'));

        if (logsError) throw logsError;

        const logsMap: Record<string, DailyLog> = {};
        (logsData || []).forEach(d => {
          logsMap[d.date] = d as DailyLog;
        });
        setMonthLogs(logsMap);
        setDailyLogs(logsMap);

        // Fetch daily workout states
        const { data: statesData, error: statesError } = await supabase
          .from('daily_workout_states')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', format(fetchStart, 'yyyy-MM-dd'))
          .lte('date', format(fetchEnd, 'yyyy-MM-dd'));

        if (statesError) throw statesError;

        const statesMap: Record<string, DailyWorkoutState> = {};
        (statesData || []).forEach(d => {
          statesMap[d.date] = d as DailyWorkoutState;
        });
        setWorkoutStates(statesMap);

        setLoadingLogs(false);
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, 'workout_sessions/daily_logs/daily_workout_states');
        setLoadingLogs(false);
      }
    };

    fetchData();

    // Subscribe to real-time updates
    const workoutChannel = supabase
      .channel(`workout_sessions:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_sessions', filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    const logsChannel = supabase
      .channel(`daily_logs:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs', filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    const statesChannel = supabase
      .channel(`daily_workout_states:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_workout_states', filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(workoutChannel);
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(statesChannel);
    };
  }, [user, currentMonth]);

  // Ensure states exist for the current view range
  useEffect(() => {
    if (!user || !activeProgram) return;

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const fetchStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const fetchEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    const days = eachDayOfInterval({ start: fetchStart, end: fetchEnd });
    
    // We only initialize if they don't exist in our current map
    const relevantDays = days.filter(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      return !workoutStates[dateStr];
    });

    relevantDays.forEach(day => {
      ensureDailyWorkoutState(user.uid, day, activeProgram);
    });
  }, [user, activeProgram, currentMonth, workoutStates]);

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
  });

  const daysInWeek = eachDayOfInterval({
    start: startOfWeek(new Date(), { weekStartsOn: 1 }),
    end: endOfWeek(new Date(), { weekStartsOn: 1 })
  });

  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayState = workoutStates[todayStr];
  const tomorrowState = workoutStates[format(tomorrow, 'yyyy-MM-dd')];

  const currentPhase = activeProgram?.phases?.find(p => 
    p.phaseNumber === Math.ceil((activeProgram.currentWeek || 1) / 4)
  );

  const getDayStatus = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const state = workoutStates[dateStr];
    const workout = monthWorkouts.find(w => w.date === dateStr);

    if (workout?.status === 'completed') return 'completed';
    if (state) {
      if (state.status === 'completed') return 'completed';
      if (state.status === 'skipped') return 'missed';
      if (state.status === 'rest') return 'recovery';
      if (state.status === 'scheduled') return 'scheduled';
      if (state.status === 'in-progress') return 'today';
    }
    return 'none';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'missed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'recovery': return <Zap className="w-4 h-4 text-emerald-500" />;
      case 'scheduled': return <Clock className="w-4 h-4 text-brand-gold" />;
      case 'today': return <Play className="w-4 h-4 text-brand-gold fill-brand-gold" />;
      default: return <Circle className="w-4 h-4 text-white/10" />;
    }
  };

  if (programLoading || loadingLogs) {
    return (
      <div className="min-h-screen bg-brand-black pb-32">
        <header className="p-6 space-y-4">
          <SkeletonLoader className="h-10 w-48 mb-2" />
          <SkeletonLoader className="h-4 w-32" />
        </header>
        <main className="px-6 space-y-8">
          <section className="space-y-4">
            <SkeletonLoader className="h-6 w-32" />
            <SkeletonLoader className="h-48 w-full rounded-3xl" />
          </section>
          <section className="space-y-4">
            <SkeletonLoader className="h-6 w-32" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <SkeletonLoader key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          </section>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black pb-32">
      <header className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all border border-white/5"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="space-y-1">
              <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter italic leading-none">Training Plan</h1>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Adaptive Programming</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setViewMode('month')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'month' ? 'bg-brand-pink text-white shadow-lg shadow-brand-pink/20' : 'text-white/40 hover:text-white'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('week')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'week' ? 'bg-brand-pink text-white shadow-lg shadow-brand-pink/20' : 'text-white/40 hover:text-white'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <div 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-xl bg-brand-pink/10 border border-brand-pink/20 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            >
              {profile?.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt={profile.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <CalendarIcon className="w-5 h-5 text-brand-pink" />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 space-y-8 max-w-7xl mx-auto">
        {viewMode === 'month' ? (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <button 
                    onClick={handlePrevMonth} 
                    className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all border border-white/5"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl min-w-[140px] text-center">
                    <h2 className="text-lg font-display font-black text-white uppercase italic tracking-tighter">
                      {format(currentMonth, 'MMMM yyyy')}
                    </h2>
                  </div>
                  <button 
                    onClick={handleNextMonth} 
                    className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all border border-white/5"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleToday}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Today
                </button>
                <GradientButton className="px-4 py-2 text-[10px]">
                  <CalendarIcon className="w-3 h-3" />
                  <span>Schedule</span>
                </GradientButton>
              </div>
            </div>

            <div className="glass-card overflow-hidden border-white/5">
              <div className="grid grid-cols-7 border-b border-white/5 bg-white/5">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                  <div key={day} className="py-3 text-center">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{day}</span>
                  </div>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentMonth.toString()}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-7 auto-rows-fr"
                >
                    {calendarDays.map((day, i) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const isToday = isSameDay(day, new Date());
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      const log = monthLogs[dateStr];
                      const state = workoutStates[dateStr];
                      const workout = monthWorkouts.find(w => w.date === dateStr);

                      return (
                        <div 
                          key={dateStr}
                          className={`min-h-[120px] p-2 border-r border-b border-white/5 transition-colors hover:bg-white/[0.02] relative ${
                            !isCurrentMonth ? 'opacity-20' : ''
                          } ${isToday ? 'bg-brand-pink/5' : ''}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-black ${isToday ? 'text-brand-pink' : 'text-white/40'}`}>
                              {format(day, 'd')}
                            </span>
                            {(workout?.status === 'completed' || state?.status === 'completed') && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            )}
                          </div>

                          <div className="space-y-1">
                            {state ? (
                              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                                state.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20' : 
                                state.status === 'rest' ? 'bg-white/5 border-white/10' :
                                'bg-indigo-500/10 border-indigo-500/20'
                              }`}>
                                <div className={`w-1 h-1 rounded-full ${
                                  state.status === 'completed' ? 'bg-emerald-500' : 
                                  state.status === 'rest' ? 'bg-white/20' :
                                  'bg-indigo-500'
                                }`} />
                                <span className={`text-[8px] font-bold uppercase truncate ${
                                  state.status === 'completed' ? 'text-emerald-500' : 
                                  state.status === 'rest' ? 'text-white/40' :
                                  'text-indigo-400'
                                }`}>
                                  {state.workoutTitle}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-white/5 rounded border border-white/10">
                                <div className="w-1 h-1 rounded-full bg-white/10" />
                                <span className="text-[8px] font-bold text-white/20 uppercase truncate italic">Rest Day</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
        ) : (
          <>
            {/* Today's Workout Card */}
            <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Today's Session</h3>
            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">
              Week {activeProgram?.currentWeek || 0} of {activeProgram?.totalWeeks || 0}
            </span>
          </div>

          <GlassCard className="p-6 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform">
              <Zap className="w-32 h-32 text-white" />
            </div>

            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="text-2xl font-display font-black text-white uppercase tracking-tighter italic">
                    {todayState?.workoutTitle || 'Rest Day'}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-brand-pink/20 text-brand-pink text-[8px] font-black uppercase tracking-widest rounded">
                      {todayState?.programDayType || 'Recovery'}
                    </span>
                    <span className="px-2 py-0.5 bg-white/5 text-white/40 text-[8px] font-black uppercase tracking-widest rounded">
                      {todayState?.workoutFocus || 'Full Body'}
                    </span>
                    {currentPhase && (
                      <span className="px-2 py-0.5 bg-brand-gold/10 text-brand-gold text-[8px] font-black uppercase tracking-widest rounded border border-brand-gold/20">
                        {currentPhase.phaseName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-white/40">
                    <Clock className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      {todayState?.workoutDuration || 0} Min
                    </span>
                  </div>
                </div>
              </div>

              {todayState && todayState.status !== 'rest' && todayState.status !== 'completed' && (
                <GradientButton 
                  onClick={() => navigate('/workout')}
                  className="w-full py-4 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span className="text-xs font-black uppercase tracking-widest">
                    {todayState.status === 'in-progress' ? 'Continue Workout' : 'Start Workout'}
                  </span>
                </GradientButton>
              )}

              {todayState?.status === 'completed' && (
                <div className="flex items-center justify-center gap-2 py-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Workout Completed</span>
                </div>
              )}
            </div>
          </GlassCard>
        </section>

        {/* This Week Section */}
        <section className="space-y-4">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">This Week</h3>
          <div className="space-y-2">
            {daysInWeek.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const status = getDayStatus(day);
              const isToday = isSameDay(day, today);
              const state = workoutStates[dateStr];
              const isExpanded = expandedDay === dateStr;

              return (
                <div key={dateStr} className="space-y-1">
                  <button 
                    onClick={() => setExpandedDay(isExpanded ? null : dateStr)}
                    className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${
                      isToday ? 'bg-brand-gold/20 border border-brand-gold/40' : 'bg-white/5 border border-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 text-center">
                        <span className="block text-[10px] font-black text-white/40 uppercase tracking-tighter">{format(day, 'EEE')}</span>
                        <span className="block text-sm font-display font-black text-white italic">{format(day, 'd')}</span>
                      </div>
                      <div className="w-px h-8 bg-white/10" />
                      <div className="flex items-center gap-3">
                        {getStatusIcon(status)}
                        <div className="text-left">
                          <p className={`text-xs font-black uppercase tracking-widest ${isToday ? 'text-white' : 'text-white/60'}`}>
                            {state?.workoutTitle || 'Rest Day'}
                          </p>
                          {state && state.status !== 'rest' && (
                            <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest">
                              {state.workoutDuration} Min • {state.targetIntensity}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    {state && state.status !== 'rest' && (
                      isExpanded ? <ChevronUp className="w-4 h-4 text-white/20" /> : <ChevronDown className="w-4 h-4 text-white/20" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && state && state.status !== 'rest' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 mt-1 space-y-6">
                          {state.workoutFocus && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Focus</p>
                                <p className="text-[10px] font-bold text-white uppercase">{state.workoutFocus}</p>
                              </div>
                              <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Intensity</p>
                                <p className="text-[10px] font-bold text-brand-pink uppercase">{state.targetIntensity}</p>
                              </div>
                            </div>
                          )}

                          {state.description && (
                            <div className="space-y-1.5 p-3 bg-brand-pink/5 rounded-xl border border-brand-pink/10">
                              <p className="text-[8px] font-black text-brand-pink uppercase tracking-widest">Coach's Brief</p>
                              <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest leading-relaxed italic">
                                {state.description}
                              </p>
                            </div>
                          )}
                          
                          {state.exerciseBlocks && state.exerciseBlocks.length > 0 ? (
                            <div className="space-y-6">
                              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Workout Structure</p>
                              <div className="space-y-8">
                                {state.exerciseBlocks.map((block, j) => (
                                  <div key={j} className="space-y-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-black text-brand-pink uppercase tracking-widest">{block.type}</span>
                                        {block.circuitType && <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">• {block.circuitType}</span>}
                                      </div>
                                      {block.instructions && (
                                        <p className="text-[9px] text-brand-gold font-black uppercase tracking-widest italic border-l-2 border-brand-gold pl-2">
                                          {block.instructions}
                                        </p>
                                      )}
                                    </div>
                                    <div className="space-y-2 pl-2 border-l border-white/5">
                                      {block.exercises.map((ex, k) => (
                                        <div key={k} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0 group">
                                          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/5 flex-shrink-0 border border-white/10 relative group-hover:border-brand-pink/30 transition-all">
                                            <ExerciseMedia key={ex.name} exerciseName={sanitizeExerciseName(ex.name)} />
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                              <Play className="w-6 h-6 text-white fill-white" />
                                            </div>
                                          </div>
                                          <div className="flex-1 flex flex-col justify-center space-y-1">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs font-black text-white uppercase italic tracking-tight group-hover:text-brand-pink transition-colors">
                                                {sanitizeExerciseName(ex.name)}
                                              </span>
                                              <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest">
                                                {ex.sets} × {ex.reps}
                                              </span>
                                            </div>
                                            {ex.notes && (
                                              <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest italic line-clamp-1">
                                                {ex.notes}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center space-y-2">
                              <Zap className="w-6 h-6 text-white/10" />
                              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Exercises generated upon start</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

        {/* Progress Section */}
        <section className="space-y-6">
          {/* Weekly Optimization Card */}
          {activeProgram && (
            <GlassCard className="p-6 border-brand-pink/30 bg-brand-pink/5">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-brand-pink/10 rounded-2xl">
                  <Activity className="w-6 h-6 text-brand-pink" />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-display font-black text-white uppercase tracking-tight italic">Weekly Optimization</h4>
                    <p className="text-[10px] text-white/40 leading-relaxed uppercase font-bold tracking-widest">
                      Your coach can analyze this week's training and optimize next week for maximum results.
                    </p>
                  </div>
                  <GradientButton 
                    onClick={handleRunAdaptation}
                    disabled={isAdapting}
                    className="w-full py-3"
                  >
                    {isAdapting ? (
                      <div className="w-4 h-4 border-2 border-brand-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-brand-black" />
                        <span>Adapt Next Week</span>
                      </>
                    )}
                  </GradientButton>
                </div>
              </div>
            </GlassCard>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Program Progress</h3>
              <span className="text-2xl font-display font-black text-brand-gold italic">{activeProgram?.progressPercent || 0}%</span>
            </div>
            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${activeProgram?.progressPercent || 0}%` }}
                className="h-full bg-brand-gold rounded-full shadow-[0_0_20px_rgba(226,181,92,0.4)]"
              />
            </div>
          </div>

          {/* Phase Timeline */}
          <div className="space-y-4">
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest text-center">Phase Timeline</p>
            <div className="relative pt-2 pb-8">
              <div className="flex h-12 gap-1">
                {activeProgram?.phases.map((phase, i) => {
                  const totalWeeks = activeProgram.totalWeeks;
                  const phaseWeeks = phase.weekEnd - phase.weekStart + 1;
                  const widthPercent = (phaseWeeks / totalWeeks) * 100;
                  const isCurrent = activeProgram.currentWeek >= phase.weekStart && activeProgram.currentWeek <= phase.weekEnd;

                  return (
                    <div 
                      key={`${phase.phaseName}-${phase.weekStart}-${i}`} 
                      className={`relative flex flex-col justify-center px-4 rounded-xl border transition-all ${
                        isCurrent ? 'bg-brand-gold/20 border-brand-gold shadow-[0_0_15px_rgba(226,181,92,0.2)]' : 'bg-white/5 border-white/10'
                      }`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      <span className={`text-[8px] font-black uppercase tracking-tighter truncate ${isCurrent ? 'text-brand-gold' : 'text-white/20'}`}>
                        {phase.phaseName}
                      </span>
                      <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-1">
                        <span className="text-[8px] font-bold text-white/20">W{phase.weekStart}</span>
                        <span className="text-[8px] font-bold text-white/20">W{phase.weekEnd}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Phase Cards */}
          <div className="grid grid-cols-1 gap-4">
            {activeProgram?.phases.map((phase, i) => {
              const isCurrent = activeProgram.currentWeek >= phase.weekStart && activeProgram.currentWeek <= phase.weekEnd;
              return (
                <GlassCard key={`${phase.phaseName}-${phase.weekStart}-${i}`} className={`p-6 space-y-4 ${isCurrent ? 'border-brand-gold/40' : ''}`} glow={isCurrent ? 'gold' : undefined}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-lg font-display font-black text-white uppercase italic">{phase.phaseName}</h4>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Weeks {phase.weekStart} - {phase.weekEnd}</p>
                    </div>
                    {isCurrent && (
                      <span className="px-2 py-1 bg-brand-gold/20 text-brand-gold text-[8px] font-black uppercase tracking-widest rounded border border-brand-gold/20">
                        Current Phase
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-[8px] text-white/20 font-black uppercase tracking-widest">Focus</p>
                      <p className="text-xs text-white/60 leading-relaxed">{phase.focus}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] text-white/20 font-black uppercase tracking-widest">Key Principle</p>
                      <p className="text-xs text-brand-gold italic font-medium">"{phase.keyPrinciple}"</p>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>

        {/* Next Workout Card */}
        <section className="space-y-4">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Next Workout</h3>
          <GlassCard className="p-6 flex items-center justify-between group hover:border-white/20 transition-colors">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/5 rounded-2xl text-white/40 group-hover:text-white transition-colors">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[8px] text-white/20 font-black uppercase tracking-widest">Tomorrow • {format(tomorrow, 'EEEE')}</p>
                <h4 className="text-xl font-display font-black text-white uppercase italic">
                  {tomorrowState?.workoutTitle || 'Rest Day'}
                </h4>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-white transition-transform group-hover:translate-x-1" />
          </GlassCard>
        </section>
          </>
        )}
      </main>

      <AnimatePresence>
        {showAdaptationModal && adaptationResult && (
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
              <div className="p-8 pb-4 text-center space-y-2 relative">
                <button 
                  onClick={() => setShowAdaptationModal(false)}
                  className="absolute top-4 right-4 p-2 text-white/40 hover:text-white z-10"
                >
                  <X className="w-6 h-6" />
                </button>
                <div className="w-16 h-16 bg-brand-pink/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-brand-pink" />
                </div>
                <h3 className="text-3xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Week {adaptationResult.week} Optimized</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Your program has been adapted based on your performance</p>
              </div>

              <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6 custom-scrollbar">
                {adaptationResult.adjustments_summary.strength_progressions.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black text-brand-gold uppercase tracking-widest">Strength Progressions</h5>
                    <ul className="space-y-2">
                      {adaptationResult.adjustments_summary.strength_progressions.map((item: string, i: number) => (
                        <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-brand-gold mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {adaptationResult.adjustments_summary.volume_changes.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black text-brand-pink uppercase tracking-widest">Volume Adjustments</h5>
                    <ul className="space-y-2">
                      {adaptationResult.adjustments_summary.volume_changes.map((item: string, i: number) => (
                        <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-brand-pink mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {adaptationResult.adjustments_summary.exercise_swaps.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Exercise Swaps</h5>
                    <ul className="space-y-2">
                      {adaptationResult.adjustments_summary.exercise_swaps.map((item: string, i: number) => (
                        <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {adaptationResult.adjustments_summary.recovery_adjustments.length > 0 && (
                  <div className="space-y-3">
                    <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Recovery Focus</h5>
                    <ul className="space-y-2">
                      {adaptationResult.adjustments_summary.recovery_adjustments.map((item: string, i: number) => (
                        <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="p-8 pt-4 bg-brand-surface/50 backdrop-blur-md border-t border-white/5">
                <GradientButton 
                  onClick={() => setShowAdaptationModal(false)}
                  className="w-full py-5"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Got it, Coach</span>
                </GradientButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
};
