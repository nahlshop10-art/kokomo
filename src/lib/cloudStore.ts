import { Product, Order, IncompleteOrder, WebsiteSettings, CourierSettings, PriceCalculatorSettings, MarketingSettings, Category } from '../types';

/**
 * CloudStore client to sync data with Cloudflare D1 Backend
 */
export const cloudStore = {
  emitEvent(message: string | null, isSuccess: boolean = false, isError: boolean = false) {
    if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('admin-loading', {
         detail: { message, isSuccess, isError }
       }));
    }
  },

  _getHeaders(): Record<string, string> {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      // Cookies are automatically sent by the browser. 
      // We keep localStorage 'paikarix_current_admin' for UI state only.
      return headers;
  },
  async loginAdmin(email: string, password: string) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  },
  async logoutAdmin() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout failed', e);
    }
  },
  async registerAdmin(email: string, password: string) {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      return await res.json();
    } catch (e) {
      return { success: false, error: 'Network error' };
    }
  },
  async getState() {
    try {
      const res = await fetch('/api/public_state');
      if (!res.ok) throw new Error('API fetch failed');
      return await res.json();
    } catch (e) {
      console.warn('Failed to load state from Cloudflare, returning empty state.');
      return null;
    }
  },

  async getAdmins() {
    try {
      const res = await fetch('/api/get_admins', { headers: this._getHeaders() });
      if (!res.ok) throw new Error('API fetch failed');
      return await res.json();
    } catch (e) {
      console.error(e);
      return null;
    }
  },

        async publicCancelOrder(orderId: string, customerPhone: string) {
    this.emitEvent('Canceling order...');
    const res = await fetch('/api/public_cancel_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, customerPhone })
    });
    if (!res.ok) {
       this.emitEvent('Failed to cancel order', false, true);
       throw new Error('Cancel order API failed');
    }
    const data = await res.json();
    this.emitEvent('Order canceled ✅', true);
    return data;
  },

  async publicAddToOrder(payload: any) {
    this.emitEvent('Updating order...');
    const res = await fetch('/api/public_add_to_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
       this.emitEvent('Failed to update order', false, true);
       throw new Error('Update order API failed');
    }
    const data = await res.json();
    this.emitEvent('Order updated ✅', true);
    return data;
  },

  async publicCheckout(payload: any) {
    this.emitEvent('Processing order...');
    const res = await fetch('/api/public_checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
       this.emitEvent('Checkout failed', false, true);
       let errorMsg = 'Checkout API failed';
       try {
         const errJson = await res.json();
         if (errJson && errJson.error) errorMsg = errJson.error;
       } catch (e) {}
       throw new Error(errorMsg);
    }
    const data = await res.json();
    this.emitEvent('Order placed ✅', true);
    return data;
  },

  async getAdminOrders(params: { page: number; limit: number; search: string; status: string; startDate: string; endDate: string }) {
    try {
      const query = new URLSearchParams({
        page: params.page.toString(),
        limit: params.limit.toString(),
        search: params.search,
        status: params.status,
        startDate: params.startDate,
        endDate: params.endDate
      }).toString();
      const res = await fetch(`/api/admin_orders?${query}`, { headers: this._getHeaders() });
      if (!res.ok) throw new Error('API fetch failed');
      return await res.json();
    } catch (e) {
      console.warn('Failed to load admin orders from Cloudflare');
      return null;
    }
  },

  async getAdminState() {
    try {
      const res = await fetch('/api/admin_state', { headers: this._getHeaders() });
      if (!res.ok) throw new Error('API fetch failed');
      return await res.json();
    } catch (e) {
      console.warn('Failed to load admin state from Cloudflare');
      return null;
    }
  },

  async getMyOrders(orderIds: string[]) {
    if (orderIds.length === 0) return [];
    try {
      const res = await fetch('/api/get_my_orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.orders || [];
    } catch (e) {
      return [];
    }
  },

  async upsertProduct(product: Product) {
    this.emitEvent('Saving product to Cloudflare D1...');
    const result = await this._post('/api/products', { items: [product], action: 'upsert' });
    if (result.success) this.emitEvent('Completed ✅', true);
    else this.emitEvent('Failed to save product', false, true);
    return result;
  },

  async upsertProducts(products: Product[]) {
    this.emitEvent('Saving products to Cloudflare D1...');
    const result = await this._post('/api/products', { items: products, action: 'upsert' });
    if (result.success) this.emitEvent('Completed ✅', true);
    else this.emitEvent('Failed to save products', false, true);
    return result;
  },

  async garbageCollect(urls: string[], waitAndEmit: boolean = false) {
    if (!urls || urls.length === 0) return;
    const run = async () => {
      try {
        if (waitAndEmit) this.emitEvent('Deleting unused files from Cloudflare R2...');
        await fetch('/api/gc', {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify({ urlsToCheck: urls })
        });
        if (waitAndEmit) this.emitEvent('Cleanup completed', true);
      } catch (e) {
        console.warn('GC error', e);
        if (waitAndEmit) this.emitEvent('Cleanup failed', false, true);
      }
    };
    if (waitAndEmit) {
      await run();
    } else {
      setTimeout(() => run().catch(e => console.warn('GC failed', e)), 2000);
    }
  },

  async deleteProducts(products: Product[]) {
    this.emitEvent('Deleting products...');
    const result = await this._post('/api/products', { items: products, action: 'delete' });
    
    if (!result.success) {
      this.emitEvent('Failed to delete products', false, true);
      throw new Error(result.error || 'Failed to delete products');
    }

    this.emitEvent('Completed ✅', true);
    return result;
  },

  async deleteAnalyticsItems(itemIds: string[]) {
    this.emitEvent('Updating analytics items...');
    const result = await this._post('/api/analytics_items', { action: 'delete', itemIds });
    if (!result.success) {
      this.emitEvent('Failed to update analytics items', false, true);
      throw new Error(result.error || 'Failed to update analytics items');
    }
    this.emitEvent('Completed ✅', true);
    return result;
  },

  async syncAllProducts(products: Product[], silent: boolean = false) {
    if (!silent) this.emitEvent('Syncing products to D1...');
    const res = await this._post('/api/products', { items: products, action: 'sync_all' });
    if (res.success && !silent) this.emitEvent('Completed ✅', true);
    else if (!silent) this.emitEvent('Sync Failed', false, true);
    return res;
  },

  async syncAllOrders(orders: Order[], type: 'standard' | 'incomplete', silent: boolean = false) {
    if (!silent) this.emitEvent('Syncing orders to D1...');
    const res = await this._post('/api/orders', { items: orders, type, action: 'sync_all' });
    if (res.success && !silent) this.emitEvent('Completed ✅', true);
    else if (!silent) this.emitEvent('Sync Failed', false, true);
    return res;
  },

  async upsertCustomer(customer: any) {
    // Hidden in bg, usually. Don't emit event so it doesn't interrupt checkout flow.
    // Dashboard actions doing this directly aren't there yet.
    return this._post('/api/customers', { items: [customer], action: 'upsert' });
  },

  async publicIncompleteOrder(order: any) {
    const res = await fetch('/api/public_incomplete_order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
      keepalive: true
    });
    if (!res.ok) {
       throw new Error('Incomplete order API failed');
    }
    return await res.json();
  },

  async upsertOrder(order: Order | IncompleteOrder, type: 'standard' | 'incomplete', silent = false) {
    if (!silent) this.emitEvent('Saving order to D1...');
    const res = await this._post('/api/orders', { items: [order], type, action: 'upsert' });
    if (!silent) {
       if (res.success) this.emitEvent('Completed ✅', true);
       else this.emitEvent('Save Failed', false, true);
    }
    return res;
  },

  async deleteOrder(order: Order | IncompleteOrder, type: 'standard' | 'incomplete') {
    this.emitEvent('Deleting order...');
    const result = await this._post('/api/orders', { items: [order], type, action: 'delete' });
    if (!result.success) {
      this.emitEvent('Failed to delete order', false, true);
      throw new Error(result.error || 'Failed to delete order');
    }
    this.emitEvent('Completed ✅', true);
    return result;
  },

  async saveSetting(key: string, value: any, silent: boolean = false) {
    if (!silent) this.emitEvent(`Saving ${key} settings...`);
    const res = await this._post('/api/settings', { key, value });
    if (res.success && !silent) this.emitEvent('Saved ✅', true);
    else if (!silent) this.emitEvent('Failed to save', false, true);
    return res;
  },

  async uploadFile(file: File | Blob, fileName: string, silent: boolean = false): Promise<string> {
    const formData = new FormData();
    formData.append('file', file, fileName);
    
    return new Promise((resolve, reject) => {
      if (!silent) this.emitEvent(`Uploading image... 0%`);
      const xhr = new XMLHttpRequest();
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          if (!silent) this.emitEvent(`Uploading image... ${percent}%`);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (!silent) this.emitEvent('Saving to Cloudflare R2... ✅', true);
            resolve(data.url || data.key);
          } catch (err) {
            if (!silent) this.emitEvent('Failed to parse upload response', false, true);
            reject(new Error('Parse failed'));
          }
        } else {
          if (!silent) this.emitEvent('Upload failed ❌', false, true);
          reject(new Error('Upload failed'));
        }
      };

      xhr.onerror = () => {
        if (!silent) this.emitEvent('Upload failed ❌', false, true);
        
        // Fallback for local preview if R2 is not fully setup
        const reader = new FileReader();
        reader.onloadend = () => {
           if (!silent) this.emitEvent('Fallback applied ✅', true);
           resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      };

      xhr.open('POST', '/api/upload');
      
      const headers = this._getHeaders();
      for (const key in headers) {
        if (key.toLowerCase() !== 'content-type') {
          xhr.setRequestHeader(key, headers[key]);
        }
      }

      xhr.send(formData);
    });
  },

  async _post(url: string, data: any) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e) {
       console.warn(`[CloudStore] Mutation failed for ${url}`);
       return { success: false };
    }
  }
};
