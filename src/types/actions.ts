export type CoachActionType = 
  | 'log_food'
  | 'update_food'
  | 'delete_food'
  | 'recommend_meal'
  | 'add_exercise'
  | 'replace_exercise'
  | 'generate_workout'
  | 'update_weight'
  | 'update_bodyfat'
  | 'update_goal';

export interface CoachAction {
  type: CoachActionType;
  payload: any;
}

export interface CoachResponse {
  message: string;
  actions: CoachAction[];
}

export interface LogFoodPayload {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealTime?: string; // 'morning', 'afternoon', 'evening', 'night'
}

export interface AddExercisePayload {
  exerciseName: string;
  sets: number;
  reps: string;
  weight?: number;
  notes?: string;
  dayIndex?: number; // 0-6
}

export interface UpdateMetricPayload {
  value: number;
  unit?: string;
}
