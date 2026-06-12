(function () {
  'use strict';

  const WIDGET_URL  = 'https://ai-oral-frontend.vercel.app/';
  const ACCENT      = '#6366f1';
  const ACCENT_DARK = '#4f46e5';
  const FONT_URL    = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap';

  /* ── Inject Google Font ─────────────── */
  if (!document.querySelector('[data-pgp-font]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_URL;
    link.setAttribute('data-pgp-font', '1');
    document.head.appendChild(link);
  }

  /* ── Styles ─────────────────────────── */
  const CSS = `
    #pgp-widget-root * { box-sizing: border-box; margin: 0; padding: 0; }

    /* Floating button */
    #pgp-fab {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 2147483640;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background: linear-gradient(135deg, ${ACCENT_DARK}, #818cf8);
      box-shadow: 0 6px 28px rgba(79,70,229,0.55), 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.25s cubic-bezier(.23,1,.32,1), box-shadow 0.25s;
      outline: none;
    }
    #pgp-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 10px 36px rgba(79,70,229,0.7), 0 0 0 8px rgba(99,102,241,0.1);
    }
    #pgp-fab:active { transform: scale(0.94); }

    #pgp-fab svg { transition: transform 0.3s, opacity 0.3s; }
    #pgp-fab.open #pgp-icon-mic  { transform: scale(0) rotate(90deg); opacity: 0; position: absolute; }
    #pgp-fab.open #pgp-icon-close { transform: scale(1) rotate(0deg); opacity: 1; }
    #pgp-fab:not(.open) #pgp-icon-close { transform: scale(0) rotate(-90deg); opacity: 0; position: absolute; }
    #pgp-fab:not(.open) #pgp-icon-mic  { transform: scale(1); opacity: 1; }

    /* Notification badge */
    #pgp-badge {
      position: absolute;
      top: 0; right: 0;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #10b981;
      border: 2.5px solid #fff;
      animation: pgpBadgePulse 2.5s ease-in-out infinite;
      display: flex; align-items: center; justify-content: center;
    }
    #pgp-badge.hidden { display: none; }
    @keyframes pgpBadgePulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
      50%     { box-shadow: 0 0 0 5px rgba(16,185,129,0); }
    }

    /* Tooltip */
    #pgp-tooltip {
      position: fixed;
      bottom: 104px;
      right: 28px;
      z-index: 2147483639;
      background: rgba(12,14,28,0.96);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      padding: 12px 16px;
      max-width: 220px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      animation: pgpTooltipIn 0.4s cubic-bezier(.23,1,.32,1) both;
      transform-origin: bottom right;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    #pgp-tooltip::after {
      content: '';
      position: absolute;
      bottom: -6px;
      right: 22px;
      width: 10px; height: 10px;
      background: rgba(12,14,28,0.96);
      border-right: 1px solid rgba(255,255,255,0.1);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      transform: rotate(45deg);
    }
    @keyframes pgpTooltipIn {
      from { opacity:0; transform: scale(0.85) translateY(8px); }
      to   { opacity:1; transform: scale(1) translateY(0); }
    }
    #pgp-tooltip-title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(255,255,255,0.92);
      letter-spacing: -0.01em;
      margin-bottom: 3px;
    }
    #pgp-tooltip-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.42);
      line-height: 1.4;
    }
    #pgp-tooltip-close {
      position: absolute;
      top: 8px; right: 8px;
      width: 20px; height: 20px;
      border-radius: 50%;
      border: none;
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.45);
      font-size: 11px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    #pgp-tooltip-close:hover { background: rgba(255,255,255,0.14); }

    /* Popup panel */
    #pgp-panel {
      position: fixed;
      bottom: 104px;
      right: 28px;
      z-index: 2147483641;
      width: min(380px, calc(100vw - 32px));
      height: min(680px, calc(100svh - 120px));
      border-radius: 28px;
      overflow: hidden;
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.08),
        0 32px 80px rgba(0,0,0,0.55),
        0 0 80px rgba(99,102,241,0.1);
      transform-origin: bottom right;
      transition: transform 0.35s cubic-bezier(.23,1,.32,1), opacity 0.3s;
      transform: scale(0.88) translateY(16px);
      opacity: 0;
      pointer-events: none;
    }
    #pgp-panel.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: all;
    }

    /* Panel header bar */
    #pgp-panel-header {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 54px;
      background: rgba(12,14,28,0.97);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 2;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      backdrop-filter: blur(20px);
    }
    #pgp-panel-brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    #pgp-panel-avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${ACCENT_DARK}, #818cf8);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
      box-shadow: 0 0 0 2px rgba(99,102,241,0.3);
      flex-shrink: 0;
    }
    #pgp-panel-title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(255,255,255,0.9);
      letter-spacing: -0.01em;
    }
    #pgp-panel-sub {
      font-size: 10px;
      color: rgba(255,255,255,0.35);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    #pgp-online-dot {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 5px rgba(16,185,129,0.8);
      animation: pgpBadgePulse 2.5s ease-in-out infinite;
    }
    #pgp-panel-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pgp-icon-btn {
      width: 28px; height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.45);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
      font-size: 14px;
    }
    .pgp-icon-btn:hover { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); }

    /* iframe */
    #pgp-iframe {
      position: absolute;
      top: 54px; left: 0; right: 0; bottom: 0;
      width: 100%;
      height: calc(100% - 54px);
      border: none;
      background: #090b17;
    }

    /* Powered-by footer */
    #pgp-footer {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 28px;
      background: rgba(12,14,28,0.97);
      border-top: 1px solid rgba(255,255,255,0.04);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 9.5px;
      color: rgba(255,255,255,0.2);
      letter-spacing: 0.03em;
    }
    #pgp-footer a {
      color: rgba(99,102,241,0.6);
      text-decoration: none;
    }
    #pgp-footer a:hover { color: rgba(130,130,255,0.9); }

    /* Mobile: full screen panel */
    @media (max-width: 480px) {
      #pgp-panel {
        bottom: 0; right: 0;
        width: 100vw;
        height: 100svh;
        border-radius: 0;
        transform-origin: bottom center;
      }
      #pgp-fab { bottom: 20px; right: 20px; }
    }
  `;

  /* ── Mount styles ───────────────────── */
  const style = document.createElement('style');
  style.setAttribute('data-pgp', '1');
  style.textContent = CSS;
  document.head.appendChild(style);

  /* ── Build DOM ──────────────────────── */
  const root = document.createElement('div');
  root.id = 'pgp-widget-root';

  /* Tooltip */
  const tooltip = document.createElement('div');
  tooltip.id = 'pgp-tooltip';
  tooltip.innerHTML = `
    <button id="pgp-tooltip-close" aria-label="Dismiss">✕</button>
    <div id="pgp-tooltip-title">🎓 AI Oral Examiner</div>
    <div id="pgp-tooltip-sub">Practice your GP exam with a real-time AI examiner. Tap to begin.</div>
  `;
  root.appendChild(tooltip);

  /* Panel */
  const panel = document.createElement('div');
  panel.id = 'pgp-panel';
  panel.innerHTML = `
    <div id="pgp-panel-header">
      <div id="pgp-panel-brand">
        <div id="pgp-panel-avatar">GP</div>
        <div>
          <div id="pgp-panel-title">PassGP Examiner</div>
          <div id="pgp-panel-sub"><span id="pgp-online-dot"></span> Online · AI Examiner</div>
        </div>
      </div>
      <div id="pgp-panel-actions">
        <button class="pgp-icon-btn" id="pgp-expand-btn" title="Open full screen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
        <button class="pgp-icon-btn" id="pgp-close-btn" title="Close">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
    <iframe id="pgp-iframe" src="${WIDGET_URL}" title="PassGP AI Oral Examiner" allow="microphone; camera" loading="lazy"></iframe>
    <div id="pgp-footer">
      Powered by <a href="https://passgp.com" target="_blank" rel="noopener">PassGP</a> &nbsp;·&nbsp; AI Oral Examiner
    </div>
  `;
  root.appendChild(panel);

  /* FAB button */
  const fab = document.createElement('button');
  fab.id = 'pgp-fab';
  fab.setAttribute('aria-label', 'Open AI Oral Examiner');
  fab.innerHTML = `
    <div id="pgp-badge"></div>
    <svg id="pgp-icon-mic" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2"/>
      <path d="M12 19v4m-4 0h8"/>
    </svg>
    <svg id="pgp-icon-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  `;
  root.appendChild(fab);

  document.body.appendChild(root);

  /* ── State ──────────────────────────── */
  let isOpen         = false;
  let tooltipVisible = true;

  function openPanel() {
    isOpen = true;
    fab.classList.add('open');
    panel.classList.add('open');
    hideTooltip();
    document.getElementById('pgp-badge').classList.add('hidden');
  }

  function closePanel() {
    isOpen = false;
    fab.classList.remove('open');
    panel.classList.remove('open');
  }

  function hideTooltip() {
    tooltipVisible = false;
    tooltip.style.display = 'none';
  }

  /* ── Events ─────────────────────────── */
  fab.addEventListener('click', () => {
    if (isOpen) closePanel(); else openPanel();
  });

  document.getElementById('pgp-close-btn').addEventListener('click', closePanel);

  document.getElementById('pgp-expand-btn').addEventListener('click', () => {
    window.open(WIDGET_URL, '_blank', 'noopener');
  });

  document.getElementById('pgp-tooltip-close').addEventListener('click', (e) => {
    e.stopPropagation();
    hideTooltip();
  });

  /* Show tooltip after 1.5s, auto-hide after 7s */
  setTimeout(() => {
    if (tooltipVisible) tooltip.style.display = 'block';
    setTimeout(() => hideTooltip(), 7000);
  }, 1500);

  /* Close on outside click */
  document.addEventListener('click', (e) => {
    if (isOpen && !root.contains(e.target)) closePanel();
  });

  /* Escape key */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

})();
