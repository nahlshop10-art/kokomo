import React, { useState, useEffect } from 'react';
import { ChevronLeft, Download, Trash2, User, Phone, MapPin, Calendar, ChevronDown, ExternalLink, Plus, Search, Check, Package, MessageSquareText, X, Edit3, ShoppingBag, Clock, PlusCircle, Truck, RefreshCw } from 'lucide-react';
import { Order, OrderStatus, CourierSettings, Product, WebsiteSettings } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatPrice, formatWhatsAppPhone } from './lib/utils';
import { isOrderStockActive } from './lib/stockUtils';
import { CopyButton } from './components/CopyButton';

interface OrderDetailsModalProps {
  order: Order;
  orders: Order[];
  products: Product[];
  perms?: Record<string, boolean>;
  courierSettings?: CourierSettings;
  websiteSettings?: WebsiteSettings;
  onClose: () => void;
  onUpdate: (order: Order) => void;
  onDelete: (orderId: string) => void;
  onRetryBdCourier?: () => void;
  isSyncingBdCourier?: boolean;
}

export default function OrderDetailsModal({ order, orders, products, perms, courierSettings, websiteSettings, onClose, onUpdate, onDelete, onRetryBdCourier, isSyncingBdCourier }: OrderDetailsModalProps) {
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [items, setItems] = useState(order.items);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [discount, setDiscount] = useState(order.discount || 0);
  const [shipping, setShipping] = useState(order.deliveryCharge || 0);
  const [extraCosts, setExtraCosts] = useState(order.extraCosts || 0);
  const [returnCost, setReturnCost] = useState(order.returnCost || 0);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSteadfastConfirm, setShowSteadfastConfirm] = useState(false);
  const [steadfastNote, setSteadfastNote] = useState('');
  const [isSubmittingSteadfast, setIsSubmittingSteadfast] = useState(false);
  const [steadfastError, setSteadfastError] = useState<string | null>(null);
  const [returnStockChecked, setReturnStockChecked] = useState(order.stockReturned || (order.status === 'Complete Return'));
  const [showAddProducts, setShowAddProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedNewProducts, setSelectedNewProducts] = useState<{product: Product, quantity: number, variantId?: string, variantName?: string, variantPrice?: number, variantBuyPrice?: number}[]>([]);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Read from local state if read or from order.isNoteRead.
  // Actually we can just keep a track of read notes in localStorage for simplicity over full DB migration if we want.
  const [isNoteRead, setIsNoteRead] = useState(() => {
    if (order.isNoteRead) return true;
    const readNotes = JSON.parse(localStorage.getItem('read_notes') || '{}');
    return !!readNotes[order.id];
  });

  useEffect(() => {
    if (order.isNoteRead === false) {
      setIsNoteRead(false);
      const readNotes = JSON.parse(localStorage.getItem('read_notes') || '{}');
      if (readNotes[order.id]) {
        delete readNotes[order.id];
        localStorage.setItem('read_notes', JSON.stringify(readNotes));
      }
    }
  }, [order.isNoteRead, order.id]);

  const handleOpenMessage = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setShowMessageModal(true);
    if (!isNoteRead) {
      setIsNoteRead(true);
      const readNotes = JSON.parse(localStorage.getItem('read_notes') || '{}');
      readNotes[order.id] = true;
      localStorage.setItem('read_notes', JSON.stringify(readNotes));
      // update order as well if we want
      onUpdate({ ...order, isNoteRead: true });
    }
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category?.trim()?.toLowerCase() === selectedCategory.trim().toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const handleAddSelectedProducts = () => {
    const newItems = [...items];
    selectedNewProducts.forEach(newP => {
      const existingItemIndex = newItems.findIndex(i => i.product.id === newP.product.id && i.variantId === newP.variantId);
      if (existingItemIndex >= 0) {
        newItems[existingItemIndex].quantity += newP.quantity;
      } else {
        newItems.push({
          id: `${newP.product.id}-${Date.now()}`,
          product: newP.product,
          quantity: newP.quantity,
          variantId: newP.variantId,
          variantName: newP.variantName,
          variantPrice: newP.variantPrice,
          variantBuyPrice: newP.variantBuyPrice
        });
      }
    });
    setItems(newItems);
    setShowAddProducts(false);
    setSelectedNewProducts([]);
  };

  const productTotal = items.reduce((acc, item) => acc + ((item.variantPrice ?? item.product.price) * item.quantity), 0);
  const total = productTotal - discount + shipping;
  
  // Calculate profit
  const totalBuyPrice = items.reduce((acc, item) => acc + ((item.variantBuyPrice ?? (item.product.buyPrice ?? Math.floor((item.variantPrice ?? item.product.price) * 0.4))) * item.quantity), 0);
  const profit = productTotal - discount - totalBuyPrice - extraCosts - (Number(returnCost) || 0);

  const hasChanges = 
    status !== order.status ||
    discount !== (order.discount || 0) ||
    shipping !== (order.deliveryCharge || 0) ||
    extraCosts !== (order.extraCosts || 0) ||
    returnCost !== (order.returnCost || 0) ||
    JSON.stringify(items) !== JSON.stringify(order.items) ||
    returnStockChecked !== (order.stockReturned || (order.status === 'Complete Return'));

  const handleUpdate = () => {
    let finalStatus = status;
    if (status === 'Returned' && returnStockChecked) {
      finalStatus = 'Complete Return';
    } else if (status === 'Complete Return' && !returnStockChecked) {
      finalStatus = 'Returned'; // Just in case, though it shouldn't really un-return stock automatically
    }

    onUpdate({
      ...order,
      items,
      status: finalStatus,
      discount,
      deliveryCharge: shipping,
      extraCosts,
      returnCost: Number(returnCost) || 0,
      total,
      profit,
      subtotal: productTotal,
      stockReturned: returnStockChecked
    });
    onClose();
  };

  const handleSteadfastSubmit = async () => {
    if (!courierSettings?.steadfast?.apiKey || !courierSettings?.steadfast?.secretKey) {
      setSteadfastError('API keys not configured in settings.');
      return;
    }

    setIsSubmittingSteadfast(true);
    setSteadfastError(null);

    try {
      let cleanPhone = order.userInfo.phone;
      if (cleanPhone) {
        cleanPhone = cleanPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('88') && cleanPhone.length > 11) {
          cleanPhone = cleanPhone.substring(2);
        }
        if (!cleanPhone.startsWith('0') && cleanPhone.length === 10) {
          cleanPhone = '0' + cleanPhone;
        }
      }

      const response = await fetch('https://portal.packzy.com/api/v1/create_order', {
        method: 'POST',
        headers: {
          'Api-Key': courierSettings.steadfast.apiKey,
          'Secret-Key': courierSettings.steadfast.secretKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoice: order.id,
          recipient_name: order.userInfo.name,
          recipient_phone: cleanPhone || order.userInfo.phone,
          recipient_address: order.userInfo.address,
          cod_amount: total,
          note: steadfastNote.substring(0, 200)
        })
      });

      const data = await response.json();

      if (data.status === 200) {
        setStatus('Preparing');
        onUpdate({
          ...order,
          status: 'Preparing',
          steadfast: {
            consignmentId: data.consignment.consignment_id,
            trackingCode: data.consignment.tracking_code,
            status: data.consignment.status,
            createdAt: new Date().toISOString()
          }
        });
        setShowSteadfastConfirm(false);
      } else {
        setSteadfastError(data.message || 'Failed to submit to Steadfast');
      }
    } catch (err: any) {
      setSteadfastError(err.message || 'Network error occurred');
    } finally {
      setIsSubmittingSteadfast(false);
    }
  };

  const statuses: OrderStatus[] = ['Pending', 'Unreachable', 'Preparing', 'Shipping', 'Completed', 'Canceled', 'Returned', 'Complete Return'];

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] flex flex-col md:left-[260px]">
      {/* Header */}
      <div className="border-b border-[var(--dash-border)] bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between p-4 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"><ChevronLeft size={22} /></button>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold text-white">Order #{order.id}</h1>
              <CopyButton text={order.id} className="p-1 text-gray-400 hover:text-white bg-white/5 rounded-lg border border-white/10" />
            </div>
          </div>
          <div className="flex gap-1.5 items-center">
            <button className="p-2 text-slate-300 hover:text-white rounded-xl bg-[var(--dash-card)] border border-[var(--dash-border)] transition-colors cursor-pointer"><Download size={18} /></button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-red-400 hover:text-red-300 rounded-xl bg-[var(--dash-card)] border border-[var(--dash-border)] transition-colors cursor-pointer"><Trash2 size={18} /></button>
            <button onClick={handleOpenMessage} className="p-2 text-gray-400 hover:text-white rounded-xl bg-[var(--dash-card)] border border-[var(--dash-border)] relative transition-colors cursor-pointer">
              <MessageSquareText size={18} />
              {order.userInfo.customerNote && !isNoteRead && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[var(--dash-card)] animate-pulse"></span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-2 lg:space-y-4 pb-24 md:p-8 md:pb-8">
        <div className="max-w-4xl mx-auto w-full space-y-2 lg:space-y-4">
        {/* Customer Info */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl flex flex-col">
          <div className="flex items-center gap-4 text-white p-4 border-b border-[var(--dash-border)]">
            <User size={20} className="text-[#fafafa]" />
            <span className="font-medium">{perms?.customerName !== false ? order.userInfo.name : '***'}</span>
          </div>
          <div className="flex items-center gap-4 text-white p-3 sm:p-4 border-b border-[var(--dash-border)]">
            <Phone size={20} className="text-[#fafafa] shrink-0" />
            <div className="flex items-center justify-between w-full">
              {(() => {
                const formattedPhone = formatWhatsAppPhone(order.userInfo.phone);
                const showPhone = perms?.customerPhone !== false;

                return (
                  <>
                    <span className="font-medium text-sm sm:text-base">{showPhone ? formattedPhone : '***'}</span>
                    <div className="flex items-center gap-2">
                      <CopyButton text={showPhone ? formattedPhone : '***'} className="p-2 text-gray-500 hover:text-white bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)]" />
                      <a 
                        href={`https://wa.me/${showPhone ? formattedPhone : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-[var(--dash-bg)] text-green-500 hover:text-green-400 hover:border-green-500/50 rounded-lg border border-[var(--dash-border)] transition-colors"
                        title="Open WhatsApp"
                        aria-label="Open WhatsApp"
                      >
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
                          <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
                        </svg>
                      </a>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-4 text-white p-4">
            <MapPin size={20} className="text-[#fafafa]" />
            <span className="font-medium text-sm sm:text-base">{perms?.customerAddress !== false ? order.userInfo.address : '***'}</span>
          </div>
        </div>

        {/* Success Ratio & Status Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Success Ratio */}
          {(() => {
            if (perms?.orderHistory === false) {
              return (
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 flex items-center justify-center text-gray-500 text-xs">
                  History Hidden
                </div>
              );
            }
            
            if (order.bdCourierStatus === 'failed') {
              return (
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                  <span className="text-gray-400 text-xs">API Failed</span>
                  <button 
                    onClick={onRetryBdCourier} 
                    className="p-1.5 bg-[var(--dash-border)] rounded hover:bg-[#254a3b] transition-colors text-white flex items-center gap-1 text-xs"
                  >
                    <RefreshCw size={12} className={isSyncingBdCourier ? "animate-spin" : ""} /> Retry
                  </button>
                </div>
              );
            }

            if (order.bdCourierStatus === 'pending') {
               return (
                 <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                    <RefreshCw size={18} className="animate-spin text-[#fafafa]" />
                    <span className="text-[10px] text-gray-500">Checking...</span>
                 </div>
               );
            }

            let completed = 0;
            let totalResolved = 0;
            let percentage = 0;

            if (order.bdCourierData?.summary) {
              completed = order.bdCourierData.summary.success_parcel || 0;
              totalResolved = order.bdCourierData.summary.total_parcel || 0;
              percentage = order.bdCourierData.summary.success_ratio || 0;
            } else {
              // Fallback
              const customerOrders = orders.filter(o => o.userInfo.phone === order.userInfo.phone);
              completed = customerOrders.filter(o => o.status === 'Completed').length;
              const failed = customerOrders.filter(o => o.status === 'Canceled' || o.status === 'Returned' || o.status === 'Complete Return' || o.status === 'Unreachable').length;
              totalResolved = completed + failed;
              if (totalResolved > 0) percentage = (completed / totalResolved) * 100;
            }

            const percentageFormatted = percentage % 1 === 0 ? percentage : Number(percentage.toFixed(2));

            return (
              <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 flex items-center justify-between relative">
                <div className="flex flex-col">
                  <span className="text-gray-300 text-[10px] sm:text-xs mb-1">Success Ratio</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg sm:text-xl font-bold text-[#fafafa] leading-none mb-1">{percentageFormatted}%</span>
                    <span className="text-gray-400 text-[10px] mb-1">({completed}/{totalResolved})</span>
                  </div>
                </div>
                <div 
                  className="w-[42px] h-[42px] sm:w-12 sm:h-12 rounded-full flex items-center justify-center relative shrink-0"
                  style={{ background: `conic-gradient(#fafafa ${percentage}%, var(--dash-border) ${percentage}%)` }}
                >
                  <div className="w-[36px] h-[36px] sm:w-[42px] sm:h-[42px] bg-[var(--dash-card)] rounded-full flex items-center justify-center z-10">
                   <span className="text-[10px] text-white font-bold">{Math.round(percentage)}%</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Status */}
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-3 flex flex-col justify-center relative">
            <span className="text-gray-300 text-xs mb-1 pl-1">Status</span>
            <button 
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center justify-between w-full px-2 py-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-xs sm:text-sm hover:border-gray-500 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center rounded-full p-1",
                  status === 'Pending' ? 'text-yellow-400 bg-yellow-400/10' :
                  status === 'Canceled' ? 'text-red-500 bg-red-500/10' :
                  status === 'Unreachable' ? 'text-gray-400 bg-gray-400/10' :
                  status === 'Returned' ? 'text-red-400 bg-red-400/10' :
                  status === 'Shipping' ? 'text-pink-400 bg-pink-400/10' :
                  status === 'Completed' ? 'text-green-400 bg-green-400/10' :
                  'text-orange-400 bg-orange-400/10'
                )}>
                  <Clock size={14} />
                </div>
                <span className={cn(
                  "font-medium",
                  status === 'Pending' ? 'text-yellow-400' :
                  status === 'Canceled' ? 'text-red-500' :
                  status === 'Unreachable' ? 'text-gray-400' :
                  status === 'Returned' ? 'text-red-400' :
                  status === 'Shipping' ? 'text-pink-400' :
                  status === 'Completed' ? 'text-green-400' :
                  'text-orange-400'
                )}>{status}</span>
              </div>
              <ChevronDown size={14} className="text-gray-400" />
            </button>

            {showStatusDropdown && (
              <div className="absolute top-full right-0 left-0 mt-1 bg-[var(--dash-border)] border border-[#2b4c3e] rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                {statuses.map(s => (
                  <button 
                    key={s}
                    onClick={() => { setStatus(s); setShowStatusDropdown(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-[#2b4c3e] text-white text-sm transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Total Items & Quantity Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--dash-border)] flex items-center justify-center text-[#fafafa]">
              <ShoppingBag size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-gray-300 text-xs mb-0.5">Total Items</span>
              <span className="text-white font-bold text-sm">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--dash-border)] flex items-center justify-center text-[#fafafa]">
              <Package size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-gray-300 text-xs mb-0.5">Total Quantity</span>
              <span className="text-white font-bold text-sm">{items.reduce((acc, item) => acc + item.quantity, 0)} pc's</span>
            </div>
          </div>
        </div>

        {/* Return Stock Checkbox (Only if Returned) */}
        {(status === 'Returned' || status === 'Complete Return') && (
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 flex items-center justify-between text-white">
            <span className="font-bold flex items-center gap-2 text-red-400">
              <Package size={18} />
              Return Stock
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={returnStockChecked}
                onChange={(e) => setReturnStockChecked(e.target.checked)}
                disabled={order.stockReturned}
              />
              <div className="w-11 h-6 bg-[var(--dash-border)] rounded-full peer peer-checked:after:translate-x-[20px] peer-checked:peer-active:after:translate-x-[12px] peer-checked:after:border-[var(--dash-card)] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white peer-checked:after:bg-[var(--dash-card)] after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 after:ease-[cubic-bezier(0.25,1,0.5,1)] peer-active:after:w-7 peer-checked:bg-[#fafafa] opacity-100 peer-disabled:opacity-50"></div>
            </label>
            {order.stockReturned && (
              <span className="text-xs text-[#fafafa] absolute right-6 -mt-10 bg-[var(--dash-bg)] px-2 rounded font-medium">Stock Already Returned</span>
            )}
          </div>
        )}

        {/* Products Section */}
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-white font-bold text-lg">Products</h2>
            <button 
              onClick={() => setShowAddProducts(true)}
              className="flex items-center gap-1 text-[#fafafa] text-sm hover:text-[#e4e4e7] font-medium transition-colors"
            >
              <PlusCircle size={16} /> Add Products
            </button>
          </div>

          <div className={cn("flex flex-col gap-3", items.length > 3 && "max-h-[320px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[var(--dash-border)] [&::-webkit-scrollbar-thumb]:rounded-full")}>
            {items.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-[var(--dash-card)] rounded-xl p-3 flex gap-4 items-center border border-[var(--dash-border)]"
              >
                <img 
                  src={(item.product.images && item.product.images.length > 0) ? item.product.images[0] : item.product.image} 
                  alt={item.product.title} 
                  className="w-[72px] h-[72px] object-cover rounded-lg bg-[var(--dash-bg)] cursor-pointer" 
                  onClick={() => setPreviewImage((item.product.images && item.product.images.length > 0) ? item.product.images[0] : item.product.image)}
                />
                <div className="flex-grow flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="bg-[var(--dash-border)] text-[#fafafa] text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      ID: {item.product.id} <CopyButton text={item.product.id} className="p-0 text-[#fafafa] hover:text-white" />
                    </span>
                    {item.variantName && (
                      <span className="bg-[var(--dash-border)] text-[#fafafa] text-[11px] font-bold px-2 py-0.5 rounded">{item.variantName}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1 border-r border-[var(--dash-border)] pr-3 mr-1">
                    <span className="text-gray-300 text-sm">৳{perms?.customerOrderAmount !== false ? (item.variantPrice ?? item.product.price) : '***'} <span className="text-gray-500 mx-1">×</span> <span className="text-[#fafafa] font-bold">{item.quantity}</span> <span className="text-gray-400">pc</span></span>
                    <span className="text-white font-bold text-lg border-l border-[var(--dash-border)] pl-3">৳{perms?.customerOrderAmount !== false ? (item.variantPrice ?? item.product.price) * item.quantity : '***'}</span>
                  </div>
                </div>
                <div 
                  className="p-1.5 text-gray-500 hover:text-white transition-colors cursor-pointer mr-1 bg-[var(--dash-bg)] rounded-md"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingItemIndex(idx);
                  }}
                >
                  <div className="flex flex-col gap-[3px]">
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl flex flex-col pt-4 pb-4">
          <div className="flex flex-col gap-4 px-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Product Total</span>
              <span className="text-white text-sm">{perms?.customerOrderAmount !== false ? formatPrice(productTotal) : '***'}</span>
            </div>
            
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">Discount</span>
              <input 
                type="number" 
                value={Number.isNaN(Number(discount)) ? '' : discount} 
                onChange={e => setDiscount(Number(e.target.value))}
                className="w-24 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-full py-1.5 px-3 text-right text-gray-300 focus:outline-none focus:border-[#fafafa] transition-colors"
                placeholder="0"
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">Shipping</span>
              <input 
                type="number" 
                value={Number.isNaN(Number(shipping)) ? '' : shipping} 
                onChange={e => setShipping(Number(e.target.value))}
                className="w-24 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-full py-1.5 px-3 text-right text-gray-300 focus:outline-none focus:border-[#fafafa] transition-colors"
                placeholder="0"
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">Extra Costs</span>
              <input 
                type="number" 
                value={Number.isNaN(Number(extraCosts)) ? '' : extraCosts} 
                onChange={e => setExtraCosts(Number(e.target.value))}
                className="w-24 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-full py-1.5 px-3 text-right text-gray-300 focus:outline-none focus:border-[#fafafa] transition-colors"
                placeholder="0"
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">Return Cost (৳)</span>
              <input 
                type="number" 
                value={Number.isNaN(Number(returnCost)) ? '' : returnCost} 
                onChange={e => setReturnCost(Number(e.target.value))}
                className="w-24 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-full py-1.5 px-3 text-right text-gray-300 focus:outline-none focus:border-[#fafafa] transition-colors"
                placeholder="0"
              />
            </div>
          </div>

          <div className="h-[1px] w-full bg-[var(--dash-border)] my-4"></div>

          <div className="flex flex-col gap-3 px-4">
            <div className="flex justify-between items-center">
              <span className="text-white font-bold">Total</span>
              <span className="text-red-500 font-bold">{perms?.customerOrderAmount !== false ? formatPrice(total) : '***'}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[#fafafa] font-bold">Profit</span>
              <span className="text-[#fafafa] font-bold">{perms?.customerOrderAmount !== false ? formatPrice(profit) : '***'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2">
          {order.steadfast ? (
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-[20px] p-4 flex items-center justify-between gap-3 overflow-hidden">
              <div className="flex items-center gap-4 min-w-0">
                <a 
                   href={`https://steadfast.com.bd/t/${order.steadfast.trackingCode}`} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="w-12 h-12 rounded-[14px] bg-[var(--dash-bg)] border border-[var(--dash-border)] flex items-center justify-center flex-shrink-0 hover:border-[#fafafa] transition-colors group cursor-pointer"
                   title="Open Tracking Page"
                >
                  <Truck size={24} className="text-[#fafafa] group-hover:scale-110 transition-transform" />
                </a>
                <span className="text-white font-bold text-lg truncate">Steadfast</span>
              </div>
              
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[#fafafa] font-bold text-base font-mono truncate">
                  #{String(order.steadfast.consignmentId).replace(/(.{3})/g, '$1-').replace(/-$/, '')}
                </span>
                <CopyButton text={String(order.steadfast.consignmentId)} className="p-2 text-gray-500 hover:text-white" />
              </div>
            </div>
          ) : (
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-[20px] p-4 flex items-center justify-between gap-2 overflow-hidden">
               <div className="flex items-center gap-3 min-w-0">
                 <Calendar size={20} className="text-[#fafafa] flex-shrink-0" />
                 <span className="text-white font-medium text-sm truncate">{order.date}</span>
               </div>
               
               <div className="flex items-center gap-3 flex-shrink-0">
                 <span className="text-gray-400 font-medium text-sm hidden sm:inline">Steadfast</span>
                 <button 
                   onClick={() => {
                     setSteadfastNote('');
                     setShowSteadfastConfirm(true);
                   }}
                   className="bg-[var(--dash-border)] text-[#fafafa] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[var(--dash-border)] transition-colors whitespace-nowrap"
                 >
                   submit
                 </button>
               </div>
            </div>
          )}
          {steadfastError && (
            <div className="text-red-500 text-sm px-2 text-right">{steadfastError}</div>
          )}
        </div>
        </div>
      </div>

      {/* Bottom Update Button */}
      {hasChanges && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--dash-bg)] border-t border-[var(--dash-border)] z-20">
          <div className="max-w-3xl mx-auto w-full">
            <button 
              onClick={handleUpdate}
              className="w-full bg-[#fafafa] text-[var(--dash-bg)] font-bold py-3.5 rounded-full hover:bg-[#e4e4e7] transition-colors flex items-center justify-center gap-2"
            >
              <Edit3 size={20} /> Update Order
            </button>
          </div>
        </div>
      )}

      {/* Item Edit Modal */}
      <AnimatePresence>
        {editingItemIndex !== null && (
          <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-[var(--dash-bg)]/50 md:left-[260px]">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-[var(--dash-bg)] rounded-t-2xl md:rounded-2xl border-t md:border border-[var(--dash-border)] p-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto md:max-w-md"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Item Details</h2>
                <button onClick={() => setEditingItemIndex(null)} className="p-2 text-gray-400 hover:text-white">
                  <Trash2 size={20} className="hidden" /> {/* Placeholder for spacing if needed, or just use X */}
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>

              {(() => {
                const item = items[editingItemIndex];
                if (!item) return null;
                const buyPrice = item.variantBuyPrice ?? (item.product.buyPrice ?? Math.floor((item.variantPrice ?? item.product.price) * 0.4));
                const sellPrice = item.variantPrice ?? item.product.price;
                const itemProfit = sellPrice - buyPrice;

                // Find live product and variant for accurate stock calculation
                const liveProduct = products.find(p => p.id === item.product?.id) || item.product;
                const liveVariant = item.variantId && liveProduct?.variants ? liveProduct.variants.find(v => v.id === item.variantId) : null;
                
                const inventoryStock = liveVariant?.stock !== undefined && liveVariant?.stock !== null 
                  ? Number(liveVariant.stock) 
                  : (liveProduct?.stock !== undefined && liveProduct?.stock !== null ? Number(liveProduct.stock) : undefined);

                const isActive = isOrderStockActive(order);
                const originalItem = order.items?.find(i => {
                  if (item.variantId) {
                    return (i.product?.id === item.product?.id || i.id === item.product?.id) && i.variantId === item.variantId;
                  }
                  return (i.product?.id === item.product?.id || i.id === item.product?.id) && !i.variantId;
                }) || order.items?.find(i => i.id === item.id);
                
                const originalQty = (isActive && originalItem) ? Number(originalItem.quantity) || 0 : 0;
                
                // Total stock available for this order item = originalQty already held in active order + remaining inventoryStock
                const totalAvailableStock = inventoryStock !== undefined && inventoryStock !== null 
                  ? originalQty + Math.max(0, inventoryStock) 
                  : Infinity;

                // Other items in current draft order with same product and variant
                const otherDraftQty = items
                  .filter((it, idx) => idx !== editingItemIndex && it.product?.id === item.product?.id && it.variantId === item.variantId)
                  .reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

                const maxAllowedQty = Math.max(0, totalAvailableStock - otherDraftQty);

                const updateItem = (updates: any) => {
                  const newItems = [...items];
                  newItems[editingItemIndex] = {
                    ...item,
                    ...updates,
                    product: { ...item.product, ...updates.product }
                  };
                  setItems(newItems);
                };

                const handleQtyChange = (delta: number) => {
                  if (delta > 0 && item.quantity >= maxAllowedQty) {
                    return;
                  }
                  const newQty = Math.min(maxAllowedQty, Math.max(0, item.quantity + delta));
                  if (newQty === 0) {
                    setItems(items.filter((_, i) => i !== editingItemIndex));
                    setEditingItemIndex(null);
                  } else {
                    updateItem({ quantity: newQty });
                  }
                };

                return (
                  <>
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white font-bold">Buy</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 line-through text-sm">{formatPrice(buyPrice)}</span>
                          <span className="text-white font-bold">{formatPrice(buyPrice)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white font-bold">Sell</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 line-through text-sm">{formatPrice(sellPrice)}</span>
                          <span className="text-white font-bold">{formatPrice(sellPrice)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white font-bold">Profit</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 line-through text-sm">{formatPrice(itemProfit)}</span>
                          <span className="text-[#fafafa] font-bold">{formatPrice(itemProfit)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <input 
                          type="number" 
                          value={Number.isNaN(Number(buyPrice)) ? '' : buyPrice}
                          onChange={e => {
                            const newBuyPrice = Math.floor(Math.max(0, Number(e.target.value)));
                            if (item.variantId) {
                               updateItem({ variantBuyPrice: newBuyPrice });
                            } else {
                               updateItem({ product: { buyPrice: newBuyPrice } });
                            }
                          }}
                          className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg py-2 px-3 text-center text-white focus:outline-none focus:border-[#fafafa]"
                        />
                        <input 
                          type="number" 
                          value={Number.isNaN(Number(sellPrice)) ? '' : sellPrice}
                          onChange={e => {
                            const newSellPrice = Math.floor(Math.max(0, Number(e.target.value)));
                            if (item.variantId) {
                               updateItem({ variantPrice: newSellPrice });
                            } else {
                               updateItem({ product: { price: newSellPrice } });
                            }
                          }}
                          className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg py-2 px-3 text-center text-white focus:outline-none focus:border-[#fafafa]"
                        />
                        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg py-2 px-3 text-center text-gray-500">
                          {/* Empty input placeholder for UI consistency if needed */}
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-4">
                        <div className="flex flex-col">
                          <span className="text-gray-400 text-sm">Original Qty: {originalItem?.quantity || 0}</span>
                          {inventoryStock !== undefined && (
                            <span className="text-xs text-gray-400 mt-0.5">
                              In Stock: <span className={cn("font-medium", (maxAllowedQty - item.quantity) <= 0 ? "text-amber-400" : "text-emerald-400")}>
                                {inventoryStock}
                              </span>
                              {maxAllowedQty !== Infinity && (
                                <span className="text-gray-500 ml-1">(Max: {maxAllowedQty})</span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm">Edit qty:</span>
                          <div className="flex items-center bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg">
                            <button onClick={() => handleQtyChange(-1)} className="px-3 py-1.5 text-white hover:text-[#fafafa] transition-colors">-</button>
                            <span className="px-2 text-white font-bold min-w-[2rem] text-center">{item.quantity}</span>
                            <button 
                              onClick={() => handleQtyChange(1)} 
                              disabled={item.quantity >= maxAllowedQty}
                              className={cn(
                                "px-3 py-1.5 transition-colors",
                                item.quantity >= maxAllowedQty 
                                  ? "text-gray-600 cursor-not-allowed opacity-40" 
                                  : "text-white hover:text-[#fafafa]"
                              )}
                              title={item.quantity >= maxAllowedQty ? `Max available stock reached (${maxAllowedQty})` : "Add quantity"}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Products Modal */}
      <AnimatePresence>
        {showAddProducts && (
          <div className="fixed inset-0 z-[120] flex items-end md:items-center justify-center bg-[var(--dash-bg)]/50 md:left-[260px] p-0 md:p-8">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-[var(--dash-bg)] rounded-t-2xl md:rounded-2xl border-t md:border border-[var(--dash-border)] flex flex-col h-[90vh] md:max-w-3xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--dash-border)] shrink-0">
                <h2 className="text-lg font-bold text-white">Add Products</h2>
                <button onClick={() => setShowAddProducts(false)} className="p-2 text-gray-400 hover:text-white">
                  <span className="text-xl leading-none">&times;</span>
                </button>
              </div>

              <div className="p-4 border-b border-[var(--dash-border)] shrink-0 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Search by name or code..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full h-12 bg-white border-[1.5px] border-[var(--theme-primary)] rounded-full px-4 pl-10 text-[var(--theme-black)] text-sm outline-none shadow-sm placeholder-gray-400 focus:shadow-md transition-shadow"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "px-4 py-1.5 rounded-full text-sm whitespace-nowrap border transition-colors",
                        selectedCategory === cat 
                           ? "bg-[#fafafa] text-[var(--dash-bg)] border-[#fafafa] font-bold" 
                          : "bg-[var(--dash-card)] text-gray-400 border-[var(--dash-border)] hover:border-gray-500"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-grow overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3">
                  {filteredProducts.map(product => {
                    const selected = selectedNewProducts.find(p => p.product.id === product.id);
                    const isSelected = !!selected;
                    const quantity = selected?.quantity || 1;

                    const availableVariant = (product.variants && product.variants.length > 0)
                      ? (product.variants.find(v => (v.stock || 0) > 0) || product.variants[0])
                      : null;
                    const variantId = selected?.variantId || availableVariant?.id;
                    const liveVariant = variantId && product.variants ? product.variants.find(v => v.id === variantId) : null;
                    
                    const invStock = liveVariant?.stock !== undefined && liveVariant?.stock !== null
                      ? Number(liveVariant.stock)
                      : (product.stock !== undefined && product.stock !== null ? Number(product.stock) : undefined);

                    // Existing quantity already in current draft order items
                    const existingInDraft = items
                      .filter(i => i.product?.id === product.id && i.variantId === variantId)
                      .reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);

                    // Original quantity in original order
                    const isActive = isOrderStockActive(order);
                    const origItem = order.items?.find(i => {
                      if (variantId) {
                        return (i.product?.id === product.id || i.id === product.id) && i.variantId === variantId;
                      }
                      return (i.product?.id === product.id || i.id === product.id) && !i.variantId;
                    });
                    const origQty = (isActive && origItem) ? Number(origItem.quantity) || 0 : 0;

                    const totalAvail = invStock !== undefined && invStock !== null
                      ? origQty + Math.max(0, invStock)
                      : Infinity;

                    const maxAddable = Math.max(0, totalAvail - existingInDraft);
                    const isOutOfStock = invStock !== undefined && maxAddable <= 0;

                    return (
                      <div 
                        key={product.id} 
                        className={cn(
                          "bg-[var(--dash-card)] border rounded-xl overflow-hidden flex flex-col transition-colors",
                          isSelected ? "border-[#fafafa]" : "border-[var(--dash-border)]",
                          isOutOfStock && !isSelected && "opacity-75"
                        )}
                      >
                        <div className="relative aspect-square w-full overflow-hidden">
                          <img src={(product.images && product.images.length > 0) ? product.images[0] : product.image} alt={product.title} className="absolute inset-0 w-full h-full object-cover" />
                          {invStock !== undefined && (
                            <span className={cn(
                              "absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm",
                              maxAddable <= 0 
                                ? "bg-rose-500/90 text-white" 
                                : maxAddable <= 3 
                                ? "bg-amber-500/90 text-black" 
                                : "bg-black/60 text-emerald-400 backdrop-blur-xs border border-white/10"
                            )}>
                              {maxAddable <= 0 ? "Stock Out" : `Stock: ${invStock}`}
                            </span>
                          )}
                          <div 
                            onClick={() => {
                              if (isSelected) {
                                setSelectedNewProducts(prev => prev.filter(p => p.product.id !== product.id));
                              } else if (!isOutOfStock) {
                                if (product.variants && product.variants.length > 0) {
                                  const availVar = product.variants.find(v => (v.stock || 0) > 0) || product.variants[0];
                                  const vName = Object.values(availVar.options || {}).map(v => String(v).toUpperCase()).join(" / ");
                                  setSelectedNewProducts(prev => [...prev, { 
                                    product, 
                                    quantity: 1,
                                    variantId: availVar.id,
                                    variantName: vName,
                                    variantPrice: availVar.price,
                                    variantBuyPrice: availVar.buyPrice
                                  }]);
                                } else {
                                  setSelectedNewProducts(prev => [...prev, { product, quantity: 1 }]);
                                }
                              }
                            }}
                            className={cn(
                              "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                              isOutOfStock && !isSelected ? "bg-[var(--dash-bg)]/30 border-white/10 cursor-not-allowed opacity-40" : "bg-[var(--dash-bg)]/50 border-white/20 cursor-pointer"
                            )}
                          >
                            {isSelected && <Check size={14} className="text-[#fafafa]" />}
                          </div>
                        </div>
                        <div className="p-3 flex flex-col flex-grow">
                          <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight mb-1">{product.title}</h3>
                          <div className="text-[#fafafa] font-bold text-sm mb-3">{formatPrice(product.price)}</div>
                          
                          <div className="mt-auto">
                            {isSelected ? (
                              <div className="flex items-center justify-between bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg">
                                <button 
                                  onClick={() => {
                                    if (quantity > 1) {
                                      setSelectedNewProducts(prev => prev.map(p => p.product.id === product.id ? { ...p, quantity: p.quantity - 1 } : p));
                                    } else {
                                      setSelectedNewProducts(prev => prev.filter(p => p.product.id !== product.id));
                                    }
                                  }} 
                                  className="px-3 py-1.5 text-white hover:text-[#fafafa] transition-colors"
                                >
                                  -
                                </button>
                                <span className="text-white font-bold">{quantity}</span>
                                <button 
                                  onClick={() => {
                                    if (quantity < maxAddable) {
                                      setSelectedNewProducts(prev => prev.map(p => p.product.id === product.id ? { ...p, quantity: p.quantity + 1 } : p));
                                    }
                                  }} 
                                  disabled={quantity >= maxAddable}
                                  className={cn(
                                    "px-3 py-1.5 transition-colors",
                                    quantity >= maxAddable 
                                      ? "text-gray-600 cursor-not-allowed opacity-40" 
                                      : "text-white hover:text-[#fafafa]"
                                  )}
                                  title={quantity >= maxAddable ? `Only ${maxAddable} available in stock` : "Add quantity"}
                                >
                                  +
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => {
                                  if (isOutOfStock) return;
                                  if (product.variants && product.variants.length > 0) {
                                    const availableVar = product.variants.find(v => (v.stock || 0) > 0) || product.variants[0];
                                    const variantName = Object.values(availableVar.options || {}).map(v => String(v).toUpperCase()).join(" / ");
                                    setSelectedNewProducts(prev => [...prev, { 
                                      product, 
                                      quantity: 1,
                                      variantId: availableVar.id,
                                      variantName: variantName,
                                      variantPrice: availableVar.price,
                                      variantBuyPrice: availableVar.buyPrice
                                    }]);
                                  } else {
                                    setSelectedNewProducts(prev => [...prev, { product, quantity: 1 }]);
                                  }
                                }}
                                disabled={isOutOfStock}
                                className={cn(
                                  "w-full py-1.5 border rounded-lg text-sm transition-colors",
                                  isOutOfStock 
                                    ? "border-[var(--dash-border)] text-gray-500 cursor-not-allowed opacity-50 bg-white/5" 
                                    : "border-[var(--dash-border)] text-gray-300 hover:border-[#fafafa] hover:text-[#fafafa]"
                                )}
                              >
                                {isOutOfStock ? "Out of Stock" : "Select"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 border-t border-[var(--dash-border)] bg-[var(--dash-bg)] shrink-0">
                <button 
                  onClick={handleAddSelectedProducts}
                  disabled={selectedNewProducts.length === 0}
                  className="w-full bg-[#fafafa] text-[var(--dash-bg)] font-bold py-3.5 rounded-xl hover:bg-[#e4e4e7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Add Selected Products {selectedNewProducts.length > 0 && `(${selectedNewProducts.length})`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[200] bg-[var(--dash-bg)]/80 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-6 max-w-sm w-full"
            >
              <h3 className="text-xl font-bold text-white mb-2 text-center">Confirm?</h3>
              <p className="text-gray-400 mb-6 text-center">Are you sure you want to delete this order?</p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => {
                    onDelete(order.id);
                    setShowDeleteConfirm(false);
                    onClose();
                  }}
                  className="w-full py-3 rounded-xl font-bold text-[var(--dash-bg)] bg-[#fafafa] hover:bg-[#e4e4e7] transition-colors"
                >
                  Confirm
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-3 rounded-xl font-bold text-white bg-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors border border-[#2a4d3e]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Steadfast Confirmation Modal */}
        {showSteadfastConfirm && (
          <div className="fixed inset-0 z-[200] bg-[var(--dash-bg)]/80 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-6 max-w-sm w-full relative"
            >
              <button onClick={() => setShowSteadfastConfirm(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
              <h3 className="text-xl font-bold text-white mb-2 text-center mt-2">Confirm?</h3>
              <p className="text-gray-400 mb-4 text-center">Cod amount: {formatPrice(total)}</p>
              
              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-2">Note to Rider (Optional)</label>
                <input
                  type="text"
                  value={steadfastNote}
                  onChange={(e) => setSteadfastNote(e.target.value)}
                  placeholder="e.g., Deliver after 5 PM"
                  className="w-full bg-[#0a1410] border border-[var(--dash-border)] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-[#fafafa]"
                  maxLength={200}
                />
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleSteadfastSubmit}
                  disabled={isSubmittingSteadfast}
                  className="w-full py-3 rounded-xl font-bold text-[var(--dash-bg)] bg-[#fafafa] hover:bg-[#e4e4e7] transition-colors disabled:opacity-50"
                >
                  {isSubmittingSteadfast ? 'Submitting...' : 'Confirm'}
                </button>
                <button 
                  onClick={() => setShowSteadfastConfirm(false)}
                  disabled={isSubmittingSteadfast}
                  className="w-full py-3 rounded-xl font-bold text-white bg-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors border border-[#2a4d3e] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Customer Note Modal */}
        {showMessageModal && (
          <div className="fixed inset-0 z-[200] bg-[var(--dash-bg)]/80 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-6 max-w-sm w-full relative"
            >
              <button 
                onClick={() => setShowMessageModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-2 mb-4">
                <MessageSquareText className="text-[#fafafa]" size={20} />
                <h3 className="text-lg font-bold text-white">Customer Note</h3>
              </div>
              
              <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-4 max-h-[60vh] overflow-y-auto">
                <p className="text-gray-200 text-sm italic font-medium">
                  {order.userInfo.customerNote ? `"${order.userInfo.customerNote}"` : "No note provided."}
                </p>
              </div>
              
            </motion.div>
          </div>
        )}
        {/* Image Preview Modal */}
        {previewImage && (
          <div 
            className="fixed inset-0 z-[200] bg-[var(--dash-bg)]/90 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setPreviewImage(null)}
          >
            <img 
              src={previewImage} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
