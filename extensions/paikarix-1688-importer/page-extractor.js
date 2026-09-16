/**
 * PaikariX 1688 Importer - Page Context Extractor
 * Injected into 1688 page execution context to safely read window.__INIT_DATA
 */
(function () {
  function getInitData() {
    try {
      if (typeof window.__INIT_DATA === 'object' && window.__INIT_DATA !== null) {
        return window.__INIT_DATA;
      }
      if (typeof window.iDetailConfig === 'object' && window.iDetailConfig !== null) {
        return window.iDetailConfig;
      }
      if (typeof window.__PAGE_DATA__ === 'object' && window.__PAGE_DATA__ !== null) {
        return window.__PAGE_DATA__;
      }
      if (typeof window.runData === 'object' && window.runData !== null) {
        return window.runData;
      }
    } catch (e) {
      console.warn('[PaikariX 1688 Extractor] Failed to read page context data:', e);
    }
    return null;
  }

  // Listen for requests from content.js
  window.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'PAIKARIX_REQUEST_PAGE_DATA') {
      const data = getInitData();
      window.postMessage({
        type: 'PAIKARIX_RESPONSE_PAGE_DATA',
        data: data
      }, '*');
    }
  });

  // Announce readiness
  window.postMessage({
    type: 'PAIKARIX_PAGE_EXTRACTOR_READY',
    data: getInitData()
  }, '*');
})();
