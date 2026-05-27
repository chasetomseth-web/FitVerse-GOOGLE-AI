import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../components/SupabaseProvider';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { ChevronLeft, User, Settings, LogOut, ChevronRight, Dumbbell, Target, Activity, Info, X, Plus, Minus, CircleCheck as CheckCircle2, Check, Camera, Trophy, Award, Zap, Clock, ArrowUpRight, ArrowDownRight, Scale, Ruler, Calendar, Sparkles, CircleAlert as AlertCircle, RotateCcw, Trash2 } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { UserProfile, WorkoutSession, BodyMetric, InjuryEntry, DailyLog, TrainingProgram } from '../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { calculateAge } from '../lib/utils';
import { refreshExerciseMetadata } from '../services/exerciseSeeder';
import { useUserProfile } from '../hooks/useUserProfile';
import { calculateDailyNutrition } from '../services/nutritionEngine';
import { 
  generateInitialProgram, 
  getBaseExercisesForFocus, 
  getRequiredEquipment,
  EQUIPMENT_SUBSTITUTION_MAP,
  substituteExerciseName
} from '../services/workoutEngine';
import { useDailyLog } from '../hooks/useDailyLog';
import { useActiveProgram } from '../hooks/useActiveProgram';
import { generate12WeekProgram } from '../services/programService';
import { toast } from 'react-hot-toast';

import { formatWeight, formatHeight, displayWeight, displayHeight } from '../lib/units';

export const Profile: React.FC = () => {
  const { user } = useSupabase();
  const { profile, updateProfile } = useUserProfile();
  const { log, setLog } = useDailyLog();
  const { activeProgram } = useActiveProgram();
  
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [lastWorkoutDoc, setLastWorkoutDoc] = useState<any>(null);
  const [hasMoreWorkouts, setHasMoreWorkouts] = useState(true);
  
  const [weightHistory, setWeightHistory] = useState<BodyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);

  // Camera states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Local state for debounced updates
  const [localProfile, setLocalProfile] = useState<Partial<UserProfile>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenMessage, setRegenMessage] = useState('');
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  
  // Equipment change notifications
  const [equipmentNotifications, setEquipmentNotifications] = useState<{ exercise: string; substitute: string }[]>([]);
  
  useEffect(() => {
    if (!showSettings) {
      setShowRegenConfirm(false);
      setLocalProfile({});
    }
  }, [showSettings]);

  const handleRegenerateProgram = async () => {
    if (!user) return;
    
    // Use localProfile if available, otherwise fallback to profile
    const profileToUse = (Object.keys(localProfile).length > 0 ? localProfile : profile) as UserProfile;
    if (!profileToUse) return;

    if (!showRegenConfirm) {
      setShowRegenConfirm(true);
      return;
    }

    setIsRegenerating(true);
    setShowRegenConfirm(false);
    setRegenMessage("Coach is forging your new 12-week program...");
    console.log('Starting program regeneration with profile:', profileToUse);

    try {
      const aiProgram = await generate12WeekProgram(profileToUse);
      console.log('AI Program generated:', aiProgram);
      
      // Deactivate current program
      if (activeProgram?.id) {
        await supabase
          .from('training_programs')
          .update({ status: 'completed' })
          .eq('id', activeProgram.id);
      }

      // Save new program
      const snakeCaseProgram: any = {
        id: aiProgram.programId,
        user_id: user.id,
        program_name: aiProgram.programName,
        total_weeks: aiProgram.totalWeeks,
        current_week: aiProgram.currentWeek,
        start_date: aiProgram.startDate,
        expected_end_date: aiProgram.expectedEndDate,
        status: aiProgram.status,
        phases: aiProgram.phases,
        weeks: aiProgram.weeks,
        weekly_schedule: aiProgram.weeklySchedule,
        consistency_score: aiProgram.consistencyScore,
        progress_percent: aiProgram.progressPercent
      };
      await supabase.from('training_programs').upsert(snakeCaseProgram);
      
      // Also update the profile with any changes made in the modal
      if (Object.keys(localProfile).length > 0) {
        await updateProfile(localProfile);
      }

      toast.success('New program generated successfully!');
      setShowSettings(false);
    } catch (error) {
      console.error('Error regenerating program:', error);
      toast.error('Failed to generate new program.');
    } finally {
      setIsRegenerating(false);
      setRegenMessage('');
    }
  };
  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [newInjury, setNewInjury] = useState<Partial<InjuryEntry>>({
    bodyPart: '',
    severity: 5,
    status: 'active',
    description: ''
  });

  const navigate = useNavigate();

  // Initialize local profile when profile loads
  useEffect(() => {
    if (profile && Object.keys(localProfile).length === 0) {
      setLocalProfile(profile);
    }
  }, [profile]);

  // Reset confirmation state when modal closes
  useEffect(() => {
    if (!showSettings) {
      setShowRegenConfirm(false);
    }
  }, [showSettings]);

  // Debounce logic
  useEffect(() => {
    if (!profile || Object.keys(localProfile).length === 0) return;

    const timer = setTimeout(async () => {
      // Check what changed
      const changedFields = Object.keys(localProfile).filter(
        key => JSON.stringify((localProfile as any)[key]) !== JSON.stringify((profile as any)[key])
      );

      if (changedFields.length === 0) return;

      setIsSaving(true);
      const updates: any = {};
      changedFields.forEach(field => {
        updates[field] = (localProfile as any)[field];
      });

      await updateProfile(updates);

      // Side Effects
      const nutritionTriggerFields = ['weightKg', 'heightCm', 'age'];
      const goalTriggerFields = ['primaryGoal'];
      const equipmentTriggerFields = ['availableEquipment'];

      if (changedFields.some(f => nutritionTriggerFields.includes(f) || goalTriggerFields.includes(f))) {
        await handleNutritionRecalculation(localProfile as UserProfile);
      }

      if (changedFields.some(f => goalTriggerFields.includes(f))) {
        await handleProgramRegeneration(localProfile as UserProfile);
      }

      if (changedFields.some(f => equipmentTriggerFields.includes(f))) {
        handleEquipmentCheck(localProfile as UserProfile);
      }

      setIsSaving(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [localProfile, profile]);

  const handleNutritionRecalculation = async (updatedProfile: UserProfile) => {
    const trainingDays = updatedProfile.preferredWorkoutDays?.length || 3;
    const readiness = log?.readinessScore || 70;
    
    const newTargets = calculateDailyNutrition(
      updatedProfile,
      trainingDays,
      log?.stepCount || 0,
      readiness
    );

    await setLog({
      calorieBudget: newTargets.calories,
      proteinTargetG: newTargets.proteinG,
      carbTargetG: newTargets.carbsG,
      fatTargetG: newTargets.fatG
    });
  };

  const handleProgramRegeneration = async (updatedProfile: UserProfile) => {
    if (!user) return;

    toast.loading('Updating program for your new goal...', { id: 'regen' });
    try {
      // 1. Generate new AI program
      const aiProgram = await generate12WeekProgram(updatedProfile);

      // 2. Deactivate existing programs
      const { data: activePrograms, error: fetchError } = await supabase
        .from('training_programs')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (fetchError) throw fetchError;

      if (activePrograms && activePrograms.length > 0) {
        await supabase
          .from('training_programs')
          .update({ status: 'completed' })
          .in('id', activePrograms.map(p => p.id));
      }

      // 3. Save new program
      const snakeCaseProgram: any = {
        id: aiProgram.programId,
        user_id: user.id,
        program_name: aiProgram.programName,
        total_weeks: aiProgram.totalWeeks,
        current_week: aiProgram.currentWeek,
        start_date: aiProgram.startDate,
        expected_end_date: aiProgram.expectedEndDate,
        status: aiProgram.status,
        phases: aiProgram.phases,
        weeks: aiProgram.weeks,
        weekly_schedule: aiProgram.weeklySchedule,
        consistency_score: aiProgram.consistencyScore,
        progress_percent: aiProgram.progressPercent
      };
      await supabase.from('training_programs').upsert(snakeCaseProgram);

      toast.success('Program updated for your new goal!', { id: 'regen' });
    } catch (error) {
      console.error('Error in automatic program regeneration:', error);
      toast.error('Failed to update program automatically. Try manual regeneration in settings.', { id: 'regen' });
    }
  };

  const handleEquipmentCheck = (updatedProfile: UserProfile) => {
    if (!activeProgram) return;

    const affected: { exercise: string; substitute: string }[] = [];
    const available = updatedProfile.availableEquipment || ['Bodyweight'];

    Object.values(activeProgram.weeklySchedule).forEach((session: any) => {
      const exercises = getBaseExercisesForFocus(session.sessionFocus);
      exercises.forEach(ex => {
        let currentName = ex.exerciseName;
        let required = getRequiredEquipment(currentName);
        
        const triedEquip = new Set<string>();
        let isAffected = false;
        let finalName = currentName;

        while (required.some(req => !available.includes(req as any))) {
          isAffected = true;
          const missing = required.find(req => !available.includes(req as any))!;
          
          if (triedEquip.has(missing)) break;
          triedEquip.add(missing);

          const sub = EQUIPMENT_SUBSTITUTION_MAP[missing];
          if (!sub) break;
          
          finalName = substituteExerciseName(finalName, missing, sub);
          required = getRequiredEquipment(finalName);
        }

        if (isAffected) {
          affected.push({
            exercise: currentName,
            substitute: finalName
          });
        }
      });
    });

    if (affected.length > 0) {
      setEquipmentNotifications(affected);
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchInitialHistory = async () => {
      try {
        // Fetch workouts - note: no startAfter equivalent for pagination in simple queries
        const { data: workoutData, error: workoutError } = await supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('date', { ascending: false })
          .limit(10);

        if (workoutError) throw workoutError;

        setWorkoutHistory((workoutData || []).map(d => ({ id: d.id, ...d } as WorkoutSession)));
        setHasMoreWorkouts((workoutData || []).length === 10);

        // Fetch weight history
        const { data: weightData, error: weightError } = await supabase
          .from('body_metrics')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
          .limit(10);

        if (weightError) throw weightError;

        setWeightHistory((weightData || []).map(d => ({ id: d.id, ...d } as BodyMetric)));
        setLoading(false);
      } catch (error) {
        handleSupabaseError(error, OperationType.LIST, 'workout_sessions/body_metrics');
        setLoading(false);
      }
    };

    fetchInitialHistory();
  }, [user]);

  const loadMoreWorkouts = async () => {
    if (!user || loadingMore || !hasMoreWorkouts) return;

    setLoadingMore(true);
    try {
      const offset = workoutHistory.length;
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('date', { ascending: false })
        .range(offset, offset + 9);

      if (error) throw error;

      if (data && data.length > 0) {
        const newWorkouts = data.map(d => ({ id: d.id, ...d } as WorkoutSession));
        setWorkoutHistory(prev => [...prev, ...newWorkouts]);
        setHasMoreWorkouts(data.length === 10);
      } else {
        setHasMoreWorkouts(false);
      }
    } catch (error) {
      handleSupabaseError(error, OperationType.LIST, 'workout_sessions');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleAddInjury = async () => {
    if (!user || !profile || !newInjury.bodyPart) return;

    const injury: InjuryEntry = {
      bodyPart: newInjury.bodyPart,
      severity: newInjury.severity || 5,
      dateReported: new Date().toISOString(),
      status: 'active',
      description: newInjury.description || ''
    };

    const updatedInjuries = [...(profile.injuryLog || []), injury];
    await updateProfile({ injuryLog: updatedInjuries });
    setLocalProfile(prev => ({ ...prev, injuryLog: updatedInjuries }));
    setShowInjuryModal(false);
    setNewInjury({ bodyPart: '', severity: 5, status: 'active', description: '' });
  };

  const toggleInjuryStatus = async (index: number) => {
    if (!profile) return;
    const updatedInjuries = [...(profile.injuryLog || [])];
    updatedInjuries[index].status = updatedInjuries[index].status === 'active' ? 'recovered' : 'active';
    await updateProfile({ injuryLog: updatedInjuries });
    setLocalProfile(prev => ({ ...prev, injuryLog: updatedInjuries }));
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/auth');
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 512, height: 512 } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Square crop
        const size = Math.min(video.videoWidth, video.videoHeight);
        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;
        
        canvas.width = 512;
        canvas.height = 512;
        
        context.drawImage(video, startX, startY, size, size, 0, 0, 512, 512);
        
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        await updateProfile({ photoURL: photoData });
        stopCamera();
      }
    }
  };

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
            <div 
              className="w-16 h-16 rounded-3xl bg-brand-pink/10 border border-brand-pink/20 flex items-center justify-center relative group overflow-hidden cursor-pointer" 
              onClick={startCamera}
            >
              {profile?.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt={profile.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <User className="w-8 h-8 text-brand-pink group-hover:scale-110 transition-transform" />
              )}
              <div className="absolute inset-0 bg-brand-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-display font-black text-white uppercase tracking-tighter italic leading-none">{profile?.name || 'Athlete'}</h1>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{profile?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(true)}
              className="p-3 bg-white/5 text-white/40 rounded-2xl hover:text-white hover:bg-white/10 transition-all"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={handleLogout}
              className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500/20 transition-all"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Camera Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-brand-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-md space-y-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Capture Profile</h2>
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Frame yourself for the FitVerse</p>
                </div>
                <button 
                  onClick={stopCamera}
                  className="p-3 bg-white/5 text-white/40 rounded-2xl hover:text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="relative aspect-square w-full rounded-3xl overflow-hidden border-2 border-brand-pink/20 shadow-2xl shadow-brand-pink/10">
                <video 
                  ref={videoRef}
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute inset-0 border-[24px] border-brand-black/40 pointer-events-none" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-64 h-64 border border-white/20 rounded-full" />
                </div>
              </div>

              <div className="flex items-center justify-center gap-6">
                <button 
                  onClick={stopCamera}
                  className="p-4 bg-white/5 text-white/40 rounded-2xl hover:text-white transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
                <button 
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-brand-pink rounded-full flex items-center justify-center shadow-lg shadow-brand-pink/40 active:scale-90 transition-all group"
                >
                  <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center group-hover:border-white/40 transition-all">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                </button>
                <div className="w-14" /> {/* Spacer */}
              </div>
              
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        {/* Saving Indicator */}
        <AnimatePresence>
          {isSaving && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-brand-pink/90 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-brand-pink/20 backdrop-blur-md flex items-center gap-2"
            >
              <div className="w-2 h-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Syncing with FitVerse...
            </motion.div>
          )}
        </AnimatePresence>

        {/* Equipment Notifications */}
        <AnimatePresence>
          {equipmentNotifications.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card border-brand-gold/30 bg-brand-gold/5 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-gold">
                  <AlertCircle className="w-4 h-4" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Equipment Update Required</h4>
                </div>
                <button 
                  onClick={() => setEquipmentNotifications([])}
                  className="text-white/20 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {equipmentNotifications.map((notif, i) => (
                  <div key={`${notif.exercise}-${i}`} className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest">
                    <span className="text-white/40">{notif.exercise}</span>
                    <span className="text-brand-gold">→ {notif.substitute}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Physical Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { 
              label: 'Weight', 
              value: displayWeight(localProfile.weightKg || 0, localProfile.unitSystem || 'imperial'),
              unit: localProfile.unitSystem === 'metric' ? 'kg' : 'lbs', 
              icon: Scale, 
              color: 'text-brand-pink', 
              key: 'weightKg' 
            },
            { 
              label: 'Height', 
              value: localProfile.unitSystem === 'metric' 
                ? Math.round(localProfile.heightCm || 0) 
                : `${displayHeight(localProfile.heightCm || 0, 'imperial').val1}'${displayHeight(localProfile.heightCm || 0, 'imperial').val2}"`,
              unit: localProfile.unitSystem === 'metric' ? 'cm' : '', 
              icon: Ruler, 
              color: 'text-brand-gold', 
              key: 'heightCm' 
            },
            { label: 'Birthdate', value: localProfile.birthDate, unit: '', icon: User, color: 'text-emerald-500', key: 'birthDate', type: 'date' },
            { label: 'Level', value: localProfile.fitnessLevel, unit: '', icon: Zap, color: 'text-indigo-400', key: 'fitnessLevel', type: 'select', options: ['beginner', 'intermediate', 'advanced'] },
          ].map((stat, i) => {
            const [bYear, bMonth, bDay] = (localProfile.birthDate || '2000-01-01').split('-');
            
            return (
            <div key={i} className="glass-card p-4 space-y-2 border-l-2 border-white/5">
              <div className="flex items-center justify-between">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{stat.label}</span>
              </div>
              {stat.type === 'select' ? (
                <select 
                  value={stat.value}
                  onChange={(e) => setLocalProfile(prev => ({ ...prev, [stat.key]: e.target.value }))}
                  className="w-full bg-transparent text-lg font-display font-black text-white leading-none uppercase italic focus:outline-none appearance-none cursor-pointer"
                >
                  {stat.options?.map(opt => (
                    <option key={opt} value={opt} className="bg-brand-black">{opt}</option>
                  ))}
                </select>
              ) : stat.type === 'date' ? (
                <div className="flex flex-col gap-1">
                  <div className="flex gap-1">
                    <select 
                      value={bMonth} 
                      onChange={(e) => {
                        const newDate = `${bYear}-${e.target.value}-${bDay}`;
                        setLocalProfile(prev => ({ ...prev, birthDate: newDate, age: calculateAge(newDate) }));
                      }}
                      className="bg-transparent text-[10px] font-display font-black text-white leading-none uppercase italic focus:outline-none appearance-none cursor-pointer"
                    >
                      {Array.from({ length: 12 }).map((_, i) => (
                        <option key={i} value={String(i + 1).padStart(2, '0')} className="bg-brand-black">{i + 1}</option>
                      ))}
                    </select>
                    <span className="text-[8px] text-white/20">/</span>
                    <select 
                      value={bDay} 
                      onChange={(e) => {
                        const newDate = `${bYear}-${bMonth}-${e.target.value}`;
                        setLocalProfile(prev => ({ ...prev, birthDate: newDate, age: calculateAge(newDate) }));
                      }}
                      className="bg-transparent text-[10px] font-display font-black text-white leading-none uppercase italic focus:outline-none appearance-none cursor-pointer"
                    >
                      {Array.from({ length: 31 }).map((_, i) => (
                        <option key={i} value={String(i + 1).padStart(2, '0')} className="bg-brand-black">{i + 1}</option>
                      ))}
                    </select>
                    <span className="text-[8px] text-white/20">/</span>
                    <select 
                      value={bYear} 
                      onChange={(e) => {
                        const newDate = `${e.target.value}-${bMonth}-${bDay}`;
                        setLocalProfile(prev => ({ ...prev, birthDate: newDate, age: calculateAge(newDate) }));
                      }}
                      className="bg-transparent text-[10px] font-display font-black text-white leading-none uppercase italic focus:outline-none appearance-none cursor-pointer"
                    >
                      {Array.from({ length: 100 }).map((_, i) => {
                        const year = new Date().getFullYear() - i;
                        return <option key={i} value={String(year)} className="bg-brand-black">{year}</option>;
                      })}
                    </select>
                  </div>
                  <span className="text-[8px] font-bold text-white/20 uppercase">
                    {localProfile.age} yrs
                  </span>
                </div>
              ) : (
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-display font-black text-white leading-none uppercase italic">
                    {stat.value}
                  </span>
                  <span className="text-[8px] font-bold text-white/20 uppercase">{stat.unit}</span>
                </div>
              )}
            </div>
            );
          })}
        </section>

        {/* Goals & Equipment */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Primary Goal</h3>
              <Target className="w-5 h-5 text-brand-pink" />
            </div>
            <select 
              value={localProfile.primaryGoal}
              onChange={(e) => setLocalProfile(prev => ({ ...prev, primaryGoal: e.target.value as any }))}
              className="w-full p-4 bg-white/5 rounded-2xl border border-white/5 text-sm font-display font-black text-white uppercase tracking-tight italic focus:outline-none focus:border-brand-pink transition-all appearance-none cursor-pointer"
            >
              {[
                { id: 'weight_loss', name: 'Weight Loss' },
                { id: 'muscle_gain', name: 'Muscle Gain' },
                { id: 'sports_performance', name: 'Sports Performance' }
              ].map(goal => (
                <option key={goal.id} value={goal.id} className="bg-brand-black">{goal.name}</option>
              ))}
            </select>
            <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest mt-1">Changing goal will regenerate your program</p>
          </div>

          <div className="glass-card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic leading-none">Equipment Arsenal</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Tap to add or remove from your profile</p>
              </div>
              <Dumbbell className="w-5 h-5 text-brand-gold" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                'Barbell', 'Dumbbell', 'Kettlebell', 'Bench', 
                'Rack', 'Pull-up Bar', 'Bands', 'Cable Machine', 
                'Machines', 'Cardio Machines', 'Bodyweight'
              ].map((eq) => {
                const isSelected = localProfile.availableEquipment?.includes(eq as any);
                return (
                  <button 
                    key={eq}
                    onClick={() => {
                      const current = localProfile.availableEquipment || [];
                      const updated = isSelected 
                        ? current.filter(e => e !== eq)
                        : [...current, eq as any];
                      setLocalProfile(prev => ({ ...prev, availableEquipment: updated }));
                    }}
                    className={`flex items-center justify-between px-3 py-3 rounded-2xl border transition-all group ${
                      isSelected 
                        ? 'bg-brand-gold/10 text-brand-gold border-brand-gold/30' 
                        : 'bg-white/5 text-white/40 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-tight italic">{eq}</span>
                    {isSelected ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="pt-4 border-t border-white/5">
              <button 
                onClick={() => {
                  const all: any[] = ['Barbell', 'Dumbbell', 'Kettlebell', 'Bench', 'Rack', 'Pull-up Bar', 'Bands', 'Cable Machine', 'Machines', 'Cardio Machines', 'Bodyweight'];
                  setLocalProfile(prev => ({ ...prev, availableEquipment: all }));
                }}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
              >
                Reset to Full Gym Access
              </button>
            </div>
          </div>
        </section>

        {/* Strength Baselines */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Strength Baselines</h3>
            <Dumbbell className="w-5 h-5 text-brand-gold" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { key: 'benchPress', label: 'Bench' },
              { key: 'squat', label: 'Squat' },
              { key: 'deadlift', label: 'Deadlift' },
              { key: 'overheadPress', label: 'OHP' },
              { key: 'barbellRow', label: 'Row' },
            ].map((lift) => {
              const valKg = localProfile.strengthBaselines?.[lift.key as keyof typeof localProfile.strengthBaselines] || 0;
              const displayVal = displayWeight(valKg, localProfile.unitSystem || 'imperial');
              const unit = localProfile.unitSystem === 'imperial' ? 'lbs' : 'kg';
              
              return (
                <div key={lift.key} className="glass-card p-4 space-y-1 text-center border-b-2 border-brand-gold/20">
                  <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">{lift.label}</p>
                  <p className="text-lg font-display font-black text-white italic">{displayVal}<span className="text-[8px] ml-0.5 text-white/20 uppercase">{unit}</span></p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Injury Log */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Injury Log</h3>
            <button 
              onClick={() => setShowInjuryModal(true)}
              className="p-2 bg-brand-pink/10 text-brand-pink rounded-xl hover:bg-brand-pink/20 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localProfile.injuryLog?.map((injury, i) => (
              <div key={`${injury.bodyPart}-${injury.date}-${i}`} className={`glass-card p-4 space-y-3 border-l-2 ${injury.status === 'active' ? 'border-red-500' : 'border-emerald-500'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${injury.status === 'active' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                    <h5 className="text-xs font-black text-white uppercase tracking-widest">{injury.bodyPart}</h5>
                  </div>
                  <button 
                    onClick={() => toggleInjuryStatus(i)}
                    className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${
                      injury.status === 'active' 
                        ? 'text-red-500 border-red-500/30 bg-red-500/10' 
                        : 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
                    }`}
                  >
                    {injury.status}
                  </button>
                </div>
                <p className="text-[10px] text-white/60 leading-relaxed">{injury.description}</p>
                <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Reported: {format(new Date(injury.dateReported), 'MMM d, yyyy')}</p>
              </div>
            ))}
            {(!localProfile.injuryLog || localProfile.injuryLog.length === 0) && (
              <div className="col-span-full glass-card p-8 text-center border-dashed border-2 border-white/5">
                <Activity className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">No injuries logged. Stay safe!</p>
              </div>
            )}
          </div>
        </section>

        {/* Workout History */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Workout History</h3>
              <span className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-black text-white/40 uppercase tracking-widest">
                {workoutHistory.length} Sessions
              </span>
            </div>
            <Calendar className="w-5 h-5 text-white/20" />
          </div>
          <div className="space-y-3">
            {workoutHistory.length > 0 ? workoutHistory.map((workout) => (
              <div key={workout.id} className="glass-card p-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-brand-pink/10 rounded-2xl group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-5 h-5 text-brand-pink" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white uppercase tracking-widest">{workout.sessionFocus}</h5>
                    <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">{format(new Date(workout.date), 'MMMM do, yyyy')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-display font-black text-white italic">{workout.actualDuration || workout.plannedDuration} Min</p>
                  <p className="text-[8px] text-brand-pink font-bold uppercase tracking-widest">RPE {workout.overallRPE || '--'}</p>
                </div>
              </div>
            )) : (
              <div className="glass-card p-8 text-center space-y-2">
                <Calendar className="w-8 h-8 text-white/10 mx-auto" />
                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">No workout history yet.</p>
              </div>
            )}
            
            {hasMoreWorkouts && (
              <button 
                onClick={loadMoreWorkouts}
                disabled={loadingMore}
                className="w-full py-4 glass-card border-dashed border-2 border-white/5 text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white hover:border-white/20 transition-all disabled:opacity-50"
              >
                {loadingMore ? 'Loading fit history...' : 'Load More Workouts'}
              </button>
            )}
          </div>
        </section>

        {/* Weight History */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Weight History</h3>
            <Scale className="w-5 h-5 text-white/20" />
          </div>
          <div className="space-y-3">
            {weightHistory.length > 0 ? weightHistory.map((metric) => (
              <div key={metric.id} className="glass-card p-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl group-hover:scale-110 transition-transform">
                    <Activity className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white uppercase tracking-widest">{formatWeight(metric.weightKg, localProfile.unitSystem || 'imperial')}</h5>
                    <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">{format(new Date(metric.date), 'MMMM do, yyyy')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">{metric.source}</p>
                </div>
              </div>
            )) : (
              <div className="glass-card p-8 text-center space-y-2">
                <Scale className="w-8 h-8 text-white/10 mx-auto" />
                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">No weight entries yet.</p>
              </div>
            )}
          </div>
        </section>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
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
              className="glass-card w-full max-w-md p-8 space-y-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center space-y-2">
                <h3 className="text-3xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Settings</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Configure your FitVerse experience</p>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-brand-pink uppercase tracking-widest">Physical Profile</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1 col-span-2">
                      <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Unit System</label>
                      <div className="flex bg-white/5 p-1 rounded-xl">
                        <button 
                          onClick={() => setLocalProfile(prev => ({ ...prev, unitSystem: 'imperial' }))}
                          className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${localProfile.unitSystem === 'imperial' ? 'bg-brand-pink text-white' : 'text-white/40'}`}
                        >
                          Imperial
                        </button>
                        <button 
                          onClick={() => setLocalProfile(prev => ({ ...prev, unitSystem: 'metric' }))}
                          className={`flex-1 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${localProfile.unitSystem === 'metric' ? 'bg-brand-pink text-white' : 'text-white/40'}`}
                        >
                          Metric
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Birthdate</label>
                      <div className="flex gap-2">
                        <select 
                          value={(localProfile.birthDate || '2000-01-01').split('-')[1]} 
                          onChange={(e) => {
                            const [y, m, d] = (localProfile.birthDate || '2000-01-01').split('-');
                            const newDate = `${y}-${e.target.value}-${d}`;
                            setLocalProfile(prev => ({ ...prev, birthDate: newDate, age: calculateAge(newDate) }));
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-pink transition-all text-white appearance-none"
                        >
                          {Array.from({ length: 12 }).map((_, i) => (
                            <option key={`month-${i}`} value={String(i + 1).padStart(2, '0')} className="bg-brand-black">
                              {format(new Date(2000, i, 1), 'MMMM')}
                            </option>
                          ))}
                        </select>
                        <select 
                          value={(localProfile.birthDate || '2000-01-01').split('-')[2]} 
                          onChange={(e) => {
                            const [y, m, d] = (localProfile.birthDate || '2000-01-01').split('-');
                            const newDate = `${y}-${m}-${e.target.value}`;
                            setLocalProfile(prev => ({ ...prev, birthDate: newDate, age: calculateAge(newDate) }));
                          }}
                          className="w-20 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-pink transition-all text-white appearance-none text-center"
                        >
                          {Array.from({ length: 31 }).map((_, i) => (
                            <option key={`day-${i}`} value={String(i + 1).padStart(2, '0')} className="bg-brand-black">{i + 1}</option>
                          ))}
                        </select>
                        <select 
                          value={(localProfile.birthDate || '2000-01-01').split('-')[0]} 
                          onChange={(e) => {
                            const [y, m, d] = (localProfile.birthDate || '2000-01-01').split('-');
                            const newDate = `${e.target.value}-${m}-${d}`;
                            setLocalProfile(prev => ({ ...prev, birthDate: newDate, age: calculateAge(newDate) }));
                          }}
                          className="w-24 bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold uppercase tracking-widest focus:outline-none focus:border-brand-pink transition-all text-white appearance-none text-center"
                        >
                          {Array.from({ length: 100 }).map((_, i) => {
                            const year = new Date().getFullYear() - i;
                            return <option key={`year-${year}`} value={String(year)} className="bg-brand-black">{year}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">
                        Weight ({localProfile.unitSystem === 'imperial' ? 'lbs' : 'kg'})
                      </label>
                      <input 
                        type="number" 
                        value={displayWeight(localProfile.weightKg || 0, localProfile.unitSystem || 'imperial')}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const weightKg = localProfile.unitSystem === 'imperial' 
                            ? Math.round(val / 2.20462) 
                            : Math.round(val);
                          setLocalProfile(prev => ({ ...prev, weightKg }));
                        }}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">
                        Height ({localProfile.unitSystem === 'imperial' ? 'ft/in' : 'cm'})
                      </label>
                      {localProfile.unitSystem === 'imperial' ? (
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            placeholder="ft"
                            value={displayHeight(localProfile.heightCm || 0, 'imperial').val1}
                            onChange={(e) => {
                              const ft = parseInt(e.target.value) || 0;
                              const currentIn = displayHeight(localProfile.heightCm || 0, 'imperial').val2 || 0;
                              const heightCm = Math.round((ft * 12 + currentIn) * 2.54);
                              setLocalProfile(prev => ({ ...prev, heightCm }));
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all text-white"
                          />
                          <input 
                            type="number" 
                            placeholder="in"
                            value={displayHeight(localProfile.heightCm || 0, 'imperial').val2}
                            onChange={(e) => {
                              const inch = parseInt(e.target.value) || 0;
                              const currentFt = displayHeight(localProfile.heightCm || 0, 'imperial').val1;
                              const heightCm = Math.round((currentFt * 12 + inch) * 2.54);
                              setLocalProfile(prev => ({ ...prev, heightCm }));
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all text-white"
                          />
                        </div>
                      ) : (
                        <input 
                          type="number" 
                          value={displayHeight(localProfile.heightCm || 0, 'metric').val1}
                          onChange={(e) => {
                            const heightCm = Math.round(parseFloat(e.target.value) || 0);
                            setLocalProfile(prev => ({ ...prev, heightCm }));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all text-white"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-brand-pink uppercase tracking-widest">Strength Baselines ({localProfile.unitSystem === 'imperial' ? 'lbs' : 'kg'})</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'benchPress', label: 'Bench Press' },
                      { key: 'squat', label: 'Squat' },
                      { key: 'deadlift', label: 'Deadlift' },
                      { key: 'overheadPress', label: 'OHP' },
                      { key: 'barbellRow', label: 'Barbell Row' },
                    ].map((lift) => (
                      <div key={lift.key} className="space-y-1">
                        <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">{lift.label}</label>
                        <input 
                          type="number" 
                          value={displayWeight(localProfile.strengthBaselines?.[lift.key as keyof typeof localProfile.strengthBaselines] || 0, localProfile.unitSystem || 'imperial')}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const weightKg = localProfile.unitSystem === 'imperial' 
                              ? Math.round(val / 2.20462) 
                              : Math.round(val);
                            setLocalProfile(prev => ({
                              ...prev,
                              strengthBaselines: {
                                ...(prev.strengthBaselines || {}),
                                [lift.key]: weightKg
                              }
                            }));
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-brand-pink uppercase tracking-widest">Training Preferences</h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Workout Duration (min)</label>
                      <input 
                        type="number" 
                        value={localProfile.preferredWorkoutDuration || ''}
                        onChange={(e) => setLocalProfile(prev => ({ ...prev, preferredWorkoutDuration: parseInt(e.target.value) }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Training Days Per Week</label>
                      <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                        <button 
                          onClick={() => {
                            const current = localProfile.preferredWorkoutDays?.length || 3;
                            const newVal = Math.max(1, current - 1);
                            const daysMap: Record<number, number[]> = {
                              1: [3], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7]
                            };
                            setLocalProfile(prev => ({ ...prev, preferredWorkoutDays: daysMap[newVal] }));
                          }}
                          className="p-2 bg-white/10 rounded-lg text-white"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-xl font-display font-black text-white italic">{(localProfile.preferredWorkoutDays?.length || 3)} Days</span>
                        <button 
                          onClick={() => {
                            const current = localProfile.preferredWorkoutDays?.length || 3;
                            const newVal = Math.min(7, current + 1);
                            const daysMap: Record<number, number[]> = {
                              1: [3], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7]
                            };
                            setLocalProfile(prev => ({ ...prev, preferredWorkoutDays: daysMap[newVal] }));
                          }}
                          className="p-2 bg-white/10 rounded-lg text-white"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-brand-pink uppercase tracking-widest">Training Program</h4>
                  <div className="space-y-4">
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-relaxed">
                      If your program is missing sessions or you want a fresh start, you can regenerate it based on your current profile.
                    </p>
                    
                    {showRegenConfirm ? (
                      <div className="p-4 rounded-xl bg-brand-pink/10 border border-brand-pink/20 space-y-4">
                        <p className="text-[10px] font-black text-brand-pink uppercase tracking-widest text-center">
                          Are you sure? This replaces your current program.
                        </p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setShowRegenConfirm(false)}
                            className="flex-1 py-3 rounded-lg bg-white/5 border border-white/10 text-[8px] font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all"
                          >
                            Cancel
                          </button>
                          <button 
                            onClick={handleRegenerateProgram}
                            className="flex-1 py-3 rounded-lg bg-brand-pink text-[8px] font-black text-white uppercase tracking-widest hover:bg-brand-pink/80 transition-all shadow-lg shadow-brand-pink/20"
                          >
                            Yes, Regenerate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={handleRegenerateProgram}
                        disabled={isRegenerating}
                        className="w-full py-4 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center gap-3 hover:bg-white/10 transition-all group disabled:opacity-50"
                      >
                        {isRegenerating ? (
                          <>
                            <div className="w-4 h-4 border-2 border-brand-pink border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">{regenMessage || 'Regenerating...'}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-brand-gold group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Regenerate Program</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-brand-pink uppercase tracking-widest">System</h4>
                  <div className="space-y-2">
                    <button 
                      onClick={async () => {
                        setRefreshing(true);
                        try {
                          await refreshExerciseMetadata((p) => setRefreshProgress(p));
                          alert('Exercise metadata refreshed successfully!');
                        } catch (err) {
                          console.error('Refresh failed:', err);
                          alert('Failed to refresh metadata. Check console for details.');
                        } finally {
                          setRefreshing(false);
                          setRefreshProgress(0);
                        }
                      }}
                      disabled={refreshing}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all group disabled:opacity-50"
                    >
                      {refreshing ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-4 h-4 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-brand-gold">{refreshProgress}%</span>
                        </div>
                      ) : (
                        <>
                          <Sparkles className={`w-4 h-4 text-brand-gold group-hover:animate-pulse`} />
                          <span className="text-[10px] font-black text-white uppercase tracking-widest">Refresh Exercise Metadata</span>
                        </>
                      )}
                    </button>
                    <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest text-center">Fixes broken video links and updates exercise data</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-brand-pink uppercase tracking-widest">Reset & Onboarding</h4>
                    <div className="space-y-2">
                       <button 
                        onClick={() => navigate('/onboarding')}
                        className="w-full py-4 bg-brand-pink/10 border border-brand-pink/20 rounded-xl flex items-center justify-center gap-3 hover:bg-brand-pink/20 transition-all group"
                      >
                        <RotateCcw className="w-4 h-4 text-brand-pink group-hover:rotate-180 transition-transform duration-500" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Re-run Onboarding</span>
                      </button>
                      <p className="text-[8px] text-white/20 font-bold uppercase tracking-widest text-center">Navigate back to the guided setup journey</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={async () => {
                    if (Object.keys(localProfile).length > 0) {
                      setIsSaving(true);
                      await updateProfile(localProfile);
                      setIsSaving(false);
                    }
                    setShowSettings(false);
                  }}
                  disabled={isSaving}
                  className="w-full btn-primary py-5 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Injury Modal */}
      <AnimatePresence>
        {showInjuryModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-card w-full max-w-md p-8 space-y-6 relative"
            >
              <button 
                onClick={() => setShowInjuryModal(false)}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center space-y-2">
                <h3 className="text-2xl font-display font-black text-white uppercase italic tracking-tighter">Report Injury</h3>
                <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Help us adjust your training safely</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Body Part</label>
                  <select 
                    value={newInjury.bodyPart}
                    onChange={(e) => setNewInjury(prev => ({ ...prev, bodyPart: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all appearance-none text-white"
                  >
                    <option value="" className="bg-brand-black">Select body part...</option>
                    {['Shoulder', 'Elbow', 'Wrist', 'Lower Back', 'Upper Back', 'Hip', 'Knee', 'Ankle', 'Neck'].map(part => (
                      <option key={part} value={part} className="bg-brand-black">{part}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Severity (1-10)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={newInjury.severity}
                      onChange={(e) => setNewInjury(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                      className="flex-1 accent-brand-pink"
                    />
                    <span className="text-xs font-black text-brand-pink w-4">{newInjury.severity}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Description</label>
                  <textarea 
                    value={newInjury.description}
                    onChange={(e) => setNewInjury(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe the pain or limitation..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all min-h-[100px] text-white"
                  />
                </div>

                <button 
                  onClick={handleAddInjury}
                  disabled={!newInjury.bodyPart}
                  className="w-full btn-primary py-4 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Add to Injury Log</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <BottomNav />
    </div>
  );
};
