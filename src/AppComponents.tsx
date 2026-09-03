import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, Search, ShoppingBag, LayoutGrid, Gem, Circle, Sparkles, LifeBuoy, Activity, CircleDashed, SlidersHorizontal, Lock, Unlock, Trash2, Minus, Plus, X, ArrowRight, ArrowLeft, User, Phone, MapPin, Truck, Check, Send, Copy, ChevronUp, MoreHorizontal, RefreshCw, Star, Download, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, BadgePercent, Edit3, EyeOff, MessageSquareText, Package, CheckCircle2, Navigation } from 'lucide-react';
import { format } from 'date-fns';
import { getCartTotal } from './lib/pricingUtils';
import { isProductInStock } from './lib/stockUtils';
import { downloadReceiptAsJPG, downloadReceiptAsPDF } from './lib/downloadReceipt';
import { Receipt } from './components/Receipt';
import { cn, formatPrice, normalizePhone, slugify } from './lib/utils';
import { CopyButton } from './components/CopyButton';
import MinOrderPopup from './MinOrderPopup';
import ActionBtn from './components/ActionBtn';
import { useScrollLock } from './hooks/useScrollLock';
import { DEFAULT_ACTION_BUTTONS, Category, Product, WebsiteSettings, Order, CartItem } from './types';

export function BannerSlider({ banners, borderRadius = '0px' }: { banners: string[], borderRadius?: string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % banners.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);

  // If there's a border radius other than 0px, add a bit of padding to see it,
  // or we can just apply the border radius and if they want it full width, they can use 0px.
  // Actually, usually users expect a small margin if it's rounded. Let's add slight margin if rounded > 0.
  const isRounded = borderRadius && borderRadius !== '0px' && borderRadius !== '0';

  return (
    <div className={isRounded ? "px-2 pt-2" : ""}>
      <div 
        className="relative w-full overflow-hidden bg-gray-100" 
        style={{ aspectRatio: '16/5', borderRadius }}
      >
        <AnimatePresence initial={false}>
          <motion.img
            key={currentIndex}
            src={banners[currentIndex]}
            alt={`Banner ${currentIndex + 1}`}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ borderRadius }}
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
          transition={{ duration: 0.5 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={1}
          onDragEnd={(e, { offset, velocity }) => {
            const swipe = swipePower(offset.x, velocity.x);
            if (swipe < -swipeConfidenceThreshold) {
              nextSlide();
            } else if (swipe > swipeConfidenceThreshold) {
              prevSlide();
            }
          }}
        />
      </AnimatePresence>

      {banners.length > 1 && (
        <>
          <button 
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-[var(--theme-black)]/30 rounded-full flex items-center justify-center text-[var(--theme-white)] backdrop-blur-sm"
          >
            <ChevronLeft size={16} />
          </button>
          <button 
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-[var(--theme-black)]/30 rounded-full flex items-center justify-center text-[var(--theme-white)] backdrop-blur-sm"
          >
            <ChevronRight size={16} />
          </button>
          
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((_, idx) => (
              <div 
                key={idx} 
                className={cn("w-1.5 h-1.5 rounded-full transition-colors", idx === currentIndex ? "bg-[var(--theme-white)]" : "bg-[var(--theme-white)]/50")}
              />
            ))}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export function FilterDropdown({ sortOrder, onSort }: { sortOrder: string, onSort: (s: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSort = (s: any) => {
    onSort(s);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="w-10 h-10 rounded-full bg-[var(--theme-black)] text-[var(--theme-white)] flex items-center justify-center">
        <SlidersHorizontal size={18} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute top-12 left-0 w-40 bg-[var(--theme-white)] border border-gray-100 text-[var(--theme-black)] rounded-xl shadow-xl overflow-hidden py-1 z-50"
          >
            <button onClick={() => handleSort('default')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2">
              <Menu size={16} className={sortOrder === 'default' ? 'text-[var(--theme-primary)]' : 'text-gray-400'} /> Default
            </button>
            <button onClick={() => handleSort('high')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2">
              <ArrowDown size={16} className={sortOrder === 'high' ? 'text-[var(--theme-primary)]' : 'text-gray-400'} /> Price high
            </button>
            <button onClick={() => handleSort('low')} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2">
              <ArrowUp size={16} className={sortOrder === 'low' ? 'text-[var(--theme-primary)]' : 'text-gray-400'} /> Price low
            </button>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar({ onClose, activeCategory, setActiveCategory, categories, products, websiteSettings }: { onClose: () => void, activeCategory: string, setActiveCategory: (c: string) => void, categories: Category[], products: Product[], websiteSettings?: WebsiteSettings }) {
  useScrollLock(true);
  const activeCategories = React.useMemo(() => {
    return categories
      .map(cat => {
        const catNameLower = cat.name.trim().toLowerCase();
        const firstMatchingProduct = products.find(p => p.category?.trim()?.toLowerCase() === catNameLower);
        if (!firstMatchingProduct) return null;
        const displayIcon = cat.icon || firstMatchingProduct.image || null;
        return { ...cat, displayIcon };
      })
      .filter(Boolean) as (Category & { displayIcon: string | null })[];
  }, [categories, products]);
  
  return (
    <div className="fixed inset-0 z-50 flex bg-[var(--theme-black)]/50">
      <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="w-4/5 max-w-sm bg-[var(--theme-white)] h-full flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          {websiteSettings?.logoUrl ? (
            <img src={websiteSettings.logoUrl} alt="Logo" className="h-8 object-contain" />
          ) : (
            <div className="h-8"></div>
          )}
          <button onClick={onClose} className="p-2 text-gray-400">
            <X size={20} />
          </button>
        </div>
        <div className="flex-grow overflow-y-auto py-2">
          <button 
            onClick={() => { setActiveCategory('All'); onClose(); }}
            className={cn("w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left", activeCategory === 'All' ? "bg-gray-50" : "")}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--theme-white)] bg-[var(--theme-black)]">
              <LayoutGrid size={16} />
            </div>
            <span className={cn("font-medium", activeCategory === 'All' ? "text-[var(--theme-primary)]" : "text-gray-700")}>All</span>
          </button>
          {activeCategories.map(cat => {
            return (
              <button 
                key={cat.id} 
                onClick={() => { setActiveCategory(cat.name); onClose(); }}
                className={cn("w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left", activeCategory === cat.name ? "bg-gray-50" : "")}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--theme-white)] bg-[var(--theme-black)] overflow-hidden">
                  {cat.displayIcon ? (
                    <img src={cat.displayIcon} alt={cat.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-[var(--theme-white)]">{cat.name.charAt(0)}</span>
                  )}
                </div>
                <span className={cn("font-medium", activeCategory === cat.name ? "text-[var(--theme-primary)]" : "text-gray-700")}>{cat.name}</span>
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-gray-100 text-center text-xs text-gray-400">
          Developed by <span className="text-[var(--theme-primary)] font-medium">MAX</span>
        </div>
      </motion.div>
    </div>
  );
}

export function SearchModal({ onClose, products, onProductClick }: { onClose: () => void, products: Product[], onProductClick: (p: Product) => void }) {
  const [query, setQuery] = useState('');
  const results = products.filter(p => 
    p.title.toLowerCase().includes(query.toLowerCase()) && 
    isProductInStock(p) && p.isVisible !== false
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col pointer-events-none lg:right-[320px] xl:right-[360px] lg:items-center lg:pt-3">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-white/60 lg:bg-[#09090b]/20 backdrop-blur-md pointer-events-auto cursor-pointer touch-none"
      />
      
      <div className="pt-4 px-4 pb-3 relative z-10 pointer-events-none w-full max-w-xl mx-auto lg:p-0">
        <motion.div 
          layoutId="search-bar-morph"
          style={{ borderRadius: 9999 }}
          transition={{ type: "spring", bounce: 0.05, duration: 0.4 }}
          className="w-full h-12 flex items-center bg-[var(--theme-white)] border-[1.5px] border-[var(--theme-primary)] overflow-hidden pointer-events-auto shadow-lg pr-2 rounded-full"
        >
          <Search size={20} className="ml-4 text-gray-400 shrink-0 hidden sm:block" />
          <motion.input
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: 0.05 }}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full px-4 h-full bg-transparent text-sm focus:outline-none text-[var(--theme-black)] lg:text-[15px]"
            placeholder="Search products..."
            autoFocus
          />
          <motion.button 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-[#09090b] transition-colors shrink-0 cursor-pointer"
          >
            <X size={18} />
          </motion.button>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="flex-grow lg:flex-grow-0 overflow-y-auto lg:overflow-visible px-4 pb-4 lg:p-0 relative z-10 pointer-events-none w-full max-w-xl mx-auto lg:mt-2 lg:max-h-[70vh] custom-scroll"
      >
        {query && results.length > 0 && (
          <div className="bg-white/95 backdrop-blur-xl rounded-[20px] lg:rounded-2xl overflow-hidden shadow-2xl pointer-events-auto pb-1 border border-gray-100 lg:max-h-[70vh] lg:overflow-y-auto">
            {results.map((product, idx) => (
              <div 
                key={product.id} 
                onClick={() => { onProductClick(product); }}
                className="flex items-center gap-3 p-2.5 lg:p-3 bg-transparent cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ borderBottom: idx !== results.length - 1 ? '1px solid rgba(243, 244, 246, 0.8)' : 'none' }}
              >
                <img src={product.thumbnail || product.image} className="w-14 h-14 lg:w-12 lg:h-12 rounded-xl lg:rounded-lg object-cover bg-gray-50 shrink-0 shadow-sm" />
                <div className="flex-grow min-w-0 pr-2">
                  <h4 className="text-[13px] lg:text-[14px] font-medium text-[var(--theme-black)] line-clamp-1 mb-0.5">{product.title}</h4>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-[14px] lg:text-[13px] text-[var(--theme-primary)]">{formatPrice(product.price)}</span>
                    <span className="text-[10px] font-semibold text-[var(--theme-primary)] bg-[var(--theme-primary)]/10 px-2 py-0.5 rounded uppercase shrink-0 ml-2">{product.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function ColorModal({ product, onClose, onAdd }: { product: Product, onClose: () => void, onAdd: (p: Product, c: string) => void }) {
  useScrollLock(true);
  const [selectedColor, setSelectedColor] = useState(product.colors![0]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--theme-black)]/50 p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm bg-[var(--theme-white)] rounded-3xl overflow-hidden relative">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-[var(--theme-white)]/80 backdrop-blur rounded-full text-gray-600">
          <X size={18} />
        </button>
        <div className="aspect-square bg-gray-100 relative">
          <img src={selectedColor.thumbnail || selectedColor.image || product.thumbnail || product.image} alt={product.title} className="w-full h-full object-cover" />
        </div>
        <div className="p-5">
          <div className="text-sm text-[var(--theme-black)] line-clamp-2 h-[2.5rem] leading-[1.25rem] mb-3">{product.title}</div>
          <div className="font-bold text-[16px] lg:text-lg mb-4">{formatPrice(product.price)}</div>
          <div className="mb-6">
            <div className="text-sm font-bold text-[var(--theme-black)] mb-2 flex items-center gap-2">
              COLOR: <span className="text-gray-500 font-normal uppercase">{selectedColor.name}</span>
            </div>
            <div className="flex gap-3">
              {product.colors!.map(color => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(color)}
                  className={cn("relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-all", selectedColor.name === color.name ? "border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]/20" : "border-transparent")}
                >
                  <img src={color.image} alt={color.name} className="w-full h-full object-cover" />
                  {selectedColor.name === color.name && (
                    <div className="absolute top-0 right-0 bg-[var(--theme-primary)] text-[var(--theme-white)] rounded-bl-lg p-0.5">
                      <Check size={12} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
          <button 
            onClick={() => { onAdd(product, selectedColor.name); onClose(); }} 
            className="btn-gradient w-full h-9 xl:h-10 rounded-full"
          >
            Add to cart
          </button>
        </div>
      </motion.div>
    </div>
  );
}

interface CartRowProps {
  item: CartItem;
  itemDiscount?: number;
  onPreview: (img: string) => void;
  onRemove: (id: string) => void;
  onUpdateQty: (id: string, val: number, isDelta?: boolean) => void;
  themeStyle?: 'cart' | 'checkout';
}

export const MemoizedCartRow = React.memo(function MemoizedCartRow({
  item,
  itemDiscount = 0,
  onPreview,
  onRemove,
  onUpdateQty,
  themeStyle = 'cart'
}: CartRowProps) {
  const isCheckout = themeStyle === 'checkout';
  const unitPrice = item.variantPrice ?? item.product.price;
  const finalUnitPrice = Math.max(0, unitPrice - itemDiscount);
  const displayImage = item.product.thumbnail || item.product.image;

  return (
    <div className={cn(
      "flex gap-4 p-3 rounded-xl shadow-sm content-visibility-auto",
      isCheckout ? "bg-[var(--theme-white)] border border-[var(--theme-primary)]/10" : "bg-[var(--theme-white)] border border-gray-100"
    )}>
      <img 
        src={displayImage} 
        alt={item.product.title} 
        loading="lazy"
        className="w-20 h-20 object-cover rounded-lg bg-gray-50 cursor-pointer shrink-0" 
        onClick={() => onPreview(displayImage)}
      />
      <div className="flex-grow flex flex-col justify-between min-w-0">
        <div>
          <h4 className="text-sm text-[var(--theme-black)] line-clamp-2 h-[2.5rem] leading-[1.25rem]">{item.product.title}</h4>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase inline-flex items-center gap-1">
              ID: {item.product.id} <CopyButton text={item.product.id} className="p-0 text-gray-400 hover:text-gray-600" />
            </span>
            {item.color && <span className="text-[10px] font-bold text-[var(--theme-primary)] bg-[var(--theme-primary)]/10 px-2 py-0.5 rounded uppercase">{item.color}</span>}
            {item.variantName && <span className="text-[10px] font-bold text-[var(--theme-primary)] bg-[var(--theme-primary)]/10 px-2 py-0.5 rounded uppercase">{item.variantName}</span>}
          </div>
          {isCheckout && (
            <div className="text-xs text-gray-500 mt-1">
              {itemDiscount > 0 ? (
                <>
                  <span className="line-through mr-1 text-gray-400">{formatPrice(unitPrice)}</span>
                  <span className="text-[var(--theme-black)] font-bold">{formatPrice(finalUnitPrice)}</span>
                </>
              ) : (
                formatPrice(unitPrice)
              )}
              <span> × {item.quantity} pc{item.quantity > 1 ? "'s" : ""}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          {isCheckout ? (
            <div className="font-bold text-[var(--theme-primary)] text-base">{formatPrice(finalUnitPrice * item.quantity)}</div>
          ) : (
            <div>
              <div className="font-bold text-sm">
                {itemDiscount > 0 ? (
                  <>
                    <span className="line-through text-gray-400 mr-2 text-xs">{formatPrice(unitPrice)}</span>
                    <span className="text-[var(--theme-black)]">{formatPrice(finalUnitPrice)}</span>
                  </>
                ) : (
                  formatPrice(unitPrice)
                )}
                <span className="text-xs text-gray-400 font-normal ml-1">x {item.quantity} pc</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button 
              onClick={() => onRemove(item.id)} 
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                isCheckout ? "text-[var(--theme-primary)] border border-[var(--theme-primary)]/20 bg-[var(--theme-white)] hover:bg-[var(--theme-primary)]/5" : "text-red-500 border border-red-200 bg-red-50"
              )}
            >
              <Trash2 size={14} />
            </button>
            <div className={cn(
              "flex items-center rounded-full h-8 bg-[var(--theme-white)]",
              isCheckout ? "border border-[var(--theme-primary)]/20" : "border border-gray-200"
            )}>
              <button 
                onClick={() => onUpdateQty(item.id, -1, true)} 
                className={cn(
                  "w-8 h-full flex items-center justify-center rounded-l-full transition-colors",
                  isCheckout ? "text-gray-700 hover:bg-gray-50" : "text-gray-500 hover:bg-gray-50"
                )}
              >
                <Minus size={14} />
              </button>
              <input 
                type="number" 
                className="w-10 text-center font-medium text-sm appearance-none border-none outline-none focus:outline-none bg-transparent p-0 m-0 focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                value={item.quantity === 0 ? '' : (item.quantity || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    onUpdateQty(item.id, 0, false);
                    return;
                  }
                  const num = parseInt(val);
                  if (!isNaN(num)) {
                    onUpdateQty(item.id, num, false);
                  }
                }}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (isNaN(val) || val < 1) {
                    onUpdateQty(item.id, 1, false);
                  }
                }}
              />
              <button 
                onClick={() => onUpdateQty(item.id, 1, true)} 
                className={cn(
                  "w-8 h-full flex items-center justify-center rounded-r-full transition-colors",
                  isCheckout ? "text-gray-700 hover:bg-gray-50" : "text-gray-500 hover:bg-gray-50"
                )}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const MemoizedCheckoutOrderList = React.memo(function MemoizedCheckoutOrderList({
  cart,
  itemDiscounts = {},
  onPreview,
  onRemove,
  onUpdateQty
}: any) {
  const totalQty = React.useMemo(() => cart.reduce((s: number, i: CartItem) => s + i.quantity, 0), [cart]);

  return (
    <div className="mt-6 pb-6 lg:mt-0 lg:pb-0 h-full flex flex-col lg:bg-[var(--store-bg)] lg:rounded-xl">
      <h3 className="text-lg font-bold text-[var(--theme-black)] mb-4 flex items-center justify-between shrink-0 lg:p-4 lg:pb-2">
        Your order
        <span className="text-sm font-normal text-gray-500">
          Items: <span className="font-bold text-[var(--theme-black)]">{cart.length}</span> Quantity: <span className="font-bold text-[var(--theme-black)]">{totalQty}</span>
        </span>
      </h3>
      <div className="space-y-1 lg:space-y-2 flex-1 overflow-visible lg:overflow-y-auto lg:min-h-0 p-1 lg:p-4 lg:pt-0 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
        {cart.map((item: CartItem) => (
          <MemoizedCartRow
            key={item.id}
            item={item}
            itemDiscount={itemDiscounts[item.id]}
            onPreview={onPreview}
            onRemove={onRemove}
            onUpdateQty={onUpdateQty}
            themeStyle="checkout"
          />
        ))}
      </div>
    </div>
  );
});

export function CartModal({ onClose, cart, orders, tab, setTab, updateQuantity, removeFromCart, onCheckout, onViewOrder, onOrderAgain, onAddMoreToOrder, websiteSettings, products }: any) {
  useScrollLock(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const { total, itemDiscounts } = React.useMemo(
    () => getCartTotal(cart, websiteSettings?.qtyRules),
    [cart, websiteSettings?.qtyRules]
  );
  const totalQuantity = cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);

  // Smart Discount Message Logic
  const applicableDiscounts = websiteSettings?.discounts?.filter((d: any) => d.status && d.type !== 'coupon') || [];
  let nextDiscountMsg = '';
  
  if (applicableDiscounts.length > 0) {
    // Find discounts that are not yet met due to minOrderAmount
    const upcomingDiscounts = applicableDiscounts
      .filter((d: any) => d.conditions.minOrderAmount && d.conditions.minOrderAmount > total)
      .sort((a: any, b: any) => (a.conditions.minOrderAmount || 0) - (b.conditions.minOrderAmount || 0));
      
    if (upcomingDiscounts.length > 0) {
      const nextD = upcomingDiscounts[0];
      const amountNeeded = (nextD.conditions.minOrderAmount || 0) - total;
      let reward = '';
      if (nextD.type === 'percentage') reward = `${nextD.action.percentage}% OFF`;
      else if (nextD.type === 'fixed') reward = `${formatPrice(nextD.action.fixedAmount || 0)} OFF`;
      else if (nextD.type === 'free_delivery') reward = `Free Delivery`;
      
      if (reward) {
        nextDiscountMsg = `Add ${formatPrice(amountNeeded)} more to get ${reward}`;
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[var(--theme-black)]/50">
      <div className="w-full max-w-md bg-[var(--store-bg)] h-full flex flex-col">
        <div className="flex items-center justify-between p-2 lg:p-4 border-b border-gray-100 bg-[var(--theme-white)]">
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600">
            <X size={20} />
          </button>
          <div className="flex bg-gray-100 rounded-full p-1">
            <button onClick={() => setTab('history')} className={cn("px-6 py-2 rounded-full text-sm font-medium transition-colors", tab === 'history' ? "bg-[var(--theme-primary)] text-[var(--theme-white)] hover:bg-[var(--theme-primary-hover)]" : "text-gray-600")}>History</button>
            <button onClick={() => setTab('cart')} className={cn("px-6 py-2 rounded-full text-sm font-medium transition-colors", tab === 'cart' ? "bg-[var(--theme-primary)] text-[var(--theme-white)] hover:bg-[var(--theme-primary-hover)]" : "text-gray-600")}>Cart</button>
          </div>
          <div className="w-10"></div>
        </div>

        {tab === 'cart' && nextDiscountMsg && (
          <div className="bg-[var(--theme-primary)]/10 px-4 py-2 text-center text-sm font-medium text-[var(--theme-primary)] border-b border-[var(--theme-primary)]/20">
            ✨ {nextDiscountMsg}
          </div>
        )}

        <div className="flex-grow overflow-y-auto p-1 lg:p-4">
          {tab === 'cart' ? (
            cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <ShoppingBag size={48} className="mb-4 opacity-20" />
                <p>Your cart is empty</p>
              </div>
            ) : (
              <div className="space-y-1 lg:space-y-4">
                {cart.map((item: CartItem) => (
                  <MemoizedCartRow
                    key={item.id}
                    item={item}
                    itemDiscount={itemDiscounts[item.id]}
                    onPreview={setPreviewImage}
                    onRemove={removeFromCart}
                    onUpdateQty={updateQuantity}
                    themeStyle="cart"
                  />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-1 lg:space-y-4">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <p>No order history</p>
                </div>
              ) : (
                [...orders].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()).map((order: Order) => {
                  let bgColor = 'bg-[#e0f2fe]';
                  let iconColor = 'text-blue-500';
                  let Icon = MoreHorizontal;

                  if (order.status === 'Canceled' || order.status === 'Returned' || order.status === 'Complete Return') {
                    bgColor = 'bg-[#ffe4e6]';
                    iconColor = 'text-red-500';
                    Icon = X;
                  } else if (order.status === 'Completed') {
                    bgColor = 'bg-[#dcfce7]';
                    iconColor = 'text-green-500';
                    Icon = Check;
                  }

                  // formatting date to make it look nicer like "1 minute ago" or raw datetime
                  // Currently order.date has format e.g. "EEEE, MM/dd/yyyy, hh:mm a"
                  // Let's just use what was there but clean it up slightly if needed
                  const splitDate = order.date.split(', ');
                  const niceDate = splitDate.length > 2 ? `${splitDate[1]}` : order.date;

                  const isCanceled = order.status === 'Canceled';
                  const hasAvailableItem = products ? order.items.some((item: any) => {
                    const p = products.find((prod: any) => prod.id === item.product.id);
                    return p && isProductInStock(p) && p.isVisible !== false;
                  }) : false;
                  const showOrderAgain = isCanceled && hasAvailableItem;

                  return (
                    <div key={order.id} className={cn("rounded-3xl p-4 shadow-sm border border-[var(--theme-white)]/50", bgColor)}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[var(--theme-white)] flex items-center justify-center shadow-sm">
                            <Icon size={20} className={iconColor} />
                          </div>
                          <span className="font-bold text-lg text-[var(--theme-black)]">{formatPrice(order.total)}</span>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">{niceDate}</span>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => onViewOrder(order)} className="flex-1 py-3 bg-[var(--theme-white)] border border-gray-100 rounded-2xl text-sm font-medium text-[var(--theme-black)] flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 transition-colors">
                          Details <ArrowRight size={16} />
                        </button>
                        {['Pending', 'Preparing', 'Unreachable'].includes(order.status) && (
                          <button onClick={(e) => { e.stopPropagation(); onAddMoreToOrder(order.id); }} className="flex-1 py-3 bg-[#e8f5e9] border border-[#bbf7d0] rounded-2xl text-sm font-bold text-green-700 flex items-center justify-center gap-2 shadow-sm hover:bg-opacity-90 transition-colors">
                            <Plus size={16} /> Add More
                          </button>
                        )}
                        {showOrderAgain && (
                          <button onClick={(e) => { e.stopPropagation(); onOrderAgain(order); }} className="flex-1 py-3 bg-[var(--theme-primary)] rounded-2xl text-sm font-bold text-[var(--theme-white)] flex items-center justify-center gap-2 shadow-sm hover:bg-[var(--theme-primary-hover)] transition-colors">
                            <Plus size={16} /> Order Again
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {tab === 'cart' && cart.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-[var(--store-bg)] shrink-0" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-500 text-sm font-medium">TOTAL:</span>
              <span className="font-bold text-xl">{formatPrice(total)}</span>
            </div>
            <ActionBtn
              config={websiteSettings?.actionButtons?.checkout || DEFAULT_ACTION_BUTTONS.checkout}
              onClick={onCheckout}
              label="Checkout"
            />
          </div>
        )}
      </div>
      <AnimatePresence>
        {previewImage && (
          <ImagePreviewModal
            src={previewImage}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function DesktopRightSidebar({
  cart,
  orders,
  tab,
  setTab,
  updateQuantity,
  removeFromCart,
  onCheckout,
  onViewOrder,
  onOrderAgain,
  onAddMoreToOrder,
  websiteSettings,
  products
}: any) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { total, itemDiscounts } = React.useMemo(
    () => getCartTotal(cart, websiteSettings?.qtyRules),
    [cart, websiteSettings?.qtyRules]
  );
  const totalQuantity = cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);

  // Smart Discount Message Logic
  const applicableDiscounts = websiteSettings?.discounts?.filter((d: any) => d.status && d.type !== 'coupon') || [];
  let nextDiscountMsg = '';

  if (applicableDiscounts.length > 0) {
    const upcomingDiscounts = applicableDiscounts
      .filter((d: any) => d.conditions.minOrderAmount && d.conditions.minOrderAmount > total)
      .sort((a: any, b: any) => (a.conditions.minOrderAmount || 0) - (b.conditions.minOrderAmount || 0));

    if (upcomingDiscounts.length > 0) {
      const nextD = upcomingDiscounts[0];
      const amountNeeded = (nextD.conditions.minOrderAmount || 0) - total;
      let reward = '';
      if (nextD.type === 'percentage') reward = `${nextD.action.percentage}% OFF`;
      else if (nextD.type === 'fixed') reward = `${formatPrice(nextD.action.fixedAmount || 0)} OFF`;
      else if (nextD.type === 'free_delivery') reward = `Free Delivery`;

      if (reward) {
        nextDiscountMsg = `Add ${formatPrice(amountNeeded)} more to get ${reward}`;
      }
    }
  }

  return (
    <aside className="hidden lg:flex flex-col w-[320px] xl:w-[360px] border-l border-gray-100 bg-[var(--theme-white)] h-screen h-[100dvh] fixed top-0 right-0 z-30 select-none">
      {/* Top Segmented Header */}
      <div className="h-16 lg:h-18 px-4 flex items-center justify-center border-b border-gray-100 shrink-0">
        <div className="flex w-full max-w-[240px] bg-gray-100 rounded-full p-1">
          <button
            onClick={() => setTab('history')}
            className={cn(
              "flex-1 py-1.5 rounded-full text-xs font-bold transition-all text-center",
              tab === 'history'
                ? "bg-[var(--theme-black)] text-[var(--theme-white)] shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            History
          </button>
          <button
            onClick={() => setTab('cart')}
            className={cn(
              "flex-1 py-1.5 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center gap-1.5",
              tab === 'cart'
                ? "bg-[var(--theme-black)] text-[var(--theme-white)] shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            )}
          >
            <span>Cart</span>
            {totalQuantity > 0 && (
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none",
                tab === 'cart'
                  ? "bg-[var(--theme-primary)] text-[var(--theme-white)]"
                  : "bg-gray-200 text-gray-700"
              )}>
                {totalQuantity}
              </span>
            )}
          </button>
        </div>
      </div>

      {tab === 'cart' && nextDiscountMsg && (
        <div className="bg-[var(--theme-primary)]/10 px-4 py-2 text-center text-xs font-medium text-[var(--theme-primary)] border-b border-[var(--theme-primary)]/20 shrink-0">
          ✨ {nextDiscountMsg}
        </div>
      )}

      {/* Main Body */}
      <div className="flex-grow overflow-y-auto p-3 space-y-2.5">
        {tab === 'cart' ? (
          cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
              <ShoppingBag size={48} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item: CartItem) => (
                <MemoizedCartRow
                  key={item.id}
                  item={item}
                  itemDiscount={itemDiscounts[item.id]}
                  onPreview={setPreviewImage}
                  onRemove={removeFromCart}
                  onUpdateQty={updateQuantity}
                  themeStyle="cart"
                />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-2.5">
            {orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                <p className="text-sm font-medium">No order history</p>
              </div>
            ) : (
              [...orders]
                .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
                .map((order: Order) => {
                  let bgColor = 'bg-[#e0f2fe]';
                  let iconColor = 'text-blue-500';
                  let Icon = MoreHorizontal;

                  if (order.status === 'Canceled' || order.status === 'Returned' || order.status === 'Complete Return') {
                    bgColor = 'bg-[#ffe4e6]';
                    iconColor = 'text-red-500';
                    Icon = X;
                  } else if (order.status === 'Completed') {
                    bgColor = 'bg-[#dcfce7]';
                    iconColor = 'text-green-500';
                    Icon = Check;
                  }

                  const splitDate = order.date.split(', ');
                  const niceDate = splitDate.length > 2 ? `${splitDate[1]}` : order.date;

                  const isCanceled = order.status === 'Canceled';
                  const hasAvailableItem = products ? order.items.some((item: any) => {
                    const p = products.find((prod: any) => prod.id === item.product.id);
                    return p && isProductInStock(p) && p.isVisible !== false;
                  }) : false;
                  const showOrderAgain = isCanceled && hasAvailableItem;

                  return (
                    <div key={order.id} className={cn("rounded-2xl p-3.5 shadow-sm border border-[var(--theme-white)]/50", bgColor)}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[var(--theme-white)] flex items-center justify-center shadow-sm shrink-0">
                            <Icon size={16} className={iconColor} />
                          </div>
                          <span className="font-bold text-base text-[var(--theme-black)]">{formatPrice(order.total)}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 font-medium">{niceDate}</span>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <button
                          onClick={() => onViewOrder(order)}
                          className="flex-1 py-2 bg-[var(--theme-white)] border border-gray-100 rounded-xl text-xs font-semibold text-[var(--theme-black)] flex items-center justify-center gap-1.5 shadow-sm hover:bg-gray-50 transition-colors"
                        >
                          Details <ArrowRight size={14} />
                        </button>
                        {['Pending', 'Preparing', 'Unreachable'].includes(order.status) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onAddMoreToOrder(order.id); }}
                            className="flex-1 py-2 bg-[#e8f5e9] border border-[#bbf7d0] rounded-xl text-xs font-bold text-green-700 flex items-center justify-center gap-1.5 shadow-sm hover:bg-opacity-90 transition-colors"
                          >
                            <Plus size={14} /> Add More
                          </button>
                        )}
                        {showOrderAgain && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onOrderAgain(order); }}
                            className="flex-1 py-2 bg-[var(--theme-primary)] rounded-xl text-xs font-bold text-[var(--theme-white)] flex items-center justify-center gap-1.5 shadow-sm hover:bg-[var(--theme-primary-hover)] transition-colors"
                          >
                            <Plus size={14} /> Order Again
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {tab === 'cart' && cart.length > 0 && (
        <div className="p-4 border-t border-gray-100 bg-[var(--theme-white)] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">TOTAL:</span>
            <span className="font-extrabold text-xl text-[var(--theme-black)]">{formatPrice(total)}</span>
          </div>
          <ActionBtn
            config={websiteSettings?.actionButtons?.checkout || DEFAULT_ACTION_BUTTONS.checkout}
            onClick={onCheckout}
            label="Checkout"
          />
        </div>
      )}

      <AnimatePresence>
        {previewImage && (
          <ImagePreviewModal
            src={previewImage}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </AnimatePresence>
    </aside>
  );
}

export function CheckoutModal({ onClose, cart, orders, onPlaceOrder, websiteSettings, updateQuantity, removeFromCart, onSaveIncompleteOrder }: any) {
  useScrollLock(true);
  const [name, setName] = useState(() => localStorage.getItem('checkout_name') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('checkout_phone') || '');
  const [address, setAddress] = useState(() => localStorage.getItem('checkout_address') || '');
  const [customerNote, setCustomerNote] = useState('');
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string>(
    websiteSettings?.deliveryCharges?.[0]?.id || ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('checkout_name', name);
      localStorage.setItem('checkout_phone', phone);
      localStorage.setItem('checkout_address', address);
      localStorage.removeItem('checkout_customer_note');
    }, 300);
    return () => clearTimeout(timer);
  }, [name, phone, address]);

  const lastSavedIncompleteRef = useRef<string>('');
  const timeoutRef = useRef<any>(null);

  const triggerSaveIncompleteOrder = useCallback((p: string, n: string, a: string) => {
    if (success) return;
    const phoneDigits = p.replace(/\D/g, '');
    if (phoneDigits.length < 11) return;
    const cartSignature = Array.isArray(cart) ? cart.map((c: any) => `${c.product?.id || ''}:${c.quantity || 0}:${c.variant || ''}`).join(';') : '';
    const fingerprint = `${phoneDigits}|${(n || '').trim()}|${(a || '').trim()}|${cartSignature}`;
    if (lastSavedIncompleteRef.current === fingerprint) return;
    lastSavedIncompleteRef.current = fingerprint;
    onSaveIncompleteOrder?.(p, n, a);
  }, [cart, onSaveIncompleteOrder, success]);

  useEffect(() => {
    if (success || !websiteSettings?.incompleteOrdersFeature?.enabled) return;

    // Timeout logic for inactivity
    timeoutRef.current = setTimeout(() => {
      triggerSaveIncompleteOrder(phone, name, address);
    }, (websiteSettings.incompleteOrdersFeature.inactivityTimerMinutes || 5) * 60 * 1000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [phone, name, address, success, websiteSettings, triggerSaveIncompleteOrder]);

  const handleClose = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!success && websiteSettings?.incompleteOrdersFeature?.enabled) {
      triggerSaveIncompleteOrder(phone, name, address);
    }
    onClose();
  };

  const { total: subtotal, itemDiscounts } = React.useMemo(
    () => getCartTotal(cart, websiteSettings?.qtyRules),
    [cart, websiteSettings?.qtyRules]
  );
  const totalQuantity = cart.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);
  
  const selectedDelivery = websiteSettings?.deliveryCharges?.find((dc: any) => dc.id === selectedDeliveryId) || websiteSettings?.deliveryCharges?.[0];
  
  // Discount Logic
  const applicableDiscounts = websiteSettings?.discounts?.filter((d: any) => d.status) || [];
  
  const checkDiscountValidity = (d: any) => {
    if (d.conditions.minOrderAmount && subtotal < d.conditions.minOrderAmount) return false;
    if (d.conditions.maxOrderAmount && subtotal > d.conditions.maxOrderAmount) return false;
    if (d.conditions.minQuantity && totalQuantity < d.conditions.minQuantity) return false;
    
    if (d.conditions.location === 'inside_dhaka' && selectedDelivery?.area?.toLowerCase() !== 'inside dhaka') return false;
    if (d.conditions.location === 'outside_dhaka' && selectedDelivery?.area?.toLowerCase() !== 'outside dhaka') return false;
    
    if (d.conditions.firstOrderOnly && orders.length > 0) return false;

    if (d.time?.startDate && new Date() < new Date(d.time.startDate)) return false;
    if (d.time?.endDate && new Date() > new Date(d.time.endDate)) return false;

    if (d.limits?.maxUsageGlobal && (d.limits.currentUsageGlobal || 0) >= d.limits.maxUsageGlobal) return false;

    if (d.conditions.selectedCategories && d.conditions.selectedCategories.length > 0) {
      const hasCategory = cart.some((item: CartItem) => d.conditions.selectedCategories.includes(item.product.category));
      if (!hasCategory) return false;
    }

    if (d.conditions.selectedProducts && d.conditions.selectedProducts.length > 0) {
      const hasProduct = cart.some((item: CartItem) => d.conditions.selectedProducts.includes(item.product.id));
      if (!hasProduct) return false;
    }

    return true;
  };

  let bestDiscount: any = null;
  const autoDiscounts = applicableDiscounts.filter((d: any) => d.type !== 'coupon').sort((a: any, b: any) => b.priority - a.priority);
  for (const d of autoDiscounts) {
    if (checkDiscountValidity(d)) {
      bestDiscount = d;
      break;
    }
  }

  if (appliedCoupon) {
    if (checkDiscountValidity(appliedCoupon)) {
      if (!bestDiscount || appliedCoupon.priority >= bestDiscount.priority) {
        bestDiscount = appliedCoupon;
      }
    } else {
      setAppliedCoupon(null);
      setCouponError('Coupon conditions not met for current cart');
    }
  }

  const hasCouponRules = applicableDiscounts.some((d: any) => d.type === 'coupon');

  const handleApplyCoupon = () => {
    setCouponError('');
    if (!couponCode.trim()) return;
    
    const coupon = applicableDiscounts.find((d: any) => d.type === 'coupon' && d.action.couponCode === couponCode.toUpperCase());
    if (coupon) {
      if (checkDiscountValidity(coupon)) {
        setAppliedCoupon(coupon);
        setCouponCode('');
      } else {
        setCouponError('Coupon conditions not met');
      }
    } else {
      setCouponError('Invalid coupon code');
    }
  };

  let discountAmount = 0;
  let isFreeDelivery = false;

  if (bestDiscount) {
    if (bestDiscount.type === 'percentage' && bestDiscount.action.percentage) {
      discountAmount = Math.round(subtotal * (bestDiscount.action.percentage / 100));
    } else if (bestDiscount.type === 'fixed' && bestDiscount.action.fixedAmount) {
      discountAmount = bestDiscount.action.fixedAmount;
    } else if (bestDiscount.type === 'free_delivery') {
      isFreeDelivery = true;
    } else if (bestDiscount.type === 'buy_x_get_y' && bestDiscount.action.buyX && bestDiscount.action.getY) {
      // Logic: For every X items, get Y cheapest items free
      // We'll simplify: find total eligible items, calculate how many Ys are free
      const eligibleItems = cart.sort((a: any, b: any) => a.product.price - b.product.price);
      const totalEligibleQuantity = eligibleItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
      const freeSets = Math.floor(totalEligibleQuantity / (bestDiscount.action.buyX + bestDiscount.action.getY));
      let freeCount = freeSets * bestDiscount.action.getY;
      
      let saved = 0;
      for (const item of eligibleItems) {
        const take = Math.min(item.quantity, freeCount);
        saved += take * item.product.price;
        freeCount -= take;
        if (freeCount <= 0) break;
      }
      discountAmount = saved;
    } else if (bestDiscount.type === 'coupon') {
      if (bestDiscount.action.percentage) {
        discountAmount = Math.round(subtotal * (bestDiscount.action.percentage / 100));
      } else if (bestDiscount.action.fixedAmount) {
        discountAmount = bestDiscount.action.fixedAmount;
      }
    }
  }

  const deliveryCharge = isFreeDelivery ? 0 : (selectedDelivery ? selectedDelivery.price : 0);
  const total = Math.max(0, subtotal - discountAmount + deliveryCharge);

  // Smart Discount Message Logic
  let nextDiscountMsg = '';
  if (applicableDiscounts.length > 0) {
    const upcomingDiscounts = applicableDiscounts
      .filter((d: any) => d.type !== 'coupon' && d.conditions.minOrderAmount && d.conditions.minOrderAmount > subtotal)
      .sort((a: any, b: any) => (a.conditions.minOrderAmount || 0) - (b.conditions.minOrderAmount || 0));
      
    if (upcomingDiscounts.length > 0) {
      const nextD = upcomingDiscounts[0];
      const amountNeeded = (nextD.conditions.minOrderAmount || 0) - subtotal;
      let reward = '';
      if (nextD.type === 'percentage') reward = `${nextD.action.percentage}% OFF`;
      else if (nextD.type === 'fixed') reward = `${formatPrice(nextD.action.fixedAmount || 0)} OFF`;
      else if (nextD.type === 'free_delivery') reward = `Free Delivery`;
      
      if (reward) {
        nextDiscountMsg = `Add ${formatPrice(amountNeeded)} more to get ${reward}`;
      }
    }
  }

  const handlePlaceOrder = async () => {
    setError(null);
    
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    
    const isValidPhone = (phone.startsWith('01') && phone.length === 11) || 
                         (phone.startsWith('8801') && phone.length === 13) || 
                         (phone.startsWith('+8801') && phone.length === 14);

    if (!isValidPhone) {
      setError('Please provide a valid phone number');
      return;
    }
    
    if (!address.trim()) {
      setError('Please enter your address');
      return;
    }

    // ANTI-SPAM LOGIC
    if (websiteSettings?.antiSpam?.enabled) {
      const antiSpam = websiteSettings.antiSpam;
      const now = Date.now();

      // Check Rate Limit or Device Tracking
      if (antiSpam.rateLimitEnabled || antiSpam.deviceTrackingEnabled) {
        
        let blockUntil = parseInt(localStorage.getItem('antiSpam_blockedUntil') || '0', 10);
        if (now < blockUntil) {
          const remainingMins = Math.ceil((blockUntil - now) / 60000);
          setError(`Too many orders. Please try again in ${remainingMins} minutes.`);
          return;
        }

        // Get logs
        let orderLog: number[] = JSON.parse(localStorage.getItem('antiSpam_orderLog') || '[]');
        // Clean up old entries (older than 24 hours)
        orderLog = orderLog.filter(t => now - t < 24 * 60 * 60 * 1000);

        if (antiSpam.rateLimitEnabled) {
          const shortTermCount = orderLog.filter(t => now - t < (antiSpam.shortTermMinutes || 10) * 60 * 1000).length;
          const hourlyCount = orderLog.filter(t => now - t < 60 * 60 * 1000).length;
          const dailyCount = orderLog.filter(t => now - t < 24 * 60 * 60 * 1000).length;

          if (
            shortTermCount >= (antiSpam.shortTermOrdersCount || 3) ||
            hourlyCount >= (antiSpam.hourlyOrdersCount || 5) ||
            dailyCount >= (antiSpam.dailyOrdersCount || 10)
          ) {
            // Block the user
            const blockDuration = (antiSpam.blockDurationMinutes || 60) * 60 * 1000;
            localStorage.setItem('antiSpam_blockedUntil', (now + blockDuration).toString());
            setError(`Too many orders. Please try again later.`);
            return;
          }
        }

        // If passed, log this order attempt
        orderLog.push(now);
        localStorage.setItem('antiSpam_orderLog', JSON.stringify(orderLog));
      }
    }

    setIsSubmitting(true);
    
    // Generate simple device fingerprint
    const fpData = [
      navigator.userAgent, window.screen.width, window.screen.height, window.screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.language
    ].join('|');
    let hash = 0;
    for (let i = 0; i < fpData.length; i++) {
        const char = fpData.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const deviceId = Math.abs(hash).toString(16);

    let ipAddress = 'unknown';
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const json = await res.json();
      if (json.ip) ipAddress = json.ip;
    } catch(e) {}

    const clientInfo = {
      ipAddress,
      deviceId,
      timestamp: Date.now()
    };

    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate extra network request for UI feel
    setSuccess(true);
    setTimeout(() => {
      onPlaceOrder({ name, phone, address, customerNote, clientInfo }, deliveryCharge, discountAmount, bestDiscount?.name || '', bestDiscount?.id);
    }, 1000);
  };

  const inputBorderRadius = websiteSettings?.actionButtons?.placeOrder?.borderRadius || DEFAULT_ACTION_BUTTONS.placeOrder.borderRadius;

  const orderListElem = (
    <MemoizedCheckoutOrderList
      cart={cart}
      itemDiscounts={itemDiscounts}
      onPreview={setPreviewImage}
      onRemove={removeFromCart}
      onUpdateQty={updateQuantity}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end lg:justify-center lg:items-center bg-[var(--theme-black)]/50 lg:bg-[var(--store-bg)] lg:p-6 lg:overflow-hidden">
      <div className="w-full max-w-md lg:max-w-5xl bg-[var(--store-bg)] lg:bg-transparent h-full lg:h-[calc(100vh-3rem)] lg:max-h-[850px] flex flex-col lg:flex-row lg:gap-6 relative">
        <div className="flex flex-col flex-1 lg:w-3/5 lg:bg-[var(--theme-white)] lg:rounded-2xl lg:overflow-hidden h-full lg:shadow-md lg:border lg:border-gray-100 min-h-0">
          <div className="flex items-center p-2 lg:p-4 bg-[var(--theme-white)] border-b border-gray-100 relative lg:shrink-0 lg:py-5 lg:px-6">
          <div className="flex items-center z-10">
            <button onClick={handleClose} className="p-2 -ml-2 text-gray-600">
              <ArrowLeft size={24} />
            </button>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {websiteSettings?.logoUrl ? (
              <img src={websiteSettings.logoUrl} alt="Logo" className="h-8 object-contain pointer-events-auto" />
            ) : (
              <div className="h-8 pointer-events-auto"></div>
            )}
          </div>
          <div className="w-10 z-10"></div>
        </div>

        {/* Toasts */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 left-4 right-4 z-[120] bg-red-500 text-[var(--theme-white)] px-4 py-3 rounded-xl font-medium shadow-lg flex items-center gap-2"
            >
              <X size={18} />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 left-4 right-4 z-[120] bg-green-500 text-[var(--theme-white)] px-4 py-3 rounded-xl font-medium shadow-lg flex items-center gap-2"
            >
              <Check size={18} />
              <span className="text-sm">Order placed successfully!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {nextDiscountMsg && (
          <div className="bg-[var(--theme-primary)]/10 px-4 py-2 text-center text-sm font-medium text-[var(--theme-primary)] border-b border-[var(--theme-primary)]/20">
            ✨ {nextDiscountMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 p-2.5 lg:p-4 space-y-2.5 lg:space-y-4 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="bg-[var(--theme-white)] rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-[var(--theme-black)] mb-4 flex items-center gap-1">আপনার নাম <span className="text-red-500">*</span></h3>
            <div className="space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User size={18} />
                </div>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => { setName(e.target.value); setError(null); }} 
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-[var(--theme-primary)]/5 border text-sm focus:outline-none focus:ring-2",
                    error && !name.trim() ? "border-red-500 focus:ring-red-200" : "border-[var(--theme-primary)]/20 focus:ring-[var(--theme-primary)]/30"
                  )} 
                  placeholder="Name" 
                  style={{ borderRadius: inputBorderRadius }}
                />
              </div>

              <h3 className="text-sm font-bold text-[var(--theme-black)] mb-1 mt-4 flex items-center gap-1 justify-between">
                <span>মোবাইল নাম্বার <span className="text-red-500">*</span></span>
                <span className={cn("text-xs font-normal", 
                  (phone.startsWith('01') && phone.length === 11) || 
                  (phone.startsWith('8801') && phone.length === 13) || 
                  (phone.startsWith('+8801') && phone.length === 14) 
                    ? "text-green-600 font-medium" 
                    : "text-red-500"
                )}>
                  {phone.length}/{phone.startsWith('+8801') ? 14 : phone.startsWith('8801') ? 13 : 11}
                </span>
              </h3>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Phone size={18} />
                </div>
                <input 
                  type="tel" 
                  value={phone} 
                  onChange={e => { 
                    let val = e.target.value;
                    if (val.startsWith('+')) {
                      val = '+' + val.substring(1).replace(/\D/g, '');
                    } else {
                      val = val.replace(/\D/g, '');
                    }
                    if (val.startsWith('01')) val = val.substring(0, 11);
                    else if (val.startsWith('8801')) val = val.substring(0, 13);
                    else if (val.startsWith('+8801')) val = val.substring(0, 14);
                    else val = val.substring(0, 14);
                    
                    setPhone(val); 
                    setError(null); 
                  }} 
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-[var(--theme-primary)]/5 border text-sm focus:outline-none focus:ring-2 transition-all",
                    phone.length > 0
                      ? ((phone.startsWith('01') && phone.length === 11) || 
                         (phone.startsWith('8801') && phone.length === 13) || 
                         (phone.startsWith('+8801') && phone.length === 14))
                        ? "border-green-500 ring-2 ring-green-100"
                        : "border-red-500 ring-1 ring-red-100 focus:ring-red-200"
                      : error ? "border-red-500 focus:ring-red-200" : "border-[var(--theme-primary)]/20 focus:ring-[var(--theme-primary)]/30"
                  )} 
                  placeholder="Phone" 
                  style={{ borderRadius: inputBorderRadius }}
                />
              </div>

              <h3 className="text-sm font-bold text-[var(--theme-black)] mb-1 mt-4 flex items-center gap-1">আপনার ঠিকানা <span className="text-red-500">*</span></h3>
              <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none text-gray-400">
                  <MapPin size={18} />
                </div>
                <textarea 
                  value={address} 
                  onChange={e => { setAddress(e.target.value); setError(null); }} 
                  rows={3} 
                  className={cn(
                    "w-full pl-10 pr-4 py-3 bg-[var(--theme-primary)]/5 border rounded-xl text-sm focus:outline-none focus:ring-2 resize-none",
                    error && !address.trim() ? "border-red-500 focus:ring-red-200" : "border-[var(--theme-primary)]/20 focus:ring-[var(--theme-primary)]/30"
                  )} 
                  placeholder="Address"
                ></textarea>
              </div>

              <h3 className="text-sm font-bold text-[var(--theme-black)] mb-1 mt-4 flex items-center gap-1">Customer Note <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span></h3>
              <div className="relative">
                <input 
                  type="text"
                  value={customerNote} 
                  onChange={e => setCustomerNote(e.target.value)} 
                  className="w-full px-4 py-3 bg-[var(--theme-primary)]/5 border border-[var(--theme-primary)]/20 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/30 transition-all"
                  style={{ borderRadius: inputBorderRadius }}
                />
              </div>
            </div>
          </div>

          {/* Coupon Input */}
          {(hasCouponRules || appliedCoupon) && (
            <div className="bg-[var(--theme-white)] rounded-2xl p-4 shadow-sm border border-gray-100">
              <h3 className="text-sm font-bold text-[var(--theme-black)] mb-3 flex items-center gap-2">
                <BadgePercent size={18} className="text-[var(--theme-primary)]" /> Apply Coupon
              </h3>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={couponCode}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="Enter code"
                  style={{ borderRadius: (websiteSettings?.actionButtons?.placeOrder?.borderRadius || '50px') }}
                  className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--theme-primary)]/30 uppercase"
                />
                <button 
                  onClick={handleApplyCoupon}
                  style={{ borderRadius: (websiteSettings?.actionButtons?.placeOrder?.borderRadius || '50px') }}
                  className="px-4 py-2.5 bg-[var(--theme-primary)] text-[var(--theme-white)] text-sm font-medium hover:bg-[var(--theme-primary-hover)] transition-colors"
                >
                  Apply
                </button>
              </div>
              {couponError && <p className="text-red-500 text-xs mt-2">{couponError}</p>}
              {appliedCoupon && (
                <div className="mt-3 p-2.5 bg-green-50 border border-green-100 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                    <Check size={16} /> Coupon applied!
                  </div>
                  <button onClick={() => setAppliedCoupon(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-[var(--theme-white)] rounded-2xl p-4 shadow-sm border border-gray-100">
            <h3 className="text-sm font-bold text-[var(--theme-black)] mb-3 flex items-center gap-2">
              <Truck size={18} className="text-[var(--theme-primary)]" /> Delivery Charge
            </h3>
            {isFreeDelivery ? (
              <div className="flex items-center justify-between p-3 border border-green-200 bg-green-50" style={{ borderRadius: inputBorderRadius }}>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check size={12} className="text-[var(--theme-white)]" />
                  </div>
                  <span className="text-sm font-medium text-green-800">Free Delivery</span>
                </div>
                <span className="font-bold text-sm text-green-600">FREE</span>
              </div>
            ) : (
              <div className="space-y-2">
                {websiteSettings?.deliveryCharges?.map((dc: any) => (
                  <label 
                    key={dc.id}
                    onClick={() => setSelectedDeliveryId(dc.id)} 
                    className={cn(
                      "flex items-center justify-between p-3 border cursor-pointer transition-colors", 
                      selectedDeliveryId === dc.id ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]/5" : "border-gray-200"
                    )}
                    style={{ borderRadius: inputBorderRadius }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("w-5 h-5 rounded-full border flex items-center justify-center", selectedDeliveryId === dc.id ? "border-[var(--theme-primary)] bg-[var(--theme-primary)]" : "border-gray-300")}>
                        {selectedDeliveryId === dc.id && <Check size={12} className="text-[var(--theme-white)]" />}
                      </div>
                      <span className="text-sm font-medium text-[var(--theme-black)]">{dc.area} <span className="text-gray-400 font-normal">({dc.time})</span></span>
                    </div>
                    <span className="font-bold text-sm">{formatPrice(dc.price)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[var(--theme-white)] rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2 lg:space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-[var(--theme-black)]">Product Total</span>
              <span className="font-bold">{formatPrice(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="font-medium flex items-center gap-1">
                  Discount {bestDiscount?.name ? `(${bestDiscount.name})` : ''}
                </span>
                <span className="font-bold">-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="font-medium text-[var(--theme-black)]">Delivery Charge</span>
              <span className="font-bold">
                {isFreeDelivery ? (
                  <span className="text-green-600">{formatPrice(0)} (Free)</span>
                ) : (
                  formatPrice(deliveryCharge)
                )}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between">
              <span className="font-bold text-[var(--theme-black)]">Final Total</span>
              <span className="font-bold text-[var(--theme-primary)] text-lg">{formatPrice(total)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="mt-2 text-center text-xs font-medium text-green-600 bg-green-50 py-1.5 rounded-lg">
                🎉 You saved {formatPrice(discountAmount + (isFreeDelivery && selectedDelivery ? selectedDelivery.price : 0))} on this order!
              </div>
            )}
          </div>

          <div className="lg:hidden">
            {orderListElem}
          </div>
        </div>

        <div className="p-4 bg-[var(--theme-white)] border-t border-gray-100 shrink-0 lg:rounded-b-2xl" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          {isSubmitting ? (
            <button 
              disabled 
              style={{
                background: 'var(--theme-primary-gradient)',
                boxShadow: 'var(--theme-primary-shadow)',
              }}
              className="w-full h-[48px] text-[var(--theme-white)] rounded-full font-medium flex items-center justify-center opacity-70"
            >
              <RefreshCw size={18} className="animate-spin" />
            </button>
          ) : (
            <ActionBtn
              config={websiteSettings?.actionButtons?.placeOrder || DEFAULT_ACTION_BUTTONS.placeOrder}
              onClick={handlePlaceOrder}
              label="Place Order"
            />
          )}
        </div>
      </div>
      
      <div className="hidden lg:flex flex-col lg:w-[45%] h-full bg-[var(--theme-white)] rounded-2xl overflow-hidden shadow-md border border-gray-100 p-4">
        {orderListElem}
      </div>
    </div>
      <AnimatePresence>
        {previewImage && (
          <ImagePreviewModal
            src={previewImage}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export function OrderDetailsModal({ order, products, websiteSettings, onClose, onCancelOrder, onUpdateOrder, onOrderAgain }: any) {
  useScrollLock(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editedUser, setEditedUser] = useState(order.userInfo);
  const [editedItems, setEditedItems] = useState(order.items);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Track changes to know if we show Confirm button
  const hasUserChanges = JSON.stringify(editedUser) !== JSON.stringify(order.userInfo);
  const hasItemChanges = JSON.stringify(editedItems) !== JSON.stringify(order.items);
  const hasChanges = hasUserChanges || hasItemChanges;

  const canEdit = ['Pending', 'Unreachable', 'Preparing'].includes(order.status);
  const canCancel = order.status === 'Pending' || order.status === 'Preparing';

  const isCanceled = order.status === 'Canceled';
  const hasAvailableItem = products ? order.items.some((item: any) => {
    const p = products.find((prod: any) => prod.id === item.product.id);
    return p && isProductInStock(p) && p.isVisible !== false;
  }) : false;
  const showOrderAgain = isCanceled && hasAvailableItem;

  const handleUpdateQuantity = (itemId: string, delta: number, isDirect: boolean = false) => {
    if (!canEdit) return;
    
    setEditedItems((prev: any) => prev.map((item: any) => {
      if (item.id === itemId) {
        let newQty = isDirect ? delta : item.quantity + delta;
        newQty = isDirect ? Math.max(0, newQty) : Math.max(1, newQty);
        if (isNaN(newQty)) newQty = isDirect ? 0 : 1;
        
        // Find current product to check stock properly
        const currentProduct = products.find((p: Product) => p.id === item.product.id);
        const originalItem = order.items.find((i: CartItem) => i.id === itemId);
        const originalQty = originalItem ? originalItem.quantity : 0;
        
        if (currentProduct && currentProduct.stock !== undefined && currentProduct.stock !== null) {
           const maxAllowed = originalQty + Number(currentProduct.stock);
           if (newQty > maxAllowed) {
              newQty = maxAllowed;
           }
        }
        
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const { total: currentSubtotal, itemDiscounts } = React.useMemo(
    () => getCartTotal(editedItems, websiteSettings?.qtyRules),
    [editedItems, websiteSettings?.qtyRules]
  );
  let currentDiscount = order.discount;
  if (order.discountName && order.discount > 0 && order.subtotal > 0) {
    currentDiscount = Math.min(order.discount, currentSubtotal);
  }
  const currentTotal = Math.max(0, currentSubtotal - currentDiscount + order.deliveryCharge);

  const handleConfirmChanges = () => {
    const updatedOrder = {
      ...order,
      subtotal: currentSubtotal,
      total: currentTotal,
      discount: currentDiscount,
      items: editedItems,
      userInfo: editedUser
    };
    
    const stockChanges = editedItems.map((item: any) => {
       const originalItem = order.items.find((i: any) => i.id === item.id);
       const originalQty = originalItem ? originalItem.quantity : 0;
       const delta = originalQty - item.quantity;
       return { productId: item.product.id, variantId: item.variantId, product: item.product, delta };
    }).filter((c: any) => c.delta !== 0);

    onUpdateOrder(updatedOrder, stockChanges);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--theme-black)]/50 p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md bg-[var(--theme-white)] rounded-2xl overflow-hidden flex flex-col max-h-[90vh] relative">
        <div className="flex items-center justify-between p-4 bg-[var(--theme-white)] border-b border-gray-100">
          <h2 className="font-bold text-lg flex items-center gap-2">
            Order ID #{order.id} <CopyButton text={order.id} />
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-2 bg-[var(--theme-white)] text-xs text-gray-500 text-center border-b border-gray-100">
          {order.date}
        </div>

        <div className={cn("flex-grow overflow-y-auto p-4 space-y-1 lg:space-y-4", hasChanges ? "pb-24" : "")}>
          <div className="bg-[var(--theme-white)] rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-100 relative">
              <span className="font-bold text-sm text-[var(--theme-black)]">User info</span>
              {canEdit ? (
                <button 
                  onClick={() => setIsEditingUser(!isEditingUser)} 
                  className={cn("p-1.5 rounded-full transition-colors", isEditingUser ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:bg-gray-200")}
                >
                  {isEditingUser ? <Check size={14} /> : <Edit3 size={14} />}
                </button>
              ) : (
                <ChevronUp size={16} className="text-gray-500" />
              )}
            </div>
            <div className="p-3 space-y-2 text-sm">
              {isEditingUser ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 font-medium">Name</span>
                    <input 
                      type="text" 
                      value={editedUser.name} 
                      onChange={e => setEditedUser({...editedUser, name: e.target.value})}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm w-full outline-none focus:border-blue-300"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 font-medium">Phone</span>
                    <input 
                      type="tel" 
                      value={editedUser.phone} 
                      onChange={e => setEditedUser({...editedUser, phone: e.target.value})}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm w-full outline-none focus:border-blue-300"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 font-medium">Address</span>
                    <textarea 
                      value={editedUser.address} 
                      onChange={e => setEditedUser({...editedUser, address: e.target.value})}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm w-full outline-none focus:border-blue-300 resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-gray-500 font-medium">Customer Note</span>
                    <input 
                      type="text"
                      value={editedUser.customerNote || ''} 
                      onChange={e => setEditedUser({...editedUser, customerNote: e.target.value})}
                      className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm w-full outline-none focus:border-blue-300"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex"><span className="w-24 text-gray-500">Name</span><span className="font-medium">{editedUser.name}</span></div>
                  <div className="flex"><span className="w-24 text-gray-500">Phone</span><span className="font-medium">{editedUser.phone}</span></div>
                  <div className="flex"><span className="w-24 text-gray-500">Address</span><span className="font-medium line-clamp-3">{editedUser.address}</span></div>
                  {editedUser.customerNote && (
                    <div className="mt-3 p-3 bg-[var(--theme-primary)]/5 border border-[var(--theme-primary)]/20 rounded-lg flex flex-col gap-1.5 shadow-sm">
                      <div className="flex items-center gap-1.5 text-[var(--theme-primary)]">
                        <MessageSquareText size={16} />
                        <span className="text-xs font-bold uppercase tracking-wider">Customer Note</span>
                      </div>
                      <p className="text-sm font-medium text-[var(--theme-black)] break-words w-full">
                        "{editedUser.customerNote}"
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="bg-[var(--theme-white)] rounded-xl border border-gray-100 p-6 flex justify-between relative w-full overflow-hidden">
            <div className="absolute top-10 left-[12%] right-[12%] h-1 bg-gray-100 -z-10"></div>
            {(() => {
              const steps = ['Pending', 'Preparing', 'Shipping', 'Completed'];
              
              const stepIcons: Record<string, React.ElementType> = {
                'Pending': MoreHorizontal,
                'Preparing': RefreshCw,
                'Shipping': Truck,
                'Completed': Star
              };

              let currentIndex = steps.indexOf(order.status);
              if (currentIndex === -1) currentIndex = 0; 
              
              return (
                <>
                  <div 
                    className="absolute top-10 left-[12%] h-1 bg-[#2563eb] -z-10 transition-all duration-500" 
                    style={{ width: `${(currentIndex / 3) * 76}%` }} // Approximate 76% spans from first to last icon centers
                  ></div>
                  
                  {steps.map((step, idx) => {
                    const isCompleted = idx <= currentIndex;
                    const Icon = stepIcons[step];
                    
                    return (
                      <div key={step} className="flex flex-col items-center gap-2 relative z-10 w-1/4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center border-4 border-[var(--theme-white)] shadow-[0_0_0_1px_rgba(0,0,0,0.05)] transition-colors", 
                          isCompleted ? "bg-[#2563eb] text-[var(--theme-white)] outline outline-2 outline-offset-1 outline-blue-100" : "bg-gray-50 text-gray-400"
                        )}>
                          <Icon size={20} strokeWidth={isCompleted ? 3 : 2} />
                        </div>
                        <span className={cn(
                          "text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap", 
                          isCompleted ? "text-[var(--theme-black)]" : "text-gray-400"
                        )}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>

          <div className="bg-[var(--theme-white)] rounded-xl border border-gray-100 p-4 space-y-1 lg:space-y-3">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-[var(--theme-black)]">Subtotal</span>
              <span className="font-bold">{formatPrice(currentSubtotal)}</span>
            </div>
            {currentDiscount !== undefined && currentDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="font-medium flex items-center gap-1">
                  Discount {order.discountName ? `(${order.discountName})` : ''}
                </span>
                <span className="font-bold">-{formatPrice(currentDiscount || 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="font-medium text-[var(--theme-black)]">Delivery Charge</span>
              <span className="font-bold">+ {formatPrice(order.deliveryCharge)}</span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between">
              <span className="font-bold text-[var(--theme-black)]">Total</span>
              <span className="font-bold text-[var(--theme-primary)] text-lg">{formatPrice(currentTotal)}</span>
            </div>
          </div>

          {(() => {
            return (
              <div className="flex gap-3">
                {canCancel ? (
                  <button 
                    onClick={() => setShowCancelConfirm(true)}
                    className="flex-1 h-[44px] px-4 text-sm font-semibold rounded-full bg-[var(--theme-white)] border border-red-200 text-red-500 flex items-center justify-center gap-1.5 hover:bg-red-50 transition-colors whitespace-nowrap"
                  >
                    <Trash2 size={16} /> Cancel
                  </button>
                ) : showOrderAgain ? (
                  <button 
                    onClick={() => onOrderAgain && onOrderAgain(order)}
                    className="flex-1 h-[44px] px-4 text-sm font-semibold rounded-full bg-[var(--theme-primary)] text-[var(--theme-white)] flex items-center justify-center gap-1.5 hover:bg-[var(--theme-primary-hover)] transition-colors whitespace-nowrap"
                  >
                    <Plus size={16} /> Order Again
                  </button>
                ) : !isCanceled ? (
                  <button 
                    disabled
                    className="flex-1 h-[44px] px-4 text-sm font-semibold rounded-full bg-gray-100 border border-gray-200 text-gray-400 flex items-center justify-center gap-1.5 cursor-not-allowed whitespace-nowrap"
                  >
                    <Trash2 size={16} /> Cancel
                  </button>
                ) : null}
                {!isCanceled && (
                  <div className="relative flex-1">
                    <button 
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      className="w-full h-[44px] px-4 text-sm font-semibold rounded-full bg-[var(--theme-primary)] text-[var(--theme-white)] flex items-center justify-center gap-1.5 hover:bg-[var(--theme-primary-hover)] transition-colors whitespace-nowrap"
                    >
                      <Download size={16} /> Download Receipt
                    </button>
                    <AnimatePresence>
                  {showDownloadMenu && (
                    <motion.div 
                      className="absolute bottom-full mb-3 left-0 right-0 bg-[var(--theme-white)] shadow-[0_4px_24px_rgba(0,0,0,0.15)] rounded-2xl overflow-hidden border border-gray-100 z-50 p-2 space-y-2 origin-bottom"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, type: 'spring', bounce: 0 }}
                    >
                      <button 
                        onClick={() => {
                           setShowDownloadMenu(false);
                           if (receiptRef.current) downloadReceiptAsJPG(receiptRef.current, order.id);
                        }}
                        className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 font-bold text-[var(--theme-black)] rounded-xl transition-colors border border-gray-200 shadow-sm flex items-center justify-between"
                      >
                        Download as JPG
                        <Download size={16} className="text-gray-400" />
                      </button>
                      <button 
                        onClick={() => {
                           setShowDownloadMenu(false);
                           if (receiptRef.current) downloadReceiptAsPDF(receiptRef.current, order.id);
                        }}
                        className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 font-bold text-[var(--theme-black)] rounded-xl transition-colors border border-gray-200 shadow-sm flex items-center justify-between"
                      >
                        Download as PDF
                        <Download size={16} className="text-gray-400" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
          );
          })()}
          
          {!canCancel && order.status !== 'Canceled' && order.status !== 'Returned' && order.status !== 'Complete Return' && order.status !== 'Unreachable' && (
            <p className="text-xs text-center text-gray-500 mt-2">Orders cannot be canceled once shipping has started.</p>
          )}

          <div className="space-y-1 lg:space-y-3 mt-4">
            {editedItems.map((item: CartItem) => (
              <div key={item.id} className="flex gap-3 p-3 bg-[var(--theme-white)] border border-gray-100 rounded-xl">
                <motion.img 
                  whileTap={{ scale: 0.95 }}
                  src={item.product.thumbnail || item.product.image} 
                  className="w-16 h-16 rounded-lg object-cover cursor-pointer" 
                  onClick={() => setPreviewImage(item.product.thumbnail || item.product.image)}
                />
                <div className="flex-grow flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-[var(--theme-black)] line-clamp-2 h-[2.5rem] leading-[1.25rem]">{item.product.title}</h4>
                    <div className="flex gap-2 flex-wrap">
                      {item.color && <span className="text-[10px] font-bold text-[var(--theme-primary)] bg-[var(--theme-primary)]/10 px-2 py-0.5 rounded uppercase mt-1 inline-block">{item.color}</span>}
                      {item.variantName && <span className="text-[10px] font-bold text-[var(--theme-primary)] bg-[var(--theme-primary)]/10 px-2 py-0.5 rounded uppercase mt-1 inline-block">{item.variantName}</span>}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    {canEdit ? (
                      <div className="flex items-center border border-gray-200 rounded-full h-8 bg-[var(--theme-white)] overflow-hidden shadow-sm">
                        <button onClick={() => handleUpdateQuantity(item.id, -1)} className="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-[var(--theme-primary)] transition-colors">
                          <Minus size={14} />
                        </button>
                        <input 
                          type="number"
                          value={item.quantity === 0 ? '' : (item.quantity || '')}
                          className="w-8 text-center text-sm font-bold text-[var(--theme-black)] border-none outline-none focus:outline-none focus:ring-0 bg-transparent p-0 m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          onChange={(e) => {
                             const val = e.target.value;
                             if (val === '') {
                               handleUpdateQuantity(item.id, 0, true);
                               return;
                             }
                             const num = parseInt(val);
                             if (!isNaN(num)) {
                               handleUpdateQuantity(item.id, num, true);
                             }
                          }}
                          onBlur={(e) => {
                             const val = parseInt(e.target.value);
                             if (isNaN(val) || val < 1) handleUpdateQuantity(item.id, 1, true);
                          }}
                        />
                        <button onClick={() => handleUpdateQuantity(item.id, 1)} className="w-8 h-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-[var(--theme-primary)] transition-colors">
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <span className="font-medium text-sm text-gray-500">
                        {itemDiscounts[item.id] ? (
                           <>
                             <span className="line-through mr-1 text-xs">{formatPrice(item.variantPrice ?? item.product.price)}</span>
                             <span className="text-[var(--theme-black)] font-bold">{formatPrice(Math.max(0, (item.variantPrice ?? item.product.price) - itemDiscounts[item.id]))}</span>
                           </>
                        ) : (
                           formatPrice(item.variantPrice ?? item.product.price)
                        )}
                        <span> x {item.quantity} pc</span>
                      </span>
                    )}
                    <span className="font-bold text-sm text-[var(--theme-black)]">{formatPrice(Math.max(0, (item.variantPrice ?? item.product.price) - (itemDiscounts[item.id] || 0)) * item.quantity)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {hasChanges && (
          <div className="absolute bottom-4 left-4 right-4 z-50">
            <button 
              onClick={handleConfirmChanges}
              className="w-full h-[48px] px-4 bg-[#f6f5f3]/95 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.25)] border border-[var(--theme-black)]/[0.1] rounded-[50px] flex justify-between items-center text-[var(--theme-black)] hover:bg-[#ebe8e3] transition-colors"
              style={{ WebkitBackdropFilter: "blur(12px)" }}
            >
              <div className="flex items-center justify-center bg-transparent">
                <ShoppingBag size={20} strokeWidth={1.5} />
              </div>
              <span className="font-medium flex-1 text-center">Confirm changes</span>
              <span className="font-bold text-[15px]">{formatPrice(currentTotal)}</span>
            </button>
          </div>
        )}
      </motion.div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--theme-black)]/50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-[var(--theme-white)] rounded-2xl p-6 max-w-sm w-full shadow-xl"
            >
              <h3 className="text-lg font-bold text-[var(--theme-black)] mb-2">Cancel Order</h3>
              <p className="text-gray-600 mb-6">Are you sure you want to cancel this order?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  No, keep it
                </button>
                <button 
                  onClick={() => {
                    onCancelOrder(order.id);
                    setShowCancelConfirm(false);
                  }}
                  className="flex-1 py-2.5 bg-red-500 text-[var(--theme-white)] font-bold rounded-xl hover:bg-red-600 transition-colors"
                >
                  Yes, cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewImage && (
          <ImagePreviewModal
            src={previewImage}
            onClose={() => setPreviewImage(null)}
          />
        )}
      </AnimatePresence>

      <Receipt ref={receiptRef} order={order} settings={websiteSettings} />
    </div>
  );
}

export function ThankYouModal({ order, onClose, onViewDetails }: { order: Order, onClose: () => void, onViewDetails: (order: Order) => void }) {
  useScrollLock(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--theme-black)]/50 p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="w-full max-w-md bg-[var(--theme-white)] rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 flex flex-col items-center text-center bg-[var(--theme-white)] border-b border-gray-100 relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-5 shadow-sm border border-green-100">
            <Check size={40} strokeWidth={3} />
          </div>
          <h2 className="text-2xl font-bold text-[var(--theme-black)] mb-2">Thank you for your order!</h2>
          <p className="text-gray-500 text-sm mb-5">Your order has been placed successfully.</p>
          <div className="px-5 py-2.5 bg-gray-50 rounded-full text-sm font-bold text-gray-700 border border-gray-100 flex items-center justify-center gap-2">
            Order ID: #{order.id} <CopyButton text={order.id} />
          </div>
        </div>

        <div className="p-5 space-y-1 lg:space-y-4 flex-grow overflow-y-auto">
          {/* Order Summary */}
          <div className="bg-[var(--theme-white)] rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--theme-black)] mb-4 flex items-center gap-2">
              <ShoppingBag size={16} className="text-[var(--theme-primary)]" /> Order Summary
            </h3>
            <div className="space-y-1 lg:space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{formatPrice(order.subtotal)}</span></div>
              {order.discount !== undefined && order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span className="font-medium">Discount {order.discountName ? `(${order.discountName})` : ''}</span>
                  <span className="font-bold">-{formatPrice(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-gray-500">Delivery Charge</span><span className="font-medium">{formatPrice(order.deliveryCharge)}</span></div>
              <div className="pt-3 border-t border-gray-100 flex justify-between"><span className="font-bold text-[var(--theme-black)]">Total</span><span className="font-bold text-[var(--theme-primary)] text-base">{formatPrice(order.total)}</span></div>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="bg-[var(--theme-white)] rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-bold text-[var(--theme-black)] mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-[var(--theme-primary)]" /> Delivery Information
            </h3>
            <div className="space-y-1 lg:space-y-3 text-sm">
              <div className="flex"><span className="w-20 text-gray-500">Name</span><span className="font-medium text-[var(--theme-black)]">{order.userInfo.name}</span></div>
              <div className="flex"><span className="w-20 text-gray-500">Phone</span><span className="font-medium text-[var(--theme-black)]">{order.userInfo.phone}</span></div>
              <div className="flex"><span className="w-20 text-gray-500">Address</span><span className="font-medium text-[var(--theme-black)] leading-tight">{order.userInfo.address}</span></div>
            </div>
          </div>
        </div>

        <div className="p-5 bg-[var(--theme-white)] border-t border-gray-100 flex flex-col gap-3">
          <button onClick={() => onViewDetails(order)} className="w-full py-4 bg-[var(--theme-primary)] text-[var(--theme-white)] rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-[var(--theme-primary-hover)] transition-colors shadow-md">
            View Order Details <ArrowRight size={18} />
          </button>
          <button onClick={onClose} className="w-full py-4 bg-[var(--theme-white)] border-2 border-gray-100 text-gray-700 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
            Go to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function ImagePreviewModal({ src, onClose }: { src: string, onClose: () => void }) {
  useScrollLock(true);
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-[var(--theme-black)]/90 p-4 sm:p-8" 
      onClick={onClose}
    >
      <button 
        onClick={onClose} 
        className="fixed top-5 right-5 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white bg-[#09090b]/80 hover:bg-[#09090b] rounded-full backdrop-blur-md transition-all z-[310] border border-white/10 shadow-2xl hover:scale-105 active:scale-95"
      >
        <X size={22} strokeWidth={2} />
      </button>

      <div className="relative max-w-full max-h-full flex items-center justify-center pointer-events-none">
        <motion.img 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }} 
          exit={{ scale: 0.9, opacity: 0 }} 
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          src={src} 
          alt="Preview" 
          className="max-w-full max-h-[85vh] object-contain rounded-xl cursor-grab active:cursor-grabbing pointer-events-auto bg-transparent border border-white/5"
          onClick={(e) => e.stopPropagation()}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.8}
          onDragEnd={(e, { offset, velocity }) => {
            if (offset.y > 150 || offset.y < -150 || velocity.y > 500 || velocity.y < -500) {
              onClose();
            }
          }}
        />
      </div>
    </motion.div>
  );
}

