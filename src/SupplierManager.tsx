import React, { useState, useMemo } from 'react';
import { ChevronLeft, Plus, X, Trash2, Edit3, Check, Factory, Search, Building2 } from 'lucide-react';
import { WebsiteSettings } from './types';
import { cn } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface SupplierManagerProps {
  settings: WebsiteSettings;
  setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
}

export default function SupplierManager({ settings, setSettings, onClose }: SupplierManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newSupplier, setNewSupplier] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const suppliers = settings.suppliers || [];

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers;
    return suppliers.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase().trim()));
  }, [suppliers, searchQuery]);

  const handleAdd = () => {
    const trimmed = newSupplier.trim();
    if (!trimmed || suppliers.includes(trimmed)) {
      setIsAdding(false);
      setNewSupplier('');
      return;
    }
    const updated = [...suppliers, trimmed];
    const updatedSettings = { ...settings, suppliers: updated };
    setSettings(updatedSettings);
    cloudStore.saveSetting('websiteSettings', updatedSettings).catch(console.error);
    setNewSupplier('');
    setIsAdding(false);
  };

  const handleEdit = (oldSupplier: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || (trimmed !== oldSupplier && suppliers.includes(trimmed))) {
      setEditingSupplier(null);
      setEditValue('');
      return;
    }
    const updated = suppliers.map(s => s === oldSupplier ? trimmed : s);
    const updatedSettings = { ...settings, suppliers: updated };
    setSettings(updatedSettings);
    cloudStore.saveSetting('websiteSettings', updatedSettings).catch(console.error);
    setEditingSupplier(null);
    setEditValue('');
  };

  const handleRemove = (supplier: string) => {
    const updated = suppliers.filter(s => s !== supplier);
    const updatedSettings = { ...settings, suppliers: updated };
    setSettings(updatedSettings);
    cloudStore.saveSetting('websiteSettings', updatedSettings).catch(console.error);
  };

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
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
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                <Factory size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Suppliers & Vendors
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Manage product sourcing vendors and supplier assignment tags
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0"
          >
            Done
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 max-w-4xl mx-auto w-full pb-32 overscroll-y-contain custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Quick Add Card */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/40">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-amber-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Add New Supplier</h2>
            </div>
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} className="stroke-[3]" /> Add Supplier
              </button>
            )}
          </div>

          {isAdding && (
            <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] p-3.5 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <label className="text-xs font-semibold text-slate-300">Supplier / Vendor Name</label>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  className="flex-1 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
                  placeholder="e.g. Guangzhou Wholesale Market"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd();
                    if (e.key === 'Escape') {
                      setIsAdding(false);
                      setNewSupplier('');
                    }
                  }}
                />
                <button 
                  onClick={handleAdd}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-md cursor-pointer whitespace-nowrap"
                >
                  Save
                </button>
                <button 
                  onClick={() => { setIsAdding(false); setNewSupplier(''); }}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Search Bar when > 3 suppliers */}
          {suppliers.length > 3 && (
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search suppliers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
              />
            </div>
          )}
        </div>

        {/* Supplier Directory List */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/40">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Supplier Directory</h2>
            <span className="text-[11px] text-slate-500">
              Showing {filteredSuppliers.length} of {suppliers.length}
            </span>
          </div>

          <div className="space-y-2 pt-1">
            {filteredSuppliers.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-xl border border-dashed border-[var(--dash-border)] bg-white/[0.01]">
                <Factory size={32} className="mx-auto text-slate-600 mb-2" />
                <p className="text-xs text-slate-400 font-medium">
                  {searchQuery ? 'No suppliers match your search.' : 'No suppliers added yet.'}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Add suppliers to tag and track buy prices across your catalog.
                </p>
              </div>
            ) : (
              filteredSuppliers.map((supplier, idx) => (
                <div 
                  key={idx} 
                  className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3.5 flex items-center justify-between transition-all hover:border-slate-600 group"
                >
                  {editingSupplier === supplier ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input 
                        type="text" 
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 bg-[var(--dash-card)] text-white border border-[var(--dash-border)] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEdit(supplier);
                          if (e.key === 'Escape') {
                            setEditingSupplier(null);
                            setEditValue('');
                          }
                        }}
                      />
                      <button 
                        onClick={() => handleEdit(supplier)} 
                        className="text-emerald-400 p-2 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Save edit"
                      >
                        <Check size={16} className="stroke-[3]" />
                      </button>
                      <button 
                        onClick={() => setEditingSupplier(null)} 
                        className="text-slate-500 p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {supplier.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-white font-medium text-xs md:text-sm truncate">
                          {supplier}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                        <button 
                          onClick={() => { setEditingSupplier(supplier); setEditValue(supplier); }} 
                          className="text-slate-400 hover:text-indigo-400 p-2 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Edit supplier"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button 
                          onClick={() => handleRemove(supplier)} 
                          className="text-slate-400 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete supplier"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

