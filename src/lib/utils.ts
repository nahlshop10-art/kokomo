import React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return `৳${Math.floor(price)}`;
}

export function cleanAlibabaImageUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let url = rawUrl.trim();
  if (url.startsWith('//')) {
    url = 'https:' + url;
  }

  // Strip URL query parameters (e.g. ?x-oss-process=...)
  url = url.split('?')[0];

  const isAlibaba = url.includes('alicdn.com') || url.includes('cbu01') || url.includes('1688.com');
  if (!isAlibaba) {
    return url;
  }

  // Remember original extension if present in raw URL
  const extMatch = url.match(/\.(jpg|jpeg|png|webp|gif)/i);
  const hadExt = !!extMatch;
  const origExt = extMatch ? '.' + extMatch[1].toLowerCase() : '.jpg';

  // Strip .search.jpg or search suffix
  url = url.replace(/(\.(?:jpg|jpeg|png|webp))\.search(?:\.[a-z0-9]+)?$/i, '$1');
  url = url.replace(/\.search\.(jpg|png|jpeg|webp)$/i, '.$1');

  // Strip dot-format thumbnail dimensions like .400x400.jpg or .jpg.400x400.jpg
  url = url.replace(/(\.(?:jpg|jpeg|png|webp))\.\d+x\d+(?:\.[a-z0-9]+)?$/i, '$1');
  url = url.replace(/\.\d+x\d+\.(?:jpg|jpeg|png|webp)$/i, origExt);

  // Specified regex to strip Alibaba CDN thumbnail suffixes to get 1200x1200 master images
  url = url.replace(/(_\d+x\d+[^.]*(\.[a-z0-9]+)?|_\.webp)$/i, '');

  // Also strip additional CDN quality/size decorators like .jpg_60x60.jpg or .jpg_q90.jpg
  url = url.replace(/(\.(?:jpg|jpeg|png|webp))_[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9]+)?$/i, '$1');

  // Deduplicate any repeated extension
  url = url.replace(/(\.(?:jpg|jpeg|png|webp))\1+$/i, '$1');

  // If stripping the suffix removed the only extension, restore original extension
  if (hadExt && !/\.(?:jpg|jpeg|png|webp|gif)$/i.test(url)) {
    url = url + origExt;
  }

  return url;
}

export const clean1688Url = (input?: string): string => {
  if (!input) return '';
  let str = input.trim();
  const match = str.match(/https?:\/\/[^\s\u4e00-\u9fa5\uff00-\uffef]+/);
  if (match) {
    let url = match[0];
    url = url.replace(/[,，\.。;；!?！？\)\>）】]+$/, '');
    return url;
  }
  if (str.startsWith('qr.1688.com') || str.startsWith('detail.1688.com') || str.startsWith('m.1688.com')) {
    const clean = str.split(/\s+/)[0];
    return 'https://' + clean;
  }
  return str;
};

export function formatShortTimeAgo(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return 'N/A';

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffYear > 0) return `${diffYear}y`;
  if (diffMonth > 0) return `${diffMonth}mo`;
  if (diffWeek > 0) return `${diffWeek}w`;
  if (diffDay > 0) return `${diffDay}d`;
  if (diffHour > 0) return `${diffHour}h`;
  if (diffMin > 0) return `${diffMin}m`;
  return '0m';
}

export function formatWhatsAppPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  
  if (/^(88)+01/.test(cleaned)) {
    return cleaned.replace(/^(88)+/, '88');
  } else if (cleaned.startsWith('01')) {
    return '88' + cleaned;
  } else if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return '880' + cleaned;
  }
  
  return cleaned;
}

const scrollMemory: Record<string, number> = {};

export function useScrollRestore(id: string) {
  const ref = React.useRef<HTMLDivElement>(null);
  const hasRestoredRef = React.useRef(false);

  React.useLayoutEffect(() => {
    if (!hasRestoredRef.current && ref.current && scrollMemory[id] !== undefined) {
      ref.current.scrollTop = scrollMemory[id];
      hasRestoredRef.current = true;
    }

    let ticking = false;
    const handleScroll = (e: Event) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const target = e.target as HTMLDivElement;
          if (target) {
            scrollMemory[id] = target.scrollTop;
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    const el = ref.current;
    if (el) el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (el) el.removeEventListener('scroll', handleScroll);
    };
  }, [id]);

  return ref;
}

export function useWindowScrollRestore(id: string, enabled: boolean = true) {
  const prevEnabledRef = React.useRef(false);

  React.useLayoutEffect(() => {
    const justEnabled = enabled && !prevEnabledRef.current;
    prevEnabledRef.current = enabled;

    if (!enabled) return;

    if (justEnabled && scrollMemory[id] !== undefined) {
      window.scrollTo(0, scrollMemory[id]);
    }

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          scrollMemory[id] = window.scrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [id, enabled]);
}

export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('880') && cleaned.length >= 13) {
    return cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    return cleaned;
  } else if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return '0' + cleaned;
  }
  return cleaned;
}

export function isValidBangladeshiPhone(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const norm = normalizePhone(phone);
  return /^01[3-9]\d{8}$/.test(norm);
}

export function slugify(text: string): string {
  if (!text) return '';
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export const sendTelegramNotification = (type: 'NEW_ORDER' | 'STOCK_UPDATED' | 'ORDER_CANCELLED' | 'ORDER_UPDATED', order: any, websiteSettings: any, previousStock?: number, currentStock?: number, newItemsAdded?: number) => {
    if (!websiteSettings?.telegramNotification?.enabled) return;

    const telegram = websiteSettings.telegramNotification;
    const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const d = new Date();
    const dayName = days[d.getDay()];
    const bdDigits = {
      '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
      '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
    };
    const toBn = (str: string) => String(str).replace(/[0-9]/g, match => bdDigits[match as keyof typeof bdDigits]);
    
    const day = toBn(String(d.getDate()).padStart(2, '0'));
    const month = toBn(String(d.getMonth() + 1).padStart(2, '0'));
    const year = toBn(String(d.getFullYear()));
    
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    const hourStr = toBn(String(hours).padStart(2, '0'));
    const minStr = toBn(String(d.getMinutes()).padStart(2, '0'));
    
    const banglaDate = `${dayName} • ${day}/${month}/${year} • ${hourStr}:${minStr} ${ampm}`;
    const shopName = websiteSettings?.shopName || 'NAHL SHOP';
    const shopNameUpper = String(shopName).toUpperCase();
    
    let message = `🛍️ ${shopNameUpper}\n━━━━━━━━━━━━━━━━━━━━\n`;
    
    if (type === 'NEW_ORDER') {
      message += `🎉 NEW ORDER\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    } else if (type === 'ORDER_CANCELLED' || type === 'ORDER_UPDATED') {
      message += `❌ ORDER CANCELLED\n━━━━━━━━━━━━━━━━━━━━\n\n`;
    } else if (type === 'STOCK_UPDATED') {
      if (newItemsAdded !== undefined) {
         message += `📦 UPDATED\n━━━━━━━━━━━━━━━━━━━━\n`;
         if (previousStock !== undefined && currentStock !== undefined) {
           message += `\n📈 Previous : ${previousStock}\n📊 Current  : ${currentStock}\n🆕 New Items  +${newItemsAdded}\n\n`;
         } else {
           message += `\n🆕 New Items  +${newItemsAdded}\n\n`;
         }
      } else {
         message += `📦 STOCK UPDATED\n━━━━━━━━━━━━━━━━━━━━\n\n`;
         if (previousStock !== undefined && currentStock !== undefined) {
           message += `📈 Previous : ${previousStock}\n📊 Current  : ${currentStock}\n\n`;
         }
      }
    }
    
    message += `👤 Customer : ${order.userInfo?.name || ''}\n`;
    message += `📞 Phone    : ${order.userInfo?.phone || ''}\n`;
    if (type === 'ORDER_CANCELLED' || type === 'ORDER_UPDATED') {
       message += `💰 Amount   : ৳${order.total}\n\n`;
    } else {
       message += `💰 Total    : ৳${order.total}\n\n`;
    }
    message += `🕘 ${banglaDate}`;

    fetch(`/api/send_telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message
      })
    }).catch(e => console.error("Telegram notification failed", e));
};
