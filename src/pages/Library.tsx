import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../components/SupabaseProvider';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { ChevronLeft, Search, ListFilter as Filter, ChevronRight, Dumbbell, Zap, Clock, Play, Info, X, BookOpen, Volume2, VolumeX, RefreshCw, TrendingUp, TriangleAlert as AlertTriangle } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { ExerciseLibraryEntry, WorkoutSession } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { seedExerciseLibrary, refreshExerciseMetadata } from '../services/exerciseSeeder';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

import { useUserProfile } from '../hooks/useUserProfile';
import { ExerciseMedia } from '../components/ExerciseMedia';

export const Library: React.FC = () => {
  const { user } = useSupabase();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const [exercises, setExercises] = useState<ExerciseLibraryEntry[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMovementPattern, setSelectedMovementPattern] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('All');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseLibraryEntry | null>(null);
  const [userHistory, setUserHistory] = useState<{ date: string; weight: number }[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const hasAttemptedAutoSeed = React.useRef(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const isAdmin = user?.email === 'chasetomseth@gmail.com';

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleSeed = async (isAuto = false) => {
    if (isSeeding) return;
    setIsSeeding(true);
    setSeedProgress(0);
    try {
      await seedExerciseLibrary((progress) => setSeedProgress(progress));
      if (!isAuto) {
        alert('Library initialization complete! All 450+ exercises are now available.');
      }
    } catch (error) {
      console.error('Seeding error:', error);
      if (!isAuto) {
        alert('Initialization encountered an issue. Please try again.');
      }
    } finally {
      setIsSeeding(false);
    }
  };

  const handleRefreshMetadata = async () => {
    if (!isAdmin) return;
    setIsSeeding(true);
    setSeedProgress(0);
    try {
      await refreshExerciseMetadata((progress) => setSeedProgress(progress));
      alert('Metadata refresh complete! All exercises have been re-categorized.');
    } catch (error) {
      console.error('Refresh error:', error);
      alert('Refresh encountered an issue.');
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (selectedExercise && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [selectedExercise]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading && exercises.length === 0 && !isSeeding && !hasAttemptedAutoSeed.current) {
      hasAttemptedAutoSeed.current = true;
      console.log('Library empty, triggering automatic initialization...');
      handleSeed(true);
    }
  }, [loading, exercises.length, isSeeding]);

  const muscleGroups = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
  const equipmentOptions = ['All', 'Barbell', 'Dumbbell', 'Kettlebell', 'Cable', 'Machine', 'Band', 'Bodyweight', 'Cardio Machine', 'Medicine Ball', 'Sled'];
  const difficultyOptions = ['All', 'beginner', 'intermediate', 'advanced'];
  const movementPatterns = ['All', 'Horizontal Push', 'Horizontal Pull', 'Vertical Push', 'Vertical Pull', 'Squat', 'Hinge', 'Lunge', 'Carry', 'Core', 'Rotation', 'Anti-Rotation', 'Locomotion', 'Plyometric', 'Mobility', 'Conditioning'];
  const categories = ['All', 'Primary Lift', 'Secondary Lift', 'Accessory', 'Isolation', 'Core', 'Conditioning', 'Mobility', 'Activation'];

  useEffect(() => {
    const fetchExercises = async () => {
      try {
        const { data, error } = await supabase
          .from('exercise_library')
          .select('*')
          .limit(500);

        if (error) throw error;

        if (data) {
          // Convert snake_case to camelCase
          const normalizedData = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            videoUrl: d.video_url,
            movementPattern: d.movement_pattern,
            primaryMuscleGroup: d.primary_muscle_group,
            secondaryMuscleGroups: d.secondary_muscle_groups,
            equipment: d.equipment,
            category: d.category,
            difficulty: d.difficulty,
            instructions: d.instructions || [],
            commonFormErrors: d.common_form_errors || [],
            substitutionTiers: d.substitution_tiers,
            videoKey: d.video_key
          }));
          setExercises(normalizedData as ExerciseLibraryEntry[]);
        }
        setLoading(false);
      } catch (error) {
        handleSupabaseError(error, OperationType.LIST, 'exercise_library');
        setLoading(false);
      }
    };

    fetchExercises();

    const channel = supabase
      .channel('exercise_library')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exercise_library' }, () => {
        fetchExercises();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchesMuscle = selectedMuscle === 'All' || 
      ex.primaryMuscleGroup === selectedMuscle || 
      ex.secondaryMuscleGroups?.includes(selectedMuscle);
    const matchesEquipment = selectedEquipment === 'All' || 
      (typeof ex.equipment === 'string' ? ex.equipment === selectedEquipment : ex.equipment.includes(selectedEquipment as any));
    const matchesDifficulty = selectedDifficulty === 'All' || ex.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();
    const matchesPattern = selectedMovementPattern === 'All' || ex.movementPattern === selectedMovementPattern;
    const matchesCategory = selectedCategory === 'All' || ex.category === selectedCategory;
    
    return matchesSearch && matchesMuscle && matchesEquipment && matchesDifficulty && matchesPattern && matchesCategory;
  });

  useEffect(() => {
    if (selectedExercise && user) {
      const fetchHistory = async () => {
        try {
          // Fetch last 20 completed sessions
          const { data, error } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('date', { ascending: false })
            .limit(20);

          if (error) throw error;

          const history: { date: string; weight: number }[] = [];

          (data || []).forEach((session: any) => {
            const exercises = session.exercises || [];
            const ex = exercises.find((e: any) => e.exerciseName === selectedExercise.name || e.exercise_name === selectedExercise.name);
            if (ex && ex.sets && ex.sets.length > 0) {
              const maxWeight = Math.max(...ex.sets.map((s: any) => s.actualWeight || s.actual_weight || 0));
              if (maxWeight > 0) {
                history.push({
                  date: session.date,
                  weight: maxWeight
                });
              }
            }
          });

          setUserHistory(history.slice(0, 5).reverse());
        } catch (error) {
          console.error('Error fetching exercise history:', error);
        }
      };
      fetchHistory();
    } else {
      setUserHistory([]);
    }
  }, [selectedExercise, user]);

  return (
    <div className="min-h-screen bg-brand-black pb-32">
      <header className="p-6 space-y-6 bg-brand-black/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all border border-white/5"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="space-y-1">
              <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter italic leading-none">Exercise Library</h1>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Biomechanical Database</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button 
                onClick={handleRefreshMetadata}
                disabled={isSeeding}
                className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors disabled:opacity-50"
                title="Refresh Metadata"
              >
                <RefreshCw className={`w-5 h-5 text-white/40 ${isSeeding ? 'animate-spin' : ''}`} />
              </button>
            )}
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
                <BookOpen className="w-5 h-5 text-brand-pink" />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exercises..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
            />
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {movementPatterns.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedMovementPattern(p)}
                  className={`px-4 py-2 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    selectedMovementPattern === p ? 'bg-brand-gold text-white border-brand-gold shadow-lg shadow-brand-gold/20' : 'bg-white/5 border-white/5 text-white/40'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`px-4 py-2 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    selectedCategory === c ? 'bg-brand-gold text-white border-brand-gold shadow-lg shadow-brand-gold/20' : 'bg-white/5 border-white/5 text-white/40'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {muscleGroups.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMuscle(m)}
                  className={`px-4 py-2 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    selectedMuscle === m ? 'bg-brand-gold text-white border-brand-gold shadow-lg shadow-brand-gold/20' : 'bg-white/5 border-white/5 text-white/40'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {equipmentOptions.map((e) => (
                <button
                  key={e}
                  onClick={() => setSelectedEquipment(e)}
                  className={`px-4 py-2 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    selectedEquipment === e ? 'bg-brand-gold text-white border-brand-gold shadow-lg shadow-brand-gold/20' : 'bg-white/5 border-white/5 text-white/40'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="px-6 py-8 space-y-6 max-w-4xl mx-auto">
        {loading || (isSeeding && exercises.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-brand-pink/20 border-t-brand-pink rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Dumbbell className="w-8 h-8 text-brand-pink animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-display font-black text-white uppercase italic tracking-widest">
                {isSeeding ? 'Initializing Library...' : 'Loading Exercises...'}
              </h3>
              <p className="text-white/40 text-[10px] uppercase tracking-[0.2em]">
                {isSeeding ? `Syncing Biomechanical Database (${seedProgress}%)` : 'Preparing your workout database'}
              </p>
            </div>
          </div>
        ) : filteredExercises.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {filteredExercises.map((ex) => (
              <motion.button
                key={ex.id}
                layoutId={ex.id}
                onClick={() => setSelectedExercise(ex)}
                className="glass-card aspect-square p-3 flex flex-col justify-between group overflow-hidden relative active:scale-95 transition-transform"
              >
                <ExerciseMedia 
                  exerciseName={ex.name} 
                  className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none"
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-brand-black via-brand-black/20 to-transparent opacity-80" />
                
                <div className="relative z-10 space-y-1">
                  <div className="flex flex-wrap gap-0.5">
                    <span className="px-1 py-0.5 bg-brand-pink/20 text-brand-pink text-[5px] font-black uppercase tracking-widest rounded">
                      {ex.primaryMuscleGroup}
                    </span>
                    <span className="px-1 py-0.5 bg-brand-gold/20 text-brand-gold text-[5px] font-black uppercase tracking-widest rounded">
                      {ex.movementPattern}
                    </span>
                  </div>
                  <h4 className="text-[10px] font-display font-black text-white uppercase tracking-tight italic leading-tight group-hover:text-brand-pink transition-colors line-clamp-2">
                    {ex.name}
                  </h4>
                </div>
                
                <div className="relative z-10 flex items-center justify-between text-[6px] font-bold text-white/40 uppercase tracking-widest">
                  <span className="px-1.5 py-0.5 bg-white/5 rounded-full border border-white/5">
                    {ex.difficulty}
                  </span>
                  <ChevronRight className="w-2 h-2 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 space-y-6 flex flex-col items-center">
            <div className="p-6 bg-white/5 rounded-full">
              <Dumbbell className="w-12 h-12 text-white/10" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-white/40">No exercises found</p>
              <p className="text-[10px] text-white/20 uppercase tracking-widest">Try adjusting your filters</p>
            </div>
            
            {isSeeding && (
              <div className="w-full max-w-md p-8 glass-card border-brand-pink/30 bg-brand-pink/5 space-y-6 text-center">
                <div className="w-16 h-16 bg-brand-pink/20 rounded-full flex items-center justify-center mx-auto">
                  <Dumbbell className="w-8 h-8 text-brand-pink" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-display font-black text-white uppercase italic">Syncing Library</h2>
                  <p className="text-white/60 text-xs leading-relaxed">
                    We're populating your database with 450+ instructional videos. Exercises will appear below as they sync.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-brand-pink"
                      initial={{ width: 0 }}
                      animate={{ width: `${seedProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-brand-pink font-bold uppercase tracking-tighter animate-pulse">
                    Processing biomechanical data... {seedProgress}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Exercise Detail Modal */}
      <AnimatePresence>
        {selectedExercise && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedExercise(null)}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 cursor-pointer"
          >
            <motion.div 
              layoutId={selectedExercise.id}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-2xl p-8 space-y-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar cursor-default"
            >
              <button 
                onClick={() => setSelectedExercise(null)}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="space-y-6">
                <div className="aspect-video bg-white/5 rounded-3xl relative overflow-hidden group cursor-pointer" onClick={togglePlay}>
                  <ExerciseMedia 
                    exerciseName={selectedExercise.name}
                    muted={isMuted}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    videoRef={videoRef}
                    className="w-full h-full object-cover"
                  />
                  
                  <AnimatePresence>
                    {!isPlaying && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] pointer-events-none"
                      >
                        <div className="p-6 bg-brand-pink rounded-full shadow-2xl shadow-brand-pink/50">
                          <Play className="w-12 h-12 text-white fill-white" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMuted(!isMuted);
                      }}
                      className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all border border-white/10"
                    >
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                  <div className="absolute inset-0 border-2 border-white/5 rounded-3xl pointer-events-none" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 bg-brand-pink/20 text-brand-pink text-[8px] font-black uppercase tracking-widest rounded">
                          {selectedExercise.primaryMuscleGroup}
                        </span>
                        {selectedExercise.secondaryMuscleGroups?.map((m, i) => (
                          <span key={`${selectedExercise.id}-muscle-detail-${m}-${i}`} className="px-2 py-0.5 bg-white/5 text-white/40 text-[8px] font-black uppercase tracking-widest rounded">
                            {m}
                          </span>
                        ))}
                        <span className="px-2 py-0.5 bg-brand-gold/20 text-brand-gold text-[8px] font-black uppercase tracking-widest rounded">
                          {selectedExercise.movementPattern}
                        </span>
                        <span className="px-2 py-0.5 bg-white/10 text-white/60 text-[8px] font-black uppercase tracking-widest rounded">
                          {selectedExercise.difficulty}
                        </span>
                      </div>
                      <h3 className="text-3xl font-display font-black text-white uppercase italic tracking-tighter leading-none">
                        {selectedExercise.name}
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                      <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Equipment</p>
                      <p className="text-[10px] font-black text-white uppercase tracking-tight">
                        {Array.isArray(selectedExercise.equipment) ? selectedExercise.equipment.join(', ') : selectedExercise.equipment}
                      </p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                      <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Category</p>
                      <p className="text-[10px] font-black text-white uppercase tracking-tight">{selectedExercise.category}</p>
                    </div>
                  </div>

                  {selectedExercise.substitutionTiers && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-brand-pink" />
                        Substitution Tiers
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                          <p className="text-[8px] text-brand-pink font-bold uppercase tracking-widest">Tier 1: Direct Swap</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedExercise.substitutionTiers.tier1.map((s, i) => (
                              <span key={`tier1-${i}`} className="text-[9px] text-white/60 bg-white/5 px-2 py-1 rounded-lg">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                          <p className="text-[8px] text-brand-gold font-bold uppercase tracking-widest">Tier 2: Pattern Swap</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedExercise.substitutionTiers.tier2.map((s, i) => (
                              <span key={`tier2-${i}`} className="text-[9px] text-white/60 bg-white/5 px-2 py-1 rounded-lg">{s}</span>
                            ))}
                          </div>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                          <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Tier 3: Regression</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedExercise.substitutionTiers.tier3.map((s, i) => (
                              <span key={`tier3-${i}`} className="text-[9px] text-white/60 bg-white/5 px-2 py-1 rounded-lg">{s}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Info className="w-4 h-4 text-brand-pink" />
                        Description
                      </h4>
                      <p className="text-sm text-white/60 leading-relaxed">{selectedExercise.description}</p>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                        <Play className="w-4 h-4 text-brand-pink" />
                        Instructions
                      </h4>
                      <div className="space-y-4">
                        {selectedExercise.instructions.map((step, i) => (
                          <div key={`${selectedExercise.id}-step-${i}`} className="flex gap-4">
                            <span className="text-brand-pink font-display font-black italic">0{i + 1}</span>
                            <p className="text-sm text-white/60 leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedExercise.commonFormErrors && selectedExercise.commonFormErrors.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-brand-gold" />
                          Common Form Errors
                        </h4>
                        <ul className="space-y-2">
                          {selectedExercise.commonFormErrors.map((error, i) => (
                            <li key={`${selectedExercise.id}-error-${i}`} className="flex items-start gap-3 text-sm text-white/60 leading-relaxed">
                              <div className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-1.5 shrink-0" />
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {userHistory.length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-brand-pink" />
                          Weight Progression
                        </h4>
                        <div className="h-48 w-full bg-white/5 rounded-2xl p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={userHistory}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis 
                                dataKey="date" 
                                hide 
                              />
                              <YAxis 
                                stroke="rgba(255,255,255,0.2)" 
                                fontSize={10}
                                tickFormatter={(val) => `${val}kg`}
                              />
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                itemStyle={{ color: '#FF007A' }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="weight" 
                                stroke="#FF007A" 
                                strokeWidth={3}
                                dot={{ fill: '#FF007A', strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-[8px] text-white/20 uppercase tracking-widest text-center">Last 5 logged sessions</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <BottomNav />
    </div>
  );
};
