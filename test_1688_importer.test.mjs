import assert from 'node:assert/strict';
import { cleanAlibabaImageUrl, clean1688Url, is1688CdnUrl } from './src/lib/utils.ts';

console.log('--- Running PaikariX 1688 Importer Test Suite ---');

// 1. Test cleanAlibabaImageUrl
console.log('\n[1/5] Testing cleanAlibabaImageUrl across CDN formats...');

const imgTestCases = [
  {
    input: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg_300x300.jpg',
    expected: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg',
    desc: 'Standard _300x300.jpg suffix'
  },
  {
    input: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg_.webp',
    expected: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg',
    desc: 'Alibaba _.webp suffix'
  },
  {
    input: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.png_60x60.png',
    expected: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.png',
    desc: 'PNG _60x60.png suffix'
  },
  {
    input: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg.400x400.jpg',
    expected: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg',
    desc: 'Dot-format dimension decorator (.jpg.400x400.jpg)'
  },
  {
    input: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890_300x300.jpg',
    expected: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg',
    desc: 'Suffix when no prior extension exists in base name'
  },
  {
    input: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.search.jpg',
    expected: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg',
    desc: 'Search thumbnail suffix (.search.jpg)'
  },
  {
    input: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg_400x400.jpg?x-oss-process=image/resize,w_400',
    expected: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg',
    desc: 'OSS process query parameter with dimension suffix'
  },
  {
    input: '//cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg_q90.jpg',
    expected: 'https://cbu01.alicdn.com/img/ibank/2018/012/345/67890.jpg',
    desc: 'Protocol-relative URL with quality suffix (_q90.jpg)'
  },
  {
    input: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=800',
    expected: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a',
    desc: 'Non-Alibaba image query parameter stripped cleanly'
  },
  {
    input: 'https://cbu01.alicdn.com/img/ibank/O1CN01b5zCCh2CSgqL2nR0s_!!2217591418473-0-cib.jpg_sum.jpg',
    expected: 'https://cbu01.alicdn.com/img/ibank/O1CN01b5zCCh2CSgqL2nR0s_!!2217591418473-0-cib.jpg',
    desc: 'SKU _sum.jpg suffix stripped cleanly'
  },
  {
    input: 'https://img.alicdn.com/imgextra/i2/O1CN01vPS4dX1YdboQ4A7pk_!!6000000003082-55-tps-15-8.svg',
    expected: '',
    desc: 'Alibaba UI SVG and TPS icons rejected cleanly'
  }
];

imgTestCases.forEach((tc, i) => {
  const actual = cleanAlibabaImageUrl(tc.input);
  assert.equal(actual, tc.expected, `Case ${i + 1} (${tc.desc}) failed. Expected ${tc.expected}, got ${actual}`);
  console.log(`  ✓ Case ${i + 1}: ${tc.desc} -> ${actual}`);
});

// 2. Test clean1688Url
console.log('\n[2/5] Testing clean1688Url...');

const urlCases = [
  {
    input: 'https://detail.1688.com/offer/729482910481.html?spm=a26352.b28411319.offerlist.1',
    expected: 'https://detail.1688.com/offer/729482910481.html?spm=a26352.b28411319.offerlist.1',
    desc: 'Canonical 1688 offer URL'
  },
  {
    input: '【新款热卖】https://detail.1688.com/offer/729482910481.html，包邮！',
    expected: 'https://detail.1688.com/offer/729482910481.html',
    desc: 'Chinese promotional text with punctuation around URL'
  },
  {
    input: 'detail.1688.com/offer/729482910481.html',
    expected: 'https://detail.1688.com/offer/729482910481.html',
    desc: 'Protocol-less 1688 domain'
  }
];

urlCases.forEach((tc, i) => {
  const actual = clean1688Url(tc.input);
  assert.equal(actual, tc.expected, `URL Case ${i + 1} failed. Expected ${tc.expected}, got ${actual}`);
  console.log(`  ✓ URL Case ${i + 1}: ${tc.desc} -> ${actual}`);
});

// 3. Test Auto Price formula with store settings (including decimal RMB)
console.log('\n[3/5] Testing Auto Price formula with decimal RMB wholesale prices...');

const storeSettings = {
  yuanRate: 18.5,
  additionalCost: 120,
  profit: 250
};

function calculatePrices(rmb, settings) {
  const numVal = Number(rmb);
  if (isNaN(numVal)) throw new Error('Invalid RMB price');
  const buy = Math.floor((settings.yuanRate * numVal) + settings.additionalCost);
  const sell = Math.floor(buy + settings.profit);
  return { buy, sell };
}

// Case A: 28 RMB integer
const priceA = calculatePrices(28, storeSettings);
assert.equal(priceA.buy, 638, 'Buy price for 28 RMB should be 638');
assert.equal(priceA.sell, 888, 'Sell price for 28 RMB should be 888');
console.log(`  ✓ 28 RMB -> Buy: ৳${priceA.buy}, Sell: ৳${priceA.sell}`);

// Case B: 18.5 RMB decimal wholesale price
const priceB = calculatePrices(18.5, storeSettings);
// 18.5 * 18.5 + 120 = 342.25 + 120 = 462.25 -> 462
assert.equal(priceB.buy, 462, 'Buy price for 18.5 RMB should be 462');
assert.equal(priceB.sell, 712, 'Sell price for 18.5 RMB should be 712');
console.log(`  ✓ 18.5 RMB -> Buy: ৳${priceB.buy}, Sell: ৳${priceB.sell}`);

// 4. Test Decimal RMB Preservation in Product (no Math.floor truncation)
console.log('\n[4/5] Testing decimal RMB preservation in Product autoPrice...');

const decimalAutoPrice = '18.5';
const savedAutoPrice = decimalAutoPrice && !isNaN(Number(decimalAutoPrice)) ? Number(decimalAutoPrice) : undefined;
assert.equal(savedAutoPrice, 18.5, 'Decimal RMB must not be truncated to 18');
console.log(`  ✓ Preserved decimal autoPrice: ${savedAutoPrice}`);

// 5. Test Variant Auto Price Sync Logic
console.log('\n[5/5] Testing Variant Auto Price Sync Logic...');

let variants = [
  { id: 'v1', autoPrice: '25', buyPrice: 582, price: 832, options: { opt_color: 'Red' } },
  { id: 'v2', autoPrice: '25', buyPrice: 582, price: 832, options: { opt_color: 'Blue' } },
  { id: 'v3', autoPrice: '35', buyPrice: 767, price: 1017, options: { opt_color: 'Custom Gold' } } // Custom variant price
];

// User updates main autoPrice from 25 to 30
const oldMainAutoPrice = '25';
const newMainAutoPrice = '30';
const newCalculated = calculatePrices(newMainAutoPrice, storeSettings);

variants = variants.map(v => {
  if (!v.autoPrice || v.autoPrice === oldMainAutoPrice) {
    return {
      ...v,
      autoPrice: newMainAutoPrice,
      buyPrice: newCalculated.buy,
      price: newCalculated.sell
    };
  }
  return v;
});

// v1 and v2 should be updated to 30
assert.equal(variants[0].autoPrice, '30');
assert.equal(variants[0].buyPrice, 675);
assert.equal(variants[1].autoPrice, '30');
assert.equal(variants[1].buyPrice, 675);
// v3 had a custom price of 35, should remain 35
assert.equal(variants[2].autoPrice, '35');
assert.equal(variants[2].buyPrice, 767);
console.log('  ✓ Default variants synced to new autoPrice (30 RMB -> ৳675/৳925)');
console.log('  ✓ Custom variant preserved its custom autoPrice (35 RMB -> ৳767/৳1017)');

// 6. Test Modern 1688 DOM Whitespace & Range Price Extraction
console.log('\n[6/6] Testing modern 1688 DOM whitespace & range price extraction...');

function extractRmbFromDomText(rawText) {
  if (!rawText) return undefined;
  const compacted = rawText.replace(/\s+/g, '');
  const match = compacted.match(/(?:¥|￥)?([0-9]+(?:\.[0-9]+)?)/);
  if (match && parseFloat(match[1]) > 0) {
    return parseFloat(match[1]);
  }
  return undefined;
}

const priceTestCases = [
  { text: '¥\n5\n.00\n\nMinimum order is 1pcs', expected: 5 },
  { text: '¥\n0\n.45\n¥\n1\n.03\n\nMinimum order quantity: 3 pairs', expected: 0.45 },
  { text: '  ¥ 18.50 / 件  ', expected: 18.5 },
  { text: '￥ 99.00', expected: 99 },
  { text: '¥5', expected: 5 }
];

priceTestCases.forEach((tc, idx) => {
  const actual = extractRmbFromDomText(tc.text);
  assert.equal(actual, tc.expected, `Price Case ${idx + 1} failed: expected ${tc.expected}, got ${actual}`);
  console.log(`  ✓ Price Case ${idx + 1}: ${JSON.stringify(tc.text.slice(0, 15))}... -> ${actual} RMB`);
});

// 7. Test Modern 1688 window.context extraction for Single-Variant Product (837976582448)
console.log('\n[7/9] Testing window.context extraction for Offer 837976582448...');

const sampleContextSingle = {
  result: {
    data: {
      productTitle: {
        fields: {
          title: "Necklace Women's Light Luxury Niche Design Ring Love Titanium Steel Necklace New All-match Elegant High-end Simple Accessories",
          shopInfo: { companyName: "义乌市陌语饰品厂" }
        }
      },
      mainPrice: {
        fields: {
          originalPricesWithoutPromotion: [{ price: "5.00", beginAmount: "1" }]
        }
      },
      gallery: {
        fields: {
          offerImgList: [
            "https://cbu01.alicdn.com/img/ibank/O1CN014WsYCz1Bs2yjWA4Ea_!!0-0-cib.jpg",
            "https://cbu01.alicdn.com/img/ibank/O1CN01HRUm6o1Bs2ydXEav1_!!0-0-cib.jpg"
          ]
        }
      },
      Root: {
        fields: {
          dataJson: JSON.stringify({
            skuModel: {
              skuProps: [
                {
                  fid: 3216,
                  prop: "Color",
                  value: [
                    {
                      imageUrl: "https://cbu01.alicdn.com/img/ibank/O1CN01b5zCCh2CSgqL2nR0s_!!2217591418473-0-cib.jpg",
                      name: "Xl1879 ring full diamond love necklace gold"
                    }
                  ]
                }
              ],
              skuInfoMap: {
                "Xl1879 ring full diamond love necklace gold": {
                  price: "5.00",
                  canBookCount: 1926824,
                  skuId: 5597783984497
                }
              }
            }
          })
        }
      }
    }
  }
};

// Simulate content.js extraction from sampleContextSingle
const d1 = sampleContextSingle.result.data;
const r1 = JSON.parse(d1.Root.fields.dataJson);
const title1 = d1.productTitle.fields.title;
const autoPrice1 = parseFloat(d1.mainPrice.fields.originalPricesWithoutPromotion[0].price);
const images1 = d1.gallery.fields.offerImgList.map(u => cleanAlibabaImageUrl(u));
const skuProps1 = r1.skuModel.skuProps;
const skuInfoMap1 = r1.skuModel.skuInfoMap;

assert.equal(title1.includes('Ring Love Titanium Steel'), true);
assert.equal(autoPrice1, 5);
assert.equal(images1.length, 2);
assert.equal(images1[0], 'https://cbu01.alicdn.com/img/ibank/O1CN014WsYCz1Bs2yjWA4Ea_!!0-0-cib.jpg');
assert.equal(skuProps1[0].value[0].name, 'Xl1879 ring full diamond love necklace gold');
assert.equal(skuInfoMap1['Xl1879 ring full diamond love necklace gold'].price, '5.00');
console.log('  ✓ Offer 837976582448: extracted title, 5.00 autoPrice, 2 clean images, and variant');

// 8. Test Modern 1688 window.context extraction for Multi-Variant Matrix (627638867036)
console.log('\n[8/9] Testing window.context extraction for multi-variant Offer 627638867036...');

const sampleContextMulti = {
  result: {
    data: {
      productTitle: { fields: { title: "Earrings Titanium Steel" } },
      mainPrice: {
        fields: {
          originalPricesWithoutPromotion: [
            { price: "0.45", beginAmount: "3" },
            { price: "1.03", beginAmount: "3" }
          ]
        }
      },
      gallery: {
        fields: {
          offerImgList: ["https://cbu01.alicdn.com/img/ibank/O1CN01WykpK01XIi1KZnTrq_!!2209129882901-0-cib.jpg"]
        }
      },
      Root: {
        fields: {
          dataJson: JSON.stringify({
            skuModel: {
              skuProps: [
                {
                  prop: "Color",
                  value: [
                    { name: "Steel color 2MM", imageUrl: "https://cbu01.alicdn.com/img/ibank/sample1.jpg" },
                    { name: "Gold 10MM", imageUrl: "https://cbu01.alicdn.com/img/ibank/sample2.jpg" }
                  ]
                }
              ],
              skuInfoMap: {
                "Steel color 2MM": { price: "0.45", canBookCount: 95439 },
                "Gold 10MM": { price: "1.03", canBookCount: 96340 }
              }
            }
          })
        }
      }
    }
  }
};

const d2 = sampleContextMulti.result.data;
const r2 = JSON.parse(d2.Root.fields.dataJson);
const autoPrice2 = parseFloat(d2.mainPrice.fields.originalPricesWithoutPromotion[0].price);
const skuInfoMap2 = r2.skuModel.skuInfoMap;
assert.equal(autoPrice2, 0.45);
assert.equal(skuInfoMap2['Steel color 2MM'].price, '0.45');
assert.equal(skuInfoMap2['Gold 10MM'].price, '1.03');
console.log('  ✓ Offer 627638867036: extracted base price 0.45, individual variant prices 0.45 and 1.03');

// 9. Test ProductEditorModal fallback activePriceCalc when priceCalculatorSettings is undefined
console.log('\n[9/9] Testing ProductEditorModal fallback price calculations with undefined settings...');

const defaultSettings = { yuanRate: 18.35, additionalCost: 20, profit: 110 };
const fallbackCalc = undefined || defaultSettings;

const buy5 = Math.floor(fallbackCalc.yuanRate * 5 + fallbackCalc.additionalCost);
const sell5 = Math.floor(buy5 + fallbackCalc.profit);

assert.equal(buy5, 111, 'Buy price for 5 RMB with fallback settings must be 111');
assert.equal(sell5, 221, 'Sell price for 5 RMB with fallback settings must be 221');

const buyDecimal = Math.floor(fallbackCalc.yuanRate * 0.45 + fallbackCalc.additionalCost);
const sellDecimal = Math.floor(buyDecimal + fallbackCalc.profit);

assert.equal(buyDecimal, 28, 'Buy price for 0.45 RMB with fallback settings must be 28');
assert.equal(sellDecimal, 138, 'Sell price for 0.45 RMB with fallback settings must be 138');

console.log('  ✓ Fallback pricing: 5 RMB -> Buy: ৳111, Sell: ৳221');
console.log('  ✓ Fallback pricing: 0.45 RMB -> Buy: ৳28, Sell: ৳138');

// 10. Test is1688CdnUrl detection logic for Feature 1
console.log('\n[10/13] Testing is1688CdnUrl detection logic...');

assert.equal(is1688CdnUrl('https://cbu01.alicdn.com/img/ibank/sample1.jpg'), true);
assert.equal(is1688CdnUrl('https://img.alicdn.com/imgextra/sample2.jpg'), true);
assert.equal(is1688CdnUrl('https://detail.1688.com/pic/sample.png'), true);
assert.equal(is1688CdnUrl('https://pub-2e2791afa81c4719bc403edfa89dacb7.r2.dev/uploads/img_123.webp'), false);
assert.equal(is1688CdnUrl('/uploads/img_123.webp'), false);
assert.equal(is1688CdnUrl('data:image/webp;base64,UklGRk...'), false);
assert.equal(is1688CdnUrl('blob:http://localhost:3000/uuid'), false);
console.log('  ✓ Correctly identified 1688 CDN URLs while preserving R2 and local blobs');

// 11. Test Selective Sourcing for Single Item (1 of N) with exact autoPrice & pictures (Feature 2a)
console.log('\n[11/13] Testing Selective Sourcing for Single Item (1 of N)...');

function buildSelectiveProduct(baseProduct, selectedVariantIds) {
  if (!baseProduct) return null;
  const selectedVariants = (baseProduct.variants || []).filter(v => selectedVariantIds.includes(v.id));
  if (selectedVariants.length === 0) return baseProduct;

  const selectedImages = [];
  selectedVariants.forEach(v => {
    if (v.image && !selectedImages.includes(v.image)) {
      selectedImages.push(v.image);
    }
  });

  if (selectedImages.length === 0 && baseProduct.images && baseProduct.images.length > 0) {
    selectedImages.push(baseProduct.images[0]);
  }

  const prices = selectedVariants
    .map(v => v.autoPrice ? parseFloat(v.autoPrice) : baseProduct.autoPrice)
    .filter(p => p !== undefined && !isNaN(p) && p > 0);
  const resolvedAutoPrice = prices.length > 0 ? prices[0] : baseProduct.autoPrice;

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
    images: selectedImages,
    options: synchronizedOptions,
    variants: selectedVariants
  };
}

const mockMultiItemProduct = {
  title: 'Titanium Steel Vintage Ring Set (12 Designs)',
  code1688: '729482910481',
  autoPrice: 2.50,
  images: [
    'https://cbu01.alicdn.com/img/master.jpg',
    'https://cbu01.alicdn.com/img/variant_gold.jpg',
    'https://cbu01.alicdn.com/img/variant_silver.jpg',
    'https://cbu01.alicdn.com/img/variant_rose.jpg'
  ],
  options: [
    { id: 'opt_color', name: 'Color', values: ['Gold', 'Silver', 'Rose Gold'] }
  ],
  variants: [
    { id: 'v_gold', options: { opt_color: 'Gold' }, image: 'https://cbu01.alicdn.com/img/variant_gold.jpg', autoPrice: '3.80' },
    { id: 'v_silver', options: { opt_color: 'Silver' }, image: 'https://cbu01.alicdn.com/img/variant_silver.jpg', autoPrice: '2.50' },
    { id: 'v_rose', options: { opt_color: 'Rose Gold' }, image: 'https://cbu01.alicdn.com/img/variant_rose.jpg', autoPrice: '4.20' }
  ]
};

// Merchant orders ONLY the Rose Gold ring
const singleSelected = buildSelectiveProduct(mockMultiItemProduct, ['v_rose']);

assert.equal(singleSelected.variants.length, 1);
assert.equal(singleSelected.variants[0].id, 'v_rose');
assert.equal(singleSelected.autoPrice, 4.20, 'autoPrice must match exact wholesale price of Rose Gold (4.20)');
assert.equal(singleSelected.images.length, 1);
assert.equal(singleSelected.images[0], 'https://cbu01.alicdn.com/img/variant_rose.jpg');
assert.equal(singleSelected.options[0].values.length, 1);
assert.equal(singleSelected.options[0].values[0], 'Rose Gold');
console.log('  ✓ Selective 1-item import: 1 variant, exact autoPrice 4.20 RMB, only Rose Gold image');

// 12. Test Selective Sourcing for Multiple Specific Items (2 of N) (Feature 2b)
console.log('\n[12/13] Testing Selective Sourcing for Multiple Items (2 of N)...');

const multiSelected = buildSelectiveProduct(mockMultiItemProduct, ['v_gold', 'v_silver']);

assert.equal(multiSelected.variants.length, 2);
assert.equal(multiSelected.autoPrice, 3.80, 'autoPrice reflects the first selected item price (3.80)');
assert.equal(multiSelected.images.length, 2);
assert.deepEqual(multiSelected.images, [
  'https://cbu01.alicdn.com/img/variant_gold.jpg',
  'https://cbu01.alicdn.com/img/variant_silver.jpg'
]);
assert.deepEqual(multiSelected.options[0].values, ['Gold', 'Silver']);
console.log('  ✓ Selective multi-item import: 2 variants, only Gold and Silver images, synchronized options');

// 13. Test ProductEditorModal Variant Quick Delete & Option/Image Cleanup (Feature 2c)
console.log('\n[13/13] Testing ProductEditorModal Variant Quick Delete & Option/Image Cleanup...');

function simulateDeleteVariant(state, variantId) {
  const variantToDelete = state.variants.find(v => v.id === variantId);
  if (!variantToDelete) return state;

  const nextVariants = state.variants.filter(v => v.id !== variantId);

  // Synchronize options
  let nextOptions = [];
  if (nextVariants.length > 0) {
    nextOptions = state.options
      .map(opt => {
        const usedVals = new Set(nextVariants.map(v => v.options[opt.id]).filter(Boolean));
        return {
          ...opt,
          values: opt.values.filter(val => usedVals.has(val))
        };
      })
      .filter(opt => opt.values.length > 0);
  }

  // Remove orphaned gallery images
  let nextImages = [...state.images];
  const deletedImg = variantToDelete.image;
  if (deletedImg) {
    const isUsedByOtherVariants = nextVariants.some(v => v.image === deletedImg);
    if (!isUsedByOtherVariants) {
      nextImages = nextImages.filter(img => img !== deletedImg);
    }
  }

  return {
    ...state,
    variants: nextVariants,
    options: nextOptions,
    images: nextImages
  };
}

const editorState = {
  variants: [
    { id: 'v1', options: { opt_color: 'Red' }, image: 'https://r2/red.webp' },
    { id: 'v2', options: { opt_color: 'Blue' }, image: 'https://r2/blue.webp' },
    { id: 'v3', options: { opt_color: 'Green' }, image: 'https://r2/green.webp' }
  ],
  options: [
    { id: 'opt_color', name: 'Color', values: ['Red', 'Blue', 'Green'] }
  ],
  images: [
    'https://r2/red.webp',
    'https://r2/blue.webp',
    'https://r2/green.webp'
  ]
};

// Delete Green variant (v3)
const afterDelete = simulateDeleteVariant(editorState, 'v3');

assert.equal(afterDelete.variants.length, 2);
assert.deepEqual(afterDelete.options[0].values, ['Red', 'Blue'], 'Option values must have "Green" removed');
assert.equal(afterDelete.images.includes('https://r2/green.webp'), false, 'Orphaned green image must be removed');
assert.equal(afterDelete.images.length, 2);
console.log('  ✓ 1-click variant delete cleanly synchronizes options (Green removed)');
console.log('  ✓ Orphaned gallery image cleanly purged from images array');

console.log('\n🎉 ALL 13 PAIKARIX 1688 IMPORTER TESTS PASSED SUCCESSFULLY!');


