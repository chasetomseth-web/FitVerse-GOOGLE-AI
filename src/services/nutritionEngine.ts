import { UserProfile, DailyLog } from '../types';

export interface NutritionTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Calculates Basal Metabolic Rate using the Mifflin-St Jeor Equation.
 */
export const calculateBMR = (
  weightKg: number,
  heightCm: number,
  age: number,
  gender: 'male' | 'female'
): number => {
  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  if (gender === 'male') {
    bmr += 5;
  } else {
    // female
    bmr -= 161;
  }
  return bmr;
};

/**
 * Returns the activity multiplier based on training frequency and daily steps.
 */
export const getActivityMultiplier = (
  trainingDaysPerWeek: number,
  averageDailySteps: number = 0
): number => {
  // Base activity factor
  let multiplier = 1.2;

  // Training frequency adjustments
  if (trainingDaysPerWeek >= 5) multiplier = 1.725;
  else if (trainingDaysPerWeek >= 3) multiplier = 1.55;
  else if (trainingDaysPerWeek >= 1) multiplier = 1.375;

  // Step-based adjustments (bonus)
  if (averageDailySteps > 10000) multiplier += 0.1;
  else if (averageDailySteps > 7500) multiplier += 0.05;

  return multiplier;
};

/**
 * Calculates the base daily nutrition targets before readiness adjustments.
 */
export const calculateDailyNutrition = (
  profile: UserProfile,
  trainingDaysPerWeek: number,
  averageDailySteps: number,
  readinessScore: number
): NutritionTargets => {
  const bmr = calculateBMR(profile.weightKg, profile.heightCm, profile.age, profile.gender);
  const activityMultiplier = getActivityMultiplier(trainingDaysPerWeek, averageDailySteps);
  
  let tdee = bmr * activityMultiplier;

  // Goal Adjustment
  if (profile.primaryGoal === 'muscle_gain') {
    tdee += 300; // Slightly higher surplus for muscle gain focus
  } else if (profile.primaryGoal === 'weight_loss') {
    tdee -= 500; // Standard deficit for weight loss
  } else if (profile.primaryGoal === 'sports_performance') {
    tdee += 100; // Performance focus usually means slight surplus or maintenance
  }

  // Readiness Adjustment (as requested in calculateDailyNutrition)
  if (readinessScore < 50) {
    tdee -= 125;
  }

  // Minimums
  const minCals = profile.gender === 'male' ? 1600 : 1400;
  const calories = Math.max(minCals, Math.round(tdee));

  // Macros
  const proteinMultiplier = profile.primaryGoal === 'weight_loss' ? 2.2 : 2.0;
  const proteinG = Math.round(profile.weightKg * proteinMultiplier);
  const fatG = Math.round(profile.weightKg * 0.9);
  
  const proteinCals = proteinG * 4;
  const fatCals = fatG * 9;
  const carbsG = Math.max(0, Math.round((calories - proteinCals - fatCals) / 4));

  return { calories, proteinG, carbsG, fatG };
};

/**
 * Adjusts nutrition targets based on a specific readiness score.
 * Useful for "what-if" scenarios or dynamic UI updates.
 */
export const calculateAdjustedNutrition = (
  baseNutrition: NutritionTargets,
  readinessScore: number,
  gender: 'male' | 'female'
): NutritionTargets => {
  let adjustedCalories = baseNutrition.calories;
  
  if (readinessScore < 50) {
    adjustedCalories -= 125;
  }

  const minCals = gender === 'male' ? 1600 : 1400;
  adjustedCalories = Math.max(minCals, adjustedCalories);

  // Keep protein and fat stable, adjust carbs
  const calorieDiff = adjustedCalories - baseNutrition.calories;
  const adjustedCarbsG = Math.max(0, baseNutrition.carbsG + Math.round(calorieDiff / 4));

  return {
    ...baseNutrition,
    calories: adjustedCalories,
    carbsG: adjustedCarbsG
  };
};

/**
 * Adjusts nutrition targets based on weight trends.
 * This is the "Advanced Feature" for Fitverse.
 */
export const calculateTrendAdjustedNutrition = (
  baseNutrition: NutritionTargets,
  profile: UserProfile,
  weightStats: { current: number; change: number; avg7Day: number } | null
): NutritionTargets => {
  if (!weightStats) return baseNutrition;

  let adjustedCalories = baseNutrition.calories;
  
  // Goal: weight loss
  if (profile.primaryGoal === 'weight_loss') {
    // Target rate: -0.5 to -1.0 lbs per week
    // If we are using kg, -0.22 to -0.45 kg per week
    const weeklyChangeKg = weightStats.change * 7; // Very rough estimate
    
    if (weeklyChangeKg > -0.2) { // Losing slower than ~0.5lbs/week
      adjustedCalories -= 100;
    }
  } else if (profile.primaryGoal === 'muscle_gain') {
    const weeklyChangeKg = weightStats.change * 7;
    
    if (weeklyChangeKg < 0.1) { // Gaining slower than ~0.2lbs/week
      adjustedCalories += 100;
    }
  }

  const minCals = profile.gender === 'male' ? 1600 : 1400;
  adjustedCalories = Math.max(minCals, adjustedCalories);

  // Keep protein and fat stable, adjust carbs
  const calorieDiff = adjustedCalories - baseNutrition.calories;
  const adjustedCarbsG = Math.max(0, baseNutrition.carbsG + Math.round(calorieDiff / 4));

  return {
    ...baseNutrition,
    calories: adjustedCalories,
    carbsG: adjustedCarbsG
  };
};

/**
 * Calculates remaining macros for the day.
 */
export const getRemainingMacros = (
  targets: NutritionTargets,
  consumed: { calories: number; protein: number; carbs: number; fat: number }
) => {
  return {
    calories: targets.calories - consumed.calories,
    protein: targets.proteinG - consumed.protein,
    carbs: targets.carbsG - consumed.carbs,
    fat: targets.fatG - consumed.fat
  };
};
