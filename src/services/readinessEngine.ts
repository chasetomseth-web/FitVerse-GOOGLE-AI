import { DailyLog, UserProfile } from '../types';

export interface ReadinessResult {
  total: number;
  status: DailyLog['readinessStatus'];
}

export interface ReadinessAdjustments {
  volumeChange: number;
  intensityRPE: number;
  restModifier: number;
  reason: string;
}

/**
 * Calculates the optimal sleep hours based on individual profile.
 */
export const getOptimalSleepRange = (profile: UserProfile): { min: number; max: number } => {
  let min = 7;
  let max = 9;

  // Age-based adjustments
  if (profile.age < 25) {
    min = 7.5;
    max = 9.5;
  } else if (profile.age > 65) {
    min = 7;
    max = 8;
  }

  // Activity-based adjustments
  if (profile.fitnessLevel === 'advanced' || profile.primaryGoal === 'sports_performance') {
    min += 0.5;
    max += 1.0;
  }

  // Sex-based adjustment (marginal but scientifically noted)
  if (profile.gender === 'female') {
    min += 0.3;
    max += 0.3;
  }

  return { min, max };
};

/**
 * Calculates the readiness score based on tailored metrics.
 * 
 * @param sleepHours - Actual hours of sleep
 * @param sleepQuality - Quality rating (1-5, 5 is best)
 * @param muscleSoreness - Soreness rating (1-5, 5 is best/least sore)
 * @param energyLevel - Energy rating (1-5, 5 is best)
 * @param stressLevel - Stress rating (1-5, 5 is best/least stressed)
 * @param profile - User profile for tailoring
 */
export const calculateReadinessScore = (
  sleepHours: number,
  sleepQuality: number,
  muscleSoreness: number,
  energyLevel: number,
  stressLevel: number,
  profile: UserProfile
): ReadinessResult => {
  const { min: optMin, max: optMax } = getOptimalSleepRange(profile);

  // 1. Sleep Hours (25 pts)
  // Linear scale up to optMin, then flat at 25 pts up to optMax, then slight penalty for oversleeping?
  // Actually, let's just cap at 25 pts for optMin and above.
  let sleepHourPts = 0;
  if (sleepHours >= optMin) {
    sleepHourPts = 25;
    // Slight penalty for extreme oversleeping (e.g., > 11 hours)
    if (sleepHours > 11) {
      sleepHourPts = Math.max(15, 25 - (sleepHours - 11) * 5);
    }
  } else {
    sleepHourPts = (sleepHours / optMin) * 25;
  }

  // 2. Sleep Quality (20 pts)
  const qualityPts = (sleepQuality / 5) * 20;

  // 3. Muscle Soreness (20 pts) - 5 is Fresh
  const sorenessPts = (muscleSoreness / 5) * 20;

  // 4. Energy Level (20 pts) - 5 is High
  const energyPts = (energyLevel / 5) * 20;

  // 5. Stress Level (15 pts) - 5 is Relaxed
  const stressPts = (stressLevel / 5) * 15;

  const total = Math.round(sleepHourPts + qualityPts + sorenessPts + energyPts + stressPts);
  
  let status: DailyLog['readinessStatus'] = 'Stable';
  if (total >= 85) status = 'Peak';
  else if (total >= 70) status = 'Stable'; // Normal
  else if (total >= 50) status = 'Reduced'; // Low
  else if (total >= 30) status = 'Fatigued';
  else status = 'Recovery';

  return { total, status };
};

/**
 * Returns training adjustments based on the readiness score.
 */
export const getReadinessAdjustments = (score: number): ReadinessAdjustments => {
  if (score >= 85) {
    return {
      volumeChange: 0,
      intensityRPE: 0,
      restModifier: 1.0,
      reason: 'Peak recovery. Execute planned session at full intensity.'
    };
  } else if (score >= 70) {
    return {
      volumeChange: 0,
      intensityRPE: 0,
      restModifier: 1.0,
      reason: 'Stable recovery. Proceed with planned session.'
    };
  } else if (score >= 50) {
    return {
      volumeChange: -1,
      intensityRPE: -1,
      restModifier: 1.2,
      reason: 'Reduced recovery. Volume and intensity decreased by 1 unit. Rest increased 20%.'
    };
  } else {
    return {
      volumeChange: -2,
      intensityRPE: -2,
      restModifier: 1.5,
      reason: 'Recovery state. Significant reduction in volume and intensity. Focus on movement quality.'
    };
  }
};

/**
 * Returns a hex color string based on the readiness score.
 */
export const getReadinessColor = (score: number): string => {
  if (score >= 85) return '#10B981'; // Green (Emerald 500)
  if (score >= 70) return '#E2B55C'; // Yellow (Brand Gold)
  if (score >= 50) return '#F59E0B'; // Orange (Amber 500)
  return '#E33F70'; // Red (Brand Pink)
};

/**
 * Returns a human-readable label for readiness sliders.
 */
export const getSliderDescriptor = (type: string, value: number): string => {
  switch (type) {
    case 'sleepQuality':
      if (value >= 5) return 'Excellent';
      if (value >= 4) return 'Good';
      if (value >= 3) return 'Average';
      if (value >= 2) return 'Poor';
      return 'Terrible';
    case 'sorenessLevel':
      if (value >= 5) return 'Fresh';
      if (value >= 4) return 'Mild';
      if (value >= 3) return 'Moderate';
      if (value >= 2) return 'Sore';
      return 'Max Sore';
    case 'energyLevel':
      if (value >= 5) return 'High';
      if (value >= 4) return 'Good';
      if (value >= 3) return 'Average';
      if (value >= 2) return 'Low';
      return 'Drained';
    case 'stressLevel':
      if (value >= 5) return 'Relaxed';
      if (value >= 4) return 'Calm';
      if (value >= 3) return 'Moderate';
      if (value >= 2) return 'Stressed';
      return 'High Stress';
    default:
      return value.toString();
  }
};
