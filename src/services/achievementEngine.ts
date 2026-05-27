import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';
import { WorkoutSession, Achievement, DailyLog } from '../types';

/**
 * Checks for new achievements based on a completed workout session.
 * Compares current performance against historical data.
 */
export const checkAndAwardAchievements = async (userId: string, session: WorkoutSession): Promise<Achievement[]> => {
  const newAchievements: Achievement[] = [];
  const now = new Date().toISOString();

  try {
    // 1. Fetch historical sessions to compare PRs
    const historicalSessionsQuery = query(
      collection(db, 'users', userId, 'workout_sessions'),
      where('status', '==', 'completed'),
      orderBy('date', 'desc'),
      limit(100) // Limit to last 100 sessions for performance
    );
    const historicalSnap = await getDocs(historicalSessionsQuery);
    const historicalSessions = historicalSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as WorkoutSession))
      .filter(s => s.id !== session.id);

    // Helper to calculate volume for an exercise in a session
    const getExerciseVolume = (exercises: any[], exerciseName: string) => {
      const ex = exercises.find(e => e.exerciseName === exerciseName);
      if (!ex || !ex.sets) return 0;
      return ex.sets.reduce((acc: number, set: any) => acc + ((set.actualWeight || set.weight || 0) * (set.actualReps || set.reps || 0)), 0);
    };

    // Helper to get max weight for an exercise in a session
    const getExerciseMaxWeight = (exercises: any[], exerciseName: string) => {
      const ex = exercises.find(e => e.exerciseName === exerciseName);
      if (!ex || !ex.sets) return 0;
      return Math.max(...ex.sets.map((s: any) => s.actualWeight || s.weight || 0));
    };

    // Helper to get max weight for specific reps
    const getExerciseRepMax = (exercises: any[], exerciseName: string, targetReps: number) => {
      const ex = exercises.find(e => e.exerciseName === exerciseName);
      if (!ex || !ex.sets) return 0;
      const validSets = ex.sets.filter((s: any) => (s.actualReps || s.reps) === targetReps);
      if (validSets.length === 0) return 0;
      return Math.max(...validSets.map((s: any) => s.actualWeight || s.weight || 0));
    };

    for (const exercise of session.exercises) {
      const exerciseName = exercise.exerciseName;
      const currentMaxWeight = getExerciseMaxWeight(session.exercises, exerciseName);
      const currentVolume = getExerciseVolume(session.exercises, exerciseName);
      const current5RM = getExerciseRepMax(session.exercises, exerciseName, 5);
      const current10RM = getExerciseRepMax(session.exercises, exerciseName, 10);

      if (currentMaxWeight <= 0) continue;

      // Strength PR
      let isStrengthPR = true;
      for (const s of historicalSessions) {
        const hMax = getExerciseMaxWeight(s.exercises, exerciseName);
        if (hMax >= currentMaxWeight) {
          isStrengthPR = false;
          break;
        }
      }
      if (isStrengthPR && historicalSessions.length > 0) {
        newAchievements.push({
          achievementId: `strength_pr_${exerciseName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
          uid: userId,
          name: 'Heaviest weight ever',
          description: `New personal record for ${exerciseName}: ${currentMaxWeight} lbs`,
          earnedAt: now,
          value: currentMaxWeight,
          verified: true
        });
      }

      // Volume PR
      let isVolumePR = true;
      for (const s of historicalSessions) {
        const hVol = getExerciseVolume(s.exercises, exerciseName);
        if (hVol >= currentVolume) {
          isVolumePR = false;
          break;
        }
      }
      if (isVolumePR && historicalSessions.length > 0 && currentVolume > 0) {
        newAchievements.push({
          achievementId: `volume_pr_${exerciseName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
          uid: userId,
          name: 'Max volume ever',
          description: `Highest total volume for ${exerciseName}: ${currentVolume} lbs`,
          earnedAt: now,
          value: currentVolume,
          verified: true
        });
      }

      // 5RM PR
      if (current5RM > 0) {
        let is5RMPR = true;
        for (const s of historicalSessions) {
          const h5RM = getExerciseRepMax(s.exercises, exerciseName, 5);
          if (h5RM >= current5RM) {
            is5RMPR = false;
            break;
          }
        }
        if (is5RMPR && historicalSessions.length > 0) {
          newAchievements.push({
            achievementId: `5rm_pr_${exerciseName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
            uid: userId,
            name: 'Heaviest 5RM ever',
            description: `New 5-rep max for ${exerciseName}: ${current5RM} lbs`,
            earnedAt: now,
            value: current5RM,
            verified: true
          });
        }
      }

      // 10RM PR
      if (current10RM > 0) {
        let is10RMPR = true;
        for (const s of historicalSessions) {
          const h10RM = getExerciseRepMax(s.exercises, exerciseName, 10);
          if (h10RM >= current10RM) {
            is10RMPR = false;
            break;
          }
        }
        if (is10RMPR && historicalSessions.length > 0) {
          newAchievements.push({
            achievementId: `10rm_pr_${exerciseName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
            uid: userId,
            name: 'Heaviest 10RM ever',
            description: `New 10-rep max for ${exerciseName}: ${current10RM} lbs`,
            earnedAt: now,
            value: current10RM,
            verified: true
          });
        }
      }
    }

    // 2. Step Streak (Last 7 daily logs)
    const logsQuery = query(
      collection(db, 'users', userId, 'daily_logs'),
      orderBy('date', 'desc'),
      limit(7)
    );
    const logsSnap = await getDocs(logsQuery);
    const logs = logsSnap.docs.map(d => d.data() as DailyLog);
    
    if (logs.length >= 7) {
      const isStreak = logs.every(l => l.stepCount >= 5000);
      if (isStreak) {
        // Check if a streak achievement was earned TODAY to avoid duplicates
        const todayStr = new Date().toISOString().split('T')[0];
        const existingStreakQuery = query(
          collection(db, 'users', userId, 'achievements'),
          where('name', '==', '7-Day Step Streak'),
          where('earnedAt', '>=', todayStr)
        );
        const existingStreakSnap = await getDocs(existingStreakQuery);
        
        if (existingStreakSnap.empty) {
          newAchievements.push({
            achievementId: `step_streak_7_${Date.now()}`,
            uid: userId,
            name: '7-Day Step Streak',
            description: 'Completed 5,000+ steps for 7 consecutive days!',
            earnedAt: now,
            value: 7,
            verified: true
          });
        }
      }
    }

    // Save new achievements to Firestore subcollection
    for (const ach of newAchievements) {
      await addDoc(collection(db, 'users', userId, 'achievements'), ach);
    }

    return newAchievements;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
};
