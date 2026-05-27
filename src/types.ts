export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  createdAt: string;
  lastActiveAt: string;
  timezone: string;
  age: number;
  birthDate: string;
  unitSystem: 'imperial' | 'metric';
  gender: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  bodyweightGoalKg: number;
  bodyFatPercent?: number;
  primaryGoal: 'muscle_gain' | 'weight_loss' | 'sports_performance';
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  availableEquipment: string[];
  preferredWorkoutDuration: number;
  preferredWorkoutDays: number[];
  trainingEnvironment: 'full_gym' | 'home_gym' | 'outdoor' | 'mixed';
  coachNotes: string;
  medicalNotes?: string;
  limitations?: string;
  selectedGoals: string[];
  knownIntolerances: string[];
  mealPreferences: string[];
  injuryLog: InjuryEntry[];
  strengthBaselines: StrengthBaselines;
  onboardingComplete: boolean;
  photoURL?: string;
  currentStreak?: number;
  lastWorkoutDate?: string;
}

export interface InjuryEntry {
  bodyPart: string;
  severity: number;
  dateReported: string;
  status: 'active' | 'recovered' | 'improving';
  description?: string;
}

export interface StrengthBaselines {
  benchPress?: number;
  squat?: number;
  deadlift?: number;
  overheadPress?: number;
  ohp?: number;
  barbellRow?: number;
  dumbbellRow?: number;
  row?: number;
}

export interface DailyLog {
  id: string; // YYYY-MM-DD
  uid: string;
  date: string;
  readinessScore: number;
  readinessStatus: 'Peak' | 'Stable' | 'Reduced' | 'Recovery' | 'Fatigued';
  sleepHours: number;
  sleepQuality: number;
  sorenessLevel: number;
  sorenessLocations: string[];
  stressLevel: number;
  energyLevel: number;
  weightKg?: number;
  hrv?: number;
  calorieBudget: number;
  proteinTargetG: number;
  carbTargetG: number;
  fatTargetG: number;
  caloriesConsumed: number;
  proteinConsumedG: number;
  carbsConsumedG: number;
  fatConsumedG: number;
  mealLog: MealEntry[];
  waterGlasses: number;
  stepCount: number;
  activeCaloriesBurned: number;
  workoutCompleted: boolean;
  isSmartRest?: boolean;
  workoutId?: string;
}

export interface MealEntry {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: string[];
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  timestamp: string;
  photoUrl?: string;
}

export interface DailyWorkoutState {
  id: string; // YYYY-MM-DD
  uid: string;
  date: string;
  programPhase: string;
  programDayType: string;
  workoutTitle: string;
  workoutFocus: string;
  workoutDuration: number; // minutes
  targetIntensity: string; // e.g., "RPE 8"
  exerciseBlocks?: WorkoutBlock[]; // Generated when workout begins
  status: 'scheduled' | 'assigned' | 'generated' | 'in-progress' | 'completed' | 'skipped' | 'rest';
  programId: string;
  programWeek: number;
  swappable?: boolean;
  readinessScoreAtCheckin?: number;
}

export interface WorkoutSession {
  id?: string;
  sessionId: string;
  uid: string;
  date: string;
  programId: string;
  programWeek: number;
  sessionFocus: string;
  plannedDuration: number;
  actualDuration?: number;
  endTime?: string;
  notes?: string;
  description?: string;
  readinessAtSession: number;
  adjustmentsMade: {
    volumeChange: number;
    intensityRPE: number;
    restModifier: number;
    reason: string;
  };
  exercises: WorkoutExercise[];
  blocks: WorkoutBlock[];
  overallRPE?: number;
  sessionNotes?: string;
  achievementsUnlocked: string[];
  status: 'assigned' | 'in-progress' | 'completed' | 'skipped';
}

export interface WorkoutBlock {
  type: 'strength' | 'superset' | 'circuit';
  displayMode?: 'single' | 'grid';
  circuitType?: 'AMRAP' | 'EMOM' | 'FT' | 'Chipper' | 'Tabata' | 'RFT' | 'Ladder' | 'Couplet' | 'Triplet';
  duration?: number; // minutes
  exercises: WorkoutExercise[];
  instructions?: string;
  completedAt?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  movementPattern?: MovementPattern;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  sets: WorkoutSet[];
  formNotes?: string;
  completedAt?: string;
  instructions?: string;
  tempo?: string;
  rest?: string;
  weightSuggested?: string;
}

export interface WorkoutSet {
  reps: number;
  weight: number;
  actualReps?: number;
  actualWeight?: number;
  rpe: number;
  restSeconds: number;
  completedAt?: string;
}

export interface TrainingProgram {
  id?: string;
  programId: string;
  uid: string;
  programName: string;
  totalWeeks: number;
  currentWeek: number;
  startDate: string;
  expectedEndDate: string;
  status: 'active' | 'completed' | 'paused';
  phases: TrainingPhase[];
  weeklySchedule: Record<string, WeeklySessionConfig>;
  preferredWorkoutDays?: number[];
  preferredWorkoutDuration?: number;
  consistencyScore: number;
  progressPercent: number;
  weeks?: ProgramWeek[];
  nutritionProfile?: NutritionProfile;
  readinessLogic?: ReadinessLogic;
  auditLog?: string[];
}

export interface NutritionProfile {
  trainingDay: NutritionTarget;
  restDay: NutritionTarget;
  activeRecoveryDay: NutritionTarget;
  bmr: number;
  tdee: number;
}

export interface NutritionTarget {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  note?: string;
}

export interface ReadinessLogic {
  tiers: Record<string, ReadinessTier>;
}

export interface ReadinessTier {
  name: string;
  intensityModifier: number;
  volumeModifier: number;
  conditioningModifier: number;
  rpeTarget: string;
  description: string;
}

export interface ProgramWeek {
  weekNumber: number;
  phaseName: string;
  sessions: ProgramSession[];
}

export interface ProgramSession {
  dayName: string;
  sessionFocus: string;
  sessionType: 'Strength' | 'Hypertrophy' | 'Conditioning' | 'Full Body';
  blocks: ProgramBlock[];
  shortVersion?: ProgramBlock[];
  bodyweightVersion?: ProgramBlock[];
  description?: string;
}

export interface ProgramBlock {
  type: 'strength' | 'superset' | 'circuit';
  circuitType?: 'AMRAP' | 'EMOM' | 'FT' | 'Chipper' | 'Tabata' | 'RFT' | 'Ladder' | 'Couplet' | 'Triplet';
  duration?: number; // minutes
  exercises: ProgramExercise[];
  instructions?: string;
}

export interface ProgramExercise {
  name: string;
  movementPattern?: string;
  primaryMuscleGroup?: string;
  secondaryMuscleGroups?: string[];
  sets: number;
  reps: string;
  tempo: string;
  rest: string;
  notes: string;
  type: 'Push' | 'Pull' | 'Legs' | 'Core' | 'Conditioning';
  weight?: string; // Suggested weight
}

export interface TrainingPhase {
  phaseName: string;
  weekStart: number;
  weekEnd: number;
  focus: string;
  volumeMultiplier: number;
  intensityTarget: number;
  keyPrinciple: string;
}

export interface WeeklySessionConfig {
  sessionFocus: string;
  targetMuscles: string[];
  sessionType: string;
  estimatedDuration: number;
}

export interface BodyMetric {
  id?: string;
  uid: string;
  date: string;
  weightKg: number;
  bodyFatPercent?: number;
  leanMassKg?: number;
  notes?: string;
  source: 'manual' | 'scale_sync' | 'estimated';
}

export interface Achievement {
  id?: string;
  achievementId: string;
  uid: string;
  name: string;
  description: string;
  earnedAt: string;
  value?: number;
  verified: boolean;
}

export type MovementPattern = 
  | 'Horizontal Push' 
  | 'Horizontal Pull' 
  | 'Vertical Push' 
  | 'Vertical Pull' 
  | 'Squat' 
  | 'Hinge' 
  | 'Lunge' 
  | 'Carry' 
  | 'Core' 
  | 'Rotation' 
  | 'Anti-Rotation' 
  | 'Locomotion' 
  | 'Plyometric' 
  | 'Mobility' 
  | 'Conditioning'
  | 'Other';

export type EquipmentType = 
  | 'Barbell' 
  | 'Dumbbell' 
  | 'Kettlebell' 
  | 'Bench'
  | 'Rack'
  | 'Pull-up Bar'
  | 'Bands'
  | 'Cable Machine' 
  | 'Machines' 
  | 'Cardio Machines' 
  | 'Medicine Ball'
  | 'Sled'
  | 'Bodyweight';

export type ExerciseCategory = 
  | 'Primary Lift' 
  | 'Secondary Lift' 
  | 'Accessory' 
  | 'Isolation' 
  | 'Core' 
  | 'Conditioning' 
  | 'Mobility' 
  | 'Activation';

export interface ExerciseLibraryEntry {
  id: string;
  name: string;
  description: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  movementPattern: MovementPattern;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  equipment: EquipmentType;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: ExerciseCategory;
  substitutionTiers: {
    tier1: string[];
    tier2: string[];
    tier3: string[];
  };
  instructions: string[];
  commonFormErrors?: string[];
}

export interface NutritionGuide {
  id: string;
  title: string;
  content: string;
  category: string;
  thumbnailUrl?: string;
}

export interface CoachConversation {
  id: string;
  uid: string;
  date: string;
  messages: CoachMessage[];
}

export interface CoachMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
  timestamp: string;
}
