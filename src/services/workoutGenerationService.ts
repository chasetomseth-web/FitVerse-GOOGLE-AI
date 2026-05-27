import { callGemini } from "./gemini";
import { 
  UserProfile, 
  TrainingProgram, 
  WorkoutSession, 
  ExerciseLibraryEntry,
  WorkoutBlock,
  WorkoutExercise,
  WorkoutSet
} from '../types';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

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


export interface GenerationParams {
  profile: UserProfile;
  program: TrainingProgram;
  checkIn: {
    sleepHours: number;
    sleepQuality: number;
    muscleSoreness: number;
    energyLevel: number;
    stressLevel: number;
    weight: number;
  };
  history: {
    last7DaysReadiness: { date: string; score: number; tier: string }[];
    last7DaysWorkouts: { date: string; sessionType: string; completed: boolean }[];
    last7DaysPerformance: { date: string; exercise: string; weight: number; reps: number; rpe: number }[];
  };
  equipment: 'Full Gym' | 'Home Gym' | 'Minimal Equipment' | 'Bodyweight Only';
  time: '30 minutes' | '45 minutes' | '60 minutes' | 'Full Session';
  dayName: string;
}

export async function generateWorkout(params: GenerationParams): Promise<WorkoutSession> {
  const { profile, program, checkIn, history, equipment, time, dayName } = params;

  const systemInstruction = `
MASTER SYSTEM PROMPT — ELITE PERFORMANCE COACH & NUTRITIONIST
You are a world-class performance coach, strength specialist, and nutritionist. 
Your goal is to provide finalized, adaptive training and nutrition for TODAY based on the athlete's current readiness, program phase, and goals.

OBJECTIVE:
Generate a finalized, adaptive workout JSON for TODAY.

ATHLETE CONTEXT:
- Name: ${profile.name}
- Goal: ${profile.primaryGoal}
- Experience: ${profile.fitnessLevel}
- Equipment: ${equipment}
- Time Commitment: ${time}
- Program Week: ${program.currentWeek}
- Program Phase: ${program.phases.find(p => program.currentWeek >= p.weekStart && program.currentWeek <= p.weekEnd)?.phaseName || 'Foundation'}

READINESS INPUTS:
- Sleep Quality: ${checkIn.sleepQuality}/5 (${checkIn.sleepHours}h)
- Muscle Soreness: ${checkIn.muscleSoreness}/5
- Energy Level: ${checkIn.energyLevel}/5
- Stress Level: ${checkIn.stressLevel}/5
- Readiness Score: to be calculated (0-100)

ADAPTATION LOGIC:
- Tier Peak (85-100): Optimal performance. Increase load (+5%) or volume. Full conditioning.
- Tier Normal (70-84): Steady state. Follow programmed load/volume.
- Tier Low (50-69): Minor fatigue. Reduce load (-10%) or volume (-1 set).
- Tier Fatigued (30-49): Moderate fatigue. Reduce load (-20%), half volume, low conditioning.
- Tier Recovery (<30): High fatigue. Mobility, light stretching, or rest only.

WORKOUT STRUCTURE:
EVERY workout MUST contain exactly THREE blocks: Warmup, Strength, Conditioning.
1. Warmup: 5-10 min, Bodyweight/Joint Prep. Clear instructions required.
2. Strength: 15-20 min, Compound focus. Clear instructions required.
3. Conditioning: 15-20 min, Goal-specific metabolic work. Clear instructions required.

EXERCISE SELECTION:
- ONLY use exercises from the APPROVED EXERCISE LIST.
- Use EXACT names. No "Arm Circles".

APPROVED EXERCISE LIST:
${EXERCISE_LIBRARY_LIST}

OUTPUT CONSTRAINTS:
- JSON ONLY.
- session_description: Clear overview, objective, and intensity briefing for the athlete.
- block_instructions: Detailed protocol (e.g., "Full recovery between sets" or "Continuous movement").
- coach_note: Professional, motivating feedback based on readiness.
`;

  const prompt = `
Generate the finalized workout for ${profile.name}.
Day: ${dayName}
Equipment: ${equipment}
Time: ${time}

SCHEDULED SESSION TEMPLATE:
${JSON.stringify(program.weeks?.find(w => w.weekNumber === program.currentWeek)?.sessions.find(s => s.dayName === dayName) || {})}

STRICT: RETURN JSON ONLY.
`;

  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    try {
      const config = {
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        responseSchema: {
          type: "OBJECT",
          properties: {
            readiness_score: { type: "NUMBER" },
            training_tier: { type: "STRING" },
            adjustments_applied: { type: "ARRAY", items: { type: "STRING" } },
            session_type: { type: "STRING" },
            finalized_duration_minutes: { type: "NUMBER" },
            session_description: { type: "STRING" },
            blocks: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  block_type: { type: "STRING" },
                  format: { type: "STRING" },
                  instructions: { type: "STRING" },
                  display_mode: { type: "STRING" },
                  duration_minutes: { type: "NUMBER" },
                  exercises: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        sets: { type: "NUMBER" },
                        reps: { type: "STRING" },
                        weight_lbs: { type: "NUMBER" },
                        rpe_target: { type: "NUMBER" },
                        rest_seconds: { type: "NUMBER" },
                        coaching_cues: { type: "STRING" }
                      }
                    }
                  }
                }
              }
            },
            coach_note: { type: "STRING" }
          },
          required: ["readiness_score", "training_tier", "session_type", "blocks"]
        }
      };

      const textResponse = await callGemini(prompt, config, systemInstruction);

      const data = JSON.parse(textResponse);

      const sanitizeExerciseName = (name: string): string => {
        const n = name.toLowerCase().trim();
        if (n === 'arm circles' || n.includes('arm circle')) {
          return 'Air Squat'; // Safe default from library
        }
        return name;
      };

      const session: WorkoutSession = {
        sessionId: `sess_${Date.now()}`,
        uid: profile.uid,
        date: new Date().toISOString().split('T')[0],
        programId: program.programId,
        programWeek: program.currentWeek,
        sessionFocus: data.session_type || 'General Training',
        plannedDuration: data.finalized_duration_minutes || 60,
        readinessAtSession: data.readiness_score || 70,
        adjustmentsMade: {
          volumeChange: 0, 
          intensityRPE: 0,
          restModifier: 1.0,
          reason: (data.adjustments_applied || []).join('. ')
        },
        blocks: (data.blocks || []).map((b: any) => ({
          type: b.block_type?.toLowerCase().includes('strength') ? 'strength' : 
                b.block_type?.toLowerCase().includes('superset') ? 'superset' : 'circuit',
          displayMode: b.display_mode as any,
          circuitType: b.format as any,
          duration: b.duration_minutes,
          instructions: b.instructions,
          exercises: (b.exercises || []).map((ex: any) => {
            const cleanName = sanitizeExerciseName(ex.name);
            return {
              exerciseId: cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
              exerciseName: cleanName,
              sets: Array(ex.sets || 0).fill(null).map(() => ({
                reps: parseInt(ex.reps) || 10,
                weight: ex.weight_lbs || 0,
                rpe: ex.rpe_target || 8,
                restSeconds: ex.rest_seconds || 60
              })),
              instructions: ex.coaching_cues
            };
          })
        })),
        exercises: (data.blocks || []).flatMap((b: any) => (b.exercises || []).map((ex: any) => {
          const cleanName = sanitizeExerciseName(ex.name);
          return {
            exerciseId: cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            exerciseName: cleanName,
            sets: Array(ex.sets || 0).fill(null).map(() => ({
              reps: parseInt(ex.reps) || 10,
              weight: ex.weight_lbs || 0,
              rpe: ex.rpe_target || 8,
              restSeconds: ex.rest_seconds || 60
            })),
            instructions: ex.coaching_cues
          };
        })),
        achievementsUnlocked: [],
        status: 'assigned',
        notes: data.coach_note,
        description: data.session_description
      };

      return session;
    } catch (error) {
      if (attempts < maxAttempts - 1) {
        attempts++;
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to generate workout");
}
