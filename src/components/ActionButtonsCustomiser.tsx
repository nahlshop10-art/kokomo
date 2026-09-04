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
  const [selectedButton, setSelectedButton] = useState<ButtonKey>('addToCart');
  
  const buttonsConfig: ActionButtonsConfig = settings.actionButtons || DEFAULT_ACTION_BUTTONS;

  const currentSettings: ButtonDesign | FloatingButtonDesign = buttonsConfig[selectedButton] || DEFAULT_ACTION_BUTTONS[selectedButton] || DEFAULT_ACTION_BUTTONS.addToCart!;

  const updateSettings = (key: string, value: any) => {
    setSettings(prev => {
      const prevButtons = prev.actionButtons || DEFAULT_ACTION_BUTTONS;
      const baseBtn = prevButtons[selectedButton] || DEFAULT_ACTION_BUTTONS[selectedButton] || DEFAULT_ACTION_BUTTONS.addToCart!;
      return {
        ...prev,
        actionButtons: {
          ...prevButtons,
          [selectedButton]: {
            ...baseBtn,
            [key]: value
          }
        }
      };
    });
  };

  const buttonOptions: { key: ButtonKey; label: string }[] = [
    { key: 'addToCart', label: 'Add to Cart / Add to Order Button' },
    { key: 'viewCart', label: 'View Cart Floating Button' },
    { key: 'confirmOrder', label: 'Confirm Order Floating Button' },
    { key: 'checkout', label: 'Checkout Button (Cart)' },
    { key: 'placeOrder', label: 'Place Order Button' },
  ];

  // Helper parsing numeric height / width / radius
  const numericHeight = parseInt(String(currentSettings.height || '38').replace(/\D/g, '')) || 38;
  const numericRadius = currentSettings.borderRadius === '9999px' ? 9999 : (parseInt(String(currentSettings.borderRadius || '9999').replace(/\D/g, '')) || 0);
  const widthVal = currentSettings.width || '100%';
  const numericWidth = widthVal.endsWith('%') ? parseInt(widthVal) : (widthVal === 'auto' ? 100 : 100);

  return (
    <div className="p-2.5 md:p-8 space-y-4 max-w-3xl mx-auto w-full pb-36">
      {/* Live Preview Card */}
      <div className="bg-[var(--dash-card)] border border-indigo-500/30 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
        <div className="flex justify-between items-center border-b border-[var(--dash-border)]/50 pb-2.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
            Live Preview: {buttonOptions.find(o => o.key === selectedButton)?.label}
          </h4>
          <span className="text-[11px] font-mono text-slate-400">
            H: {currentSettings.height || '38px'} | W: {currentSettings.width || '100%'} | R: {currentSettings.borderRadius || '9999px'}
          </span>
        </div>
        
        <div className="py-6 px-4 bg-[var(--dash-bg)] rounded-xl flex flex-col items-center justify-center gap-4 border border-[var(--dash-border)]/50 overflow-hidden">
          {selectedButton === 'addToCart' ? (
            <div className="w-full flex flex-col items-center gap-3">
              <div className="w-full max-w-xs flex justify-center">
                <button
                  style={{
                    height: currentSettings.height || '38px',
                    width: currentSettings.width === 'auto' ? 'auto' : (currentSettings.width || '100%'),
                    borderRadius: currentSettings.borderRadius || '9999px',
                    background: 'var(--theme-primary-gradient)',
                    boxShadow: 'var(--theme-primary-shadow)',
                    color: 'rgb(254, 243, 245)',
                  }}
                  className="font-semibold text-sm flex items-center justify-center px-4 transition-all"
                >
                  Add to cart
                </button>
              </div>
              <div className="w-full max-w-xs flex justify-center">
                <button
                  style={{
                    height: currentSettings.height || '38px',
                    width: currentSettings.width === 'auto' ? 'auto' : (currentSettings.width || '100%'),
                    borderRadius: currentSettings.borderRadius || '9999px',
                    background: 'var(--theme-primary-gradient)',
                    boxShadow: 'var(--theme-primary-shadow)',
                    color: 'rgb(254, 243, 245)',
                  }}
                  className="font-semibold text-sm flex items-center justify-center gap-1.5 px-4 transition-all"
                >
                  <span className="text-base leading-none font-bold">+</span> Add to Order
                </button>
              </div>
            </div>
          ) : (
            <button
              style={{
                height: currentSettings.height || '48px',
                width: currentSettings.width === 'auto' ? 'auto' : (currentSettings.width || '100%'),
                borderRadius: currentSettings.borderRadius || '9999px',
                background: 'var(--theme-primary-gradient)',
                boxShadow: 'var(--theme-primary-shadow)',
                color: 'rgb(254, 243, 245)',
              }}
              className="font-semibold text-sm flex items-center justify-center px-6 transition-all"
            >
              {selectedButton === 'viewCart' ? 'View Cart ৳ 1,838' : selectedButton === 'placeOrder' ? 'Place Order →' : 'Checkout'}
            </button>
          )}
        </div>
      </div>

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

      <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 border-b border-[var(--dash-border)]/50 pb-3">
          <Layout size={16} className="text-indigo-400" /> Size & Shape
        </h4>
        
        {/* Height Control (Slider + Input + Quick Presets) */}
        <div className="space-y-2.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Button Height</label>
            <span className="text-indigo-400 font-mono text-xs font-bold bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
              {currentSettings.height || '38px'}
            </span>
          </div>
          <input 
            type="range" 
            min="28" 
            max="64" 
            value={numericHeight}
            onChange={(e) => updateSettings('height', `${e.target.value}px`)}
            className="w-full accent-indigo-500 cursor-pointer"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { label: 'Compact (32px)', val: '32px' },
              { label: 'Normal (36px)', val: '36px' },
              { label: 'Standard (38px)', val: '38px' },
              { label: 'Comfortable (44px)', val: '44px' },
              { label: 'Large (50px)', val: '50px' },
            ].map(p => (
              <button
                key={p.val}
                type="button"
                onClick={() => updateSettings('height', p.val)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border cursor-pointer",
                  currentSettings.height === p.val
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                    : "bg-[var(--dash-bg)] text-slate-400 border-[var(--dash-border)] hover:text-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Width Control (Slider + Presets) */}
        <div className="space-y-2.5 border-t border-[var(--dash-border)]/50 pt-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Button Width</label>
            <span className="text-indigo-400 font-mono text-xs font-bold bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
              {currentSettings.width || '100%'}
            </span>
          </div>
          <input 
            type="range" 
            min="50" 
            max="100" 
            value={numericWidth}
            onChange={(e) => updateSettings('width', `${e.target.value}%`)}
            className="w-full accent-indigo-500 cursor-pointer"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { label: 'Full Width (100%)', val: '100%' },
              { label: '95% Width', val: '95%' },
              { label: '90% Width', val: '90%' },
              { label: '85% Width', val: '85%' },
              { label: '80% Width', val: '80%' },
              { label: 'Auto Width', val: 'auto' },
            ].map(p => (
              <button
                key={p.val}
                type="button"
                onClick={() => updateSettings('width', p.val)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border cursor-pointer",
                  currentSettings.width === p.val
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                    : "bg-[var(--dash-bg)] text-slate-400 border-[var(--dash-border)] hover:text-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Border Radius Control (Corner Radius Rounded) */}
        <div className="space-y-2.5 border-t border-[var(--dash-border)]/50 pt-4">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">Corner Radius (Rounded)</label>
            <span className="text-indigo-400 font-mono text-xs font-bold bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
              {currentSettings.borderRadius === '9999px' ? 'Full Pill (9999px)' : (currentSettings.borderRadius || '9999px')}
            </span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="40" 
            value={numericRadius > 40 ? 40 : numericRadius}
            onChange={(e) => updateSettings('borderRadius', `${e.target.value}px`)}
            className="w-full accent-indigo-500 cursor-pointer"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { label: 'Sharp Square (0px)', val: '0px' },
              { label: 'Slightly Rounded (6px)', val: '6px' },
              { label: 'Rounded (10px)', val: '10px' },
              { label: 'Extra Rounded (16px)', val: '16px' },
              { label: 'Full Pill (9999px)', val: '9999px' },
            ].map(p => (
              <button
                key={p.val}
                type="button"
                onClick={() => updateSettings('borderRadius', p.val)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border cursor-pointer",
                  currentSettings.borderRadius === p.val
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                    : "bg-[var(--dash-bg)] text-slate-400 border-[var(--dash-border)] hover:text-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-[var(--dash-border)]/50 pt-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Shadow (Elevation)</label>
            <input 
              type="range" min="0" max="5"
              value={currentSettings.elevation || 0}
              onChange={(e) => updateSettings('elevation', parseInt(e.target.value))}
              className="w-full mt-2 accent-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Custom Border Radius</label>
            <input 
              type="text"
              value={currentSettings.borderRadius || ''}
              onChange={(e) => updateSettings('borderRadius', e.target.value)}
              className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-mono outline-none"
              placeholder="e.g. 12px or 9999px"
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
