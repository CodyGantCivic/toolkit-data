/**
 * DownloadXMLCSS.js
 *
 * Library-style script intended to be loaded dynamically (injected by a userscript).
 * It preserves the original per-layout UI insertion behavior AND the robust
 * detection + download functionality.
 *
 * Exposes:
 *   - window.downloadxmlcss(options)
 *   - window.CPToolkit.downloadxmlcss(options)
 *
 * Options:
 *   - autoConfirm: boolean (default false) — bypass confirmation when multiple files found
 *   - types: ['css','xml'] — which types to detect/download
 *   - timeoutMs: number — per-file fetch timeout
 */

(function () {
  'use strict';

  // namespace
  window.CPToolkit = window.CPToolkit || {};
  const TOOLKIT_NAME = '[CP Toolkit - Download XML/CSS]';

  /* ----------------- Utilities (download + fetch + detection) ----------------- */

  function downloadTextAsFile(filename, text, mime = 'text/plain;charset=utf-8') {
    return new Promise((resolve) => {
      try {
        const blob = new Blob([text], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve({ ok: true, filename });
      } catch (err) {
        console.error(TOOLKIT_NAME + ' downloadTextAsFile failed', err);
        resolve({ ok: false, filename, err });
      }
    });
  }

  async function fetchText(url, timeoutMs = 10000) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null;
    try {
      if (controller && timeoutMs) timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { signal: controller ? controller.signal : undefined, credentials: 'same-origin' });
      const status = resp.status;
      if (!resp.ok) {
        return { ok: false, url, status, text: null, err: new Error('HTTP ' + status) };
      }
      const text = await resp.text();
      return { ok: true, url, status, text };
    } catch (err) {
      return { ok: false, url, status: null, text: null, err };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function toAbsoluteUrl(href) {
    try {
      return new URL(href, document.baseURI).href;
    } catch (e) {
      return href;
    }
  }

  function filenameFromUrl(url, fallbackPrefix = 'download') {
    try {
      const u = new URL(url);
      const pathname = u.pathname;
      const last = pathname.substring(pathname.lastIndexOf('/') + 1) || '';
      if (last) return decodeURIComponent(last.split('?')[0]) || fallbackPrefix;
      return (u.hostname || 'file') + '-' + Date.now();
    } catch (err) {
      const sanitized = url.replace(/[^a-z0-9\-_\.]/gi, '-').slice(0, 80);
      return sanitized || (fallbackPrefix + '-' + Date.now());
    }
  }

  function injectStyle(css, id = 'cp-toolkit-downloadxmlcss-style') {
    try {
      let s = document.getElementById(id);
      if (!s) {
        s = document.createElement('style');
        s.id = id;
        document.head.appendChild(s);
      }
      s.textContent = css;
    } catch (e) {
      console.warn(TOOLKIT_NAME + ' injectStyle failed', e);
    }
  }

  /* ----------------- Detection logic (existing in your GitHub file) ----------------- */

  function detectCssAndXmlUrls() {
    const cssUrls = new Set();
    const xmlUrls = new Set();

    // 1) <link rel="stylesheet">
    document.querySelectorAll('link[rel~="stylesheet"][href]').forEach((lnk) => {
      const href = lnk.getAttribute('href');
      if (!href) return;
      const abs = toAbsoluteUrl(href);
      if (abs.toLowerCase().endsWith('.css') || /\/assets\//i.test(abs)) cssUrls.add(abs);
    });

    // 2) <a href="*.css|*.xml">
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      const abs = toAbsoluteUrl(href);
      if (abs.toLowerCase().endsWith('.xml')) xmlUrls.add(abs);
      if (abs.toLowerCase().endsWith('.css')) cssUrls.add(abs);
    });

    // 3) data attributes / script tags referencing xml
    document.querySelectorAll('[data-xml-src], [data-src], script[type="application/xml"]').forEach((el) => {
      const src = el.getAttribute('data-xml-src') || el.getAttribute('data-src') || el.getAttribute('src') || el.textContent;
      if (!src) return;
      const abs = toAbsoluteUrl(src.trim());
      if (abs.toLowerCase().endsWith('.xml')) xmlUrls.add(abs);
    });

    // 4) CivicPlus heuristic endpoints (candidates)
    const candidates = [
      '/assets/mystique/shared/components/moduletiles/templates/cp-Module-Tile.html',
      '/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html',
      '/Services/Content/GetXml',
      '/Config/SiteConfig.xml'
    ];
    candidates.forEach(c => {
      const abs = toAbsoluteUrl(c);
      if (/\.xml$/i.test(abs) || /template/i.test(abs) || /Service/i.test(abs)) xmlUrls.add(abs);
    });

    return { css: Array.from(cssUrls), xml: Array.from(xmlUrls) };
  }

  /* ----------------- Core downloader function (exported) ----------------- */

  async function downloadxmlcss(options = {}) {
    const cfg = Object.assign({ urls: null, types: ['css', 'xml'], autoConfirm: false, timeoutMs: 15000 }, options || {});
    console.log(TOOLKIT_NAME + ' starting with options:', cfg);

    let targets = [];
    if (Array.isArray(cfg.urls) && cfg.urls.length > 0) {
      targets = cfg.urls.map(toAbsoluteUrl);
    } else {
      const detected = detectCssAndXmlUrls();
      if (cfg.types.includes('css') && Array.isArray(detected.css)) targets.push(...detected.css);
      if (cfg.types.includes('xml') && Array.isArray(detected.xml)) targets.push(...detected.xml);
      targets = Array.from(new Set(targets));
    }

    if (targets.length === 0) {
      console.warn(TOOLKIT_NAME + ' no candidate URLs found to download.');
      return { results: [], summary: { message: 'no-candidates' } };
    }

    if (!cfg.autoConfirm && targets.length > 1) {
      const ok = confirm(`[DownloadXMLCSS] Found ${targets.length} files to download.\nProceed?`);
      if (!ok) {
        console.log(TOOLKIT_NAME + ' user cancelled downloads.');
        return { results: [], summary: { message: 'user-cancelled' } };
      }
    }

    const results = [];
    for (const t of targets) {
      try {
        console.log(TOOLKIT_NAME + ' fetching', t);
        const r = await fetchText(t, cfg.timeoutMs);
        if (!r.ok) {
          console.warn(TOOLKIT_NAME + ' fetch failed for', t, r.err || r.status);
          results.push({ url: t, ok: false, status: r.status, err: r.err || new Error('fetch-failed') });
          continue;
        }
        const lower = t.toLowerCase();
        let mime = 'text/plain;charset=utf-8';
        if (lower.endsWith('.css')) mime = 'text/css;charset=utf-8';
        else if (lower.endsWith('.xml')) mime = 'application/xml;charset=utf-8';
        else if (lower.endsWith('.html') || lower.endsWith('.htm')) mime = 'text/html;charset=utf-8';
        const filename = filenameFromUrl(t);
        const dl = await downloadTextAsFile(filename, r.text, mime);
        results.push(Object.assign({ url: t, ok: dl.ok !== false, filename }, dl));
      } catch (err) {
        console.error(TOOLKIT_NAME + ' error processing', t, err);
        results.push({ url: t, ok: false, err });
      }
    }

    const okCount = results.filter(x => x.ok).length;
    const failCount = results.length - okCount;
    console.log(TOOLKIT_NAME + ` finished: ${okCount} succeeded, ${failCount} failed`);
    return { results, summary: { total: results.length, succeeded: okCount, failed: failCount } };
  }

  /* ----------------- UI insertion: per-layout buttons and Download All (original behavior) ----------------- */

  // helpers for UI insertion
  function qAll(sel, ctx) {
    if (window.jQuery) return Array.from((ctx ? window.jQuery(ctx) : window.jQuery(document)).find(sel));
    return Array.from((ctx || document).querySelectorAll(sel));
  }

  function makeActionButton(className, labelHtml, onClick) {
    const a = document.createElement('a');
    a.href = '#';
    a.className = `button ${className}`;
    a.innerHTML = labelHtml;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      try { onClick && onClick.call(this, e); } catch (err) { console.warn(TOOLKIT_NAME + ' button handler failed', err); }
    });
    return a;
  }

  async function ensureFontAwesomeFallback() {
    if (typeof window.CPToolkit !== 'undefined' && typeof window.CPToolkit.ensureFontAwesome === 'function') {
      try { await window.CPToolkit.ensureFontAwesome(); return; } catch (e) { /* ignore */ }
    }
    try {
      const already = document.querySelector('.fa, .fas, .far, .fal, .fab') || document.getElementById('cp-toolkit-fontawesome');
      if (!already) {
        const link = document.createElement('link');
        link.id = 'cp-toolkit-fontawesome';
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        document.head.appendChild(link);
      }
    } catch (e) { /* ignore */ }
  }

  function waitForSelector(selector, timeoutMs = 8000, intervalMs = 120) {
    return new Promise((resolve) => {
      const start = Date.now();
      function tick() {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(tick, intervalMs);
      }
      tick();
    });
  }

  // Insert buttons next to layout items (mirrors your original userscript placement/behavior)
  async function insertLayoutButtons() {
    // Only on Layouts page
    const url = window.location.href.toLowerCase();
    if (!url.includes('/admin/designcenter/layouts')) return { ok: false, reason: 'not-layouts' };

    await ensureFontAwesomeFallback();

    // Add styles (approx original)
    injectStyle(`
      .downloadXML, .downloadCSS {
          line-height: 33px;
          font-size: .75rem;
          font-weight: 400 !important;
          position: absolute;
          top: 4px;
          z-index: 10;
      }
      .downloadXML { right: 221px; }
      .downloadCSS { right: 120px; }
      .downloadXML .fa, .downloadCSS .fa { color: #4f8ec0; }
      .listing .item { padding-right: 330px; }
      .listing .item>.status { right: 330px; }
      .listing .item h3 { width: calc(100% - 54px); }
      .cp-download-wrapper { position: relative; }
      @media (max-width: 800px) {
        .downloadXML { right: 160px; }
        .downloadCSS { right: 60px; }
      }
    `);

    await waitForSelector('.listing .item, .item', 8000);
    const itemEls = qAll('.listing .item, .item');
    if (!itemEls || itemEls.length === 0) return { ok: false, reason: 'no-items' };

    const currentSite = window.location.host.replace(/[:\/]/g, '-');

    for (const itemEl of itemEls) {
      try {
        const titleAnchor = itemEl.querySelector && itemEl.querySelector('h3 a');
        const thisLayout = titleAnchor ? (titleAnchor.textContent || titleAnchor.innerText || '').trim() : null;
        if (!thisLayout) continue;
        if (itemEl.querySelector('.downloadXML') || itemEl.querySelector('.downloadCSS')) continue;

        // find insertion container
        let insertionContainer = itemEl.querySelector('.actions, .buttons, .item-actions, .item-buttons');
        if (!insertionContainer) {
          const status = itemEl.querySelector('.status');
          if (status && status.parentNode) insertionContainer = status.parentNode;
        }
        if (!insertionContainer) {
          if (!itemEl.classList.contains('cp-download-wrapper')) itemEl.classList.add('cp-download-wrapper');
          insertionContainer = itemEl;
        }

        // XML button triggers direct download of /App_Themes/<layout>/<layout>.xml
        const xmlBtn = makeActionButton('downloadXML', `<i class="fa fa-download" aria-hidden="true"></i> XML`, function () {
          const downloadUrl = `/App_Themes/${encodeURIComponent(thisLayout)}/${encodeURIComponent(thisLayout)}.xml`;
          const filename = `${currentSite}-${thisLayout}.xml`;
          // call core download pipeline for this single URL
          downloadxmlcss({ urls: [downloadUrl], types: ['xml'], autoConfirm: true, timeoutMs: 15000 })
            .catch(err => console.warn(TOOLKIT_NAME + ' xmlBtn download error', err));
        });

        // CSS button: find "Layout Page" link, fetch it and parse CSS path then download
        const cssBtn = makeActionButton('downloadCSS', `<i class="fa fa-download" aria-hidden="true"></i> CSS`, function () {
          // find Layout Page link inside item
          let layoutPageHref = null;
          try {
            if (window.jQuery) {
              const lp = window.jQuery(itemEl).find("a:contains('Layout Page')").first();
              if (lp && lp.length) layoutPageHref = lp.attr('href');
            } else {
              const anchors = itemEl.querySelectorAll('a');
              for (const a of anchors) {
                if ((a.textContent || '').trim().toLowerCase().includes('layout page')) {
                  layoutPageHref = a.getAttribute('href');
                  break;
                }
              }
            }
          } catch (e) { layoutPageHref = null; }

          if (!layoutPageHref) {
            console.warn(TOOLKIT_NAME + ' layout page link not found for', thisLayout);
            return;
          }

          // fetch redirected layout page and then fetch it with bundle=off to find CSS path
          const xhr = new XMLHttpRequest();
          xhr.open('GET', layoutPageHref, true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                const redirectedURL = xhr.responseURL || layoutPageHref;
                fetchText(redirectedURL + '?bundle=off', 10000).then((r) => {
                  if (r.ok && r.text) {
                    const m = r.text.match(/\/App_Themes\/[^"'\s]*Layout[^"'\s]*/i);
                    if (m && m[0]) {
                      const cssUrl = m[0];
                      const filename = `${currentSite}-${thisLayout}.css`;
                      downloadxmlcss({ urls: [cssUrl], types: ['css'], autoConfirm: true, timeoutMs: 15000 })
                        .catch(err => console.warn(TOOLKIT_NAME + ' cssBtn download error', err));
                    } else {
                      console.warn(TOOLKIT_NAME + ' CSS path not found in layout page for', thisLayout);
                    }
                  } else {
                    console.warn(TOOLKIT_NAME + ' Failed to fetch layout page content for CSS detection', thisLayout, r.err || r.status);
                  }
                });
              } else {
                console.warn(TOOLKIT_NAME + ' failed to load layout page', layoutPageHref, xhr.status);
              }
            }
          };
          xhr.send();
        });

        // append CSS then XML (keeps spacing similar to original)
        insertionContainer.appendChild(cssBtn);
        insertionContainer.appendChild(xmlBtn);
      } catch (err) {
        console.warn(TOOLKIT_NAME + ' failed to process an item', err);
      }
    }

    // Add "Download All" in the sidebar
    try {
      const sidebarButtons = document.querySelector('.contentContainer .sidebar .buttons') || document.querySelector('.sidebar .buttons');
      if (sidebarButtons && !sidebarButtons.querySelector('.cp-download-all')) {
        const li = document.createElement('li');
        li.className = 'cp-download-all';
        const a = document.createElement('a');
        a.className = 'button bigButton nextAction';
        a.href = '#';
        a.innerHTML = '<span>Download All CSS and XML</span>';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          const allButtons = document.querySelectorAll('.downloadXML, .downloadCSS');
          for (const btn of allButtons) {
            try { btn.click(); } catch (err) { /* ignore */ }
          }
        });
        li.appendChild(a);
        sidebarButtons.appendChild(li);
      }
    } catch (e) {
      console.warn(TOOLKIT_NAME + ' failed to add Download All button', e);
    }

    return { ok: true };
  }

  /* ----------------- Exports ----------------- */

  window.downloadxmlcss = window.downloadxmlcss || downloadxmlcss;
  window.CPToolkit = window.CPToolkit || {};
  window.CPToolkit.downloadxmlcss = window.CPToolkit.downloadxmlcss || downloadxmlcss;
  window.CPToolkit.detectCssAndXmlUrls = detectCssAndXmlUrls;
  window.CPToolkit.insertDownloadButtons = insertLayoutButtons;

  // end module
})();

