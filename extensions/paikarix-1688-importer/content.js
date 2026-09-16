/**
 * PaikariX 1688 Importer - Content Script
 * Runs on 1688 product detail pages.
 * Extracts title, RMB price, master 1200x1200 gallery images, color variants & photos,
 * and communicates directly with PaikariX Dashboard.
 */

(function () {
  'use strict';

  // Prevent double injection
  if (window.__PAIKARIX_1688_INJECTED__) return;
  window.__PAIKARIX_1688_INJECTED__ = true;

  let pageContextData = null;

  // 1. Inject page-extractor.js into page context to access window.__INIT_DATA
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('page-extractor.js');
    script.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {
    console.warn('[PaikariX 1688] Page extractor injection note:', e);
  }

  // Listen for data from page-extractor.js
  window.addEventListener('message', function (event) {
    if (event.data) {
      if (event.data.type === 'PAIKARIX_PAGE_EXTRACTOR_READY' || event.data.type === 'PAIKARIX_RESPONSE_PAGE_DATA') {
        if (event.data.data) {
          pageContextData = event.data.data;
          updatePreviewBadge();
        }
      }
    }
  });

  // Request page data
  function requestPageContextData() {
    window.postMessage({ type: 'PAIKARIX_REQUEST_PAGE_DATA' }, '*');
  }
  requestPageContextData();
  setTimeout(requestPageContextData, 1000);

  // 2. High-resolution Alibaba CDN Image Cleaner
  // Strips thumbnail suffixes like _300x300.jpg, _.webp, _sum.jpg, .search.jpg, etc., to fetch 1200x1200 master pictures
  function cleanAlibabaImageUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let url = rawUrl.trim();
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }

    // Strip URL query parameters
    url = url.split('?')[0];

    const isAlibaba = url.includes('alicdn.com') || url.includes('cbu01') || url.includes('1688.com');
    if (!isAlibaba) {
      return url;
    }

    // Reject SVGs and UI sprite icons
    if (url.toLowerCase().endsWith('.svg') || url.includes('-tps-')) {
      return '';
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
    url = url.replace(/(_\d+x\d+[^.]*(\.[a-z0-9]+)?|_\.webp|_sum\.jpg)$/i, '');

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

  // 3. Fallback extraction from in-DOM script tags
  function extractScriptTagData() {
    if (pageContextData) return pageContextData;
    const scripts = document.querySelectorAll('script');
    for (let i = 0; i < scripts.length; i++) {
      const text = scripts[i].textContent || '';
      if (text.includes('__INIT_DATA')) {
        const match = text.match(/__INIT_DATA\s*=\s*(\{.+?\});?\s*(?:var|<\/script>|\n|$)/s);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch (e) {}
        }
      }
      if (text.includes('iDetailConfig')) {
        const match = text.match(/iDetailConfig\s*=\s*(\{.+?\});?\s*(?:var|<\/script>|\n|$)/s);
        if (match) {
          try {
            return JSON.parse(match[1]);
          } catch (e) {}
        }
      }
    }
    return null;
  }

  // 4. Extract 1688 Offer ID & Canonical Link
  function extractOfferId() {
    const url = window.location.href;
    const match = url.match(/\/offer\/(\d+)\.html/) || url.match(/[?&]offerId=(\d+)/) || url.match(/(\d{9,15})/);
    return match ? match[1] : '';
  }

  // Helper to filter out UI sprites, arrows, badges and icons
  function isProductPhoto(u) {
    if (!u || typeof u !== 'string') return false;
    const lower = u.toLowerCase();
    if (lower.endsWith('.svg') || lower.includes('.svg?') || lower.includes('-tps-')) return false;
    if (lower.includes('avatar') || lower.includes('badge') || lower.includes('icon') || lower.includes('arrow') || lower.includes('button')) {
      return false;
    }
    if (lower.includes('15-8') || lower.includes('16-16') || lower.includes('24-24') || lower.includes('16x16') || lower.includes('24x24') || lower.includes('32x32')) {
      return false;
    }
    return true;
  }

  // 5. Main Extraction Routine
  function extract1688Product() {
    const data = pageContextData || extractScriptTagData();
    const offerId = extractOfferId();
    const link1688 = offerId ? `https://detail.1688.com/offer/${offerId}.html` : window.location.href.split('?')[0];

    // --- A. TITLE ---
    let title = '';
    if (data?.data?.offerDomain?.subject) {
      title = data.data.offerDomain.subject;
    } else if (data?.globalData?.tempModel?.offerTitle) {
      title = data.globalData.tempModel.offerTitle;
    } else if (data?.tempModel?.offerTitle) {
      title = data.tempModel.offerTitle;
    } else if (data?.data?.subject) {
      title = data.data.subject;
    }

    if (!title) {
      const titleSelectors = [
        '.module-od-title',
        '.title-content',
        '.od-pc-offer-title',
        '.title-text',
        '.d-title',
        '.offer-title',
        '[class*="offer-title"]',
        'h1.title'
      ];
      for (const sel of titleSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const t = (el.innerText || el.textContent || '').trim();
          if (t && t.length > 5) {
            title = t;
            break;
          }
        }
      }
    }

    if (!title) {
      const metaTitle = document.querySelector('meta[property="og:title"]');
      if (metaTitle) title = metaTitle.getAttribute('content') || '';
    }

    if (!title) {
      title = document.title.replace(/\s*-\s*阿里巴巴.*$/, '').replace(/【.*?】/g, '').trim();
    }
    title = title.trim();

    // --- B. WHOLESALE RMB PRICE (autoPrice) ---
    let rawRmb = '';
    
    // Check ladder price in data
    const ladderPrices = data?.data?.offerDomain?.ladderPrice || data?.data?.ladderPrice;
    if (Array.isArray(ladderPrices) && ladderPrices.length > 0 && ladderPrices[0].price) {
      rawRmb = String(ladderPrices[0].price);
    }

    // Check tempModel price
    if (!rawRmb && data?.globalData?.tempModel?.price) {
      rawRmb = String(data.globalData.tempModel.price);
    }
    if (!rawRmb && data?.tempModel?.price) {
      rawRmb = String(data.tempModel.price);
    }
    if (!rawRmb && data?.data?.offerDomain?.skuModel?.priceRange) {
      rawRmb = String(data.data.offerDomain.skuModel.priceRange);
    }
    if (!rawRmb && data?.data?.offerDomain?.priceDisplayModel?.price) {
      rawRmb = String(data.data.offerDomain.priceDisplayModel.price);
    }

    // Check DOM prices (including modern 1688 selectors and stripping whitespace)
    if (!rawRmb) {
      const priceSelectors = [
        '.price-info',
        '.price-comp',
        '.od-price-container .currency',
        '.od-price-container',
        '.module-od-main-price',
        '.price-component',
        '.price-text',
        '.od-pc-offer-price',
        '.price-num',
        '.value-price',
        '.ladder-price-item .price',
        '.price-original',
        '.discountPrice',
        '.price-item .price',
        '.item-price-stock'
      ];
      for (const sel of priceSelectors) {
        const els = Array.from(document.querySelectorAll(sel));
        for (const el of els) {
          const compacted = (el.innerText || el.textContent || '').replace(/\s+/g, '');
          const match = compacted.match(/(?:¥|￥)?([0-9]+(?:\.[0-9]+)?)/);
          if (match && parseFloat(match[1]) > 0) {
            rawRmb = match[1];
            break;
          }
        }
        if (rawRmb) break;
      }
    }

    let autoPrice = undefined;
    if (rawRmb) {
      const cleanMatch = String(rawRmb).replace(/[^\d.]/g, '').match(/\d+(?:\.\d+)?/);
      if (cleanMatch) {
        const val = parseFloat(cleanMatch[0]);
        if (!isNaN(val) && val > 0) autoPrice = val;
      }
    }

    // --- C. MASTER GALLERY IMAGES (1200x1200) ---
    const imageSet = new Set();

    // From Data
    const dataImages = data?.data?.offerDomain?.image?.images || 
      data?.data?.offerImgList ||
      data?.globalData?.tempModel?.offerImgList || 
      data?.tempModel?.offerImgList || 
      [];
    if (Array.isArray(dataImages)) {
      dataImages.forEach(img => {
        if (isProductPhoto(img)) {
          const clean = cleanAlibabaImageUrl(img);
          if (clean) imageSet.add(clean);
        }
      });
    }

    // From DOM Gallery (targeting actual product image gallery containers)
    const galleryImgElements = document.querySelectorAll(
      '.module-od-picture-gallery img, .od-picture-gallery-section img, .detail-gallery-turn-wrapper img, .od-gallery-img, .vertical-img-list img, .tab-trigger img, .mod-detail-gallery img, ul.nav-tabs img, .detail-gallery img'
    );
    galleryImgElements.forEach(img => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-lazyload-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
      if (src && (src.includes('alicdn.com') || src.includes('cbu01')) && isProductPhoto(src)) {
        const clean = cleanAlibabaImageUrl(src);
        if (clean) imageSet.add(clean);
      }
    });

    // Fallback: any ibank images in page
    if (imageSet.size === 0) {
      document.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || img.getAttribute('data-src') || img.src || '';
        if (src && (src.includes('alicdn.com/img/ibank/') || src.includes('cbu01.alicdn.com')) && isProductPhoto(src)) {
          const clean = cleanAlibabaImageUrl(src);
          if (clean) imageSet.add(clean);
        }
      });
    }

    // --- D. COLOR VARIANTS & PHOTOS ---
    const options = [];
    const variants = [];
    const colorItems = [];

    // Check SKU props in Data
    const skuProps = data?.data?.offerDomain?.skuModel?.skuProps || 
      data?.globalData?.tempModel?.skuProps || 
      data?.skuProps || 
      [];
    
    // Check skuInfoMap for SKU-specific prices
    const skuInfoMap = data?.data?.offerDomain?.skuModel?.skuInfoMap || 
      data?.skuModel?.skuInfoMap || 
      data?.globalData?.tempModel?.skuInfoMap || 
      null;

    let optionGroupName = 'color';

    if (Array.isArray(skuProps) && skuProps.length > 0) {
      const colorProp = skuProps.find(p => /颜色|款式|规格|花色|color|size|style/i.test(p.prop || p.name || '')) || skuProps[0];
      if (colorProp) {
        const pName = colorProp.prop || colorProp.name || '';
        optionGroupName = /颜色|color/i.test(pName) ? 'color' :
                          /规格|size/i.test(pName) ? 'size' :
                          /款式|style/i.test(pName) ? 'style' : (pName || 'color');
      }
      if (colorProp && Array.isArray(colorProp.value)) {
        colorProp.value.forEach(item => {
          let name = (item.name || item.propValue || '').trim();
          name = name.split(/[\r\n¥￥]/)[0].trim();
          const imgUrl = cleanAlibabaImageUrl(item.imageUrl || item.image || '');

          let vPrice = undefined;
          if (item.price) {
            const vClean = String(item.price).replace(/[^\d.]/g, '').match(/\d+(?:\.\d+)?/);
            if (vClean) vPrice = parseFloat(vClean[0]);
          } else if (skuInfoMap) {
            const skuObj = skuInfoMap[item.specId] || skuInfoMap[item.skuId] || skuInfoMap[name];
            if (skuObj && skuObj.price) {
              const vClean = String(skuObj.price).replace(/[^\d.]/g, '').match(/\d+(?:\.\d+)?/);
              if (vClean) vPrice = parseFloat(vClean[0]);
            }
          }

          if (name) {
            colorItems.push({ name, image: imgUrl, price: vPrice });
          }
        });
      }
    }

    // Modern 1688 DOM structure (.module-od-sku-selection, .expand-view-item)
    if (colorItems.length === 0) {
      const skuContainers = document.querySelectorAll('.module-od-sku-selection .feature-item, [class*="sku-selection"] .feature-item, .feature-item');
      if (skuContainers.length > 0) {
        skuContainers.forEach(container => {
          const groupHeader = container.querySelector('.feature-item-label, h3, [class*="feature-item-label"]');
          if (groupHeader) {
            const headerText = (groupHeader.innerText || groupHeader.textContent || '').trim();
            if (headerText) {
              optionGroupName = /颜色|color/i.test(headerText) ? 'color' :
                                /规格|size/i.test(headerText) ? 'size' :
                                /款式|style/i.test(headerText) ? 'style' : headerText.toLowerCase();
            }
          }

          const items = container.querySelectorAll('.expand-view-item, [class*="expand-view-item"], .sku-item');
          items.forEach(el => {
            const labelEl = el.querySelector('.item-label, [class*="item-label"], .name, .title');
            let name = labelEl ? (labelEl.getAttribute('title') || labelEl.innerText) : el.innerText;
            if (name) {
              name = name.split(/[\r\n¥￥]/)[0].trim();
            }

            let imgUrl = '';
            const imgEl = el.querySelector('img');
            if (imgEl) {
              const raw = imgEl.src || imgEl.getAttribute('data-src') || '';
              imgUrl = cleanAlibabaImageUrl(raw);
            }

            let vPrice = undefined;
            const priceEl = el.querySelector('.item-price-stock, [class*="item-price"], [class*="price"]');
            if (priceEl) {
              const compacted = (priceEl.innerText || '').replace(/\s+/g, '');
              const m = compacted.match(/(?:¥|￥)?([0-9]+(?:\.[0-9]+)?)/);
              if (m && parseFloat(m[1]) > 0) {
                vPrice = parseFloat(m[1]);
              }
            }

            if (name && !colorItems.some(c => c.name === name)) {
              colorItems.push({ name, image: imgUrl, price: vPrice });
            }
          });
        });
      }
    }

    // Classic DOM fallback
    if (colorItems.length === 0) {
      const skuElements = document.querySelectorAll('.sku-item, .prop-item, .od-pc-attribute-item, .list-leading-item, .sku-prop-list li');
      skuElements.forEach(el => {
        let name = el.getAttribute('title') || 
          el.querySelector('.name, .title, .prop-name, [class*="sku-name"], [class*="prop-name"]')?.innerText || 
          el.innerText.trim();
        name = name.split(/[\r\n¥￥]/)[0].trim();

        let imgUrl = '';
        const img = el.querySelector('img');
        if (img) {
          imgUrl = cleanAlibabaImageUrl(img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '');
        } else {
          const bg = el.getAttribute('style') || '';
          const bgMatch = bg.match(/url\(["']?([^"']+)["']?\)/);
          if (bgMatch) {
            imgUrl = cleanAlibabaImageUrl(bgMatch[1]);
          }
        }

        if (name && !colorItems.some(c => c.name === name)) {
          colorItems.push({ name, image: imgUrl, price: undefined });
        }
      });
    }

    // If autoPrice was not found from main price elements, use the first variant's price!
    if (autoPrice === undefined && colorItems.length > 0 && colorItems[0].price !== undefined) {
      autoPrice = colorItems[0].price;
    }

    // Add variant photos to gallery
    colorItems.forEach(c => {
      if (c.image) {
        imageSet.add(c.image);
      }
    });

    const images = Array.from(imageSet);

    // Populate options and variants
    if (colorItems.length > 0) {
      const optionId = 'opt_' + (optionGroupName || 'color');
      options.push({
        id: optionId,
        name: optionGroupName || 'color',
        values: colorItems.map(c => c.name)
      });

      colorItems.forEach(c => {
        const itemAutoPrice = c.price !== undefined ? c.price : autoPrice;
        variants.push({
          id: Math.random().toString(36).substring(2, 11),
          options: { [optionId]: c.name },
          image: c.image || images[0] || '',
          autoPrice: itemAutoPrice !== undefined ? String(itemAutoPrice) : undefined,
          stock: 100,
          isVisible: true
        });
      });
    }

    // --- E. SUPPLIER / COMPANY INFO ---
    let supplier = '';
    if (data?.data?.offerDomain?.seller?.companyName) {
      supplier = data.data.offerDomain.seller.companyName;
    } else if (data?.globalData?.companyName) {
      supplier = data.globalData.companyName;
    } else if (data?.data?.company?.name) {
      supplier = data.data.company.name;
    } else if (data?.tempModel?.seller?.companyName) {
      supplier = data.tempModel.seller.companyName;
    }
    if (!supplier) {
      const compSelectors = [
        '.winport-title',
        '.company-name',
        '.shop-name',
        '.supplier-name',
        '.od-pc-offer-company-name',
        '[class*="company-name"]',
        '[class*="shop-name"]'
      ];
      for (const sel of compSelectors) {
        const compEl = document.querySelector(sel);
        if (compEl) {
          const s = (compEl.innerText || compEl.getAttribute('title') || compEl.textContent || '').trim();
          if (s) {
            supplier = s;
            break;
          }
        }
      }
    }

    // --- F. DESCRIPTION / SPECIFICATIONS ---
    let description = '';
    const attrs = data?.data?.offerDomain?.attributes || data?.globalData?.attributes || [];
    if (Array.isArray(attrs) && attrs.length > 0) {
      const attrLines = attrs
        .filter(a => (a.attributeName || a.name) && (a.value || a.attributeValue))
        .map(a => `${a.attributeName || a.name}: ${a.value || a.attributeValue}`)
        .slice(0, 15);
      if (attrLines.length > 0) {
        description = attrLines.join('\n');
      }
    }

    return {
      title,
      code1688: offerId,
      link1688,
      autoPrice,
      images,
      options,
      variants,
      supplier,
      description,
      stock: variants.length > 0 ? undefined : 100
    };
  }

  // 6. UI Floating Button Injection
  let floatingBtn = null;
  let previewCard = null;

  function createFloatingButton() {
    if (document.getElementById('paikarix-1688-floating-root')) return;

    const root = document.createElement('div');
    root.id = 'paikarix-1688-floating-root';
    root.className = 'paikarix-ext-root';

    root.innerHTML = `
      <div id="paikarix-preview-card" class="paikarix-preview-card paikarix-hidden">
        <div class="paikarix-preview-header">
          <div class="paikarix-logo-badge">PKX</div>
          <div class="paikarix-preview-title-box">
            <span class="paikarix-tag">1688 Ready</span>
            <span id="paikarix-card-id" class="paikarix-id-text">#${extractOfferId()}</span>
          </div>
        </div>
        <div id="paikarix-card-title" class="paikarix-title-text">Extracting title...</div>
        <div class="paikarix-meta-row">
          <div class="paikarix-meta-item">
            <span class="paikarix-meta-label">RMB Price</span>
            <span id="paikarix-card-price" class="paikarix-meta-val">¥--</span>
          </div>
          <div class="paikarix-meta-item">
            <span class="paikarix-meta-label">Master Images</span>
            <span id="paikarix-card-images" class="paikarix-meta-val">0</span>
          </div>
          <div class="paikarix-meta-item">
            <span class="paikarix-meta-label">Variants</span>
            <span id="paikarix-card-variants" class="paikarix-meta-val">0</span>
          </div>
        </div>
      </div>

      <button id="paikarix-floating-btn" class="paikarix-floating-btn" title="Click to send this product to PaikariX Dashboard">
        <div class="paikarix-btn-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14"/>
            <path d="m12 5 7 7-7 7"/>
          </svg>
        </div>
        <div class="paikarix-btn-content">
          <span class="paikarix-btn-title">Send to PaikariX</span>
          <span id="paikarix-btn-sub" class="paikarix-btn-subtitle">Wholesale 1-Click</span>
        </div>
      </button>
    `;

    document.body.appendChild(root);

    floatingBtn = document.getElementById('paikarix-floating-btn');
    previewCard = document.getElementById('paikarix-preview-card');

    // Hover to preview
    floatingBtn.addEventListener('mouseenter', () => {
      updatePreviewBadge();
      previewCard.classList.remove('paikarix-hidden');
    });

    root.addEventListener('mouseleave', () => {
      previewCard.classList.add('paikarix-hidden');
    });

    // Click to Import
    floatingBtn.addEventListener('click', handleImportClick);
  }

  function updatePreviewBadge() {
    try {
      const product = extract1688Product();
      const idEl = document.getElementById('paikarix-card-id');
      const titleEl = document.getElementById('paikarix-card-title');
      const priceEl = document.getElementById('paikarix-card-price');
      const imgEl = document.getElementById('paikarix-card-images');
      const varEl = document.getElementById('paikarix-card-variants');

      if (idEl) idEl.textContent = product.code1688 ? `#${product.code1688}` : '';
      if (titleEl) titleEl.textContent = product.title ? (product.title.length > 50 ? product.title.slice(0, 50) + '...' : product.title) : 'Untitled Product';
      if (priceEl) priceEl.textContent = product.autoPrice ? `¥${product.autoPrice}` : '¥--';
      if (imgEl) imgEl.textContent = String(product.images.length);
      if (varEl) varEl.textContent = String(product.variants.length);
    } catch (e) {}
  }

  function handleImportClick() {
    const btn = document.getElementById('paikarix-floating-btn');
    const sub = document.getElementById('paikarix-btn-sub');
    if (!btn) return;

    btn.classList.add('paikarix-loading');
    if (sub) sub.textContent = 'Extracting...';

    // Refresh extraction
    const product = extract1688Product();

    if (!product.code1688 && !product.title) {
      alert('Could not detect 1688 product information on this page. Please make sure the offer page has finished loading.');
      btn.classList.remove('paikarix-loading');
      if (sub) sub.textContent = 'Wholesale 1-Click';
      return;
    }

    if (sub) sub.textContent = 'Sending...';

    // Send to background service worker
    chrome.runtime.sendMessage({
      action: 'IMPORT_PRODUCT',
      data: product
    }, (response) => {
      btn.classList.remove('paikarix-loading');
      if (response && response.success) {
        btn.classList.add('paikarix-success');
        if (sub) sub.textContent = 'Sent to Dashboard!';
        setTimeout(() => {
          btn.classList.remove('paikarix-success');
          if (sub) sub.textContent = 'Wholesale 1-Click';
        }, 3500);
      } else {
        // Fallback notification
        btn.classList.add('paikarix-success');
        if (sub) sub.textContent = 'Dashboard Opened!';
        setTimeout(() => {
          btn.classList.remove('paikarix-success');
          if (sub) sub.textContent = 'Wholesale 1-Click';
        }, 3500);
      }
    });
  }

  // 7. Message listener for extension popup queries
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.action === 'GET_1688_PRODUCT_DATA') {
        const product = extract1688Product();
        sendResponse({ success: true, product });
        return true;
      }
      if (request && request.action === 'TRIGGER_IMPORT') {
        handleImportClick();
        sendResponse({ success: true });
        return true;
      }
    });
  }

  // Inject floating button when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
  } else {
    createFloatingButton();
  }

  // Periodic check to ensure button remains visible after dynamic page loads and track SPA URL changes
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      pageContextData = null;
      requestPageContextData();
      updatePreviewBadge();
    }
    if (!document.getElementById('paikarix-1688-floating-root')) {
      createFloatingButton();
    }
  }, 1500);

})();
