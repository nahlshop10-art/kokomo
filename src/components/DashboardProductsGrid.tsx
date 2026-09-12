import React, { useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Package, PackageX, Check, Eye, EyeOff } from 'lucide-react';
import { Product, TopBarMode } from '../types';
import { cn } from '../lib/utils';
import { CopyButton } from './CopyButton';
import { DashboardProductImage } from './DashboardProductImage';

// Memoized Product Card for lag-free Virtualized Products Grid
export interface DashboardProductGridCardProps {
  product: Product;
  topBarMode: TopBarMode;
  isOutOfStock: boolean;
  isSelected: boolean;
  isVisible: boolean;
  perms: any;
  onEdit: (p: Product) => void;
  onToggleSelection: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMoveProducts: (e: React.MouseEvent, id: string) => void;
}

export const DashboardProductGridCard = React.memo(({
  product,
  topBarMode,
  isOutOfStock,
  isSelected,
  isVisible,
  perms,
  onEdit,
  onToggleSelection,
  onToggleVisibility,
  onMoveProducts
}: DashboardProductGridCardProps) => {
  if (!product) return null;
  const buyPriceVal = product.buyPrice ?? (product.price ? Math.floor(product.price * 0.4) : 0);
  const sellPriceVal = product.price || 0;
  const profitVal = sellPriceVal - buyPriceVal;

  return (
    <div 
      className="product-card-contain rounded-xl overflow-hidden border flex flex-col relative cursor-pointer bg-[var(--dash-card)] border-[var(--dash-border)]"
      onClick={() => {
        if (topBarMode === 'default') {
          onEdit(product);
        } else if (topBarMode === 'move' || topBarMode === 'delete') {
          onToggleSelection(product.id);
        } else if (topBarMode === 'visibility') {
          if (!isOutOfStock) {
            onToggleVisibility(product.id);
          }
        }
      }}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--dash-card)]">
        <DashboardProductImage 
          src={product.thumbnail || product.image || ''} 
          alt={product.title || ''} 
          dimmedOrOutOfStock={product.isVisible === false || isOutOfStock}
        />
        
        {/* Stock Out Overlay/Label */}
        {isOutOfStock && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[var(--dash-bg)]/20 pointer-events-none transition-opacity duration-200">
             <div className="w-8 h-8 rounded-full border border-[#ff4d4f] flex items-center justify-center bg-[var(--dash-bg)] text-[#ff4d4f] shadow-md shadow-[#ff4d4f]/20">
                <PackageX size={14} strokeWidth={2} />
             </div>
          </div>
        )}
        
        {/* Mode Specific Overlays */}
        {(topBarMode === 'move' || topBarMode === 'delete') && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded border-2 border-[var(--dash-border)] bg-[var(--dash-bg)]/50 flex items-center justify-center z-10">
            {isSelected && <Check size={16} className="text-[#fafafa]" />}
          </div>
        )}

        {topBarMode === 'visibility' && (
          <div className={cn("absolute top-2 left-2 w-8 h-8 rounded flex items-center justify-center z-10", 
            isVisible ? "bg-[#fafafa] text-[var(--dash-bg)]" : "bg-red-500 text-white"
          )}>
            {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </div>
        )}

        {topBarMode === 'move' && (
          <button 
            onClick={(e) => onMoveProducts(e, product.id)}
            className="absolute bottom-2 left-2 bg-[var(--dash-bg)]/80 text-white text-xs font-medium px-3 py-1.5 rounded z-10"
          >
            Insert
          </button>
        )}

        {/* Default Overlays */}
        {topBarMode === 'default' && (
          <>
            <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
              {product.isNew && <div className="bg-[var(--dash-bg)]/80 text-white text-[10px] font-bold px-2 py-1 rounded w-fit">NEW</div>}
            </div>
            <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
              <div className="bg-[var(--dash-bg)]/80 text-white text-[10px] font-bold px-2 py-1 rounded w-fit flex items-center gap-1">
                ID: {product.id} <CopyButton text={product.id} className="p-0 text-gray-300 hover:text-white" />
              </div>
            </div>
          </>
        )}
        
        <div className="absolute bottom-2 right-2 bg-[#ff4d6d] text-white text-xs font-bold px-2 py-1 rounded z-10">
          ¥{product.autoPrice || 0}
        </div>
        {topBarMode !== 'move' && !isOutOfStock && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border z-10 shadow-md bg-[#fafafa] text-[var(--dash-bg)] border-[#fafafa]/20">
            <Package size={14} />
            {perms?.product?.stock !== false ? (product.stock || 0) : '***'}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 text-center text-[10px] border-t border-[var(--dash-border)] divide-x divide-[var(--dash-border)]">
        <div className="py-1">
          <div className="text-gray-500">BUY</div>
          <div className="font-medium text-white">{perms?.product?.buyPrice !== false ? buyPriceVal : '***'}</div>
        </div>
        <div className="py-1">
          <div className="text-gray-500">SELL</div>
          <div className="font-medium text-white">{perms?.product?.sellPrice !== false ? sellPriceVal : '***'}</div>
        </div>
        <div className="py-1">
          <div className="text-gray-500">PROFIT</div>
          <div className="font-medium text-white">{perms?.product?.profit !== false ? profitVal : '***'}</div>
        </div>
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.product.title === next.product.title &&
    prev.product.price === next.product.price &&
    prev.product.buyPrice === next.product.buyPrice &&
    prev.product.autoPrice === next.product.autoPrice &&
    prev.product.stock === next.product.stock &&
    prev.product.thumbnail === next.product.thumbnail &&
    prev.product.image === next.product.image &&
    prev.product.isVisible === next.product.isVisible &&
    prev.product.isNew === next.product.isNew &&
    prev.topBarMode === next.topBarMode &&
    prev.isOutOfStock === next.isOutOfStock &&
    prev.isSelected === next.isSelected &&
    prev.isVisible === next.isVisible &&
    prev.perms?.product?.buyPrice === next.perms?.product?.buyPrice &&
    prev.perms?.product?.sellPrice === next.perms?.product?.sellPrice &&
    prev.perms?.product?.profit === next.perms?.product?.profit &&
    prev.perms?.product?.stock === next.perms?.product?.stock
  );
});

DashboardProductGridCard.displayName = 'DashboardProductGridCard';

export interface DashboardProductsGridProps {
  displayProducts: Product[];
  scrollEl: HTMLDivElement | null;
  windowWidth: number;
  topBarMode: TopBarMode;
  selectedProducts: string[];
  visibilityChanges: Record<string, boolean>;
  perms: any;
  onEdit: (p: Product) => void;
  onToggleSelection: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onMoveProducts: (e: React.MouseEvent, id: string) => void;
}

export const DashboardProductsGrid = React.memo(({
  displayProducts,
  scrollEl,
  windowWidth,
  topBarMode,
  selectedProducts,
  visibilityChanges,
  perms,
  onEdit,
  onToggleSelection,
  onToggleVisibility,
  onMoveProducts,
}: DashboardProductsGridProps) => {
  const cols = windowWidth >= 1536 ? 6 : (windowWidth >= 1280 ? 5 : (windowWidth >= 1024 ? 4 : (windowWidth >= 768 ? 3 : 2)));
  const rowCount = Math.ceil(displayProducts.length / cols);

  const estimateRowHeight = useCallback(() => {
    if (typeof window === 'undefined') return 240;
    const w = windowWidth;
    if (w < 768) {
      return Math.round((w - 36) / 2 + 42);
    }
    return 290;
  }, [windowWidth]);

  const getScrollElement = useCallback(() => scrollEl, [scrollEl]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement,
    estimateSize: estimateRowHeight,
    overscan: 2,
  });

  const selectedSet = useMemo(() => new Set(selectedProducts), [selectedProducts]);

  return (
    <div 
      className="w-full relative px-1 pb-1" 
      style={{ 
        height: `${virtualizer.getTotalSize()}px`,
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.index}
          className="absolute top-0 left-0 w-full grid grid-cols-2 gap-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-4 md:px-4"
          style={{
            transform: `translateY(${virtualRow.start}px)`,
            contain: 'layout paint',
          }}
        >
          {Array.from({ length: cols }).map((_, i) => {
            const productIndex = virtualRow.index * cols + i;
            const product = displayProducts[productIndex];
            if (!product) return <div key={i} />;

            const isOutOfStock = product.variants && product.variants.length > 0 
              ? !product.variants.some(v => v.stock !== undefined && v.stock !== null && Number(v.stock) > 0)
              : (product.stock === undefined || product.stock === null || Number(product.stock) <= 0);

            const isSelected = selectedSet.has(product.id);
            const isVisible = visibilityChanges[product.id] !== undefined ? visibilityChanges[product.id] : product.isVisible !== false;

            return (
              <DashboardProductGridCard
                key={product.id}
                product={product}
                topBarMode={topBarMode}
                isOutOfStock={isOutOfStock}
                isSelected={isSelected}
                isVisible={isVisible}
                perms={perms}
                onEdit={onEdit}
                onToggleSelection={onToggleSelection}
                onToggleVisibility={onToggleVisibility}
                onMoveProducts={onMoveProducts}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});

DashboardProductsGrid.displayName = 'DashboardProductsGrid';
