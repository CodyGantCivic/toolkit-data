// ==UserScript==
// @name         CP Toolkit - Remote Loader (with OnLoad Scripts Manager)
// @namespace    http://civicplus.com/
// @version      1.4.8
// @description  Loader for CivicPlus admin helpers with a right-center hidden-until-hotspot manager (minimal logging).
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  const TOOL_NAME = '[CP Toolkit Loader]';
  const STORAGE_KEY = 'cptoolkit.enabledScripts.v1';

  // ======= Script registry: add your helpers here =======
  const scriptRegistry = [
    // <-- restored to use uploaded original helper
    { id: 'download_xml_css', name: 'Download XML/CSS', url: '/mnt/data/DownloadXMLCSS.js', pages: ['/admin/designcenter/layouts'] },
    { id: 'advanced_styles', name: 'Advanced Styles Helper', url: 'https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/scripts/on-load/AdvancedStylesHelper.js', pages: ['/designcenter/themes*','/designcenter/widgets*'] },
    { id: 'widget_skin', name: 'Widget Skin Helper', url: 'https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/scripts/on-load/widgetSkinHelper.js', pages: ['/designcenter/themes*'] },
    { id: 'graphic_link_helper', name: 'Graphic Link Helper', url: 'https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/scripts/on-load/GraphicLinkHelper.js', pages: ['/admin/graphiclinks*'] },
    { id: 'xml_major_change_alert', name: 'XML Major Change Alert', url: 'https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/scripts/on-load/XMLMajorChangeAlert.js', pages: ['/admin/designcenter/layouts/modify*'] }
  ];
  // ======================================================

  // Prevent frames
  if (window.top !== window.self) return;

  window.CPToolkit = window.CPToolkit || {};
  window.CPToolkit._managerInstalled = window.CPToolkit._managerInstalled || true;

  // --- pageMatches helper (improved: exact-match when no * present) ---
  function pageMatches(patterns) {
    try {
      const pathname = (window.location.pathname || '').toLowerCase();
      return patterns.some(function (p) {
        const pat = String(p || '').toLowerCase();
        if (!pat) return false;
        if (pat.indexOf('*') >= 0) {
          const re = new RegExp('^' + pat.replace(/\*/g, '.*') + '$');
          return re.test(pathname);
        }
        if (pathname === pat) return true;
        if (pathname === (pat + '/')) return true;
        if (pat.endsWith('/') && pathname === pat.slice(0, -1)) return true;
        return false;
      });
    } catch (e) {
      return false;
    }
  }

  // --- storage helpers ---
  function readEnabledMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  function writeEnabledMap(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
      return true;
    } catch (e) {
      console.error(TOOL_NAME + ' failed saving settings', e);
      return false;
    }
  }
  function effectiveEnabledMap() {
    const stored = readEnabledMap();
    if (!stored) {
      const allOn = {};
      scriptRegistry.forEach(s => allOn[s.id] = true);
      return allOn;
    }
    scriptRegistry.forEach(s => { if (stored[s.id] === undefined) stored[s.id] = true; });
    return stored;
  }

  // Manager UI (re-used from prior)
  function createManagerUI() {
    if (document.getElementById('cptoolkit-manager-root')) return;
    const root = document.createElement('div');
    root.id = 'cptoolkit-manager-root';
    root.innerHTML = `
      <style>
        #cptoolkit-fab { position: fixed; right: -44px; top: 50%; transform: translateY(-50%); width: 44px; height: 120px; border-radius: 8px 0 0 8px; background: linear-gradient(180deg,#0b5fff,#0846d1); color: white; display:flex; align-items:center; justify-content:center; cursor:pointer; z-index: 2147483000; box-shadow: 0 6px 18px rgba(11,95,255,0.25); user-select: none; transition: right 240ms cubic-bezier(.2,.9,.2,1), opacity 160ms; opacity: 0.95; }
        #cptoolkit-fab .tab { position: absolute; left: -18px; width: 18px; height: 44px; top: calc(50% - 22px); border-radius: 6px 0 0 6px; background: rgba(255,255,255,0.08); }
        #cptoolkit-fab .label { writing-mode: vertical-rl; transform: rotate(180deg); font-weight:700; letter-spacing:0.6px; font-size:12px; }
        #cptoolkit-modal { display: none; position: fixed; right: 20px; bottom: 80px; width: 420px; max-height: 70vh; overflow: auto; background: #fff; border-radius: 10px; box-shadow: 0 12px 30px rgba(4,12,20,0.3); z-index: 2147483001; padding: 12px; font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; }
        #cptoolkit-modal h3 { margin:0 0 8px 0; font-size:14px;}
        .cptoolkit-entry { display:flex; align-items:center; justify-content:space-between; padding:8px 6px; border-bottom: 1px solid #eef2ff;}
        .cptoolkit-entry .left { display:flex; gap:8px; align-items:center; }
        .cptoolkit-entry .meta { font-size:12px; color:#444; }
        .cptoolkit-controls { display:flex; gap:6px; margin-top:8px; }
        .cptoolkit-btn { padding:6px 10px; border-radius:6px; cursor:pointer; background:#f3f4f6; border:1px solid #e5e7eb; font-size:13px; }
        .cptoolkit-btn.primary { background:#0b5fff; color:#fff; border-color:transparent; }
        .cptoolkit-link { font-size:12px; color:#0b5fff; text-decoration: none; margin-left:6px; }
      </style>

      <div id="cptoolkit-fab" title="CP Toolkit" tabindex="0" role="button" aria-label="Open CP Toolkit">
        <div class="tab" aria-hidden="true"></div>
        <div class="label">CP</div>
      </div>

      <div id="cptoolkit-modal" role="dialog" aria-label="On-load scripts manager">
        <h3>On-load Scripts Manager</h3>
        <div id="cptoolkit-list"></div>
        <div class="cptoolkit-controls">
          <button id="cptoolkit-enable-all" class="cptoolkit-btn">Enable all</button>
          <button id="cptoolkit-disable-all" class="cptoolkit-btn">Disable all</button>
          <div style="flex:1"></div>
          <button id="cptoolkit-save" class="cptoolkit-btn primary">Save</button>
          <button id="cptoolkit-close" class="cptoolkit-btn">Close</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(root);

    const fab = document.getElementById('cptoolkit-fab');
    const modal = document.getElementById('cptoolkit-modal');
    const list = document.getElementById('cptoolkit-list');
    const btnSave = document.getElementById('cptoolkit-save');
    const btnClose = document.getElementById('cptoolkit-close');
    const btnEnableAll = document.getElementById('cptoolkit-enable-all');
    const btnDisableAll = document.getElementById('cptoolkit-disable-all');

    const map = effectiveEnabledMap();

    function renderList() {
      list.innerHTML = '';
      scriptRegistry.forEach(s => {
        const entry = document.createElement('div');
        entry.className = 'cptoolkit-entry';
        const left = document.createElement('div');
        left.className = 'left';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = 'cptoolkit-cb-' + s.id;
        cb.checked = !!map[s.id];
        cb.addEventListener('change', () => { map[s.id] = cb.checked; });
        const title = document.createElement('div');
        title.innerHTML = `<div><strong>${s.name}</strong></div><div class="meta">${s.pages.join(', ')}</div>`;
        left.appendChild(cb);
        left.appendChild(title);

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '6px';
        const openLink = document.createElement('a');
        openLink.href = s.url;
        openLink.target = '_blank';
        openLink.className = 'cptoolkit-link';
        openLink.textContent = 'Open';
        right.appendChild(openLink);

        entry.appendChild(left);
        entry.appendChild(right);
        list.appendChild(entry);
      });
    }

    renderList();

    // Hotspot logic
    const HOTSPOT_EDGE_PX = 24;
    const HOTSPOT_CENTER_Y_PX = 120;
    let visible = false;
    let hideTimer = null;

    function showFab() { if (visible) return; visible = true; fab.style.right = '8px'; }
    function hideFab() { if (!visible) return; visible = false; fab.style.right = '-44px'; }

    function onMouseMove(e) {
      try {
        const cx = window.innerWidth;
        const cy = window.innerHeight / 2;
        const dx = cx - e.clientX;
        const dy = Math.abs(e.clientY - cy);
        const inEdge = dx <= HOTSPOT_EDGE_PX;
        const inCenterBand = dy <= HOTSPOT_CENTER_Y_PX;
        if (inEdge && inCenterBand) { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } showFab(); return; }
        const rect = fab.getBoundingClientRect();
        const overFab = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (overFab) { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } showFab(); return; }
        if (visible && !hideTimer) { hideTimer = setTimeout(() => { hideFab(); hideTimer = null; }, 700); }
      } catch (err) { console.error(TOOL_NAME + ' manager hotspot error', err); }
    }

    function onFabMouseEnter() { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } showFab(); }
    function onFabMouseLeave() { if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { hideFab(); hideTimer = null; }, 500); }
    function onModalMouseEnter() { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } showFab(); }
    function onModalMouseLeave() { if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { hideFab(); hideTimer = null; }, 500); }

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    fab.addEventListener('mouseenter', onFabMouseEnter);
    fab.addEventListener('mouseleave', onFabMouseLeave);
    modal.addEventListener('mouseenter', onModalMouseEnter);
    modal.addEventListener('mouseleave', onModalMouseLeave);

    fab.addEventListener('click', () => {
      const isOpen = modal.style.display === 'block';
      modal.style.display = isOpen ? 'none' : 'block';
      if (!isOpen) showFab();
    });

    btnClose.addEventListener('click', () => modal.style.display = 'none');
    btnEnableAll.addEventListener('click', () => { scriptRegistry.forEach(s => map[s.id] = true); renderList(); });
    btnDisableAll.addEventListener('click', () => { scriptRegistry.forEach(s => map[s.id] = false); renderList(); });
    btnSave.addEventListener('click', () => { writeEnabledMap(map); const old = btnSave.textContent; btnSave.textContent = 'Saved'; setTimeout(()=>btnSave.textContent = old,900); });

    fab.addEventListener('focus', () => { showFab(); });
    fab.addEventListener('blur', () => { hideTimer = setTimeout(hideFab, 700); });

    hideFab();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createManagerUI);
  } else {
    setTimeout(createManagerUI, 0);
  }

  // --- CivicPlus detection with minimal logging ---
  async function isCivicPlusSite() {
    try {
      const testUrl = `${window.location.origin}/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html`;
      const res = await fetch(testUrl, { method: 'HEAD', cache: 'no-store' }).catch(()=>null);
      if (res && (res.ok || res.type === 'opaque')) {
        console.log('CivicPlus detected');
        return true;
      }
      if (res && res.status === 405) {
        const r2 = await fetch(testUrl, { method: 'GET', cache: 'no-store' }).catch(()=>null);
        if (r2 && (r2.ok || r2.type === 'opaque')) {
          console.log('CivicPlus detected');
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error(TOOL_NAME + ' detection error', e);
      return false;
    }
  }

  // --- Fetch + inject script if enabled and page matches ---
  async function fetchAndInjectIfEnabled(scriptEntry, enabledMap) {
    try {
      if (!enabledMap[scriptEntry.id]) return false;
      if (Array.isArray(scriptEntry.pages) && scriptEntry.pages.length) {
        if (!pageMatches(scriptEntry.pages)) return false;
      }
      if (window.CPToolkit.injectedScripts && window.CPToolkit.injectedScripts[scriptEntry.id]) return true;

      // Minimal activation log
      console.log('Activating ' + scriptEntry.name);

      const r = await fetch(scriptEntry.url, { cache: 'no-store' });
      if (!r.ok) throw new Error('fetch failed ' + r.status);
      const txt = await r.text();
      if (!txt) throw new Error('empty script');

      const el = document.createElement('script');
      el.type = 'text/javascript';
      el.setAttribute('data-cp-script-id', scriptEntry.id);
      el.textContent = txt + `\n//# sourceURL=${scriptEntry.url}\n`;
      (document.head || document.documentElement).appendChild(el);

      window.CPToolkit.injectedScripts = window.CPToolkit.injectedScripts || {};
      window.CPToolkit.injectedScripts[scriptEntry.id] = true;
      return true;
    } catch (err) {
      console.error(TOOL_NAME + ' inject error for ' + scriptEntry.name, err);
      return false;
    }
  }

  // wait-for-global util
  function waitForGlobal(name, timeout = 3000, interval = 100) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function check() {
        const parts = name.split('.');
        let cur = window;
        for (const p of parts) {
          if (!cur) break;
          cur = cur[p];
        }
        if (cur) return resolve(cur);
        if (Date.now() - start > timeout) return resolve(null);
        setTimeout(check, interval);
      })();
    });
  }

  // --- Main loader flow ---
  (async function mainLoaderFlow() {
    try {
      const isCP = await isCivicPlusSite();
      if (!isCP) return;

      const enabledMap = effectiveEnabledMap();

      for (const s of scriptRegistry) {
        await fetchAndInjectIfEnabled(s, enabledMap);

        // special-case: call known export names for the download helper
        if (s.id === 'download_xml_css') {
          const insertFn = await waitForGlobal('insertDownloadButtons', 2000);
          const aliasFn = await waitForGlobal('downloadxmlcss', 2000);
          try {
            if (typeof insertFn === 'function') insertFn();
            else if (typeof aliasFn === 'function') aliasFn();
          } catch (e) {
            console.error(TOOL_NAME + ' error calling DownloadXMLCSS init', e);
          }
          continue;
        }

        const possibleGlobals = [
          s.id,
          s.name.replace(/\s+/g, '_'),
          s.name.replace(/\s+/g, '')
        ];
        for (const g of possibleGlobals) {
          const resolved = await waitForGlobal(g, 2000).catch(()=>null);
          if (resolved) {
            try {
              if (typeof resolved.init === 'function') {
                resolved.init();
              } else if (typeof resolved === 'function') {
                resolved();
              }
            } catch (e) {
              console.error(TOOL_NAME + ' error calling init for ' + s.name, e);
            }
            break;
          }
        }
      }
    } catch (e) {
      console.error(TOOL_NAME + ' main loader error', e);
    }
  })();

  // SPA watcher
  (function setupSpaWatcher() {
    let rerunTimer = null;
    function notify() {
      if (rerunTimer) clearTimeout(rerunTimer);
      rerunTimer = setTimeout(() => {
        (async () => {
          try {
            const isCP = await isCivicPlusSite();
            if (!isCP) return;
            const enabledMap = effectiveEnabledMap();
            for (const s of scriptRegistry) {
              await fetchAndInjectIfEnabled(s, enabledMap);
            }
          } catch (e) {
            console.error(TOOL_NAME + ' spa notify error', e);
          }
        })();
      }, 200);
    }
    const op = history.pushState;
    const or = history.replaceState;
    history.pushState = function () { const res = op.apply(this, arguments); notify(); return res; };
    history.replaceState = function () { const res = or.apply(this, arguments); notify(); return res; };
    window.addEventListener('popstate', notify);
  })();

})();
