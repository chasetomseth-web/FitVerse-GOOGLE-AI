import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFirebase } from '../components/FirebaseProvider';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, setDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { 
  ChevronLeft,
  Send, 
  Brain, 
  Sparkles, 
  Info, 
  ChevronRight, 
  Zap, 
  Clock, 
  Dumbbell,
  AlertCircle,
  Utensils,
  TrendingUp,
  Activity
} from 'lucide-react';
import { CoachConversation, CoachMessage, DailyLog, TrainingProgram, WorkoutSession } from '../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { BottomNav } from '../components/BottomNav';
import { generateCoachResponse } from '../services/gemini';
import { handleCoachActions } from '../services/actionHandler';
import { CoachResponse } from '../types/actions';
import { useUserProfile } from '../hooks/useUserProfile';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/utils';
import { useDailyLog } from '../hooks/useDailyLog';
import { useActiveProgram } from '../hooks/useActiveProgram';

export const Coach: React.FC = () => {
  const { user } = useFirebase();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const { log: todayLog } = useDailyLog();
  const { activeProgram } = useActiveProgram();
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [history, setHistory] = useState<CoachMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutSession | null>(null);
  const [weightTrend, setWeightTrend] = useState<'Stable' | 'Trending Up' | 'Trending Down'>('Stable');
  
  const initialGreetingTriggered = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;

    // Fetch weight trend
    const metricsQuery = query(
      collection(db, 'users', user.uid, 'body_metrics'),
      orderBy('date', 'desc'),
      limit(7)
    );

    const unsubMetrics = onSnapshot(metricsQuery, (snap) => {
      if (snap.docs.length >= 2) {
        const weights = snap.docs.map(d => d.data().weightKg);
        const latest = weights[0];
        const previous = weights[weights.length - 1];
        const diff = latest - previous;
        if (Math.abs(diff) < 0.5) setWeightTrend('Stable');
        else if (diff > 0) setWeightTrend('Trending Up');
        else setWeightTrend('Trending Down');
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/body_metrics`));

    // Fetch today's workout for context
    const workoutQuery = query(
      collection(db, 'users', user.uid, 'workout_sessions'),
      where('date', '==', todayStr),
      limit(1)
    );

    const unsubWorkout = onSnapshot(workoutQuery, (snap) => {
      if (!snap.empty) {
        setTodayWorkout({ id: snap.docs[0].id, ...snap.docs[0].data() } as WorkoutSession);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/workout_sessions`));

    // Load recent conversations for persistent memory
    const historyQuery = query(
      collection(db, 'users', user.uid, 'coach_conversations'),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubHistory = onSnapshot(historyQuery, (snap) => {
      const sortedDocs = [...snap.docs].sort((a, b) => a.data().date.localeCompare(b.data().date));
      
      let allMessages: CoachMessage[] = [];
      let todayFound = false;
      let todayMessages: CoachMessage[] = [];

      sortedDocs.forEach(d => {
        const data = d.data() as CoachConversation;
        const msgList = data.messages || [];
        
        if (d.id === todayStr) {
          todayFound = true;
          todayMessages = msgList;
        } else {
          allMessages = [...allMessages, ...msgList];
        }
      });

      setHistory(allMessages);

      // Only update local messages if we aren't currently waiting for an AI response
      // or if the incoming list is clearly ahead of our current list
      if (todayFound && !loading) {
        setMessages(todayMessages);
      }

      if (!todayFound && !loading && !initialGreetingTriggered.current) {
        initialGreetingTriggered.current = true;
        triggerInitialGreeting();
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/coach_conversations`));

    return () => {
      unsubWorkout();
      unsubHistory();
    };
  }, [user]);

  const triggerInitialGreeting = async () => {
    if (!user || !profile || loading || messages.length > 0) return;
    
    setLoading(true);
    try {
      const context = assembleContext();
      const prompt = [
        { 
          role: 'user' as const, 
          parts: [{ text: `Generate a brief, personalized opening greeting for today. 
          Reference my readiness score (${todayLog?.readinessScore || 'not logged'}) and today's workout (${todayWorkout?.sessionFocus || 'Rest Day'}). 
          Keep it professional and motivating.` }] 
        }
      ];

      const result: CoachResponse = await generateCoachResponse(prompt, context);
      
      const modelMessage: CoachMessage = {
        role: 'model',
        parts: [{ text: result.message || "Welcome back! I'm ready to help you optimize your training today." }],
        timestamp: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid, 'coach_conversations', todayStr), {
        uid: user.uid,
        date: todayStr,
        messages: [modelMessage],
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Greeting Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const assembleContext = () => {
    const currentPhase = activeProgram?.phases.find(p => 
      activeProgram.currentWeek >= p.weekStart && activeProgram.currentWeek <= p.weekEnd
    );

    const nutritionTargets = {
      calories: todayLog?.calorieBudget || 2500,
      proteinG: todayLog?.proteinTargetG || 180,
      carbsG: todayLog?.carbTargetG || 250,
      fatG: todayLog?.fatTargetG || 80
    };

    const consumed = {
      calories: todayLog?.caloriesConsumed || 0,
      protein: todayLog?.proteinConsumedG || 0,
      carbs: todayLog?.carbsConsumedG || 0,
      fat: todayLog?.fatConsumedG || 0
    };

    const remaining = {
      calories: nutritionTargets.calories - consumed.calories,
      protein: nutritionTargets.proteinG - consumed.protein,
      carbs: nutritionTargets.carbsG - consumed.carbs,
      fat: nutritionTargets.fatG - consumed.fat
    };

    return {
      profile,
      todayLog,
      program: activeProgram,
      todayWorkout,
      currentPhase,
      streak: 12, // Matches Home.tsx hardcoded streak
      weeklyCompletion: activeProgram?.consistencyScore || 0,
      weightTrend,
      remaining,
      currentTime: format(new Date(), 'h:mm a'),
      currentDay: format(new Date(), 'EEEE')
    };
  };

  const quickActions = [
    { label: "How is my program going?", icon: Activity },
    { label: "What should I eat for my next meal?", icon: Utensils },
    { label: "I am feeling sore today", icon: AlertCircle },
    { label: "Help me adjust today's workout", icon: Zap },
    { label: "Show me my progress this week", icon: TrendingUp }
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (e?: React.FormEvent, textOverride?: string) => {
    if (e) e.preventDefault();
    const text = textOverride || inputText;
    if (!text.trim() || !user || !profile || loading) return;

    const userMessage: CoachMessage = {
      role: 'user',
      parts: [{ text: text }],
      timestamp: new Date().toISOString()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!textOverride) setInputText('');
    setLoading(true);

    try {
      const context = assembleContext();
      
      const fullConversation = [
        ...history.map(m => ({ 
          role: m.role, 
          parts: [{ text: `[${m.timestamp ? format(new Date(m.timestamp), 'h:mm a') : 'Unknown Time'}] ${m.parts[0].text}` }] 
        })),
        ...newMessages.map(m => ({ 
          role: m.role, 
          parts: [{ text: `[${m.timestamp ? format(new Date(m.timestamp), 'h:mm a') : 'Current'}] ${m.parts[0].text}` }]
        }))
      ];

      const result: CoachResponse = await generateCoachResponse(
        fullConversation,
        context
      );

      // Update local state immediately for responsiveness
      const modelMessage: CoachMessage = {
        role: 'model',
        parts: [{ text: result.message || "I'm having trouble connecting right now." }],
        timestamp: new Date().toISOString()
      };

      const finalMessages = [...newMessages, modelMessage];
      setMessages(finalMessages);

      // Execute actions if any
      if (result.actions && result.actions.length > 0) {
        await handleCoachActions(user.uid, result.actions, profile, (msg) => {
          toast(msg, 'success');
        });
      }

      await setDoc(doc(db, 'users', user.uid, 'coach_conversations', todayStr), {
        uid: user.uid,
        date: todayStr,
        messages: finalMessages,
        createdAt: serverTimestamp()
      }, { merge: true });

    } catch (error: any) {
      console.error("Coach Error:", error);
      const errorMessage = error?.message || String(error);
      const errorDetails = error?.details || null;
      
      let displayMessage = "The Coach is currently resting. Try again in a minute.";
      
      const lowerError = errorMessage.toLowerCase();
      
      if (lowerError.includes('api key not configured') || lowerError.includes('key is missing')) {
        displayMessage = "Coach configuration error (API Key). Check project settings.";
      } else if (lowerError.includes('permissions') || lowerError.includes('insufficient')) {
        displayMessage = "Database permission issue. Check your connection.";
      } else if (lowerError.includes('token') || lowerError.includes('json') || lowerError.includes('syntax')) {
        displayMessage = "Coach had an internal logic error (JSON). Try again.";
      } else if (lowerError.includes('exhausted') || lowerError.includes('quota') || lowerError.includes('rate') || lowerError.includes('429')) {
        displayMessage = "Coach is overwhelmed! (Rate limit). Try again in 60s.";
      } else if (lowerError.includes('safety') || lowerError.includes('blocked')) {
        displayMessage = "Coach found the topic sensitive. Let's talk about fitness!";
      } else if (lowerError.includes('timeout') || lowerError.includes('aborted')) {
        displayMessage = "Coach took too long to answer. Check your connection.";
      } else if (errorMessage.length < 150) {
        displayMessage = `Coach Error: ${errorMessage}`;
      }
      
      if (errorDetails && errorDetails.error?.message) {
        displayMessage = `Coach API Error: ${errorDetails.error.message}`;
      }
      
      toast(displayMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="min-h-screen bg-brand-black pb-32">
        <header className="p-6 space-y-4">
          <SkeletonLoader className="h-10 w-48 mb-2" />
          <SkeletonLoader className="h-4 w-32" />
        </header>
        <main className="px-6 space-y-6">
          <SkeletonLoader className="h-40 w-full rounded-3xl" />
          <div className="space-y-4">
            <SkeletonLoader className="h-20 w-3/4 rounded-2xl" />
            <SkeletonLoader className="h-20 w-3/4 rounded-2xl ml-auto" />
            <SkeletonLoader className="h-20 w-3/4 rounded-2xl" />
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-black flex flex-col">
      <header className="p-6 space-y-4 bg-brand-black/80 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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
                <Brain className="w-5 h-5 text-brand-pink" />
              )}
            </div>
            <div className="space-y-0.5">
              <h1 className="text-xl font-display font-black text-white uppercase tracking-tighter italic leading-none">Personal Coach</h1>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Active Coaching</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-gold animate-pulse" />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6 relative custom-scrollbar bg-[radial-gradient(circle_at_top_right,rgba(255,42,109,0.03),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(212,175,55,0.03),transparent_40%)]" ref={scrollRef}>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02] pointer-events-none" />
        <div className="space-y-6 relative z-10">
          {messages.map((m, i) => (
            <motion.div 
              key={m.timestamp || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] p-4 rounded-2xl ${
                m.role === 'user' 
                  ? 'bg-gradient-to-r from-brand-pink to-brand-gold text-white rounded-tr-none shadow-lg shadow-brand-pink/20' 
                  : 'bg-white/5 rounded-tl-none border border-white/10'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {m.parts[0].text}
                </p>
                <div className={`mt-2 text-[8px] font-bold uppercase tracking-widest ${m.role === 'user' ? 'text-white/60' : 'text-white/20'}`}>
                  {format(new Date(m.timestamp), 'h:mm a')}
                </div>
              </div>
            </motion.div>
          ))}
          {loading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/10 flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-brand-pink rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-brand-pink rounded-full animate-bounce delay-100" />
                  <div className="w-1.5 h-1.5 bg-brand-pink rounded-full animate-bounce delay-200" />
                </div>
                <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Coach is thinking...</span>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <footer className="p-6 bg-brand-black/80 backdrop-blur-xl border-t border-white/5 space-y-4">
        {/* Quick Action Chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {quickActions.map((action, i) => (
            <button
              key={`${action.label}-${i}`}
              onClick={() => handleSendMessage(undefined, action.label)}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all active:scale-95"
            >
              <action.icon className="w-3 h-3 text-brand-gold" />
              <span className="text-[8px] font-black text-white uppercase tracking-widest whitespace-nowrap">{action.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSendMessage} className="relative">
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask your coach anything..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-16 text-sm focus:outline-none focus:border-brand-pink transition-all"
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || loading}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-xl transition-all ${
              inputText.trim() && !loading ? 'bg-brand-pink text-white shadow-lg shadow-brand-pink/20' : 'bg-white/5 text-white/20'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
      <BottomNav />
    </div>
  );
};
