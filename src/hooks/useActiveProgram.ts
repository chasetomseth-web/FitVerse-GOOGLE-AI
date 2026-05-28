import { useState, useEffect } from 'react';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { useSupabase } from '../components/SupabaseProvider';
import { TrainingProgram } from '../types';
import { toCamelCase } from '../lib/db';

export const useActiveProgram = () => {
  const { user } = useSupabase();
  const [activeProgram, setActiveProgram] = useState<TrainingProgram | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setActiveProgram(null);
      setLoading(false);
      return;
    }

    const fetchProgram = async () => {
      try {
        const { data, error } = await supabase
          .from('training_programs')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setActiveProgram(data ? toCamelCase(data) as TrainingProgram : null);
      } catch (error) {
        handleSupabaseError(error, OperationType.GET, 'training_programs');
      } finally {
        setLoading(false);
      }
    };

    fetchProgram();

    // Subscribe to changes
    const channel = supabase
      .channel(`active_program:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_programs',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setActiveProgram(null);
          } else {
            const newData = toCamelCase(payload.new) as any;
            if (newData.status === 'active') {
              setActiveProgram(newData as TrainingProgram);
            } else {
              setActiveProgram(null);
            }
          }
        }
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateProgram = async (updates: Partial<TrainingProgram>) => {
    if (!user || !activeProgram?.id) return;
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
        .from('training_programs')
        .update(cleanUpdates)
        .eq('id', activeProgram.id);

      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, 'training_programs');
    }
  };

  return { activeProgram, loading, updateProgram };
};
