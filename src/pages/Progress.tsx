import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useSupabase } from '../components/SupabaseProvider';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { ChevronLeft, TrendingUp, ChevronRight, Dumbbell, Zap, Clock, ChartBar as BarChart2, Calendar, Flame, Target, Award, Activity, CircleCheck as CheckCircle2, Circle, ArrowUpRight, ArrowDownRight, Info, X, Trophy, History, LayoutGrid } from 'lucide-react';
import { DailyLog, WorkoutSession, BodyMetric, Achievement, DailyWorkoutState } from '../types';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  subDays, 
  isToday, 
  isAfter,
  differenceInDays,
  subWeeks,
  startOfDay,
  getDay,
  addDays
} from 'date-fns';
import { BottomNav } from '../components/BottomNav';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  ReferenceLine
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { GlassCard } from '../components/ui/GlassCard';
import { StatCard } from '../components/ui/StatCard';
import { ProgressRing } from '../components/ui/ProgressRing';
import { GradientButton } from '../components/ui/GradientButton';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { useActiveProgram } from '../hooks/useActiveProgram';
import { useUserProfile } from '../hooks/useUserProfile';
import { ensureDailyWorkoutState, swapWorkoutStates } from '../services/workoutSynchronizationService';
import { useToast } from '../components/ui/Toast';

export const Progress: React.FC = () => {
  const { user } = useSupabase();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { activeProgram } = useActiveProgram();
  const [readinessLogs, setReadinessLogs] = useState<DailyLog[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSession[]>([]);
  const [weightLogs, setWeightLogs] = useState<BodyMetric[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [adaptationLogs, setAdaptationLogs] = useState<any[]>([]);
  const [workoutStates, setWorkoutStates] = useState<DailyWorkoutState[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'milestones' | 'insights'>('overview');
  const [achievementFilter, setAchievementFilter] = useState<'All' | 'Strength' | 'Volume' | 'Streaks' | 'Consistency'>('All');
  const [loading, setLoading] = useState(true);
  const [selectedDayDetail, setSelectedDayDetail] = useState<any | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  const unitSystem = profile?.unitSystem || 'imperial';
  const weightFactor = unitSystem === 'imperial' ? 2.20462 : 1;
  const weightUnit = unitSystem === 'imperial' ? 'lbs' : 'kg';
  const { toast } = useToast();

  const handleSwapWorkout = async (targetDate: Date) => {
    if (!user || !activeProgram) return;
    setIsSwapping(true);
    try {
      const success = await swapWorkoutStates(user.uid, new Date(), targetDate, activeProgram);
      if (success) {
        toast({
          title: "Program Adaptive Shift",
          description: `Sessions exchanged with ${format(targetDate, 'EEEE, MMM d')}`,
          variant: "success",
        });
        setSelectedDayDetail(null);
      } else {
        toast({
          title: "Swap Error",
          description: "Failed to synchronize workout swap",
          variant: "error",
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSwapping(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchData = async () => {
      try {
        // Recovery Trend (Last 28 days + buffer for heatmap)
        const { data: readinessData, error: readinessError } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(90);

        if (readinessError) throw readinessError;
        setReadinessLogs((readinessData || []).map(d => ({ id: d.id, ...d } as DailyLog)).reverse());

        // Training Volume (Last 8 sessions or 12 weeks for heatmap)
        const { data: workoutsData, error: workoutsError } = await supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('date', { ascending: false })
          .limit(100);

        if (workoutsError) throw workoutsError;
        setRecentWorkouts((workoutsData || []).map(d => ({ id: d.id, ...d } as WorkoutSession)));

        // Weight Trend (Last 30 metrics from subcollection)
        const { data: weightData, error: weightError } = await supabase
          .from('body_metrics')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(30);

        if (weightError) throw weightError;
        setWeightLogs((weightData || []).map(d => ({ id: d.id, ...d } as BodyMetric)).reverse());

        // Achievements (from subcollection)
        const { data: achievementsData, error: achievementsError } = await supabase
          .from('achievements')
          .select('*')
          .eq('user_id', user.id)
          .order('earned_at', { ascending: false });

        if (achievementsError) throw achievementsError;
        setAchievements((achievementsData || []).map(d => ({
          id: d.id,
          achievementId: (d as any).achievement_id,
          name: d.name,
          description: d.description,
          earnedAt: (d as any).earned_at,
          userId: (d as any).user_id
        } as Achievement)));
        setLoading(false);

        // Adaptation Logs
        const { data: adaptationsData, error: adaptationsError } = await supabase
          .from('weekly_adaptations')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false });

        if (adaptationsError) throw adaptationsError;
        setAdaptationLogs(adaptationsData || []);

        // Fetch Daily Workout States for heatmap
        const heatmapStart = startOfWeek(subWeeks(new Date(), 11), { weekStartsOn: 1 });

        const { data: statesData, error: statesError } = await supabase
          .from('daily_workout_states')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', format(heatmapStart, 'yyyy-MM-dd'));

        if (statesError) throw statesError;
        setWorkoutStates(statesData || []);
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, 'multiple tables');
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to real-time updates
    const readinessChannel = supabase
      .channel(`daily_logs:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_logs', filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    const workoutsChannel = supabase
      .channel(`workout_sessions_progress:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_sessions', filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    const weightChannel = supabase
      .channel(`body_metrics:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'body_metrics', filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    const achievementsChannel = supabase
      .channel(`achievements:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'achievements', filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    const adaptationsChannel = supabase
      .channel(`weekly_adaptations:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_adaptations', filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    const statesChannel = supabase
      .channel(`daily_workout_states_progress:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_workout_states', filter: `user_id=eq.${user.id}` }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(readinessChannel);
      supabase.removeChannel(workoutsChannel);
      supabase.removeChannel(weightChannel);
      supabase.removeChannel(achievementsChannel);
      supabase.removeChannel(adaptationsChannel);
      supabase.removeChannel(statesChannel);
    };
  }, [user]);

  const calculateVolume = (exercises: any[]) => {
    if (!exercises) return 0;
    return exercises.reduce((acc, ex) => {
      if (!ex.sets) return acc;
      // Always calculate in KG for internal logic/intensity
      return acc + ex.sets.reduce((sAcc: number, set: any) => sAcc + ((set.weight || 0) * (set.reps || 0)), 0);
    }, 0);
  };

  // Data processing
  const { 
    heatmapData, 
    monthLabels, 
    consistencyScore, 
    currentStreak,
    masteryPercent,
    scheduledDaysCount,
    completionsThisWeek,
    volumeChartData,
    recoveryChartData,
    weightTrendData,
    filteredAchievements
  } = React.useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    // 1. Training Volume Chart (Last 8 weeks)
    const last8Weeks = Array.from({ length: 8 }).map((_, i) => {
      const start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const end = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      return { start, end, label: format(start, 'M/d') };
    }).reverse();

    const volumeData = last8Weeks.map(week => {
      const weekWorkouts = recentWorkouts.filter(w => {
        const d = new Date(w.date);
        return d >= week.start && d <= week.end && w.status === 'completed';
      });
      const totalVolume = weekWorkouts.reduce((acc, w) => acc + calculateVolume(w.exercises), 0);
      return {
        name: week.label,
        volume: Math.round(totalVolume * weightFactor)
      };
    });

    // 2. Recovery Trend Chart (Last 28 days)
    const recoveryData = readinessLogs.slice(-28).map(l => ({
      date: format(new Date(l.date), 'MMM d'),
      score: l.readinessScore
    }));

    // 3. Weight Trend Chart (Last 30 metrics)
    const weightData = weightLogs.map(l => ({
      date: format(new Date(l.date), 'MMM d'),
      weight: Math.round(l.weightKg * weightFactor)
    }));

    // 4. Consistency Heatmap (Last 12 weeks)
    const heatmapStart = startOfWeek(subWeeks(now, 11), { weekStartsOn: 1 });
    const heatmapEnd = endOfWeek(addDays(now, 7), { weekStartsOn: 1 });
    const heatmapDays = eachDayOfInterval({
      start: heatmapStart,
      end: heatmapEnd
    });

    const hData = heatmapDays.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const state = workoutStates.find(s => s.date === dayStr);
      const workout = recentWorkouts.find(w => w.date === dayStr && w.status === 'completed');
      
      let status: 'none' | 'completed' | 'missed' | 'recovery' | 'scheduled' = 'none';
      if (workout) {
        status = 'completed';
      } else if (state) {
        if (state.status === 'completed') status = 'completed';
        else if (state.status === 'skipped') status = 'missed';
        else if (state.status === 'rest') status = 'recovery';
        else if (state.status === 'scheduled') status = 'scheduled';
      }

      return {
        date: day,
        dateStr: dayStr,
        status,
        focus: state?.workoutTitle || 'Rest Day',
        intensity: workout?.intensityRPE || (state?.targetIntensity ? parseInt(state.targetIntensity.replace('RPE ', '')) / 2.5 : 0),
        volume: Math.round((workout?.totalVolume || 0) * weightFactor),
        duration: workout?.durationMinutes || state?.workoutDuration || 0
      };
    });

    // 5. Month labels
    const mLabels: { label: string, index: number }[] = [];
    heatmapDays.forEach((day, i) => {
      if (i % 7 === 0) {
        const month = format(day, 'MMM');
        if (mLabels.length === 0 || mLabels[mLabels.length - 1].label !== month) {
          mLabels.push({ label: month, index: i / 7 });
        }
      }
    });

    // 6. Consistency Score (Last 30 days)
    const last30 = hData.slice(-30);
    const scheduled30 = last30.filter(d => d.status === 'completed' || d.status === 'missed' || d.status === 'recovery').length;
    const completed30 = last30.filter(d => d.status === 'completed' || d.status === 'recovery').length;
    const cScore = scheduled30 > 0 ? Math.round((completed30 / scheduled30) * 100) : 100;

    // 7. Streak
    let streak = 0;
    for (let i = 0; i < hData.length; i++) {
      const day = hData[i];
      if (day.status === 'completed' || day.status === 'recovery') {
        streak++;
      } else if (day.status === 'missed') {
        streak = 0;
      }
    }

    // 8. Weekly Mastery
    const schedCount = Object.values(activeProgram?.weeklySchedule || {}).filter(v => v !== 'Rest Day').length;
    const weeklyW = recentWorkouts.filter(w => {
      const d = new Date(w.date);
      return d >= weekStart && d <= weekEnd;
    });
    const compsThisWeek = weeklyW.length;
    const recovThisWeek = hData.filter(d => {
      const dDate = new Date(d.date);
      return dDate >= weekStart && dDate <= weekEnd && d.status === 'recovery';
    }).length;
    const mPercent = schedCount > 0 ? ((compsThisWeek + recovThisWeek) / schedCount) * 100 : 0;

    // 9. Achievements
    const fAchievements = achievements.filter(a => {
      if (achievementFilter === 'All') return true;
      const desc = a.description.toLowerCase();
      const name = a.name.toLowerCase();
      if (achievementFilter === 'Strength') return desc.includes('strength') || desc.includes('weight') || name.includes('strength');
      if (achievementFilter === 'Volume') return desc.includes('volume') || desc.includes('total') || name.includes('volume');
      if (achievementFilter === 'Streaks') return desc.includes('streak') || name.includes('streak');
      if (achievementFilter === 'Consistency') return desc.includes('consistency') || desc.includes('completion') || name.includes('consistency');
      return true;
    });

    return {
      heatmapData: hData,
      monthLabels: mLabels,
      consistencyScore: cScore,
      currentStreak: streak,
      masteryPercent: mPercent,
      scheduledDaysCount: schedCount,
      completionsThisWeek: compsThisWeek,
      volumeChartData: volumeData,
      recoveryChartData: recoveryData,
      weightTrendData: weightData,
      filteredAchievements: fAchievements
    };
  }, [readinessLogs, recentWorkouts, weightLogs, achievements, activeProgram, weightFactor, achievementFilter]);

  const workoutsThisWeek = completionsThisWeek;
  const scheduledThisWeek = scheduledDaysCount;

  const COLORS = ['#e33f70', 'rgba(255, 255, 255, 0.05)'];

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
                <TrendingUp className="w-5 h-5 text-brand-pink" />
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter italic leading-none">Performance Hub</h1>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Real-time Adaptive Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
            {(['overview', 'trends', 'milestones', 'insights'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-brand-pink text-white shadow-lg shadow-brand-pink/20' : 'text-white/40 hover:text-white/60'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-6 space-y-8 max-w-4xl mx-auto">
        {loading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SkeletonLoader className="h-48 rounded-3xl" />
              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                <SkeletonLoader className="h-24 rounded-2xl" />
                <SkeletonLoader className="h-24 rounded-2xl" />
                <SkeletonLoader className="h-24 rounded-2xl" />
                <SkeletonLoader className="h-24 rounded-2xl" />
              </div>
            </div>
            <SkeletonLoader className="h-64 rounded-3xl" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Weekly Mastery Ring */}
              <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="md:col-span-1 p-6 flex flex-col items-center justify-center relative overflow-hidden" glow="pink">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    <ProgressRing value={masteryPercent} size={120} label={`${completionsThisWeek}/${scheduledDaysCount}`} />
                  </div>
                  <div className="mt-4 text-center">
                    <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Weekly Mastery</h4>
                    <div className="flex items-center gap-1 text-brand-pink justify-center">
                      <Flame className="w-4 h-4 fill-brand-pink" />
                      <span className="text-lg font-display font-black italic">{completionsThisWeek} SESSIONS</span>
                    </div>
                  </div>
                </GlassCard>

                <div className="md:col-span-2 grid grid-cols-2 gap-4">
                  <StatCard 
                    icon={Trophy}
                    label="Achievements"
                    value={achievements.length.toString()}
                    color="text-brand-gold"
                    trend={{ value: "Total earned", isPositive: true }}
                  />
                  <StatCard 
                    icon={History}
                    label="Consistency"
                    value={`${Math.round(masteryPercent)}%`}
                    color="text-brand-pink"
                    trend={{ value: "This week", isPositive: masteryPercent >= 80 }}
                  />
                  <StatCard 
                    icon={Activity}
                    label="Current Weight"
                    value={weightLogs.length > 0 ? `${Math.round(weightLogs[weightLogs.length - 1].weightKg * weightFactor)}${weightUnit}` : '--'}
                    color="text-emerald-500"
                    trend={{ 
                      value: weightLogs.length > 1 ? `${Math.round((weightLogs[weightLogs.length - 1].weightKg - weightLogs[0].weightKg) * weightFactor)}${weightUnit}` : 'No trend', 
                      isPositive: weightLogs.length > 1 && (weightLogs[weightLogs.length - 1].weightKg - weightLogs[0].weightKg) <= 0 
                    }}
                  />
                  <StatCard 
                    icon={LayoutGrid}
                    label="Sessions"
                    value={recentWorkouts.length.toString()}
                    color="text-white/40"
                    trend={{ value: "All time", isPositive: true }}
                  />
                </div>
              </section>

              {/* Consistency Heatmap */}
              <section className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Consistency Heatmap</h3>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Last 12 Weeks of Training</p>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Consistency</p>
                      <p className="text-xl font-display font-black text-emerald-500 italic leading-none">{consistencyScore}%</p>
                    </div>
                    <div className="w-px h-8 bg-white/5" />
                    <div className="text-center">
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Current Streak</p>
                      <div className="flex items-center gap-1 justify-center">
                        <Flame className="w-4 h-4 text-brand-gold fill-brand-gold" />
                        <p className="text-xl font-display font-black text-brand-gold italic leading-none">{currentStreak}D</p>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-white/5" />
                    <div className="text-center">
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">This Week</p>
                      <p className="text-xl font-display font-black text-brand-pink italic leading-none">{workoutsThisWeek}/{scheduledThisWeek}</p>
                    </div>
                  </div>
                </div>

                <GlassCard className="p-6 overflow-x-auto no-scrollbar" glow="pink">
                  <div className="flex gap-4 min-w-max">
                    {/* Day Labels */}
                    <div className="grid grid-rows-7 gap-1.5 pt-6">
                      <span className="h-3 text-[8px] font-black text-white/20 uppercase flex items-center">Mon</span>
                      <span className="h-3" />
                      <span className="h-3 text-[8px] font-black text-white/20 uppercase flex items-center">Wed</span>
                      <span className="h-3" />
                      <span className="h-3 text-[8px] font-black text-white/20 uppercase flex items-center">Fri</span>
                      <span className="h-3" />
                      <span className="h-3" />
                    </div>

                    <div className="space-y-2">
                      {/* Month Labels */}
                      <div className="flex gap-1 relative h-4">
                        {monthLabels.map((m) => (
                          <span 
                            key={`month-label-${m.label}-${m.index}`} 
                            className="absolute text-[8px] font-black text-white/20 uppercase tracking-widest"
                            style={{ left: `${m.index * 20}px` }}
                          >
                            {m.label}
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-1.5">
                        {Array.from({ length: Math.ceil(heatmapData.length / 7) }).map((_, weekIndex) => (
                          <div key={`week-${weekIndex}`} className="grid grid-rows-7 gap-1.5">
                            {Array.from({ length: 7 }).map((_, dayIndex) => {
                              const dayData = heatmapData[weekIndex * 7 + dayIndex];
                              if (!dayData) return <div key={`empty-${weekIndex}-${dayIndex}`} className="w-3.5 h-3.5 rounded-sm bg-white/5" />;
                              
                              let bgColor = 'bg-white/5';
                              let border = 'border-transparent';
                              let opacity = 1;

                              if (dayData.status === 'completed') {
                                bgColor = 'bg-brand-pink';
                                // Discrete intensity levels
                                if (dayData.intensity === 1) opacity = 0.3;
                                else if (dayData.intensity === 2) opacity = 0.5;
                                else if (dayData.intensity === 3) opacity = 0.75;
                                else opacity = 1;
                              } else if (dayData.status === 'scheduled') {
                                bgColor = 'bg-brand-gold';
                                opacity = 0.4;
                              } else if (dayData.status === 'missed') {
                                bgColor = 'transparent';
                                border = 'border-white/20';
                              } else if (dayData.status === 'recovery') {
                                bgColor = 'bg-emerald-500';
                                opacity = 0.6;
                              }

                              return (
                                <div 
                                  key={dayData.dateStr} 
                                  onClick={() => setSelectedDayDetail(dayData)}
                                  className={`w-3.5 h-3.5 rounded-sm border ${border} ${bgColor} transition-all hover:scale-125 cursor-pointer relative group/cell`}
                                  style={{ opacity }}
                                >
                                  {/* Custom Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-brand-surface border border-white/10 rounded-lg shadow-2xl opacity-0 group-hover/cell:opacity-100 pointer-events-none transition-opacity z-50">
                                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">
                                      {format(dayData.date, 'EEE, MMM d')}
                                    </p>
                                    <p className={`text-[10px] font-black uppercase tracking-tight italic ${dayData.status === 'completed' ? 'text-brand-pink' : dayData.status === 'missed' ? 'text-red-500' : dayData.status === 'recovery' ? 'text-emerald-500' : dayData.status === 'scheduled' ? 'text-brand-gold' : 'text-white/40'}`}>
                                      {dayData.status === 'completed' ? dayData.focus : dayData.status === 'missed' ? 'Missed Session' : dayData.status === 'recovery' ? 'Smart Recovery' : dayData.status === 'scheduled' ? dayData.focus : 'Rest Day'}
                                    </p>
                                    {(dayData.status === 'completed' || dayData.status === 'scheduled') && (
                                      <div className="mt-1 pt-1 border-t border-white/5 flex justify-between">
                                        {dayData.status === 'completed' && <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{dayData.volume} {weightUnit}</span>}
                                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{dayData.duration}m</span>
                                      </div>
                                    )}
                                    {dayData.status === 'recovery' && (
                                      <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest mt-1">Adaptive rest taken</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-brand-gold opacity-60" />
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Scheduled</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-brand-pink" />
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Completed</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500 opacity-60" />
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Recovery</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm border border-white/20" />
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Missed</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm bg-white/5" />
                        <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Rest</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest mr-1">Intensity</span>
                      <div className="w-2 h-2 rounded-sm bg-brand-pink opacity-30" />
                      <div className="w-2 h-2 rounded-sm bg-brand-pink opacity-50" />
                      <div className="w-2 h-2 rounded-sm bg-brand-pink opacity-75" />
                      <div className="w-2 h-2 rounded-sm bg-brand-pink opacity-100" />
                    </div>
                  </div>
                </GlassCard>
              </section>
            </motion.div>
          )}

          {activeTab === 'trends' && (
            <motion.div
              key="trends"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Weight Trend Chart */}
              <GlassCard className="p-6 space-y-6" glow="pink">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-brand-pink" />
                    <h3 className="font-display font-bold text-lg uppercase tracking-tight text-white">Weight Trend (30d, {weightUnit})</h3>
                  </div>
                </div>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weightTrendData}>
                      <defs>
                        <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e33f70" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#e33f70" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 10 }} />
                      <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1A1A1A', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#e33f70" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#weightGradient)"
                        dot={{ fill: '#e33f70', strokeWidth: 2, r: 4 }} 
                        activeDot={{ r: 6, fill: '#e33f70' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Training Volume Chart */}
              <GlassCard className="p-6 space-y-6" glow="gold">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-brand-gold" />
                    <h3 className="font-display font-bold text-lg uppercase tracking-tight text-white">Weekly Training Volume (8w, {weightUnit})</h3>
                  </div>
                </div>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeChartData}>
                      <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f27d26" stopOpacity={1}/>
                          <stop offset="95%" stopColor="#f27d26" stopOpacity={0.6}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 10 }} />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                        contentStyle={{ 
                          backgroundColor: '#1A1A1A', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }} 
                      />
                      <Bar dataKey="volume" fill="url(#volumeGradient)" radius={[4, 4, 0, 0]}>
                        {volumeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fillOpacity={0.6 + (index / volumeChartData.length) * 0.4} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>

              {/* Recovery Trend Chart */}
              <GlassCard className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-display font-bold text-lg uppercase tracking-tight text-white">Recovery Trend (28d)</h3>
                  </div>
                </div>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={recoveryChartData}>
                      <defs>
                        <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#ffffff40', fontSize: 10 }} />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1A1A1A', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }} 
                      />
                      <ReferenceLine y={85} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'right', value: 'Optimal', fill: '#10b981', fontSize: 8, fontWeight: 'bold' }} />
                      <ReferenceLine y={70} stroke="#f27d26" strokeDasharray="3 3" label={{ position: 'right', value: 'Fair', fill: '#f27d26', fontSize: 8, fontWeight: 'bold' }} />
                      <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Low', fill: '#ef4444', fontSize: 8, fontWeight: 'bold' }} />
                      <Area 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#recoveryGradient)"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 'milestones' && (
            <motion.div
              key="milestones"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Achievements</h3>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                    {['All', 'Strength', 'Volume', 'Streaks', 'Consistency'].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setAchievementFilter(filter as any)}
                        className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                          achievementFilter === filter ? 'bg-brand-gold text-brand-black' : 'bg-white/5 text-white/40 border border-white/5'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {filteredAchievements.length > 0 ? (
                    filteredAchievements.map((achievement) => (
                      <GlassCard key={achievement.id} className="p-4 flex items-center gap-4 group" glow="gold">
                        <div className="p-3 bg-brand-gold/10 rounded-xl group-hover:scale-110 transition-transform">
                          <Award className="w-6 h-6 text-brand-gold" />
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-display font-black text-white uppercase tracking-tight italic">{achievement.name}</h4>
                            <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">{format(new Date(achievement.earnedAt), 'MMM d, yyyy')}</span>
                          </div>
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-relaxed">
                            {achievement.description}
                          </p>
                        </div>
                      </GlassCard>
                    ))
                  ) : (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                        <Trophy className="w-8 h-8 text-white/10" />
                      </div>
                      <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">No achievements found in this category</p>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}
          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Coaching Insights</h3>
                </div>

                <div className="space-y-6">
                  {adaptationLogs.length > 0 ? (
                    adaptationLogs.map((log) => (
                      <GlassCard key={log.id} className="p-6 space-y-6" glow="pink">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-brand-pink/10 rounded-xl">
                              <Zap className="w-6 h-6 text-brand-pink fill-brand-pink" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xl font-display font-black text-white uppercase italic tracking-tight">Week {log.week} Adaptation</h4>
                              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{format(new Date(log.date), 'MMMM d, yyyy')}</p>
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Applied</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {log.summary.strength_progressions.length > 0 && (
                            <div className="space-y-3">
                              <h5 className="text-[10px] font-black text-brand-gold uppercase tracking-widest">Strength Progressions</h5>
                              <ul className="space-y-2">
                                {log.summary.strength_progressions.map((item: string, i: number) => (
                                  <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                                    <div className="w-1 h-1 rounded-full bg-brand-gold mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {log.summary.volume_changes.length > 0 && (
                            <div className="space-y-3">
                              <h5 className="text-[10px] font-black text-brand-pink uppercase tracking-widest">Volume Adjustments</h5>
                              <ul className="space-y-2">
                                {log.summary.volume_changes.map((item: string, i: number) => (
                                  <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                                    <div className="w-1 h-1 rounded-full bg-brand-pink mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {log.summary.exercise_swaps.length > 0 && (
                            <div className="space-y-3">
                              <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Exercise Swaps</h5>
                              <ul className="space-y-2">
                                {log.summary.exercise_swaps.map((item: string, i: number) => (
                                  <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                                    <div className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {log.summary.recovery_adjustments.length > 0 && (
                            <div className="space-y-3">
                              <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Recovery Focus</h5>
                              <ul className="space-y-2">
                                {log.summary.recovery_adjustments.map((item: string, i: number) => (
                                  <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </GlassCard>
                    ))
                  ) : (
                    <div className="text-center py-20 space-y-4">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                        <Zap className="w-10 h-10 text-white/10" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-display font-black text-white uppercase italic tracking-tight">No Insights Yet</p>
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest max-w-[200px] mx-auto">
                          Complete your first week to receive coach-driven program optimizations.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
        )}
        {/* Day Detail & Swap Modal */}
      <AnimatePresence>
        {selectedDayDetail && (
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
              className="w-full max-w-sm glass-card p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{format(selectedDayDetail.date, 'EEEE, MMM d')}</p>
                  <h3 className="text-2xl font-display font-black text-white uppercase italic tracking-tighter tracking-tight">Mission Detail</h3>
                </div>
                <button 
                  onClick={() => setSelectedDayDetail(null)}
                  className="p-2 bg-white/5 rounded-xl text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Type</span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                      selectedDayDetail.status === 'completed' ? 'bg-brand-pink/20 text-brand-pink' :
                      selectedDayDetail.status === 'recovery' ? 'bg-emerald-500/20 text-emerald-500' :
                      selectedDayDetail.status === 'scheduled' ? 'bg-brand-gold/20 text-brand-gold' :
                      'bg-white/10 text-white/40'
                    }`}>
                      {selectedDayDetail.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Focus</span>
                    <span className="text-xs font-black text-white uppercase italic">{selectedDayDetail.focus}</span>
                  </div>
                </div>

                {/* Swap Logic */}
                {isAfter(startOfDay(selectedDayDetail.date), startOfDay(new Date())) && (selectedDayDetail.status === 'scheduled' || selectedDayDetail.status === 'recovery') && (
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest text-center">
                      Swap today's mission with this session?
                    </p>
                    <GradientButton
                      disabled={isSwapping}
                      onClick={() => handleSwapWorkout(selectedDayDetail.date)}
                      className="w-full py-4 text-xs"
                    >
                      {isSwapping ? 'Executing Swap...' : 'Confirm Session Swap'}
                    </GradientButton>
                  </div>
                )}

                {selectedDayDetail.status === 'completed' && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Volume</p>
                      <p className="text-sm font-display font-black text-white italic">{selectedDayDetail.volume} {weightUnit}</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Duration</p>
                      <p className="text-sm font-display font-black text-white italic">{selectedDayDetail.duration}m</p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest text-center">
                Adaptive programming syncs your physical capacity with mission scheduling.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
      <BottomNav />
    </div>
  );
};
