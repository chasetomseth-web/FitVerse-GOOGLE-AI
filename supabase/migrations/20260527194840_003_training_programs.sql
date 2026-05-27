/*
  # Training Program Tables
  
  This migration creates tables for training programs and workout sessions.
  
  1. New Tables:
    - `training_programs`: User's training programs
      - `id` (uuid, primary key)
      - `program_id` (text, unique, not null)
      - `user_id` (uuid, references user_profiles)
      - `program_name` (text, not null)
      - `total_weeks` (integer)
      - `current_week` (integer, default 1)
      - `start_date` (timestamptz)
      - `expected_end_date` (timestamptz)
      - `status` (text, default 'active')
      - `consistency_score` (integer, default 0)
      - `progress_percent` (integer, default 0)
      - `created_at` (timestamptz, default now())
      
    - `training_phases`: Individual phases within a program
      - `id` (uuid, primary key)
      - `program_id` (uuid, references training_programs)
      - `phase_name` (text)
      - `week_start` (integer)
      - `week_end` (integer)
      - `focus` (text)
      - `volume_multiplier` (numeric)
      - `intensity_target` (integer)
      - `key_principle` (text)
      
    - `nutrition_profiles`: Nutrition targets for programs
      - `id` (uuid, primary key)
      - `program_id` (uuid, references training_programs)
      - `bmr` (integer)
      - `tdee` (integer)
      
    - `readiness_tiers`: Readiness tier configurations
      - `id` (uuid, primary key)
      - `program_id` (uuid, references training_programs)
      - `tier_name` (text)
      - `intensity_modifier` (numeric)
      - `volume_modifier` (numeric)
      - `conditioning_modifier` (numeric)
      - `rpe_target` (text)
      - `description` (text)
  
  2. Security:
    - Enable RLS on all tables
*/

-- Create training_programs table
CREATE TABLE IF NOT EXISTS training_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  program_name text NOT NULL,
  total_weeks integer,
  current_week integer DEFAULT 1,
  start_date timestamptz,
  expected_end_date timestamptz,
  status text DEFAULT 'active',
  consistency_score integer DEFAULT 0,
  progress_percent integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create training_phases table
CREATE TABLE IF NOT EXISTS training_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  phase_name text,
  week_start integer,
  week_end integer,
  focus text,
  volume_multiplier numeric,
  intensity_target integer,
  key_principle text
);

-- Create nutrition_profiles table
CREATE TABLE IF NOT EXISTS nutrition_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  bmr integer,
  tdee integer
);

-- Create readiness_tiers table
CREATE TABLE IF NOT EXISTS readiness_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
  tier_name text,
  intensity_modifier numeric,
  volume_modifier numeric,
  conditioning_modifier numeric,
  rpe_target text,
  description text
);

-- Enable RLS
ALTER TABLE training_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_tiers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own programs"
  ON training_programs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own programs"
  ON training_programs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own programs"
  ON training_programs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own program phases"
  ON training_phases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = training_phases.program_id
      AND training_programs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read own nutrition profiles"
  ON nutrition_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = nutrition_profiles.program_id
      AND training_programs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can read own readiness tiers"
  ON readiness_tiers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM training_programs
      WHERE training_programs.id = readiness_tiers.program_id
      AND training_programs.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_training_programs_user ON training_programs(user_id);
CREATE INDEX IF NOT EXISTS idx_training_phases_program ON training_phases(program_id);
