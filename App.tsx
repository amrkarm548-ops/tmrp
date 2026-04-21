import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { StudyGenerator } from './components/StudyGenerator';
import { AdminPanel } from './components/AdminPanel';
import { WelcomeBot } from './components/WelcomeBot';
import { FileLibrary } from './components/FileLibrary';
import { SettingsPanel } from './components/SettingsPanel';
import { TamredianoLibrary } from './components/TamredianoLibrary';
import { Shield, LogIn, MessageSquare, X, Bell, Settings, Library, GraduationCap, Layout, FolderOpen, Ban, LogOut } from 'lucide-react';
import { AuthProvider } from './context/AuthProvider';
import { useAuth } from './hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, onSnapshot } from './firebase';

function AppContent() {
  const { user, profile, loading, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('study');
  const [globalFiles, setGlobalFiles] = useState<File[]>([]);
  const [showBot, setShowBot] = useState(false);
  const [toast, setToast] = useState<{message: string, visible: boolean}>({message: '', visible: false});
  const [appConfig, setAppConfig] = useState<any>({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setAppConfig(docSnap.data());
      }
    });
    return () => unsub();
  }, []);

  // Close mobile menu logic is now simplified
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  React.useEffect(() => {
    const handleNav = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        handleTabChange(customEvent.detail);
      }
    };
    window.addEventListener('tamrediano_navigate', handleNav);
    return () => window.removeEventListener('tamrediano_navigate', handleNav);
  }, []);

  const handleNotificationClick = async () => {
    const playSound = () => {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.error("Audio block", e));
      } catch (e) {
        console.error("Audio error", e);
      }
    };

    playSound();
    
    // Fallback to in-app toast since browser notifications might be blocked
    setToast({ message: 'إشعارات تمريضيانو تعمل بامتياز! 🚀', visible: true });
    setTimeout(() => {
      setToast({ message: '', visible: false });
    }, 4000);

    // Also attempt native if available
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('تمريضيانو', {
          body: 'الإشعارات مفعلة وتعمل بنجاح!',
          icon: '/logo.png',
          dir: 'rtl'
        });
      } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    } catch(e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-cyan-500 rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <GraduationCap className="text-cyan-400" size={32} />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-pulse delay-700"></div>
        
        <div className="w-full max-w-xl relative z-10 p-6">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center mb-10"
          >
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="absolute inset-0 bg-cyan-500 rounded-full blur-[30px] opacity-20 animate-pulse"></div>
              <div className="w-full h-full bg-gradient-to-br from-slate-900 to-[#020617] p-1 rounded-full relative z-10 border border-slate-800 shadow-2xl flex items-center justify-center group overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <GraduationCap className="text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-transform duration-500 group-hover:scale-110" size={56} />
              </div>
            </div>
            <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-slate-400 mb-4 font-cairo tracking-tight drop-shadow-lg">تمريضيانو</h1>
            <p className="text-slate-400 font-cairo text-lg md:text-xl max-w-md mx-auto leading-relaxed">
              منصة المذاكرة الأذكى لطلاب التمريض. ذكاء اصطناعي يفهمك.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="bg-[#0f172a]/80 backdrop-blur-2xl p-8 md:p-12 rounded-[2.5rem] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group"
          >
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
            
            <div className="relative z-10 space-y-8">
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-bold text-white font-cairo tracking-tight">مرحباً بك</h2>
                <p className="text-slate-400 font-cairo text-sm">التسجيل باستخدام حساب جوجل الجامعي أو الشخصي</p>
              </div>

              <button 
                onClick={login}
                className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-4 font-cairo text-lg group/btn relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6 relative z-10 drop-shadow-sm" />
                <span className="relative z-10">المتابعة باستخدام Google</span>
                <LogIn className="relative z-10 group-hover/btn:-translate-x-2 transition-transform duration-300 text-cyan-400" size={22} />
              </button>

              <div className="flex items-center gap-4 text-slate-500">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10"></div>
                <span className="text-[11px] font-cairo uppercase tracking-widest bg-white/5 px-4 py-1 rounded-full">أو تصفح الميزات</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10"></div>
              </div>

              <div className="grid grid-cols-3 gap-3 md:gap-5">
                {[
                  { icon: Shield, label: 'أمان وتشفير', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { icon: Layout, label: 'واجهة عصرية', color: 'text-blue-400', bg: 'bg-blue-400/10' },
                  { icon: MessageSquare, label: 'ذكاء اصطناعي', color: 'text-indigo-400', bg: 'bg-indigo-400/10' }
                ].map((item, i) => (
                  <div key={i} className="text-center space-y-3 p-3 rounded-2xl hover:bg-white/5 transition-colors cursor-default">
                    <div className={`w-12 h-12 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center mx-auto shadow-inner`}>
                      <item.icon size={22} />
                    </div>
                    <p className="text-[11px] text-slate-400 font-cairo font-bold tracking-tight">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
          
          <p className="text-center mt-12 text-slate-600 text-sm font-cairo tracking-wide">
            جميع الحقوق محفوظة لفريق <span className="font-bold text-cyan-900">تمريضيانو</span> © 2026
          </p>
        </div>
      </div>
    );
  }

  if (profile?.role === 'banned') {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Terrifying Background Elements */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.03)_2px,transparent_2px),linear-gradient(90deg,rgba(239,68,68,0.03)_2px,transparent_2px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]"></div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-red-600/20 blur-[150px] rounded-full animate-pulse"
        />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-red-900/40 blur-[150px] rounded-full animate-pulse"
        />

        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", duration: 0.8, bounce: 0.5 }}
          className="bg-[#0f172a]/90 backdrop-blur-3xl p-10 md:p-14 rounded-[3rem] border-2 border-red-500/50 shadow-[0_0_100px_rgba(239,68,68,0.25)] text-center max-w-xl w-full relative z-10 overflow-hidden"
        >
          {/* Animated Scanline */}
          <motion.div 
            animate={{ y: ["-100%", "200%"] }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            className="absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-red-500/10 to-transparent opacity-50 pointer-events-none"
          />

          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1, rotate: [0, -10, 10, -10, 10, 0] }}
            transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
            className="w-32 h-32 bg-gradient-to-br from-red-500/20 to-red-900/40 rounded-full flex items-center justify-center mx-auto mb-8 relative border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.4)]"
          >
            <div className="absolute inset-0 rounded-full border-t-2 border-red-500 animate-spin" style={{ animationDuration: '3s' }}></div>
            <Ban className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" size={64} />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-red-400 font-cairo tracking-tight mb-4 uppercase drop-shadow-lg">
              تم حظر الحساب
            </h2>
            <div className="h-1 w-24 bg-red-500/50 mx-auto rounded-full mb-6 shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
          </motion.div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-slate-300 font-cairo text-lg mb-10 leading-relaxed relative z-10"
          >
            عذراً، الوصول مرفوض <span className="text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded-md animate-pulse ml-1 inline-block">ACCESS DENIED</span>
            <br/><br/>
            تم إيقاف حسابك من قبل إدارة منصة تمريضيانو لانتهاك الشروط أو لأسباب إدارية. 
            <br/>
            <span className="text-sm text-slate-500 mt-6 block border-t border-red-500/20 pt-4">إذا كنت تعتقد أن هذا الإجراء تم عن طريق الخطأ، يرجى التواصل مع الدعم الفني.</span>
          </motion.p>
          
          <motion.button 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={logout}
            className="w-full py-5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold rounded-2xl transition-all font-cairo flex justify-center items-center gap-3 shadow-[0_0_30px_rgba(239,68,68,0.4)] hover:shadow-[0_0_50px_rgba(239,68,68,0.6)] text-xl group relative overflow-hidden border border-red-400/30"
          >
            <LogOut size={24} className="relative z-10 group-hover:-translate-x-1 transition-transform" />
            <span className="relative z-10">الخروج من المنصة</span>
          </motion.button>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: 'study', label: 'المذاكرة الذكية', icon: GraduationCap },
    { id: 'library', label: 'مكتبة الملفات', icon: Library },
    { id: 'tamrediano_library', label: 'مكتبة تمريضيانو', icon: FolderOpen },
    { id: 'settings', label: 'الإعدادات', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-cairo">
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden md:block">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={handleTabChange} 
          isAdmin={profile?.role === 'admin'} 
          logoUrl={appConfig?.logoBase64}
        />
      </div>

      {/* Mobile Top Header (Just Logo) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#020617]/90 backdrop-blur-xl border-b border-white/5 z-40 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20 overflow-hidden relative">
            {appConfig?.logoBase64 ? (
              <img src={appConfig.logoBase64} alt="Logo" className="w-full h-full object-cover z-20 absolute inset-0" />
            ) : null}
            <GraduationCap className="text-white relative z-10" size={20} />
          </div>
          <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 text-xl tracking-tight font-cairo">تمريضيانو</span>
        </div>
        <img src={profile?.photoURL} onClick={logout} alt="Avatar" className="w-9 h-9 rounded-full object-cover border border-white/10 cursor-pointer" />
      </div>

      {/* Mobile Bottom Navigation (App Bar) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-[80px] bg-[#020617]/95 backdrop-blur-2xl border-t border-white/10 z-50 px-2 pb-safe flex justify-around items-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${isActive ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {isActive && (
                <div className="absolute top-0 w-10 h-1 bg-cyan-500 rounded-b-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
              )}
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-cyan-500/10 scale-110' : ''}`}>
                <tab.icon size={22} className={isActive ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : ''} />
              </div>
              <span className={`text-[10px] font-cairo font-bold transition-all ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {tab.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
        {profile?.role === 'admin' && (
          <button
            onClick={() => handleTabChange('admin')}
            className={`relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${activeTab === 'admin' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {activeTab === 'admin' && (
              <div className="absolute top-0 w-10 h-1 bg-amber-500 rounded-b-full shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
            )}
            <div className={`p-1.5 rounded-xl transition-all duration-300 ${activeTab === 'admin' ? 'bg-amber-500/10 scale-110' : ''}`}>
              <Shield size={22} className={activeTab === 'admin' ? 'drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : ''} />
            </div>
            <span className={`text-[10px] font-cairo font-bold transition-all ${activeTab === 'admin' ? 'opacity-100' : 'opacity-70'}`}>
              الإدارة
            </span>
          </button>
        )}
      </div>
      
      <main className="flex-1 overflow-y-auto p-4 md:p-10 relative pb-28 md:pb-10 mt-16 md:mt-0 bg-[#020617] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.05),rgba(255,255,255,0))]">
        <AnimatePresence>
          {toast.visible && (
            <motion.div 
              initial={{ opacity: 0, y: -50, x: '-50%' }}
              animate={{ opacity: 1, y: 30, x: '-50%' }}
              exit={{ opacity: 0, y: -50, x: '-50%' }}
              className="fixed top-0 left-1/2 z-[100] px-6 py-4 bg-[#0f172a] border border-cyan-500/50 rounded-2xl shadow-[0_10px_40px_rgba(34,211,238,0.2)] flex items-center gap-4"
            >
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center relative">
                <Bell size={16} className="text-cyan-400 animate-bounce" />
                <div className="absolute inset-0 border-2 border-cyan-400 rounded-full animate-ping opacity-50"></div>
              </div>
              <p className="text-white font-bold font-cairo text-sm md:text-base">{toast.message}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto">
          <header className="mb-12 hidden md:flex justify-between items-center p-6 rounded-[2rem] border border-white/5 shadow-2xl relative overflow-hidden">
            {/* Background Image Setup */}
            <div 
              className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-screen"
              style={{ backgroundImage: `url('${appConfig?.bgBase64 || '/bg.png'}')` }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-l from-[#020617] via-[#020617]/80 to-transparent z-0"></div>
            
            <div className="flex items-center gap-6 relative z-10">
              <div className="relative w-16 h-16 group">
                <div className="absolute inset-0 bg-cyan-500 rounded-2xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity duration-300"></div>
                <div className="relative w-full h-full bg-[#020617] rounded-2xl shadow-inner border border-white/10 overflow-hidden flex items-center justify-center">
                  {/* Handle logo display safely without mutating DOM styles on error */}
                  {appConfig?.logoBase64 ? (
                    <img src={appConfig.logoBase64} alt="Logo" className="absolute inset-0 w-full h-full object-cover z-20" />
                  ) : null}
                  <GraduationCap className="text-white drop-shadow-md relative z-10" size={32} />
                </div>
              </div>
              <div>
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-200 tracking-tight font-cairo drop-shadow-lg">تمريضيانو بريميوم</h1>
                <p className="text-slate-300 text-lg mt-1 font-cairo flex items-center gap-2 drop-shadow-md">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                  أهلاً بك يا <span className="text-white font-bold">{profile?.displayName}</span>.. جاهز للإبداع اليوم؟
                </p>
              </div>
            </div>
            <div className="flex items-center gap-5 relative z-10">
              <button 
                onClick={handleNotificationClick}
                className="p-3.5 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 transition-all relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Bell size={22} className="text-slate-300 group-hover:text-white transition-colors relative z-10" />
                <div className="absolute top-3.5 right-3.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#1e293b] shadow-[0_0_8px_rgba(244,63,94,0.8)] z-20"></div>
              </button>
              <div className="h-10 w-px bg-white/10 mx-2"></div>
              <div className="flex items-center gap-4 bg-white/5 p-2 pr-5 rounded-2xl border border-white/10 shadow-inner hover:bg-white/10 transition-colors cursor-pointer">
                <div className="text-right">
                  <p className="text-sm font-bold text-white leading-none font-cairo">{profile?.displayName}</p>
                  <p className="text-[10px] text-cyan-400 uppercase tracking-widest mt-1.5 font-bold">{profile?.role}</p>
                </div>
                <div className="relative">
                  <img src={profile?.photoURL} alt="avatar" className="w-12 h-12 rounded-xl object-cover border-2 border-slate-700 shadow-lg" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 bg-green-500 border-2 border-[#020617] rounded-full"></div>
                </div>
              </div>
            </div>
          </header>

          <div className="relative">
            <AnimatePresence mode="wait">
              {/* Optional: You can keep AnimatePresence for transitions, but to persist we just render them hidden */}
            </AnimatePresence>
            
            <div className={activeTab === 'study' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
              <StudyGenerator 
                globalFiles={globalFiles} 
                setGlobalFiles={setGlobalFiles} 
              />
            </div>
            <div className={activeTab === 'library' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
              <FileLibrary />
            </div>
            <div className={activeTab === 'tamrediano_library' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
              <TamredianoLibrary />
            </div>
            {profile?.role === 'admin' && (
              <div className={activeTab === 'admin' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
                <AdminPanel />
              </div>
            )}
            <div className={activeTab === 'settings' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
              <SettingsPanel />
            </div>
          </div>
        </div>

        {/* Floating Bot Button */}
        <div className="fixed bottom-[90px] right-4 md:bottom-10 md:right-10 z-50">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowBot(!showBot)}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-[1rem] md:rounded-3xl shadow-2xl flex items-center justify-center transition-all duration-500 ${
              showBot 
                ? 'bg-white text-slate-900 rotate-90' 
                : 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-cyan-500/40'
            }`}
          >
            {showBot ? <X className="w-6 h-6 md:w-8 md:h-8" /> : <MessageSquare className="w-6 h-6 md:w-8 md:h-8" />}
          </motion.button>
          
          <AnimatePresence>
            {showBot && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="absolute bottom-16 md:bottom-20 right-0 w-[calc(100vw-2rem)] max-w-[360px] md:max-w-none md:w-[400px] shadow-3xl"
              >
                <div className="bg-[#0f172a] rounded-[2rem] md:rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl h-[450px] md:h-[600px]">
                  <WelcomeBot onComplete={() => {}} isPersistent={true} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
