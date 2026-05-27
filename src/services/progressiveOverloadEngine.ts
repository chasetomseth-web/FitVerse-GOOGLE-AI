import { WorkoutSession, StrengthBaselines, WorkoutExercise } from '../types';
import { db } from '../lib/db';
import { handleSupabaseError, OperationType, supabase } from '../lib/supabase';

/**
 * Progressive Overload Engine Service
 * Analyzes session performance to recommend weight adjustments.
 */

/**
 * Evaluates performance and returns updated strength baselines.
 */
export const evaluateProgressiveOverload = (
  currentSession: WorkoutSession,
  previousSession: WorkoutSession | null
): Partial<StrengthBaselines> => {
  const updatedBaselines: Partial<StrengthBaselines> = {};

  currentSession.exercises.forEach((currentEx) => {
    // 1. Find matching exercise in previous session
    const prevEx = previousSession?.exercises.find(
      (ex) => ex.exerciseName.toLowerCase() === currentEx.exerciseName.toLowerCase()
    );

    // 2. Analyze performance
    const allSetsCompleted = currentEx.sets.every((s) => s.completedAt);
    const avgRPE = currentEx.sets.reduce((sum, s) => sum + s.rpe, 0) / currentEx.sets.length;

    // Check for missed reps (comparing actualReps to target reps)
    // If actualReps is missing, assume they hit the target
    const setsWithMissedReps = currentEx.sets.filter(
      (s) => s.actualReps !== undefined && s.actualReps < s.reps
    ).length;

    const isLowerBody = checkIfLowerBody(currentEx.exerciseName);
    const baselineKey = mapExerciseToBaselineKey(currentEx.exerciseName);

    if (!baselineKey) return;

    // Get the weight used (assume consistent across sets for baseline purposes)
    const currentWeight = currentEx.sets[0].weight;

    // 3. Apply Logic based on User Requirements:
    // - If RPE < 7 increase weight next session
    // - If RPE 7–8 maintain or add reps
    // - If RPE > 9 decrease weight
    if (avgRPE < 7 && allSetsCompleted) {
      // Increase weight
      const increase = isLowerBody ? 2.5 : 1.25;
      updatedBaselines[baselineKey] = currentWeight + increase;
    } else if (avgRPE >= 7 && avgRPE <= 8.5) {
      // Maintain weight, maybe add reps (handled in session generation)
      updatedBaselines[baselineKey] = currentWeight;
    } else if (avgRPE > 9 || setsWithMissedReps >= 1) {
      // Decrease weight
      updatedBaselines[baselineKey] = Math.round(currentWeight * 0.95);
    }
  });

  return updatedBaselines;
};

/**
 * Writes updated baselines to Supabase.
 */
export const updateStrengthBaselines = async (
  uid: string,
  updatedBaselines: Partial<StrengthBaselines>
): Promise<void> => {
  if (Object.keys(updatedBaselines).length === 0) return;

  try {
    // Filter out undefined values
    const cleanBaselines = Object.entries(updatedBaselines).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    if (Object.keys(cleanBaselines).length === 0) return;

    await db.updateUser(uid, { strengthBaselines: cleanBaselines });
  } catch (error) {
    handleSupabaseError(error, OperationType.WRITE, `users/${uid}`);
  }
};

// --- Helper Functions ---

function checkIfLowerBody(name: string): boolean {
  const n = name.toLowerCase();
  const keywords = ['squat', 'deadlift', 'leg', 'lunge', 'hip', 'glute', 'hamstring', 'calf'];
  return keywords.some((k) => n.includes(k));
}

function mapExerciseToBaselineKey(name: string): keyof StrengthBaselines | null {
  const n = name.toLowerCase();
  if (n.includes('bench press')) return 'benchPress';
  if (n.includes('squat')) return 'squat';
  if (n.includes('deadlift')) return 'deadlift';
  if (n.includes('overhead press') || n.includes('ohp')) return 'overheadPress';
  if (n.includes('barbell row')) return 'barbellRow';
  if (n.includes('dumbbell row')) return 'dumbbellRow';
  return null;
}
