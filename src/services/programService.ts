import { callGemini } from "./gemini";
import { UserProfile, TrainingProgram, ProgramWeek, ProgramSession, ProgramExercise, ProgramBlock } from "../types";

const EXERCISE_LIBRARY_LIST = `
1 or 2 foot supported chin up isometric,
1 or 2 foot supported pull up isometric,
2kb clean,
2kb reverse lunge,
2kb row to clean to front squat,
2kb single leg rdl,
2kb sumo deadlift,
3 direction box jumps,
3 hurdles 3 mt climbers,
3 point bridge,
Ab wheel roll out,
Accordion sit-ups,
Active push-pull straight leg raise,
Air squat - fast,
Air squat,
Alternating dumbbell curls,
Alternating dumbbell press,
Alternating hand kettlebell swing,
Alternating kettlebell swing,
Alternating runners pose,
American kb swing,
Arms straight overhead sit-up,
Arnold press,
B stance db rdl,
Back rack reverse lunge,
Back squat,
Ball hamstring curl,
Ball knee tucks,
Ball pass,
Ball push-up,
Ball slams,
Band assist pull up,
Band assisted dips,
Band assisted pull up,
Band lateral raises,
Banded bb dl,
Banded bent over row,
Banded bicycles,
Banded bilateral bent over row,
Banded clamshell,
Banded double arm row,
Banded glute bridge,
Banded high low row,
Banded monster walk,
Banded pull apart,
Banded pull through,
Banded reverse lunge,
Banded side steps,
Banded tricep extension,
Barbell assisted pull up,
Barbell assisted push up,
Barbell bench press,
Barbell bent over row,
Barbell box squat,
Barbell burpee deadlift,
Barbell deadlift,
Barbell floor press,
Barbell hang power clean,
Barbell hip thrusts,
Barbell incline bench press,
Barbell power clean,
Barbell pull up negatives,
Barbell rdl,
Barbell rotations,
Barbell seated ohp (z press),
Barbell skull-crusher,
Barbell sumo deadlift high pull,
Barbell sumo deadlift,
BB glute bridge,
Bear crawl high hips,
Bear crawl low hips,
Bench curtsy step overs,
Bench jump overs,
Bent over row,
Bicycle crunch - straight leg,
Bicycle crunch,
Birddog,
Bodyweight dips,
Bosu ball pop squats,
Bosu ball side to side,
Bottom squat hold,
Bottoms up kb press,
Box jump - step down,
Box jump single leg land,
Box squat jumps,
Box squat,
Box toe taps,
Boxer sit up,
Broad jump consecutive,
Broad jump,
Bulgarian split jumps,
Bulgarian split squat,
Burpee box jump over,
Burpee hurdle jump overs,
Burpee,
Butterfly sit-ups,
Cable chest fly,
Chin ups,
Cossack squat,
Countermovement rotation sling toss,
Crab walk,
Cross legged modified ninja roll,
Curtsy lunges,
DB american swing,
DB curls to rotation,
DB diagonal snatch,
DB front squat,
DB hammer curl,
DB isometric split squat,
DB lateral raise,
DB overhead tricep extension,
DB power clean & push press,
DB reverse fly,
DB single leg hip thrust,
DB skullcrusher,
DB swing,
DB thruster,
DB bent over fly,
Dead stop barbell row,
Deadbug (with resistance),
Deadbug,
Decline russian twist,
Decline sit-up,
Deficit kettlebell rdl,
Deficit jumping lunges,
Devils press,
Dips,
Dive bomber,
Drop to plyo box jump,
Dumbbell bench press,
Dumbbell bench supported delt row,
Dumbbell bicep curl,
Dumbbell chest flys,
Dumbbell curl press,
Dumbbell floor press,
Dumbbell floor skull crusher,
Dumbbell forward push back lunge,
Dumbbell front to lateral raise,
Dumbbell hammer curl,
Dumbbell lunge to step with press,
Dumbbell overhead reverse lunge,
Dumbbell power clean,
Dumbbell push press,
Dumbbell rdl,
Dumbbell single arm row,
Dumbbell strict press,
Dumbbell upright row to full circle,
Eccentric pull-up,
Eccentric push-ups,
Elevated forward alternating lunges,
Elevated push-ups,
Engine starter,
EZ bar curl,
Face-forward sling toss,
Face-pulls,
Farmers carry double arm,
Farmers carry march in place,
Farmers carry walking lunges,
Farmers lunge to step,
Farmer's carry walking lunge,
Feet-knee together deep squat,
Figure 8 kb clean,
Floating conventional deadlift,
Floor press,
Forward alternating push back lunges,
Forward deceleration lunge,
Forward hurdle hops,
Forward lunge with rotation,
Forward push back lunge,
Front foot elevated split squat,
Front rack reverse lunge,
Front squat,
Goblet bulgarian split squat,
Goblet get-up,
Goblet pendulum lunge,
Goblet squat,
Goblet deficit lunge,
Good mornings,
Gorilla kettlebell row,
Half burpee,
Half knee palloff press,
Half kneeling bottoms up kb press,
Half kneeling dumbbell press,
Half kneeling to single arm chest pass,
Hand & knee supported chainsaw row,
Hand release push-ups,
Hands elevated push up to box jump,
Hanging knee raise,
Hanging leg raise,
Heavy wall ball for height,
Heel elevated db squat,
Heels elevated air squat,
Heels elevated front squat,
Heels elevated goblet squat,
Hindu squats,
Hip thrusters,
Hollow arms down double leg lowers,
Hollow arms down single leg lowers,
Hollow arms up double leg lowers,
Hollow arms up single leg lowers,
Hollow flutter kicks,
Hollow hang to superman,
Hollow hang,
Hollow high plank alternating knee to elbow,
Hollow high plank alternating leg raise,
Hollow hold - high plank,
Hollow hold 1,
Hollow hold 2,
Hollow push-ups,
Hollow to arch,
Hurdle forward back hops,
Hurdle lateral hops,
Hurdle mini laterals,
Hurdle step overs,
Inchworm into world's greatest stretch,
Incline chest supported db row,
Incline db bench press,
Inverted row,
Isolation hold pull up,
Jump rope,
Jump squat,
Jumping back squat,
Jumping ball slam,
Jumping lunge,
Jumping pull-ups,
KB burpee deadlift,
KB front rack squat,
KB half turkish get up,
KB high pulls,
KB romanian deadlift,
KB sa clean & press,
KB single leg rdl,
KB sl rdl,
KB swing singles,
KB swinging high pull,
KB thruster,
Kettlebell burpee deadlift,
Kettlebell deadlift,
Kettlebell hang power snatch,
Kettlebell hang snatch,
Kettlebell lunge weave,
Kettlebell power snatch,
Kick out kickups,
Kickback,
Kipping toes to bar,
Knee to elbow plank,
Kneeling arm sweep,
Kneeling chest opener,
Knees to elbows,
Landmine alternating arm thruster,
Landmine barbell rotations,
Landmine bent over row,
Landmine front squat,
Landmine hack squat,
Landmine incline chest press,
Landmine power clean and jerk,
Landmine power clean,
Landmine push press,
Landmine single arm row,
Landmine single leg rdl,
Landmine skater lunge,
Landmine strict press,
Landmine thruster,
Lat pulldown,
Lateral bar burpees,
Lateral jumping squats,
Lateral leap,
Lateral lunge into reach,
Lateral lunge to curtsy lunge,
Lateral lunge with t-spine rotation,
Lateral lunge,
Lateral push back lunge,
Lateral push back lunges,
Leg curl,
Leg extension,
Leg press calf raise,
Leg press,
Loaded cossack squat,
Loaded squat jumps,
Long sitting shoulder press,
Low bar back squat,
Low plank banded row,
Low to high band chops,
Lunge + palloff press hold,
Lungester,
Machine chest fly,
Machine overhead press,
Manmakers,
Med ball butterfly sit up,
Med ball front squat,
Med ball hollow plank,
Med ball plank knee to elbow,
Med ball plank with alternating hip extension,
Med ball push ups,
Med ball push-up with knee to elbow hold,
Med ball single arm pass,
Med ball slam into pass,
Med ball thruster,
Medball squat clean,
Medicine ball rolling push-up,
Mountain climbers,
Mountain sliders,
Nordic curls,
Overhead plate lunge to step,
Overhead plate reverse lunge,
Overhead plate walking lunge,
Overhead squat,
Overhead trap bar reverse lunge,
Overhead walking plate lunges,
Overhead walking plates lunge,
Pallof press - inside hand emphasis,
Pallof press - outside hand,
Pendulum lunge,
Plank flag pose,
Plank kb lateral pulls,
Plank knee to elbow,
Plank 3pt to 2pt,
Plank shoulder taps,
Plate front squat to rotating overhead press,
Plate ground to overhead,
Plate hops,
Plate overhead carry,
Plate pop squats,
Plate row,
Plate sit up,
Plate stack lateral shuffle,
Plate stack "fast" step up,
Plate stationary side lunge,
Plate thruster,
Plyo push up,
Power clean to push press,
Power step up,
Prone to squat,
Pull-ups neutral grip,
Punishers,
Push press,
Push up shoulder tap,
Push up to ankle tap,
Push up to renegade row,
Quadruped kickbacks,
Rainbow slam 20,
Rainbow slam,
Rainbowslam,
Raised quadruped hold,
Rear delt fly,
Recumbent bike,
Renegade row and press,
Renegade row and stand,
Renegade row with push-up and stand,
Renegade row,
Reverse lunge,
Reverse nordic curls,
Reverse plank,
Rope climbers,
Row and reach in bridge,
Row,
Russian twists,
Seated banded lat pull,
Seated curl,
Seated knee extensions,
Seated reverse flys,
Shoulder punch outs,
Shuttle run,
Side kick through,
Side plank dips forearm-hand,
Side plank,
Sidekick,
Single arm chest press on box,
Single arm db snatch,
Single arm farmers carry,
Single arm farmers march,
Single arm floor press,
Single arm kettlebell reverse lunge,
Single arm overhead reverse lunge,
Single arm row,
Single arm thrusters,
Single leg box squat,
Single leg forward hurdle hops,
Single leg glute bridge,
Single leg rdl,
Sit up,
Skater jumps,
Ski erg,
Skier squat,
Skierg crossovers,
SL high box step ups,
Slam ball alt side lunge,
Slam ball axe chop,
Slam ball burpee,
Slam ball shoulder toss,
Slam ball sit-ups,
Slider burpees,
Slider frogs inside to outside,
Slider frogs outside to inside,
Spiderman push up,
Squat into thoracic rotation,
Squat rotations,
Squat weave,
Stairmaster,
Standing clamshell,
Starfish plank,
Stationary lunge,
Step-up,
Stepback lunge with rotation,
Strict press into push press,
Strict press,
Sumo barbell deadlift,
Sumo deadlift high pull,
Sumo squat jumps,
Superman's,
Supinated barbell row,
Supine medball chest pass,
Supine straight leg hip lift,
Swimmer back extensions,
Toes to bar,
Trap bar deadlift,
Trap bar farmers carry,
Trap bar jumps,
Treadmill jog,
Treadmill sprint,
Treadmill walk,
Triangle stance rotations,
Tricep bar pushdown,
Tricep kickbacks,
Tricep rope pushdown,
TRX ab roll out,
TRX assisted squat jump,
TRX backstep lunge,
TRX face-pull,
TRX knee tuck,
TRX overhead squat,
TRX pendulum swings,
TRX pistol squats,
TRX row with squat,
TRX single arm squat, row, & rotation,
Tuck jumps,
Up down plank,
Upright row,
V up,
Wall ball shots,
Wall crawl,
Wall sit bus drivers,
Wall sit,
Weighted accordion sit-up,
Weighted dips,
Weighted pull-ups,
Weighted step-up,
Wide seated cable row,
Wide stance air squat to calf raise,
Z press
`;

export async function generate12WeekProgram(user: UserProfile): Promise<TrainingProgram> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const prompt = `
MASTER SYSTEM PROMPT — PERFORMANCE & NUTRITION COACH
You are a master performance coach, strength coach, sports scientist, and nutritionist that generates fully adaptive training and nutrition programs for users.

OBJECTIVE:
Generate a comprehensive 12-week training program and baseline nutrition profile for the following athlete.

ATHLETE PROFILE:
- Name: ${user.name}
- Sex: ${user.gender}
- Age: ${user.age}
- Height: ${user.heightCm} cm
- Weight: ${user.weightKg} kg
- Primary Goal: ${user.primaryGoal.replace('_', ' ')}
- Training Frequency: ${user.preferredWorkoutDays.length} days/week
- Session Duration: ${user.preferredWorkoutDuration} min
- Experience Level: ${user.fitnessLevel}
- Preferred Training Days: ${user.preferredWorkoutDays.join(', ')}
- Available Equipment: ${user.availableEquipment.join(', ')}
- Physical Limitations: ${user.limitations || 'None'}
- Strength Baselines: ${JSON.stringify(user.strengthBaselines || {})}

CORE PRINCIPLES:
1. Training Schedule:
   - You MUST generate a workout for EVERY day specified in the "Preferred Training Days" list.
   - If the user specifies 7 days, you MUST provide 7 workouts per week. 
   - NEVER default to Sunday (or any other day) as a rest day if it is in the "Preferred Training Days" list.
   - Every week in the 12-week plan MUST have exactly the same number of sessions as the Training Frequency.

2. Training Goals:
   - Weight Loss: Prioritize caloric expenditure, metabolic conditioning, and training density.
   - Muscle Gain: Prioritize hypertrophy volume, progressive overload, and compound lifts.
   - Sports Performance: Prioritize strength, power, speed, and athletic conditioning.

3. Workout Structure:
   - EVERY workout MUST contain exactly THREE blocks: Warmup, Strength, Conditioning. No more, no less.
   - Warmup: 5-10 min, focused on joint prep and movement activation.
   - Strength: 15-20 min, focused on compound lifts and progressive overload.
   - Conditioning: 15-20 min, goal-specific protocols (AMRAP, EMOM, Tabata, HIIT, etc.).

4. Adaptive Engine:
   - Calculate readiness tiers (Peak, Normal, Low, Fatigued, Recovery) and provide modifiers for intensity, volume, and conditioning.

5. Nutrition Engine:
   - Basal Metabolic Rate (BMR): Calculate using Mifflin-St Jeor equation.
   - Total Daily Energy Expenditure (TDEE): Calculate based on BMR and estimated activity/training.
   - Goal-Based Calories: 
     * Weight Loss: TDEE - deficit (500-700 kcal).
     * Muscle Gain: TDEE + surplus (200-500 kcal).
     * Sports Performance: Maintenance to slight surplus.
   - Macro Ratios:
     * Protein: 1.6 - 2.4 g/kg bodyweight.
     * Fat: 20-30% of total calories.
     * Carbs: Remaining calories.

EXERCISE SELECTION:
- ONLY use exercises from the provided APPROVED EXERCISE LIST.
- Use EXACT names from the list. If an exercise isn't in the list, find the closest substitute.
- Do NOT use "Arm Circles" (not in library).

APPROVED EXERCISE LIST:
${EXERCISE_LIBRARY_LIST}

OUTPUT FORMAT:
Return ONLY valid JSON in the following schema:
{
  "audit_log": ["string explaining design choices"],
  "nutrition_profile": {
    "bmr": number,
    "tdee": number,
    "trainingDay": { "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "note": "string" },
    "restDay": { "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "note": "string" }
  },
  "readiness_logic": {
    "tiers": {
      "Peak": { "intensityModifier": 1.1, "volumeModifier": 1.1, "conditioningModifier": 1.2, "rpeTarget": "8.5-9.5", "description": "High performance day" },
      "Normal": { "intensityModifier": 1.0, "volumeModifier": 1.0, "conditioningModifier": 1.0, "rpeTarget": "7-8", "description": "Baseline training" },
      "Low": { "intensityModifier": 0.9, "volumeModifier": 0.8, "conditioningModifier": 0.7, "rpeTarget": "6-7", "description": "Accumulated fatigue" },
      "Fatigued": { "intensityModifier": 0.8, "volumeModifier": 0.6, "conditioningModifier": 0.5, "rpeTarget": "4-6", "description": "Structural recovery" },
      "Recovery": { "intensityModifier": 0.7, "volumeModifier": 0.5, "conditioningModifier": 0.3, "rpeTarget": "2-4", "description": "Active recovery/mobility" }
    }
  },
  "phases": [
    { "phaseName": "string", "weekStart": number, "weekEnd": number, "focus": "string", "volumeMultiplier": number, "intensityTarget": number, "keyPrinciple": "string" }
  ],
  "weeks": [
    {
      "week": number,
      "phase": "string",
      "days": [
        {
          "dayName": "string (Monday, Tuesday, etc.)",
          "focus": "string",
          "sessionType": "Strength | Hypertrophy | Conditioning | Full Body",
          "description": "Athlete's overview of today's session objective",
          "preview_blocks": [
            {
              "block_type": "Warmup | Strength | Conditioning",
              "format": "string (e.g. 5x5, AMRAP 10min)",
              "instructions": "Specific coaching briefing for this block",
              "duration_standard_minutes": number,
              "exercises": [
                {
                  "name": "string (EXACT library name)",
                  "sets": number,
                  "reps": "string",
                  "intensity_preview": "string (e.g. 70% 1RM or Bodyweight)",
                  "rest_seconds": number,
                  "coaching_cues": "string"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
`;

  const config = {
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
      responseSchema: {
        type: "OBJECT",
        properties: {
          audit_log: { type: "ARRAY", items: { type: "STRING" } },
          nutrition_profile: {
            type: "OBJECT",
            properties: {
              bmr: { type: "NUMBER" },
              tdee: { type: "NUMBER" },
              trainingDay: {
                type: "OBJECT",
                properties: {
                  calories: { type: "NUMBER" },
                  proteinG: { type: "NUMBER" },
                  carbsG: { type: "NUMBER" },
                  fatG: { type: "NUMBER" },
                  note: { type: "STRING" }
                }
              },
              restDay: {
                type: "OBJECT",
                properties: {
                  calories: { type: "NUMBER" },
                  proteinG: { type: "NUMBER" },
                  carbsG: { type: "NUMBER" },
                  fatG: { type: "NUMBER" },
                  note: { type: "STRING" }
                }
              }
            }
          },
          readiness_logic: {
            type: "OBJECT",
            properties: {
              tiers: {
                type: "OBJECT",
                properties: {
                  Peak: { type: "OBJECT", properties: { intensityModifier: { type: "NUMBER" }, volumeModifier: { type: "NUMBER" }, conditioningModifier: { type: "NUMBER" }, rpeTarget: { type: "STRING" }, description: { type: "STRING" } } },
                  Normal: { type: "OBJECT", properties: { intensityModifier: { type: "NUMBER" }, volumeModifier: { type: "NUMBER" }, conditioningModifier: { type: "NUMBER" }, rpeTarget: { type: "STRING" }, description: { type: "STRING" } } },
                  Low: { type: "OBJECT", properties: { intensityModifier: { type: "NUMBER" }, volumeModifier: { type: "NUMBER" }, conditioningModifier: { type: "NUMBER" }, rpeTarget: { type: "STRING" }, description: { type: "STRING" } } },
                  Fatigued: { type: "OBJECT", properties: { intensityModifier: { type: "NUMBER" }, volumeModifier: { type: "NUMBER" }, conditioningModifier: { type: "NUMBER" }, rpeTarget: { type: "STRING" }, description: { type: "STRING" } } },
                  Recovery: { type: "OBJECT", properties: { intensityModifier: { type: "NUMBER" }, volumeModifier: { type: "NUMBER" }, conditioningModifier: { type: "NUMBER" }, rpeTarget: { type: "STRING" }, description: { type: "STRING" } } }
                }
              }
            }
          },
          phases: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                phaseName: { type: "STRING" },
                weekStart: { type: "NUMBER" },
                weekEnd: { type: "NUMBER" },
                focus: { type: "STRING" },
                volumeMultiplier: { type: "NUMBER" },
                intensityTarget: { type: "NUMBER" },
                keyPrinciple: { type: "STRING" }
              }
            }
          },
          weeks: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                week: { type: "NUMBER" },
                phase: { type: "STRING" },
                days: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      day: { type: "NUMBER" },
                      dayName: { type: "STRING" },
                      focus: { type: "STRING" },
                      sessionType: { type: "STRING" },
                      description: { type: "STRING" },
                      preview_blocks: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            block_type: { type: "STRING" },
                            format: { type: "STRING" },
                            instructions: { type: "STRING" },
                            duration_standard_minutes: { type: "NUMBER" },
                            exercises: {
                              type: "ARRAY",
                              items: {
                                type: "OBJECT",
                                properties: {
                                  name: { type: "STRING" },
                                  sets: { type: "NUMBER" },
                                  reps: { type: "STRING" },
                                  intensity_preview: { type: "STRING" },
                                  rest_seconds: { type: "NUMBER" },
                                  coaching_cues: { type: "STRING" }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
  };

  const textResponse = await callGemini(prompt, config);
  const programData = JSON.parse(textResponse);

  const sanitizeExerciseName = (name: string): string => {
    const n = name.toLowerCase().trim();
    if (n === 'arm circles' || n.includes('arm circle')) {
      return 'Air Squat'; // Safe default from library
    }
    return name;
  };

  const mappedWeeks: ProgramWeek[] = programData.weeks.map((w: any) => ({
    weekNumber: w.week,
    phaseName: w.phase,
    sessions: w.days.map((d: any) => ({
      dayName: d.dayName,
      sessionFocus: d.focus,
      sessionType: d.sessionType as any,
      description: d.description,
      blocks: (d.preview_blocks || []).map((b: any) => ({
        type: b.block_type.toLowerCase().includes('strength') ? 'strength' : 
              b.block_type.toLowerCase().includes('superset') ? 'superset' : 'circuit',
        displayMode: b.block_type.toLowerCase().includes('strength') ? 'single' : 'grid',
        circuitType: b.format as any,
        duration: b.duration_standard_minutes,
        instructions: b.instructions,
        exercises: b.exercises.map((ex: any) => {
          const cleanName = sanitizeExerciseName(ex.name);
          return {
            name: cleanName,
            sets: ex.sets,
            reps: ex.reps,
            notes: ex.coaching_cues,
            weight: ex.intensity_preview,
            tempo: 'Standard',
            rest: `${ex.rest_seconds}s`,
            type: 'Push'
          };
        })
      }))
    }))
  }));

  const program: TrainingProgram = {
    programId: `prog_${Date.now()}`,
    uid: user.uid,
    programName: `${user.primaryGoal.replace('_', ' ').toUpperCase()} - 12 WEEK ELITE`,
    totalWeeks: 12,
    currentWeek: 1,
    startDate: new Date().toISOString(),
    expectedEndDate: new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    phases: programData.phases,
    weeks: mappedWeeks,
    weeklySchedule: {},
    consistencyScore: 0,
    progressPercent: 0,
    nutritionProfile: {
      ...programData.nutrition_profile,
      activeRecoveryDay: programData.nutrition_profile.restDay
    },
    readinessLogic: programData.readiness_logic,
    auditLog: programData.audit_log
  };

  return program;
}
