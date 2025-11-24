/**
 * DownloadXMLCSS.js
 *
 * Library-style script intended to be loaded dynamically (injected by a userscript).
 * It preserves the original logic and UI placement from your userscript, but does NOT auto-run.
 * Call `downloadxmlcss(options)` to execute.
 *
 * Exposes:
 *   window.downloadxmlcss(options)
 *   window.CPToolkit.downloadxmlcss(options)
 *
 * Options:
 *   - autoConfirm: boolean (default false)
 *
 * Note: This version uses the same DOM selectors and logic you originally implemented,
 *       but adapts GM_addStyle to plain style injection and is robust to SPA timing.
 */

(function () {
  'use strict';

  // safe namespace
  window.CPToolkit = window.CPToolkit || {};
  const TOOLKIT_NAME = '[CP Toolkit - Download XML/CSS]';

  // Helper: check page matches
  function pageMatches(patterns) {
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    return patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
      return regex.test(url) || regex.test(pathname);
    });
  }

  // Inject CSS (replacement for GM_addStyle)
  function injectStyle(css) {
    try {
      let s = document.getElementById('cp-toolkit-downloadxmlcss-style');
      if (!s) {
        s = document.createElement('style');
        s.id = 'cp-toolkit-downloadxmlcss-style';
        document.head.appendChild(s);
      }
      s.textContent = css;
    } catch (err) {
      console.warn(TOOLKIT_NAME + ' injectStyle failed', err);
    }
  }

  // tiny fetch util
  async function fetchText(url, timeoutMs = 15000) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timer = null;
      if (controller && timeoutMs) timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { signal: controller ? controller.signal : undefined, credentials: 'same-origin' });
      if (!resp.ok) {
        return { ok: false, status: resp.status, text: null };
      }
      const text = await resp.text();
      if (timer) clearTimeout(timer);
      return { ok: true, status: resp.status, text };
    } catch (err) {
      return { ok: false, status: null, text: null, err };
    }
  }

  // trigger download by creating an anchor and clicking it
  function triggerDownloadFilename(filename, href) {
    return new Promise((resolve) => {
      try {
        // Resolve relative to current document
        let finalHref = href;
        try { finalHref = new URL(href, document.baseURI).href; } catch (e) { /* keep original */ }

        const a = document.createElement('a');
        a.href = finalHref;
        a.download = filename;
        // Append to DOM to ensure click works in some browsers
        document.body.appendChild(a);
        a.click();
        a.remove();
        resolve({ ok: true, filename, url: finalHref });
      } catch (err) {
        console.warn(TOOLKIT_NAME + ' triggerDownloadFilename failed', err);
        resolve({ ok: false, filename, err });
      }
    });
  }

  // Wait for a selector to appear (poll)
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

  // prefer jQuery when available
  function qAll(sel, ctx) {
    if (window.jQuery) return Array.from((ctx ? window.jQuery(ctx) : window.jQuery(document)).find(sel));
    return Array.from((ctx || document).querySelectorAll(sel));
  }

  // create a button consistent with page
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

  // try to ensure fontawesome either via shared loader or injecting CDN link
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

  // Main exported function - preserves original logic/behavior
  async function downloadxmlcss(options = {}) {
    const cfg = Object.assign({ autoConfirm: false }, options || {});

    // Only run on Layouts page
    if (!pageMatches(['/admin/designcenter/layouts'])) {
      console.log(TOOLKIT_NAME + ' Not on Layouts page — exiting');
      return { ok: false, reason: 'not-layouts-page' };
    }

    // If CPToolkit detection exists, verify site
    if (typeof window.CPToolkit !== 'undefined' && typeof window.CPToolkit.isCivicPlusSite === 'function') {
      try {
        const isCP = await window.CPToolkit.isCivicPlusSite();
        if (!isCP) {
          console.log(TOOLKIT_NAME + ' Not a CivicPlus site — exiting');
          return { ok: false, reason: 'not-cpsite' };
        }
      } catch (e) {
        console.warn(TOOLKIT_NAME + ' CP site detection threw, proceeding anyway', e);
      }
    }

    console.log(TOOLKIT_NAME + ' Initializing...');

    await ensureFontAwesomeFallback();

    // Add styling roughly equivalent to GM_addStyle in original
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

    // Wait for listing items to appear up to 8s
    await waitForSelector('.listing .item, .item', 8000);

    const itemEls = qAll('.listing .item, .item');
    if (!itemEls || itemEls.length === 0) {
      console.warn(TOOLKIT_NAME + ' No layout items found on page at this moment.');
      return { ok: false, reason: 'no-layout-items' };
    }

    const currentSite = window.location.host.replace(/[:\/]/g, '-');

    // Insert buttons per-item
    for (const itemEl of itemEls) {
      try {
        const titleAnchor = itemEl.querySelector && itemEl.querySelector('h3 a');
        const thisLayout = titleAnchor ? (titleAnchor.textContent || titleAnchor.innerText || '').trim() : null;
        if (!thisLayout) continue;

        // avoid duplicates
        if (itemEl.querySelector('.downloadXML') || itemEl.querySelector('.downloadCSS')) continue;

        // choose insertion point
        let insertionContainer = itemEl.querySelector('.actions, .buttons, .item-actions, .item-buttons');
        if (!insertionContainer) {
          const status = itemEl.querySelector('.status');
          if (status && status.parentNode) insertionContainer = status.parentNode;
        }
        if (!insertionContainer) {
          if (!itemEl.classList.contains('cp-download-wrapper')) itemEl.classList.add('cp-download-wrapper');
          insertionContainer = itemEl;
        }

        // XML button
        const xmlBtn = makeActionButton('downloadXML', `<i class="fa fa-download" aria-hidden="true"></i> XML`, function () {
          const downloadUrl = `/App_Themes/${encodeURIComponent(thisLayout)}/${encodeURIComponent(thisLayout)}.xml`;
          const filename = `${currentSite}-${thisLayout}.xml`;
          triggerDownloadFilename(filename, downloadUrl);
        });

        // CSS button
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
          } catch (e) {
            layoutPageHref = null;
          }

          if (!layoutPageHref) {
            console.warn(TOOLKIT_NAME + ' layout page link not found for', thisLayout);
            return;
          }

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
                      triggerDownloadFilename(filename, cssUrl);
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

        // append CSS then XML (matches previous spacing)
        insertionContainer.appendChild(cssBtn);
        insertionContainer.appendChild(xmlBtn);
      } catch (err) {
        console.warn(TOOLKIT_NAME + ' failed to process an item', err);
      }
    }

    // Add "Download All" in sidebar
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

    console.log(TOOLKIT_NAME + ' Successfully loaded and buttons inserted');
    return { ok: true };
  }

  // expose
  window.downloadxmlcss = window.downloadxmlcss || downloadxmlcss;
  window.CPToolkit = window.CPToolkit || {};
  window.CPToolkit.downloadxmlcss = window.CPToolkit.downloadxmlcss || downloadxmlcss;
  window.CPToolkit.pageMatches = pageMatches;

})();



