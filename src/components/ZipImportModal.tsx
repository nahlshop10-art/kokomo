import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, UploadCloud, FileArchive, CheckCircle2, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { fileToImageData, optimizeImageRun, getDefaultImageOptimization, OptimizeOptions } from '../lib/imageOptimizationWorker';
import { Product, Category } from '../types';
import { cloudStore } from '../lib/cloudStore';

interface ZipImportModalProps {
  onClose: () => void;
  onImportComplete: (newProducts: Product[]) => void;
  categories: Category[];
  suppliers: string[];
  existingProducts: Product[];
}

export default function ZipImportModal({ onClose, onImportComplete, categories, suppliers, existingProducts }: ZipImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [optimizeImages, setOptimizeImages] = useState<boolean>(true);
  
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [failCount, setFailCount] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.zip')) {
        setFile(droppedFile);
      } else {
        alert('Please select a valid ZIP file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const detectCategory = (title: string, catList: Category[]) => {
    if (!title) return '';
    const titleLower = title.toLowerCase();
    
    // Exact substring match
    for (const cat of catList) {
      if (titleLower.includes(cat.name.toLowerCase())) {
        return cat.name;
      }
    }

    // Word based match
    const words = titleLower.split(/[^a-z0-9]+/);
    for (const cat of catList) {
      const catLower = cat.name.toLowerCase();
      for (const word of words) {
        if (word.length >= 3 && (word === catLower || word + 's' === catLower || catLower + 's' === word)) {
          return cat.name;
        }
      }
    }
    
    return '';
  };

  const parseZip = async () => {
    if (!file) return;

    setStatus('processing');
    setProgressMsg('Reading ZIP...');
    
    try {
      const zip = await JSZip.loadAsync(file);
      
      let csvFile = null;
      for (const relativePath in zip.files) {
        if (relativePath.endsWith('products.csv')) {
          csvFile = zip.files[relativePath];
          break;
        }
      }

      if (!csvFile) {
        throw new Error('products.csv not found in the ZIP file.');
      }

      const csvData = await csvFile.async('text');
      
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const rows = results.data as any[];
          setTotalCount(rows.length);
          setProgressMsg('Processing products...');
          
          let successes = 0;
          let failures = 0;
          const newProducts: Product[] = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            setProcessedCount(i + 1);
            setProgressMsg(`Processing ${i+1}/${rows.length}...`);

            try {
              // Yield to event loop to allow progress bar to repaint
              await new Promise(resolve => setTimeout(resolve, 0));
              // Extract data
              const title = row.title || '';
              const buyPriceText = row.price || '';
              const stockText = row.stock || '';
              const code = row.code || '';
              const imageFilename = row.image || '';
              const description = row.description || row.Description || '';

              // Find image in zip
              let imageUrl = '';
              let thumbnailUrl = '';
              if (imageFilename) {
                // look for it in images folder or anywhere
                let imgFile = null;
                for (const relativePath in zip.files) {
                   if (relativePath.includes(imageFilename)) {
                     imgFile = zip.files[relativePath];
                     break;
                   }
                }

                if (imgFile) {
                  const imgBlob = await imgFile.async('blob');
                  let finalBlob = imgBlob;
                  let parsedImageData: ImageData | undefined = undefined;

                  if (optimizeImages) {
                    try {
                      setProgressMsg(`Optimizing ${imageFilename}...`);
                      const imgFileObj = new File([imgBlob], imageFilename, { type: imgBlob.type || 'image/jpeg' });
                      parsedImageData = await fileToImageData(imgFileObj, 1920);
                      const defaultConfig = getDefaultImageOptimization();
                      let optimizeOptions: OptimizeOptions = { quality: 75 };
                      if (defaultConfig && defaultConfig.enabled) {
                         optimizeOptions.quality = defaultConfig.quality;
                         if (defaultConfig.scale !== 100) {
                           optimizeOptions.resize = {
                             width: Math.max(1, Math.round(parsedImageData.width * (defaultConfig.scale / 100))),
                             height: Math.max(1, Math.round(parsedImageData.height * (defaultConfig.scale / 100)))
                           };
                         }
                      }
                      const result = await optimizeImageRun(parsedImageData, optimizeOptions);
                      finalBlob = new Blob([result.buffer], { type: 'image/webp' });
                    } catch (e) {
                      console.warn('Image optimization failed, using original', e);
                    }
                  }
                  
                  // For a real app, upload to Firebase here.
                  // Since we cannot connect to Firebase Storage without config, we'll convert to local Object URL
                  // In a real integrated env, upload to cloud and get public URL
                  // But `ProductEditorModal` uses local data URLs or object URLs? Wait.
                  // Let's use Object URL for now, or just read as base64 string
                  
                  const buffer = await finalBlob.arrayBuffer();
                  let mime = finalBlob.type || 'image/jpeg';
                  if(!mime && imageFilename.endsWith('.png')) mime = 'image/png';
                  
                  try {
                    setProgressMsg(`Uploading ${imageFilename}...`);
                    
                    let finalImageFilename = imageFilename;
                    if (optimizeImages && finalBlob.type === 'image/webp') {
                      finalImageFilename = imageFilename.replace(/\.[^/.]+$/, "") + ".webp";
                    }

                    imageUrl = await cloudStore.uploadFile(finalBlob, finalImageFilename);
                    
                    const thumbCfg = getDefaultImageOptimization();
                    const thumbWidth = thumbCfg?.thumbnailWidth || 470;
                    const thumbQuality = thumbCfg?.thumbnailQuality || 70;
                    
                    if (parsedImageData && parsedImageData.width > thumbWidth) {
                      const thumbOptions: OptimizeOptions = { 
                        quality: thumbQuality, 
                        resize: { width: thumbWidth, height: Math.max(1, Math.round(parsedImageData.height * (thumbWidth / parsedImageData.width))) } 
                      };
                      const thumbResult = await optimizeImageRun(parsedImageData, thumbOptions);
                      const thumbBlob = new Blob([thumbResult.buffer], { type: 'image/webp' });
                      thumbnailUrl = await cloudStore.uploadFile(thumbBlob, `thumb_${finalImageFilename}`);
                    } else {
                      thumbnailUrl = imageUrl;
                    }
                  } catch (e) {
                    console.error('Failed to upload ZIP image over R2:', e);
                    // Fallback to base64
                    const reader = new FileReader();
                    reader.readAsDataURL(finalBlob);
                    await new Promise(resolve => {
                      reader.onloadend = () => {
                        imageUrl = reader.result as string;
                        resolve(null);
                      };
                    });
                  }
                }
              }

              // Auto detect category
              const category = detectCategory(title, categories);

              // Handle Product ID
              const providedId = (row.id || row.product_id || row.productId || row.code || row['Product ID'] || row['product id'] || row['Product Id'] || '').trim();
              
              // Generate new ID logic based on existing system
              const generateUniqueId = (cat: string) => {
                const categoryPrefix = cat && cat !== 'Uncategorized' 
                  ? cat.charAt(0).toUpperCase() 
                  : 'P';
                
                // Collect existing and newly generated IDs to ensure absolute uniqueness
                const allCurrentIds = new Set([
                  ...existingProducts.map(p => p.id),
                  ...newProducts.map(p => p.id)
                ]);
                
                let maxNum = 0;
                allCurrentIds.forEach(id => {
                  if (id.startsWith(categoryPrefix)) {
                    const numPart = id.substring(1);
                    const num = parseInt(numPart, 10);
                    if (!isNaN(num) && num > maxNum) {
                      maxNum = num;
                    }
                  }
                });
                
                let nextNum = maxNum + 1;
                let newId = `${categoryPrefix}${nextNum.toString().padStart(3, '0')}`;
                // Keep incrementing until we find a truly unique one
                while (allCurrentIds.has(newId)) {
                  nextNum++;
                  newId = `${categoryPrefix}${nextNum.toString().padStart(3, '0')}`;
                }
                return newId;
              };

              let finalId = '';
              const allUsedIds = new Set([
                ...existingProducts.map(p => p.id),
                ...newProducts.map(p => p.id)
              ]);

              if (providedId) {
                // Check if duplicate
                if (allUsedIds.has(providedId)) {
                   finalId = generateUniqueId(category || categories[0]?.name || 'Uncategorized');
                } else {
                   finalId = providedId; // it's valid and unique
                }
              } else {
                 finalId = generateUniqueId(category || categories[0]?.name || 'Uncategorized');
              }

              // Construct Product
              const newProduct: Product = {
                id: finalId,
                title: title,
                material: '',
                price: 0, // Sell price is always empty (0)
                image: imageUrl,
                images: imageUrl ? [imageUrl] : [],
                thumbnail: thumbnailUrl || imageUrl,
                thumbnails: thumbnailUrl ? [thumbnailUrl] : (imageUrl ? [imageUrl] : undefined),
                category: category || categories[0]?.name || 'Uncategorized', // default to first cat or Uncategorized
                description: description,
                colors: [],
                buyPrice: buyPriceText ? Number(buyPriceText) : undefined,
                stock: stockText ? Number(stockText) : undefined,
                supplier: selectedSupplier || undefined,
                isVisible: true,
                autoPrice: undefined,
                isNew: true, // mark as new to sort
              };
              
              if(code) {
                 newProduct.variants = [];
                 newProduct.qtyRules = [];
              }


              newProducts.push(newProduct);
              successes++;
            } catch (err) {
              console.error('Failed to import row', row, err);
              failures++;
            }
          }

          setSuccessCount(successes);
          setFailCount(failures);
          setStatus('success');
          onImportComplete(newProducts);
        },
        error: (err) => {
          console.error(err);
          setProgressMsg('Error parsing CSV');
          setStatus('error');
        }
      });

    } catch (error) {
      console.error(error);
      setProgressMsg('Error reading ZIP file. Ensure products.csv exists.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[var(--dash-bg)]/80 flex justify-center items-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-[var(--dash-border)] flex justify-between items-center bg-[var(--dash-bg)]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileArchive className="text-[#fafafa]" size={24} />
            Import ZIP
          </h2>
          <button onClick={onClose} className="p-2 bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] hover:bg-[var(--dash-border)] text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          {status === 'idle' && (
            <div className="space-y-6">
              <div 
                className="border-2 border-dashed border-[var(--dash-border)] rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-[#fafafa] hover:bg-[var(--dash-border)]/30 transition-all cursor-pointer"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 bg-[#fafafa]/10 rounded-full flex items-center justify-center mb-4">
                  <UploadCloud size={32} className="text-[#fafafa]" />
                </div>
                <h3 className="text-lg font-medium text-white mb-1">Click or drag ZIP here</h3>
                <p className="text-sm text-gray-400">products.csv &amp; images folder</p>
                
                {file && (
                  <div className="mt-4 p-3 bg-[var(--dash-bg)] border border-[#fafafa]/30 rounded-lg flex items-center gap-2 text-[#fafafa]">
                    <FileArchive size={16} />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-[#fafafa]/70">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                )}
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".zip" 
                  className="hidden" 
                  onChange={handleFileChange}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Select Supplier (Optional)</label>
                  <select 
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3 text-white focus:outline-none focus:border-[#fafafa] transition-colors appearance-none"
                  >
                    <option value="">No Supplier</option>
                    {suppliers.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3">
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                       Image Optimization
                       {getDefaultImageOptimization()?.enabled ? (
                          <span className="text-[10px] bg-[#fafafa]/10 text-[#fafafa] px-1.5 py-0.5 rounded border border-[#fafafa]/20">Custom Default</span>
                       ) : (
                          <span className="text-[10px] bg-[var(--dash-card)] text-gray-400 px-1.5 py-0.5 rounded border border-gray-700">Auto Mode</span>
                       )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">Reduce file size without losing quality</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={optimizeImages}
                      onChange={(e) => setOptimizeImages(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-[var(--dash-border)] rounded-full peer peer-checked:after:translate-x-[calc(100%-0px)] peer-checked:peer-active:after:translate-x-[calc(100%-8px)] peer-checked:after:border-[var(--dash-card)] after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 after:ease-[cubic-bezier(0.25,1,0.5,1)] font-medium peer-active:after:w-7 peer-checked:bg-[#fafafa]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 border-4 border-[var(--dash-border)] border-t-[#fafafa] rounded-full animate-spin mb-6"></div>
              <h3 className="text-xl font-bold text-white mb-2">{progressMsg}</h3>
              {totalCount > 0 && (
                <>
                  <p className="text-gray-400 mb-4">{processedCount} / {totalCount} products</p>
                  <div className="w-full h-2 bg-[var(--dash-border)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#fafafa] transition-all duration-300"
                      style={{ width: `${(processedCount / totalCount) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-20 h-20 bg-[#fafafa]/10 rounded-full flex items-center justify-center mb-2">
                <CheckCircle2 size={40} className="text-[#fafafa]" />
              </div>
              <h3 className="text-2xl font-bold text-white">Import Complete!</h3>
              
              <div className="flex gap-4 w-full">
                <div className="flex-1 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#fafafa]">{successCount}</div>
                  <div className="text-sm text-gray-400">Successfully Imported</div>
                </div>
                <div className="flex-1 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-red-500">{failCount}</div>
                  <div className="text-sm text-gray-400">Failed Records</div>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                <AlertCircle size={40} className="text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white">Import Failed</h3>
              <p className="text-gray-400">{progressMsg}</p>
            </div>
          )}

        </div>

        <div className="p-4 border-t border-[var(--dash-border)] bg-[var(--dash-bg)] flex gap-3">
          {status === 'idle' && (
            <>
              <button 
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-[var(--dash-border)] text-white font-medium hover:bg-[var(--dash-border)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={parseZip}
                disabled={!file}
                className="flex-1 py-3 rounded-xl bg-[#fafafa] text-[var(--dash-bg)] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#e4e4e7] transition-colors"
              >
                Start Import
              </button>
            </>
          )}

          {(status === 'error' || status === 'success') && (
            <button 
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#fafafa] text-[var(--dash-bg)] font-bold hover:bg-[#e4e4e7] transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
