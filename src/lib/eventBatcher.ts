export let currentBatchIntervalMs = 35000;
let batchTimeoutId: NodeJS.Timeout | null = null;
let isUnloading = false;

interface BrowserEvent {
  platform: 'meta' | 'tiktok' | 'ga4';
  eventName: string;
  eventData: any;
  eventId?: string;
  pixelId?: string;
  advancedMatching?: any;
}

interface MetaServerEvent {
  event: any;
}

interface TikTokServerEvent {
  payload: any;
}

interface GA4ServerEvent {
  clientId: string;
  event: any;
  userData?: any;
}

const queue = {
  metaBrowser: [] as BrowserEvent[],
  tiktokBrowser: [] as BrowserEvent[],
  ga4Browser: [] as BrowserEvent[],
  metaServer: [] as MetaServerEvent[],
  tiktokServer: [] as TikTokServerEvent[],
  ga4Server: new Map<string, GA4ServerEvent[]>()
};

export const setBatchingInterval = (seconds?: number) => {
  const ms = (seconds !== undefined && seconds !== null ? Math.max(0, seconds) : 35) * 1000;
  if (currentBatchIntervalMs !== ms) {
    currentBatchIntervalMs = ms;
  }
};

const scheduleFlush = () => {
  if (currentBatchIntervalMs <= 0) {
    flushEvents();
    return;
  }
  if (!batchTimeoutId) {
    batchTimeoutId = setTimeout(() => {
      batchTimeoutId = null;
      flushEvents();
    }, currentBatchIntervalMs);
  }
};

export const queueBrowserEvent = (
  platform: 'meta' | 'tiktok' | 'ga4', 
  eventName: string, 
  eventData: any, 
  eventId?: string,
  pixelId?: string,
  advancedMatching?: any
) => {
  if (platform === 'meta') {
    queue.metaBrowser.push({ platform, eventName, eventData, eventId, pixelId, advancedMatching });
  } else if (platform === 'tiktok') {
    queue.tiktokBrowser.push({ platform, eventName, eventData, eventId });
  } else if (platform === 'ga4') {
    queue.ga4Browser.push({ platform, eventName, eventData, eventId });
  }
  scheduleFlush();
  checkImmediateFlush(eventName);
};

export const queueMetaServerEvent = (eventPayload: any) => {
  queue.metaServer.push({ event: eventPayload });
  scheduleFlush();
  checkImmediateFlush(eventPayload.event_name);
};

export const queueTikTokServerEvent = (payload: any) => {
  queue.tiktokServer.push({ payload });
  scheduleFlush();
  checkImmediateFlush(payload.eventName);
};

export const queueGA4ServerEvent = (clientId: string, eventPayload: any, userData?: any) => {
  const key = `${clientId}`;
  if (!queue.ga4Server.has(key)) {
    queue.ga4Server.set(key, []);
  }
  queue.ga4Server.get(key)!.push({ clientId, event: eventPayload, userData });
  scheduleFlush();
  checkImmediateFlush(eventPayload.name);
};

const checkImmediateFlush = (eventName: string) => {
  const normalized = eventName.toLowerCase();
  // Flush on Purchase or InitiateCheckout immediately
  if (normalized === 'purchase' || normalized === 'initiatecheckout' || normalized === 'initiate_checkout' || typeof window !== 'undefined' && window.location.pathname === '/checkout') {
    flushEvents();
  }
};

export const flushEvents = async () => {
  if (batchTimeoutId) {
    clearTimeout(batchTimeoutId);
    batchTimeoutId = null;
  }

  const mBrowser = [...queue.metaBrowser];
  const tBrowser = [...queue.tiktokBrowser];
  const gBrowser = [...queue.ga4Browser];
  const mServer = [...queue.metaServer];
  const tServer = [...queue.tiktokServer];
  const gServer = new Map(queue.ga4Server);
  
  queue.metaBrowser = [];
  queue.tiktokBrowser = [];
  queue.ga4Browser = [];
  queue.metaServer = [];
  queue.tiktokServer = [];
  queue.ga4Server.clear();

  if (mBrowser.length === 0 && tBrowser.length === 0 && gBrowser.length === 0 && mServer.length === 0 && tServer.length === 0 && gServer.size === 0) return;

  // Execute browser events
  if (typeof window !== 'undefined') {
    if (window.fbq && mBrowser.length > 0) {
      mBrowser.forEach(ev => {
        window.fbq('track', ev.eventName, ev.eventData, { eventID: ev.eventId });
      });
    }
    if (window.ttq && tBrowser.length > 0) {
      tBrowser.forEach(ev => {
        if (ev.eventName === 'Pageview' || ev.eventName === 'PageView') {
          window.ttq.page({ event_id: ev.eventId });
        } else {
          window.ttq.track(ev.eventName, ev.eventData, { event_id: ev.eventId });
        }
      });
    }
    if (window.gtag && gBrowser.length > 0) {
      gBrowser.forEach(ev => {
        if (ev.eventName === 'page_view') {
          window.gtag('event', 'page_view', {
            page_title: document.title,
            page_location: location.href,
            page_path: location.pathname,
            ...ev.eventData
          });
        } else {
          window.gtag('event', ev.eventName, ev.eventData);
        }
      });
    }
  }

  // Execute Server Meta Events
  if (mServer.length > 0) {
    try {
      const payload = { events: mServer.map(e => e.event) };
      await fetch('/api/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (e) {
      console.error('Meta batch error', e);
    }
  }

  // Execute Server TikTok Events
  if (tServer.length > 0) {
    try {
      // Create a batch payload
      const payload = { events: tServer.map(e => e.payload) };
      await fetch('/api/tiktok', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (e) {
      console.error('TikTok batch error', e);
    }
  }

  // Execute Server GA4 Events
  for (const [key, events] of gServer.entries()) {
    if (events.length === 0) continue;
    const first = events[0];
    const payload: any = {
      client_id: first.clientId,
      events: events.map(e => e.event)
    };
    
    if (first.userData) {
      payload.user_data = {
        email_address: first.userData.email,
        phone_number: first.userData.phone
      };
    }

    try {
      const url = `/api/ga4`;
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (e) {
      console.error('GA4 batch error', e);
    }
  }
};

const handleUnload = () => {
  isUnloading = true;
  flushEvents();
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    flushEvents();
  }
};

export const initBatcher = () => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeunload', handleUnload);
    window.removeEventListener('unload', handleUnload);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('unload', handleUnload);
    window.addEventListener('visibilitychange', handleVisibilityChange);
  }
};
