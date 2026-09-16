/**
 * PaikariX 1688 Importer - Background Service Worker
 * Manages tab switching, communication between 1688 and PaikariX Dashboard.
 */

const DEFAULT_DASHBOARD_URL = 'http://localhost:3000';

// Match patterns that indicate a PaikariX Dashboard tab
function isDashboardUrl(url, configuredUrl) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    if (u.hostname.endsWith('.pages.dev')) return true;
    if (u.hostname.endsWith('paikarix.com')) return true;
    if (configuredUrl) {
      const c = new URL(configuredUrl);
      if (u.origin === c.origin) return true;
    }
  } catch (e) {}
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'IMPORT_PRODUCT') {
    const productData = request.data;

    chrome.storage.local.get(['dashboardUrl'], (result) => {
      const targetUrl = result.dashboardUrl || DEFAULT_DASHBOARD_URL;

      chrome.tabs.query({}, (tabs) => {
        const dashboardTab = tabs.find(t => isDashboardUrl(t.url, targetUrl));

        if (dashboardTab && dashboardTab.id) {
          // Switch to existing dashboard tab
          chrome.tabs.update(dashboardTab.id, { active: true });
          if (dashboardTab.windowId) {
            chrome.windows.update(dashboardTab.windowId, { focused: true });
          }

          // Try sending directly to content script
          chrome.tabs.sendMessage(dashboardTab.id, {
            type: 'PAIKARIX_1688_IMPORT',
            payload: productData
          }, () => {
            if (chrome.runtime.lastError) {
              // Fallback: store as pending import and reload tab if needed
              chrome.storage.local.set({ pendingImport: productData });
            }
          });

          sendResponse({ success: true, tabId: dashboardTab.id, opened: false });
        } else {
          // Store pending import and open dashboard
          chrome.storage.local.set({ pendingImport: productData }, () => {
            chrome.tabs.create({ url: targetUrl }, (newTab) => {
              sendResponse({ success: true, tabId: newTab.id, opened: true });
            });
          });
        }
      });
    });

    return true; // Keep sendResponse channel open for async execution
  }
});
