import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Mic,
  MicOff,
  X,
  Send,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  Cpu,
  Loader2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  ShoppingCart,
  Receipt,
  Package,
  DollarSign,
  Scale,
  Building2,
  UserPlus,
  Compass,
  Wallet,
  Calculator,
  ShieldCheck,
  TrendingUp,
  FileCheck2,
  AlertCircle,
  Clock,
  Printer,
  BarChart3,
  FileText,
  Users,
  CalendarDays
} from 'lucide-react';

/** Voice command quick-entry modal. */
export const VoiceAssistantModal: React.FC = () => {
  const {
    activeModal,
    closeModal,
    isRecording,
    isTranscribing,
    recordingTranscript,
    startRecording,
    stopRecording,
    setRecordingTranscript,
    sendMessage,
    isProcessing,
    setActiveTab,
    darkMode,
    audioVoiceEnabled,
    toggleAudioVoice,
    addToast,
    micErrorNotice,
    clearMicErrorNotice,
    requestMicrophonePermission
  } = useApp();

  const [inputVal, setInputVal] = useState('');
  const [isMindThinking, setIsMindThinking] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);

  // Detect whether running in an embedded preview iframe
  const isEmbeddedIframe = typeof window !== 'undefined' && window.self !== window.top;


  // Keep inputVal in sync with live transcript & evaluate intent preview
  useEffect(() => {
    if (recordingTranscript) {
      setInputVal(recordingTranscript);
    }
  }, [recordingTranscript]);

  if (activeModal !== 'voice') return null;

  /**
   * Hand a voice command to the copilot. This modal no longer runs its own
   * interpreter; every command goes through the same path as the copilot
   * screen (`sendMessage` -> supervisor).
   */
  const handleExecuteVoiceAction = async (rawText?: string) => {
    const query = (rawText || inputVal).trim();
    if (!query || isProcessing || isTranscribing || isMindThinking) return;


    setInputVal('');
    setRecordingTranscript('');
    clearMicErrorNotice();

    if (isRecording) {
      stopRecording();
    }

    // ONE OWNER. Every command from this surface now goes to the same path the
    // copilot screen uses: `sendMessage` -> safeUnderstand (guides and module
    // navigation only) -> `executeSupervisorTurn`.
    //
    // It used to stop here. This modal ran its own interpreter — mind.ts for
    // intent, executor.ts for the tools, fastPath.ts for a per-keystroke route
    // preview — and the audit found the three disagreeing: "پرچیز آرڈر بناو"
    // answered "Supplier? dEMO" in the copilot and "Supplier not found" here.
    // The answer depended on which button was pressed. The supervisor owns
    // interpretation now because it is deterministic (mind.ts needs an API key
    // and returns null without one, so the modal silently lost every command),
    // and because it is where the clarification behaviour and its tests live.
    closeModal();
    setActiveTab('copilot');
    sendMessage(query, 'voice');
  };

  /**
   * Request hardware microphone permission directly via user click gesture
   */
  const handleRequestMicAccess = async () => {
    setIsTestingMic(true);
    const granted = await requestMicrophonePermission();
    setIsTestingMic(false);
    if (granted) {
      addToast('success', 'Microphone Ready', 'Real microphone access granted. You can now tap to record.');
    }
  };

  /**
   * Open the applet in a top-level browser tab
   */
  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  // Comprehensive One-Tap Voice Command Actions — Urdu-first (اردو)، Roman Urdu، English
  const voiceCommandChips = [
    // — Live inspections —
    { label: 'کتنا کیش ہے؟', query: 'کتنا کیش ہے', icon: Wallet, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20', badge: 'لائیو خزانہ' },
    { label: 'GST کتنا وصول ہوا؟', query: 'GST kitna wasool hua', icon: Scale, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20', badge: 'FBR 18% آڈٹ' },
    { label: 'اسٹاک چیک کرو', query: 'اسٹاک چیک کرو', icon: Package, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20', badge: 'گودام اسٹاک' },
    { label: 'وصولی کتنی ہے؟', query: 'وصولی کتنی ہے', icon: Receipt, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20', badge: 'AR بیلنس' },
    { label: 'سپلائر پیمنٹس؟', query: 'supplier payments kitni hain', icon: Building2, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20', badge: 'AP بیلنس' },
    { label: 'نفعہ کتنا ہوا؟', query: 'munafa kitna hua', icon: BarChart3, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20', badge: 'P&L اسنیپ شاٹ' },
    { label: '1 لاکھ سیل پر ٹیکس؟', query: '1 lakh ki sale par tax kitna', icon: Calculator, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20', badge: 'GST + فرڈر ٹیکس' },
    { label: 'آج کا حساب', query: 'aaj ka hisab batao', icon: CalendarDays, color: 'bg-sky-500/10 text-sky-600 border-sky-500/20 hover:bg-sky-500/20', badge: 'ڈے بک' },
    // — Creation workflows —
    { label: 'نیا سیل انوئس', query: 'naya sale invoice banao', icon: Receipt, color: 'bg-sky-500/10 text-sky-600 border-sky-500/20 hover:bg-sky-500/20', badge: '18% GST انوئس' },
    { label: 'پرچیز آرڈر بناو', query: 'purchase order bana do', icon: FileText, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20', badge: 'PO ورک فلو' },
    { label: 'کیش واؤچر', query: 'cash voucher banao', icon: Wallet, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20', badge: 'کیش بک انٹری' },
    { label: 'نیا سپلائر', query: 'naya supplier add karo', icon: Building2, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20', badge: 'ون بورڈنگ' },
    { label: 'نیا گاہک', query: 'naya customer add karo', icon: Users, color: 'bg-sky-500/10 text-sky-600 border-sky-500/20 hover:bg-sky-500/20', badge: 'رجسٹریشن' },
    { label: 'نیا پروڈکٹ', query: 'naya product add karo', icon: Package, color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 hover:bg-indigo-500/20', badge: 'SKU رجسٹری' },
    // — Printing —
    { label: 'انوئس پرنٹ کرو', query: 'invoice print karo', icon: Printer, color: 'bg-indigo-600/10 text-indigo-600 border-indigo-600/20 hover:bg-indigo-600/20', badge: 'FBR 80mm تھرمل' },
    { label: 'اسٹاک رپورٹ پرنٹ', query: 'stock report print karo', icon: Printer, color: 'bg-teal-500/10 text-teal-600 border-teal-500/20 hover:bg-teal-500/20', badge: 'ویلیویشن رپورٹ' },
    // — Navigation —
    { label: 'ڈیش بورڈ کھولو', query: 'dashboard kholo', icon: BarChart3, color: 'bg-slate-500/10 text-slate-600 border-slate-500/20 hover:bg-slate-500/20', badge: 'ایگزیکٹو ویو' },
    { label: 'رپورٹس کھولو', query: 'reports kholo', icon: FileText, color: 'bg-slate-500/10 text-slate-600 border-slate-500/20 hover:bg-slate-500/20', badge: 'GL و فنانشلز' },
    // — FBR —
    { label: 'FBR ریڈی ہے؟', query: 'FBR integration ready kaise ho', icon: ShieldCheck, color: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20 hover:bg-emerald-600/20', badge: '5-اسٹپ گائیڈ' },
    { label: 'ٹیکس آٹومیٹ کرو', query: 'tax automate karo', icon: ShieldAlert, color: 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20', badge: 'خودکار GST' }
  ];

  return (
    <div
      id="voice-assistant-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-fadeIn"
    >
      <div
        id="voice-assistant-modal-container"
        className={`rounded-3xl shadow-2xl border w-full max-w-2xl overflow-hidden animate-scaleUp transition-colors my-auto ${
          darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Top Header */}
        <div className="px-5 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold">Voice Command & System Engine</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase border border-emerald-400/30">
                  Live System Inspector
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Ask about Cash, 18% GST, Sale Taxes, Stock, or trigger creation workflows
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleAudioVoice}
              title={audioVoiceEnabled ? 'Voice Response Audio: ON' : 'Voice Response Audio: MUTED'}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                audioVoiceEnabled
                  ? 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/50'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {audioVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setInputVal('');
                setRecordingTranscript('');
                clearMicErrorNotice();
                closeModal();
              }}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Voice Assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Real Microphone Access Grant / Permission Banner */}
          {(micErrorNotice || isEmbeddedIframe) && (
            <div
              id="mic-permission-grant-panel"
              className={`p-3.5 rounded-2xl border transition-all ${
                micErrorNotice
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-950 dark:text-indigo-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${micErrorNotice ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`} />
                <div className="flex-1 text-xs">
                  <div className="font-bold flex items-center justify-between">
                    <span>
                      {micErrorNotice
                        ? 'Microphone Permission in Browser Preview'
                        : 'Real Microphone Access Policy'}
                    </span>
                    {isEmbeddedIframe && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 font-mono font-semibold">
                        Preview Iframe
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                    {micErrorNotice ? (
                      <>
                        The browser reported: <span className="font-mono font-semibold">{micErrorNotice}</span>.
                        Embedded iframes restrict direct microphone hardware capture. Open in a full window or tap any command below.
                      </>
                    ) : (
                      <>
                        To enable direct hardware speech recognition with <strong>Groq Whisper</strong>, grant microphone permissions or open in full window.
                      </>
                    )}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenInNewTab}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Full Window for Native Mic</span>
                    </button>

                    <button
                      type="button"
                      disabled={isTestingMic}
                      onClick={handleRequestMicAccess}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      {isTestingMic ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>Grant / Test Mic Access</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


          {/* LIVE SYSTEM INSPECTION RESULT CARD */}

          {/* Voice Recording Center */}
          <div
            className={`flex flex-col items-center justify-center py-4 sm:py-5 border rounded-2xl relative overflow-hidden transition-colors ${
              darkMode ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {isRecording && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-40 bg-red-500/15 rounded-full animate-ping" />
                <div className="w-28 h-28 bg-red-500/25 rounded-full animate-pulse" />
              </div>
            )}

            <button
              type="button"
              id="voice-mic-trigger-button"
              disabled={isTranscribing}
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative z-10 w-18 h-18 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
                isRecording
                  ? 'bg-red-600 text-white ring-8 ring-red-500/30 scale-105 animate-pulse'
                  : isTranscribing
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 active:scale-95 shadow-indigo-600/30'
              }`}
              title={isRecording ? 'Stop Recording' : 'Start Speaking Voice Command'}
            >
              {isRecording ? (
                <MicOff className="w-7 h-7" />
              ) : isTranscribing ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : (
                <Mic className="w-7 h-7" />
              )}
            </button>

            <div className="mt-2.5 text-center relative z-10 px-4">
              <span className="text-xs font-bold uppercase tracking-wider block">
                {isRecording
                  ? 'سن رہا ہوں… اردو میں بولیں'
                  : isTranscribing
                  ? 'Groq Whisper سے ٹرانسکرائب ہو رہا ہے…'
                  : 'مائیک دبائیں یا ٹائپ کریں'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {isRecording
                  ? 'مثلاً «کتنا کیش ہے»، «GST کتنا وصول ہوا»، «نئی سیل درج کرو»'
                  : 'زبان: اردو • رومان اردو — جواب صرف وہی جو پوچھا'}
              </span>
            </div>
          </div>

          {/* Transcript & Command Input Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>Voice / Text Command Buffer:</span>
              {inputVal && (
                <button
                  type="button"
                  onClick={() => {
                    setInputVal('');
                    setRecordingTranscript('');
                  }}
                  className="text-slate-400 hover:text-red-500 text-[11px] cursor-pointer"
                >
                  Clear Buffer
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                id="voice-command-input"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={
                  isRecording
                    ? 'سن رہا ہوں… «کتنا کیش ہے»…'
                    : 'بولیں یا ٹائپ کریں… «کتنا کیش ہے»، «سبیر کو 50 کلو یارن بیچو»…'
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteVoiceAction();
                }}
                className={`flex-1 px-4 py-2.5 border rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                type="button"
                id="voice-execute-button"
                onClick={() => handleExecuteVoiceAction()}
                disabled={!inputVal.trim() || isProcessing || isTranscribing}
                className="px-4 sm:px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shrink-0"
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Inspect</span>
              </button>
            </div>

          </div>

          {/* One-Tap Voice Command Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Aligned Voice Commands (One-Tap Copilot Command)</span>
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Auto-Clears Buffer</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {voiceCommandChips.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleExecuteVoiceAction(item.query)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 group ${
                      darkMode
                        ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-indigo-500/50'
                        : 'bg-slate-50 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${item.color}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">
                        "{item.label}"
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {item.badge}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
