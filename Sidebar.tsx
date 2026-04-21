import React from 'react';
import { Settings, Library, Shield, GraduationCap, FolderOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAdmin: boolean;
  logoUrl?: string;
}

export function Sidebar({ activeTab, setActiveTab, isAdmin, logoUrl }: SidebarProps) {
  const menuItems = [
	    { id: 'study', icon: GraduationCap, label: 'المذاكرة الذكية' },
	    { id: 'library', icon: Library, label: 'مكتبة الملفات' },
	    { id: 'tamrediano_library', icon: FolderOpen, label: 'مكتبة تمريضيانو' },
	    { id: 'settings', icon: Settings, label: 'الإعدادات' },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 bg-[#020617] border-r border-white/5 flex-col p-8 h-full">
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-cyan-500/20 relative overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover absolute inset-0 z-20" />
            ) : null}
            <GraduationCap className="text-white relative z-10" size={28} />
          </div>
          <div>
            <span className="text-2xl font-black tracking-tighter text-white font-cairo block leading-none">تمريضيانو</span>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.2em] mt-1 block">Premium</span>
          </div>
        </div>

        <nav className="flex-1 space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group font-cairo relative overflow-hidden",
                activeTab === item.id 
                  ? "bg-white/5 text-white shadow-xl" 
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]"
              )}
            >
              {activeTab === item.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 rounded-full"
                />
              )}
              <item.icon size={22} className={cn(
                "transition-all duration-300",
                activeTab === item.id ? "text-cyan-400 scale-110" : "text-slate-600 group-hover:text-slate-400"
              )} />
              <span className="font-bold text-lg">{item.label}</span>
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={cn(
                "w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group font-cairo mt-8 border border-amber-500/10",
                activeTab === 'admin' 
                  ? "bg-amber-500/10 text-amber-500" 
                  : "text-slate-500 hover:text-amber-400 hover:bg-amber-500/5"
              )}
            >
              <Shield size={22} />
              <span className="font-bold text-lg">لوحة الإدارة</span>
            </button>
          )}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 blur-2xl rounded-full -mr-10 -mt-10 group-hover:bg-cyan-500/20 transition-all"></div>
            <p className="text-xs text-cyan-400 font-black mb-2 uppercase tracking-widest relative z-10">Status: Active</p>
            <p className="text-sm text-slate-300 font-cairo leading-relaxed relative z-10">كل المميزات مفتوحة ليك يا بطل.. استمتع بالمذاكرة الذكية!</p>
          </div>
        </div>
      </aside>
    </>
  );
}
