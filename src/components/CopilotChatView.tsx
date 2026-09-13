import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Layers,
  FileCheck,
  AlertTriangle,
  ArrowRight,
  Receipt,
  ShoppingCart,
  Package,
  Scale,
  RefreshCw
} from 'lucide-react';
import { AgentDomain } from '../types';

export const CopilotChatView: React.FC = () => {
  const {
    messages,
    sendMessage,
    isProcessing,
    activeConfirmation,
    confirmAction,
    cancelAction,
    isRecording,
    recordingTranscript,
    startRecording,
    stopRecording,
    setRecordingTranscript,
    triggerDemoPrompt
  } = useApp();

  const [inputVal, setInputVal] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing, activeConfirmation]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isProcessing) return;
    sendMessage(inputVal, 'text');
    setInputVal('');
  };

  const renderAgentBadge = (domain?: AgentDomain) => {
    if (!domain) return null;
    const config: Record<AgentDomain, { label: string; bg: string; text: string; border: string }> = {
      supervisor: { label: 'Supervisor Agent', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
      inventory: { label: 'Inventory Agent', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      purchase: { label: 'Purchase Agent', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      accounting: { label: 'Accounting Agent', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      compliance: { label: 'Compliance Agent (FBR RAG)', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
    };
    const c = config[domain] || config.supervisor;
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${c.bg} ${c.text} ${c.border}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
        {c.label}
      </span>
    );
  };

  const demoScripts = [
    { label: '1. Voice Stock Query', prompt: 'Kitna cotton yarn bacha hai?', urdu: 'کتنا کاٹن یارن بچا ہے؟', icon: '🎙️' },
    { label: '2. Purchase Order', prompt: 'ColorChem se 100 kilo blue dye ka PO bana do', urdu: 'ڈائی کا پرچیز آرڈر بنا دو', icon: '📝' },
    { label: '3. Record Sale (18% GST)', prompt: 'Al-Rehman ko 50 kilo cotton yarn sell karo', urdu: 'الرحمٰن کو 50 کلو یارن سیل کرو', icon: '🧾' },
    { label: '4. Business Summary', prompt: 'Aaj ka complete business summary do', urdu: 'آج کا مکمل بزنس سمری دو', icon: '📊' },
    { label: '5. Compliance RAG', prompt: 'Is transaction ka applicable tax rule kya hai?', urdu: 'ایف بی آر ٹیکس کا کیا قانون ہے؟', icon: '⚖️' },
    { label: '6. Receive Goods (PO-1001)', prompt: 'Receive goods for PO-1001', urdu: 'پی او کے گڈز ریسیو کرو', icon: '📦' }
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100/70 overflow-hidden relative">
      {/* Interactive Demo Scripts Bar (Directly matching PRD Section 38 Demo Script) */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 shadow-2xs">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          Demo Flows:
        </span>
        <div className="flex items-center gap-1.5">
          {demoScripts.map((demo, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => triggerDemoPrompt(demo.prompt)}
              className="px-2.5 py-1 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-md text-xs font-semibold text-slate-700 hover:text-blue-800 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <span>{demo.icon}</span>
              <span>{demo.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 max-w-3xl ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-xs ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-900 text-blue-400 border border-slate-700'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Bubble Body */}
              <div className="space-y-1.5 max-w-[85%]">
                {/* Agent & Tool Badges */}
                {!isUser && (
                  <div className="flex flex-wrap items-center gap-2">
                    {renderAgentBadge(msg.routedAgent)}
                    {msg.toolExecution && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <span className="text-blue-600 font-bold">tool:</span>
                        <span>{msg.toolExecution.toolName}</span>
                        <span className="text-slate-400">({msg.toolExecution.executionMs}ms)</span>
                      </span>
                    )}
                    {msg.inputMethod === 'voice' && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded font-medium border border-purple-100">
                        <Mic className="w-2.5 h-2.5" /> Voice Input
                      </span>
                    )}
                  </div>
                )}

                {/* Message Content Box */}
                <div
                  className={`p-4 rounded-xl text-sm leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-blue-600 text-white font-medium rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-line">{msg.content}</div>
                </div>

                {/* Confirmation Interactive Card (PRD Section 14) */}
                {msg.confirmationRequired && msg.confirmationRequired.status === 'pending' && (
                  <div className="mt-3 bg-amber-50/90 border-2 border-amber-300 rounded-xl p-4 shadow-sm animate-fadeIn">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{msg.confirmationRequired.title}</span>
                    </div>
                    <p className="text-xs text-amber-800 mb-3">
                      {msg.confirmationRequired.description}
                    </p>

                    {/* Breakdown Details */}
                    <div className="bg-white/80 border border-amber-200 rounded-lg p-2.5 mb-3 text-xs space-y-1 font-mono text-slate-700">
                      {Object.entries(msg.confirmationRequired.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center py-0.5 border-b border-amber-100 last:border-b-0">
                          <span className="text-slate-500 font-sans text-[11px] capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                          <span className="font-semibold text-slate-900">{typeof value === 'number' ? `Rs. ${value.toLocaleString()}` : String(value)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => cancelAction(msg.confirmationRequired!.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmAction(msg.confirmationRequired!)}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Confirm & Commit to Database</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className={`text-[10px] text-slate-400 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-3 mr-auto max-w-xl">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-blue-400 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs flex items-center gap-2 text-xs text-slate-600 font-medium">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></div>
              <span>Supervisor routing intent to domain agent & executing validated tools...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice Recording Waveform & Preview Modal (PRD Section 9) */}
      {isRecording && (
        <div className="bg-slate-900 text-white border-t border-slate-800 p-4 shrink-0 animate-fadeIn">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div>
              <div>
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  <span>Groq Whisper Voice Engine Active</span>
                </div>
                <div className="text-sm font-semibold text-slate-200 mt-0.5">
                  {recordingTranscript || 'Listening to English or Roman Urdu... (Try: "Kitna cotton yarn bacha hai?")'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={stopRecording}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md shadow-red-600/30"
            >
              <MicOff className="w-3.5 h-3.5" />
              <span>Transcribe & Send</span>
            </button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="bg-white border-t border-slate-200 p-3 md:p-4 shrink-0 shadow-lg">
        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
          {/* Voice Button */}
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? 'Stop Recording' : 'Start Voice Input (Groq Whisper)'}
            className={`p-2.5 rounded-xl transition-all cursor-pointer shrink-0 border ${
              isRecording
                ? 'bg-red-600 text-white border-red-700 animate-pulse'
                : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
            }`}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder='Ask in English or Roman Urdu: "Kitna cotton yarn bacha hai?" or "Al-Rehman ko 50 kilo sell karo"...'
              disabled={isProcessing}
              className="w-full bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputVal.trim() || isProcessing}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-all cursor-pointer shrink-0 shadow-sm shadow-blue-600/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="max-w-4xl mx-auto mt-1.5 flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Supported: English, Roman Urdu (اردو)</span>
          <span>Deterministic business execution • Zero hallucinations</span>
        </div>
      </div>
    </div>
  );
};
