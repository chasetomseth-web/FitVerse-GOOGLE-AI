import { db } from '../lib/db';
import { handleSupabaseError, OperationType, supabase } from '../lib/supabase';
import { CoachAction } from '../types/actions';
import { format } from 'date-fns';
import { DailyLog, DailyWorkoutState, UserProfile, MealEntry, WorkoutBlock } from '../types';

export const handleCoachActions = async (
  uid: string,
  actions: CoachAction[],
  profile: UserProfile,
  onActionComplete?: (message: string) => void
) => {
  if (!actions || actions.length === 0) return;

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  for (const action of actions) {
    try {
      console.log(`Executing Coach Action: ${action.type}`, action.payload);
      switch (action.type) {
        case 'log_food': {
          const name = String(action.payload.food_name || action.payload.name || action.payload.foodName || 'Fuel');
          const calories = Math.round(Number(action.payload.calories || 0));
          const protein = Math.round(Number(action.payload.protein || action.payload.proteinG || 0));
          const carbs = Math.round(Number(action.payload.carbs || action.payload.carbsG || 0));
          const fat = Math.round(Number(action.payload.fat || action.payload.fatG || 0));
          const mealTime = String(action.payload.meal_time || action.payload.mealTime || 'snack').toLowerCase();

          const newMeal: MealEntry = {
            mealType: (['breakfast', 'lunch', 'dinner', 'snack'].includes(mealTime) ? mealTime : 'snack') as any,
            foods: [name],
            macros: { calories, protein, carbs, fat },
            timestamp: new Date().toISOString()
          };

          // Get current log to append meal
          const currentLog = await db.getDailyLog(uid, todayStr);
          const currentMealLog = (currentLog as any)?.mealLog || [];
          const currentCalories = (currentLog as any)?.caloriesConsumed || 0;
          const currentProtein = (currentLog as any)?.proteinConsumedG || 0;
          const currentCarbs = (currentLog as any)?.carbsConsumedG || 0;
          const currentFat = (currentLog as any)?.fatConsumedG || 0;

          // Upsert the daily log with incremented values
          await db.upsertDailyLog(uid, todayStr, {
            mealLog: [...currentMealLog, newMeal],
            caloriesConsumed: currentCalories + calories,
            proteinConsumedG: currentProtein + protein,
            carbsConsumedG: currentCarbs + carbs,
            fatConsumedG: currentFat + fat
          });

          onActionComplete?.(`Logged ${name} (${calories} kcal)`);
          break;
        }

        case 'add_exercise': {
          const exerciseName = String(action.payload.exercise_name || action.payload.exerciseName || 'Exercise');
          const sets = Number(action.payload.sets || 3);
          const reps = String(action.payload.reps || '10');
          const weight = Number(action.payload.weight || 0);

          const state = await db.getDailyWorkoutState(uid, todayStr);

          if (state) {
            const blocks = [...((state as any).exerciseBlocks || [])] as WorkoutBlock[];

            if (blocks.length === 0) {
              blocks.push({
                type: 'strength',
                displayMode: 'single',
                exercises: [],
                instructions: 'Coach added accessory move'
              });
            }

            const activeBlock = blocks[blocks.length - 1];
            activeBlock.exercises.push({
              exerciseId: crypto.randomUUID(),
              exerciseName: exerciseName,
              sets: Array(sets).fill({
                reps: parseInt(reps) || 10,
                weight: weight,
                rpe: 8,
                restSeconds: 90
              }),
              primaryMuscleGroup: 'Misc',
              secondaryMuscleGroups: [],
            } as any);

            await db.upsertDailyWorkoutState(uid, todayStr, { exerciseBlocks: blocks });
            onActionComplete?.(`Added ${exerciseName} to today's workout`);
          } else {
            console.warn("No workout state found for today to add exercise.");
          }
          break;
        }

        case 'update_weight': {
          const value = Number(action.payload.value);

          await db.updateUser(uid, { weightKg: value });

          // Also update in daily log
          const currentLog = await db.getDailyLog(uid, todayStr);
          await db.upsertDailyLog(uid, todayStr, {
            weightKg: value,
            ...(currentLog || {})
          });

          onActionComplete?.(`Weight updated to ${value}kg`);
          break;
        }

        case 'update_bodyfat': {
          const value = Number(action.payload.value);
          await db.updateUser(uid, { bodyFatPercentage: value });
          onActionComplete?.(`Body fat updated to ${value}%`);
          break;
        }

        default:
          console.warn(`Action type ${action.type} not implemented in handler.`);
      }
    } catch (error) {
      console.error(`Error handling coach action ${action.type}:`, error);
      handleSupabaseError(error, OperationType.UPDATE, `users/${uid}`);
    }
  }
};
