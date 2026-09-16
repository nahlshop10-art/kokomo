/**
 * PaikariX 1688 Importer - Page Context Extractor
 * Injected into 1688 page execution context (main world) to safely read window.context and legacy __INIT_DATA
 */
(function () {
  'use strict';

  function extractContextData() {
    try {
      // 1. Modern 1688 uses window.context (result.data)
      if (typeof window.context === 'object' && window.context !== null) {
        const result = window.context.result || {};
        const data = result.data || {};
        const global = result.global || {};
        let rootData = null;
        if (data.Root && data.Root.fields && data.Root.fields.dataJson) {
          try {
            rootData = typeof data.Root.fields.dataJson === 'string'
              ? JSON.parse(data.Root.fields.dataJson)
              : data.Root.fields.dataJson;
          } catch (e) {}
        }
        return {
          source: 'window.context',
          data: data,
          global: global,
          rootData: rootData
        };
      }

      // 2. Legacy globals
      if (typeof window.__INIT_DATA === 'object' && window.__INIT_DATA !== null) {
        return { source: 'window.__INIT_DATA', ...window.__INIT_DATA };
      }
      if (typeof window.iDetailConfig === 'object' && window.iDetailConfig !== null) {
        return { source: 'window.iDetailConfig', ...window.iDetailConfig };
      }
      if (typeof window.__PAGE_DATA__ === 'object' && window.__PAGE_DATA__ !== null) {
        return { source: 'window.__PAGE_DATA__', ...window.__PAGE_DATA__ };
      }
      if (typeof window.runData === 'object' && window.runData !== null) {
        return { source: 'window.runData', ...window.runData };
      }
      if (typeof window.globalData === 'object' && window.globalData !== null) {
        return { source: 'window.globalData', globalData: window.globalData };
      }
    } catch (e) {
      console.warn('[PaikariX 1688 Extractor] Failed to read page context data:', e);
    }
    return null;
  }

  function syncDataToDomAndMessage() {
    const extracted = extractContextData();
    if (!extracted) return;

    try {
      let el = document.getElementById('__paikarix_1688_data__');
      if (!el) {
        el = document.createElement('script');
        el.id = '__paikarix_1688_data__';
        el.type = 'application/json';
        (document.documentElement || document.head || document.body).appendChild(el);
      }
      el.textContent = JSON.stringify(extracted);
    } catch (e) {}

    window.postMessage({
      type: 'PAIKARIX_PAGE_EXTRACTOR_READY',
      data: extracted
    }, '*');
  }

  // Listen for requests from content.js
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'PAIKARIX_REQUEST_PAGE_DATA') {
      const data = extractContextData();
      if (data) {
        try {
          let el = document.getElementById('__paikarix_1688_data__');
          if (!el) {
            el = document.createElement('script');
            el.id = '__paikarix_1688_data__';
            el.type = 'application/json';
            (document.documentElement || document.head || document.body).appendChild(el);
          }
          el.textContent = JSON.stringify(data);
        } catch (e) {}
      }
      window.postMessage({
        type: 'PAIKARIX_RESPONSE_PAGE_DATA',
        data: data
      }, '*');
    }
  });

  // Run immediately
  syncDataToDomAndMessage();

  // Retry polling over initial render lifecycle in case window.context is assigned shortly after scripts initialize
  const delays = [100, 300, 800, 1500, 3000];
  delays.forEach(ms => setTimeout(syncDataToDomAndMessage, ms));
})();
