let worker: Worker | null = null;
let currentId = 0;
const pendingTasks = new Map<number, { resolve: Function, reject: Function }>();

export function getOptimizerWorker() {
  if (typeof window === 'undefined') return null;
  if (!worker) {
    worker = new Worker(new URL('../workers/imageOptimizer.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { id, success, buffer, width, height, error } = e.data;
      const task = pendingTasks.get(id);
      if (task) {
        pendingTasks.delete(id);
        if (success) {
          task.resolve({ buffer, width, height });
        } else {
          task.reject(new Error(error));
        }
      }
    };
  }
  return worker;
}

export interface OptimizeOptions {
  quality?: number;
  resize?: {
    width: number;
    height: number;
  };
}

export interface ImageOptimizationConfig {
  enabled: boolean;
  quality: number;
  scale: number;
  thumbnailWidth: number;
  thumbnailQuality: number;
}

export function getDefaultImageOptimization(): ImageOptimizationConfig {
  const defaultCfg: ImageOptimizationConfig = { enabled: true, quality: 70, scale: 70, thumbnailWidth: 470, thumbnailQuality: 70 };
  try {
    const saved = localStorage.getItem('paikarix_image_optimization_default');
    if (saved) return { ...defaultCfg, ...JSON.parse(saved) };
  } catch(e) {}
  return defaultCfg;
}

export function setDefaultImageOptimization(config: ImageOptimizationConfig | null) {
  if (config) {
    localStorage.setItem('paikarix_image_optimization_default', JSON.stringify(config));
  } else {
    localStorage.removeItem('paikarix_image_optimization_default');
  }
}

export interface OptimizeResult {
  buffer: ArrayBuffer;
  width: number;
  height: number;
}

export function optimizeImageRun(imageData: ImageData, options: OptimizeOptions): Promise<OptimizeResult> {
  return new Promise((resolve, reject) => {
    const w = getOptimizerWorker();
    if (!w) return reject(new Error('Worker not available'));
    
    const id = ++currentId;
    pendingTasks.set(id, { resolve, reject });
    
    // Copy buffer for transfer because ImageData buffer might be used if doing multiple
    const arrayBuffer = imageData.data.buffer.slice(0);
    
    w.postMessage({
      task: 'optimize',
      id,
      width: imageData.width,
      height: imageData.height,
      buffer: arrayBuffer,
      options
    }, [arrayBuffer]);
  });
}

export function urlToImageData(url: string, maxDimension: number = 1920): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let targetW = img.width;
        let targetH = img.height;
        if (targetW > maxDimension || targetH > maxDimension) {
           if (targetW > targetH) {
             targetH = Math.round(targetH * (maxDimension / targetW));
             targetW = maxDimension;
           } else {
             targetW = Math.round(targetW * (maxDimension / targetH));
             targetH = maxDimension;
           }
        }
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
          return reject(new Error("No 2d context"));
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const data = ctx.getImageData(0, 0, targetW, targetH);
        canvas.width = 0;
        canvas.height = 0;
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        resolve(data);
      } catch (e) {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        reject(e);
      }
    };
    img.onerror = () => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export function fileToImageData(file: File | Blob, maxDimension: number = 1920): Promise<ImageData> {
  return urlToImageData(URL.createObjectURL(file), maxDimension);
}

export function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${window.btoa(binary)}`;
}

/**
 * Ultra-fast, crash-resilient client-side image compressor for visual search.
 * Handles high-resolution camera photos (12-50MP), HEIC/JPEG on Android & iOS,
 * without freezing or leaking memory on mobile devices.
 */
export async function compressImageForVisualSearch(file: File | Blob, maxDimension: number = 380): Promise<string> {
  // Strategy 1: Native hardware-accelerated createImageBitmap (fastest, zero memory spike)
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await (createImageBitmap as any)(file, { resizeWidth: maxDimension, resizeQuality: 'medium' });
      } catch {
        bitmap = await createImageBitmap(file);
      }

      if (bitmap) {
        let width = bitmap.width;
        let height = bitmap.height;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          canvas.width = 0;
          canvas.height = 0;
          return dataUrl;
        }
        bitmap.close();
      }
    } catch (e) {
      console.warn('[VisualSearch] Native createImageBitmap failed, trying object URL fallback:', e);
    }
  }

  // Strategy 2: URL.createObjectURL + HTMLImageElement with strict error & timeout handling
  return new Promise<string>((resolve, reject) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (err) {
      return reject(new Error('Cannot read image file.'));
    }

    const img = new Image();
    let settled = false;

    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      try {
        if (objectUrl && objectUrl.startsWith('blob:')) {
          URL.revokeObjectURL(objectUrl);
        }
      } catch {}
    };

    const timer = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('Image processing timed out. Please try another photo.'));
      }
    }, 7000);

    img.onload = () => {
      if (settled) return;
      try {
        let width = img.naturalWidth || img.width || maxDimension;
        let height = img.naturalHeight || img.height || maxDimension;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          return reject(new Error('Canvas 2D rendering failed'));
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        canvas.width = 0;
        canvas.height = 0;
        cleanup();
        resolve(dataUrl);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    img.onerror = () => {
      if (settled) return;
      cleanup();
      reject(new Error('Failed to decode image format. Please take a standard photo or screenshot.'));
    };

    img.src = objectUrl;
  });
}

