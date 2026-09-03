import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Search, User, UserX, ShieldAlert, Check, X, Phone, ShoppingCart, Activity, MessageCircle, Calendar, IndianRupee, Clock } from 'lucide-react';
import { Order, WebsiteSettings } from './types';
import { cn, normalizePhone, formatPrice, formatWhatsAppPhone, formatShortTimeAgo, useScrollRestore } from './lib/utils';
import { DatePicker } from './components/DatePicker';

interface CustomersManagerProps {
  orders: Order[];
  setOrders?: any;
  customers?: any[];
  setCustomers?: any;
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  onClose: () => void;
  isOwner?: boolean;
}

interface CustomerStats {
  phone: string;
  name: string;
  totalOrders: number;
  cancelledOrders: number;
  successRate: number;
  completedOrders: number;
  totalSpent: number;
  isBlocked: boolean;
  statusText: string;
  rank?: number;
  lastOrderTime: number;
}

type DateFilterType = 'All Time' | 'Today' | 'Last 7 Days' | 'Last 30 Days' | 'Custom';
type SortByType = 'orders' | 'low_orders' | 'spent';

export default function CustomersManager({ orders, setOrders, customers = [], setCustomers, websiteSettings, setWebsiteSettings, onClose, isOwner = false }: CustomersManagerProps) {
  const [activeTab, setActiveTab] = useState<'Analytics' | 'Blocked' | 'Settings'>('Analytics');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterType>('All Time');
  const [customFromDate, setCustomFromDate] = useState<Date | null>(null);
  const [customToDate, setCustomToDate] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<SortByType>('spent');

  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const scrollRef = useScrollRestore(`customers-${activeTab}`);

  const handleDeleteCustomers = async () => {
    if (!isOwner || selectedPhones.length === 0) return;
    setIsDeleting(true);
    try {
      // 1. Delete from customers table
      const customersToDelete = customers.filter(c => selectedPhones.includes(normalizePhone(c.phone)));
      if (customersToDelete.length > 0) {
        await fetch('/api/customers', { 
           method: 'POST', 
           headers: { 'Content-Type': 'application/json' }, 
           body: JSON.stringify({ action: 'delete', items: customersToDelete }) 
        });
      }
      
      // 2. Delete all standard orders of these customers
      const ordersToDelete = orders.filter(o => selectedPhones.includes(normalizePhone(o.userInfo.phone)));
      if (ordersToDelete.length > 0) {
        await fetch('/api/orders', { 
           method: 'POST', 
           headers: { 'Content-Type': 'application/json' }, 
           body: JSON.stringify({ action: 'delete', items: ordersToDelete, type: 'standard' }) 
        });
      }

      // 3. Update local state
      if (setCustomers) {
         setCustomers(customers.filter(c => !selectedPhones.includes(normalizePhone(c.phone))));
      }
      if (setOrders) {
         setOrders(orders.filter(o => !selectedPhones.includes(normalizePhone(o.userInfo.phone))));
      }

      setSelectedPhones([]);
      setShowDeleteConfirm(false);
    } catch (e) {
      console.error(e);
      alert('Failed to delete customers permanently.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedPhones.length === sortedCustomers.length) {
      setSelectedPhones([]);
    } else {
      setSelectedPhones(sortedCustomers.map(c => normalizePhone(c.phone)));
    }
  };

  const toggleSelection = (phone: string) => {
    const normPhone = normalizePhone(phone);
    if (selectedPhones.includes(normPhone)) {
      setSelectedPhones(selectedPhones.filter(p => p !== normPhone));
    } else {
      setSelectedPhones([...selectedPhones, normPhone]);
    }
  };

  const customerSettings = websiteSettings.customers || { systemEnabled: true, autoBlockEnabled: false, maxCancelLimit: 3, blockedPhones: [], whatsappMessage: 'Hello {name}, thank you for ordering from our store.' };
  const blockedPhones = customerSettings.blockedPhones || [];
  const systemEnabled = customerSettings.systemEnabled ?? true;

  // Filter Orders by Date
  const filteredOrders = useMemo(() => {
    if (dateFilter === 'All Time') return orders;
    
    const now = Date.now();
    const today = new Date(now).setHours(0, 0, 0, 0);
    
    return orders.filter(order => {
      const orderDate = new Date(order.date).getTime();
      
      switch (dateFilter) {
        case 'Today':
          return orderDate >= today;
        case 'Last 7 Days':
          return orderDate >= now - (7 * 24 * 60 * 60 * 1000);
        case 'Last 30 Days':
          return orderDate >= now - (30 * 24 * 60 * 60 * 1000);
        case 'Custom':
          if (customFromDate && customToDate) {
            // Set fromDate to start of day and toDate to end of day
            const startOfDay = new Date(customFromDate).setHours(0, 0, 0, 0);
            const endOfDay = new Date(customToDate).setHours(23, 59, 59, 999);
            return orderDate >= startOfDay && orderDate <= endOfDay;
          }
          return true;
        default:
          return true;
      }
    });
  }, [orders, dateFilter, customFromDate, customToDate]);

  // Computed Stats
  const rawCustomers = useMemo(() => {
    // Determine absolute last order time globally for every customer
    const globalLastOrderTimes = new Map<string, number>();
    orders.forEach(order => {
      const normPhone = normalizePhone(order.userInfo.phone);
      if (!normPhone) return;
      const t = new Date(order.date).getTime();
      const currentLabel = globalLastOrderTimes.get(normPhone) || 0;
      if (t > currentLabel) {
        globalLastOrderTimes.set(normPhone, t);
      }
    });

    const map = new Map<string, { displayPhone: string, name: string, total: number, cancelled: number, completed: number, spent: number, lastOrderTime: number }>();
    
    // 1. Initialize map from permanent customers database
    customers.forEach(cust => {
      const normPhone = normalizePhone(cust.phone);
      if (!normPhone) return;
      map.set(normPhone, {
         displayPhone: cust.phone,
         name: cust.name,
         total: 0,
         cancelled: 0,
         completed: 0,
         spent: 0,
         lastOrderTime: cust.lastSeenAt || 0
      });
    });

    // 2. Overlay dynamic filter stats
    filteredOrders.forEach(order => {
      const normPhone = normalizePhone(order.userInfo.phone);
      if (!normPhone) return;

      if (!map.has(normPhone)) {
        map.set(normPhone, { displayPhone: order.userInfo.phone, name: order.userInfo.name, total: 0, cancelled: 0, completed: 0, spent: 0, lastOrderTime: globalLastOrderTimes.get(normPhone) || 0 });
      }
      const data = map.get(normPhone)!;
      data.total += 1;

      if (order.status === 'Canceled' || order.status === 'Returned' || order.status === 'Complete Return') {
        data.cancelled += 1;
      }
      if (order.status === 'Completed') {
        data.completed += 1;
        data.spent += order.total;
      }
      // If the order has a more recent name, maybe keep it but prefer DB if we want
      if (order.date && new Date(order.date).getTime() >= data.lastOrderTime) {
         data.name = order.userInfo.name;
         data.lastOrderTime = new Date(order.date).getTime();
      }
    });
    
    return Array.from(map.entries()).map(([normPhone, data]) => {
      const isBlocked = blockedPhones.some(p => normalizePhone(p) === normPhone);
      // Success rate based on resolved orders (completed + cancelled).
      const resolved = data.completed + data.cancelled;
      const successRate = resolved > 0 ? Math.round((data.completed / resolved) * 100) : (data.completed > 0 ? 100 : 0);
      
      return {
        phone: data.displayPhone,
        name: data.name,
        totalOrders: data.total,
        cancelledOrders: data.cancelled,
        completedOrders: data.completed,
        totalSpent: data.spent,
        successRate,
        isBlocked,
        statusText: isBlocked ? 'Blocked' : 'Active',
        lastOrderTime: data.lastOrderTime
      } as CustomerStats;
    });
  }, [orders, filteredOrders, blockedPhones, customers]);

  const sortedCustomers = useMemo(() => {
    let sorted = [...rawCustomers];
    
    // Sort logic
    if (sortBy === 'spent') {
      sorted.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sortBy === 'low_orders') {
      sorted.sort((a, b) => {
        if (a.totalOrders !== b.totalOrders) {
          return a.totalOrders - b.totalOrders;
        }
        // If tied, sort by latest order time (descending) so more recent is prioritized slightly, or maybe least spent?
        // Usually, secondary by lowest spent or something. Let's just do by totalSpent ascending.
        return a.totalSpent - b.totalSpent;
      });
    } else {
      sorted.sort((a, b) => b.totalOrders - a.totalOrders);
    }

    // Assign ranks
    sorted.forEach((c, index) => {
      c.rank = index + 1;
    });

    if (searchQuery) {
      const query = searchQuery.toLowerCase().replace(/#/g, '');
      sorted = sorted.filter(c => 
        normalizePhone(c.phone).includes(query) || 
        c.phone.includes(query) ||
        c.name.toLowerCase().includes(query) ||
        // Order ID search checking
        orders.some(o => normalizePhone(o.userInfo.phone) === normalizePhone(c.phone) && o.id.toLowerCase().replace(/#/g, '').includes(query))
      );
    }
    return sorted;
  }, [rawCustomers, searchQuery, orders, sortBy]);

  const handleBlockToggle = (phone: string, isBlocked: boolean) => {
    const normPhone = normalizePhone(phone);
    const updatedBlocked = isBlocked 
      ? blockedPhones.filter(p => normalizePhone(p) !== normPhone)
      : [...blockedPhones, normPhone];
    
    setWebsiteSettings(prev => ({
      ...prev,
      customers: {
        ...customerSettings,
        blockedPhones: updatedBlocked
      }
    }));
  };

  const handleSettingsUpdate = (updates: Partial<typeof customerSettings>) => {
    setWebsiteSettings(prev => ({
      ...prev,
      customers: {
        ...customerSettings,
        ...updates
      }
    }));
  };

  const handleWhatsApp = (customer: CustomerStats) => {
    const phoneNum = formatWhatsAppPhone(customer.phone);
    
    let msgTemplate = customerSettings.whatsappMessage || 'Hello {name}, thank you for ordering from our store.';
    msgTemplate = msgTemplate
      .replace(/{name}/g, customer.name)
      .replace(/{phone}/g, customer.phone)
      .replace(/{total_orders}/g, customer.totalOrders.toString())
      .replace(/{total_spent}/g, formatPrice(customer.totalSpent));
      
    const text = encodeURIComponent(msgTemplate);
    const url = `https://wa.me/${phoneNum}?text=${text}`;
    window.open(url, '_blank');
  };

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
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <User size={20} />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Customer Intelligence & Blacklist
              </h1>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Purchase history, cancellation rates, blacklist control, and automated spam filtering
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
          >
            Done
          </button>
        </div>
      </div>

      {/* Sub-header Tab Bar */}
      <div className="px-4 py-2.5 bg-[var(--dash-bg)]/95 backdrop-blur-md border-b border-[var(--dash-border)]/60 flex items-center shrink-0 z-10">
        <div className="flex items-center bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-1 gap-1 w-full max-w-md mx-auto">
          {(['Analytics', 'Blocked', 'Settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer",
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5 max-w-5xl mx-auto w-full pb-36 overscroll-y-contain custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
        {activeTab === 'Analytics' && (
          <div className="flex flex-col gap-4">
            
            {/* Filter and Sort Controls */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-5 shadow-xl flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {(['All Time', 'Today', 'Last 7 Days', 'Last 30 Days', 'Custom'] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => setDateFilter(filter)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer",
                        dateFilter === filter 
                          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/40" 
                          : "bg-[var(--dash-bg)] text-slate-400 border-[var(--dash-border)] hover:border-slate-600"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-1">
                  <span className="text-[11px] text-slate-500 font-bold uppercase px-2">Sort:</span>
                  <button
                    onClick={() => setSortBy('spent')}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                      sortBy === 'spent' ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    Most Spent
                  </button>
                  <button
                    onClick={() => setSortBy('orders')}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                      sortBy === 'orders' ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    Most Orders
                  </button>
                  <button
                    onClick={() => setSortBy('low_orders')}
                    className={cn(
                      "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer",
                      sortBy === 'low_orders' ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    Low Orders
                  </button>
                </div>
              </div>
              
              {dateFilter === 'Custom' && (
                <div className="flex items-center gap-3 pt-2 border-t border-[var(--dash-border)]/50">
                  <div className="flex-1">
                    <DatePicker 
                      label="From" 
                      value={customFromDate} 
                      onChange={setCustomFromDate} 
                      align="left"
                    />
                  </div>
                  <div className="flex-1">
                    <DatePicker 
                      label="To" 
                      value={customToDate} 
                      onChange={setCustomToDate} 
                      align="right"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Search Bar */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search by customer phone, name, or order ID..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-11 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl px-4 pl-10 text-xs md:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-lg"
              />
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Bulk Selection Bar */}
            <div className="flex items-center justify-between px-1">
              <button onClick={handleSelectAll} className="text-xs font-bold text-slate-300 flex items-center gap-2 hover:text-white transition-colors cursor-pointer">
                <div className={cn(
                  "w-4.5 h-4.5 rounded-lg flex items-center justify-center border transition-colors",
                  selectedPhones.length === sortedCustomers.length && sortedCustomers.length > 0 
                    ? "bg-indigo-600 border-indigo-600 text-white" 
                    : "border-slate-600 text-transparent"
                )}>
                  <Check size={12} className={selectedPhones.length === sortedCustomers.length && sortedCustomers.length > 0 ? "opacity-100" : "opacity-0"} />
                </div>
                {selectedPhones.length > 0 ? `${selectedPhones.length} Customers Selected` : 'Select All Customers'}
              </button>
              
              {selectedPhones.length > 0 && (
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedPhones([])} className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer">
                    Clear Selection
                  </button>
                  {isOwner && (
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg font-bold transition-colors cursor-pointer"
                    >
                      Delete Selected
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Customers Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {sortedCustomers.map(customer => {
                const normPhone = normalizePhone(customer.phone);
                const isSelected = selectedPhones.includes(normPhone);
                
                return (
                <div key={customer.phone} className={cn(
                  "bg-[var(--dash-card)] border rounded-2xl p-4 md:p-5 flex flex-col justify-between gap-4 relative overflow-hidden transition-all shadow-xl",
                  isSelected ? "border-indigo-500 ring-1 ring-indigo-500/40" : "border-[var(--dash-border)]/70 hover:border-slate-700"
                )}>
                  <div className="absolute -top-4 -right-4 text-[72px] font-black text-white/[0.03] pointer-events-none select-none">
                    #{customer.rank}
                  </div>
                  
                  <div className="flex justify-between items-start z-10 relative">
                    <div className="flex gap-3">
                      <div className="mt-0.5">
                        <button 
                          onClick={() => toggleSelection(customer.phone)}
                          className={cn(
                            "w-5 h-5 rounded-lg flex items-center justify-center border transition-colors cursor-pointer",
                            isSelected 
                              ? "bg-indigo-600 border-indigo-600 text-white" 
                              : "border-slate-600 text-transparent"
                          )}
                        >
                          <Check size={12} className={isSelected ? "opacity-100" : "opacity-0"} />
                        </button>
                      </div>
                      <div>
                        <div className="font-bold text-white flex items-center gap-2 text-sm md:text-base cursor-pointer" onClick={() => toggleSelection(customer.phone)}>
                          <span className="text-indigo-400 text-xs">#{customer.rank}</span> {customer.name || 'Anonymous Customer'}
                          {customer.isBlocked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold">Blocked</span>}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1 cursor-pointer" onClick={() => toggleSelection(customer.phone)}>
                          <Phone size={11} className="text-slate-500" /> {formatWhatsAppPhone(customer.phone)}
                          <span className="text-slate-600">•</span>
                          <Clock size={11} className="text-slate-500" /> {formatShortTimeAgo(customer.lastOrderTime)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button 
                         onClick={() => handleWhatsApp(customer)}
                         className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center transition-colors cursor-pointer"
                         title="Send WhatsApp Message"
                      >
                         <MessageCircle size={15} />
                      </button>
                      <button 
                        onClick={() => handleBlockToggle(customer.phone, customer.isBlocked)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-xl font-bold border transition-colors cursor-pointer",
                          customer.isBlocked 
                            ? "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10" 
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                        )}
                      >
                        {customer.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-2 z-10 relative pt-1">
                    <div className="bg-[var(--dash-bg)] p-2.5 rounded-xl flex flex-col items-center border border-[var(--dash-border)]/60">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">Spent</div>
                      <div className="font-bold text-white text-xs md:text-sm">
                        {formatPrice(customer.totalSpent)}
                      </div>
                    </div>
                    <div className="bg-[var(--dash-bg)] p-2.5 rounded-xl flex flex-col items-center border border-[var(--dash-border)]/60">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">Orders</div>
                      <div className="font-bold text-indigo-400 text-xs md:text-sm flex items-center gap-1">
                        {customer.totalOrders}
                      </div>
                    </div>
                    <div className="bg-[var(--dash-bg)] p-2.5 rounded-xl flex flex-col items-center border border-[var(--dash-border)]/60">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">Canceled</div>
                      <div className="font-bold text-rose-400 text-xs md:text-sm">
                        {customer.cancelledOrders}
                      </div>
                    </div>
                    <div className="bg-[var(--dash-bg)] p-2.5 rounded-xl flex flex-col items-center border border-[var(--dash-border)]/60">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">Success</div>
                      <div className="font-bold text-emerald-400 text-xs md:text-sm">
                        {customer.successRate}%
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
              {sortedCustomers.length === 0 && (
                <div className="col-span-2 text-center text-slate-500 py-12 bg-[var(--dash-card)] rounded-2xl border border-[var(--dash-border)]">
                  No customers found matching your filter criteria.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Blocked' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {sortedCustomers.filter(c => c.isBlocked).map(customer => (
                <div key={customer.phone} className="bg-[var(--dash-card)] border border-rose-500/30 rounded-2xl p-4 md:p-5 flex flex-col justify-between gap-4 relative overflow-hidden shadow-xl">
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <div className="font-bold text-rose-400 flex items-center gap-2 text-base">
                        {customer.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-1">
                        <Phone size={11} className="text-slate-500" /> {formatWhatsAppPhone(customer.phone)}
                        <span className="text-slate-600">•</span>
                        <Clock size={11} className="text-slate-500" /> {formatShortTimeAgo(customer.lastOrderTime)}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleBlockToggle(customer.phone, true)}
                      className="text-xs px-3 py-1.5 bg-white/5 text-slate-200 rounded-xl border border-white/10 hover:bg-white/10 font-bold transition-colors cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 relative z-10">
                    <div className="bg-[var(--dash-bg)] p-3 rounded-xl flex flex-col items-center border border-[var(--dash-border)]">
                      <div className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Total Cancelled</div>
                      <div className="font-bold text-rose-400 text-base">
                        {customer.cancelledOrders}
                      </div>
                    </div>
                    <div className="bg-[var(--dash-bg)] p-3 rounded-xl flex flex-col items-center border border-[var(--dash-border)]">
                      <div className="text-[10px] text-slate-500 font-bold uppercase mb-0.5">Success Rate</div>
                      <div className="font-bold text-slate-300 text-base">
                        {customer.successRate}%
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {sortedCustomers.filter(c => c.isBlocked).length === 0 && (
              <div className="text-center text-slate-500 py-12 bg-[var(--dash-card)] rounded-2xl border border-[var(--dash-border)]">
                No customers are currently blacklisted.
              </div>
            )}
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm md:text-base">Customer Intelligence System</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Master toggle for customer database tracking and silent blocking.</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleSettingsUpdate({ systemEnabled: !systemEnabled })}
                  className={cn(
                    "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                    systemEnabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
                  )}
                >
                  <div
                    className={cn(
                      "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                      systemEnabled ? "translate-x-5.5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>

            <div className={cn("space-y-4 transition-all duration-300", !systemEnabled && "opacity-40 pointer-events-none")}>
              <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--dash-border)]/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                      <ShieldAlert size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm md:text-base">Auto-Block High-Cancellation Numbers</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Automatically silences users after exceeding cancel threshold.</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleSettingsUpdate({ autoBlockEnabled: !customerSettings.autoBlockEnabled })}
                    className={cn(
                      "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                      customerSettings.autoBlockEnabled ? "bg-rose-500 shadow-md shadow-rose-500/20" : "bg-slate-700/60"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                        customerSettings.autoBlockEnabled ? "translate-x-5.5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                {customerSettings.autoBlockEnabled && (
                  <div className="flex items-center justify-between bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3 px-4">
                    <span className="text-xs text-slate-300 font-semibold">Max Cancellations Allowed:</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleSettingsUpdate({ maxCancelLimit: Math.max(1, customerSettings.maxCancelLimit - 1) })}
                        className="w-8 h-8 flex items-center justify-center text-white bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                      >-</button>
                      <span className="font-bold text-white text-sm w-6 text-center">
                        {customerSettings.maxCancelLimit}
                      </span>
                      <button 
                        onClick={() => handleSettingsUpdate({ maxCancelLimit: customerSettings.maxCancelLimit + 1 })}
                        className="w-8 h-8 flex items-center justify-center text-white bg-white/5 hover:bg-white/10 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                      >+</button>
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp Message Template */}
              <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-[var(--dash-border)]/50">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <MessageCircle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm md:text-base">WhatsApp Outreach Template</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Automated message template when clicking WhatsApp icon on customer card</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <textarea 
                    value={customerSettings.whatsappMessage || ''}
                    onChange={(e) => handleSettingsUpdate({ whatsappMessage: e.target.value })}
                    placeholder="Hello {name}, thank you for ordering from our store."
                    rows={3}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                  <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)]/60 rounded-xl p-3 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-400 block uppercase">Dynamic Tags:</span>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-300 font-mono">
                      <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg select-all">{"{name}"}</span>
                      <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg select-all">{"{phone}"}</span>
                      <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg select-all">{"{total_orders}"}</span>
                      <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-lg select-all">{"{total_spent}"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[110]"
              onClick={() => setShowDeleteConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-[400px] bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl shadow-2xl z-[120] p-6 lg:left-[calc(50%+120px)]"
            >
              <h2 className="text-lg font-bold text-white mb-2">Delete Customer Records?</h2>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                This action is permanent and irreversible. All selected customer history and their associated orders will be purged.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-white/5 text-slate-300 font-semibold text-xs rounded-xl border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCustomers}
                  disabled={isDeleting}
                  className="flex-1 py-2.5 bg-rose-500 text-white font-bold text-xs rounded-xl hover:bg-rose-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 cursor-pointer"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
