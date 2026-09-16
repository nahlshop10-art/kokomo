import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

interface SortableImageProps {
  key?: React.Key;
  id: string;
  img: string;
  index: number;
  meta: any;
  onRemove: () => void;
  onOptimize: () => void;
}

export function SortableImage({ id, img, index, meta, onRemove, onOptimize }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative aspect-square bg-[var(--dash-card)] rounded-lg overflow-hidden border border-[var(--dash-border)] group ${isDragging ? 'opacity-50 ring-2 ring-[#fafafa]' : ''}`}
    >
      <img
        src={img}
        alt=""
        referrerPolicy="no-referrer"
        className="w-full h-full object-cover cursor-pointer"
        onClick={() => meta && !meta.isProcessing && onOptimize()}
      />
      <div 
        className="absolute inset-x-0 top-0 bottom-8 bg-[var(--dash-bg)]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-move touch-none pointer-events-none"
      >
        <GripVertical className="text-white" size={32} />
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 bg-red-500/80 text-white p-1 rounded-full hover:bg-red-500 transition-colors z-20"
      >
        <X size={14} />
      </button>

      {index === 0 && (
        <div className="absolute top-1 left-1 bg-[var(--dash-bg)]/80 backdrop-blur-sm border border-[#fafafa] text-[#fafafa] px-1.5 py-0.5 rounded text-[9px] font-bold z-10 pointer-events-none">
          COVER
        </div>
      )}

      {meta?.isProcessing && (
        <div className="absolute bottom-1 left-1 right-1 bg-[var(--dash-bg)]/80 text-[#fafafa] text-[9px] font-bold text-center py-1 rounded z-10 flex items-center justify-center gap-1 pointer-events-none">
          <div className="w-2 h-2 border border-[#fafafa]/40 border-t-[#fafafa] rounded-full animate-spin" />
          Optimizing...
        </div>
      )}
      {(meta && !meta.isProcessing && meta.optimizedSize) ? (
        <button
          onClick={(e) => { e.stopPropagation(); onOptimize(); }}
          className="absolute bottom-1 left-1 bg-[#fafafa] text-[var(--dash-bg)] text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20 flex flex-col text-left hover:bg-[#e4e4e7] leading-[1.2]"
        >
          <span className="opacity-80">{meta.width}x{meta.height}</span>
          <span>{(meta.optimizedSize >= 1024 * 1024 ? (meta.optimizedSize / (1024 * 1024)).toFixed(1) + 'MB' : (meta.optimizedSize / 1024).toFixed(1) + 'KB')}</span>
        </button>
      ) : (meta && !meta.isProcessing && meta.originalSize) ? (
        <button
          onClick={(e) => { e.stopPropagation(); onOptimize(); }}
          className="absolute bottom-1 left-1 bg-gray-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20 flex flex-col text-left hover:bg-gray-600 leading-[1.2]"
        >
          {meta.width && <span className="opacity-80">{meta.width}x{meta.height}</span>}
          <span>{(meta.originalSize >= 1024 * 1024 ? (meta.originalSize / (1024 * 1024)).toFixed(1) + 'MB' : (meta.originalSize / 1024).toFixed(1) + 'KB')}</span>
        </button>
      ) : null}
    </div>
  );
}
