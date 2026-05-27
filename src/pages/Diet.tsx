import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebase } from '../components/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { 
  ChevronLeft,
  Utensils, 
  Plus, 
  Droplets, 
  Sparkles,
  X,
  TrendingUp,
  Search,
  Loader2,
  Camera
} from 'lucide-react';
import { DailyLog, MealEntry, BodyMetric } from '../types';
import { format, startOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { generateCoachResponse, analyzeMealPhotos } from '../services/gemini';
import { getRemainingMacros } from '../services/nutritionEngine';
import { useDailyLog } from '../hooks/useDailyLog';
import { useUserProfile } from '../hooks/useUserProfile';
import { searchFoods, FDCSearchResultFood, extractMacros as extractFDCMacros } from '../services/fdcService';
import { searchOFFFoods, OFFProduct, extractOFFMacros } from '../services/offService';
import { MealPhotoAnalyzer } from '../components/MealPhotoAnalyzer';
import { MealDisplay } from '../components/MealDisplay';

type UnifiedFoodResult = {
  id: string;
  name: string;
  brand?: string;
  source: 'fdc' | 'off';
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  originalData: any;
};

export const Diet: React.FC = () => {
  const { user } = useFirebase();
  const navigate = useNavigate();
  const { profile } = useUserProfile();
  const { log: todayLog, loading: logLoading, setLog } = useDailyLog();
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showPhotoAnalyzer, setShowPhotoAnalyzer] = useState(false);
  const [analyzedFoods, setAnalyzedFoods] = useState<any[] | null>(null);
  const [capturedPhotos, setCapturedPhotos] = useState<{ data: string; mimeType: string }[]>([]);
  const [userAnswers, setUserAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [weightHistory, setWeightHistory] = useState<any[]>([]);
  
  const [mealForm, setMealForm] = useState({
    type: 'breakfast' as MealEntry['mealType'],
    foods: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UnifiedFoodResult[]>([]);
  const [searching, setSearching] = useState(false);

  const unitSystem = profile?.unitSystem || 'imperial';
  const weightFactor = unitSystem === 'imperial' ? 2.20462 : 1;
  const weightUnit = unitSystem === 'imperial' ? 'lbs' : 'kg';

  useEffect(() => {
    if (!user) return;

    const metricsRef = collection(db, 'users', user.uid, 'body_metrics');
    const q = query(metricsRef, orderBy('date', 'desc'), limit(7));

    const unsubscribe = onSnapshot(q, (snap) => {
      const history = snap.docs.map(doc => {
        const data = doc.data() as BodyMetric;
        return {
          date: format(new Date(data.date), 'MM/dd'),
          weight: Math.round(data.weightKg * weightFactor)
        };
      }).reverse();
      setWeightHistory(history);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/body_metrics`);
    });

    return () => unsubscribe();
  }, [user, weightFactor]);

  const nutritionTargets = {
    calories: todayLog?.calorieBudget || 2500,
    proteinG: todayLog?.proteinTargetG || 180,
    carbsG: todayLog?.carbTargetG || 250,
    fatG: todayLog?.fatTargetG || 80
  };

  const remaining = getRemainingMacros(
    nutritionTargets,
    {
      calories: todayLog?.caloriesConsumed || 0,
      protein: todayLog?.proteinConsumedG || 0,
      carbs: todayLog?.carbsConsumedG || 0,
      fat: todayLog?.fatConsumedG || 0
    }
  );

  const handleAddMeal = async () => {
    if (!user || !todayLog) return;
    
    const newMeal: MealEntry = {
      mealType: mealForm.type,
      foods: mealForm.foods.split(',').map(f => f.trim()),
      macros: {
        calories: mealForm.calories,
        protein: mealForm.protein,
        carbs: mealForm.carbs,
        fat: mealForm.fat
      },
      timestamp: new Date().toISOString()
    };

    const updatedLog: Partial<DailyLog> = {
      mealLog: [...(todayLog.mealLog || []), newMeal],
      caloriesConsumed: (todayLog.caloriesConsumed || 0) + mealForm.calories,
      proteinConsumedG: (todayLog.proteinConsumedG || 0) + mealForm.protein,
      carbsConsumedG: (todayLog.carbsConsumedG || 0) + mealForm.carbs,
      fatConsumedG: (todayLog.fatConsumedG || 0) + mealForm.fat
    };

    try {
      await setLog(updatedLog);
      setShowAddMeal(false);
      setAnalyzedFoods(null);
      setCapturedPhotos([]);
      setUserAnswers([]);
      setMealForm({ type: 'breakfast', foods: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding meal:', error);
    }
  };

  const handleAnalysisComplete = (results: any[], photos: { data: string; mimeType: string }[]) => {
    const foodItems = results.filter(r => r.name !== 'TOTAL');
    const total = results.find(r => r.name === 'TOTAL') || results[results.length - 1];
    const foods = foodItems.map(r => r.name).join(', ');
    
    setCapturedPhotos(photos);
    setAnalyzedFoods(foodItems);
    setMealForm({
      ...mealForm,
      foods,
      calories: Math.round(total.calories),
      protein: Math.round(total.protein),
      carbs: Math.round(total.carbs),
      fat: Math.round(total.fat)
    });
    setShowPhotoAnalyzer(false);
  };

  const handleAnswerQuestion = async (question: string, answer: string) => {
    const newAnswers = [...userAnswers, { question, answer }];
    setUserAnswers(newAnswers);
    setIsReanalyzing(true);
    try {
      const results = await analyzeMealPhotos(capturedPhotos, newAnswers);
      const foodItems = results.filter((r: any) => r.name !== 'TOTAL');
      const total = results.find((r: any) => r.name === 'TOTAL') || results[results.length - 1];
      const foods = foodItems.map((r: any) => r.name).join(', ');
      
      setAnalyzedFoods(foodItems);
      setMealForm({
        ...mealForm,
        foods,
        calories: Math.round(total.calories),
        protein: Math.round(total.protein),
        carbs: Math.round(total.carbs),
        fat: Math.round(total.fat)
      });
    } catch (error) {
      console.error("Re-analysis Error:", error);
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      // Run both searches in parallel
      const [fdcResults, offResults] = await Promise.all([
        searchFoods(query, 5),
        searchOFFFoods(query, 5)
      ]);

      const unifiedResults: UnifiedFoodResult[] = [
        ...fdcResults.foods.map((f, i) => ({
          id: `fdc-${f.fdcId || 'none'}-${i}-${Date.now()}`,
          name: f.description,
          brand: f.brandOwner,
          source: 'fdc' as const,
          macros: extractFDCMacros(f),
          originalData: f
        })),
        ...offResults.products.map((p, i) => ({
          id: `off-${p._id || 'none'}-${i}-${Date.now()}`,
          name: p.product_name,
          brand: p.brands,
          source: 'off' as const,
          macros: extractOFFMacros(p),
          originalData: p
        }))
      ];

      setSearchResults(unifiedResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const selectFood = (food: UnifiedFoodResult) => {
    setMealForm({
      ...mealForm,
      foods: food.name,
      calories: Math.round(food.macros.calories),
      protein: Math.round(food.macros.protein),
      carbs: Math.round(food.macros.carbs),
      fat: Math.round(food.macros.fat)
    });
    setSearchResults([]);
    setSearchQuery('');
  };

  const getRecommendation = async () => {
    if (!user || !profile || !todayLog) return;
    setLoading(true);
    try {
      const timeOfDay = format(new Date(), 'HH:mm');
      const prompt = [
        { 
          role: 'user', 
          parts: [{ 
            text: `It is currently ${timeOfDay}. 
            My remaining macros for today are: ${remaining.calories} kcal, ${remaining.protein}g protein, ${remaining.carbs}g carbs, ${remaining.fat}g fat. 
            My meal preferences are: ${profile.mealPreferences?.join(', ') || 'None'}.
            My known intolerances are: ${profile.knownIntolerances?.join(', ') || 'None'}.
            Suggest a high-performance meal for my next meal slot that perfectly fits my remaining macros. Provide a detailed description of the meal and explain why it's a good choice for my goals and current readiness. Do not include any actions in the JSON response, just the message.` 
          }] 
        }
      ];

      const response = await generateCoachResponse(prompt as any, { profile, todayLog });
      setRecommendation(response.message);
    } catch (error) {
      console.error("Recommendation Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const MacroBar = ({ label, current, target, color }: { label: string, current: number, target: number, color: string }) => {
    const percent = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{label}</span>
          <span className="text-[10px] font-bold text-white uppercase tracking-tight">{Math.round(current)} / {Math.round(target)}g</span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            className={`h-full ${color} rounded-full`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-black pb-12">
      <header className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl transition-all border border-white/5"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-xl bg-brand-pink/10 border border-brand-pink/20 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            >
              {profile?.photoURL ? (
                <img 
                  src={profile.photoURL} 
                  alt={profile.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Utensils className="w-5 h-5 text-brand-pink" />
              )}
            </div>
          </div>
          <button 
            onClick={() => setShowAddMeal(true)}
            className="p-3 bg-brand-pink text-white rounded-2xl shadow-lg shadow-brand-pink/20 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="px-6 space-y-8 max-w-4xl mx-auto">
        {/* Calorie Progress */}
        <section className="glass-card p-8 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-brand-pink/20" />
          <div className="relative w-48 h-48 rounded-full border-4 border-white/5 flex flex-col items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-brand-pink border-t-transparent animate-spin-slow opacity-20" />
            <span className="text-5xl font-display font-black text-white italic leading-none">
              {Math.round(remaining.calories)}
            </span>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-1">Kcal Remaining</span>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-8 w-full">
            <div className="text-center">
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Consumed</p>
              <p className="text-lg font-display font-black text-white italic">{Math.round(todayLog?.caloriesConsumed || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Burned</p>
              <p className="text-lg font-display font-black text-emerald-500 italic">{Math.round(todayLog?.activeCaloriesBurned || 0)}</p>
            </div>
            <div className="text-center">
              <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Budget</p>
              <p className="text-lg font-display font-black text-brand-gold italic">{Math.round(nutritionTargets.calories)}</p>
            </div>
          </div>
        </section>

        {/* Macros */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 space-y-6 md:col-span-2">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Macronutrients</h3>
            <div className="space-y-6">
              <MacroBar label="Protein" current={todayLog?.proteinConsumedG || 0} target={nutritionTargets.proteinG} color="bg-brand-pink" />
              <MacroBar label="Carbohydrates" current={todayLog?.carbsConsumedG || 0} target={nutritionTargets.carbsG} color="bg-brand-gold" />
              <MacroBar label="Fats" current={todayLog?.fatConsumedG || 0} target={nutritionTargets.fatG} color="bg-emerald-500" />
            </div>
          </div>

          <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-brand-gold/10 rounded-full flex items-center justify-center">
              <Droplets className="w-8 h-8 text-brand-gold" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-white uppercase tracking-widest">Hydration</h4>
              <p className="text-2xl font-display font-black text-brand-gold italic">{todayLog?.waterGlasses || 0} / 10</p>
              <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Glasses Today</p>
            </div>
            <button 
              onClick={async () => {
                if (!todayLog) return;
                await setLog({ 
                  waterGlasses: (todayLog.waterGlasses || 0) + 1 
                });
              }}
              className="w-full py-3 bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
            >
              Add Glass
            </button>
          </div>
        </section>

        {/* Weight Trend */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Weight Trend ({weightUnit})</h3>
            <TrendingUp className="w-5 h-5 text-brand-pink" />
          </div>
          <div className="glass-card p-6 h-64">
            {weightHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weightHistory}>
                  <defs>
                    <linearGradient id="weightGradientDiet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF007A" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#FF007A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fontWeight: 700 }}
                  />
                  <YAxis 
                    stroke="rgba(255,255,255,0.4)" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    domain={['dataMin - 1', 'dataMax + 1']}
                    tick={{ fontWeight: 700 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0,0,0,0.8)', 
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: 900,
                      textTransform: 'uppercase'
                    }}
                    itemStyle={{ color: '#FF007A' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#FF007A" 
                    strokeWidth={3} 
                    fillOpacity={1}
                    fill="url(#weightGradientDiet)"
                    dot={{ fill: '#FF007A', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-2">
                <TrendingUp className="w-8 h-8 text-white/10" />
                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">No weight history available.</p>
              </div>
            )}
          </div>
        </section>

        {/* AI Recommendation */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Coach Recommendation</h3>
            <Sparkles className="w-5 h-5 text-brand-gold animate-pulse" />
          </div>
          <div className="glass-card p-6 space-y-6 border-brand-gold/20 relative overflow-hidden">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-brand-gold/10 rounded-2xl">
                <Utensils className="w-6 h-6 text-brand-gold" />
              </div>
              <div className="space-y-2 flex-1">
                <h4 className="text-sm font-display font-black text-white uppercase tracking-tight italic">Next Meal Recommendation</h4>
                {recommendation ? (
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-white/60 leading-relaxed italic"
                  >
                    {recommendation}
                  </motion.p>
                ) : (
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                    Ready to optimize your next meal based on remaining macros?
                  </p>
                )}
              </div>
            </div>
            <button 
              onClick={getRecommendation}
              disabled={loading}
              className="w-full btn-primary py-4 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span className="text-xs font-black uppercase tracking-widest">Generate Recommendation</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Meal History */}
        <section className="space-y-4 pb-12">
          <h3 className="font-display font-bold text-lg text-white uppercase tracking-tight italic">Today's Log</h3>
          <div className="space-y-3">
            {todayLog?.mealLog?.length ? todayLog.mealLog.map((meal, i) => (
              <div key={`${meal.mealType}-${meal.timestamp || i}-${i}`} className="glass-card p-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
                    <Utensils className="w-5 h-5 text-brand-pink" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white uppercase tracking-widest">{meal.mealType}</h5>
                    <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest">{meal.foods.join(', ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-display font-black text-white italic">{Math.round(meal.macros.calories)} Kcal</p>
                  <p className="text-[8px] text-brand-pink font-bold uppercase tracking-widest">{Math.round(meal.macros.protein)}g Protein</p>
                </div>
              </div>
            )) : (
              <div className="glass-card p-8 text-center space-y-2">
                <Utensils className="w-8 h-8 text-white/10 mx-auto" />
                <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">No meals logged today.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Add Meal Modal */}
      <AnimatePresence>
        {showPhotoAnalyzer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6"
          >
            <MealPhotoAnalyzer 
              onAnalysisComplete={handleAnalysisComplete}
              onCancel={() => setShowPhotoAnalyzer(false)}
            />
          </motion.div>
        )}

        {showAddMeal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl overflow-y-auto p-4 sm:p-6"
          >
            <div className="min-h-full flex items-start justify-center py-8">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="glass-card w-full max-w-md p-6 sm:p-8 space-y-6 relative mb-24"
              >
              <button 
                onClick={() => setShowAddMeal(false)}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center space-y-2">
                <h3 className="text-3xl font-display font-black text-white uppercase italic tracking-tighter leading-none">Log Fuel</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Precision macro tracking</p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => setShowPhotoAnalyzer(true)}
                  className="w-full py-4 bg-brand-pink/10 border border-brand-pink/20 rounded-2xl flex items-center justify-center gap-3 group hover:bg-brand-pink/20 transition-all"
                >
                  <Camera className="w-5 h-5 text-brand-pink group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="text-[10px] font-black text-white uppercase tracking-widest">Scan Meal with Coach</p>
                    <p className="text-[8px] text-brand-pink font-bold uppercase tracking-widest">Photo → Calories & Macros</p>
                  </div>
                </button>

                {analyzedFoods && (
                  <div className="space-y-4">
                    <MealDisplay 
                      foods={analyzedFoods} 
                      onAnswerQuestion={handleAnswerQuestion}
                      isAnalyzing={isReanalyzing}
                    />
                    <button 
                      onClick={() => {
                        setAnalyzedFoods(null);
                        setCapturedPhotos([]);
                        setUserAnswers([]);
                      }}
                      className="w-full py-2 text-[8px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Clear Analysis
                    </button>
                  </div>
                )}

                <div className="relative flex items-center gap-4">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Or Manual Entry</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {['breakfast', 'lunch', 'dinner', 'snack'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setMealForm({ ...mealForm, type: type as any })}
                      className={`py-2 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all ${
                        mealForm.type === type ? 'bg-brand-pink text-white border-brand-pink shadow-lg shadow-brand-pink/20' : 'bg-white/5 border-white/5 text-white/40'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="space-y-1 relative">
                  <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Search Food Database</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Search for a food..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-pink animate-spin" />}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="absolute z-[110] top-full left-0 right-0 mt-2 bg-brand-black/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                      {searchResults.map((food) => (
                        <button
                          key={food.id}
                          onClick={() => selectFood(food)}
                          className="w-full p-4 text-left hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-white uppercase tracking-tight">{food.name}</p>
                            <span className={`text-[6px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest ${
                              food.source === 'fdc' ? 'bg-brand-pink/20 text-brand-pink' : 'bg-emerald-500/20 text-emerald-500'
                            }`}>
                              {food.source}
                            </span>
                          </div>
                          {food.brand && <p className="text-[8px] text-white/40 font-bold uppercase tracking-widest mt-0.5">{food.brand}</p>}
                          <div className="flex gap-3 mt-1">
                            <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">{Math.round(food.macros.calories)} Kcal</span>
                            <span className="text-[8px] font-black text-brand-pink uppercase tracking-widest">{Math.round(food.macros.protein)}g P</span>
                            <span className="text-[8px] font-black text-brand-gold uppercase tracking-widest">{Math.round(food.macros.carbs)}g C</span>
                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">{Math.round(food.macros.fat)}g F</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Foods (comma separated)</label>
                  <input 
                    type="text" 
                    value={mealForm.foods}
                    onChange={(e) => setMealForm({ ...mealForm, foods: e.target.value })}
                    placeholder="Eggs, Toast, Avocado"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Calories</label>
                    <input 
                      type="number" 
                      value={mealForm.calories || ''}
                      onChange={(e) => setMealForm({ ...mealForm, calories: Math.round(parseFloat(e.target.value)) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Protein (g)</label>
                    <input 
                      type="number" 
                      value={mealForm.protein || ''}
                      onChange={(e) => setMealForm({ ...mealForm, protein: Math.round(parseFloat(e.target.value)) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Carbs (g)</label>
                    <input 
                      type="number" 
                      value={mealForm.carbs || ''}
                      onChange={(e) => setMealForm({ ...mealForm, carbs: Math.round(parseFloat(e.target.value)) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-white/40 uppercase tracking-widest ml-2">Fat (g)</label>
                    <input 
                      type="number" 
                      value={mealForm.fat || ''}
                      onChange={(e) => setMealForm({ ...mealForm, fat: Math.round(parseFloat(e.target.value)) || 0 })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-brand-pink transition-all"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleAddMeal}
                  className="w-full btn-primary py-5 flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Log Meal</span>
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
};
