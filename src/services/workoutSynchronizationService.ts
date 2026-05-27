import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, writeBatch, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { DailyWorkoutState, TrainingProgram, DailyLog } from '../types';
import { format, startOfDay, differenceInDays, subDays } from 'date-fns';

/**
 * Ensures a DailyWorkoutState exists for the given date.
 * If not, it generates it from the active program.
 */
export const ensureDailyWorkoutState = async (uid: string, date: Date, activeProgram: TrainingProgram | null): Promise<DailyWorkoutState | null> => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const stateRef = doc(db, 'users', uid, 'daily_workout_states', dateStr);
  
  try {
    const snap = await getDoc(stateRef);
    if (snap.exists()) {
      const existingState = snap.data() as DailyWorkoutState;
      // If the state belongs to the current active program, return it
      if (activeProgram && existingState.programId === activeProgram.id) {
        return existingState;
      }
      // If it's a completed workout from a previous program, keep it
      if (existingState.status === 'completed') {
        return existingState;
      }
      // Otherwise, we'll fall through and re-generate it for the new program
    }

    if (!activeProgram) return null;

    // --- READINESS ADAPTIVE ENGINE ---
    // User Request: Only include rest day if readiness score is continuously dropping.
    const logsQuery = query(
      collection(db, 'users', uid, 'daily_logs'),
      orderBy('date', 'desc'),
      limit(4)
    );
    const logsSnap = await getDocs(logsQuery);
    const recentLogs = logsSnap.docs.map(d => d.data() as DailyLog);
    
    let forcedRest = false;
    let restReason = "";

    if (recentLogs.length >= 3) {
      const scores = recentLogs.map(l => l.readinessScore || 70);
      // Trend: Current < Prev < PrevPrev
      const continuousDrop = scores[0] < scores[1] && scores[1] < scores[2];
      const severelyLow = scores[0] < 50;

      if (continuousDrop || severelyLow) {
        forcedRest = true;
        restReason = continuousDrop ? "Fatigue Trap: 3-Day Readiness Decline Detected" : "Severe Recovery Deficit Detected";
      }
    }

    // Generate from program
    const dayOfWeek = format(date, 'i');
    const dayName = format(date, 'EEEE');
    const startDate = new Date(activeProgram.startDate);
    const diffDays = differenceInDays(startOfDay(date), startOfDay(startDate));
    const weekNum = Math.floor(diffDays / 7) + 1;
    
    // Find program phase/week info
    const phase = activeProgram.phases?.find(p => weekNum >= p.weekStart && weekNum <= p.weekEnd);
    const weekData = activeProgram.weeks?.find(w => w.weekNumber === weekNum);
    
    // Robust matching for session
    let session = weekData?.sessions.find(s => 
      s.dayName === dayName || 
      s.dayName.toLowerCase() === dayName.toLowerCase() ||
      s.dayName.toLowerCase().startsWith(dayName.toLowerCase().substring(0, 3))
    );

    if (!session && weekData) {
      // Try by day number if AI provided it
      session = weekData.sessions.find(s => (s as any).day === parseInt(dayOfWeek));
      
      // Fallback: If weeklySchedule has a workout for this day, try to find a session by index or cycle
      const dayConfig = activeProgram.weeklySchedule?.[dayOfWeek];
      const isTrainingDay = dayConfig && dayConfig.sessionType.toLowerCase() !== 'rest';
      
      if (!session && isTrainingDay && weekData.sessions.length > 0) {
        const trainingDays = Object.keys(activeProgram.weeklySchedule)
          .filter(k => activeProgram.weeklySchedule[k].sessionType.toLowerCase() !== 'rest')
          .map(Number)
          .sort((a, b) => a - b);
          
        const trainingDayIndex = trainingDays.indexOf(parseInt(dayOfWeek));
        // Cycle through available sessions if we have fewer than training days
        const sessionIndex = trainingDayIndex % weekData.sessions.length;
        if (weekData.sessions[sessionIndex]) {
          session = weekData.sessions[sessionIndex];
        }
      }
    }
    
    let dayConfig = activeProgram.weeklySchedule?.[dayOfWeek];

    // Fallback: if weeklySchedule is empty, try to find a session for this dayName in ANY week
    if (!dayConfig || Object.keys(activeProgram.weeklySchedule).length === 0) {
      const anyWeekSession = activeProgram.weeks?.find(w => 
        w.sessions.some(s => 
          s.dayName === dayName || 
          s.dayName.toLowerCase() === dayName.toLowerCase() ||
          s.dayName.toLowerCase().startsWith(dayName.toLowerCase().substring(0, 3))
        )
      )?.sessions.find(s => 
        s.dayName === dayName || 
        s.dayName.toLowerCase() === dayName.toLowerCase() ||
        s.dayName.toLowerCase().startsWith(dayName.toLowerCase().substring(0, 3))
      );
      
      if (anyWeekSession) {
        dayConfig = {
          sessionFocus: anyWeekSession.sessionFocus,
          sessionType: anyWeekSession.sessionType,
          estimatedDuration: 45,
          targetMuscles: []
        };
      }
    }

    const isRestDay = forcedRest || (!session && (!dayConfig || dayConfig.sessionType.toLowerCase() === 'rest'));

    const newState: DailyWorkoutState = {
      id: dateStr,
      uid,
      date: dateStr,
      programPhase: phase?.phaseName || 'Foundation',
      programDayType: isRestDay ? (forcedRest ? 'Smart Recovery' : 'Rest Day') : (session?.sessionType || dayConfig?.sessionType || 'Strength'),
      workoutTitle: isRestDay ? (forcedRest ? 'Recovery Protocol' : 'Rest Day') : (session?.sessionFocus || dayConfig?.sessionFocus || 'Training'),
      workoutFocus: isRestDay ? (forcedRest ? restReason : 'Recovery') : (session?.sessionFocus || dayConfig?.sessionFocus || 'General'),
      workoutDuration: dayConfig?.estimatedDuration || 45,
      targetIntensity: isRestDay ? 'RPE 0' : 'RPE 8',
      status: isRestDay ? 'rest' : 'scheduled',
      programId: activeProgram.id!,
      programWeek: weekNum,
      swappable: !isRestDay, // Rest days aren't swappable usually, or maybe they are?
      readinessScoreAtCheckin: recentLogs[0]?.readinessScore
    };

    await setDoc(stateRef, newState);
    return newState;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/daily_workout_states/${dateStr}`);
    return null;
  }
};

/**
 * Swaps workout states between two dates.
 */
export const swapWorkoutStates = async (uid: string, date1: Date, date2: Date, activeProgram: TrainingProgram | null) => {
  const date1Str = format(date1, 'yyyy-MM-dd');
  const date2Str = format(date2, 'yyyy-MM-dd');

  try {
    // Ensure both states exist
    const state1 = await ensureDailyWorkoutState(uid, date1, activeProgram);
    const state2 = await ensureDailyWorkoutState(uid, date2, activeProgram);

    if (!state1 || !state2) return false;

    const batch = writeBatch(db);

    // Swap fields but keep the original ID and Date
    const newState1: DailyWorkoutState = {
      ...state1,
      programPhase: state2.programPhase,
      programDayType: state2.programDayType,
      workoutTitle: state2.workoutTitle,
      workoutFocus: state2.workoutFocus,
      workoutDuration: state2.workoutDuration,
      targetIntensity: state2.targetIntensity,
      exerciseBlocks: state2.exerciseBlocks,
      status: state2.status === 'completed' ? 'completed' : (state2.programDayType === 'Rest Day' ? 'rest' : 'scheduled'),
      programId: state2.programId,
      programWeek: state2.programWeek,
    };

    const newState2: DailyWorkoutState = {
      ...state2,
      programPhase: state1.programPhase,
      programDayType: state1.programDayType,
      workoutTitle: state1.workoutTitle,
      workoutFocus: state1.workoutFocus,
      workoutDuration: state1.workoutDuration,
      targetIntensity: state1.targetIntensity,
      exerciseBlocks: state1.exerciseBlocks,
      status: state1.status === 'completed' ? 'completed' : (state1.programDayType === 'Rest Day' ? 'rest' : 'scheduled'),
      programId: state1.programId,
      programWeek: state1.programWeek,
    };

    batch.set(doc(db, 'users', uid, 'daily_workout_states', date1Str), newState1);
    batch.set(doc(db, 'users', uid, 'daily_workout_states', date2Str), newState2);

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}/daily_workout_states/swap`);
    return false;
  }
};
