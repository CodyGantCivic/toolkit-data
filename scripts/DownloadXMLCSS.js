// ==UserScript==
// @name         CP Toolkit - Remote DownloadXMLCSS Loader (local/GitHub)
// @namespace    http://civicplus.com/
// @version      2.2.0
// @description  Ctrl+RightClick -> fetch DownloadXMLCSS.js (local path or GitHub raw), inject into page, export & call APIs.
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';
  const TOOLKIT = '[CP Toolkit Loader]';

  // <<-- Use uploaded local path (your toolchain will transform it). Replace with GitHub RAW if you prefer. -->> 
  const DOWNLOAD_XML_CSS_URL = 'https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/scripts/DownloadXMLCSS.js';
  // If you want direct GitHub fetching, replace the line above with:
  // 'https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/scripts/DownloadXMLCSS.js'

  function fetchRemoteText(url) {
    return new Promise((resolve, reject) => {
      try {
        GM_xmlhttpRequest({
          method: 'GET',
          url: url + (url.includes('?') ? '&' : '?') + 't=' + Date.now(),
          responseType: 'text',
          onload(res) {
            if (res.status >= 200 && res.status < 300 && res.responseText) resolve(res.responseText);
            else reject(new Error('HTTP ' + res.status));
          },
          onerror(err) { reject(err); },
          ontimeout() { reject(new Error('timeout')); }
        });
      } catch (err) { reject(err); }
    });
  }

  // Inject into page context
  function injectToPage(text) {
    const s = document.createElement('script');
    s.type = 'text/javascript';
    s.textContent = text;
    (document.documentElement || document.head || document.body).appendChild(s);
    s.parentNode && s.parentNode.removeChild(s);
  }

  function waitForNames(names, timeoutMs = 3500, intervalMs = 80) {
    const start = Date.now();
    return new Promise((resolve) => {
      (function tick() {
        for (const name of names) {
          try {
            const parts = name.split('.');
            let ctx = window;
            for (const p of parts) ctx = ctx?.[p];
            if (typeof ctx === 'function') return resolve({ found: true, name });
          } catch (e) {}
        }
        if (Date.now() - start >= timeoutMs) return resolve({ found: false });
        setTimeout(tick, intervalMs);
      })();
    });
  }

  async function runLoader() {
    console.log(TOOLKIT, 'Trigger received…');

    // quick CivicPlus detector
    async function isCivicPlusSite() {
      return new Promise((resolve) => {
        try {
          const xhr = new XMLHttpRequest();
          xhr.open('HEAD', '/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html', true);
          xhr.timeout = 4000;
          xhr.onload = () => resolve(xhr.status === 200);
          xhr.onerror = () => resolve(false);
          xhr.ontimeout = () => resolve(false);
          xhr.send();
        } catch (e) { resolve(false); }
      });
    }

    const isCP = await isCivicPlusSite();
    if (!isCP) {
      console.warn(TOOLKIT, 'Not a CivicPlus site — cancelling loader.');
      return;
    }
    console.log(TOOLKIT, 'CivicPlus detected — fetching remote script...');

    try {
      const text = await fetchRemoteText(DOWNLOAD_XML_CSS_URL);
      // Try to inject raw text first (the GitHub library already exports the APIs),
      // but also append a small safe exporter if the functions exist but were not exported.
      let finalText = text;

      // Basic heuristic: look for typical function names
      const candidates = [];
      const funcDecl = /function\s+([A-Za-z0-9_\$]+)\s*\(/g;
      let m; while ((m = funcDecl.exec(text))) candidates.push(m[1]);
      const assignPat = /(?:var|let|const)?\s*([A-Za-z0-9_\$]+)\s*=\s*(?:function|\([^)]*\)\s*=>)/g;
      while ((m = assignPat.exec(text))) candidates.push(m[1]);

      // If canonical names present but not attached to window, append exporter
      const known = ['downloadxmlcss','downloadXmlCss','downloadXMLCSS','insertDownloadButtons','insertLayoutButtons'];
      const toAttach = [];
      known.forEach(k => {
        if (new RegExp('\\b' + k + '\\b\\s*\\(', 'i').test(text) || new RegExp('\\b' + k + '\\b\\s*=','i').test(text)) toAttach.push(k);
      });
      // Also include discovered candidates
      candidates.forEach(c => { if (!toAttach.includes(c)) toAttach.push(c); });

      if (toAttach.length) {
        const exporter = toAttach.map(n => `try{ if(typeof ${n} === 'function'){ window.${n} = window.${n} || ${n}; window.CPToolkit = window.CPToolkit || {}; window.CPToolkit.${n} = window.CPToolkit.${n} || ${n}; } }catch(e){}`).join('\n');
        finalText = text + '\n/* AUTO-EXPORTER */\n' + exporter + '\n/* END AUTO-EXPORTER */\n';
        console.log(TOOLKIT, 'Appended auto-exporter for', toAttach);
      }

      injectToPage(finalText);
      console.log(TOOLKIT, 'Injected remote script into page.');

      // Wait for insertDownloadButtons
      const insertRes = await waitForNames(['CPToolkit.insertDownloadButtons','insertDownloadButtons','insertLayoutButtons'], 3500);
      if (insertRes.found) {
        console.log(TOOLKIT, 'Calling', insertRes.name);
        const parts = insertRes.name.split('.');
        let fn = window;
        for (const p of parts) fn = fn && fn[p];
        try { fn(); } catch (err) { console.warn(TOOLKIT, 'insert call threw', err); }
      } else {
        console.warn(TOOLKIT, 'No insertDownloadButtons() found.');
      }

      // Wait for main download function
      const dlRes = await waitForNames(['downloadxmlcss','CPToolkit.downloadxmlcss','downloadXmlCss'], 3500);
      if (dlRes.found) {
        console.log(TOOLKIT, 'Calling', dlRes.name);
        const parts = dlRes.name.split('.');
        let fn = window;
        for (const p of parts) fn = fn && fn[p];
        try {
          const rv = fn({ autoConfirm: false });
          if (rv && typeof rv.then === 'function') rv.catch && rv.catch(err => console.warn(TOOLKIT, 'download call rejected', err));
        } catch (err) { console.warn(TOOLKIT, 'download fn threw', err); }
      } else {
        console.warn(TOOLKIT, 'No downloadxmlcss() found.');
      }

    } catch (err) {
      console.error(TOOLKIT, 'Failed to load remote script', err);
    }
  }

  document.addEventListener('contextmenu', function (e) {
    if (e.ctrlKey) { e.preventDefault(); runLoader(); }
  }, true);

  try { if (typeof GM_registerMenuCommand === 'function') GM_registerMenuCommand('Load DownloadXMLCSS Now', runLoader); } catch (e) {}

  console.log(TOOLKIT, 'Loader ready (Ctrl+RightClick).');
})();
