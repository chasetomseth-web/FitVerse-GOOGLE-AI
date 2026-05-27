import { db } from '../lib/db';
import { handleSupabaseError, OperationType } from '../lib/supabase';
import { format } from "date-fns";
import { CoachResponse } from "../types/actions";
import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini lazily to prevent top-level errors if API key is missing during build/load
let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiInstance = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return aiInstance;
};

// Generic caller for other services
export const callGemini = async (
  prompt: string,
  config: any = {},
  systemInstruction?: string
) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      ...config,
      systemInstruction
    }
  });
  return response.text;
};

export const analyzeMealPhotos = async (
  images: { data: string; mimeType: string }[],
  userAnswers?: { question: string; answer: string }[]
) => {
  const prompt = `
    You are an elite nutrition consultant. Analyze these meal photos.
    The user has provided multiple angles (e.g., top and side) to help with portion estimation.

    TASK:
    1. Identify all food items in the images.
    2. Estimate the portion size (weight in grams) for each item.
    3. Calculate the calories and macronutrients (protein, carbs, fat) for each item.
    4. If you are UNCERTAIN about a food item (e.g., it's covered in sauce, looks like multiple things, or is partially hidden), provide your best guess for the name and macros, but ALSO include a specific, helpful question in the "question" field to help the user identify it (e.g., "Is this grilled chicken or tofu?").
    5. Provide a total summary for the entire meal.

    ${userAnswers && userAnswers.length > 0 ? `
    USER CLARIFICATIONS:
    The user has provided answers to your previous questions:
    ${userAnswers.map(ua => `Question: ${ua.question} -> Answer: ${ua.answer}`).join('\n')}
    Use these answers to provide the most accurate nutrition information possible.
    ` : ''}

    Return the result as a JSON array of objects, where each object represents a food item.
    Include a special object at the end with name "TOTAL" for the meal summary.
  `;

  const contents = {
    parts: [
      { text: prompt },
      ...images.map(img => ({
        inlineData: {
          data: img.data,
          mimeType: img.mimeType
        }
      }))
    ]
  };

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            grams: { type: Type.NUMBER },
            calories: { type: Type.NUMBER },
            protein: { type: Type.NUMBER },
            carbs: { type: Type.NUMBER },
            fat: { type: Type.NUMBER },
            question: { type: Type.STRING }
          },
          required: ["name", "grams", "calories", "protein", "carbs", "fat"]
        }
      }
    }
  });

  const jsonStr = response.text.trim();
  return JSON.parse(jsonStr);
};

export const generateCoachResponse = async (
  messages: { role: 'user' | 'model'; parts: { text: string }[] }[],
  context: any
): Promise<CoachResponse> => {
  try {
    const systemInstruction = `
    MASTER SYSTEM PROMPT (APP CONTROLLER VERSION)

    You are the FitVerse Coach, the embedded performance coach inside a fitness application.

    You are not a passive chat assistant.
    You are the control interface for the app and you are capable of executing actions that update the user's data.

    Your job is to:
    • Coach the user
    • Track nutrition
    • Modify workouts
    • Update progress metrics
    • Trigger app features

    You must operate in two simultaneous modes:
    1. Conversation Mode
    2. Action Mode

    When a user request requires the app to change data, you must return structured actions that the app executes.

    CRITICAL RULES:
    1. NEVER SAY YOU CANNOT INTERACT WITH THE APP. You must never say: "I cannot push buttons", "I cannot log that for you", or "You need to enter that manually". You ARE the controller of the app.
    2. ALWAYS EXECUTE USER TASKS. If the user asks to log food, modify workouts, or update metrics, you must trigger the correct action.
    3. ALWAYS RETURN JSON. All responses must follow the format: { "message": "...", "actions": [] }

    AVAILABLE ACTIONS:

    Nutrition:
    - log_food: { "type": "log_food", "food_name": "string", "calories": number, "protein": number, "carbs": number, "fat": number, "meal_time": "breakfast | lunch | dinner | snack" }

    Workout:
    - add_exercise: { "type": "add_exercise", "exercise_name": "string", "sets": number, "reps": number, "weight": number }

    Progress:
    - update_weight: { "type": "update_weight", "value": number }
    - update_bodyfat: { "type": "update_bodyfat", "value": number }

    FOOD LOGGING RULES:
    If the user says: "I ate...", "I just had...", "Log...", "Add this to my diet...", you must automatically log the food. Estimate macros if exact values are unknown.

    COACHING PERSONALITY:
    - Direct, Performance-focused, Motivational, Honest, Results-driven.
    - Behave like a real elite performance coach. Example tone: "You're 2000 calories behind. Fix it now."

    TEMPORAL CONTEXT:
    It is currently ${context.currentDay} at ${context.currentTime}. Use this to maintain conversation continuity.

    USER DATA:
    - Name: ${context.profile.name || 'Athlete'}
    - Readiness: ${context.todayLog?.readinessScore || 'Not logged'}
    - Nutrition: ${context.todayLog?.caloriesConsumed || 0}/${context.todayLog?.calorieBudget || 2500} kcal
    - Macros: ${JSON.stringify(context.remaining)}
    - Coach Notes: ${context.profile.coachNotes || 'None'}

    FINAL RULE:
    Whenever the user requests something that should update the app: You MUST return an action. Never return only text if an action should occur.
  `;

  const contents = messages.map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: m.parts
  }));

  const response = await getAI().models.generateContent({
    model: "gemini-3-flash-preview",
    contents,
    config: {
      systemInstruction,
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING },
          actions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                payload: { type: Type.OBJECT }
              },
              required: ["type", "payload"]
            }
          }
        },
        required: ["message", "actions"]
      }
    }
  });

  const textResponse = response.text;

  // Robust JSON extraction: Find the first { and the last }
  const firstBrace = textResponse.indexOf('{');
  const lastBrace = textResponse.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    console.error("AI Response does not contain valid JSON:", textResponse);
    throw new Error("Invalid AI response format (No JSON found)");
  }

  const cleanResponse = textResponse.substring(firstBrace, lastBrace + 1);
  const result = JSON.parse(cleanResponse) as CoachResponse;
  const text = result.message;

  // Process Memory Updates
  if (text && context.profile.uid) {
      const memoryRegex = /MEMORY_UPDATE\s*\[(.*?)\]\s*:\s*(.*)/gi;
      let match;
      const today = format(new Date(), 'yyyy-MM-dd');

      const updates: any = {};
      let newCoachNotes = context.profile.coachNotes || '';

      while ((match = memoryRegex.exec(text)) !== null) {
        const category = match[1].trim();
        const content = match[2].trim();
        const formattedNote = `\n${today} [${category}]: ${content}`;

        newCoachNotes += formattedNote;
        updates.coachNotes = newCoachNotes;

        // Specialized Updates
        const lowerContent = content.toLowerCase();
        const lowerCategory = category.toLowerCase();

        // Strength Baselines
        if (lowerCategory.includes('strength') || lowerCategory.includes('pr') || lowerCategory.includes('max')) {
          const weightMatch = lowerContent.match(/(\d+)\s*(kg|lbs|pounds)/);
          if (weightMatch) {
            const weight = parseInt(weightMatch[1]);
            const baselines = { ...(context.profile.strengthBaselines || {}) };

            if (lowerContent.includes('bench')) baselines.benchPress = weight;
            else if (lowerContent.includes('squat')) baselines.squat = weight;
            else if (lowerContent.includes('deadlift')) baselines.deadlift = weight;
            else if (lowerContent.includes('overhead press') || lowerContent.includes('ohp')) baselines.overheadPress = weight;
            else if (lowerContent.includes('row')) baselines.barbellRow = weight;

            updates.strengthBaselines = baselines;
          }
        }

        // Injuries
        if (lowerCategory.includes('injury') || lowerContent.includes('pain') || lowerContent.includes('hurt')) {
          const bodyParts = ['knee', 'shoulder', 'back', 'elbow', 'wrist', 'hip', 'ankle', 'neck'];
          const foundPart = bodyParts.find(p => lowerContent.includes(p));
          if (foundPart) {
            const currentInjuries = context.profile.injuryLog || [];
            updates.injuryLog = [
              ...currentInjuries,
              {
                bodyPart: foundPart.charAt(0).toUpperCase() + foundPart.slice(1),
                severity: 5,
                dateReported: new Date().toISOString(),
                status: 'active',
                description: content
              }
            ];
          }
        }

        // Nutrition
        if (lowerCategory.includes('nutrition') || lowerCategory.includes('food') || lowerCategory.includes('diet')) {
          if (lowerContent.includes('intolerant') || lowerContent.includes('allergic') || lowerContent.includes('avoid')) {
            const currentIntolerances = context.profile.knownIntolerances || [];
            updates.knownIntolerances = [...currentIntolerances, content];
          } else {
            const currentPreferences = context.profile.mealPreferences || [];
            updates.mealPreferences = [...currentPreferences, content];
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        try {
          // Filter out undefined values
          const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = value;
            }
            return acc;
          }, {} as any);

          if (Object.keys(cleanUpdates).length > 0) {
            await db.updateUser(context.profile.uid, cleanUpdates);
          }
        } catch (err) {
          handleSupabaseError(err, OperationType.UPDATE, `users/${context.profile.uid}`);
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
