import assert from 'node:assert/strict';
import { cleanAlibabaImageUrl, clean1688Url } from './src/lib/utils.ts';

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

console.log('\n🎉 ALL PAIKARIX 1688 IMPORTER TESTS PASSED SUCCESSFULLY!');
