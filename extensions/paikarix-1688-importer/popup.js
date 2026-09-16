/**
 * PaikariX 1688 Importer - Popup Script
 */

document.addEventListener('DOMContentLoaded', () => {
  const loadingBox = document.getElementById('content-loading');
  const productBox = document.getElementById('content-product');
  const emptyBox = document.getElementById('content-empty');
  const badge = document.getElementById('connection-badge');

  const productIdEl = document.getElementById('product-id');
  const productPriceEl = document.getElementById('product-price');
  const productTitleEl = document.getElementById('product-title');
  const statImagesEl = document.getElementById('stat-images');
  const statVariantsEl = document.getElementById('stat-variants');
  const btnImportNow = document.getElementById('btn-import-now');

  const settingsToggle = document.getElementById('settings-toggle');
  const settingsBody = document.getElementById('settings-body');
  const inputDashboardUrl = document.getElementById('input-dashboard-url');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const linkOpenDashboard = document.getElementById('link-open-dashboard');
  const toast = document.getElementById('toast');

  let currentProductData = null;
  let currentActiveTab = null;

  // Show Toast
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2200);
  }

  // Load Settings
  chrome.storage.local.get(['dashboardUrl'], (result) => {
    inputDashboardUrl.value = result.dashboardUrl || 'https://kokomo-1r0.pages.dev/admin';
  });

  // Toggle Settings
  settingsToggle.addEventListener('click', () => {
    settingsBody.classList.toggle('hidden');
  });

  // Save Settings
  btnSaveSettings.addEventListener('click', () => {
    const val = inputDashboardUrl.value.trim() || 'https://kokomo-1r0.pages.dev/admin';
    chrome.storage.local.set({ dashboardUrl: val }, () => {
      showToast('Dashboard URL saved!');
    });
  });

  // Open Dashboard Link
  linkOpenDashboard.addEventListener('click', () => {
    chrome.storage.local.get(['dashboardUrl'], (result) => {
      const url = result.dashboardUrl || 'https://kokomo-1r0.pages.dev/admin';
      chrome.tabs.create({ url });
    });
  });

  // Check Active Tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      showEmpty();
      return;
    }

    currentActiveTab = tabs[0];
    const url = currentActiveTab.url || '';

    const is1688 = url.includes('1688.com/offer/') || url.includes('detail.1688.com');

    if (!is1688) {
      badge.textContent = 'Standby';
      badge.className = 'badge badge-gray';
      showEmpty();
      return;
    }

    badge.textContent = '1688 Connected';
    badge.className = 'badge badge-green';

    // Request product data from content script
    chrome.tabs.sendMessage(currentActiveTab.id, { action: 'GET_1688_PRODUCT_DATA' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.product) {
        // Fallback: parse basic URL info
        const idMatch = url.match(/\/offer\/(\d+)\.html/);
        const code = idMatch ? idMatch[1] : '';
        if (code) {
          showProduct({
            code1688: code,
            title: currentActiveTab.title ? currentActiveTab.title.replace(/\s*-\s*阿里巴巴.*$/, '').trim() : '1688 Product',
            autoPrice: '',
            images: [],
            variants: [],
            link1688: url
          });
        } else {
          showEmpty();
        }
        return;
      }

      showProduct(response.product);
    });
  });

  function showProduct(product) {
    currentProductData = product;
    loadingBox.classList.add('hidden');
    emptyBox.classList.add('hidden');
    productBox.classList.remove('hidden');

    productIdEl.textContent = product.code1688 ? `#${product.code1688}` : '#1688';
    productPriceEl.textContent = product.autoPrice ? `¥${product.autoPrice}` : '¥--';
    productTitleEl.textContent = product.title || 'Untitled Product';
    statImagesEl.textContent = String(product.images?.length || 0);
    statVariantsEl.textContent = String(product.variants?.length || 0);
  }

  function showEmpty() {
    loadingBox.classList.add('hidden');
    productBox.classList.add('hidden');
    emptyBox.classList.remove('hidden');
  }

  // Handle Import Button Click
  btnImportNow.addEventListener('click', () => {
    if (!currentProductData) return;

    btnImportNow.disabled = true;
    btnImportNow.innerHTML = '<span>Importing...</span>';

    // Relay through background script
    chrome.runtime.sendMessage({
      action: 'IMPORT_PRODUCT',
      data: currentProductData
    }, (response) => {
      btnImportNow.disabled = false;
      btnImportNow.innerHTML = '<span>Imported to PaikariX!</span>';
      showToast('Product sent to PaikariX!');
      setTimeout(() => {
        window.close();
      }, 1000);
    });
  });

});
