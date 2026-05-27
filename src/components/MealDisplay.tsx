import React, { useState } from 'react';
import { Utensils, Check, MessageSquare, Send, Loader2 } from 'lucide-react';

interface FoodItem {
  name: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  question?: string;
}

interface MealDisplayProps {
  foods: FoodItem[];
  onAnswerQuestion?: (question: string, answer: string) => void;
  isAnalyzing?: boolean;
}

export const MealDisplay: React.FC<MealDisplayProps> = ({ foods, onAnswerQuestion, isAnalyzing }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  if (!foods || foods.length === 0) {
    return (
      <div className="p-6 text-center space-y-2 bg-white/5 rounded-2xl border border-white/10">
        <Utensils className="w-8 h-8 text-white/10 mx-auto" />
        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">No foods detected.</p>
      </div>
    );
  }

  // Calculate total macros
  const totals = foods.reduce(
    (acc, f) => {
      acc.calories += f.calories || 0;
      acc.protein += f.protein || 0;
      acc.carbs += f.carbs || 0;
      acc.fat += f.fat || 0;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const roundedTotals = {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fat: Math.round(totals.fat)
  };

  const handleAnswerSubmit = (question: string) => {
    const answer = answers[question];
    if (answer && onAnswerQuestion) {
      onAnswerQuestion(question, answer);
      // Clear the answer after submission
      setAnswers(prev => {
        const next = { ...prev };
        delete next[question];
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-display font-black text-white uppercase tracking-tight italic">Meal Analysis</h3>
          {isAnalyzing && <Loader2 className="w-3 h-3 text-brand-pink animate-spin" />}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/20 rounded-lg">
          <Check className="w-3 h-3 text-emerald-500" />
          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">High Accuracy</span>
        </div>
      </div>

      <div className="space-y-3">
        {foods.map((f, index) => (
          <div key={`${f.name}-${index}`} className="space-y-2">
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-black text-white uppercase tracking-widest">{f.name}</p>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{f.grams}g Serving</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-display font-black text-brand-pink italic">{Math.round(f.calories)} Kcal</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-[6px] font-black text-white/20 uppercase tracking-widest">P: {Math.round(f.protein)}g</span>
                  <span className="text-[6px] font-black text-white/20 uppercase tracking-widest">C: {Math.round(f.carbs)}g</span>
                  <span className="text-[6px] font-black text-white/20 uppercase tracking-widest">F: {Math.round(f.fat)}g</span>
                </div>
              </div>
            </div>

            {f.question && (
              <div className="mx-2 p-4 bg-brand-gold/10 rounded-2xl border border-brand-gold/20 space-y-3">
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 text-brand-gold mt-0.5" />
                  <p className="text-[10px] font-bold text-white uppercase tracking-widest leading-relaxed">
                    {f.question}
                  </p>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={answers[f.question] || ''}
                    onChange={(e) => setAnswers({ ...answers, [f.question!]: e.target.value })}
                    placeholder="Type your answer..."
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white focus:outline-none focus:border-brand-gold transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleAnswerSubmit(f.question!)}
                  />
                  <button 
                    onClick={() => handleAnswerSubmit(f.question!)}
                    disabled={!answers[f.question] || isAnalyzing}
                    className="p-2 bg-brand-gold rounded-xl text-black disabled:opacity-50 transition-all active:scale-90 flex items-center justify-center min-w-[40px]"
                  >
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-6 bg-brand-pink/10 rounded-3xl border border-brand-pink/20 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black text-white uppercase tracking-widest">Total Macros</p>
          <p className="text-2xl font-display font-black text-brand-pink italic tracking-tighter">{roundedTotals.calories} Kcal</p>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Protein</p>
            <p className="text-sm font-display font-black text-white italic">{roundedTotals.protein}g</p>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Carbs</p>
            <p className="text-sm font-display font-black text-white italic">{roundedTotals.carbs}g</p>
          </div>
          <div className="space-y-1">
            <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Fat</p>
            <p className="text-sm font-display font-black text-white italic">{roundedTotals.fat}g</p>
          </div>
        </div>
      </div>
    </div>
  );
};
