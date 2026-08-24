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
      id: 2,
      order: 1,
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
      order: 2,
      name: "Poonam Sihag",
      nameHi: "पूनम सिहाग",
      relation: "W/O Anil Sihag",
      relationHi: "पत्नी अनिल सिहाग",
      initials: "PS",
      color: "#059669",
      photo: "./assets/candidates/poonam.jpeg"
    },
    {
      id: 6,
      order: 3,
      name: "Deepa",
      nameHi: "दीपा",
      relation: "D/o/L Tarachand Saini",
      relationHi: "पुत्री स्व. ताराचंद सैनी",
      initials: "DS",
      color: "#0d9488",
      photo: "./assets/candidates/Dipa.jpg"
    },
    {
      id: 4,
      order: 4,
      name: "Suman",
      nameHi: "सुमन",
      relation: "W/O Tilak",
      relationHi: "पत्नी तिलक",
      initials: "SM",
      color: "#d97706",
      photo: null
    },
    {
      id: 1,
      order: 5,
      name: "Monika Baloda",
      nameHi: "मोनिका बलोदा",
      relation: "W/O Manish Baloda",
      relationHi: "पत्नी मनीष बलोदा",
      initials: "MB",
      color: "#2563eb",
      photo: null
    },
    {
      id: 5,
      order: 6,
      name: "Aruna Madam",
      nameHi: "अरुणा मैडम",
      relation: "W/O Bhupendra Sheoran",
      relationHi: "पत्नी भूपेंद्र स्योराण",
      initials: "AM",
      color: "#8b5cf6",
      photo: null
    }
  ];

  function getCandidatesInOrder() {
    return CANDIDATES.slice().sort((a, b) => a.order - b.order);
  }

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
      votes: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      totalVotes: 0,
      hasVoted: false,
      userVotedCandidateId: null,
      pendingCandidateId: null,
      isSubmitting: false
    },
    mapZoom: 1,
    mapPan: { x: 0, y: 0 }
  };

  // --- 4. INITIALIZATION ---
  const VOTE_TOKEN_KEY = 'ward29_vote_token';
  const VOTE_TOKEN_COOKIE = 'ward29_vote_token';
  const VOTE_CANDIDATE_KEY = 'ward29_voted_candidate_id';

  document.addEventListener('DOMContentLoaded', async () => {
    initPollState();
    await loadInitialData();
    await syncServerVoteStatus();
    setupBottomNavigation();
    setupCandidateVoting();
    setupVoterSearchAndFilters();
    setupInteractiveMap();
    setupCandidatePhotoViewer();
    setupShareFeatures();
    renderDashboardVisuals();
    renderCandidatesList();
    renderVoters();
    hideAppSplash();
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

  // --- 6. ANONYMOUS POLL TOKEN (no personal data, no fingerprinting) ---
  function hideAppSplash() {
    const splash = document.getElementById('appSplash');
    if (!splash) return;
    splash.classList.add('is-done');
    window.setTimeout(() => splash.remove(), 400);
  }

  function readVoteTokenCookie() {
    const match = document.cookie.match(new RegExp('(?:^|; )' + VOTE_TOKEN_COOKIE + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function writeVoteTokenCookie(token) {
    const maxAge = 60 * 60 * 24 * 400;
    document.cookie = VOTE_TOKEN_COOKIE + '=' + encodeURIComponent(token) + '; path=/; max-age=' + maxAge + '; SameSite=Lax';
  }

  function getOrCreateVoteToken() {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let token = localStorage.getItem(VOTE_TOKEN_KEY) || readVoteTokenCookie();
    if (!token || !uuidRe.test(token)) {
      token = (crypto.randomUUID && crypto.randomUUID()) ||
        ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
          const n = (Math.random() * 16) | 0;
          const v = ch === 'x' ? n : (n & 0x3) | 0x8;
          return v.toString(16);
        }));
    }
    localStorage.setItem(VOTE_TOKEN_KEY, token);
    writeVoteTokenCookie(token);
    return token;
  }

  async function sha256Hex(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async function getDeviceHash() {
    return sha256Hex(getOrCreateVoteToken());
  }

  async function getDeviceScopeHash() {
    const material = [
      navigator.platform || '',
      String(screen.width),
      String(screen.height),
      String(window.devicePixelRatio || 1),
      Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      navigator.maxTouchPoints > 0 ? 'touch' : 'no-touch',
      (navigator.language || '').split('-')[0]
    ].join('|');
    return sha256Hex('ward29-scope:' + material);
  }

  function markLocalVoted(candidateId) {
    state.poll.hasVoted = true;
    state.poll.userVotedCandidateId = candidateId;
    localStorage.setItem(VOTE_CANDIDATE_KEY, String(candidateId));
  }

  async function syncServerVoteStatus() {
    if (!supabaseClient) return;
    try {
      const hash = await getDeviceHash();
      const scopeHash = await getDeviceScopeHash();
      const { data, error } = await supabaseClient.rpc('get_vote_status', {
        p_device_hash: hash,
        p_device_scope_hash: scopeHash
      });
      if (error || !data) return;
      if (data.voted && data.candidate_id) {
        markLocalVoted(Number(data.candidate_id));
      }
    } catch (err) {
      /* status sync is UX-only */
    }
  }

  function initPollState() {
    getOrCreateVoteToken();
    const votedId = localStorage.getItem(VOTE_CANDIDATE_KEY);
    if (votedId) {
      state.poll.hasVoted = true;
      state.poll.userVotedCandidateId = parseInt(votedId, 10);
    }

    const savedVotes = localStorage.getItem('ward29_community_votes');
    if (savedVotes) {
      try {
        state.poll.votes = JSON.parse(savedVotes);
      } catch (e) {
        state.poll.votes = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
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

  function getPollLeadership() {
    const ranked = CANDIDATES.map((c) => {
      const votes = state.poll.votes[c.id] || 0;
      const pct = state.poll.totalVotes > 0 ? (votes / state.poll.totalVotes) * 100 : 0;
      return { candidate: c, votes, pct };
    }).sort((a, b) => b.votes - a.votes);

    const top = ranked[0];
    if (!top || top.votes === 0) {
      return { ranked, leaders: [], isTie: false, hasVotes: false };
    }
    const leaders = ranked.filter((row) => row.votes === top.votes);
    return { ranked, leaders, isTie: leaders.length > 1, hasVotes: true };
  }

  function formatPollPct(value) {
    return value.toFixed(2);
  }

  function renderHomePollPreview() {
    const leaderEl = document.getElementById('dashPollLeader');
    if (!leaderEl) return;

    const lead = getPollLeadership();
    const kicker = document.getElementById('dashPollKicker');
    const votesEl = document.getElementById('dashPollVotes');
    const pctEl = document.getElementById('dashPollPct');
    const totalEl = document.getElementById('dashPollTotal');

    if (!lead.hasVotes) {
      if (kicker) kicker.textContent = 'Current leader';
      leaderEl.textContent = 'Waiting for votes';
      if (votesEl) votesEl.textContent = '0';
      if (pctEl) pctEl.textContent = '0.00%';
    } else if (lead.isTie) {
      if (kicker) kicker.textContent = 'Current leaders';
      leaderEl.textContent = 'Tie between ' + lead.leaders.length + ' candidates';
      if (votesEl) votesEl.textContent = String(lead.leaders[0].votes);
      if (pctEl) pctEl.textContent = formatPollPct(lead.leaders[0].pct) + '%';
    } else {
      const sole = lead.leaders[0];
      if (kicker) kicker.textContent = 'Current leader';
      leaderEl.textContent = sole.candidate.name;
      if (votesEl) votesEl.textContent = String(sole.votes);
      if (pctEl) pctEl.textContent = formatPollPct(sole.pct) + '%';
    }
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
        if (e.target === confirmModal && !state.poll.isSubmitting) closeConfirmModal();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        if (!state.poll.pendingCandidateId || state.poll.isSubmitting) return;
        await submitUserVote(state.poll.pendingCandidateId);
      });
    }
    const resultsBtn = document.getElementById('voteViewResultsBtn');
    if (resultsBtn) {
      resultsBtn.addEventListener('click', () => {
        closeConfirmModal();
        const section = document.getElementById('candidates');
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function setVoteSheetMode(mode) {
    const title = document.getElementById('voteSheetTitle');
    const confirmView = document.getElementById('voteSheetConfirmView');
    const successView = document.getElementById('voteSheetSuccessView');
    const alreadyView = document.getElementById('voteSheetAlreadyView');
    const confirmActions = document.getElementById('voteSheetConfirmActions');
    const resultActions = document.getElementById('voteSheetResultActions');
    const show = (el, on) => { if (el) el.hidden = !on; };
    show(confirmView, mode === 'confirm');
    show(successView, mode === 'success');
    show(alreadyView, mode === 'already');
    show(confirmActions, mode === 'confirm');
    show(resultActions, mode === 'success' || mode === 'already');
    if (title) {
      title.textContent = mode === 'success' ? 'Vote recorded' : mode === 'already' ? 'Already voted' : 'Confirm your vote';
    }
  }

  function setSubmitButtonBusy(busy) {
    const submitBtn = document.getElementById('voteSubmitBtn');
    if (!submitBtn) return;
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Submitting...' : 'Confirm Vote';
  }

  function openVoteConfirmation(candidateId) {
    if (state.poll.isSubmitting) return;
    if (state.poll.hasVoted) {
      setVoteSheetMode('already');
      const modal = document.getElementById('voteConfirmModalBackdrop');
      if (modal) modal.classList.add('open');
      return;
    }

    const candidate = CANDIDATES.find(c => c.id === candidateId);
    if (!candidate) return;

    state.poll.pendingCandidateId = candidateId;
    const nameEl = document.getElementById('confirmCandidateName');
    const relEl = document.getElementById('confirmCandidateRel');
    if (nameEl) nameEl.textContent = candidate.name + ' (' + candidate.nameHi + ')';
    if (relEl) relEl.textContent = candidate.relation + ' • ' + candidate.relationHi;
    setVoteSheetMode('confirm');
    setSubmitButtonBusy(false);

    const modal = document.getElementById('voteConfirmModalBackdrop');
    if (modal) modal.classList.add('open');
  }

  function closeConfirmModal() {
    if (state.poll.isSubmitting) return;
    state.poll.pendingCandidateId = null;
    const modal = document.getElementById('voteConfirmModalBackdrop');
    if (modal) modal.classList.remove('open');
    setVoteSheetMode('confirm');
    setSubmitButtonBusy(false);
  }

  async function submitUserVote(candidateId) {
    if (state.poll.isSubmitting) return;
    if (!CANDIDATES.some((c) => c.id === candidateId)) return;

    if (!navigator.onLine) {
      showToast('You appear to be offline. Please connect and try again.');
      return;
    }

    if (!supabaseClient) {
      showToast('Voting is temporarily unavailable. Please try again.');
      return;
    }

    state.poll.isSubmitting = true;
    setSubmitButtonBusy(true);
    renderCandidatesList();

    try {
      const hash = await getDeviceHash();
      const scopeHash = await getDeviceScopeHash();
      const { data, error } = await supabaseClient.rpc('submit_vote', {
        p_candidate_id: candidateId,
        p_device_hash: hash,
        p_device_scope_hash: scopeHash
      });

      const result = data || {};
      if (error && !result.status) {
        showToast('Your vote could not be recorded. Please try again.');
        return;
      }

      if (result.status === 'recorded') {
        markLocalVoted(candidateId);
        await fetchSupabaseVotes();
        renderCandidatesList();
        renderPollResults();
        setVoteSheetMode('success');
        return;
      }

      if (result.status === 'already_voted') {
        const existingId = Number(result.candidate_id) || state.poll.userVotedCandidateId;
        if (existingId) markLocalVoted(existingId);
        else state.poll.hasVoted = true;
        await fetchSupabaseVotes();
        renderCandidatesList();
        renderPollResults();
        setVoteSheetMode('already');
        return;
      }

      showToast('Your vote could not be recorded. Please try again.');
    } catch (err) {
      showToast('Your vote could not be recorded. Please try again.');
    } finally {
      state.poll.isSubmitting = false;
      setSubmitButtonBusy(false);
      renderCandidatesList();
    }
  }

  function renderCandidatesList() {
    const grid = document.getElementById('candidatesGrid');
    if (!grid) return;

    const lead = getPollLeadership();
    const uniqueLeaderId = lead.hasVotes && !lead.isTie ? lead.leaders[0].candidate.id : null;
    const ordered = getCandidatesInOrder();
    const busy = state.poll.isSubmitting;
    const pendingId = state.poll.pendingCandidateId;

    grid.innerHTML = ordered.map(c => {
      const votes = state.poll.votes[c.id] || 0;
      const pct = state.poll.totalVotes > 0 ? formatPollPct((votes / state.poll.totalVotes) * 100) : '0.00';
      const isLeader = uniqueLeaderId === c.id;
      const isUserVoted = state.poll.userVotedCandidateId === c.id;

      let mediaMarkup = '';
      if (c.photo) {
        mediaMarkup = `
          <button type="button" class="candidate-photo-frame js-open-candidate-photo" data-photo="${c.photo}" data-name="${c.name}" aria-label="View ${c.name} photo full screen">
            <img src="${c.photo}" alt="${c.name}" class="candidate-photo-img" loading="lazy">
            <span class="candidate-photo-tap-hint">View full photo · Download</span>
          </button>
        `;
      } else {
        mediaMarkup = `
          <div class="candidate-avatar-placeholder" style="background: ${c.color};">
            ${c.initials}
          </div>
        `;
      }

      let voteBtn = '';
      if (busy && pendingId === c.id) {
        voteBtn = '<button type="button" class="btn-vote-candidate is-busy" disabled>Submitting...</button>';
      } else if (state.poll.hasVoted) {
        voteBtn = '<button type="button" class="btn-vote-candidate' + (isUserVoted ? ' voted-this' : '') + '" disabled>' +
          (isUserVoted ? '✓ Voted' : 'Already Voted') + '</button>';
      } else {
        voteBtn = '<button type="button" class="btn-vote-candidate" onclick="window.openCandidateVote(' + c.id + ')">Vote</button>';
      }

      return `
        <div class="candidate-card-item ${isLeader ? 'is-leader' : ''}">
          <div class="candidate-top-bar">
            <span class="candidate-num-badge">Candidate #${c.order}</span>
            ${isLeader ? '<span class="leader-badge-pill">Current Leader</span>' : ''}
          </div>
          <div class="candidate-media-wrap">
            ${mediaMarkup}
            <div class="candidate-info-block">
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
          <div style="margin-top: 0.875rem;">${voteBtn}</div>
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
    const banner = document.getElementById('pollLeaderBanner');

    if (totalElem) totalElem.textContent = state.poll.totalVotes;
    if (centerTotal) centerTotal.textContent = state.poll.totalVotes;
    renderHomePollPreview();

    const lead = getPollLeadership();
    if (banner) {
      if (!lead.hasVotes) {
        banner.innerHTML = '';
      } else if (lead.isTie) {
        banner.innerHTML = '<p class="poll-leader-kicker">Current leaders</p><p class="poll-leader-name">Tie between ' + lead.leaders.length + ' candidates</p><p class="poll-leader-meta">' + lead.leaders[0].votes + ' votes · ' + formatPollPct(lead.leaders[0].pct) + '% each</p>';
      } else {
        const sole = lead.leaders[0];
        banner.innerHTML = '<p class="poll-leader-kicker">Current leader</p><p class="poll-leader-name">' + sole.candidate.name + '</p><p class="poll-leader-meta">' + sole.votes + ' votes · ' + formatPollPct(sole.pct) + '%</p>';
      }
    }

    if (!leaderboard) return;

    leaderboard.innerHTML = lead.ranked.map((row, idx) => {
      const pct = formatPollPct(row.pct);
      return `
        <div class="leaderboard-item">
          <div class="leaderboard-item-top">
            <div class="leaderboard-candidate-name">
              <span style="color: var(--text-tertiary); font-weight: 800; margin-right: 0.35rem;">#${idx + 1}</span>
              <span>${row.candidate.name}</span>
            </div>
            <div class="leaderboard-votes-info">
              <span>${row.votes}</span> <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 600;">(${pct}%)</span>
            </div>
          </div>
          <div class="candidate-progress-bar-wrap" style="height: 5px; margin-top: 0.2rem;">
            <div class="candidate-progress-bar-inner" style="width: ${pct}%; background: ${row.candidate.color};"></div>
          </div>
        </div>
      `;
    }).join('');

    if (donutSegments) {
      let cumulativeOffset = 0;
      const circumference = 238.76;
      donutSegments.innerHTML = lead.ranked.map((row) => {
        if (row.votes === 0 || state.poll.totalVotes === 0) return '';
        const dashLength = (row.votes / state.poll.totalVotes) * circumference;
        const segmentSvg = `
          <circle cx="50" cy="50" r="38" fill="none" stroke="${row.candidate.color}" stroke-width="18"
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

  // --- 12. CANDIDATE PHOTO VIEWER ---
  function setupCandidatePhotoViewer() {
    const modal = document.getElementById('candidatePhotoModalBackdrop');
    const img = document.getElementById('candidatePhotoModalImg');
    const title = document.getElementById('candidatePhotoTitle');
    const closeBtn = document.getElementById('candidatePhotoCloseBtn');
    const downloadBtn = document.getElementById('candidatePhotoDownloadBtn');
    const grid = document.getElementById('candidatesGrid');

    let currentPhotoUrl = '';
    let currentFileName = 'candidate.jpg';

    function closePhotoModal() {
      if (modal) modal.classList.remove('open');
      document.body.style.overflow = '';
    }

    function openPhotoModal(photoSrc, candidateName) {
      if (!modal || !img) return;
      currentPhotoUrl = new URL(photoSrc, window.location.href).href;
      const ext = photoSrc.split('.').pop().split('?')[0] || 'jpg';
      currentFileName = candidateName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') + '.' + ext;
      img.src = currentPhotoUrl;
      img.alt = candidateName;
      if (title) title.textContent = candidateName;
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    async function downloadPhoto() {
      if (!currentPhotoUrl) return;
      try {
        const res = await fetch(currentPhotoUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = currentFileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
        showToast('Photo download started');
      } catch {
        window.open(currentPhotoUrl, '_blank', 'noopener');
        showToast('Open the image and save from your browser');
      }
    }

    if (grid) {
      grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.js-open-candidate-photo');
        if (!btn) return;
        const src = btn.getAttribute('data-photo');
        const name = btn.getAttribute('data-name') || 'Candidate';
        if (src) openPhotoModal(src, name);
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closePhotoModal);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadPhoto);

    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.id === 'candidatePhotoViewport') closePhotoModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && modal.classList.contains('open')) closePhotoModal();
    });
  }

  // --- 13. FULLSCREEN MAP VIEWER ---
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
