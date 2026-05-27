import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { DailyWorkoutState } from '../types';
import { format } from 'date-fns';

export const useDailyWorkout = (dateStr?: string) => {
  const { user } = useFirebase();
  const [workoutState, setWorkoutState] = useState<DailyWorkoutState | null>(null);
  const [loading, setLoading] = useState(true);

  const targetDate = dateStr || format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) {
      setWorkoutState(null);
      setLoading(false);
      return;
    }

    const stateRef = doc(db, 'users', user.uid, 'daily_workout_states', targetDate);
    
    const unsubscribe = onSnapshot(stateRef, (snap) => {
      if (snap.exists()) {
        setWorkoutState(snap.data() as DailyWorkoutState);
      } else {
        setWorkoutState(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/daily_workout_states/${targetDate}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, targetDate]);

  return { workoutState, loading };
};
