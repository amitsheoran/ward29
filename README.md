# Ward 29 Pilani — Electoral Information Portal (2026)

A modern, production-quality, mobile-first static website for **Ward 29, Pilani, Rajasthan (नगर पालिका निर्वाचन नामावली, 2026)**.

This portal transforms the official 39-page electoral roll PDF into an interactive, fast, and structured civic web application with instant voter search, multi-field filtering, statistics visualization, interactive boundary map, and detailed voter record lookup.

---

## 🏛️ Source of Truth & Official Data

- **Primary Reference Document**: `input/WardNo29.pdf` (39 Pages)
- **Municipality**: नगर पालिका पिलानी (Pilani), Rajasthan
- **Assembly Constituency**: 25 - पिलानी (25 - Pilani)
- **Ward & Part Number**: Ward 29, Part 1
- **Polling Station**: 29 - गौतम सेकण्डरी स्कूल, पिलानी (Gautam Secondary School, Pilani)
- **Electoral Roll Year**: 2026
- **Qualifying Date**: 01-01-2026
- **Final Publication Date**: 08-05-2026

### Official Voter Statistics
| Category | Main List (मूल सूची) | Additions (परिवर्धन सूची) | Deletions (विलोपन सूची) | Total (कुल) |
| :--- | :---: | :---: | :---: | :---: |
| **Male (पुरुष)** | 445 | 18 | 0 | **463** |
| **Female (महिला)** | 418 | 20 | 0 | **438** |
| **Third Gender (तृतीय लिंग)** | 0 | 0 | 0 | **0** |
| **Total (कुल मतदाता)** | **863** | **38** | **0** | **901** |

---

## 🚀 Key Features

1. **Mobile-First Responsive Design**:
   - Tailored for all mobile screens (320px, 360px, 390px, 414px, 430px), tablets, and desktops.
   - Zero horizontal overflow.
   - Minimum 44px touch targets.
   - Clean Hindi & English typography (`Noto Sans Devanagari` & `Inter`).
2. **Instant Voter Search**:
   - Live client-side search across Voter Name, Voter ID (EPIC), Father/Husband's Name, and House Number without page reloads.
3. **Multi-Faceted Filtering**:
   - Filter by Gender (Male / Female), Age cohorts (18-25, 26-35, 36-50, 51-65, 65+), Section (Main List / Additions), and House Number.
   - Mobile Filter Bottom Sheet.
4. **Voter Records (Mobile Cards & Desktop Table)**:
   - Mobile: Clean cards with one-tap "Copy Voter ID" and toast feedback.
   - Desktop: Sticky-header table with quick actions.
   - Voter Details Modal / Bottom Sheet with full metadata and PDF page references.
5. **Interactive Ward Map**:
   - High-resolution map extracted from Page 2 with Zoom In, Zoom Out, Reset, and Fullscreen viewer.
   - Pinch-to-zoom and pan support on touchscreens.
6. **Ward & Part Boundaries**:
   - Official boundary descriptions in Devanagari with prominent landmark tags.
7. **Zero Backend / 100% Static**:
   - Pure HTML5, CSS3, and Vanilla JavaScript.
   - Fully compatible with **GitHub Pages**.

---

## 📂 Project Structure

```text
D:\Apps\ward29\
├── index.html                  # Main application HTML5 single-page portal
├── css/
│   └── style.css               # Responsive design system & animations
├── js/
│   └── app.js                  # Search, filter, map, and modal controller
├── data/
│   ├── ward.json               # Official metadata, boundaries, statistics
│   └── voters.json             # Structured records for all 901 voters
├── assets/
│   └── ward-map.png            # High-resolution official Ward 29 map
├── input/
│   └── WardNo29.pdf            # Original 39-page source PDF document
└── README.md                   # Project documentation
```

---

## 💻 Running Locally

Because the application fetches local JSON data via `fetch()`, run a lightweight local HTTP server:

```bash
# Using Python
cd D:\Apps\ward29
python -m http.server 8000

# Open in browser:
http://localhost:8000/
```

Or using Node.js `npx serve`:

```bash
npx serve .
```

---

## 🌐 Deploying to GitHub Pages

The repository is configured at:
```text
https://github.com/amitsheoran/ward29
```

### Steps to Deploy:
1. Commit all files and push to `main` branch:
   ```bash
   git add .
   git commit -m "feat: complete mobile-first Ward 29 electoral information website with all 901 voters"
   git push origin main
   ```
2. In GitHub repository settings:
   - Navigate to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **Deploy from a branch**.
   - Select branch: `main` and folder: `/ (root)`.
   - Click **Save**.
3. The website will be live at:
   ```text
   https://amitsheoran.github.io/ward29/
   ```

---

## 📋 Data Integrity Verification

All 901 records were directly extracted and verified against `input/WardNo29.pdf`:
- [x] All 39 pages inspected and parsed.
- [x] Exact 901 voter records extracted with EPIC IDs, ages, genders, and names.
- [x] Official summary totals (463 Male, 438 Female, 0 Third Gender = 901 Total) 100% verified.
- [x] Relative asset paths (`./data/`, `./assets/`, `./input/`) configured for GitHub Pages compatibility.

---

## ⚖️ License & Disclaimer

Information presented here is for civic transparency and accessibility based on the public electoral roll published by the State Election Commission, Rajasthan.
