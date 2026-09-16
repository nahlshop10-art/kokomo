# PaikariX 1688 Importer Chrome Extension (Manifest V3)

A high-performance, lightweight Google Chrome Extension designed for 1-click importing of wholesale products from **1688.com** directly into the **PaikariX Dashboard**.

---

## ✨ Features

- **Direct RMB Wholesale Price Sync**: Extracts wholesale RMB prices directly into the dashboard's `Auto Price` field. The dashboard automatically calculates `Buy *` and `Sell *` prices using your store's price calculator settings (`yuanRate`, `additionalCost`, `profit`). No duplicate calculators or unnecessary Cloudflare requests!
- **1200x1200 Master Gallery Pictures**: Automatically strips Alibaba CDN thumbnail and resize suffixes (like `_300x300.jpg`, `_.webp`, `.search.jpg`, etc.) using regex to extract full-resolution master photos.
- **Color Variants & Photos**: Automatically extracts SKU options (Color/Specification) and links each variant to its corresponding high-resolution color photo.
- **Sourcing Link & ID**: Auto-populates `1688 Product ID` (`code1688`) and clean `1688 Product Link` (`link1688`).
- **Sleek Floating "Send to PaikariX" Button**: Injected non-intrusively onto 1688 product pages (`detail.1688.com` and `m.1688.com`) with instant preview badge and 1-click transmission.
- **Direct Tab Switching**: Focuses existing PaikariX dashboard tabs instantly or opens a new tab with pending import data.
- **In-Dashboard Clipboard Paste (`Ctrl+V`)**: Paste images copied to your clipboard directly into `ProductEditorModal` without saving files to disk.

---

## 🚀 How to Install in Google Chrome

1. Open **Google Chrome** on your computer.
2. In the address bar, type `chrome://extensions/` and press **Enter**.
3. In the top right corner, enable **Developer mode** toggle.
4. In the top left corner, click **Load unpacked**.
5. Select the `extensions/paikarix-1688-importer` folder from this project.
6. The extension **PaikariX 1688 Importer** is now installed and active!

---

## 🛒 How to Use

1. Browse to any product on [1688.com](https://www.1688.com), e.g. `https://detail.1688.com/offer/729482910481.html`.
2. Notice the sleek floating **"Send to PaikariX"** button on the bottom right of the page (or click the extension icon in your Chrome toolbar).
3. Hover to preview the detected RMB price, master images, and color variants.
4. Click **"Send to PaikariX"**.
5. The extension will automatically switch to your PaikariX Dashboard tab (or open it if not already open) and open the **Product Editor Modal** in "Add Product" mode with:
   - Product title
   - Auto-calculated wholesale buy & retail sell prices from RMB
   - Master 1200x1200 gallery images
   - Pre-linked color options and variant pictures
   - 1688 Offer ID and canonical link
6. Review or make any custom adjustments, and click **Add Product** to save!

---

## ⚙️ Configuration

- In the extension popup, click **Dashboard Settings** to configure your PaikariX Dashboard URL:
  - Local development: `http://localhost:3000` (default)
  - Cloudflare Pages: `https://kokomo.pages.dev` or your custom domain.
