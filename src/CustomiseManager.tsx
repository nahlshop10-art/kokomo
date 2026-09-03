import React, { useState } from 'react';
import { ChevronLeft, Save, Check, FolderArchive, Download, Palette } from 'lucide-react';
import { WebsiteSettings, Product, Category } from './types';
import ActionButtonsCustomiser from './components/ActionButtonsCustomiser';
import FbZipExportModal from './components/FbZipExportModal';
import { cloudStore } from './lib/cloudStore';
import { cn } from './lib/utils';

interface CustomiseManagerProps {
  settings: WebsiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
  products?: Product[];
  categories?: Category[];
  onDownloadFbZip?: () => void;
}

const POPULAR_FONTS = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", 
  "Oswald", "Source Sans Pro", "Slabo 27px", "Raleway", "PT Sans", 
  "Merriweather", "Noto Sans", "Nunito", "Playfair Display", 
  "Muli", "Rubik", "Ubuntu", "Work Sans", "Lora", 
  "Nunito Sans", "Fira Sans", "Quicksand", "Crimson Text", "Hind",
  "Titillium Web", "Inconsolata", "Josefin Sans", "Cabin", "Anton",
  "Oxygen", "Dosis", "Bitter", "Arimo", "Pacifico"
];

export default function CustomiseManager({ 
  settings, 
  setSettings, 
  onClose,
  products = [],
  categories = [],
  onDownloadFbZip
}: CustomiseManagerProps) {
  const [draftSettings, setDraftSettings] = useState<WebsiteSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [activeTab, setActiveTab] = useState<'website' | 'buttons' | 'dashboard'>('website');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLocalFbZipModal, setShowLocalFbZipModal] = useState(false);

  const defaultThemeColors = {
    primary: '#ff4d6d',
    black: '#000000',
    white: '#ffffff',
    bg: '#ffffff',
  };

  const themeColors = draftSettings.themeColors || defaultThemeColors;

  const handleColorChange = (key: keyof typeof themeColors, value: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      themeColors: {
        ...(prev.themeColors || defaultThemeColors),
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setSettings(draftSettings);
      await cloudStore.saveSetting('websiteSettings', draftSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Header */}
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
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
              <Palette size={20} />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight">Customise Store</h2>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Theme colors, typography, buttons, and dashboard layout</p>
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

      {/* Sub-header Tab Bar */}
      <div className="px-2.5 py-2.5 bg-[var(--dash-bg)]/95 backdrop-blur-md border-b border-[var(--dash-border)]/60 flex items-center shrink-0 z-10">
        <div className="flex items-center bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-1 gap-1 w-full max-w-md mx-auto">
          {(['website', 'buttons', 'dashboard'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all capitalize cursor-pointer",
                activeTab === tab 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" 
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-36 bg-[var(--dash-bg)] custom-scrollbar">
        {activeTab === 'website' && (
          <div className="p-2.5 md:p-8 space-y-4 max-w-3xl mx-auto w-full">
            {draftSettings.mainFont && (
              <style>
                {`@import url('https://fonts.googleapis.com/css2?family=${draftSettings.mainFont.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');`}
              </style>
            )}
            
            {/* Primary Colour Group */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Primary Colour Group</h4>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={themeColors.primary.startsWith('#') && themeColors.primary.length === 7 ? themeColors.primary : '#ff4d6d'} 
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 p-0 shrink-0"
                />
                <input 
                  type="text" 
                  value={themeColors.primary}
                  onChange={(e) => handleColorChange('primary', e.target.value)}
                  className="flex-1 bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 uppercase font-mono text-xs md:text-sm outline-none"
                  placeholder="#FF4D6D"
                />
              </div>
            </div>

            {/* Black Colour Group */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Black Colour Group</h4>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={themeColors.black.startsWith('#') && themeColors.black.length === 7 ? themeColors.black : '#000000'} 
                  onChange={(e) => handleColorChange('black', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 p-0 shrink-0"
                />
                <input 
                  type="text" 
                  value={themeColors.black}
                  onChange={(e) => handleColorChange('black', e.target.value)}
                  className="flex-1 bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 uppercase font-mono text-xs md:text-sm outline-none"
                  placeholder="#000000"
                />
              </div>
            </div>

            {/* White Colour Group */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">White Colour Group</h4>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={themeColors.white.startsWith('#') && themeColors.white.length === 7 ? themeColors.white : '#ffffff'} 
                  onChange={(e) => handleColorChange('white', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 p-0 shrink-0"
                />
                <input 
                  type="text" 
                  value={themeColors.white}
                  onChange={(e) => handleColorChange('white', e.target.value)}
                  className="flex-1 bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 uppercase font-mono text-xs md:text-sm outline-none"
                  placeholder="#FFFFFF"
                />
              </div>
            </div>

            {/* Store Background Colour */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Front Store Background Colour</h4>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={(themeColors.bg && themeColors.bg.startsWith('#') && themeColors.bg.length === 7) ? themeColors.bg : '#ffffff'} 
                  onChange={(e) => handleColorChange('bg', e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 p-0 shrink-0"
                />
                <input 
                  type="text" 
                  value={themeColors.bg || ''}
                  onChange={(e) => handleColorChange('bg', e.target.value)}
                  className="flex-1 bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 uppercase font-mono text-xs md:text-sm outline-none"
                  placeholder="#FFFFFF"
                />
              </div>
              <p className="text-[11px] text-slate-500">This changes the main background color of the customer-facing storefront (e.g. main page, product details, cart list, and checkout views).</p>
            </div>
            
            {/* Typography Card */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Typography (Main Website)</h4>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Font Style (35 Popular Fonts)</label>
                <select
                  value={draftSettings.mainFont || 'Inter'}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, mainFont: e.target.value }))}
                  className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 font-mono text-xs md:text-sm outline-none"
                >
                  {POPULAR_FONTS.map(font => (
                    <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                  ))}
                </select>
                <div 
                  className="mt-3 p-4 bg-[var(--dash-bg)] rounded-xl text-center border border-[var(--dash-border)]/50" 
                  style={{ fontFamily: draftSettings.mainFont || 'Inter' }}
                >
                  <p className="text-white text-base font-bold">Preview Text</p>
                  <p className="text-slate-400 text-xs mt-1">The quick brown fox jumps over the lazy dog.</p>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-[var(--dash-border)]/50">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold text-slate-300">Text Brightness</label>
                  <span className="text-indigo-400 font-mono text-xs font-bold">{draftSettings.textBrightness ?? 100}%</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="100" 
                  value={draftSettings.textBrightness ?? 100}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, textBrightness: parseInt(e.target.value) }))}
                  className="w-full accent-indigo-500"
                />
                <p className="text-[11px] text-slate-500">Controls the brightness/opacity of text elements across the storefront.</p>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'buttons' && (
          <ActionButtonsCustomiser settings={draftSettings} setSettings={setDraftSettings} />
        )}

        {activeTab === 'dashboard' && (
          <div className="p-2.5 md:p-8 space-y-4 max-w-3xl mx-auto w-full">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm md:text-base font-bold text-white">Mobile Navigation Bar</h3>
              <button 
                onClick={() => setDraftSettings(prev => ({ ...prev, dashboardNav: { height: 64, width: 92, blur: 4, bottomOffset: 10 } }))}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Reset to Default
              </button>
            </div>
            
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-5">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold text-slate-300">Height</label>
                  <span className="text-indigo-400 font-mono text-xs font-bold">{draftSettings.dashboardNav?.height ?? 64}px</span>
                </div>
                <input 
                  type="range" 
                  min="40" 
                  max="100" 
                  value={draftSettings.dashboardNav?.height ?? 64}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), height: parseInt(e.target.value) } }))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="space-y-2 border-t border-[var(--dash-border)]/50 pt-4">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold text-slate-300">Width</label>
                  <span className="text-indigo-400 font-mono text-xs font-bold">{draftSettings.dashboardNav?.width ?? 92}%</span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="100" 
                  value={draftSettings.dashboardNav?.width ?? 92}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), width: parseInt(e.target.value) } }))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="space-y-2 border-t border-[var(--dash-border)]/50 pt-4">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold text-slate-300">Blur Effect</label>
                  <span className="text-indigo-400 font-mono text-xs font-bold">{draftSettings.dashboardNav?.blur ?? 4}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="40" 
                  value={draftSettings.dashboardNav?.blur ?? 4}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), blur: parseInt(e.target.value) } }))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="space-y-2 border-t border-[var(--dash-border)]/50 pt-4">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold text-slate-300">Bottom Position (Offset)</label>
                  <span className="text-indigo-400 font-mono text-xs font-bold">{draftSettings.dashboardNav?.bottomOffset ?? 10}px</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="50" 
                  value={draftSettings.dashboardNav?.bottomOffset ?? 10}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), bottomOffset: parseInt(e.target.value) } }))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="space-y-2 border-t border-[var(--dash-border)]/50 pt-4">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold text-slate-300">Glass Border Whiteness</label>
                  <span className="text-indigo-400 font-mono text-xs font-bold">{draftSettings.dashboardNav?.borderWhiteness ?? 40}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={draftSettings.dashboardNav?.borderWhiteness ?? 40}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardNav: { ...(prev.dashboardNav ?? { height: 64, width: 92, blur: 4, bottomOffset: 10 }), borderWhiteness: parseInt(e.target.value) } }))}
                  className="w-full accent-indigo-500"
                />
                <p className="text-[11px] text-slate-500">Controls the opacity/whiteness of the glass border outline.</p>
              </div>
            </div>

            <div className="flex justify-between items-center mb-1 mt-6">
              <h3 className="text-sm md:text-base font-bold text-white">Dashboard Theme</h3>
              <button 
                onClick={() => setDraftSettings(prev => ({ ...prev, dashboardTheme: { blueTint: 47 } }))}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Reset Tint
              </button>
            </div>

            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs font-semibold text-slate-300">Blue Tint Level</label>
                  <span className="text-indigo-400 font-mono text-xs font-bold">{draftSettings.dashboardTheme?.blueTint ?? 47}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={draftSettings.dashboardTheme?.blueTint ?? 47}
                  onChange={(e) => setDraftSettings(prev => ({ ...prev, dashboardTheme: { ...(prev.dashboardTheme ?? { blueTint: 47 }), blueTint: parseInt(e.target.value) } }))}
                  className="w-full accent-indigo-500"
                />
                <p className="text-[11px] text-slate-500">Adjust the blue saturation of the dashboard dark mode theme.</p>
              </div>
            </div>

            <div className="flex justify-between items-center mb-1 mt-6">
              <h3 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                <FolderArchive size={18} className="text-indigo-400" />
                FB Auto-Sender Dataset
              </h3>
            </div>

            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">In-Stock Products Dataset (.ZIP)</h4>
                  <p className="text-xs text-slate-400 mt-1">Generate and download a single .ZIP archive containing all in-stock product images and formatted text.txt captions for FB Messenger auto-sender.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onDownloadFbZip) {
                      onDownloadFbZip();
                    } else {
                      setShowLocalFbZipModal(true);
                    }
                  }}
                  className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                >
                  <Download size={16} />
                  <span>Download Fb Zip</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showLocalFbZipModal && (
        <FbZipExportModal
          onClose={() => setShowLocalFbZipModal(false)}
          products={products}
          categories={categories}
          themePrimary={themeColors.primary}
        />
      )}
    </div>
  );
}
