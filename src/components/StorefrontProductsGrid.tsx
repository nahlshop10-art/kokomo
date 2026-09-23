import React, { useCallback } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Product, CartItem, WebsiteSettings } from '../types';
import { formatPrice, cn } from '../lib/utils';
import { calculateProductDiscount } from '../lib/pricingUtils';
import { Trash2, Plus, Minus } from 'lucide-react';

export interface StorefrontProductCardProps {
  product: Product;
  cartItem?: CartItem;
  itemDiscount?: number;
  addingToOrderId: string | null;
  productImageHover?: boolean;
  onSelect: (p: Product) => void;
  onAdd: (p: Product) => void;
  onUpdate: (id: string, val: number, isDelta?: boolean) => void;
  onRemove: (id: string) => void;
}

export const StorefrontProductCard = React.memo(function StorefrontProductCard({
  product,
  cartItem,
  itemDiscount = 0,
  addingToOrderId,
  productImageHover,
  onSelect,
  onAdd,
  onUpdate,
  onRemove,
}: StorefrontProductCardProps) {
  return (
    <div 
      className="product-card-contain relative bg-[var(--theme-white)] rounded-lg rounded-b-[20px] rounded-b-20px overflow-hidden border border-gray-100 xl:p-1 flex flex-col group cursor-pointer"
      onClick={() => onSelect(product)}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-gray-100 group contain-strict xl:rounded-md">
        <img 
          src={product.thumbnail || product.image} 
          alt={product.title} 
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
            productImageHover && product.images && product.images.length > 1 ? "group-hover:opacity-0" : ""
          )}
        />
        {productImageHover && product.images && product.images.length > 1 && (
          <img 
            src={product.thumbnails?.[1] || product.images[1]} 
            alt={`${product.title} hover`} 
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          />
        )}
        
        {product.colors && (
          <div className="absolute bottom-2 right-2 flex -space-x-1">
            {product.colors.map(c => (
              <img key={c.name} src={c.image} className="w-6 h-6 rounded-full border border-[var(--theme-white)] shadow-sm object-cover" />
            ))}
          </div>
        )}
      </div>
      <div className="pl-1 lg:pl-2 pt-1 flex flex-col flex-grow">
        {product.material && product.material !== 'Unknown' && (
          <div className="text-xs text-yellow-600 font-medium">{product.material}</div>
        )}
        <div 
          className="text-xs lg:text-sm line-clamp-2 font-semibold leading-tight text-[var(--theme-black)] h-[30px] lg:h-[36px] break-words [overflow-wrap:anywhere] [word-break:break-word]"
          style={{ color: 'var(--theme-black)' }}
          title={product.title}
        >
          {product.title}
        </div>
        {itemDiscount > 0 ? (
          <div className="flex items-baseline gap-1.5 font-bold text-[16px] lg:text-lg">
            <span className="line-through text-gray-400 text-xs lg:text-sm font-normal">{formatPrice(product.price)}</span>
            <span className="text-[var(--theme-black)]">{formatPrice(product.price - itemDiscount)}</span>
          </div>
        ) : (
          <div className="font-bold text-[16px] lg:text-lg">{formatPrice(product.price)}</div>
        )}
      </div>

      <div className="p-0.5 pt-0 mt-auto">
        {cartItem && (!product.hasVariants || !product.variants?.length) ? (
          <div className="w-full flex justify-center" onClick={(e) => e.stopPropagation()}>
            <div 
              className="flex items-center justify-between" 
              style={{
                width: 'var(--btn-add-width, 100%)',
                height: 'var(--btn-add-height, 38px)',
              }}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(cartItem.id); }} 
                className="flex items-center justify-center text-red-500 border border-red-200 bg-red-50 cursor-pointer shrink-0"
                style={{
                  width: 'var(--btn-add-height, 38px)',
                  height: 'var(--btn-add-height, 38px)',
                  borderRadius: 'var(--btn-add-radius, 9999px)'
                }}
              >
                <Trash2 size={16} />
              </button>
              <div 
                className="flex items-center border border-gray-200 h-full bg-[var(--theme-white)] overflow-hidden" 
                style={{ borderRadius: 'var(--btn-add-radius, 9999px)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); onUpdate(cartItem.id, -1); }} 
                  className="px-2 lg:px-2.5 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer"
                  style={{ borderTopLeftRadius: 'var(--btn-add-radius, 9999px)', borderBottomLeftRadius: 'var(--btn-add-radius, 9999px)' }}
                >
                  <Minus size={16} />
                </button>
                <input 
                  type="number" 
                  className="w-10 text-center font-medium text-sm appearance-none border-none outline-none focus:outline-none bg-transparent p-0 m-0 focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  value={cartItem.quantity === 0 ? '' : (cartItem.quantity || '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      onUpdate(cartItem.id, 0, false);
                      return;
                    }
                    const num = parseInt(val);
                    if (!isNaN(num)) {
                      onUpdate(cartItem.id, num, false);
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value);
                    if (isNaN(val) || val < 1) {
                      onUpdate(cartItem.id, 1, false);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); onUpdate(cartItem.id, 1); }} 
                  className="px-2 lg:px-2.5 h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 cursor-pointer"
                  style={{ borderTopRightRadius: 'var(--btn-add-radius, 9999px)', borderBottomRightRadius: 'var(--btn-add-radius, 9999px)' }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onAdd(product);
              }}
              className="btn-gradient btn-add-to-cart gap-1.5 cursor-pointer"
            >
              {addingToOrderId ? (cartItem ? <><Plus size={15} /> Add more</> : <><Plus size={15} /> Add to Order</>) : (cartItem ? "Add more" : "Add to cart")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.product.title === next.product.title &&
    prev.product.price === next.product.price &&
    prev.product.image === next.product.image &&
    prev.product.thumbnail === next.product.thumbnail &&
    prev.product.stock === next.product.stock &&
    prev.productImageHover === next.productImageHover &&
    prev.addingToOrderId === next.addingToOrderId &&
    prev.itemDiscount === next.itemDiscount &&
    prev.cartItem?.quantity === next.cartItem?.quantity &&
    prev.cartItem?.variantId === next.cartItem?.variantId &&
    prev.onSelect === next.onSelect &&
    prev.onAdd === next.onAdd &&
    prev.onUpdate === next.onUpdate &&
    prev.onRemove === next.onRemove
  );
});

StorefrontProductCard.displayName = 'StorefrontProductCard';

export interface StorefrontProductsGridProps {
  filteredProducts: Product[];
  windowWidth: number;
  cartMap: Map<string | number, CartItem>;
  productTotalQtyMap: Map<string | number, number>;
  cartItemDiscounts: Record<string, number>;
  addingToOrderId: string | null;
  websiteSettings: WebsiteSettings;
  listRef?: React.RefObject<HTMLDivElement>;
  onSelect: (p: Product) => void;
  onAdd: (p: Product) => void;
  onUpdate: (id: string, val: number, isDelta?: boolean) => void;
  onRemove: (id: string) => void;
}

export const StorefrontProductsGrid = React.memo(function StorefrontProductsGrid({
  filteredProducts,
  windowWidth,
  cartMap,
  productTotalQtyMap,
  cartItemDiscounts,
  addingToOrderId,
  websiteSettings,
  listRef,
  onSelect,
  onAdd,
  onUpdate,
  onRemove,
}: StorefrontProductsGridProps) {
  const cols = windowWidth >= 1024 ? 4 : (windowWidth >= 768 ? 3 : 2);
  const rowCount = Math.ceil(filteredProducts.length / cols);

  const estimateRowHeight = useCallback(() => {
    return windowWidth >= 1024 ? 380 : windowWidth >= 768 ? 320 : 286;
  }, [windowWidth]);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: estimateRowHeight,
    overscan: windowWidth < 768 ? 6 : 4,
  });

  return (
    <div 
      ref={listRef} 
      className="w-full relative pb-1" 
      style={{ height: `${virtualizer.getTotalSize()}px` }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.index}
          ref={virtualizer.measureElement}
          data-index={virtualRow.index}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start}px)`,
          }}
          className={cn(
            "grid gap-0.5 sm:gap-2 lg:gap-1 xl:gap-2 px-1 lg:px-4 pb-0.5 sm:pb-2 lg:pb-1 xl:pb-2", 
            cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2"
          )}
        >
          {Array.from({ length: cols }).map((_, i) => {
            const productIndex = virtualRow.index * cols + i;
            const product = filteredProducts[productIndex];
            if (!product) return <div key={`empty-${i}`} />;

            const cartItem = cartMap.get(product.id);
            const productQtyInCart = productTotalQtyMap.get(product.id) || 0;
            const itemDiscount = productQtyInCart > 0
              ? (cartItem && cartItemDiscounts[cartItem.id] !== undefined
                  ? cartItemDiscounts[cartItem.id]
                  : calculateProductDiscount(product, productQtyInCart, cartItem?.variantId, websiteSettings?.qtyRules))
              : 0;

            return (
              <StorefrontProductCard
                key={product.id}
                product={product}
                cartItem={cartItem}
                itemDiscount={itemDiscount}
                addingToOrderId={addingToOrderId}
                productImageHover={websiteSettings.productImageHover}
                onSelect={onSelect}
                onAdd={onAdd}
                onUpdate={onUpdate}
                onRemove={onRemove}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});

StorefrontProductsGrid.displayName = 'StorefrontProductsGrid';
