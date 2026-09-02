import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu, Search, ShoppingBag, LayoutGrid, Lock, Unlock,
  Trash2, Minus, Plus, X, RefreshCw, EyeOff
} from 'lucide-react';
import { format } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn, formatPrice, normalizePhone, useWindowScrollRestore, slugify, sendTelegramNotification } from './lib/utils';
import { restoreOrderStock, deductOrderStock, notifyMasterStockSync, adjustOrderStockDiff, getAvailableStock } from './lib/stockUtils';
import { cloudStore } from './lib/cloudStore';
import { CopyButton } from './components/CopyButton';
import { Product, CartItem, Order, OrderStatus, Category, WebsiteSettings, MarketingSettings, CourierSettings, PriceCalculatorSettings, IncompleteOrder } from './types';
import { PRODUCTS, CATEGORIES as DEFAULT_CATEGORIES } from './data';
import { initMetaPixel, trackMetaEvent } from './lib/metaPixel';
import { initTikTokPixel, trackTikTokEvent } from './lib/tiktokPixel';
import { initGA4, trackGA4Event } from './lib/ga4Pixel';
import { initBatcher, setBatchingInterval } from './lib/eventBatcher';
import { BannerSlider, FilterDropdown, Sidebar, SearchModal, ColorModal, CartModal, CheckoutModal, OrderDetailsModal, ThankYouModal, ImagePreviewModal } from './AppComponents';
import { getCartTotal, calculateItemDiscount } from './lib/pricingUtils';
import { isProductInStock } from './lib/stockUtils';
import MinOrderPopup from './MinOrderPopup';
import ProductDetails from './ProductDetails';
import StockOutView from './StockOutView';

const Dashboard = React.lazy(() => import('./Dashboard'));
import { ErrorBoundary } from './components/ErrorBoundary';
import { Receipt } from './components/Receipt';
import { VariantModal } from './components/VariantModal';
import { downloadReceiptAsJPG, downloadReceiptAsPDF } from './lib/downloadReceipt';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import ActionBtn from './components/ActionBtn';
import FloatingSocialButtons from './components/FloatingSocialButtons';
import { useScrollLock } from './hooks/useScrollLock';
import { useHistoryModal } from './hooks/useHistoryModal';
import { DEFAULT_ACTION_BUTTONS } from './types';

export default function App() {
  const [isCloudLoading, setIsCloudLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  useEffect(() => {
    // We will initialize from cloudStore in a unified effect below
  }, []);


  const [websiteSettings, setWebsiteSettings] = useState<WebsiteSettings>(() => {
    try {
      const cached = localStorage.getItem('paikarix_website_settings_cache');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}
    
    return {
      bannerEnabled: true,
      banners: [],
      deliveryCharges: [
        { id: '1', area: 'Inside Dhaka', price: 80, time: '1/2 Days' },
        { id: '2', area: 'Outside Dhaka', price: 110, time: '2/3 Days' }
      ],
      productImageHover: true
    };
  });

  useEffect(() => {
    if (websiteSettings) {
      localStorage.setItem('paikarix_website_settings_cache', JSON.stringify(websiteSettings));
      const root = document.documentElement;
      root.style.setProperty('--theme-primary', websiteSettings.themeColors?.primary || '#ff4d6d');
      root.style.setProperty('--theme-primary-hover', `color-mix(in srgb, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 80%, black)`);
      root.style.setProperty('--theme-primary-gradient', `linear-gradient(90deg, color-mix(in srgb, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 76%, white 24%) 0%, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 45%, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 100%)`);
      root.style.setProperty('--theme-primary-shadow', `0 4px 14px color-mix(in srgb, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 28%, transparent)`);
      root.style.setProperty('--theme-black', websiteSettings.themeColors?.black || '#000000');
      root.style.setProperty('--theme-white', websiteSettings.themeColors?.white || '#ffffff');
      root.style.setProperty('--store-bg', websiteSettings.themeColors?.bg || websiteSettings.themeColors?.white || '#ffffff');
      
      const tint = websiteSettings.dashboardTheme?.blueTint ?? 47;
      root.style.setProperty('--dash-bg', `hsl(222, ${tint}%, 11%)`);
      root.style.setProperty('--dash-card', `hsl(217, ${tint * 0.70}%, 17%)`);
      root.style.setProperty('--dash-border', `hsl(215, ${tint * 0.53}%, 27%)`);
      root.style.setProperty('--dash-border-light', `hsl(215, ${tint * 0.40}%, 35%)`);
    }
  }, [websiteSettings]);

  useEffect(() => {
    // 1. Meta Title (fallback to shopName or hostname)
    const title = websiteSettings?.seoSettings?.metaTitle || websiteSettings?.shopName || window.location.hostname;
    document.title = title;

    // 2. Meta Description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', websiteSettings?.seoSettings?.metaDescription || '');

    // 3. Meta Keywords
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (websiteSettings?.seoSettings?.metaKeywords) {
      if (!metaKeywords) {
        metaKeywords = document.createElement('meta');
        metaKeywords.setAttribute('name', 'keywords');
        document.head.appendChild(metaKeywords);
      }
      metaKeywords.setAttribute('content', websiteSettings.seoSettings.metaKeywords);
    } else if (metaKeywords) {
      metaKeywords.remove();
    }

    // 4. Social Open Graph Settings
    const updateOgTag = (property: string, content: string | undefined) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (content) {
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('property', property);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      } else if (tag) {
        tag.remove();
      }
    };

    updateOgTag('og:title', websiteSettings?.seoSettings?.socialShareTitle || title);
    updateOgTag('og:description', websiteSettings?.seoSettings?.socialShareDescription || websiteSettings?.seoSettings?.metaDescription);
    updateOgTag('og:image', websiteSettings?.seoSettings?.defaultSocialShareImage);

    // 5. Favicon
    if (websiteSettings?.seoSettings?.favicon) {
      let favicon = document.querySelector('link[rel="icon"]');
      if (!favicon) {
        favicon = document.createElement('link');
        favicon.setAttribute('rel', 'icon');
        document.head.appendChild(favicon);
      }
      favicon.setAttribute('href', websiteSettings.seoSettings.favicon);
    }
  }, [websiteSettings?.seoSettings, websiteSettings?.shopName]);


  const [courierSettings, setCourierSettings] = useState<CourierSettings>(() => {
    return {
      steadfast: {
        apiKey: '',
        secretKey: ''
      }
    };
  });


  const [priceCalculatorSettings, setPriceCalculatorSettings] = useState<PriceCalculatorSettings>(() => {
    return {
      yuanRate: 18.35,
      additionalCost: 20,
      profit: 110
    };
  });


  const [marketingSettings, setMarketingSettings] = useState<MarketingSettings>(() => {
    return {
      metaPixel: {
        enabled: false,
        pixelId: '',
        accessToken: '',
        testCode: ''
      },
      tiktokPixel: {
        enabled: false,
        pixelId: '',
        accessToken: '',
        testCode: ''
      }
    };
  });


  // Initialize Pixels
  useEffect(() => {
    initBatcher();
    
    if (marketingSettings.metaPixel.enabled && marketingSettings.metaPixel.pixelId) {
      initMetaPixel(marketingSettings.metaPixel);
    }
    if (marketingSettings.tiktokPixel.enabled && marketingSettings.tiktokPixel.pixelId) {
      initTikTokPixel(marketingSettings.tiktokPixel);
    }
    if (marketingSettings.ga4?.enabled && marketingSettings.ga4?.measurementId) {
      initGA4(marketingSettings.ga4);
    }
  }, [marketingSettings.metaPixel.enabled, marketingSettings.metaPixel.pixelId, marketingSettings.tiktokPixel.enabled, marketingSettings.tiktokPixel.pixelId, marketingSettings.ga4?.enabled, marketingSettings.ga4?.measurementId]);

  useEffect(() => {
    setBatchingInterval(websiteSettings.eventBatchingInterval);
  }, [websiteSettings.eventBatchingInterval]);


  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
  };

  useEffect(() => {
    // Initialized from cloudStore unified loader later
  }, []);

  useEffect(() => {
    // Legacy syncAllProducts removed to prevent race conditions and overwriting D1 from cache
  }, [products, productsLoaded, isCloudLoading]);

  const [activeCategory, setActiveCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState<'default' | 'high' | 'low'>('default');
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('shopping_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [incompleteOrders, setIncompleteOrders] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [myOrderIds, setMyOrderIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('paikarix_my_order_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [myOrders, setMyOrders] = useState<Order[]>([]);

  useEffect(() => {
    localStorage.setItem('paikarix_my_order_ids', JSON.stringify(myOrderIds));
  }, [myOrderIds]);

  // Unified cloudStore state loader
  useEffect(() => {
    const loadState = async () => {
      const ordersPromise = myOrderIds.length > 0
        ? cloudStore.getMyOrders(myOrderIds).catch(e => {
            console.error("Failed to fetch my orders:", e);
            return [];
          })
        : Promise.resolve([]);

      const [state, fetchedOrders] = await Promise.all([
        cloudStore.getState(),
        ordersPromise
      ]);

      if (state) {
        if (state.products && state.products.length > 0) setProducts(state.products);
        if (state.settings) {
          if (state.settings.categories) setCategories(state.settings.categories);
          if (state.settings.websiteSettings) setWebsiteSettings(state.settings.websiteSettings);
          if (state.settings.marketingSettings) setMarketingSettings(state.settings.marketingSettings);
          if (state.settings.courierSettings) setCourierSettings(state.settings.courierSettings);
          if (state.settings.priceCalculatorSettings) setPriceCalculatorSettings(state.settings.priceCalculatorSettings);
          if (state.settings.isMaintenanceMode !== undefined) setIsMaintenanceMode(state.settings.isMaintenanceMode);
        }
      }
      setCategoriesLoaded(true);
      setProductsLoaded(true);

      if (fetchedOrders && fetchedOrders.length > 0) {
        setMyOrders(fetchedOrders);
      }
      setIsCloudLoading(false);
    };
    loadState();
  }, []);

  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Maintenance state
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);


  // Dashboard state
  const [isDashboardOpen, setIsDashboardOpen] = useState(() => location.pathname.startsWith('/admin'));
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const holdTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const [preventClick, setPreventClick] = useState(false);

  const handleLogoClick = () => {
    clickCountRef.current += 1;
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    clickTimeoutRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 1000);

    if (clickCountRef.current >= 3) {
      setIsDashboardOpen(true);
      clickCountRef.current = 0;
    }
  };

  const handleLogoPointerDown = () => {
    holdTimeoutRef.current = setTimeout(() => {
      setIsDashboardOpen(true);
    }, 3000);
  };

  const handleLogoPointerUp = () => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
  };

  // Modals state
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSearchOpen, setSearchOpen] = useState(false);
  const [isCartOpen, setCartOpen] = useState(false);
  const [cartTab, setCartTab] = useState<'history' | 'cart'>('cart');
  const [isCheckoutOpen, setCheckoutOpen] = useState(false);
  const [isMinOrderPopupOpen, setIsMinOrderPopupOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [colorModalProduct, setColorModalProduct] = useState<Product | null>(null);
  const [variantModalProduct, setVariantModalProduct] = useState<Product | null>(null);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isStockOutViewOpen, setStockOutViewOpen] = useState(false);

  // Hook up history states for NON-URL modals - so hitting back button closes them natively
  useHistoryModal(isSidebarOpen, () => setSidebarOpen(false), 'sidebar');
  useHistoryModal(isMinOrderPopupOpen, () => setIsMinOrderPopupOpen(false), 'minorder');
  useHistoryModal(!!selectedOrder, () => setSelectedOrder(null), 'selectedorder');
  useHistoryModal(!!colorModalProduct, () => setColorModalProduct(null), 'colorproduct');
  useHistoryModal(!!variantModalProduct, () => setVariantModalProduct(null), 'variantproduct');
  useHistoryModal(!!previewImage, () => setPreviewImage(null), 'previewimage');
  useHistoryModal(isStockOutViewOpen, () => setStockOutViewOpen(false), 'stockout');

  const closeUrlModal = () => {
    if (location.state?.internalUiObj) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  };

  const listRef = useRef<HTMLDivElement>(null);
  const [addingToOrderId, setAddingToOrderId] = useState<string | null>(() => {
    return localStorage.getItem('adding_to_order_id') || null;
  });
  const [addingToOrderItems, setAddingToOrderItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('adding_to_order_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('shopping_cart', JSON.stringify(cart));
    }, 300);
    return () => clearTimeout(timer);
  }, [cart]);

  useEffect(() => {
    if (addingToOrderId) {
      localStorage.setItem('adding_to_order_id', addingToOrderId);
    } else {
      localStorage.removeItem('adding_to_order_id');
    }
  }, [addingToOrderId]);

  useEffect(() => {
    localStorage.setItem('adding_to_order_items', JSON.stringify(addingToOrderItems));
  }, [addingToOrderItems]);

  // Smooth scroll restore for main storefront
  useWindowScrollRestore('app-main', !selectedProductForDetails && !isCartOpen && !isCheckoutOpen && !isDashboardOpen);

  const isUpdatingFromUrl = useRef(false);

  // Sync URL -> State (Back/Forward buttons & manual URL entry)
  useEffect(() => {
    if (!productsLoaded || !categoriesLoaded) return;

    isUpdatingFromUrl.current = true;
    const path = location.pathname;

    setCheckoutOpen(path === '/checkout');
    setCartOpen(path === '/cart');
    setSearchOpen(path === '/search');
    setIsDashboardOpen(path.startsWith('/admin'));

    if (path.startsWith('/product/')) {
       const slug = decodeURIComponent(path.replace('/product/', ''));
       // Prioritize exact ID match for uniqueness, fallback to slug for legacy links
       const product = products.find(p => p.id === slug) || products.find(p => slugify(p.title) === slug);
       
       if (product && isProductInStock(product) && product.isVisible !== false) {
         setSelectedProductForDetails(product);
       } else {
         setSelectedProductForDetails(null);
         if (path !== '/product/') navigate('/', { replace: true });
       }
    } else {
       setSelectedProductForDetails(null);
    }

    if (path.startsWith('/c/')) {
       const slug = decodeURIComponent(path.replace('/c/', ''));
       const cat = categories.find(c => slugify(c.name) === slug);
       setActiveCategory(cat ? cat.name : 'All');
       if (!cat && slug !== 'All') {
          navigate('/', { replace: true });
       }
    } else if (path === '/' || path.startsWith('/product/') || path.startsWith('/cart') || path.startsWith('/checkout') || path.startsWith('/search') || path.startsWith('/order/')) {
       // if we are on a different page, category selection should stay as it was or reset, but usually we just keep it
    } else if (!path.startsWith('/admin')) {
       setActiveCategory('All');
       navigate('/', { replace: true });
    }

    if (path.startsWith('/order/')) {
       const orderId = path.replace('/order/', '');
       const currentOrder = myOrders.find(o => o.id === orderId);
       // We set successOrder instead of selectedOrder when viewing your own order generally.
       if (currentOrder && currentOrder.id === successOrder?.id) {
           // keep successOrder
       } else if (currentOrder) {
           setSuccessOrder(currentOrder);
       }
    }

    setTimeout(() => { isUpdatingFromUrl.current = false; }, 50);
  }, [location.pathname, products, categories, myOrders, productsLoaded, categoriesLoaded, navigate]);

  // Sync State -> URL
  useEffect(() => {
     if (isUpdatingFromUrl.current || !productsLoaded || !categoriesLoaded) return;
     let newPath = '/';
     if (isDashboardOpen) {
       // Only push /admin if we aren't already somewhere in /admin
       if (!location.pathname.startsWith('/admin')) newPath = '/admin';
       else newPath = location.pathname; // keep current admin path
     }
     else if (isCheckoutOpen) newPath = '/checkout';
     else if (isSearchOpen) newPath = '/search';
     else if (isCartOpen) newPath = '/cart';
     else if (successOrder) newPath = `/order/${successOrder.id}`;
     else if (selectedProductForDetails) newPath = `/product/${selectedProductForDetails.id}`;
     else if (activeCategory !== 'All') newPath = `/c/${slugify(activeCategory)}`;

     if (location.pathname !== newPath) {
        // If going back to home, we don't necessarily push unless we want to, but actually
        // since we use closeUrlModal() it calls navigate(-1). So if we explicitly set a state to false,
        // it falls here and pushes '/', which is fine or bad?
        // Wait, if we use closeUrlModal(), it does navigate(-1), so the path matches!
        // If we do navigate(newPath), and newPath is not '/', we are opening a modal. 
        // We want to push. If we are closing, we use closeUrlModal(). If something else triggers it, we PUSH.
        navigate(newPath, { state: { internalUiObj: true } });
     }
  }, [isDashboardOpen, isCheckoutOpen, isSearchOpen, isCartOpen, successOrder, selectedProductForDetails, activeCategory]);

  const hasSentPageViewRef = useRef<boolean>(false);

  useEffect(() => {
    if (!productsLoaded || !categoriesLoaded || hasSentPageViewRef.current) return;
    
    // Only send PageView on the main product landing page ('/')
    // and only send ONE single PageView event per visit/session
    if (location.pathname === '/') {
      hasSentPageViewRef.current = true;
      trackMetaEvent('PageView', {}, marketingSettings.metaPixel);
      trackTikTokEvent('Pageview', {}, marketingSettings.tiktokPixel);
      trackGA4Event('page_view', {}, null, marketingSettings.ga4 || { enabled: false, measurementId: '', apiSecret: '' });
    }
  }, [location.pathname, productsLoaded, categoriesLoaded, marketingSettings.metaPixel, marketingSettings.tiktokPixel, marketingSettings.ga4]);

  // Derived state
  const activeCategoriesWithIcons = React.useMemo(() => {
    return categories
      .map(cat => {
        const catNameLower = cat.name.trim().toLowerCase();
        const firstMatchingProduct = products.find(p => p.category?.trim()?.toLowerCase() === catNameLower);
        if (!firstMatchingProduct) return null;
        const displayIcon = cat.icon || firstMatchingProduct.image || null;
        return { ...cat, displayIcon };
      })
      .filter(Boolean) as (Category & { displayIcon: string | null })[];
  }, [categories, products]);

  const filteredProducts = React.useMemo(() => {
    let result = products.filter(p => {
      if (p.isVisible === false) return false;
      return isProductInStock(p);
    });

    if (activeCategory !== 'All') {
      result = result.filter(p => p.category?.trim()?.toLowerCase() === activeCategory.trim().toLowerCase());
    }

    if (sortOrder === 'high') {
      result = [...result].sort((a, b) => b.price - a.price);
    } else if (sortOrder === 'low') {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (websiteSettings?.smartProductDisplay) {
      // Smart Display Logic: Top Selling (desc) -> New -> Lowest Selling
      const salesMap: Record<string, number> = {};
      orders.forEach(order => {
        if (order.status !== 'Canceled') {
          order.items.forEach(item => {
            salesMap[item.product.id] = (salesMap[item.product.id] || 0) + item.quantity;
          });
        }
      });

      const computed = [...result].sort((a, b) => {
        const salesA = salesMap[a.id] || 0;
        const salesB = salesMap[b.id] || 0;
        
        // 1. Sort by Sales Descending
        if (salesA !== salesB) {
          return salesB - salesA;
        }

        // 2. If sales are equal, New products come first
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        
        // 3. Stable sort fallback based on ID to prevent randomness
        return a.id.localeCompare(b.id);
      });

      result = computed;
    }

    return result;
  }, [products, activeCategory, sortOrder, websiteSettings?.smartProductDisplay, orders]);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const cols = windowWidth >= 1024 ? 4 : (windowWidth >= 768 ? 3 : 2);
  const rowCount = Math.ceil(filteredProducts.length / cols);
  
  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 350,
    overscan: 5,
  });

  const cartTotalItems = React.useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const { total: cartTotalPrice, itemDiscounts: cartItemDiscounts } = React.useMemo(
    () => getCartTotal(cart, websiteSettings?.qtyRules),
    [cart, websiteSettings?.qtyRules]
  );

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handlers
  const addToCart = (product: Product, color?: string, variantId?: string, quantity: number = 1, variantName?: string, variantPrice?: number, variantBuyPrice?: number) => {
    const id = variantId ? `${product.id}-${variantId}` : color ? `${product.id}-${color}` : product.id;
    
    // Compute total available stock from live product state
    const liveProduct = products.find(p => p.id === product.id) || product;
    const availableStock = getAvailableStock(liveProduct, variantId);
    
    if (availableStock <= 0) {
      showToast(`This product is out of stock`);
      return;
    }

    const existing = cart.find(item => item.id === id);
    const currentQty = existing ? existing.quantity : 0;
    
    if (currentQty >= availableStock) {
      showToast(`Only ${availableStock} items available in stock`);
      return;
    }

    const newQty = Math.min(availableStock, currentQty + quantity);
    if (currentQty + quantity > availableStock) {
      showToast(`Only ${availableStock} items available in stock`);
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing) {
        return prev.map(item => item.id === id ? { ...item, quantity: newQty } : item);
      }
      return [...prev, { id, product: liveProduct, quantity: Math.min(availableStock, quantity), color, variantId, variantName, variantPrice, variantBuyPrice }];
    });
    
    trackMetaEvent('AddToCart', {
      content_ids: [product.id],
      contents: [{ id: product.id, quantity: 1 }],
      content_type: 'product',
      value: variantPrice ?? product.price,
      currency: 'BDT'
    }, marketingSettings.metaPixel);

    trackTikTokEvent('AddToCart', {
      contents: [{
        content_id: product.id,
        content_type: 'product',
        price: variantPrice ?? product.price,
        quantity
      }],
      value: variantPrice ?? product.price,
      currency: 'BDT'
    }, marketingSettings.tiktokPixel);

    trackGA4Event('add_to_cart', {
      currency: 'BDT',
      value: (variantPrice ?? product.price) * quantity,
      items: [
        {
          item_id: product.id,
          item_name: product.title,
          price: variantPrice ?? product.price,
          quantity: quantity
        }
      ]
    }, null, marketingSettings.ga4 || { enabled: false, measurementId: '', apiSecret: '' });
  };

  const updateQuantity = (cartItemId: string, value: number, isDelta: boolean = true) => {
    setCart(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const liveProduct = products.find(p => p.id === item.product?.id) || item.product;
        const availableStock = getAvailableStock(liveProduct, item.variantId);
        
        if (availableStock <= 0) {
          showToast(`This product is out of stock`);
          return { ...item, quantity: 0 };
        }

        const targetQty = isDelta ? item.quantity + value : value;
        let newQuantity = isDelta ? Math.max(1, targetQty) : Math.max(0, targetQty);
        
        if (newQuantity > availableStock) {
          showToast(`Only ${availableStock} items available in stock`);
          newQuantity = availableStock;
        }
        
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.id !== cartItemId));
  };

  const handleAddToOrderTemp = (product: Product, color?: any, variantId?: string, quantity: number = 1, variantName?: string, variantPrice?: number, variantBuyPrice?: number) => {
    const liveProduct = products.find(p => p.id === product.id) || product;
    const availableStock = getAvailableStock(liveProduct, variantId);
    
    if (availableStock <= 0) {
      showToast(`This product is out of stock`);
      return;
    }

    setAddingToOrderItems(prev => {
      const existingEntry = prev.find(item => item.product.id === product.id && (variantId ? item.variantId === variantId : color ? item.color === (color.name || color) : !item.color && !item.variantId));
      if (existingEntry) {
        const newQty = Math.min(availableStock, existingEntry.quantity + quantity);
        if (existingEntry.quantity + quantity > availableStock) {
          showToast(`Only ${availableStock} items available in stock`);
        }
        return prev.map(item => item.id === existingEntry.id ? { ...item, quantity: newQty } : item);
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        product: liveProduct,
        quantity: Math.min(availableStock, quantity),
        color: color?.name || color,
        variantId,
        variantName,
        variantPrice,
        variantBuyPrice
      }];
    });
  };

  const updateToOrderTempQuantity = (cartItemId: string, value: number, isDelta: boolean = true) => {
    setAddingToOrderItems(prev => prev.map(item => {
      if (item.id === cartItemId) {
        const liveProduct = products.find(p => p.id === item.product?.id) || item.product;
        const availableStock = getAvailableStock(liveProduct, item.variantId);
        
        if (availableStock <= 0) {
          showToast(`This product is out of stock`);
          return { ...item, quantity: 0 };
        }

        const targetQty = isDelta ? item.quantity + value : value;
        let newQuantity = isDelta ? Math.max(1, targetQty) : Math.max(0, targetQty);
        
        if (newQuantity > availableStock) {
          showToast(`Only ${availableStock} items available in stock`);
          newQuantity = availableStock;
        }
        
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeFromOrderTemp = (cartItemId: string) => {
    setAddingToOrderItems(prev => prev.filter(item => item.id !== cartItemId));
  };

  const confirmAddToCartItemsToOrder = () => {
    if (!addingToOrderId || addingToOrderItems.length === 0) return;

    // Compute the updated order first to ensure it is immediately available
    const orderToUpdate = orders.find(o => o.id === addingToOrderId) || myOrders.find(o => o.id === addingToOrderId);
    if (!orderToUpdate) {
      showToast("Order not found or no longer available.");
      return;
    }
    
    let newItems = [...orderToUpdate.items];

    addingToOrderItems.forEach(tempItem => {
      const existingItemIndex = newItems.findIndex(i => i.product.id === tempItem.product.id && i.color === tempItem.color && i.variantId === tempItem.variantId);
      if (existingItemIndex >= 0) {
        newItems[existingItemIndex] = { ...newItems[existingItemIndex], quantity: newItems[existingItemIndex].quantity + tempItem.quantity };
      } else {
        newItems.push({
          id: tempItem.id || Math.random().toString(36).substr(2, 9),
          product: tempItem.product,
          quantity: tempItem.quantity,
          color: tempItem.color,
          variantId: tempItem.variantId,
          variantName: tempItem.variantName,
          variantPrice: tempItem.variantPrice,
          variantBuyPrice: tempItem.variantBuyPrice
        });
      }
    });

    const newSubtotal = newItems.reduce((acc, current) => acc + ((current.variantPrice ?? current.product.price) * current.quantity), 0);
    const newTotal = Math.max(0, newSubtotal + (orderToUpdate.deliveryCharge || 0) - (orderToUpdate.discount || orderToUpdate.discountAmount || 0));

    const orderBuyCost = newItems.reduce((acc, current) => {
      const buyPrice = current.variantBuyPrice ?? (current.product.buyPrice ?? Math.floor((current.variantPrice ?? current.product.price) * 0.4));
      return acc + (buyPrice * current.quantity);
    }, 0);
    const newProfit = newSubtotal - (orderToUpdate.discount || orderToUpdate.discountAmount || 0) - orderBuyCost - (orderToUpdate.extraCosts || 0);

    const updatedOrder: Order = {
      ...orderToUpdate,
      items: newItems,
      totalAmount: newTotal,
      subtotal: newSubtotal,
      total: newTotal,
      profit: newProfit
    };

    // Calculate exact stock diff using standard math helper
    const { updatedProducts, changedProducts } = adjustOrderStockDiff(products, orderToUpdate, updatedOrder);

    // Update UI immediately with newly calculated stock
    setProducts(updatedProducts);

    setOrders(prevOrders => prevOrders.map(order => 
      order.id === addingToOrderId ? updatedOrder : order
    ));
    setMyOrders(prevOrders => prevOrders.map(o => o.id === addingToOrderId ? updatedOrder : o));

    // Send single backend request to Cloudflare D1 (the server handles DB updates and master sync seamlessly)
    cloudStore.publicAddToOrder({
      orderId: addingToOrderId,
      newItems: addingToOrderItems,
      customerPhone: (updatedOrder.userInfo as any)?.phone || (updatedOrder.clientInfo as any)?.phone || '',
      updatedOrder: updatedOrder,
      changedProducts: changedProducts
    }).catch(console.error);

    const newItemsAddedQty = addingToOrderItems.reduce((acc, item) => acc + item.quantity, 0);
    const previousTotalQty = orderToUpdate.items.reduce((acc, item) => acc + item.quantity, 0);
    const currentTotalQty = previousTotalQty + newItemsAddedQty;
    sendTelegramNotification('STOCK_UPDATED', updatedOrder, websiteSettings, previousTotalQty, currentTotalQty, newItemsAddedQty);

    showToast("Products added to order successfully!");
    setAddingToOrderId(null);
    setAddingToOrderItems([]);
    setSelectedProductForDetails(null);
  };

  const handleAddMoreToOrderProduct = (orderId: string, product: Product, color?: any, variantId?: string, quantity: number = 1, variantName?: string, variantPrice?: number, variantBuyPrice?: number) => {
    const processMoreToOrder = (order: Order) => {
      if (order.id === orderId) {
        // Check if item already exists
        const existingItemIndex = order.items.findIndex(item => item.product.id === product.id && item.color === color && item.variantId === variantId);
        
        let newItems = [...order.items];
        if (existingItemIndex >= 0) {
           newItems[existingItemIndex] = { ...newItems[existingItemIndex], quantity: newItems[existingItemIndex].quantity + quantity };
        } else {
           newItems.push({
             id: Math.random().toString(36).substr(2, 9),
             product,
             quantity,
             color,
             variantId,
             variantName,
             variantPrice,
             variantBuyPrice
           });
        }
        
        const newSubtotal = newItems.reduce((acc, current) => acc + ((current.variantPrice ?? current.product.price) * current.quantity), 0);
        const newTotal = newSubtotal + (order.deliveryCharge || 0) - (order.discount || order.discountAmount || 0);

        return {
          ...order,
          items: newItems,
          totalAmount: newTotal,
          subtotal: newSubtotal,
          total: newTotal
        };
      }
      return order;
    };
    setOrders(prevOrders => prevOrders.map(processMoreToOrder));
    setMyOrders(prevOrders => prevOrders.map(processMoreToOrder));
    showToast(`${product.title} added to Order #${orderId}`);
  };

  const placeOrder = async (userInfo: any, deliveryCharge: number, discountAmount: number = 0, discountName: string = '', discountId?: string) => {
    // 1. Strict pre-checkout stock verification
    for (const item of cart) {
      const liveProduct = products.find(p => p.id === item.product?.id) || item.product;
      const availableStock = getAvailableStock(liveProduct, item.variantId);
      if (availableStock <= 0) {
        alert(`"${liveProduct.title || 'Product'}" is out of stock. Please remove it from your cart.`);
        return;
      }
      if (item.quantity > availableStock) {
        alert(`"${liveProduct.title || 'Product'}" only has ${availableStock} items in stock. Please reduce your quantity.`);
        return;
      }
    }

    const { clientInfo, ...cleanUserInfo } = userInfo;
    const customerPhone = normalizePhone(cleanUserInfo.phone);
    const systemEnabled = websiteSettings.customers?.systemEnabled ?? true;
    let blockedPhones = websiteSettings.customers?.blockedPhones || [];
    let isBlocked = false;

    if (systemEnabled) {
      isBlocked = blockedPhones.some(p => normalizePhone(p) === customerPhone);
      
      if (!isBlocked && websiteSettings.customers?.autoBlockEnabled) {
        const cancelLimit = websiteSettings.customers.maxCancelLimit || 3;
        const cancelCount = orders.filter(o => normalizePhone(o.userInfo.phone) === customerPhone && (o.status === 'Canceled' || o.status === 'Returned' || o.status === 'Complete Return')).length;
        if (cancelCount >= cancelLimit) {
          isBlocked = true;
          setWebsiteSettings(prev => ({
            ...prev,
            customers: {
               ...(prev.customers || { systemEnabled: true, autoBlockEnabled: false, maxCancelLimit: 3, blockedPhones: [] }),
               blockedPhones: [...blockedPhones, customerPhone] // Storing original inputted phone format is fine, we check norm.
            }
          }));
        }
      }
    }

    const orderBuyCost = cart.reduce((acc, item) => {
      const buyPrice = item.variantBuyPrice ?? (item.product.buyPrice ?? Math.floor((item.variantPrice ?? item.product.price) * 0.4));
      return acc + (buyPrice * item.quantity);
    }, 0);
    const orderProfit = cartTotalPrice - discountAmount - orderBuyCost;

    
    let baseId = Math.floor(100 + Math.random() * 900).toString();

    const newOrder: Order = {
      id: baseId,
      date: format(new Date(), 'EEEE, MM/dd/yyyy, hh:mm a'),
      status: 'Pending',
      items: [...cart],
      userInfo: cleanUserInfo,
      deliveryCharge,
      subtotal: cartTotalPrice,
      total: Math.max(0, cartTotalPrice - discountAmount + deliveryCharge),
      discount: discountAmount,
      discountName: discountName,
      profit: orderProfit,
      clientInfo
    };

    if (isBlocked) {
      // Act completely normal but do NOT save the order
      setCart([]);
      setCheckoutOpen(false);
      setCartOpen(false);
      setSuccessOrder(newOrder); // Show success view
      return;
    }

    const newCustomer = {
      id: cleanUserInfo.phone,
      name: cleanUserInfo.name,
      phone: cleanUserInfo.phone,
      location: cleanUserInfo.address,
      joinedAt: new Date().getTime(),
      lastSeenAt: new Date().getTime(),
    };

    let serverOrder = newOrder;
    try {
        const incompleteOrderIdsToDelete = incompleteOrders
          .filter(o => normalizePhone(o.phone) === customerPhone)
          .map(o => o.id);

        const res = await cloudStore.publicCheckout({
            order: newOrder,
            customer: newCustomer,
            incompletePhone: customerPhone,
            incompleteOrderIdsToDelete,
            discountId
        });
        if (res && res.order) {
            serverOrder = res.order;
        } else {
            alert("Failed to place order. Please try again.");
            return;
        }
    } catch (e: any) {
        console.error("Public checkout failed:", e);
        const msg = e?.message && e.message !== 'Checkout API failed' ? e.message : "Network error. Could not place order. Please try again.";
        alert(msg);
        return;
    }

    setOrders([serverOrder, ...orders]);
    setMyOrderIds([...myOrderIds, serverOrder.id]);
    setMyOrders([serverOrder, ...myOrders]);

    setIncompleteOrders(prev => prev.filter(o => normalizePhone(o.phone) !== customerPhone));

    // Reduce stock locally for instant UI update
    setProducts(prevProducts => deductOrderStock(prevProducts, serverOrder));

    // Increment discount usage count locally
    if (discountId && websiteSettings?.discounts) {
      const updatedDiscounts = websiteSettings.discounts.map(d => {
        if (d.id === discountId) {
          return {
            ...d,
            limits: {
              ...d.limits,
              currentUsageGlobal: (d.limits.currentUsageGlobal || 0) + 1
            }
          };
        }
        return d;
      });
      setWebsiteSettings({ ...websiteSettings, discounts: updatedDiscounts });
    }

    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
    setSuccessOrder(serverOrder);
    const nameParts = userInfo.name ? userInfo.name.split(' ') : [];
    const fn = nameParts.length > 0 ? nameParts[0] : undefined;
    const ln = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

    sendTelegramNotification('NEW_ORDER', serverOrder, websiteSettings);

    trackMetaEvent('Purchase', {
      content_ids: cart.map(item => item.product.id),
      contents: cart.map(item => ({ id: item.product.id, quantity: item.quantity })),
      content_type: 'product',
      value: serverOrder.total,
      currency: 'BDT',
      num_items: cartTotalItems
    }, marketingSettings.metaPixel, {
      ph: userInfo.phone,
      em: userInfo.email,
      fn: fn,
      ln: ln,
      external_id: userInfo.phone // using phone as external ID if no user ID
    });

    trackTikTokEvent('PlaceAnOrder', {
      contents: cart.map(item => ({
        content_id: item.product.id,
        content_type: 'product',
        price: item.product.price,
        quantity: item.quantity
      })),
      value: serverOrder.total,
      currency: 'BDT'
    }, marketingSettings.tiktokPixel, {
      ph: userInfo.phone,
      em: userInfo.email,
      external_id: userInfo.phone // using phone as external ID if no user ID
    });

    trackGA4Event('purchase', {
      transaction_id: serverOrder.id,
      value: serverOrder.total,
      currency: 'BDT',
      tax: 0,
      shipping: deliveryCharge,
      items: cart.map(item => ({
        item_id: item.product.id,
        item_name: item.product.title,
        price: item.product.price,
        quantity: item.quantity
      }))
    }, {
      transaction_id: serverOrder.id,
      value: serverOrder.total,
      currency: 'BDT',
      tax: 0,
      shipping: deliveryCharge,
      items: cart.map(item => ({
        item_id: item.product.id,
        item_name: item.product.title,
        price: item.product.price,
        quantity: item.quantity
      }))
    }, marketingSettings.ga4 || { enabled: false, measurementId: '', apiSecret: '' }, { email: userInfo.email, phone: userInfo.phone });
  };

  const handleSaveIncompleteOrder = (phone: string, name: string, address: string) => {
    const normPhone = normalizePhone(phone);
    if (!normPhone) return;

    const now = Date.now();
    const duplicateControlValue = websiteSettings.incompleteOrdersFeature?.duplicateControlValue || 1;
    const duplicateControlUnit = websiteSettings.incompleteOrdersFeature?.duplicateControlUnit || 'days';
    
    let duplicateThresholdMs = duplicateControlValue * 24 * 60 * 60 * 1000;
    if (duplicateControlUnit === 'minutes') duplicateThresholdMs = duplicateControlValue * 60 * 1000;
    else if (duplicateControlUnit === 'hours') duplicateThresholdMs = duplicateControlValue * 60 * 60 * 1000;

    let targetToPersist: IncompleteOrder | null = null;

    setIncompleteOrders(prev => {
      const recentDuplicates = prev.filter(o => 
        normalizePhone(o.phone) === normPhone && (now - o.timestamp) < duplicateThresholdMs
      );

      if (recentDuplicates.length > 0) {
        // Update the most recent duplicate
        const updatedOrder: IncompleteOrder = {
          ...recentDuplicates[0],
          name: name || recentDuplicates[0].name,
          location: address || recentDuplicates[0].location,
          timestamp: now,
          cartItems: cart
        };
        targetToPersist = updatedOrder;
        
        return prev.map(o => {
          if (o.id === recentDuplicates[0].id) {
            return updatedOrder;
          }
          return o;
        });
      }

      // Add a new incomplete order
      const newIncomplete: IncompleteOrder = {
        id: Math.random().toString(36).substring(2, 9),
        phone,
        name,
        location: address,
        timestamp: now,
        status: 'Hot',
        contacted: false,
        cartItems: cart
      };
      targetToPersist = newIncomplete;
      
      return [newIncomplete, ...prev];
    });

    if (targetToPersist) {
      cloudStore.publicIncompleteOrder(targetToPersist).catch(console.error);
    }
  };

  const handleOrderAgain = (orderToReorder: Order) => {
    setCart(prevCart => {
      const newCart = [...prevCart];
      
      orderToReorder.items.forEach(item => {
        const product = products.find(p => p.id === item.product.id);
        const hasStock = product && isProductInStock(product);
        const isVisible = product?.isVisible !== false;

        if (product && hasStock && isVisible) {
          const availableStock = product.stock !== undefined && product.stock !== null ? Number(product.stock) : Infinity;
          const qtyToAdd = Math.min(item.quantity, availableStock);
          const existing = newCart.find(i => i.id === item.id);
          if (existing) {
            existing.quantity += qtyToAdd;
            if (availableStock !== Infinity && existing.quantity > availableStock) {
               existing.quantity = availableStock;
            }
          } else {
            newCart.push({ ...item, quantity: qtyToAdd });
          }
        }
      });
      return newCart;
    });

    setSelectedOrder(null);
    setCartTab('cart');
    setCartOpen(true);
  };

  if (isDashboardOpen) {
    return (
      <ErrorBoundary fallbackTitle="Admin Panel Error">
        <React.Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-[#09090b] text-white">Loading Admin...</div>}>
          <Dashboard 
            products={products} 
            setProducts={setProducts} 
            orders={orders} 
            setOrders={setOrders} 
            incompleteOrders={incompleteOrders} // Newly added
            setIncompleteOrders={setIncompleteOrders}
            categories={categories}
            setCategories={setCategories}
            websiteSettings={websiteSettings}
            setWebsiteSettings={setWebsiteSettings}
            marketingSettings={marketingSettings}
            setMarketingSettings={setMarketingSettings}
            courierSettings={courierSettings}
            setCourierSettings={setCourierSettings}
            priceCalculatorSettings={priceCalculatorSettings}
            setPriceCalculatorSettings={setPriceCalculatorSettings}
            onClose={() => setIsDashboardOpen(false)} 
            isMaintenanceMode={isMaintenanceMode}
            setIsMaintenanceMode={setIsMaintenanceMode}
          />
        </React.Suspense>
      </ErrorBoundary>
    );
  }

  if (isMaintenanceMode) {
    return (
      <div 
        className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center relative px-6"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 30%, #27272a 0%, #09090b 60%)'
        }}
        onClick={handleLogoClick}
      >
        <div className="flex flex-col items-center text-center max-w-sm z-10">
          <div className="mb-8 relative">
            <div className="w-16 h-16 bg-[#18181b] border border-[#fafafa]/30 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(250, 250, 250,0.1)]">
              <RefreshCw size={28} className="text-[#fafafa] animate-[spin_4s_linear_infinite]" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-[var(--theme-white)] mb-3 tracking-tight">
            WORK IN PROGRESS
          </h1>
          
          <p className="text-gray-400 text-base">
            We are making things better. We will be back shortly!
          </p>
        </div>
      </div>
    );
  }

  const themeVars = {
    '--theme-primary': websiteSettings.themeColors?.primary || '#ff4d6d',
    '--theme-primary-hover': `color-mix(in srgb, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 80%, black)`,
    '--theme-primary-gradient': `linear-gradient(90deg, color-mix(in srgb, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 76%, white 24%) 0%, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 45%, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 100%)`,
    '--theme-primary-shadow': `0 4px 14px color-mix(in srgb, ${websiteSettings.themeColors?.primary || '#ff4d6d'} 28%, transparent)`,
    '--theme-black': websiteSettings.themeColors?.black || '#000000',
    '--theme-white': websiteSettings.themeColors?.white || '#ffffff',
    '--store-bg': websiteSettings.themeColors?.bg || websiteSettings.themeColors?.white || '#ffffff',
  } as React.CSSProperties;

  return (
    <div style={themeVars} className="contents main-storefront">
      {!isDashboardOpen && (
        <style>
          {`
            ${websiteSettings.mainFont ? `
              @import url('https://fonts.googleapis.com/css2?family=${websiteSettings.mainFont.replace(/ /g, '+')}:wght@300;400;500;600;700&display=swap');
              .main-storefront * {
                font-family: "${websiteSettings.mainFont}", sans-serif !important;
              }
            ` : ''}
            ${websiteSettings.textBrightness !== undefined && websiteSettings.textBrightness !== 100 ? `
              .main-storefront * {
                -webkit-text-fill-color: color-mix(in srgb, currentcolor ${websiteSettings.textBrightness}%, transparent) !important;
              }
            ` : ''}
          `}
        </style>
      )}
      {selectedProductForDetails ? (
        <ProductDetails 
          key={selectedProductForDetails.id}
          product={selectedProductForDetails} 
          products={products}
          onBack={() => closeUrlModal()} 
          cart={addingToOrderId ? addingToOrderItems : cart}
          addToCart={addingToOrderId ? handleAddToOrderTemp : addToCart}
          updateQuantity={addingToOrderId ? updateToOrderTempQuantity : updateQuantity}
          removeFromCart={addingToOrderId ? removeFromOrderTemp : removeFromCart}
          onViewCart={() => {
            if (addingToOrderId) {
              confirmAddToCartItemsToOrder();
            } else {
              setCartTab('cart'); 
              setCartOpen(true);
            }
          }}
          onSearch={() => setSearchOpen(true)}
          onMenu={() => setSidebarOpen(true)}
          websiteSettings={websiteSettings}
          isAddingToOrder={!!addingToOrderId}
          cancelAddingToOrder={() => { setAddingToOrderId(null); setAddingToOrderItems([]); }}
          onAddToOrder={(p) => {
            // Unused as we now use generalized cart flow, but left just in case
          }}
          onProductSelect={(p) => setSelectedProductForDetails(p)}
        />
      ) : (
        <div className="min-h-screen bg-[var(--store-bg)] pb-24 font-sans text-[var(--theme-black)] w-full pt-16">
          {/* Header */}
          <header className="flex items-center justify-between px-2 py-3 bg-[var(--theme-white)] fixed top-0 left-0 right-0 w-full z-50 shadow-sm">
            <div className="flex items-center z-10">
              <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-[var(--theme-black)]">
                <Menu size={24} />
              </button>
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {websiteSettings.logoUrl ? (
                <img 
                  src={websiteSettings.logoUrl} 
                  alt="Logo" 
                  className="h-8 object-contain cursor-pointer select-none pointer-events-auto"
                  onClick={handleLogoClick}
                  onPointerDown={handleLogoPointerDown}
                  onPointerUp={handleLogoPointerUp}
                  onPointerLeave={handleLogoPointerUp}
                />
              ) : (
                <div 
                  className="h-8 w-8 cursor-pointer select-none pointer-events-auto"
                  onClick={handleLogoClick}
                  onPointerDown={handleLogoPointerDown}
                  onPointerUp={handleLogoPointerUp}
                  onPointerLeave={handleLogoPointerUp}
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 z-10 relative">
              <button 
                onClick={() => setSearchOpen(true)} 
                className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-100 text-gray-500 px-4 h-10 rounded-full w-64 hover:bg-gray-100 transition-colors mr-4"
              >
                <Search size={18} />
                <span className="text-sm">Search...</span>
              </button>

              <div className="w-10 h-10 flex justify-center items-center lg:hidden relative">
                <AnimatePresence>
                  {!isSearchOpen && (
                    <>
                      <motion.button 
                        key="search-button"
                        layoutId="search-bar-morph" 
                        style={{ borderRadius: 9999 }}
                        transition={{ type: "spring", bounce: 0.05, duration: 0.4 }}
                        onClick={() => setSearchOpen(true)} 
                        className="absolute w-10 h-10 bg-transparent overflow-hidden border-[1.5px] border-transparent"
                      />
                      <motion.button
                        key="search-icon"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                        onClick={() => setSearchOpen(true)} 
                        className="absolute w-10 h-10 bg-transparent flex items-center justify-center z-10 text-[var(--theme-black)]"
                      >
                        <Search size={22} />
                      </motion.button>
                    </>
                  )}
                </AnimatePresence>
              </div>
              <button onClick={() => { setCartTab('cart'); setCartOpen(true); }} className="p-2 -mr-2 text-[var(--theme-black)] relative">
                <ShoppingBag size={22} />
                {cartTotalItems > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-[var(--theme-primary)] text-[var(--theme-white)] text-[10px] font-bold rounded-full flex items-center justify-center">
                    {cartTotalItems}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* Banner Slider */}
          {websiteSettings.bannerEnabled && websiteSettings.banners.length > 0 && (
            <BannerSlider banners={websiteSettings.banners} borderRadius={websiteSettings.bannerBorderRadius} />
          )}

          {/* Category Nav */}
          <div className="flex overflow-x-auto no-scrollbar pt-3 pb-2 px-2 gap-2 lg:py-3 lg:gap-3 bg-[var(--store-bg)]">
            <button onClick={() => handleCategoryChange('All')} className="flex flex-col items-center gap-1 lg:gap-2 min-w-fit">
              <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-[var(--theme-white)] transition-all bg-[var(--theme-black)]", activeCategory === 'All' ? "ring-2 ring-offset-2 ring-[var(--theme-primary)]" : "")}>
                <LayoutGrid size={24} />
              </div>
              <span className={cn("text-xs font-medium", activeCategory === 'All' ? "text-[var(--theme-black)]" : "text-gray-500")}>All</span>
            </button>
            {activeCategoriesWithIcons.map(cat => {
              const isActive = activeCategory === cat.name;
              return (
                <button key={cat.id} onClick={() => handleCategoryChange(cat.name)} className="flex flex-col items-center gap-1 lg:gap-2 min-w-fit">
                  <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-[var(--theme-white)] transition-all bg-[var(--theme-black)] overflow-hidden relative", isActive ? "ring-2 ring-offset-2 ring-[var(--theme-primary)]" : "")}>
                    {cat.displayIcon ? (
                      <img src={cat.displayIcon} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-[var(--theme-white)]">{cat.name.charAt(0)}</span>
                    )}
                  </div>
                  <span className={cn("text-xs font-medium", isActive ? "text-[var(--theme-black)]" : "text-gray-500")}>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between px-1 py-1 lg:py-2 bg-[var(--store-bg)] relative z-20">
            <FilterDropdown sortOrder={sortOrder} onSort={setSortOrder} />
            <div className="flex items-center gap-2">
              {websiteSettings.stockOutFeature?.enabled && orders.filter(o => o.status === 'Completed').length >= (websiteSettings.stockOutFeature?.minOrdersRequired || 0) && (
                <button 
                  onClick={() => setStockOutViewOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100/80 rounded-full text-sm font-medium text-gray-700 active:bg-gray-200 transition-colors"
                >
                  <EyeOff size={14} />
                  stock-outs
                </button>
              )}
              {websiteSettings?.preOrder?.pWebsite?.enabled ? (
                <button 
                  onClick={() => {
                     const link = websiteSettings?.preOrder?.pWebsite?.link;
                     if (link) {
                        const formattedLink = link.startsWith('http') ? link : `https://${link}`;
                        window.open(formattedLink, '_blank');
                     }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100/80 rounded-full text-sm font-medium text-gray-700 active:bg-gray-200 transition-colors"
                >
                  <Unlock size={14} />
                  pre-order on
                </button>
              ) : (
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100/80 rounded-full text-sm font-medium text-gray-400 cursor-not-allowed">
                  <Lock size={14} />
                  pre-order off
                </button>
              )}
            </div>
          </div>

          {/* Product Grid */}
          <div ref={listRef} className="w-full relative px-1 pb-1" style={{ height: `${virtualizer.getTotalSize()}px` }}>
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
                className={cn("grid gap-1 px-1 pb-1 lg:gap-4 lg:p-4", cols === 4 ? "grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2")}
              >
                {Array.from({ length: cols }).map((_, i) => {
                  const productIndex = virtualRow.index * cols + i;
                  const product = filteredProducts[productIndex];
                  if (!product) return <div key={`empty-${i}`} />;

                  // Find if product is in cart (any color)
              const cartItem = addingToOrderId 
                ? addingToOrderItems.find(item => item.product.id === product.id)
                : cart.find(item => item.product.id === product.id);

              const handleRemove = (id: string) => addingToOrderId ? removeFromOrderTemp(id) : removeFromCart(id);
              const handleUpdate = (id: string, val: number, isDelta: boolean = true) => addingToOrderId ? updateToOrderTempQuantity(id, val, isDelta) : updateQuantity(id, val, isDelta);
              const handleAdd = (p: Product) => {
                if (p.hasVariants && p.variants && p.variants.length > 0) {
                  setVariantModalProduct(p);
                } else if (p.colors && p.colors.length > 0) {
                  setColorModalProduct(p);
                } else if (addingToOrderId) {
                   handleAddToOrderTemp(p);
                } else {
                   addToCart(p);
                }
              };
              
              return (
                <div 
                  key={product.id} 
                  className="bg-[var(--theme-white)] rounded-lg overflow-hidden shadow-sm border border-gray-100 flex flex-col group cursor-pointer"
                  onClick={() => {
                    if (preventClick) return;
                    setSelectedProductForDetails(product);
                    trackMetaEvent('ViewContent', {
                      content_ids: [product.id],
                      contents: [{ id: product.id, quantity: 1 }],
                      content_type: 'product',
                      value: product.price,
                      currency: 'BDT'
                    }, marketingSettings.metaPixel);

                    trackTikTokEvent('ViewContent', {
                      contents: [{
                        content_id: product.id,
                        content_type: 'product',
                        price: product.price,
                        quantity: 1
                      }],
                      value: product.price,
                      currency: 'BDT'
                    }, marketingSettings.tiktokPixel);

                    trackGA4Event('view_item', {
                      currency: 'BDT',
                      value: product.price,
                      items: [{
                        item_id: product.id,
                        item_name: product.title,
                        price: product.price,
                        quantity: 1
                      }]
                    }, null, marketingSettings.ga4 || { enabled: false, measurementId: '', apiSecret: '' });
                  }}
                >
                  <div 
                    className="relative aspect-square w-full overflow-hidden bg-gray-100 group"
                    onTouchStart={() => {
                      touchStartTimeRef.current = Date.now();
                      setHoveredProductId(product.id);
                    }}
                    onTouchEnd={() => {
                      setHoveredProductId(null);
                      if (Date.now() - touchStartTimeRef.current > 200) {
                        setPreventClick(true);
                        setTimeout(() => setPreventClick(false), 50);
                      }
                    }}
                    onTouchCancel={() => setHoveredProductId(null)}
                  >
                      <img 
                        src={product.thumbnail || product.image} 
                        alt={product.title} 
                        loading="lazy"
                        decoding="async"
                        className={cn(
                          "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                          websiteSettings.productImageHover && product.images && product.images.length > 1 ? "group-hover:opacity-0" : "",
                          websiteSettings.productImageHover && product.images && product.images.length > 1 && hoveredProductId === product.id ? "opacity-0" : ""
                        )}
                      />
                      {websiteSettings.productImageHover && product.images && product.images.length > 1 && (
                        <img 
                          src={product.thumbnails?.[1] || product.images[1]} 
                          alt={`${product.title} hover`} 
                          loading="lazy"
                          decoding="async"
                          className={cn(
                            "absolute inset-0 w-full h-full object-cover transition-opacity duration-300",
                            hoveredProductId === product.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                          )}
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
                  <div className="p-[2px] flex flex-col flex-grow gap-[2px]">
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
                    <div className="font-bold text-[16px] lg:text-lg">{formatPrice(product.price)}</div>

                    {cartItem && (!product.hasVariants || !product.variants?.length) ? (
                      <div className="flex items-center justify-between w-full h-[36px] lg:h-[40px]" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => { e.stopPropagation(); handleRemove(cartItem.id); }} className="w-[36px] lg:w-[40px] h-full flex items-center justify-center text-red-500 border border-red-200 rounded-full bg-red-50">
                          <Trash2 size={16} />
                        </button>
                        <div className="flex items-center border border-gray-200 rounded-full h-full bg-[var(--theme-white)]" onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => { e.stopPropagation(); handleUpdate(cartItem.id, -1); }} className="w-[36px] lg:w-[40px] h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-l-full">
                            <Minus size={16} />
                          </button>
                          <input 
                            type="number" 
                            className="w-10 text-center font-medium text-sm appearance-none border-none outline-none focus:outline-none bg-transparent p-0 m-0 focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            value={cartItem.quantity === 0 ? '' : (cartItem.quantity || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                handleUpdate(cartItem.id, 0, false);
                                return;
                              }
                              const num = parseInt(val);
                              if (!isNaN(num)) {
                                handleUpdate(cartItem.id, num, false);
                              }
                            }}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value);
                              if (isNaN(val) || val < 1) {
                                handleUpdate(cartItem.id, 1, false);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button onClick={(e) => { e.stopPropagation(); handleUpdate(cartItem.id, 1); }} className="w-[36px] lg:w-[40px] h-full flex items-center justify-center text-gray-500 hover:bg-gray-50 rounded-r-full">
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdd(product);
                        }}
                        className="btn-gradient w-full h-9 xl:h-10 rounded-full gap-1.5"
                      >
                        {addingToOrderId ? (cartItem ? <><Plus size={15} /> Add more</> : <><Plus size={15} /> Add to Order</>) : (cartItem ? "Add more" : "Add to cart")}
                      </button>
                    )}
                  </div>
                </div>
              );
                })}
              </div>
            ))}
          </div>

          {/* Floating Cart */}
          {cart.length > 0 && !addingToOrderId && (
            <ActionBtn
              config={websiteSettings?.actionButtons?.viewCart || DEFAULT_ACTION_BUTTONS.viewCart}
              onClick={() => { setCartTab('cart'); setCartOpen(true); }}
              label="View Cart"
              badge={cartTotalItems}
              rightText={formatPrice(cartTotalPrice)}
            />
          )}

          {addingToOrderId && addingToOrderItems.length > 0 && (
            <div className="fixed z-40" style={{
              bottom: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).marginBottom,
              left: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position.includes('left') ? (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).marginLeft || '16px' : undefined,
              right: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position.includes('right') ? (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).marginRight || '16px' : undefined,
              display: 'flex', gap: '8px', 
              width: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position === 'bottom-center' || (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position === 'top-center' ? 'calc(100% - 32px)' : undefined,
              marginLeft: (websiteSettings?.actionButtons?.confirmOrder || DEFAULT_ACTION_BUTTONS.confirmOrder).position === 'bottom-center' ? '16px' : undefined
            }}>
              <button 
                onClick={() => { setAddingToOrderId(null); setAddingToOrderItems([]); }}
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
                  width: '100%', // Override width to fill container
                  position: 'bottom-left' // Mock position to avoid it rendering its own fixed wrapper absolute bounds
                }}
                className="flex-1"
                style={{ position: 'relative', bottom: 'auto', left: 'auto', right: 'auto', top: 'auto', transform: 'none', margin: '0' }}
                onClick={confirmAddToCartItemsToOrder}
                label="Confirm"
                badge={addingToOrderItems.reduce((acc, item) => acc + item.quantity, 0)}
                rightText={formatPrice(addingToOrderItems.reduce((acc, item) => acc + (item.variantPrice ?? item.product.price) * item.quantity, 0))}
              />
            </div>
          )}

          {addingToOrderId && addingToOrderItems.length === 0 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex justify-center">
              <button 
                onClick={() => { setAddingToOrderId(null); setAddingToOrderItems([]); }}
                className="w-14 h-14 bg-[var(--theme-white)] text-[var(--theme-black)] rounded-full flex items-center justify-center shadow-lg font-bold border border-gray-200 hover:bg-gray-50 transition-colors"
                aria-label="Cancel"
              >
                <X size={24} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <React.Suspense fallback={null}>
      <AnimatePresence>
        {isSidebarOpen && <Sidebar onClose={() => setSidebarOpen(false)} activeCategory={activeCategory} setActiveCategory={(cat) => { handleCategoryChange(cat); setSelectedProductForDetails(null); }} categories={categories} products={products} websiteSettings={websiteSettings} />}
        {isSearchOpen && (
          <SearchModal 
            onClose={() => closeUrlModal()} 
            products={products} 
            onProductClick={(p) => {
              navigate(`/product/${p.id}`, { state: { internalUiObj: true } });
              trackMetaEvent('ViewContent', {
                content_ids: [p.id],
                contents: [{ id: p.id, quantity: 1 }],
                content_type: 'product',
                value: p.price,
                currency: 'BDT'
              }, marketingSettings.metaPixel);

              trackTikTokEvent('ViewContent', {
                contents: [{
                  content_id: p.id,
                  content_type: 'product',
                  price: p.price,
                  quantity: 1
                }],
                value: p.price,
                currency: 'BDT'
              }, marketingSettings.tiktokPixel);

              trackGA4Event('view_item', {
                currency: 'BDT',
                value: p.price,
                items: [{
                  item_id: p.id,
                  item_name: p.title,
                  price: p.price,
                  quantity: 1
                }]
              }, null, marketingSettings.ga4 || { enabled: false, measurementId: '', apiSecret: '' });
            }}
          />
        )}
        {isCartOpen && (
          <CartModal 
            onClose={() => closeUrlModal()} 
            cart={cart} 
            orders={myOrders}
            tab={cartTab}
            setTab={setCartTab}
            updateQuantity={updateQuantity} 
            removeFromCart={removeFromCart} 
            websiteSettings={websiteSettings}
            products={products}
            onCheckout={() => { 
              if (websiteSettings?.minOrderFeature?.enabled) {
                if (cartTotalItems < websiteSettings.minOrderFeature.minQuantity) {
                  setIsMinOrderPopupOpen(true);
                  return;
                }
              }

              setCartOpen(false); 
              setCheckoutOpen(true); 
              trackMetaEvent('InitiateCheckout', {
                content_ids: cart.map(item => item.product.id),
                contents: cart.map(item => ({ id: item.product.id, quantity: item.quantity })),
                content_type: 'product',
                value: cartTotalPrice,
                currency: 'BDT',
                num_items: cartTotalItems
              }, marketingSettings.metaPixel);

              trackTikTokEvent('InitiateCheckout', {
                contents: cart.map(item => ({
                  content_id: item.product.id,
                  content_type: 'product',
                  price: item.product.price,
                  quantity: item.quantity
                })),
                value: cartTotalPrice,
                currency: 'BDT'
              }, marketingSettings.tiktokPixel);

              trackGA4Event('begin_checkout', {
                currency: 'BDT',
                value: cartTotalPrice,
                items: cart.map(item => ({
                  item_id: item.product.id,
                  item_name: item.product.title,
                  price: item.product.price,
                  quantity: item.quantity
                }))
              }, null, marketingSettings.ga4 || { enabled: false, measurementId: '', apiSecret: '' });
            }} 
            onViewOrder={(o) => { setCartOpen(false); setSelectedOrder(o); }}
            onOrderAgain={handleOrderAgain}
            onAddMoreToOrder={(orderId) => {
              setAddingToOrderItems([]);
              setAddingToOrderId(orderId);
              setCartOpen(false);
            }}
          />
        )}
        {isCheckoutOpen && (
          <CheckoutModal 
            onClose={() => closeUrlModal()} 
            cart={cart} 
            orders={myOrders}
            onPlaceOrder={placeOrder} 
            websiteSettings={websiteSettings}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            onSaveIncompleteOrder={handleSaveIncompleteOrder}
          />
        )}
        {selectedOrder && (
          <OrderDetailsModal 
            order={selectedOrder} 
            products={products}
            websiteSettings={websiteSettings}
            onClose={() => setSelectedOrder(null)} 
            onOrderAgain={handleOrderAgain}
            onCancelOrder={(orderId: string) => {
              const orderToCancel = orders.find(o => o.id === orderId) || myOrders.find(o => o.id === orderId);
              if (orderToCancel) {
                // Restore stock locally
                setProducts(prevProducts => restoreOrderStock(prevProducts, orderToCancel));
                
                notifyMasterStockSync(orderToCancel, websiteSettings, true);
                
                const canceledOrder = { ...orderToCancel, status: 'Canceled' as OrderStatus };
                cloudStore.publicCancelOrder(orderId, orderToCancel.userInfo?.phone || orderToCancel.clientInfo?.phone || '').catch(console.error);
                sendTelegramNotification('ORDER_CANCELLED', canceledOrder, websiteSettings);
              }
              const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: 'Canceled' as OrderStatus } : o);
              setOrders(updatedOrders);
              setMyOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Canceled' as OrderStatus } : o));
              setSelectedOrder({ ...selectedOrder, status: 'Canceled' });
              showToast("Your order has been cancelled successfully");
            }}
            onUpdateOrder={(updatedOrder: Order, stockChanges: { productId: string, variantId?: string, product?: any, delta: number }[]) => {
              setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
              setMyOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
              
              const oldOrder = orders.find(o => o.id === updatedOrder.id) || myOrders.find(o => o.id === updatedOrder.id);
              const previousTotalQty = oldOrder ? oldOrder.items.reduce((acc, item) => acc + item.quantity, 0) : undefined;
              const currentTotalQty = updatedOrder.items.reduce((acc, item) => acc + item.quantity, 0);

              const finalChangedProducts: Product[] = [];

              // Apply stock changes synchronously so finalChangedProducts is populated immediately
              if (stockChanges && stockChanges.length > 0) {
                const nextProducts = products.map(p => {
                  const change = stockChanges.find(sc => sc.productId === p.id);
                  if (change) {
                    let updated = { ...p };
                    if (change.variantId && updated.variants && updated.variants.length > 0) {
                      updated.variants = updated.variants.map((v: any) => {
                        if (v.id === change.variantId && v.stock !== undefined && v.stock !== null) {
                          return { ...v, stock: Math.max(0, Number(v.stock) + change.delta) };
                        }
                        return v;
                      });
                      const totalVariantStock = updated.variants.reduce((acc: number, v: any) => acc + (Number(v.stock) || 0), 0);
                      updated.stock = totalVariantStock;
                      if (totalVariantStock === 0) {
                        updated.stockOutDate = new Date().toISOString();
                      } else {
                        updated.stockOutDate = undefined;
                        updated.isVisible = true;
                      }
                      finalChangedProducts.push(updated);
                      return updated;
                    } else if (p.stock !== undefined && p.stock !== null) {
                      const newStock = Math.max(0, Number(p.stock) + change.delta);
                      updated.stock = newStock;
                      if (newStock === 0) {
                        updated.stockOutDate = new Date().toISOString();
                      } else {
                        updated.stockOutDate = undefined;
                        updated.isVisible = true;
                      }
                      finalChangedProducts.push(updated);
                      return updated;
                    }
                  }
                  return p;
                });

                setProducts(nextProducts);
                
                // Notify master of delta stock changes
                const fakeOrderForSync = {
                  items: stockChanges.map(sc => ({
                    product: sc.product || products.find(p => p.id === sc.productId) || { id: sc.productId },
                    variantId: sc.variantId,
                    quantity: -sc.delta // if delta is positive (item quantity decreased), we restore, meaning deduct -delta
                  }))
                };
                notifyMasterStockSync(fakeOrderForSync, websiteSettings, false);
              }

              cloudStore.publicAddToOrder({
                orderId: updatedOrder.id,
                newItems: [],
                customerPhone: (updatedOrder.userInfo as any)?.phone || (updatedOrder.clientInfo as any)?.phone || '',
                updatedOrder: updatedOrder,
                changedProducts: finalChangedProducts
              }).catch(console.error);
              
              if (previousTotalQty !== currentTotalQty) {
                sendTelegramNotification('ORDER_UPDATED', updatedOrder, websiteSettings, previousTotalQty, currentTotalQty);
              }
              
              setSelectedOrder(updatedOrder);
              showToast("Order updated successfully");
            }}
          />
        )}
        {successOrder && (
          <ThankYouModal 
            order={successOrder} 
            onClose={() => { 
              setSuccessOrder(null); 
              setCheckoutOpen(false); 
              navigate('/', { replace: true });
            }} 
            onViewDetails={(o) => {
              setSuccessOrder(null);
              setCheckoutOpen(false);
              setSelectedOrder(o);
            }} 
          />
        )}
        {colorModalProduct && (
          <ColorModal 
            product={colorModalProduct} 
            onClose={() => setColorModalProduct(null)} 
            onAdd={(p, c) => {
               if (addingToOrderId) {
                 handleAddToOrderTemp(p, c);
               } else {
                 addToCart(p, c);
               }
            }} 
          />
        )}
        {variantModalProduct && (
          <VariantModal 
            product={variantModalProduct} 
            onClose={() => setVariantModalProduct(null)} 
            onAdd={(p, variant, quantity) => {
               const variantName = Object.values(variant.options || {}).map(v => String(v).toUpperCase()).join(" / ");
               if (addingToOrderId) {
                 handleAddToOrderTemp(p, undefined, variant.id, quantity, variantName, variant.price, variant.buyPrice);
               } else {
                 addToCart(p, undefined, variant.id, quantity, variantName, variant.price, variant.buyPrice);
               }
               setVariantModalProduct(null);
            }} 
          />
        )}
        {previewImage && (
          <ImagePreviewModal
            src={previewImage}
            onClose={() => setPreviewImage(null)}
          />
        )}
        {isStockOutViewOpen && (
          <StockOutView 
            products={products} 
            onClose={() => setStockOutViewOpen(false)} 
          />
        )}
      </AnimatePresence>
      </React.Suspense>
      {/* Min Order Popup */}
      <MinOrderPopup 
        isOpen={isMinOrderPopupOpen}
        onClose={() => setIsMinOrderPopupOpen(false)}
        message={websiteSettings?.minOrderFeature?.message || 'সর্বনিম্ন যেকোনো ৩টি কিনতে হবে'}
        autoCloseTime={websiteSettings?.minOrderFeature?.autoCloseTime || 0}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-hover)] text-[var(--theme-white)] px-6 py-3 rounded-full shadow-xl font-medium text-sm whitespace-nowrap transition-colors"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Social Buttons */}
      {(!isCartOpen && !isCheckoutOpen) && (
        <FloatingSocialButtons 
          links={websiteSettings.socialLinks || []} 
          mainIcon={websiteSettings.socialMediaMainIcon}
          config={websiteSettings?.actionButtons?.viewCart || DEFAULT_ACTION_BUTTONS.viewCart}
          isCartVisible={cart.length > 0 && !addingToOrderId}
        />
      )}
    </div>
  );
}

// --- Components ---
