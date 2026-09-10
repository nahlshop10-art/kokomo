import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Home, Filter, Edit, Plus, LayoutDashboard, Package, 
  ShoppingCart, Settings, ChevronLeft, Save, Upload, X, Eye, EyeOff,
  Trash2, Move, RefreshCcw, ChevronDown, ChevronUp, Image as ImageIcon,
  LayoutGrid, Activity, Check, SlidersHorizontal, Calendar as CalendarIcon,
  ChevronRight, Edit3, Copy, RefreshCw, Palette, Factory, BadgePercent, Globe, CreditCard, Truck, JapaneseYen, Target, LogOut, User, ShieldAlert, UserCheck, UserX, Unlock, Lock,
  Printer, CheckSquare, PackagePlus, AlertCircle, FileArchive, FolderArchive, Calculator, PackageX, Download,
  HelpCircle, Shield, Layers, Database, Info, ExternalLink,
  TrendingUp, ShoppingBag, CircleDollarSign, Undo2, MinusCircle, ClipboardList, ClipboardCheck, XCircle, Tag,
  Star, Key, FileText, Type, AlignLeft, Share2, Lightbulb, Mail, Clock, BarChart2,
  Building, Percent, Send, MessageCircle, Box, Image
} from 'lucide-react';
import { Product, Order, OrderStatus, Category, WebsiteSettings, DeliveryCharge, MarketingSettings, GA4Settings, PixelBatchSettings, SeoSettings, CourierSettings, PriceCalculatorSettings, AdminUser, DiscountRule, DiscountType, DEFAULT_ADMIN_PERMISSIONS } from './types';
import { restoreOrderStock, deductOrderStock, notifyMasterStockSync, adjustOrderStockDiff, notifyMasterStockSyncDiff, getAvailableStock } from './lib/stockUtils';
import { cn, formatPrice, useScrollRestore, slugify } from './lib/utils';
import { useHistoryModal } from './hooks/useHistoryModal';
import { downloadReceiptAsJPG } from './lib/downloadReceipt';
import { Receipt } from './components/Receipt';

import { cloudStore } from './lib/cloudStore';
import { getDefaultImageOptimization, setDefaultImageOptimization, ImageOptimizationConfig } from './lib/imageOptimizationWorker';
import ProductEditorModal, { clean1688Url } from './ProductEditorModal';
import OrderDetailsModal from './OrderDetailsModal';
import ZipImportModal from './components/ZipImportModal';
import FbZipExportModal from './components/FbZipExportModal';
import { DatePicker } from './components/DatePicker';
import DiscountManager from './DiscountManager';
import CustomersManager from './CustomersManager';
import AccountControlManager from './AccountControlManager';
import CustomiseManager from './CustomiseManager';
import SupplierManager from './SupplierManager';
import { DashboardProductsGrid } from './components/DashboardProductsGrid';
import BulkPriceManager from './BulkPriceManager';
import IncompleteOrdersManager from './IncompleteOrdersManager';
import AntiSpamManager from './AntiSpamManager';
import MinOrderManager from './MinOrderManager';
import SocialMediaManager from './SocialMediaManager';
import PreOrderManager from './PreOrderManager';
import { ApiSyncManager } from './ApiSyncManager';
import NotificationManager from './NotificationManager';
import { CopyButton } from './components/CopyButton';
import AdminLoadingScreen from './components/AdminLoadingScreen';
import { useScrollLock } from './hooks/useScrollLock';

interface DashboardProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  websiteSettings: WebsiteSettings;
  setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>;
  marketingSettings: MarketingSettings;
  setMarketingSettings: React.Dispatch<React.SetStateAction<MarketingSettings>>;
  courierSettings: CourierSettings;
  setCourierSettings: React.Dispatch<React.SetStateAction<CourierSettings>>;
  priceCalculatorSettings: PriceCalculatorSettings;
  setPriceCalculatorSettings: React.Dispatch<React.SetStateAction<PriceCalculatorSettings>>;
  onClose: () => void;
  isMaintenanceMode: boolean;
  setIsMaintenanceMode: (val: boolean) => void;
  incompleteOrders?: any[];
  setIncompleteOrders?: React.Dispatch<React.SetStateAction<any[]>>;
}

type TopBarMode = 'default' | 'search' | 'category' | 'filter' | 'move' | 'visibility' | 'delete';

let hasRunCleanup = false;

// Memoized Top Product item with lightweight hardware-accelerated 3D Card Flip
const TopProductItem = React.memo(({ 
  product, 
  quantity, 
  showImages,
  isDeleteMode,
  isSelected,
  onToggleSelect,
}: { 
  product: Product; 
  quantity: number; 
  showImages: boolean; 
  isDeleteMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    if (isDeleteMode && isFlipped) {
      setIsFlipped(false);
    }
  }, [isDeleteMode, isFlipped]);

  if (!product) return null;
  const stock = getAvailableStock(product);

  // Dynamic stock badge color: 0-5 Red, 6-15 Yellow, 16+ Green
  let stockBadgeColor = "bg-emerald-500 text-white shadow-emerald-500/30";
  if (stock <= 5) {
    stockBadgeColor = "bg-red-500 text-white shadow-red-500/30";
  } else if (stock <= 15) {
    stockBadgeColor = "bg-amber-400 text-black shadow-amber-400/30 font-black";
  }

  let targetUrl = clean1688Url(product.link1688);
  if (targetUrl && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = `https://${targetUrl}`;
  }

  const handleCardClick = () => {
    if (isDeleteMode) {
      onToggleSelect && onToggleSelect();
    } else {
      setIsFlipped(prev => !prev);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`card-flip-container relative aspect-square select-none cursor-pointer rounded-xl transition-all ${
        isDeleteMode ? 'hover:opacity-90' : 'hover:scale-[1.02]'
      }`}
    >
      <div 
        className={`card-flip-inner relative w-full h-full rounded-xl ${
          isFlipped ? 'is-flipped' : ''
        }`}
      >
        {/* FRONT FACE: Thumbnail + Stock + Sales */}
        <div 
          className={`card-flip-front absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-[var(--dash-card)] border transition-colors ${
            isSelected 
              ? 'border-red-500 ring-2 ring-red-500/50' 
              : 'border-[var(--dash-border)] hover:border-slate-500 hover:shadow-lg'
          }`}
        >
          {showImages && (
            <img 
              src={product.thumbnail || product.image || ''} 
              alt={product.title || ''} 
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          )}
          {isDeleteMode && (
            <div className={`absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center z-10 transition-colors ${
              isSelected ? 'bg-red-500 text-white' : 'bg-black/60 border border-white/40 text-transparent'
            }`}>
              <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}

          {/* Stock Quantity Badge with dynamic color (0-5 Red, 6-15 Yellow, 16+ Green) */}
          <div 
            title={`Remaining Stock: ${stock}`}
            className={`absolute ${isDeleteMode ? 'bottom-1 left-1' : 'top-1 left-1'} ${stockBadgeColor} text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full z-10 shadow-md min-w-[18px] sm:min-w-[20px] text-center border border-black/10 pointer-events-none`}
          >
            {stock}
          </div>

          {/* Sales Quantity Badge (Top-Right) */}
          <div 
            title={`Sold in Period: ${quantity}`}
            className="absolute top-1 right-1 bg-[#fafafa] text-[var(--dash-bg)] text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full z-10 shadow-md border border-black/10 pointer-events-none"
          >
            {quantity}
          </div>
        </div>

        {/* BACK FACE: 1688 Code & Order Now Button */}
        <div 
          className="card-flip-back absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-slate-900/95 border border-orange-500/50 p-2 sm:p-2.5 flex flex-col justify-between items-center text-center shadow-xl backdrop-blur-sm select-none"
        >
          {/* Top: 1688 Product Code */}
          <div className="w-full flex flex-col items-center justify-center pt-1 min-w-0">
            <span className="text-[10px] sm:text-[11px] font-semibold text-gray-400 tracking-tight flex items-center gap-1">
              <span className="text-orange-400 font-bold">1688</span> Code
            </span>
            {product.code1688 ? (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="mt-1 flex items-center justify-center gap-1 max-w-full px-1.5 py-0.5 rounded bg-black/60 border border-orange-500/30 text-orange-300 font-mono text-[11px] sm:text-xs font-bold shadow-inner"
              >
                <span className="truncate max-w-[55px] sm:max-w-[75px]">{product.code1688}</span>
                <CopyButton text={product.code1688} className="p-0.5 text-orange-400 hover:text-white shrink-0" />
              </div>
            ) : (
              <span className="mt-1 text-[10px] text-gray-500 italic">No code</span>
            )}
          </div>

          {/* Bottom: Order Now Button */}
          <div className="w-full pb-0.5" onClick={(e) => e.stopPropagation()}>
            {targetUrl ? (
              <a 
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white font-bold rounded-lg text-[11px] sm:text-xs flex items-center justify-center gap-1 shadow-md shadow-orange-600/30 transition-all cursor-pointer"
              >
                <span>Order Now</span>
                <ExternalLink size={11} className="shrink-0" />
              </a>
            ) : (
              <button 
                type="button"
                onClick={() => {
                  const query = encodeURIComponent(product.code1688 || product.title);
                  window.open(`https://m.1688.com/top/.html?keywords=${query}`, '_blank');
                }}
                className="w-full py-1.5 px-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-orange-400 border border-orange-500/40 font-bold rounded-lg text-[11px] sm:text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <span>Order Now</span>
                <ExternalLink size={11} className="shrink-0" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function Dashboard({ products, setProducts, orders, setOrders, incompleteOrders, setIncompleteOrders, categories, setCategories, websiteSettings, setWebsiteSettings, marketingSettings, setMarketingSettings, courierSettings, setCourierSettings, priceCalculatorSettings, setPriceCalculatorSettings, onClose, isMaintenanceMode, setIsMaintenanceMode }: DashboardProps) {
  useScrollLock(true);
  const [activeTab, setActiveTab] = useState('Products');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    let timeoutId: any = null;
    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowWidth(window.innerWidth);
      }, 150);
    };
    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const [settingsView, setSettingsView] = useState<'main' | 'categories' | 'website' | 'marketing' | 'courier' | 'priceCalculator' | 'account' | 'accountControl' | 'discounts' | 'customers' | 'suppliers' | 'customise' | 'qtyRules' | 'incompleteOrders' | 'antiSpam' | 'minOrder' | 'bulkPrice' | 'socialMedia' | 'preOrder' | 'imageSettings' | 'seoSettings' | 'apiSync' | 'notification' | 'fbZipExport'>('main');
  
  const location = useLocation();
  const navigate = useNavigate();
  const isUpdatingFromUrl = useRef(false);

  // Sync URL -> State
  useEffect(() => {
     isUpdatingFromUrl.current = true;
     const path = location.pathname;
     if (path.startsWith('/admin/settings/')) {
        const slug = path.replace('/admin/settings/', '');
        setActiveTab('Settings');
        const validViews = ['main', 'categories', 'website', 'marketing', 'courier', 'priceCalculator', 'account', 'accountControl', 'discounts', 'customers', 'suppliers', 'customise', 'qtyRules', 'incompleteOrders', 'antiSpam', 'minOrder', 'bulkPrice', 'socialMedia', 'preOrder', 'imageSettings', 'seoSettings', 'apiSync', 'notification', 'fbZipExport'];
        const matchedView = validViews.find(v => slugify(v) === slug) || slug;
        setSettingsView(matchedView as any);
        setSelectedOrder(null);
        setEditingProduct(null);
        setIsAddingProduct(false);
        setShowZipImport(false);
        setShowFbZipExport(false);
     } else if (path === '/admin/settings') {
        setActiveTab('Settings');
        setSelectedOrder(null);
        setEditingProduct(null);
        setIsAddingProduct(false);
        setShowZipImport(false);
        setShowFbZipExport(false);
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
          setSettingsView('categories');
        } else {
          setSettingsView('main');
        }
     } else if (path.startsWith('/admin/')) {
        const slug = path.replace('/admin/', '');
        const tabs = ['Dashboard', 'Products', 'Orders', 'Settings'];
        const mTab = tabs.find(t => slugify(t) === slug);
        if (mTab) {
           setActiveTab(mTab);
           setSelectedOrder(null);
           setEditingProduct(null);
           setIsAddingProduct(false);
           setShowZipImport(false);
           setShowFbZipExport(false);
           if (mTab !== 'Settings') {
             setSettingsView('main');
           } else if (typeof window !== 'undefined' && window.innerWidth >= 768) {
             setSettingsView('categories');
           }
        }
     } else if (path === '/admin') {
        setActiveTab('Products');
        setSelectedOrder(null);
        setEditingProduct(null);
        setIsAddingProduct(false);
        setShowZipImport(false);
        setShowFbZipExport(false);
        setSettingsView('main');
     }
     setTimeout(() => { isUpdatingFromUrl.current = false; }, 50);
  }, [location.pathname]);

  // Sync State -> URL
  useEffect(() => {
     if (isUpdatingFromUrl.current) return;
     let target = '/admin';
     if (activeTab === 'Settings' && settingsView !== 'main') {
        target = `/admin/settings/${slugify(settingsView)}`;
     } else if (activeTab !== 'Products') {
        target = `/admin/${slugify(activeTab)}`;
     }
     if (location.pathname !== target) navigate(target);
  }, [activeTab, settingsView]);

  // Ensure desktop Settings view always defaults to categories instead of showing duplicate or blank middle
  useEffect(() => {
    if (activeTab === 'Settings' && settingsView === 'main') {
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setSettingsView('categories');
      }
    }
  }, [activeTab, settingsView]);

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showZipImport, setShowZipImport] = useState(false);
  const [showFbZipExport, setShowFbZipExport] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [selectedAnalyticsCategory, setSelectedAnalyticsCategory] = useState<string>('All');

  const [isManagingAnalyticsItems, setIsManagingAnalyticsItems] = useState(false);

  const [selectedAnalyticsItemIds, setSelectedAnalyticsItemIds] = useState<string[]>([]);

  useHistoryModal(isAddingProduct, () => setIsAddingProduct(false), 'add-product');
  useHistoryModal(!!editingProduct, () => setEditingProduct(null), 'edit-product');
  useHistoryModal(showZipImport, () => setShowZipImport(false), 'zip-import');
  useHistoryModal(showFbZipExport, () => setShowFbZipExport(false), 'fb-zip-export');
  useHistoryModal(!!confirmAction, () => setConfirmAction(null), 'confirm-action');

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    // Crucial: Close any open modals so navigation switches immediately
    setSelectedOrder(null);
    setEditingProduct(null);
    setIsAddingProduct(false);
    setShowZipImport(false);
    setShowFbZipExport(false);

    if (tab !== 'Settings') {
      setSettingsView('main');
    } else {
      if (typeof window !== 'undefined' && window.innerWidth >= 768 && (settingsView === 'main' || !settingsView)) {
        setSettingsView('categories');
      }
    }
  };

  const handleCloseSettingsView = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setSettingsView('categories');
    } else {
      setSettingsView('main');
    }
  };

  const [topBarMode, setTopBarMode] = useState<TopBarMode>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [visibilityChanges, setVisibilityChanges] = useState<Record<string, boolean>>({});
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDashboardSwitcher, setShowDashboardSwitcher] = useState(false);

  // Orders State
  const [paginatedOrders, setPaginatedOrders] = useState<Order[]>([]);
  const [paginatedOrdersPage, setPaginatedOrdersPage] = useState(1);
  const [paginatedOrdersHasMore, setPaginatedOrdersHasMore] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [adminStats, setAdminStats] = useState<any>(null);

  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'All'>('All');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [isOrderSearchMode, setIsOrderSearchMode] = useState(false);

  useHistoryModal(!!selectedOrder, () => setSelectedOrder(null), 'dashboard-selected-order');
  useHistoryModal(showOrderSummary, () => setShowOrderSummary(false), 'dashboard-order-summary');
  const [showPrintDropdown, setShowPrintDropdown] = useState(false);
  const bulkPrintRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Dashboard Tab State
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [dateRangePreset, setDateRangePreset] = useState('This month');
  
  const scrollRef = useScrollRestore(`dashboard-${activeTab}`);

  // Admin Auth State
  const [isCloudLoading, setIsCloudLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([{
    id: 'default-admin',
    email: 'max@gmail.com',
    passwordHash: '1234',
    isApproved: true,
    createdAt: new Date().toISOString()
  }]);

  React.useEffect(() => {
    setIsCloudLoading(false);
  }, []);


  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(() => {
    const saved = localStorage.getItem('paikarix_current_admin');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse current admin', e);
      }
    }
    return null;
  });

  const perms = React.useMemo(() => ({
    sections: { ...DEFAULT_ADMIN_PERMISSIONS.sections, ...(currentAdmin?.permissions?.sections || {}) },
    product: { ...DEFAULT_ADMIN_PERMISSIONS.product, ...(currentAdmin?.permissions?.product || {}) },
    order: { ...DEFAULT_ADMIN_PERMISSIONS.order, ...(currentAdmin?.permissions?.order || {}) },
    analytics: { ...DEFAULT_ADMIN_PERMISSIONS.analytics, ...(currentAdmin?.permissions?.analytics || {}) },
  }), [currentAdmin?.permissions]);
  const currentDbUser = adminUsers.find(u => 
    (currentAdmin?.id && u.id === currentAdmin.id) || 
    (currentAdmin?.email && u.email?.trim().toLowerCase() === currentAdmin.email.trim().toLowerCase())
  );
  const effectiveRole = currentDbUser?.role || currentAdmin?.role;
  const isOwner = Boolean(
    (effectiveRole === 'Owner' || currentAdmin?.email?.trim().toLowerCase() === 'max@gmail.com') &&
    (currentDbUser ? (currentDbUser.isApproved && !currentDbUser.isBlocked) : true)
  );

  // Enforce Permissions on Route/Tab changes
  React.useEffect(() => {
    if (!perms) return;
    
    // Determine the default fallback tab based on what's available
    let defaultTab = 'Products';
    if (perms.sections.products) defaultTab = 'Products';
    else if (perms.sections.orders) defaultTab = 'Orders';
    else if (perms.sections.dashboard) defaultTab = 'Dashboard';
    else if (perms.sections.settings) defaultTab = 'Settings';
    else defaultTab = 'Products'; // fallback

    // Check main tabs
    if (activeTab === 'Dashboard' && !perms.sections.dashboard) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'Products' && !perms.sections.products) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'Orders' && !perms.sections.orders) {
      setActiveTab(defaultTab);
    } else if (activeTab === 'Settings' && !perms.sections.settings) {
      setActiveTab(defaultTab);
    }

    // Check specific settings views
    if (activeTab === 'Settings' || settingsView !== 'main') {
      if (settingsView === 'customers' && (!perms.sections.customers || !isOwner)) {
        setSettingsView('main');
      }
      // If settings tab is completely disabled, then any settings view is disallowed
      if (!perms.sections.settings && settingsView !== 'main') {
        setSettingsView('main');
      }
    }
  }, [activeTab, settingsView, perms, isOwner]);

  React.useEffect(() => {
    if (currentAdmin) {
      localStorage.setItem('paikarix_current_admin', JSON.stringify(currentAdmin));
    } else {
      localStorage.removeItem('paikarix_current_admin');
      cloudStore.logoutAdmin().catch(() => {});
    }
  }, [currentAdmin]);

  React.useEffect(() => {
    if (currentAdmin) {
      const userInDb = adminUsers.find(u => u.id === currentAdmin.id);
      if (userInDb) {
        if (userInDb.isBlocked) {
          setCurrentAdmin(null);
          return;
        }
        if (JSON.stringify(userInDb.permissions) !== JSON.stringify(currentAdmin.permissions) || userInDb.role !== currentAdmin.role) {
          setCurrentAdmin({ ...userInDb, loginTimestamp: currentAdmin.loginTimestamp });
        }
      }
      
      if (currentAdmin.loginTimestamp && websiteSettings?.autoLogoutDays) {
        const now = Date.now();
        const daysInMs = websiteSettings.autoLogoutDays * 24 * 60 * 60 * 1000;
        if (now - currentAdmin.loginTimestamp > daysInMs) {
          setCurrentAdmin(null);
        }
      }
    }
  }, [currentAdmin, adminUsers, websiteSettings?.autoLogoutDays]);

  const navStyleContent = React.useMemo(() => `
    :root {
      --glass-border: rgba(255, 255, 255, ${websiteSettings?.dashboardNav?.borderWhiteness !== undefined ? websiteSettings.dashboardNav.borderWhiteness / 100 : 0.40});
    }
    @media (max-width: 767px) {
      .mobile-dashboard-nav {
         bottom: ${websiteSettings?.dashboardNav?.bottomOffset ?? 10}px !important;
         height: ${websiteSettings?.dashboardNav?.height ?? 64}px !important;
         width: ${websiteSettings?.dashboardNav?.width ?? 92}% !important;
         left: 50% !important;
         transform: translateX(-50%) translateZ(0) !important;
         will-change: transform;
         backdrop-filter: blur(${websiteSettings?.dashboardNav?.blur ?? 4}px) saturate(1.8) !important;
         -webkit-backdrop-filter: blur(${websiteSettings?.dashboardNav?.blur ?? 4}px) saturate(1.8) !important;
      }
      .mobile-fab-glass {
         backdrop-filter: blur(${websiteSettings?.dashboardNav?.blur ?? 4}px) saturate(1.8) !important;
         -webkit-backdrop-filter: blur(${websiteSettings?.dashboardNav?.blur ?? 4}px) saturate(1.8) !important;
         bottom: calc(${websiteSettings?.dashboardNav?.bottomOffset ?? 10}px + ${websiteSettings?.dashboardNav?.height ?? 64}px + 16px) !important;
         transform: translateZ(0) !important;
         will-change: transform;
      }
    }
  `, [
    websiteSettings?.dashboardNav?.borderWhiteness,
    websiteSettings?.dashboardNav?.bottomOffset,
    websiteSettings?.dashboardNav?.height,
    websiteSettings?.dashboardNav?.width,
    websiteSettings?.dashboardNav?.blur
  ]);
  
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const startStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const endStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    return `${startStr} / ${endStr}`;
  });
  
  const [calStart, setCalStart] = useState<Date | null>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calEnd, setCalEnd] = useState<Date | null>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });

  const [isSyncingSteadfast, setIsSyncingSteadfast] = useState(false);

  React.useEffect(() => {
    if (activeTab === 'Orders' && courierSettings?.steadfast?.apiKey && courierSettings?.steadfast?.secretKey) {
      syncSteadfastOrders();
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (!currentAdmin) return;

    const fetchAdminData = async () => {
      const state = await cloudStore.getAdminState();
      if (state) {
        if (state.products && state.products.length > 0) setProducts(state.products);
        if (state.orders) setOrders(state.orders);
        if (state.incompleteOrders) setIncompleteOrders(state.incompleteOrders);
        if (state.adminUsers) setAdminUsers(state.adminUsers);
        if (state.customers) setCustomers(state.customers);
        
        if (state.settings) {
          if (state.settings.categories) setCategories(state.settings.categories);
          if (state.settings.websiteSettings) setWebsiteSettings(state.settings.websiteSettings);
          if (state.settings.marketingSettings) setMarketingSettings(state.settings.marketingSettings);
          if (state.settings.courierSettings) setCourierSettings(state.settings.courierSettings);
          if (state.settings.priceCalculatorSettings) setPriceCalculatorSettings(state.settings.priceCalculatorSettings);
          if (state.settings.imageOptimization) setDefaultImageOptimization(state.settings.imageOptimization);
        }
      }
      
      // Trigger background retention cleanup once per session
      if (!hasRunCleanup) {
        hasRunCleanup = true;
        fetch('/api/run_retention_cleanup', { method: 'POST' }).catch(console.error);
      }
    };
    fetchAdminData();
  }, [currentAdmin?.id]);

  React.useEffect(() => {
    if (!currentAdmin) return;
    
    // Auto-migrate base64 images to R2 silently
    const migrateImages = async () => {
      if (!products || products.length === 0) return;
      
      let migratedAny = false;
      let newProducts = [...products];

      for (let i = 0; i < newProducts.length; i++) {
        const p = { ...newProducts[i] };
        let pChanged = false;

        if (p.image && p.image.startsWith('data:image/')) {
          try {
            const res = await fetch(p.image);
            const blob = await res.blob();
            const url = await cloudStore.uploadFile(blob, `mig_img_${Date.now()}.jpg`, true);
            p.image = url;
            pChanged = true;
          } catch(e) { console.warn('Failed to migrate main image for product', p.id); }
        }

        if (p.images && p.images.length > 0) {
          const updatedImages = [...p.images];
          for (let j = 0; j < updatedImages.length; j++) {
            if (updatedImages[j].startsWith('data:image/')) {
              try {
                const res = await fetch(updatedImages[j]);
                const blob = await res.blob();
                const url = await cloudStore.uploadFile(blob, `mig_img_${Date.now()}_${j}.jpg`, true);
                updatedImages[j] = url;
                pChanged = true;
              } catch(e) {}
            }
          }
          if (pChanged) p.images = updatedImages;
        }

        if (pChanged) {
          newProducts[i] = p;
          migratedAny = true;
        }
      }

      if (migratedAny) {
        console.log('Migrated base64 images to R2 successfully!');
        setProducts(newProducts);
        cloudStore.syncAllProducts(newProducts, true).catch(console.error);
      }
    };

    // Delay migration slightly so UI loads fast
    const t = setTimeout(() => {
      migrateImages();
    }, 5000);
    return () => clearTimeout(t);
  }, [currentAdmin?.id, products.length]);

  const loadAdminOrders = async (page: number, append: boolean = false) => {
    setIsLoadingOrders(true);
    const [startDate, endDate] = dateRange.split(' / ');
    const res = await cloudStore.getAdminOrders({
      page,
      limit: 50,
      search: orderSearchQuery,
      status: orderFilter,
      startDate: startDate + 'T00:00:00',
      endDate: endDate + 'T23:59:59.999'
    });
    if (res) {
      if (append) {
        setPaginatedOrders(prev => {
          const newOrders = res.orders.filter((o: Order) => !prev.some(p => p.id === o.id));
          return [...prev, ...newOrders];
        });
      } else {
        setPaginatedOrders(res.orders);
      }
      setPaginatedOrdersHasMore(res.orders.length === 50);
      setAdminStats(res.stats);
    }
    setIsLoadingOrders(false);
  };

  React.useEffect(() => {
    if (!currentAdmin) return;
    // Debounce the fetching slightly
    const t = setTimeout(() => {
      setPaginatedOrdersPage(1);
      loadAdminOrders(1, false);
    }, 300);
    return () => clearTimeout(t);
  }, [currentAdmin?.id, dateRange, orderSearchQuery, orderFilter]);

  const handleLoadMoreOrders = () => {
    if (!isLoadingOrders && paginatedOrdersHasMore) {
      const nextPage = paginatedOrdersPage + 1;
      setPaginatedOrdersPage(nextPage);
      loadAdminOrders(nextPage, true);
    }
  };

  const syncSteadfastOrders = async () => {
    if (isSyncingSteadfast) return;
    setIsSyncingSteadfast(true);

    try {
      const ordersToSync = orders.filter(o => 
        o.steadfast?.consignmentId && 
        !['Completed', 'Canceled', 'Returned', 'Complete Return'].includes(o.status)
      );

      if (ordersToSync.length === 0) {
        setIsSyncingSteadfast(false);
        return;
      }

      let updatedOrders = [...orders];
      let hasChanges = false;

      for (const order of ordersToSync) {
        try {
          const response = await fetch(`https://portal.packzy.com/api/v1/status_by_cid/${order.steadfast!.consignmentId}`, {
            headers: {
              'Api-Key': courierSettings.steadfast.apiKey,
              'Secret-Key': courierSettings.steadfast.secretKey
            }
          });
          if (!response.ok) {
            if (response.status === 401) {
              console.warn(`Steadfast API returned 401 Unauthorized. Please check your Steadfast API Key and Secret Key in Settings > Courier.`);
              break; // Stop syncing to prevent further errors
            }
            console.error(`Steadfast API error for order ${order.id}: ${response.status} ${response.statusText}`);
            continue;
          }
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            console.error(`Invalid JSON from Steadfast for order ${order.id}:`, text);
            continue; // Skip JSON error
          }
          
          if (data.status === 200 && data.delivery_status) {
            const sfStatus = data.delivery_status.toLowerCase();
            let newStatus: OrderStatus | null = null;
            
            if (sfStatus === 'delivered') newStatus = 'Completed';
            else if (sfStatus === 'cancelled' || sfStatus === 'returned') newStatus = 'Returned';
            else if (sfStatus === 'in_transit' || sfStatus === 'dispatched') newStatus = 'Shipping';
            
            if (newStatus && newStatus !== order.status) {
              const orderIndex = updatedOrders.findIndex(o => o.id === order.id);
              if (orderIndex !== -1) {
                const wasRestored = order.status === 'Canceled' || order.status === 'Complete Return' || order.stockReturned;
                const isRestored = newStatus === 'Canceled' || newStatus === 'Complete Return' || order.stockReturned;
                
                if (!wasRestored && isRestored) {
                  setProducts(prev => {
                    const newProducts = restoreOrderStock(prev, order);
                    const changed = newProducts.filter(p => order.items.some(item => item.product.id === p.id));
                    if(changed.length > 0) cloudStore.upsertProducts(changed).catch(console.error);
                    return newProducts;
                  });
                  notifyMasterStockSync(order, websiteSettings, true); // Restore
                } else if (wasRestored && !isRestored) {
                  setProducts(prev => {
                    const newProducts = deductOrderStock(prev, order);
                    const changed = newProducts.filter(p => order.items.some(item => item.product.id === p.id));
                    if(changed.length > 0) cloudStore.upsertProducts(changed).catch(console.error);
                    return newProducts;
                  });
                  notifyMasterStockSync(order, websiteSettings, false); // Deduct
                }

                updatedOrders[orderIndex] = {
                  ...updatedOrders[orderIndex],
                  status: newStatus,
                  steadfast: {
                    ...updatedOrders[orderIndex].steadfast!,
                    status: data.delivery_status
                  }
                };
                hasChanges = true;
              }
            }
          }
        } catch (err) {
          console.error(`Failed to sync order ${order.id}:`, err);
        }
      }

      if (hasChanges) {
        setOrders(updatedOrders);
        cloudStore.syncAllOrders(updatedOrders, 'standard', true).catch(console.error);
      }
    } finally {
      setIsSyncingSteadfast(false);
    }
  };

  const [isSyncingBdCourier, setIsSyncingBdCourier] = useState(false);
  const [activeBdCourierApiIndex, setActiveBdCourierApiIndex] = useState(0);

  const checkBdCourierFraud = async (orderId?: string) => {
    if (isSyncingBdCourier && !orderId) return;
    if (!orderId) setIsSyncingBdCourier(true);

    try {
      const activeApis = courierSettings?.bdCourierApis?.filter(api => api.enabled) || [];
      if (activeApis.length === 0) {
        if (!orderId) setIsSyncingBdCourier(false);
        return;
      }

      const ordersToProcess = orderId 
        ? orders.filter(o => o.id === orderId) 
        : orders.filter(o => !o.bdCourierStatus || o.bdCourierStatus === 'pending');

      if (ordersToProcess.length === 0) {
        if (!orderId) setIsSyncingBdCourier(false);
        return;
      }

      let updatedOrders = [...orders];
      let hasChanges = false;
      let currentApiIndex = activeBdCourierApiIndex;

      for (const order of ordersToProcess) {
        let success = false;
        let attempts = 0;

        while (!success && attempts < activeApis.length) {
          const api = activeApis[currentApiIndex];
          try {
            const response = await fetch('https://api.bdcourier.com/courier-check', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api.apiKey}`
              },
              body: JSON.stringify({ phone: order.userInfo.phone })
            });

            if (response.ok) {
              const data = await response.json();
              
              if (data.status === 'success') {
                const orderIndex = updatedOrders.findIndex(o => o.id === order.id);
                if (orderIndex !== -1) {
                  updatedOrders[orderIndex] = { 
                    ...updatedOrders[orderIndex], 
                    bdCourierStatus: 'success',
                    bdCourierData: data.data || data
                  };
                  hasChanges = true;
                }
                success = true;
              } else {
                currentApiIndex = (currentApiIndex + 1) % activeApis.length;
              }
            } else {
              currentApiIndex = (currentApiIndex + 1) % activeApis.length;
            }
          } catch (err) {
            console.error(`BD Courier API error for ${order.id}:`, err);
            currentApiIndex = (currentApiIndex + 1) % activeApis.length;
          }
          attempts++;
        }

        if (!success) {
           const orderIndex = updatedOrders.findIndex(o => o.id === order.id);
           if (orderIndex !== -1) {
             updatedOrders[orderIndex] = { 
               ...updatedOrders[orderIndex], 
               bdCourierStatus: 'failed'
             };
             hasChanges = true;
           }
        }
      }

      if (currentApiIndex !== activeBdCourierApiIndex) {
        setActiveBdCourierApiIndex(currentApiIndex);
      }

      if (hasChanges) {
        setOrders(updatedOrders);
        setPaginatedOrders(prev => prev.map(o => updatedOrders.find(u => u.id === o.id) || o));
        const changedOrders = updatedOrders.filter(o => ordersToProcess.some(p => p.id === o.id));
        for (const o of changedOrders) {
           cloudStore.upsertOrder(o, 'standard', true).catch(console.error);
        }
      }
    } finally {
      if (!orderId) setIsSyncingBdCourier(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'Orders' && courierSettings?.bdCourierApis?.some(api => api.enabled)) {
      checkBdCourierFraud();
    }
  }, [activeTab, orders.length, courierSettings?.bdCourierApis]);

  const handlePresetSelect = (preset: string) => {
    setDateRangePreset(preset);
    setShowPresetDropdown(false);
    
    const today = new Date();
    let start = new Date(today);
    let end = new Date(today);

    switch (preset) {
      case 'Today':
        break;
      case 'Yesterday':
        start.setDate(today.getDate() - 1);
        end.setDate(today.getDate() - 1);
        break;
      case 'This month':
        start.setDate(1);
        break;
      case 'Last month':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'Last 7 days':
        start.setDate(today.getDate() - 7);
        break;
      case 'Last 30 days':
        start.setDate(today.getDate() - 30);
        break;
      case 'Last 60 days':
        start.setDate(today.getDate() - 60);
        break;
    }

    setCalStart(start);
    setCalEnd(end);

    const startStr = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}-${start.getDate().toString().padStart(2, '0')}`;
    const endStr = `${end.getFullYear()}-${(end.getMonth() + 1).toString().padStart(2, '0')}-${end.getDate().toString().padStart(2, '0')}`;
    setDateRange(`${startStr} / ${endStr}`);
  };

  const handleApplyDateRange = () => {
    if (calStart !== null) {
      const startStr = `${calStart.getFullYear()}-${(calStart.getMonth() + 1).toString().padStart(2, '0')}-${calStart.getDate().toString().padStart(2, '0')}`;
      const endStr = calEnd !== null 
        ? `${calEnd.getFullYear()}-${(calEnd.getMonth() + 1).toString().padStart(2, '0')}-${calEnd.getDate().toString().padStart(2, '0')}`
        : startStr;
      setDateRange(`${startStr} / ${endStr}`);
    }
    setShowCalendar(false);
  };

  const handleSaveProduct = (updatedProduct: Product) => {
    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? updatedProduct : p));
    } else {
      // Check if ID was manually provided and not just the default Date.now timestamp string
      // (Assuming a manual ID would be like 'P001' or something not 13 digits)
      const isManualId = updatedProduct.id && !/^\d{13}$/.test(updatedProduct.id);
      
      if (!isManualId || products.some(p => p.id === updatedProduct.id)) {
        // Generate ID based on category
        const categoryPrefix = updatedProduct.category && updatedProduct.category !== 'Uncategorized' 
          ? updatedProduct.category.charAt(0).toUpperCase() 
          : 'P';
        
        const existingIds = products.map(p => p.id).filter(id => id.startsWith(categoryPrefix));
        let maxNum = 0;
        existingIds.forEach(id => {
          const numPart = id.substring(1);
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        });
        
        let nextNum = maxNum + 1;
        let newId = `${categoryPrefix}${nextNum.toString().padStart(3, '0')}`;
        while(products.some(p => p.id === newId)) {
          nextNum++;
          newId = `${categoryPrefix}${nextNum.toString().padStart(3, '0')}`;
        }
        
        updatedProduct.id = newId;
      }
      setProducts([updatedProduct, ...products]);
    }
    cloudStore.upsertProduct(updatedProduct).catch(console.error);
    setEditingProduct(null);
    setIsAddingProduct(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleDeleteProduct = (id: string) => {
    setConfirmAction({
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product? This action cannot be undone.',
      onConfirm: () => {
        const productToDel = products.find(p => p.id === id);
        setProducts(products.filter(p => p.id !== id));
        if (productToDel) {
          cloudStore.deleteProducts([productToDel]).catch(console.error);
        }
        setEditingProduct(null);
        setConfirmAction(null);
      }
    });
  };

  const handleDeleteAnalyticsItems = () => {
    if (!isOwner) {
      alert('Permission denied: Only the Owner account can delete analytics items.');
      return;
    }
    if (selectedAnalyticsItemIds.length === 0) return;
    setConfirmAction({
      title: 'Delete Analytics Images',
      message: `Are you sure you want to remove ${selectedAnalyticsItemIds.length} item(s) from Analytics? If they are used elsewhere in orders or products, they will only be hidden; otherwise they will be permanently deleted.`,
      onConfirm: async () => {
        try {
          const idsToDelete = [...selectedAnalyticsItemIds];
          await cloudStore.deleteAnalyticsItems(idsToDelete);
          setWebsiteSettings(prev => ({
            ...prev,
            hiddenAnalyticsItemIds: Array.from(new Set([...(prev.hiddenAnalyticsItemIds || []), ...idsToDelete]))
          }));
          setSelectedAnalyticsItemIds([]);
          setIsManagingAnalyticsItems(false);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        } catch (err) {
          console.error('Failed to delete analytics items', err);
        }
        setConfirmAction(null);
      }
    });
  };

  // Memoized Products filtering and sorting for 60fps scrolling
  const displayProducts = React.useMemo(() => {
    let result = [...products];

    // Search
    if (searchQuery) {
      const cleanSearchQuery = searchQuery.replace(/#/g, '').toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.id.replace(/#/g, '').toLowerCase().includes(cleanSearchQuery) ||
        (p.code1688 && p.code1688.toLowerCase().includes(cleanSearchQuery))
      );
    }

    // Category
    if (selectedCategory !== 'All') {
      result = result.filter(p => p.category?.trim()?.toLowerCase() === selectedCategory.trim().toLowerCase());
    }

    // Filter
    switch (selectedFilter) {
      case 'Visible':
        return result.filter(p => p.isVisible !== false);
      case 'Hidden':
        return result.filter(p => p.isVisible === false);
      case 'In Stock':
        return result.filter(p => (p.stock || 0) > 0);
      case 'Stockouts':
        return result.filter(p => (p.stock || 0) === 0);
      case 'High -> Low (Stock)':
        return [...result].sort((a, b) => (b.stock || 0) - (a.stock || 0));
      case 'Low -> High (Stock)':
        return [...result].sort((a, b) => (a.stock || 0) - (b.stock || 0));
      case 'High -> Low (Price)':
        return [...result].sort((a, b) => b.price - a.price);
      case 'Low -> High (Price)':
        return [...result].sort((a, b) => a.price - b.price);
      default:
        return result;
    }
  }, [products, searchQuery, selectedCategory, selectedFilter]);

  // Stats calculation for Products tab (memoized)
  const { totalItems, totalStock, totalBuy, totalSell, totalProfit } = React.useMemo(() => {
    const items = displayProducts.length;
    let stock = 0;
    let buy = 0;
    let sell = 0;
    for (let i = 0; i < items; i++) {
      const p = displayProducts[i];
      const s = p.stock || 0;
      stock += s;
      buy += (p.buyPrice || 0) * (s || 1);
      sell += p.price * (s || 1);
    }
    return {
      totalItems: items,
      totalStock: stock,
      totalBuy: buy,
      totalSell: sell,
      totalProfit: sell - buy,
    };
  }, [displayProducts]);

  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(() => scrollRef.current);

  const setScrollContainerRef = React.useCallback((node: HTMLDivElement | null) => {
    if (scrollRef) {
      scrollRef.current = node;
    }
    setScrollEl(node);
  }, [scrollRef]);

  useEffect(() => {
    if (scrollRef.current && scrollRef.current !== scrollEl) {
      setScrollEl(scrollRef.current);
    }
  }, [currentAdmin, activeTab, scrollEl]);

  // Orders filtering
  let displayOrders = paginatedOrders;

  // Stats calculation for Dashboard tab (memoized to avoid re-parsing on every render)
  const dashboardStats = React.useMemo(() => {
    const [rangeStartStr, rangeEndStr] = dateRange.split(' / ');
    const rangeStart = new Date(rangeStartStr + 'T00:00:00');
    const rangeEnd = new Date(rangeEndStr + 'T23:59:59.999');

    const filtered = orders.filter(o => {
      const datePart = o.date ? o.date.split(', ')[1] : null;
      if (!datePart) return true;
      const [month, day, year] = datePart.split('/');
      const orderDate = new Date(Number(year), Number(month) - 1, Number(day));
      return orderDate >= rangeStart && orderDate <= rangeEnd;
    });

    const totOrders = adminStats ? adminStats.totalOrders : filtered.length;
    const compOrders = adminStats ? adminStats.completedOrders : filtered.filter(o => o.status === 'Completed').length;
    const cancOrders = adminStats ? adminStats.canceledOrders : filtered.filter(o => o.status === 'Canceled').length;

    const totSell = adminStats ? adminStats.totalSellAmount : filtered.reduce((acc, o) => acc + (o.subtotal - (o.discount || 0)), 0);
    const compSell = adminStats ? adminStats.completedSellAmount : filtered.filter(o => o.status === 'Completed').reduce((acc, o) => acc + (o.subtotal - (o.discount || 0)), 0);

    const rawTotalProfit = filtered.reduce((acc, o) => {
      if (o.profit !== undefined) return acc + o.profit;
      const orderCost = o.items.reduce((cost, item) => cost + ((item.variantBuyPrice ?? (item.product.buyPrice || Math.floor((item.variantPrice ?? item.product.price) * 0.4))) * item.quantity), 0);
      return acc + (o.subtotal - (o.discount || 0) - orderCost - (o.extraCosts || 0) - (o.returnCost || 0));
    }, 0);

    const rawCompProfit = filtered.filter(o => o.status === 'Completed').reduce((acc, o) => {
      if (o.profit !== undefined) return acc + o.profit;
      const orderCost = o.items.reduce((cost, item) => cost + ((item.variantBuyPrice ?? (item.product.buyPrice || Math.floor((item.variantPrice ?? item.product.price) * 0.4))) * item.quantity), 0);
      return acc + (o.subtotal - (o.discount || 0) - orderCost - (o.extraCosts || 0) - (o.returnCost || 0));
    }, 0);

    const totReturned = adminStats ? adminStats.totalReturnedCost : filtered.reduce((acc, o) => {
      return acc + (o.returnCost || 0);
    }, 0);

    const totProfit = adminStats ? adminStats.totalProfitAmount : rawTotalProfit;
    const compProfit = adminStats ? adminStats.completedProfitAmount : rawCompProfit;

    const totQty = adminStats ? adminStats.totalQuantity : filtered.reduce((acc, o) => acc + (o.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0), 0);

    const uItemIds = new Set<string>();
    filtered.forEach(o => {
      (o.items || []).forEach(item => {
        if (item?.product?.id) {
          uItemIds.add(item.product.id);
        }
      });
    });
    const uItemsCount = adminStats ? (adminStats.uniqueItemIds?.length || 0) : uItemIds.size;

    const pSales = new Map<string, { product: Product, quantity: number }>();
    if (adminStats && adminStats.productSales) {
      Object.entries(adminStats.productSales).forEach(([productId, quantity]) => {
        const latestProduct = products.find(p => p.id === productId);
        if (latestProduct) {
          pSales.set(productId, { product: latestProduct, quantity: Number(quantity) || 0 });
        }
      });
    } else {
      filtered.forEach(order => {
        if (order.status !== 'Canceled' && order.status !== 'Returned' && order.status !== 'Complete Return') {
          (order.items || []).forEach(item => {
            const pId = item?.product?.id;
            if (!pId) return;
            const existing = pSales.get(pId);
            if (existing) {
              existing.quantity += (item.quantity || 0);
            } else {
              const latestProduct = products.find(p => p.id === pId) || item.product;
              if (latestProduct) {
                pSales.set(pId, { product: latestProduct, quantity: (item.quantity || 0) });
              }
            }
          });
        }
      });
    }

    const hiddenIds = websiteSettings?.hiddenAnalyticsItemIds || [];
    const topProds = Array.from(pSales.values())
      .filter(p => p && p.product && p.quantity > 0 && !hiddenIds.includes(p.product.id))
      .sort((a, b) => b.quantity - a.quantity);

    return {
      filteredOrders: filtered,
      totalOrders: totOrders,
      completedOrders: compOrders,
      canceledOrders: cancOrders,
      totalSellAmount: totSell,
      completedSellAmount: compSell,
      totalReturnedCost: totReturned,
      totalProfitAmount: totProfit,
      completedProfitAmount: compProfit,
      totalQuantity: totQty,
      uniqueItemsCount: uItemsCount,
      topProducts: topProds,
    };
  }, [dateRange, orders, adminStats, products, websiteSettings?.hiddenAnalyticsItemIds]);

  const {
    filteredOrders,
    totalOrders,
    completedOrders,
    canceledOrders,
    totalSellAmount,
    completedSellAmount,
    totalReturnedCost,
    totalProfitAmount,
    completedProfitAmount,
    totalQuantity,
    uniqueItemsCount,
    topProducts,
  } = dashboardStats;

  const analyticsCategories = React.useMemo(() => {
    const defaultCats = ['All', 'Necklaces', 'Bracelets', 'Earrings', 'Rings'];
    const storeCats = categories.map(c => c.name?.trim()).filter(Boolean);
    return ['All', ...new Set([...defaultCats.slice(1), ...storeCats])];
  }, [categories]);

  const filteredTopProducts = React.useMemo(() => {
    if (selectedAnalyticsCategory === 'All') return topProducts;
    const sel = selectedAnalyticsCategory.toLowerCase();
    return topProducts.filter(({ product }) => {
      const cat = product.category?.trim()?.toLowerCase() || '';
      const title = product.title?.toLowerCase() || '';
      if (cat === sel) return true;
      if (sel === 'necklaces' && (cat.includes('neck') || cat.includes('chain') || title.includes('necklace') || title.includes('chain') || title.includes('项链') || title.includes('锁骨链'))) return true;
      if (sel === 'bracelets' && (cat.includes('brace') || cat.includes('bangle') || title.includes('bracelet') || title.includes('bangle') || title.includes('手链') || title.includes('手镯'))) return true;
      if (sel === 'earrings' && (cat.includes('ear') || title.includes('earring') || title.includes('ear') || title.includes('耳环') || title.includes('耳钉'))) return true;
      if (sel === 'rings' && (cat.includes('ring') || title.includes('ring') || title.includes('戒指') || title.includes('对戒'))) return true;
      return cat.includes(sel) || title.includes(sel);
    });
  }, [topProducts, selectedAnalyticsCategory]);

  const toggleProductSelection = React.useCallback((id: string) => {
    if (topBarMode === 'delete' && !isOwner) {
      setSelectedProducts(prev => 
        prev.includes(id) ? [] : [id]
      );
      return;
    }
    
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  }, [topBarMode, isOwner]);

  const toggleVisibility = React.useCallback((id: string) => {
    setVisibilityChanges(prev => {
      const product = products.find(p => p.id === id);
      const currentVis = prev[id] !== undefined ? prev[id] : (product?.isVisible !== false);
      return { ...prev, [id]: !currentVis };
    });
  }, [products]);

  const handleDeleteSelected = async () => {
    const productsToDel = products.filter(p => selectedProducts.includes(p.id));
    if (productsToDel.length > 0) {
      try {
        await cloudStore.deleteProducts(productsToDel);
        setProducts(products.filter(p => !selectedProducts.includes(p.id)));
      } catch (error) {
        console.error('Failed to delete products', error);
      }
    }
    setSelectedProducts([]);
    setTopBarMode('default');
    setShowDeleteConfirm(false);
  };

  const handleUpdateVisibility = () => {
    const updatedProducts: Product[] = [];
    const newProducts = products.map(p => {
      if (visibilityChanges[p.id] !== undefined) {
        const updated = { ...p, isVisible: visibilityChanges[p.id] };
        updatedProducts.push(updated);
        return updated;
      }
      return p;
    });
    setProducts(newProducts);
    if (updatedProducts.length > 0) {
      cloudStore.upsertProducts(updatedProducts).catch(console.error);
    }
    setVisibilityChanges({});
    setTopBarMode('default');
  };

  const handleMoveProducts = React.useCallback((e: React.MouseEvent, targetProductId: string) => {
    e.stopPropagation();
    if (selectedProducts.length === 0) return;

    const itemsToInsert = selectedProducts.map(id => products.find(p => p.id === id)).filter(Boolean) as Product[];
    const newProducts = products.filter(p => !selectedProducts.includes(p.id));
    
    const targetIndex = newProducts.findIndex(p => p.id === targetProductId);
    
    if (targetIndex !== -1) {
      newProducts.splice(targetIndex, 0, ...itemsToInsert);
    } else {
      const originalTargetIndex = products.findIndex(p => p.id === targetProductId);
      const insertIndex = newProducts.findIndex(p => products.findIndex(op => op.id === p.id) >= originalTargetIndex);
      if (insertIndex !== -1) {
        newProducts.splice(insertIndex, 0, ...itemsToInsert);
      } else {
        newProducts.push(...itemsToInsert);
      }
    }
    
    setProducts(newProducts);
    cloudStore.syncAllProducts(newProducts).catch(console.error);
    setSelectedProducts([]);
    setTopBarMode('default');
  }, [selectedProducts, products]);

  const toggleOrderSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(o => o !== id) : [...prev, id]);
  };

  const toggleSelectAllOrders = () => {
    if (selectedOrders.length === displayOrders.length && displayOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(displayOrders.map(o => o.id));
    }
  };

  const handleBulkJPGDownload = async () => {
    setShowPrintDropdown(false);
    for (const orderId of selectedOrders) {
      const element = bulkPrintRefs.current[orderId];
      if (element) {
        await downloadReceiptAsJPG(element, orderId);
        await new Promise(r => setTimeout(r, 200));
      }
    }
  };

  const handleBulkPrint = async () => {
    setShowPrintDropdown(false);
    
    // Create a hidden iframe for sturdy and stealthy printing
    const iframeId = 'print-receipts-iframe';
    const existingIframe = document.getElementById(iframeId);
    if (existingIframe) {
      document.body.removeChild(existingIframe);
    }
    
    const iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0';
    iframe.style.right = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    iframe.title = 'Print Orders';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      console.error('Print iframe creation failed');
      document.body.removeChild(iframe);
      return;
    }

    // Gather Styles from the main document (so Tailwind works perfectly inside)
    const styleNodes = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
    const stylesHtml = styleNodes.map(node => node.outerHTML).join('');

    // Gather Receipts HTML
    let receiptsHtml = '';
    for (const orderId of selectedOrders) {
      const element = bulkPrintRefs.current[orderId];
      if (element) {
        receiptsHtml += `<div class="receipt-wrapper">${element.outerHTML}</div>`;
      }
    }

    if (!receiptsHtml) {
      console.error('No printable content found');
      document.body.removeChild(iframe);
      return;
    }

    // Inject content into the iframe
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <base href="${window.location.origin}/" />
          <title>Print Receipts</title>
          ${stylesHtml}
          <style>
            :root {
              --theme-primary: ${websiteSettings?.themeColors?.primary || '#ff4d6d'};
              --theme-primary-hover: color-mix(in srgb, ${websiteSettings?.themeColors?.primary || '#ff4d6d'} 80%, black);
              --theme-black: ${websiteSettings?.themeColors?.black || '#000000'};
              --theme-white: ${websiteSettings?.themeColors?.white || '#ffffff'};
            }
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            
            @page {
              margin: 0;
            }
            body { 
               margin: 0; 
               padding: 0; 
               background: white !important; 
               -webkit-print-color-adjust: exact !important; 
               print-color-adjust: exact !important;
               font-family: 'Inter', sans-serif;
            }
            
            .receipt-wrapper {
              page-break-after: always;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            .receipt-wrapper:last-child {
              page-break-after: auto;
            }
            
            /* Responsive Overrides for perfectly fitting thermal / A4 / any paper size */
            
            @media print {
              html, body {
                width: 100%;
                margin: 0;
                padding: 0;
              }
              body {
                background: white !important;
              }
              .receipt-wrapper {
                page-break-after: always;
              }
            }
          </style>
        </head>
        <body>
          ${receiptsHtml}
          <script>
            // We use a small script inside to trigger printing once images load
            window.onload = () => {
               // Give a tiny bit of time for external fonts (Inter) to render and SVGs to compute
               setTimeout(() => {
                 window.print();
               }, 400);
            };
            
            window.onafterprint = () => {
               // Optional: notify parent to remove iframe
               window.parent.postMessage('print_complete', '*');
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Cleanup the iframe after printing is done or after a safety timeout
    const handleMessage = (e: MessageEvent) => {
      if (e.data === 'print_complete') {
        cleanup();
      }
    };
    
    const cleanup = () => {
       window.removeEventListener('message', handleMessage);
       setTimeout(() => {
         const staleIframe = document.getElementById(iframeId);
         if (staleIframe) {
            document.body.removeChild(staleIframe);
         }
       }, 500); // slight delay handles some browsers returning early
    };
    
    window.addEventListener('message', handleMessage);
    
    // Fallback cleanup in case print window is closed or event doesn't fire
    setTimeout(cleanup, 20000);
  };

  const selectedOrdersSummary = React.useMemo(() => {
    let summary = { total: 0, buy: 0, profit: 0, items: 0, uniqueItems: new Set<string>(), quantity: 0 };
    if (selectedOrders.length === 0) return summary;

    selectedOrders.forEach(ordId => {
      const order = paginatedOrders.find(o => o.id === ordId) || orders.find(o => o.id === ordId);
      if (order) {
        const productRevenue = (order.subtotal !== undefined && Number(order.subtotal) > 0)
          ? (Number(order.subtotal) - (Number(order.discount) || 0))
          : (Number(order.total) || 0);

        summary.total += Math.max(0, productRevenue);

        let itemsList: any[] = [];
        if (Array.isArray(order.items)) {
          itemsList = order.items;
        } else if (typeof order.items === 'string') {
          try {
            itemsList = JSON.parse(order.items);
          } catch(e) {
            itemsList = [];
          }
        }

        let orderBuyCost = 0;
        let orderItemsCount = itemsList.length;
        let orderQty = 0;

        if (itemsList.length > 0) {
          itemsList.forEach((item: any) => {
            const qty = Number(item.quantity) || 1;
            const itemSellPrice = Number(item.variantPrice ?? item.product?.price ?? 0);
            const buyCostItem = Number(
              item.variantBuyPrice ?? 
              item.product?.buyPrice ?? 
              (itemSellPrice > 0 ? Math.floor(itemSellPrice * 0.4) : 0)
            );
            orderBuyCost += (buyCostItem * qty);
            if (item.product?.id) {
              summary.uniqueItems.add(String(item.product.id));
            } else if (item.id) {
              summary.uniqueItems.add(String(item.id));
            }
            orderQty += qty;
          });
        } else {
          orderItemsCount = 1;
          orderQty = 1;
          orderBuyCost = Math.floor(productRevenue * 0.4);
          summary.uniqueItems.add(order.id);
        }

        summary.buy += orderBuyCost;
        summary.items += orderItemsCount;
        summary.quantity += orderQty;
        
        if (order.profit !== undefined && order.profit !== null && !isNaN(Number(order.profit))) {
          summary.profit += Number(order.profit);
        } else {
          const extraCosts = Number(order.extraCosts) || 0;
          const orderReturnCost = Number(order.returnCost) || 0;
          summary.profit += (productRevenue - orderBuyCost - extraCosts - orderReturnCost);
        }
      }
    });

    return summary;
  }, [selectedOrders, paginatedOrders, orders]);

  if (!currentAdmin) {
    return (
      <AdminAuth 
        adminUsers={adminUsers} 
        setAdminUsers={setAdminUsers} 
        setCurrentAdmin={setCurrentAdmin} 
      />
    );
  }

  if (isAddingProduct) {
    return <ProductEditorModal 
      isOpen={true} 
      onClose={() => setIsAddingProduct(false)} 
      onSave={handleSaveProduct} 
      categories={categories}
      priceCalculatorSettings={priceCalculatorSettings}
      products={products}
      suppliers={websiteSettings.suppliers || []}
      perms={perms.product}
      inputBorderRadius={websiteSettings?.actionButtons?.checkout?.borderRadius}
    />;
  }

  return (
    <div className={cn("fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden", activeTab === 'Settings' ? "md:pl-[334px]" : "md:pl-[84px]")}>
      <AdminLoadingScreen />
      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[120] bg-[#fafafa] text-[var(--dash-bg)] px-4 py-2 rounded-full font-medium shadow-lg flex items-center gap-2"
          >
            <Check size={16} />
            Product updated
          </motion.div>
        )}
      </AnimatePresence>

      <ProductEditorModal 
        isOpen={!!editingProduct} 
        onClose={() => setEditingProduct(null)} 
        onSave={handleSaveProduct}
        onDelete={handleDeleteProduct}
        initialProduct={editingProduct}
        categories={categories}
        priceCalculatorSettings={priceCalculatorSettings}
        products={products}
        suppliers={websiteSettings.suppliers || []}
        perms={perms.product}
        inputBorderRadius={websiteSettings?.actionButtons?.checkout?.borderRadius}
      />


      {/* Confirm Action Modal */}
      <AnimatePresence>
        {confirmAction && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setConfirmAction(null)}
              className="absolute inset-0 bg-[var(--dash-bg)]/60 backdrop-blur-sm pointer-events-auto"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="relative w-full max-w-sm bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl overflow-hidden pointer-events-auto shadow-2xl p-6"
            >
              <h2 className="text-xl font-bold text-white mb-2">{confirmAction.title}</h2>
              <p className="text-gray-400 mb-6">{confirmAction.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 rounded-xl font-medium text-white bg-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmAction.onConfirm}
                  className="flex-1 py-2.5 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top Bar */}
      {activeTab === 'Products' && perms.sections.products && (
        <div className="flex items-center gap-2 p-4 md:px-8 md:py-5 border-b border-[var(--dash-border)] relative z-50 bg-[var(--dash-bg)]">
          {topBarMode === 'search' ? (
          <div className="flex-grow flex items-center gap-2 z-10 relative">
            <motion.div 
              layoutId="dashboard-product-search-morph"
              style={{ borderRadius: 9999 }}
              transition={{ type: "spring", bounce: 0.05, duration: 0.4 }}
              className="flex-grow flex items-center bg-white border-[1.5px] border-[var(--theme-primary)] overflow-hidden shadow-sm pointer-events-auto"
            >
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-12 bg-transparent px-4 text-sm outline-none text-[var(--dash-bg)] placeholder-gray-400"
                autoFocus
              />
              <button 
                onClick={() => { setTopBarMode('default'); setSearchQuery(''); }}
                className="p-3 text-gray-400 hover:text-[var(--dash-bg)] transition-colors"
              >
                <X size={18} />
              </button>
            </motion.div>
          </div>
        ) : (
          <>
            <motion.button 
              layoutId="dashboard-product-search-morph" 
              style={{ borderRadius: 9999 }}
              transition={{ type: "spring", bounce: 0.05, duration: 0.4 }}
              onClick={() => { setShowEditMenu(false); setTopBarMode('search'); }} 
              className="w-10 h-10 bg-transparent flex items-center justify-center relative overflow-hidden border-[1.5px] border-transparent shrink-0"
            >
              <Search size={22} className="text-white" />
            </motion.button>
            
            <div className="relative">
              <button onClick={() => { setShowEditMenu(false); setTopBarMode(topBarMode === 'category' ? 'default' : 'category'); }} className={cn("p-2 rounded-lg border transition-colors", topBarMode === 'category' ? "bg-[var(--dash-border)] border-[#fafafa] text-[#fafafa]" : "bg-[var(--dash-card)] border-[var(--dash-border)] hover:bg-[var(--dash-border)]")}>
                <LayoutGrid size={20} />
              </button>
              <AnimatePresence>
              {topBarMode === 'category' && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setTopBarMode('default')} />
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 mt-2 w-64 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl shadow-xl z-50 max-h-[60vh] overflow-y-auto">
                  {(() => {
                    const usedCats = products.map(p => p.category?.trim()).filter(Boolean);
                    const definedCats = categories.map(c => c.name.trim());
                    const uniqueCats = Array.from(new Set([...definedCats, ...usedCats]));
                    return ['All', ...uniqueCats].map(cat => {
                      const count = cat === 'All' ? products.length : products.filter(p => p.category?.trim()?.toLowerCase() === cat.trim().toLowerCase()).length;
                      return (
                      <button 
                        key={cat}
                        onClick={() => { 
                          setSelectedCategory(cat); 
                          setTopBarMode('default'); 
                        }}
                        className={cn("w-full text-left px-4 py-3 hover:bg-[var(--dash-border)] flex items-center gap-3", selectedCategory === cat ? "bg-[var(--dash-border)]" : "")}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#ff8fa3] flex items-center justify-center text-white">
                          <LayoutGrid size={16} />
                        </div>
                        <div>
                          <div className="text-sm">{cat}</div>
                          <div className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Package size={10}/> {count} / <Activity size={10}/> 0 / <ShoppingCart size={10}/> 0
                          </div>
                        </div>
                      </button>
                    );
                    });
                  })()}
                </motion.div>
                </>
              )}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button onClick={() => { setShowEditMenu(false); setTopBarMode(topBarMode === 'filter' ? 'default' : 'filter'); }} className={cn("p-2 rounded-lg border transition-colors", topBarMode === 'filter' ? "bg-[var(--dash-border)] border-[#fafafa] text-[#fafafa]" : "bg-[var(--dash-card)] border-[var(--dash-border)] hover:bg-[var(--dash-border)]")}>
                <Filter size={20} />
              </button>
              <AnimatePresence>
              {topBarMode === 'filter' && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setTopBarMode('default')} />
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full left-0 mt-2 w-48 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl shadow-xl z-50 overflow-hidden py-2">
                  {[
                    'All', 'Top Selling', 'Label', 'Visible', 'In Stock', 'Stockouts', 'Hidden',
                    'High -> Low (Stock)', 'Low -> High (Stock)', 'Low -> High (Price)', 'High -> Low (Price)'
                  ].map(filter => (
                    <button 
                      key={filter}
                      onClick={() => { 
                        setSelectedFilter(filter); 
                        setTopBarMode('default'); 
                      }}
                      className={cn("w-full text-left px-4 py-2 text-sm hover:bg-[var(--dash-border)] flex items-center justify-between", selectedFilter === filter ? "text-[#fafafa]" : "text-gray-300")}
                    >
                      {filter}
                      {['Visible', 'In Stock', 'Stockouts', 'Hidden'].includes(filter) && (
                        <span className="text-[10px] bg-[var(--dash-border)] text-[#fafafa] px-2 py-0.5 rounded-full">
                          {filter === 'Visible' ? products.filter(p => p.isVisible !== false).length :
                           filter === 'Hidden' ? products.filter(p => p.isVisible === false).length :
                           filter === 'In Stock' ? products.filter(p => (p.stock || 0) > 0).length :
                           filter === 'Stockouts' ? products.filter(p => (p.stock || 0) === 0).length : 0}
                        </span>
                      )}
                    </button>
                  ))}
                </motion.div>
                </>
              )}
              </AnimatePresence>
            </div>

            {topBarMode === 'move' || topBarMode === 'visibility' || topBarMode === 'delete' ? (
              <>
                <button className="flex items-center gap-1 px-3 py-2 bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] text-white">
                  {topBarMode === 'move' && <Move size={16} />}
                  {topBarMode === 'visibility' && <Eye size={16} />}
                  {topBarMode === 'delete' && <Trash2 size={16} />}
                  <span className="text-sm capitalize">{topBarMode}</span>
                </button>
                <button onClick={() => { setTopBarMode('default'); setSelectedProducts([]); setVisibilityChanges({}); }} className="px-3 py-2 bg-red-900/50 text-red-400 rounded-lg border border-red-900 text-sm">
                  Reset
                </button>
              </>
            ) : (
              <div className="relative">
                <button onClick={() => { setTopBarMode('default'); setShowEditMenu(!showEditMenu); }} className="p-2 bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors"><Edit size={20} /></button>
                <AnimatePresence>
                {showEditMenu && (
                  <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowEditMenu(false)} />
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full right-0 mt-2 w-40 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl shadow-xl z-50 overflow-hidden">
                    <button onClick={() => { setTopBarMode('move'); setShowEditMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-[var(--dash-border)] flex items-center gap-2"><Move size={16}/> Move</button>
                    <button onClick={() => { setTopBarMode('visibility'); setShowEditMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-[var(--dash-border)] flex items-center gap-2"><Eye size={16}/> Visibility</button>
                    <button onClick={() => { setTopBarMode('delete'); setShowEditMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-[var(--dash-border)] flex items-center gap-2 text-red-400"><Trash2 size={16}/> Delete</button>
                  </motion.div>
                  </>
                )}
                </AnimatePresence>
              </div>
            )}
            
            {(websiteSettings?.preOrder?.pDashboard?.length ?? 0) > 0 && (
              <div className="relative">
                <button onClick={() => setShowDashboardSwitcher(!showDashboardSwitcher)} className={cn("p-2 flex items-center gap-1 rounded-lg border transition-colors", showDashboardSwitcher ? "bg-[var(--dash-border)] border-[#fafafa] text-[#fafafa]" : "bg-[var(--dash-card)] border-[var(--dash-border)] hover:bg-[var(--dash-border)] text-gray-400 hover:text-white")}>
                  <LayoutDashboard size={20} />
                  <ChevronDown size={14} />
                </button>
                <AnimatePresence>
                {showDashboardSwitcher && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDashboardSwitcher(false)} />
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute top-full right-0 mt-2 w-48 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl shadow-xl z-50 overflow-hidden">
                      <button 
                        onClick={() => { setShowDashboardSwitcher(false); }} 
                        className="w-full text-left px-4 py-3 hover:bg-[var(--dash-border)] flex items-center gap-2 text-white border-b border-[var(--dash-border)]"
                      >
                        <LayoutDashboard size={16} className="text-[#fafafa]"/>
                        Main
                      </button>
                      {websiteSettings?.preOrder?.pDashboard?.map(dash => (
                        <button 
                          key={dash.id}
                          onClick={() => { 
                             setShowDashboardSwitcher(false);
                             const link = dash.link.startsWith('http') ? dash.link : `https://${dash.link}`;
                             window.open(link, '_blank');
                          }} 
                          className="w-full text-left px-4 py-3 hover:bg-[var(--dash-border)] flex items-center gap-2 text-gray-300"
                        >
                          <Globe size={16}/>
                          {dash.name}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
                </AnimatePresence>
              </div>
            )}

            <button 
              onClick={() => { setActiveTab('Settings'); setSettingsView('fbZipExport'); }}
              className="ml-auto px-3 py-2 bg-[var(--dash-card)] rounded-xl border border-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors text-white font-medium flex items-center gap-2 cursor-pointer shadow-sm text-xs sm:text-sm"
              title="Download FB Auto-Sender In-Stock Dataset"
            >
              <Download size={16} className="text-indigo-400" />
              <span className="hidden sm:inline">Download Fb Zip</span>
            </button>

            <button 
              onClick={() => setShowZipImport(true)}
              className="px-3 py-2 bg-[var(--dash-card)] rounded-xl border border-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors text-white font-medium flex items-center gap-2 cursor-pointer shadow-sm text-xs sm:text-sm"
            >
              <FileArchive size={16} className="text-indigo-400" />
              <span className="hidden sm:inline">Import ZIP</span>
            </button>

            <button
              onClick={() => setIsAddingProduct(true)}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Add Product</span>
            </button>

            <button 
              onClick={onClose} 
              className="p-2 bg-[var(--dash-card)] rounded-xl border border-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors text-slate-300 hover:text-white cursor-pointer"
              title="View Live Store"
            >
              <Globe size={18} className="text-indigo-400" />
            </button>
          </>
        )}
      </div>
      )}

      {/* Orders Top Bar */}
      {activeTab === 'Orders' && perms.sections.orders && (
        <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 md:px-8 border-b border-[var(--dash-border)] relative z-50 bg-[var(--dash-bg)]">
          <div className="flex items-center gap-2">
            {isOrderSearchMode ? (
              <div className="flex-grow flex items-center gap-2 z-10 relative">
                <motion.div 
                  layoutId="dashboard-order-search-morph"
                  style={{ borderRadius: 9999 }}
                  transition={{ type: "spring", bounce: 0.05, duration: 0.4 }}
                  className="flex-grow flex items-center bg-white border-[1.5px] border-[var(--theme-primary)] overflow-hidden shadow-sm pointer-events-auto"
                >
                  <input 
                    type="text" 
                    placeholder="Search by Phone or Id..." 
                    value={orderSearchQuery}
                    onChange={e => setOrderSearchQuery(e.target.value)}
                    className="w-full h-12 bg-transparent px-4 text-sm outline-none text-[var(--dash-bg)] placeholder-gray-400"
                    autoFocus
                  />
                  <button 
                    onClick={() => { setIsOrderSearchMode(false); setOrderSearchQuery(''); }}
                    className="p-3 text-gray-400 hover:text-[var(--dash-bg)] transition-colors"
                  >
                    <X size={18} />
                  </button>
                </motion.div>
              </div>
            ) : (
              <motion.button 
                layoutId="dashboard-order-search-morph" 
                style={{ borderRadius: 9999 }}
                transition={{ type: "spring", bounce: 0.05, duration: 0.4 }}
                onClick={() => setIsOrderSearchMode(true)} 
                className="w-10 h-10 bg-transparent flex items-center justify-center relative overflow-hidden border-[1.5px] border-transparent shrink-0"
              >
                <Search size={22} className="text-white" />
              </motion.button>
            )}
            
            {!isOrderSearchMode && (
              <div className="flex-grow overflow-x-auto no-scrollbar flex gap-2">
                {['All', 'Pending', 'Unreachable', 'Preparing', 'Shipping', 'Completed', 'Canceled', 'Returned', 'Complete Return'].map(filter => {
                  const count = filter === 'All' ? orders.length : orders.filter(o => o.status === filter).length;
                  const isActive = orderFilter === filter;
                  return (
                  <button
                    key={filter}
                    onClick={() => setOrderFilter(filter as OrderStatus | 'All')}
                    style={{ borderRadius: websiteSettings?.actionButtons?.placeOrder?.borderRadius || '9999px' }}
                    className={cn(
                      "px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2 border",
                      isActive 
                        ? "bg-[#fafafa] border-[#fafafa] text-[var(--dash-bg)] shadow-[0_0_15px_rgba(250, 250, 250,0.15)]" 
                        : "bg-[var(--dash-card)] border-[var(--dash-border)] text-gray-300 hover:bg-[var(--dash-border)] hover:text-white"
                    )}
                  >
                   <span>{filter}</span>
                   <span className={cn(
                     "text-[11px] font-bold px-2 py-0.5 rounded-full",
                     isActive ? "bg-[var(--dash-bg)]/20 text-[var(--dash-bg)]" : "bg-[var(--dash-border)] text-gray-400"
                   )}>
                     {count}
                   </span>
                  </button>
                )})}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Dashboard' && perms.sections.dashboard && (
        <div className="flex items-center justify-between gap-2 sm:gap-4 p-3 md:px-8 md:py-4 border-b border-[var(--dash-border)] relative z-50 bg-[var(--dash-bg)] w-full">
          {/* Desktop Quick Presets */}
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'This month'].map(preset => (
              <button
                key={preset}
                onClick={() => handlePresetSelect(preset)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border",
                  dateRangePreset === preset
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/25"
                    : "bg-[var(--dash-card)] border-[var(--dash-border)] text-slate-300 hover:bg-[var(--dash-border)] hover:text-white"
                )}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Mobile Presets Dropdown */}
          <div className="relative shrink-0 flex items-stretch md:hidden">
            <button 
              onClick={() => setShowPresetDropdown(!showPresetDropdown)} 
              style={{ borderRadius: websiteSettings?.actionButtons?.checkout?.borderRadius || '9999px' }}
              className="px-3.5 flex items-center justify-center bg-[var(--dash-card)] border border-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors text-gray-400 min-h-[40px]"
            >
              <SlidersHorizontal size={18} />
            </button>
            {showPresetDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPresetDropdown(false)} />
                <div className="absolute top-full left-0 mt-2 w-48 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl shadow-xl z-50 py-2">
                  {['Today', 'Yesterday', 'This month', 'Last month', 'Last 7 days', 'Last 30 days', 'Last 60 days'].map(preset => (
                    <button 
                      key={preset}
                      onClick={() => {
                        handlePresetSelect(preset);
                        setShowPresetDropdown(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-[var(--dash-border)] flex items-center justify-between text-gray-300"
                    >
                      {preset}
                      {dateRangePreset === preset && <Check size={16} className="text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="relative flex items-center gap-2 flex-1 min-w-0 md:flex-none md:max-w-md md:ml-auto">
            <button 
              onClick={() => setShowCalendar(!showCalendar)} 
              style={{ borderRadius: websiteSettings?.actionButtons?.checkout?.borderRadius || '9999px' }}
              className="flex-1 min-w-0 md:flex-none flex items-center justify-center gap-2 px-3 md:px-4 py-2 bg-[var(--dash-card)] border border-[var(--dash-border)] hover:bg-[var(--dash-border)] transition-colors text-white min-h-[40px] cursor-pointer shadow-sm"
            >
              <CalendarIcon size={16} className="text-indigo-400 shrink-0" />
              <span className="text-xs md:text-sm font-medium whitespace-nowrap truncate">{dateRange}</span>
            </button>
            <button 
              onClick={handleApplyDateRange}
              style={{ borderRadius: websiteSettings?.actionButtons?.checkout?.borderRadius || '9999px' }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all flex items-center justify-center min-h-[40px] whitespace-nowrap shrink-0 shadow-md shadow-indigo-500/25 active:scale-95 cursor-pointer text-xs md:text-sm"
            >
              Apply
            </button>
            
            {showCalendar && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
                <div className="absolute top-full right-0 mt-2 w-[320px] max-w-[calc(100vw-24px)] bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl shadow-xl z-50 p-4 sm:p-5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                    <CalendarIcon size={16} className="text-[#fafafa]" />
                    Custom Date Range
                  </h3>
                  <div className="flex flex-col gap-4">
                    <DatePicker 
                      label="From Date" 
                      value={calStart} 
                      onChange={(d) => {
                        setCalStart(d);
                        if (calEnd && d > calEnd) setCalEnd(d);
                      }} 
                    />
                    <DatePicker 
                      label="To Date" 
                      value={calEnd} 
                      onChange={(d) => {
                        setCalEnd(d);
                        if (calStart && d < calStart) setCalStart(d);
                      }} 
                    />
                    <button 
                      onClick={() => {
                        handleApplyDateRange();
                        setShowCalendar(false);
                      }}
                      style={{ borderRadius: websiteSettings?.actionButtons?.checkout?.borderRadius || '9999px' }}
                      className="w-full mt-2 py-3 bg-[#fafafa] text-[var(--dash-bg)] font-bold hover:bg-[#e4e4e7] transition-colors shadow-lg shadow-[#fafafa]/20"
                    >
                      Apply Range
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {(topBarMode === 'search' || isOrderSearchMode) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => {
              setTopBarMode('default');
              setIsOrderSearchMode(false);
            }}
            className="absolute inset-0 bg-transparent z-40 pointer-events-auto cursor-pointer"
          />
        )}
      </AnimatePresence>

      <div 
        ref={setScrollContainerRef} 
        className={cn(
          "flex-grow min-h-0 overflow-y-auto relative z-0 md:p-8 overscroll-y-contain", 
          activeTab === 'Dashboard' ? 'px-1.5 pt-1 pb-20' : (activeTab === 'Settings' || activeTab === 'Orders') ? 'px-2.5 pt-2 pb-20' : 'px-4 pt-4 pb-20'
        )}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-7xl mx-auto w-full">
        {/* Stats - Only show on Dashboard tab */}
        {activeTab === 'Dashboard' && perms.sections.dashboard && (
          <>
            {/* Overview Section */}
            {(perms.analytics.completedSell || perms.analytics.completedProfit) && (
               <div className="mb-1 md:mb-6">
                 <DashboardOverviewCard 
                    completedSell={perms.analytics.completedSell ? formatPrice(completedSellAmount) : ''} 
                    completedProfit={perms.analytics.completedProfit ? formatPrice(completedProfitAmount) : ''} 
                 />
               </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-1.5 gap-y-1 md:gap-4 mb-4 md:mb-8">
              {perms.analytics.totalSell && <DashboardStatCard title="Total sell" value={formatPrice(totalSellAmount)} icon={ShoppingBag} color="green" />}
              {perms.analytics.completedProfit && <DashboardStatCard title="Profit" value={formatPrice(totalProfitAmount)} icon={CircleDollarSign} color="green" />}
              {perms.analytics.completedProfit && <DashboardStatCard title="Returned Cost" value={formatPrice(totalReturnedCost)} icon={Undo2} color="orange" />}
              <DashboardStatCard title="Extra Costs" value={formatPrice(0)} icon={MinusCircle} color="red" />
              {perms.analytics.totalOrders && <DashboardStatCard title="Total Orders" value={totalOrders.toString()} icon={ClipboardList} color="blue" />}
              {perms.analytics.completedOrders && <DashboardStatCard title="Completed Orders" value={completedOrders.toString()} icon={ClipboardCheck} color="blue" />}
              <DashboardStatCard title="Canceled Orders" value={canceledOrders.toString()} icon={XCircle} color="purple" />
              <DashboardStatCard title="Total Items" value={products.length.toString()} icon={Package} color="orange" />
              <DashboardStatCard title="Unique Items" value={uniqueItemsCount.toString()} icon={Tag} color="teal" />
              <DashboardStatCard title="Total Quantity" value={totalQuantity.toString()} icon={ShoppingCart} color="teal" />
              <DashboardStatCard title="Free Delivery" value="0" icon={Truck} color="purple" />
            </div>

            {/* Top Products */}
            {perms.analytics.topSellingProducts && topProducts.length > 0 && (
              <div className="mb-6 border-t border-[var(--dash-border)] pt-8">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-8"></div>
                  <h3 className="text-xl font-bold text-white flex items-center justify-center">Items</h3>
                  {isOwner ? (
                    <button 
                      onClick={() => {
                        setIsManagingAnalyticsItems(prev => !prev);
                        setSelectedAnalyticsItemIds([]);
                      }}
                      className={`p-2 rounded-xl border transition-all ${
                        isManagingAnalyticsItems 
                          ? 'bg-red-500/20 text-red-400 border-red-500/40' 
                          : 'bg-[var(--dash-card)] text-slate-400 hover:text-white border-[var(--dash-border)]'
                      }`}
                      title={isManagingAnalyticsItems ? "Cancel" : "Delete Analytics Images"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-8"></div>
                  )}
                </div>

                {isManagingAnalyticsItems && (
                  <div className="flex items-center justify-between bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-3 mb-4 shadow-xl">
                    <span className="text-xs sm:text-sm font-semibold text-slate-200">
                      {selectedAnalyticsItemIds.length} item(s) selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setIsManagingAnalyticsItems(false);
                          setSelectedAnalyticsItemIds([]);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button 
                        disabled={selectedAnalyticsItemIds.length === 0}
                        onClick={handleDeleteAnalyticsItems}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 flex items-center gap-1.5 shadow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Selected
                      </button>
                    </div>
                  </div>
                )}

                {/* Category Filter Chips for Items */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-3">
                  {analyticsCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedAnalyticsCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        selectedAnalyticsCategory === cat
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                          : 'bg-[var(--dash-card)] text-gray-400 hover:text-white border border-[var(--dash-border)] hover:bg-[var(--dash-border)]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6 md:gap-4">
                  {filteredTopProducts.map(({ product, quantity }) => (
                    <TopProductItem 
                      key={product.id}
                      product={product}
                      quantity={quantity}
                      showImages={Boolean(perms.analytics.productImages)}
                      isDeleteMode={isManagingAnalyticsItems}
                      isSelected={selectedAnalyticsItemIds.includes(product.id)}
                      onToggleSelect={() => {
                        setSelectedAnalyticsItemIds(prev => 
                          prev.includes(product.id) 
                            ? prev.filter(id => id !== product.id)
                            : [...prev, product.id]
                        );
                      }}
                    />
                  ))}
                </div>

                {filteredTopProducts.length === 0 && (
                  <div className="text-center py-10 text-gray-400 text-xs sm:text-sm bg-[var(--dash-card)] rounded-xl border border-[var(--dash-border)]">
                    No best-selling items found in category <span className="text-white font-semibold">"{selectedAnalyticsCategory}"</span> for this date range.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Products Grid */}
        {activeTab === 'Products' && perms.sections.products && (
          <DashboardProductsGrid
            displayProducts={displayProducts}
            scrollEl={scrollEl || scrollRef.current}
            windowWidth={windowWidth}
            topBarMode={topBarMode}
            selectedProducts={selectedProducts}
            visibilityChanges={visibilityChanges}
            perms={perms}
            onEdit={setEditingProduct}
            onToggleSelection={toggleProductSelection}
            onToggleVisibility={toggleVisibility}
            onMoveProducts={handleMoveProducts}
          />
        )}

        {/* Orders List */}
        {activeTab === 'Orders' && perms.sections.orders && (
          <div className="w-full">
            {displayOrders.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">No orders found</div>
            ) : (
              <div className="flex flex-col gap-3 max-w-4xl mx-auto w-full">
                  {displayOrders.map(order => (
                    <div 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className="bg-[var(--dash-card)] border border-[var(--dash-border)]/80 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between cursor-pointer hover:border-slate-500/40 transition-colors shadow-sm"
                    >
                      {/* Top Row: Left (Checkbox, Name, #ID, Copy, Calendar, Date) & Right (Status Pill in place of the removed red dot) */}
                      <div className="flex items-start justify-between gap-2">
                        {/* Left: Circle + Customer Info + Date */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Selection Circle */}
                          <div 
                            onClick={(e) => toggleOrderSelection(order.id, e)} 
                            className="cursor-pointer shrink-0"
                          >
                            {selectedOrders.includes(order.id) ? (
                              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center transition-all">
                                <Check size={12} className="text-[var(--dash-bg)] stroke-[3]" />
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border border-slate-500/70 hover:border-slate-300 transition-colors" />
                            )}
                          </div>

                          {/* Customer Name, ID, Copy, Date */}
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-white text-sm sm:text-[15px] tracking-tight truncate">
                                {perms.order.customerName ? (order.userInfo?.name || 'Anonymous') : '***'}
                              </span>
                              <span className="text-slate-400 font-normal text-xs">
                                #{order.id}
                              </span>
                              <CopyButton text={order.id} className="p-0.5 text-slate-400 hover:text-white" />
                            </div>
                            <div className="flex items-center gap-1 text-slate-400 text-[11px] sm:text-xs mt-0.5">
                              <CalendarIcon size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{order.date}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Status Pill (Placed where the red dot was, consistent with other buttons) */}
                        <div className="flex items-center shrink-0">
                          {order.status === 'Pending' && (
                            <span className="px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm">
                              <span className="text-[12px]">🎉</span> Pending
                            </span>
                          )}
                          {order.status === 'Preparing' && (
                            <span className="px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm">
                              <span className="text-[12px]">📦</span> Preparing
                            </span>
                          )}
                          {order.status === 'Shipping' && (
                            <span className="px-3.5 py-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-pink-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm">
                              <span className="text-[12px]">🚚</span> Shipping
                            </span>
                          )}
                          {order.status === 'Completed' && (
                            <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm">
                              <span className="text-[12px]">✅</span> Completed
                            </span>
                          )}
                          {order.status === 'Canceled' && (
                            <span className="px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm">
                              <span className="text-[12px]">❌</span> Canceled
                            </span>
                          )}
                          {order.status === 'Returned' && (
                            <span className="px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm">
                              <span className="text-[12px]">↩️</span> Returned
                            </span>
                          )}
                          {order.status === 'Complete Return' && (
                            <span className="px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm">
                              <span className="text-[12px]">🔄</span> Complete Return
                            </span>
                          )}
                          {order.status === 'Unreachable' && (
                            <span className="px-3.5 py-1.5 rounded-full bg-slate-700/30 border border-slate-600/30 text-slate-400 text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm">
                              <span className="text-[12px]">📵</span> Unreachable
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Left (Price - reduced to perfect balanced size) & Right (Details Button) */}
                      <div className="flex items-center justify-between mt-3.5 pt-0.5">
                        <div className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
                          {perms.order.customerOrderAmount ? formatPrice(order.total) : '***'}
                        </div>

                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-[#1e2b42] hover:bg-[#253552] border border-[#2a3c5d]/60 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                        >
                          <span>Details</span>
                          <ChevronRight size={14} className="text-slate-300" strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
            )}

            {activeTab === 'Orders' && paginatedOrdersHasMore && displayOrders.length > 0 && (
              <div className="col-span-full flex justify-center mt-6 mb-8">
                <button 
                  onClick={handleLoadMoreOrders}
                  disabled={isLoadingOrders}
                  className="px-6 py-2.5 bg-[#fafafa] text-[var(--dash-bg)] rounded-xl font-bold text-sm hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg"
                >
                  {isLoadingOrders ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-[var(--dash-bg)] border-t-transparent animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Orders'
                  )}
                </button>
              </div>
            )}
            {activeTab === 'Orders' && selectedOrders.length > 0 && (
              <div className="fixed bottom-[80px] right-4 z-40 bg-[#fafafa] text-[var(--dash-bg)] rounded-xl flex flex-col shadow-2xl overflow-visible">
                {showOrderSummary && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[var(--dash-card)] text-white p-4 rounded-xl border border-[#fafafa] text-sm flex flex-col gap-2 w-56 shadow-[0_8px_30px_rgb(250, 250, 250,0.2)]">
                    <div className="flex justify-between font-bold text-[#fafafa] border-b border-[var(--dash-border)] pb-2 mb-1">
                      <span>Summary</span>
                      <span>{selectedOrders.length}</span>
                    </div>
                    <div className="flex justify-between"><span>Total:</span> <span>৳{selectedOrdersSummary.total}</span></div>
                    <div className="flex justify-between text-gray-400"><span>Buy:</span> <span>৳{selectedOrdersSummary.buy}</span></div>
                    <div className="flex justify-between text-[#fafafa] font-bold"><span>Profit:</span> <span>৳{selectedOrdersSummary.profit}</span></div>
                    <div className="flex justify-between mt-1 pt-2 border-t border-[var(--dash-border)]">
                      <span>Items:</span> <span>{selectedOrdersSummary.items}</span>
                    </div>
                    <div className="flex justify-between"><span>Unique Items:</span> <span>{selectedOrdersSummary.uniqueItems.size}</span></div>
                    <div className="flex justify-between"><span>Quantity:</span> <span>{selectedOrdersSummary.quantity}</span></div>
                  </div>
                )}
                <div className="relative flex items-center h-10">
                  <button onClick={toggleSelectAllOrders} className="flex px-4 h-full items-center gap-2 font-bold text-sm border-r border-[#e4e4e7] hover:bg-[#e4e4e7] transition-colors rounded-l-xl flex-shrink-0">
                    <CheckSquare size={16} className="text-[var(--dash-bg)]" />
                    Select All
                  </button>
                  <div className="h-full border-r border-[#e4e4e7]">
                    <button 
                      onClick={() => setShowPrintDropdown(!showPrintDropdown)} 
                      className="px-3 h-full hover:bg-[#e4e4e7] transition-colors flex items-center justify-center w-full"
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                  <button onClick={() => setShowOrderSummary(!showOrderSummary)} className="px-3 h-full hover:bg-[#e4e4e7] transition-colors rounded-r-xl w-10 flex items-center justify-center flex-shrink-0">
                    {showOrderSummary ? <ChevronDown size={18}/> : <ChevronUp size={18} />}
                  </button>
                  <AnimatePresence>
                    {showPrintDropdown && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full right-0 mb-2 w-48 bg-[var(--dash-card)] border border-[#fafafa] rounded-xl overflow-hidden shadow-[0_8px_30px_rgb(250, 250, 250,0.3)] origin-bottom-right"
                      >
                         <button onClick={handleBulkJPGDownload} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--dash-border)] text-white transition-colors">
                           <Download size={18} className="text-[#fafafa] shrink-0" />
                           <div className="flex flex-col flex-1">
                             <span className="font-bold text-sm leading-none mb-1">JPG Download</span>
                             <span className="text-[10px] leading-none text-gray-400">Save as image</span>
                           </div>
                         </button>
                         <button onClick={handleBulkPrint} className="w-full flex items-center gap-3 px-4 py-3 text-left border-t border-[var(--dash-border)] hover:bg-[var(--dash-border)] text-white transition-colors">
                           <Printer size={18} className="text-[#fafafa] shrink-0" />
                           <div className="flex flex-col flex-1">
                             <span className="font-bold text-sm leading-none mb-1">Print Options</span>
                             <span className="text-[10px] leading-none text-gray-400">Physical printer</span>
                           </div>
                         </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Settings Tab */}
        {activeTab === 'Settings' && perms.sections.settings && (
          <div className="md:hidden max-w-6xl mx-auto w-full flex flex-col gap-4 px-0 py-1 pb-2">
            {/* Header */}
            <div className="mb-1 md:mb-2">
              <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight">Settings Hub</h1>
              <p className="text-[12px] md:text-sm text-slate-400 mt-0.5">Manage storefront appearance, marketing pixels, logistics, and store preferences</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 items-start">
              {/* Column 1: Storefront & Catalog */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Palette size={14} className="text-indigo-400" />
                  <span>Storefront & Catalog</span>
                </div>

                {/* Maintenance */}
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl overflow-hidden shadow-lg shadow-black/10">
                  <div className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5">
                    <div className="flex items-center gap-3.5">
                      <div className="text-indigo-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <RefreshCw size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Maintenance</span>
                    </div>
                    <button 
                      onClick={() => {
                        const newVal = !isMaintenanceMode;
                        setIsMaintenanceMode(newVal);
                        cloudStore.saveSetting('isMaintenanceMode', newVal).catch(console.error);
                      }}
                      className={cn(
                        "w-10 h-5.5 md:w-11 md:h-6 rounded-full relative flex items-center px-0.5 transition-colors duration-200 outline-none cursor-pointer",
                        isMaintenanceMode ? "bg-[#8b5cf6]" : "bg-slate-800"
                      )}
                    >
                      <div className={cn(
                        "w-4.5 h-4.5 md:w-5 md:h-5 rounded-full bg-white shadow-md transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
                        isMaintenanceMode ? "translate-x-4.5 md:translate-x-5" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                </div>

                {/* Catalog Group */}
                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl overflow-hidden shadow-lg shadow-black/10 flex flex-col divide-y divide-[var(--dash-border)]/40">
                  {/* Website */}
                  <div 
                    onClick={() => setSettingsView('website')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-indigo-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Globe size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Website Layout</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Customise */}
                  <div 
                    onClick={() => setSettingsView('customise')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-pink-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Palette size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Customise Theme</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Categories */}
                  <div 
                    onClick={() => setSettingsView('categories')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-purple-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Tag size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Categories</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* SEO & Branding Settings */}
                  <div 
                    onClick={() => setSettingsView('seoSettings')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-indigo-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Globe size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">SEO & Branding</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Image Settings */}
                  <div 
                    onClick={() => setSettingsView('imageSettings')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-sky-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <ImageIcon size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Image Settings</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Pre Order */}
                  <div 
                    onClick={() => setSettingsView('preOrder')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-blue-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Package size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Pre Order</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>
                </div>
              </div>

              {/* Column 2: Sales, Marketing & Growth */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span>Sales & Marketing</span>
                </div>

                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl overflow-hidden shadow-lg shadow-black/10 flex flex-col divide-y divide-[var(--dash-border)]/40">
                  {/* Discounts */}
                  <div 
                    onClick={() => setSettingsView('discounts')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-emerald-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <BadgePercent size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Discounts & Coupons</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Qty Rules */}
                  <div 
                    onClick={() => setSettingsView('qtyRules')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-cyan-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <PackagePlus size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Quantity Rules</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Bulk Edit */}
                  <div 
                    onClick={() => setSettingsView('bulkPrice')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-blue-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Calculator size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Bulk Edit Price</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Marketing */}
                  <div 
                    onClick={() => setSettingsView('marketing')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-blue-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Target size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Marketing & Pixels</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Social Media */}
                  <div 
                    onClick={() => setSettingsView('socialMedia')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-blue-500 shrink-0 flex items-center justify-center w-6 h-6">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Social Media Links</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Download FB Zip (FB Auto-Sender Dataset) */}
                  <div 
                    onClick={() => setSettingsView('fbZipExport')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-blue-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <FolderArchive size={20} strokeWidth={1.75} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm md:text-base font-medium tracking-wide">Download Fb Zip</span>
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono font-medium">In-Stock</span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>
                </div>
              </div>

              {/* Column 3: Logistics, Operations & Team */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 px-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Shield size={14} className="text-amber-400" />
                  <span>Operations & Security</span>
                </div>

                <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl overflow-hidden shadow-lg shadow-black/10 flex flex-col divide-y divide-[var(--dash-border)]/40">
                  {/* Anti Spam */}
                  <div 
                    onClick={() => setSettingsView('antiSpam')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-red-500 shrink-0 flex items-center justify-center w-6 h-6">
                        <ShieldAlert size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Anti-Spam & Fraud</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Notification */}
                  <div 
                    onClick={() => setSettingsView('notification')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-cyan-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Order Notifications</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Incomplete Orders */}
                  <div 
                    onClick={() => setSettingsView('incompleteOrders')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-orange-500 shrink-0 flex items-center justify-center w-6 h-6">
                        <AlertCircle size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Incomplete Orders</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Minimum Order */}
                  <div 
                    onClick={() => setSettingsView('minOrder')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-rose-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <ShoppingCart size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Minimum Order</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Courier */}
                  <div 
                    onClick={() => setSettingsView('courier')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-emerald-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Truck size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Courier & Delivery</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Suppliers */}
                  <div 
                    onClick={() => setSettingsView('suppliers')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-orange-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Factory size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Suppliers</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Price Calculator */}
                  <div 
                    onClick={() => setSettingsView('priceCalculator')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-yellow-500 shrink-0 flex items-center justify-center w-6 h-6">
                        <JapaneseYen size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Price Calculator</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Customers - Strictly Owner Only */}
                  {isOwner && perms.sections.customers && (
                    <div 
                      onClick={() => setSettingsView('customers')}
                      className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="text-blue-500 shrink-0 flex items-center justify-center w-6 h-6">
                          <User size={20} strokeWidth={1.75} />
                        </div>
                        <span className="text-white text-sm md:text-base font-medium tracking-wide">Customers CRM</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                    </div>
                  )}

                  {/* Store Sync */}
                  <div 
                    onClick={() => setSettingsView('apiSync')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-emerald-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Database size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Store API Sync</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Account Settings */}
                  <div 
                    onClick={() => setSettingsView('account')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-emerald-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Settings size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Account Settings</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Account Control */}
                  <div 
                    onClick={() => setSettingsView('accountControl')}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-indigo-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <Shield size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-white text-sm md:text-base font-medium tracking-wide">Team Permissions</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                  </div>

                  {/* Logout */}
                  <div 
                    onClick={() => {
                      cloudStore.logoutAdmin().catch(console.error);
                      setCurrentAdmin(null);
                      window.location.href = '/';
                    }}
                    className="flex items-center justify-between py-3.5 px-3.5 md:py-4 md:px-5 cursor-pointer hover:bg-red-500/[0.05] active:bg-red-500/[0.1] transition-colors group select-none"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="text-red-400 shrink-0 flex items-center justify-center w-6 h-6">
                        <LogOut size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-red-400 text-sm md:text-base font-medium tracking-wide">Logout</span>
                    </div>
                    <ChevronRight size={16} className="text-red-500/50 group-hover:text-red-400 transition-colors shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Bottom Nav / Sidebar */}
      <style>{navStyleContent}</style>
      <div className="mobile-dashboard-nav fixed bg-[var(--dash-bg)]/70 border-2 border-[var(--glass-border)] shadow-[0_8px_32px_rgba(0,0,0,0.5)] shadow-black/50 rounded-[32px] flex justify-around items-center px-2 z-40 md:top-0 md:bottom-0 md:left-0 md:right-auto md:w-[84px] md:h-screen md:flex-col md:justify-start md:border-y-0 md:border-l-0 md:border-[var(--dash-border)] md:border-r md:px-2 md:py-6 md:gap-3 md:rounded-none md:bg-[var(--dash-bg)] md:backdrop-blur-none md:transform-none md:saturate-100 md:shadow-none overflow-y-auto">
        <div className="hidden md:flex items-center justify-center w-full mb-3">
          <div 
            onClick={() => handleTabChange('Dashboard')}
            className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner cursor-pointer hover:bg-indigo-500/20 transition-colors"
            title="Dashboard"
          >
             <LayoutDashboard size={20} />
          </div>
        </div>

        <div className="w-full flex flex-row md:flex-col gap-1 md:gap-2">
          {perms.sections.dashboard && <NavButton icon={LayoutDashboard} label="Dashboard" active={activeTab === 'Dashboard'} onClick={() => handleTabChange('Dashboard')} />}
          {perms.sections.products && <NavButton icon={Package} label="Products" active={activeTab === 'Products'} onClick={() => handleTabChange('Products')} />}
          {perms.sections.orders && <NavButton icon={ShoppingCart} label="Orders" active={activeTab === 'Orders'} onClick={() => handleTabChange('Orders')} />}
          {perms.sections.settings && <NavButton icon={Settings} label="Settings" active={activeTab === 'Settings'} onClick={() => handleTabChange('Settings')} />}
        </div>
        
        <div className="hidden md:block flex-1" />
        
        {/* Desktop Sidebar Footer */}
        <div className="hidden md:flex flex-col items-center gap-2.5 w-full pt-4 border-t border-[var(--dash-border)]/60">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="View Live Store"
          >
            <Globe size={18} />
          </button>
          {currentAdmin && (
            <button 
              onClick={() => {
                cloudStore.logoutAdmin().catch(console.error);
                setCurrentAdmin(null);
              }} 
              className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer"
              title={`Logout (${currentAdmin.email || 'Admin'})`}
            >
              {currentAdmin.email ? currentAdmin.email[0].toUpperCase() : 'A'}
            </button>
          )}
        </div>
      </div>

      {/* Desktop Settings Sub-Sidebar */}
      {activeTab === 'Settings' && perms.sections.settings && (
        <div className="hidden md:flex fixed top-0 bottom-0 left-[84px] w-[250px] bg-[var(--dash-bg)] border-r border-[var(--dash-border)]/70 flex-col z-30 overflow-y-auto px-3 py-5 select-none">
          {/* Store Header */}
          <div className="flex flex-col gap-1 pb-4 mb-3 border-b border-[var(--dash-border)]/60 px-2">
            <a 
              href="/" 
              target="_blank" 
              rel="noreferrer" 
              className="text-white font-extrabold text-base tracking-tight hover:text-indigo-400 transition-colors flex items-center gap-1.5 group"
            >
              <span>{websiteSettings.storeName || 'PaikariX'}</span>
              <ExternalLink size={13} className="text-slate-400 group-hover:text-indigo-400 transition-colors" />
            </a>
            <span className="text-[11px] text-slate-400 truncate">{currentAdmin?.email || 'admin@example.com'}</span>
          </div>

          {/* Settings Serial List */}
          <div className="flex flex-col gap-0.5">
            {/* 1. Maintenance */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl text-slate-300">
              <div className="flex items-center gap-2.5">
                <RefreshCw size={16} className="text-indigo-400 shrink-0" />
                <span className="text-xs font-medium text-white">Maintenance</span>
              </div>
              <button 
                onClick={() => {
                  const newVal = !isMaintenanceMode;
                  setIsMaintenanceMode(newVal);
                  cloudStore.saveSetting('isMaintenanceMode', newVal).catch(console.error);
                }}
                className={cn(
                  "w-8 h-4.5 rounded-full relative flex items-center px-0.5 transition-colors duration-200 outline-none cursor-pointer shrink-0",
                  isMaintenanceMode ? "bg-[#8b5cf6]" : "bg-slate-800 border border-white/10"
                )}
              >
                <div className={cn(
                  "w-3.5 h-3.5 rounded-full bg-white shadow-md transition-all duration-300",
                  isMaintenanceMode ? "translate-x-3.5" : "translate-x-0"
                )} />
              </button>
            </div>

            {/* 2. Pre Order */}
            <div 
              onClick={() => setSettingsView('preOrder')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'preOrder' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Box size={16} className="text-cyan-400 shrink-0" />
                <span className="text-xs font-medium">Pre-Order</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 3. Categories */}
            <div 
              onClick={() => setSettingsView('categories')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'categories' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Tag size={16} className="text-purple-400 shrink-0" />
                <span className="text-xs font-medium">Categories</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 4. Suppliers */}
            <div 
              onClick={() => setSettingsView('suppliers')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'suppliers' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Building size={16} className="text-amber-400 shrink-0" />
                <span className="text-xs font-medium">Suppliers</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 5. Discounts */}
            <div 
              onClick={() => setSettingsView('discounts')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'discounts' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Percent size={16} className="text-emerald-400 shrink-0" />
                <span className="text-xs font-medium">Discounts & Coupons</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 6. Website Layout */}
            <div 
              onClick={() => setSettingsView('website')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'website' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Globe size={16} className="text-indigo-400 shrink-0" />
                <span className="text-xs font-medium">Website Layout</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 7. Courier */}
            <div 
              onClick={() => setSettingsView('courier')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'courier' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Truck size={16} className="text-teal-400 shrink-0" />
                <span className="text-xs font-medium">Courier & Delivery</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 8. Price Calculator */}
            <div 
              onClick={() => setSettingsView('priceCalculator')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'priceCalculator' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <JapaneseYen size={16} className="text-yellow-400 shrink-0" />
                <span className="text-xs font-medium">Price Calculator</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 9. Marketing */}
            <div 
              onClick={() => setSettingsView('marketing')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'marketing' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Target size={16} className="text-blue-400 shrink-0" />
                <span className="text-xs font-medium">Marketing & Pixels</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 10. Quantity Rules */}
            <div 
              onClick={() => setSettingsView('qtyRules')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'qtyRules' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Layers size={16} className="text-cyan-400 shrink-0" />
                <span className="text-xs font-medium">Quantity Rules</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 11. Bulk Edit Price */}
            <div 
              onClick={() => setSettingsView('bulkPrice')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'bulkPrice' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Calculator size={16} className="text-indigo-400 shrink-0" />
                <span className="text-xs font-medium">Bulk Edit Price</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 12. Anti-Spam */}
            <div 
              onClick={() => setSettingsView('antiSpam')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'antiSpam' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={16} className="text-rose-400 shrink-0" />
                <span className="text-xs font-medium">Anti-Spam & Fraud</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 13. Order Notifications */}
            <div 
              onClick={() => setSettingsView('notification')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'notification' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Send size={16} className="text-sky-400 shrink-0" />
                <span className="text-xs font-medium">Order Notifications</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 14. Incomplete Orders */}
            <div 
              onClick={() => setSettingsView('incompleteOrders')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'incompleteOrders' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                <span className="text-xs font-medium">Incomplete Orders</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 15. Minimum Order */}
            <div 
              onClick={() => setSettingsView('minOrder')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'minOrder' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <ShoppingCart size={16} className="text-pink-400 shrink-0" />
                <span className="text-xs font-medium">Minimum Order</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 16. Customers CRM - Strictly Owner Only */}
            {isOwner && perms.sections.customers && (
              <div 
                onClick={() => setSettingsView('customers')}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                  settingsView === 'customers' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <User size={16} className="text-blue-400 shrink-0" />
                  <span className="text-xs font-medium">Customers CRM</span>
                </div>
                <ChevronRight size={13} className="text-slate-500 shrink-0" />
              </div>
            )}

            {/* 17. SEO & Branding */}
            <div 
              onClick={() => setSettingsView('seoSettings')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'seoSettings' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Globe size={16} className="text-indigo-400 shrink-0" />
                <span className="text-xs font-medium">SEO & Branding</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 18. Image Settings */}
            <div 
              onClick={() => setSettingsView('imageSettings')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'imageSettings' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Image size={16} className="text-teal-400 shrink-0" />
                <span className="text-xs font-medium">Image Settings</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 19. Store API Sync */}
            <div 
              onClick={() => setSettingsView('apiSync')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'apiSync' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Database size={16} className="text-emerald-400 shrink-0" />
                <span className="text-xs font-medium">Store API Sync</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 20. Customise Theme */}
            <div 
              onClick={() => setSettingsView('customise')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'customise' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Palette size={16} className="text-pink-400 shrink-0" />
                <span className="text-xs font-medium">Customise Theme</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 21. Account Settings */}
            <div 
              onClick={() => setSettingsView('account')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'account' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Settings size={16} className="text-teal-400 shrink-0" />
                <span className="text-xs font-medium">Account Settings</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 22. Team Permissions */}
            <div 
              onClick={() => setSettingsView('accountControl')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'accountControl' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Shield size={16} className="text-indigo-400 shrink-0" />
                <span className="text-xs font-medium">Team Permissions</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 23. Download FB Zip */}
            <div 
              onClick={() => setSettingsView('fbZipExport')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'fbZipExport' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <FolderArchive size={16} className="text-blue-400 shrink-0" />
                <span className="text-xs font-medium">Download Fb Zip</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 24. Social Media */}
            <div 
              onClick={() => setSettingsView('socialMedia')}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all",
                settingsView === 'socialMedia' ? "bg-indigo-600/15 border border-indigo-500/30 text-white font-bold" : "text-slate-300 hover:bg-white/[0.02] hover:text-white border border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5">
                <MessageCircle size={16} className="text-sky-400 shrink-0" />
                <span className="text-xs font-medium">Social Media Links</span>
              </div>
              <ChevronRight size={13} className="text-slate-500 shrink-0" />
            </div>

            {/* 25. Logout */}
            <div 
              onClick={() => {
                cloudStore.logoutAdmin().catch(console.error);
                setCurrentAdmin(null);
              }}
              className="flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer text-rose-400 hover:bg-rose-500/10 transition-all mt-2 border-t border-[var(--dash-border)]/50 pt-3"
            >
              <div className="flex items-center gap-2.5">
                <LogOut size={16} className="text-rose-400 shrink-0" />
                <span className="text-xs font-medium">Logout</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FABs */}
      {topBarMode === 'default' && activeTab === 'Products' && (
        <button 
          onClick={() => setIsAddingProduct(true)}
          className="mobile-fab-glass fixed md:bottom-8 right-6 md:right-8 w-14 h-14 md:w-16 md:h-16 bg-[var(--dash-bg)]/70 md:bg-[#fafafa] text-[#fafafa] md:text-[var(--dash-bg)] border-2 border-[var(--glass-border)] md:border-none shadow-[0_8px_32px_rgba(0,0,0,0.5)] md:shadow-lg shadow-black/50 rounded-full flex items-center justify-center hover:bg-[var(--dash-border)] md:hover:bg-[#e4e4e7] transition-colors md:backdrop-blur-none z-50"
        >
          <Plus size={28} strokeWidth={2.5} className="md:w-8 md:h-8" />
        </button>
      )}

      {topBarMode === 'delete' && (
        <div className="mobile-fab-glass fixed md:bottom-8 right-6 md:right-8 flex items-center gap-3 z-50 p-2 md:p-0 bg-[var(--dash-bg)]/70 md:bg-transparent border-2 border-[var(--glass-border)] md:border-none shadow-[0_8px_32px_rgba(0,0,0,0.5)] shadow-black/50 md:shadow-none rounded-[32px] md:rounded-none">
          {isOwner && (
            <button 
              onClick={() => {
                if (selectedProducts.length === products.length) {
                  setSelectedProducts([]);
                } else {
                  setSelectedProducts(products.map(p => p.id));
                }
              }}
              className="px-6 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors font-bold text-sm"
            >
              {selectedProducts.length === products.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          {selectedProducts.length > 0 && (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="px-6 h-12 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors font-bold text-sm"
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-[var(--dash-bg)]/80 flex items-center justify-center p-4">
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-white mb-2">Delete Products</h3>
            <p className="text-gray-400 mb-6">Are you sure you want to delete {selectedProducts.length} products? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-[var(--dash-border)] text-white font-medium hover:bg-[var(--dash-border)] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteSelected}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {topBarMode === 'visibility' && Object.keys(visibilityChanges).length > 0 && (
        <button 
          onClick={handleUpdateVisibility}
          className="mobile-fab-glass fixed md:bottom-8 right-6 md:right-8 px-6 h-[56px] border-2 border-[var(--glass-border)] md:border-none shadow-[0_8px_32px_rgba(0,0,0,0.5)] md:shadow-lg shadow-black/50 md:shadow-none bg-[var(--dash-bg)]/70 md:bg-[#fafafa] text-[#fafafa] md:text-[var(--dash-bg)] rounded-[28px] md:rounded-2xl flex items-center justify-center hover:bg-[var(--dash-border)] md:hover:bg-[#e4e4e7] transition-colors z-[45] font-bold md:backdrop-blur-none"
        >
          Update
        </button>
      )}

      {showZipImport && (
        <ZipImportModal
          onClose={() => setShowZipImport(false)}
          categories={categories}
          suppliers={websiteSettings.suppliers || []}
          existingProducts={products}
          onImportComplete={(newProducts) => {
            setProducts(prev => [...newProducts, ...prev]);
            cloudStore.upsertProducts(newProducts).catch(console.error);
            setShowZipImport(false);
          }}
        />
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          orders={orders}
          products={products}
          perms={perms.order}
          courierSettings={courierSettings}
          websiteSettings={websiteSettings}
          onClose={() => setSelectedOrder(null)}
          onUpdate={(updatedOrder) => {
            const oldOrder = orders.find(o => o.id === updatedOrder.id) || paginatedOrders.find(o => o.id === updatedOrder.id) || selectedOrder;
            if (oldOrder) {
              setProducts(prev => {
                const { updatedProducts, changedProducts, diffItems } = adjustOrderStockDiff(prev, oldOrder, updatedOrder);
                if (changedProducts.length > 0) {
                  cloudStore.upsertProducts(changedProducts).catch(console.error);
                }
                if (diffItems.length > 0) {
                  notifyMasterStockSyncDiff(diffItems, websiteSettings);
                }
                return updatedProducts;
              });
            }
            setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            setPaginatedOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            cloudStore.upsertOrder(updatedOrder, 'standard').catch(console.error);
            setSelectedOrder(updatedOrder);
          }}
          isOwner={isOwner}
          onDelete={(orderId) => {
            if (!isOwner) {
              alert('Permission denied: Only the Owner account can delete orders.');
              return;
            }
            const orderToDel = paginatedOrders.find(o => o.id === orderId) || orders.find(o => o.id === orderId);
            setOrders(orders.filter(o => o.id !== orderId));
            setPaginatedOrders(prev => prev.filter(o => o.id !== orderId));
            if (orderToDel) cloudStore.deleteOrder(orderToDel, 'standard').catch(console.error);
            setSelectedOrder(null);
          }}
        />
      )}

      {settingsView === 'categories' && perms.sections.settings && (
        <CategoriesManager categories={categories} setCategories={setCategories} onClose={handleCloseSettingsView} themePrimary={websiteSettings.themeColors?.primary} />
      )}
      {settingsView === 'imageSettings' && perms.sections.settings && (
        <ImageSettingsManager onClose={handleCloseSettingsView} themePrimary={websiteSettings.themeColors?.primary} />
      )}
      {settingsView === 'seoSettings' && perms.sections.settings && (
        <SeoSettingsManager settings={websiteSettings} setSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'website' && perms.sections.settings && (
        <WebsiteManager settings={websiteSettings} setSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'socialMedia' && perms.sections.settings && (
        <SocialMediaManager websiteSettings={websiteSettings} setWebsiteSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'apiSync' && perms.sections.settings && (
        <ApiSyncManager settings={websiteSettings} setSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'marketing' && perms.sections.settings && (
        <MarketingManager settings={marketingSettings} setSettings={setMarketingSettings} onClose={handleCloseSettingsView} themePrimary={websiteSettings.themeColors?.primary} />
      )}
      {settingsView === 'courier' && perms.sections.settings && (
        <CourierManager settings={courierSettings} setSettings={setCourierSettings} onClose={handleCloseSettingsView} themePrimary={websiteSettings.themeColors?.primary} />
      )}
      {settingsView === 'customers' && perms.sections.settings && perms.sections.customers && isOwner && (
        <CustomersManager orders={orders} setOrders={setOrders} customers={customers} setCustomers={setCustomers} websiteSettings={websiteSettings} setWebsiteSettings={setWebsiteSettings} onClose={handleCloseSettingsView} isOwner={isOwner} />
      )}
      {settingsView === 'incompleteOrders' && perms.sections.settings && (
        <IncompleteOrdersManager 
          orders={orders}
          incompleteOrders={incompleteOrders || []} 
          setIncompleteOrders={setIncompleteOrders}
          websiteSettings={websiteSettings} 
          setWebsiteSettings={setWebsiteSettings}
          setOrders={setOrders}
          onClose={handleCloseSettingsView} 
        />
      )}
      {settingsView === 'antiSpam' && perms.sections.settings && (
        <AntiSpamManager websiteSettings={websiteSettings} setWebsiteSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'minOrder' && perms.sections.settings && (
        <MinOrderManager websiteSettings={websiteSettings} setWebsiteSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'bulkPrice' && perms.sections.settings && (
        <BulkPriceManager 
          products={products}
          setProducts={setProducts}
          categories={categories}
          suppliers={websiteSettings.suppliers || []}
          onClose={handleCloseSettingsView}
        />
      )}
      {settingsView === 'priceCalculator' && perms.sections.settings && (
        <PriceCalculatorManager settings={priceCalculatorSettings} setSettings={setPriceCalculatorSettings} onClose={handleCloseSettingsView} themePrimary={websiteSettings.themeColors?.primary} />
      )}
      {settingsView === 'suppliers' && perms.sections.settings && (
        <SupplierManager settings={websiteSettings} setSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'qtyRules' && perms.sections.settings && (
        <QtyRulesManager settings={websiteSettings} setSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'customise' && perms.sections.settings && (
        <CustomiseManager 
          settings={websiteSettings} 
          setSettings={setWebsiteSettings} 
          onClose={handleCloseSettingsView} 
          products={products}
          categories={categories}
          onDownloadFbZip={() => setSettingsView('fbZipExport')}
        />
      )}
      {settingsView === 'fbZipExport' && perms.sections.settings && (
        <FbZipExportModal 
          products={products}
          categories={categories}
          websiteSettings={websiteSettings}
          themePrimary={websiteSettings.themeColors?.primary}
          onClose={handleCloseSettingsView}
        />
      )}
      {settingsView === 'notification' && perms.sections.settings && (
        <NotificationManager websiteSettings={websiteSettings} setWebsiteSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'accountControl' && perms.sections.settings && (
        <AccountControlManager adminUsers={adminUsers} setAdminUsers={setAdminUsers} currentAdmin={currentAdmin} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'account' && perms.sections.settings && (
        <AccountManager adminUsers={adminUsers} setAdminUsers={setAdminUsers} currentAdmin={currentAdmin} setCurrentAdmin={setCurrentAdmin} websiteSettings={websiteSettings} setWebsiteSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'discounts' && perms.sections.settings && (
        <DiscountManager websiteSettings={websiteSettings} setWebsiteSettings={setWebsiteSettings} products={products} categories={categories} onClose={handleCloseSettingsView} />
      )}
      {settingsView === 'preOrder' && perms.sections.settings && (
        <PreOrderManager websiteSettings={websiteSettings} setWebsiteSettings={setWebsiteSettings} onClose={handleCloseSettingsView} />
      )}
      {activeTab === 'Orders' && selectedOrders.length > 0 && (
        <div className="fixed left-[-9999px] top-0 pointer-events-none z-[-100]">
          {selectedOrders.map(orderId => {
            const order = paginatedOrders.find(o => o.id === orderId) || orders.find(o => o.id === orderId);
            if (!order) return null;
            return (
              <Receipt 
                key={`print-${orderId}`} 
                order={order} 
                settings={websiteSettings} 
                ref={el => { bulkPrintRefs.current[orderId] = el as HTMLDivElement; }} 
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardOverviewCard({ completedSell, completedProfit }: { completedSell: string, completedProfit: string }) {
  return (
    <div className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl py-3.5 px-4 md:p-8 relative overflow-hidden flex flex-col min-h-[110px] md:min-h-[160px] shadow-lg shadow-black/10">
       <div className="flex items-center gap-2 text-slate-100 mb-2.5 md:mb-6 relative z-10">
          <TrendingUp className="w-4.5 h-4.5 md:w-5.5 md:h-5.5 text-indigo-400" />
          <span className="font-semibold text-sm md:text-xl tracking-wide">Overview</span>
       </div>
       
       <div className="grid grid-cols-2 gap-2 md:gap-8 relative z-10 w-full">
          {completedSell && (
            <div className="pr-2 border-r border-[var(--dash-border)]/40">
              <div className="text-slate-400 text-[11px] md:text-base mb-1 font-medium tracking-wide">Completed Sell</div>
              <div className="text-xl md:text-4xl font-extrabold text-white tracking-wide">{completedSell}</div>
            </div>
          )}
          {completedProfit && (
            <div className="pl-2">
              <div className="text-slate-400 text-[11px] md:text-base mb-1 font-medium tracking-wide">Completed profit</div>
              <div className="text-xl md:text-4xl font-extrabold text-white tracking-wide">{completedProfit}</div>
            </div>
          )}
       </div>
    </div>
  );
}

function DashboardStatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: 'green' | 'orange' | 'red' | 'blue' | 'purple' | 'teal' }) {
  const colors = {
    green: {
      border: 'border-l-emerald-500',
      iconBg: 'bg-emerald-500/10',
      iconBorder: 'border border-emerald-500/20',
      iconColor: 'text-emerald-500'
    },
    orange: {
      border: 'border-l-amber-500',
      iconBg: 'bg-amber-500/10',
      iconBorder: 'border border-amber-500/20',
      iconColor: 'text-amber-500'
    },
    red: {
      border: 'border-l-rose-500',
      iconBg: 'bg-rose-500/10',
      iconBorder: 'border border-rose-500/20',
      iconColor: 'text-rose-500'
    },
    blue: {
      border: 'border-l-blue-500',
      iconBg: 'bg-blue-500/10',
      iconBorder: 'border border-blue-500/20',
      iconColor: 'text-blue-500'
    },
    purple: {
      border: 'border-l-purple-500',
      iconBg: 'bg-purple-500/10',
      iconBorder: 'border border-purple-500/20',
      iconColor: 'text-purple-500'
    },
    teal: {
      border: 'border-l-teal-500',
      iconBg: 'bg-teal-500/10',
      iconBorder: 'border border-teal-500/20',
      iconColor: 'text-teal-500'
    }
  };
  
  const c = colors[color] || colors.blue;

  return (
    <div className={`bg-[var(--dash-card)] border-y border-r border-[var(--dash-border)]/70 rounded-2xl ${c.border} border-l-2 py-3 px-2.5 md:p-6 relative overflow-hidden flex items-center gap-2.5 md:gap-5 min-h-[72px] md:min-h-[112px] shadow-sm`}>
      <div className={`p-1.5 md:p-3 rounded-full flex-shrink-0 flex items-center justify-center ${c.iconBg} ${c.iconBorder} ${c.iconColor}`}>
         <Icon className="w-4.5 h-4.5 md:w-6 md:h-6" strokeWidth={2} />
      </div>
      <div className="flex flex-col justify-center min-w-0">
        <div className="text-slate-400 text-[10.5px] md:text-sm font-medium tracking-wide truncate mb-0.5">{title}</div>
        <div className="text-base md:text-2xl font-bold text-white tracking-wide truncate">{value}</div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string, value: string }) {
  return (
    <div className="bg-[var(--dash-card)] p-3 rounded-xl border border-[var(--dash-border)]">
      <div className="text-gray-500 text-xs mb-1">{title}</div>
      <div className="text-[#fafafa] font-bold text-lg">{value}</div>
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "relative flex flex-col items-center justify-center h-full md:h-auto flex-1 md:flex-none gap-1 md:gap-1.5 md:w-full md:py-3 transition-all md:rounded-2xl group cursor-pointer", 
      active 
        ? "text-white md:bg-indigo-600/15 md:border md:border-indigo-500/30 shadow-sm" 
        : "text-gray-500 md:text-slate-400 hover:text-gray-300 md:hover:bg-white/[0.03] md:hover:text-white md:border md:border-transparent"
    )}>
      <div className={cn(
        "transition-all flex items-center justify-center", 
        active 
          ? "text-white md:bg-indigo-600 md:w-10 md:h-7 md:rounded-full shadow-md shadow-indigo-500/25" 
          : "text-gray-400 md:w-10 md:h-7 md:rounded-full group-hover:text-white"
      )}>
         <Icon size={20} className="md:w-[18px] md:h-[18px]" strokeWidth={active ? 2.5 : 2} />
      </div>
      <span className={cn("text-[10px] md:text-[11px] font-medium tracking-tight", active ? "font-bold text-white" : "text-gray-400")}>{label}</span>
    </button>
  );
}

function CategoriesManager({ categories, setCategories, onClose, themePrimary }: { categories: Category[], setCategories: React.Dispatch<React.SetStateAction<Category[]>>, onClose: () => void, themePrimary?: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  const scrollRef = useScrollRestore('dashboard-categories');

  const handleSave = (category: Category) => {
    let updated: Category[];
    if (editingCategory) {
      updated = categories.map(c => c.id === category.id ? category : c);
    } else {
      updated = [...categories, category];
    }
    setCategories(updated);
    cloudStore.saveSetting('categories', updated).catch(console.error);
    setIsEditing(false);
    setEditingCategory(null);
  };

  const handleDelete = (id: string) => {
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    cloudStore.saveSetting('categories', updated).catch(console.error);
    setIsEditing(false);
    setEditingCategory(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Top Bar */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <LayoutGrid size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">Category Management</h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Organize products into intuitive collections and groups</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => { setEditingCategory(null); setIsEditing(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer"
          >
            <Plus size={16} /> Add Category
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 overscroll-y-contain custom-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-4xl mx-auto w-full space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {categories.map(cat => (
              <div 
                key={cat.id} 
                className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-indigo-500/50 transition-all shadow-xl active:scale-95"
                onClick={() => { setEditingCategory(cat); setIsEditing(true); }}
              >
                <div className="w-16 h-16 rounded-2xl bg-[var(--dash-bg)] border border-[var(--dash-border)] flex items-center justify-center overflow-hidden group-hover:border-indigo-500/50 transition-all shadow-inner relative">
                  {cat.icon ? (
                    <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-indigo-400 font-bold text-xl">{cat.name.charAt(0)}</span>
                  )}
                </div>
                <div className="text-center">
                  <span className="text-xs md:text-sm font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">{cat.name}</span>
                </div>
              </div>
            ))}
          </div>

          {categories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-[var(--dash-card)] rounded-2xl border border-dashed border-[var(--dash-border)]">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-3">
                <LayoutGrid size={22} />
              </div>
              <p className="text-white font-bold text-sm">No categories created yet</p>
              <p className="text-xs text-slate-500 mt-1">Click "Add Category" to create your first collection</p>
            </div>
          )}
        </div>
      </div>

      {isEditing && (
        <CategoryEditorModal 
          category={editingCategory}
          onSave={handleSave}
          onClose={() => { setIsEditing(false); setEditingCategory(null); }}
          onDelete={editingCategory ? () => handleDelete(editingCategory.id) : undefined}
          themePrimary={themePrimary}
        />
      )}
    </div>
  );
}

function CategoryEditorModal({ category, onSave, onClose, onDelete, themePrimary }: { category: Category | null, onSave: (c: Category) => void, onClose: () => void, onDelete?: () => void, themePrimary?: string }) {
  const [name, setName] = useState(category ? category.name : '');
  const [icon, setIcon] = useState(category ? category.icon || '' : '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: category ? category.id : Date.now().toString(),
      name: name.trim(),
      icon: icon.trim() || undefined
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      cloudStore.uploadFile(file, `category_${Date.now()}_${file.name}`)
        .then(url => {
          setIcon(url);
        })
        .catch(() => {
          const reader = new FileReader();
          reader.onload = (event) => {
            setIcon(event.target?.result as string);
          };
          reader.readAsDataURL(file);
        });
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        <div className="p-4 md:p-6 border-b border-[var(--dash-border)]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
              {category ? 'Edit Category' : 'New Category'}
            </h2>
          </div>
          {onDelete && (
            <button 
              onClick={onDelete}
              className="w-10 h-10 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center transition-colors cursor-pointer"
              title="Delete Category"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        <div 
          className="p-4 md:p-6 flex-1 overflow-y-auto space-y-4 max-w-xl mx-auto w-full overscroll-y-contain pb-28"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 block">Category Title *</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Traditional Jewelry"
                className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl px-3.5 py-3 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <div className="text-[11px] text-slate-500 mt-1.5 font-mono truncate">
                https://paikarix.com/c/{name.toLowerCase().replace(/\s+/g, '-')}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 block">Icon / Thumbnail</label>
              <div className="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-4 flex items-center justify-start gap-4">
                {icon ? (
                  <div className="relative inline-block">
                    <img src={icon} alt="Preview" className="w-20 h-20 object-cover rounded-xl bg-white/5 border border-[var(--dash-border)]" />
                    <button 
                      onClick={() => setIcon('')}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-md cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-[var(--dash-border)] hover:border-indigo-500 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <ImageIcon size={20} className="mb-1" />
                    <span className="text-[10px] font-bold">Upload</span>
                  </button>
                )}
                <div className="text-xs text-slate-400">
                  <p className="font-semibold text-white">Category Image</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Recommended 400x400 JPG or PNG</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={!name.trim()}
              className="w-full py-3 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25 cursor-pointer"
            >
              {category ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebsiteManager({ settings, setSettings, onClose }: { settings: WebsiteSettings, setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>, onClose: () => void }) {
  const [draftSettings, setDraftSettings] = useState<WebsiteSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setSettings(draftSettings);
      await cloudStore.saveSetting('websiteSettings', draftSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetRatio = 16 / 5;
        let width = img.width;
        let height = img.height;
        const currentRatio = width / height;

        if (currentRatio > targetRatio) {
          width = height * targetRatio;
        } else {
          height = width / targetRatio;
        }

        if (width > 1600) {
          width = 1600;
          height = 1600 / targetRatio;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const srcX = (img.width - width) / 2;
        const srcY = (img.height - height) / 2;
        
        ctx?.drawImage(img, srcX, srcY, width, height, 0, 0, width, height);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const url = await cloudStore.uploadFile(blob, `banner_${Date.now()}.jpg`);
              setDraftSettings(prev => ({ ...prev, banners: [...(prev.banners || []), url] }));
            } catch (e) {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
              setDraftSettings(prev => ({ ...prev, banners: [...(prev.banners || []), dataUrl] }));
            }
          }
        }, 'image/jpeg', 0.8);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const removeBanner = (index: number) => {
    setDraftSettings(prev => ({
      ...prev,
      banners: (prev.banners || []).filter((_, i) => i !== index)
    }));
  };

  const addDeliveryCharge = () => {
    setDraftSettings(prev => ({
      ...prev,
      deliveryCharges: [...(prev.deliveryCharges || []), { id: Date.now().toString(), area: '', price: 0, time: '' }]
    }));
  };

  const updateDeliveryCharge = (id: string, field: keyof DeliveryCharge, value: string | number) => {
    setDraftSettings(prev => ({
      ...prev,
      deliveryCharges: (prev.deliveryCharges || []).map(dc => dc.id === id ? { ...dc, [field]: value } : dc)
    }));
  };

  const removeDeliveryCharge = (id: string) => {
    setDraftSettings(prev => ({
      ...prev,
      deliveryCharges: (prev.deliveryCharges || []).filter(dc => dc.id !== id)
    }));
  };

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Top Bar */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Globe size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">Storefront & Layout</h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Customize banners, branding, stock sections, and delivery fees</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {saved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-4 max-w-4xl mx-auto w-full overscroll-y-contain custom-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Banner Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Hero Promotional Banners</h2>
              <p className="text-xs text-slate-400">High-converting carousel slides displayed on the homepage (16:5 ratio).</p>
            </div>
            <button 
              onClick={() => setDraftSettings(prev => ({ ...prev, bannerEnabled: !prev.bannerEnabled }))}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                draftSettings.bannerEnabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
            >
              <div
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  draftSettings.bannerEnabled ? "translate-x-5.5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {draftSettings.bannerEnabled && (
            <div className="space-y-4 pt-2 border-t border-[var(--dash-border)]/40 animate-in fade-in duration-200">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(draftSettings.banners || []).map((banner, idx) => (
                  <div key={idx} className="relative aspect-[16/5] rounded-xl overflow-hidden border border-[var(--dash-border)] group shadow-inner">
                    <img src={banner} alt={`Banner ${idx}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removeBanner(idx)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-md z-10 opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div 
                className={cn(
                  "border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center transition-colors cursor-pointer",
                  isDragging ? "border-indigo-400 bg-indigo-500/10 text-indigo-300" : "border-[var(--dash-border)] text-slate-400 hover:text-white hover:border-indigo-500/50"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <ImageIcon size={28} className="mb-1 text-indigo-400" />
                <span className="text-xs font-bold text-white">Click or drag banner here to upload</span>
                <span className="text-[11px] text-slate-500 mt-0.5">Recommended 1600x500 JPG/PNG</span>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleImageUpload}
              />
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Banner Corner Radius</label>
                  <input 
                    type="text"
                    value={draftSettings.bannerBorderRadius || '16px'}
                    onChange={(e) => setDraftSettings(prev => ({ ...prev, bannerBorderRadius: e.target.value }))}
                    placeholder="e.g. 16px, 1rem"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logo Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Header Store Logo</h2>
            <p className="text-xs text-slate-400">Primary brand identity shown on desktop and mobile navbar.</p>
          </div>
          <div>
            {draftSettings.logoUrl ? (
              <div className="relative w-48 h-16 rounded-xl overflow-hidden border border-[var(--dash-border)] bg-white/5 flex items-center justify-center p-2">
                <img src={draftSettings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                <button 
                  onClick={() => setDraftSettings(prev => ({ ...prev, logoUrl: undefined }))}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-md z-10 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div 
                className="border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center transition-colors cursor-pointer border-[var(--dash-border)] text-slate-400 hover:text-white hover:border-indigo-500/50"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/png, image/jpeg, image/svg+xml';
                  input.onchange = (e: any) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const file = e.target.files[0];
                      cloudStore.uploadFile(file, `logo_${Date.now()}_${file.name}`)
                        .then(url => {
                          setDraftSettings(prev => ({ ...prev, logoUrl: url }));
                        })
                        .catch(() => {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setDraftSettings(prev => ({ ...prev, logoUrl: event.target?.result as string }));
                          };
                          reader.readAsDataURL(file);
                        });
                    }
                  };
                  input.click();
                }}
              >
                <ImageIcon size={24} className="mb-1 text-indigo-400" />
                <span className="text-xs font-bold text-white">Click to upload store logo</span>
                <span className="text-[10px] text-slate-500 mt-0.5">PNG, SVG transparent background recommended</span>
              </div>
            )}
          </div>
        </div>

        {/* Stock Out Control */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Stock Out Section</h2>
              <p className="text-xs text-slate-400">Control who can browse out-of-stock and historical catalog items.</p>
            </div>
            <button 
              onClick={() => setDraftSettings(prev => ({ 
                ...prev, 
                stockOutFeature: { 
                  enabled: !prev.stockOutFeature?.enabled, 
                  minOrdersRequired: prev.stockOutFeature?.minOrdersRequired || 0 
                } 
              }))}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                draftSettings.stockOutFeature?.enabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
            >
              <div
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  draftSettings.stockOutFeature?.enabled ? "translate-x-5.5" : "translate-x-0"
                )}
              />
            </button>
          </div>
          
          {draftSettings.stockOutFeature?.enabled && (
            <div className="pt-2 border-t border-[var(--dash-border)]/40">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Minimum Completed Orders Required</label>
              <input 
                type="number"
                value={draftSettings.stockOutFeature?.minOrdersRequired || 0}
                onChange={(e) => setDraftSettings(prev => ({
                  ...prev,
                  stockOutFeature: {
                    enabled: prev.stockOutFeature?.enabled ?? true,
                    minOrdersRequired: parseInt(e.target.value) || 0
                  }
                }))}
                min="0"
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-bold"
              />
              <p className="text-[11px] text-slate-500 mt-1">Set to 0 to let all visitors view stock-out items.</p>
            </div>
          )}
        </div>

        {/* Smart Product Display */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Smart Product Display</h2>
              <p className="text-xs text-slate-400">Order products automatically: Top Selling ➔ New Arrival ➔ Lowest Selling</p>
            </div>
            <button 
              onClick={() => setDraftSettings(prev => ({ ...prev, smartProductDisplay: !prev.smartProductDisplay }))}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                draftSettings.smartProductDisplay ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
            >
              <div
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  draftSettings.smartProductDisplay ? "translate-x-5.5" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="pt-3 border-t border-[var(--dash-border)]/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Product Image Hover Effect</h2>
                <p className="text-xs text-slate-400">Show secondary image on desktop mouse hover</p>
              </div>
              <button 
                onClick={() => setDraftSettings(prev => ({ ...prev, productImageHover: !prev.productImageHover }))}
                className={cn(
                  "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                  draftSettings.productImageHover ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
                )}
              >
                <div
                  className={cn(
                    "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                    draftSettings.productImageHover ? "translate-x-5.5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Receipt Settings Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Receipt & Invoice Branding</h2>
            <p className="text-xs text-slate-400">Phone hotline and QR codes printed on thermal and PDF invoices.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Customer Service Hotline</label>
              <input
                type="text"
                value={draftSettings.shopPhone || ''}
                onChange={(e) => setDraftSettings(prev => ({ ...prev, shopPhone: e.target.value }))}
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                placeholder="09658133593"
              />
            </div>
            
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Receipt QR Code</label>
              {draftSettings.receiptQrCodeUrl ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--dash-border)] bg-white flex items-center justify-center">
                  <img src={draftSettings.receiptQrCodeUrl} alt="QR Code" className="max-w-full max-h-full object-contain" />
                  <button 
                    onClick={() => setDraftSettings(prev => ({ ...prev, receiptQrCodeUrl: undefined }))}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 shadow-md cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <button 
                  className="border-2 border-dashed w-full h-16 rounded-xl p-2 flex items-center justify-center gap-2 border-[var(--dash-border)] text-slate-400 hover:text-white hover:border-indigo-500/50 cursor-pointer"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/png, image/jpeg, image/svg+xml';
                    input.onchange = (e: any) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const file = e.target.files[0];
                        cloudStore.uploadFile(file, `qr_${Date.now()}_${file.name}`)
                          .then(url => {
                            setDraftSettings(prev => ({ ...prev, receiptQrCodeUrl: url }));
                          })
                          .catch(() => {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setDraftSettings(prev => ({ ...prev, receiptQrCodeUrl: event.target?.result as string }));
                            };
                            reader.readAsDataURL(file);
                          });
                      }
                    };
                    input.click();
                  }}
                >
                  <ImageIcon size={18} className="text-indigo-400" />
                  <span className="text-xs font-bold">Upload QR Image</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Charge Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Delivery Charges & Zones</h2>
              <p className="text-xs text-slate-400">Shipping rates calculated at checkout by customer area.</p>
            </div>
            <button 
              onClick={addDeliveryCharge}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all cursor-pointer"
            >
              <Plus size={14} /> Add Zone
            </button>
          </div>

          <div className="space-y-3">
            {(draftSettings.deliveryCharges || []).map(dc => (
              <div key={dc.id} className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                <input 
                  type="text" 
                  value={dc.area}
                  onChange={(e) => updateDeliveryCharge(dc.id, 'area', e.target.value)}
                  placeholder="Zone / Area Name (e.g. Inside Dhaka)"
                  className="flex-1 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
                <div className="flex gap-2 items-center">
                  <div className="relative w-24">
                    <input 
                      type="number" 
                      value={dc.price || ''}
                      onChange={(e) => updateDeliveryCharge(dc.id, 'price', Math.floor(Number(e.target.value)))}
                      placeholder="Price"
                      className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg pl-3 pr-6 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-bold">৳</span>
                  </div>
                  <input 
                    type="text" 
                    value={dc.time}
                    onChange={(e) => updateDeliveryCharge(dc.id, 'time', e.target.value)}
                    placeholder="Est. Time (e.g. 1-2 Days)"
                    className="w-28 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button 
                    onClick={() => removeDeliveryCharge(dc.id)}
                    className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketingManager({ settings, setSettings, onClose, themePrimary }: { settings: MarketingSettings, setSettings: React.Dispatch<React.SetStateAction<MarketingSettings>>, onClose: () => void, themePrimary?: string }) {
  const [draftSettings, setDraftSettings] = useState<MarketingSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showMetaToken, setShowMetaToken] = useState(false);
  const [showTikTokToken, setShowTikTokToken] = useState(false);
  const [showGA4Secret, setShowGA4Secret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setSettings(draftSettings);
      await cloudStore.saveSetting('marketingSettings', draftSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const updateMetaPixel = (field: keyof MarketingSettings['metaPixel'], value: string | boolean) => {
    setDraftSettings(prev => ({
      ...prev,
      metaPixel: {
        ...prev.metaPixel,
        [field]: value
      }
    }));
  };

  const updateTikTokPixel = (field: keyof MarketingSettings['tiktokPixel'], value: string | boolean) => {
    setDraftSettings(prev => ({
      ...prev,
      tiktokPixel: {
        ...prev.tiktokPixel,
        [field]: value
      }
    }));
  };

  const updateGA4 = (field: keyof GA4Settings, value: string | boolean) => {
    setDraftSettings(prev => ({
      ...prev,
      ga4: {
        ...prev.ga4,
        enabled: prev.ga4?.enabled ?? false,
        measurementId: prev.ga4?.measurementId ?? '',
        apiSecret: prev.ga4?.apiSecret ?? '',
        [field]: value
      }
    }));
  };

  const updatePixelBatch = (field: keyof PixelBatchSettings, value: boolean | number) => {
    setDraftSettings(prev => ({
      ...prev,
      pixelBatch: {
        enabled: prev.pixelBatch?.enabled ?? true,
        intervalSeconds: prev.pixelBatch?.intervalSeconds ?? 35,
        [field]: value
      }
    }));
  };

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Top Bar */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer" 
              id="marketing_back_btn"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <BarChart2 size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">Marketing & Pixel Tracking</h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Meta Pixel, TikTok Pixel & Google Analytics 4 Conversions API</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {saved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-4 max-w-4xl mx-auto w-full overscroll-y-contain custom-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Meta Pixel Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4" id="meta_pixel_card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0064e0]/10 border border-[#0064e0]/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#0064e0]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.417 6c-1.897 0-3.398 1.054-4.417 2.378-1.02-1.324-2.52-2.378-4.417-2.378C4.545 6 2 8.442 2 11.455c0 3.013 2.545 5.455 5.583 5.455 1.897 0 3.398-1.054 4.417-2.378 1.02 1.324 2.52 2.378 4.417 2.378C19.455 16.91 22 14.468 22 11.455 22 8.442 19.455 6 16.417 6zm-8.834 9.1c-1.928 0-3.5-1.572-3.5-3.5s1.572-3.5 3.5-3.5c1.173 0 2.215.582 2.854 1.48C9.563 11.104 8.52 12.87 7.583 15.1zm8.834 0c-.937-2.23-1.98-3.996-2.854-5.52.64-.898 1.68-1.48 2.854-1.48 1.928 0 3.5 1.572 3.5 3.5s-1.572 3.5-3.5 3.5z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Meta (Facebook) Pixel & CAPI</h2>
                <p className="text-xs text-slate-400">Track browser events and server-side Conversions API.</p>
              </div>
            </div>
            
            <button 
              onClick={() => updateMetaPixel('enabled', !draftSettings.metaPixel.enabled)}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                draftSettings.metaPixel.enabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
              id="meta_pixel_toggle"
            >
              <div 
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  draftSettings.metaPixel.enabled ? "translate-x-5.5" : "translate-x-0"
                )} 
              />
            </button>
          </div>

          {draftSettings.metaPixel.enabled && (
            <div className="space-y-3.5 pt-2 border-t border-[var(--dash-border)]/40 animate-in fade-in duration-200">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Pixel ID *</label>
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    value={draftSettings.metaPixel.pixelId}
                    onChange={(e) => updateMetaPixel('pixelId', e.target.value)}
                    placeholder="e.g. 182938472918"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button 
                    type="button"
                    onClick={() => handleCopy(draftSettings.metaPixel.pixelId, 'meta_pixelId')}
                    className="absolute right-2 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center text-xs cursor-pointer"
                    title="Copy Pixel ID"
                    id="meta_pixel_id_copy"
                  >
                    {copiedField === 'meta_pixelId' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Conversions API Access Token</label>
                  <div className="relative flex items-center">
                    <input 
                      type={showMetaToken ? "text" : "password"}
                      value={draftSettings.metaPixel.accessToken}
                      onChange={(e) => updateMetaPixel('accessToken', e.target.value)}
                      placeholder="EAA..."
                      className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 pr-16 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={() => setShowMetaToken(!showMetaToken)}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {showMetaToken ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleCopy(draftSettings.metaPixel.accessToken, 'meta_accessToken')}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedField === 'meta_accessToken' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Test Event Code (Optional)</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      value={draftSettings.metaPixel.testCode}
                      onChange={(e) => updateMetaPixel('testCode', e.target.value)}
                      placeholder="TEST49835"
                      className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button 
                      type="button"
                      onClick={() => handleCopy(draftSettings.metaPixel.testCode, 'meta_testCode')}
                      className="absolute right-2 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center text-xs cursor-pointer"
                    >
                      {copiedField === 'meta_testCode' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TikTok Pixel Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4" id="tiktok_pixel_card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.61 4.18.92 1.09 2.22 1.83 3.58 2.13l-.01 3.69c-1.32-.01-2.61-.35-3.74-1.05-.72-.45-1.34-1.05-1.81-1.76l-.04 6.8c.02 1.93-.54 3.86-1.63 5.39-1.2 1.7-3.13 2.86-5.21 3.19-2.13.34-4.36-.14-6.07-1.42C1.4 20.01.44 17.78.41 15.4c-.03-2.38.93-4.66 2.63-6.23 1.77-1.62 4.22-2.39 6.55-2.02l-.01 3.7c-1.34-.17-2.73.18-3.76 1.09-.85.76-1.31 1.88-1.26 3.02.04 1.13.59 2.19 1.48 2.88 1.02.79 2.39 1.02 3.58.62.97-.33 1.77-1.11 2.13-2.09.24-.63.31-1.3.29-1.97V.02h.01Z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">TikTok Pixel & Events API</h2>
                <p className="text-xs text-slate-400">Measure video ad campaign conversions and ROI.</p>
              </div>
            </div>
            
            <button 
              onClick={() => updateTikTokPixel('enabled', !draftSettings.tiktokPixel?.enabled)}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                draftSettings.tiktokPixel?.enabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
              id="tiktok_pixel_toggle"
            >
              <div 
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  draftSettings.tiktokPixel?.enabled ? "translate-x-5.5" : "translate-x-0"
                )} 
              />
            </button>
          </div>

          {draftSettings.tiktokPixel?.enabled && (
            <div className="space-y-3.5 pt-2 border-t border-[var(--dash-border)]/40 animate-in fade-in duration-200">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Pixel ID *</label>
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    value={draftSettings.tiktokPixel?.pixelId || ''}
                    onChange={(e) => updateTikTokPixel('pixelId', e.target.value)}
                    placeholder="Enter TikTok Pixel ID"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button 
                    type="button"
                    onClick={() => handleCopy(draftSettings.tiktokPixel?.pixelId || '', 'tiktok_pixelId')}
                    className="absolute right-2 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center text-xs cursor-pointer"
                    title="Copy Pixel ID"
                  >
                    {copiedField === 'tiktok_pixelId' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Events API Access Token</label>
                  <div className="relative flex items-center">
                    <input 
                      type={showTikTokToken ? "text" : "password"}
                      value={draftSettings.tiktokPixel?.accessToken || ''}
                      onChange={(e) => updateTikTokPixel('accessToken', e.target.value)}
                      placeholder="Access token"
                      className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 pr-16 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      <button 
                        type="button"
                        onClick={() => setShowTikTokToken(!showTikTokToken)}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {showTikTokToken ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleCopy(draftSettings.tiktokPixel?.accessToken || '', 'tiktok_accessToken')}
                        className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedField === 'tiktok_accessToken' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Test Event Code (Optional)</label>
                  <div className="relative flex items-center">
                    <input 
                      type="text" 
                      value={draftSettings.tiktokPixel?.testCode || ''}
                      onChange={(e) => updateTikTokPixel('testCode', e.target.value)}
                      placeholder="TEST83864"
                      className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button 
                      type="button"
                      onClick={() => handleCopy(draftSettings.tiktokPixel?.testCode || '', 'tiktok_testCode')}
                      className="absolute right-2 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center text-xs cursor-pointer"
                    >
                      {copiedField === 'tiktok_testCode' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Google Analytics 4 Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4" id="ga4_pixel_card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="13" width="3.5" height="6" rx="1" fill="#F9AB00" />
                  <rect x="10.25" y="9" width="3.5" height="10" rx="1" fill="#F25C05" />
                  <rect x="15.5" y="5" width="3.5" height="14" rx="1" fill="#D9381E" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Google Analytics 4 (GA4)</h2>
                <p className="text-xs text-slate-400">Track web engagement, traffic origins, and user retention.</p>
              </div>
            </div>
            
            <button 
              onClick={() => updateGA4('enabled', !draftSettings.ga4?.enabled)}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                draftSettings.ga4?.enabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
              id="ga4_toggle"
            >
              <div 
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  draftSettings.ga4?.enabled ? "translate-x-5.5" : "translate-x-0"
                )} 
              />
            </button>
          </div>

          {draftSettings.ga4?.enabled && (
            <div className="space-y-3.5 pt-2 border-t border-[var(--dash-border)]/40 animate-in fade-in duration-200">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Measurement ID (G-XXXXXXXXXX) *</label>
                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    value={draftSettings.ga4?.measurementId || ''}
                    onChange={(e) => updateGA4('measurementId', e.target.value)}
                    placeholder="G-XXXXXX"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button 
                    type="button"
                    onClick={() => handleCopy(draftSettings.ga4?.measurementId || '', 'ga4_measurementId')}
                    className="absolute right-2 px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors flex items-center justify-center text-xs cursor-pointer"
                    title="Copy Measurement ID"
                  >
                    {copiedField === 'ga4_measurementId' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Measurement Protocol API Secret (Optional)</label>
                <div className="relative flex items-center">
                  <input 
                    type={showGA4Secret ? "text" : "password"}
                    value={draftSettings.ga4?.apiSecret || ''}
                    onChange={(e) => updateGA4('apiSecret', e.target.value)}
                    placeholder="API Secret for server-side purchase tracking"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 pr-16 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => setShowGA4Secret(!showGA4Secret)}
                      className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showGA4Secret ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button 
                      type="button"
                      onClick={() => handleCopy(draftSettings.ga4?.apiSecret || '', 'ga4_apiSecret')}
                      className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedField === 'ga4_apiSecret' ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pixel Event Batching Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4" id="pixel_batching_card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Pixel Event Batching</h2>
                <p className="text-xs text-slate-400">Collect and group pixel events to send them together in a single Cloudflare request.</p>
              </div>
            </div>
            
            <button 
              type="button"
              onClick={() => updatePixelBatch('enabled', !(draftSettings.pixelBatch?.enabled ?? true))}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                (draftSettings.pixelBatch?.enabled ?? true) ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
              id="pixel_batching_toggle"
              title="Toggle Pixel Batching"
            >
              <div 
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  (draftSettings.pixelBatch?.enabled ?? true) ? "translate-x-5.5" : "translate-x-0"
                )} 
              />
            </button>
          </div>

          {(draftSettings.pixelBatch?.enabled ?? true) && (
            <div className="space-y-3.5 pt-2 border-t border-[var(--dash-border)]/40 animate-in fade-in duration-200">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Batching Interval (Seconds) *</label>
                <div className="relative flex items-center">
                  <input 
                    type="number" 
                    min="1"
                    max="300"
                    value={draftSettings.pixelBatch?.intervalSeconds ?? 35}
                    onChange={(e) => updatePixelBatch('intervalSeconds', Math.max(1, parseInt(e.target.value) || 1))}
                    placeholder="e.g. 35"
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                  <span className="absolute right-4 text-xs font-semibold text-slate-400 pointer-events-none">Seconds</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  Sets the timer for how many seconds later this pixel batch will send all events together. Events automatically flush instantly on checkout, purchase, or tab close.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CourierManager({ settings, setSettings, onClose, themePrimary }: { settings: CourierSettings, setSettings: React.Dispatch<React.SetStateAction<CourierSettings>>, onClose: () => void, themePrimary?: string }) {
  const [draftSettings, setDraftSettings] = useState<CourierSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSteadfastApi, setShowSteadfastApi] = useState(false);
  const [showSteadfastSecret, setShowSteadfastSecret] = useState(false);
  const [showBdCourierApi, setShowBdCourierApi] = useState<Record<string, boolean>>({});

  const handleSave = async () => {
    setIsSaving(true);
    try {
      setSettings(draftSettings);
      await cloudStore.saveSetting('courierSettings', draftSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleBdCourierApiVisibility = (id: string) => {
    setShowBdCourierApi(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const updateSteadfast = (field: keyof CourierSettings['steadfast'], value: string) => {
    setDraftSettings(prev => ({
      ...prev,
      steadfast: {
        ...prev.steadfast,
        [field]: value
      }
    }));
  };

  const addBdCourierApi = () => {
    setDraftSettings(prev => ({
      ...prev,
      bdCourierApis: [
        ...(prev.bdCourierApis || []),
        { id: Date.now().toString(), name: '', apiKey: '', enabled: true }
      ]
    }));
  };

  const updateBdCourierApi = (id: string, field: keyof typeof settings.bdCourierApis[0], value: any) => {
    setDraftSettings(prev => ({
      ...prev,
      bdCourierApis: (prev.bdCourierApis || []).map(api => 
        api.id === id ? { ...api, [field]: value } : api
      )
    }));
  };

  const removeBdCourierApi = (id: string) => {
    setDraftSettings(prev => ({
      ...prev,
      bdCourierApis: (prev.bdCourierApis || []).filter(api => api.id !== id)
    }));
    setShowBdCourierApi(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
    });
  };

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Header */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Truck size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">Courier & Delivery Integration</h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Automated parcel dispatch & fraud screening APIs</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {saved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-4 max-w-4xl mx-auto w-full overscroll-y-contain custom-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Steadfast Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Truck size={20} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Steadfast Courier API</h2>
                <p className="text-xs text-slate-400">One-click parcel booking and consignment label generation.</p>
              </div>
            </div>
            <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">Active</span>
          </div>

          <div className="space-y-3.5 pt-2 border-t border-[var(--dash-border)]/40">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">API Key *</label>
              <div className="relative flex items-center">
                <input 
                  type={showSteadfastApi ? "text" : "password"}
                  value={draftSettings.steadfast.apiKey}
                  onChange={(e) => updateSteadfast('apiKey', e.target.value)}
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 pr-20 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="Enter Steadfast API Key"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button onClick={() => setShowSteadfastApi(!showSteadfastApi)} className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer">
                    {showSteadfastApi ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(draftSettings.steadfast.apiKey)} className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
            
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Secret Key *</label>
              <div className="relative flex items-center">
                <input 
                  type={showSteadfastSecret ? "text" : "password"}
                  value={draftSettings.steadfast.secretKey}
                  onChange={(e) => updateSteadfast('secretKey', e.target.value)}
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 pr-20 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="Enter Steadfast Secret Key"
                />
                <div className="absolute right-2 flex items-center gap-1">
                  <button onClick={() => setShowSteadfastSecret(!showSteadfastSecret)} className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer">
                    {showSteadfastSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => navigator.clipboard.writeText(draftSettings.steadfast.secretKey)} className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BD COURIER API Section */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">BD Courier Fraud Screening API</h2>
                <p className="text-xs text-slate-400">Check customer delivery success rate before shipping.</p>
              </div>
            </div>
            <button 
              onClick={addBdCourierApi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all cursor-pointer"
            >
              <Plus size={14} /> Add API Key
            </button>
          </div>

          <div className="space-y-3.5 pt-2 border-t border-[var(--dash-border)]/40">
            {(!draftSettings.bdCourierApis || draftSettings.bdCourierApis.length === 0) ? (
              <div className="text-center py-8 text-slate-500 text-xs bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] border-dashed">
                No BD Courier APIs configured. Click "Add API Key" to enable customer fraud checking.
              </div>
            ) : (
              draftSettings.bdCourierApis.map((api, index) => (
                <div key={api.id} className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase border border-indigo-500/20">API #{index + 1}</span>
                      <input 
                        type="text" 
                        value={api.name || ''}
                        onChange={(e) => updateBdCourierApi(api.id, 'name', e.target.value)}
                        placeholder="Label / Key Note (Optional)"
                        className="bg-transparent text-xs text-slate-300 focus:outline-none border-b border-transparent focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateBdCourierApi(api.id, 'enabled', !api.enabled)}
                        className={cn(
                          "w-10 h-5.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                          api.enabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
                        )}
                      >
                        <div
                          className={cn(
                            "w-4.5 h-4.5 rounded-full bg-white transition-all duration-300 shadow-md",
                            api.enabled ? "translate-x-4.5" : "translate-x-0"
                          )}
                        />
                      </button>
                      <button 
                        onClick={() => removeBdCourierApi(api.id)}
                        className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="relative flex items-center">
                    <input 
                      type={showBdCourierApi[api.id] ? "text" : "password"}
                      value={api.apiKey}
                      onChange={(e) => updateBdCourierApi(api.id, 'apiKey', e.target.value)}
                      className="w-full bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2 pr-20 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                      placeholder="Paste BD Courier API Key"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      <button onClick={() => toggleBdCourierApiVisibility(api.id)} className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer">
                        {showBdCourierApi[api.id] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button onClick={() => navigator.clipboard.writeText(api.apiKey)} className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer">
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PriceCalculatorManager({ settings, setSettings, onClose, themePrimary }: { settings: PriceCalculatorSettings, setSettings: React.Dispatch<React.SetStateAction<PriceCalculatorSettings>>, onClose: () => void, themePrimary?: string }) {
  const [yuanRate, setYuanRate] = useState(settings.yuanRate.toString());
  const [additionalCost, setAdditionalCost] = useState(settings.additionalCost.toString());
  const [profit, setProfit] = useState(settings.profit.toString());
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = {
        yuanRate: Number(yuanRate) || 0,
        additionalCost: Number(additionalCost) || 0,
        profit: Number(profit) || 0
      };
      setSettings(updated);
      await cloudStore.saveSetting('priceCalculatorSettings', updated);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 600);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Header */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Calculator size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">Import Price Calculator</h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Automate CNY to BDT landed cost and wholesale margin</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {saved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-4 max-w-2xl mx-auto w-full overscroll-y-contain custom-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Yuan (CNY) Exchange Rate (৳) *</label>
            <input 
              type="number" 
              value={yuanRate}
              onChange={(e) => setYuanRate(e.target.value)}
              className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-bold"
            />
            <p className="text-[11px] text-slate-500 mt-1">Exchange rate applied to Chinese supplier factory prices.</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Shipping & Landed Surcharge per Unit (৳) *</label>
            <input 
              type="number" 
              value={additionalCost}
              onChange={(e) => setAdditionalCost(e.target.value)}
              className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-bold"
            />
            <p className="text-[11px] text-slate-500 mt-1">Freight, customs, and port clearance handling cost per piece.</p>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Target Wholesale Profit Margin (৳) *</label>
            <input 
              type="number" 
              value={profit}
              onChange={(e) => setProfit(e.target.value)}
              className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-bold"
            />
            <p className="text-[11px] text-slate-500 mt-1">Default target markup automatically added to suggested selling price.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminAuth({ adminUsers, setAdminUsers, setCurrentAdmin }: { adminUsers: AdminUser[], setAdminUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>, setCurrentAdmin: (user: AdminUser) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isLogin) {
      const trimmedEmail = email.trim();
      const res = await cloudStore.loginAdmin(trimmedEmail, password);
      if (res.success && res.user) {
        if (res.user.isBlocked) {
          setError('Account has been blocked by admin.');
        } else if (res.user.isApproved) {
          setCurrentAdmin({ ...res.user, loginTimestamp: Date.now() });
        } else {
          setError('Account pending approval from admin.');
        }
      } else {
        setError(res.error || 'Invalid email or password.');
      }
    } else {
      if (password.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      const trimmedEmail = email.trim();
      if (adminUsers.some(u => u.email.trim() === trimmedEmail)) {
        setError('Email already exists.');
        return;
      }

      const res = await cloudStore.registerAdmin(trimmedEmail, password);
      if (res.success && res.user) {
        setAdminUsers([...adminUsers, res.user]);
        setIsLogin(true);
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setError('Registration successful. Please wait for admin approval.');
      } else {
        setError(res.error || 'Registration failed');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-[var(--dash-bg)] z-[200] flex flex-col font-sans">
      <div className="flex items-center justify-between p-4 bg-[var(--dash-bg)]">
        <div className="flex items-center gap-2 text-white">
          <Check size={20} className="text-[#fafafa]" />
          <h1 className="text-lg font-medium">Admin {isLogin ? 'login' : 'registration'} | Nahl Shop</h1>
        </div>
        <button className="p-2 text-white">
          <RefreshCw size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#ff4d6d] mb-1.5">E-Mail *</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-3 text-white focus:outline-none focus:border-[#fafafa] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#ff4d6d] mb-1.5">Password *</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-3 text-white focus:outline-none focus:border-[#fafafa] transition-colors"
              />
            </div>
            
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-[#ff4d6d] mb-1.5">Confirm Password *</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-3 text-white focus:outline-none focus:border-[#fafafa] transition-colors"
                />
              </div>
            )}

            {error && (
              <div className={cn("text-sm text-center", error.includes('successful') ? "text-[#fafafa]" : "text-[#ff4d6d]")}>
                {error}
              </div>
            )}

            <button 
              type="submit"
              className="w-full py-3 rounded-lg font-medium text-lg bg-[#fafafa] text-[var(--dash-bg)] hover:bg-[#e4e4e7] transition-colors"
            >
              {isLogin ? 'Login' : 'Register'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setEmail('');
                setPassword('');
                setConfirmPassword('');
              }}
              className="text-gray-400 hover:text-white underline underline-offset-4"
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountManager({ adminUsers, setAdminUsers, currentAdmin, setCurrentAdmin, websiteSettings, setWebsiteSettings, onClose }: { adminUsers: AdminUser[], setAdminUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>, currentAdmin: AdminUser, setCurrentAdmin: (user: AdminUser | null) => void, websiteSettings: WebsiteSettings, setWebsiteSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>, onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

  const [newEmail, setNewEmail] = useState('');
  const [emailMsg, setEmailMsg] = useState({ type: '', text: '' });

  const [autoLogoutDays, setAutoLogoutDays] = useState(websiteSettings.autoLogoutDays?.toString() || '7');
  const [logoutMsg, setLogoutMsg] = useState({ type: '', text: '' });

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    password: false,
    email: false,
    autoLogout: true
  });
  const [userTab, setUserTab] = useState<'pending' | 'active' | 'blocked'>('pending');

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleLogout = () => {
    setCurrentAdmin(null);
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsers.some(u => u.email === newEmail && u.id !== currentAdmin.id)) {
      setEmailMsg({ type: 'error', text: 'Email already in use.' });
      return;
    }
    const updatedUsers = adminUsers.map(u => 
      u.id === currentAdmin.id ? { ...u, email: newEmail } : u
    );
    setAdminUsers(updatedUsers);
    setCurrentAdmin({ ...currentAdmin, email: newEmail });
    await cloudStore.saveSetting('adminUsers', updatedUsers);
    setEmailMsg({ type: 'success', text: 'Email updated successfully!' });
    setNewEmail('');
    setTimeout(() => setEmailMsg({ type: '', text: '' }), 3000);
  };

  const handleUpdateLogout = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = parseInt(autoLogoutDays);
    if (isNaN(days) || days < 1) {
      setLogoutMsg({ type: 'error', text: 'Please enter a valid number of days.' });
      return;
    }
    const updated = { ...websiteSettings, autoLogoutDays: days };
    setWebsiteSettings(updated);
    await cloudStore.saveSetting('websiteSettings', updated);
    setLogoutMsg({ type: 'success', text: 'Auto logout time updated!' });
    setTimeout(() => setLogoutMsg({ type: '', text: '' }), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAdmin.passwordHash !== currentPassword) {
      setPwdMsg({ type: 'error', text: 'Incorrect current password.' });
      return;
    }
    if (newPassword.length < 4) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 4 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    const updatedUsers = adminUsers.map(u => 
      u.id === currentAdmin.id ? { ...u, passwordHash: newPassword } : u
    );
    setAdminUsers(updatedUsers);
    setCurrentAdmin({ ...currentAdmin, passwordHash: newPassword });
    await cloudStore.saveSetting('adminUsers', updatedUsers);
    setPwdMsg({ type: 'success', text: 'Password updated successfully!' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPwdMsg({ type: '', text: '' }), 3000);
  };

  const handleApprove = async (id: string) => {
    const updated = adminUsers.map(u => u.id === id ? { ...u, isApproved: true, isBlocked: false } : u);
    setAdminUsers(updated);
    await cloudStore.saveSetting('adminUsers', updated);
  };

  const handleReject = async (id: string) => {
    const updated = adminUsers.filter(u => u.id !== id);
    setAdminUsers(updated);
    await cloudStore.saveSetting('adminUsers', updated);
  };

  const handleBlock = async (id: string) => {
    const updated = adminUsers.map(u => u.id === id ? { ...u, isBlocked: true } : u);
    setAdminUsers(updated);
    await cloudStore.saveSetting('adminUsers', updated);
  };

  const handleUnblock = async (id: string) => {
    const updated = adminUsers.map(u => u.id === id ? { ...u, isBlocked: false } : u);
    setAdminUsers(updated);
    await cloudStore.saveSetting('adminUsers', updated);
  };

  const pendingUsers = adminUsers.filter(u => !u.isApproved && !u.isBlocked);
  const activeUsers = adminUsers.filter(u => u.isApproved && !u.isBlocked && u.id !== currentAdmin.id);
  const blockedUsers = adminUsers.filter(u => u.isBlocked);

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Header */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Shield size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">Account & Team Access</h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Security credentials, team member roles & auto logout</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-4 max-w-4xl mx-auto w-full overscroll-y-contain custom-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Profile Card */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg shadow-inner">
                {currentAdmin.email ? currentAdmin.email[0].toUpperCase() : 'A'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm md:text-base font-bold text-white">{currentAdmin.email}</h2>
                  <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    {currentAdmin.id === 'default-admin' ? 'Owner / Superadmin' : 'Staff Admin'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Signed in on current device</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs md:text-sm font-bold hover:bg-red-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl shadow-xl overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 md:p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
            onClick={() => toggleSection('password')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Lock size={18} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white">Change Admin Password</h2>
                <p className="text-xs text-slate-400">Update your dashboard login password</p>
              </div>
            </div>
            {expandedSections.password ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
          {expandedSections.password && (
            <form onSubmit={handleChangePassword} className="space-y-3.5 p-4 md:p-5 pt-0 border-t border-[var(--dash-border)]/40 mt-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Current Password *</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">New Password *</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Min 4 characters"
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Confirm New Password *</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat new password"
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              
              {pwdMsg.text && (
                <div className={cn("text-xs p-3 rounded-xl font-medium", pwdMsg.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20")}>
                  {pwdMsg.text}
                </div>
              )}

              <button 
                type="submit"
                className="w-full py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-98 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer"
              >
                Update Password
              </button>
            </form>
          )}
        </div>

        {/* Change Email Card */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl shadow-xl overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 md:p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
            onClick={() => toggleSection('email')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Mail size={18} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white">Change Email Address</h2>
                <p className="text-xs text-slate-400">Update account communication email</p>
              </div>
            </div>
            {expandedSections.email ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
          {expandedSections.email && (
            <form onSubmit={handleChangeEmail} className="space-y-3.5 p-4 md:p-5 pt-0 border-t border-[var(--dash-border)]/40 mt-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">New Email Address *</label>
                <input 
                  type="email" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="admin@yourdomain.com"
                  className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              {emailMsg.text && (
                <div className={cn("text-xs p-3 rounded-xl font-medium", emailMsg.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20")}>
                  {emailMsg.text}
                </div>
              )}
              <button 
                type="submit"
                className="w-full py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-98 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer"
              >
                Update Email
              </button>
            </form>
          )}
        </div>

        {/* Auto Logout Card */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl shadow-xl overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 md:p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
            onClick={() => toggleSection('autoLogout')}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Clock size={18} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white">Auto Logout Expiry</h2>
                <p className="text-xs text-slate-400">Security session duration before requiring re-login</p>
              </div>
            </div>
            {expandedSections.autoLogout ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
          {expandedSections.autoLogout && (
            <form onSubmit={handleUpdateLogout} className="space-y-3.5 p-4 md:p-5 pt-0 border-t border-[var(--dash-border)]/40 mt-2">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Session Expiry (Days) *</label>
                  <input 
                    type="number" 
                    min="1"
                    value={autoLogoutDays}
                    onChange={(e) => setAutoLogoutDays(e.target.value)}
                    required
                    className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0"
                >
                  Save
                </button>
              </div>
              {logoutMsg.text && (
                <div className={cn("text-xs p-3 rounded-xl font-medium", logoutMsg.type === 'success' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20")}>
                  {logoutMsg.text}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Admin Management Section */}
        {currentAdmin.id === 'default-admin' && (
          <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Staff & Team Account Permissions</h2>
              <p className="text-xs text-slate-400">Review pending registrations and grant or revoke access.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--dash-border)]/60 pb-3">
              <button
                onClick={() => setUserTab('pending')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  userTab === 'pending' ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "bg-white/5 text-slate-400 hover:text-white"
                )}
              >
                Pending Approvals ({pendingUsers.length})
              </button>
              <button
                onClick={() => setUserTab('active')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  userTab === 'active' ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "bg-white/5 text-slate-400 hover:text-white"
                )}
              >
                Active Staff ({activeUsers.length})
              </button>
              <button
                onClick={() => setUserTab('blocked')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                  userTab === 'blocked' ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25" : "bg-white/5 text-slate-400 hover:text-white"
                )}
              >
                Blocked ({blockedUsers.length})
              </button>
            </div>

            <div className="space-y-2.5">
              {userTab === 'pending' && (
                <div className="space-y-2.5">
                  {pendingUsers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] border-dashed">
                      No pending team registrations.
                    </div>
                  ) : (
                    pendingUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3.5 bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)]">
                        <div>
                          <p className="text-white text-xs md:text-sm font-bold">{user.email}</p>
                          <p className="text-[10px] text-slate-500">Registered: {new Date(user.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleApprove(user.id)}
                            className="p-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-all cursor-pointer"
                            title="Approve Account"
                          >
                            <Check size={16} />
                          </button>
                          <button 
                            onClick={() => handleReject(user.id)}
                            className="p-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-all cursor-pointer"
                            title="Reject"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              
              {userTab === 'active' && (
                <div className="space-y-2.5">
                  {activeUsers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] border-dashed">
                      No other active staff accounts.
                    </div>
                  ) : (
                    activeUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3.5 bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)]">
                        <div>
                          <p className="text-white text-xs md:text-sm font-bold">{user.email}</p>
                          <span className="text-[10px] text-emerald-400 font-semibold">Active Member</span>
                        </div>
                        <button 
                          onClick={() => handleBlock(user.id)}
                          className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/20 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                        >
                          <ShieldAlert size={14} /> Block
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {userTab === 'blocked' && (
                <div className="space-y-2.5">
                  {blockedUsers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] border-dashed">
                      No blocked accounts.
                    </div>
                  ) : (
                    blockedUsers.map(user => (
                      <div key={user.id} className="flex items-center justify-between p-3.5 bg-[var(--dash-bg)] rounded-xl border border-[var(--dash-border)] opacity-80">
                        <div>
                          <p className="text-slate-400 text-xs md:text-sm line-through">{user.email}</p>
                          <span className="text-[10px] text-red-400 font-semibold">Blocked</span>
                        </div>
                        <button 
                          onClick={() => handleUnblock(user.id)}
                          className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                        >
                          <Unlock size={14} /> Unblock
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QtyRulesManager({ settings, setSettings, onClose, themePrimary }: { settings: WebsiteSettings, setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>, onClose: () => void, themePrimary?: string }) {
  const [enabled, setEnabled] = useState(settings.qtyRules?.enabled ?? false);
  const [minQuantity, setMinQuantity] = useState(settings.qtyRules?.minQuantity?.toString() || '6');
  const [discountPerPiece, setDiscountPerPiece] = useState(settings.qtyRules?.discountPerPiece?.toString() || '5');
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = {
        ...settings,
        qtyRules: {
          enabled,
          minQuantity: parseInt(minQuantity) || 0,
          discountPerPiece: parseInt(discountPerPiece) || 0
        }
      };
      setSettings(updated);
      await cloudStore.saveSetting('websiteSettings', updated);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 600);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Header */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <PackagePlus size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">Quantity Pricing Rules</h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Automated tiered bulk discount for large orders</p>
              </div>
            </div>
          </div>

          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {saved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-4 max-w-2xl mx-auto w-full overscroll-y-contain custom-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Quantity-Based Pricing Engine</h2>
              <p className="text-xs text-slate-400">Offer automated per-piece discounts when customers purchase wholesale volume.</p>
            </div>
            <button 
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                enabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
            >
              <div 
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  enabled ? "translate-x-5.5" : "translate-x-0"
                )} 
              />
            </button>
          </div>

          {enabled && (
            <div className="space-y-4 pt-4 border-t border-[var(--dash-border)]/40 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Minimum Pieces (Qty &ge;) *</label>
                  <div className="relative flex items-center">
                    <input 
                      type="number" 
                      value={minQuantity} 
                      onChange={e => setMinQuantity(e.target.value)} 
                      placeholder="6"
                      className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 pr-12 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-bold"
                    />
                    <span className="absolute right-3 text-xs text-slate-500 font-bold">pcs</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Discount per Piece (৳) *</label>
                  <div className="relative flex items-center">
                    <input 
                      type="number" 
                      value={discountPerPiece} 
                      onChange={e => setDiscountPerPiece(e.target.value)} 
                      placeholder="5"
                      className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 pr-12 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 font-bold"
                    />
                    <span className="absolute right-3 text-xs text-slate-500 font-bold">৳</span>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3.5 flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                  <PackagePlus size={16} />
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-white">Rule Execution Summary:</p>
                  <p>Purchasing <strong className="text-indigo-400">&ge;{minQuantity || 0} pieces</strong> grants a <strong className="text-indigo-400">{discountPerPiece || 0}৳</strong> discount per item at checkout.</p>
                  <p className="text-[11px] text-slate-500">Note: Custom tier rules configured inside individual products will override this default store rule.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SeoSettingsManager({ settings, setSettings, onClose, themePrimary }: { settings: WebsiteSettings, setSettings: React.Dispatch<React.SetStateAction<WebsiteSettings>>, onClose: () => void, themePrimary?: string }) {
  const [seo, setSeo] = useState<SeoSettings>(settings.seoSettings || {});
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<{ [key: string]: boolean }>({});

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const newSettings = { ...settings, seoSettings: seo };
      setSettings(newSettings);
      await cloudStore.saveSetting('websiteSettings', newSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof SeoSettings) => {
    if (e.target.files && e.target.files[0]) {
      const fieldStr = String(fieldName);
      setIsUploading({ ...isUploading, [fieldStr]: true });
      const file = e.target.files[0];
      try {
        const url = await cloudStore.uploadFile(file, `seo_${fieldStr}_${Date.now()}.${file.name.split('.').pop()}`);
        setSeo({ ...seo, [fieldName]: url });
      } catch (err) {
        console.error("Upload failed", err);
        const reader = new FileReader();
        reader.onload = (event) => {
          setSeo({ ...seo, [fieldName]: event.target?.result as string });
        };
        reader.readAsDataURL(file);
      } finally {
        setIsUploading({ ...isUploading, [fieldStr]: false });
      }
    }
  };

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Top Header Bar */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              id="seo_back_btn"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <Globe size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">SEO, OpenGraph & Favicon</h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Search engine indexing, WhatsApp link previews and branding</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0 disabled:opacity-50"
            id="seo_save_btn"
          >
            {saved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-4 max-w-4xl mx-auto w-full overscroll-y-contain custom-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Basic SEO Controls (Box 1) */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4" id="seo_basic_card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Tag size={20} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Google Search Meta Tags</h2>
                <p className="text-xs text-slate-400">Search title and meta snippet shown in Google, Bing & Yahoo results.</p>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-bold uppercase tracking-wider" id="seo_status_good">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Optimized</span>
            </div>
          </div>

          <div className="space-y-3.5 pt-2 border-t border-[var(--dash-border)]/40">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Store Meta Title *</label>
              <input
                type="text"
                value={seo.metaTitle || ''}
                onChange={(e) => setSeo({ ...seo, metaTitle: e.target.value })}
                placeholder="e.g. PaikariX - Wholesale Import & B2B Supply in Bangladesh"
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500"
                id="seo_meta_title_input"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Store Meta Description</label>
              <textarea
                value={seo.metaDescription || ''}
                onChange={(e) => setSeo({ ...seo, metaDescription: e.target.value })}
                placeholder="Short paragraph describing your store, wholesale categories, and buyer guarantees..."
                rows={2}
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 resize-y min-h-[56px]"
                id="seo_meta_description_textarea"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Meta Keywords</label>
              <input
                type="text"
                value={seo.metaKeywords || ''}
                onChange={(e) => setSeo({ ...seo, metaKeywords: e.target.value })}
                placeholder="e.g. wholesale, electronics, import bd, wholesale gadgets (comma separated)"
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500"
                id="seo_meta_keywords_input"
              />
            </div>
          </div>
        </div>

        {/* Social Media Sharing Controls (Box 2) */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4" id="seo_social_card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Share2 size={20} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Social Media OpenGraph Sharing</h2>
                <p className="text-xs text-slate-400">Preview title, thumbnail, and snippet on Facebook, WhatsApp & Twitter.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3.5 pt-2 border-t border-[var(--dash-border)]/40">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Social Share Title</label>
              <input
                type="text"
                value={seo.socialShareTitle || ''}
                onChange={(e) => setSeo({ ...seo, socialShareTitle: e.target.value })}
                placeholder="Enter social share title (optional)"
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500"
                id="seo_social_title_input"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Social Share Description</label>
              <textarea
                value={seo.socialShareDescription || ''}
                onChange={(e) => setSeo({ ...seo, socialShareDescription: e.target.value })}
                placeholder="Text that appears under the link preview card..."
                rows={2}
                className="w-full bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white focus:outline-none focus:border-indigo-500 resize-y min-h-[56px]"
                id="seo_social_description_textarea"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 block">Default Social Share Banner (1200x630px)</label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3.5">
                <div className="w-24 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden" id="social_image_preview_box">
                  {seo.defaultSocialShareImage ? (
                    <img src={seo.defaultSocialShareImage} alt="Social Share Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={20} className="text-slate-500" />
                  )}
                </div>
                
                <div className="flex-1 space-y-1">
                  <p className="text-xs text-slate-300 font-bold">Upload OpenGraph Card Image</p>
                  <p className="text-[11px] text-slate-500">Displayed whenever your store domain is pasted in chat or social feeds.</p>
                </div>
                
                <label className={cn(
                  "bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 active:scale-95",
                  isUploading.defaultSocialShareImage && "opacity-50 cursor-not-allowed"
                )} id="social_image_upload_label">
                  {isUploading.defaultSocialShareImage ? <RefreshCw className="animate-spin" size={14} /> : <Upload size={14} />}
                  <span>{isUploading.defaultSocialShareImage ? 'Uploading...' : 'Upload Image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="social_share_image_input"
                    onChange={(e) => handleImageUpload(e, 'defaultSocialShareImage')}
                    disabled={isUploading.defaultSocialShareImage}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Branding & Appearance (Box 3) */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4" id="seo_branding_card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Palette size={20} />
              </div>
              <div>
                <h2 className="text-sm md:text-base font-bold text-white mb-0.5">Favicon & Browser Icon</h2>
                <p className="text-xs text-slate-400">Tiny tab icon shown on browser tabs and bookmarks.</p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--dash-border)]/40">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-xl p-3.5">
              <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden" id="favicon_preview_box">
                {seo.favicon ? (
                  <img src={seo.favicon} alt="Favicon Preview" className="w-8 h-8 object-contain" />
                ) : (
                  <Star size={20} className="text-indigo-400" />
                )}
              </div>
              
              <div className="flex-1 space-y-1">
                <p className="text-xs text-slate-300 font-bold">Store Browser Favicon (.ico, .png, .svg)</p>
                <p className="text-[11px] text-slate-500">Recommended dimension: 64x64px square image with transparent background.</p>
              </div>
              
              <label className={cn(
                "bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 active:scale-95",
                isUploading.favicon && "opacity-50 cursor-not-allowed"
              )} id="favicon_upload_label">
                {isUploading.favicon ? <RefreshCw className="animate-spin" size={14} /> : <Upload size={14} />}
                <span>{isUploading.favicon ? 'Uploading...' : 'Upload Favicon'}</span>
                <input
                  type="file"
                  accept="image/png, image/x-icon, image/jpeg, image/svg+xml"
                  className="hidden"
                  id="favicon_image_input"
                  onChange={(e) => handleImageUpload(e, 'favicon')}
                  disabled={isUploading.favicon}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImageSettingsManager({ onClose, themePrimary }: { onClose: () => void; themePrimary?: string }) {
  const [enabled, setEnabled] = useState(true);
  const [quality, setQuality] = useState(70);
  const [scale, setScale] = useState(70);
  const [thumbnailWidth, setThumbnailWidth] = useState(470);
  const [thumbnailQuality, setThumbnailQuality] = useState(70);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const cfg = getDefaultImageOptimization();
    setEnabled(cfg.enabled);
    setQuality(cfg.quality);
    setScale(cfg.scale);
    setThumbnailWidth(cfg.thumbnailWidth);
    setThumbnailQuality(cfg.thumbnailQuality);
  }, []);

  const handleSave = () => {
    const cfg = { enabled, quality, scale, thumbnailWidth, thumbnailQuality };
    setDefaultImageOptimization(cfg);
    cloudStore.saveSetting('imageOptimization', cfg).catch(console.error);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const themeColor = '#6366F1';

  return (
    <div className="fixed inset-0 z-[100] bg-[var(--dash-bg)] text-[#e2e8f0] flex flex-col font-sans overflow-hidden md:left-[334px]">
      {/* Top Bar */}
      <div className="border-b border-[var(--dash-border)]/70 bg-[var(--dash-bg)]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between px-2.5 py-3 md:px-8 md:py-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer"
              title="Go back"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
                <ImageIcon size={20} />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold text-white tracking-tight">Image Processing & Optimization</h1>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">Real-time WebP compression, thumbnail sizing & asset delivery</p>
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer shrink-0"
          >
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto p-2.5 md:p-8 space-y-4 max-w-3xl mx-auto w-full overscroll-y-contain custom-scrollbar pb-32"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Auto Optimization */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm md:text-base font-bold text-white mb-0.5">Automated Client-Side Image Compression</h3>
              <p className="text-xs text-slate-400">Compress uploaded product photos before uploading to Cloudflare R2 storage.</p>
            </div>
            <button 
              onClick={() => setEnabled(!enabled)}
              className={cn(
                "w-12 h-6.5 rounded-full relative transition-all duration-300 ease-in-out p-0.5 focus:outline-none shrink-0 cursor-pointer",
                enabled ? "bg-indigo-600 shadow-md shadow-indigo-500/25" : "bg-slate-700/60"
              )}
            >
              <div 
                className={cn(
                  "w-5.5 h-5.5 rounded-full bg-white transition-all duration-300 shadow-md",
                  enabled ? "translate-x-5.5" : "translate-x-0"
                )} 
              />
            </button>
          </div>

          {enabled && (
            <div className="space-y-5 pt-4 border-t border-[var(--dash-border)]/40 animate-in fade-in duration-200">
              <div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                  <span className="text-slate-300">Compression Quality</span>
                  <span className="text-indigo-400 font-mono text-sm">{quality}%</span>
                </div>
                <input 
                  type="range" min="1" max="100" value={quality} onChange={e => setQuality(Number(e.target.value))}
                  className="w-full h-1.5 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-full appearance-none cursor-pointer accent-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Recommended: 80%. Balances sharp product visuals with sub-second page loads.</p>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                  <span className="text-slate-300">Maximum Resolution Scale</span>
                  <span className="text-indigo-400 font-mono text-sm">{scale}%</span>
                </div>
                <input 
                  type="range" min="10" max="100" value={scale} onChange={e => setScale(Number(e.target.value))}
                  className="w-full h-1.5 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-full appearance-none cursor-pointer accent-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">Scales down excessive 4K/8K images from supplier cameras to web-friendly bounds.</p>
              </div>
            </div>
          )}
        </div>

        {/* Thumbnail Settings */}
        <div className="bg-[var(--dash-card)] border border-[var(--dash-border)]/70 rounded-2xl p-4 md:p-6 shadow-xl space-y-4">
          <div>
            <h3 className="text-sm md:text-base font-bold text-white mb-0.5">High-Speed Grid Thumbnail Generator</h3>
            <p className="text-xs text-slate-400">Creates lightweight thumbnail variants for fast grid scrolling and instant mobile catalog browsing.</p>
          </div>

          <div className="space-y-5 pt-3 border-t border-[var(--dash-border)]/40">
            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                <span className="text-slate-300">Thumbnail Target Width</span>
                <span className="text-indigo-400 font-mono text-sm">{thumbnailWidth}px</span>
              </div>
              <input 
                type="range" min="100" max="1080" step="10" value={thumbnailWidth} onChange={e => setThumbnailWidth(Number(e.target.value))}
                className="w-full h-1.5 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-full appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Recommended: 350px - 500px for retina mobile displays.</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-2">
                <span className="text-slate-300">Thumbnail Compression Quality</span>
                <span className="text-indigo-400 font-mono text-sm">{thumbnailQuality}%</span>
              </div>
              <input 
                type="range" min="10" max="100" value={thumbnailQuality} onChange={e => setThumbnailQuality(Number(e.target.value))}
                className="w-full h-1.5 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-full appearance-none cursor-pointer accent-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">Recommended: 60% - 75% for optimum grid performance.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}