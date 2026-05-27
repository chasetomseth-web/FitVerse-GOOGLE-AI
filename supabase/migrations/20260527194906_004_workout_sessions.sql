/*
  # Workout Session Tables
  
  This migration creates tables for workout sessions and exercises.
  
  1. New Tables:
    - `workout_sessions`: Individual workout sessions
      - `id` (uuid, primary key)
      - `session_id` (text, unique)
      - `user_id` (uuid, references user_profiles)
      - `date` (date, not null)
      - `program_id` (text)
      - `program_week` (integer)
      - `session_focus` (text)
      - `planned_duration` (integer)
      - `actual_duration` (integer)
      - `end_time` (timestamptz)
      - `notes` (text)
      - `description` (text)
      - `readiness_at_session` (integer)
      - `overall_rpe` (integer)
      - `session_notes` (text)
      - `status` (text, default 'assigned')
      - `created_at` (timestamptz, default now())
      
    - `workout_blocks`: Blocks within a workout session
      - `id` (uuid, primary key)
      - `session_id` (uuid, references workout_sessions)
      - `type` (text)
      - `display_mode` (text)
      - `circuit_type` (text)
      - `duration` (integer)
      - `instructions` (text)
      - `completed_at` (timestamptz)
      - `order_index` (integer)
      
    - `workout_exercises`: Exercises within blocks
      - `id` (uuid, primary key)
      - `block_id` (uuid, references workout_blocks)
      - `exercise_id` (text)
      - `exercise_name` (text)
      - `movement_pattern` (text)
      - `primary_muscle_group` (text)
      - `secondary_muscle_groups` (text[])
      - `form_notes` (text)
      - `instructions` (text)
      - `tempo` (text)
      - `rest_seconds` (integer)
      - `weight_suggested` (text)
      - `completed_at` (timestamptz)
      - `order_index` (integer)
      
    - `workout_sets`: Individual sets within exercises
      - `id` (uuid, primary key)
      - `exercise_id` (uuid, references workout_exercises)
      - `reps` (integer)
      - `weight` (integer)
      - `actual_reps` (integer)
      - `actual_weight` (integer)
      - `rpe` (integer)
      - `rest_seconds` (integer)
      - `completed_at` (timestamptz)
      - `order_index` (integer)
  
  2. Security:
    - Enable RLS on all tables
*/

-- Create workout_sessions table
CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text UNIQUE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  program_id text,
  program_week integer,
  session_focus text,
  planned_duration integer,
  actual_duration integer,
  end_time timestamptz,
  notes text,
  description text,
  readiness_at_session integer,
  overall_rpe integer,
  session_notes text,
  status text DEFAULT 'assigned',
  volume_change integer DEFAULT 0,
  intensity_rpe integer DEFAULT 0,
  rest_modifier numeric DEFAULT 1.0,
  adjustment_reason text,
  created_at timestamptz DEFAULT now()
);

-- Create workout_blocks table
CREATE TABLE IF NOT EXISTS workout_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  type text,
  display_mode text,
  circuit_type text,
  duration integer,
  instructions text,
  completed_at timestamptz,
  order_index integer DEFAULT 0
);

-- Create workout_exercises table
CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES workout_blocks(id) ON DELETE CASCADE,
  exercise_id text,
  exercise_name text,
  movement_pattern text,
  primary_muscle_group text,
  secondary_muscle_groups text[] DEFAULT '{}',
  form_notes text,
  instructions text,
  tempo text,
  rest_seconds integer,
  weight_suggested text,
  completed_at timestamptz,
  order_index integer DEFAULT 0
);

-- Create workout_sets table
CREATE TABLE IF NOT EXISTS workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  reps integer,
  weight integer,
  actual_reps integer,
  actual_weight integer,
  rpe integer,
  rest_seconds integer,
  completed_at timestamptz,
  order_index integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workout_sessions
CREATE POLICY "Users can read own workout sessions"
  ON workout_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout sessions"
  ON workout_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout sessions"
  ON workout_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for workout_blocks
CREATE POLICY "Users can read own workout blocks"
  ON workout_blocks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions
      WHERE workout_sessions.id = workout_blocks.session_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for workout_exercises
CREATE POLICY "Users can read own workout exercises"
  ON workout_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_blocks
      JOIN workout_sessions ON workout_sessions.id = workout_blocks.session_id
      WHERE workout_blocks.id = workout_exercises.block_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for workout_sets
CREATE POLICY "Users can read own workout sets"
  ON workout_sets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_exercises
      JOIN workout_blocks ON workout_blocks.id = workout_exercises.block_id
      JOIN workout_sessions ON workout_sessions.id = workout_blocks.session_id
      WHERE workout_exercises.id = workout_sets.exercise_id
      AND workout_sessions.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date ON workout_sessions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_workout_blocks_session ON workout_blocks(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_block ON workout_exercises(block_id);
CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets(exercise_id);
