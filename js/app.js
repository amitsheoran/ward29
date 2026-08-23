/**
 * Ward 29 Pilani — Electoral Information System
 * Senior UI/UX Application Engine
 */

(function () {
  'use strict';

  // Application State
  const state = {
    ward: null,
    voters: [],
    filteredVoters: [],
    pagination: {
      currentPage: 1,
      pageSize: 30,
      totalPages: 1
    },
    filters: {
      search: '',
      gender: 'all',
      ageGroup: 'all',
      section: 'all',
      houseNumber: 'all'
    },
    map: {
      scale: 1,
      posX: 0,
      posY: 0,
      isDragging: false,
      startX: 0,
      startY: 0
    }
  };

  // DOM Elements
  const elements = {
    // Search & Filter
    searchInput: document.getElementById('voterSearchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    filterToggleBtn: document.getElementById('filterToggleBtn'),
    filterBadgeCount: document.getElementById('filterBadgeCount'),
    resultsCount: document.getElementById('resultsCount'),
    activeFilterChips: document.getElementById('activeFilterChips'),
    
    // Voter List Containers
    votersGrid: document.getElementById('votersGrid'),
    votersTableBody: document.getElementById('votersTableBody'),
    emptyState: document.getElementById('emptyState'),
    emptyResetBtn: document.getElementById('emptyResetBtn'),
    
    // Pagination
    paginationWrapper: document.getElementById('paginationWrapper'),
    pageInfo: document.getElementById('pageInfo'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageNumbersContainer: document.getElementById('pageNumbersContainer'),
    
    // Bottom Sheets & Modals
    voterModalBackdrop: document.getElementById('voterModalBackdrop'),
    voterModalContent: document.getElementById('voterModalContent'),
    
    filterModalBackdrop: document.getElementById('filterModalBackdrop'),
    filterModalCloseBtn: document.getElementById('filterModalCloseBtn'),
    filterApplyBtn: document.getElementById('filterApplyBtn'),
    filterResetBtn: document.getElementById('filterResetBtn'),
    houseSelectFilter: document.getElementById('houseSelectFilter'),
    
    // Map Viewer Modal
    mapTriggerBtn: document.getElementById('mapTriggerBtn'),
    btnOpenMapAction: document.getElementById('btnOpenMapAction'),
    mapModalBackdrop: document.getElementById('mapModalBackdrop'),
    mapModalCloseBtn: document.getElementById('mapModalCloseBtn'),
    mapModalViewport: document.getElementById('mapModalViewport'),
    mapModalImg: document.getElementById('mapModalImg'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomResetBtn: document.getElementById('zoomResetBtn'),
    
    // Boundaries Accordion
    boundaryToggleBtn: document.getElementById('boundaryToggleBtn'),
    boundaryToggleIcon: document.getElementById('boundaryToggleIcon'),
    boundaryFullText: document.getElementById('boundaryFullText'),
    
    // Navigation & Toast
    toastContainer: document.getElementById('toastContainer'),
    bottomNavLinks: document.querySelectorAll('.bottom-nav-link')
  };

  // App Initialization
  async function init() {
    try {
      await loadData();
      renderDashboardVisuals();
      populateHouseFilterOptions();
      setupEventListeners();
      setupMapViewer();
      applyFilters();
    } catch (err) {
      console.error('Initialization error:', err);
      showToast('डेटा लोड करने में समस्या हुई। कृपया पुनः प्रयास करें।');
    }
  }

  // Load JSON Files
  async function loadData() {
    const [wardRes, votersRes] = await Promise.all([
      fetch('./data/ward.json'),
      fetch('./data/voters.json')
    ]);

    if (!wardRes.ok || !votersRes.ok) {
      throw new Error('Failed to load JSON data');
    }

    state.ward = await wardRes.json();
    state.voters = await votersRes.json();
    state.filteredVoters = [...state.voters];
  }

  // Animate Number Count-Up (Respects reduced motion)
  function animateValue(element, start, end, duration) {
    if (!element) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      element.textContent = end.toLocaleString('en-IN');
      return;
    }

    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const currentVal = Math.floor(easeProgress * (end - start) + start);
      element.textContent = currentVal.toLocaleString('en-IN');
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.textContent = end.toLocaleString('en-IN');
      }
    };
    window.requestAnimationFrame(step);
  }

  // Render Dashboard Visualizations & Donut Chart
  function renderDashboardVisuals() {
    if (!state.ward || !state.voters.length) return;
    const stats = state.ward.statistics.totalVoters;
    const total = stats.total;
    const male = stats.male;
    const female = stats.female;

    // Number Count-Ups
    animateValue(document.getElementById('quickFactTotal'), 0, total, 800);
    animateValue(document.getElementById('donutTotalCount'), 0, total, 800);
    animateValue(document.getElementById('statTotal'), 0, total, 800);
    animateValue(document.getElementById('statMale'), 0, male, 800);
    animateValue(document.getElementById('statFemale'), 0, female, 800);
    animateValue(document.getElementById('legendMaleCount'), 0, male, 800);
    animateValue(document.getElementById('legendFemaleCount'), 0, female, 800);

    // Donut Chart SVG Calculations
    // Circumference for r=38 is 2 * PI * 38 = 238.761
    const C = 2 * Math.PI * 38;
    const maleArc = (male / total) * C;
    const femaleArc = (female / total) * C;

    const donutMale = document.getElementById('donutMale');
    const donutFemale = document.getElementById('donutFemale');

    if (donutMale && donutFemale) {
      donutMale.style.strokeDasharray = `${maleArc.toFixed(2)} ${C.toFixed(2)}`;
      donutMale.style.strokeDashoffset = '0';
      donutFemale.style.strokeDasharray = `${femaleArc.toFixed(2)} ${C.toFixed(2)}`;
      donutFemale.style.strokeDashoffset = `-${maleArc.toFixed(2)}`;
    }
  }

  // Populate House Filter Options
  function populateHouseFilterOptions() {
    if (!elements.houseSelectFilter) return;
    const houseSet = new Set();
    state.voters.forEach(v => {
      if (v.houseNumber && v.houseNumber !== '—') {
        houseSet.add(v.houseNumber);
      }
    });

    const sortedHouses = Array.from(houseSet).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, 'hi');
    });

    sortedHouses.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = `मकान संख्या: ${h}`;
      elements.houseSelectFilter.appendChild(opt);
    });
  }

  // Filter & Bilingual Search Engine
  function applyFilters() {
    const q = state.filters.search.trim().toLowerCase();
    const g = state.filters.gender;
    const ageG = state.filters.ageGroup;
    const sec = state.filters.section;
    const hNo = state.filters.houseNumber;

    state.filteredVoters = state.voters.filter(v => {
      // 1. Search Query (Hindi Name, English Name, Relative Hindi/English, EPIC ID, House No, Serial No)
      if (q) {
        const matchNameHi = (v.name || '').toLowerCase().includes(q);
        const matchNameEn = (v.nameEn || '').toLowerCase().includes(q);
        const matchId = (v.voterId || '').toLowerCase().includes(q);
        const matchRelHi = (v.relationName || '').toLowerCase().includes(q);
        const matchRelEn = (v.relationNameEn || '').toLowerCase().includes(q);
        const matchHn = String(v.houseNumber || '').toLowerCase().includes(q);
        const matchSr = String(v.serialNumber) === q;
        
        if (!matchNameHi && !matchNameEn && !matchId && !matchRelHi && !matchRelEn && !matchHn && !matchSr) {
          return false;
        }
      }

      // 2. Gender Filter
      if (g !== 'all' && v.gender !== g) return false;

      // 3. Section Filter
      if (sec !== 'all') {
        if (sec === 'mool' && !v.section.includes('मूल सूची')) return false;
        if (sec === 'pari' && !v.section.includes('परिवर्धन सूची')) return false;
      }

      // 4. House Number Filter
      if (hNo !== 'all' && v.houseNumber !== hNo) return false;

      // 5. Age Bracket Filter
      if (ageG !== 'all') {
        const a = v.age;
        if (ageG === '18-25' && (a < 18 || a > 25)) return false;
        if (ageG === '26-35' && (a < 26 || a > 35)) return false;
        if (ageG === '36-50' && (a < 36 || a > 50)) return false;
        if (ageG === '51-65' && (a < 51 || a > 65)) return false;
        if (ageG === '65+' && a < 66) return false;
      }

      return true;
    });

    state.pagination.currentPage = 1;
    updatePaginationMath();
    renderVoters();
    updateResultsSummary();
  }

  function updatePaginationMath() {
    const total = state.filteredVoters.length;
    state.pagination.totalPages = Math.max(1, Math.ceil(total / state.pagination.pageSize));
    if (state.pagination.currentPage > state.pagination.totalPages) {
      state.pagination.currentPage = state.pagination.totalPages;
    }
  }

  // Render Voter List (Cards on Mobile, Data Table on Desktop)
  function renderVoters() {
    const total = state.filteredVoters.length;
    
    if (total === 0) {
      elements.votersGrid.style.display = 'none';
      if (elements.votersTableBody) elements.votersTableBody.parentElement.style.display = 'none';
      elements.emptyState.style.display = 'block';
      elements.paginationWrapper.style.display = 'none';
      return;
    }

    elements.emptyState.style.display = 'none';
    elements.votersGrid.style.display = '';
    if (elements.votersTableBody) elements.votersTableBody.parentElement.style.display = '';
    elements.paginationWrapper.style.display = 'flex';

    const startIdx = (state.pagination.currentPage - 1) * state.pagination.pageSize;
    const pageItems = state.filteredVoters.slice(startIdx, startIdx + state.pagination.pageSize);

    // 1. Mobile Cards
    elements.votersGrid.innerHTML = pageItems.map(v => createVoterCardHTML(v)).join('');

    // 2. Desktop Table Rows
    if (elements.votersTableBody) {
      elements.votersTableBody.innerHTML = pageItems.map(v => createTableRowHTML(v)).join('');
    }

    // 3. Pagination Controls
    renderPaginationUI(startIdx, pageItems.length, total);
  }

  // Mobile Voter Card HTML
  function createVoterCardHTML(v) {
    const isMale = v.gender === 'पुरुष';
    const genderClass = isMale ? 'male' : 'female';
    const genderLabel = isMale ? 'Male (पुरुष)' : 'Female (महिला)';
    const enName = v.nameEn && v.nameEn !== v.name ? `<div class="card-voter-name-en">${escapeHTML(v.nameEn)}</div>` : '';
    const enRel = v.relationNameEn && v.relationNameEn !== v.relationName && v.relationNameEn !== '—' ? ` (${escapeHTML(v.relationNameEn)})` : '';

    return `
      <div class="voter-card-item" data-sr="${v.serialNumber}">
        <div class="card-row-top">
          <span class="card-sr-pill">#${v.serialNumber}</span>
          <span class="gender-badge-pill ${genderClass}">${genderLabel}</span>
        </div>

        <div class="card-voter-name-heading hindi">${escapeHTML(v.name)}</div>
        ${enName}

        <div class="card-epic-row">
          <span class="card-epic-val">${escapeHTML(v.voterId)}</span>
          <button type="button" class="btn-card-copy-epic" data-copy="${escapeHTML(v.voterId)}" title="Copy Voter ID">
            <span>📋</span> <span>Copy</span>
          </button>
        </div>

        <div class="card-rel-row">
          <span>${escapeHTML(v.relationType)}:</span>
          <strong>${escapeHTML(v.relationName)}</strong>${enRel}
        </div>

        <div class="card-meta-chips-row">
          <span class="meta-chip-item">आयु: ${v.age} वर्ष</span>
          <span class="meta-chip-item">मकान: ${escapeHTML(v.houseNumber)}</span>
          <span class="meta-chip-item photo-ok">✓ फोटो उपलब्ध</span>
        </div>

        <button type="button" class="btn-card-view-details" data-view-sr="${v.serialNumber}">
          <span>View Details</span> <span>→</span>
        </button>
      </div>
    `;
  }

  // Desktop Table Row HTML
  function createTableRowHTML(v) {
    const isMale = v.gender === 'पुरुष';
    const genderClass = isMale ? 'male' : 'female';
    const genderLabel = isMale ? 'पुरुष' : 'महिला';
    const enName = v.nameEn && v.nameEn !== v.name ? `<div class="tbl-name-en">${escapeHTML(v.nameEn)}</div>` : '';
    const enRel = v.relationNameEn && v.relationNameEn !== v.relationName && v.relationNameEn !== '—' ? `<span style="font-size: 0.75rem; color: var(--text-tertiary);"> (${escapeHTML(v.relationNameEn)})</span>` : '';

    return `
      <tr data-view-sr="${v.serialNumber}">
        <td style="font-weight: 700; color: var(--text-tertiary);">#${v.serialNumber}</td>
        <td>
          <button type="button" class="btn-card-copy-epic" data-copy="${escapeHTML(v.voterId)}" title="Copy Voter ID" style="font-weight: 800; font-size: 0.8125rem;">
            <span>${escapeHTML(v.voterId)}</span> <span>📋</span>
          </button>
        </td>
        <td>
          <div class="tbl-name-hi">${escapeHTML(v.name)}</div>
          ${enName}
        </td>
        <td>
          <span style="font-size: 0.75rem; color: var(--text-tertiary);">${escapeHTML(v.relationType)}:</span>
          <span class="hindi" style="font-weight: 600;">${escapeHTML(v.relationName)}</span>${enRel}
        </td>
        <td style="font-weight: 700;">${escapeHTML(v.houseNumber)}</td>
        <td>${v.age}</td>
        <td><span class="gender-badge-pill ${genderClass}">${genderLabel}</span></td>
        <td><span style="font-size: 0.75rem; color: var(--success); font-weight: 700;">✓ उपलब्ध</span></td>
      </tr>
    `;
  }

  // Pagination UI Renderer
  function renderPaginationUI(startIdx, currentCount, totalCount) {
    const p = state.pagination;
    const endIdx = startIdx + currentCount;
    elements.pageInfo.textContent = `दिखाए जा रहे हैं ${startIdx + 1}–${endIdx} (कुल ${totalCount})`;

    elements.prevPageBtn.disabled = p.currentPage <= 1;
    elements.nextPageBtn.disabled = p.currentPage >= p.totalPages;

    let pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, p.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(p.totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    elements.pageNumbersContainer.innerHTML = '';
    for (let i = startPage; i <= endPage; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn-page-nav ${i === p.currentPage ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        state.pagination.currentPage = i;
        renderVoters();
        scrollToVoterSection();
      });
      elements.pageNumbersContainer.appendChild(btn);
    }
  }

  // Results Status Bar & Active Chips
  function updateResultsSummary() {
    const total = state.voters.length;
    const filtered = state.filteredVoters.length;

    let activeFilterCount = 0;
    if (state.filters.gender !== 'all') activeFilterCount++;
    if (state.filters.ageGroup !== 'all') activeFilterCount++;
    if (state.filters.section !== 'all') activeFilterCount++;
    if (state.filters.houseNumber !== 'all') activeFilterCount++;

    if (elements.filterBadgeCount) {
      if (activeFilterCount > 0) {
        elements.filterBadgeCount.style.display = 'inline';
        elements.filterBadgeCount.textContent = activeFilterCount;
      } else {
        elements.filterBadgeCount.style.display = 'none';
      }
    }

    if (filtered === total) {
      elements.resultsCount.textContent = `कुल ${total} मतदाता`;
    } else {
      elements.resultsCount.textContent = `${filtered} मतदाता मिले (${total} में से)`;
    }

    // Active filter chips
    elements.activeFilterChips.innerHTML = '';

    if (state.filters.gender !== 'all') {
      elements.activeFilterChips.appendChild(createChip(`लिंग: ${state.filters.gender}`, () => {
        state.filters.gender = 'all';
        syncFilterRadios();
        applyFilters();
      }));
    }

    if (state.filters.ageGroup !== 'all') {
      elements.activeFilterChips.appendChild(createChip(`आयु: ${state.filters.ageGroup}`, () => {
        state.filters.ageGroup = 'all';
        syncFilterRadios();
        applyFilters();
      }));
    }

    if (state.filters.section !== 'all') {
      const lbl = state.filters.section === 'mool' ? 'मूल सूची' : 'परिवर्धन सूची';
      elements.activeFilterChips.appendChild(createChip(`सूची: ${lbl}`, () => {
        state.filters.section = 'all';
        syncFilterRadios();
        applyFilters();
      }));
    }

    if (state.filters.houseNumber !== 'all') {
      elements.activeFilterChips.appendChild(createChip(`मकान: ${state.filters.houseNumber}`, () => {
        state.filters.houseNumber = 'all';
        if (elements.houseSelectFilter) elements.houseSelectFilter.value = 'all';
        applyFilters();
      }));
    }
  }

  function createChip(text, onRemove) {
    const chip = document.createElement('span');
    chip.className = 'chip-pill-active';
    chip.innerHTML = `<span>${escapeHTML(text)}</span> <span class="chip-remove-btn">×</span>`;
    chip.querySelector('.chip-remove-btn').addEventListener('click', onRemove);
    return chip;
  }

  // Detailed Voter Bottom Sheet / Modal
  function openVoterModal(serialNumber) {
    const voter = state.voters.find(v => v.serialNumber === serialNumber);
    if (!voter) return;

    const isMale = voter.gender === 'पुरुष';
    const genderClass = isMale ? 'male' : 'female';
    const genderLabel = isMale ? 'Male (पुरुष)' : 'Female (महिला)';

    elements.voterModalContent.innerHTML = `
      <div class="sheet-header-bar">
        <div>
          <span class="card-sr-pill">#${voter.serialNumber}</span>
          <h3 class="sheet-header-title hindi" style="margin-top: 0.15rem;">
            ${escapeHTML(voter.name)}
            <span style="font-size: 0.8125rem; font-weight: 500; color: var(--text-tertiary); font-family: var(--font-sans);">(${escapeHTML(voter.nameEn || '')})</span>
          </h3>
        </div>
        <button type="button" class="btn-sheet-close" id="modalCloseAction">✕</button>
      </div>

      <div class="sheet-scroll-body">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <button type="button" class="btn-card-copy-epic" data-copy="${escapeHTML(voter.voterId)}" style="font-size: 0.9375rem; padding: 0.35rem 0.75rem; background: var(--bg-subtle);">
            <span>${escapeHTML(voter.voterId)}</span>
            <span>📋 Copy</span>
          </button>
          <span class="gender-badge-pill ${genderClass}">${genderLabel}</span>
        </div>

        <div class="detail-meta-grid">
          <div class="detail-box-cell">
            <div class="detail-cell-label">मतदाता का नाम</div>
            <div class="detail-cell-value">${escapeHTML(voter.name)}</div>
          </div>

          <div class="detail-box-cell">
            <div class="detail-cell-label">${escapeHTML(voter.relationType)} का नाम</div>
            <div class="detail-cell-value">${escapeHTML(voter.relationName)}</div>
          </div>

          <div class="detail-box-cell">
            <div class="detail-cell-label">मकान संख्या</div>
            <div class="detail-cell-value">${escapeHTML(voter.houseNumber)}</div>
          </div>

          <div class="detail-box-cell">
            <div class="detail-cell-label">आयु / लिंग</div>
            <div class="detail-cell-value">${voter.age} वर्ष / ${escapeHTML(voter.gender)}</div>
          </div>

          <div class="detail-box-cell full-width">
            <div class="detail-cell-label">नामावली सूची भाग</div>
            <div class="detail-cell-value">${escapeHTML(voter.section)}</div>
          </div>

          <div class="detail-box-cell full-width">
            <div class="detail-cell-label">मतदान केंद्र विवरण</div>
            <div class="detail-cell-value">29 — गौतम सेकण्डरी स्कूल, पिलानी (कमरा नं 1)</div>
          </div>

          <div class="detail-box-cell full-width">
            <div class="detail-cell-label">मूल PDF पृष्ठ संदर्भ</div>
            <div class="detail-cell-value">आधिकारिक PDF पृष्ठ संख्या: ${voter.pageNumber}</div>
          </div>
        </div>
      </div>

      <div class="sheet-footer-actions">
        <button type="button" class="btn-open-map" data-copy="${escapeHTML(voter.voterId)}" style="width: 100%; justify-content: center;">
          <span>Voter ID कॉपी करें (Copy)</span>
        </button>
      </div>
    `;

    elements.voterModalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';

    const closeBtn = document.getElementById('modalCloseAction');
    if (closeBtn) closeBtn.addEventListener('click', closeVoterModal);
  }

  function closeVoterModal() {
    elements.voterModalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Filter Bottom Sheet Controls
  function openFilterModal() {
    elements.filterModalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeFilterModal() {
    elements.filterModalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  function syncFilterRadios() {
    const gRadio = document.querySelector(`input[name="filterGender"][value="${state.filters.gender}"]`);
    if (gRadio) gRadio.checked = true;

    const aRadio = document.querySelector(`input[name="filterAge"][value="${state.filters.ageGroup}"]`);
    if (aRadio) aRadio.checked = true;

    const sRadio = document.querySelector(`input[name="filterSection"][value="${state.filters.section}"]`);
    if (sRadio) sRadio.checked = true;

    if (elements.houseSelectFilter) elements.houseSelectFilter.value = state.filters.houseNumber;
  }

  // Interactive Map Viewer
  function setupMapViewer() {
    if (!elements.mapModalImg || !elements.mapModalViewport) return;

    function updateMapTransform() {
      elements.mapModalImg.style.transform = `translate(${state.map.posX}px, ${state.map.posY}px) scale(${state.map.scale})`;
    }

    function openMapModal() {
      elements.mapModalBackdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
      state.map.scale = 1;
      state.map.posX = 0;
      state.map.posY = 0;
      updateMapTransform();
    }

    function closeMapModal() {
      elements.mapModalBackdrop.classList.remove('open');
      document.body.style.overflow = '';
    }

    elements.mapTriggerBtn?.addEventListener('click', openMapModal);
    elements.btnOpenMapAction?.addEventListener('click', openMapModal);
    elements.mapModalCloseBtn?.addEventListener('click', closeMapModal);

    elements.zoomInBtn?.addEventListener('click', () => {
      state.map.scale = Math.min(state.map.scale + 0.3, 4);
      updateMapTransform();
    });

    elements.zoomOutBtn?.addEventListener('click', () => {
      state.map.scale = Math.max(state.map.scale - 0.3, 0.8);
      updateMapTransform();
    });

    elements.zoomResetBtn?.addEventListener('click', () => {
      state.map.scale = 1;
      state.map.posX = 0;
      state.map.posY = 0;
      updateMapTransform();
    });

    // Touch & Mouse Drag to Pan
    elements.mapModalViewport.addEventListener('mousedown', (e) => {
      state.map.isDragging = true;
      state.map.startX = e.clientX - state.map.posX;
      state.map.startY = e.clientY - state.map.posY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!state.map.isDragging) return;
      state.map.posX = e.clientX - state.map.startX;
      state.map.posY = e.clientY - state.map.startY;
      updateMapTransform();
    });

    window.addEventListener('mouseup', () => {
      state.map.isDragging = false;
    });

    // Touch Events
    let initialDistance = 0;
    elements.mapModalViewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        state.map.isDragging = true;
        state.map.startX = e.touches[0].clientX - state.map.posX;
        state.map.startY = e.touches[0].clientY - state.map.posY;
      } else if (e.touches.length === 2) {
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    elements.mapModalViewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && state.map.isDragging) {
        state.map.posX = e.touches[0].clientX - state.map.startX;
        state.map.posY = e.touches[0].clientY - state.map.startY;
        updateMapTransform();
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (initialDistance > 0) {
          const factor = dist / initialDistance;
          state.map.scale = Math.min(Math.max(state.map.scale * factor, 0.8), 4);
          initialDistance = dist;
          updateMapTransform();
        }
      }
    }, { passive: true });

    elements.mapModalViewport.addEventListener('touchend', () => {
      state.map.isDragging = false;
      initialDistance = 0;
    });
  }

  // Toast Notification System
  function showToast(message) {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<span>✓</span> <span>${escapeHTML(message)}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2200);
  }

  // Copy to Clipboard Helper
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      showToast(`Voter ID कॉपी किया गया: ${text}`);
    } catch (err) {
      showToast(`ID: ${text}`);
    }
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Search Input
    let searchTimeout;
    elements.searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      state.filters.search = e.target.value;
      if (elements.searchClearBtn) {
        elements.searchClearBtn.classList.toggle('visible', state.filters.search.length > 0);
      }
      searchTimeout = setTimeout(applyFilters, 150);
    });

    elements.searchClearBtn?.addEventListener('click', () => {
      state.filters.search = '';
      if (elements.searchInput) elements.searchInput.value = '';
      elements.searchClearBtn.classList.remove('visible');
      applyFilters();
    });

    // Boundary Toggle Accordion
    elements.boundaryToggleBtn?.addEventListener('click', () => {
      if (elements.boundaryFullText) {
        elements.boundaryFullText.classList.toggle('open');
        const isOpen = elements.boundaryFullText.classList.contains('open');
        if (elements.boundaryToggleIcon) elements.boundaryToggleIcon.textContent = isOpen ? '↑' : '↓';
      }
    });

    // Filter Trigger Modal
    elements.filterToggleBtn?.addEventListener('click', openFilterModal);
    elements.filterModalCloseBtn?.addEventListener('click', closeFilterModal);

    elements.emptyResetBtn?.addEventListener('click', () => {
      state.filters.gender = 'all';
      state.filters.ageGroup = 'all';
      state.filters.section = 'all';
      state.filters.houseNumber = 'all';
      state.filters.search = '';
      if (elements.searchInput) elements.searchInput.value = '';
      if (elements.searchClearBtn) elements.searchClearBtn.classList.remove('visible');
      syncFilterRadios();
      applyFilters();
    });

    // Click outside modal
    elements.voterModalBackdrop?.addEventListener('click', (e) => {
      if (e.target === elements.voterModalBackdrop) closeVoterModal();
    });

    elements.filterModalBackdrop?.addEventListener('click', (e) => {
      if (e.target === elements.filterModalBackdrop) closeFilterModal();
    });

    // Apply Filter Button
    elements.filterApplyBtn?.addEventListener('click', () => {
      const g = document.querySelector('input[name="filterGender"]:checked')?.value || 'all';
      const a = document.querySelector('input[name="filterAge"]:checked')?.value || 'all';
      const s = document.querySelector('input[name="filterSection"]:checked')?.value || 'all';
      const h = elements.houseSelectFilter?.value || 'all';

      state.filters.gender = g;
      state.filters.ageGroup = a;
      state.filters.section = s;
      state.filters.houseNumber = h;

      closeFilterModal();
      applyFilters();
      scrollToVoterSection();
    });

    // Reset Filters Button
    elements.filterResetBtn?.addEventListener('click', () => {
      state.filters.gender = 'all';
      state.filters.ageGroup = 'all';
      state.filters.section = 'all';
      state.filters.houseNumber = 'all';
      syncFilterRadios();
      closeFilterModal();
      applyFilters();
    });

    // Global Click Delegation
    document.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) {
        e.stopPropagation();
        const id = copyBtn.getAttribute('data-copy');
        if (id) copyToClipboard(id);
        return;
      }

      const viewCard = e.target.closest('[data-view-sr]');
      if (viewCard) {
        const sr = parseInt(viewCard.getAttribute('data-view-sr'), 10);
        if (!isNaN(sr)) openVoterModal(sr);
        return;
      }
    });

    // Pagination Controls
    elements.prevPageBtn?.addEventListener('click', () => {
      if (state.pagination.currentPage > 1) {
        state.pagination.currentPage--;
        renderVoters();
        scrollToVoterSection();
      }
    });

    elements.nextPageBtn?.addEventListener('click', () => {
      if (state.pagination.currentPage < state.pagination.totalPages) {
        state.pagination.currentPage++;
        renderVoters();
        scrollToVoterSection();
      }
    });

    // Bottom Navigation Scroll Spy
    window.addEventListener('scroll', () => {
      updateBottomNavActiveState();
    }, { passive: true });

    // Keyboard ESC to close open modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeVoterModal();
        closeFilterModal();
        elements.mapModalBackdrop?.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  function scrollToVoterSection() {
    const sec = document.getElementById('voters');
    if (sec) {
      const top = sec.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function updateBottomNavActiveState() {
    const sections = ['overview', 'stats', 'map', 'voters', 'polling-station'];
    const scrollPos = window.scrollY + 160;

    for (const id of sections) {
      const el = document.getElementById(id);
      if (el) {
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          elements.bottomNavLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
          break;
        }
      }
    }
  }

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
