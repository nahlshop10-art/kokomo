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
      if (!ctx) return reject(new Error("No 2d context"));
      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(ctx.getImageData(0, 0, targetW, targetH));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
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
