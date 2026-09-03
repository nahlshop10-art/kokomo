import React, { useState } from 'react';
import { WebsiteSettings, ActionButtonsConfig, ButtonDesign, FloatingButtonDesign, DEFAULT_ACTION_BUTTONS } from '../types';
import { ChevronDown, Type, PaintBucket, Layout, Move, MousePointerClick, AlignLeft, AlignCenter, AlignRight, Check, CheckCircle2, ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '../lib/utils';

interface ActionButtonsCustomiserProps {
  settings: WebsiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
}

type ButtonKey = keyof ActionButtonsConfig;

export default function ActionButtonsCustomiser({ settings, setSettings }: ActionButtonsCustomiserProps) {
  const [selectedButton, setSelectedButton] = useState<ButtonKey>('viewCart');
  
  const buttonsConfig: ActionButtonsConfig = settings.actionButtons || DEFAULT_ACTION_BUTTONS;

  const currentSettings = buttonsConfig[selectedButton];

  const updateSettings = (key: string, value: any) => {
    setSettings(prev => {
      const prevButtons = prev.actionButtons || DEFAULT_ACTION_BUTTONS;
      return {
        ...prev,
        actionButtons: {
          ...prevButtons,
          [selectedButton]: {
            ...prevButtons[selectedButton],
            [key]: value
          }
        }
      };
    });
  };

  const buttonOptions: { key: ButtonKey; label: string }[] = [
    { key: 'viewCart', label: 'View Cart Floating Button' },
    { key: 'confirmOrder', label: 'Confirm Order Floating Button' },
    { key: 'checkout', label: 'Checkout Button (Cart)' },
    { key: 'placeOrder', label: 'Place Order Button' },
  ];

  return (
    <div className="p-2.5 md:p-8 space-y-4 max-w-3xl mx-auto w-full pb-36">
      <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Select Button</h4>
        <div className="space-y-2">
          {buttonOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSelectedButton(opt.key)}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all cursor-pointer border text-xs md:text-sm font-semibold",
                selectedButton === opt.key 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25" 
                  : "bg-[var(--dash-bg)] text-slate-300 border-[var(--dash-border)] hover:bg-white/5 hover:text-white"
              )}
            >
              <span>{opt.label}</span>
              {selectedButton === opt.key && <CheckCircle2 size={18} />}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-[var(--dash-border)]/50 pb-3">
          <Layout size={16} className="text-indigo-400" /> Size & Shape
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Width</label>
            <select
              value={currentSettings.width}
              onChange={(e) => updateSettings('width', e.target.value)}
              className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none"
            >
              <option value="auto">Auto (Fit Content)</option>
              <option value="100%">100% (Full Width)</option>
              <option value="90%">90% Width</option>
              <option value="200px">Fixed (200px)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Height</label>
            <input 
              type="text"
              value={currentSettings.height}
              onChange={(e) => updateSettings('height', e.target.value)}
              className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none font-mono"
              placeholder="e.g. 48px"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Border Radius</label>
            <input 
              type="text"
              value={currentSettings.borderRadius}
              onChange={(e) => updateSettings('borderRadius', e.target.value)}
              className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none font-mono"
              placeholder="e.g. 8px, 9999px"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Shadow (Elevation)</label>
            <input 
              type="range" min="0" max="5"
              value={currentSettings.elevation}
              onChange={(e) => updateSettings('elevation', parseInt(e.target.value))}
              className="w-full mt-2 accent-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Padding X</label>
            <input 
              type="text"
              value={currentSettings.paddingX}
              onChange={(e) => updateSettings('paddingX', e.target.value)}
              className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none font-mono"
              placeholder="e.g. 24px"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Padding Y</label>
            <input 
              type="text"
              value={currentSettings.paddingY}
              onChange={(e) => updateSettings('paddingY', e.target.value)}
              className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none font-mono"
              placeholder="e.g. 12px"
            />
          </div>
        </div>
      </div>

      <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-[var(--dash-border)]/50 pb-3">
          <PaintBucket size={16} className="text-indigo-400" /> Colors
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Background</label>
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={currentSettings.backgroundColor} 
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0"
              />
              <input 
                type="text" 
                value={currentSettings.backgroundColor}
                onChange={(e) => updateSettings('backgroundColor', e.target.value)}
                className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2 uppercase font-mono text-xs outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Text / Icon</label>
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={currentSettings.textColor} 
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0 shrink-0"
              />
              <input 
                type="text" 
                value={currentSettings.textColor}
                onChange={(e) => updateSettings('textColor', e.target.value)}
                className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2 uppercase font-mono text-xs outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-[var(--dash-border)]/50 pb-3">
          <Type size={16} className="text-indigo-400" /> Typography
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Font Size</label>
            <input 
              type="text"
              value={currentSettings.fontSize}
              onChange={(e) => updateSettings('fontSize', e.target.value)}
              className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none font-mono"
              placeholder="e.g. 16px"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Font Weight</label>
            <select
              value={currentSettings.fontWeight}
              onChange={(e) => updateSettings('fontWeight', parseInt(e.target.value))}
              className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none"
            >
              <option value="400">Normal (400)</option>
              <option value="500">Medium (500)</option>
              <option value="600">SemiBold (600)</option>
              <option value="700">Bold (700)</option>
              <option value="800">ExtraBold (800)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-[var(--dash-border)]/50 pb-3">
          <MousePointerClick size={16} className="text-indigo-400" /> Icon Settings
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Icon Style</label>
            <select
              value={currentSettings.icon}
              onChange={(e) => updateSettings('icon', e.target.value)}
              className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs md:text-sm outline-none"
            >
              <option value="none">None (Hide)</option>
              <option value="bag">Shopping Bag</option>
              <option value="cart">Shopping Cart</option>
              <option value="check">Checkmark</option>
              <option value="arrow">Right Arrow</option>
              <option value="plus">Plus Sign</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Position</label>
            <div className="flex rounded-xl overflow-hidden border border-[var(--dash-border)] bg-[var(--dash-bg)] p-1 gap-1">
              <button
                onClick={() => updateSettings('iconPosition', 'left')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  currentSettings.iconPosition === 'left' ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "text-slate-400 hover:text-white"
                )}
              >
                Left
              </button>
              <button
                onClick={() => updateSettings('iconPosition', 'right')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  currentSettings.iconPosition === 'right' ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "text-slate-400 hover:text-white"
                )}
              >
                Right
              </button>
            </div>
          </div>
        </div>
      </div>

      {('position' in currentSettings) && (
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-[var(--dash-border)]/50 pb-3">
            <Move size={16} className="text-indigo-400" /> Floating Position
          </h4>
          
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Screen Position</label>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => updateSettings('position', 'top-left')}
                className={cn(
                  "py-2.5 rounded-xl border text-xs font-bold flex justify-center transition-all cursor-pointer",
                  currentSettings.position === 'top-left' ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25" : "bg-[var(--dash-bg)] text-slate-300 border-[var(--dash-border)] hover:bg-white/5"
                )}
              >
                Top Left
              </button>
              <div className="py-2.5 border border-dashed border-[var(--dash-border)] rounded-xl flex justify-center opacity-30 text-xs font-bold">
                Top
              </div>
              <button 
                onClick={() => updateSettings('position', 'top-right')}
                className={cn(
                  "py-2.5 rounded-xl border text-xs font-bold flex justify-center transition-all cursor-pointer",
                  currentSettings.position === 'top-right' ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25" : "bg-[var(--dash-bg)] text-slate-300 border-[var(--dash-border)] hover:bg-white/5"
                )}
              >
                Top Right
              </button>
              <button 
                onClick={() => updateSettings('position', 'bottom-left')}
                className={cn(
                  "py-2.5 rounded-xl border text-xs font-bold flex justify-center transition-all cursor-pointer",
                  currentSettings.position === 'bottom-left' ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25" : "bg-[var(--dash-bg)] text-slate-300 border-[var(--dash-border)] hover:bg-white/5"
                )}
              >
                Bot Left
              </button>
              <button 
                onClick={() => updateSettings('position', 'bottom-center')}
                className={cn(
                  "py-2.5 rounded-xl border text-xs font-bold flex justify-center transition-all cursor-pointer",
                  currentSettings.position === 'bottom-center' ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25" : "bg-[var(--dash-bg)] text-slate-300 border-[var(--dash-border)] hover:bg-white/5"
                )}
              >
                Bot Center
              </button>
              <button 
                onClick={() => updateSettings('position', 'bottom-right')}
                className={cn(
                  "py-2.5 rounded-xl border text-xs font-bold flex justify-center transition-all cursor-pointer",
                  currentSettings.position === 'bottom-right' ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25" : "bg-[var(--dash-bg)] text-slate-300 border-[var(--dash-border)] hover:bg-white/5"
                )}
              >
                Bot Right
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">You can also drag the floating button preview on the main screen to change position.</p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Margin Bottom</label>
              <input 
                type="text"
                value={(currentSettings as FloatingButtonDesign).marginBottom}
                onChange={(e) => updateSettings('marginBottom', e.target.value)}
                className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-2 py-2 text-xs text-center font-mono outline-none"
                placeholder="24px"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Margin Left</label>
              <input 
                type="text"
                value={(currentSettings as FloatingButtonDesign).marginLeft}
                onChange={(e) => updateSettings('marginLeft', e.target.value)}
                className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-2 py-2 text-xs text-center font-mono outline-none"
                placeholder="0px"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Margin Right</label>
              <input 
                type="text"
                value={(currentSettings as FloatingButtonDesign).marginRight}
                onChange={(e) => updateSettings('marginRight', e.target.value)}
                className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-2 py-2 text-xs text-center font-mono outline-none"
                placeholder="0px"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
