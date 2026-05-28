import { useState, useEffect } from 'react';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { useSupabase } from '../components/SupabaseProvider';
import { UserProfile } from '../types';
import { toCamelCase } from '../lib/db';

export const useUserProfile = () => {
  const { user } = useSupabase();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;
        setProfile(data ? toCamelCase(data) as UserProfile : null);
      } catch (error) {
        handleSupabaseError(error, OperationType.GET, 'user_profiles');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Subscribe to changes
    const channel = supabase
      .channel(`user_profile:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setProfile(null);
          } else {
            setProfile(toCamelCase(payload.new) as UserProfile);
          }
        }
      );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          // Convert camelCase to snake_case for Supabase
          const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          acc[snakeKey] = value;
        }
        return acc;
      }, {} as any);

      if (Object.keys(cleanUpdates).length === 0) return;

      const { error } = await supabase
        .from('user_profiles')
        .update(cleanUpdates)
        .eq('id', user.id);

      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, 'user_profiles');
    }
  };

  return { profile, loading, updateProfile };
};
