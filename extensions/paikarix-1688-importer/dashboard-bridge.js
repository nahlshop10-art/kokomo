/**
 * PaikariX 1688 Importer - Dashboard Bridge Content Script
 * Injected on PaikariX Dashboard domains (localhost, pages.dev, paikarix.com)
 * Relays import payloads from background script to web application with reliable handshake.
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__PAIKARIX_DASHBOARD_BRIDGE_INJECTED__) return;
  window.__PAIKARIX_DASHBOARD_BRIDGE_INJECTED__ = true;

  function dispatchToDashboard(payload) {
    if (!payload) return;
    console.log('[PaikariX Bridge] Dispatching product to dashboard:', payload);

    // 1. Dispatch via window.postMessage
    window.postMessage({
      source: 'paikarix-1688-importer',
      type: 'PAIKARIX_1688_IMPORT',
      payload: payload
    }, '*');

    // 2. Dispatch via CustomEvent
    window.dispatchEvent(new CustomEvent('paikarix-1688-import', {
      detail: payload
    }));
  }

  // 1. Listen for live runtime messages from background service worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'PAIKARIX_1688_IMPORT') {
      dispatchToDashboard(message.payload);
      sendResponse({ success: true });
      return true;
    }
  });

  // 2. Check for pending imports stored in chrome.storage.local
  function checkAndDeliverPendingImports() {
    chrome.storage.local.get(['pendingImport'], (result) => {
      if (result && result.pendingImport) {
        const payload = result.pendingImport;
        dispatchToDashboard(payload);
      }
    });
  }

  // Check on load
  if (document.readyState === 'complete') {
    checkAndDeliverPendingImports();
  } else {
    window.addEventListener('load', checkAndDeliverPendingImports);
  }

  // 3. Bidirectional handshake listener with dashboard application
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'paikarix-dashboard') return;

    // Dashboard requesting pending import upon mounting/login
    if (event.data.type === 'REQUEST_PENDING_IMPORT') {
      checkAndDeliverPendingImports();
    }

    // Dashboard acknowledged receipt of import
    if (event.data.type === 'PAIKARIX_IMPORT_ACK') {
      chrome.storage.local.remove(['pendingImport']);
      console.log('[PaikariX Bridge] Import acknowledged by dashboard, storage cleared.');
    }

    // Ping / Pong
    if (event.data.type === 'PING') {
      window.postMessage({
        source: 'paikarix-1688-importer',
        type: 'PONG',
        version: '1.1.0'
      }, '*');
    }
  });

  // Announce bridge presence to dashboard
  setTimeout(() => {
    window.postMessage({
      source: 'paikarix-1688-importer',
      type: 'BRIDGE_READY',
      version: '1.1.0'
    }, '*');
  }, 300);

})();
