import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Calendar, 
  Brain, 
  BarChart2, 
  Book, 
  User, 
  Utensils 
} from 'lucide-react';

export const BottomNav: React.FC = () => {
  const tabs = [
    { name: 'Home', icon: Home, path: '/' },
    { name: 'Program', icon: Calendar, path: '/program' },
    { name: 'Coach', icon: Brain, path: '/coach' },
    { name: 'Diet', icon: Utensils, path: '/diet' },
    { name: 'Progress', icon: BarChart2, path: '/progress' },
    { name: 'Library', icon: Book, path: '/library' },
    { name: 'Profile', icon: User, path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-brand-black/80 backdrop-blur-xl border-t border-white/5 px-4 pb-safe pt-2">
      <div className="flex items-center justify-around max-w-4xl mx-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => `
              flex flex-col items-center gap-1 p-2 transition-all duration-300
              ${isActive ? 'text-brand-pink scale-110' : 'text-white/40 hover:text-white/60'}
            `}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-widest">{tab.name}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
