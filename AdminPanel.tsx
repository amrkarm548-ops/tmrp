import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc, setDoc, updateDoc, handleFirestoreError, OperationType, query, orderBy, addDoc, deleteDoc } from '../firebase';
import { Shield, Users, FileText, Activity, Settings, Key, AlertTriangle, Save, Trash2, Ban, CheckCircle, TrendingUp, BarChart3, MessageSquare, Layout, Sparkles, Cpu, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { getPrimaryKey, PROMPTS, GLOBAL_CONSTRAINTS } from '../services/aiService';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../lib/utils';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
  feedback: string[];
  createdAt: string;
}

interface GeneratedFile {
  type: string;
  createdAt: unknown;
}

interface GlobalConfig {
  dynamicPromptTuning: string;
  totalUsers: number;
  totalFiles: number;
  customPrompts?: Record<string, string>;
  telegramBotToken?: string;
}

interface FeedbackItem {
  id: string; // The feedback string itself, or index
  text: string;
  user: string;
  email: string;
  uid: string;
}

interface ApiKeyItem {
  id: string;
  key: string;
  addedBy: string;
  usageCount: number;
  status: 'active' | 'exhausted' | 'invalid';
  createdAt: unknown;
}

export const AdminPanel: React.FC = () => {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filesData, setFilesData] = useState<GeneratedFile[]>([]);
  const [config, setConfig] = useState<GlobalConfig & { logoBase64?: string, bgBase64?: string }>({ dynamicPromptTuning: '', totalUsers: 0, totalFiles: 0 });
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [promptReports, setPromptReports] = useState<any[]>([]);
  const [newKey, setNewKey] = useState('');
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'ai' | 'feedback' | 'customization'>('stats');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [confirmingKeyId, setConfirmingKeyId] = useState<string | null>(null);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  useEffect(() => {
    // Fetch Users
    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));

    // Fetch Global Config
    const configUnsubscribe = onSnapshot(doc(db, 'config', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setConfig(snapshot.data() as GlobalConfig);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'config/global'));

    // Fetch Files to get real stats
    const filesUnsubscribe = onSnapshot(query(collection(db, 'files'), orderBy('createdAt', 'desc')), (snapshot) => {
      const fData = snapshot.docs.map(doc => doc.data() as GeneratedFile);
      setFilesData(fData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'files'));

    // Fetch API Keys
    const keysUnsubscribe = onSnapshot(collection(db, 'api_keys'), (snapshot) => {
      const kData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ApiKeyItem);
      setApiKeys(kData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'api_keys'));

    // Fetch Prompt Reports
    const reportsUnsubscribe = onSnapshot(query(collection(db, 'prompt_reports'), orderBy('createdAt', 'desc')), (snapshot) => {
      const rData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPromptReports(rData);
    }, (error) => console.log('No prompt reports collection yet or permission error', error));

    return () => {
      usersUnsubscribe();
      configUnsubscribe();
      filesUnsubscribe();
      keysUnsubscribe();
      reportsUnsubscribe();
    };
  }, []);

  // Sync memory to backend bot
  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    const syncData = async () => {
      try {
        await fetch('/api/internal/bot-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keys: apiKeys.map(k => k.key),
            totalUsers: users.length,
            totalFiles: filesData.length,
            activeKeysCount: apiKeys.filter(k => k.status === 'active').length
          })
        });
      } catch (err) {
        console.warn("Failed to sync bot memory");
      }
    };
    syncData();
  }, [users.length, filesData.length, apiKeys, profile]);

  const handleSaveConfig = async () => {
    try {
      await setDoc(doc(db, 'config', 'global'), config, { merge: true });
      showMessage('تم حفظ الإعدادات بنجاح!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'config/global');
      showMessage('خطأ في الحفظ.', 'error');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, key: 'logoBase64' | 'bgBase64') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showMessage('عفواً، حجم الصورة يجب ألا يتعدى 2 ميجابايت', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setConfig({ ...config, [key]: event.target.result as string });
          showMessage('تم رفع الصورة بنجاح (لا تنسى الضغط على حفظ)', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addEmergencyKey = async () => {
    if (!newKey.trim() || !profile) return;
    try {
      await addDoc(collection(db, 'api_keys'), {
        key: newKey.trim(),
        addedBy: profile.uid,
        usageCount: 0,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      setNewKey('');
      showMessage('تمت الإضافة بنجاح', 'success');
    } catch (e) {
      console.error(e);
      showMessage('خطأ في إضافة المفتاح.', 'error');
    }
  };

  const removeEmergencyKey = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'api_keys', id));
      setConfirmingKeyId(null);
      showMessage('تم الحذف بنجاح', 'success');
    } catch (e) {
      console.error(e);
      showMessage('خطأ في حذف المفتاح.', 'error');
    }
  };

  const markFeedbackResolved = async (uid: string, text: string) => {
    try {
      const userDoc = users.find(u => u.uid === uid);
      if (userDoc) {
        const newFeedback = userDoc.feedback.filter(f => f !== text);
        await updateDoc(doc(db, 'users', uid), { feedback: newFeedback });
        showMessage('تم مسح البلاغ', 'success');
      }
    } catch (error) {
      console.error(error);
      showMessage('خطأ في مسح البلاغ', 'error');
    }
  };

  const makeDefaultPrompt = async (text: string, reportId: string) => {
    try {
      await setDoc(doc(db, 'config', 'global'), { dynamicPromptTuning: text }, { merge: true });
      await updateDoc(doc(db, 'prompt_reports', reportId), { status: 'resolved' });
      showMessage('تم تعيين التعليمات وتوثيق البلاغ بنجاح!', 'success');
    } catch (e) {
      showMessage('حدث خطأ أثناء التحديث', 'error');
    }
  };

  const markPromptReportResolved = async (id: string, suggestion?: string) => {
    try {
      await updateDoc(doc(db, 'prompt_reports', id), { status: 'ignored' });
      if (suggestion && config.dynamicPromptTuning === suggestion) {
        setConfig({ ...config, dynamicPromptTuning: '' });
        await setDoc(doc(db, 'config', 'global'), { dynamicPromptTuning: '' }, { merge: true });
      }
      showMessage('تم تجاهل البلاغ وبنجاح', 'success');
    } catch (error) {
      console.error(error);
      showMessage('خطأ في أرشفة البلاغ', 'error');
    }
  };

  const toggleUserRole = async (userDoc: UserProfile) => {
    if (userDoc.uid === profile?.uid) {
      showMessage('لا يمكنك تغيير رتبة نفسك!', 'error');
      return;
    }
    const newRole = userDoc.role === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'users', userDoc.uid), { role: newRole });
      showMessage('تم التحديث بنجاح', 'success');
    } catch (e) {
      console.error(e);
      showMessage('حدث خطأ أثناء تعديل الصلاحيات', 'error');
    }
  };

  const toggleUserBan = async (userDoc: UserProfile) => {
    if (userDoc.uid === profile?.uid) {
      showMessage('لا يمكنك حظر نفسك!', 'error');
      return;
    }
    if (userDoc.role === 'admin') {
      showMessage('لا يمكن حظر مشرف!', 'error');
      return;
    }
    const newRole = userDoc.role === 'banned' ? 'user' : 'banned';
    try {
      await updateDoc(doc(db, 'users', userDoc.uid), { role: newRole });
      showMessage(`تم ${newRole === 'banned' ? 'حظر' : 'فك حظر'} المستخدم بنجاح`, 'success');
    } catch (e) {
      console.error(e);
      showMessage('حدث خطأ أثناء تعديل حالة الحظر', 'error');
    }
  };

  const getWeeklyUsers = () => {
    const defaultData = [
      { name: 'السبت', users: 0 }, { name: 'الأحد', users: 0 }, { name: 'الاث.', users: 0 },
      { name: 'الثل.', users: 0 }, { name: 'الأرب.', users: 0 }, { name: 'الخم.', users: 0 }, { name: 'الجم.', users: 0 }
    ];
    users.forEach(u => {
      if (!u.createdAt) return;
      const d = new Date(u.createdAt);
      if(!isNaN(d.getTime())) {
        const day = (d.getDay() + 1) % 7; // Map so Saturday is 0
        defaultData[day].users += 1;
      }
    });
    return defaultData;
  };

  const chartData = getWeeklyUsers();

  const getFileDistribution = () => {
    const counts: Record<string, number> = { 'BONBONAYA': 0, 'EXTRACTS': 0, 'MCQ_MAKER': 0, 'NCLEX': 0, 'CHEAT_SHEET': 0, 'ZERO_KNOWLEDGE': 0 };
    filesData.forEach(f => {
      if (counts[f.type] !== undefined) counts[f.type]++;
    });
    return [
      { name: 'بونبوناية', value: counts['BONBONAYA'] },
      { name: 'مستخرجات', value: counts['EXTRACTS'] },
      { name: 'بنك أسئلة', value: counts['MCQ_MAKER'] },
      { name: 'NCLEX', value: counts['NCLEX'] },
      { name: 'برشامة', value: counts['CHEAT_SHEET'] },
      { name: 'من الصفر', value: counts['ZERO_KNOWLEDGE'] },
    ].filter(item => item.value > 0);
  };
  const distributionData = getFileDistribution();

  const feedbackList: FeedbackItem[] = users.flatMap(u => (u.feedback || []).map(f => ({ text: f, user: u.displayName, email: u.email, uid: u.uid })));

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8 bg-black/10 rounded-3xl text-center">
        <div>
          <Ban className="text-red-500 w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-red-500 font-cairo">لا تملك صلاحيات الدخول</h2>
          <p className="text-slate-400 mt-2 font-cairo">هذه الصفحة مخصصة للإدارة فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 relative">
      <AnimatePresence>
        {msg.text && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full font-bold font-cairo shadow-xl ${
              msg.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-bold uppercase tracking-widest mb-3 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <Shield size={14} />
            بوابة المشرفين
          </div>
          <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-500 font-cairo tracking-tight drop-shadow-sm">
            لوحة القيادة
          </h2>
          <p className="text-slate-400 font-cairo mt-3 text-lg max-w-xl">
            مراقبة النشاط العام، إدارة المستخدمين، وتوجيه الذكاء الاصطناعي بدقة عالية.
          </p>
        </div>
        
        <div className="w-full grid grid-cols-2 lg:flex lg:flex-row gap-1.5 bg-[#0f172a]/80 backdrop-blur-xl p-2 rounded-[1.25rem] border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
          {[
            { id: 'stats', icon: Activity, label: 'الإحصائيات' },
            { id: 'users', icon: Users, label: 'المستخدمين' },
            { id: 'ai', icon: Settings, label: 'الذكاء (AI)' },
            { id: 'customization', icon: Layout, label: 'تخصيص' },
            { id: 'feedback', icon: MessageSquare, label: 'البلاغات' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'stats' | 'users' | 'ai' | 'customization' | 'feedback')}
              className={`flex justify-center items-center gap-2 px-3 py-3 lg:px-5 lg:py-2.5 rounded-xl transition-all font-bold font-cairo text-sm relative ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-[#020617] shadow-lg shadow-amber-500/30' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabAdmin" className="absolute inset-0 border-2 border-amber-300 rounded-xl opacity-50"></motion.div>
              )}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'stats' && (
          <motion.div 
            key="stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8 relative z-10"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              {[
                { label: 'إجمالي المستخدمين', value: users.length, icon: Users, gradient: 'from-blue-600 to-indigo-600', shadow: 'shadow-blue-500/20' },
                { label: 'الملفات المولدة', value: filesData.length, icon: FileText, gradient: 'from-cyan-500 to-teal-500', shadow: 'shadow-cyan-500/20' },
                { label: 'بلاغات المستخدمين', value: feedbackList.length, icon: MessageSquare, gradient: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/20' },
              ].map((stat, i) => (
                <div key={i} className="relative overflow-hidden glass p-8 rounded-[2rem] border-white/5 group hover:-translate-y-1 transition-transform duration-300 shadow-xl">
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.gradient} blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity`}></div>
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <p className="text-slate-400 font-cairo text-sm uppercase tracking-widest mb-2 font-bold">{stat.label}</p>
                      <h3 className="text-5xl font-black text-white drop-shadow-md">{stat.value.toLocaleString()}</h3>
                    </div>
                    <div className={`w-16 h-16 bg-gradient-to-br ${stat.gradient} rounded-[1.25rem] flex items-center justify-center text-white shadow-lg ${stat.shadow} group-hover:scale-110 transition-transform duration-300`}>
                      <stat.icon size={32} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[#0f172a]/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.3)] space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white font-cairo flex items-center gap-3">
                    <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400"><TrendingUp size={20} /></div>
                    نشاط المستخدمين الأسبوعي
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontFamily: 'Cairo', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                        itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="users" stroke="#22d3ee" strokeWidth={4} fillOpacity={1} fill="url(#colorUsers)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#0f172a]/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.3)] space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white font-cairo flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400"><BarChart3 size={20} /></div>
                    توزيع أنواع الملفات
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distributionData.length > 0 ? distributionData : [{ name: 'لا توجد ملفات', value: 0 }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', fontFamily: 'Cairo', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                        cursor={{fill: '#ffffff05'}}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {[0,1,2,3,4].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#22d3ee', '#818cf8', '#fbbf24', '#f43f5e', '#34d399'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[#0f172a]/90 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
              <h3 className="text-xl font-bold text-white font-cairo flex items-center gap-3">
                <Users className="text-blue-400" size={24} />
                قائمة المستخدمين المسجلين
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-black/20 text-slate-400 font-cairo text-sm">
                    <th className="p-6 font-bold tracking-widest uppercase">المستخدم</th>
                    <th className="p-6 font-bold tracking-widest uppercase">البريد الإلكتروني</th>
                    <th className="p-6 font-bold tracking-widest uppercase">الرتبة</th>
                    <th className="p-6 font-bold tracking-widest uppercase">تاريخ الانضمام</th>
                    <th className="p-6 font-bold tracking-widest uppercase">نشاط وتفاعل</th>
                    <th className="p-6 font-bold tracking-widest uppercase">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((user) => (
                    <tr key={user.uid} className="hover:bg-white/[0.04] transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <img src={user.photoURL} alt="" className="w-12 h-12 rounded-2xl object-cover border border-white/10 shadow-lg" />
                            {user.role === 'admin' && <div className="absolute -top-2 -right-2 bg-amber-500 text-black p-1 rounded-full shadow-md"><Shield size={10} /></div>}
                          </div>
                          <div>
                            <span className="font-bold text-white font-cairo block text-lg">{user.displayName}</span>
                            <span className="text-xs text-slate-500 font-mono">UID: {user.uid.substring(0,8)}...</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 text-slate-300 font-mono text-sm">{user.email}</td>
                      <td className="p-6">
                        <span className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border ${
                          user.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]' : user.role === 'banned' ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                          {user.role === 'banned' ? 'محظور' : user.role}
                        </span>
                      </td>
                      <td className="p-6 text-slate-400 font-cairo text-sm whitespace-nowrap">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="p-6 space-y-2 dir-rtl">
                        <div className="flex items-center justify-end gap-2 text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-xl text-[11px] font-bold font-cairo w-full">
                          <FileText size={12} />
                          {filesData.filter(f => f.createdBy === user.uid).length} ملف مباع/مولد
                        </div>
                        <div className="flex items-center justify-end gap-2 text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl text-[11px] font-bold font-cairo w-full">
                          <MessageSquare size={12} />
                          {(promptReports.filter(pr => pr.userEmail === user.email).length) + (user.feedback?.length || 0)} بلاغ
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => toggleUserRole(user)}
                            className="p-2.5 bg-white/5 hover:bg-amber-500 hover:text-black hover:shadow-[0_0_15px_rgba(245,158,11,0.5)] text-slate-300 rounded-xl transition-all"
                            title="تغيير الرتبة"
                          >
                            <Shield size={18} />
                          </button>
                          <button 
                            onClick={() => toggleUserBan(user)}
                            className={`p-2.5 rounded-xl transition-all ${user.role === 'banned' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-white/5 hover:bg-red-500 hover:text-white hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] text-slate-300'}`} 
                            title={user.role === 'banned' ? 'فك الحظر' : 'حظر'}
                          >
                            <Ban size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'ai' && (
          <motion.div 
            key="ai"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 gap-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Dynamic Prompt Tuning */}
              <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8">
                <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                  <Settings className="text-cyan-400" size={28} />
                  <h3 className="text-2xl font-bold text-white font-cairo">تعديل ذكاء المنصة (Dynamic Tuning)</h3>
                </div>
                
                <div className="space-y-4">
                  <p className="text-slate-400 font-cairo leading-relaxed">
                    اكتب هنا أي تعليمات إضافية عايز الذكاء الاصطناعي يلتزم بيها في كل العمليات (توليد ملفات، شات، أسئلة).
                    دي بتساعد في تصحيح الأخطاء اللي المستخدمين بيبلغوا عنها.
                  </p>
                  <textarea 
                    value={config.dynamicPromptTuning}
                    onChange={(e) => setConfig({ ...config, dynamicPromptTuning: e.target.value })}
                    placeholder="مثال: يرجى تقليل استخدام الكلمات المعقدة في الشرح المصري..."
                    className="w-full bg-white/5 border border-white/10 rounded-[2rem] p-6 text-white outline-none focus:border-cyan-500 font-cairo text-lg min-h-[200px]"
                  />
                  <button 
                    onClick={handleSaveConfig}
                    className="w-full py-5 bg-cyan-500 hover:bg-cyan-400 text-[#020617] font-bold rounded-2xl transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-3 font-cairo text-xl"
                  >
                    <Save size={24} />
                    حفظ التعديلات الذكية
                  </button>
                </div>
              </div>

              {/* Emergency Keys */}
              <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8">
                <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                  <Key className="text-amber-500" size={28} />
                  <h3 className="text-2xl font-bold text-white font-cairo">مفاتيح الطوارئ (Emergency Keys)</h3>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-3">
                    <input 
                      type="password"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="أضف مفتاح Gemini جديد..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500 font-mono text-sm"
                    />
                    <button 
                      onClick={addEmergencyKey}
                      className="px-8 bg-amber-500 hover:bg-amber-400 text-[#020617] font-bold rounded-2xl transition-all"
                    >
                      إضافة
                    </button>
                  </div>

                  <div className="space-y-3">
                    {getPrimaryKey() && (
                      <div className="flex items-center justify-between p-4 bg-cyan-500/5 rounded-2xl border border-cyan-500/20 group">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <span className="text-cyan-400 font-mono text-sm leading-none bg-cyan-500/10 px-2 py-1 rounded-md">
                              المفتاح الأساسي (مسجل في الكود)
                            </span>
                            <span className="text-slate-300 font-mono text-sm">
                              {getPrimaryKey()!.substring(0, 10)}...{getPrimaryKey()!.substring(getPrimaryKey()!.length - 8)}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-500/10 text-green-400">
                              نشط افتراضياً
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-cairo">
                            عدد الاستخدامات: <span className="font-mono text-cyan-400">غير محدود</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {apiKeys.map((k) => (
                      <div key={k.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-300 font-mono text-sm">
                              {k.key.substring(0, 10)}...{k.key.substring(k.key.length - 8)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              k.status === 'active' 
                                ? 'bg-green-500/20 text-green-400 border-green-500/20' 
                                : k.status === 'exhausted' 
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' 
                                : 'bg-red-500/20 text-red-400 border-red-500/20'
                            }`}>
                              {k.status === 'active' ? 'نشط (Active)' : k.status === 'exhausted' ? 'مستنفد (Exhausted)' : 'غير صالح (Invalid)'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-cairo">
                            عدد الاستخدامات: <span className="font-mono text-cyan-400">{k.usageCount}</span>
                          </div>
                        </div>
                        <button 
                          onClick={() => confirmingKeyId === k.id ? removeEmergencyKey(k.id) : setConfirmingKeyId(k.id)}
                          onMouseLeave={() => setConfirmingKeyId(null)}
                          className={`p-2 rounded-xl transition-all ${
                            confirmingKeyId === k.id ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-red-500/10'
                          }`}
                        >
                          {confirmingKeyId === k.id ? <span className="text-[10px] font-bold font-cairo">تأكيد</span> : <Trash2 size={18} />}
                        </button>
                      </div>
                    ))}
                    {apiKeys.length === 0 && (
                      <div className="text-center py-10 text-slate-600 font-cairo">
                        <AlertTriangle className="mx-auto mb-2 opacity-20" size={48} />
                        مفيش مفاتيح طوارئ حالياً
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Telegram Bot Setting */}
              <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8 lg:col-span-2">
                <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                  <Bot className="text-blue-400" size={28} />
                  <h3 className="text-2xl font-bold text-white font-cairo">ربط وإدارة بوت تيليجرام</h3>
                </div>
                
                <div className="space-y-4">
                  <p className="text-slate-400 font-cairo leading-relaxed">
                    من خلال ربط الموقع ببوت تيليجرام، يمكنك التحكم بالكامل في المنصة (إضافة مفاتيح، استخراج تقارير، إرسال أوامر، تحكم في البرومبت المعتمد) وذلك برسالة من هاتفك فقط. كل ما عليك هو إدخال التوكن واسمه ومراسلة البوت ومتابعته!
                  </p>
                  
                  <div className="flex gap-4 items-center">
                    <input 
                      type="password"
                      value={config.telegramBotToken || ''}
                      onChange={(e) => setConfig({ ...config, telegramBotToken: e.target.value })}
                      placeholder="أدخل توكن بوت التيليجرام الخاص بك (مثال: 8773917319:AAG-...)"
                      className="flex-1 bg-white/5 border border-white/10 rounded-[2rem] p-6 text-white outline-none focus:border-blue-500 font-mono text-lg transition-all"
                    />
                    <button 
                      onClick={handleSaveConfig}
                      className="px-10 py-5 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-[2rem] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 font-cairo text-xl"
                    >
                      <Save size={24} />
                      حفظ
                    </button>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-start gap-4">
                     <AlertTriangle className="text-blue-400 shrink-0 mt-1" size={24} />
                     <div>
                       <h4 className="font-bold text-blue-400 font-cairo text-lg mb-1">كيف يعمل البوت؟</h4>
                       <p className="text-slate-300 font-cairo text-sm leading-relaxed">
                          بمجرد حفظ التوكن الخاص بالـ Bot من (BotFather)، وتوفر استضافة داعمة للنود.js المستمر سيعمل النظام. وفي بيئة AI Studio قمنا بتنشيط نظام الاستماع الخلفي. أرسل رسالة للبوت وسيستخدم الذكاء الاصطناعي لفهم طلبك والتفاعل مع قواعد بيانات الموقع مباشرةً.
                       </p>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Individual AI Prompts Editors */}
            <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8">
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <Cpu className="text-purple-400" size={28} />
                <h3 className="text-2xl font-bold text-white font-cairo">إدارة التعليمات البرمجية لكل موديل (Prompts Manager)</h3>
              </div>
              <p className="text-slate-400 font-cairo mb-6">
                هنا يمكنك تعديل التعليمات الأساسية (البرومبت) الخاصة بكل أداة في المنصة لتخصيص نتائجها بشكل دقيق. اترك المربع فارغاً للعودة للتعليمات الافتراضية.
              </p>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Global Constraints */}
                <div className="space-y-3 xl:col-span-2">
                  <label className="text-white font-bold font-cairo flex items-center gap-2">الشخصية الأساسية والقيود العامة (Global Constraints)</label>
                  <textarea 
                    value={config.customPrompts?.GLOBAL || GLOBAL_CONSTRAINTS}
                    onChange={(e) => setConfig({ ...config, customPrompts: { ...config.customPrompts, GLOBAL: e.target.value } })}
                    className="w-full bg-[#0f172a] border border-white/10 rounded-[2rem] p-6 text-slate-300 outline-none focus:border-purple-500 font-mono text-sm min-h-[250px]"
                    dir="ltr"
                  />
                </div>

                {/* Module Editors */}
                {Object.entries(PROMPTS).map(([key, defaultPrompt]) => (
                  <div key={key} className="space-y-3 bg-white/5 p-6 rounded-[2rem] border border-white/5">
                    <label className="text-cyan-400 font-bold font-cairo block mb-2">{key} (التعليمات المخصصة للموديول)</label>
                    <textarea 
                      value={config.customPrompts?.[key] ?? defaultPrompt.replace(GLOBAL_CONSTRAINTS, '')}
                      onChange={(e) => setConfig({ ...config, customPrompts: { ...config.customPrompts, [key]: e.target.value } })}
                      className="w-full bg-[#020617]/50 border border-white/10 rounded-2xl p-4 text-slate-300 outline-none focus:border-cyan-500 font-mono text-sm min-h-[200px]"
                      dir="ltr"
                    />
                  </div>
                ))}
              </div>

              <button 
                onClick={handleSaveConfig}
                className="w-full py-5 bg-purple-500 hover:bg-purple-400 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-500/20 flex items-center justify-center gap-3 font-cairo text-xl mt-8"
              >
                <Save size={24} />
                حفظ تعليمات الموديلات
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'customization' && (
          <motion.div 
            key="customization"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {/* Logo Settings */}
            <div className="glass p-10 rounded-[2.5rem] border-white/5 space-y-8">
              <div className="flex items-center gap-4 border-b border-white/5 pb-6">
                <Layout className="text-cyan-400" size={28} />
                <h3 className="text-2xl font-bold text-white font-cairo">تخصيص الصور والشعار</h3>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <p className="text-slate-400 font-cairo text-lg">شعار الموقع (Logo):</p>
                  <label className="flex items-center justify-center w-full min-h-[150px] bg-white/5 border-2 border-dashed border-white/10 hover:border-cyan-500/50 rounded-[2rem] cursor-pointer transition-colors relative overflow-hidden group">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'logoBase64')} className="hidden" />
                    {config.logoBase64 ? (
                      <div className="absolute inset-0 p-4 flex items-center justify-center bg-[#020617]/80">
                         <img src={config.logoBase64} alt="Preview" className="h-full object-contain drop-shadow-2xl" />
                      </div>
                    ) : (
                      <span className="font-cairo text-slate-500 font-bold group-hover:text-cyan-400">اضغط لرفع الشعار</span>
                    )}
                  </label>
                </div>

                <div className="space-y-3">
                  <p className="text-slate-400 font-cairo text-lg">صورة الخلفية العلوية (Premium Banner):</p>
                  <label className="flex items-center justify-center w-full min-h-[150px] bg-white/5 border-2 border-dashed border-white/10 hover:border-amber-500/50 rounded-[2rem] cursor-pointer transition-colors relative overflow-hidden group">
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'bgBase64')} className="hidden" />
                    {config.bgBase64 ? (
                      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${config.bgBase64})` }}></div>
                    ) : (
                      <span className="font-cairo text-slate-500 font-bold group-hover:text-amber-400">اضغط لرفع الخلفية</span>
                    )}
                  </label>
                </div>

                <button 
                  onClick={handleSaveConfig}
                  className="w-full py-5 bg-cyan-500 hover:bg-cyan-400 text-[#020617] font-bold rounded-2xl transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-3 font-cairo text-xl"
                >
                  <Save size={24} />
                  حفظ الصور والتعديلات
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'feedback' && (
          <motion.div 
            key="feedback"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            {/* AI Prompts Suggestions Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <Sparkles className="text-amber-500" size={24} />
                <h3 className="text-xl font-bold text-white font-cairo">بلاغات تعديل وسلوك الذكاء الاصطناعي (المتحكم الذكي)</h3>
              </div>
              
              {promptReports.filter(pr => pr.status === 'pending').map((pr, i) => (
                <div key={pr.id} className="glass p-8 rounded-[2rem] border-amber-500/20 space-y-4 bg-amber-500/5">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
                        <Cpu size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white font-cairo">{pr.userName}</h4>
                        <p className="text-xs text-slate-500 font-mono">{pr.userEmail}</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full font-bold uppercase tracking-widest">اقتراح ذكي جديد</span>
                  </div>
                  <p className="text-amber-200 font-cairo text-lg leading-relaxed bg-[#020617]/50 p-6 rounded-2xl border border-amber-500/10">
                    {pr.promptSuggestion}
                  </p>
                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={() => makeDefaultPrompt(pr.promptSuggestion, pr.id)} className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-[#020617] rounded-xl font-bold font-cairo text-sm transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20">
                      <Sparkles size={16} />
                      اجعله الأساسي للموقع
                    </button>
                    <button onClick={() => markPromptReportResolved(pr.id, pr.promptSuggestion)} className="px-6 py-3 bg-red-500/10 text-red-400 rounded-xl font-bold font-cairo text-sm hover:bg-red-500/20 transition-all flex items-center gap-2">
                      <Trash2 size={16} />
                      تجاهل
                    </button>
                  </div>
                </div>
              ))}
              
              {promptReports.filter(pr => pr.status === 'pending').length === 0 && (
                <div className="text-center py-10 bg-white/5 rounded-[2rem] border border-white/5">
                  <CheckCircle className="mx-auto text-slate-600 mb-4" size={48} />
                  <p className="text-lg font-bold text-slate-500 font-cairo">لا توجد بلاغات تعديل ذكية قيد الانتظار.</p>
                </div>
              )}

              {/* Resolved / Ignored Reports */}
              {promptReports.filter(pr => pr.status !== 'pending').length > 0 && (
                <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                  <h4 className="text-lg font-bold text-slate-400 font-cairo">أرشيف البلاغات (مكتمل / متجاهل)</h4>
                  {promptReports.filter(pr => pr.status !== 'pending').map((pr, i) => (
                    <div key={pr.id} className="glass p-6 rounded-2xl border-white/5 space-y-3 opacity-60 hover:opacity-100 transition-opacity">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white font-cairo text-sm">{pr.userName}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${pr.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {pr.status === 'resolved' ? 'تم الرد واعتماده' : 'تم تجاهله'}
                          </span>
                        </div>
                      </div>
                      <p className="text-slate-400 font-cairo text-sm p-4 bg-white/5 rounded-xl border border-white/5">
                        {pr.promptSuggestion}
                      </p>
                      <div className="flex justify-end">
                        <button 
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'prompt_reports', pr.id));
                              if (config.dynamicPromptTuning === pr.promptSuggestion) {
                                setConfig({ ...config, dynamicPromptTuning: '' });
                                await setDoc(doc(db, 'config', 'global'), { dynamicPromptTuning: '' }, { merge: true });
                              }
                              showMessage('تم الحذف النهائي وإلغاء تفعيله إن كان نشطاً', 'success');
                            } catch(e) {
                              showMessage('خطأ في الحذف', 'error');
                            }
                          }}
                          className="text-xs text-red-400 hover:text-red-300 font-cairo flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          حذف نهائي
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* General Feedback Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <MessageSquare className="text-cyan-500" size={24} />
                <h3 className="text-xl font-bold text-white font-cairo">البلاغات العامة والمشاكل</h3>
              </div>

              {feedbackList.map((f, i) => (
                <div key={i} className="glass p-8 rounded-[2rem] border-white/5 space-y-4 hover:border-cyan-500/30 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-500">
                        <MessageSquare size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-white font-cairo">{f.user}</h4>
                        <p className="text-xs text-slate-500 font-mono">{f.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-white/5 px-3 py-1 rounded-full text-slate-500 font-bold uppercase tracking-widest">بلاغ عام</span>
                  </div>
                  <p className="text-slate-300 font-cairo text-lg leading-relaxed bg-white/5 p-6 rounded-2xl border border-white/5">
                    {f.text}
                  </p>
                  <div className="flex gap-3 justify-end pt-2">
                    <button onClick={() => markFeedbackResolved(f.uid, f.text)} className="px-6 py-2 bg-cyan-500/10 text-cyan-400 rounded-xl font-bold font-cairo text-sm hover:bg-cyan-500/20 transition-all">
                      تم الحل
                    </button>
                    <button onClick={() => markFeedbackResolved(f.uid, f.text)} className="px-6 py-2 bg-red-500/10 text-red-400 rounded-xl font-bold font-cairo text-sm hover:bg-red-500/20 transition-all">
                      تجاهل وحذف
                    </button>
                  </div>
                </div>
              ))}
              {feedbackList.length === 0 && (
                <div className="text-center py-10 bg-white/5 rounded-[2rem] border border-white/5">
                  <CheckCircle className="mx-auto text-slate-600 mb-4" size={48} />
                  <p className="text-lg font-bold text-slate-500 font-cairo">لا توجد بلاغات عامة.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
