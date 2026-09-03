import React, { useState } from 'react';
import { ChevronLeft, Save, ShoppingCart, Clock, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { WebsiteSettings } from './types';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface Props {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: (settings: WebsiteSettings) => void;
  onClose: () => void;
}

export default function MinOrderManager({ websiteSettings, setWebsiteSettings, onClose }: Props) {
  const [enabled, setEnabled] = useState(websiteSettings.minOrderFeature?.enabled ?? false);
  const [minQuantity, setMinQuantity] = useState(websiteSettings.minOrderFeature?.minQuantity ?? 3);
  const [message, setMessage] = useState(websiteSettings.minOrderFeature?.message ?? 'সর্বনিম্ন যেকোনো ৩টি কিনতে হবে');
  const [autoCloseTime, setAutoCloseTime] = useState(websiteSettings.minOrderFeature?.autoCloseTime ?? 2000);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...websiteSettings,
        minOrderFeature: {
          enabled,
          minQuantity: Math.max(1, Number(minQuantity) || 1),
          message: message.trim(),
          autoCloseTime: Math.max(0, Number(autoCloseTime) || 0)
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

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Header */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-4 py-3.5 md:px-8 md:py-4">
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
                <ShoppingCart size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Minimum Order Rule
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Enforce minimum purchase quantity requirements at checkout
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
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 max-w-4xl mx-auto w-full pb-32 overscroll-y-contain custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Master Toggle Card */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm md:text-base">Enable Minimum Order Restriction</h2>
                <p className="text-xs text-slate-400 mt-0.5">Block checkout if total cart items are below minimum requirement</p>
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
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/40">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Rule Parameters</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Active Threshold: {minQuantity} Pcs
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                  Minimum Quantity Required (MOQ)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    min="1"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">
                    Pcs
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Clock size={13} className="text-indigo-400" /> Popup Auto-Close Timer (ms)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={autoCloseTime}
                    onChange={(e) => setAutoCloseTime(Number(e.target.value))}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    min="0"
                    step="500"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    ms (0 = manual)
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-400" /> Customer Popup Error Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. সর্বনিম্ন যেকোনো ৩টি পণ্য কিনতে হবে"
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors min-h-[90px] placeholder:text-slate-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                This warning will be displayed if the customer taps checkout before reaching the minimum quantity.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

