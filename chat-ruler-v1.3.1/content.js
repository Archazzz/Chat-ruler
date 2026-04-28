(function() {
  'use strict';

  const VER = '1.3.1';
  const STORAGE_KEY = 'ai-chat-navigator-settings';
  const ANCHOR_PREFIX = 'ai-nav-anchor-';
  const SIDEBAR_ID = 'ai-chat-navigator-sidebar';
  const MINI_BAR_ID = 'ai-chat-navigator-mini';

  const DEFAULT_SETTINGS = {
    mode: 'expanded', width: 280, collapsedRounds: {}, autoUpdate: true,
  };

  // ==================== Platform Detectors ====================
  // Each detector returns [{element, role, text}] sorted by DOM order.
  const DETECTORS = {
    // -------- Doubao --------
    // DOM structure (from user):
    //   <div data-message-id="..." class="flex-row flex w-full justify-end">   ← user
    //   <div data-message-id="..." class="relative flex-row flex w-full">      ← assistant
    // Key insight: every message has data-message-id; user has justify-end.
    doubao() {
      const msgs = [];
      const els = document.querySelectorAll('div[data-message-id]');
      console.info('[AI Nav][Doubao] div[data-message-id] count:', els.length);

      els.forEach(el => {
        const isUser = (el.className || '').includes('justify-end');
        const role = isUser ? 'user' : 'assistant';
        let text = '';
        if (isUser) {
          const bubble = el.querySelector('[class*="send-msg-bubble"]');
          text = bubble ? bubble.textContent : el.textContent;
        } else {
          const md = el.querySelector('.flow-markdown-body, .paragraph-element');
          text = md ? md.textContent : el.textContent;
        }
        const t = (text || '').trim();
        if (t.length > 0) {
          msgs.push({ el, role, text: t });
        }
      });

      console.info('[AI Nav][Doubao] valid messages:', msgs.length);
      msgs.forEach((m, i) => console.info(`  [${i}] ${m.role}: "${m.text.substring(0, 40)}..."`));
      return msgs;
    },

    // -------- Gemini --------
    // DOM structure (from user):
    //   <user-query>       ← one user message container
    //     <p class="query-text-line">...</p>
    //   </user-query>
    //   <model-response>   ← one AI message container
    //     <div class="markdown markdown-main-panel" id="model-response-message-content-...">
    //       <h3>...</h3><p>...</p>
    //     </div>
    //   </model-response>
    gemini() {
      const msgs = [];

      // User messages: each <user-query> is ONE message, not each paragraph inside it
      const userQueries = document.querySelectorAll('user-query');
      console.info('[AI Nav][Gemini] <user-query> count:', userQueries.length);
      userQueries.forEach(el => {
        // Try consolidated text container first, otherwise aggregate all paragraphs
        const textEl = el.querySelector('.query-text') || el;
        const t = (textEl.textContent || '').trim();
        if (t.length > 0) {
          msgs.push({ el, role: 'user', text: t });
        }
      });

      // AI messages: each <model-response> is ONE message
      const modelResponses = document.querySelectorAll('model-response');
      console.info('[AI Nav][Gemini] <model-response> count:', modelResponses.length);
      modelResponses.forEach(el => {
        const md = el.querySelector('.markdown-main-panel');
        const textEl = md || el;
        const t = (textEl.textContent || '').trim();
        if (t.length > 0) {
          msgs.push({ el, role: 'assistant', text: t });
        }
      });

      // Sort by DOM position
      msgs.sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });

      console.info('[AI Nav][Gemini] valid messages:', msgs.length);
      msgs.forEach((m, i) => console.info(`  [${i}] ${m.role}: "${m.text.substring(0, 40)}..."`));
      return msgs;
    },

    // -------- Yuanbao --------
    // DOM structure (from user):
    //   <div class="agent-chat__list__item" data-conv-speaker="human">  ← user
    //     <div class="hyc-content-text">...</div>
    //   </div>
    //   <div class="agent-chat__list__item" data-conv-speaker="ai">     ← assistant
    //     <div class="hyc-common-markdown">...<h3>...</h3>...</div>
    //   </div>
    yuanbao() {
      const msgs = [];
      const items = document.querySelectorAll('.agent-chat__list__item');
      console.info('[AI Nav][Yuanbao] .agent-chat__list__item count:', items.length);

      items.forEach(el => {
        const speaker = el.getAttribute('data-conv-speaker');
        if (speaker === 'human') {
          const textEl = el.querySelector('.hyc-content-text');
          const t = textEl ? (textEl.textContent || '').trim() : (el.textContent || '').trim();
          if (t.length > 0) msgs.push({ el, role: 'user', text: t });
        } else if (speaker === 'ai') {
          const md = el.querySelector('.hyc-common-markdown');
          const t = md ? (md.textContent || '').trim() : (el.textContent || '').trim();
          if (t.length > 0) msgs.push({ el, role: 'assistant', text: t });
        }
      });

      console.info('[AI Nav][Yuanbao] valid messages:', msgs.length);
      msgs.forEach((m, i) => console.info(`  [${i}] ${m.role}: "${m.text.substring(0, 40)}..."`));
      return msgs;
    },

    // -------- DeepSeek --------
    // DOM structure (from user):
    //   <div data-virtual-list-item-key="1">
    //     <div class="d29f3d7d ds-message">   ← user (has .fbb737a4)
    //       <div class="fbb737a4">...</div>
    //     </div>
    //   </div>
    //   <div data-virtual-list-item-key="2">
    //     <div class="ds-message">              ← assistant (has .ds-markdown)
    //       <div class="ds-markdown">...<h3>...</h3>...</div>
    //     </div>
    //   </div>
    deepseek() {
      const msgs = [];
      const containers = document.querySelectorAll('[data-virtual-list-item-key]');
      console.info('[AI Nav][DeepSeek] [data-virtual-list-item-key] count:', containers.length);

      containers.forEach(container => {
        const dsMsg = container.querySelector('.ds-message');
        if (!dsMsg) return;

        // User: contains .fbb737a4 text block
        const userEl = dsMsg.querySelector('.fbb737a4');
        if (userEl) {
          const t = (userEl.textContent || '').trim();
          if (t.length > 0) msgs.push({ el: container, role: 'user', text: t });
          return;
        }

        // Assistant: contains .ds-markdown
        const aiEl = dsMsg.querySelector('.ds-markdown');
        if (aiEl) {
          const t = (aiEl.textContent || '').trim();
          if (t.length > 0) msgs.push({ el: container, role: 'assistant', text: t });
        }
      });

      console.info('[AI Nav][DeepSeek] valid messages:', msgs.length);
      msgs.forEach((m, i) => console.info(`  [${i}] ${m.role}: "${m.text.substring(0, 40)}..."`));
      return msgs;
    },

    // -------- Kimi --------
    // DOM structure (from user):
    //   <div class="chat-content-list">
    //     <div class="chat-content-item chat-content-item-user">   ← user
    //       <div class="user-content">...</div>
    //     </div>
    //     <div class="chat-content-item chat-content-item-assistant"> ← assistant
    //       <div class="markdown">...<strong>小节标题</strong>...</div>
    //     </div>
    //   </div>
    kimi() {
      const msgs = [];

      const userEls = document.querySelectorAll('.chat-content-item.chat-content-item-user');
      console.info('[AI Nav][Kimi] .chat-content-item-user count:', userEls.length);
      userEls.forEach(el => {
        const textEl = el.querySelector('.user-content');
        const t = textEl ? (textEl.textContent || '').trim() : (el.textContent || '').trim();
        if (t.length > 0) msgs.push({ el, role: 'user', text: t });
      });

      const aiEls = document.querySelectorAll('.chat-content-item.chat-content-item-assistant');
      console.info('[AI Nav][Kimi] .chat-content-item-assistant count:', aiEls.length);
      aiEls.forEach(el => {
        const md = el.querySelector('.markdown');
        const t = md ? (md.textContent || '').trim() : (el.textContent || '').trim();
        if (t.length > 0) msgs.push({ el, role: 'assistant', text: t });
      });

      // Sort by DOM position
      msgs.sort((a, b) => {
        const pos = a.el.compareDocumentPosition(b.el);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });

      console.info('[AI Nav][Kimi] valid messages:', msgs.length);
      msgs.forEach((m, i) => console.info(`  [${i}] ${m.role}: "${m.text.substring(0, 40)}..."`));
      return msgs;
    },

    // -------- Sider --------
    // DOM structure:
    //   <div class="message-item-outer" data-id="...">
    //     <div class="message-item large-mode">
    //       <div class="message-inner">
    //         <!-- User message: flex-row-reverse (right-aligned) -->
    //         <div class="flex flex-row-reverse">
    //           <div class="bg-grey-fill2-normal">
    //             <span class="user-input-text">用户消息</span>
    //           </div>
    //         </div>
    //         <!-- AI message: role-icon-box + answer-markdown-box -->
    //         <div class="role-icon-box">...</div>
    //         <div class="role-title">Sider Fusion</div>
    //         <div class="answer-markdown-box">
    //           <div class="markdown-body">AI 回复...</div>
    //         </div>
    //       </div>
    //     </div>
    //   </div>
    sider() {
      const msgs = [];
      const items = document.querySelectorAll('.message-item-outer[data-id]');
      console.info('[AI Nav][Sider] .message-item-outer[data-id] count:', items.length);

      items.forEach(el => {
        // User message: has .flex.flex-row-reverse (right-aligned)
        const userInput = el.querySelector('.user-input-text');
        const isUser = el.querySelector('.flex.flex-row-reverse') !== null;
        // AI message: has .role-icon-box or .answer-markdown-box
        const aiMarkdown = el.querySelector('.markdown-body');
        const isAssistant = el.querySelector('.role-icon-box') !== null || el.querySelector('.answer-markdown-box') !== null;

        if (isUser && userInput) {
          const t = (userInput.textContent || '').trim();
          if (t.length > 0) msgs.push({ el, role: 'user', text: t });
        } else if (isAssistant) {
          const t = aiMarkdown ? (aiMarkdown.textContent || '').trim() : (el.textContent || '').trim();
          if (t.length > 0) msgs.push({ el, role: 'assistant', text: t });
        }
      });

      console.info('[AI Nav][Sider] valid messages:', msgs.length);
      msgs.forEach((m, i) => console.info(`  [${i}] ${m.role}: "${m.text.substring(0, 40)}..."`));
      return msgs;
    },

    // -------- ChatGPT --------
    // DOM structure (from user):
    //   <section data-turn="user" data-testid="conversation-turn-1">
    //     <div data-message-author-role="user" data-message-id="...">
    //       <div class="whitespace-pre-wrap">用户消息</div>
    //     </div>
    //   </section>
    //   <section data-turn="assistant" data-testid="conversation-turn-2">
    //     <div data-message-author-role="assistant" data-message-id="...">
    //       <div class="markdown prose ...">AI 回复...<strong>标题</strong>...</div>
    //     </div>
    //   </section>
    gpt() {
      const msgs = [];
      // Use outer section[data-turn] as the message container for stable anchoring
      const turns = document.querySelectorAll('section[data-turn]');
      console.info('[AI Nav][GPT] section[data-turn] count:', turns.length);

      turns.forEach(turn => {
        const role = turn.getAttribute('data-turn');
        if (role === 'user') {
          const wrap = turn.querySelector('.whitespace-pre-wrap');
          const t = wrap ? (wrap.textContent || '').trim() : (turn.textContent || '').trim();
          if (t.length > 0) msgs.push({ el: turn, role: 'user', text: t });
        } else if (role === 'assistant') {
          const md = turn.querySelector('.markdown');
          const t = md ? (md.textContent || '').trim() : (turn.textContent || '').trim();
          if (t.length > 0) msgs.push({ el: turn, role: 'assistant', text: t });
        }
      });

      console.info('[AI Nav][GPT] valid messages:', msgs.length);
      msgs.forEach((m, i) => console.info(`  [${i}] ${m.role}: "${m.text.substring(0, 40)}..."`));
      return msgs;
    },

    // -------- Generic (fallback) --------
    // These platforms use data-message-author-role attribute.
    generic() {
      const msgs = [];
      const all = document.querySelectorAll('[data-message-author-role]');
      console.info('[AI Nav][Generic] [data-message-author-role] count:', all.length);
      if (all.length === 0) return msgs;

      // Deduplicate: keep outermost elements
      const unique = [];
      all.forEach(el => {
        const isNested = Array.from(all).some(o => o !== el && o.contains(el));
        if (!isNested) unique.push(el);
      });

      unique.forEach(el => {
        const role = el.getAttribute('data-message-author-role');
        if (role !== 'user' && role !== 'assistant') return;
        const t = (el.textContent || '').trim();
        if (t.length > 0) {
          msgs.push({ el, role, text: t });
        }
      });

      console.info('[AI Nav][Generic] valid messages:', msgs.length);
      return msgs;
    }
  };

  // ==================== Utilities ====================
  function getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migrate old 'visible' key to new 'mode' key
        if ('visible' in parsed && !('mode' in parsed)) {
          parsed.mode = parsed.visible ? 'expanded' : 'mini';
          delete parsed.visible;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  }
  function saveSettings(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  function hexToRgb(hex) {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? `${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}` : '79,106,246';
  }
  function truncateText(text, max) {
    if (!text) return '';
    const c = text.replace(/\s+/g, ' ').trim();
    return c.length <= max ? c : c.substring(0, max) + '...';
  }
  function escapeHtml(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }
  function extractHeadings(el, baseIdx) {
    const h = [];
    // Standard headings
    el.querySelectorAll('h1, h2, h3').forEach((e, i) => {
      const t = e.textContent.trim();
      if (t) {
        const hid = ANCHOR_PREFIX + baseIdx + '-h-' + h.length;
        e.setAttribute('data-ai-nav-anchor', hid);
        e.style.scrollMarginTop = '80px';
        h.push({ text: t, el: e, id: hid });
      }
    });
    // Kimi uses <strong> as section titles inside .markdown
    if (h.length === 0 && el.querySelector('.markdown')) {
      el.querySelectorAll('.markdown strong').forEach(e => {
        const t = e.textContent.trim();
        if (t && t.length < 60 && !h.find(x => x.text === t)) {
          const hid = ANCHOR_PREFIX + baseIdx + '-h-' + h.length;
          e.setAttribute('data-ai-nav-anchor', hid);
          e.style.scrollMarginTop = '80px';
          h.push({ text: t, el: e, id: hid });
        }
      });
    }
    return h.slice(0, 8);
  }

  // ==================== Host → Platform mapping ====================
  function detectPlatform() {
    const host = location.hostname;
    if (host === 'doubao.com' || host.endsWith('.doubao.com')) return 'doubao';
    if (host === 'gemini.google.com') return 'gemini';
    if (host === 'chat.deepseek.com') return 'deepseek';
    if (host === 'kimi.moonshot.cn' || host === 'kimi.com' || host.endsWith('.kimi.com')) return 'kimi';
    if (host === 'yuanbao.tencent.com' || host.endsWith('.yuanbao.tencent.com')) return 'yuanbao';
    if (host === 'chatgpt.com' || host === 'chat.openai.com' || host.endsWith('.chatgpt.com')) return 'gpt';
    if (host === 'sider.ai' || host.endsWith('.sider.ai')) return 'sider';
    return null;
  }

  // ==================== Message Discovery Router ====================
  function discoverMessages(platform) {
    console.info('[AI Nav] ====== v' + VER + ' | platform:', platform, '======');

    if (platform === 'doubao') return DETECTORS.doubao();
    if (platform === 'gemini') return DETECTORS.gemini();
    if (platform === 'yuanbao') return DETECTORS.yuanbao();
    if (platform === 'deepseek') return DETECTORS.deepseek();
    if (platform === 'kimi') return DETECTORS.kimi();
    if (platform === 'gpt') return DETECTORS.gpt();
    if (platform === 'sider') return DETECTORS.sider();

    // Fallback → try generic
    const generic = DETECTORS.generic();
    if (generic.length >= 2) return generic;
    return [];
  }

  // ==================== Parser ====================
  function parseConversation(platform) {
    document.querySelectorAll('[data-ai-nav-anchor]').forEach(el => el.removeAttribute('data-ai-nav-anchor'));

    const messages = discoverMessages(platform);
    if (messages.length === 0) return [];

    const turns = [];
    let current = null;
    let turnIdx = 0;

    messages.forEach((msg, msgIdx) => {
      if (msg.role === 'user') {
        if (current) { turns.push(current); turnIdx++; }
        current = {
          id: ANCHOR_PREFIX + turnIdx, index: 0,
          userEl: msg.el, assistantEls: [],
          preview: truncateText(msg.text, 14) || '(空)',
          headings: [],
        };
        msg.el.setAttribute('data-ai-nav-anchor', current.id);
      } else {
        if (!current) {
          current = { id: ANCHOR_PREFIX + turnIdx, index: 0, userEl: null, assistantEls: [], preview: '(开场)', headings: [] };
        }
        current.assistantEls.push(msg.el);
        msg.el.setAttribute('data-ai-nav-anchor', current.id);
        const hd = extractHeadings(msg.el, turnIdx);
        if (hd.length) current.headings.push(...hd);
      }
    });
    if (current) turns.push(current);
    turns.forEach((t, i) => { t.index = i + 1; });

    console.info('[AI Nav] turns:', turns.length);
    turns.forEach(t => console.info(`  #${t.index}: "${t.preview}" (headings:${t.headings.length})`));
    return turns;
  }

  // ==================== Theme Detection ====================
  let currentTheme = 'light';

  function detectPageTheme() {
    // Platform-specific dark mode indicators (priority order)
    const indicators = [
      // DeepSeek, Gemini, etc.
      () => document.querySelector('[data-theme="dark"]') ? 'dark' : null,
      () => document.querySelector('[data-color-mode="dark"]') ? 'dark' : null,
      // Tailwind / common
      () => document.documentElement.classList.contains('dark') ? 'dark' : null,
      () => document.body.classList.contains('dark') ? 'dark' : null,
      () => document.body.getAttribute('theme') === 'dark' ? 'dark' : null,
      () => document.documentElement.getAttribute('theme') === 'dark' ? 'dark' : null,
      // Kimi
      () => document.querySelector('html[theme="dark"]') ? 'dark' : null,
      // Doubao
      () => document.body.getAttribute('data-theme') === 'dark' ? 'dark' : null,
      // Gemini uses body.dark-theme or body.light-theme
      () => document.body.classList.contains('dark-theme') ? 'dark' : null,
      // Yuanbao
      () => document.querySelector('[data-theme="dark"]') ? 'dark' : null,
      // System fallback
      () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : null,
    ];
    for (const fn of indicators) {
      const r = fn();
      if (r) return r;
    }
    return 'light';
  }

  function applyTheme() {
    const theme = detectPageTheme();
    if (theme === currentTheme) return;
    currentTheme = theme;
    if (sidebarEl) sidebarEl.setAttribute('data-ai-nav-theme', theme);
    if (miniBarEl) miniBarEl.setAttribute('data-ai-nav-theme', theme);
    console.info('[AI Nav] theme switched to:', theme);
  }

  function startThemeWatch() {
    const themeObs = new MutationObserver(() => applyTheme());
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'theme', 'data-theme'] });
    themeObs.observe(document.body, { attributes: true, attributeFilter: ['class', 'theme', 'data-theme'] });

    // Re-observe if body is replaced (SPA navigation)
    const bodyObs = new MutationObserver(() => {
      themeObs.disconnect();
      themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'theme', 'data-theme'] });
      if (document.body) themeObs.observe(document.body, { attributes: true, attributeFilter: ['class', 'theme', 'data-theme'] });
      applyTheme();
    });
    bodyObs.observe(document.documentElement, { childList: true, subtree: false });

    // System preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

    // Polling fallback — ensures theme stays in sync even if observers miss
    setInterval(() => {
      const detected = detectPageTheme();
      if (detected !== currentTheme) {
        console.info('[AI Nav] poll detected theme change:', currentTheme, '\u2192', detected);
        applyTheme();
      }
    }, 1500);

    applyTheme();
  }

  // ==================== Sidebar ====================
  let sidebarEl = null, contentEl = null, miniBarEl = null;
  let settings = getSettings();
  let currentTurns = [], activeId = null;

  function getThemeColor() {
    // Unified accent color across all platforms — Apple-style system blue
    return '#2563EB';
  }

  function createUI() {
    if (document.getElementById(SIDEBAR_ID)) return;
    const color = getThemeColor();

    // Sidebar
    sidebarEl = document.createElement('div');
    sidebarEl.id = SIDEBAR_ID;
    sidebarEl.style.width = settings.width + 'px';
    sidebarEl.className = settings.mode === 'expanded' ? '' : 'hidden';
    sidebarEl.setAttribute('data-ai-nav-theme', currentTheme);
    sidebarEl.innerHTML =
      '<div class="ai-nav-header"><span class="ai-nav-title">对话标尺</span><div class="ai-nav-controls">' +
      '<button class="ai-nav-btn" id="ai-nav-refresh" title="刷新 (Alt+Shift+R)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>' +
      '<button class="ai-nav-btn has-text" id="ai-nav-close" title="收起导航 (Alt+Shift+O)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 17l5-5-5-5"/><path d="M6 17l5-5-5-5"/></svg><span>收起</span></button>' +
      '</div></div><div class="ai-nav-body" id="ai-nav-body"></div>' +
      '<div class="ai-nav-footer"><span id="ai-nav-status">v' + VER + '</span></div>' +
      '<div class="ai-nav-resize"></div>';
    document.body.appendChild(sidebarEl);
    contentEl = document.getElementById('ai-nav-body');

    // Mini bar — drawer style
    miniBarEl = document.createElement('div');
    miniBarEl.id = MINI_BAR_ID;
    miniBarEl.className = settings.mode === 'mini' ? '' : 'hidden';
    miniBarEl.setAttribute('data-ai-nav-theme', currentTheme);
    const expandSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 17l-5-5 5-5"/><path d="M18 17l-5-5 5-5"/></svg>';
    miniBarEl.innerHTML =
      '<div class="ai-nav-mini-inner">' +
        '<div class="ai-nav-mini-collapsed">' +
          '<div class="ai-nav-mini-dots"></div>' +
          '<div class="ai-nav-mini-expand-btn" title="展开导航">' + expandSvg + '</div>' +
        '</div>' +
        '<div class="ai-nav-mini-expanded">' +
          '<div class="ai-nav-mini-list"></div>' +
          '<div class="ai-nav-mini-expand-row" title="展开完整导航">' + expandSvg + '<span>展开导航</span></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(miniBarEl);

    const rgb = hexToRgb(color);
    sidebarEl.style.setProperty('--ai-nav-theme', color);
    sidebarEl.style.setProperty('--ai-nav-theme-rgb', rgb);
    miniBarEl.style.setProperty('--ai-nav-theme', color);
    miniBarEl.style.setProperty('--ai-nav-theme-rgb', rgb);

    document.getElementById('ai-nav-close').addEventListener('click', () => setMode('mini'));
    document.getElementById('ai-nav-refresh').addEventListener('click', () => { refresh(); updateStatus('\u5df2\u5237\u65b0'); });

    // Mini bar expand buttons
    miniBarEl.querySelector('.ai-nav-mini-expand-btn').addEventListener('click', (e) => { e.stopPropagation(); setMode('expanded'); });
    miniBarEl.querySelector('.ai-nav-mini-expand-row').addEventListener('click', () => setMode('expanded'));

    // Hover state for mini bar
    miniBarEl.addEventListener('mouseenter', () => miniBarEl.classList.add('hovered'));
    miniBarEl.addEventListener('mouseleave', () => miniBarEl.classList.remove('hovered'));

    // Resize
    const handle = sidebarEl.querySelector('.ai-nav-resize');
    let resizing = false, sx = 0, sw = 0;
    handle.addEventListener('mousedown', e => { resizing = true; sx = e.clientX; sw = parseInt(sidebarEl.style.width||'280',10); document.body.style.cursor='col-resize'; document.body.style.userSelect='none'; });
    document.addEventListener('mousemove', e => { if(!resizing)return; sidebarEl.style.width=Math.max(200,Math.min(500,sw+(sx-e.clientX)))+'px'; settings.width=parseInt(sidebarEl.style.width,10); });
    document.addEventListener('mouseup', () => { if(resizing){resizing=false;document.body.style.cursor='';document.body.style.userSelect='';saveSettings(settings);} });
  }

  function setMode(mode) {
    settings.mode = mode; saveSettings(settings);
    if (!sidebarEl || !miniBarEl) return;
    sidebarEl.classList.toggle('hidden', mode !== 'expanded');
    miniBarEl.classList.toggle('hidden', mode !== 'mini');
  }

  function updateActiveState(id) {
    if (contentEl) {
      contentEl.querySelectorAll('.ai-nav-turn').forEach(t => { t.classList.toggle('active', t.getAttribute('data-turn-id')===id); });
    }
    if (miniBarEl) {
      miniBarEl.querySelectorAll('.ai-nav-mini-item').forEach(item => { item.classList.toggle('active', item.getAttribute('data-turn-id')===id); });
      miniBarEl.querySelectorAll('.ai-nav-mini-dot').forEach(d => { d.classList.toggle('active', d.getAttribute('data-turn-id')===id); });
    }
  }
  function updateStatus(t) {
    const el = document.getElementById('ai-nav-status');
    if (el) { el.textContent = t; setTimeout(()=>{if(el.textContent===t&&currentTurns.length)el.textContent='\u5171 '+currentTurns.length+' \u8f6e';},2000); }
  }

  function render(turns) {
    if (!contentEl) return;
    currentTurns = turns;
    if (!turns.length) {
      contentEl.innerHTML = '<div class="ai-nav-empty"><p>\u6682\u65e0\u5bf9\u8bdd</p><p class="ai-nav-hint">\u53d1\u9001\u6d88\u606f\u540e\u81ea\u52a8\u751f\u6210</p><p class="ai-nav-hint">Alt+Shift+R \u624b\u52a8\u5237\u65b0</p></div>';
      updateStatus('\u7b49\u5f85'); return;
    }
    contentEl.innerHTML = turns.map(t => {
      const collapsed = settings.collapsedRounds[t.id] || false;
      const hasH = t.headings.length > 0;
      const preview = escapeHtml(t.preview || '(\u7a7a)');
      const hh = hasH ? '<div class="ai-nav-headings '+(collapsed?'hidden':'')+'">'+t.headings.map(h=>'<div class="ai-nav-heading" data-heading-id="'+h.id+'"><span class="ai-nav-heading-mark">#</span><span class="ai-nav-heading-text">'+escapeHtml(truncateText(h.text,16))+'</span></div>').join('')+'</div>' : '';
      return '<div class="ai-nav-turn '+(collapsed?'collapsed ':'')+(t.id===activeId?'active':'')+'" data-turn-id="'+t.id+'"><div class="ai-nav-turn-header" data-anchor="'+t.id+'"><span class="ai-nav-turn-index">'+t.index+'</span><span class="ai-nav-turn-preview" title="'+preview+'">'+preview+'</span>'+(hasH?'<span class="ai-nav-toggle '+(collapsed?'collapsed':'')+'"></span>':'')+'</div>'+hh+'</div>';
    }).join('');

    updateStatus('\u5171 '+turns.length+' \u8f6e');

    contentEl.querySelectorAll('.ai-nav-turn-header').forEach(h => {
      h.addEventListener('click', e => {
        const turn = h.closest('.ai-nav-turn');
        const arrow = h.querySelector('.ai-nav-toggle');
        const anchor = h.getAttribute('data-anchor');
        if (arrow && (e.target===arrow||arrow.contains(e.target))) {
          e.stopPropagation();
          turn.classList.toggle('collapsed'); arrow.classList.toggle('collapsed');
          const hd = turn.querySelector('.ai-nav-headings'); if (hd) hd.classList.toggle('hidden');
          settings.collapsedRounds[anchor] = turn.classList.contains('collapsed');
          saveSettings(settings); return;
        }
        navigateTo(anchor);
      });
    });
    contentEl.querySelectorAll('.ai-nav-heading').forEach(h => {
      h.addEventListener('click', e => {
        e.stopPropagation();
        const hid = h.getAttribute('data-heading-id');
        navigateTo(hid);
      });
    });
  }

  function navigateTo(id) {
    let el = document.querySelector('[data-ai-nav-anchor="'+id+'"]');
    if (!el) { console.warn('[AI Nav] anchor not found:', id); return; }

    const isHeadingAnchor = id.includes('-h-');
    const platform = detectPlatform();

    const platformScrollMap = {
      doubao: '.scrollable-Se7zNt, .scroll-view-OEiNXD',
      gemini: 'main.chat-window, .conversation-container, .scrollable-conversation',
      deepseek: '.ds-conversation, [class*="chat"]',
      yuanbao: '.agent-chat__list, .chat-list-container',
      kimi: '.chat-content-list, .chat-main',
      gpt: 'main, .flex-1.overflow-hidden, [class*="overflow-y"]',
      sider: 'main, .chat-container, [class*="scroll"], body',
    };

    let scroller = null;
    if (platform && platformScrollMap[platform]) {
      scroller = document.querySelector(platformScrollMap[platform]);
    }

    try {
      el.scrollIntoView({ block: 'start', behavior: 'instant' });
    } catch (e) {}

    if (scroller) {
      const style = window.getComputedStyle(scroller);
      const isScrollable = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay' || scroller.scrollHeight > scroller.clientHeight;
      if (isScrollable) {
        const elRect = el.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const relativeTop = elRect.top - scrollerRect.top + scroller.scrollTop;
        scroller.scrollTop = Math.max(0, relativeTop - 80);
      }
    }

    if (!scroller) {
      let parent = el.parentElement;
      while (parent && parent !== document.documentElement) {
        const style = window.getComputedStyle(parent);
        const canScroll = (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') && parent.scrollHeight > parent.clientHeight;
        if (canScroll) {
          const elRect = el.getBoundingClientRect();
          const parentRect = parent.getBoundingClientRect();
          parent.scrollTop = Math.max(0, elRect.top - parentRect.top + parent.scrollTop - 80);
          break;
        }
        parent = parent.parentElement;
      }
    }

    const elRect = el.getBoundingClientRect();
    const isInViewport = elRect.top >= 0 && elRect.bottom <= window.innerHeight;
    if (!isInViewport) {
      window.scrollTo({ top: elRect.top + window.scrollY - 80, behavior: 'auto' });
    }

    // Element highlight
    el.classList.add('ai-nav-highlight');
    setTimeout(() => el.classList.remove('ai-nav-highlight'), 1500);

    // Heading click: also highlight parent message block
    if (isHeadingAnchor) {
      const turnId = id.split('-h-')[0];
      const turnEl = document.querySelector('[data-ai-nav-anchor="'+turnId+'"]');
      if (turnEl) {
        turnEl.classList.add('ai-nav-block-highlight');
        setTimeout(() => turnEl.classList.remove('ai-nav-block-highlight'), 2000);
      }
      activeId = turnId;
    } else {
      activeId = id;
    }
    updateActiveState(activeId);
  }

  function renderMini(turns) {
    if (!miniBarEl) return;
    const dotsContainer = miniBarEl.querySelector('.ai-nav-mini-dots');
    const list = miniBarEl.querySelector('.ai-nav-mini-list');
    if (!dotsContainer || !list) return;

    // Collapsed dots list
    dotsContainer.innerHTML = turns.map(t => {
      return '<div class="ai-nav-mini-dot '+(t.id===activeId?'active':'')+'" data-turn-id="'+t.id+'" title="'+escapeHtml(t.preview)+'"><span class="ai-nav-mini-dot-box">'+t.index+'</span></div>';
    }).join('');

    // Expanded items list
    list.innerHTML = turns.map(t => {
      return '<div class="ai-nav-mini-item '+(t.id===activeId?'active':'')+'" data-turn-id="'+t.id+'"><span class="ai-nav-mini-index">'+t.index+'</span><span class="ai-nav-mini-text">'+escapeHtml(truncateText(t.preview, 16))+'</span><span class="ai-nav-mini-dash"></span></div>';
    }).join('');

    // Click handlers for collapsed dots
    dotsContainer.querySelectorAll('.ai-nav-mini-dot').forEach(d => {
      d.addEventListener('click', () => navigateTo(d.getAttribute('data-turn-id')));
    });
    // Click handlers for expanded items
    list.querySelectorAll('.ai-nav-mini-item').forEach(item => {
      item.addEventListener('click', () => navigateTo(item.getAttribute('data-turn-id')));
    });
  }

  // ==================== Observers ====================
  let scrollObs = null, mutObs = null, refreshTimer = null;

  function startScrollWatch() {
    if (scrollObs) scrollObs.disconnect();
    scrollObs = new IntersectionObserver(entries => {
      let best = null, bestRatio = -1;
      entries.forEach(en => { if (en.isIntersecting && en.intersectionRatio > bestRatio) { best = en; bestRatio = en.intersectionRatio; } });
      if (best) {
        let id = best.target.getAttribute('data-ai-nav-anchor');
        if (id) {
          // Extract turn id from heading anchor (ai-nav-anchor-0-h-0 -> ai-nav-anchor-0)
          if (id.includes('-h-')) id = id.split('-h-')[0];
          if (id !== activeId) {
            activeId = id;
            updateActiveState(id);
          }
        }
      }
    }, { root: null, rootMargin: '-10% 0px -70% 0px', threshold: 0 });
    document.querySelectorAll('[data-ai-nav-anchor]').forEach(el => scrollObs.observe(el));
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => { refresh(); updateStatus('\u5df2\u66f4\u65b0'); }, 300);
  }

  function startMutationWatch() {
    if (mutObs) mutObs.disconnect();
    mutObs = new MutationObserver(mutations => {
      let hasNew = false;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const node of m.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.querySelector && (
              node.querySelector('div[data-message-id]') ||
              node.querySelector('user-query') ||
              node.querySelector('model-response') ||
              node.querySelector('[data-conv-speaker]') ||
              node.querySelector('[data-virtual-list-item-key]') ||
              node.querySelector('.chat-content-item') ||
              node.querySelector('section[data-turn]') ||
              node.querySelector('.message-item-outer[data-id]') ||
              node.querySelector('[data-message-author-role]')
            )) hasNew = true;
          }
        } else if (m.type === 'characterData') {
          const parent = m.target.parentElement;
          if (parent && parent.closest) {
            if (parent.closest('div[data-message-id], user-query, model-response, .agent-chat__list__item, [data-virtual-list-item-key], .chat-content-item, section[data-turn], .message-item-outer[data-id], [data-message-author-role]')) {
              hasNew = true;
            }
          }
        }
        if (hasNew) break;
      }
      if (hasNew) scheduleRefresh();
    });
    mutObs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // ==================== Main ====================
  let inited = false;

  function refresh() {
    const platform = detectPlatform();
    if (!platform) return;
    console.info('[AI Nav] ====== refreshing ======');
    const turns = parseConversation(platform);
    render(turns);
    renderMini(turns);
    requestAnimationFrame(() => startScrollWatch());
  }

  function initWithRetry(attempt) {
    attempt = attempt || 0;
    const platform = detectPlatform();
    if (!platform) { console.info('[AI Nav] host not supported:', location.hostname); return; }

    console.info('[AI Nav] init #' + (attempt+1) + '/30 | ' + platform + ' | v' + VER);

    const test = discoverMessages(platform);
    if (test.length < 2 && attempt < 30) {
      console.info('[AI Nav] messages < 2, retry in 1s...');
      setTimeout(() => initWithRetry(attempt + 1), 1000);
      return;
    }
    doInit();
  }

  function doInit() {
    if (inited) { refresh(); return; }
    inited = true;
    console.info('[AI Nav] activated:', detectPlatform(), '| v' + VER);

    createUI();
    refresh();
    startMutationWatch();
    startThemeWatch();

    document.addEventListener('keydown', e => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); setMode(settings.mode === 'expanded' ? 'mini' : 'expanded'); }
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'r') { e.preventDefault(); refresh(); updateStatus('\u5df2\u5237\u65b0'); }
    });

    // Click outside sidebar to collapse
    document.addEventListener('click', e => {
      if (settings.mode !== 'expanded') return;
      const target = e.target;
      if (sidebarEl && sidebarEl.contains(target)) return;
      if (miniBarEl && miniBarEl.contains(target)) return;
      setMode('mini');
    });

    // SPA route change detection (multi-layer)
    const origPush = history.pushState, origReplace = history.replaceState;
    history.pushState = function() { origPush.apply(this, arguments); onRouteChange(); };
    history.replaceState = function() { origReplace.apply(this, arguments); onRouteChange(); };
    window.addEventListener('popstate', onRouteChange);
    window.addEventListener('hashchange', onRouteChange);

    let lastUrl = location.href;
    let lastMsgCount = 0;

    function onRouteChange() {
      console.info('[AI Nav] route changed, re-init...');
      lastUrl = location.href;
      inited = false;
      if (mutObs) { mutObs.disconnect(); mutObs = null; }
      if (scrollObs) { scrollObs.disconnect(); scrollObs = null; }
      setTimeout(() => initWithRetry(0), 1000);
    }

    function checkUrlChange() {
      if (location.href !== lastUrl) {
        console.info('[AI Nav] URL poll detected change:', lastUrl, '→', location.href);
        lastUrl = location.href;
        onRouteChange();
      }
    }

    function checkMsgCountJump() {
      const platform = detectPlatform();
      if (!platform) return;
      const msgs = discoverMessages(platform);
      const cnt = msgs.length;
      if (lastMsgCount > 0 && Math.abs(cnt - lastMsgCount) > 2) {
        console.info('[AI Nav] message count jump detected:', lastMsgCount, '\u2192', cnt, ', refreshing...');
        refresh();
      }
      lastMsgCount = cnt;
    }

    setInterval(checkUrlChange, 800);
    setInterval(checkMsgCountJump, 2000);

    setInterval(() => {
      if (currentTurns.length === 0) { console.info('[AI Nav] periodic: empty, refreshing...'); refresh(); }
    }, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => initWithRetry(0), 600));
  } else {
    setTimeout(() => initWithRetry(0), 600);
  }
})();