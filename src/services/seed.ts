import { db } from '../lib/db';

const EXERCISES = [
  {
    id: 'barbell_bench_press',
    name: 'Barbell Bench Press',
    description: 'The standard chest builder.',
    primaryMuscleGroup: 'Chest',
    secondaryMuscleGroups: ['Shoulders', 'Arms'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    category: 'Strength',
    movementPattern: 'horizontal_push',
    instructions: [
      'Lie on your back on a flat bench.',
      'Grip the bar with hands slightly wider than shoulder-width.',
      'Lower the bar to your mid-chest.',
      'Push the bar back up until your arms are fully extended.'
    ]
  },
  {
    id: 'back_squat',
    name: 'Back Squat',
    description: 'The king of lower body exercises.',
    primaryMuscleGroup: 'Legs',
    secondaryMuscleGroups: ['Core'],
    equipment: 'Barbell',
    difficulty: 'advanced',
    category: 'Strength',
    movementPattern: 'squat',
    instructions: [
      'Rest the barbell on your upper back.',
      'Stand with feet shoulder-width apart.',
      'Lower your hips until they are below your knees.',
      'Drive back up to the starting position.'
    ]
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    description: 'Total body power movement.',
    primaryMuscleGroup: 'Back',
    secondaryMuscleGroups: ['Legs', 'Core'],
    equipment: 'Barbell',
    difficulty: 'advanced',
    category: 'Strength',
    movementPattern: 'hinge',
    instructions: [
      'Stand with feet mid-foot under the bar.',
      'Bend over and grab the bar with a shoulder-width grip.',
      'Lift the bar by standing up with it.',
      'Lower it back to the ground under control.'
    ]
  },
  {
    id: 'dumbbell_overhead_press',
    name: 'Dumbbell Overhead Press',
    description: 'Build strong, stable shoulders.',
    primaryMuscleGroup: 'Shoulders',
    secondaryMuscleGroups: ['Arms'],
    equipment: 'Dumbbell',
    difficulty: 'intermediate',
    category: 'Strength',
    movementPattern: 'vertical_push',
    instructions: [
      'Stand with feet shoulder-width apart.',
      'Hold dumbbells at shoulder height.',
      'Press the weights overhead until your arms are fully extended.',
      'Lower back to starting position.'
    ]
  },
  {
    id: 'barbell_row',
    name: 'Barbell Row',
    description: 'Build a strong back.',
    primaryMuscleGroup: 'Back',
    secondaryMuscleGroups: ['Arms'],
    equipment: 'Barbell',
    difficulty: 'intermediate',
    category: 'Strength',
    movementPattern: 'horizontal_pull',
    instructions: [
      'Bend over with your back flat.',
      'Grip the bar with hands slightly wider than shoulder-width.',
      'Pull the bar to your lower chest.',
      'Lower back to starting position.'
    ]
  }
];

export async function seedExercises() {
  console.log('Checking for existing exercises...');

  try {
    for (const exercise of EXERCISES) {
      const existing = await db.getExercise(exercise.id);

      if (!existing) {
        console.log(`Adding exercise: ${exercise.name}`);
        await db.createExercise(exercise);
      } else {
        console.log(`Exercise already exists: ${exercise.name}`);
      }
    }

    console.log('Exercise seeding complete!');
  } catch (error) {
    console.error('Error seeding exercises:', error);
    throw error;
  }
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;

  test('seedExercises seeds the database', async () => {
    await seedExercises();
    const exercise = await db.getExercise('barbell_bench_press');
    expect(exercise).toBeDefined();
  });
}
