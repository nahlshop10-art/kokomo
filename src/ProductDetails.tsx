import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Menu, Search, ShoppingBag, ChevronLeft, ChevronRight, 
  Trash2, Plus, Minus, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatPrice } from './lib/utils';
import { isProductInStock } from './lib/stockUtils';
import { Product, CartItem, WebsiteSettings, DEFAULT_ACTION_BUTTONS } from './types';
import { CopyButton } from './components/CopyButton';
import ActionBtn from './components/ActionBtn';
import { useScrollLock } from './hooks/useScrollLock';

interface ProductDetailsProps {
  key?: React.Key;
  product: Product;
  products?: Product[];
  onBack: () => void;
  cart: CartItem[];
  addToCart: (product: Product, color?: any, variantId?: string, quantity?: number, variantName?: string, variantPrice?: number, variantBuyPrice?: number) => void;
  updateQuantity: (cartItemId: string, delta: number, isDelta?: boolean) => void;
  removeFromCart: (cartItemId: string) => void;
  onViewCart: () => void;
  onSearch: () => void;
  onMenu: () => void;
  websiteSettings?: WebsiteSettings;
  isAddingToOrder?: boolean;
  cancelAddingToOrder?: () => void;
  onAddToOrder?: (product: Product, color?: any, variantId?: string, quantity?: number, variantName?: string, variantPrice?: number, variantBuyPrice?: number) => void;
  onProductSelect?: (product: Product) => void;
}

export default function ProductDetails({ 
  product, products = [], onBack, cart, addToCart, updateQuantity, removeFromCart, onViewCart, onSearch, onMenu, websiteSettings, isAddingToOrder, cancelAddingToOrder, onAddToOrder, onProductSelect
}: ProductDetailsProps) {

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
    if (product.variants && product.variants.length > 0) {
      const firstAvailable = product.variants.find(v => v.stock === undefined || v.stock === null || Number(v.stock) > 0);
      if (firstAvailable) return { ...firstAvailable.options };
    }
    const initial: Record<string, string> = {};
    if (product.options) {
      product.options.forEach(opt => {
        initial[opt.id] = opt.values[0];
      });
    }
    return initial;
  });

  const availableOptionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (product.options && product.variants) {
      product.options.forEach(opt => {
        map[opt.id] = opt.values.filter(val => {
          return product.variants!.some(v => {
            if (v.options[opt.id] !== val) return false;
            for (const [otherOptId, selectedVal] of Object.entries(selectedOptions)) {
               if (otherOptId !== opt.id && selectedVal && v.options[otherOptId]) {
                  if (v.options[otherOptId] !== selectedVal) return false;
               }
            }
            if (v.stock !== undefined && v.stock !== null && Number(v.stock) <= 0) return false;
            return true;
          });
        });
      });
    }
    return map;
  }, [product.options, product.variants, selectedOptions]);

  const selectedVariant = useMemo(() => {
    if (!product.variants) return null;
    return product.variants.find(v => {
      return Object.entries(selectedOptions).every(([optionId, value]) => v.options[optionId] === value);
    });
  }, [product.variants, selectedOptions]);

  const handleOptionSelect = (optionId: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionId]: value
    }));
  };

  const displayPrice = selectedVariant?.price ?? product.price;
  const stock = selectedVariant?.stock ?? product.stock ?? 0;
  const isOutOfStock = stock <= 0;

  // Use product.images if available, otherwise fallback to an array with just the main image
  const defaultImages = product.images && product.images.length > 0 ? product.images : [product.image];
  const images = useMemo(() => {
    if (selectedVariant?.image) {
      // Put variant specific image at the beginning of the gallery
      return [selectedVariant.image, ...defaultImages.filter(img => img !== selectedVariant.image)];
    }
    return defaultImages;
  }, [selectedVariant, defaultImages]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  useScrollLock(isFullScreen);

  // Swipe handling state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) nextImage();
    if (isRightSwipe) prevImage();
  };

  // Find if this product is in the cart
  const cartItem = cart.find(item => {
    if (item.product.id !== product.id) return false;
    if (selectedVariant && item.variantId !== selectedVariant.id) return false;
    return true;
  });
  const cartQuantity = cartItem ? cartItem.quantity : 0;
  const cartTotalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotalPrice = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    let variantName;
    if (selectedVariant) {
      variantName = Object.values(selectedVariant.options || {}).map(v => String(v).toUpperCase()).join(" / ");
    }
    
    addToCart(product, undefined, selectedVariant?.id, 1, variantName, selectedVariant?.price, selectedVariant?.buyPrice);
  };

  const handleIncrement = () => {
    if (cartItem) updateQuantity(cartItem.id, 1);
  };

  const handleDecrement = () => {
    if (cartItem) {
      if (cartItem.quantity > 1) {
        updateQuantity(cartItem.id, -1);
      } else {
        removeFromCart(cartItem.id);
      }
    }
  };

  const handleRemove = () => {
    if (cartItem) removeFromCart(cartItem.id);
  };

  // (useScrollLock hooked above handles body scroll locking)

  // Reset when product changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setCurrentImageIndex(0);
    setVisibleSimilarLimit(4);
  }, [product.id]);

  const [visibleSimilarLimit, setVisibleSimilarLimit] = useState(4);
  const { similar, isFallback } = useMemo(() => {
    if (!products.length) return { similar: [], isFallback: false };
    
    const stopWords = new Set(['the', 'is', 'in', 'and', 'or', 'with', 'for', 'a', 'an', 'of', 'to', 'on']);
    const getTokens = (text: string) => text.toLowerCase().split(/[\s,.-]+/).filter(t => t.length > 2 && !stopWords.has(t));
    
    const targetTitleTokens = getTokens(product.title);
    const targetDescTokens = getTokens(product.description || '');
    
    let scoredProducts = products.filter(p => p.id !== product.id && p.isVisible !== false && (isProductInStock(p))).map(p => {
      let score = 0;
      let matchedKeyword = '';
      
      const pTitleTokens = getTokens(p.title);
      const pDescTokens = getTokens(p.description || '');
      
      let titleMatches = [];
      pTitleTokens.forEach(t => {
        if (targetTitleTokens.includes(t)) titleMatches.push(t);
      });
      score += titleMatches.length * 10;
      
      if (titleMatches.length > 0) {
        matchedKeyword = titleMatches[0];
      }
      
      if (p.category?.trim()?.toLowerCase() === product.category?.trim()?.toLowerCase()) {
        score += 5;
        if (!matchedKeyword) matchedKeyword = p.category;
      }
      
      let descMatches = [];
      pDescTokens.forEach(t => {
        if (targetDescTokens.includes(t)) descMatches.push(t);
      });
      score += descMatches.length * 1;
      
      if (!matchedKeyword && descMatches.length > 0) {
        matchedKeyword = descMatches[0];
      }
      
      return { product: p, score, matchedKeyword };
    });
    
    let isFallback = false;
    let filtered = scoredProducts.filter(p => p.score > 0);
    
    if (filtered.length === 0) {
      isFallback = true;
      // Fallback: newest products
      filtered = scoredProducts.map(p => ({ ...p, score: 0 }));
      filtered.sort((a, b) => b.product.id.localeCompare(a.product.id)); // Assuming ID has some chronological order, or just default array order
    } else {
      // Sort by best match
      filtered.sort((a, b) => b.score - a.score);
    }
    
    return {
      similar: filtered,
      isFallback
    };
  }, [product, products]);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && similar.length > visibleSimilarLimit) {
          setVisibleSimilarLimit((prev) => prev + 4);
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [similar.length, visibleSimilarLimit]
  );

  return (
    <div className="min-h-screen bg-[var(--store-bg)] pb-24 font-sans text-[var(--theme-black)] w-full pt-16 z-40">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-[var(--theme-white)] fixed top-0 left-0 right-0 w-full z-50 shadow-sm">
        <div className="flex items-center gap-2 z-10">
          <button onClick={onBack} className="p-2 -ml-2 text-[var(--theme-black)]">
            <ArrowLeft size={24} />
          </button>
          <button onClick={onMenu} className="p-2 text-[var(--theme-black)]">
            <Menu size={24} />
          </button>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {websiteSettings?.logoUrl ? (
            <img src={websiteSettings.logoUrl} alt="Logo" className="h-8 object-contain pointer-events-auto" />
          ) : (
            <div className="h-8 pointer-events-auto"></div>
          )}
        </div>

        <div className="flex items-center gap-2 z-10">
          <button 
             onClick={onSearch} 
             className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-500 px-4 py-2 rounded-full w-64 hover:bg-gray-100 transition-colors"
          >
             <Search size={18} />
             <span className="text-sm">Search...</span>
          </button>
          <div className="w-10 h-10 bg-transparent flex items-center justify-center relative lg:hidden">
            <motion.button 
              layoutId="search-bar-morph" 
              style={{ borderRadius: 9999 }}
              transition={{ type: "spring", bounce: 0.05, duration: 0.4 }}
              onClick={onSearch} 
              className="absolute w-10 h-10 bg-transparent overflow-hidden border-[1.5px] border-transparent"
            />
            <button
              onClick={onSearch} 
              className="absolute w-10 h-10 bg-transparent flex items-center justify-center z-10 text-[var(--theme-black)]"
            >
              <Search size={22} />
            </button>
          </div>
          <button onClick={onViewCart} className="p-2 -mr-2 text-[var(--theme-black)] relative hidden lg:flex">
            <ShoppingBag size={22} />
            {cartTotalItems > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[var(--theme-primary)] text-[var(--theme-white)] text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartTotalItems}
              </span>
            )}
          </button>
          <button onClick={onViewCart} className="p-2 -mr-2 text-[var(--theme-black)] relative lg:hidden">
            <ShoppingBag size={22} />
            {cartTotalItems > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[var(--theme-primary)] text-[var(--theme-white)] text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartTotalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Desktop Main Content Container */}
      <div className="lg:max-w-7xl lg:mx-auto lg:px-4 lg:pt-8 lg:pb-12">
        <div className="flex flex-col lg:flex-row lg:gap-8 lg:items-start">
          
          {/* Left Column: Image Gallery & Thumbnails */}
          <div className="w-full lg:w-[48%] lg:sticky lg:top-24">
            {/* Main Image Gallery */}
            <div 
              className="relative bg-gray-200 aspect-square w-full overflow-hidden lg:rounded-2xl"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <img 
                src={images[currentImageIndex]} 
                alt={product.title} 
                className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                onClick={() => setIsFullScreen(true)}
              />
              
              {images.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[var(--theme-black)]/40 rounded-full flex items-center justify-center text-[var(--theme-white)] backdrop-blur-sm"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-[var(--theme-black)]/40 rounded-full flex items-center justify-center text-[var(--theme-white)] backdrop-blur-sm"
                  >
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="bg-[var(--theme-white)] px-4 py-3 border-b border-gray-100 lg:bg-transparent lg:px-0 lg:py-4 lg:border-none">
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {images.map((img, idx) => {
                    let thumbSource = img;
                    if (product.thumbnails && product.thumbnails[idx]) {
                       thumbSource = product.thumbnails[idx];
                    } else if (img === product.image && product.thumbnail) {
                       thumbSource = product.thumbnail; 
                    }
                    return (
                    <button 
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={cn(
                        "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all lg:w-20 lg:h-20",
                        currentImageIndex === idx ? "border-[var(--theme-primary)] opacity-100" : "border-transparent opacity-60"
                      )}
                    >
                      <img src={thumbSource} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                    </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Details & Controls */}
          <div className="w-full lg:w-[52%] flex flex-col">
            {/* Product Details Card */}
            <div className="m-4 bg-[var(--theme-white)] rounded-2xl border border-orange-100/50 p-4 shadow-sm lg:m-0 lg:p-6 lg:border-gray-100">
              <div className="text-sm lg:text-lg lg:font-bold text-[var(--theme-black)] line-clamp-2 h-[2.5rem] lg:h-auto lg:leading-tight leading-[1.25rem] mb-3">
          {product.title}
        </div>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-2 py-1 bg-pink-100 text-[var(--theme-primary)] text-xs font-medium rounded">
            {product.category}
          </span>
          <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-medium rounded inline-flex items-center gap-1">
            ID: {product.id} <CopyButton text={product.id} className="p-0.5 ml-1 text-orange-600 hover:bg-orange-200" />
          </span>
          {product.material && product.material !== 'Unknown' && (
            <span className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs font-medium rounded border border-yellow-100">
              {product.material}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="font-bold text-[16px] lg:text-lg mb-6">
          {formatPrice(displayPrice)}
        </div>

        {/* Variants Selection */}
        {product.hasVariants && product.options && product.options.length > 0 && (
          <div className="mb-6 space-y-4">
            {product.options.map(option => {
              const availableVals = availableOptionsMap[option.id] || [];
              if (availableVals.length === 0) return null;
              
              return (
                <div key={option.id}>
                  <div className="text-[11px] font-bold text-[var(--theme-black)] mb-2 uppercase tracking-wide">
                    {option.name} :
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableVals.map(val => {
                      const isSelected = selectedOptions[option.id] === val;
                      return (
                        <button
                          key={val}
                          onClick={() => handleOptionSelect(option.id, val)}
                          className={cn(
                            "px-5 py-2.5 rounded-full text-sm font-medium transition-all border",
                            isSelected 
                              ? "bg-[var(--theme-primary)] border-[var(--theme-primary)] text-[var(--theme-white)]"
                              : "bg-[var(--theme-white)] border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 bg-opacity-70"
                          )}
                        >
                          {val.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cart Controls */}
        {isOutOfStock ? (
           <div className="w-full py-3.5 bg-gray-200 text-gray-500 rounded-full font-bold text-center border-none mt-2">
             Out of stock
           </div>
        ) : cartQuantity === 0 ? (
          <button 
            disabled={product.hasVariants && !selectedVariant}
            onClick={handleAddToCart}
            className={cn(
              "w-full h-9 xl:h-10 rounded-full gap-1.5 mt-2",
              product.hasVariants && !selectedVariant
               ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none font-semibold text-sm flex items-center justify-center"
               : "btn-gradient"
            )}
          >
            {isAddingToOrder ? <><Plus size={15} /> Add to Order</> : "Add to cart"}
          </button>
        ) : (
          <div className="flex items-center justify-between mt-2 pt-2">
            <span className="text-2xl font-bold text-[var(--theme-primary)]">{formatPrice(displayPrice * cartQuantity)}</span>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleRemove}
                className="w-11 h-11 flex items-center justify-center border border-[var(--theme-primary)] text-[var(--theme-primary)] rounded-full active:bg-pink-50 transition-colors"
              >
                <Trash2 size={18} />
              </button>
              <div className="flex items-center border border-[var(--theme-primary)] rounded-full h-11 bg-[var(--theme-white)] overflow-hidden">
                <button 
                  onClick={handleDecrement}
                  className="w-11 h-full flex items-center justify-center text-[var(--theme-primary)] active:bg-pink-50 rounded-l-full transition-colors"
                >
                  <Minus size={18} />
                </button>
                <input 
                  type="number"
                  min="1"
                  max={stock}
                  disabled={isOutOfStock}
                  value={cartQuantity === 0 ? '' : (cartQuantity || '')}
                  onChange={(e) => {
                    if (!cartItem) return;
                    const val = e.target.value;
                    if (val === '') {
                      updateQuantity(cartItem.id, 0, false);
                      return;
                    }
                    const num = parseInt(val);
                    if (!isNaN(num)) {
                      updateQuantity(cartItem.id, num, false);
                    }
                  }}
                  onBlur={(e) => {
                    if (!cartItem) return;
                    const val = parseInt(e.target.value);
                    if (isNaN(val) || val < 1) updateQuantity(cartItem.id, 1, false);
                  }}
                  className="w-10 text-center text-sm font-bold text-[var(--theme-black)] bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button 
                  onClick={handleIncrement}
                  className="w-11 h-full flex items-center justify-center text-[var(--theme-primary)] active:bg-pink-50 rounded-r-full transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      {product.description && (
        <div className="mx-4 mt-2 mb-6 bg-[var(--theme-white)] rounded-2xl border border-gray-100 p-5 shadow-sm lg:m-0 lg:mt-6">
          <h2 className="text-[1.35rem] font-bold text-[var(--theme-black)] mb-4 lg:mb-3">Description</h2>
          <div className="text-[var(--theme-black)] text-[15px] whitespace-pre-wrap leading-[1.6]">
            {product.description}
          </div>
        </div>
      )}
    </div>
  </div>

  {/* Similar Products */}
      {similar.length > 0 && (
        <div className="mt-8 mb-6 w-full">
          <h2 className="text-[1.35rem] font-bold text-[var(--theme-black)] mb-5 text-center px-4">
            {isFallback ? "You may also like" : "Similar Products"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 px-1 pb-1 lg:gap-4 lg:p-4">
            {similar.slice(0, visibleSimilarLimit).map(({ product: p, matchedKeyword }) => {
              const pCartItem = cart.find(item => item.product.id === p.id);
              
              return (
                <div 
                  key={p.id} 
                  className="bg-[var(--theme-white)] rounded-lg overflow-hidden shadow-sm border border-gray-100 flex flex-col group"
                  onClick={() => onProductSelect?.(p)}
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
                    <img 
                      src={p.thumbnail || p.image} 
                      alt={p.title} 
                      loading="lazy"
                      decoding="async"
                      className={cn(
                        "absolute inset-0 w-full h-full object-cover cursor-pointer transition-opacity duration-300",
                        websiteSettings?.productImageHover && p.images && p.images.length > 1 ? "group-hover:opacity-0" : ""
                      )}
                    />
                    {websiteSettings?.productImageHover && p.images && p.images.length > 1 && (
                      <img 
                        src={p.thumbnails?.[1] || p.images[1]} 
                        alt={`${p.title} hover`} 
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover cursor-pointer transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                      />
                    )}
                    
                    {p.colors && (
                      <div className="absolute bottom-2 right-2 flex -space-x-1">
                        {p.colors.map(c => (
                          <img key={c.name} src={c.image} className="w-6 h-6 rounded-full border border-[var(--theme-white)] shadow-sm object-cover" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-[2px] flex flex-col flex-grow gap-[2px]">
                    {p.material && p.material !== 'Unknown' && (
                      <div className="text-xs text-yellow-600 font-medium">{p.material}</div>
                    )}
                    <div 
                      className="text-xs lg:text-sm line-clamp-2 font-semibold leading-tight text-[var(--theme-black)] h-[30px] lg:h-[36px] break-words [overflow-wrap:anywhere] [word-break:break-word]"
                      style={{ color: 'var(--theme-black)' }}
                      title={p.title}
                    >
                      {p.title}
                    </div>
                    <div className="font-bold text-[16px] lg:text-lg">{formatPrice(p.price)}</div>

                    {pCartItem ? (
                      <div className="flex items-center justify-between w-full h-[36px] lg:h-[40px]" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFromCart(pCartItem.id); }} 
                          className="w-[36px] lg:w-[40px] h-full flex items-center justify-center text-red-500 border border-red-200 rounded-full bg-red-50"
                        >
                          <Trash2 size={16} />
                        </button>
                        <div className="flex items-center border border-gray-200 rounded-full h-full bg-[var(--theme-white)]" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); updateQuantity(pCartItem.id, -1); }} 
                            className="w-[36px] lg:w-[40px] h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-l-full"
                          >
                            <Minus size={16} />
                          </button>
                          <input 
                            type="number" 
                            className="w-10 text-center font-medium text-sm appearance-none border-none outline-none focus:outline-none bg-transparent p-0 m-0 focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            value={pCartItem.quantity === 0 ? '' : (pCartItem.quantity || '')}
                            onChange={(e) => {
                              e.stopPropagation();
                              const val = e.target.value;
                              if (val === '') {
                                updateQuantity(pCartItem.id, 0, false);
                                return;
                              }
                              const num = parseInt(val);
                              if (!isNaN(num)) {
                                updateQuantity(pCartItem.id, num, false);
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (isNaN(val) || val < 1) {
                                updateQuantity(pCartItem.id, 1, false);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button 
                            onClick={(e) => { e.stopPropagation(); updateQuantity(pCartItem.id, 1); }} 
                            className="w-[36px] lg:w-[40px] h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-r-full"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                        className="btn-gradient w-full h-9 xl:h-10 rounded-full gap-1.5"
                      >
                        {isAddingToOrder ? <><Plus size={15} /> Add to Order</> : "Add to cart"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {similar.length > visibleSimilarLimit && (
            <div ref={lastItemRef} className="h-10 w-full" />
          )}
        </div>
      )}
      </div>

      {/* Spacer for Sticky Bottom Bar */}
      <div className="h-24"></div>

      {/* Sticky Bottom Bar */}
      <AnimatePresence>
        {cartTotalItems > 0 && !isAddingToOrder && (
          <ActionBtn
            config={websiteSettings?.actionButtons?.viewCart || DEFAULT_ACTION_BUTTONS.viewCart}
            onClick={onViewCart}
            label="View Cart"
            badge={cartTotalItems}
            rightText={formatPrice(cartTotalPrice)}
          />
        )}
        
        {cartTotalItems > 0 && isAddingToOrder && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed z-40" 
            style={{
              bottom: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).marginBottom,
              left: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position.includes('left') ? (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).marginLeft || '16px' : undefined,
              right: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position.includes('right') ? (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).marginRight || '16px' : undefined,
              display: 'flex', gap: '8px', 
              width: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position === 'bottom-center' || (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position === 'top-center' ? 'calc(100% - 32px)' : undefined,
              marginLeft: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position === 'bottom-center' ? '16px' : undefined
            }}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); cancelAddingToOrder?.(); }}
              className="w-14 h-14 bg-[var(--theme-white)] text-[var(--theme-black)] rounded-full flex items-center justify-center shadow-lg font-bold border border-gray-200 hover:bg-gray-50 transition-colors shrink-0"
              style={{ 
                height: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).height,
                width: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).height,
                borderRadius: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).borderRadius
              }}
              aria-label="Cancel"
            >
              <X size={20} />
            </button>
            <ActionBtn
              config={{
                ...(websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder),
                width: '100%',
                position: 'bottom-left' // Mock position
              }}
              style={{ position: 'relative', bottom: 'auto', left: 'auto', right: 'auto', top: 'auto', transform: 'none', margin: '0' }}
              className="flex-1"
              onClick={onViewCart}
              label="Confirm Order"
              badge={cartTotalItems}
              rightText={formatPrice(cartTotalPrice)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Image Modal */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[var(--theme-black)] flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 text-[var(--theme-white)] absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/50 to-transparent">
              <span className="text-sm font-medium">{currentImageIndex + 1} / {images.length}</span>
              <button onClick={() => setIsFullScreen(false)} className="p-2 bg-[var(--theme-black)]/20 rounded-full backdrop-blur-md">
                <X size={24} />
              </button>
            </div>

            {/* Swipeable Image Area */}
            <div 
              className="flex-1 relative flex items-center justify-center overflow-hidden"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentImageIndex}
                  src={images[currentImageIndex]}
                  alt="Full screen preview"
                  className="w-full h-auto max-h-full object-contain"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.2 }}
                />
              </AnimatePresence>

              {/* Invisible click areas for next/prev */}
              <div className="absolute inset-y-0 left-0 w-1/3" onClick={prevImage} />
              <div className="absolute inset-y-0 right-0 w-1/3" onClick={nextImage} />
            </div>

            {/* Modal Cart Controls */}
            <div className="bg-[var(--theme-white)] rounded-t-3xl p-6 pb-8 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
              <div className="mb-4">
                <h2 className="text-sm text-[var(--theme-black)] line-clamp-2 h-[2.5rem] leading-[1.25rem] mb-3">{product.title}</h2>
                <div className="font-bold text-[16px] lg:text-lg">{formatPrice(product.price)}</div>
              </div>

              {cartQuantity === 0 ? (
                <button 
                  onClick={handleAddToCart}
                  className="btn-gradient w-full h-9 xl:h-10 rounded-full gap-1.5 mt-2"
                >
                  {isAddingToOrder ? <><Plus size={15} /> Add to Order</> : "Add to cart"}
                </button>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">Quantity</span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={handleRemove}
                      className="w-10 h-10 flex items-center justify-center border border-[var(--theme-primary)] text-[var(--theme-primary)] rounded-full active:bg-pink-50 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="flex items-center border border-[var(--theme-primary)] rounded-full h-10">
                      <button 
                        onClick={handleDecrement}
                        className="w-10 h-full flex items-center justify-center text-[var(--theme-primary)] active:bg-pink-50 rounded-l-full transition-colors"
                      >
                        <Minus size={18} />
                      </button>
                      <input 
                        type="number"
                        min="1"
                        max={stock}
                        disabled={isOutOfStock}
                        value={cartQuantity === 0 ? '' : (cartQuantity || '')}
                        onChange={(e) => {
                          if (!cartItem) return;
                          const val = e.target.value;
                          if (val === '') {
                            updateQuantity(cartItem.id, 0, false);
                            return;
                          }
                          const num = parseInt(val);
                          if (!isNaN(num)) {
                            updateQuantity(cartItem.id, num, false);
                          }
                        }}
                        onBlur={(e) => {
                          if (!cartItem) return;
                          const val = parseInt(e.target.value);
                          if (isNaN(val) || val < 1) updateQuantity(cartItem.id, 1, false);
                        }}
                        className="w-10 text-center font-semibold text-[var(--theme-black)] bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button 
                        onClick={handleIncrement}
                        className="w-10 h-full flex items-center justify-center text-[var(--theme-primary)] active:bg-pink-50 rounded-r-full transition-colors"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
