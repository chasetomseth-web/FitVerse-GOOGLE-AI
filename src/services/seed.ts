import { db } from '../firebase';
import { collection, addDoc, getDocs, query, limit } from 'firebase/firestore';

const EXERCISES = [
  {
    name: 'Barbell Bench Press',
    description: 'The standard chest builder.',
    muscleGroups: ['Chest', 'Shoulders', 'Arms'],
    equipment: ['Barbell', 'Bench'],
    difficulty: 'intermediate',
    category: 'Strength',
    instructions: [
      'Lie on your back on a flat bench.',
      'Grip the bar with hands slightly wider than shoulder-width.',
      'Lower the bar to your mid-chest.',
      'Push the bar back up until your arms are fully extended.'
    ]
  },
  {
    name: 'Back Squat',
    description: 'The king of lower body exercises.',
    muscleGroups: ['Legs', 'Core'],
    equipment: ['Barbell', 'Rack'],
    difficulty: 'advanced',
    category: 'Strength',
    instructions: [
      'Rest the barbell on your upper back.',
      'Stand with feet shoulder-width apart.',
      'Lower your hips until they are below your knees.',
      'Drive back up to the starting position.'
    ]
  },
  {
    name: 'Deadlift',
    description: 'Total body power movement.',
    muscleGroups: ['Back', 'Legs', 'Core'],
    equipment: ['Barbell'],
    difficulty: 'advanced',
    category: 'Strength',
    instructions: [
      'Stand with feet mid-foot under the bar.',
      'Bend over and grab the bar with a shoulder-width grip.',
      'Lift the bar by standing up with it.',
      'Lower it back to the ground under control.'
    ]
  },
  {
    name: 'Dumbbell Overhead Press',
    description: 'Build strong, stable shoulders.',
    muscleGroups: ['Shoulders', 'Arms'],
    equipment: ['Dumbbells'],
    difficulty: 'intermediate',
    category: 'Strength',
    instructions: [
      'Hold dumbbells at shoulder height.',
      'Press the weights overhead until arms are straight.',
      'Lower back to shoulder height.',
      'Maintain a neutral spine throughout.'
    ]
  }
];

export const seedDatabase = async () => {
  const exSnap = await getDocs(query(collection(db, 'exercise_library'), limit(1)));
  if (exSnap.empty) {
    for (const ex of EXERCISES) {
      await addDoc(collection(db, 'exercise_library'), ex);
    }
    console.log('Database seeded with exercises.');
  }
};
