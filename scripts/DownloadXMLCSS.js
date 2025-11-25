/**
 * DownloadXMLCSS.js
 * Library to detect and download CSS/XML and insert per-layout UI buttons.
 * Exposes:
 *   window.downloadxmlcss(options)
 *   window.CPToolkit.downloadxmlcss(options)
 *   window.CPToolkit.insertDownloadButtons()
 *
 * (Paste this file to GitHub at scripts/DownloadXMLCSS.js)
 */
(function () {
  'use strict';

  // ensure namespace
  window.CPToolkit = window.CPToolkit || {};
  const TOOLKIT_NAME = '[CP Toolkit - Download XML/CSS]';

  /* ---------- Utilities ---------- */

  function toAbsoluteUrl(href) {
    try { return new URL(href, document.baseURI).href; }
    catch (e) { return href; }
  }

  function filenameFromUrl(url, fallbackPrefix = 'download') {
    try {
      const u = new URL(url);
      const last = u.pathname.split('/').pop() || '';
      return decodeURIComponent((last || (u.hostname + '-' + Date.now())).split('?')[0]);
    } catch (e) {
      return fallbackPrefix + '-' + Date.now();
    }
  }

  async function fetchText(url, timeoutMs = 10000) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timer = null;
      if (controller && timeoutMs) timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { signal: controller ? controller.signal : undefined, credentials: 'same-origin' });
      if (!resp.ok) return { ok: false, status: resp.status, text: null, err: new Error('HTTP ' + resp.status) };
      const text = await resp.text();
      if (timer) clearTimeout(timer);
      return { ok: true, status: resp.status, text };
    } catch (err) {
      return { ok: false, status: null, text: null, err };
    }
  }

  function downloadBlob(filename, text, mime = 'text/plain;charset=utf-8') {
    try {
      const blob = new Blob([text], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return { ok: true, filename };
    } catch (err) {
      console.warn(TOOLKIT_NAME, 'downloadBlob failed', err);
      return { ok: false, err };
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
      console.warn(TOOLKIT_NAME, 'injectStyle failed', e);
    }
  }

  /* ---------- Detection ---------- */

  function detectCssAndXmlUrls() {
    const css = new Set();
    const xml = new Set();

    // <link rel=stylesheet>
    document.querySelectorAll('link[rel~="stylesheet"][href]').forEach(l => {
      const h = l.getAttribute('href');
      if (!h) return;
      const abs = toAbsoluteUrl(h);
      if (/\.css(\?.*)?$/i.test(abs) || /\/assets\//i.test(abs)) css.add(abs);
    });

    // anchors to .css/.xml
    document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (!h) return;
      const abs = toAbsoluteUrl(h);
      if (/\.css(\?.*)?$/i.test(abs)) css.add(abs);
      if (/\.xml(\?.*)?$/i.test(abs)) xml.add(abs);
    });

    // data- attributes / script xml content
    document.querySelectorAll('[data-xml-src],[data-src],script[type="application/xml"]').forEach(el => {
      const s = el.getAttribute('data-xml-src') || el.getAttribute('data-src') || el.getAttribute('src') || el.textContent;
      if (!s) return;
      const abs = toAbsoluteUrl(s.trim());
      if (/\.xml(\?.*)?$/i.test(abs)) xml.add(abs);
    });

    // couple CivicPlus heuristics
    [
      '/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html',
      '/Services/Content/GetXml',
      '/Config/SiteConfig.xml'
    ].forEach(p => xml.add(toAbsoluteUrl(p)));

    return { css: Array.from(css), xml: Array.from(xml) };
  }

  /* ---------- Core downloader ---------- */

  async function downloadxmlcss(options = {}) {
    const cfg = Object.assign({ urls: null, types: ['css','xml'], autoConfirm: false, timeoutMs: 15000 }, options || {});
    console.log(TOOLKIT_NAME, 'running downloadxmlcss', cfg);

    let targets = [];

    if (Array.isArray(cfg.urls) && cfg.urls.length) {
      targets = cfg.urls.map(toAbsoluteUrl);
    } else {
      const detected = detectCssAndXmlUrls();
      if (cfg.types.includes('css')) targets.push(...detected.css);
      if (cfg.types.includes('xml')) targets.push(...detected.xml);
      targets = Array.from(new Set(targets));
    }

    if (!targets.length) {
      console.warn(TOOLKIT_NAME, 'no candidate URLs found');
      return { results: [], summary: { message: 'no-candidates' } };
    }

    if (!cfg.autoConfirm && targets.length > 1) {
      if (!confirm(`Found ${targets.length} files to download. Proceed?`)) {
        console.log(TOOLKIT_NAME, 'user cancelled');
        return { results: [], summary: { message: 'cancelled' } };
      }
    }

    const results = [];
    for (const t of targets) {
      try {
        const r = await fetchText(t, cfg.timeoutMs);
        if (!r.ok) {
          results.push({ url: t, ok: false, status: r.status, err: r.err });
          continue;
        }
        const mime = /\.css(\?.*)?$/i.test(t) ? 'text/css;charset=utf-8' : /\.xml(\?.*)?$/i.test(t) ? 'application/xml;charset=utf-8' : 'text/plain;charset=utf-8';
        const filename = filenameFromUrl(t);
        const dl = downloadBlob(filename, r.text, mime);
        results.push(Object.assign({ url: t, ok: dl.ok }, dl));
      } catch (err) {
        results.push({ url: t, ok: false, err });
      }
    }

    const okCount = results.filter(x => x.ok).length;
    console.log(TOOLKIT_NAME, `done: ${okCount}/${results.length} succeeded`);
    return { results, summary: { total: results.length, succeeded: okCount } };
  }

  /* ---------- UI insertion (per-layout buttons & Download All) ---------- */

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
      try { onClick && onClick.call(this, e); } catch (err) { console.warn(TOOLKIT_NAME, 'button handler failed', err); }
    });
    return a;
  }

  async function ensureFontAwesome() {
    if (typeof window.CPToolkit !== 'undefined' && typeof window.CPToolkit.ensureFontAwesome === 'function') {
      try { await window.CPToolkit.ensureFontAwesome(); return; } catch (e) {}
    }
    if (!document.getElementById('cp-toolkit-fontawesome')) {
      const link = document.createElement('link');
      link.id = 'cp-toolkit-fontawesome';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
      document.head.appendChild(link);
    }
  }

  function waitForSelector(selector, timeoutMs = 8000, intervalMs = 120) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function tick() {
        if (document.querySelector(selector)) return resolve(true);
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(tick, intervalMs);
      })();
    });
  }

  async function insertLayoutButtons() {
    if (!window.location.pathname.toLowerCase().includes('/admin/designcenter/layouts')) {
      return { ok: false, reason: 'not-layouts' };
    }

    await ensureFontAwesome();

    injectStyle(`
      .downloadXML, .downloadCSS { line-height:33px; font-size:.75rem; font-weight:400 !important; position:absolute; top:4px; z-index:10; }
      .downloadXML { right:221px; } .downloadCSS { right:120px; }
      .downloadXML .fa, .downloadCSS .fa { color: #4f8ec0; }
      .listing .item { padding-right:330px; } .listing .item>.status { right:330px; }
      .listing .item h3 { width: calc(100% - 54px); } .cp-download-wrapper{position:relative;}
      @media(max-width:800px){ .downloadXML{right:160px} .downloadCSS{right:60px} }
    `);

    await waitForSelector('.listing .item, .item', 8000);
    const items = qAll('.listing .item, .item');
    if (!items || !items.length) return { ok: false, reason: 'no-items' };

    const sitePrefix = window.location.host.replace(/[:\/]/g, '-');

    for (const item of items) {
      try {
        const titleAnchor = item.querySelector && item.querySelector('h3 a');
        const layoutName = titleAnchor ? (titleAnchor.textContent || '').trim() : null;
        if (!layoutName) continue;
        if (item.querySelector('.downloadXML') || item.querySelector('.downloadCSS')) continue;

        let insertPoint = item.querySelector('.actions, .buttons, .item-actions, .item-buttons');
        if (!insertPoint) {
          const status = item.querySelector('.status');
          if (status && status.parentNode) insertPoint = status.parentNode;
        }
        if (!insertPoint) { item.classList.add('cp-download-wrapper'); insertPoint = item; }

        const xmlBtn = makeActionButton('downloadXML', `<i class="fa fa-download" aria-hidden="true"></i> XML`, function () {
          const url = `/App_Themes/${encodeURIComponent(layoutName)}/${encodeURIComponent(layoutName)}.xml`;
          downloadxmlcss({ urls: [url], types: ['xml'], autoConfirm: true, timeoutMs: 15000 }).catch(err => console.warn(TOOLKIT_NAME, 'xmlBtn err', err));
        });

        const cssBtn = makeActionButton('downloadCSS', `<i class="fa fa-download" aria-hidden="true"></i> CSS`, function () {
          // find Layout Page link inside item
          let layoutPageHref = null;
          try {
            if (window.jQuery) {
              const lp = window.jQuery(item).find("a:contains('Layout Page')").first();
              if (lp && lp.length) layoutPageHref = lp.attr('href');
            } else {
              for (const a of item.querySelectorAll('a')) {
                if ((a.textContent || '').toLowerCase().includes('layout page')) { layoutPageHref = a.getAttribute('href'); break; }
              }
            }
          } catch (e) { layoutPageHref = null; }

          if (!layoutPageHref) { console.warn(TOOLKIT_NAME, 'layout page not found for', layoutName); return; }

          const xhr = new XMLHttpRequest();
          xhr.open('GET', layoutPageHref, true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                const redirected = xhr.responseURL || layoutPageHref;
                fetchText(redirected + '?bundle=off', 10000).then(r => {
                  if (r.ok && r.text) {
                    const m = r.text.match(/\/App_Themes\/[^"'\s]*Layout[^"'\s]*/i);
                    if (m && m[0]) {
                      downloadxmlcss({ urls: [m[0]], types: ['css'], autoConfirm: true, timeoutMs: 15000 }).catch(err => console.warn(TOOLKIT_NAME, 'cssBtn err', err));
                    } else console.warn(TOOLKIT_NAME, 'css path not found for', layoutName);
                  } else console.warn(TOOLKIT_NAME, 'fetch layout failed', layoutName, r.err || r.status);
                });
              } else console.warn(TOOLKIT_NAME, 'layout page fetch status', xhr.status);
            }
          };
          xhr.send();
        });

        insertPoint.appendChild(cssBtn);
        insertPoint.appendChild(xmlBtn);
      } catch (err) {
        console.warn(TOOLKIT_NAME, 'item processing error', err);
      }
    }

    try {
      const sidebar = document.querySelector('.contentContainer .sidebar .buttons') || document.querySelector('.sidebar .buttons');
      if (sidebar && !sidebar.querySelector('.cp-download-all')) {
        const li = document.createElement('li');
        li.className = 'cp-download-all';
        const a = document.createElement('a');
        a.className = 'button bigButton nextAction';
        a.href = '#';
        a.innerHTML = '<span>Download All CSS and XML</span>';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          const all = document.querySelectorAll('.downloadXML, .downloadCSS');
          for (const b of all) try { b.click(); } catch (err) {}
        });
        li.appendChild(a);
        sidebar.appendChild(li);
      }
    } catch (e) {
      console.warn(TOOLKIT_NAME, 'sidebar insertion failed', e);
    }

    return { ok: true };
  }

  /* ---------- Expose API explicitly ---------- */

  window.downloadxmlcss = window.downloadxmlcss || downloadxmlcss;
  window.CPToolkit = window.CPToolkit || {};
  window.CPToolkit.downloadxmlcss = window.CPToolkit.downloadxmlcss || downloadxmlcss;
  window.CPToolkit.insertDownloadButtons = window.CPToolkit.insertDownloadButtons || insertLayoutButtons;
  window.CPToolkit.detectCssAndXmlUrls = window.CPToolkit.detectCssAndXmlUrls || detectCssAndXmlUrls;

})();

