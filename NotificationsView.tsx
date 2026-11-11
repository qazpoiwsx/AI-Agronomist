import React from 'react';
import { 
  Bell, 
  CheckCheck, 
  ShieldAlert, 
  CloudSun, 
  Radar, 
  CheckCircle2, 
  UserCheck, 
  Clock, 
  AlertTriangle,
  Trash2
} from 'lucide-react';
import { AgroNotification } from '../types';
import { Language, translations } from '../translations';
import { cn } from '../lib/utils';
import { TabRoute } from './Sidebar';

interface NotificationsViewProps {
  notifications: AgroNotification[];
  lang: Language;
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  setActiveTab: (tab: TabRoute) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  lang,
  onMarkAsRead,
  onMarkAllAsRead,
  setActiveTab
}) => {
  const t = translations[lang];

  const getIcon = (type: AgroNotification['type'], severity: AgroNotification['severity']) => {
    switch (type) {
      case 'disease':
        return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'weather':
        return <CloudSun className="w-5 h-5 text-amber-500" />;
      case 'mission':
        return <Radar className="w-5 h-5 text-blue-500" />;
      case 'review':
        return <UserCheck className="w-5 h-5 text-emerald-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-slate-900 leading-tight">
            {t.notifsCenterTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t.notifsCenterDesc}
          </p>
        </div>

        {notifications.some(n => !n.read) && (
          <button
            onClick={onMarkAllAsRead}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            <span>{t.notifsMarkAllRead}</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs">
          <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-serif font-bold text-base text-slate-700">{t.notifsNoNew}</h3>
          <p className="text-xs text-slate-400 mt-1">{t.notifsAllNormal}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                if (!item.read) onMarkAsRead(item.id);
                if (item.type === 'disease') setActiveTab('health');
                else if (item.type === 'weather') setActiveTab('weather');
                else if (item.type === 'mission') setActiveTab('missions');
                else if (item.type === 'review') setActiveTab('recommendations');
              }}
              className={cn(
                "p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex items-start gap-4",
                item.read 
                  ? "bg-white border-slate-200/80 hover:bg-slate-50" 
                  : "bg-emerald-50/40 border-emerald-200 shadow-xs hover:bg-emerald-50/70"
              )}
            >
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-xs">
                {getIcon(item.type, item.severity)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className={cn(
                    "text-xs leading-snug truncate",
                    item.read ? "font-semibold text-slate-800" : "font-bold text-slate-900"
                  )}>
                    {item.title}
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-2">
                  {item.message}
                </p>

                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[8px] font-bold uppercase",
                    item.severity === 'critical' ? "bg-red-100 text-red-700" :
                    item.severity === 'warning' ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-700"
                  )}>
                    {item.severity}
                  </span>
                  <span className="text-[10px] font-bold text-[#2F7D4A] hover:underline">
                    {t.notifsGoToSection}
                  </span>
                </div>
              </div>

              {!item.read && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
