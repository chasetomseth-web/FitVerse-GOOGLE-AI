export type UnitSystem = 'imperial' | 'metric';

export const kgToLbs = (kg: number): number => kg * 2.20462;
export const lbsToKg = (lbs: number): number => lbs / 2.20462;

export const cmToIn = (cm: number): number => cm / 2.54;
export const inToCm = (inches: number): number => inches * 2.54;

export const formatWeight = (weightKg: number, unitSystem: UnitSystem, showUnit = true): string => {
  if (unitSystem === 'imperial') {
    const lbs = Math.round(kgToLbs(weightKg));
    return `${lbs}${showUnit ? ' lbs' : ''}`;
  }
  const kg = Math.round(weightKg * 10) / 10;
  return `${kg}${showUnit ? ' kg' : ''}`;
};

export const formatHeight = (heightCm: number, unitSystem: UnitSystem): string => {
  if (unitSystem === 'imperial') {
    const totalInches = cmToIn(heightCm);
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(heightCm)} cm`;
};

export const displayWeight = (weight: number, unitSystem: UnitSystem): number => {
  if (unitSystem === 'imperial') {
    return Math.round(kgToLbs(weight));
  }
  return Math.round(weight * 10) / 10;
};

export const inputToKg = (weight: number, unitSystem: UnitSystem): number => {
  if (unitSystem === 'imperial') {
    return lbsToKg(weight);
  }
  return weight;
};

export const displayHeight = (heightCm: number, unitSystem: UnitSystem): { val1: number; val2?: number; label1: string; label2?: string } => {
  if (unitSystem === 'imperial') {
    const totalInches = cmToIn(heightCm);
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { val1: feet, val2: inches, label1: 'ft', label2: 'in' };
  }
  return { val1: Math.round(heightCm), label1: 'cm' };
};
