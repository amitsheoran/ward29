/**
 * Ward 29 Pilani - Electoral Information System
 * Production-Quality Vanilla JavaScript Application
 */

(function () {
  'use strict';

  // State Management
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

  // DOM Element Selectors
  const elements = {
    // Search & Filter
    searchInput: document.getElementById('voterSearchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    filterToggleBtn: document.getElementById('filterToggleBtn'),
    filterBadgeCount: document.getElementById('filterBadgeCount'),
    resultsCount: document.getElementById('resultsCount'),
    activeFilterChips: document.getElementById('activeFilterChips'),
    
    // Voter Render Containers
    votersGrid: document.getElementById('votersGrid'),
    votersTableBody: document.getElementById('votersTableBody'),
    emptyState: document.getElementById('emptyState'),
    
    // Pagination
    paginationWrapper: document.getElementById('paginationWrapper'),
    pageInfo: document.getElementById('pageInfo'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageNumbersContainer: document.getElementById('pageNumbersContainer'),
    
    // Modals & Bottom Sheets
    voterModalBackdrop: document.getElementById('voterModalBackdrop'),
    voterModalContent: document.getElementById('voterModalContent'),
    voterModalCloseBtn: document.getElementById('voterModalCloseBtn'),
    
    filterModalBackdrop: document.getElementById('filterModalBackdrop'),
    filterModalCloseBtn: document.getElementById('filterModalCloseBtn'),
    filterApplyBtn: document.getElementById('filterApplyBtn'),
    filterResetBtn: document.getElementById('filterResetBtn'),
    houseSelectFilter: document.getElementById('houseSelectFilter'),
    
    // Map Viewer
    mapCard: document.getElementById('mapCard'),
    mapViewport: document.getElementById('mapViewport'),
    mapImage: document.getElementById('mapImage'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomResetBtn: document.getElementById('zoomResetBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    
    // Toast & Navigation
    toastContainer: document.getElementById('toastContainer'),
    backToTopBtn: document.getElementById('backToTopBtn'),
    navPills: document.querySelectorAll('.nav-pill')
  };

  // Initialize Application
  async function init() {
    try {
      await loadData();
      populateWardMetadata();
      populateStatistics();
      populateHouseFilterOptions();
      setupEventListeners();
      setupMapViewer();
      applyFilters();
    } catch (err) {
      console.error('Initialization error:', err);
      showToast('डेटा लोड करने में समस्या हुई। कृपया पुनः प्रयास करें।');
    }
  }

  // Load JSON Data
  async function loadData() {
    const [wardRes, votersRes] = await Promise.all([
      fetch('./data/ward.json'),
      fetch('./data/voters.json')
    ]);

    if (!wardRes.ok || !votersRes.ok) {
      throw new Error('Failed to load JSON files');
    }

    state.ward = await wardRes.json();
    state.voters = await votersRes.json();
    state.filteredVoters = [...state.voters];
  }

  // Populate Ward Metadata
  function populateWardMetadata() {
    if (!state.ward) return;
    const w = state.ward;

    // Polling Station Card
    const psName = document.getElementById('psName');
    const psAddress = document.getElementById('psAddress');
    if (psName) psName.textContent = w.pollingStation.name;
    if (psAddress) psAddress.textContent = `${w.pollingStation.address} (${w.pollingStation.building})`;

    // Boundaries
    const wardBoundaryText = document.getElementById('wardBoundaryText');
    const partBoundaryText = document.getElementById('partBoundaryText');
    if (wardBoundaryText) wardBoundaryText.textContent = w.boundaries.wardBoundary;
    if (partBoundaryText) partBoundaryText.textContent = w.boundaries.partBoundary;
  }

  // Populate Statistics Section
  function populateStatistics() {
    if (!state.ward || !state.voters.length) return;
    const stats = state.ward.statistics.totalVoters;

    const totalVotersVal = document.getElementById('statTotalVoters');
    const maleVotersVal = document.getElementById('statMaleVoters');
    const femaleVotersVal = document.getElementById('statFemaleVoters');
    const tgVotersVal = document.getElementById('statTGVoters');

    if (totalVotersVal) totalVotersVal.textContent = stats.total.toLocaleString('en-IN');
    if (maleVotersVal) maleVotersVal.textContent = stats.male.toLocaleString('en-IN');
    if (femaleVotersVal) femaleVotersVal.textContent = stats.female.toLocaleString('en-IN');
    if (tgVotersVal) tgVotersVal.textContent = stats.thirdGender.toLocaleString('en-IN');

    // Visual Gender Bar
    const malePct = ((stats.male / stats.total) * 100).toFixed(1);
    const femalePct = ((stats.female / stats.total) * 100).toFixed(1);

    const maleBar = document.getElementById('genderBarMale');
    const malePctLabel = document.getElementById('genderMalePct');
    const femalePctLabel = document.getElementById('genderFemalePct');

    if (maleBar) maleBar.style.width = `${malePct}%`;
    if (malePctLabel) malePctLabel.textContent = `पुरुष: ${stats.male} (${malePct}%)`;
    if (femalePctLabel) femalePctLabel.textContent = `महिला: ${stats.female} (${femalePct}%)`;

    // Age Cohort Calculation
    const cohorts = {
      '18-25': 0,
      '26-35': 0,
      '36-50': 0,
      '51-65': 0,
      '65+': 0
    };

    state.voters.forEach(v => {
      const a = v.age;
      if (a <= 25) cohorts['18-25']++;
      else if (a <= 35) cohorts['26-35']++;
      else if (a <= 50) cohorts['36-50']++;
      else if (a <= 65) cohorts['51-65']++;
      else cohorts['65+']++;
    });

    const maxCohort = Math.max(...Object.values(cohorts));
    for (const [cohortKey, count] of Object.entries(cohorts)) {
      const barEl = document.getElementById(`cohortBar_${cohortKey}`);
      const countEl = document.getElementById(`cohortCount_${cohortKey}`);
      if (barEl) barEl.style.width = `${(count / maxCohort) * 100}%`;
      if (countEl) countEl.textContent = count;
    }
  }

  // Populate House Filter Dropdown
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

  // Filter & Search Engine
  function applyFilters() {
    const q = state.filters.search.trim().toLowerCase();
    const g = state.filters.gender;
    const ageG = state.filters.ageGroup;
    const sec = state.filters.section;
    const hNo = state.filters.houseNumber;

    state.filteredVoters = state.voters.filter(v => {
      // 1. Search Query
      if (q) {
        const matchName = v.name.toLowerCase().includes(q);
        const matchId = v.voterId.toLowerCase().includes(q);
        const matchRel = v.relationName.toLowerCase().includes(q);
        const matchHn = String(v.houseNumber).toLowerCase().includes(q);
        const matchSr = String(v.serialNumber) === q;
        if (!matchName && !matchId && !matchRel && !matchHn && !matchSr) {
          return false;
        }
      }

      // 2. Gender Filter
      if (g !== 'all' && v.gender !== g) {
        return false;
      }

      // 3. Section Filter
      if (sec !== 'all') {
        if (sec === 'mool' && !v.section.includes('मूल सूची')) return false;
        if (sec === 'pari' && !v.section.includes('परिवर्धन सूची')) return false;
      }

      // 4. House Number Filter
      if (hNo !== 'all' && v.houseNumber !== hNo) {
        return false;
      }

      // 5. Age Group Filter
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

  // Update Pagination Calculations
  function updatePaginationMath() {
    const total = state.filteredVoters.length;
    state.pagination.totalPages = Math.max(1, Math.ceil(total / state.pagination.pageSize));
    if (state.pagination.currentPage > state.pagination.totalPages) {
      state.pagination.currentPage = state.pagination.totalPages;
    }
  }

  // Render Voter List (Both Mobile Cards and Desktop Table)
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

    // 1. Render Mobile Cards
    elements.votersGrid.innerHTML = pageItems.map(v => createVoterCardHTML(v)).join('');

    // 2. Render Desktop Table Rows
    if (elements.votersTableBody) {
      elements.votersTableBody.innerHTML = pageItems.map(v => createTableRowHTML(v)).join('');
    }

    // 3. Update Pagination UI
    renderPaginationUI(startIdx, pageItems.length, total);
  }

  // HTML Template for Mobile Voter Card
  function createVoterCardHTML(v) {
    const isMale = v.gender === 'पुरुष';
    const genderClass = isMale ? 'badge-gender-male' : 'badge-gender-female';

    return `
      <div class="voter-card" data-sr="${v.serialNumber}">
        <div class="card-top-row">
          <span class="card-sr-badge">#${v.serialNumber}</span>
          <button type="button" class="card-voter-id-btn" data-copy="${escapeHTML(v.voterId)}" title="Copy Voter ID">
            <span>${escapeHTML(v.voterId)}</span>
            <span class="copy-icon">📋</span>
          </button>
        </div>

        <div class="card-name hindi">${escapeHTML(v.name)}</div>

        <div class="card-relation hindi">
          <span class="card-relation-label">${escapeHTML(v.relationType)} का नाम:</span>
          <span class="card-relation-val">${escapeHTML(v.relationName)}</span>
        </div>

        <div class="card-badges-row">
          <span class="badge ${genderClass}">${escapeHTML(v.gender)}</span>
          <span class="badge badge-house">आयु: ${v.age} वर्ष</span>
          <span class="badge badge-house">मकान: ${escapeHTML(v.houseNumber)}</span>
          <span class="badge badge-photo">✓ फोटो उपलब्ध</span>
        </div>

        <button type="button" class="card-detail-btn" data-view-sr="${v.serialNumber}">
          <span>पूर्ण विवरण देखें</span>
          <span>→</span>
        </button>
      </div>
    `;
  }

  // HTML Template for Desktop Table Row
  function createTableRowHTML(v) {
    const isMale = v.gender === 'पुरुष';
    const genderClass = isMale ? 'badge-gender-male' : 'badge-gender-female';

    return `
      <tr data-view-sr="${v.serialNumber}">
        <td style="font-weight: 700; color: var(--text-muted);">#${v.serialNumber}</td>
        <td>
          <button type="button" class="card-voter-id-btn" data-copy="${escapeHTML(v.voterId)}" title="Copy Voter ID">
            <span>${escapeHTML(v.voterId)}</span>
            <span class="copy-icon">📋</span>
          </button>
        </td>
        <td class="hindi-name">${escapeHTML(v.name)}</td>
        <td class="hindi-rel">
          <span style="font-size: 0.75rem; color: var(--text-subtle);">${escapeHTML(v.relationType)}:</span>
          ${escapeHTML(v.relationName)}
        </td>
        <td style="font-weight: 600;">${escapeHTML(v.houseNumber)}</td>
        <td>${v.age}</td>
        <td><span class="badge ${genderClass}">${escapeHTML(v.gender)}</span></td>
        <td><span class="badge badge-photo">उपलब्ध</span></td>
      </tr>
    `;
  }

  // Render Pagination Controls
  function renderPaginationUI(startIdx, currentCount, totalCount) {
    const p = state.pagination;
    
    // Page Info text
    const endIdx = startIdx + currentCount;
    elements.pageInfo.textContent = `दिखाए जा रहे हैं ${startIdx + 1}–${endIdx} (कुल ${totalCount} में से)`;

    elements.prevPageBtn.disabled = p.currentPage <= 1;
    elements.nextPageBtn.disabled = p.currentPage >= p.totalPages;

    // Generate page numbers
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
      btn.className = `page-btn ${i === p.currentPage ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', () => {
        state.pagination.currentPage = i;
        renderVoters();
        scrollToVoterSection();
      });
      elements.pageNumbersContainer.appendChild(btn);
    }
  }

  // Update Result Count & Active Filter Chips
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

    // Render active filter chips
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
    chip.className = 'filter-chip';
    chip.innerHTML = `<span>${escapeHTML(text)}</span> <span class="filter-chip-remove">×</span>`;
    chip.querySelector('.filter-chip-remove').addEventListener('click', onRemove);
    return chip;
  }

  // Open Detailed Voter Modal / Bottom Sheet
  function openVoterModal(serialNumber) {
    const voter = state.voters.find(v => v.serialNumber === serialNumber);
    if (!voter) return;

    const isMale = voter.gender === 'पुरुष';
    const genderClass = isMale ? 'badge-gender-male' : 'badge-gender-female';

    elements.voterModalContent.innerHTML = `
      <div class="modal-header">
        <div>
          <span class="card-sr-badge" style="margin-bottom: 0.25rem;">क्रमांक #${voter.serialNumber}</span>
          <h3 class="modal-title hindi">${escapeHTML(voter.name)}</h3>
        </div>
        <button type="button" class="modal-close-btn" id="modalCloseAction">✕</button>
      </div>

      <div class="modal-body">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <button type="button" class="card-voter-id-btn" data-copy="${escapeHTML(voter.voterId)}" style="font-size: 0.9375rem; padding: 0.35rem 0.75rem;">
            <span>${escapeHTML(voter.voterId)}</span>
            <span class="copy-icon">📋</span>
          </button>
          <span class="badge ${genderClass}">${escapeHTML(voter.gender)}</span>
        </div>

        <div class="voter-detail-grid">
          <div class="voter-detail-item">
            <div class="voter-detail-label">मतदाता का नाम</div>
            <div class="voter-detail-val">${escapeHTML(voter.name)}</div>
          </div>

          <div class="voter-detail-item">
            <div class="voter-detail-label">${escapeHTML(voter.relationType)} का नाम</div>
            <div class="voter-detail-val">${escapeHTML(voter.relationName)}</div>
          </div>

          <div class="voter-detail-item">
            <div class="voter-detail-label">मकान संख्या</div>
            <div class="voter-detail-val">${escapeHTML(voter.houseNumber)}</div>
          </div>

          <div class="voter-detail-item">
            <div class="voter-detail-label">आयु / लिंग</div>
            <div class="voter-detail-val">${voter.age} वर्ष / ${escapeHTML(voter.gender)}</div>
          </div>

          <div class="voter-detail-item full-width">
            <div class="voter-detail-label">नामावली सूची भाग</div>
            <div class="voter-detail-val">${escapeHTML(voter.section)}</div>
          </div>

          <div class="voter-detail-item full-width">
            <div class="voter-detail-label">मतदान केंद्र विवरण</div>
            <div class="voter-detail-val">29 - गौतम सेकण्डरी स्कूल, पिलानी (कमरा नं 1)</div>
          </div>

          <div class="voter-detail-item full-width">
            <div class="voter-detail-label">मूल PDF पृष्ठ संदर्भ</div>
            <div class="voter-detail-val">आधिकारिक PDF पृष्ठ संख्या: ${voter.pageNumber}</div>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="empty-btn" data-copy="${escapeHTML(voter.voterId)}" style="margin-top: 0;">
          <span>Voter ID कॉपी करें</span>
        </button>
      </div>
    `;

    elements.voterModalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Hook modal close inside
    const closeBtn = document.getElementById('modalCloseAction');
    if (closeBtn) closeBtn.addEventListener('click', closeVoterModal);
  }

  function closeVoterModal() {
    elements.voterModalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Filter Modal Controls
  function openFilterModal() {
    elements.filterModalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeFilterModal() {
    elements.filterModalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
  }

  function syncFilterRadios() {
    // Gender
    const gRadio = document.querySelector(`input[name="filterGender"][value="${state.filters.gender}"]`);
    if (gRadio) gRadio.checked = true;

    // Age
    const aRadio = document.querySelector(`input[name="filterAge"][value="${state.filters.ageGroup}"]`);
    if (aRadio) aRadio.checked = true;

    // Section
    const sRadio = document.querySelector(`input[name="filterSection"][value="${state.filters.section}"]`);
    if (sRadio) sRadio.checked = true;

    // House
    if (elements.houseSelectFilter) elements.houseSelectFilter.value = state.filters.houseNumber;
  }

  // Toast Notification System
  function showToast(message) {
    if (!elements.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
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
      console.warn('Copy failed:', err);
      showToast(`ID: ${text}`);
    }
  }

  // Interactive Map Viewer Controller
  function setupMapViewer() {
    if (!elements.mapImage || !elements.mapViewport) return;

    function updateMapTransform() {
      elements.mapImage.style.transform = `translate(${state.map.posX}px, ${state.map.posY}px) scale(${state.map.scale})`;
    }

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

    elements.fullscreenBtn?.addEventListener('click', () => {
      elements.mapCard.classList.toggle('fullscreen');
      const isFull = elements.mapCard.classList.contains('fullscreen');
      elements.fullscreenBtn.innerHTML = isFull ? '<span>✕</span> <span>बंद करें</span>' : '<span>⛶</span> <span>फुलस्क्रीन</span>';
      if (!isFull) {
        state.map.scale = 1;
        state.map.posX = 0;
        state.map.posY = 0;
        updateMapTransform();
      }
    });

    // Touch & Mouse Drag to Pan
    elements.mapViewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('.map-ctrl-btn')) return;
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
    elements.mapViewport.addEventListener('touchstart', (e) => {
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

    elements.mapViewport.addEventListener('touchmove', (e) => {
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

    elements.mapViewport.addEventListener('touchend', () => {
      state.map.isDragging = false;
      initialDistance = 0;
    });
  }

  // Setup Event Listeners
  function setupEventListeners() {
    // Instant Search
    let searchTimeout;
    elements.searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      state.filters.search = e.target.value;
      if (elements.searchClearBtn) {
        elements.searchClearBtn.classList.toggle('visible', state.filters.search.length > 0);
      }
      searchTimeout = setTimeout(applyFilters, 180);
    });

    elements.searchClearBtn?.addEventListener('click', () => {
      state.filters.search = '';
      if (elements.searchInput) elements.searchInput.value = '';
      elements.searchClearBtn.classList.remove('visible');
      applyFilters();
    });

    // Filter Trigger Modal
    elements.filterToggleBtn?.addEventListener('click', openFilterModal);
    elements.filterModalCloseBtn?.addEventListener('click', closeFilterModal);
    elements.voterModalCloseBtn?.addEventListener('click', closeVoterModal);

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

    // Global Click Delegation for Card Actions & Copy Buttons
    document.addEventListener('click', (e) => {
      // Copy Voter ID
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn) {
        e.stopPropagation();
        const id = copyBtn.getAttribute('data-copy');
        if (id) copyToClipboard(id);
        return;
      }

      // View Details
      const viewCard = e.target.closest('[data-view-sr]');
      if (viewCard) {
        const sr = parseInt(viewCard.getAttribute('data-view-sr'), 10);
        if (!isNaN(sr)) openVoterModal(sr);
        return;
      }
    });

    // Pagination Next / Prev
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

    // Back to top button
    window.addEventListener('scroll', () => {
      if (elements.backToTopBtn) {
        elements.backToTopBtn.classList.toggle('visible', window.scrollY > 400);
      }
      updateActiveNavPill();
    }, { passive: true });

    elements.backToTopBtn?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Keyboard ESC to close modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeVoterModal();
        closeFilterModal();
      }
    });
  }

  function scrollToVoterSection() {
    const sec = document.getElementById('voters');
    if (sec) {
      const top = sec.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  function updateActiveNavPill() {
    const sections = ['overview', 'stats', 'map', 'boundaries', 'polling-station', 'voters', 'source'];
    const scrollPos = window.scrollY + 140;

    for (const id of sections) {
      const el = document.getElementById(id);
      if (el) {
        const top = el.offsetTop;
        const height = el.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          elements.navPills.forEach(pill => {
            pill.classList.toggle('active', pill.getAttribute('href') === `#${id}`);
          });
          break;
        }
      }
    }
  }

  // Security Helper: Escape HTML
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
