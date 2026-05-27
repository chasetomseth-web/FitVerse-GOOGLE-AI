import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useFirebase } from '../components/FirebaseProvider';
import { WorkoutSession } from '../types';

export const useWorkoutSession = (sessionId: string | undefined) => {
  const { user } = useFirebase();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || !user) {
      setSession(null);
      setLoading(false);
      return;
    }

    const sessionRef = doc(db, 'users', user.uid, 'workout_sessions', sessionId);
    const unsubscribe = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        setSession({ id: snap.id, ...snap.data() } as WorkoutSession);
      } else {
        setSession(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/workout_sessions/${sessionId}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [sessionId, user]);

  const updateSession = async (updates: Partial<WorkoutSession>) => {
    if (!sessionId || !user) return;
    try {
      // Filter out undefined values as Firestore updateDoc doesn't support them
      const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as any);

      if (Object.keys(cleanUpdates).length === 0) return;

      const sessionRef = doc(db, 'users', user.uid, 'workout_sessions', sessionId);
      await setDoc(sessionRef, cleanUpdates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/workout_sessions/${sessionId}`);
    }
  };

  return { session, loading, updateSession };
};
