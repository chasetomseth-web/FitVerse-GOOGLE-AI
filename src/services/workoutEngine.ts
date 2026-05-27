import { 
  TrainingProgram, 
  WorkoutSession, 
  WorkoutBlock,
  WorkoutExercise, 
  WorkoutSet, 
  UserProfile, 
  StrengthBaselines,
  InjuryEntry,
  DailyLog,
  ProgramSession,
  ProgramBlock,
  ProgramExercise
} from '../types';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { getReadinessAdjustments } from './readinessEngine';

/**
 * Workout Engine Service
 * Handles dynamic workout generation and adjustment based on readiness, equipment, time, and injuries.
 */

const RECOVERY_EXERCISES = [
  { exerciseName: 'Bodyweight Squat', primaryMuscleGroup: 'Legs', secondaryMuscleGroups: ['Glutes'], movementPattern: 'Squat' },
  { exerciseName: 'Pushup', primaryMuscleGroup: 'Chest', secondaryMuscleGroups: ['Triceps', 'Shoulders'], movementPattern: 'Horizontal Push' },
  { exerciseName: 'Bird Dog', primaryMuscleGroup: 'Core', secondaryMuscleGroups: ['Back'], movementPattern: 'Anti-Rotation' },
  { exerciseName: 'Glute Bridge', primaryMuscleGroup: 'Legs', secondaryMuscleGroups: ['Glutes', 'Hamstrings'], movementPattern: 'Hinge' },
  { exerciseName: 'Cat Cow', primaryMuscleGroup: 'Back', secondaryMuscleGroups: ['Core'], movementPattern: 'Mobility' }
];

export const EQUIPMENT_SUBSTITUTION_MAP: Record<string, string> = {
  'Barbell': 'Dumbbell',
  'Dumbbell': 'Kettlebell',
  'Kettlebell': 'Cable Machine',
  'Cable Machine': 'Bands',
  'Bands': 'Bodyweight',
  'Rack': 'Bench',
  'Bench': 'Bodyweight',
  'Pull-up Bar': 'Bands',
  'Machines': 'Dumbbell',
  'Cardio Machines': 'Bodyweight'
};

/**
 * Generates an adjusted workout session based on multiple constraints.
 */
export const generateAdjustedSession = (
  program: TrainingProgram,
  readinessScore: number,
  availableEquipment: string[],
  availableTime: number,
  activeInjuries: InjuryEntry[],
  strengthBaselines: StrengthBaselines,
  uid: string,
  dailyLog?: DailyLog
): WorkoutSession => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const readinessStatus = getReadinessStatus(readinessScore);
  const safeEquipment = availableEquipment || [];
  
  // 1. Get base session from program for today
  const currentWeekData = program.weeks?.find(w => w.weekNumber === program.currentWeek);
  const dayName = format(new Date(), 'EEEE');
  const aiSession = currentWeekData?.sessions.find(s => s.dayName === dayName);

  const currentWeekConfig = program.weeklySchedule || {};
  const sessionConfig = currentWeekConfig[dayName] || Object.values(currentWeekConfig)[0];
  
  let blocks: WorkoutBlock[] = [];
  let adjustmentsMade = {
    volumeChange: 0,
    intensityRPE: 0,
    restModifier: 1.0,
    reason: 'Standard session'
  };

  // 2. Apply Readiness Adjustments First
  if (readinessStatus === 'Recovery') {
    blocks = [{
      type: 'strength',
      exercises: RECOVERY_EXERCISES.map(ex => ({
        exerciseId: ex.exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        exerciseName: ex.exerciseName,
        primaryMuscleGroup: ex.primaryMuscleGroup,
        secondaryMuscleGroups: ex.secondaryMuscleGroups,
        movementPattern: ex.movementPattern as any,
        sets: Array(2).fill(null).map(() => ({
          reps: 12,
          weight: 0,
          rpe: 5,
          restSeconds: 60
        }))
      }))
    }];
    adjustmentsMade = {
      volumeChange: -50,
      intensityRPE: -3,
      restModifier: 1.2,
      reason: 'Recovery status: Light full-body movement'
    };
  } else {
    // Start with AI blocks if available
    let baseBlocks = aiSession?.blocks || [];
    
    // Check for specialized versions
    if (availableTime <= 30 && aiSession?.shortVersion && aiSession.shortVersion.length > 0) {
      baseBlocks = aiSession.shortVersion;
      adjustmentsMade.reason = 'Using 30-minute optimized version';
    } else if (safeEquipment.length === 1 && safeEquipment[0] === 'Bodyweight' && aiSession?.bodyweightVersion && aiSession.bodyweightVersion.length > 0) {
      baseBlocks = aiSession.bodyweightVersion;
      adjustmentsMade.reason = 'Using bodyweight-only version';
    }

    // Calculate base readiness adjustments
    const readinessAdjustments = getReadinessAdjustments(readinessScore);
    let volumeChange = readinessAdjustments.volumeChange;
    let intensityRPE = readinessAdjustments.intensityRPE;
    let restModifier = readinessAdjustments.restModifier;
    let reason = readinessAdjustments.reason;

    // Further adjust based on specific daily log metrics if available
    if (dailyLog) {
      if (dailyLog.sorenessLevel <= 2) {
        volumeChange -= 1;
        reason += " + High soreness adjustment.";
      }
      if (dailyLog.energyLevel <= 2) {
        intensityRPE -= 1;
        reason += " + Low energy adjustment.";
      }
      if (dailyLog.stressLevel <= 2) {
        restModifier *= 1.1;
        reason += " + High stress adjustment.";
      }
    }

    adjustmentsMade = {
      volumeChange,
      intensityRPE,
      restModifier,
      reason
    };

    if (baseBlocks.length > 0) {
      blocks = baseBlocks.map(block => ({
        type: block.type,
        circuitType: block.circuitType,
        duration: block.duration,
        exercises: block.exercises.map(ex => {
          // Parse reps string (e.g., "8-10" -> 8)
          const repsMatch = ex.reps?.toString().match(/(\d+)/);
          const reps = repsMatch ? parseInt(repsMatch[1]) : 10;
          
          // Adjust sets based on volume change
          const baseSets = ex.sets || 3;
          const finalSetsCount = Math.max(1, baseSets + volumeChange);

          return {
            exerciseId: ex.name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            exerciseName: ex.name,
            primaryMuscleGroup: ex.primaryMuscleGroup || ex.type, // Use ex.primaryMuscleGroup if available, fallback to ex.type
            secondaryMuscleGroups: ex.secondaryMuscleGroups || [],
            movementPattern: (ex as any).movementPattern || 'Other',
            sets: Array(finalSetsCount).fill(null).map(() => ({
              reps,
              weight: 0,
              rpe: 8 + intensityRPE,
              restSeconds: Math.round((parseInt(ex.rest || '90') || 90) * restModifier)
            })),
            instructions: ex.notes,
            tempo: ex.tempo,
            rest: ex.rest,
            weightSuggested: ex.weight
          };
        })
      }));
    } else {
      // Fallback to template exercises
      const baseExercises = getBaseExercisesForFocus(sessionConfig?.sessionFocus || 'Full Body Power');
      blocks = baseExercises.map(ex => ({
        type: 'strength',
        exercises: [
        {
          exerciseId: ex.exerciseName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          ...ex
        }
      ]
      }));
    }
  }

  // 3. Filter by Available Equipment & Substitute
  blocks = blocks.map(block => ({
    ...block,
    exercises: block.exercises.map(ex => {
      let currentName = ex.exerciseName;
      let required = getRequiredEquipment(currentName);
      
      // Keep track of what we've tried to avoid infinite loops
      const triedEquip = new Set<string>();
      
      while (required.some(req => !safeEquipment.includes(req))) {
        // Find the first missing requirement
        const missing = required.find(req => !safeEquipment.includes(req))!;
        
        if (triedEquip.has(missing)) break;
        triedEquip.add(missing);

        const sub = EQUIPMENT_SUBSTITUTION_MAP[missing];
        if (!sub) break;
        
        const newName = substituteExerciseName(currentName, missing, sub);
        if (newName === currentName) {
          // If direct name replacement fails, try generic patterns
          if (missing === 'Barbell') currentName = currentName.replace('Barbell', 'Dumbbell');
          else if (missing === 'Dumbbell') currentName = 'Pushup'; // Extreme fallback
          else if (missing === 'Rack' || missing === 'Bench') {
            // If missing rack or bench, try to switch to dumbbell version which usually doesn't need them
            currentName = currentName.replace('Barbell', 'Dumbbell');
          }
        } else {
          currentName = newName;
        }
        
        required = getRequiredEquipment(currentName);
      }
      
      return { ...ex, exerciseName: currentName };
    })
  }));

  // 4. Injury Filtering
  const injuredMuscles = activeInjuries.map(i => i.bodyPart.toLowerCase());
  blocks = blocks.map(block => ({
    ...block,
    exercises: block.exercises.filter(ex => {
      const loadsInjuredArea = [ex.primaryMuscleGroup, ...(ex.secondaryMuscleGroups || [])].some(m => injuredMuscles.includes(m.toLowerCase()));
      return !loadsInjuredArea;
    })
  })).filter(block => block.exercises.length > 0);

  // 5. Duration Management (Simplified for blocks)
  // ... (could be more complex, but let's keep it simple for now)

  // 6. Assign Working Weights
  blocks = blocks.map(block => ({
    ...block,
    exercises: block.exercises.map(ex => ({
      ...ex,
      sets: ex.sets.map(set => ({
        ...set,
        weight: calculateWeight(ex.exerciseName, set.reps, strengthBaselines)
      }))
    }))
  }));

  // Flatten exercises for backward compatibility
  const allExercises = blocks.flatMap(b => b.exercises);

  return {
    sessionId: `sess_${Date.now()}`,
    uid,
    date: todayStr,
    programId: program.programId,
    programWeek: program.currentWeek,
    sessionFocus: sessionConfig?.sessionFocus || 'Full Body Power',
    plannedDuration: calculateDuration(allExercises),
    readinessAtSession: readinessScore,
    adjustmentsMade,
    blocks,
    exercises: allExercises,
    achievementsUnlocked: [],
    status: 'assigned'
  };
};

export const generateInitialProgram = (profile: UserProfile): TrainingProgram => {
  const programId = `prog_${Date.now()}`;
  const initialProgram: TrainingProgram = {
    programId,
    uid: profile.uid,
    programName: `${profile.primaryGoal.replace('_', ' ').toUpperCase()} PHASE 1`,
    totalWeeks: 12,
    currentWeek: 1,
    startDate: new Date().toISOString(),
    expectedEndDate: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    phases: [
      {
        phaseName: 'Foundation',
        weekStart: 1,
        weekEnd: 4,
        focus: 'Form & Consistency',
        volumeMultiplier: 1.0,
        intensityTarget: 7,
        keyPrinciple: 'Progressive Overload'
      }
    ],
    weeklySchedule: {},
    consistencyScore: 0,
    progressPercent: 0
  };

  // Build weekly schedule based on preferredWorkoutDays
  const days = profile.preferredWorkoutDays || [1, 3, 5];
  const focuses = ['Upper Body Power', 'Lower Body Power', 'Full Body Hypertrophy', 'Core & Conditioning', 'Active Recovery'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  days.forEach((day, idx) => {
    const dayName = DAY_NAMES[day];
    const focus = focuses[idx % focuses.length];
    initialProgram.weeklySchedule[dayName] = {
      sessionFocus: focus,
      targetMuscles: focus.includes('Upper') ? ['Chest', 'Back', 'Shoulders'] : focus.includes('Lower') ? ['Quads', 'Hams', 'Glutes'] : ['Full Body'],
      sessionType: focus.includes('Power') ? 'Strength' : 'Hypertrophy',
      estimatedDuration: profile.preferredWorkoutDuration || 45
    };
  });

  return initialProgram;
};

// --- Helper Functions ---

function getReadinessStatus(score: number): 'Peak' | 'Stable' | 'Reduced' | 'Recovery' {
  if (score >= 85) return 'Peak';
  if (score >= 70) return 'Stable';
  if (score >= 50) return 'Reduced';
  return 'Recovery';
}

function isCompound(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('squat') || n.includes('deadlift') || n.includes('bench') || 
         n.includes('press') || n.includes('row') || n.includes('pull up') || 
         n.includes('chin up') || n.includes('clean') || n.includes('snatch') ||
         n.includes('lunge') || n.includes('step up') || n.includes('burpee') ||
         n.includes('thruster');
}

export const getRequiredEquipment = (name: string): string[] => {
  const n = name.toLowerCase();
  const requirements: string[] = [];

  if (n.includes('barbell') || n.includes('bb ')) requirements.push('Barbell');
  if (n.includes('dumbbell') || n.includes('db ')) requirements.push('Dumbbell');
  if (n.includes('kettlebell') || n.includes('kb ')) requirements.push('Kettlebell');
  if (n.includes('cable')) requirements.push('Cable Machine');
  if (n.includes('machine')) requirements.push('Machines');
  if (n.includes('band')) requirements.push('Bands');
  if (n.includes('pull up') || n.includes('pull-up') || n.includes('chin up')) requirements.push('Pull-up Bar');
  if (n.includes('bench press') || n.includes('incline press')) requirements.push('Bench');
  if (n.includes('squat rack') || n.includes('power rack') || (n.includes('squat') && n.includes('barbell'))) requirements.push('Rack');
  if (n.includes('treadmill') || n.includes('bike') || n.includes('rower')) requirements.push('Cardio Machines');
  
  if (requirements.length === 0) requirements.push('Bodyweight');
  
  return requirements;
};

export const substituteExerciseName = (name: string, oldEquip: string, newEquip: string): string => {
  // Specific substitution rules
  const n = name.toLowerCase();
  if (oldEquip === 'Barbell' && newEquip === 'Dumbbell') {
    if (n.includes('bench press')) return 'Dumbbell Bench Press';
    if (n.includes('squat')) return 'Goblet Squat';
    if (n.includes('deadlift')) return 'Dumbbell RDL';
    if (n.includes('row')) return 'Dumbbell Row';
    if (n.includes('overhead press')) return 'Dumbbell Shoulder Press';
  }
  if (oldEquip === 'Dumbbell' && newEquip === 'Bodyweight') {
    if (n.includes('bench press')) return 'Pushup';
    if (n.includes('squat')) return 'Bodyweight Squat';
    if (n.includes('row')) return 'Inverted Row';
    if (n.includes('lunge')) return 'Bodyweight Lunge';
  }
  
  // Generic string replacement fallback
  return name.replace(oldEquip, newEquip).replace(oldEquip.toLowerCase(), newEquip.toLowerCase());
};

function calculateDuration(exercises: WorkoutExercise[]): number {
  let totalSeconds = 0;
  exercises.forEach(ex => {
    ex.sets.forEach(set => {
      // Assume 3 seconds per rep + rest
      totalSeconds += (set.reps * 3) + set.restSeconds;
    });
    // Add 2 mins transition between exercises
    totalSeconds += 120;
  });
  return Math.round(totalSeconds / 60);
}

function calculateWeight(name: string, reps: number, baselines: StrengthBaselines): number {
  const n = name.toLowerCase();
  let oneRepMax = 0;

  if (n.includes('bench')) oneRepMax = baselines.benchPress || 0;
  else if (n.includes('squat')) oneRepMax = baselines.squat || 0;
  else if (n.includes('deadlift')) oneRepMax = baselines.deadlift || 0;
  else if (n.includes('overhead press') || n.includes('ohp')) oneRepMax = baselines.overheadPress || 0;
  else if (n.includes('row')) oneRepMax = baselines.barbellRow || baselines.dumbbellRow || 0;

  if (oneRepMax === 0) return 0;

  // Hypertrophy (8-12 reps): 65-75%
  if (reps >= 8) {
    return Math.round(oneRepMax * 0.7);
  }
  // Strength (1-5 reps): 80-90%
  if (reps <= 5) {
    return Math.round(oneRepMax * 0.85);
  }
  // Default / Power (6-7 reps)
  return Math.round(oneRepMax * 0.75);
}

export const getBaseExercisesForFocus = (focus: string): WorkoutExercise[] => {
  const n = focus.toLowerCase();
  
  // Specific templates for distinct focuses
  const templates: Record<string, WorkoutExercise[]> = {
    'lower_power': [
      {
        exerciseId: 'back_squat',
        exerciseName: 'Back squat',
        primaryMuscleGroup: 'Legs',
        secondaryMuscleGroups: ['Glutes'],
        movementPattern: 'Squat',
        sets: Array(3).fill(null).map(() => ({ reps: 5, weight: 0, rpe: 8, restSeconds: 120 }))
      },
      {
        exerciseId: 'barbell_deadlift',
        exerciseName: 'Barbell deadlift',
        primaryMuscleGroup: 'Legs',
        secondaryMuscleGroups: ['Back'],
        movementPattern: 'Hinge',
        sets: Array(3).fill(null).map(() => ({ reps: 3, weight: 0, rpe: 9, restSeconds: 180 }))
      },
      {
        exerciseId: 'box_jump___step_down',
        exerciseName: 'Box jump - step down',
        primaryMuscleGroup: 'Legs',
        secondaryMuscleGroups: [],
        movementPattern: 'Plyometric',
        sets: Array(3).fill(null).map(() => ({ reps: 5, weight: 0, rpe: 7, restSeconds: 90 }))
      }
    ],
    'upper_power': [
      {
        exerciseId: 'barbell_bench_press',
        exerciseName: 'Barbell bench press',
        primaryMuscleGroup: 'Chest',
        secondaryMuscleGroups: ['Triceps', 'Shoulders'],
        movementPattern: 'Horizontal Push',
        sets: Array(3).fill(null).map(() => ({ reps: 5, weight: 0, rpe: 8, restSeconds: 120 }))
      },
      {
        exerciseId: 'barbell_bent_over_row',
        exerciseName: 'Barbell bent over row',
        primaryMuscleGroup: 'Back',
        secondaryMuscleGroups: ['Arms'],
        movementPattern: 'Horizontal Pull',
        sets: Array(3).fill(null).map(() => ({ reps: 5, weight: 0, rpe: 8, restSeconds: 120 }))
      },
      {
        exerciseId: 'strict_press',
        exerciseName: 'Strict press',
        primaryMuscleGroup: 'Shoulders',
        secondaryMuscleGroups: ['Arms'],
        movementPattern: 'Vertical Push',
        sets: Array(3).fill(null).map(() => ({ reps: 5, weight: 0, rpe: 8, restSeconds: 120 }))
      }
    ],
    'lower_hypertrophy': [
      {
        exerciseId: 'goblet_squat',
        exerciseName: 'Goblet squat',
        primaryMuscleGroup: 'Legs',
        secondaryMuscleGroups: ['Glutes'],
        movementPattern: 'Squat',
        sets: Array(3).fill(null).map(() => ({ reps: 12, weight: 0, rpe: 7, restSeconds: 60 }))
      },
      {
        exerciseId: 'barbell_rdl',
        exerciseName: 'Barbell rdl',
        primaryMuscleGroup: 'Legs',
        secondaryMuscleGroups: ['Back'],
        movementPattern: 'Hinge',
        sets: Array(3).fill(null).map(() => ({ reps: 10, weight: 0, rpe: 8, restSeconds: 90 }))
      },
      {
        exerciseId: 'bulgarian_split_squat',
        exerciseName: 'Bulgarian split squat',
        primaryMuscleGroup: 'Legs',
        secondaryMuscleGroups: ['Glutes'],
        movementPattern: 'Lunge',
        sets: Array(3).fill(null).map(() => ({ reps: 10, weight: 0, rpe: 8, restSeconds: 60 }))
      }
    ],
    'upper_hypertrophy': [
      {
        exerciseId: 'dumbbell_bench_press',
        exerciseName: 'Dumbbell bench press',
        primaryMuscleGroup: 'Chest',
        secondaryMuscleGroups: ['Triceps', 'Shoulders'],
        movementPattern: 'Horizontal Push',
        sets: Array(3).fill(null).map(() => ({ reps: 10, weight: 0, rpe: 8, restSeconds: 90 }))
      },
      {
        exerciseId: 'dumbbell_single_arm_row',
        exerciseName: 'Dumbbell single arm row',
        primaryMuscleGroup: 'Back',
        secondaryMuscleGroups: ['Arms'],
        movementPattern: 'Horizontal Pull',
        sets: Array(3).fill(null).map(() => ({ reps: 12, weight: 0, rpe: 7, restSeconds: 60 }))
      },
      {
        exerciseId: 'dumbbell_lateral_raise',
        exerciseName: 'Dumbbell lateral raise',
        primaryMuscleGroup: 'Shoulders',
        secondaryMuscleGroups: [],
        movementPattern: 'Other',
        sets: Array(3).fill(null).map(() => ({ reps: 15, weight: 0, rpe: 8, restSeconds: 45 }))
      }
    ],
    'full_body_hypertrophy': [
      {
        exerciseId: 'back_squat',
        exerciseName: 'Back squat',
        primaryMuscleGroup: 'Legs',
        secondaryMuscleGroups: ['Glutes'],
        movementPattern: 'Squat',
        sets: Array(3).fill(null).map(() => ({ reps: 10, weight: 0, rpe: 7, restSeconds: 90 }))
      },
      {
        exerciseId: 'barbell_bench_press',
        exerciseName: 'Barbell bench press',
        primaryMuscleGroup: 'Chest',
        secondaryMuscleGroups: ['Triceps', 'Shoulders'],
        movementPattern: 'Horizontal Push',
        sets: Array(3).fill(null).map(() => ({ reps: 10, weight: 0, rpe: 7, restSeconds: 90 }))
      },
      {
        exerciseId: 'dumbbell_single_arm_row',
        exerciseName: 'Dumbbell single arm row',
        primaryMuscleGroup: 'Back',
        secondaryMuscleGroups: ['Arms'],
        movementPattern: 'Horizontal Pull',
        sets: Array(3).fill(null).map(() => ({ reps: 12, weight: 0, rpe: 7, restSeconds: 60 }))
      }
    ],
    'conditioning': [
      {
        exerciseId: 'burpee',
        exerciseName: 'Burpee',
        primaryMuscleGroup: 'Full Body',
        secondaryMuscleGroups: [],
        movementPattern: 'Plyometric',
        sets: Array(4).fill(null).map(() => ({ reps: 15, weight: 0, rpe: 9, restSeconds: 30 }))
      },
      {
        exerciseId: 'kettlebell_swing_singles',
        exerciseName: 'Kettlebell swing singles',
        primaryMuscleGroup: 'Legs',
        secondaryMuscleGroups: ['Back'],
        movementPattern: 'Hinge',
        sets: Array(4).fill(null).map(() => ({ reps: 20, weight: 0, rpe: 8, restSeconds: 30 }))
      },
      {
        exerciseId: 'mountain_climbers',
        exerciseName: 'Mountain climbers',
        primaryMuscleGroup: 'Core',
        secondaryMuscleGroups: [],
        movementPattern: 'Core',
        sets: Array(4).fill(null).map(() => ({ reps: 30, weight: 0, rpe: 8, restSeconds: 30 }))
      }
    ]
  };

  if (n.includes('lower') && n.includes('power')) return templates['lower_power'];
  if (n.includes('upper') && n.includes('power')) return templates['upper_power'];
  if (n.includes('lower') && n.includes('hypertrophy')) return templates['lower_hypertrophy'];
  if (n.includes('upper') && n.includes('hypertrophy')) return templates['upper_hypertrophy'];
  if (n.includes('full body') && n.includes('hypertrophy')) return templates['full_body_hypertrophy'];
  if (n.includes('conditioning') || n.includes('circuit')) return templates['conditioning'];
  
  // Fallback chain
  if (n.includes('lower')) return templates['lower_power'];
  if (n.includes('upper')) return templates['upper_power'];
  if (n.includes('power')) return templates['lower_power'];
  
  return templates['full_body_hypertrophy'];
}
