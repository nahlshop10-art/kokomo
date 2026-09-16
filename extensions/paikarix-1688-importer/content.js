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

  // 1. Listen for data from page-extractor.js (via window message and DOM event)
  window.addEventListener('message', function (event) {
    if (event.data) {
      if (event.data.type === 'PAIKARIX_PAGE_EXTRACTOR_READY' || event.data.type === 'PAIKARIX_RESPONSE_PAGE_DATA') {
        if (event.data.data) {
          pageContextData = event.data.data;
          if (typeof updateFloatingWidgetState === 'function') {
            updateFloatingWidgetState();
          }
        }
      }
    }
  });

  function requestPageContextData() {
    window.postMessage({ type: 'PAIKARIX_REQUEST_PAGE_DATA' }, '*');
  }
  requestPageContextData();
  setTimeout(requestPageContextData, 500);
  setTimeout(requestPageContextData, 1500);

  // Fallback dynamic injection of page-extractor.js if not already injected by manifest
  try {
    if (!document.getElementById('__paikarix_1688_extractor_script__')) {
      const script = document.createElement('script');
      script.id = '__paikarix_1688_extractor_script__';
      script.src = chrome.runtime.getURL('page-extractor.js');
      script.onload = function () {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    }
  } catch (e) {
    console.warn('[PaikariX 1688] Page extractor injection note:', e);
  }

  // Synchronous + Asynchronous page data retrieval
  function getPageContextData() {
    // 1. Try reading directly from DOM bridge element written by page-extractor.js in main world
    try {
      const el = document.getElementById('__paikarix_1688_data__');
      if (el && el.textContent) {
        const parsed = JSON.parse(el.textContent);
        if (parsed) return parsed;
      }
    } catch (e) {}

    // 2. In-memory pageContextData received via postMessage
    if (pageContextData) return pageContextData;

    // 3. Fallback extraction from in-DOM script tags
    return extractScriptTagData();
  }

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
    const contextObj = getPageContextData() || {};
    const offerId = extractOfferId();
    const link1688 = offerId ? `https://detail.1688.com/offer/${offerId}.html` : window.location.href.split('?')[0];

    // Unpack modern 1688 window.context or legacy data
    const moduleData = contextObj.data || contextObj;
    let rootData = contextObj.rootData || null;
    if (!rootData && moduleData?.Root?.fields?.dataJson) {
      try {
        rootData = typeof moduleData.Root.fields.dataJson === 'string'
          ? JSON.parse(moduleData.Root.fields.dataJson)
          : moduleData.Root.fields.dataJson;
      } catch (e) {}
    }

    // --- A. TITLE ---
    let title = '';
    if (moduleData?.productTitle?.fields?.title) {
      title = moduleData.productTitle.fields.title;
    } else if (moduleData?.gallery?.fields?.subject) {
      title = moduleData.gallery.fields.subject;
    } else if (rootData?.offerBaseInfo?.subject) {
      title = rootData.offerBaseInfo.subject;
    } else if (contextObj?.data?.offerDomain?.subject) {
      title = contextObj.data.offerDomain.subject;
    } else if (contextObj?.globalData?.tempModel?.offerTitle) {
      title = contextObj.globalData.tempModel.offerTitle;
    } else if (contextObj?.tempModel?.offerTitle) {
      title = contextObj.tempModel.offerTitle;
    } else if (contextObj?.data?.subject) {
      title = contextObj.data.subject;
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
    let autoPrice = undefined;

    // 1. From modern window.context originalPricesWithoutPromotion
    const origPrices = moduleData?.mainPrice?.fields?.originalPricesWithoutPromotion;
    if (Array.isArray(origPrices) && origPrices.length > 0 && origPrices[0].price) {
      const p = parseFloat(origPrices[0].price);
      if (!isNaN(p) && p > 0) autoPrice = p;
    }

    // 2. From skuParam range prices or skuPriceScale
    if (autoPrice === undefined) {
      const rangePrices = rootData?.orderParamModel?.orderParam?.skuParam?.skuRangePrices;
      if (Array.isArray(rangePrices) && rangePrices.length > 0 && rangePrices[0].price) {
        const p = parseFloat(rangePrices[0].price);
        if (!isNaN(p) && p > 0) autoPrice = p;
      }
    }
    if (autoPrice === undefined && rootData?.skuModel?.skuPriceScale) {
      const p = parseFloat(rootData.skuModel.skuPriceScale);
      if (!isNaN(p) && p > 0) autoPrice = p;
    }

    // 3. From mainPrice priceModel
    if (autoPrice === undefined && moduleData?.mainPrice?.fields?.priceModel?.price) {
      const p = parseFloat(moduleData.mainPrice.fields.priceModel.price);
      if (!isNaN(p) && p > 0) autoPrice = p;
    }
    if (autoPrice === undefined && moduleData?.mainPrice?.fields?.finalPriceModel?.price) {
      const p = parseFloat(moduleData.mainPrice.fields.finalPriceModel.price);
      if (!isNaN(p) && p > 0) autoPrice = p;
    }

    // 4. From legacy ladderPrice or tempModel
    if (autoPrice === undefined) {
      const ladderPrices = contextObj?.data?.offerDomain?.ladderPrice || contextObj?.data?.ladderPrice;
      if (Array.isArray(ladderPrices) && ladderPrices.length > 0 && ladderPrices[0].price) {
        const p = parseFloat(ladderPrices[0].price);
        if (!isNaN(p) && p > 0) autoPrice = p;
      }
    }
    if (autoPrice === undefined && contextObj?.globalData?.tempModel?.price) {
      const p = parseFloat(contextObj.globalData.tempModel.price);
      if (!isNaN(p) && p > 0) autoPrice = p;
    }
    if (autoPrice === undefined && contextObj?.tempModel?.price) {
      const p = parseFloat(contextObj.tempModel.price);
      if (!isNaN(p) && p > 0) autoPrice = p;
    }
    if (autoPrice === undefined && contextObj?.data?.offerDomain?.skuModel?.priceRange) {
      const p = parseFloat(contextObj.data.offerDomain.skuModel.priceRange);
      if (!isNaN(p) && p > 0) autoPrice = p;
    }

    // 5. From DOM prices (with whitespace compaction and range handling)
    if (autoPrice === undefined) {
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
          const matches = compacted.matchAll(/(?:¥|￥)?([0-9]+(?:\.[0-9]+)?)/g);
          const foundNums = [];
          for (const m of matches) {
            const num = parseFloat(m[1]);
            if (!isNaN(num) && num > 0) foundNums.push(num);
          }
          if (foundNums.length > 0) {
            autoPrice = Math.min(...foundNums);
            break;
          }
        }
        if (autoPrice !== undefined) break;
      }
    }

    // --- C. MASTER GALLERY IMAGES (1200x1200) ---
    const imageSet = new Set();

    // From modern gallery.fields
    const contextGallery = moduleData?.gallery?.fields?.offerImgList || moduleData?.gallery?.fields?.mainImage;
    if (Array.isArray(contextGallery)) {
      contextGallery.forEach(img => {
        if (isProductPhoto(img)) {
          const clean = cleanAlibabaImageUrl(img);
          if (clean) imageSet.add(clean);
        }
      });
    }

    // From legacy Data
    const dataImages = contextObj?.data?.offerDomain?.image?.images || 
      contextObj?.data?.offerImgList ||
      contextObj?.globalData?.tempModel?.offerImgList || 
      contextObj?.tempModel?.offerImgList || 
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

    // --- D. COLOR & SIZE VARIANTS & PHOTOS ---
    const options = [];
    const variants = [];

    // Check SKU props in modern rootData or legacy contextObj
    const skuProps = rootData?.skuModel?.skuProps ||
      moduleData?.skuModel?.skuProps ||
      contextObj?.data?.offerDomain?.skuModel?.skuProps || 
      contextObj?.globalData?.tempModel?.skuProps || 
      contextObj?.skuProps || 
      [];
    
    // Check skuInfoMap for variant-specific prices & stock
    const skuInfoMap = rootData?.skuModel?.skuInfoMap ||
      moduleData?.skuModel?.skuInfoMap ||
      contextObj?.data?.offerDomain?.skuModel?.skuInfoMap || 
      contextObj?.skuModel?.skuInfoMap || 
      contextObj?.globalData?.tempModel?.skuInfoMap || 
      null;

    if (Array.isArray(skuProps) && skuProps.length > 0) {
      // Build options list
      skuProps.forEach((prop, idx) => {
        const pName = (prop.prop || prop.name || `Option ${idx + 1}`).trim();
        const optId = 'opt_' + pName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const vals = (prop.value || [])
          .map(v => (v.name || v.propValue || '').split(/[\r\n¥￥]/)[0].trim())
          .filter(Boolean);
        if (vals.length > 0) {
          options.push({
            id: optId,
            name: pName,
            values: vals
          });
        }
      });

      // Build variants list
      if (skuProps.length === 1 && options.length === 1) {
        const prop = skuProps[0];
        const optId = options[0].id;
        (prop.value || []).forEach(item => {
          const name = (item.name || item.propValue || '').split(/[\r\n¥￥]/)[0].trim();
          if (!name) return;
          const imgUrl = cleanAlibabaImageUrl(item.imageUrl || item.image || '');
          if (imgUrl) imageSet.add(imgUrl);

          const skuEntry = skuInfoMap ? (
            skuInfoMap[name] ||
            skuInfoMap[item.specId] ||
            skuInfoMap[item.skuId] ||
            Object.values(skuInfoMap).find(s => s.specAttrs === name || s.specId === item.specId)
          ) : null;

          let vPrice = undefined;
          if (skuEntry?.price) {
            vPrice = parseFloat(skuEntry.price);
          } else if (skuEntry?.discountPrice) {
            vPrice = parseFloat(skuEntry.discountPrice);
          } else if (item.price) {
            vPrice = parseFloat(item.price);
          }

          const resolvedPrice = (vPrice !== undefined && !isNaN(vPrice)) ? vPrice : autoPrice;
          const stock = skuEntry?.canBookCount !== undefined ? skuEntry.canBookCount : 100;

          variants.push({
            id: item.skuId ? String(item.skuId) : Math.random().toString(36).substring(2, 11),
            options: { [optId]: name },
            image: imgUrl || '',
            autoPrice: resolvedPrice !== undefined ? String(resolvedPrice) : undefined,
            stock: stock,
            isVisible: true
          });
        });
      } else if (skuProps.length > 1 && options.length > 1 && skuInfoMap) {
        // Multi-dimensional variants (e.g. Color and Size)
        for (const [key, skuEntry] of Object.entries(skuInfoMap)) {
          const specAttrs = (skuEntry.specAttrs || key).trim();
          const parts = specAttrs.split(/[>&,]/).map(s => s.trim());
          const variantOptions = {};
          options.forEach((opt, oIdx) => {
            if (parts[oIdx]) {
              variantOptions[opt.id] = parts[oIdx];
            }
          });

          // Match image from first prop if available
          let imgUrl = '';
          const matchingVal = skuProps[0]?.value?.find(v => (v.name || '').trim() === parts[0]);
          if (matchingVal?.imageUrl) {
            imgUrl = cleanAlibabaImageUrl(matchingVal.imageUrl);
            if (imgUrl) imageSet.add(imgUrl);
          }

          let vPrice = undefined;
          if (skuEntry.price) vPrice = parseFloat(skuEntry.price);
          else if (skuEntry.discountPrice) vPrice = parseFloat(skuEntry.discountPrice);

          const resolvedPrice = (vPrice !== undefined && !isNaN(vPrice)) ? vPrice : autoPrice;
          const stock = skuEntry.canBookCount !== undefined ? skuEntry.canBookCount : 100;

          variants.push({
            id: skuEntry.skuId ? String(skuEntry.skuId) : Math.random().toString(36).substring(2, 11),
            options: variantOptions,
            image: imgUrl || '',
            autoPrice: resolvedPrice !== undefined ? String(resolvedPrice) : undefined,
            stock: stock,
            isVisible: true
          });
        }
      }
    }

    // Modern 1688 DOM fallback for variants (.module-od-sku-selection)
    if (variants.length === 0) {
      const skuContainers = document.querySelectorAll('.module-od-sku-selection .feature-item, [class*="sku-selection"] .feature-item, .feature-item');
      if (skuContainers.length > 0) {
        const domColorItems = [];
        let optionGroupName = 'color';

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
              if (imgUrl) imageSet.add(imgUrl);
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

            if (name && !domColorItems.some(c => c.name === name)) {
              domColorItems.push({ name, image: imgUrl, price: vPrice });
            }
          });
        });

        if (domColorItems.length > 0) {
          const optId = 'opt_' + (optionGroupName || 'color');
          options.push({
            id: optId,
            name: optionGroupName || 'color',
            values: domColorItems.map(c => c.name)
          });
          domColorItems.forEach(c => {
            const itemPrice = c.price !== undefined ? c.price : autoPrice;
            variants.push({
              id: Math.random().toString(36).substring(2, 11),
              options: { [optId]: c.name },
              image: c.image || '',
              autoPrice: itemPrice !== undefined ? String(itemPrice) : undefined,
              stock: 100,
              isVisible: true
            });
          });
        }
      }
    }

    // Classic DOM fallback for variants
    if (variants.length === 0) {
      const skuElements = document.querySelectorAll('.sku-item, .prop-item, .od-pc-attribute-item, .list-leading-item, .sku-prop-list li');
      const domItems = [];
      skuElements.forEach(el => {
        let name = el.getAttribute('title') || 
          el.querySelector('.name, .title, .prop-name, [class*="sku-name"], [class*="prop-name"]')?.innerText || 
          el.innerText.trim();
        name = name.split(/[\r\n¥￥]/)[0].trim();

        let imgUrl = '';
        const img = el.querySelector('img');
        if (img) {
          imgUrl = cleanAlibabaImageUrl(img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '');
          if (imgUrl) imageSet.add(imgUrl);
        }

        if (name && !domItems.some(c => c.name === name)) {
          domItems.push({ name, image: imgUrl });
        }
      });

      if (domItems.length > 0) {
        options.push({
          id: 'opt_color',
          name: 'color',
          values: domItems.map(c => c.name)
        });
        domItems.forEach(c => {
          variants.push({
            id: Math.random().toString(36).substring(2, 11),
            options: { opt_color: c.name },
            image: c.image || '',
            autoPrice: autoPrice !== undefined ? String(autoPrice) : undefined,
            stock: 100,
            isVisible: true
          });
        });
      }
    }

    // If autoPrice was not found from main price elements, use the first variant's price!
    if (autoPrice === undefined && variants.length > 0 && variants[0].autoPrice !== undefined) {
      autoPrice = parseFloat(variants[0].autoPrice);
    }

    const images = Array.from(imageSet);

    // Ensure all variants have a fallback display image if empty
    variants.forEach(v => {
      if (!v.image && images.length > 0) {
        v.image = images[0];
      }
    });

    // --- E. SUPPLIER / COMPANY INFO ---
    let supplier = '';
    if (moduleData?.productTitle?.fields?.shopInfo?.companyName) {
      supplier = moduleData.productTitle.fields.shopInfo.companyName;
    } else if (moduleData?.productTitle?.fields?.shopInfo?.authCompanyName) {
      supplier = moduleData.productTitle.fields.shopInfo.authCompanyName;
    } else if (rootData?.offerBaseInfo?.sellerLoginId) {
      supplier = rootData.offerBaseInfo.sellerLoginId;
    } else if (contextObj?.data?.offerDomain?.seller?.companyName) {
      supplier = contextObj.data.offerDomain.seller.companyName;
    } else if (contextObj?.globalData?.companyName) {
      supplier = contextObj.globalData.companyName;
    } else if (contextObj?.data?.company?.name) {
      supplier = contextObj.data.company.name;
    } else if (contextObj?.tempModel?.seller?.companyName) {
      supplier = contextObj.tempModel.seller.companyName;
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
    const attrList = moduleData?.productAttributes?.fields?.attributeList ||
      contextObj?.data?.offerDomain?.attributes ||
      contextObj?.globalData?.attributes ||
      [];
    if (Array.isArray(attrList) && attrList.length > 0) {
      const attrLines = attrList
        .filter(a => (a.name || a.attributeName) && (a.value || a.attributeValue))
        .map(a => `${a.name || a.attributeName}: ${a.value || a.attributeValue}`)
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

  // --- G. SELECTIVE SOURCING HELPERS (Feature 2) ---

  // Detect if a style button is currently selected / active on 1688
  function detectActive1688Style(product) {
    const activeSelectors = [
      '.module-od-sku-selection [class*="selected"]',
      '.module-od-sku-selection .selected',
      '.module-od-sku-selection .active',
      '[class*="sku-item"][class*="selected"]',
      '[class*="sku-item"].selected',
      '[class*="sku-item"].active',
      '[class*="expand-view-item"][class*="selected"]',
      '[class*="expand-view-item"].selected',
      '.feature-item [class*="selected"]',
      '.feature-item .selected',
      '.sku-item.selected',
      '.prop-item.selected',
      '[class*="selected--"]',
      '[class*="active--"]',
      '[class*="skuSelected"]',
      '[class*="sku-selected"]',
      '[class*="item-selected"]',
      '[aria-selected="true"]',
      '[aria-checked="true"]'
    ];

    let activeEl = null;
    for (const sel of activeSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0) {
          activeEl = el;
          break;
        }
      }
      if (activeEl) break;
    }

    if (!activeEl) return null;

    // Extract style name from active element
    const labelEl = activeEl.querySelector('.item-label, [class*="item-label"], .name, .title, .prop-name, [class*="prop-name"]');
    let name = labelEl ? (labelEl.getAttribute('title') || labelEl.innerText) : (activeEl.getAttribute('title') || activeEl.innerText || '');
    name = name.split(/[\r\n¥￥]/)[0].trim();

    if (!name) return null;

    // Extract price from active element or nearby price element
    let price = undefined;
    const priceEl = activeEl.querySelector('.item-price-stock, [class*="item-price"], [class*="price"]');
    if (priceEl) {
      const compacted = (priceEl.innerText || '').replace(/\s+/g, '');
      const m = compacted.match(/(?:¥|￥)?([0-9]+(?:\.[0-9]+)?)/);
      if (m && parseFloat(m[1]) > 0) price = parseFloat(m[1]);
    }

    // Extract photo from active element
    let imgUrl = '';
    const imgEl = activeEl.querySelector('img');
    if (imgEl) {
      imgUrl = cleanAlibabaImageUrl(imgEl.src || imgEl.getAttribute('data-src') || '');
    }

    // Match against product variants if available
    let matchedVariant = null;
    if (product && Array.isArray(product.variants)) {
      matchedVariant = product.variants.find(v => {
        const val = Object.values(v.options || {})[0];
        return val && (val === name || name.includes(val) || val.includes(name));
      });
    }

    if (matchedVariant) {
      return {
        name: Object.values(matchedVariant.options || {})[0] || name,
        price: matchedVariant.autoPrice ? parseFloat(matchedVariant.autoPrice) : (price !== undefined ? price : product.autoPrice),
        image: matchedVariant.image || imgUrl,
        variantId: matchedVariant.id,
        variant: matchedVariant
      };
    }

    return {
      name: name,
      price: price !== undefined ? price : (product ? product.autoPrice : undefined),
      image: imgUrl,
      variantId: null,
      variant: null
    };
  }

  // Build product with ONLY selected variants, ONLY their photos, and exact prices
  function buildSelectiveProduct(baseProduct, selectedVariantIds) {
    if (!baseProduct) return null;
    const selectedVariants = (baseProduct.variants || []).filter(v => selectedVariantIds.includes(v.id));
    if (selectedVariants.length === 0) return baseProduct;

    // 1. Collect ONLY the pictures belonging to the selected variants
    const selectedImages = [];
    selectedVariants.forEach(v => {
      if (v.image && !selectedImages.includes(v.image)) {
        selectedImages.push(v.image);
      }
    });

    if (selectedImages.length === 0 && baseProduct.images && baseProduct.images.length > 0) {
      selectedImages.push(baseProduct.images[0]);
    }

    // 2. Determine exact autoPrice from selected variants
    const prices = selectedVariants
      .map(v => v.autoPrice ? parseFloat(v.autoPrice) : baseProduct.autoPrice)
      .filter(p => p !== undefined && !isNaN(p) && p > 0);
    const resolvedAutoPrice = prices.length > 0 ? prices[0] : baseProduct.autoPrice;

    // 3. Synchronize options so only selected values are retained
    const synchronizedOptions = [];
    (baseProduct.options || []).forEach(opt => {
      const usedVals = new Set(selectedVariants.map(v => v.options?.[opt.id]).filter(Boolean));
      const filteredVals = opt.values.filter(val => usedVals.has(val));
      if (filteredVals.length > 0) {
        synchronizedOptions.push({
          ...opt,
          values: filteredVals
        });
      }
    });

    return {
      ...baseProduct,
      autoPrice: resolvedAutoPrice,
      image: selectedImages[0] || '',
      thumbnail: selectedImages[0] || '',
      images: selectedImages,
      options: synchronizedOptions,
      variants: selectedVariants
    };
  }

  // Build single-item product for 1-click active style import
  function buildSingleVariantProduct(baseProduct, activeStyle) {
    if (!baseProduct || !activeStyle) return baseProduct;

    if (activeStyle.variantId && baseProduct.variants && baseProduct.variants.some(v => v.id === activeStyle.variantId)) {
      return buildSelectiveProduct(baseProduct, [activeStyle.variantId]);
    }

    // Fallback: construct single variant
    const variantImage = activeStyle.image || (baseProduct.images?.[0] || '');
    const images = variantImage ? [variantImage] : (baseProduct.images || []);
    const optId = 'opt_color';
    const variant = {
      id: Math.random().toString(36).substring(2, 11),
      options: { [optId]: activeStyle.name },
      image: variantImage,
      autoPrice: activeStyle.price !== undefined ? String(activeStyle.price) : (baseProduct.autoPrice ? String(baseProduct.autoPrice) : undefined),
      stock: 100,
      isVisible: true
    };

    return {
      ...baseProduct,
      autoPrice: activeStyle.price !== undefined ? activeStyle.price : baseProduct.autoPrice,
      image: variantImage,
      thumbnail: variantImage,
      images: images,
      options: [{ id: optId, name: 'color', values: [activeStyle.name] }],
      variants: [variant]
    };
  }

  // 6. UI Floating Widget & Checklist Drawer Injection
  let floatingBtn = null;
  let previewCard = null;
  let currentActiveStyle = null;
  let currentProductData = null;
  const checkedVariantIds = new Set();

  function createFloatingButton() {
    const existing = document.getElementById('paikarix-1688-floating-root');
    if (existing) {
      if (document.getElementById('paikarix-drawer')) return;
      existing.remove();
    }

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

      <!-- Slide-Out Multi-Select Checklist Drawer -->
      <div id="paikarix-drawer-overlay" class="paikarix-drawer-overlay paikarix-hidden"></div>
      <div id="paikarix-drawer" class="paikarix-drawer paikarix-drawer-hidden">
        <div class="paikarix-drawer-header">
          <div class="paikarix-drawer-title-box">
            <div class="paikarix-drawer-title">
              <span>Select Items to Import</span>
            </div>
            <div class="paikarix-drawer-sub">Choose only the 1, 2, or 3 items you bought</div>
          </div>
          <button id="paikarix-drawer-close" class="paikarix-drawer-close-btn" type="button" title="Close">&times;</button>
        </div>

        <div class="paikarix-drawer-toolbar">
          <input id="paikarix-drawer-search" type="text" class="paikarix-drawer-search" placeholder="Search styles / colors..." />
          <div class="paikarix-drawer-select-actions">
            <button id="paikarix-drawer-select-all" class="paikarix-link-btn" type="button">Select All</button>
            <span class="paikarix-dot">•</span>
            <button id="paikarix-drawer-deselect-all" class="paikarix-link-btn" type="button">Deselect All</button>
          </div>
        </div>

        <div id="paikarix-drawer-list" class="paikarix-drawer-list">
          <!-- Variant rows injected dynamically -->
        </div>

        <div class="paikarix-drawer-footer">
          <button id="paikarix-drawer-send-selected" class="paikarix-drawer-primary-btn" type="button">
            <span>Send Selected (<span id="paikarix-checked-count">0</span>)</span>
          </button>
          <button id="paikarix-drawer-send-all" class="paikarix-drawer-secondary-btn" type="button">
            Send All Items (<span id="paikarix-all-count">0</span>)
          </button>
        </div>
      </div>

      <!-- Floating Buttons Bar -->
      <div class="paikarix-floating-bar">
        <button id="paikarix-drawer-btn" class="paikarix-secondary-btn" type="button" title="Open variant selector drawer">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 11 3 3L22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          <span>Select Items</span>
          <span id="paikarix-variant-pill" class="paikarix-variant-pill">0</span>
        </button>

        <button id="paikarix-floating-btn" class="paikarix-floating-btn" type="button" title="Click to send to PaikariX Dashboard">
          <div class="paikarix-btn-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14"/>
              <path d="m12 5 7 7-7 7"/>
            </svg>
          </div>
          <div class="paikarix-btn-content">
            <span id="paikarix-btn-main-title" class="paikarix-btn-title">Send to PaikariX</span>
            <span id="paikarix-btn-sub" class="paikarix-btn-subtitle">Wholesale 1-Click</span>
          </div>
        </button>
      </div>
    `;

    document.body.appendChild(root);

    floatingBtn = document.getElementById('paikarix-floating-btn');
    previewCard = document.getElementById('paikarix-preview-card');

    // Hover to preview
    floatingBtn.addEventListener('mouseenter', () => {
      updateFloatingWidgetState();
      previewCard.classList.remove('paikarix-hidden');
    });

    root.addEventListener('mouseleave', () => {
      previewCard.classList.add('paikarix-hidden');
    });

    // Primary Floating Button Click:
    // If active style is selected, send only that style; else send full product
    floatingBtn.addEventListener('click', () => {
      const product = currentProductData || extract1688Product();
      if (currentActiveStyle) {
        const selectivePayload = buildSingleVariantProduct(product, currentActiveStyle);
        deliverImportPayload(selectivePayload);
      } else {
        deliverImportPayload(product);
      }
    });

    // Drawer Button Click
    const drawerBtn = document.getElementById('paikarix-drawer-btn');
    if (drawerBtn) {
      drawerBtn.addEventListener('click', openChecklistDrawer);
    }

    // Drawer Close Buttons
    const drawerCloseBtn = document.getElementById('paikarix-drawer-close');
    const drawerOverlay = document.getElementById('paikarix-drawer-overlay');
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeChecklistDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeChecklistDrawer);

    // Drawer Actions: Select All & Deselect All
    const selectAllBtn = document.getElementById('paikarix-drawer-select-all');
    const deselectAllBtn = document.getElementById('paikarix-drawer-deselect-all');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        const product = currentProductData || extract1688Product();
        (product.variants || []).forEach(v => checkedVariantIds.add(v.id));
        renderDrawerList();
      });
    }
    if (deselectAllBtn) {
      deselectAllBtn.addEventListener('click', () => {
        checkedVariantIds.clear();
        renderDrawerList();
      });
    }

    // Drawer Search Filter
    const searchInput = document.getElementById('paikarix-drawer-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderDrawerList();
      });
    }

    // Drawer Footer: Send Selected
    const sendSelectedBtn = document.getElementById('paikarix-drawer-send-selected');
    if (sendSelectedBtn) {
      sendSelectedBtn.addEventListener('click', () => {
        const product = currentProductData || extract1688Product();
        if (checkedVariantIds.size === 0) {
          alert('Please check at least 1 item to import, or click "Send All Items".');
          return;
        }
        const selectivePayload = buildSelectiveProduct(product, Array.from(checkedVariantIds));
        closeChecklistDrawer();
        deliverImportPayload(selectivePayload);
      });
    }

    // Drawer Footer: Send All Items
    const sendAllBtn = document.getElementById('paikarix-drawer-send-all');
    if (sendAllBtn) {
      sendAllBtn.addEventListener('click', () => {
        const product = currentProductData || extract1688Product();
        closeChecklistDrawer();
        deliverImportPayload(product);
      });
    }

    // Initial state update
    updateFloatingWidgetState();
  }

  function openChecklistDrawer() {
    const drawer = document.getElementById('paikarix-drawer');
    const overlay = document.getElementById('paikarix-drawer-overlay');
    if (!drawer || !overlay) return;

    currentProductData = extract1688Product();
    currentActiveStyle = detectActive1688Style(currentProductData);

    // If a variant is actively clicked on 1688 and nothing else checked yet, pre-check it!
    if (currentActiveStyle && currentActiveStyle.variantId && checkedVariantIds.size === 0) {
      checkedVariantIds.add(currentActiveStyle.variantId);
    }

    renderDrawerList();
    drawer.classList.remove('paikarix-drawer-hidden');
    overlay.classList.remove('paikarix-hidden');
  }

  function closeChecklistDrawer() {
    const drawer = document.getElementById('paikarix-drawer');
    const overlay = document.getElementById('paikarix-drawer-overlay');
    if (drawer) drawer.classList.add('paikarix-drawer-hidden');
    if (overlay) overlay.classList.add('paikarix-hidden');
  }

  function renderDrawerList() {
    const listEl = document.getElementById('paikarix-drawer-list');
    const checkedCountEl = document.getElementById('paikarix-checked-count');
    const allCountEl = document.getElementById('paikarix-all-count');
    const searchInput = document.getElementById('paikarix-drawer-search');
    if (!listEl) return;

    const product = currentProductData || extract1688Product();
    const variants = product.variants || [];
    const query = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';

    if (allCountEl) allCountEl.textContent = String(variants.length);
    if (checkedCountEl) checkedCountEl.textContent = String(checkedVariantIds.size);

    if (variants.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #71717a; font-size: 13px;">
          No multi-style variants detected for this item. Click "Send to PaikariX" to import directly.
        </div>
      `;
      return;
    }

    const filtered = query
      ? variants.filter(v => Object.values(v.options || {}).join(' ').toLowerCase().includes(query))
      : variants;

    const prevScroll = listEl.scrollTop;

    listEl.innerHTML = filtered.map(v => {
      const isChecked = checkedVariantIds.has(v.id);
      const styleName = Object.values(v.options || {})[0] || 'Standard';
      const priceText = v.autoPrice ? `¥${v.autoPrice}` : (product.autoPrice ? `¥${product.autoPrice}` : '¥--');
      const thumbSrc = v.image || product.images?.[0] || '';

      return `
        <div class="paikarix-drawer-item ${isChecked ? 'paikarix-checked' : ''}" data-variant-id="${v.id}">
          <input type="checkbox" class="paikarix-item-checkbox" ${isChecked ? 'checked' : ''} data-variant-id="${v.id}" />
          ${thumbSrc ? `<img src="${thumbSrc}" class="paikarix-item-thumb" alt="${styleName}" />` : `<div class="paikarix-item-thumb"></div>`}
          <div class="paikarix-item-info">
            <div class="paikarix-item-name" title="${styleName}">${styleName}</div>
            <div class="paikarix-item-meta">
              <span class="paikarix-item-price">${priceText}</span>
              ${v.stock !== undefined ? `<span class="paikarix-item-stock">Stock: ${v.stock}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to rows
    listEl.querySelectorAll('.paikarix-drawer-item').forEach(itemEl => {
      itemEl.addEventListener('click', (e) => {
        const vId = itemEl.getAttribute('data-variant-id');
        if (!vId) return;
        if (checkedVariantIds.has(vId)) {
          checkedVariantIds.delete(vId);
        } else {
          checkedVariantIds.add(vId);
        }
        renderDrawerList();
      });
    });

    listEl.scrollTop = prevScroll;
  }

  function updateFloatingWidgetState() {
    try {
      currentProductData = extract1688Product();
      const product = currentProductData;

      // Update Preview Card Details
      const idEl = document.getElementById('paikarix-card-id');
      const titleEl = document.getElementById('paikarix-card-title');
      const priceEl = document.getElementById('paikarix-card-price');
      const imgEl = document.getElementById('paikarix-card-images');
      const varEl = document.getElementById('paikarix-card-variants');
      const variantPill = document.getElementById('paikarix-variant-pill');
      const drawerBtn = document.getElementById('paikarix-drawer-btn');

      if (idEl) idEl.textContent = product.code1688 ? `#${product.code1688}` : '';
      if (titleEl) titleEl.textContent = product.title ? (product.title.length > 50 ? product.title.slice(0, 50) + '...' : product.title) : 'Untitled Product';
      if (priceEl) priceEl.textContent = product.autoPrice ? `¥${product.autoPrice}` : '¥--';
      if (imgEl) imgEl.textContent = String(product.images.length);
      if (varEl) varEl.textContent = String(product.variants.length);
      if (variantPill) variantPill.textContent = String(product.variants.length);

      if (drawerBtn) {
        if (product.variants.length > 1) {
          drawerBtn.style.display = 'flex';
        } else {
          drawerBtn.style.display = 'none';
        }
      }

      // Feature 2a: Detect Active Clicked Style in real-time
      currentActiveStyle = detectActive1688Style(product);

      const mainBtn = document.getElementById('paikarix-floating-btn');
      const mainTitle = document.getElementById('paikarix-btn-main-title');
      const subTitle = document.getElementById('paikarix-btn-sub');

      if (currentActiveStyle && mainBtn && mainTitle && subTitle) {
        mainBtn.classList.add('paikarix-active-style-mode');
        const displayName = currentActiveStyle.name.length > 18
          ? currentActiveStyle.name.slice(0, 18) + '...'
          : currentActiveStyle.name;
        const priceDisplay = (currentActiveStyle.price !== undefined && !isNaN(currentActiveStyle.price))
          ? ` (¥${currentActiveStyle.price})`
          : '';
        mainTitle.textContent = `Send Selected: ${displayName}${priceDisplay}`;
        subTitle.textContent = '1-Click Selective Import';
        mainBtn.title = `Click to import ONLY "${currentActiveStyle.name}" with its pictures and exact price`;
      } else if (mainBtn && mainTitle && subTitle) {
        mainBtn.classList.remove('paikarix-active-style-mode');
        mainTitle.textContent = 'Send to PaikariX';
        subTitle.textContent = product.variants.length > 0
          ? `Wholesale 1-Click (${product.variants.length} items)`
          : 'Wholesale 1-Click';
        mainBtn.title = 'Click to send all items to PaikariX Dashboard';
      }
    } catch (e) {
      console.warn('[PaikariX 1688] updateFloatingWidgetState note:', e);
    }
  }

  function deliverImportPayload(payload) {
    const btn = document.getElementById('paikarix-floating-btn');
    const sub = document.getElementById('paikarix-btn-sub');
    if (!btn) return;

    btn.classList.add('paikarix-loading');
    if (sub) sub.textContent = 'Extracting...';

    if (!payload || (!payload.code1688 && !payload.title)) {
      alert('Could not detect 1688 product information on this page. Please make sure the offer page has finished loading.');
      btn.classList.remove('paikarix-loading');
      if (sub) sub.textContent = 'Wholesale 1-Click';
      return;
    }

    if (sub) sub.textContent = 'Sending...';

    chrome.runtime.sendMessage({
      action: 'IMPORT_PRODUCT',
      data: payload
    }, (response) => {
      btn.classList.remove('paikarix-loading');
      btn.classList.add('paikarix-success');
      const isSelective = payload.variants && payload.variants.length === 1 && currentActiveStyle;
      if (sub) {
        sub.textContent = isSelective ? 'Selected Item Sent!' : 'Sent to Dashboard!';
      }
      setTimeout(() => {
        btn.classList.remove('paikarix-success');
        updateFloatingWidgetState();
      }, 3500);
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
        const product = extract1688Product();
        deliverImportPayload(product);
        sendResponse({ success: true });
        return true;
      }
    });
  }

  // Real-time Style Selection Observer: detect when merchant clicks style buttons on 1688
  document.addEventListener('click', (e) => {
    // If the click is inside SKU selection or option containers
    const target = e.target;
    if (target && target.closest && (
      target.closest('.module-od-sku-selection') ||
      target.closest('[class*="sku"]') ||
      target.closest('.feature-item') ||
      target.closest('.expand-view-item') ||
      target.closest('.prop-item')
    )) {
      setTimeout(updateFloatingWidgetState, 60);
      setTimeout(updateFloatingWidgetState, 250);
    }
  }, true);

  // Inject floating button when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
  } else {
    createFloatingButton();
  }

  // Periodic check to track SPA navigation and maintain UI button
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      pageContextData = null;
      requestPageContextData();
      updateFloatingWidgetState();
    }
    if (!document.getElementById('paikarix-1688-floating-root')) {
      createFloatingButton();
    }
  }, 1000);

})();
