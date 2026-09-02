import React, { useState } from 'react';
import { ChevronLeft, Save, ShieldAlert, Zap, Clock, Smartphone, Check, ShieldCheck, AlertOctagon } from 'lucide-react';
import { WebsiteSettings } from './types';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface Props {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: (settings: WebsiteSettings) => void;
  onClose: () => void;
}

export default function AntiSpamManager({ websiteSettings, setWebsiteSettings, onClose }: Props) {
  const [enabled, setEnabled] = useState(websiteSettings.antiSpam?.enabled ?? false);
  const [rateLimitEnabled, setRateLimitEnabled] = useState(websiteSettings.antiSpam?.rateLimitEnabled ?? true);
  const [deviceTrackingEnabled, setDeviceTrackingEnabled] = useState(websiteSettings.antiSpam?.deviceTrackingEnabled ?? true);
  
  const [shortTermOrdersCount, setShortTermOrdersCount] = useState(websiteSettings.antiSpam?.shortTermOrdersCount ?? 3);
  const [shortTermMinutes, setShortTermMinutes] = useState(websiteSettings.antiSpam?.shortTermMinutes ?? 10);
  const [hourlyOrdersCount, setHourlyOrdersCount] = useState(websiteSettings.antiSpam?.hourlyOrdersCount ?? 5);
  const [dailyOrdersCount, setDailyOrdersCount] = useState(websiteSettings.antiSpam?.dailyOrdersCount ?? 10);
  const [blockDurationMinutes, setBlockDurationMinutes] = useState(websiteSettings.antiSpam?.blockDurationMinutes ?? 60);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const themeColor = '#6366F1';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...websiteSettings,
        antiSpam: {
          enabled,
          rateLimitEnabled,
          deviceTrackingEnabled,
          shortTermOrdersCount,
          shortTermMinutes,
          hourlyOrdersCount,
          dailyOrdersCount,
          blockDurationMinutes
        }
      };
      setWebsiteSettings(updatedSettings);
      await cloudStore.saveSetting('websiteSettings', updatedSettings);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 600);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[240px]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3.5 md:px-8 md:py-4 border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
            title="Go back"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Anti-Spam & Fraud Protection
              </h1>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Rate limiting, bot shields, and device fingerprinting to block fake orders
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0 disabled:opacity-50"
        >
          {saved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 max-w-3xl mx-auto w-full pb-32 overscroll-y-contain custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Master Control */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white">Master Anti-Spam Engine</h2>
                <p className="text-xs text-slate-400 mt-0.5">Toggle global fake order prevention and IP verification</p>
              </div>
            </div>

            <button
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                enabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
            >
              <div
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  enabled ? "translate-x-5.5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        {enabled && (
          <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              
              {/* Rate Limits */}
              <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-[var(--dash-border)]/40">
                  <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                    <Zap size={15} className="text-indigo-400" /> Rate Limits
                  </div>
                  <button
                    onClick={() => setRateLimitEnabled(!rateLimitEnabled)}
                    className={cn(
                      "w-10 h-5.5 rounded-full relative transition-all duration-200 p-0.5 focus:outline-none cursor-pointer",
                      rateLimitEnabled ? "bg-indigo-600" : "bg-slate-700/60"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4.5 h-4.5 rounded-full bg-white transition-all shadow-sm",
                        rateLimitEnabled ? "translate-x-4.5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">Short-Term Rapid Checkout Limit</label>
                    <div className="flex items-center gap-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-2 px-3">
                      <input 
                        type="number" 
                        value={shortTermOrdersCount} 
                        onChange={e => setShortTermOrdersCount(Number(e.target.value))} 
                        className="w-12 bg-transparent text-white font-bold text-xs md:text-sm focus:outline-none" 
                      />
                      <span className="text-xs text-slate-400">orders per</span>
                      <input 
                        type="number" 
                        value={shortTermMinutes} 
                        onChange={e => setShortTermMinutes(Number(e.target.value))} 
                        className="w-12 bg-transparent text-white font-bold text-xs md:text-sm focus:outline-none" 
                      />
                      <span className="text-xs text-slate-400">mins</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">Hourly Order Cap</label>
                    <div className="flex items-center gap-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-2 px-3">
                      <input 
                        type="number" 
                        value={hourlyOrdersCount} 
                        onChange={e => setHourlyOrdersCount(Number(e.target.value))} 
                        className="w-14 bg-transparent text-white font-bold text-xs md:text-sm focus:outline-none" 
                      />
                      <span className="text-xs text-slate-400">orders per 1 hour</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 mb-1.5 block">Daily Order Cap</label>
                    <div className="flex items-center gap-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-2 px-3">
                      <input 
                        type="number" 
                        value={dailyOrdersCount} 
                        onChange={e => setDailyOrdersCount(Number(e.target.value))} 
                        className="w-14 bg-transparent text-white font-bold text-xs md:text-sm focus:outline-none" 
                      />
                      <span className="text-xs text-slate-400">orders per day</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Device Tracking */}
              <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-[var(--dash-border)]/40">
                  <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider">
                    <Smartphone size={15} className="text-indigo-400" /> Device Tracking
                  </div>
                  <button
                    onClick={() => setDeviceTrackingEnabled(!deviceTrackingEnabled)}
                    className={cn(
                      "w-10 h-5.5 rounded-full relative transition-all duration-200 p-0.5 focus:outline-none cursor-pointer",
                      deviceTrackingEnabled ? "bg-indigo-600" : "bg-slate-700/60"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4.5 h-4.5 rounded-full bg-white transition-all shadow-sm",
                        deviceTrackingEnabled ? "translate-x-4.5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Fingerprints device screen, canvas hashes, and headers to prevent automated script submissions.
                </p>

                <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3 space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-400 block">Block Expiry Duration</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={blockDurationMinutes} 
                      onChange={e => setBlockDurationMinutes(Number(e.target.value))} 
                      className="w-16 bg-transparent text-white font-bold text-sm focus:outline-none" 
                    />
                    <span className="text-xs text-slate-400">Minutes</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Duration a flagged suspicious device remains blocked.</p>
                </div>
              </div>

            </div>

            {/* Info notice */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 flex gap-3 text-xs text-slate-300">
              <AlertOctagon className="w-5 h-5 flex-shrink-0 text-indigo-400 mt-0.5" />
              <p className="leading-relaxed">
                When rate limits are breached, users receive a polite "Too many attempts, please wait" notice to safeguard server resources and maintain inventory integrity.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

