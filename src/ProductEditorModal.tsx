import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Save, ChevronUp, ChevronDown, Plus, Minus, Image as ImageIcon, X, Package, Trash2, GripVertical, Check } from 'lucide-react';
import { Product, Category, PriceCalculatorSettings, ProductOption, ProductVariant, DEFAULT_ACTION_BUTTONS } from './types';
import { cn, formatPrice } from './lib/utils';
import ImageOptimizerModal from './components/ImageOptimizerModal';
import { optimizeImageRun, arrayBufferToDataUrl, fileToImageData, getDefaultImageOptimization, OptimizeOptions } from './lib/imageOptimizationWorker';
import { DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableImage } from './components/SortableImage';

// define image meta type
type ImageMeta = {
  originalSize: number;
  optimizedSize?: number;
  width: number;
  height: number;
  originalDataUrl: string;
  thumbnailUrl?: string;
  isProcessing?: boolean;
};

// Levenshtein distance algorithm for typo tolerance
function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

import { cloudStore } from './lib/cloudStore';

interface ProductEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: Product) => void;
  onDelete?: (id: string) => void;
  initialProduct?: Product | null;
  categories: Category[];
  priceCalculatorSettings?: PriceCalculatorSettings;
  products?: Product[];
  suppliers?: string[];
  perms?: Record<string, boolean>;
  inputBorderRadius?: string;
}

export const clean1688Url = (input?: string): string => {
  if (!input) return '';
  let str = input.trim();
  const match = str.match(/https?:\/\/[^\s\u4e00-\u9fa5\uff00-\uffef]+/);
  if (match) {
    let url = match[0];
    url = url.replace(/[,，\.。;；!?！？\)\>）】]+$/, '');
    return url;
  }
  if (str.startsWith('qr.1688.com') || str.startsWith('detail.1688.com') || str.startsWith('m.1688.com')) {
    const clean = str.split(/\s+/)[0];
    return 'https://' + clean;
  }
  return str;
};

export default function ProductEditorModal({ isOpen, onClose, onSave, onDelete, initialProduct, categories, priceCalculatorSettings, products, suppliers = [], perms, inputBorderRadius }: ProductEditorModalProps) {
  const inputBorderRadiusStyle = { borderRadius: inputBorderRadius || DEFAULT_ACTION_BUTTONS.checkout.borderRadius };
  const [productId, setProductId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [description, setDescription] = useState('');
  const [autoPrice, setAutoPrice] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stock, setStock] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imagesMeta, setImagesMeta] = useState<Record<number, ImageMeta>>({});
  const [optimizingImageIndex, setOptimizingImageIndex] = useState<number | null>(null);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [qtyRules, setQtyRules] = useState<{quantity: number, price: number}[]>([]);
  const [code1688, setCode1688] = useState('');
  const [link1688, setLink1688] = useState('');
  
  const [editingOptionIdx, setEditingOptionIdx] = useState<number | null>(null);
  const [editingOption, setEditingOption] = useState<{name: string, values: string[]} | null>(null);
  const [optionInputVal, setOptionInputVal] = useState('');
  const [selectingImageForVariant, setSelectingImageForVariant] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<'general' | 'price' | 'stock'>('general');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVisible, setIsVisible] = useState<boolean>(initialProduct?.isVisible ?? true);
  const [isNew, setIsNew] = useState<boolean>(initialProduct?.isNew ?? false);
  const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(false);
  
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [showOptionSuggestions, setShowOptionSuggestions] = useState(false);
  const PRE_MADE_OPTIONS = ['color', 'size', 'weight', 'material'];
  
  const suggestedTitles = React.useMemo(() => {
    if (!products) return [];
    const stats = new Map<string, { count: number, lastSeen: number }>();
    products.forEach((p, i) => {
      if (!p.title) return;
      const current = stats.get(p.title) || { count: 0, lastSeen: 0 };
      current.count += 1;
      current.lastSeen = Math.max(current.lastSeen, i);
      stats.set(p.title, current);
    });
    
    const sorted = Array.from(stats.entries()).sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      return b[1].lastSeen - a[1].lastSeen;
    }).map(e => e[0]);

    if (!title) return sorted.slice(0, 50); // Show recent
    return sorted.filter(t => t.toLowerCase().includes(title.toLowerCase())).slice(0, 50);
  }, [products, title]);

  useEffect(() => {
    if (isOpen) {
      if (initialProduct) {
        const resolvedBuyPrice = initialProduct.buyPrice || (initialProduct.price ? Math.floor(initialProduct.price * 0.4) : '');
        setProductId(initialProduct.id || '');
        setTitle(initialProduct.title || '');
        setCategory(initialProduct.category || '');
        setSupplier(initialProduct.supplier || '');
        setDescription(initialProduct.description || '');
        setAutoPrice(initialProduct.autoPrice?.toString() || '');
        setBuyPrice(resolvedBuyPrice ? resolvedBuyPrice.toString() : '');
        setSellPrice(initialProduct.price?.toString() || '');
        setStock(initialProduct.stock?.toString() || '');
        setImages(initialProduct.images && initialProduct.images.length > 0 ? initialProduct.images : (initialProduct.image ? [initialProduct.image] : []));
        setOptions(initialProduct.options || []);
        const resolvedVariants = (initialProduct.variants || []).map(v => ({
          ...v,
          buyPrice: v.buyPrice || (v.price ? Math.floor(v.price * 0.4) : (initialProduct.price ? Math.floor(initialProduct.price * 0.4) : undefined))
        }));
        setVariants(resolvedVariants);
        setQtyRules(initialProduct.qtyRules || []);
        setIsVisible(initialProduct.isVisible !== false);
        setIsNew(initialProduct.isNew ?? false);
        setCode1688(initialProduct.code1688 || '');
        setLink1688(initialProduct.link1688 || '');
        setHasManuallySelectedCategory(true);
      } else {
        setProductId('');
        setTitle('');
        setCategory('');
        setSupplier('');
        setDescription('');
        setAutoPrice('');
        setBuyPrice('');
        setSellPrice('');
        setStock('');
        setCode1688('');
        setLink1688('');
        setImages([]);
        setOptions([]);
        setVariants([]);
        setQtyRules([]);
        setIsVisible(true);
        setIsNew(false);
        setHasManuallySelectedCategory(false);
      }
      setOpenSection('general');
      setErrorMsg('');
    }
  }, [isOpen, initialProduct]);

  // Automatic Category Detection from Title
  useEffect(() => {
    if (!isOpen || initialProduct || hasManuallySelectedCategory) return;
    if (!title.trim()) return;

    let bestMatch = '';
    let bestScore = 0; 

    const words = title.toLowerCase().split(/[^a-z0-9]+/);

    for (const cat of categories) {
      const catNameLower = cat.name.toLowerCase();
      let score = 0;

      // 1. Exact substring match
      if (title.toLowerCase().includes(catNameLower)) {
        score += 100;
      }

      // 2. Word by word fuzzy match
      const catWords = catNameLower.split(/[^a-z0-9]+/);
      
      for (const catWord of catWords) {
        if (catWord.length < 3) continue;

        for (const word of words) {
          if (word.length < 3) continue;
          
          // Pluralization / stemming check
          if (word === catWord || word + 's' === catWord || catWord + 's' === word || word + 'es' === catWord || catWord + 'es' === word) {
             score += 50;
             continue; 
          }

          // Substring check
          if (word.includes(catWord) || catWord.includes(word)) {
            if (Math.abs(word.length - catWord.length) <= 2) {
              score += 30;
            }
          }

          // Levenshtein distance check for typos
          const dist = levenshteinDistance(word, catWord);
          if (word.length >= 5 && dist === 1) {
             score += 40;
          } else if (word.length >= 7 && dist <= 2) {
             score += 20;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = cat.name;
      }
    }

    if (bestMatch && bestScore >= 20) {
      setCategory(bestMatch);
    }
  }, [title, categories, isOpen, initialProduct, hasManuallySelectedCategory]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      for (const file of files) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
          const initialDataUrl = reader.result as string;
          
          setImages(prev => {
            const newIdx = prev.length;
            
            // Extract image data to send to worker
            fileToImageData(file, 1920).then(imageData => {
              setImagesMeta(m => ({
                ...m,
                [newIdx]: {
                  originalSize: file.size,
                  width: imageData.width,
                  height: imageData.height,
                  originalDataUrl: initialDataUrl,
                  isProcessing: true
                }
              }));

              const defaultConfig = getDefaultImageOptimization();
              let optimizeOptions: OptimizeOptions = { quality: 70 };
              if (defaultConfig && defaultConfig.enabled) {
                 optimizeOptions.quality = defaultConfig.quality;
                 if (defaultConfig.scale !== 100) {
                   optimizeOptions.resize = {
                     width: Math.max(1, Math.round(imageData.width * (defaultConfig.scale / 100))),
                     height: Math.max(1, Math.round(imageData.height * (defaultConfig.scale / 100)))
                   };
                 }
              }

              optimizeImageRun(imageData, optimizeOptions).then(async result => {
                 let optimizedDataUrl: string;
                 let thumbnailDataUrl: string | undefined;
                 try {
                   const blob = new Blob([result.buffer], { type: 'image/webp' });
                   optimizedDataUrl = await cloudStore.uploadFile(blob, `img_${Date.now()}.webp`);
                   
                   // Thumbnail generation
                   let thumbWidth = defaultConfig?.thumbnailWidth || 470;
                   let thumbQuality = defaultConfig?.thumbnailQuality || 70;
                   if (imageData.width > thumbWidth) {
                     const thumbOptions: OptimizeOptions = { 
                       quality: thumbQuality, 
                       resize: { width: thumbWidth, height: Math.max(1, Math.round(imageData.height * (thumbWidth / imageData.width))) } 
                     };
                     const thumbResult = await optimizeImageRun(imageData, thumbOptions);
                     const thumbBlob = new Blob([thumbResult.buffer], { type: 'image/webp' });
                     thumbnailDataUrl = await cloudStore.uploadFile(thumbBlob, `thumb_${Date.now()}.webp`);
                   } else {
                     thumbnailDataUrl = optimizedDataUrl; // reuse if already small
                   }
                 } catch (e) {
                   console.error('Failed to upload to R2', e);
                   optimizedDataUrl = arrayBufferToDataUrl(result.buffer, 'image/webp');
                 }
                 
                 setImagesMeta(m => ({
                   ...m,
                   [newIdx]: {
                     ...m[newIdx],
                     optimizedSize: result.buffer.byteLength,
                     isProcessing: false,
                     width: result.width,
                     height: result.height,
                     thumbnailUrl: thumbnailDataUrl
                   }
                 }));

                 setImages(prevImages => {
                   const copy = [...prevImages];
                   copy[newIdx] = optimizedDataUrl;
                   return copy;
                 });
              }).catch(err => {
                 console.error("Auto optimize error", err);
                 // Fallback to basic canvas resize
                 const canvas = document.createElement('canvas');
                 canvas.width = imageData.width;
                 canvas.height = imageData.height;
                 const ctx = canvas.getContext('2d');
                 ctx?.putImageData(imageData, 0, 0); // Need to handle scaling properly if falling back, but original is fine as fallback
                 
                 // Generate a canvas data URL as fallback if possible
                 try {
                   const fallbackUrl = canvas.toDataURL('image/jpeg', 0.8);
                   setImages(prevImages => {
                     const copy = [...prevImages];
                     copy[newIdx] = fallbackUrl;
                     return copy;
                   });
                 } catch(canvasErr) {}

                 setImagesMeta(m => ({
                   ...m, [newIdx]: { ...m[newIdx], isProcessing: false, optimizedSize: file.size }
                 }));
              });
            });

            return [...prev, initialDataUrl];
          });
        };
      }
    }
  };

  const handleAutoPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAutoPrice(val);
    
    if (val && priceCalculatorSettings) {
      const numVal = Number(val);
      if (!isNaN(numVal)) {
        const calculatedBuyPrice = Math.floor((priceCalculatorSettings.yuanRate * numVal) + priceCalculatorSettings.additionalCost);
        const calculatedSellPrice = Math.floor(calculatedBuyPrice + priceCalculatorSettings.profit);
        
        setBuyPrice(calculatedBuyPrice.toString());
        setSellPrice(calculatedSellPrice.toString());
      }
    }
  };

  const generateVariations = (opts: ProductOption[]) => {
    if (opts.length === 0) return [];
    if (opts.some(o => o.values.length === 0)) return [];
    let combos: Record<string, string>[] = [{}];
    opts.forEach(opt => {
      const nextCombos: Record<string, string>[] = [];
      combos.forEach(combo => {
        opt.values.forEach(val => {
          nextCombos.push({ ...combo, [opt.id]: val });
        });
      });
      combos = nextCombos;
    });
    return combos;
  };

  const handleSaveOptions = (newOpts: ProductOption[]) => {
    setOptions(newOpts);
    const combos = generateVariations(newOpts);
    const newVariants = combos.map(combo => {
      // 1. Exact match
      let exact = variants.find(v => {
        return Object.keys(combo).every(k => v.options[k] === combo[k]) && Object.keys(v.options).length === Object.keys(combo).length;
      });
      if (exact) return exact;

      // 2. Partial match (new option added -> old variant is a subset of new combo)
      let partial = variants.find(v => {
        const vKeys = Object.keys(v.options);
        return vKeys.length > 0 && vKeys.every(k => v.options[k] === combo[k]);
      });

      // 3. Partial match (option removed -> new combo is a subset of old variant)
      if (!partial) {
        partial = variants.find(v => {
          const cKeys = Object.keys(combo);
          return cKeys.length > 0 && cKeys.every(k => v.options[k] === combo[k]);
        });
      }

      if (partial) {
        return {
          ...partial,
          id: Math.random().toString(36).substring(2, 11),
          options: combo
        } as ProductVariant;
      }

      return {
        id: Math.random().toString(36).substring(2, 11),
        options: combo
      } as ProductVariant;
    });
    setVariants(newVariants);
  };

  const handleSave = () => {
    if (!title) {
      setErrorMsg('Please provide a title.');
      return;
    }

    if (productId) {
      const isDuplicate = products.some(p => p.id === productId && p.id !== initialProduct?.id);
      if (isDuplicate) {
        setErrorMsg('Product ID must be unique. This ID is already in use.');
        setOpenSection('general');
        return;
      }
    }

    if (variants.length === 0 && !sellPrice) {
      setErrorMsg('Please provide a sell price.');
      return;
    }

    let defaultPrice = variants.length > 0 && variants[0].price ? variants[0].price : (Math.floor(Number(sellPrice)) || 0);

    const newStock = stock && variants.length === 0 ? Math.floor(Number(stock)) : 0;
    const totalVariantStock = variants.reduce((acc, v) => acc + (v.stock || 0), 0);
    const finalStock = variants.length > 0 ? totalVariantStock : newStock;
    let newStockOutDate = initialProduct?.stockOutDate;
    
    // If stock became 0 (or was 0 and still is), make sure stockOutDate is set.
    // If it was just changed to 0, set it to now. 
    // If it's > 0, clear it.
    if (finalStock === 0) {
      if ((initialProduct?.stock !== 0 && initialProduct?.stock !== undefined) || !newStockOutDate) {
        newStockOutDate = new Date().toISOString();
      }
    } else {
      newStockOutDate = undefined;
    }

    const finalThumbnails = images.map((imgUrl, idx) => {
       const meta = imagesMeta[idx];
       if (meta && meta.thumbnailUrl) return meta.thumbnailUrl;
       if (initialProduct && initialProduct.thumbnails && initialProduct.images && initialProduct.images[idx] === imgUrl && initialProduct.thumbnails[idx]) {
          return initialProduct.thumbnails[idx];
       }
       return imgUrl;
    });

    const finalBuyPrice = buyPrice ? Math.floor(Number(buyPrice)) : (defaultPrice ? Math.floor(defaultPrice * 0.4) : 0);

    const updatedProduct: Product = {
      id: productId || (initialProduct ? initialProduct.id : Date.now().toString()),
      title: title || 'Untitled Product',
      material: initialProduct?.material || '',
      price: defaultPrice,
      buyPrice: finalBuyPrice,
      autoPrice: autoPrice ? Math.floor(Number(autoPrice)) : undefined,
      stock: finalStock,
      stockOutDate: newStockOutDate,
      supplier,
      description,
      category: category || 'Uncategorized',
      image: images[0] || 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&q=80&w=800',
      thumbnail: finalThumbnails[0] || images[0] || 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&q=80&w=800',
      images: images,
      thumbnails: finalThumbnails.length > 0 ? finalThumbnails : undefined,
      options: options,
      variants: variants.map(v => ({
        ...v,
        buyPrice: v.buyPrice !== undefined && v.buyPrice !== null
          ? v.buyPrice
          : (v.price ? Math.floor(v.price * 0.4) : (finalBuyPrice || undefined))
      })),
      hasVariants: variants.length > 0,
      isVisible: isVisible,
      isNew: isNew,
      qtyRules: qtyRules,
      code1688: code1688.trim() || undefined,
      link1688: clean1688Url(link1688) || undefined,
    };
    onSave(updatedProduct);
  };

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = images.indexOf(active.id as string);
    const newIndex = images.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      setImages((prev) => arrayMove(prev, oldIndex, newIndex));
      setImagesMeta((prevMeta) => {
        const arr = [];
        const len = Math.max(Object.keys(prevMeta).length, images.length);
        for (let i = 0; i < len; i++) {
           arr.push(prevMeta[i]);
        }
        const newArr = arrayMove(arr, oldIndex, newIndex);
        const newMeta: Record<number, ImageMeta> = {};
        newArr.forEach((m, i) => { if (m) newMeta[i] = m; });
        return newMeta;
      });
    }
  };

  const isNewProduct = !initialProduct;
  const currentImages = images || [];
  const initialImages = initialProduct?.images && initialProduct.images.length > 0 
      ? initialProduct.images 
      : (initialProduct?.image ? [initialProduct.image] : []);

  const initialBuyPriceValue = initialProduct 
    ? (initialProduct.buyPrice || (initialProduct.price ? Math.floor(initialProduct.price * 0.4) : ''))?.toString() || ''
    : '';

  const hasChanges = isNewProduct 
    ? (title !== '' || images.length > 0 || buyPrice !== '' || sellPrice !== '' || category !== '' || code1688 !== '' || link1688 !== '')
    : (
        title !== (initialProduct?.title || '') ||
        category !== (initialProduct?.category || '') ||
        supplier !== (initialProduct?.supplier || '') ||
        description !== (initialProduct?.description || '') ||
        autoPrice !== (initialProduct?.autoPrice?.toString() || '') ||
        buyPrice !== initialBuyPriceValue ||
        sellPrice !== (initialProduct?.price?.toString() || '') ||
        stock !== (initialProduct?.stock?.toString() || '') ||
        code1688 !== (initialProduct?.code1688 || '') ||
        link1688 !== (initialProduct?.link1688 || '') ||
        JSON.stringify(currentImages) !== JSON.stringify(initialImages) ||
        JSON.stringify(options) !== JSON.stringify(initialProduct?.options || []) ||
        JSON.stringify(variants) !== JSON.stringify(initialProduct?.variants || []) ||
        JSON.stringify(qtyRules) !== JSON.stringify(initialProduct?.qtyRules || []) ||
        isVisible !== (initialProduct?.isVisible !== false) ||
        isNew !== (initialProduct?.isNew ?? false)
    );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: 20 }} 
          className="fixed inset-0 z-[110] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[84px]"
        >
          {/* Top Bar */}
          <div className="border-b border-[var(--dash-border)] bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
            <div className="max-w-4xl mx-auto w-full flex items-center justify-between p-4 md:px-8">
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"><X size={22} /></button>
                <h1 className="text-base md:text-lg font-bold text-white">{initialProduct ? `Edit / ${initialProduct.id}` : 'Add Product'}</h1>
              </div>
              <div className="flex gap-2 items-center">
                {/* Manual Visibility Toggle */}
                {initialProduct && (
                  <div 
                    className={cn(
                      "w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out mr-2 flex items-center group",
                      (stock === '' || Number(stock) === 0) ? "bg-gray-700 opacity-50 cursor-not-allowed" : 
                      isVisible ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-gray-600"
                    )}
                    onClick={() => {
                      if (stock !== '' && Number(stock) > 0) {
                        setIsVisible(!isVisible);
                      }
                    }}
                    title={isVisible ? "Product is visible in storefront" : "Product is hidden"}
                  >
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] shadow-sm group-active:w-6",
                      isVisible ? "translate-x-6 group-active:translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                )}
                {initialProduct && onDelete && (
                  <button 
                    onClick={() => {
                      onDelete(initialProduct.id);
                    }} 
                    className="p-2 bg-red-900/20 text-red-400 rounded-xl border border-red-900/50 hover:bg-red-900/40 transition-colors cursor-pointer"
                    title="Delete Product"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <button 
                  onClick={() => setIsNew(!isNew)}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 border transition-colors shrink-0 rounded-xl cursor-pointer",
                    isNew 
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/25" 
                      : "bg-[var(--dash-card)] text-gray-400 border-[var(--dash-border)] hover:text-white hover:border-gray-400"
                  )}
                  style={inputBorderRadiusStyle}
                >
                  NEW
                </button>
                <button
                  onClick={handleSave}
                  className="hidden md:flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer ml-1"
                >
                  <Save size={14} />
                  <span>{initialProduct ? 'Save' : 'Add'}</span>
                </button>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="mx-4 mt-4 p-3 bg-red-900/20 border border-red-900/50 text-red-500 rounded-lg text-sm">
              {errorMsg}
            </div>
          )}

          <div className="flex-grow overflow-y-auto p-4 pb-24 md:p-8">
            <div className="max-w-4xl mx-auto w-full space-y-4">
            {/* General Information */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl overflow-hidden p-4 space-y-4">
              <h2 className="font-bold text-sm text-gray-300">General Information</h2>
              <div className="flex gap-4">
                <div className="flex-grow space-y-1 relative">
                  <label className="text-xs text-[#ff4d6d]">Title *</label>
                  <input 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    onFocus={() => setShowTitleSuggestions(true)}
                    onBlur={() => setShowTitleSuggestions(false)}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa]" 
                    style={inputBorderRadiusStyle}
                  />
                  {showTitleSuggestions && suggestedTitles.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {suggestedTitles.map((t, i) => (
                        <div 
                          key={i} 
                          className="px-3 py-2 text-sm text-gray-300 hover:bg-[var(--dash-border)] hover:text-[#fafafa] cursor-pointer cursor-default"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent blur
                            setTitle(t);
                            setShowTitleSuggestions(false);
                          }}
                        >
                          {t}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-32 space-y-1">
                  <label className="text-xs text-gray-400">Product ID</label>
                  <input 
                    value={productId}
                    onChange={e => setProductId(e.target.value)}
                    placeholder=""
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa] text-gray-300"
                    style={inputBorderRadiusStyle}
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-gray-400">Category</label>
                  <select value={category} onChange={e => { setCategory(e.target.value); setHasManuallySelectedCategory(true); }} className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa] appearance-none" style={inputBorderRadiusStyle}>
                    <option value="">Select...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-gray-400">Supplier</label>
                  <select value={supplier} onChange={e => setSupplier(e.target.value)} className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa] appearance-none" style={inputBorderRadiusStyle}>
                    <option value="">Select...</option>
                    {suppliers.map((s, i) => (
                      <option key={i} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-400">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg p-2 text-sm focus:outline-none focus:border-[#fafafa] resize-none" />
              </div>
            </div>

            {/* Price */}
            {variants.length === 0 && (
              <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl overflow-hidden p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm text-gray-300">Price</h2>
                  {perms?.profit !== false && <span className="text-xs text-gray-500 font-normal">Profit {formatPrice(Number(sellPrice) - Number(buyPrice) || 0)}</span>}
                </div>
                <div className="flex gap-4">
                  {perms?.buyPrice !== false && (
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-gray-400">Auto Price</label>
                      <input type="number" value={Number.isNaN(Number(autoPrice)) ? '' : autoPrice} onChange={handleAutoPriceChange} className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa]" style={inputBorderRadiusStyle} />
                    </div>
                  )}
                  {perms?.buyPrice !== false && (
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-[#ff4d6d]">Buy *</label>
                      <input type="number" value={Number.isNaN(Number(buyPrice)) ? '' : buyPrice} onChange={e => setBuyPrice(e.target.value)} className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa]" style={inputBorderRadiusStyle} />
                    </div>
                  )}
                  {perms?.sellPrice !== false && (
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-[#ff4d6d]">Sell *</label>
                      <input type="number" value={Number.isNaN(Number(sellPrice)) ? '' : sellPrice} onChange={e => setSellPrice(e.target.value)} className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa]" style={inputBorderRadiusStyle} />
                    </div>
                  )}
                </div>

                <div className="space-y-3 mt-4 pt-4 border-t border-[var(--dash-border)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-300">Quantity Rules</h3>
                  </div>
                  {qtyRules.length > 0 && (
                    <div className="space-y-2">
                      {qtyRules.map((rule, idx) => (
                        <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2.5" style={inputBorderRadiusStyle}>
                          <div className="flex-1 flex items-center bg-[var(--dash-card)] border border-[var(--dash-border)] px-3 py-1.5 focus-within:border-[#fafafa] transition-colors" style={inputBorderRadiusStyle}>
                            <span className="text-xs text-gray-500 mr-2 whitespace-nowrap">Qty &ge;</span>
                            <input 
                              type="number" 
                              value={Number.isNaN(rule.quantity) || rule.quantity === 0 ? '' : rule.quantity}
                              placeholder="e.g. 6"
                              onChange={e => {
                                const newRules = [...qtyRules];
                                newRules[idx].quantity = Number(e.target.value);
                                setQtyRules(newRules);
                              }}
                              className="w-full bg-transparent text-sm text-white focus:outline-none" 
                            />
                          </div>
                          <div className="flex-1 flex items-center bg-[var(--dash-card)] border border-[var(--dash-border)] px-3 py-1.5 focus-within:border-[#fafafa] transition-colors" style={inputBorderRadiusStyle}>
                            <span className="text-xs text-gray-500 mr-2 whitespace-nowrap">Off (৳)</span>
                            <input 
                              type="number" 
                              value={Number.isNaN(rule.price) || rule.price === 0 ? '' : rule.price}
                              placeholder="e.g. 5"
                              onChange={e => {
                                const newRules = [...qtyRules];
                                newRules[idx].price = Number(e.target.value);
                                setQtyRules(newRules);
                              }}
                              className="w-full bg-transparent text-sm text-white focus:outline-none" 
                            />
                          </div>
                          <button onClick={() => setQtyRules(qtyRules.filter((_, i) => i !== idx))} className="shrink-0 p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors" title="Remove rule">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setQtyRules([...qtyRules, { quantity: 0, price: 0 }])}
                      className="flex items-center gap-1.5 text-sm font-medium border border-[var(--dash-border)] text-gray-300 bg-[var(--dash-bg)] px-4 py-2 hover:border-[#fafafa] hover:text-[#fafafa] transition-colors"
                      style={inputBorderRadiusStyle}
                    >
                      <Plus size={16} /> Add Rule
                    </button>
                    {perms?.stock !== false && (
                      <div className="flex-1" style={{ maxWidth: 'calc(33.333% - 11px)' }}>
                        <input 
                          type="number" 
                          placeholder="Stock" 
                          value={Number.isNaN(Number(stock)) ? '' : stock} 
                          onChange={e => setStock(e.target.value)} 
                          className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa]" 
                          style={inputBorderRadiusStyle} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Images */}
            <div>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={images} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-3 gap-2">
                    {images.map((img, i) => {
                      const meta = imagesMeta[i];
                      return (
                        <SortableImage
                          key={img}
                          id={img}
                          img={img}
                          index={i}
                          meta={meta}
                          onOptimize={() => setOptimizingImageIndex(i)}
                          onRemove={() => {
                             setImages(prev => prev.filter((_, idx) => idx !== i));
                             setImagesMeta(prevMeta => {
                                const arr = [];
                                const len = Math.max(Object.keys(prevMeta).length, images.length);
                                for (let j = 0; j < len; j++) arr.push(prevMeta[j]);
                                arr.splice(i, 1);
                                const newMeta: Record<number, ImageMeta> = {};
                                arr.forEach((m, idx) => { if (m) newMeta[idx] = m; });
                                return newMeta;
                             });
                          }}
                        />
                      )
                    })}
                    
                    <label className="relative aspect-square border-2 border-dashed border-[var(--dash-border)] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-[var(--dash-card)] transition-colors text-gray-400 hover:text-[#fafafa] hover:border-[#fafafa]">
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                      <Plus size={24} />
                      <span className="text-[10px] mt-1 text-center px-1">Upload</span>
                    </label>
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            {/* Options block */}
            <div className={cn("bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl", options.length > 0 ? "p-4 space-y-4" : "p-3 flex items-center justify-between")}>
              {options.length > 0 && (
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-300">Options</h2>
                  <button
                    type="button"
                    onClick={() => { setEditingOptionIdx(null); setEditingOption({ name: 'color', values: [] }); }}
                    className="px-3 py-1.5 flex items-center gap-2 border border-[#fafafa] text-[#fafafa] text-sm hover:bg-[#fafafa]/10 cursor-pointer pointer-events-auto"
                    style={inputBorderRadiusStyle}
                  >
                    <Plus size={16} /> Add Option
                  </button>
                </div>
              )}
              {options.length === 0 && (
                <>
                  <h2 className="text-base font-medium text-gray-300">Options</h2>
                  <button
                    type="button"
                    onClick={() => { setEditingOptionIdx(null); setEditingOption({ name: 'color', values: [] }); }}
                    className="px-3 py-1.5 flex items-center gap-2 border border-[#fafafa] text-[#fafafa] text-sm hover:bg-[#fafafa]/10 cursor-pointer pointer-events-auto"
                    style={inputBorderRadiusStyle}
                  >
                    <Plus size={16} /> Add Option
                  </button>
                </>
              )}

              {options.length > 0 && (
                <div className="space-y-3">
                  {options.map((opt, idx) => (
                    <div key={opt.id} className="flex items-start gap-3">
                      <div className="text-gray-400 text-sm py-1 min-w-[3rem]">{opt.name}:</div>
                      <div className="flex-1 flex flex-wrap gap-2">
                        {opt.values.map(val => (
                          <div key={val} className="px-2 py-1 bg-[var(--dash-border)] rounded text-sm text-gray-200">
                            {val}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => {
                        const newOps = options.filter((_, i) => i !== idx);
                        handleSaveOptions(newOps);
                      }} className="text-[#ff4d6d] p-1 hover:bg-[#ff4d6d]/10 rounded flex-shrink-0">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 1688 Sourcing Info (Internal Dashboard Only) */}
            <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-300">1688 Sourcing Details</span>
                <span className="text-[10px] text-gray-500 font-medium">Internal Only</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">1688 Product ID</label>
                  <input 
                    value={code1688}
                    onChange={e => setCode1688(e.target.value)}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa] text-gray-300"
                    style={inputBorderRadiusStyle}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">1688 Product Link</label>
                  <input 
                    value={link1688}
                    onChange={e => {
                      const raw = e.target.value;
                      const cleaned = clean1688Url(raw);
                      setLink1688(cleaned || raw);
                    }}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa] text-gray-300"
                    style={inputBorderRadiusStyle}
                  />
                </div>
              </div>
            </div>

            {/* Variants */}
            {variants.length > 0 && (
              <div className="space-y-4 mt-4">
                <div className="flex items-center gap-2 mb-2">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>
                  <span className="text-xl font-bold text-[#fafafa]">{variants.length}</span>
                  <span className="text-xl font-medium text-white">Variants</span>
                </div>
                <div className="space-y-4">
                  {variants.map((variant, vIdx) => {
                    const variantName = Object.values(variant.options).map(v => String(v).toUpperCase()).join(' ');
                    return (
                      <div key={variant.id} className={cn(
                        "bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 flex flex-col gap-4 transition-all duration-300",
                        (variant.stock !== undefined && variant.stock !== null && Number(variant.stock) <= 0) 
                          ? "opacity-50 grayscale hover:opacity-100 hover:grayscale-0" 
                          : ""
                      )}>
                        {/* Top row */}
                        <div className="flex items-start gap-3">
                          <button 
                            onClick={() => setSelectingImageForVariant(variant.id)}
                            className="w-[84px] h-[84px] rounded-lg bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center relative"
                          >
                            {variant.image ? (
                              <img src={variant.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon size={24} className="text-gray-500" />
                            )}
                          </button>
                          
                          <div className="flex-1 flex flex-col justify-between h-[84px] py-1">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="font-bold text-white tracking-wide uppercase text-sm mt-1">{variantName}</span>
                                {(variant.stock !== undefined && variant.stock !== null && Number(variant.stock) <= 0) && (
                                  <span className="text-[10px] bg-red-500/20 text-red-500 font-bold px-1.5 py-0.5 rounded uppercase">Stock Out</span>
                                )}
                              </div>
                              {perms?.stock !== false && (
                                <div className="flex gap-2 items-center text-xs bg-[var(--dash-bg)] px-2 py-1 border border-[var(--dash-border)] text-white" style={inputBorderRadiusStyle}>
                                  <Package size={14} className="text-gray-400" />
                                  <input 
                                    className="bg-transparent w-10 text-right outline-none placeholder-white"
                                    placeholder="0"
                                    value={Number.isNaN(Number(variant.stock)) || variant.stock === undefined || variant.stock === null ? '' : variant.stock}
                                    onChange={e => {
                                      const next = [...variants];
                                      next[vIdx] = { ...next[vIdx], stock: e.target.value ? Number(e.target.value) : undefined };
                                      setVariants(next);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex justify-between items-end mt-auto">
                              <span className="text-xs text-gray-400 font-mono tracking-wider ml-1">0 / 0</span>
                              <button className="flex items-center gap-2 text-xs border border-[#fafafa] text-[#fafafa] px-3 py-1.5 hover:bg-[#fafafa]/10 transition-colors pointer-events-none rounded-lg">
                                <Minus size={14} /> Price
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Bottom Row - Prices */}
                        {perms?.profit !== false && (
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-500 font-normal ml-auto">
                              Profit {formatPrice((variant.price || 0) - (variant.buyPrice || 0))}
                            </span>
                          </div>
                        )}
                        <div className="flex gap-4">
                          {perms?.buyPrice !== false && (
                            <div className="flex-1 space-y-1">
                              <label className="text-xs text-gray-400">Auto Price</label>
                              <input 
                                type="number"
                                value={Number.isNaN(Number(variant.autoPrice)) || variant.autoPrice === undefined || variant.autoPrice === null ? '' : variant.autoPrice}
                                onChange={e => {
                                  const val = e.target.value;
                                  const next = [...variants];
                                  let updatedVariant = { ...next[vIdx], autoPrice: val };
                                  
                                  if (val && priceCalculatorSettings) {
                                    const numVal = Number(val);
                                    if (!isNaN(numVal)) {
                                      const calculatedBuyPrice = Math.floor((priceCalculatorSettings.yuanRate * numVal) + priceCalculatorSettings.additionalCost);
                                      const calculatedSellPrice = Math.floor(calculatedBuyPrice + priceCalculatorSettings.profit);
                                      updatedVariant.buyPrice = calculatedBuyPrice;
                                      updatedVariant.price = calculatedSellPrice;
                                    }
                                  }
                                  next[vIdx] = updatedVariant;
                                  setVariants(next);
                                }}
                                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa]"
                                style={inputBorderRadiusStyle}
                              />
                            </div>
                          )}
                          {perms?.buyPrice !== false && (
                            <div className="flex-1 space-y-1">
                              <label className="text-xs text-[#ff4d6d]">Buy *</label>
                              <input 
                                type="number"
                                value={Number.isNaN(Number(variant.buyPrice)) || variant.buyPrice === undefined || variant.buyPrice === null ? '' : variant.buyPrice}
                                onChange={e => {
                                  const next = [...variants];
                                  next[vIdx] = { ...next[vIdx], buyPrice: e.target.value ? Number(e.target.value) : undefined };
                                  setVariants(next);
                                }}
                                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa]"
                                style={inputBorderRadiusStyle}
                              />
                            </div>
                          )}
                          {perms?.sellPrice !== false && (
                            <div className="flex-1 space-y-1">
                              <label className="text-xs text-[#ff4d6d]">Sell *</label>
                              <input 
                                type="number"
                                value={Number.isNaN(Number(variant.price)) || variant.price === undefined || variant.price === null ? '' : variant.price}
                                onChange={e => {
                                  const next = [...variants];
                                  next[vIdx] = { ...next[vIdx], price: e.target.value ? Number(e.target.value) : undefined };
                                  setVariants(next);
                                }}
                                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2 text-sm focus:outline-none focus:border-[#fafafa]"
                                style={inputBorderRadiusStyle}
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-[var(--dash-border)]">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quantity Rules</h3>
                          </div>
                          {(variant.qtyRules && variant.qtyRules.length > 0) && (
                            <div className="space-y-2">
                              {variant.qtyRules.map((rule, idx) => (
                                <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-[var(--dash-bg)] border border-[var(--dash-border)] p-2" style={inputBorderRadiusStyle}>
                                  <div className="flex-1 flex items-center bg-[var(--dash-card)] border border-[var(--dash-border)] px-2 py-1 focus-within:border-[#fafafa] transition-colors" style={inputBorderRadiusStyle}>
                                    <span className="text-[10px] text-gray-500 mr-2 whitespace-nowrap">Qty &ge;</span>
                                    <input 
                                      type="number" 
                                      value={Number.isNaN(rule.quantity) || rule.quantity === 0 ? '' : rule.quantity}
                                      onChange={e => {
                                        const nextVariants = [...variants];
                                        const vRules = [...(nextVariants[vIdx].qtyRules || [])];
                                        vRules[idx] = { ...vRules[idx], quantity: Number(e.target.value) };
                                        nextVariants[vIdx].qtyRules = vRules;
                                        setVariants(nextVariants);
                                      }}
                                      className="w-full bg-transparent text-xs text-white focus:outline-none" 
                                    />
                                  </div>
                                  <div className="flex-1 flex items-center bg-[var(--dash-card)] border border-[var(--dash-border)] px-2 py-1 focus-within:border-[#fafafa] transition-colors" style={inputBorderRadiusStyle}>
                                    <span className="text-[10px] text-gray-500 mr-2 whitespace-nowrap">Off (৳)</span>
                                    <input 
                                      type="number" 
                                      value={Number.isNaN(rule.price) || rule.price === 0 ? '' : rule.price}
                                      onChange={e => {
                                        const nextVariants = [...variants];
                                        const vRules = [...(nextVariants[vIdx].qtyRules || [])];
                                        vRules[idx] = { ...vRules[idx], price: Number(e.target.value) };
                                        nextVariants[vIdx].qtyRules = vRules;
                                        setVariants(nextVariants);
                                      }}
                                      className="w-full bg-transparent text-xs text-white focus:outline-none" 
                                    />
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const nextVariants = [...variants];
                                      nextVariants[vIdx].qtyRules = nextVariants[vIdx].qtyRules?.filter((_, i) => i !== idx);
                                      setVariants(nextVariants);
                                    }} 
                                    className="shrink-0 p-1 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                const nextVariants = [...variants];
                                const vRules = nextVariants[vIdx].qtyRules || [];
                                nextVariants[vIdx].qtyRules = [...vRules, { quantity: 0, price: 0 }];
                                setVariants(nextVariants);
                              }}
                              className="flex items-center gap-1.5 text-xs font-medium border border-[var(--dash-border)] text-gray-300 bg-[var(--dash-bg)] px-3 py-1.5 hover:border-[#fafafa] hover:text-[#fafafa] transition-colors"
                              style={inputBorderRadiusStyle}
                            >
                              <Plus size={14} /> Add Rule
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Bottom Action */}
          {hasChanges && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-[var(--dash-bg)] border-t border-[var(--dash-border)] z-10">
              <div className="max-w-4xl mx-auto w-full">
                <button 
                  onClick={handleSave}
                  className="w-full bg-[#fafafa] text-[var(--dash-bg)] font-bold py-3 rounded-full hover:bg-[#e4e4e7] transition-colors"
                  >
                  {initialProduct ? 'Save Changes' : 'Add Product'}
                </button>
              </div>
            </div>
          )}

          <ImageOptimizerModal 
             isOpen={optimizingImageIndex !== null}
             onClose={() => setOptimizingImageIndex(null)}
             originalDataUrl={optimizingImageIndex !== null ? imagesMeta[optimizingImageIndex]?.originalDataUrl || images[optimizingImageIndex] : ''}
             originalSize={optimizingImageIndex !== null ? imagesMeta[optimizingImageIndex]?.originalSize || 0 : 0}
             initialWidth={optimizingImageIndex !== null ? imagesMeta[optimizingImageIndex]?.width || 800 : 800}
             initialHeight={optimizingImageIndex !== null ? imagesMeta[optimizingImageIndex]?.height || 800 : 800}
             onSave={(optimizedDataUrl, originalSize, optimizedSize) => {
                if (optimizingImageIndex !== null) {
                   setImages(prev => {
                      const next = [...prev];
                      next[optimizingImageIndex] = optimizedDataUrl;
                      return next;
                   });
                   setImagesMeta(m => {
                     const existing = m[optimizingImageIndex] || {
                        originalDataUrl: images[optimizingImageIndex],
                        originalSize: originalSize,
                        width: 1000,
                        height: 1000,
                        isProcessing: false,
                     };
                     return {
                       ...m,
                       [optimizingImageIndex]: {
                          ...existing,
                          optimizedSize
                       }
                     };
                   });
                }
                setOptimizingImageIndex(null);
             }}
          />

          {editingOption && (
            <div className="absolute inset-0 bg-[var(--dash-bg)]/95 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-[var(--dash-bg)] w-full max-w-md border border-[var(--dash-border)] rounded-xl flex flex-col overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-4">
                  <h3 className="text-[#ff4d6d] text-sm font-medium">Option Name *</h3>
                  <button onClick={() => { setEditingOption(null); setOptionInputVal(''); }}><X size={20} className="text-gray-400" /></button>
                </div>
                <div className="p-4 space-y-4 pt-0">
                   <div className="relative border border-[#fafafa] p-2 focus-within:ring-1 focus-within:ring-[#fafafa] rounded-full">
                     <input 
                       value={editingOption.name} 
                       onChange={e => setEditingOption({...editingOption, name: e.target.value.toLowerCase()})} 
                       onFocus={() => setShowOptionSuggestions(true)}
                       onBlur={() => setTimeout(() => setShowOptionSuggestions(false), 200)}
                       placeholder="e.g. color"
                       className="bg-transparent w-full outline-none text-white px-2" 
                     />
                     <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#fafafa] pointer-events-none" />
                     {showOptionSuggestions && (
                       <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-xl overflow-hidden z-50">
                         {PRE_MADE_OPTIONS.map(opt => (
                           <div 
                             key={opt}
                             className="px-4 py-3 text-sm text-gray-300 hover:bg-[var(--dash-border)] cursor-pointer flex justify-between items-center"
                             onClick={() => {
                               setEditingOption({...editingOption, name: opt});
                               setShowOptionSuggestions(false);
                             }}
                           >
                             {opt}
                             {editingOption.name === opt && <Check size={16} className="text-[#fafafa]" />}
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                   
                   <div className="border border-[var(--dash-border)] rounded-xl p-4 space-y-4">
                     <label className="text-sm text-gray-400">Option Values</label>
                     <div className="space-y-2">
                       {[...editingOption.values, ''].map((v, idx) => {
                         const isLast = idx === editingOption.values.length;
                         return (
                           <div key={idx} className={cn("flex p-3 items-center justify-between border rounded-full", isLast ? "border-[var(--dash-border)] bg-[var(--dash-card)]" : "border-[#fafafa]")}>
                             <div className="flex items-center gap-3 flex-1">
                               {!isLast ? <GripVertical size={16} className="text-gray-500" /> : <div className="w-4" />}
                               <input 
                                 value={v}
                                 placeholder={isLast ? "Enter Value" : ""}
                                 onChange={e => {
                                   const nv = [...editingOption.values];
                                   if (isLast) {
                                     nv.push(e.target.value);
                                   } else {
                                     nv[idx] = e.target.value;
                                   }
                                   setEditingOption({...editingOption, values: nv});
                                 }}
                                 className="bg-transparent w-full outline-none text-white text-sm"
                               />
                             </div>
                             {!isLast && (
                               <button onClick={() => {
                                 const nv = [...editingOption.values];
                                 nv.splice(idx, 1);
                                 setEditingOption({...editingOption, values: nv});
                               }}>
                                 <Trash2 size={16} className="text-[#ff4d6d]" />
                               </button>
                             )}
                           </div>
                         )
                       })}
                     </div>
                   </div>

                   <button 
                     onClick={() => {
                       let finalVals = editingOption.values.map(s => s.trim()).filter(Boolean);
                       if (!editingOption.name || finalVals.length === 0) return;
                       
                       let newOpts = [...options];
                       if (editingOptionIdx !== null) {
                         newOpts[editingOptionIdx] = { id: newOpts[editingOptionIdx].id, name: editingOption.name, values: finalVals };
                       } else {
                         newOpts.push({ id: Date.now().toString(), name: editingOption.name, values: finalVals });
                       }
                       handleSaveOptions(newOpts);
                       setEditingOption(null);
                       setOptionInputVal('');
                       setEditingOptionIdx(null);
                     }}
                     className="w-full bg-[#fafafa] text-[var(--dash-bg)] font-bold py-3 mt-4 hover:bg-[#e4e4e7]"
                     style={inputBorderRadiusStyle}
                   >
                     Save
                   </button>
                </div>
              </div>
            </div>
          )}

          {selectingImageForVariant && (
            <div className="absolute inset-0 bg-[var(--dash-bg)]/95 z-[130] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-[var(--dash-bg)] w-full max-w-md border border-[var(--dash-border)] rounded-xl flex flex-col overflow-hidden shadow-2xl">
                <div className="flex justify-between items-center p-4">
                  <h3 className="text-white text-sm font-medium uppercase tracking-wide">
                    {(() => {
                        const variant = variants.find(v => v.id === selectingImageForVariant);
                        return variant ? Object.values(variant.options).join(' ') : 'SELECT IMAGE';
                    })()}
                  </h3>
                  <button onClick={() => setSelectingImageForVariant(null)}><X size={20} className="text-gray-400" /></button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
                  {images.map((img, i) => {
                    const currentImg = variants.find(v => v.id === selectingImageForVariant)?.image;
                    const isSelected = currentImg === img;
                    return (
                      <button 
                        key={i} 
                        onClick={() => {
                          const next = [...variants];
                          const vIdx = next.findIndex(v => v.id === selectingImageForVariant);
                          if (vIdx !== -1) {
                            next[vIdx] = { ...next[vIdx], image: img };
                            setVariants(next);
                          }
                          setSelectingImageForVariant(null);
                        }}
                        className={cn("relative aspect-square bg-[var(--dash-card)] rounded-lg overflow-hidden border-2 transition-all", isSelected ? "border-[#fafafa]" : "border-transparent block")}
                      >
                         <img src={img} className="w-full h-full object-cover" alt=""/>
                         {isSelected && (
                           <div className="absolute top-2 left-2 bg-[#fafafa] p-0.5 rounded shadow">
                             <Check size={12} className="text-[var(--dash-bg)]" />
                           </div>
                         )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

        </motion.div>
      )}
    </AnimatePresence>
  );
}
