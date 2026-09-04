import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { Product, ProductVariant } from '../types';
import { cn, formatPrice } from '../lib/utils';
import { useScrollLock } from '../hooks/useScrollLock';

interface VariantModalProps {
  product: Product;
  onClose: () => void;
  onAdd: (product: Product, variant: ProductVariant, quantity: number) => void;
}

export function VariantModal({ product, onClose, onAdd }: VariantModalProps) {
  useScrollLock(true);
  // Initialize with the options of the first variant that has stock
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

  // Compute available values for each option based on variant stock and current selection
  const availableOptionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (product.options && product.variants) {
      product.options.forEach(opt => {
        map[opt.id] = opt.values.filter(val => {
          // Check if there is ANY variant with this option value AND the other currently selected options that has stock
          return product.variants!.some(v => {
            if (v.options[opt.id] !== val) return false;
            // For other options, they must match the selected option (if defined)
            for (const [otherOptId, selectedVal] of Object.entries(selectedOptions)) {
               if (otherOptId !== opt.id && selectedVal && v.options[otherOptId]) {
                  if (v.options[otherOptId] !== selectedVal) return false;
               }
            }
            // If we have stock tracking enabled for variants, hide if 0
            if (v.stock !== undefined && v.stock !== null && Number(v.stock) <= 0) return false;
            return true;
          });
        });
      });
    }
    return map;
  }, [product.options, product.variants, selectedOptions]);

  const [quantity, setQuantity] = useState(1);

  // Find the currently selected variant
  const selectedVariant = useMemo(() => {
    if (!product.variants) return null;
    return product.variants.find(v => {
      return Object.entries(selectedOptions).every(([optionId, value]) => v.options[optionId] === value);
    });
  }, [product.variants, selectedOptions]);

  // Derived display values
  const displayPrice = selectedVariant?.price ?? product.price;
  const displayImage = selectedVariant?.image ?? product.image;
  const stock = selectedVariant?.stock ?? product.stock ?? 0;
  const isOutOfStock = stock <= 0;

  const handleOptionSelect = (optionId: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionId]: value
    }));
    setQuantity(1); // Reset qty on variant change
  };

  const handleAddToCart = () => {
    if (!selectedVariant) return;
    const finalQty = Math.max(1, quantity || 1);
    onAdd(product, selectedVariant, finalQty);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--theme-black)]/50 p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm bg-[var(--theme-white)] rounded-3xl overflow-hidden relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-gray-100/80 backdrop-blur rounded-full text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer">
          <X size={18} />
        </button>
        
        <div className="p-5">
          <div className="flex gap-4 mb-6">
            <div className="w-32 h-32 rounded-2xl overflow-hidden border border-gray-100 flex-shrink-0">
              <img src={displayImage} alt={product.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <h3 className="font-bold text-[var(--theme-black)] text-sm leading-tight mb-2 line-clamp-3">{product.title}</h3>
              <div className="font-bold text-[var(--theme-primary)] text-xl mb-1">{formatPrice(displayPrice)}</div>
            </div>
          </div>

          <div className="space-y-4 mb-6 max-h-[40vh] overflow-y-auto">
            {product.options?.map(option => {
              const availableVals = availableOptionsMap[option.id] || [];
              if (availableVals.length === 0) return null;
              
              return (
                <div key={option.id}>
                  <div className="text-[10px] font-bold text-[var(--theme-black)] mb-2 uppercase tracking-wide">
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
                            "px-4 py-2 rounded-full text-sm font-medium transition-all border",
                            isSelected 
                              ? "bg-[var(--theme-primary)] border-[var(--theme-primary)] text-[var(--theme-white)]"
                              : "bg-[var(--theme-white)] border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
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

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-bold text-[var(--theme-primary)] text-2xl">
                {formatPrice(displayPrice * quantity)}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="w-11 h-11 flex items-center justify-center text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 rounded-full cursor-pointer transition-colors">
                  <Trash2 size={18} />
                </button>
                <div className="flex items-center border border-gray-200 rounded-full h-11 bg-[var(--theme-white)] overflow-hidden">
                  <button 
                    disabled={isOutOfStock}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                    className="w-11 h-full flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Minus size={18} />
                  </button>
                  <input 
                    type="number"
                    min="1"
                    disabled={isOutOfStock}
                    value={isOutOfStock ? 0 : (quantity === 0 ? '' : (quantity || ''))}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setQuantity(0);
                        return;
                      }
                      const num = parseInt(val);
                      if (!isNaN(num)) {
                        if (stock !== undefined && stock !== null && num > Number(stock)) {
                          setQuantity(Number(stock));
                        } else {
                          setQuantity(Math.max(0, num));
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (isNaN(val) || val < 1) setQuantity(1);
                    }}
                    className="w-10 text-center text-sm font-medium text-[var(--theme-black)] bg-transparent border-none outline-none focus:outline-none focus:ring-0 p-0 m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button 
                    disabled={isOutOfStock}
                    onClick={() => {
                        if (stock !== undefined && stock !== null && quantity >= Number(stock)) {
                            // Don't increase beyond stock
                        } else {
                            setQuantity(quantity + 1);
                        }
                    }} 
                    className="w-11 h-full flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full flex justify-center">
              <button 
                onClick={handleAddToCart}
                disabled={!selectedVariant || isOutOfStock}
                className={cn(
                  "btn-add-to-cart text-sm",
                  selectedVariant && !isOutOfStock 
                     ? "btn-gradient cursor-pointer" 
                     : "bg-gray-200 text-gray-500 cursor-not-allowed shadow-none font-semibold flex items-center justify-center"
                )}
              >
                {isOutOfStock ? "Out of stock" : "Add to cart"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
