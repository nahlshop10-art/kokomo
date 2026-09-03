import React, { useState } from 'react';
import { Save, Bell, Key, MessageSquare, AlertCircle, ChevronLeft, Settings, Copy, Check, Send } from 'lucide-react';
import { WebsiteSettings } from './types';
import { cloudStore } from './lib/cloudStore';
import { cn } from './lib/utils';

interface NotificationManagerProps {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}

export default function NotificationManager({ websiteSettings, setWebsiteSettings, onClose }: NotificationManagerProps) {
  const [botToken, setBotToken] = useState(websiteSettings?.telegramNotification?.botToken || '');
  const [chatId, setChatId] = useState(websiteSettings?.telegramNotification?.chatId || '');
  const [enabled, setEnabled] = useState(websiteSettings?.telegramNotification?.enabled || false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedChatId, setCopiedChatId] = useState(false);

  const themeColor = '#6366F1';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...websiteSettings,
        telegramNotification: {
          enabled,
          botToken: botToken.trim(),
          chatId: chatId.trim(),
        }
      };
      setWebsiteSettings(updatedSettings);
      await cloudStore.saveSetting('websiteSettings', updatedSettings);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 600);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyToken = () => {
    if (!botToken) return;
    navigator.clipboard.writeText(botToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyChatId = () => {
    if (!chatId) return;
    navigator.clipboard.writeText(chatId);
    setCopiedChatId(true);
    setTimeout(() => setCopiedChatId(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Top Bar */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Bell size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Order Notifications
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Instant Telegram bot alerts when customers place new orders
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
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-5 max-w-4xl mx-auto w-full pb-32 overscroll-y-contain custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Telegram Enable Toggle */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Send size={20} className="translate-x-[-1px] translate-y-[1px]" />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white">Telegram Instant Order Alerts</h2>
                <p className="text-xs text-slate-400 mt-0.5">Receive immediate ping with order details, items, address, and total</p>
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

        {/* Telegram Credentials Card */}
        {enabled && (
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/40">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Bot Credentials</h2>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Encrypted Delivery
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Key size={13} className="text-indigo-400" /> Telegram Bot Token</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="e.g. 8642328760:AAH3b9ij..."
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl pl-4 pr-11 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Copy Token"
                  >
                    {copiedToken ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><MessageSquare size={13} className="text-indigo-400" /> Telegram Chat ID</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="e.g. 6805318773"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl pl-4 pr-11 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleCopyChatId}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Copy Chat ID"
                  >
                    {copiedChatId ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Setup Help Guide */}
            <div className="bg-indigo-500/5 border border-indigo-500/20 p-4 rounded-xl flex gap-3 text-slate-300 text-xs">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-indigo-400 mt-0.5" />
              <div className="space-y-1 leading-relaxed">
                <span className="font-bold text-white block">How to connect your bot:</span>
                <p className="text-slate-400 text-[11px]">
                  1. Create a bot using <strong className="text-indigo-300">@BotFather</strong> on Telegram to get your <strong>Bot Token</strong>.
                  <br />
                  2. Open a chat with your bot and send <strong className="text-indigo-300">/start</strong>.
                  <br />
                  3. Use <strong className="text-indigo-300">@userinfobot</strong> to get your numeric <strong>Chat ID</strong>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


