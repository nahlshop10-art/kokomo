import React, { useState } from 'react';
import { WebsiteSettings, SocialLink } from './types';
import { ChevronLeft, Plus, Trash2, Save, Check, Share2, Globe } from 'lucide-react';
import { cloudStore } from './lib/cloudStore';
import { PaikarixMessageIcon } from './components/FloatingSocialButtons';

export default function SocialMediaManager({
  websiteSettings,
  setWebsiteSettings,
  onClose
}: {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<SocialLink[]>(websiteSettings.socialLinks || []);
  const [mainIcon, setMainIcon] = useState<string>(websiteSettings.socialMediaMainIcon || '');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const themeColor = '#6366F1';

  const handleAdd = () => {
    setLinks([...links, { id: Math.random().toString(36).substr(2, 9), icon: '', link: '' }]);
  };

  const handleRemove = (id: string) => {
    setLinks(links.filter(l => l.id !== id));
  };

  const handleChange = (id: string, field: keyof SocialLink, value: string) => {
    setLinks(links.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = { ...websiteSettings, socialLinks: links, socialMediaMainIcon: mainIcon };
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

  const handleIconUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange(id, 'icon', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMainIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMainIcon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Top Bar */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
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
                <Share2 size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Social Media Links
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Manage floating contact buttons and messenger channels on store
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
        {/* Main Floating Trigger Icon */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/40">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Floating Button Hub Icon</h2>
            <span className="text-xs text-slate-400 font-medium">Appears bottom-right</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[var(--dash-bg)] border border-[var(--dash-border)] flex items-center justify-center relative overflow-hidden group shadow-inner">
              {mainIcon ? (
                <img src={mainIcon} alt="Main Hub" className="w-10 h-10 object-contain" />
              ) : (
                <PaikarixMessageIcon className="w-8 h-8 text-[#fff8f0]" />
              )}
              <input 
                type="file" 
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleMainIconUpload}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-white block">Custom Floating Hub Icon</label>
              <p className="text-[11px] text-slate-400">Click icon to upload PNG or SVG (64x64 recommended).</p>
              {mainIcon && (
                <button 
                  onClick={() => setMainIcon('')}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium cursor-pointer pt-1"
                >
                  Reset to Default Icon
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Social Links List */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/40">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Active Social Channels</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">Direct chat links for WhatsApp, Messenger, Telegram, Facebook, etc.</p>
            </div>
            <button 
              onClick={handleAdd}
              style={{ backgroundColor: themeColor }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs text-white hover:brightness-110 active:scale-95 transition-all shadow-md cursor-pointer shrink-0"
            >
              <Plus size={14} className="stroke-[3]" /> Add Channel
            </button>
          </div>

          <div className="space-y-3">
            {links.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No social links added yet. Click "+ Add Channel" above.
              </div>
            ) : (
              links.map((link, idx) => (
                <div 
                  key={link.id || idx}
                  className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3.5 flex items-center gap-3 group hover:border-slate-600 transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl bg-[var(--dash-card)] border border-[var(--dash-border)] flex items-center justify-center relative overflow-hidden shrink-0 shadow-inner">
                    {link.icon ? (
                      <img src={link.icon} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <Globe size={18} className="text-slate-400" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => handleIconUpload(link.id, e)}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <input 
                      type="text"
                      value={link.link}
                      onChange={(e) => handleChange(link.id, 'link', e.target.value)}
                      placeholder="e.g. https://wa.me/8801700000000 or m.me/page"
                      className="w-full bg-transparent border-none text-xs md:text-sm text-white focus:outline-none placeholder:text-slate-600 font-mono"
                    />
                  </div>

                  <button 
                    onClick={() => handleRemove(link.id)}
                    className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0 cursor-pointer"
                    title="Remove link"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
