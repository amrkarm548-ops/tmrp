import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, XCircle, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { chatWithBot } from '../services/aiService';

interface WelcomeBotProps {
  onComplete?: (name: string) => void;
  isPersistent?: boolean;
}

export function WelcomeBot({ onComplete, isPersistent = false }: WelcomeBotProps) {
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string }[]>(() => {
    const saved = localStorage.getItem('tamrediano_chat_history');
    return saved ? JSON.parse(saved) : [
      { role: 'bot', text: 'أهلاً بك في تمريضيانو بريميوم! 🩺' },
      { role: 'bot', text: 'أنا المساعد الذكي بتاعك.. قولي اسمك إيه عشان نبدأ؟' }
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('tamrediano_chat_history', JSON.stringify(messages));
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input;
    const newMessages = [...messages, { role: 'user' as const, text: userText }];
    setMessages(newMessages);
    setInput('');
    
    if (messages.length < 4 && !isPersistent) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'bot', text: `تشرفنا يا ${userText}! ثواني وبنجهزلك المنصة..` }]);
        setTimeout(() => onComplete?.(userText), 1500);
      }, 800);
    } else {
      setIsLoading(true);
      try {
        const botResponse = await chatWithBot(userText, messages);
        
        let parsedResponse = botResponse;
        const navMatch = botResponse.match(/\[NAV:([a-z_]+)\]/i);
        if (navMatch) {
          const target = navMatch[1];
          window.dispatchEvent(new CustomEvent('tamrediano_navigate', { detail: target }));
          parsedResponse = botResponse.replace(navMatch[0], '').trim();
        }

        setMessages(prev => [...prev, { role: 'bot', text: parsedResponse }]);
      } catch (error) {
        console.error('Chat Error:', error);
        setMessages(prev => [...prev, { role: 'bot', text: 'حصل مشكلة في الاتصال.. جرب تاني كمان شوية.' }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const clearChat = () => {
    const initial = [
      { role: 'bot', text: 'أهلاً بك في تمريضيانو بريميوم! 🩺' },
      { role: 'bot', text: 'أنا المساعد الذكي بتاعك.. قولي اسمك إيه عشان نبدأ؟' }
    ];
    setMessages(initial);
    localStorage.removeItem('tamrediano_chat_history');
  };

  return (
    <div className={cn(
      "flex flex-col h-full overflow-hidden",
      !isPersistent && "fixed inset-0 bg-[#020617]/80 backdrop-blur-sm items-center justify-center p-4 z-[100]"
    )}>
      <motion.div 
        initial={!isPersistent ? { scale: 0.9, opacity: 0 } : {}}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "w-full glass flex flex-col relative overflow-hidden",
          !isPersistent ? "max-w-md h-[80vh] md:h-[600px] rounded-[2rem] md:rounded-[3rem] p-4 md:p-8" : "h-full p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem]"
        )}
      >
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full -mr-16 -mt-16"></div>
        
        <div className="flex items-center justify-between mb-4 md:mb-8 border-b border-white/5 pb-4 md:pb-6 relative z-10">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/20 relative">
              <Bot className="text-white w-6 h-6 md:w-7 md:h-7" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-green-500 border-[3px] border-[#020617] rounded-full"></div>
            </div>
            <div>
              <h2 className="font-black text-white font-cairo text-base md:text-lg leading-none">مساعد تمريضيانو</h2>
              <div className="flex items-center gap-1.5 md:gap-2 mt-1 md:mt-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[9px] md:text-[10px] text-cyan-400 font-black uppercase tracking-widest">Active Now</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-2">
            <button 
              onClick={clearChat}
              className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-red-400 transition-all"
              title="مسح المحادثة"
            >
              <Trash2 className="w-5 h-5 md:w-5 md:h-5" />
            </button>
            {!isPersistent && (
              <button 
                onClick={() => onComplete?.('Guest')}
                className="p-2 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all"
              >
                <XCircle className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            )}
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-4 md:space-y-6 mb-4 md:mb-6 scrollbar-hide px-1 md:px-2 relative z-10"
        >
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={cn(
                  "max-w-[85%] p-3 md:p-5 rounded-2xl md:rounded-3xl font-cairo text-[13px] md:text-sm leading-relaxed shadow-xl",
                  msg.role === 'user' 
                    ? 'bg-cyan-500 text-[#020617] font-bold rounded-tr-none shadow-cyan-500/10' 
                    : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/5'
                )}>
                  {msg.text}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-white/5 p-3 md:p-5 rounded-2xl md:rounded-3xl rounded-tl-none border border-white/5 flex items-center gap-2 md:gap-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form onSubmit={handleSubmit} className="relative z-10">
          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك هنا يا بطل..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 md:py-5 px-4 md:px-6 pr-12 md:pr-16 text-white outline-none focus:border-cyan-500 transition-all font-cairo text-sm md:text-lg shadow-inner"
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 bg-cyan-500 text-[#020617] rounded-xl hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center shadow-lg shadow-cyan-500/20"
            >
              <Send className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        </form>
        
        <div className="mt-2 md:mt-4 text-center">
          <p className="text-[10px] text-slate-600 font-cairo">
            مدعوم بالذكاء الاصطناعي لخدمة طلاب التمريض 🩺
          </p>
        </div>
      </motion.div>
    </div>
  );
}
