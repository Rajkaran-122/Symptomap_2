import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendChatbotMessage } from '@/api/symptom-api';
import ClinicsPanel from '@/components/ClinicsPanel';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
}

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'hi', label: 'हिंदी' },
];

export interface ChatbotWidgetRef {
  openWithMessage: (text: string) => void;
}

const ChatbotWidget = forwardRef<ChatbotWidgetRef, { initialMessage?: string }>(( { initialMessage }, ref) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [language, setLanguage] = useState<string>(() => localStorage.getItem('symptomap_chat_lang') || 'en');
  const [listening, setListening] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | undefined>(undefined);
  const [showClinics, setShowClinics] = useState(false);

  useEffect(() => {
    if (initialMessage && !messages.length) {
      setMessages([{ id: 'init', role: 'user', text: initialMessage }]);
      void handleSend(initialMessage);
      setOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);
  useEffect(() => { localStorage.setItem('symptomap_chat_lang', language); }, [language]);

  useImperativeHandle(ref, () => ({
    openWithMessage: (text: string) => {
      setOpen(true);
      setMessages(prev => [...prev, { id: `u_${Date.now()}`, role: 'user', text }]);
      void handleSend(text);
    }
  }), [conversationId, language]);

  const speak = (text: string) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      // Best-effort language mapping
      utterance.lang = language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : language === 'hi' ? 'hi-IN' : 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const openClinicsNearMe = async () => {
    try {
      setShowClinics(true);
    } catch {
      setShowClinics(true);
    }
  };

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;
    if (!text) setMessages(prev => [...prev, { id: `u_${Date.now()}`, role: 'user', text: content }]);
    setInput('');
    setTyping(true);
    try {
      const res = await sendChatbotMessage({ message: content, conversationId, language, imageDataUrl });
      setConversationId(res.conversationId);
      setMessages(prev => [...prev, { id: `a_${Date.now()}`, role: 'assistant', text: res.text }]);
      speak(res.text);
    } catch (e) {
      setMessages(prev => [...prev, { id: `a_${Date.now()}`, role: 'assistant', text: 'Sorry, something went wrong.' }]);
    } finally {
      setTyping(false);
    }
  };

  const startVoiceInput = () => {
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) return;
      const rec = new SR();
      rec.lang = language === 'es' ? 'es-ES' : language === 'fr' ? 'fr-FR' : language === 'hi' ? 'hi-IN' : 'en-US';
      rec.continuous = false;
      rec.interimResults = false;
      rec.onstart = () => setListening(true);
      rec.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setListening(false);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      rec.start();
    } catch {}
  };

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground shadow-lg rounded-full px-4 py-3"
      >
        {open ? 'Close Chat' : 'Chat with AI'}
      </button>
      <AnimatePresence>
        {open && (
          <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 right-6 z-50 w-80 sm:w-96 bg-card border rounded-xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b bg-card/80">
              <div className="text-sm font-semibold">SymptoMap Assistant</div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.speechSynthesis.cancel()} className="text-xs underline">Stop</button>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="text-xs border rounded px-2 py-1 bg-background">
                  {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </div>
            </div>
            <div className="h-80 p-3 space-y-2 overflow-y-auto">
              {messages.map(m => (
                <div key={m.id}>
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`px-3 py-2 rounded-lg max-w-[75%] text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>{m.text}</div>
                  </div>
                  {m.role === 'assistant' && /see a doctor|consult a doctor|seek medical|visit a clinic|healthcare professional/i.test(m.text) && (
                    <div className="flex justify-start mt-1">
                      <button onClick={openClinicsNearMe} className="text-xs underline">Find a clinic near me</button>
                    </div>
                  )}
                </div>
              ))}
              {typing && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-lg bg-muted text-foreground text-sm">
                    <span className="inline-block w-2 h-2 bg-foreground/70 rounded-full animate-bounce mr-1" />
                    <span className="inline-block w-2 h-2 bg-foreground/60 rounded-full animate-bounce mr-1" style={{ animationDelay: '100ms' }} />
                    <span className="inline-block w-2 h-2 bg-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="p-2 border-t bg-card/80">
              <form onSubmit={(e) => { e.preventDefault(); void handleSend(); }} className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 border rounded-md bg-background px-2 py-2 text-sm"
                />
                <label className="text-xs border rounded-md px-2 py-2 cursor-pointer bg-background">
                  📷
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setImageDataUrl(reader.result as string);
                    reader.readAsDataURL(file);
                  }} />
                </label>
                <button type="button" onClick={startVoiceInput} className={`px-2 py-2 rounded-md text-sm border ${listening ? 'bg-red-500 text-white' : 'bg-background'}`}>{listening ? 'Listening' : '🎤'}</button>
                <button type="submit" className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm">Send</button>
              </form>
              {imageDataUrl && (
                <div className="mt-2 text-xs flex items-center gap-2">
                  <img src={imageDataUrl} alt="preview" className="h-10 w-10 object-cover rounded" />
                  <button className="underline" onClick={() => setImageDataUrl(undefined)}>Remove</button>
                </div>
              )}
            </div>
          </motion.div>
          {showClinics && (
            <ClinicsPanel onClose={() => setShowClinics(false)} />
          )}
          </>
        )}
      </AnimatePresence>
    </>
  );
});

export default ChatbotWidget;
