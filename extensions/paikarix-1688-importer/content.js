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
          updatePreviewBadge();
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
