export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface ProductOption {
  id: string;
  name: string;
  values: string[];
}

export interface QtyPriceRule {
  quantity: number;
  price: number;
}

export interface ProductVariant {
  id: string;
  options: Record<string, string>; // Maps option id to value, e.g. { 'opt1': 'red', 'opt2': 'XL' }
  price?: number;
  buyPrice?: number;
  stock?: number;
  image?: string;
  sku?: string;
  isVisible?: boolean;
  autoPrice?: string;
  qtyRules?: QtyPriceRule[];
}

export interface Product {
  id: string;
  title: string;
  material: string;
  price: number;
  image: string;
  images?: string[];
  thumbnail?: string;
  thumbnails?: string[];
  category: string;
  colors?: { name: string; image: string }[];
  buyPrice?: number;
  autoPrice?: number;
  stock?: number;
  supplier?: string;
  description?: string;
  isVisible?: boolean;
  stockOutDate?: string;
  options?: ProductOption[];
  variants?: ProductVariant[];
  hasVariants?: boolean;
  qtyRules?: QtyPriceRule[];
  isNew?: boolean;
}

export interface CartItem {
  id: string; // unique id for cart item (product.id + color + variant)
  product: Product;
  quantity: number;
  color?: string;
  variantId?: string;
  variantName?: string;
  variantPrice?: number;
  variantBuyPrice?: number;
}

export interface DeliveryCharge {
  id: string;
  area: string;
  price: number;
  time: string;
}

export interface MetaPixelSettings {
  enabled: boolean;
  pixelId: string;
  accessToken: string;
  testCode: string;
}

export interface TikTokPixelSettings {
  enabled: boolean;
  pixelId: string;
  accessToken: string;
  testCode: string;
}

export interface GA4Settings {
  enabled: boolean;
  measurementId: string;
  apiSecret: string;
}

export interface MarketingSettings {
  metaPixel: MetaPixelSettings;
  tiktokPixel: TikTokPixelSettings;
  ga4?: GA4Settings;
}

export type DiscountType = 'percentage' | 'fixed' | 'free_delivery' | 'buy_x_get_y' | 'coupon';

export interface DiscountCondition {
  minOrderAmount?: number;
  maxOrderAmount?: number;
  minQuantity?: number;
  selectedProducts?: string[];
  selectedCategories?: string[];
  location?: 'inside_dhaka' | 'outside_dhaka' | 'all';
  firstOrderOnly?: boolean;
}

export interface DiscountAction {
  percentage?: number;
  fixedAmount?: number;
  buyX?: number;
  getY?: number;
  couponCode?: string;
}

export interface DiscountLimits {
  maxUsageGlobal?: number;
  maxUsagePerUser?: number;
  oneTimeUse?: boolean;
  currentUsageGlobal?: number;
}

export interface DiscountTime {
  startDate?: string;
  endDate?: string;
}

export interface DiscountRule {
  id: string;
  name: string;
  status: boolean;
  priority: number;
  type: DiscountType;
  conditions: DiscountCondition;
  action: DiscountAction;
  limits: DiscountLimits;
  time: DiscountTime;
}

export interface CustomerSettings {
  systemEnabled?: boolean;
  autoBlockEnabled: boolean;
  maxCancelLimit: number;
  blockedPhones: string[];
  whatsappMessage?: string;
}

export interface ThemeColors {
  primary: string;
  black: string;
  white: string;
  bg?: string;
}

export interface GlobalQtyRules {
  enabled: boolean;
  minQuantity: number;
  discountPerPiece: number;
}

export type IncompleteOrderStatus = 'Hot' | 'Cold' | 'Follow-up';

export interface IncompleteOrder {
  id: string;
  phone: string;
  name?: string;
  location?: string;
  timestamp: number;
  status?: IncompleteOrderStatus;
  contacted?: boolean;
  contactedAt?: number;
  cartItems?: CartItem[];
}

export interface IncompleteOrderSettings {
  enabled: boolean;
  inactivityTimerMinutes: number;
  duplicateControlValue: number;
  duplicateControlUnit: 'minutes' | 'hours' | 'days';
  whatsappMessage: string;
  retentionPeriodDays?: number; // Added
}

export interface AntiSpamSettings {
  enabled: boolean;
  rateLimitEnabled: boolean;
  deviceTrackingEnabled: boolean;
  shortTermOrdersCount: number;
  shortTermMinutes: number;
  hourlyOrdersCount: number;
  dailyOrdersCount: number;
  blockDurationMinutes: number;
}

export interface MinOrderFeatureSettings {
  enabled: boolean;
  minQuantity: number;
  message: string;
  autoCloseTime: number; // 0 for manual close, otherwise value in ms
}

export interface SocialLink {
  id: string;
  icon: string;
  link: string;
}

export interface PWebsiteConfig {
  enabled: boolean;
  link: string;
}

export interface PDashboardLink {
  id: string;
  name: string;
  link: string;
}

export interface PreOrderSettings {
  pWebsite: PWebsiteConfig;
  pDashboard: PDashboardLink[];
}

export interface SeoSettings {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  socialShareTitle?: string;
  socialShareDescription?: string;
  defaultSocialShareImage?: string;
  favicon?: string;
}

export interface DashboardNavConfig {
  height: number;
  width: number;
  blur: number;
  bottomOffset: number;
  borderWhiteness?: number;
}

export interface TelegramNotificationSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

export interface WebsiteSettings {
  shopName?: string;
  smartProductDisplay?: boolean;
  bannerBorderRadius?: string;
  bannerEnabled: boolean;
  banners: string[];
  socialLinks?: SocialLink[];
  socialMediaMainIcon?: string;
  deliveryCharges: DeliveryCharge[];
  productImageHover?: boolean;
  logoUrl?: string;
  receiptQrCodeUrl?: string;
  shopPhone?: string;
  autoLogoutDays?: number;
  discounts?: DiscountRule[];
  customers?: CustomerSettings;
  stockOutFeature?: {
    enabled: boolean;
    minOrdersRequired: number;
  };
  themeColors?: ThemeColors;
  suppliers?: string[];
  qtyRules?: GlobalQtyRules;
  seoSettings?: SeoSettings;
  incompleteOrdersFeature?: IncompleteOrderSettings;
  antiSpam?: AntiSpamSettings;
  minOrderFeature?: MinOrderFeatureSettings;
  actionButtons?: ActionButtonsConfig;
  eventBatchingInterval?: number;
  mainFont?: string;
  textBrightness?: number;
  preOrder?: PreOrderSettings;
  dashboardNav?: DashboardNavConfig;
  dashboardTheme?: {
    blueTint: number; // 0 to 100, default is to be decided (maybe 50)
  };
  apiSync?: {
    enabled?: boolean;
    isMaster: boolean;
    masterApiKey?: string;
    connectedMasterUrl?: string;
    connectedMasterApiKey?: string;
  };
  telegramNotification?: TelegramNotificationSettings;
}

export interface ButtonDesign {
  width: string; // 'auto', 'full', custom (e.g., '200px')
  height: string; // custom (e.g., '48px')
  backgroundColor: string; // hex
  textColor: string; // hex
  fontSize: string; // px
  fontWeight: number;
  icon: string; // 'none', 'bag', 'cart', 'check', 'arrow', 'plus'
  iconPosition: 'left' | 'right';
  borderRadius: string; // px
  elevation: number; // 0-5
  paddingX: string; // px
  paddingY: string; // px
}

export interface FloatingButtonDesign extends ButtonDesign {
  position: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-right' | 'top-left' | 'top-center';
  marginBottom: string; // px
  marginLeft: string; // px
  marginRight: string; // px
}

export interface ActionButtonsConfig {
  addToCart?: ButtonDesign;
  viewCart: FloatingButtonDesign;
  checkout: ButtonDesign;
  placeOrder: ButtonDesign;
  confirmOrder: FloatingButtonDesign; // When adding to order
}

export const DEFAULT_ACTION_BUTTONS: ActionButtonsConfig = {
  addToCart: {
    width: '100%',
    height: '38px',
    backgroundColor: 'var(--theme-primary)',
    textColor: 'var(--theme-white)',
    fontSize: '14px',
    fontWeight: 600,
    icon: 'plus',
    iconPosition: 'left',
    borderRadius: '9999px',
    elevation: 0,
    paddingX: '16px',
    paddingY: '8px',
  },
  viewCart: {
    width: 'auto',
    height: '48px',
    backgroundColor: 'var(--theme-primary)',
    textColor: 'var(--theme-white)',
    fontSize: '16px',
    fontWeight: 700,
    icon: 'bag',
    iconPosition: 'left',
    borderRadius: '9999px',
    elevation: 3,
    paddingX: '24px',
    paddingY: '12px',
    position: 'bottom-right',
    marginBottom: '3px',
    marginLeft: '3px',
    marginRight: '3px',
  },
  checkout: {
    width: '100%',
    height: '48px',
    backgroundColor: 'var(--theme-primary)',
    textColor: 'var(--theme-white)',
    fontSize: '16px',
    fontWeight: 700,
    icon: 'arrow',
    iconPosition: 'right',
    borderRadius: '9999px',
    elevation: 0,
    paddingX: '24px',
    paddingY: '12px',
  },
  placeOrder: {
    width: '100%',
    height: '48px',
    backgroundColor: 'var(--theme-primary)',
    textColor: 'var(--theme-white)',
    fontSize: '16px',
    fontWeight: 700,
    icon: 'arrow',
    iconPosition: 'right',
    borderRadius: '9999px',
    elevation: 0,
    paddingX: '24px',
    paddingY: '12px',
  },
  confirmOrder: {
    width: 'auto',
    height: '48px',
    backgroundColor: 'var(--theme-primary)',
    textColor: 'var(--theme-white)',
    fontSize: '16px',
    fontWeight: 700,
    icon: 'check',
    iconPosition: 'left',
    borderRadius: '9999px',
    elevation: 3,
    paddingX: '24px',
    paddingY: '12px',
    position: 'bottom-right',
    marginBottom: '3px',
    marginLeft: '3px',
    marginRight: '3px',
  }
};

export interface BdCourierReport {
  id: string;
  name: string;
  details: string;
  created_at: string;
  courierLogo: string;
  courierName: string;
}

export interface BdCourierSummary {
  total_parcel: number;
  success_parcel: number;
  cancelled_parcel: number;
  success_ratio: number;
}

export interface BdCourierData {
  summary: BdCourierSummary;
  reports: BdCourierReport[];
}

export interface BdCourierApiConfig {
  id: string;
  name?: string;
  apiKey: string;
  enabled: boolean;
}

export interface CourierSettings {
  steadfast: {
    apiKey: string;
    secretKey: string;
  };
  bdCourierApis?: BdCourierApiConfig[];
}

export interface PriceCalculatorSettings {
  yuanRate: number;
  additionalCost: number;
  profit: number;
}

export type AdminRole = 'Owner' | 'Manager' | 'Staff';

export interface AdminPermissions {
  sections: {
    dashboard: boolean;
    products: boolean;
    orders: boolean;
    customers: boolean;
    analytics: boolean;
    settings: boolean;
  };
  product: {
    buyPrice: boolean;
    sellPrice: boolean;
    profit: boolean;
    stock: boolean;
    supplierCost: boolean;
  };
  order: {
    customerName: boolean;
    customerPhone: boolean;
    customerAddress: boolean;
    customerOrderAmount: boolean;
    orderHistory: boolean;
  };
  analytics: {
    totalSell: boolean;
    completedSell: boolean;
    totalOrders: boolean;
    completedOrders: boolean;
    completedProfit: boolean;
    topSellingProducts: boolean;
    productImages: boolean;
    customerAnalytics: boolean;
    revenueAnalytics: boolean;
  };
}

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  sections: { dashboard: true, products: true, orders: true, customers: true, analytics: true, settings: true },
  product: { buyPrice: true, sellPrice: true, profit: true, stock: true, supplierCost: true },
  order: { customerName: true, customerPhone: true, customerAddress: true, customerOrderAmount: true, orderHistory: true },
  analytics: { totalSell: true, completedSell: true, totalOrders: true, completedOrders: true, completedProfit: true, topSellingProducts: true, productImages: true, customerAnalytics: true, revenueAnalytics: true }
};

export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  isApproved: boolean;
  isBlocked?: boolean;
  createdAt: string;
  loginTimestamp?: number;
  role?: AdminRole;
  permissions?: AdminPermissions;
}

export type OrderStatus = 'Pending' | 'Unreachable' | 'Preparing' | 'Shipping' | 'Completed' | 'Canceled' | 'Returned' | 'Complete Return';

export interface Order {
  id: string;
  date: string;
  status: OrderStatus;
  items: CartItem[];
  isNoteRead?: boolean;
  returnCost?: number;
  userInfo: {
    name: string;
    phone: string;
    address: string;
    customerNote?: string;
  };
  deliveryCharge: number;
  discountAmount?: number;
  promoCode?: string;
  promoId?: string;
  clientInfo?: {
    userAgent: string;
    deviceType: string;
    os: string;
    browser: string;
    screenResolution: string;
  };
  steadfast?: {
    consignmentId: string;
    trackingCode: string;
    status: string;
    createdAt: string;
  };
  pathao?: {
    consignmentId: string;
    status: string;
    createdAt: string;
  };
  note?: string;
  stockReturned?: boolean;
  subtotal: number;
  total: number;
  discount?: number;
  discountName?: string;
  extraCosts?: number;
  profit?: number;
  successRatio?: { successful: number; total: number };
  paymentStatus?: 'Paid' | 'Unpaid';
  trackingNumber?: string;
  bdCourierStatus?: 'pending' | 'success' | 'failed';
  bdCourierData?: BdCourierData;
}
