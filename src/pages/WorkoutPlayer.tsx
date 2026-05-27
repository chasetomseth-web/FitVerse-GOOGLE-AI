import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFirebase } from '../components/FirebaseProvider';
import { db } from '../firebase';
import { collection, doc, addDoc, getDoc, setDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  Zap, 
  X,
  ArrowRight,
  ArrowUpRight,
  Award,
  Trophy,
  Dumbbell,
  Home,
  ZapOff,
  Smile,
  Meh,
  Frown,
  Battery,
  Timer,
  Star
} from 'lucide-react';
import { WorkoutSession, TrainingProgram, Achievement } from '../types';
import { format, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { generateAdjustedSession } from '../services/workoutEngine';
import { evaluateProgressiveOverload, updateStrengthBaselines } from '../services/progressiveOverloadEngine';
import { checkAndAwardAchievements } from '../services/achievementEngine';
import { useActiveProgram } from '../hooks/useActiveProgram';
import { useDailyLog } from '../hooks/useDailyLog';
import { useUserProfile } from '../hooks/useUserProfile';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { useToast } from '../components/ui/Toast';
import { ExerciseMedia } from '../components/ExerciseMedia';

export const WorkoutPlayer: React.FC = () => {
  const { user } = useFirebase();
  const { profile, updateProfile } = useUserProfile();
  const { activeProgram, loading: programLoading } = useActiveProgram();
  const { log: todayLog, loading: logLoading, setLog } = useDailyLog();
  const [searchParams] = useSearchParams();
  const sessionIdParam = searchParams.get('sessionId');
  
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Pre-workout setup state
  const [setupStep, setSetupStep] = useState(0);
  const [setupAnswers, setSetupAnswers] = useState({
    feeling: '',
    location: '',
    time: 0
  });
  const [showSummary, setShowSummary] = useState(false);

  // Post-workout feedback
  const [feedback, setFeedback] = useState({
    rpe: 8,
    notes: ''
  });
  
  // Inputs for actual performance
  const [actualReps, setActualReps] = useState<number>(0);
  const [actualWeight, setActualWeight] = useState<number>(0);
  const [actualRPE, setActualRPE] = useState<number>(8);
  const [earnedAchievements, setEarnedAchievements] = useState<Achievement[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sanitizeExerciseName = (name: string): string => {
    const n = name.toLowerCase().trim();
    if (n === 'arm circles' || n.includes('arm circle')) {
      return 'Air Squat'; // Safe default from library
    }
    return name;
  };

  const sanitizeSession = (sess: WorkoutSession): WorkoutSession => {
    return {
      ...sess,
      blocks: (sess.blocks || []).map(b => ({
        ...b,
        exercises: (b.exercises || []).map(ex => {
          const cleanName = sanitizeExerciseName(ex.exerciseName);
          return {
            ...ex,
            exerciseName: cleanName,
            exerciseId: cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')
          };
        })
      })),
      exercises: (sess.exercises || []).map(ex => {
        const cleanName = sanitizeExerciseName(ex.exerciseName);
        return {
          ...ex,
          exerciseName: cleanName,
          exerciseId: cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')
        };
      })
    };
  };
  
  // Timer states
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [circuitTimer, setCircuitTimer] = useState(0);
  const [isCircuitActive, setIsCircuitActive] = useState(false);
  const [circuitRounds, setCircuitRounds] = useState(0);
  const [countdown, setCountdown] = useState(0);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load session if ID passed or check today's state
  useEffect(() => {
    const loadSession = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        if (sessionIdParam) {
          const docRef = doc(db, 'users', user.uid, 'workout_sessions', sessionIdParam);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data() as WorkoutSession;
            if (data.status === 'assigned' || data.status === 'in-progress') {
              setSession(sanitizeSession({ id: docSnap.id, ...data }));
              setShowSummary(true);
            }
          }
        } else {
          // Check today's daily_workout_state
          const todayStr = format(new Date(), 'yyyy-MM-dd');
          const stateRef = doc(db, 'users', user.uid, 'daily_workout_states', todayStr);
          const stateSnap = await getDoc(stateRef);
          
          if (stateSnap.exists()) {
            const stateData = stateSnap.data();
            if (stateData.exerciseBlocks && stateData.exerciseBlocks.length > 0) {
              // Create a temporary session object from the state
              const tempSession: WorkoutSession = {
                sessionId: `sess_${Date.now()}`,
                uid: user.uid,
                date: todayStr,
                programId: stateData.programId,
                programWeek: stateData.programWeek,
                sessionFocus: stateData.workoutFocus,
                plannedDuration: stateData.workoutDuration,
                readinessAtSession: todayLog?.readinessScore || 70,
                adjustmentsMade: {
                  volumeChange: 0,
                  intensityRPE: 0,
                  restModifier: 1.0,
                  reason: 'Generated via Adaptive Engine'
                },
                blocks: stateData.exerciseBlocks,
                exercises: stateData.exerciseBlocks.flatMap((b: any) => b.exercises),
                achievementsUnlocked: [],
                status: 'in-progress',
                notes: ''
              };
              setSession(sanitizeSession(tempSession));
              setShowSummary(true);
            }
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [user, sessionIdParam, todayLog]);

  const unitSystem = profile?.unitSystem || 'imperial';
  const weightFactor = unitSystem === 'imperial' ? 2.20462 : 1;
  const weightUnit = unitSystem === 'imperial' ? 'lbs' : 'kg';

  useEffect(() => {
    if (session && session.blocks && session.blocks[currentBlockIndex]) {
      const currentBlock = session.blocks[currentBlockIndex];
      const currentExercise = currentBlock.exercises[currentExerciseIndex];
      if (currentExercise && currentExercise.sets[currentSetIndex]) {
        const currentSet = currentExercise.sets[currentSetIndex];
        setActualReps(currentSet.reps);
        setActualWeight(Math.round(currentSet.weight * weightFactor));
        setActualRPE(currentSet.rpe || 8);
      }
    }
  }, [currentBlockIndex, currentExerciseIndex, currentSetIndex, session, weightFactor]);

  const handleStartSetup = async () => {
    if (!user || !profile || !activeProgram) return;

    setGenerating(true);
    try {
      const readinessScore = todayLog?.readinessScore || 70;
      
      // Map feeling to readiness adjustment
      let adjustedReadiness = readinessScore;
      if (setupAnswers.feeling === 'Great') adjustedReadiness += 5;
      if (setupAnswers.feeling === 'Low Energy') adjustedReadiness -= 10;
      if (setupAnswers.feeling === 'Fatigued') adjustedReadiness -= 20;

      // Map location to equipment
      let equipment: string[] = [];
      if (setupAnswers.location === 'Full Gym') {
        equipment = ['Barbell', 'Dumbbell', 'Kettlebell', 'Cable Machine', 'Machines', 'Bench', 'Rack', 'Pull-up Bar', 'Bands', 'Cardio Machines', 'Bodyweight'];
      } else if (setupAnswers.location === 'Home Gym') {
        equipment = profile.availableEquipment || ['Bodyweight'];
      } else if (setupAnswers.location === 'Minimal Equipment') {
        equipment = ['Dumbbell', 'Kettlebell', 'Bands', 'Bodyweight'];
      } else {
        equipment = ['Bodyweight'];
      }

      const newSession = generateAdjustedSession(
        activeProgram,
        adjustedReadiness,
        equipment,
        setupAnswers.time,
        profile.injuryLog?.filter(i => i.status === 'active') || [],
        profile.strengthBaselines || {},
        user.uid,
        todayLog || undefined
      );

      const docRef = await addDoc(collection(db, 'users', user.uid, 'workout_sessions'), {
        ...newSession,
        status: 'in-progress',
        startTime: new Date().toISOString()
      });
      
      setSession(sanitizeSession({ id: docRef.id, ...newSession }));
      setShowSummary(true);
    } catch (error) {
      console.error('Error generating session:', error);
      toast('Failed to generate session', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleNextSet = async () => {
    if (!session || !session.blocks) return;
    const currentBlock = session.blocks[currentBlockIndex];
    const currentExercise = currentBlock.exercises[currentExerciseIndex];
    const currentSet = currentExercise.sets[currentSetIndex];
    if (!currentExercise || !currentSet) return;

    const updatedBlocks = [...session.blocks];
    const updatedSet = {
      ...currentSet,
      completedAt: new Date().toISOString(),
      actualReps,
      actualWeight: Math.round(actualWeight / weightFactor),
      actualRPE
    };
    updatedBlocks[currentBlockIndex].exercises[currentExerciseIndex].sets[currentSetIndex] = updatedSet;

    const updatedSession = { ...session, blocks: updatedBlocks };
    setSession(updatedSession);

    // Save to Firestore
    try {
      if (session.id) {
        const sessionRef = doc(db, 'users', user.uid, 'workout_sessions', session.id);
        await setDoc(sessionRef, {
          blocks: updatedBlocks,
          exercises: updatedBlocks.flatMap(b => b.exercises) // Keep flattened for compatibility
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error saving set:', error);
    }

    // Start rest timer if applicable
    const restSeconds = parseInt(currentExercise.rest || '60');
    if (restSeconds > 0) {
      setRestTimer(restSeconds);
      setIsResting(true);
    }

    // Navigation logic
    if (currentSetIndex < currentExercise.sets.length - 1) {
      // Next set in same exercise
      setCurrentSetIndex(currentSetIndex + 1);
    } else {
      // Last set of exercise
      if (currentBlock.type === 'strength') {
        // Move to next block
        if (currentBlockIndex < session.blocks.length - 1) {
          setCurrentBlockIndex(currentBlockIndex + 1);
          setCurrentExerciseIndex(0);
          setCurrentSetIndex(0);
        } else {
          setCompleted(true);
        }
      } else if (currentBlock.type === 'superset' || currentBlock.type === 'circuit') {
        // In supersets/circuits, we usually rotate through exercises for each set
        // OR we finish all sets of one then move to next. 
        // Let's assume standard rotation for supersets/circuits: Ex A Set 1 -> Ex B Set 1 -> Ex A Set 2...
        
        if (currentExerciseIndex < currentBlock.exercises.length - 1) {
          // Next exercise in same set-round
          setCurrentExerciseIndex(currentExerciseIndex + 1);
        } else {
          // Finished a round of all exercises in the block
          if (currentSetIndex < currentExercise.sets.length - 1) {
            // Start next round
            setCurrentExerciseIndex(0);
            setCurrentSetIndex(currentSetIndex + 1);
          } else {
            // Finished all rounds of this block
            if (currentBlockIndex < session.blocks.length - 1) {
              setCurrentBlockIndex(currentBlockIndex + 1);
              setCurrentExerciseIndex(0);
              setCurrentSetIndex(0);
            } else {
              setCompleted(true);
            }
          }
        }
      }
    }
  };

  const handleFinishWorkout = async () => {
    if (!session || !user) return;

    const wasAlreadyCompleted = todayLog?.workoutCompleted;
    setIsSaving(true);
    
    try {
      // Ensure session has an ID (should be handled by handleStartSession, but safety first)
      let currentSessionId = session.id;
      if (!currentSessionId) {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'workout_sessions'), {
          ...session,
          status: 'in-progress',
          startTime: new Date().toISOString()
        });
        currentSessionId = docRef.id;
        setSession({ ...session, id: currentSessionId });
      }

      const sessionRef = doc(db, 'users', user.uid, 'workout_sessions', currentSessionId);
      
      // 1. Update session status
      const completedSession: WorkoutSession = {
        ...session,
        id: currentSessionId,
        status: 'completed',
        endTime: new Date().toISOString(),
        actualDuration: Math.round(timer / 60),
        overallRPE: feedback.rpe,
        notes: feedback.notes,
      };

      await setDoc(sessionRef, {
        status: 'completed',
        endTime: completedSession.endTime,
        actualDuration: completedSession.actualDuration,
        overallRPE: completedSession.overallRPE,
        notes: completedSession.notes,
        exercises: session.exercises
      }, { merge: true });

      // 2. Save detailed performance for each exercise
      for (const block of session.blocks || []) {
        for (const ex of block.exercises) {
          const perfRef = doc(collection(sessionRef, 'performance'));
          await setDoc(perfRef, {
            uid: user.uid,
            sessionId: session.id,
            exerciseId: ex.exerciseId || ex.exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            exerciseName: ex.exerciseName,
            sets: ex.sets,
            completedAt: new Date().toISOString(),
            circuitRounds: block.type === 'circuit' ? circuitRounds : null
          });
        }
      }
      
      // 3. Update daily log
      await setLog({
        workoutCompleted: true
      });

      // 3. Progressive Overload Logic
      const prevQ = query(
        collection(db, 'users', user.uid, 'workout_sessions'),
        where('programId', '==', session.programId),
        where('sessionFocus', '==', session.sessionFocus),
        where('status', '==', 'completed'),
        orderBy('date', 'desc'),
        limit(2)
      );
      
      const prevSnap = await getDocs(prevQ);
      let previousSession: WorkoutSession | null = null;
      
      if (prevSnap.docs.length > 1) {
        const otherDoc = prevSnap.docs.find(d => d.id !== session.id);
        if (otherDoc) {
          previousSession = { id: otherDoc.id, ...otherDoc.data() } as WorkoutSession;
        }
      }

      const updatedBaselines = evaluateProgressiveOverload(session, previousSession);
      if (Object.keys(updatedBaselines).length > 0) {
        await updateStrengthBaselines(user.uid, updatedBaselines);
      }

      // 4. Streak Logic
      if (profile && !wasAlreadyCompleted) {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const yesterday = subDays(new Date(), 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
        
        let newStreak = (profile.currentStreak || 0);
        
        if (profile.lastWorkoutDate === yesterdayStr) {
          newStreak += 1;
        } else if (profile.lastWorkoutDate !== todayStr) {
          // If they missed yesterday, it resets to 1 (for today's workout)
          newStreak = 1;
        }
        
        await updateProfile({ 
          currentStreak: newStreak,
          lastWorkoutDate: todayStr
        });
      }

      // 5. Achievement Logic
      const newAchievements = await checkAndAwardAchievements(user.uid, completedSession);
      if (newAchievements.length > 0) {
        setEarnedAchievements(newAchievements);
        toast(`Unlocked ${newAchievements.length} new achievements!`, 'success');
      } else {
        toast('Workout saved successfully!', 'success');
        navigate('/progress');
      }
    } catch (error) {
      console.error('Error finishing workout:', error);
      toast('Failed to save workout', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (!isPaused && !completed && session) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isPaused, completed, session]);

  useEffect(() => {
    let interval: any;
    if (isResting && restTimer > 0 && !isPaused) {
      interval = setInterval(() => {
        setRestTimer(t => {
          if (t <= 1) {
            setIsResting(false);
            // Audio cue could go here
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isResting, restTimer, isPaused]);

  const playBeep = (type: 'short' | 'long' = 'short') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(type === 'long' ? 440 : 880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (type === 'long' ? 0.5 : 0.1));

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + (type === 'long' ? 0.5 : 0.1));
    } catch (e) {
      console.warn("Audio context not available", e);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isCircuitActive && circuitTimer > 0 && !isPaused) {
      interval = setInterval(() => {
        setCircuitTimer(t => {
          if (t <= 1) {
            setIsCircuitActive(false);
            playBeep('long');
            return 0;
          }
          if (t <= 4) playBeep('short');
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isCircuitActive, circuitTimer, isPaused]);

  useEffect(() => {
    if (countdown > 0) {
      playBeep('short');
    }
  }, [countdown]);

  const handleStartSession = async () => {
    if (!session || !user) return;
    
    if (!session.id) {
      // It's a temp session from daily_workout_states, save it first
      setGenerating(true);
      try {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'workout_sessions'), {
          ...session,
          status: 'in-progress',
          startTime: new Date().toISOString()
        });
        
        // Update daily_workout_state to in-progress
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const stateRef = doc(db, 'users', user.uid, 'daily_workout_states', todayStr);
        await setDoc(stateRef, { status: 'in-progress', sessionId: docRef.id }, { merge: true });
        
        setSession({ ...session, id: docRef.id });
      } catch (error) {
        console.error('Error starting session:', error);
        toast('Failed to start session', 'error');
        setGenerating(false);
        return;
      } finally {
        setGenerating(false);
      }
    }
    
    setShowSummary(false);
  };

  if (loading || programLoading || logLoading) {
    return (
      <div className="min-h-screen bg-brand-black flex items-center justify-center">
        <div className="animate-pulse text-brand-pink font-display font-bold text-2xl uppercase italic">Loading Session...</div>
      </div>
    );
  }

  // Pre-workout Setup Panel
  if (!session) {
    const steps = [
      {
        title: "How are you feeling?",
        subtitle: "We'll adjust intensity based on your energy",
        options: [
          { label: 'Great', icon: Smile, color: 'text-emerald-400' },
          { label: 'Normal', icon: Meh, color: 'text-brand-gold' },
          { label: 'Low Energy', icon: ZapOff, color: 'text-orange-400' },
          { label: 'Fatigued', icon: Frown, color: 'text-brand-pink' }
        ],
        field: 'feeling'
      },
      {
        title: "Where are you training?",
        subtitle: "We'll adapt exercises to your equipment",
        options: [
          { label: 'Full Gym', icon: Dumbbell, color: 'text-white' },
          { label: 'Home Gym', icon: Home, color: 'text-white' },
          { label: 'Minimal Equipment', icon: Battery, color: 'text-white' },
          { label: 'Bodyweight Only', icon: Zap, color: 'text-white' }
        ],
        field: 'location'
      },
      {
        title: "How much time?",
        subtitle: "We'll scale volume to fit your schedule",
        options: [
          { label: '30 minutes', value: 30, icon: Timer, color: 'text-white' },
          { label: '45 minutes', value: 45, icon: Timer, color: 'text-white' },
          { label: '60 minutes', value: 60, icon: Timer, color: 'text-white' },
          { label: 'Full Session', value: 90, icon: Clock, color: 'text-white' }
        ],
        field: 'time'
      }
    ];

    const currentStep = steps[setupStep];

    return (
      <div className="min-h-screen bg-brand-black p-6 flex flex-col">
        <header className="flex items-center justify-between mb-12">
          <button onClick={() => navigate('/')} className="p-2 text-white/40 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 w-8 rounded-full ${i <= setupStep ? 'bg-brand-pink' : 'bg-white/10'}`} />
            ))}
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 flex flex-col justify-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter leading-none">{currentStep.title}</h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{currentStep.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {currentStep.options.map((opt) => (
              <button
                key={opt.label}
                onClick={() => {
                  setSetupAnswers({ ...setupAnswers, [currentStep.field]: opt.value !== undefined ? opt.value : opt.label });
                  if (setupStep < steps.length - 1) {
                    setSetupStep(setupStep + 1);
                  } else {
                    handleStartSetup();
                  }
                }}
                className="group relative"
              >
                <GlassCard className="p-6 flex items-center justify-between group-hover:border-brand-pink/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl bg-white/5 ${opt.color}`}>
                      <opt.icon className="w-6 h-6" />
                    </div>
                    <span className="text-lg font-display font-black text-white uppercase italic">{opt.label}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-brand-pink transition-colors" />
                </GlassCard>
              </button>
            ))}
          </div>
        </main>

        {generating && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-brand-pink border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-[10px] font-black text-white uppercase tracking-widest animate-pulse">Engineering Your Session...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Summary before starting
  if (showSummary && session) {
    return (
      <div className="min-h-screen bg-brand-black p-6 flex flex-col">
        <main className="flex-1 flex flex-col justify-center space-y-12">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-brand-pink/20 rounded-full flex items-center justify-center mx-auto">
              <Zap className="w-10 h-10 text-brand-pink" />
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Session Ready</h2>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Dynamic adjustments applied</p>
            </div>
          </div>

          <div className="space-y-4">
            <GlassCard className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Focus</span>
                <span className="text-sm font-display font-black text-white uppercase italic">{session.sessionFocus}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Equipment</span>
                <span className="text-sm font-display font-black text-brand-gold uppercase italic">{setupAnswers.location}</span>
              </div>
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Estimated Time</span>
                <span className="text-sm font-display font-black text-white uppercase italic">{session.plannedDuration} min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Adjustment</span>
                <span className="text-sm font-display font-black text-brand-gold uppercase italic">{session.adjustmentsMade.reason}</span>
              </div>
            </GlassCard>

            <div className="space-y-2">
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest text-center">Exercises Included</p>
              <div className="flex flex-wrap justify-center gap-2">
                {session.exercises.map((ex, i) => (
                  <span key={`${ex.exerciseName}-${i}`} className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-white/60 uppercase tracking-widest">
                    {ex.exerciseName}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <GradientButton 
            onClick={handleStartSession}
            className="w-full py-6"
          >
            <Play className="w-5 h-5" />
            <span>Start Training</span>
          </GradientButton>
        </main>
      </div>
    );
  }

  if (completed) {
    if (earnedAchievements.length > 0) {
      return (
        <div className="min-h-screen bg-brand-black flex flex-col p-6 space-y-8 overflow-hidden relative">
          {/* Starburst Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ rotate: i * 30, scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.5, 1.2], opacity: [0, 0.2, 0] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                className="absolute w-1 h-[100vh] bg-gradient-to-t from-brand-gold/0 via-brand-gold/40 to-brand-gold/0 origin-center"
              />
            ))}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center space-y-8 relative z-10">
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12 }}
              className="w-32 h-32 bg-brand-gold/20 rounded-full flex items-center justify-center relative"
            >
              <Trophy className="w-16 h-16 text-brand-gold" />
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 border-4 border-brand-gold rounded-full"
              />
            </motion.div>

            <div className="text-center space-y-2">
              <h2 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter leading-none">New Milestones!</h2>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">You just pushed the limits</p>
            </div>

            <div className="w-full max-w-sm space-y-4">
              {earnedAchievements.map((ach, i) => (
                <motion.div
                  key={ach.achievementId}
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                >
                  <GlassCard className="p-4 flex items-center gap-4 border-brand-gold/30" glow="gold">
                    <div className="p-2 bg-brand-gold/10 rounded-lg">
                      <Award className="w-5 h-5 text-brand-gold" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-display font-black text-white uppercase italic">{ach.name}</h4>
                      <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">{ach.description}</p>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>

          <GradientButton 
            onClick={() => navigate('/progress')}
            className="w-full py-5 relative z-10"
          >
            <span className="text-xs font-black uppercase tracking-widest">View Progress Hub</span>
            <ArrowRight className="w-5 h-5" />
          </GradientButton>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-brand-black flex flex-col p-6 space-y-8">
        <div className="flex-1 flex flex-col items-center justify-center space-y-8">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-32 h-32 bg-brand-gold/20 rounded-full flex items-center justify-center relative"
          >
            <Trophy className="w-16 h-16 text-brand-gold" />
            <motion.div 
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 border-4 border-brand-gold rounded-full"
            />
          </motion.div>

          <div className="text-center space-y-2">
            <h2 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Session Complete</h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Consistency is the only path to mastery</p>
          </div>

          <div className="w-full max-w-sm space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-6 text-center space-y-1">
                <p className="text-[8px] text-white/20 font-black uppercase tracking-widest">Duration</p>
                <p className="text-2xl font-display font-black text-white italic">{Math.round(timer / 60)}m</p>
              </div>
              <div className="glass-card p-6 text-center space-y-1">
                <p className="text-[8px] text-white/20 font-black uppercase tracking-widest">Intensity (RPE)</p>
                <div className="flex items-center justify-center gap-2">
                  <button 
                    onClick={() => setFeedback({ ...feedback, rpe: Math.max(1, feedback.rpe - 1) })}
                    className="text-white/40 hover:text-white"
                  >
                    <Pause className="w-4 h-4 rotate-90" />
                  </button>
                  <span className="text-2xl font-display font-black text-brand-pink italic">{feedback.rpe}</span>
                  <button 
                    onClick={() => setFeedback({ ...feedback, rpe: Math.min(10, feedback.rpe + 1) })}
                    className="text-white/40 hover:text-white"
                  >
                    <Play className="w-4 h-4 rotate-90" />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest text-center">Session Notes</p>
              <textarea 
                value={feedback.notes}
                onChange={(e) => setFeedback({ ...feedback, notes: e.target.value })}
                placeholder="How did it feel? Any pain or wins?"
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-brand-pink/50 h-24 resize-none"
              />
            </div>
          </div>
        </div>

        <GradientButton 
          onClick={handleFinishWorkout}
          disabled={isSaving}
          className="w-full py-5"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-xs font-black uppercase tracking-widest">Save & Return to Hub</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </GradientButton>
      </div>
    );
  }

  const currentBlock = session.blocks[currentBlockIndex];
  const currentExercise = currentBlock.exercises[currentExerciseIndex];
  const currentSet = currentExercise.sets[currentSetIndex];

  const renderGridView = () => (
    <div className="flex-1 flex flex-col space-y-6">
      {currentBlock.instructions && (
        <div className="px-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest mb-1">Block Protocol</p>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest italic leading-relaxed">
              {currentBlock.instructions}
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 overflow-y-auto">
        {currentBlock.exercises.map((ex, idx) => (
        <GlassCard key={idx} className="p-4 flex flex-col space-y-4 border-white/10 hover:border-brand-pink/30 transition-all group">
          <div className="aspect-video bg-white/5 rounded-2xl overflow-hidden relative border border-white/5 group-hover:border-brand-pink/20 transition-all">
            <ExerciseMedia key={ex.exerciseName} exerciseName={ex.exerciseName} />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-display font-black text-white uppercase italic leading-tight group-hover:text-brand-pink transition-colors">{ex.exerciseName}</h4>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">{ex.sets.length} Sets x {ex.sets[0]?.reps}</span>
              {ex.instructions && (
                <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest italic truncate max-w-[150px]">
                  {ex.instructions}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <input 
              type="number"
              placeholder="Weight"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-pink/50 placeholder:text-white/10"
              onChange={(e) => {
                // Logic to update weight for this exercise in the block
                const updatedBlocks = [...session!.blocks];
                updatedBlocks[currentBlockIndex].exercises[idx].sets.forEach(s => s.actualWeight = Number(e.target.value));
                setSession({ ...session!, blocks: updatedBlocks });
              }}
            />
            <input 
              type="number"
              placeholder="Reps"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-pink/50 placeholder:text-white/10"
              onChange={(e) => {
                const updatedBlocks = [...session!.blocks];
                updatedBlocks[currentBlockIndex].exercises[idx].sets.forEach(s => s.actualReps = Number(e.target.value));
                setSession({ ...session!, blocks: updatedBlocks });
              }}
            />
          </div>
        </GlassCard>
      ))}
      </div>
    </div>
  );

  const renderStrengthView = () => (
    <div className="flex-1 flex flex-col space-y-8">
      {/* Block Instructions */}
      {currentBlock.instructions && (
        <div className="bg-brand-gold/5 border border-brand-gold/20 rounded-2xl p-4">
          <p className="text-[8px] font-black text-brand-gold uppercase tracking-widest mb-1">Block Instructions</p>
          <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest italic leading-relaxed">
            {currentBlock.instructions}
          </p>
        </div>
      )}

      {/* Video / Visual */}
      <div className="aspect-video bg-white/5 rounded-3xl overflow-hidden relative group border border-white/10">
        <ExerciseMedia key={currentExercise.exerciseName} exerciseName={currentExercise.exerciseName} />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Performance Inputs */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <div className="grid grid-cols-2 gap-8 text-center w-full">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Weight ({weightUnit})</p>
            <div className="flex items-center justify-center gap-4">
              <input 
                type="number"
                value={actualWeight}
                onChange={(e) => setActualWeight(Number(e.target.value))}
                className="w-24 bg-transparent text-5xl font-display font-black text-white italic text-center focus:outline-none"
              />
            </div>
            <p className="text-[8px] text-white/20 uppercase">
              Target: {currentExercise.weightSuggested || Math.round(currentSet.weight * weightFactor)}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Reps</p>
            <div className="flex items-center justify-center gap-4">
              <input 
                type="number"
                value={actualReps}
                onChange={(e) => setActualReps(Number(e.target.value))}
                className="w-24 bg-transparent text-5xl font-display font-black text-brand-gold italic text-center focus:outline-none"
              />
            </div>
            <p className="text-[8px] text-white/20 uppercase">Target: {currentSet.reps}</p>
          </div>
        </div>

        {/* RPE Input */}
        <div className="w-full space-y-4 px-8">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Intensity (RPE)</p>
            <span className="text-xl font-display font-black text-brand-pink italic">{actualRPE}</span>
          </div>
          <input 
            type="range" min="1" max="10" step="1"
            value={actualRPE}
            onChange={(e) => setActualRPE(parseInt(e.target.value))}
            className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-pink"
          />
          <div className="flex justify-between text-[8px] font-bold text-white/20 uppercase tracking-widest">
            <span>Easy</span>
            <span>Moderate</span>
            <span>Max Effort</span>
          </div>
        </div>

        {/* Progression Suggestion */}
        {actualRPE < 7 && actualReps >= currentSet.reps && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 w-full flex items-center gap-3"
          >
            <ArrowUpRight className="w-5 h-5 text-emerald-500" />
            <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
              Progression Suggestion: Increase +5-10 lbs next session
            </p>
          </motion.div>
        )}

        {/* Exercise Meta */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <GlassCard className="p-4 flex items-center gap-3 border-brand-pink/20">
            <div className="p-2 bg-brand-pink/10 rounded-xl">
              <Dumbbell className="w-5 h-5 text-brand-pink" />
            </div>
            <div>
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Muscle</p>
              <p className="text-sm font-display font-black text-white uppercase italic">{currentExercise.primaryMuscleGroup || 'Full Body'}</p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-3 border-white/10">
            <div className="p-2 bg-white/5 rounded-xl">
              <Zap className="w-5 h-5 text-brand-gold" />
            </div>
            <div>
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Pattern</p>
              <p className="text-sm font-display font-black text-white uppercase italic">{currentExercise.movementPattern || 'Other'}</p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-3 border-brand-pink/20">
            <div className="p-2 bg-brand-pink/10 rounded-xl">
              <Timer className="w-5 h-5 text-brand-pink" />
            </div>
            <div>
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Tempo</p>
              <p className="text-sm font-display font-black text-white uppercase italic">{currentExercise.tempo || '2-0-2-0'}</p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-3 border-white/10">
            <div className="p-2 bg-white/5 rounded-xl">
              <Clock className="w-5 h-5 text-white/40" />
            </div>
            <div>
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Rest</p>
              <p className="text-sm font-display font-black text-white uppercase italic">{currentExercise.rest || '90'}s</p>
            </div>
          </GlassCard>
        </div>

        {/* Form Cues */}
        {currentExercise.instructions && (
          <div className="w-full space-y-2">
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Form Cues</p>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest leading-relaxed italic">
              {currentExercise.instructions}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSupersetView = () => (
    <div className="flex-1 flex flex-col space-y-8">
      {/* Block Instructions */}
      {currentBlock.instructions && (
        <div className="bg-brand-pink/5 border border-brand-pink/20 rounded-2xl p-4">
          <p className="text-[8px] font-black text-brand-pink uppercase tracking-widest mb-1">Block Instructions</p>
          <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest italic leading-relaxed">
            {currentBlock.instructions}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {currentBlock.exercises.map((ex, idx) => (
          <GlassCard 
            key={idx} 
            className={`p-4 space-y-4 border-2 transition-all ${idx === currentExerciseIndex ? 'border-brand-pink bg-brand-pink/5' : 'border-white/5 opacity-40'}`}
          >
            <div className="aspect-video bg-white/5 rounded-xl overflow-hidden relative border border-white/5">
              <ExerciseMedia key={ex.exerciseName} exerciseName={ex.exerciseName} />
            </div>
            <div className="space-y-1">
              <span className="text-[8px] font-black text-brand-gold uppercase tracking-widest">Exercise {String.fromCharCode(65 + idx)}</span>
              <h4 className="text-sm font-display font-black text-white uppercase italic leading-tight">{ex.exerciseName}</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black text-white/20 uppercase">Target</span>
                <span className="text-[10px] font-bold text-white">{ex.sets.length}x{ex.sets[0]?.reps}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-black text-white/20 uppercase">Weight</span>
                <span className="text-[10px] font-bold text-brand-pink">{ex.weightSuggested || 'BW'}</span>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center space-y-8">
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Current Focus</p>
          <h3 className="text-3xl font-display font-black text-white uppercase italic tracking-tighter">{currentExercise.exerciseName}</h3>
        </div>

        <div className="grid grid-cols-2 gap-8 text-center w-full">
          <div className="space-y-2">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Weight ({weightUnit})</p>
            <input 
              type="number"
              value={actualWeight}
              onChange={(e) => setActualWeight(Number(e.target.value))}
              className="w-full bg-transparent text-4xl font-display font-black text-white italic text-center focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Reps</p>
            <input 
              type="number"
              value={actualReps}
              onChange={(e) => setActualReps(Number(e.target.value))}
              className="w-full bg-transparent text-4xl font-display font-black text-brand-gold italic text-center focus:outline-none"
            />
          </div>
        </div>

        <div className="bg-white/5 p-6 rounded-3xl w-full text-center space-y-2">
          <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Superset Logic</p>
          <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest italic">
            Perform Exercise A → Exercise B → Rest → Repeat
          </p>
        </div>
      </div>
    </div>
  );

  const renderCircuitView = () => (
    <div className="flex-1 flex flex-col space-y-6">
      <div className="bg-brand-pink/10 border border-brand-pink/20 rounded-3xl p-6 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-brand-pink uppercase tracking-widest">
              {currentBlock.circuitType} • Round {circuitRounds + 1}
            </p>
            <h3 className="text-2xl font-display font-black text-white uppercase italic tracking-tighter">
              {countdown > 0 ? `Starting in ${countdown}...` : isCircuitActive ? 'Keep Moving!' : 'Ready to Start?'}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Time Remaining</p>
            <p className={`text-3xl font-display font-black italic ${circuitTimer < 30 && isCircuitActive ? 'text-brand-pink animate-pulse' : 'text-white'}`}>
              {Math.floor(circuitTimer / 60)}:{String(circuitTimer % 60).padStart(2, '0')}
            </p>
          </div>
        </div>
        {currentBlock.instructions && (
          <p className="text-[10px] text-brand-gold font-black uppercase tracking-widest italic border-l-2 border-brand-gold pl-3 py-1">
            {currentBlock.instructions}
          </p>
        )}
      </div>

      <div className="flex justify-center gap-4">
        <div className="glass-card px-6 py-2 rounded-full border-brand-pink/20">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mr-2">Rounds</span>
          <span className="text-lg font-display font-black text-brand-pink italic">{circuitRounds}</span>
        </div>
        <button 
          onClick={() => setCircuitRounds(prev => prev + 1)}
          className="glass-card px-6 py-2 rounded-full border-brand-gold/20 hover:bg-brand-gold/10 transition-colors"
        >
          <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest">+ Round</span>
        </button>
      </div>

      <div className="space-y-3">
        {currentBlock.exercises.map((ex, idx) => (
          <GlassCard 
            key={idx} 
            className={`p-4 flex items-center justify-between transition-all ${idx === currentExerciseIndex ? 'border-brand-pink bg-brand-pink/5 scale-[1.02]' : 'border-white/5 opacity-40'}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-12 bg-white/5 rounded-lg overflow-hidden border border-white/5">
                <ExerciseMedia key={ex.exerciseName} exerciseName={ex.exerciseName} />
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${idx === currentExerciseIndex ? 'bg-brand-pink text-white' : 'bg-white/10 text-white/40'}`}>
                {idx + 1}
              </div>
              <div>
                <h4 className="text-sm font-display font-black text-white uppercase italic">{ex.exerciseName}</h4>
                <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">{ex.sets[0]?.reps} Reps • {ex.weightSuggested || 'BW'}</p>
              </div>
            </div>
            {idx === currentExerciseIndex && (
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }} 
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 bg-brand-pink rounded-full" 
              />
            )}
          </GlassCard>
        ))}
      </div>

      {!isCircuitActive && circuitTimer === 0 && countdown === 0 && (
        <GradientButton 
          onClick={() => {
            setCountdown(5);
            const interval = setInterval(() => {
              setCountdown(prev => {
                if (prev <= 1) {
                  clearInterval(interval);
                  setCircuitTimer((currentBlock.duration || 15) * 60);
                  setIsCircuitActive(true);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);
          }}
          className="w-full py-6"
        >
          <Play className="w-5 h-5" />
          <span>Start {currentBlock.circuitType}</span>
        </GradientButton>
      )}

      {isCircuitActive && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 text-center">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Weight ({weightUnit})</p>
            <input 
              type="number"
              value={actualWeight}
              onChange={(e) => setActualWeight(Number(e.target.value))}
              className="w-full bg-transparent text-3xl font-display font-black text-white italic text-center focus:outline-none"
            />
          </div>
          <div className="space-y-2 text-center">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Reps</p>
            <input 
              type="number"
              value={actualReps}
              onChange={(e) => setActualReps(Number(e.target.value))}
              className="w-full bg-transparent text-3xl font-display font-black text-brand-gold italic text-center focus:outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-black flex overflow-hidden">
      {/* Left Sidebar - Timer & Info */}
      <aside className="w-1/4 min-w-[280px] border-r border-white/5 flex flex-col p-8 space-y-12 bg-black/40 backdrop-blur-md">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-brand-pink rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Live Session</span>
          </div>
          <h1 className="text-7xl font-display font-black text-white italic tracking-tighter leading-none">
            {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
          </h1>
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-brand-pink"
              initial={{ width: 0 }}
              animate={{ width: `${(timer / (session.plannedDuration * 60)) * 100}%` }}
            />
          </div>
        </div>

        {session.description && (
          <div className="p-4 bg-brand-pink/5 border border-brand-pink/10 rounded-2xl space-y-2">
            <p className="text-[8px] font-black text-brand-pink uppercase tracking-widest">Coach's Focus</p>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest leading-relaxed italic">
              {session.description}
            </p>
          </div>
        )}

        <div className="space-y-6 flex-1">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-brand-pink uppercase tracking-widest">Current Block</p>
            <h2 className="text-3xl font-display font-black text-white uppercase italic tracking-tighter leading-none">
              {currentBlock.type === 'strength' ? 'Primary Strength' : currentBlock.type === 'circuit' ? 'Conditioning' : 'Warmup'}
            </h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest italic">
              {currentBlock.circuitType || 'Standard Protocol'} • {currentBlock.duration || 15} Min
            </p>
          </div>

          <div className="space-y-4 pt-6 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Progress</span>
              <span className="text-[10px] font-bold text-white">{currentBlockIndex + 1} / {session.blocks.length} Blocks</span>
            </div>
            <div className="flex gap-1">
              {session.blocks.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i < currentBlockIndex ? 'bg-emerald-500' : i === currentBlockIndex ? 'bg-brand-pink' : 'bg-white/10'}`} />
              ))}
            </div>
          </div>

          <div className="pt-6 space-y-2">
            <button 
              onClick={() => setIsPaused(!isPaused)}
              className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
            >
              {isPaused ? <Play className="w-4 h-4 text-white" /> : <Pause className="w-4 h-4 text-white" />}
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{isPaused ? 'Resume' : 'Pause'}</span>
            </button>
            <button 
              onClick={() => navigate('/')}
              className="w-full py-4 text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors"
            >
              End Session Early
            </button>
          </div>
        </div>

        {/* Logo at bottom */}
        <div className="pt-8 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-pink flex items-center justify-center rounded-xl rotate-3">
              <Zap className="w-6 h-6 text-brand-black fill-brand-black" />
            </div>
            <div>
              <p className="text-lg font-display font-black text-white italic tracking-tighter leading-none">FITVERSE</p>
              <p className="text-[8px] font-black text-brand-pink uppercase tracking-widest">Elite Training</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Rest Timer Overlay */}
        <AnimatePresence>
          {isResting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-brand-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="space-y-2 mb-12">
                <h3 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Rest Period</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Recover for the next set</p>
              </div>

              <div className="relative w-64 h-64 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="128" cy="128" r="120" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                  <motion.circle
                    cx="128" cy="128" r="120" fill="none" stroke="currentColor" strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 120}
                    animate={{ strokeDashoffset: (1 - restTimer / (parseInt(currentExercise.rest || '90'))) * (2 * Math.PI * 120) }}
                    transition={{ duration: 1, ease: 'linear' }}
                    className="text-brand-pink"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-7xl font-display font-black text-white italic">{restTimer}</span>
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Seconds</span>
                </div>
              </div>

              <div className="mt-12 space-y-4 w-full max-w-xs">
                <button 
                  onClick={() => setIsResting(false)}
                  className="w-full py-4 bg-brand-pink rounded-2xl text-[10px] font-black text-brand-black uppercase tracking-widest"
                >
                  Skip Rest
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
          {currentBlock.displayMode === 'grid' ? renderGridView() : (
            currentBlock.type === 'strength' ? renderStrengthView() : 
            currentBlock.type === 'superset' ? renderSupersetView() : renderCircuitView()
          )}
        </div>

        {/* Footer Controls */}
        <footer className="p-8 border-t border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Current Exercise</span>
              <span className="text-lg font-display font-black text-white uppercase italic">{currentExercise.exerciseName}</span>
            </div>

            <div className="flex items-center gap-4">
              {currentBlock.displayMode === 'grid' ? (
                <GradientButton 
                  onClick={() => {
                    if (currentBlockIndex < session.blocks.length - 1) {
                      setCurrentBlockIndex(currentBlockIndex + 1);
                      setCurrentExerciseIndex(0);
                      setCurrentSetIndex(0);
                    } else {
                      setCompleted(true);
                    }
                  }}
                  className="px-12 py-4"
                >
                  <span>Complete Block</span>
                  <ArrowRight className="w-5 h-5" />
                </GradientButton>
              ) : (
                <GradientButton 
                  onClick={handleNextSet}
                  className="px-12 py-4"
                >
                  <span>{currentSetIndex < currentExercise.sets.length - 1 ? 'Next Set' : 'Next Exercise'}</span>
                  <ArrowRight className="w-5 h-5" />
                </GradientButton>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
