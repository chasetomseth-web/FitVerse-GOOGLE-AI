/*
  # Daily Workout State Tables
  
  This migration creates table for daily workout state tracking.
  
  1. New Tables:
    - `daily_workout_states`: Authoritative state for a specific day's workout
      - `id` (text, primary key - YYYY-MM-DD format)
      - `user_id` (uuid, references user_profiles)
      - `date` (date, not null)
      - `program_phase` (text)
      - `program_day_type` (text)
      - `workout_title` (text)
      - `workout_focus` (text)
      - `workout_duration` (integer)
      - `target_intensity` (text)
      - `exercise_blocks` (jsonb)
      - `status` (text, default 'scheduled')
      - `program_id` (text)
      - `program_week` (integer)
      - `swappable` (boolean, default true)
      - `readiness_score_at_checkin` (integer)
      - `description` (text)
      - `created_at` (timestamptz, default now())
      - UNIQUE(user_id, date)
  
  2. Security:
    - Enable RLS
*/

-- Create daily_workout_states table
CREATE TABLE IF NOT EXISTS daily_workout_states (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  program_phase text,
  program_day_type text,
  workout_title text,
  workout_focus text,
  workout_duration integer,
  target_intensity text,
  exercise_blocks jsonb,
  status text DEFAULT 'scheduled',
  program_id text,
  program_week integer,
  swappable boolean DEFAULT true,
  readiness_score_at_checkin integer,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE daily_workout_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own daily workout states"
  ON daily_workout_states FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily workout states"
  ON daily_workout_states FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily workout states"
  ON daily_workout_states FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_daily_workout_states_user_date ON daily_workout_states(user_id, date);
