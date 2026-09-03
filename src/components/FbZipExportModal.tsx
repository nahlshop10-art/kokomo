import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft,
  ChevronLeft,
  Download, 
  FileText, 
  FolderArchive, 
  CheckCircle2, 
  AlertCircle, 
  Image as ImageIcon,
  FolderTree,
  Check,
  Sparkles,
  Info,
  MoreVertical,
  Lock,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import JSZip from 'jszip';
import { Product, Category, WebsiteSettings } from '../types';
import { cn } from '../lib/utils';

interface FbZipExportModalProps {
  onClose: () => void;
  products: Product[];
  categories: Category[];
  websiteSettings?: WebsiteSettings;
  themePrimary?: string;
}

// Dotted/dashed line divider for text.txt
const DIVIDER_LINE = '┈┈┈┈┈┈┈┈┈┈';

/**
 * Checks if a product is currently in-stock
 */
export function isProductInStock(product: Product): boolean {
  if (product.variants && product.variants.length > 0) {
    return product.variants.some((v: any) => {
      if (v.isVisible === false) return false;
      return (v.stock !== undefined && v.stock !== null) ? Number(v.stock) > 0 : true;
    });
  }
  return (product.stock !== undefined && product.stock !== null) ? Number(product.stock) > 0 : false;
}

/**
 * Generates the text.txt content according to FB Auto-Sender format specification
 */
export function generateProductCaption(
  product: Product,
  categories: Category[],
  moqDiscount: number = 5,
  fallbackCategory: string = 'GENERAL'
): string {
  let catName = fallbackCategory;
  if (product.category) {
    const foundCat = categories.find(
      c => c.id === product.category || c.name.toLowerCase() === product.category.toLowerCase()
    );
    catName = (foundCat?.name || product.category).trim();
  }
  if (!catName || catName.toLowerCase() === 'uncategorized') {
    catName = fallbackCategory;
  }
  const categoryUpper = catName.toUpperCase();

  const price = Math.round(Number(product.price) || 0);
  const moqPrice = Math.max(0, price - moqDiscount);

  return `${categoryUpper}\n----------------------\n${price} TK / PER PIECES \n${moqPrice} TK / MOQ-6\n----------------------`;
}

function getExtension(url: string, blob?: Blob): string {
  if (blob && blob.type) {
    if (blob.type.includes('png')) return '.png';
    if (blob.type.includes('webp')) return '.webp';
    if (blob.type.includes('jpeg') || blob.type.includes('jpg')) return '.jpg';
    if (blob.type.includes('gif')) return '.gif';
  }
  const cleanUrl = url.split('?')[0].split('#')[0];
  const match = cleanUrl.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i);
  if (match) {
    return match[0].toLowerCase();
  }
  return '.webp';
}

async function fetchHighResImageBlob(url: string): Promise<{ blob: Blob; ext: string } | null> {
  if (!url) return null;

  try {
    if (url.startsWith('data:image/')) {
      const parts = url.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/webp';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      return { blob, ext: getExtension(url, blob) };
    }

    const proxyEndpoint = `/api/proxy_image?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const proxyRes = await fetch(proxyEndpoint, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (proxyRes.ok) {
        const blob = await proxyRes.blob();
        if (blob && blob.size > 0) {
          return { blob, ext: getExtension(url, blob) };
        }
      }
    } catch (proxyErr) {
      console.warn('Proxy fetch fallback to direct fetch', proxyErr);
    }

    const directRes = await fetch(url, { mode: 'cors' });
    if (directRes.ok) {
      const blob = await directRes.blob();
      if (blob && blob.size > 0) {
        return { blob, ext: getExtension(url, blob) };
      }
    }
  } catch (e) {
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(null);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((b) => resolve(b), 'image/webp', 0.95);
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });

      if (blob && blob.size > 0) {
        return { blob, ext: '.webp' };
      }
    } catch {
      // Ignored
    }
  }

  return null;
}

export default function FbZipExportModal({ 
  onClose, 
  products, 
  categories, 
  websiteSettings,
  themePrimary = '#6366F1' 
}: FbZipExportModalProps) {
  const primaryColor = '#6366F1';

  const [moqDiscount, setMoqDiscount] = useState<number>(5);
  const [fallbackCategory, setFallbackCategory] = useState<string>('GENERAL');
  const [folderNaming, setFolderNaming] = useState<'sequential' | 'productId'>('sequential');
  const [maxImagesPerProduct, setMaxImagesPerProduct] = useState<number>(3);
  const [customImageLimit, setCustomImageLimit] = useState<string>('3');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState<number>(0);

  const [exportState, setExportState] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [exportedCount, setExportedCount] = useState<number>(0);
  const [totalImagesExported, setTotalImagesExported] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const cancelRef = useRef<boolean>(false);

  // Filter in-stock products
  const { inStockProducts, outOfStockCount } = useMemo(() => {
    const inStock: Product[] = [];
    let outCount = 0;

    for (const p of products) {
      if (isProductInStock(p)) {
        inStock.push(p);
      } else {
        outCount++;
      }
    }

    return { inStockProducts: inStock, outOfStockCount: outCount };
  }, [products]);

  // Preview product calculation
  const sampleProduct = inStockProducts[selectedPreviewIndex] || inStockProducts[0];
  const sampleCaption = useMemo(() => {
    if (!sampleProduct) return '';
    return generateProductCaption(sampleProduct, categories, moqDiscount, fallbackCategory);
  }, [sampleProduct, categories, moqDiscount, fallbackCategory]);

  // Estimate total images
  const estimatedImagesCount = useMemo(() => {
    let count = 0;
    for (const p of inStockProducts) {
      let prodImgCount = 0;
      if (p.image) prodImgCount++;
      if (Array.isArray(p.images)) {
        for (const img of p.images) {
          if (img && img !== p.image) prodImgCount++;
        }
      }
      if (prodImgCount === 0 && p.thumbnail) prodImgCount++;
      const limited = maxImagesPerProduct > 0 ? Math.min(prodImgCount, maxImagesPerProduct) : prodImgCount;
      count += limited;
    }
    return count;
  }, [inStockProducts, maxImagesPerProduct]);

  const handleSelectPreset = (count: number) => {
    setIsCustomMode(false);
    setMaxImagesPerProduct(count);
  };

  const handleCustomChange = (val: string) => {
    setCustomImageLimit(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setMaxImagesPerProduct(Math.min(50, parsed));
    } else if (val === '0') {
      setMaxImagesPerProduct(0);
    }
  };

  const handleStartExport = async () => {
    if (inStockProducts.length === 0) {
      alert('No in-stock products found to export.');
      return;
    }

    cancelRef.current = false;
    setExportState('exporting');
    setProgressPercent(0);
    setStatusMessage('Preparing ZIP file...');
    setErrorMessage('');

    try {
      const zip = new JSZip();
      const datasetFolder = zip.folder('export_dataset') || zip;
      
      const total = inStockProducts.length;
      let totalImages = 0;
      let completedProducts = 0;

      const CONCURRENCY = 4;
      for (let i = 0; i < total; i += CONCURRENCY) {
        if (cancelRef.current) {
          setExportState('idle');
          return;
        }

        const batch = inStockProducts.slice(i, i + CONCURRENCY);
        
        await Promise.all(batch.map(async (prod, batchOffset) => {
          const productIndex = i + batchOffset;
          const folderName = folderNaming === 'sequential' 
            ? `${productIndex + 1}` 
            : `${prod.id || productIndex + 1}`;

          const folder = datasetFolder.folder(folderName);
          if (!folder) return;

          // 1. Write text.txt
          const caption = generateProductCaption(prod, categories, moqDiscount, fallbackCategory);
          folder.file('text.txt', caption);

          // 2. Collect high-res photos
          const highResImgUrls: string[] = [];
          if (prod.image && !prod.image.includes('thumb_')) {
            highResImgUrls.push(prod.image);
          }
          if (Array.isArray(prod.images)) {
            for (const img of prod.images) {
              if (img && !img.includes('thumb_') && !highResImgUrls.includes(img)) {
                highResImgUrls.push(img);
              }
            }
          }
          if (highResImgUrls.length === 0 && prod.image) {
            highResImgUrls.push(prod.image);
          }
          if (highResImgUrls.length === 0 && prod.thumbnail) {
            highResImgUrls.push(prod.thumbnail);
          }

          const selectedImgUrls = maxImagesPerProduct > 0 
            ? highResImgUrls.slice(0, maxImagesPerProduct)
            : highResImgUrls;

          // 3. Download image blobs
          let imgSeq = 1;
          for (const url of selectedImgUrls) {
            if (cancelRef.current) return;
            const res = await fetchHighResImageBlob(url);
            if (res && res.blob) {
              const filename = `image_${imgSeq}${res.ext}`;
              folder.file(filename, res.blob);
              totalImages++;
              imgSeq++;
            }
          }

          completedProducts++;
          const pct = Math.round((completedProducts / total) * 90);
          setProgressPercent(pct);
          setStatusMessage(`Packaging product ${completedProducts} of ${total}: "${prod.title.slice(0, 22)}..."`);
        }));

        await new Promise(r => setTimeout(r, 10));
      }

      if (cancelRef.current) {
        setExportState('idle');
        return;
      }

      setStatusMessage('Creating high-resolution ZIP package...');
      setProgressPercent(95);

      const zipBlob = await zip.generateAsync(
        { 
          type: 'blob', 
          compression: 'DEFLATE', 
          compressionOptions: { level: 6 } 
        }, 
        (metadata) => {
          setProgressPercent(95 + Math.round(metadata.percent * 0.05));
        }
      );

      const timestamp = new Date().toISOString().slice(0, 10);
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `fb_instock_dataset_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setExportedCount(completedProducts);
      setTotalImagesExported(totalImages);
      setProgressPercent(100);
      setExportState('success');
    } catch (err: any) {
      console.error('FB ZIP Export error:', err);
      setErrorMessage(err?.message || 'An error occurred during ZIP creation.');
      setExportState('error');
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setExportState('idle');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[260px]">
      
      {/* 1. Standardized Header */}
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
            
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
              <FolderArchive size={20} strokeWidth={2} />
            </div>

            <div className="flex items-center gap-2.5">
              <h1 className="text-base md:text-lg font-bold text-white tracking-tight">
                Download FB Zip
              </h1>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                IN-STOCK
              </span>
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

      {/* 2. Main Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-4 py-5 md:p-8 space-y-4 max-w-4xl mx-auto w-full pb-36 custom-scrollbar">

        {/* Export Progress Notification (Visible during active export) */}
        {exportState === 'exporting' && (
          <div className="bg-[var(--dash-card)] rounded-2xl p-5 border border-indigo-500/40 shadow-xl space-y-3.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <RefreshCw size={16} className="animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Downloading Images &amp; Building ZIP</h3>
                  <p className="text-xs text-slate-400 truncate max-w-xs sm:max-w-md">{statusMessage}</p>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-indigo-400">{progressPercent}%</span>
            </div>

            <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full rounded-full bg-indigo-600 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCancel}
                className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancel Export
              </button>
            </div>
          </div>
        )}

        {/* Export Success Notification */}
        {exportState === 'success' && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4.5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ZIP Archive Downloaded Successfully!</h3>
                <p className="text-xs text-emerald-300">
                  Exported {exportedCount} in-stock products with {totalImagesExported} high-resolution photos.
                </p>
              </div>
            </div>
            <button
              onClick={() => setExportState('idle')}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 text-white text-xs font-semibold hover:bg-white/15 transition-colors shrink-0 cursor-pointer"
            >
              Export Again
            </button>
          </div>
        )}

        {/* Top 3 Metric Cards Grid */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
          {/* In-Stock */}
          <div className="bg-[var(--dash-card)] rounded-2xl p-3.5 sm:p-4 border border-[var(--dash-border)]/70 shadow-xl flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
              <CheckCircle2 size={13} className="text-emerald-400" /> IN-STOCK
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">{inStockProducts.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-normal">Ready to export</div>
            </div>
          </div>

          {/* Stock Out */}
          <div className="bg-[var(--dash-card)] rounded-2xl p-3.5 sm:p-4 border border-[var(--dash-border)]/70 shadow-xl flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400 uppercase tracking-wide">
              <span className="w-3 h-3 rounded-full border-[1.5px] border-amber-400 flex items-center justify-center text-[7px] font-black">!</span> 
              STOCK OUT
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">{outOfStockCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-normal">Auto-skipped</div>
            </div>
          </div>

          {/* High-Res Pics */}
          <div className="bg-[var(--dash-card)] rounded-2xl p-3.5 sm:p-4 border border-[var(--dash-border)]/70 shadow-xl flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-400 uppercase tracking-wide">
              <ImageIcon size={13} className="text-indigo-400" /> HIGH-RES PICS
            </div>
            <div className="mt-2.5">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">~{estimatedImagesCount}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 font-normal">Images total</div>
            </div>
          </div>
        </div>

        {/* Card 2: Photos per Product */}
        <div className="bg-[var(--dash-card)] rounded-2xl p-4 sm:p-6 border border-[var(--dash-border)]/70 shadow-xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                <ImageIcon size={18} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">Photos per Product</h2>
                <p className="text-xs text-slate-400 mt-0.5 font-normal">
                  Limit how many gallery photos to include per product folder.
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20 shrink-0">
              {maxImagesPerProduct === 0 ? 'All Photos' : `Max ${maxImagesPerProduct}`}
            </span>
          </div>

          {/* 2x3 Grid of Buttons */}
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '1 Photo', val: 1 },
                { label: '2 Photos', val: 2 },
                { label: '3 Photos', val: 3 },
                { label: '5 Photos', val: 5 },
                { label: 'All Photos', val: 0 },
                { label: 'Custom', val: -1 }
              ].map((item) => {
                const isSelected = item.val === -1 ? isCustomMode : (!isCustomMode && maxImagesPerProduct === item.val);
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.val === -1) {
                        setIsCustomMode(true);
                      } else {
                        handleSelectPreset(item.val);
                      }
                    }}
                    className={cn(
                      "py-2.5 px-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center cursor-pointer border",
                      isSelected
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25 font-bold"
                        : "bg-[var(--dash-bg)] text-slate-300 border-[var(--dash-border)] hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Input Field (If Custom selected) */}
            {isCustomMode && (
              <div className="bg-[var(--dash-bg)] border border-indigo-500/40 rounded-xl p-3 flex items-center gap-3 animate-in fade-in">
                <span className="text-xs text-slate-300 font-medium">Custom Quantity:</span>
                <input 
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="50"
                  value={customImageLimit}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-20 bg-[var(--dash-card)] text-white text-center font-bold border border-[var(--dash-border)] rounded-lg py-1 text-xs outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400">photos max per product</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
              <Info size={13} className="text-indigo-400 shrink-0" />
              <span>All images are exported in original full resolution (no compression/blur).</span>
            </div>
          </div>
        </div>

        {/* Card 3: FB Caption & Price Rules */}
        <div className="bg-[var(--dash-card)] rounded-2xl p-4 sm:p-6 border border-[var(--dash-border)]/70 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <FileText size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">FB Caption &amp; Price Rules</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-normal">
                Formatted specifically for FB Messenger Auto-Sender app.
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {/* MOQ-6 Discount */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-200">MOQ-6 Discount Amount (TK)</label>
              <div className="relative">
                <input 
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="500"
                  value={moqDiscount}
                  onChange={(e) => setMoqDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 font-mono text-xs focus:border-indigo-500 outline-none"
                />
                <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">TK OFF</span>
              </div>
              <p className="text-[11px] text-slate-500">Deducted from selling price for MOQ-6 caption (Default: 5 TK).</p>
            </div>

            {/* Fallback Category */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-200">Fallback Category Name</label>
              <input 
                type="text"
                value={fallbackCategory}
                onChange={(e) => setFallbackCategory(e.target.value.toUpperCase())}
                className="w-full bg-[var(--dash-bg)] text-white border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 uppercase font-mono text-xs focus:border-indigo-500 outline-none"
                placeholder="GENERAL"
              />
              <p className="text-[11px] text-slate-500">Used if a product has no category (Default: GENERAL).</p>
            </div>

            {/* Live Text Preview Box */}
            <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3.5 space-y-2.5 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    LIVE TEXT PREVIEW
                  </span>
                </div>

                {inStockProducts.length > 1 && (
                  <div className="relative">
                    <select
                      value={selectedPreviewIndex}
                      onChange={(e) => setSelectedPreviewIndex(Number(e.target.value))}
                      className="text-xs bg-[var(--dash-card)] text-slate-200 border border-[var(--dash-border)] rounded-lg pl-2.5 pr-7 py-1 outline-none max-w-[180px] sm:max-w-[220px] truncate appearance-none cursor-pointer"
                    >
                      {inStockProducts.slice(0, 30).map((p, idx) => (
                        <option key={p.id || idx} value={idx}>
                          {idx + 1}. {p.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>

              <div className="bg-black/30 border border-[var(--dash-border)] rounded-xl p-3 font-mono text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed">
                {sampleCaption || 'No in-stock products available for preview.'}
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: ZIP Folder Structure */}
        <div className="bg-[var(--dash-card)] rounded-2xl p-4 sm:p-6 border border-[var(--dash-border)]/70 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <FolderTree size={18} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">ZIP Folder Structure</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-normal">
                Choose how product subfolders inside the ZIP archive should be named.
              </p>
            </div>
          </div>

          {/* 2 Radio Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Sequential */}
            <div 
              onClick={() => setFolderNaming('sequential')}
              className={cn(
                "p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all",
                folderNaming === 'sequential' 
                  ? "bg-indigo-500/10 border-indigo-500 text-white" 
                  : "bg-[var(--dash-bg)] border-[var(--dash-border)] text-slate-300 hover:bg-white/5"
              )}
            >
              <div className="w-4 h-4 rounded-full border-2 border-indigo-500 flex items-center justify-center shrink-0">
                {folderNaming === 'sequential' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
              </div>
              <div>
                <div className="text-xs font-bold">Sequential Numbers (1, 2, 3...)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Recommended for FB Auto Sender</div>
              </div>
            </div>

            {/* Product IDs */}
            <div 
              onClick={() => setFolderNaming('productId')}
              className={cn(
                "p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition-all",
                folderNaming === 'productId' 
                  ? "bg-indigo-500/10 border-indigo-500 text-white" 
                  : "bg-[var(--dash-bg)] border-[var(--dash-border)] text-slate-300 hover:bg-white/5"
              )}
            >
              <div className="w-4 h-4 rounded-full border-2 border-slate-500 flex items-center justify-center shrink-0">
                {folderNaming === 'productId' && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
              </div>
              <div>
                <div className="text-xs font-bold">Product IDs (P001, P002...)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Uses your internal product SKU/ID</div>
              </div>
            </div>
          </div>

          {/* Directory Visual Tree */}
          <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3.5 font-mono text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span>📁</span>
              <span className="font-bold text-white">export_dataset/</span>
            </div>
            <div className="pl-4 flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-500">└──</span>
              <span>📁</span>
              <span className="text-indigo-400 font-bold">{folderNaming === 'sequential' ? '1/' : 'P001/'}</span>
              <span className="text-slate-400">(Product 1)</span>
            </div>
            <div className="pl-8 flex items-center gap-1.5 text-slate-400">
              <span className="text-slate-600">├──</span>
              <span>🖼️</span>
              <span className="text-amber-300">image_1.webp</span>
              <span className="text-slate-500">(Original High-Res)</span>
            </div>
            {maxImagesPerProduct !== 1 && (
              <div className="pl-8 flex items-center gap-1.5 text-slate-400">
                <span className="text-slate-600">├──</span>
                <span>🖼️</span>
                <span className="text-amber-300">image_2.webp</span>
                <span className="text-slate-500">(Gallery Photo)</span>
              </div>
            )}
            <div className="pl-8 flex items-center gap-1.5 text-slate-400">
              <span className="text-slate-600">└──</span>
              <span>📄</span>
              <span className="text-emerald-400">text.txt</span>
              <span className="text-slate-500">(Formatted caption)</span>
            </div>
            <div className="pl-4 flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-500">└──</span>
              <span>📁</span>
              <span className="text-indigo-400 font-bold">{folderNaming === 'sequential' ? '2/' : 'P002/'}</span>
              <span className="text-slate-400">(Product 2)</span>
            </div>
            <div className="pl-8 text-slate-600">
              └── .....
            </div>
          </div>
        </div>

      </div>

      {/* 3. Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[260px] px-4 py-3 bg-[var(--dash-bg)]/95 backdrop-blur-md border-t border-[var(--dash-border)]/70 z-[110] shadow-2xl pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button 
            onClick={onClose}
            disabled={exportState === 'exporting'}
            className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 hover:text-white font-semibold hover:bg-white/10 transition-colors text-xs sm:text-sm disabled:opacity-40 cursor-pointer"
          >
            Back
          </button>

          <button 
            onClick={handleStartExport}
            disabled={exportState === 'exporting' || inStockProducts.length === 0}
            className="flex-1 py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 font-bold text-xs sm:text-sm text-white transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportState === 'exporting' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Exporting {progressPercent}%...</span>
              </>
            ) : (
              <>
                <Download size={17} strokeWidth={2.4} />
                <span>Download FB Zip ({inStockProducts.length} In-Stock Products)</span>
              </>
            )}
          </button>
        </div>

        {/* Subtitle footer */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-2">
          <Lock size={11} className="text-slate-400" />
          <span>Secure export • Original quality</span>
        </div>
      </div>

    </div>
  );
}
