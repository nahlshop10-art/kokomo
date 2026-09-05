import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, Download, Check, MessageCircle, Calendar, Copy, MapPin, Clock, Tag, FileText, Activity, Phone, MoreVertical, X, User, Settings, Save, ShoppingCart } from 'lucide-react';
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay, isToday, isYesterday } from 'date-fns';
import { WebsiteSettings, IncompleteOrder, Order } from './types';
import { cn, formatPrice, formatWhatsAppPhone, normalizePhone } from './lib/utils';
import { cloudStore } from './lib/cloudStore';

interface Props {
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  incompleteOrders: IncompleteOrder[];
  orders?: Order[];
  setIncompleteOrders?: React.Dispatch<React.SetStateAction<any[]>>;
  setOrders?: React.Dispatch<React.SetStateAction<any[]>>;
  onClose: () => void;
}



export default function IncompleteOrdersManager({ websiteSettings, setWebsiteSettings, incompleteOrders, orders = [], setIncompleteOrders, setOrders, onClose }: Props) {
  const [enabled, setEnabled] = useState(websiteSettings.incompleteOrdersFeature?.enabled ?? false);
  const [inactivityTimerMinutes, setInactivityTimerMinutes] = useState(websiteSettings.incompleteOrdersFeature?.inactivityTimerMinutes?.toString() || '5');
  const [duplicateControlValue, setDuplicateControlValue] = useState(websiteSettings.incompleteOrdersFeature?.duplicateControlValue?.toString() || '1');
  const [duplicateControlUnit, setDuplicateControlUnit] = useState<'minutes' | 'hours' | 'days'>(websiteSettings.incompleteOrdersFeature?.duplicateControlUnit || 'days');
  const [whatsappMessage, setWhatsappMessage] = useState(websiteSettings.incompleteOrdersFeature?.whatsappMessage || 'Hello, you started an order but didn\'t complete it. Need help to finish your purchase?');
  const [retentionPeriodDays, setRetentionPeriodDays] = useState(websiteSettings.incompleteOrdersFeature?.retentionPeriodDays?.toString() || '7');

  const [dateFilter, setDateFilter] = useState<'1' | '3' | '7' | '15' | '25' | '40' | '60' | '90' | '180' | 'ALL' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState(format(startOfDay(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(endOfDay(new Date()), 'yyyy-MM-dd'));

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleSave = async () => {
    const updatedSettings = {
      ...websiteSettings,
      incompleteOrdersFeature: {
        enabled,
        inactivityTimerMinutes: parseInt(inactivityTimerMinutes) || 5,
        duplicateControlValue: parseInt(duplicateControlValue) || 1,
        duplicateControlUnit,
        whatsappMessage,
        retentionPeriodDays: parseInt(retentionPeriodDays) || 0
      }
    };
    setWebsiteSettings(updatedSettings);
    await cloudStore.saveSetting('websiteSettings', updatedSettings);
  };

  const isOrderAlreadyCompleted = (inc: IncompleteOrder): boolean => {
    const p = normalizePhone(inc.phone);
    if (!p) return false;
    const incTime = inc.updatedAt || inc.timestamp || 0;
    return orders.some(o => {
      const orderPhone = normalizePhone(o.userInfo?.phone);
      if (orderPhone !== p) return false;
      const orderTime = o.clientInfo?.timestamp || (o.date ? new Date(o.date).getTime() : 0);
      // Order completed at or after this incomplete order was created/updated (with 60s grace)
      return orderTime > 0 && orderTime >= (incTime - 60000);
    });
  };

  // Clean up any stale incomplete orders in D1 that were actually completed
  useEffect(() => {
    if (!orders || orders.length === 0 || !incompleteOrders || incompleteOrders.length === 0) return;
    const toClean = incompleteOrders.filter(inc => isOrderAlreadyCompleted(inc));
    if (toClean.length > 0) {
      toClean.forEach(inc => {
        cloudStore.deleteOrder(inc, 'incomplete').catch(() => {});
      });
      if (setIncompleteOrders) {
        setIncompleteOrders(prev => prev.filter(inc => !toClean.some(c => c.id === inc.id)));
      }
    }
  }, [orders, incompleteOrders, setIncompleteOrders]);

  const filteredOrders = useMemo(() => {
    return incompleteOrders.filter(o => {
      const p = normalizePhone(o.phone);
      if (!p) return false;
      // Strictly guarantee that placed orders NEVER appear in incomplete orders
      if (isOrderAlreadyCompleted(o)) return false;

      const orderTime = o.updatedAt || o.timestamp;
      const orderDate = new Date(orderTime);
      
      if (dateFilter === 'ALL') return true;
      if (dateFilter === 'CUSTOM') {
        const start = startOfDay(new Date(customStartDate));
        const end = endOfDay(new Date(customEndDate));
        return isAfter(orderDate, start) && isBefore(orderDate, end);
      }

      const days = parseInt(dateFilter);
      const cutoff = subDays(new Date(), days);
      return isAfter(orderDate, cutoff);
    }).sort((a, b) => (b.updatedAt || b.timestamp) - (a.updatedAt || a.timestamp));
  }, [incompleteOrders, orders, dateFilter, customStartDate, customEndDate]);

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Cancelled
          </span>
        );
      case 'LEFT_PAGE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Left Page
          </span>
        );
      case 'RETURNED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Returned
          </span>
        );
      case 'PHONE_ENTERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            Phone Entered
          </span>
        );
      default:
        return status ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            {status}
          </span>
        ) : null;
    }
  };

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedOrders(newSelection);
  };

  const selectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleContacted = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (setIncompleteOrders) {
      setIncompleteOrders(prev => {
        const updated = prev.map(o => o.id === id ? { ...o, contacted: !o.contacted, contactedAt: !o.contacted ? Date.now() : undefined } : o);
        const changedItem = updated.find(o => o.id === id);
        if (changedItem) cloudStore.upsertOrder(changedItem, 'incomplete').catch(console.error);
        return updated;
      });
    }
  };

  const generateCSVData = (ordersToExport: IncompleteOrder[]) => {
    const headers = ['Phone', 'Name', 'Location', 'Time', 'Status', 'Contacted'];
    const rows = ordersToExport.map(o => [
      formatWhatsAppPhone(o.phone),
      o.name || '',
      o.location || '',
      format(o.updatedAt || o.timestamp, 'yyyy-MM-dd HH:mm:ss'),
      o.status || 'Hot',
      o.contacted ? 'Yes' : 'No'
    ]);
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const handleDownload = async (formatType: 'csv' | 'excel') => {
    const ordersToExport = filteredOrders.filter(o => selectedOrders.size === 0 || selectedOrders.has(o.id));
    if (ordersToExport.length === 0) return;

    if (formatType === 'csv') {
      const csvContent = generateCSVData(ordersToExport);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `incomplete_orders_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const XLSX = await import('xlsx');
      const wsData = ordersToExport.map(o => ({
        Phone: formatWhatsAppPhone(o.phone),
        Name: o.name || '',
        Location: o.location || '',
        Time: format(o.updatedAt || o.timestamp, 'yyyy-MM-dd HH:mm:ss'),
        Status: o.status || 'Hot',
        Contacted: o.contacted ? 'Yes' : 'No'
      }));
      const ws = XLSX.utils.json_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Incomplete Orders");
      XLSX.writeFile(wb, `incomplete_orders_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    }
  };

  const openWhatsApp = (phone: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const cleanPhone = formatWhatsAppPhone(phone);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, '_blank');
  };

  const createOrderFromIncompleteAction = (incomplete: IncompleteOrder) => {
    const subtotal = incomplete.cartItems?.reduce((sum, item) => sum + ((item.variantPrice ?? item.product.price) * item.quantity), 0) || 0;
    
    let nextId = Math.floor(100 + Math.random() * 900).toString();
    if (orders.length > 0) {
      const parsedIds = orders.map(o => parseInt(o.id.replace(/\D/g, ''))).filter(id => !isNaN(id));
      if (parsedIds.length > 0) {
        nextId = (Math.max(...parsedIds) + 1).toString();
      }
    }

    const newOrder: Order = {
      id: nextId,
      date: format(new Date(), 'EEEE, MM/dd/yyyy, hh:mm a'),
      status: 'Pending',
      items: incomplete.cartItems || [],
      userInfo: {
        name: incomplete.name || "Unknown",
        phone: formatWhatsAppPhone(incomplete.phone),
        address: incomplete.location || ""
      },
      deliveryCharge: 0,
      subtotal: subtotal,
      total: subtotal,
      discount: 0
    };
    
    cloudStore.upsertOrder(newOrder, 'standard').catch(console.error);
    cloudStore.deleteOrder(incomplete, 'incomplete').catch(console.error);
    
    if (setOrders) {
      setOrders(prev => [newOrder, ...prev]);
    }
    if (setIncompleteOrders) {
      setIncompleteOrders(prev => prev.filter(o => o.id !== incomplete.id));
    }
    setExpandedOrderId(null);
  };

  const formatDisplayDate = (timestamp: number) => {
    const d = new Date(timestamp);
    if (isToday(d)) {
      return `Today, ${format(d, 'h:mm a')}`;
    }
    if (isYesterday(d)) {
      return `Yesterday, ${format(d, 'h:mm a')}`;
    }
    return format(d, 'MMM d, h:mm a');
  };

  const dayFilterOptions = ['1', '3', '7', '15', '25', '40', '60', '90', '180'] as const;
  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Header */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={showSettings ? () => setShowSettings(false) : onClose} 
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
                  {showSettings ? 'Abandoned Cart Settings' : 'Incomplete Checkout Recovery'}
                </h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  {showSettings ? 'Configure capture timers, data retention, and duplicate merges' : 'Recover high-intent customers who abandoned before final checkout'}
                </p>
              </div>
            </div>
          </div>

          {!showSettings ? (
            <button 
              onClick={() => setShowSettings(true)} 
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs md:text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Settings size={15} /> Settings
            </button>
          ) : (
            <button 
              onClick={() => { handleSave(); setShowSettings(false); }} 
              className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0"
            >
              Save & Apply
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto w-full overscroll-y-contain custom-scrollbar pb-32" style={{ WebkitOverflowScrolling: 'touch' }}>
        {showSettings ? (
          <div className="p-2.5 md:p-8 space-y-4 max-w-3xl mx-auto w-full pb-32">
            {/* Tracking System Card */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Live Abandonment Tracking</h2>
                  <p className="text-xs text-slate-400">Capture phone number & cart items immediately when user types in checkout.</p>
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

            {/* Conditional Settings */}
            {enabled && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Inactivity Timer */}
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Inactivity Trigger Timer</h3>
                  <div className="flex items-center bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] focus-within:border-indigo-500 overflow-hidden transition-colors">
                    <input 
                      type="number" 
                      value={inactivityTimerMinutes} 
                      onChange={e => setInactivityTimerMinutes(e.target.value)} 
                      className="w-full bg-transparent p-3 text-xs md:text-sm text-white focus:outline-none font-bold"
                    />
                    <div className="flex items-center px-4 text-xs text-slate-400 font-semibold border-l border-[var(--dash-border)]">
                      Minutes
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">Wait time after customer stops typing before saving incomplete lead.</p>
                </div>

                {/* Duplicate Control */}
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Duplicate Merging Window</h3>
                  <div className="flex bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] focus-within:border-indigo-500 overflow-hidden transition-colors">
                    <input 
                      type="number" 
                      value={duplicateControlValue} 
                      onChange={e => setDuplicateControlValue(e.target.value)} 
                      className="w-full bg-transparent p-3 text-xs md:text-sm text-white focus:outline-none font-bold"
                    />
                    <select 
                      value={duplicateControlUnit}
                      onChange={e => setDuplicateControlUnit(e.target.value as any)}
                      className="bg-[var(--dash-card)] px-4 text-slate-300 text-xs font-semibold focus:outline-none border-l border-[var(--dash-border)]"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-slate-500">Merge repeated checkout attempts from the same phone number.</p>
                </div>

                {/* WhatsApp Message */}
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Recovery Outreach Template</h3>
                  <textarea 
                    value={whatsappMessage} 
                    onChange={e => setWhatsappMessage(e.target.value)} 
                    rows={3}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 resize-none transition-colors"
                  />
                  <p className="text-[11px] text-slate-500">Default message prefilled when launching WhatsApp recovery.</p>
                </div>

                {/* Data Retention */}
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Storage Retention Period</h3>
                  <select 
                    value={retentionPeriodDays}
                    onChange={e => setRetentionPeriodDays(e.target.value)}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3 text-xs md:text-sm text-white focus:outline-none font-semibold"
                  >
                    <option value="0">Keep Forever (No Auto-Delete)</option>
                    <option value="1">1 Day</option>
                    <option value="7">7 Days (Recommended)</option>
                    <option value="30">30 Days</option>
                    <option value="60">60 Days</option>
                  </select>
                  <p className="text-[11px] text-slate-500">Auto-clean non-converted abandoned checkouts to conserve D1 storage.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2.5 md:p-8 space-y-4 max-w-4xl mx-auto w-full pb-28">
            {/* Filters Section */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-5 shadow-xl space-y-3.5">
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {dayFilterOptions.map(days => (
                  <button 
                    key={days} 
                    onClick={() => setDateFilter(days)}
                    className={cn(
                      "shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                      dateFilter === days 
                        ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/40" 
                        : "bg-[var(--dash-bg)] text-slate-400 border-[var(--dash-border)] hover:border-slate-700"
                    )}
                  >
                    {days} Day{days !== '1' ? 's' : ''}
                  </button>
                ))}
                <button 
                  onClick={() => setDateFilter('ALL')}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    dateFilter === 'ALL' 
                      ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/40" 
                      : "bg-[var(--dash-bg)] text-slate-400 border-[var(--dash-border)] hover:border-slate-700"
                  )}
                >
                  All Time
                </button>
                <button 
                  onClick={() => setDateFilter('CUSTOM')}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    dateFilter === 'CUSTOM' 
                      ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/40" 
                      : "bg-[var(--dash-bg)] text-slate-400 border-[var(--dash-border)] hover:border-slate-700"
                  )}
                >
                  <Calendar size={13} /> Custom
                </button>
              </div>

              {dateFilter === 'CUSTOM' && (
                <div className="flex items-center gap-3 pt-2 border-t border-[var(--dash-border)]/50">
                  <input 
                    type="date" 
                    value={customStartDate} 
                    onChange={e => setCustomStartDate(e.target.value)} 
                    className="bg-[var(--dash-bg)] border border-[var(--dash-border)] text-xs text-white rounded-xl px-3 py-2 focus:outline-none" 
                  />
                  <span className="text-xs text-slate-400 font-semibold">to</span>
                  <input 
                    type="date" 
                    value={customEndDate} 
                    onChange={e => setCustomEndDate(e.target.value)} 
                    className="bg-[var(--dash-bg)] border border-[var(--dash-border)] text-xs text-white rounded-xl px-3 py-2 focus:outline-none" 
                  />
                </div>
              )}

              {/* List Header Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[var(--dash-border)]/50">
                <span className="text-xs font-bold text-slate-300">
                  {filteredOrders.length} Abandoned Checkouts
                </span>

                <div className="flex items-center gap-4">
                  {filteredOrders.length > 0 && selectedOrders.size > 0 && (
                     <div className="flex items-center gap-2">
                       <button onClick={() => handleDownload('csv')} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"><Download size={13} /> CSV</button>
                       <span className="text-slate-700">|</span>
                       <button onClick={() => handleDownload('excel')} className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"><Download size={13} /> Excel</button>
                     </div>
                  )}

                  <button 
                    onClick={selectAll} 
                    className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer"
                  >
                    <div 
                      className={cn(
                        "w-4.5 h-4.5 rounded-lg border flex items-center justify-center transition-colors",
                        filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length 
                          ? "bg-indigo-600 border-indigo-600 text-white" 
                          : "border-slate-600 text-transparent"
                      )}
                    >
                      <Check size={12} className={filteredOrders.length > 0 && selectedOrders.size === filteredOrders.length ? "opacity-100" : "opacity-0"} />
                    </div>
                    <span>Select All</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Data List */}
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-[var(--dash-card)] rounded-2xl border border-[var(--dash-border)]">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-3">
                  <ShoppingCart size={22} />
                </div>
                <p className="text-white font-bold text-sm">No incomplete orders recorded</p>
                <p className="text-xs text-slate-500 mt-1">Try broadening your date filter range</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredOrders.map(order => {
                  const isSelected = selectedOrders.has(order.id);

                  return (
                    <div 
                      key={order.id} 
                      className={cn(
                        "bg-[var(--dash-card)] border p-4 md:p-5 rounded-2xl shadow-xl transition-all flex flex-col justify-between gap-3",
                        order.contacted ? "border-slate-700/60 opacity-80" : "border-[var(--dash-border)]/70 hover:border-slate-700",
                        isSelected && "ring-1 ring-indigo-500/50 border-indigo-500/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <button 
                            className={cn(
                              "w-5 h-5 rounded-lg border flex-shrink-0 flex items-center justify-center transition-colors cursor-pointer mt-0.5",
                              isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-600 text-transparent"
                            )}
                            onClick={(e) => toggleSelection(order.id, e)}
                          >
                            <Check size={12} className={isSelected ? "opacity-100" : "opacity-0"} />
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-bold text-white truncate">{order.name || 'Anonymous Customer'}</span>
                              {renderStatusBadge(order.status)}
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-slate-300 font-mono font-medium">{formatWhatsAppPhone(order.phone)}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(formatWhatsAppPhone(order.phone)); }} 
                                className="text-slate-400 hover:text-white"
                                title="Copy Phone"
                              >
                                <Copy size={11} />
                              </button>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                              <span>{formatDisplayDate(order.updatedAt || order.timestamp)}</span>
                              {order.contacted && (
                                <span className="text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/20">
                                  <Check size={10} /> Contacted
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={(e) => { e.stopPropagation(); setExpandedOrderId(order.id); }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95 cursor-pointer shrink-0"
                        >
                          Details
                        </button>
                      </div>

                      {/* Cart Preview & Recovery Actions */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-[var(--dash-border)]/50 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex -space-x-2 overflow-hidden shrink-0">
                            {order.cartItems?.slice(0, 3).map((item, idx) => (
                              <img 
                                key={idx} 
                                src={item.product?.thumbnail || item.product?.image} 
                                alt={item.product?.title || ''} 
                                className="inline-block h-6 w-6 rounded-md ring-2 ring-[var(--dash-card)] object-cover bg-white/5" 
                              />
                            ))}
                          </div>
                          <span className="text-xs font-semibold text-slate-400 truncate">
                            {order.cartItems?.length || 0} item(s) • {formatPrice(order.cartItems?.reduce((sum, item) => sum + ((item.variantPrice ?? item.product?.price ?? 0) * item.quantity), 0) || 0)}
                          </span>
                        </div>

                        {/* 1-Click WhatsApp & Call Recovery Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a 
                            href={`tel:${order.phone}`} 
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
                            title="Direct Phone Call"
                          >
                            <Phone size={14} />
                          </a>
                          <button 
                            onClick={(e) => openWhatsApp(order.phone, e)}
                            className="w-8 h-8 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
                            title="Contact on WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {expandedOrderId && (
        <DetailOverlay 
          orderId={expandedOrderId} 
          orders={incompleteOrders} 
          onClose={() => setExpandedOrderId(null)}
          toggleContacted={toggleContacted}
          openWhatsApp={openWhatsApp}
          createOrderAction={createOrderFromIncompleteAction}
          renderStatusBadge={renderStatusBadge}
        />
      )}
    </div>
  );
}

interface DetailOverlayProps {
  orderId: string;
  orders: IncompleteOrder[];
  onClose: () => void;
  toggleContacted: (id: string, e?: React.MouseEvent) => void;
  openWhatsApp: (phone: string, e?: React.MouseEvent) => void;
  createOrderAction: (order: IncompleteOrder) => void;
  renderStatusBadge: (status?: string) => React.ReactNode;
}

function DetailOverlay({ orderId, orders, onClose, toggleContacted, openWhatsApp, createOrderAction, renderStatusBadge }: DetailOverlayProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const order = orders.find(o => o.id === orderId);
  if (!order) return null;

  const totalQty = order.cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalPrice = order.cartItems?.reduce((sum, item) => sum + ((item.variantPrice ?? item.product.price) * item.quantity), 0) || 0;

  return (
    <div className="fixed inset-0 z-[110] bg-[var(--dash-bg)]/90 backdrop-blur-md flex justify-end">
      <div className="bg-[var(--dash-card)] w-full max-w-lg h-full overflow-y-auto border-l border-[var(--dash-border)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-[var(--dash-border)] flex items-center justify-between sticky top-0 bg-[var(--dash-card)]/90 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-bold text-white">Lead Details</h2>
                {renderStatusBadge(order.status)}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">{format(order.updatedAt || order.timestamp, 'dd MMM yyyy, hh:mm a')}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-4 md:p-6 space-y-5 flex-1">
          {/* Customer Info Card */}
          <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-lg font-bold shrink-0">
                {order.name ? order.name.substring(0, 2).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white truncate">{order.name || 'Anonymous Customer'}</h3>
                  {renderStatusBadge(order.status)}
                </div>
                <div className="space-y-1.5 mt-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-slate-500" />
                    <span className="font-mono text-white font-medium">{formatWhatsAppPhone(order.phone)}</span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(formatWhatsAppPhone(order.phone))} 
                      className="text-indigo-400 hover:text-indigo-300 ml-1"
                      title="Copy Phone"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  {order.location && (
                    <div className="flex items-center gap-2">
                      <MapPin size={12} className="text-slate-500" />
                      <span className="truncate">{order.location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 1-Click Recovery Actions (WhatsApp & Direct Call) */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[var(--dash-border)]/50">
              <a 
                href={`tel:${order.phone}`}
                className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white transition-all cursor-pointer shadow-sm"
              >
                <Phone size={14} /> Call Customer
              </a>
              <button 
                onClick={(e) => openWhatsApp(order.phone, e)}
                className="py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                <MessageCircle size={14} /> WhatsApp
              </button>
            </div>

            {/* Workflow Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button 
                onClick={(e) => toggleContacted(order.id, e)}
                className={cn(
                  "py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer",
                  order.contacted 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
                    : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                )}
              >
                <Check size={14} /> {order.contacted ? 'Contacted' : 'Mark Contacted'}
              </button>
              <button 
                onClick={() => createOrderAction(order)}
                className="py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md shadow-indigo-500/25 active:scale-95 cursor-pointer"
              >
                Convert to Order
              </button>
            </div>
          </div>

          {/* Cart Items Card */}
          <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Cart Items ({order.cartItems?.length || 0})
              </h4>
              <span className="text-xs font-bold text-indigo-400">Total: {formatPrice(totalPrice)}</span>
            </div>

            <div className="divide-y divide-[var(--dash-border)]/50">
              {order.cartItems?.map((item, idx) => (
                <div key={idx} className="flex gap-3.5 py-3 first:pt-0 last:pb-0">
                  <div 
                    className="w-14 h-14 rounded-xl bg-white/5 overflow-hidden shrink-0 border border-white/10 cursor-pointer"
                    onClick={() => setSelectedImage(item.product.thumbnail || item.product.image)}
                  >
                    <img src={item.product.thumbnail || item.product.image} alt={item.product.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{item.product.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.variantName || 'Default Variant'}</p>
                    <p className="text-xs text-slate-300 font-semibold mt-1">
                      {formatPrice(item.variantPrice ?? item.product.price)} × {item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-4 right-4 p-2.5 text-white/70 hover:text-white bg-white/10 rounded-full transition-colors"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <X size={20} />
          </button>
          <img 
            src={selectedImage} 
            alt="Preview" 
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}


