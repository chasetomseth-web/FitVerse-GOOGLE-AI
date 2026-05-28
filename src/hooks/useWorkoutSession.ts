import { useState, useEffect } from 'react';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { useSupabase } from '../components/SupabaseProvider';
import { WorkoutSession } from '../types';
import { toCamelCase } from '../lib/db';

export const useWorkoutSession = (sessionId: string | undefined) => {
  const { user } = useSupabase();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId || !user) {
      setSession(null);
      setLoading(false);
      return;
    }

    const fetchSession = async () => {
      try {
        const { data, error } = await supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('id', sessionId)
          .maybeSingle();

        if (error) throw error;
        setSession(data ? toCamelCase(data) as WorkoutSession : null);
      } catch (error) {
        handleSupabaseError(error, OperationType.GET, 'workout_sessions');
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    // For now, skip realtime subscriptions to avoid errors
    return () => {};
  }, [sessionId, user]);

  const updateSession = async (updates: Partial<WorkoutSession>) => {
    if (!sessionId || !user) return;
    try {
      const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          acc[snakeKey] = value;
        }
        return acc;
      }, {} as any);

      if (Object.keys(cleanUpdates).length === 0) return;

      const { error } = await supabase
        .from('workout_sessions')
        .update(cleanUpdates)
        .eq('id', sessionId);

      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, 'workout_sessions');
    }
  };

  return { session, loading, updateSession };
};
