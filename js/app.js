/**
 * Ward 29 Pilani - Civic Intelligence & Community App
 * Principal-Level Mobile-First Architecture & Design System
 * 
 * Features:
 * - Dynamic Data Fetching (Ward, Voters, Stats, Candidates)
 * - Supabase Realtime Community Poll (with Local Storage fallback)
 * - Prominent Candidate Photo Frames & Vote Confirmation Flow
 * - High-Performance Search & Multi-criteria Filtering
 * - Interactive Age Distribution Visualizations
 * - Fullscreen Pinch/Zoom Ward Map Viewer
 * - Native Mobile Sharing (navigator.share) & WhatsApp Sharing
 * - Unified 5-Destination App Shell Bottom Navigation
 */

(function () {
  'use strict';

  // --- 1. CANDIDATE CONFIGURATION & ASSETS ---
  const CANDIDATES = [
    {
      id: 1,
      name: "Monika Baloda",
      nameHi: "मोनिका बलोदा",
      relation: "W/O Manish Baloda",
      relationHi: "पत्नी मनीष बलोदा",
      initials: "MB",
      color: "#2563eb",
      photo: null
    },
    {
      id: 2,
      name: "Aditi Godara",
      nameHi: "अदिति गोदारा",
      relation: "W/O Amardeep Godara",
      relationHi: "पत्नी अमरदीप गोदारा",
      initials: "AG",
      color: "#ec4899",
      photo: "./assets/candidates/Aditi.jpg"
    },
    {
      id: 3,
      name: "Poonam Sihag",
      nameHi: "पूनम सिहाग",
      relation: "W/O Anil Sihag",
      relationHi: "पत्नी अनिल सिहाग",
      initials: "PS",
      color: "#059669",
      photo: null
    },
    {
      id: 4,
      name: "Suman",
      nameHi: "सुमन",
      relation: "W/O Tilak",
      relationHi: "पत्नी तिलक",
      initials: "SM",
      color: "#d97706",
      photo: null
    },
    {
      id: 5,
      name: "Aruna Madam",
      nameHi: "अरुणा मैडम",
      relation: "W/O Bhupendra Sheoran",
      relationHi: "पत्नी भूपेंद्र स्योराण",
      initials: "AM",
      color: "#8b5cf6",
      photo: null
    }
  ];

  // --- 2. SUPABASE CREDENTIALS (PUBLISHABLE / ANONYMOUS ONLY) ---
  const SUPABASE_URL = 'https://oagkvpuyfxfdohowhuxg.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZ2t2cHV5ZnhmZG9ob3dodXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEyMTcyOTUsImV4cCI6MjA1Njc5MzI5NX0.7G4bA8rL3R1f5NfR6ZzR8aM6qW3l-P2b8b9kZ8vT7w';

  let supabaseClient = null;
  if (typeof supabase !== 'undefined' && supabase.createClient && SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.warn('Supabase initialization fallback to offline storage');
    }
  }

  // --- 3. GLOBAL APPLICATION STATE ---
  const state = {
    ward: null,
    stats: null,
    voters: [],
    filteredVoters: [],
    currentPage: 1,
    pageSize: 30,
    filters: {
      search: '',
      gender: 'all',
      age: 'all',
      section: 'all',
      house: 'all'
    },
    poll: {
      votes: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      totalVotes: 0,
      hasVoted: false,
      userVotedCandidateId: null,
      pendingCandidateId: null
    },
    mapZoom: 1,
    mapPan: { x: 0, y: 0 }
  };

  // --- 4. INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    initPollState();
    await loadInitialData();
    setupBottomNavigation();
    setupCandidateVoting();
    setupVoterSearchAndFilters();
    setupInteractiveMap();
    setupShareFeatures();
    renderDashboardVisuals();
    renderCandidatesList();
    renderVoters();
  });

  // --- 5. DATA FETCHING ---
  async function loadInitialData() {
    try {
      const [wardRes, statsRes, votersRes] = await Promise.all([
        fetch('./data/ward.json'),
        fetch('./data/stats.json'),
        fetch('./data/voters.json')
      ]);

      state.ward = await wardRes.json();
      state.stats = await statsRes.json();
      state.voters = await votersRes.json();
      state.filteredVoters = [...state.voters];

      populateHouseFilterOptions();
    } catch (err) {
      console.error('Error loading initial JSON datasets:', err);
      showToast('डेटा लोड करने में त्रुटि हुई। कृपया रिफ्रेश करें।');
    }
  }

  // --- 6. SESSION & POLL MANAGEMENT ---
  function getOrCreateSessionId() {
    let sid = localStorage.getItem('ward29_poll_session_id');
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
      localStorage.setItem('ward29_poll_session_id', sid);
    }
    return sid;
  }

  function initPollState() {
    const votedId = localStorage.getItem('ward29_voted_candidate_id');
    if (votedId) {
      state.poll.hasVoted = true;
      state.poll.userVotedCandidateId = parseInt(votedId, 10);
    }

    const savedVotes = localStorage.getItem('ward29_community_votes');
    if (savedVotes) {
      try {
        state.poll.votes = JSON.parse(savedVotes);
      } catch (e) {
        state.poll.votes = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      }
    }
    calculatePollTotals();

    // Fetch from Supabase if connected
    if (supabaseClient) {
      fetchSupabaseVotes();
      subscribeSupabaseRealtime();
    }
  }

  async function fetchSupabaseVotes() {
    try {
      const { data, error } = await supabaseClient
        .from('candidate_votes')
        .select('candidate_id, count');

      if (!error && data && data.length > 0) {
        data.forEach(row => {
          if (state.poll.votes.hasOwnProperty(row.candidate_id)) {
            state.poll.votes[row.candidate_id] = row.count || 0;
          }
        });
        calculatePollTotals();
        renderCandidatesList();
        renderPollResults();
      }
    } catch (err) {
      console.warn('Supabase fetch notice:', err.message);
    }
  }

  function subscribeSupabaseRealtime() {
    try {
      supabaseClient
        .channel('public:candidate_votes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidate_votes' }, payload => {
          if (payload.new && payload.new.candidate_id) {
            state.poll.votes[payload.new.candidate_id] = payload.new.count;
            calculatePollTotals();
            renderCandidatesList();
            renderPollResults();
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  }

  function calculatePollTotals() {
    let total = 0;
    for (const c of CANDIDATES) {
      total += (state.poll.votes[c.id] || 0);
    }
    state.poll.totalVotes = total;
  }

  // --- 7. DASHBOARD VISUALS RENDERING ---
  function getCanonicalDemographics() {
    const published = {
      total: Number(state.stats && state.stats.totalVoters) || 901,
      male: Number(state.stats && state.stats.maleVoters) || 463,
      female: Number(state.stats && state.stats.femaleVoters) || 438
    };

    if (!state.voters.length) return published;

    let male = 0;
    let female = 0;
    state.voters.forEach((v) => {
      if (v.gender === 'पुरुष') male += 1;
      else if (v.gender === 'महिला') female += 1;
    });

    const rosterTotal = male + female;
    if (rosterTotal === state.voters.length && rosterTotal === published.total) {
      return { total: rosterTotal, male, female };
    }
    return published;
  }

  function renderDashboardVisuals() {
    const demo = getCanonicalDemographics();
    const stats = state.stats || {};
    const malePct = demo.total ? ((demo.male / demo.total) * 100).toFixed(1) : '0.0';
    const femalePct = demo.total ? ((demo.female / demo.total) * 100).toFixed(1) : '0.0';

    animateValue(document.getElementById('heroGiantTotal'), 0, demo.total, 900);
    animateValue(document.getElementById('glanceTotal'), 0, demo.total, 800);
    animateValue(document.getElementById('glanceMale'), 0, demo.male, 800);
    animateValue(document.getElementById('glanceFemale'), 0, demo.female, 800);
    animateValue(document.getElementById('donutTotalCount'), 0, demo.total, 800);
    animateValue(document.getElementById('legendMaleCount'), 0, demo.male, 800);
    animateValue(document.getElementById('legendFemaleCount'), 0, demo.female, 800);

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    setText('glanceMalePct', malePct + '%');
    setText('glanceFemalePct', femalePct + '%');
    setText('legendMalePct', malePct + '%');
    setText('legendFemalePct', femalePct + '%');
    setText('dashAvgAge', stats.averageAge != null ? String(stats.averageAge) : '44.9');
    setText('dashAvgAgeInsight', stats.averageAge != null ? String(stats.averageAge) : '44.9');
    setText('dashMedianAge', stats.medianAge != null ? String(stats.medianAge) : '41');
    setText('dashHouseCount', stats.uniqueHouses != null ? String(stats.uniqueHouses) : '257');
    setText('dashSeniorCount', stats.seniorCitizens != null ? String(stats.seniorCitizens) : '214');
    setText('dashSeniorPct', (stats.seniorPercentage != null ? stats.seniorPercentage : 23.8) + '% of voters');

    const donutTitle = document.getElementById('donutSummary');
    if (donutTitle) {
      donutTitle.textContent = demo.male + ' male and ' + demo.female + ' female registered voters';
    }

    renderHomeDonut(demo);
    renderHomeAgeBars(stats);
    bindDashboardAgeControls();
    renderHomePollPreview();
  }

  function renderHomeDonut(demo) {
    const maleEl = document.getElementById('donutMale');
    const femaleEl = document.getElementById('donutFemale');
    if (!maleEl || !femaleEl || !demo.total) return;

    const circumference = 2 * Math.PI * 38;
    const maleLen = (demo.male / demo.total) * circumference;
    const femaleLen = (demo.female / demo.total) * circumference;
    maleEl.style.strokeDasharray = maleLen + ' ' + circumference;
    maleEl.style.strokeDashoffset = '0';
    femaleEl.style.strokeDasharray = femaleLen + ' ' + circumference;
    femaleEl.style.strokeDashoffset = String(-maleLen);
  }

  function renderHomeAgeBars(stats) {
    const list = document.getElementById('ageBarsList');
    if (!list) return;

    const groups = (stats && stats.ageGroups) || {
      '18-25': { count: 100, percentage: 11.1 },
      '26-35': { count: 248, percentage: 27.5 },
      '36-45': { count: 141, percentage: 15.6 },
      '46-60': { count: 206, percentage: 22.9 },
      '61+': { count: 206, percentage: 22.9 }
    };

    const colors = {
      '18-25': '#38bdf8',
      '26-35': '#2563eb',
      '36-45': '#8b5cf6',
      '46-60': '#f59e0b',
      '61+': '#ec4899'
    };

    const labels = {
      '18-25': '18-25 years',
      '26-35': '26-35 years',
      '36-45': '36-45 years',
      '46-60': '46-60 years',
      '61+': '61+ years'
    };

    const maxCount = Math.max.apply(null, Object.keys(groups).map((key) => groups[key].count || 0)) || 1;
    const keys = ['18-25', '26-35', '36-45', '46-60', '61+'];

    list.innerHTML = keys.map((key) => {
      const item = groups[key] || { count: 0, percentage: 0 };
      const width = ((item.count / maxCount) * 100).toFixed(1);
      const largest = item.count === maxCount ? '<span class="largest-group-tag">Largest</span>' : '';
      return (
        '<button type="button" class="age-bar-row" data-age-filter="' + key + '">' +
          '<div class="age-bar-top">' +
            '<span class="age-bracket-name">' + labels[key] + ' ' + largest + '</span>' +
            '<div class="age-count-info"><span>' + item.count + '</span> <span class="age-pct-text">(' + item.percentage + '%)</span></div>' +
          '</div>' +
          '<div class="age-progress-track"><div class="age-progress-fill" style="width:' + width + '%;background:' + colors[key] + ';"></div></div>' +
        '</button>'
      );
    }).join('');
  }

  function bindDashboardAgeControls() {
    document.querySelectorAll('.age-bar-row').forEach((bar) => {
      bar.addEventListener('click', () => {
        const ageVal = bar.getAttribute('data-age-filter');
        selectAgeFilter(ageVal);
      });
    });

    document.querySelectorAll('.dash-chip').forEach((chip) => {
      if (chip.dataset.dashBound === '1') return;
      chip.dataset.dashBound = '1';
      chip.addEventListener('click', () => {
        selectAgeFilter(chip.getAttribute('data-age-chip'));
      });
    });
  }

  function renderHomePollPreview() {
    const leaderEl = document.getElementById('dashPollLeader');
    if (!leaderEl) return;

    const sorted = CANDIDATES.slice().sort((a, b) => (state.poll.votes[b.id] || 0) - (state.poll.votes[a.id] || 0));
    const leader = sorted[0];
    const votes = leader ? (state.poll.votes[leader.id] || 0) : 0;
    const pct = state.poll.totalVotes > 0 ? ((votes / state.poll.totalVotes) * 100).toFixed(1) : '0.0';

    leaderEl.textContent = votes > 0 ? leader.name : 'Waiting for votes';
    const votesEl = document.getElementById('dashPollVotes');
    const pctEl = document.getElementById('dashPollPct');
    const totalEl = document.getElementById('dashPollTotal');
    if (votesEl) votesEl.textContent = String(votes);
    if (pctEl) pctEl.textContent = pct + '%';
    if (totalEl) totalEl.textContent = String(state.poll.totalVotes || 0);
  }

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

  // --- 8. CANDIDATES & COMMUNITY POLL ---
  function setupCandidateVoting() {
    const confirmModal = document.getElementById('voteConfirmModalBackdrop');
    const closeBtn = document.getElementById('voteConfirmCloseBtn');
    const cancelBtn = document.getElementById('voteCancelBtn');
    const submitBtn = document.getElementById('voteSubmitBtn');

    if (closeBtn) closeBtn.addEventListener('click', () => closeConfirmModal());
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeConfirmModal());
    if (confirmModal) {
      confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) closeConfirmModal();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        if (!state.poll.pendingCandidateId) return;
        await submitUserVote(state.poll.pendingCandidateId);
        closeConfirmModal();
      });
    }
  }

  function openVoteConfirmation(candidateId) {
    if (state.poll.hasVoted) {
      showToast('आप पहले ही अपना मत दर्ज कर चुके हैं। (One vote per user)');
      return;
    }

    const candidate = CANDIDATES.find(c => c.id === candidateId);
    if (!candidate) return;

    state.poll.pendingCandidateId = candidateId;
    document.getElementById('confirmCandidateName').textContent = `${candidate.name} (${candidate.nameHi})`;
    document.getElementById('confirmCandidateRel').textContent = `${candidate.relation} • ${candidate.relationHi}`;

    const modal = document.getElementById('voteConfirmModalBackdrop');
    if (modal) modal.classList.add('open');
  }

  function closeConfirmModal() {
    state.poll.pendingCandidateId = null;
    const modal = document.getElementById('voteConfirmModalBackdrop');
    if (modal) modal.classList.remove('open');
  }

  async function submitUserVote(candidateId) {
    state.poll.hasVoted = true;
    state.poll.userVotedCandidateId = candidateId;
    state.poll.votes[candidateId] = (state.poll.votes[candidateId] || 0) + 1;
    calculatePollTotals();

    localStorage.setItem('ward29_voted_candidate_id', candidateId.toString());
    localStorage.setItem('ward29_community_votes', JSON.stringify(state.poll.votes));

    const sessionId = getOrCreateSessionId();

    if (supabaseClient) {
      try {
        await supabaseClient.rpc('record_candidate_vote', {
          p_candidate_id: candidateId,
          p_session_id: sessionId
        });
      } catch (err) {
        console.warn('Supabase vote recording notice:', err);
      }
    }

    renderCandidatesList();
    renderPollResults();
    showToast('✓ आपका मत सफलतापूर्वक दर्ज कर लिया गया है!');
  }

  function renderCandidatesList() {
    const grid = document.getElementById('candidatesGrid');
    if (!grid) return;

    // Find current leader
    let maxVotes = -1;
    let leaderId = null;
    for (const c of CANDIDATES) {
      const v = state.poll.votes[c.id] || 0;
      if (v > maxVotes && v > 0) {
        maxVotes = v;
        leaderId = c.id;
      }
    }

    grid.innerHTML = CANDIDATES.map(c => {
      const votes = state.poll.votes[c.id] || 0;
      const pct = state.poll.totalVotes > 0 ? ((votes / state.poll.totalVotes) * 100).toFixed(2) : '0.00';
      const isLeader = leaderId === c.id;
      const isUserVoted = state.poll.userVotedCandidateId === c.id;

      // Photo Frame vs Initials Frame
      let mediaMarkup = '';
      if (c.photo) {
        mediaMarkup = `
          <div class="candidate-photo-frame">
            <img src="${c.photo}" alt="${c.name}" class="candidate-photo-img" loading="lazy">
          </div>
        `;
      } else {
        mediaMarkup = `
          <div class="candidate-avatar-placeholder" style="background: ${c.color};">
            ${c.initials}
          </div>
        `;
      }

      return `
        <div class="candidate-card-item ${isLeader ? 'is-leader' : ''}">
          <div class="candidate-top-bar">
            <span class="candidate-num-badge">Candidate #${c.id}</span>
            ${isLeader ? `<span class="leader-badge-pill">★ Current Leader</span>` : ''}
          </div>

          <div class="candidate-media-wrap">
            ${mediaMarkup}
            <div>
              <div class="candidate-name-title">${c.name}</div>
              <div style="font-size: 0.8125rem; font-weight: 700; color: var(--navy-900); font-family: var(--font-hindi);">${c.nameHi}</div>
              <div class="candidate-rel-text">${c.relation}</div>
              <div style="font-size: 0.6875rem; color: var(--text-tertiary); font-family: var(--font-hindi);">${c.relationHi}</div>
            </div>
          </div>

          <div class="candidate-stats-box">
            <div>
              <span class="candidate-vote-count">${votes}</span>
              <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;"> Votes</span>
            </div>
            <div class="candidate-vote-pct">${pct}%</div>
          </div>

          <div class="candidate-progress-bar-wrap">
            <div class="candidate-progress-bar-inner" style="width: ${pct}%; background: ${c.color};"></div>
          </div>

          <div style="margin-top: 0.875rem;">
            ${
              state.poll.hasVoted
                ? `<button type="button" class="btn-vote-candidate ${isUserVoted ? 'voted-this' : ''}" disabled>
                    ${isUserVoted ? '✓ You Voted for ' + c.name : 'Vote Submitted'}
                   </button>`
                : `<button type="button" class="btn-vote-candidate" onclick="window.openCandidateVote(${c.id})">
                    <svg class="icon-svg" style="width: 14px; height: 14px;" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
                    <span>Vote for ${c.name}</span>
                   </button>`
            }
          </div>
        </div>
      `;
    }).join('');

    renderPollResults();
  }

  window.openCandidateVote = function (candidateId) {
    openVoteConfirmation(candidateId);
  };

  function renderPollResults() {
    const totalElem = document.getElementById('totalPollVotesCount');
    const centerTotal = document.getElementById('pollDonutCenterTotal');
    const leaderboard = document.getElementById('pollLeaderboardList');
    const donutSegments = document.getElementById('pollDonutSegments');

    if (totalElem) totalElem.textContent = state.poll.totalVotes;
    if (centerTotal) centerTotal.textContent = state.poll.totalVotes;
    renderHomePollPreview();

    if (!leaderboard) return;

    const sorted = [...CANDIDATES].sort((a, b) => (state.poll.votes[b.id] || 0) - (state.poll.votes[a.id] || 0));

    leaderboard.innerHTML = sorted.map((c, idx) => {
      const votes = state.poll.votes[c.id] || 0;
      const pct = state.poll.totalVotes > 0 ? ((votes / state.poll.totalVotes) * 100).toFixed(2) : '0.00';
      return `
        <div class="leaderboard-item">
          <div class="leaderboard-item-top">
            <div class="leaderboard-candidate-name">
              <span style="color: var(--text-tertiary); font-weight: 800; margin-right: 0.35rem;">#${idx + 1}</span>
              <span>${c.name}</span>
            </div>
            <div class="leaderboard-votes-info">
              <span>${votes}</span> <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 600;">(${pct}%)</span>
            </div>
          </div>
          <div class="candidate-progress-bar-wrap" style="height: 5px; margin-top: 0.2rem;">
            <div class="candidate-progress-bar-inner" style="width: ${pct}%; background: ${c.color};"></div>
          </div>
        </div>
      `;
    }).join('');

    // Dynamic Donut SVG Segments
    if (donutSegments) {
      let cumulativeOffset = 0;
      const circumference = 238.76;
      donutSegments.innerHTML = sorted.map(c => {
        const votes = state.poll.votes[c.id] || 0;
        if (votes === 0 || state.poll.totalVotes === 0) return '';
        const dashLength = (votes / state.poll.totalVotes) * circumference;
        const segmentSvg = `
          <circle cx="50" cy="50" r="38" fill="none" stroke="${c.color}" stroke-width="18"
            stroke-dasharray="${dashLength} ${circumference}"
            stroke-dashoffset="-${cumulativeOffset}"
            stroke-linecap="round" />
        `;
        cumulativeOffset += dashLength;
        return segmentSvg;
      }).join('');
    }
  }

  // --- 9. VOTER SEARCH & FILTER ENGINE ---
  function setupVoterSearchAndFilters() {
    const searchInput = document.getElementById('voterSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    const filterToggle = document.getElementById('filterToggleBtn');
    const filterModal = document.getElementById('filterModalBackdrop');
    const filterClose = document.getElementById('filterModalCloseBtn');
    const filterReset = document.getElementById('filterResetBtn');
    const filterApply = document.getElementById('filterApplyBtn');
    const emptyReset = document.getElementById('emptyResetBtn');

    // Live search input
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.filters.search = e.target.value.trim();
        if (clearBtn) {
          if (state.filters.search) clearBtn.classList.add('visible');
          else clearBtn.classList.remove('visible');
        }
        applyFilters();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        state.filters.search = '';
        clearBtn.classList.remove('visible');
        applyFilters();
        searchInput.focus();
      });
    }

    // Filter modal toggle
    if (filterToggle && filterModal) {
      filterToggle.addEventListener('click', () => filterModal.classList.add('open'));
    }
    if (filterClose && filterModal) {
      filterClose.addEventListener('click', () => filterModal.classList.remove('open'));
    }
    if (filterModal) {
      filterModal.addEventListener('click', (e) => {
        if (e.target === filterModal) filterModal.classList.remove('open');
      });
    }

    if (filterApply && filterModal) {
      filterApply.addEventListener('click', () => {
        const genderRadio = document.querySelector('input[name="filterGender"]:checked');
        const ageRadio = document.querySelector('input[name="filterAge"]:checked');
        const secRadio = document.querySelector('input[name="filterSection"]:checked');
        const houseSelect = document.getElementById('houseSelectFilter');

        if (genderRadio) state.filters.gender = genderRadio.value;
        if (ageRadio) state.filters.age = ageRadio.value;
        if (secRadio) state.filters.section = secRadio.value;
        if (houseSelect) state.filters.house = houseSelect.value;

        syncAgeChipsState(state.filters.age);
        applyFilters();
        filterModal.classList.remove('open');
      });
    }

    if (filterReset) {
      filterReset.addEventListener('click', () => resetAllFilters());
    }
    if (emptyReset) {
      emptyReset.addEventListener('click', () => resetAllFilters());
    }

    // Quick Age Chips Click
    const ageChips = document.querySelectorAll('.age-filter-chip');
    ageChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const ageVal = chip.getAttribute('data-age-chip');
        selectAgeFilter(ageVal);
      });
    });

    // Pagination buttons
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    if (prevBtn) prevBtn.addEventListener('click', () => changePage(state.currentPage - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => changePage(state.currentPage + 1));
  }

  function selectAgeFilter(ageVal) {
    state.filters.age = ageVal;
    syncAgeChipsState(ageVal);

    // Sync radio in filter modal
    const radio = document.querySelector(`input[name="filterAge"][value="${ageVal}"]`);
    if (radio) radio.checked = true;

    // Scroll to voters directory
    const votersSection = document.getElementById('voters');
    if (votersSection) {
      votersSection.scrollIntoView({ behavior: 'smooth' });
    }

    applyFilters();
  }

  function syncAgeChipsState(activeAge) {
    document.querySelectorAll('.age-filter-chip, .dash-chip').forEach((chip) => {
      const chipVal = chip.getAttribute('data-age-chip');
      const on = chipVal === activeAge;
      chip.classList.toggle('active', on);
      chip.classList.toggle('is-on', on);
    });

    document.querySelectorAll('.age-bar-row').forEach((bar) => {
      const barVal = bar.getAttribute('data-age-filter');
      bar.classList.toggle('active', barVal === activeAge);
    });
  }

  function resetAllFilters() {
    state.filters = {
      search: '',
      gender: 'all',
      age: 'all',
      section: 'all',
      house: 'all'
    };

    const searchInput = document.getElementById('voterSearchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.remove('visible');

    const defaultGender = document.querySelector('input[name="filterGender"][value="all"]');
    const defaultAge = document.querySelector('input[name="filterAge"][value="all"]');
    const defaultSec = document.querySelector('input[name="filterSection"][value="all"]');
    const houseSelect = document.getElementById('houseSelectFilter');

    if (defaultGender) defaultGender.checked = true;
    if (defaultAge) defaultAge.checked = true;
    if (defaultSec) defaultSec.checked = true;
    if (houseSelect) houseSelect.value = 'all';

    syncAgeChipsState('all');
    applyFilters();
  }

  function populateHouseFilterOptions() {
    const select = document.getElementById('houseSelectFilter');
    if (!select || !state.voters.length) return;

    const houseCounts = {};
    state.voters.forEach(v => {
      const h = (v.houseNumber || '').toString().trim();
      if (h) houseCounts[h] = (houseCounts[h] || 0) + 1;
    });

    const sortedHouses = Object.keys(houseCounts).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    select.innerHTML = '<option value="all">All Houses (सभी मकान)</option>' +
      sortedHouses.map(h => `<option value="${h}">मकान सं. ${h} (${houseCounts[h]} मतदाता)</option>`).join('');
  }

  function applyFilters() {
    const q = state.filters.search.toLowerCase();
    const g = state.filters.gender;
    const a = state.filters.age;
    const s = state.filters.section;
    const h = state.filters.house;

    state.filteredVoters = state.voters.filter(v => {
      // 1. Text Search
      if (q) {
        const matchName = (v.name || '').toLowerCase().includes(q);
        const matchNameEn = (v.nameEn || '').toLowerCase().includes(q);
        const matchEpic = (v.voterId || '').toLowerCase().includes(q);
        const matchRel = (v.relationName || '').toLowerCase().includes(q);
        const matchRelEn = (v.relationNameEn || '').toLowerCase().includes(q);
        const matchHouse = (v.houseNumber || '').toString().toLowerCase().includes(q);
        const matchSr = v.serialNumber.toString() === q;
        if (!matchName && !matchNameEn && !matchEpic && !matchRel && !matchRelEn && !matchHouse && !matchSr) {
          return false;
        }
      }

      // 2. Gender
      if (g !== 'all' && v.gender !== g) return false;

      // 3. Age Brackets
      if (a !== 'all') {
        const age = v.age;
        if (a === '18-25' && (age < 18 || age > 25)) return false;
        if (a === '26-35' && (age < 26 || age > 35)) return false;
        if (a === '36-45' && (age < 36 || age > 45)) return false;
        if (a === '46-60' && (age < 46 || age > 60)) return false;
        if (a === '61+' && age < 61) return false;
      }

      // 4. Section
      if (s === 'mool' && v.serialNumber > 863) return false;
      if (s === 'pari' && v.serialNumber <= 863) return false;

      // 5. House
      if (h !== 'all' && (v.houseNumber || '').toString().trim() !== h) return false;

      return true;
    });

    state.currentPage = 1;
    updateFilterBadgeCount();
    renderVoters();
  }

  function updateFilterBadgeCount() {
    let count = 0;
    if (state.filters.gender !== 'all') count++;
    if (state.filters.age !== 'all') count++;
    if (state.filters.section !== 'all') count++;
    if (state.filters.house !== 'all') count++;

    const badge = document.getElementById('filterBadgeCount');
    const filterBtn = document.getElementById('filterToggleBtn');
    if (badge && filterBtn) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
        filterBtn.classList.add('active');
      } else {
        badge.style.display = 'none';
        filterBtn.classList.remove('active');
      }
    }
  }

  // --- 10. VOTER DIRECTORY RENDERING ---
  function renderVoters() {
    const votersGrid = document.getElementById('votersGrid');
    const tableBody = document.getElementById('votersTableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationWrapper = document.getElementById('paginationWrapper');
    const resultsCount = document.getElementById('resultsCount');

    const total = state.filteredVoters.length;
    if (resultsCount) resultsCount.textContent = `${total.toLocaleString('en-IN')} मतदाता`;

    if (total === 0) {
      if (votersGrid) votersGrid.innerHTML = '';
      if (tableBody) tableBody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      if (paginationWrapper) paginationWrapper.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (paginationWrapper) paginationWrapper.style.display = 'flex';

    const start = (state.currentPage - 1) * state.pageSize;
    const end = Math.min(start + state.pageSize, total);
    const pageItems = state.filteredVoters.slice(start, end);

    // Render Mobile Cards
    if (votersGrid) {
      votersGrid.innerHTML = pageItems.map(v => {
        const isMale = v.gender === 'पुरुष';
        return `
          <div class="voter-card-item">
            <div class="card-row-top">
              <span class="card-sr-pill">#${v.serialNumber}</span>
              <span class="gender-badge-pill ${isMale ? 'male' : 'female'}">
                ${v.gender}
              </span>
            </div>

            <div class="card-voter-name-heading">${v.name}</div>
            <div class="card-voter-name-en">${v.nameEn || ''}</div>

            <div class="card-epic-row">
              <span class="card-epic-val">${v.voterId}</span>
              <button type="button" class="btn-card-copy-epic" onclick="window.copyVoterId('${v.voterId}')" title="Copy Voter ID">
                <svg class="icon-svg" style="width: 12px; height: 12px;" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <span>Copy</span>
              </button>
            </div>

            <div class="card-rel-row">
              ${v.relationType || 'पिता'}: <strong>${v.relationName}</strong>
            </div>

            <div class="card-meta-chips-row">
              <span class="meta-chip-item">आयु: ${v.age} वर्ष</span>
              <span class="meta-chip-item">मकान: ${v.houseNumber}</span>
              <span class="meta-chip-item photo-ok">✓ फोटो उपलब्ध</span>
            </div>

            <button type="button" class="btn-card-view-details" onclick="window.openVoterModal(${v.serialNumber})">
              <span>View Details -></span>
            </button>
          </div>
        `;
      }).join('');
    }

    // Render Desktop Table Rows
    if (tableBody) {
      tableBody.innerHTML = pageItems.map(v => {
        const isMale = v.gender === 'पुरुष';
        return `
          <tr onclick="window.openVoterModal(${v.serialNumber})">
            <td style="font-weight: 700; color: var(--text-tertiary);">#${v.serialNumber}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.35rem;">
                <span style="font-weight: 800; color: var(--blue-700);">${v.voterId}</span>
                <button type="button" class="btn-card-copy-epic" onclick="event.stopPropagation(); window.copyVoterId('${v.voterId}')" title="Copy EPIC">
                  <svg class="icon-svg" style="width: 11px; height: 11px;" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
              </div>
            </td>
            <td>
              <div class="tbl-name-hi">${v.name}</div>
              <div class="tbl-name-en">${v.nameEn || ''}</div>
            </td>
            <td>
              <div style="font-family: var(--font-hindi);">${v.relationType || 'पिता'}: <strong>${v.relationName}</strong></div>
            </td>
            <td style="font-weight: 700;">${v.houseNumber}</td>
            <td style="font-weight: 800;">${v.age} वर्ष</td>
            <td>
              <span class="gender-badge-pill ${isMale ? 'male' : 'female'}">${v.gender}</span>
            </td>
            <td>
              <span class="meta-chip-item photo-ok" style="font-size: 0.6875rem;">✓ उपलब्ध</span>
            </td>
          </tr>
        `;
      }).join('');
    }

    renderPaginationControls(start + 1, end, total);
  }

  function renderPaginationControls(startNum, endNum, totalCount) {
    const pageInfo = document.getElementById('pageInfo');
    const numbersContainer = document.getElementById('pageNumbersContainer');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    const totalPages = Math.ceil(totalCount / state.pageSize);

    if (pageInfo) {
      pageInfo.textContent = `दिखाए जा रहे हैं ${startNum}–${endNum} (कुल ${totalCount})`;
    }

    if (prevBtn) prevBtn.disabled = state.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = state.currentPage >= totalPages;

    if (numbersContainer) {
      let pages = [];
      if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        if (state.currentPage <= 3) pages = [1, 2, 3, 4, '...', totalPages];
        else if (state.currentPage >= totalPages - 2) pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        else pages = [1, '...', state.currentPage - 1, state.currentPage, state.currentPage + 1, '...', totalPages];
      }

      numbersContainer.innerHTML = pages.map(p => {
        if (p === '...') return `<span style="padding: 0.35rem; color: var(--text-tertiary); font-size: 0.75rem;">…</span>`;
        const isActive = p === state.currentPage;
        return `
          <button type="button" class="btn-page-nav" style="min-width: 32px; height: 32px; font-weight: ${isActive ? '800' : '600'}; background: ${isActive ? 'var(--blue-700)' : 'var(--bg-surface)'}; color: ${isActive ? 'white' : 'var(--text-primary)'}; border: 1px solid ${isActive ? 'var(--blue-700)' : 'var(--border-color)'}; border-radius: var(--radius-sm); font-size: 0.75rem;" onclick="window.changeVoterPage(${p})">
            ${p}
          </button>
        `;
      }).join('');
    }
  }

  window.changeVoterPage = function (newPage) {
    changePage(newPage);
  };

  function changePage(newPage) {
    const totalPages = Math.ceil(state.filteredVoters.length / state.pageSize);
    if (newPage < 1 || newPage > totalPages) return;
    state.currentPage = newPage;
    renderVoters();

    const votersSection = document.getElementById('voters');
    if (votersSection) {
      votersSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // --- 11. VOTER MODAL DETAILS ---
  window.openVoterModal = function (serialNumber) {
    const voter = state.voters.find(v => v.serialNumber === serialNumber);
    if (!voter) return;

    const modalBackdrop = document.getElementById('voterModalBackdrop');
    const content = document.getElementById('voterModalContent');
    if (!modalBackdrop || !content) return;

    const isMale = voter.gender === 'पुरुष';

    content.innerHTML = `
      <div class="sheet-header-bar">
        <div>
          <span style="font-size: 0.6875rem; font-weight: 700; color: var(--text-tertiary);">क्र.सं. #${voter.serialNumber}</span>
          <h3 class="sheet-header-title" style="margin-top: 0.1rem;">${voter.name}</h3>
        </div>
        <button type="button" class="btn-sheet-close" onclick="window.closeVoterModal()">✕</button>
      </div>

      <div class="sheet-scroll-body">
        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 0.875rem;">
          <div>
            <div style="font-size: 0.625rem; font-weight: 700; text-transform: uppercase; color: var(--text-tertiary);">Voter ID (EPIC)</div>
            <div style="font-size: 1.125rem; font-weight: 900; color: var(--blue-700); letter-spacing: 0.02em;">${voter.voterId}</div>
          </div>
          <button type="button" class="btn-hero-share-action" style="background: var(--blue-700); color: white;" onclick="window.copyVoterId('${voter.voterId}')">
            <span>Copy EPIC</span>
          </button>
        </div>

        <div class="detail-meta-grid">
          <div class="detail-box-cell">
            <div class="detail-cell-label">लिंग (Gender)</div>
            <div class="detail-cell-value">
              <span class="gender-badge-pill ${isMale ? 'male' : 'female'}">${voter.gender}</span>
            </div>
          </div>

          <div class="detail-box-cell">
            <div class="detail-cell-label">आयु (Age)</div>
            <div class="detail-cell-value">${voter.age} वर्ष</div>
          </div>

          <div class="detail-box-cell full-width">
            <div class="detail-cell-label">${voter.relationType || 'पिता'} का नाम (Relative)</div>
            <div class="detail-cell-value">${voter.relationName} ${voter.relationNameEn ? `(${voter.relationNameEn})` : ''}</div>
          </div>

          <div class="detail-box-cell">
            <div class="detail-cell-label">मकान संख्या (House No)</div>
            <div class="detail-cell-value">${voter.houseNumber}</div>
          </div>

          <div class="detail-box-cell">
            <div class="detail-cell-label">फोटो स्थिति</div>
            <div class="detail-cell-value" style="color: var(--success);">✓ उपलब्ध</div>
          </div>

          <div class="detail-box-cell full-width">
            <div class="detail-cell-label">मतदान केंद्र</div>
            <div class="detail-cell-value">29 - गौतम सेकण्डरी स्कूल, पिलानी (कमरा नं 1)</div>
          </div>

          <div class="detail-box-cell full-width">
            <div class="detail-cell-label">नामावली सूची भाग</div>
            <div class="detail-cell-value">${voter.section || 'मूल सूची (Main List)'} • PDF पृष्ठ ${voter.pageNumber || '8'}</div>
          </div>
        </div>
      </div>

      <div class="sheet-footer-actions">
        <button type="button" class="btn-page-nav" style="height: 38px; padding: 0 1.25rem;" onclick="window.closeVoterModal()">Close</button>
      </div>
    `;

    modalBackdrop.classList.add('open');
  };

  window.closeVoterModal = function () {
    const modalBackdrop = document.getElementById('voterModalBackdrop');
    if (modalBackdrop) modalBackdrop.classList.remove('open');
  };

  // --- 12. FULLSCREEN MAP VIEWER ---
  function setupInteractiveMap() {
    const mapTrigger = document.getElementById('mapTriggerBtn');
    const openMapAction = document.getElementById('btnOpenMapAction');
    const modal = document.getElementById('mapModalBackdrop');
    const closeBtn = document.getElementById('mapModalCloseBtn');
    const zoomIn = document.getElementById('zoomInBtn');
    const zoomOut = document.getElementById('zoomOutBtn');
    const zoomReset = document.getElementById('zoomResetBtn');
    const img = document.getElementById('mapModalImg');

    const boundaryToggle = document.getElementById('boundaryToggleBtn');
    const boundaryText = document.getElementById('boundaryFullText');
    const boundaryIcon = document.getElementById('boundaryToggleIcon');

    if (boundaryToggle && boundaryText) {
      boundaryToggle.addEventListener('click', () => {
        const isOpen = boundaryText.classList.toggle('open');
        if (boundaryIcon) boundaryIcon.textContent = isOpen ? '↑' : '↓';
      });
    }

    function openMapModal() {
      state.mapZoom = 1;
      state.mapPan = { x: 0, y: 0 };
      updateMapTransform();
      if (modal) modal.classList.add('open');
    }

    function closeMapModal() {
      if (modal) modal.classList.remove('open');
    }

    function updateMapTransform() {
      if (img) {
        img.style.transform = `translate(${state.mapPan.x}px, ${state.mapPan.y}px) scale(${state.mapZoom})`;
      }
    }

    document.querySelectorAll('.js-open-map').forEach((el) => {
      el.addEventListener('click', openMapModal);
    });
    if (closeBtn) closeBtn.addEventListener('click', closeMapModal);

    const viewport = document.getElementById('mapModalViewport');
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let pinchStart = 0;
    let zoomStart = 1;

    if (viewport) {
      viewport.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        viewport.setPointerCapture(e.pointerId);
      });
      viewport.addEventListener('pointermove', (e) => {
        if (!dragging || (e.pointerType !== 'mouse' && e.pointerType !== 'pen' && e.pointerType !== 'touch')) return;
        if (e.isPrimary === false) return;
        state.mapPan.x += e.clientX - lastX;
        state.mapPan.y += e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        updateMapTransform();
      });
      viewport.addEventListener('pointerup', () => { dragging = false; });
      viewport.addEventListener('pointercancel', () => { dragging = false; });
      viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const next = e.deltaY < 0 ? 0.12 : -0.12;
        state.mapZoom = Math.min(4, Math.max(0.75, state.mapZoom + next));
        updateMapTransform();
      }, { passive: false });
      viewport.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
          dragging = false;
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchStart = Math.hypot(dx, dy);
          zoomStart = state.mapZoom;
        }
      }, { passive: true });
      viewport.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && pinchStart) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          state.mapZoom = Math.min(4, Math.max(0.75, zoomStart * (dist / pinchStart)));
          updateMapTransform();
        }
      }, { passive: false });
    }

    if (zoomIn) {
      zoomIn.addEventListener('click', () => {
        state.mapZoom = Math.min(state.mapZoom + 0.35, 4.0);
        updateMapTransform();
      });
    }
    if (zoomOut) {
      zoomOut.addEventListener('click', () => {
        state.mapZoom = Math.max(state.mapZoom - 0.35, 0.75);
        updateMapTransform();
      });
    }
    if (zoomReset) {
      zoomReset.addEventListener('click', () => {
        state.mapZoom = 1;
        state.mapPan = { x: 0, y: 0 };
        updateMapTransform();
      });
    }
  }

  // --- 13. SHARING UTILITIES ---
  function setupShareFeatures() {
    const heroShareBtn = document.getElementById('heroShareBtn');
    const bottomShareBtn = document.getElementById('bottomShareBtn');
    const dashShareBtn = document.getElementById('dashShareBtn');
    const shareModal = document.getElementById('shareModalBackdrop');
    const shareClose = document.getElementById('shareModalCloseBtn');
    const shareCloseAction = document.getElementById('shareCloseBtn');
    const copyLinkBtn = document.getElementById('shareCopyLinkBtn');
    const shareUrlDisplay = document.getElementById('shareUrlDisplay');
    const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');

    const appUrl = window.location.href.split('#')[0];
    if (shareUrlDisplay) shareUrlDisplay.textContent = appUrl;

    const shareTitle = 'Ward 29 - Pilani | Electoral Intelligence & Community App';
    const shareText = 'Ward 29 Pilani official electoral information, voter directory, live candidate community poll, and ward map.\nExplore here: ' + appUrl;

    if (shareWhatsAppBtn) {
      shareWhatsAppBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    }

    async function triggerShare() {
      if (navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: 'Explore Ward 29 voter information, statistics, candidates and community updates.',
            url: appUrl
          });
          showToast('✓ Link shared successfully');
          return;
        } catch (err) {
          if (err.name !== 'AbortError') {
            if (shareModal) shareModal.classList.add('open');
          }
        }
      } else {
        if (shareModal) shareModal.classList.add('open');
      }
    }

    if (heroShareBtn) heroShareBtn.addEventListener('click', triggerShare);
    if (bottomShareBtn) bottomShareBtn.addEventListener('click', triggerShare);
    if (dashShareBtn) dashShareBtn.addEventListener('click', triggerShare);
    if (shareClose) shareClose.addEventListener('click', () => shareModal.classList.remove('open'));
    if (shareCloseAction) shareCloseAction.addEventListener('click', () => shareModal.classList.remove('open'));
    if (shareModal) {
      shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) shareModal.classList.remove('open');
      });
    }

    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(appUrl).then(() => {
          showToast('✓ Link copied to clipboard!');
        });
      });
    }
  }

  // --- 14. BOTTOM NAVIGATION ACTIVE STATE ---
  function setupBottomNavigation() {
    const navLinks = document.querySelectorAll('.bottom-nav-link');
    const sections = ['overview', 'stats', 'candidates', 'voters', 'community'];

    function updateActiveNav() {
      const scrollPos = window.scrollY + 180;
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = document.getElementById(sections[i]);
        if (sec && sec.offsetTop <= scrollPos) {
          navLinks.forEach(link => {
            const href = link.getAttribute('href').replace('#', '');
            if (href === sections[i]) link.classList.add('active');
            else link.classList.remove('active');
          });
          break;
        }
      }
    }

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav();
  }

  // --- 15. HELPER UTILITIES ---
  window.copyVoterId = function (epic) {
    navigator.clipboard.writeText(epic).then(() => {
      showToast(`✓ Voter ID ${epic} copied!`);
    });
  };

  function showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = msg;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

})();
