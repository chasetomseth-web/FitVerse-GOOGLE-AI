import { db } from '../firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, writeBatch, limit } from 'firebase/firestore';
import { ExerciseLibraryEntry, MovementPattern, EquipmentType, ExerciseCategory } from '../types';
import { callGemini } from './gemini';

export async function clearExerciseLibrary() {
  console.log('Clearing exercise library...');
  const q = query(collection(db, 'exercise_library'), limit(500));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log('Library cleared.');
}

async function enrichExercise(name: string, retryCount = 0): Promise<Partial<ExerciseLibraryEntry>> {
  if (!process.env.GEMINI_API_KEY) return {};

  try {
    const config = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          instructions: { type: "ARRAY", items: { type: "STRING" } },
          primaryMuscleGroup: { type: "STRING" },
          secondaryMuscleGroups: { type: "ARRAY", items: { type: "STRING" } },
          movementPattern: { type: "STRING" },
          equipment: { type: "STRING" },
          category: { type: "STRING" },
          difficulty: { type: "STRING" },
          substitutionTiers: {
            type: "OBJECT",
            properties: {
              tier1: { type: "ARRAY", items: { type: "STRING" } },
              tier2: { type: "ARRAY", items: { type: "STRING" } },
              tier3: { type: "ARRAY", items: { type: "STRING" } }
            },
            required: ["tier1", "tier2", "tier3"]
          },
          commonFormErrors: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["description", "instructions", "primaryMuscleGroup", "secondaryMuscleGroups", "movementPattern", "equipment", "category", "difficulty", "substitutionTiers", "commonFormErrors"]
      }
    };

    const textResponse = await callGemini(`Generate fitness metadata for the exercise: "${name}". 
      Provide:
      1. A concise description.
      2. 3-5 clear step-by-step instructions.
      3. Primary muscle group (e.g., Chest, Back, Quads, Hamstrings, Shoulders, Arms, Core).
      4. Secondary muscle groups.
      5. Movement Pattern (select from: Horizontal Push, Horizontal Pull, Vertical Push, Vertical Pull, Squat, Hinge, Lunge, Carry, Core, Rotation, Anti-Rotation, Locomotion, Plyometric, Mobility, Conditioning).
      6. Equipment Type (select from: Barbell, Dumbbell, Kettlebell, Cable, Machine, Band, Bodyweight, Cardio Machine, Medicine Ball, Sled).
      7. Exercise Category (select from: Primary Lift, Secondary Lift, Accessory, Isolation, Core, Conditioning, Mobility, Activation).
      8. Difficulty level (beginner, intermediate, advanced).
      9. Substitution Tiers:
         - Tier 1: Very close variations (e.g., DB Bench for BB Bench).
         - Tier 2: Similar movement pattern but different equipment or slightly different focus.
         - Tier 3: Regressions or simplified versions.
      10. 3-5 common form errors to avoid.`, config);

    return JSON.parse(textResponse);
  } catch (error: any) {
    // Handle rate limiting (429) with exponential backoff
    if (error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED') {
      if (retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 2000 + Math.random() * 1000;
        console.warn(`Rate limit hit for ${name}. Retrying in ${Math.round(delay)}ms... (Attempt ${retryCount + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return enrichExercise(name, retryCount + 1);
      }
    }
    
    console.error(`Error enriching ${name}:`, error);
    return {};
  }
}

const VIDEO_URLS = [
  "https://storage.googleapis.com/exercise-videos-fit/1 or 2 foot supported chin up isometric.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/1 or 2 foot supported pull up isometric isometric.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/2kb clean.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/2kb reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/2kb row to clean to front squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/2kb single leg rdl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/2kb sumo deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/3 direction box jumps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/3 hurdles 3 mt climbers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/3 point bridge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/Good mornings.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/ab wheel roll out.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/accordian situps.mov",
  "https://storage.googleapis.com/exercise-videos-fit/active push-pull straight leg raise.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/air squat - fast.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/air squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/alternating dumbbell curls.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/alternating dumbbell press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/alternating hand kettlebell swing.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/alternating kettlebell swing.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/alternating runners pose.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/american kb swing.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/arms straight overhead situp.mov",
  "https://storage.googleapis.com/exercise-videos-fit/arnold press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/b stance db rdl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/back rack reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/back squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/ball hamstring curl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/ball knee tucks.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/ball pass.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/ball pushup.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/ball slams.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/band assisted dips.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/band assisted pull up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/band lateral raises.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded bb dl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded bent over row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded bicycles.mov",
  "https://storage.googleapis.com/exercise-videos-fit/banded bilateral bent over row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded clamshell.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded double arm row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded glute bridge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded high low row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded monster walk.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded pull apart.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded pull through.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded side steps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/banded tricep extension.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell assisted pull up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell assisted push up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell bench press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell bent over row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell box squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell burpee deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell floor press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell hang power clean.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell hip thrusts.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell incline bench press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell power clean.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell pull up negatives.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell rdl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell rotations.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell seated ohp (z press).mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell skull-crusher.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell sumo deadlift high pull.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/barbell sumo deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bb glute bridge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bear crawl high hips.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bear crawl, low hips.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bench curtsy step overs.mov",
  "https://storage.googleapis.com/exercise-videos-fit/bench jump overs.mov",
  "https://storage.googleapis.com/exercise-videos-fit/bent over row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bicycle crunch - straight leg.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bicyclecrunch.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/birddog.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bodyweight dips.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bosu ball pop squats.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bosu ball side to side.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bottom squat hold.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bottoms up kb press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/box jump - step down.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/box jump single leg land.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/box squat jumps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/box squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/box toe taps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/boxer sit up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/broad jump consecutive.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/broad jump.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bulgarian split jumps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/bulgarian split squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/burpee box jump over.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/burpee hurdle jump overs.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/burpee.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/butterfly sit-ups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/cable chest fly.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/chin ups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/cossack squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/countermovement rotation sling toss.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/crab walk.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/cross legged modified ninja roll.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/curtsy lunges.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db american swing.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db curls to rotation.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db diagonal snatch.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db front squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db hammer curl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db isometric split squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db lateral raise.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db overhead tricep extension.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db power clean & push press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db reverse fly.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db single leg hip thrust.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db skullcrusher.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db swing.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/db thruster.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dbbentoverfly.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dead stop barbell row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/deadbug (with resistance).mp4",
  "https://storage.googleapis.com/exercise-videos-fit/deadbug.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/decline russian twist.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/decline sit-up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/defecit kettlebell rdl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/deficit jumping lunges.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/devils press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dips.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dive bomber.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/drop to plyo box jump.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell bench press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell bench suppored delt row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell bicep curl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell chest flys.mov",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell curl press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell floor press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell floor skull crusher.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell forward push back lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell front to lateral raise.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell hammer curl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell lunge to step with press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell overhead reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell power clean.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell push press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell rdl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell single arm row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell strict press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/dumbbell upright row to full circle.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/eccentric pullup.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/eccentric pushups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/elevated forward alternating lunges.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/elevated push-ups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/engine starter.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/ez bar curl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/face-forward sling toss.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/face-pulls.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/farmers carry double arm.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/farmers carry march in place.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/farmers carry walking lunges.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/farmers lunge to step.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/feet-knee together deep squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/figure 8 kb clean.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/floating conventional deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/floor press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/forward alternating push back lunges.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/forward deceleration lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/forward hurdle hops.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/forward lunge with rotation.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/forward push back lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/front foot elevated split squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/front rack reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/front squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/goblet bulgarian split squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/goblet get-up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/goblet pendulum lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/gobletsquat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/golblet deficit lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/gorilla kettlebell row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/half burpee.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/half knee palloff press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/half kneeling bottoms up kb press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/half kneeling dumbbell press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/half kneeling to single arm chest pass.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hand & knee supported chainsaw row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hand release push-ups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hands elevated push up to box jump.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hanging knee raise.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hanging leg raise.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/heavy wall ball for height.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/heel elevated db squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/heels elevated air squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/heels elevated front squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/heels elevated goblet squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hindu squats.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hip thrusters.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow arms down double leg lowers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow arms down single leg lowers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow arms up double leg lowers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow arms up single leg lowers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow flutter kicks.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow hang to superman.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow hang.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow high plank alternating knee to elbow.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow high plank alternating leg raise.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow hold - high plank.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow hold 1.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow hold 2.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow pushups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hollow to arch.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hurdle forward back hops.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hurdle lateral hops.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hurdle mini laterals.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/hurdle step overs.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/inchworm into worlds greatest stretch.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/incline chest supported db row (1).mp4",
  "https://storage.googleapis.com/exercise-videos-fit/incline db bench press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/inverted row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/isolation hold pull up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/jump rope.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/jump squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/jumping back squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/jumping ball slam.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/jumping lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/jumping pull-ups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb burpee deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb front rack squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb half turkish get up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb high pulls.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb romanian deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb sa clean & press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb single legrdl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb sl rdl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb swing singles.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb swinging high pull.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kb thruster.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kettlebell burpee deadlift.mov",
  "https://storage.googleapis.com/exercise-videos-fit/kettlebell deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kettlebell hang power snatch.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kettlebell hang snatch.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kettlebell lunge weave.mov",
  "https://storage.googleapis.com/exercise-videos-fit/kettlebell power snatch.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kick out kickups.mov",
  "https://storage.googleapis.com/exercise-videos-fit/kickback.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kipling toes to bar.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/knee to elbow plank.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kneeling arm sweep.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/kneeling chest opener.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/knees to elbows.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine alternating arm thruster.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine barbell rotations.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine bent over row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine front squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine hack squat.mov",
  "https://storage.googleapis.com/exercise-videos-fit/landmine incline chest press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine power clean and jerk.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine power clean.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine push press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine single arm row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine single leg rdl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine skater lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine strict press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/landmine thruster.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lat pulldown.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lateral bar burpees.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lateral jumping squats.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lateral leap.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lateral lunge into reach.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lateral lunge to curtsy lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lateral lunge with t-spine rotation.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lateral lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lateral push back lunges.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/leg curl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/leg extension.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/leg press calf raise.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/leg press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/loaded cossack squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/loaded squat jumps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/long sitting shoulder press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/low bar back squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/low plank banded row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/low to high band chops.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lunge + palloff press hold.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/lungester.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/machine chest fly.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/machine overhead press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/manmakers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball butterfly sit up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball front squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball hollow plank.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball plank knee to elbow.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball plank with alternating hip extension.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball push ups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball push-up with knee to elbow hold.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball single arm pass.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball slam into pass.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/med ball thruster.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/medball squat clean.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/medicine ball rolling push-up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/mountain climbers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/mountain sliders.mov",
  "https://storage.googleapis.com/exercise-videos-fit/nordic curls.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/overhead plate lunge to step.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/overhead plate reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/overhead squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/overhead trap bar reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/overhead walking plate lunges.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/pallof press - inside hand emphasis.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/pallof press - outside hand.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/pendulum lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plank flag pose.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plank kb lateral pulls.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plank knee to elbow.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plank, 3pt to 2pt.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plank, shoulder taps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plate front squat to rotating overhead press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plate ground to overhead.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plate hops.mov",
  "https://storage.googleapis.com/exercise-videos-fit/plate overhead carry.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plate pop squats.mov",
  "https://storage.googleapis.com/exercise-videos-fit/plate row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plate sit up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plate stack lateral shuffle.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plate stack fast step up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plate stationary side lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plate thruster.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/plyo push up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/power clean to push press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/power step up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/prone to squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/pull-ups neutral grip.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/punishers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/push press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/push up shoulder tap.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/push up to ankle tap.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/push up to renegade row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/quadruped kickbacks.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/rainbow slam 20.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/rainbow slam.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/raised quadruped hold.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/rear delt fly.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/recumbent bike.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/renegade row and press.mov",
  "https://storage.googleapis.com/exercise-videos-fit/renegade row and stand.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/renegade row with push-up and stand.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/renegade row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/reverse nordic curls.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/reverse plank.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/rope climbers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/row and reach in bridge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/russian twists.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/seated banded lat pull.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/seated curl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/seated knee extensions.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/seated reverse flys.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/shoulder punch outs.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/shuttle run.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/side kick through.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/side plank dips, forearm-hand.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/side plank.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/sidekick.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single arm chest press on box.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single arm db snatch.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single arm farmers carry.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single arm farmers march.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single arm floor press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single arm kettlebell reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single arm overhead reverse lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single arm row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single arm thrusters.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single leg box squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single leg forward hurdle hops.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single leg glute bridge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/single leg rdl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/sit up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/skater jumps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/ski erg.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/skier squat.mov",
  "https://storage.googleapis.com/exercise-videos-fit/skierg crossovers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/sl high box step ups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/slam ball alt side lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/slam ball axe chop.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/slam ball burpee.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/slam ball shoulder toss.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/slam ball situps.mov",
  "https://storage.googleapis.com/exercise-videos-fit/slider burpees.mov",
  "https://storage.googleapis.com/exercise-videos-fit/slider frogs inside to outside.mov",
  "https://storage.googleapis.com/exercise-videos-fit/slider frogs outside to inside.mov",
  "https://storage.googleapis.com/exercise-videos-fit/spiderman push up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/squat into thoracic rotation.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/squat rotations.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/squat weave.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/stairmaster.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/standing clamshell.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/starfish plank.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/stationary lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/step-up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/stepback lunge with rotation.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/strict press into push press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/strict press.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/sumo barbell deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/sumo deadlift high pull.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/sumo squat jumps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/supermans.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/supinated barbell row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/supine medball chest pass.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/supine straight leg hip lift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/swimmer back extensions.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/toes to bar.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trap bar deadlift.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trap bar farmers carry.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trap bar jumps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/treadmill jog.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/treadmill sprint.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/treadmill walk.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/triangle stance rotations.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/tricep bar pushdown.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/tricep kickbacks.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/tricep rope pushdown.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trx ab roll out.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trx assisted squat jump.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trx backstep lunge.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trx face-pull.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trx knee tuck.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trx overhead squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trx pendulum swings.mov",
  "https://storage.googleapis.com/exercise-videos-fit/trx pistol squats.mov",
  "https://storage.googleapis.com/exercise-videos-fit/trx row with squat.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/trx single arm squat, row, & rotation.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/tuck jumps.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/up down plank.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/upright row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/v up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/wall ball shots.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/wall crawl.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/wall sit bus drivers.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/wall sit.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/weighted accordian situp.mov",
  "https://storage.googleapis.com/exercise-videos-fit/weighted dips.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/weighted pull-ups.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/weighted step-up.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/wide seated cable row.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/wide stance air squat to calf raise.mp4",
  "https://storage.googleapis.com/exercise-videos-fit/z press.mp4"
];

function getMovementPattern(name: string): MovementPattern {
  const n = name.toLowerCase();
  
  if (n.includes('bench press') || n.includes('pushup') || n.includes('push up') || n.includes('floor press') || n.includes('chest press')) return 'Horizontal Push';
  if (n.includes('bent over row') || n.includes('seated row') || n.includes('one arm row') || n.includes('renegade row') || n.includes('inverted row') || n.includes('t-bar row')) return 'Horizontal Pull';
  if (n.includes('strict press') || n.includes('overhead press') || n.includes('ohp') || n.includes('z press') || n.includes('arnold press') || n.includes('shoulder press')) return 'Vertical Push';
  if (n.includes('pull up') || n.includes('chin up') || n.includes('lat pulldown')) return 'Vertical Pull';
  if (n.includes('squat') || n.includes('leg press') || n.includes('goblet')) return 'Squat';
  if (n.includes('deadlift') || n.includes('rdl') || n.includes('good morning') || n.includes('hinge')) return 'Hinge';
  if (n.includes('lunge') || n.includes('split squat') || n.includes('step up') || n.includes('pistol')) return 'Lunge';
  if (n.includes('carry') || n.includes('farmer')) return 'Carry';
  if (n.includes('plank') || n.includes('hollow') || n.includes('ab wheel') || n.includes('deadbug')) return 'Core';
  if (n.includes('woodchop') || n.includes('russian twist')) return 'Rotation';
  if (n.includes('pallof')) return 'Anti-Rotation';
  if (n.includes('run') || n.includes('jog') || n.includes('sprint') || n.includes('walk') || n.includes('shuttle')) return 'Locomotion';
  if (n.includes('jump') || n.includes('power clean') || n.includes('snatch') || n.includes('box jump') || n.includes('slam')) return 'Plyometric';
  if (n.includes('stretch') || n.includes('pose') || n.includes('opener') || n.includes('mobility')) return 'Mobility';
  
  return 'Conditioning';
}

function getMuscleGroups(name: string): { primary: string; secondary: string[]; isCompound: boolean } {
  const n = name.toLowerCase();
  const groups: Set<string> = new Set();
  let primary = 'Full Body';
  
  // Compound detection
  const isCompound = n.includes('squat') || n.includes('deadlift') || n.includes('bench press') || 
                     n.includes('overhead press') || n.includes('row') || n.includes('pull up') || 
                     n.includes('dip') || n.includes('lunge') || n.includes('clean') || n.includes('snatch');

  // Legs
  if (n.includes('squat') || n.includes('lunge') || n.includes('leg') || n.includes('deadlift') || 
      n.includes('rdl') || n.includes('calf') || n.includes('sumo') || n.includes('cossack') || 
      n.includes('nordic') || n.includes('step up') || n.includes('jump') || n.includes('box') || 
      n.includes('skater') || n.includes('curtsy') || n.includes('hamstring') || n.includes('quad') || 
      n.includes('glute') || n.includes('thrust') || n.includes('bridge') || n.includes('clamshell') || 
      n.includes('hinge') || n.includes('good morning')) {
    primary = 'Legs';
    groups.add('Legs');
  }
  
  // Chest
  if (n.includes('bench') || n.includes('chest') || n.includes('pushup') || n.includes('push up') || 
      n.includes('dips') || n.includes('fly') || n.includes('pec') || n.includes('floor press')) {
    primary = 'Chest';
    groups.add('Chest');
  }
  
  // Back
  if (n.includes('row') || n.includes('pull') || n.includes('chin') || n.includes('lat') || 
      n.includes('back') || n.includes('face-pull') || n.includes('shrug') || n.includes('superman') || 
      n.includes('bird dog') || n.includes('pull apart') || n.includes('inverted row')) {
    primary = 'Back';
    groups.add('Back');
  }
  
  // Shoulders
  if (n.includes('shoulder') || n.includes('lateral raise') || n.includes('arnold') || 
      n.includes('upright row') || n.includes('snatch') || n.includes('clean') || n.includes('jerk') || 
      n.includes('press') || n.includes('ohp') || n.includes('z press') || n.includes('face pull') || 
      n.includes('high pull') || n.includes('thruster') || n.includes('wall ball') || n.includes('slam ball') ||
      n.includes('delt') || n.includes('reverse fly')) {
    primary = 'Shoulders';
    groups.add('Shoulders');
  }
  
  // Arms
  if (n.includes('curl') || n.includes('tricep') || n.includes('skull') || n.includes('bicep') || 
      n.includes('hammer') || n.includes('kickback') || n.includes('preacher') || n.includes('concentration') || 
      n.includes('dip') || n.includes('pushup') || n.includes('chin') || n.includes('pull up')) {
    primary = 'Arms';
    groups.add('Arms');
  }
  
  // Core
  if (n.includes('situp') || n.includes('crunch') || n.includes('plank') || n.includes('hollow') || 
      n.includes('core') || n.includes('ab') || n.includes('leg raise') || n.includes('deadbug') || 
      n.includes('russian twist') || n.includes('birddog') || n.includes('v up') || n.includes('v-up') || 
      n.includes('toe touch') || n.includes('knee raise') || n.includes('flutter') || n.includes('scissor') || 
      n.includes('bicycle') || n.includes('woodchop') || n.includes('pallof') || n.includes('carry') || 
      n.includes('farmer') || n.includes('waiter') || n.includes('climber') || n.includes('toes to bar') ||
      n.includes('knees to elbows') || n.includes('starfish')) {
    primary = 'Core';
    groups.add('Core');
  }
  
  const allGroups = Array.from(groups);
  const secondary = allGroups.filter(g => g !== primary);
  
  return { primary, secondary, isCompound };
}

function getEquipment(name: string): EquipmentType {
  const n = name.toLowerCase();
  
  if (n.includes('db') || n.includes('dumbbell')) return 'Dumbbell';
  if (n.includes('bb') || n.includes('barbell')) return 'Barbell';
  if (n.includes('kb') || n.includes('kettlebell')) return 'Kettlebell';
  if (n.includes('band')) return 'Bands';
  if (n.includes('cable')) return 'Cable Machine';
  if (n.includes('machine') || n.includes('lat pulldown') || n.includes('leg press') || n.includes('leg extension') || n.includes('leg curl')) return 'Machines';
  if (n.includes('ball') || n.includes('med ball') || n.includes('slam ball') || n.includes('wall ball') || n.includes('stability ball') || n.includes('swiss ball') || n.includes('bosu')) return 'Medicine Ball';
  if (n.includes('treadmill') || n.includes('bike') || n.includes('ski erg') || n.includes('stairmaster') || n.includes('skierg')) return 'Cardio Machines';
  if (n.includes('sled')) return 'Sled';
  
  return 'Bodyweight';
}

function getCategory(name: string): ExerciseCategory {
  const n = name.toLowerCase();
  if (n.includes('back squat') || n.includes('deadlift') || n.includes('bench press') || n.includes('overhead press')) return 'Primary Lift';
  if (n.includes('jump') || n.includes('burpee') || n.includes('slam') || n.includes('shuttle') || 
      n.includes('sprint') || n.includes('jog') || n.includes('walk') || n.includes('bike') || 
      n.includes('ski') || n.includes('stairmaster') || n.includes('skierg') || n.includes('rope') || 
      n.includes('climber') || n.includes('skater') || n.includes('high knees') || n.includes('butt kicks') || 
      n.includes('jack') || n.includes('mountain climber')) return 'Conditioning';
  if (n.includes('stretch') || n.includes('pose') || n.includes('opener') || n.includes('rotation') || 
      n.includes('yoga') || n.includes('mobility') || n.includes('foam roll')) return 'Mobility';
  if (n.includes('situp') || n.includes('crunch') || n.includes('plank') || n.includes('hollow') || n.includes('core')) return 'Core';
  
  return 'Accessory';
}

export async function seedExerciseLibrary(onProgress?: (progress: number) => void, forceUpdate = false) {
  console.log('Starting exercise library seeding...');
  const libraryRef = collection(db, 'exercise_library');
  
  const BATCH_SIZE = 2; // Process in very small batches to avoid rate limits
  const DELAY_BETWEEN_BATCHES = 3000; // Increase delay between batches

  for (let i = 0; i < VIDEO_URLS.length; i += BATCH_SIZE) {
    const batch = VIDEO_URLS.slice(i, i + BATCH_SIZE);
    const currentProgress = Math.min(100, Math.round((i / VIDEO_URLS.length) * 100));
    if (onProgress) onProgress(currentProgress);
    
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(VIDEO_URLS.length / BATCH_SIZE)} (${currentProgress}%)`);

    const promises = batch.map(async (url) => {
      try {
        const filename = url.split('/').pop() || '';
        // Decode first to ensure we're starting from a clean filename
        const decodedFilename = decodeURIComponent(filename);
        // Clean filename: strip apostrophes and quotes as they are often removed or problematic in GCS
        const cleanedFilename = decodedFilename.replace(/'/g, '').replace(/"/g, '').replace(/’/g, '').replace(/”/g, '').replace(/“/g, '');
        
        const name = cleanedFilename.replace(/\.(mp4|mov)$/i, '').replace(/%20/g, ' ').trim();
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

        const docRef = doc(db, 'exercise_library', id);
        const existingDoc = await getDoc(docRef);
        
        if (existingDoc.exists() && !forceUpdate) {
          return;
        }

        let enrichedData: Partial<ExerciseLibraryEntry> = {};
        if (!existingDoc.exists() || forceUpdate) {
          enrichedData = await enrichExercise(name);
        } else {
          enrichedData = existingDoc.data() as Partial<ExerciseLibraryEntry>;
        }
        
        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
        // Encode and specifically handle characters that GCS might have issues with
        const encodedFilename = encodeURIComponent(cleanedFilename)
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29')
          .replace(/'/g, '%27')
          .replace(/\*/g, '%2A')
          .replace(/!/g, '%21');
        
        const finalUrl = baseUrl + encodedFilename;

        const muscleData = getMuscleGroups(name);
        const movementPattern = getMovementPattern(name);
        
        const entry: ExerciseLibraryEntry = {
          id,
          name: name.charAt(0).toUpperCase() + name.slice(1),
          description: enrichedData.description || `Instructional video for ${name}.`,
          videoUrl: finalUrl,
          movementPattern,
          primaryMuscleGroup: enrichedData.primaryMuscleGroup || muscleData.primary,
          secondaryMuscleGroups: enrichedData.secondaryMuscleGroups || muscleData.secondary,
          equipment: (enrichedData.equipment as any) || getEquipment(name),
          difficulty: (enrichedData.difficulty?.toLowerCase() as any) || 'intermediate',
          category: (enrichedData.category as any) || getCategory(name),
          substitutionTiers: enrichedData.substitutionTiers || {
            tier1: [],
            tier2: [],
            tier3: []
          },
          instructions: enrichedData.instructions || [
            'Watch the video carefully for proper form.',
            'Maintain a stable core throughout the movement.',
            'Control the tempo of both the concentric and eccentric phases.'
          ],
          commonFormErrors: enrichedData.commonFormErrors || [
            'Moving too fast through the exercise.',
            'Using momentum instead of muscle control.',
            'Holding your breath during the movement.'
          ]
        };

        await setDoc(docRef, entry);
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
      }
    });

    await Promise.all(promises);
    
    if (i + BATCH_SIZE < VIDEO_URLS.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  if (onProgress) onProgress(100);
  console.log('Seeding complete!');
}

function getSubstitutionTiers(name: string, pattern: MovementPattern, equipment: EquipmentType): { tier1: string[], tier2: string[], tier3: string[] } {
  const tiers = {
    tier1: [] as string[],
    tier2: [] as string[],
    tier3: [] as string[]
  };
  const n = name.toLowerCase();

  // Logic to find similar exercises with different equipment
  if (equipment === 'Barbell') {
    if (n.includes('bench press')) {
      tiers.tier1.push('Dumbbell Bench Press');
      tiers.tier2.push('Pushup');
      tiers.tier3.push('Floor Press');
    }
    if (n.includes('squat')) {
      tiers.tier1.push('Goblet Squat');
      tiers.tier2.push('Bodyweight Squat');
      tiers.tier3.push('Lunges');
    }
    if (n.includes('deadlift')) {
      tiers.tier1.push('Dumbbell RDL');
      tiers.tier2.push('Kettlebell Swing');
      tiers.tier3.push('Good Mornings');
    }
    if (n.includes('row')) {
      tiers.tier1.push('Dumbbell Row');
      tiers.tier2.push('Inverted Row');
      tiers.tier3.push('Band Row');
    }
    if (n.includes('overhead press')) {
      tiers.tier1.push('Dumbbell Shoulder Press');
      tiers.tier2.push('Pike Pushup');
      tiers.tier3.push('Band Overhead Press');
    }
  } else if (equipment === 'Dumbbell') {
    if (n.includes('bench press')) {
      tiers.tier1.push('Pushup');
      tiers.tier2.push('Floor Press');
    }
    if (n.includes('squat')) {
      tiers.tier1.push('Bodyweight Squat');
      tiers.tier2.push('Lunges');
    }
    if (n.includes('row')) {
      tiers.tier1.push('Inverted Row');
      tiers.tier2.push('Band Row');
    }
  }

  return tiers;
}

export async function refreshExerciseMetadata(onProgress?: (progress: number) => void) {
  console.log('Refreshing exercise metadata...');
  const libraryRef = collection(db, 'exercise_library');
  const snap = await getDocs(libraryRef);
  const total = snap.docs.length;
  
  for (let i = 0; i < total; i++) {
    const d = snap.docs[i];
    const data = d.data() as ExerciseLibraryEntry;
    const name = data.name;
    
    const muscleData = getMuscleGroups(name);
    const movementPattern = getMovementPattern(name);
    const updatedEquipment = getEquipment(name);
    const updatedCategory = getCategory(name);
    const substitutionTiers = getSubstitutionTiers(name, movementPattern, updatedEquipment);
    
    const currentUrl = data.videoUrl;
    let updatedUrl = currentUrl;
    
    if (currentUrl) {
      try {
        const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
        const filename = currentUrl.split('/').pop() || '';
        // Decode first to ensure we're starting from a clean filename
        const decodedFilename = decodeURIComponent(filename);
        // Clean filename: strip apostrophes and quotes as they are often removed in GCS
        const cleanedFilename = decodedFilename.replace(/'/g, '').replace(/"/g, '').replace(/’/g, '');
        // Encode and specifically handle characters that GCS might have issues with or that encodeURIComponent skips
        const encodedFilename = encodeURIComponent(cleanedFilename)
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29')
          .replace(/'/g, '%27')
          .replace(/\*/g, '%2A')
          .replace(/!/g, '%21');
        updatedUrl = baseUrl + encodedFilename;
      } catch (e) {
        console.error(`Failed to re-encode URL for ${name}:`, e);
      }
    }
    
    const updateData: any = {
      movementPattern,
      muscleGroups: [muscleData.primary, ...muscleData.secondary],
      primaryMuscleGroup: muscleData.primary,
      secondaryMuscleGroups: muscleData.secondary,
      isCompound: muscleData.isCompound,
      equipment: updatedEquipment,
      category: updatedCategory,
      substitutionTiers
    };

    if (updatedUrl !== undefined) {
      updateData.videoUrl = updatedUrl;
    }
    
    await setDoc(d.ref, updateData, { merge: true });
    
    if (onProgress) onProgress(Math.round(((i + 1) / total) * 100));
  }
  console.log('Metadata refresh complete!');
}
