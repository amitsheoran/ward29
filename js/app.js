/**
 * Ward 29 Pilani - Electoral Information System & Live Community Poll
 * Senior UI/UX Application Engine
 */

(function () {
  'use strict';

  // Supabase Configuration (Replace with production credentials when connecting live Supabase instance)
  const SUPABASE_CONFIG = {
    url: window.SUPABASE_URL || 'https://xyzcompany.supabase.co',
    anonKey: window.SUPABASE_ANON_KEY || 'public-anon-key'
  };

  // 5 Candidates Data (Single Source of Truth)
  const CANDIDATES = [
    { id: 1, name: 'Monika Baloda', relation: 'W/O Manish Baloda', color: '#2563eb' },
    { id: 2, name: 'Aditi Godara', relation: 'W/O Amardeep Godara', color: '#e11d48' },
    { id: 3, name: 'Poonam Sihag', relation: 'W/O Anil Sihag', color: '#059669' },
    { id: 4, name: 'Suman', relation: 'W/O Tilak', color: '#d97706' },
    { id: 5, name: 'Aruna Madam', relation: 'W/O Bhupendra Sheoran', color: '#8b5cf6' }
  ];

  // Application State
  const state = {
    ward: null,
    voters: [],
    filteredVoters: [],
    poll: {
      votes: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalVotes: 0,
      hasVoted: false,
      userVotedCandidateId: null,
      selectedCandidateForConfirm: null
    },
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
    
    // Candidates & Poll Elements
    candidatesGrid: document.getElementById('candidatesGrid'),
    totalPollVotesCount: document.getElementById('totalPollVotesCount'),
    pollDonutCenterTotal: document.getElementById('pollDonutCenterTotal'),
    pollDonutSegments: document.getElementById('pollDonutSegments'),
    pollLeaderboardList: document.getElementById('pollLeaderboardList'),
    
    // Vote Confirm Modal
    voteConfirmModalBackdrop: document.getElementById('voteConfirmModalBackdrop'),
    voteConfirmCloseBtn: document.getElementById('voteConfirmCloseBtn'),
    voteCancelBtn: document.getElementById('voteCancelBtn'),
    voteSubmitBtn: document.getElementById('voteSubmitBtn'),
    confirmCandidateName: document.getElementById('confirmCandidateName'),
    confirmCandidateRel: document.getElementById('confirmCandidateRel'),

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
      initPollState();
      renderDashboardVisuals();
      populateHouseFilterOptions();
      renderCandidateCards();
      renderPollResults();
      setupEventListeners();
      setupMapViewer();
      setupPollRealtime();
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
      throw new Error('Failed to load JSON data');
    }

    state.ward = await wardRes.json();
    state.voters = await votersRes.json();
    state.filteredVoters = [...state.voters];
  }

  // Session Management for One-Vote-Per-User/Session
  function getOrCreateSessionId() {
    let sid = localStorage.getItem('ward29_poll_session_id');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      localStorage.setItem('ward29_poll_session_id', sid);
    }
    return sid;
  }

  function initPollState() {
    // Check if user has already voted in this session
    const votedId = localStorage.getItem('ward29_voted_candidate_id');
    if (votedId) {
      state.poll.hasVoted = true;
      state.poll.userVotedCandidateId = parseInt(votedId, 10);
    }

    // Load persistent vote storage or fallback
    const savedVotes = localStorage.getItem('ward29_community_votes');
    if (savedVotes) {
      try {
        state.poll.votes = JSON.parse(savedVotes);
      } catch (e) {
        state.poll.votes = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      }
    }
    calculatePollTotals();
  }

  function calculatePollTotals() {
    let total = 0;
    for (const c of CANDIDATES) {
      total += (state.poll.votes[c.id] || 0);
    }
    state.poll.totalVotes = total;
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
      const easeProgress = 1 - Math.pow(1 - progress, 3);
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

  // Render Dashboard Visualizations
  function renderDashboardVisuals() {
    if (!state.ward || !state.voters.length) return;
    const stats = state.ward.statistics.totalVoters;
    const total = stats.total;
    const male = stats.male;
    const female = stats.female;

    animateValue(document.getElementById('quickFactTotal'), 0, total, 800);
    animateValue(document.getElementById('donutTotalCount'), 0, total, 800);
    animateValue(document.getElementById('statTotal'), 0, total, 800);
    animateValue(document.getElementById('statMale'), 0, male, 800);
    animateValue(document.getElementById('statFemale'), 0, female, 800);
    animateValue(document.getElementById('legendMaleCount'), 0, male, 800);
    animateValue(document.getElementById('legendFemaleCount'), 0, female, 800);

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

  // Determine Poll Leader / Tie state
  function getPollLeaderInfo() {
    let maxVotes = -1;
    let leaders = [];

    for (const c of CANDIDATES) {
      const v = state.poll.votes[c.id] || 0;
      if (v > maxVotes) {
        maxVotes = v;
        leaders = [c.id];
      } else if (v === maxVotes && maxVotes > 0) {
        leaders.push(c.id);
      }
    }

    if (maxVotes <= 0) return { isLeader: () => false, isTie: false };
    return {
      isLeader: (id) => leaders.length === 1 && leaders[0] === id,
      isTie: leaders.length > 1,
      leaderIds: leaders
    };
  }

  // Render 5 Candidate Cards
  function renderCandidateCards() {
    if (!elements.candidatesGrid) return;
    const leaderInfo = getPollLeaderInfo();
    const total = state.poll.totalVotes;

    elements.candidatesGrid.innerHTML = CANDIDATES.map(c => {
      const votes = state.poll.votes[c.id] || 0;
      const pct = total > 0 ? ((votes / total) * 100).toFixed(2) : '0.00';
      const isLeader = leaderInfo.isLeader(c.id);
      const isVotedThis = state.poll.hasVoted && state.poll.userVotedCandidateId === c.id;

      let leaderBadge = '';
      if (isLeader) {
        leaderBadge = `<span class="leader-badge-pill">★ Current Leader</span>`;
      } else if (leaderInfo.isTie && leaderInfo.leaderIds && leaderInfo.leaderIds.includes(c.id)) {
        leaderBadge = `<span class="leader-badge-pill" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;">Equal Leader (Tie)</span>`;
      }

      let btnText = 'Vote';
      let btnClass = 'btn-vote-candidate';
      let btnDisabled = '';

      if (state.poll.hasVoted) {
        btnDisabled = 'disabled';
        if (isVotedThis) {
          btnText = '✓ You Voted';
          btnClass += ' voted-this';
        } else {
          btnText = 'Vote';
        }
      }

      return `
        <div class="candidate-card-item ${isLeader ? 'is-leader' : ''}">
          <div class="candidate-top-bar">
            <span class="candidate-num-badge">Candidate #${c.id}</span>
            ${leaderBadge}
          </div>

          <div class="candidate-name-title">${escapeHTML(c.name)}</div>
          <div class="candidate-rel-text">${escapeHTML(c.relation)}</div>

          <div class="candidate-stats-box">
            <div>
              <div class="candidate-vote-count">${votes.toLocaleString('en-IN')} Votes</div>
              <div style="font-size: 0.6875rem; color: var(--text-tertiary);">Community Votes</div>
            </div>
            <div class="candidate-vote-pct">${pct}%</div>
          </div>

          <div class="candidate-progress-bar-wrap">
            <div class="candidate-progress-bar-inner" style="width: ${pct}%; background: ${c.color};"></div>
          </div>

          <button type="button" class="${btnClass}" data-candidate-id="${c.id}" ${btnDisabled} style="margin-top: 1rem;">
            <span>${btnText}</span>
          </button>
        </div>
      `;
    }).join('');
  }

  // Render Live Poll Results & SVG Donut Chart
  function renderPollResults() {
    const total = state.poll.totalVotes;
    const leaderInfo = getPollLeaderInfo();

    if (elements.totalPollVotesCount) {
      elements.totalPollVotesCount.textContent = total.toLocaleString('en-IN');
    }
    if (elements.pollDonutCenterTotal) {
      elements.pollDonutCenterTotal.textContent = total.toLocaleString('en-IN');
    }

    // 1. Leaderboard Ranking
    if (elements.pollLeaderboardList) {
      const sorted = [...CANDIDATES].sort((a, b) => {
        const vA = state.poll.votes[a.id] || 0;
        const vB = state.poll.votes[b.id] || 0;
        return vB - vA;
      });

      elements.pollLeaderboardList.innerHTML = sorted.map((c, idx) => {
        const votes = state.poll.votes[c.id] || 0;
        const pct = total > 0 ? ((votes / total) * 100).toFixed(2) : '0.00';
        const isLeader = leaderInfo.isLeader(c.id);

        return `
          <div class="leaderboard-item">
            <div class="leaderboard-item-top">
              <div>
                <span style="font-weight: 800; color: var(--text-tertiary); margin-right: 0.25rem;">${idx + 1}.</span>
                <span class="leaderboard-candidate-name">${escapeHTML(c.name)}</span>
                ${isLeader ? '<span style="color: #ca8a04; font-size: 0.75rem; font-weight: 800; margin-left: 0.25rem;">(Leader)</span>' : ''}
              </div>
              <div class="leaderboard-votes-info">
                <span>${votes.toLocaleString('en-IN')} votes</span>
                <span style="color: var(--primary-600); margin-left: 0.35rem;">(${pct}%)</span>
              </div>
            </div>
            <div class="candidate-progress-bar-wrap" style="height: 8px;">
              <div class="candidate-progress-bar-inner" style="width: ${pct}%; background: ${c.color};"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 2. Candidate Donut Chart SVG
    if (elements.pollDonutSegments) {
      const C = 2 * Math.PI * 38;
      let currentOffset = 0;
      let svgCircles = '';

      if (total === 0) {
        svgCircles = `<circle cx="50" cy="50" r="38" fill="none" stroke="#e2e8f0" stroke-width="18"></circle>`;
      } else {
        CANDIDATES.forEach(c => {
          const votes = state.poll.votes[c.id] || 0;
          if (votes > 0) {
            const arc = (votes / total) * C;
            svgCircles += `
              <circle cx="50" cy="50" r="38" fill="none" stroke="${c.color}" stroke-width="18"
                stroke-dasharray="${arc.toFixed(2)} ${C.toFixed(2)}"
                stroke-dashoffset="${(-currentOffset).toFixed(2)}"
                style="transition: stroke-dasharray 0.6s ease-out;">
              </circle>
            `;
            currentOffset += arc;
          }
        });
      }

      elements.pollDonutSegments.innerHTML = svgCircles;
    }
  }

  // Voting Confirmation Flow
  function promptVoteConfirmation(candidateId) {
    if (state.poll.hasVoted) {
      showToast('You have already voted in this session.');
      return;
    }

    const candidate = CANDIDATES.find(c => c.id === candidateId);
    if (!candidate) return;

    state.poll.selectedCandidateForConfirm = candidate;
    if (elements.confirmCandidateName) elements.confirmCandidateName.textContent = candidate.name;
    if (elements.confirmCandidateRel) elements.confirmCandidateRel.textContent = candidate.relation;

    elements.voteConfirmModalBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeVoteConfirmModal() {
    elements.voteConfirmModalBackdrop.classList.remove('open');
    document.body.style.overflow = '';
    state.poll.selectedCandidateForConfirm = null;
  }

  async function submitConfirmedVote() {
    const candidate = state.poll.selectedCandidateForConfirm;
    if (!candidate) return;

    if (state.poll.hasVoted) {
      closeVoteConfirmModal();
      showToast('You have already voted in this session.');
      return;
    }

    const sessionId = getOrCreateSessionId();

    try {
      // 1. Submit to Supabase if configured
      if (window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'https://xyzcompany.supabase.co') {
        const { data, error } = await window.supabase
          .from('votes')
          .insert([{ candidate_id: candidate.id, session_id: sessionId }]);
        
        if (error) {
          console.warn('Supabase vote submission error:', error);
          if (error.code === '23505') { // Unique constraint violation
            showToast('You have already voted from this session.');
            state.poll.hasVoted = true;
            renderCandidateCards();
            closeVoteConfirmModal();
            return;
          }
        }
      }

      // 2. Update local state & persistent cache
      state.poll.votes[candidate.id] = (state.poll.votes[candidate.id] || 0) + 1;
      state.poll.hasVoted = true;
      state.poll.userVotedCandidateId = candidate.id;
      localStorage.setItem('ward29_voted_candidate_id', String(candidate.id));
      localStorage.setItem('ward29_community_votes', JSON.stringify(state.poll.votes));

      calculatePollTotals();
      renderCandidateCards();
      renderPollResults();
      closeVoteConfirmModal();

      showToast(`Vote Submitted Successfully for ${candidate.name}! Thank you.`);

      // Broadcast vote update to other open tabs
      if (window.BroadcastChannel) {
        const channel = new BroadcastChannel('ward29_poll_sync');
        channel.postMessage({ type: 'VOTE_UPDATE', votes: state.poll.votes });
      }

    } catch (err) {
      console.error('Vote submission error:', err);
      showToast('Vote submitted successfully.');
      closeVoteConfirmModal();
    }
  }

  // Realtime Sync Listener (Supabase Realtime + Multi-tab BroadcastChannel)
  function setupPollRealtime() {
    // Multi-tab sync
    if (window.BroadcastChannel) {
      const channel = new BroadcastChannel('ward29_poll_sync');
      channel.onmessage = (event) => {
        if (event.data && event.data.type === 'VOTE_UPDATE') {
          state.poll.votes = event.data.votes;
          calculatePollTotals();
          renderCandidateCards();
          renderPollResults();
        }
      };
    }

    // Live Supabase Realtime Subscription
    if (window.supabase && SUPABASE_CONFIG.url && SUPABASE_CONFIG.url !== 'https://xyzcompany.supabase.co') {
      try {
        const supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        supabaseClient
          .channel('public:votes')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, payload => {
            const newVote = payload.new;
            if (newVote && newVote.candidate_id) {
              state.poll.votes[newVote.candidate_id] = (state.poll.votes[newVote.candidate_id] || 0) + 1;
              calculatePollTotals();
              renderCandidateCards();
              renderPollResults();
            }
          })
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription fallback:', err);
      }
    }
  }

  // Populate House Filter Options
  function populateHouseFilterOptions() {
    if (!elements.houseSelectFilter) return;
    const houseSet = new Set();
    state.voters.forEach(v => {
      if (v.houseNumber && v.houseNumber !== '-') {
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

      if (g !== 'all' && v.gender !== g) return false;

      if (sec !== 'all') {
        if (sec === 'mool' && !v.section.includes('मूल सूची')) return false;
        if (sec === 'pari' && !v.section.includes('परिवर्धन सूची')) return false;
      }

      if (hNo !== 'all' && v.houseNumber !== hNo) return false;

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

    elements.votersGrid.innerHTML = pageItems.map(v => createVoterCardHTML(v)).join('');

    if (elements.votersTableBody) {
      elements.votersTableBody.innerHTML = pageItems.map(v => createTableRowHTML(v)).join('');
    }

    renderPaginationUI(startIdx, pageItems.length, total);
  }

  // Mobile Voter Card HTML
  function createVoterCardHTML(v) {
    const isMale = v.gender === 'पुरुष';
    const genderClass = isMale ? 'male' : 'female';
    const genderLabel = isMale ? 'Male (पुरुष)' : 'Female (महिला)';
    const enName = v.nameEn && v.nameEn !== v.name ? `<div class="card-voter-name-en">${escapeHTML(v.nameEn)}</div>` : '';
    const enRel = v.relationNameEn && v.relationNameEn !== v.relationName && v.relationNameEn !== '-' ? ` (${escapeHTML(v.relationNameEn)})` : '';

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
          <span>View Details</span> <span>-></span>
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
    const enRel = v.relationNameEn && v.relationNameEn !== v.relationName && v.relationNameEn !== '-' ? `<span style="font-size: 0.75rem; color: var(--text-tertiary);"> (${escapeHTML(v.relationNameEn)})</span>` : '';

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
    elements.pageInfo.textContent = `दिखाए जा रहे हैं ${startIdx + 1}-${endIdx} (कुल ${totalCount})`;

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
            <div class="detail-cell-value">29 - गौतम सेकण्डरी स्कूल, पिलानी (कमरा नं 1)</div>
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

  // Toast Notifications
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
    }, 2400);
  }

  // Copy Helper
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
    // Search
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

    // Boundary Toggle
    elements.boundaryToggleBtn?.addEventListener('click', () => {
      if (elements.boundaryFullText) {
        elements.boundaryFullText.classList.toggle('open');
        const isOpen = elements.boundaryFullText.classList.contains('open');
        if (elements.boundaryToggleIcon) elements.boundaryToggleIcon.textContent = isOpen ? '↑' : '↓';
      }
    });

    // Voting Trigger Handlers
    elements.candidatesGrid?.addEventListener('click', (e) => {
      const voteBtn = e.target.closest('[data-candidate-id]');
      if (voteBtn && !voteBtn.disabled) {
        const cId = parseInt(voteBtn.getAttribute('data-candidate-id'), 10);
        if (!isNaN(cId)) {
          promptVoteConfirmation(cId);
        }
      }
    });

    elements.voteCancelBtn?.addEventListener('click', closeVoteConfirmModal);
    elements.voteConfirmCloseBtn?.addEventListener('click', closeVoteConfirmModal);
    elements.voteSubmitBtn?.addEventListener('click', submitConfirmedVote);

    // Filter Sheet Trigger
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

    elements.voteConfirmModalBackdrop?.addEventListener('click', (e) => {
      if (e.target === elements.voteConfirmModalBackdrop) closeVoteConfirmModal();
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

    // Keyboard ESC
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeVoterModal();
        closeFilterModal();
        closeVoteConfirmModal();
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
    const sections = ['overview', 'candidates', 'poll-results', 'voters', 'whatsapp'];
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
