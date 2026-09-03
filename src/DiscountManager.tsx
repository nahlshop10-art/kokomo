import React, { useState } from 'react';
import { ChevronLeft, Plus, Edit3, Trash2, Check, X, ChevronRight, Save, Percent, Tag, Calendar, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import { WebsiteSettings, DiscountRule, DiscountType, Product, Category } from './types';
import { cn, formatPrice } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface DiscountManagerProps {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  products: Product[];
  categories: Category[];
  onClose: () => void;
}

const defaultDiscount: DiscountRule = {
  id: '',
  name: '',
  status: true,
  priority: 1,
  type: 'percentage',
  conditions: {},
  action: {},
  limits: {},
  time: {}
};

export default function DiscountManager({ websiteSettings, setWebsiteSettings, products, categories, onClose }: DiscountManagerProps) {
  const [discounts, setDiscounts] = useState<DiscountRule[]>(websiteSettings.discounts || []);
  const [editingDiscount, setEditingDiscount] = useState<DiscountRule | null>(null);
  const [step, setStep] = useState(1);

  const themeColor = '#6366F1';

  const handleSaveSettings = (newDiscounts: DiscountRule[]) => {
    setDiscounts(newDiscounts);
    const updatedSettings = { ...websiteSettings, discounts: newDiscounts };
    setWebsiteSettings(updatedSettings);
    cloudStore.saveSetting('websiteSettings', updatedSettings).catch(console.error);
  };

  const handleAdd = () => {
    setEditingDiscount({ ...defaultDiscount, id: Date.now().toString() });
    setStep(1);
  };

  const handleEdit = (discount: DiscountRule) => {
    setEditingDiscount({ ...discount });
    setStep(1);
  };

  const handleDelete = (id: string) => {
    const updated = discounts.filter(d => d.id !== id);
    handleSaveSettings(updated);
  };

  const handleToggleStatus = (id: string) => {
    const updated = discounts.map(d => d.id === id ? { ...d, status: !d.status } : d);
    handleSaveSettings(updated);
  };

  const handleSaveDiscount = () => {
    if (!editingDiscount) return;
    
    if (!editingDiscount.name.trim()) {
      alert('Please provide a name for this discount rule.');
      return;
    }

    const exists = discounts.some(d => d.id === editingDiscount.id);
    const updated = exists 
      ? discounts.map(d => d.id === editingDiscount.id ? editingDiscount : d)
      : [...discounts, editingDiscount];
    
    handleSaveSettings(updated);
    setEditingDiscount(null);
  };

  if (editingDiscount) {
    return (
      <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[260px]">
        {/* Wizard Header */}
        <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-4 py-3.5 md:px-8 md:py-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setEditingDiscount(null)} 
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">
                  {discounts.find(d => d.id === editingDiscount.id) ? 'Edit Discount Rule' : 'Create New Discount'}
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Step {step} of 6: {['Basic Info', 'Discount Type', 'Conditions', 'Action Values', 'Usage Limits', 'Schedule'][step - 1]}
                </p>
              </div>
            </div>

            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Step {step}/6
            </span>
          </div>
        </div>

        {/* Wizard Content */}
        <div 
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 max-w-4xl mx-auto w-full pb-32 overscroll-y-contain custom-scrollbar"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Step Pill Tracker */}
          <div className="flex items-center justify-between bg-[var(--dash-card)] border border-[var(--dash-border)]/70 p-2.5 rounded-2xl shadow-md gap-1">
            {[1, 2, 3, 4, 5, 6].map(s => (
              <button
                key={s}
                onClick={() => setStep(s)}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                  step === s ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : 
                  step > s ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : 
                  "bg-[var(--dash-bg)] text-slate-500 hover:text-slate-300"
                )}
              >
                {step > s ? <Check size={13} className="stroke-[3]" /> : s}
                <span className="hidden sm:inline">
                  {['Info', 'Type', 'Rules', 'Action', 'Limits', 'Time'][s - 1]}
                </span>
              </button>
            ))}
          </div>

          {/* Step 1: Basic Details */}
          {step === 1 && (
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 pb-3 border-b border-[var(--dash-border)]/50">
                1. Basic Details
              </h2>
              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Discount Title *</label>
                <input 
                  type="text" 
                  value={editingDiscount.name}
                  onChange={e => setEditingDiscount({...editingDiscount, name: e.target.value})}
                  placeholder="e.g. Eid Special 20% Off"
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)]">
                <div>
                  <span className="text-xs font-bold text-white block">Rule Active Status</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">Toggle whether this discount applies immediately</p>
                </div>
                <button 
                  onClick={() => setEditingDiscount({...editingDiscount, status: !editingDiscount.status})}
                  className={cn(
                    "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                    editingDiscount.status ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
                  )}
                >
                  <div
                    className={cn(
                      "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                      editingDiscount.status ? "translate-x-5.5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
                  Priority Order (Higher priority applies first)
                </label>
                <input 
                  type="number" 
                  value={editingDiscount.priority}
                  onChange={e => setEditingDiscount({...editingDiscount, priority: parseInt(e.target.value) || 0})}
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Step 2: Type */}
          {step === 2 && (
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 pb-3 border-b border-[var(--dash-border)]/50">
                2. Select Discount Type
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { id: 'percentage', label: 'Percentage Discount (%)', desc: 'Deduct X% from eligible cart items' },
                  { id: 'fixed', label: 'Fixed Amount Discount (৳)', desc: 'Deduct a flat ৳ amount from total' },
                  { id: 'free_delivery', label: 'Free Delivery', desc: 'Waive shipping charge across all areas' },
                  { id: 'buy_x_get_y', label: 'Buy X Get Y Free', desc: 'Bundle quantity promotion' },
                  { id: 'coupon', label: 'Coupon Code', desc: 'Customer enters promo code at checkout' }
                ].map(t => (
                  <div 
                    key={t.id}
                    onClick={() => setEditingDiscount({...editingDiscount, type: t.id as DiscountType})}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 group",
                      editingDiscount.type === t.id ? "bg-indigo-500/10 border-indigo-500 shadow-md shadow-indigo-500/10" : "bg-[var(--dash-bg)] border-[var(--dash-border)] hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("text-xs md:text-sm font-bold", editingDiscount.type === t.id ? "text-indigo-400" : "text-white")}>
                        {t.label}
                      </span>
                      {editingDiscount.type === t.id && <Check size={16} className="text-indigo-400 stroke-[3]" />}
                    </div>
                    <p className="text-[11px] text-slate-500">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Conditions */}
          {step === 3 && (
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 pb-3 border-b border-[var(--dash-border)]/50">
                3. Qualifying Conditions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Minimum Order Amount (৳)</label>
                  <input 
                    type="number" 
                    value={editingDiscount.conditions.minOrderAmount || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, conditions: {...editingDiscount.conditions, minOrderAmount: parseFloat(e.target.value) || undefined}})}
                    placeholder="e.g. 1000"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Maximum Order Amount (৳) (Optional)</label>
                  <input 
                    type="number" 
                    value={editingDiscount.conditions.maxOrderAmount || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, conditions: {...editingDiscount.conditions, maxOrderAmount: parseFloat(e.target.value) || undefined}})}
                    placeholder="e.g. 5000"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Action */}
          {step === 4 && (
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 pb-3 border-b border-[var(--dash-border)]/50">
                4. Discount Amount / Values
              </h2>
              {editingDiscount.type === 'percentage' && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Discount Percentage (%)</label>
                  <input 
                    type="number" 
                    value={editingDiscount.action.percentage || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, percentage: parseFloat(e.target.value) || undefined}})}
                    placeholder="e.g. 20"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              )}
              {editingDiscount.type === 'fixed' && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Fixed Discount (৳)</label>
                  <input 
                    type="number" 
                    value={editingDiscount.action.fixedAmount || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, fixedAmount: parseFloat(e.target.value) || undefined}})}
                    placeholder="e.g. 150"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              )}
              {editingDiscount.type === 'coupon' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Promo Coupon Code *</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editingDiscount.action.couponCode || ''}
                        onChange={e => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, couponCode: e.target.value.toUpperCase()}})}
                        placeholder="e.g. EID2026"
                        className="flex-1 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 uppercase font-mono tracking-wider"
                      />
                      <button 
                        onClick={() => setEditingDiscount({...editingDiscount, action: {...editingDiscount.action, couponCode: Math.random().toString(36).substring(2, 8).toUpperCase()}})}
                        className="px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl transition-colors text-xs font-semibold"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Limits */}
          {step === 5 && (
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 pb-3 border-b border-[var(--dash-border)]/50">
                5. Usage Limits
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Max Global Redemptions</label>
                  <input 
                    type="number" 
                    value={editingDiscount.limits.maxUsageGlobal || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, limits: {...editingDiscount.limits, maxUsageGlobal: parseInt(e.target.value) || undefined}})}
                    placeholder="e.g. 100"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Max Uses Per Customer</label>
                  <input 
                    type="number" 
                    value={editingDiscount.limits.maxUsagePerUser || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, limits: {...editingDiscount.limits, maxUsagePerUser: parseInt(e.target.value) || undefined}})}
                    placeholder="e.g. 1"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Schedule */}
          {step === 6 && (
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 pb-3 border-b border-[var(--dash-border)]/50">
                6. Active Schedule & Time Window
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Start Date & Time (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={editingDiscount.time.startDate || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, time: {...editingDiscount.time, startDate: e.target.value}})}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Expiration Date & Time (Optional)</label>
                  <input 
                    type="datetime-local" 
                    value={editingDiscount.time.endDate || ''}
                    onChange={e => setEditingDiscount({...editingDiscount, time: {...editingDiscount.time, endDate: e.target.value}})}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Bottom Navigation */}
        <div className="sticky bottom-0 bg-[var(--dash-bg)]/95 backdrop-blur-md border-t border-[var(--dash-border)]/70 p-3.5 md:p-4 flex items-center justify-between z-20 shrink-0">
          <button 
            onClick={() => step > 1 ? setStep(step - 1) : setEditingDiscount(null)}
            className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-white/5 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            {step === 1 ? 'Cancel' : '← Previous Step'}
          </button>
          
          {step < 6 ? (
            <button 
              onClick={() => setStep(step + 1)}
              className="px-6 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2 cursor-pointer"
            >
              Continue to Step {step + 1} <ChevronRight size={16} />
            </button>
          ) : (
            <button 
              onClick={handleSaveDiscount}
              className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0 disabled:opacity-50"
            >
              Save
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[260px]">
      {/* Top Bar */}
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
                <Percent size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Discounts & Coupons
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Manage promotional coupon codes, percentage rules, and free delivery
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0"
          >
            <Plus size={16} className="stroke-[3]" /> Create Rule
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 max-w-4xl mx-auto w-full pb-32 overscroll-y-contain custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {discounts.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-[var(--dash-border)] bg-[var(--dash-card)]/40 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Percent size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">No Discounts Configured</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Create your first promotional discount rule or coupon code to boost conversions.
              </p>
            </div>
            <button
              onClick={handleAdd}
              className="px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer inline-flex items-center gap-2"
            >
              <Plus size={16} /> Create First Discount
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {discounts.map(discount => (
              <div 
                key={discount.id} 
                className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-5 shadow-xl space-y-3.5 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-white text-sm md:text-base truncate">
                        {discount.name}
                      </h3>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {discount.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                      {discount.type === 'percentage' && <span className="text-indigo-400 font-bold">{discount.action.percentage}% OFF</span>}
                      {discount.type === 'fixed' && <span className="text-indigo-400 font-bold">{formatPrice(discount.action.fixedAmount || 0)} OFF</span>}
                      {discount.type === 'free_delivery' && <span className="text-blue-400 font-bold">Free Shipping</span>}
                      {discount.type === 'coupon' && <span className="text-indigo-400 font-mono font-bold">Code: {discount.action.couponCode}</span>}
                      {discount.conditions.minOrderAmount && (
                        <span className="text-slate-500 text-[11px]">
                          (Min order: ৳{discount.conditions.minOrderAmount})
                        </span>
                      )}
                    </p>
                  </div>

                  <button 
                    onClick={() => handleToggleStatus(discount.id)}
                    className={cn(
                      "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                      discount.status ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                        discount.status ? "translate-x-5.5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[var(--dash-border)]/40">
                  <span className="text-[11px] text-slate-500">
                    {discount.status ? '● Active in store' : '○ Inactive'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => handleEdit(discount)}
                      className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                      title="Edit rule"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button 
                      onClick={() => handleDelete(discount.id)}
                      className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors cursor-pointer"
                      title="Delete rule"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
