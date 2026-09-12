(function(){
  // ---------------- page routing ----------------
  const PAGES = ['home', 'test-menu', 'data', 'specs'];
  let dataChartReady = false;
  let sessionNum = 0;
  let contactSeries = [];
  let signalSeries = [];
  let animFrame = null;
  const SAMPLE_SESSIONS = [
    { contact: 62, signal: 30 },
    { contact: 68, signal: 34 },
    { contact: 71, signal: 38 },
    { contact: 75, signal: 41 },
    { contact: 79, signal: 47 },
    { contact: 83, signal: 52 },
    { contact: 88, signal: 58 }
  ];
  const CHART = { padLeft: 46, padRight: 24, padTop: 16, padBottom: 30, pointGap: 68, height: 240 };

  function showPage(name){
    if(!PAGES.includes(name)) name = 'home';
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('page-active', p.dataset.page === name));
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
    window.scrollTo(0, 0);
    history.replaceState(null, '', '#' + name);
    if(name === 'data' && !dataChartReady){
      dataChartReady = true;
      initDataChart();
    }
  }

  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      showPage(el.dataset.nav);
      closeMobileNav();
    });
  });

  showPage((location.hash || '#home').slice(1));

  // ---------------- mobile hamburger nav ----------------
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNavPanel = document.getElementById('mobileNavPanel');

  function openMobileNav(){
    hamburgerBtn.classList.add('open');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    mobileNavPanel.classList.add('open');
  }
  function closeMobileNav(){
    if(!hamburgerBtn || !mobileNavPanel) return;
    hamburgerBtn.classList.remove('open');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    mobileNavPanel.classList.remove('open');
  }
  if(hamburgerBtn && mobileNavPanel){
    hamburgerBtn.addEventListener('click', () => {
      if(mobileNavPanel.classList.contains('open')) closeMobileNav();
      else openMobileNav();
    });
  }

  // ---------------- roadmap: featured card + grid, auto-cycling ----------------
  const ROADMAP_TESTS = [
    {
      status: 'live', label: 'Live', title: 'Electrode contact check',
      short: "Verifies electrode-to-skin contact is good before trusting anything else.",
      long: "Calibrate against your own best-contact baseline, then verify the electrode's resistance is in range before every session starts. Nothing else on this list can be trusted without it.",
      icon: `<circle cx="8" cy="20" r="3.4" stroke="var(--good)" stroke-width="1.8"/><circle cx="24" cy="20" r="3.4" stroke="var(--good)" stroke-width="1.8"/><path d="M11.5 20H20.5" stroke="var(--good)" stroke-width="1.8"/><path d="M12 10l3 3 6-7" stroke="var(--good)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
    },
    {
      status: 'next', label: 'Next', title: 'Reaction-time test',
      short: "A countdown, then a randomly-timed cue — timing the nerve signal, then the finger.",
      long: "A countdown, then a randomly-timed cue — measuring how long the muscle's electrical signal takes to fire (premotor time), and then how long the finger takes to actually start moving (electromechanical delay).",
      icon: `<circle cx="16" cy="18" r="9" stroke="var(--warn)" stroke-width="1.8"/><path d="M16 18V12" stroke="var(--warn)" stroke-width="1.8" stroke-linecap="round"/><path d="M16 18l4 3" stroke="var(--warn)" stroke-width="1.8" stroke-linecap="round"/><path d="M13 6H19" stroke="var(--warn)" stroke-width="1.8" stroke-linecap="round"/>`
    },
    {
      status: 'next', label: 'Next', title: 'Baseline recording',
      short: "Captures a short reference recording once contact reads good or better.",
      long: "Once contact is confirmed good, captures a short reference recording of the tracked signal — the baseline every later session gets compared against to see whether things are trending toward recovery.",
      icon: `<rect x="4" y="6" width="24" height="20" rx="3" stroke="var(--warn)" stroke-width="1.6"/><path d="M7 18 L11 18 L13 11 L16 23 L19 14 L21 18 L25 18" stroke="var(--warn)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
    },
    {
      status: 'planned', label: 'Planned', title: 'Session logging',
      short: "Bundles a test run's numbers with the contact quality it was measured under.",
      long: "Each worn session is stored with its contact quality, timestamp, and signal summary, so a session measured under bad contact is never mistaken for — or compared directly against — one measured under good contact.",
      icon: `<rect x="6" y="8" width="20" height="4.5" rx="1.5" stroke="var(--muted)" stroke-width="1.6"/><rect x="6" y="14.5" width="20" height="4.5" rx="1.5" stroke="var(--muted)" stroke-width="1.6"/><rect x="6" y="21" width="20" height="4.5" rx="1.5" stroke="var(--muted)" stroke-width="1.6"/>`
    },
    {
      status: 'planned', label: 'Planned', title: 'Recovery tracking over time',
      short: "Plots the same metric session by session to show trend, plateau, or a need for follow-up.",
      long: "Sessions laid out across weeks to show whether signal strength and reaction timing are trending toward recovery, plateauing, or worth flagging to a clinician for a closer look.",
      icon: `<path d="M5 23 L12 15 L17 19 L27 7" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 7H27V13" stroke="var(--muted)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
    }
  ];

  const roadmapLayout = document.getElementById('roadmapLayout');
  const testFeatured = document.getElementById('testFeatured');
  const testGrid = document.getElementById('testGrid');
  let roadmapIndex = 0;
  let roadmapTimer = null;
  const roadmapReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function roadmapIconSvg(icon){
    return `<svg viewBox="0 0 32 32" fill="none">${icon}</svg>`;
  }

  function renderFeatured(){
    const t = ROADMAP_TESTS[roadmapIndex];
    const dots = ROADMAP_TESTS.map((_, i) =>
      `<button class="roadmap-dot${i === roadmapIndex ? ' active' : ''}" data-idx="${i}" aria-label="Show ${ROADMAP_TESTS[i].title}"></button>`
    ).join('');
    testFeatured.innerHTML = `
      <div class="test-featured-body" id="testFeaturedBody">
        <div class="icon-wrap">${roadmapIconSvg(t.icon)}</div>
        <span class="status-chip-sm st-${t.status}">${t.label}</span>
        <h3>${t.title}</h3>
        <p>${t.long}</p>
      </div>
      <div class="roadmap-dots">${dots}</div>`;
    testFeatured.querySelectorAll('.roadmap-dot').forEach(dot => {
      dot.addEventListener('click', () => selectRoadmap(parseInt(dot.dataset.idx, 10)));
    });
  }

  function renderGrid(){
    const others = ROADMAP_TESTS.map((t, i) => ({ t, i })).filter(x => x.i !== roadmapIndex);
    testGrid.innerHTML = others.map(({ t, i }) => `
      <button class="test-card" data-idx="${i}" type="button">
        <div class="icon-wrap">${roadmapIconSvg(t.icon)}</div>
        <span class="status-chip-sm st-${t.status}">${t.label}</span>
        <h3>${t.title}</h3>
        <p>${t.short}</p>
      </button>`).join('');
    testGrid.querySelectorAll('.test-card').forEach(card => {
      card.addEventListener('click', () => selectRoadmap(parseInt(card.dataset.idx, 10)));
    });
  }

  function renderRoadmap(){
    renderFeatured();
    renderGrid();
  }

  function selectRoadmap(idx){
    if(idx === roadmapIndex) return;
    const body = document.getElementById('testFeaturedBody');
    const cards = testGrid.querySelectorAll('.test-card');
    if(roadmapReducedMotion || !body){
      roadmapIndex = idx;
      renderRoadmap();
    } else {
      body.classList.add('fading');
      cards.forEach(c => c.classList.add('fading'));
      setTimeout(() => {
        roadmapIndex = idx;
        renderRoadmap();
      }, 180);
    }
    restartRoadmapTimer();
  }

  function advanceRoadmap(){
    selectRoadmap((roadmapIndex + 1) % ROADMAP_TESTS.length);
  }

  function restartRoadmapTimer(){
    if(roadmapTimer) clearInterval(roadmapTimer);
    if(roadmapReducedMotion) return;
    roadmapTimer = setInterval(advanceRoadmap, 8000);
  }

  if(testFeatured && testGrid){
    renderRoadmap();
    restartRoadmapTimer();
    roadmapLayout.addEventListener('mouseenter', () => { if(roadmapTimer) clearInterval(roadmapTimer); });
    roadmapLayout.addEventListener('mouseleave', () => restartRoadmapTimer());
  }

  // ---------------- clock ----------------
  function tickClock(){
    document.getElementById('scopeClock').textContent = new Date().toLocaleTimeString('en-GB');
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ---------------- serial support check ----------------
  const serialSupported = 'serial' in navigator;
  if(!serialSupported){
    document.getElementById('unsupportedNotice').style.display = 'block';
  }

  let port = null;
  let writer = null;
  let reader = null;
  let readableClosed = null;
  let keepReading = false;

  const topStatusDot = document.getElementById('topStatusDot');
  const topStatusText = document.getElementById('topStatusText');
  const panelStatusDot = document.getElementById('panelStatusDot');
  const panelStatusText = document.getElementById('panelStatusText');
  const panelStateLabel = document.getElementById('panelStateLabel');
  const enterMenuBtn = document.getElementById('enterMenuBtn');
  const heroConnectBtn = document.getElementById('heroConnectBtn');
  const panelConnectBtn = document.getElementById('panelConnectBtn');
  const baudSelect = document.getElementById('baudSelect');

  function setConnectedUI(connected){
    [topStatusDot, panelStatusDot].forEach(d => d.classList.toggle('on', connected));
    topStatusText.textContent = connected ? 'Board connected' : 'No device connected';
    panelStatusText.textContent = connected ? 'Connected' : 'Not connected';
    enterMenuBtn.disabled = !connected;
    heroConnectBtn.textContent = connected ? 'Board connected' : 'Connect the board';
    heroConnectBtn.disabled = connected;
    panelConnectBtn.textContent = connected ? 'Disconnect' : 'Connect';
  }
  setConnectedUI(false);

  async function connectSerial(){
    if(!serialSupported){
      alert('This browser doesn\'t support Web Serial. Try Chrome or Edge on desktop.');
      return;
    }
    try{
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: parseInt(baudSelect.value, 10) });
      writer = port.writable.getWriter();
      setConnectedUI(true);
      startReadLoop();
    }catch(err){
      if(err && err.name !== 'NotFoundError'){
        console.error(err);
        alert('Could not connect: ' + err.message + (err.message && err.message.toLowerCase().includes('open') ? '\n\nThis usually means something else has the port — close the Arduino IDE\'s Serial Monitor/Plotter, close other tabs using this port, or unplug and replug the board, then try again.' : ''));
      }
    }
  }

  async function disconnectSerial(){
    keepReading = false;
    try{ if(reader){ await reader.cancel(); } }catch(e){}
    try{ if(writer){ writer.releaseLock(); } }catch(e){}
    try{ if(readableClosed){ await readableClosed.catch(()=>{}); } }catch(e){}
    try{ if(port){ await port.close(); } }catch(e){}
    port = null; writer = null; reader = null;
    setConnectedUI(false);
  }

  async function toggleConnection(){
    if(port){ await disconnectSerial(); }
    else{ await connectSerial(); }
  }

  heroConnectBtn.addEventListener('click', connectSerial);
  panelConnectBtn.addEventListener('click', toggleConnection);

  async function sendCommand(cmd){
    if(!writer){
      alert('Connect the board first.');
      return false;
    }
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(cmd + '\n'));
    return true;
  }

  // ---------------- read loop ----------------
  let lineBuffer = '';

  // Matches "CALIBRATION_RESULT:done:998046" or "CALIBRATION_RESULT:failed"
  function parseCalibrationResult(line){
    const m = line.match(/CALIBRATION_RESULT:(done|failed)(?::(-?\d+(?:\.\d+)?))?/i);
    if(!m) return null;
    return { ok: m[1].toLowerCase() === 'done', baseline: m[2] !== undefined ? parseFloat(m[2]) : null };
  }

  // Matches "TEST_RESULT:EXCELLENT:8,1,1:212345"
  function parseTestResult(line){
    const m = line.match(/TEST_RESULT:([A-Z_]+):(\d+),(\d+),(\d+):(-?\d+(?:\.\d+)?|N\/A)/i);
    if(!m) return null;
    return {
      verdict: m[1].toUpperCase(),
      good: parseInt(m[2], 10),
      poor: parseInt(m[3], 10),
      none: parseInt(m[4], 10),
      avgResistance: m[5].toUpperCase() === 'N/A' ? null : parseFloat(m[5])
    };
  }

  function handleIncomingLine(line){
    line = line.trim();
    if(!line) return;

    const activeScreen = document.querySelector('.screen.active');
    const screenName = activeScreen ? activeScreen.dataset.screen : null;

    if(screenName === 'CALIBRATE'){
      appendLog('calibLog', line);
      const result = parseCalibrationResult(line);
      if(result && calibrating){
        finishCalibration(result);
      }
    } else if(screenName === 'CONTACT_TEST'){
      appendLog('testLog', line);
      const result = parseTestResult(line);
      if(result && testing){
        finishContactTest(result);
      }
    }
  }

  async function startReadLoop(){
    keepReading = true;
    const textDecoder = new TextDecoderStream();
    readableClosed = port.readable.pipeTo(textDecoder.writable);
    reader = textDecoder.readable.getReader();
    try{
      while(keepReading){
        const { value, done } = await reader.read();
        if(done) break;
        if(value){
          lineBuffer += value;
          let idx;
          while((idx = lineBuffer.indexOf('\n')) >= 0){
            const line = lineBuffer.slice(0, idx);
            lineBuffer = lineBuffer.slice(idx + 1);
            handleIncomingLine(line);
          }
        }
      }
    }catch(err){
      console.error('Serial read ended:', err);
    }finally{
      try{ reader.releaseLock(); }catch(e){}
    }
  }

  function appendLog(id, text){
    const el = document.getElementById(id);
    const row = document.createElement('div');
    const t = new Date().toLocaleTimeString('en-GB');
    row.textContent = t + '  ' + text;
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
    while(el.children.length > 60){ el.removeChild(el.firstChild); }
  }

  // ---------------- app state machine (mirrors keyPressed) ----------------
  let appState = 'HOME';
  let calibrating = false;
  let testing = false;
  let calibrationDone = false;
  const SAMPLE_WINDOW_MS = 2500; // matches the Arduino's own ~3s sampling loop, just for the progress ring

  const goTestBtn = document.getElementById('goTestBtn');
  const runTestBtn = document.getElementById('runTestBtn');
  const testOptionHint = document.getElementById('testOptionHint');

  function setTestUnlocked(unlocked){
    calibrationDone = unlocked;
    goTestBtn.disabled = !unlocked;
    runTestBtn.disabled = !unlocked;
    testOptionHint.textContent = unlocked
      ? 'Check current electrode placement against the baseline.'
      : 'Run a calibration first to unlock this.';
  }
  setTestUnlocked(false);

  const screens = document.querySelectorAll('.screen');
  function goTo(state){
    appState = state;
    screens.forEach(s => s.classList.toggle('active', s.dataset.screen === state));
    panelStateLabel.textContent = 'STATE: ' + state;
  }

  function setVerdict(text, kind, summary){
    const el = document.getElementById('verdictText');
    el.textContent = text;
    el.style.setProperty('--accent', kind === 'good' ? 'var(--good)' : kind === 'warn' ? 'var(--warn)' : kind === 'bad' ? 'var(--bad)' : 'var(--muted)');
    document.getElementById('summaryText').textContent = summary || '';
  }

  function setCalibStatus(text, kind, summary){
    const el = document.getElementById('calibStatusText');
    el.textContent = text;
    el.style.setProperty('--accent', kind === 'good' ? 'var(--good)' : kind === 'warn' ? 'var(--warn)' : 'var(--muted)');
    document.getElementById('calibSummaryText').textContent = summary || '';
  }

  // ---------------- calibration ring ----------------
  const RING_CIRC = 327; // 2 * PI * 52
  function setCalibProgress(fraction){
    const el = document.getElementById('calibRingProgress');
    el.style.strokeDashoffset = String(RING_CIRC - Math.min(1, Math.max(0, fraction)) * RING_CIRC);
  }
  function setCalibLiveValue(value){
    document.getElementById('calibLiveValue').textContent = Math.round(value * 100) / 100;
  }

  // ---------------- shared result icon ----------------
  function setResultIcon(elId, kind, pulsing){
    const el = document.getElementById(elId);
    el.classList.toggle('pulsing', !!pulsing);
    const colors = {
      good: 'rgba(63,143,95,0.85)',
      warn: 'rgba(217,138,61,0.85)',
      bad: 'rgba(194,75,62,0.85)',
      muted: 'rgba(255,255,255,0.08)'
    };
    const symbols = { good: '✓', warn: '!', bad: '✕', muted: pulsing ? '…' : '—' };
    el.style.background = colors[kind] || colors.muted;
    el.textContent = symbols[kind] || symbols.muted;
  }

  // ---------------- contact-test quality meter ----------------
  // Order matters — must match the segments' data-level attributes left to right.
  const QUALITY_LEVELS = ['NO_CONTACT', 'POOR', 'MARGINAL', 'GOOD', 'EXCELLENT'];
  const LEVEL_KIND = { NO_CONTACT: 'bad', POOR: 'bad', MARGINAL: 'warn', GOOD: 'good', EXCELLENT: 'good' };

  function setQualityMeter(verdict){
    document.querySelectorAll('.quality-seg').forEach(seg => {
      seg.classList.toggle('active', seg.dataset.level === verdict);
    });
  }

  function renderStatPills(good, poor, none, avgResistance){
    const pills = document.getElementById('statPills');
    let html = '';
    html += '<span class="stat-pill"><span class="dot good"></span>Good <b>' + good + '</b></span>';
    html += '<span class="stat-pill"><span class="dot warn"></span>Poor <b>' + poor + '</b></span>';
    html += '<span class="stat-pill"><span class="dot bad"></span>None <b>' + none + '</b></span>';
    if(avgResistance !== null){
      html += '<span class="stat-pill">Avg <b>' + (Math.round(avgResistance*100)/100) + ' Ω</b></span>';
    }
    pills.innerHTML = html;
  }
  enterMenuBtn.addEventListener('click', () => goTo('MENU'));
  document.getElementById('goCalibrateBtn').addEventListener('click', () => {
    goTo('CALIBRATE');
    setCalibStatus('Idle', 'muted', 'Run calibration to capture a baseline.');
    setCalibProgress(0);
    setResultIcon('calibIcon', 'muted', false);
    document.getElementById('calibLiveValue').textContent = '—';
  });
  goTestBtn.addEventListener('click', () => {
    if(goTestBtn.disabled) return;
    goTo('CONTACT_TEST');
    setVerdict('Idle', 'muted', 'Run the test to sample this placement.');
    setResultIcon('testIcon', 'muted', false);
    setQualityMeter(null);
    document.getElementById('statPills').innerHTML = '';
  });
  document.getElementById('menuBackBtn').addEventListener('click', () => goTo('HOME'));
  document.getElementById('calibBackBtn').addEventListener('click', () => goTo('MENU'));
  document.getElementById('testBackBtn').addEventListener('click', () => goTo('MENU'));
  document.getElementById('goReactionBtn').addEventListener('click', () => goTo('REACTION_TIME'));
  document.getElementById('reactionBackBtn').addEventListener('click', () => goTo('MENU'));
  document.getElementById('goBaselineBtn').addEventListener('click', () => goTo('BASELINE_RECORDING'));
  document.getElementById('baselineBackBtn').addEventListener('click', () => goTo('MENU'));

  // How long to wait for the board to actually respond before giving up —
  // this is a "something's wrong" timeout, separate from normal completion.
  const RESPONSE_TIMEOUT_MS = 8000;

  let calibTimeoutId = null;
  let testTimeoutId = null;
  let calibProgressTimer = null;

  function finishCalibration(result){
    clearTimeout(calibTimeoutId);
    clearInterval(calibProgressTimer);
    setCalibProgress(1);
    calibrating = false;

    if(result.ok && result.baseline !== null){
      setCalibLiveValue(result.baseline);
      setResultIcon('calibIcon', 'good', false);
      setCalibStatus('Calibrated', 'good', 'Baseline: ' + (Math.round(result.baseline * 100) / 100) + ' Ω — ready for the contact test.');
      setTestUnlocked(true);
    }else{
      setResultIcon('calibIcon', 'bad', false);
      setCalibStatus('Calibration failed', 'warn', 'The board couldn\'t get enough valid readings — check electrode contact and try again.');
    }
  }

  function finishContactTest(result){
    clearTimeout(testTimeoutId);
    testing = false;

    const kind = LEVEL_KIND[result.verdict] || 'muted';
    const label = result.verdict.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());

    setQualityMeter(result.verdict);
    setResultIcon('testIcon', kind, false);
    renderStatPills(result.good, result.poor, result.none, result.avgResistance);
    setVerdict(label, kind, 'Averaged over ' + (result.good + result.poor + result.none) + ' samples.');
  }

  document.getElementById('runCalibrateBtn').addEventListener('click', async () => {
    if(appState !== 'CALIBRATE' || calibrating) return;
    const sent = await sendCommand('CALIBRATE');
    if(!sent) return;

    calibrating = true;
    setCalibStatus('Calibrating…', 'warn', 'Hold your best, firmest contact steady.');
    setResultIcon('calibIcon', 'muted', true);
    appendLog('calibLog', '> CALIBRATE');

    const start = Date.now();
    const expectedDuration = SAMPLE_WINDOW_MS;
    calibProgressTimer = setInterval(() => {
      setCalibProgress((Date.now() - start) / expectedDuration);
    }, 60);

    calibTimeoutId = setTimeout(() => {
      clearInterval(calibProgressTimer);
      setCalibProgress(1);
      calibrating = false;
      setResultIcon('calibIcon', 'bad', false);
      setCalibStatus('No response from board', 'warn', 'Didn\'t hear back from the board — check the connection and try again.');
    }, RESPONSE_TIMEOUT_MS);
  });

  document.getElementById('runTestBtn').addEventListener('click', async () => {
    if(appState !== 'CONTACT_TEST' || testing || !calibrationDone) return;
    const sent = await sendCommand('TEST');
    if(!sent) return;

    testing = true;
    setVerdict('Sampling…', 'warn', '');
    setResultIcon('testIcon', 'muted', true);
    setQualityMeter(null);
    document.getElementById('statPills').innerHTML = '';
    appendLog('testLog', '> TEST');

    testTimeoutId = setTimeout(() => {
      testing = false;
      setResultIcon('testIcon', 'bad', false);
      setVerdict('No response from board', 'warn', 'Didn\'t hear back from the board — check the connection and try again.');
    }, RESPONSE_TIMEOUT_MS);
  });

  // keyboard parity with the sketch: Esc = back, Space = run
  document.addEventListener('keydown', (e) => {
    const panelInView = document.getElementById('page-test-menu').classList.contains('page-active');
    if(!panelInView) return;

    if(e.key === 'Escape'){
      if(appState === 'MENU') goTo('HOME');
      else if(appState === 'CALIBRATE' || appState === 'CONTACT_TEST' || appState === 'REACTION_TIME' || appState === 'BASELINE_RECORDING') goTo('MENU');
    } else if(e.code === 'Space'){
      if(appState === 'CALIBRATE' || appState === 'CONTACT_TEST'){
        e.preventDefault();
        if(appState === 'CALIBRATE') document.getElementById('runCalibrateBtn').click();
        else document.getElementById('runTestBtn').click();
      }
    }
  });

  // ---------------- data page: sample/simulated chart (pure SVG, no external libs) ----------------

  function clamp(v){ return Math.max(0, Math.min(100, v)); }
  function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; }

  function appendDataLogRow(n, contact, signal, simulated){
    const el = document.getElementById('dataLog');
    const row = document.createElement('div');
    row.className = 'log-row';
    const tag = simulated ? '[simulated]' : '[sample]';
    row.textContent = `Session ${n}  ${tag}  contact ${contact}  signal ${signal}`;
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
  }

  function xFor(i){ return CHART.padLeft + i * CHART.pointGap; }
  function yFor(v){ return CHART.padTop + (100 - v) / 100 * (CHART.height - CHART.padTop - CHART.padBottom); }

  // Renders the chart showing the first `revealCount` points fully, blended toward
  // the next point by `frac` (0..1) — this one function drives both the initial
  // left-to-right draw-in and each new-point extension, just with different ranges.
  function renderChart(revealCount, frac){
    const svg = document.getElementById('dataChartSvg');
    const n = contactSeries.length;
    if(n === 0){ svg.innerHTML = ''; return; }

    const width = CHART.padLeft + (n - 1) * CHART.pointGap + CHART.padRight;
    svg.setAttribute('viewBox', `0 0 ${Math.max(width, 260)} ${CHART.height}`);
    svg.setAttribute('width', Math.max(width, 260));
    svg.setAttribute('height', CHART.height);

    const shownFull = Math.min(revealCount, n - 1);
    const hasPartial = frac > 0 && shownFull < n - 1;

    function seriesPoints(series){
      const pts = [];
      for(let i = 0; i <= shownFull; i++) pts.push([xFor(i), yFor(series[i])]);
      if(hasPartial){
        const a = series[shownFull], b = series[shownFull + 1];
        const v = a + (b - a) * frac;
        pts.push([xFor(shownFull + frac), yFor(v)]);
      }
      return pts;
    }

    function pathD(pts){
      return pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    }

    function gridAndAxes(){
      let s = '';
      [0, 25, 50, 75, 100].forEach(v => {
        const y = yFor(v);
        s += `<line x1="${CHART.padLeft}" y1="${y}" x2="${width - CHART.padRight}" y2="${y}" stroke="#e3e9e6" stroke-width="1"/>`;
        s += `<text x="${CHART.padLeft - 10}" y="${y + 3}" text-anchor="end" font-family="IBM Plex Mono" font-size="10" fill="#8fa39d">${v}</text>`;
      });
      for(let i = 0; i < n; i++){
        s += `<text x="${xFor(i)}" y="${CHART.height - 10}" text-anchor="middle" font-family="IBM Plex Mono" font-size="10" fill="#8fa39d">S${i + 1}</text>`;
      }
      return s;
    }

    function circles(pts, color, upToFull){
      let s = '';
      for(let i = 0; i <= upToFull; i++){
        s += `<circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="3.4" fill="${color}"/>`;
      }
      return s;
    }

    const contactPts = seriesPoints(contactSeries);
    const signalPts = seriesPoints(signalSeries);

    svg.innerHTML =
      gridAndAxes() +
      `<path d="${pathD(contactPts)}" fill="none" stroke="var(--good)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${pathD(signalPts)}" fill="none" stroke="var(--warn)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
      circles(contactPts, 'var(--good)', shownFull) +
      circles(signalPts, 'var(--warn)', shownFull);
  }

  // Animates the reveal from `fromCount` points to `toCount` points, sweeping
  // smoothly across every segment in between.
  function animateReveal(fromCount, toCount, duration){
    if(animFrame) cancelAnimationFrame(animFrame);
    const start = performance.now();
    const span = toCount - fromCount;
    function frame(now){
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(t);
      const current = fromCount + span * eased;
      renderChart(Math.floor(current), current - Math.floor(current));
      if(t < 1){
        animFrame = requestAnimationFrame(frame);
      } else {
        renderChart(toCount, 0);
        const scroller = document.getElementById('chartScroll');
        scroller.scrollLeft = scroller.scrollWidth;
      }
    }
    animFrame = requestAnimationFrame(frame);
  }

  function loadSampleData(){
    document.getElementById('dataLog').innerHTML = '';
    sessionNum = 0;
    contactSeries = [];
    signalSeries = [];
    SAMPLE_SESSIONS.forEach(s => {
      sessionNum += 1;
      contactSeries.push(s.contact);
      signalSeries.push(s.signal);
      appendDataLogRow(sessionNum, s.contact, s.signal, false);
    });
  }

  function initDataChart(){
    loadSampleData();
    renderChart(0, 0);
    animateReveal(0, contactSeries.length - 1, 900);
  }

  document.getElementById('addSessionBtn').addEventListener('click', () => {
    if(contactSeries.length === 0) return;
    const prevCount = contactSeries.length - 1;
    sessionNum += 1;
    const lastContact = contactSeries[contactSeries.length - 1];
    const lastSignal = signalSeries[signalSeries.length - 1];
    // simulate a mostly-improving trend with some natural noise
    const newContact = clamp(Math.round(lastContact + (Math.random() * 8 - 2)));
    const newSignal = clamp(Math.round(lastSignal + (Math.random() * 7 - 1)));
    contactSeries.push(newContact);
    signalSeries.push(newSignal);
    appendDataLogRow(sessionNum, newContact, newSignal, true);
    animateReveal(prevCount, contactSeries.length - 1, 550);
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => {
    loadSampleData();
    renderChart(0, 0);
    animateReveal(0, contactSeries.length - 1, 900);
  });

})();

// ---------------- remember a manually-chosen desktop/mobile version ----------------
function setNeurovaVersion(v){
  try{ localStorage.setItem('neurovaSiteVersion', v); }catch(e){ /* storage unavailable, link still navigates */ }
}
