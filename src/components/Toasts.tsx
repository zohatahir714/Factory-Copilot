import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export const Toasts: React.FC = () => {
  const { notifications, dismissNotification } = useApp();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {notifications.map((notif) => {
        const icons = {
          success: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
          info: <Info className="w-4 h-4 text-indigo-600 shrink-0" />,
          warning: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />,
          error: <XCircle className="w-4 h-4 text-red-600 shrink-0" />
        };

        const borders = {
          success: 'border-emerald-200 bg-white',
          info: 'border-indigo-200 bg-white',
          warning: 'border-amber-200 bg-white',
          error: 'border-red-200 bg-white'
        };

        return (
          <div
            key={notif.id}
            className={`pointer-events-auto relative overflow-hidden flex items-start gap-2.5 p-3 rounded-xl border shadow-lg ${borders[notif.type]} animate-fadeIn`}
          >
            {icons[notif.type]}
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-slate-900">{notif.title}</h5>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{notif.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(notif.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {/* 2-Second auto-hide indicator bar */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100">
              <div
                className={`h-full ${
                  notif.type === 'success'
                    ? 'bg-emerald-500'
                    : notif.type === 'error'
                    ? 'bg-red-500'
                    : notif.type === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-indigo-500'
                }`}
                style={{
                  animation: 'shrinkWidth 2s linear forwards'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
