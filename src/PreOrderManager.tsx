import React, { useState } from 'react';
import { WebsiteSettings } from './types';
import { ChevronLeft, Plus, Trash2, Save, Check, Clock, Globe, LayoutDashboard, Link2 } from 'lucide-react';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface PreOrderManagerProps {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}

export default function PreOrderManager({
  websiteSettings,
  setWebsiteSettings,
  onClose
}: PreOrderManagerProps) {
  const settings = websiteSettings.preOrder || {
    pWebsite: { enabled: false, link: '' },
    pDashboard: []
  };

  const [enabled, setEnabled] = useState(settings.pWebsite.enabled);
  const [link, setLink] = useState(settings.pWebsite.link);
  const [dashboards, setDashboards] = useState(settings.pDashboard);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedSettings = {
        ...websiteSettings,
        preOrder: {
          pWebsite: { enabled, link: link.trim() },
          pDashboard: dashboards.map(d => ({ ...d, name: d.name.trim(), link: d.link.trim() }))
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

  const addDashboard = () => {
    setDashboards([...dashboards, { id: Date.now().toString(), name: '', link: '' }]);
  };

  const updateDashboard = (index: number, field: 'name' | 'link', value: string) => {
    const newDashs = [...dashboards];
    newDashs[index][field] = value;
    setDashboards(newDashs);
  };

  const removeDashboard = (index: number) => {
    const newDashs = [...dashboards];
    newDashs.splice(index, 1);
    setDashboards(newDashs);
  };

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Top Header Bar */}
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
                <Clock size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Pre-Order Settings
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Manage website pre-order routing and external dashboard connections
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
        {/* P-website Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <Globe size={18} />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm md:text-base">Website Pre-Order Link</h2>
                <p className="text-xs text-slate-400 mt-0.5">Route store visitors to a dedicated pre-order page</p>
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
          
          {enabled && (
            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-xs font-semibold text-slate-300 tracking-wide flex items-center gap-1.5">
                <Link2 size={13} className="text-indigo-400" /> Destination URL <span className="text-indigo-400">*</span>
              </label>
              <input 
                type="url"
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://preorder.yourstore.com"
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 font-mono"
              />
              <p className="text-[11px] text-slate-500">
                When enabled, pre-order buttons will redirect customers to this URL.
              </p>
            </div>
          )}
        </div>

        {/* P-dashboard Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                <LayoutDashboard size={18} />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm md:text-base">Dashboard Workspaces</h2>
                <p className="text-xs text-slate-400 mt-0.5">Quick access links to your external admin portals</p>
              </div>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {dashboards.length} Linked
            </span>
          </div>
          
          <div className="space-y-3 pt-1">
            {dashboards.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[var(--dash-border)] bg-white/[0.01]">
                <LayoutDashboard size={28} className="mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-400 font-medium">No dashboard workspaces added yet.</p>
                <p className="text-[11px] text-slate-600 mt-0.5">Click below to connect your first dashboard.</p>
              </div>
            ) : (
              dashboards.map((dash, i) => (
                <div 
                  key={dash.id || i} 
                  className="bg-[var(--dash-bg)] border border-[var(--dash-border)] p-3.5 rounded-xl space-y-3 transition-all hover:border-slate-600 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-400" /> Workspace #{i + 1}
                    </span>
                    <button 
                      onClick={() => removeDashboard(i)} 
                      className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Remove link"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 block">Label / Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Dhaka Hub"
                        value={dash.name}
                        onChange={(e) => updateDashboard(i, 'name', e.target.value)}
                        className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 block">URL</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={dash.link}
                        onChange={(e) => updateDashboard(i, 'link', e.target.value)}
                        className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

            <button
              onClick={addDashboard}
              className="w-full py-3 rounded-xl border border-dashed border-[var(--dash-border)] hover:border-indigo-500/50 bg-white/[0.01] hover:bg-indigo-500/[0.04] text-slate-400 hover:text-indigo-300 flex items-center justify-center gap-2 transition-all text-xs font-semibold cursor-pointer"
            >
              <Plus size={16} className="text-indigo-400" />
              Add Dashboard Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
