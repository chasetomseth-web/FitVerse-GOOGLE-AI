import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useSupabase } from '../components/SupabaseProvider';
import { useUserProfile } from '../hooks/useUserProfile';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, User, Target, Activity, Dumbbell, CircleCheck as CheckCircle2, Search, Plus, Minus, X, TrendingUp, Zap } from 'lucide-react';
import { UserProfile, TrainingProgram } from '../types';

import { generate12WeekProgram } from '../services/programService';
import { calculateDailyNutrition, calculateAdjustedNutrition } from '../services/nutritionEngine';

import { calculateAge } from '../lib/utils';

const STEPS = [
  { id: 1, title: 'Basic Profile', icon: User },
  { id: 2, title: 'Goals & Level', icon: Target },
  { id: 3, title: 'Gear & Health', icon: Activity },
  { id: 4, title: 'Baselines', icon: TrendingUp },
  { id: 5, title: 'Program Forge', icon: Dumbbell },
];

const GOAL_OPTIONS = [
  { id: 'weight_loss', name: 'Weight Loss', icon: Zap },
  { id: 'muscle_gain', name: 'Muscle Gain', icon: Dumbbell },
  { id: 'sports_performance', name: 'Sports Performance', icon: Target },
];

const INJURY_OPTIONS = [
  'Knee', 'Shoulder', 'Back', 'Hip', 'Ankle', 'Wrist', 'Elbow', 'Neck'
];

const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Kettlebell', 'Bench', 'Rack', 'Pull-up Bar', 'Bands', 'Cable Machine'
];

export const Onboarding: React.FC = () => {
  const { user } = useSupabase();
  const { profile, updateProfile } = useUserProfile();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'male' as 'male' | 'female',
    birthDay: '01',
    birthMonth: '01',
    birthYear: '2000',
    unitSystem: 'imperial' as 'imperial' | 'metric',
    heightFt: 5,
    heightIn: 9,
    heightCm: 175,
    weightLbs: 165,
    weightKg: 75,
    primaryGoal: 'muscle_gain' as any,
    selectedGoals: [] as string[],
    fitnessLevel: 'beginner' as any,
    trainingDaysPerWeek: 3,
    trainingEnvironment: 'full_gym' as any,
    availableEquipment: [] as string[],
    strengthBaselines: {
      bench: 3,
      squat: 0,
      deadlift: 0,
      ohp: 0,
      row: 0
    },
    injuryLog: [] as any[],
    medicalNotes: '',
    limitations: '',
    preferredWorkoutDuration: 45,
  });

  // Pre-fill from profile if available
  useEffect(() => {
    if (profile) {
      setFormData(prev => {
        const updates: any = {};
        
        if (profile.name && !prev.firstName && !prev.lastName) {
          const parts = profile.name.split(' ');
          if (parts.length >= 2) {
            updates.firstName = parts[0];
            updates.lastName = parts.slice(1).join(' ');
          } else if (parts.length === 1 && parts[0] !== 'Athlete') {
            updates.firstName = parts[0];
          }
        }

        if (profile.gender) updates.gender = profile.gender;
        if (profile.unitSystem) updates.unitSystem = profile.unitSystem;
        if (profile.heightCm) updates.heightCm = profile.heightCm;
        if (profile.weightKg) updates.weightKg = profile.weightKg;
        if (profile.primaryGoal) updates.primaryGoal = profile.primaryGoal;
        if (profile.selectedGoals) updates.selectedGoals = profile.selectedGoals;
        if (profile.fitnessLevel) updates.fitnessLevel = profile.fitnessLevel;
        if (profile.trainingEnvironment) updates.trainingEnvironment = profile.trainingEnvironment;
        if (profile.availableEquipment) updates.availableEquipment = profile.availableEquipment;
        if (profile.preferredWorkoutDuration) updates.preferredWorkoutDuration = profile.preferredWorkoutDuration;
        
        if (profile.birthDate) {
          const [y, m, d] = profile.birthDate.split('-');
          updates.birthYear = y;
          updates.birthMonth = m;
          updates.birthDay = d;
        }

        if (profile.strengthBaselines) {
          updates.strengthBaselines = {
            bench: profile.strengthBaselines.benchPress || 0,
            squat: profile.strengthBaselines.squat || 0,
            deadlift: profile.strengthBaselines.deadlift || 0,
            ohp: profile.strengthBaselines.overheadPress || 0,
            row: profile.strengthBaselines.barbellRow || 0
          };
        }

        return { ...prev, ...updates };
      });
    }
  }, [profile]);

  const birthDate = `${formData.birthYear}-${formData.birthMonth}-${formData.birthDay}`;

  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState('');
  const navigate = useNavigate();

  const handleNext = async () => {
    // Save current step's progress to profile so it's remembered if they refresh
    if (updateProfile) {
      const heightCm = formData.unitSystem === 'imperial' 
        ? Math.round((formData.heightFt * 30.48) + (formData.heightIn * 2.54))
        : Math.round(formData.heightCm);
      const weightKg = formData.unitSystem === 'imperial' 
        ? Math.round(formData.weightLbs * 0.453592)
        : Math.round(formData.weightKg);

      await updateProfile({
        name: `${formData.firstName} ${formData.lastName}`.trim() || profile?.name || 'Athlete',
        birthDate,
        unitSystem: formData.unitSystem,
        gender: formData.gender,
        heightCm,
        weightKg,
        fitnessLevel: formData.fitnessLevel,
        primaryGoal: formData.primaryGoal,
        selectedGoals: formData.selectedGoals,
        trainingEnvironment: formData.trainingEnvironment,
        availableEquipment: formData.availableEquipment,
        preferredWorkoutDuration: formData.preferredWorkoutDuration,
        strengthBaselines: {
          benchPress: formData.strengthBaselines.bench,
          squat: formData.strengthBaselines.squat,
          deadlift: formData.strengthBaselines.deadlift,
          overheadPress: formData.strengthBaselines.ohp,
          barbellRow: formData.strengthBaselines.row
        }
      });
    }

    if (step < 5) setStep(step + 1);
    if (step === 4) startGeneration();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      navigate('/');
    }
  };

  const startGeneration = async () => {
    setGenerating(true);
    const messages = [
      "Analyzing your profile...",
      "Selecting optimal exercises...",
      "Crafting your personalized plan...",
      "Calculating training volume...",
      "Finalizing your program..."
    ];

    // Ensure at least 2.5 seconds total
    const startTime = Date.now();

    for (let i = 0; i < messages.length; i++) {
      setGenMessage(messages[i]);
      await new Promise(r => setTimeout(r, 1000));
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < 2500) {
      await new Promise(r => setTimeout(r, 2500 - elapsed));
    }

    const heightCm = formData.unitSystem === 'imperial' 
      ? Math.round((formData.heightFt * 30.48) + (formData.heightIn * 2.54))
      : Math.round(formData.heightCm);
    
    const weightKg = formData.unitSystem === 'imperial'
      ? Math.round(formData.weightLbs * 0.453592)
      : Math.round(formData.weightKg);
    
    // preferredWorkoutDays based on trainingDaysPerWeek
    const daysMap: Record<number, number[]> = {
      1: [3],
      2: [2, 4],
      3: [1, 3, 5],
      4: [1, 2, 4, 5],
      5: [1, 2, 3, 5, 6],
      6: [1, 2, 3, 4, 5, 6],
      7: [1, 2, 3, 4, 5, 6, 7]
    };
    const preferredWorkoutDays = daysMap[formData.trainingDaysPerWeek] || [1, 3, 5];

    const finalProfile: Partial<UserProfile> = {
      uid: user!.uid,
      name: `${formData.firstName} ${formData.lastName}`.trim() || profile?.name || 'Athlete',
      email: user!.email || '',
      photoURL: user!.photoURL || profile?.photoURL || '',
      birthDate,
      age: calculateAge(birthDate),
      unitSystem: formData.unitSystem,
      gender: formData.gender,
      heightCm,
      weightKg,
      bodyweightGoalKg: weightKg, // Default
      fitnessLevel: formData.fitnessLevel,
      primaryGoal: formData.primaryGoal,
      selectedGoals: formData.selectedGoals,
      preferredWorkoutDays,
      preferredWorkoutDuration: formData.preferredWorkoutDuration,
      trainingEnvironment: formData.trainingEnvironment,
      availableEquipment: formData.availableEquipment,
      injuryLog: formData.injuryLog,
      medicalNotes: formData.medicalNotes,
      limitations: formData.limitations,
      onboardingComplete: true,
      lastActiveAt: new Date().toISOString(),
      createdAt: profile?.createdAt || new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      strengthBaselines: {
        benchPress: formData.strengthBaselines.bench,
        squat: formData.strengthBaselines.squat,
        deadlift: formData.strengthBaselines.deadlift,
        overheadPress: formData.strengthBaselines.ohp,
        row: formData.strengthBaselines.row
      },
      coachNotes: '',
      knownIntolerances: [],
      mealPreferences: []
    };

    // 1. Save Profile
    if (updateProfile) {
      await updateProfile(finalProfile);
    } else {
      // Convert to snake_case for Supabase
      const snakeCaseProfile: any = {
        id: user!.id,
        name: finalProfile.name,
        email: finalProfile.email,
        photo_url: finalProfile.photoURL,
        birth_date: finalProfile.birthDate,
        age: finalProfile.age,
        unit_system: finalProfile.unitSystem,
        gender: finalProfile.gender,
        height_cm: finalProfile.heightCm,
        weight_kg: finalProfile.weightKg,
        bodyweight_goal_kg: finalProfile.bodyweightGoalKg,
        fitness_level: finalProfile.fitnessLevel,
        primary_goal: finalProfile.primaryGoal,
        selected_goals: finalProfile.selectedGoals,
        preferred_workout_days: finalProfile.preferredWorkoutDays,
        preferred_workout_duration: finalProfile.preferredWorkoutDuration,
        training_environment: finalProfile.trainingEnvironment,
        available_equipment: finalProfile.availableEquipment,
        injury_log: finalProfile.injuryLog,
        medical_notes: finalProfile.medicalNotes,
        limitations: finalProfile.limitations,
        onboarding_complete: true,
        last_active_at: new Date().toISOString(),
        created_at: profile?.createdAt || new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        strength_baselines: {
          bench_press: finalProfile.strengthBaselines?.benchPress,
          squat: finalProfile.strengthBaselines?.squat,
          deadlift: finalProfile.strengthBaselines?.deadlift,
          overhead_press: finalProfile.strengthBaselines?.overheadPress,
          barbell_row: finalProfile.strengthBaselines?.row
        },
        coach_notes: '',
        known_intolerances: [],
        meal_preferences: []
      };
      await supabase.from('user_profiles').upsert(snakeCaseProfile);
    }

    // 2. Generate Program
    try {
      setGenMessage('Coach is forging your 12-week program...');
      const aiProgram = await generate12WeekProgram(finalProfile as UserProfile);
      // Convert to snake_case for Supabase
      const snakeCaseProgram: any = {
        id: aiProgram.programId,
        user_id: user!.id,
        program_name: aiProgram.programName,
        total_weeks: aiProgram.totalWeeks,
        current_week: aiProgram.currentWeek,
        start_date: aiProgram.startDate,
        expected_end_date: aiProgram.expectedEndDate,
        status: aiProgram.status,
        phases: aiProgram.phases,
        weeks: aiProgram.weeks,
        weekly_schedule: aiProgram.weeklySchedule,
        consistency_score: aiProgram.consistencyScore,
        progress_percent: aiProgram.progressPercent
      };
      await supabase.from('training_programs').upsert(snakeCaseProgram);
    } catch (error) {
      console.error('Error generating AI program:', error);
      // Fallback to a simpler program if AI fails
      setGenMessage('Finalizing your program...');
      const fallbackProgramId = `prog_${Date.now()}`;
      const todayName = format(new Date(), 'EEEE');
      const fallbackProgram: any = {
        id: fallbackProgramId,
        user_id: user!.id,
        program_name: `${formData.primaryGoal.replace('_', ' ').toUpperCase()} PHASE 1`,
        total_weeks: 12,
        current_week: 1,
        start_date: new Date().toISOString(),
        expected_end_date: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        phases: [{ phaseName: 'Foundation', weekStart: 1, weekEnd: 4, focus: 'Form', volumeMultiplier: 1, intensityTarget: 7, keyPrinciple: 'Overload' }],
        weeks: Array.from({ length: 12 }).map((_, i) => ({
          weekNumber: i + 1,
          phaseName: 'Foundation',
          sessions: [
            {
              dayName: 'Monday',
              sessionFocus: 'Full Body Strength',
              sessionType: 'Strength',
              blocks: [
                {
                  type: 'strength',
                  exercises: [{ name: 'Goblet Squat', sets: 3, reps: '10', tempo: '2-0-2', rest: '60s', notes: 'Focus on depth', type: 'Legs' }]
                }
              ]
            },
            {
              dayName: 'Wednesday',
              sessionFocus: 'Upper Body Push/Pull',
              sessionType: 'Strength',
              blocks: [
                {
                  type: 'strength',
                  exercises: [{ name: 'Dumbbell Bench Press', sets: 3, reps: '10', tempo: '2-0-2', rest: '60s', notes: 'Control the weight', type: 'Push' }]
                }
              ]
            },
            {
              dayName: 'Friday',
              sessionFocus: 'Lower Body & Core',
              sessionType: 'Strength',
              blocks: [
                {
                  type: 'strength',
                  exercises: [{ name: 'Kettlebell Deadlift', sets: 3, reps: '10', tempo: '2-0-2', rest: '60s', notes: 'Keep back flat', type: 'Legs' }]
                }
              ]
            }
          ]
        })),
        weekly_schedule: {},
        consistency_score: 0,
        progress_percent: 0
      };
      await supabase.from('training_programs').upsert(fallbackProgram);
    }

    // 3. Calculate Nutrition and save to today's daily log
    const baseNutrition = calculateDailyNutrition(finalProfile as UserProfile, formData.trainingDaysPerWeek, 0, 100);
    const adjustedNutrition = calculateAdjustedNutrition(baseNutrition, 100, formData.gender);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const dailyLog: any = {
      user_id: user!.id,
      date: todayStr,
      calorie_budget: adjustedNutrition.calories,
      protein_target_g: adjustedNutrition.proteinG,
      carb_target_g: adjustedNutrition.carbsG,
      fat_target_g: adjustedNutrition.fatG,
      calories_consumed: 0,
      protein_consumed_g: 0,
      carbs_consumed_g: 0,
      fat_consumed_g: 0,
      meal_log: [],
      water_glasses: 0,
      step_count: 0,
      active_calories_burned: 0,
      workout_completed: false
    };
    await supabase.from('daily_logs').upsert(dailyLog);

    setGenMessage('Success!');
    setTimeout(() => navigate('/'), 1000);
  };

  return (
    <div className="min-h-screen bg-brand-black flex flex-col p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBack} 
            className={`flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white hover:text-white rounded-xl transition-all border border-white/20 ${step === 5 ? 'opacity-0 pointer-events-none' : ''}`}
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
          </button>
          {profile?.photoURL && (
            <div className="w-10 h-10 rounded-xl bg-brand-pink/10 border border-brand-pink/20 flex items-center justify-center overflow-hidden">
              <img 
                src={profile.photoURL} 
                alt={profile.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {STEPS.map((s) => (
            <div 
              key={s.id} 
              className={`h-1 w-8 rounded-full transition-all duration-500 ${
                step >= s.id ? (step === s.id ? 'bg-brand-gold w-12' : 'bg-brand-pink') : 'bg-white/5'
              }`} 
            />
          ))}
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 max-w-md mx-auto w-full">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter leading-none">The Foundation</h2>
                <p className="text-[10px] text-white/80 font-black uppercase tracking-widest">Step 1: Profile & Physical Parameters</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-widest ml-2">First Name</span>
                    <input 
                      type="text"
                      placeholder="First"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm font-bold placeholder:text-white/20 focus:outline-none focus:border-brand-pink transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-widest ml-2">Last Name</span>
                    <input 
                      type="text"
                      placeholder="Last"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm font-bold placeholder:text-white/20 focus:outline-none focus:border-brand-pink transition-all"
                    />
                  </div>
                </div>

                <div className="flex bg-white/5 p-1 rounded-xl">
                  <button 
                    onClick={() => setFormData({ ...formData, unitSystem: 'imperial' })}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.unitSystem === 'imperial' ? 'bg-brand-pink text-white' : 'text-white/40'}`}
                  >
                    Imperial (Lbs/Ft)
                  </button>
                  <button 
                    onClick={() => setFormData({ ...formData, unitSystem: 'metric' })}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.unitSystem === 'metric' ? 'bg-brand-pink text-white' : 'text-white/40'}`}
                  >
                    Metric (Kg/Cm)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(['male', 'female'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setFormData({ ...formData, gender: g })}
                      className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                        formData.gender === g ? 'bg-brand-pink/10 border-brand-pink text-brand-pink' : 'bg-white/5 border-white/5 text-white/40'
                      }`}
                    >
                      <User className="w-6 h-6" />
                      <span className="text-[8px] font-black uppercase tracking-widest">{g}</span>
                    </button>
                  ))}
                </div>

                <div className="glass-card p-6 space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-widest ml-2">Birthdate</span>
                    <div className="flex gap-2">
                      <select 
                        value={formData.birthMonth} 
                        onChange={(e) => setFormData({ ...formData, birthMonth: e.target.value })}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2 text-white text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-brand-pink appearance-none"
                      >
                        {Array.from({ length: 12 }).map((_, i) => (
                          <option key={`month-${i}`} value={String(i + 1).padStart(2, '0')} className="bg-brand-black">
                            {format(new Date(2000, i, 1), 'MMMM')}
                          </option>
                        ))}
                      </select>
                      <select 
                        value={formData.birthDay} 
                        onChange={(e) => setFormData({ ...formData, birthDay: e.target.value })}
                        className="w-20 bg-white/5 border border-white/10 rounded-lg p-2 text-white text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-brand-pink appearance-none text-center"
                      >
                        {Array.from({ length: 31 }).map((_, i) => (
                          <option key={`day-${i}`} value={String(i + 1).padStart(2, '0')} className="bg-brand-black">
                            {i + 1}
                          </option>
                        ))}
                      </select>
                      <select 
                        value={formData.birthYear} 
                        onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                        className="w-24 bg-white/5 border border-white/10 rounded-lg p-2 text-white text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-brand-pink appearance-none text-center"
                      >
                        {Array.from({ length: 100 }).map((_, i) => {
                          const year = new Date().getFullYear() - i;
                          return (
                            <option key={`year-${year}`} value={String(year)} className="bg-brand-black">
                              {year}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="flex justify-end pr-2">
                      <span className="text-[10px] font-black text-brand-gold uppercase tracking-widest italic">
                        Calculated Age: {calculateAge(birthDate)} yrs
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">Height</span>
                    {formData.unitSystem === 'imperial' ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            value={formData.heightFt} 
                            onChange={(e) => setFormData({ ...formData, heightFt: parseInt(e.target.value) || 0 })}
                            className="w-12 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-white font-display font-black"
                          />
                          <span className="text-[8px] font-black text-white/70 uppercase tracking-widest">ft</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number" 
                            value={formData.heightIn} 
                            onChange={(e) => setFormData({ ...formData, heightIn: parseInt(e.target.value) || 0 })}
                            className="w-12 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-white font-display font-black"
                          />
                          <span className="text-[8px] font-black text-white/70 uppercase tracking-widest">in</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          value={formData.heightCm} 
                          onChange={(e) => setFormData({ ...formData, heightCm: parseInt(e.target.value) || 0 })}
                          className="w-20 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-white font-display font-black"
                        />
                        <span className="text-[8px] font-black text-white/70 uppercase tracking-widest">cm</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-white/70 uppercase tracking-widest">
                      Weight ({formData.unitSystem === 'imperial' ? 'lbs' : 'kg'})
                    </span>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => {
                          if (formData.unitSystem === 'imperial') {
                            setFormData({ ...formData, weightLbs: Math.max(50, formData.weightLbs - 1) });
                          } else {
                            setFormData({ ...formData, weightKg: Math.max(20, formData.weightKg - 1) });
                          }
                        }} 
                        className="p-2 bg-white/5 rounded-lg"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-2xl font-display font-black text-white">
                        {formData.unitSystem === 'imperial' ? formData.weightLbs : formData.weightKg}
                      </span>
                      <button 
                        onClick={() => {
                          if (formData.unitSystem === 'imperial') {
                            setFormData({ ...formData, weightLbs: formData.weightLbs + 1 });
                          } else {
                            setFormData({ ...formData, weightKg: formData.weightKg + 1 });
                          }
                        }} 
                        className="p-2 bg-white/5 rounded-lg"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Ambition</h2>
                <p className="text-[10px] text-white/80 font-black uppercase tracking-widest">Step 2: Goals & Experience</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-2">Primary Goal</label>
                  <div className="grid grid-cols-3 gap-2">
                    {GOAL_OPTIONS.map((g) => {
                      const Icon = (g as any).icon;
                      return (
                        <button
                          key={g.id}
                          onClick={() => {
                            const isSelected = formData.selectedGoals.includes(g.name);
                            setFormData({ 
                              ...formData, 
                              primaryGoal: g.id as any,
                              selectedGoals: isSelected 
                                ? formData.selectedGoals.filter(goal => goal !== g.name)
                                : [...formData.selectedGoals, g.name]
                            });
                          }}
                          className={`p-3 rounded-2xl border transition-all flex flex-col items-center justify-center text-center gap-2 h-24 ${
                            formData.primaryGoal === g.id ? 'bg-brand-pink/10 border-brand-pink text-brand-pink shadow-lg shadow-brand-pink/5' : 'bg-white/5 border-white/5 text-white/40'
                          }`}
                        >
                          <div className={`p-2 rounded-xl transition-colors ${formData.primaryGoal === g.id ? 'bg-brand-pink/20' : 'bg-white/5'}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="text-[8px] font-black uppercase tracking-tight leading-tight">{g.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-2">Training Days Per Week</label>
                  <div className="flex items-center justify-center gap-6 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <button onClick={() => setFormData({ ...formData, trainingDaysPerWeek: Math.max(1, formData.trainingDaysPerWeek - 1) })} className="p-2 bg-white/10 rounded-lg"><Minus className="w-4 h-4" /></button>
                    <span className="text-3xl font-display font-black text-white">{formData.trainingDaysPerWeek}</span>
                    <button onClick={() => setFormData({ ...formData, trainingDaysPerWeek: Math.min(7, formData.trainingDaysPerWeek + 1) })} className="p-2 bg-white/10 rounded-lg"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-2">Session Length (Minutes)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[30, 45, 60, 75].map((d) => (
                      <button
                        key={d}
                        onClick={() => setFormData({ ...formData, preferredWorkoutDuration: d })}
                        className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                          formData.preferredWorkoutDuration === d ? 'bg-brand-pink/10 border-brand-pink text-brand-pink' : 'bg-white/5 border-white/5 text-white/40'
                        }`}
                      >
                        <span className="text-sm font-display font-black">{d}</span>
                        <span className="text-[6px] font-black uppercase tracking-widest">Min</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-2">Experience Level</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['beginner', 'intermediate', 'advanced'].map((l) => (
                      <button
                        key={l}
                        onClick={() => setFormData({ ...formData, fitnessLevel: l as any })}
                        className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                          formData.fitnessLevel === l ? 'bg-brand-gold/10 border-brand-gold text-brand-gold' : 'bg-white/5 border-white/5 text-white/40'
                        }`}
                      >
                        <span className="text-[8px] font-black uppercase tracking-widest">{l}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter leading-none">The Arsenal</h2>
                <p className="text-[10px] text-white/80 font-black uppercase tracking-widest">Step 3: Environment & Health</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-2">Available Equipment</label>
                  <div className="grid grid-cols-2 gap-2">
                    {EQUIPMENT_OPTIONS.map((opt) => {
                      const isSelected = formData.availableEquipment.includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => {
                            if (isSelected) {
                              setFormData({ ...formData, availableEquipment: formData.availableEquipment.filter(e => e !== opt) });
                            } else {
                              setFormData({ ...formData, availableEquipment: [...formData.availableEquipment, opt] });
                            }
                          }}
                          className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                            isSelected ? 'bg-brand-pink/10 border-brand-pink text-brand-pink' : 'bg-white/5 border-white/5 text-white/40'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest">{opt}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white uppercase tracking-widest ml-2">Injuries / Limitations</label>
                  <div className="flex flex-wrap gap-2">
                    {INJURY_OPTIONS.map((inj) => {
                      const isActive = formData.injuryLog?.some(i => i.bodyPart === inj);
                      return (
                        <button
                          key={inj}
                          onClick={() => {
                            const current = formData.injuryLog || [];
                            if (isActive) {
                              setFormData({ ...formData, injuryLog: current.filter(i => i.bodyPart !== inj) });
                            } else {
                              setFormData({ ...formData, injuryLog: [...current, { bodyPart: inj, severity: 3, dateReported: new Date().toISOString(), status: 'active', description: '' }] });
                            }
                          }}
                          className={`px-4 py-2 rounded-full border text-[8px] font-black uppercase tracking-widest transition-all ${
                            isActive ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-white/5 border-white/5 text-white/40'
                          }`}
                        >
                          {inj}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-white/70 uppercase tracking-widest ml-2">Medical Notes & Limitations</label>
                  <div className="space-y-3">
                    <textarea 
                      placeholder="Any medical conditions or notes..."
                      value={formData.medicalNotes}
                      onChange={(e) => setFormData({ ...formData, medicalNotes: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs font-bold uppercase tracking-widest min-h-[80px]"
                    />
                    <textarea 
                      placeholder="Specific physical limitations..."
                      value={formData.limitations}
                      onChange={(e) => setFormData({ ...formData, limitations: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-xs font-bold uppercase tracking-widest min-h-[80px]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <h2 className="text-4xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Power Base</h2>
                <p className="text-[10px] text-white/80 font-black uppercase tracking-widest">Step 4: Strength Baselines (Optional)</p>
              </div>

              <div className="bg-brand-gold/10 border border-brand-gold/20 rounded-2xl p-4">
                <p className="text-[10px] text-brand-gold font-bold uppercase tracking-widest leading-relaxed">
                  It's ok if you don't know yet! We can test your strength baseline once we get your program going.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { id: 'bench', name: 'Bench Press' },
                  { id: 'squat', name: 'Squat' },
                  { id: 'deadlift', name: 'Deadlift' },
                  { id: 'ohp', name: 'Overhead Press' },
                  { id: 'row', name: 'Row' },
                ].map((lift) => (
                  <div key={lift.id} className="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{lift.name}</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setFormData({ 
                          ...formData, 
                          strengthBaselines: { 
                            ...formData.strengthBaselines, 
                            [lift.id]: Math.max(0, (formData.strengthBaselines as any)[lift.id] - 5) 
                          } 
                        })}
                        className="p-1.5 bg-white/10 rounded-lg"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <div className="flex items-center gap-1 min-w-[60px] justify-center">
                        <input 
                          type="number"
                          value={(formData.strengthBaselines as any)[lift.id]}
                          onChange={(e) => setFormData({
                            ...formData,
                            strengthBaselines: {
                              ...formData.strengthBaselines,
                              [lift.id]: parseInt(e.target.value) || 0
                            }
                          })}
                          className="w-12 bg-transparent text-center text-white font-display font-black text-xl focus:outline-none"
                        />
                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">
                          {formData.unitSystem === 'imperial' ? 'lbs' : 'kg'}
                        </span>
                      </div>
                      <button 
                        onClick={() => setFormData({ 
                          ...formData, 
                          strengthBaselines: { 
                            ...formData.strengthBaselines, 
                            [lift.id]: (formData.strengthBaselines as any)[lift.id] + 5 
                          } 
                        })}
                        className="p-1.5 bg-white/10 rounded-lg"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div 
              key="step5"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full space-y-8 py-12"
            >
              <div className="relative">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  className="w-32 h-32 rounded-full border-4 border-brand-pink/20 border-t-brand-pink border-r-brand-gold shadow-[0_0_40px_rgba(227,63,112,0.2)]"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Dumbbell className="w-10 h-10 text-white animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-2xl font-display font-black text-white uppercase italic tracking-tighter">Forging Your Path</h3>
                <p className="text-[10px] text-brand-gold font-bold uppercase tracking-widest animate-pulse">{genMessage}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {step < 5 && (
        <footer className="mt-auto pt-8">
          <button 
            onClick={handleNext}
            disabled={step === 1 && (!formData.firstName.trim() || !formData.lastName.trim())}
            className="w-full btn-primary flex items-center justify-center gap-2 py-5 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-xs font-black uppercase tracking-widest">
              {step === 4 ? 'Generate Program' : 'Continue'}
            </span>
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </footer>
      )}
    </div>
  );
};
