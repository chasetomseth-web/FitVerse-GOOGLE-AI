import { callGemini } from "./gemini";
import {
  UserProfile,
  TrainingProgram,
  WorkoutSession,
  DailyLog,
  ProgramWeek
} from "../types";
import { db } from "../lib/db";
import { handleSupabaseError, OperationType, supabase } from "../lib/supabase";
import { subDays, format, startOfDay } from "date-fns";

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


export interface AdaptationResult {
  week: number;
  adjustments_summary: {
    strength_progressions: string[];
    volume_changes: string[];
    exercise_swaps: string[];
    recovery_adjustments: string[];
  };
  updated_workouts: any[]; // This will be mapped back to ProgramSession[]
}

/**
 * Adaptation Service
 * Implements the Weekly Adaptation AI logic.
 */
export const adaptProgramForNextWeek = async (
  profile: UserProfile,
  program: TrainingProgram
): Promise<AdaptationResult | null> => {
  const model = "gemini-1.5-flash";

  try {
    // 1. Gather Data
    const last7Days = Array.from({ length: 7 }).map((_, i) =>
      format(subDays(new Date(), i), 'yyyy-MM-dd')
    );

    // Fetch last week's sessions
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', profile.uid)
      .gte('date', last7Days[6])
      .eq('status', 'completed')
      .order('date', { ascending: false });

    if (sessionsError) throw sessionsError;
    const lastWeekSessions = (sessionsData || []).map(d => ({ ...d }) as WorkoutSession);

    // Fetch last week's logs (for fatigue indicators)
    const { data: logsData, error: logsError } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', profile.uid)
      .gte('date', last7Days[6])
      .order('date', { ascending: false });

    if (logsError) throw logsError;
    const lastWeekLogs = (logsData || []).map(d => ({
      ...d,
      sleepHours: (d as any).sleep_hours,
      stressLevel: (d as any).stress_level,
      sorenessLevel: (d as any).soreness_level
    }) as DailyLog);

    // Get upcoming week's workouts
    const nextWeekNum = program.currentWeek + 1;
    const nextWeekData = program.weeks?.find(w => w.weekNumber === nextWeekNum);

    if (!nextWeekData) {
      console.warn("No upcoming week found to adapt.");
      return null;
    }

    // 2. Construct Prompt
    const prompt = `
MASTER SYSTEM PROMPT — ELITE PERFORMANCE COACH & NUTRITIONIST
You are a world-class performance coach, strength specialist, and nutritionist.
Your goal is to adjust the athlete's training program for the UPCOMING week based on their performance, adherence, and recovery data from the PREVIOUS week.

OBJECTIVE:
Generate an updated, adaptive workout plan for the upcoming week (${nextWeekNum}).

ATHLETE PROFILE:
- Goal: ${profile.primaryGoal}
- Experience: ${profile.fitnessLevel}
- Equipment: ${profile.availableEquipment?.join(', ') || 'Full Gym'}
- Current Week: ${program.currentWeek}

ADAPTATION LOGIC:
1. Performance Tracking:
   - If RPE was low (<= 7) on compound hits: Increase weight (+2.5-5%).
   - If RPE was high (>= 9.5) or reps missed: Maintain or slightly reduce weight/volume.
2. Adherence:
   - If workouts were missed: Reduce volume accumulation for next week; do not increase demand.
3. Fatigue Trend:
   - If sleep is low and stress is high: Prioritize recovery blocks; reduce conditioning density.
4. Movement Balance (CRITICAL):
   - Maintain a balance of Squat, Hinge, Push, Pull (Horizontal/Vertical), Unilateral, and Core.
   - Pull volume MUST be >= Push volume.

WORKOUT STRUCTURE:
EVERY workout MUST contain exactly THREE blocks: Warmup, Strength, Conditioning.
1. Warmup: 5-10 min.
2. Strength: 15-20 min.
3. Conditioning: 15-20 min.

EXERCISE SELECTION:
- ONLY use exercises from the APPROVED EXERCISE LIST.
- Use EXACT names. No "Arm Circles".

APPROVED EXERCISE LIST:
${EXERCISE_LIBRARY_LIST}

DATA FOR ANALYSIS:
Upcoming Week (${nextWeekNum}) Workouts:
${JSON.stringify(nextWeekData.sessions)}

Last Week's Performance:
${lastWeekSessions.map(s => `Session: ${s.sessionFocus} - Exercises: ${s.exercises.map(ex => `${ex.exerciseName} (RPE: ${ex.sets.map(se => se.rpe).join(',')})`)}`).join('\n')}

Last Week's Fatigue:
${lastWeekLogs.map(l => `Date: ${l.date}, Sleep: ${l.sleepHours}h, Stress: ${l.stressLevel}/5, Soreness: ${l.sorenessLevel}/5`).join('\n')}

OUTPUT FORMAT:
Return valid JSON. Each updated workout MUST follow the 3-block structure (Warmup, Strength, Conditioning).
`;

    // 3. Call Gemini
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          week: { type: "NUMBER" },
          adjustments_summary: {
            type: "OBJECT",
            properties: {
              strength_progressions: { type: "ARRAY", items: { type: "STRING" } },
              volume_changes: { type: "ARRAY", items: { type: "STRING" } },
              exercise_swaps: { type: "ARRAY", items: { type: "STRING" } },
              recovery_adjustments: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["strength_progressions", "volume_changes", "exercise_swaps", "recovery_adjustments"]
          },
          updated_workouts: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                dayName: { type: "STRING" },
                sessionFocus: { type: "STRING" },
                sessionType: { type: "STRING" },
                description: { type: "STRING" },
                blocks: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      type: { type: "STRING" },
                      instructions: { type: "STRING" },
                      exercises: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            name: { type: "STRING" },
                            movementPattern: { type: "STRING" },
                            primaryMuscleGroup: { type: "STRING" },
                            secondaryMuscleGroups: { type: "ARRAY", items: { type: "STRING" } },
                            sets: { type: "NUMBER" },
                            reps: { type: "STRING" },
                            tempo: { type: "STRING" },
                            rest: { type: "STRING" },
                            notes: { type: "STRING" },
                            type: { type: "STRING" },
                            weight: { type: "STRING" }
                          }
                        }
                      }
                    }
                  }
                },
                shortVersion: { type: "ARRAY", items: { type: "OBJECT" } },
                bodyweightVersion: { type: "ARRAY", items: { type: "OBJECT" } }
              },
              required: ["dayName", "sessionFocus", "sessionType", "blocks"]
            }
          }
        },
        required: ["week", "adjustments_summary", "updated_workouts"]
      }
    };

    const textResponse = await callGemini(prompt, config);
    const result = JSON.parse(textResponse) as AdaptationResult;

    const sanitizeExerciseName = (name: string): string => {
      const n = name.toLowerCase().trim();
      if (n === 'arm circles' || n.includes('arm circle')) {
        return 'Air Squat'; // Safe default from library
      }
      return name;
    };

    // Sanitize exercises in result
    result.updated_workouts = result.updated_workouts.map((session: any) => ({
      ...session,
      blocks: (session.blocks || []).map((block: any) => ({
        ...block,
        exercises: (block.exercises || []).map((ex: any) => ({
          ...ex,
          name: sanitizeExerciseName(ex.name)
        }))
      }))
    }));

    // 4. Update Program in Supabase
    const updatedWeeks = program.weeks?.map(w => {
      if (w.weekNumber === nextWeekNum) {
        return {
          ...w,
          sessions: result.updated_workouts
        };
      }
      return w;
    });

    const { error: updateError } = await supabase
      .from('training_programs')
      .update({ weeks: updatedWeeks })
      .eq('id', program.programId);

    if (updateError) throw updateError;

    // 5. Save Adaptation Summary for UI
    await db.createWeeklyAdaptation(profile.uid, {
      week: nextWeekNum,
      programId: program.programId,
      date: new Date().toISOString(),
      summary: result.adjustments_summary,
      status: 'applied'
    });

    return result;
  } catch (error) {
    console.error("Adaptation Error:", error);
    return null;
  }
};
