/**
 * DownloadXMLCSS.js
 *
 * Library-style script intended to be loaded dynamically (injected by a userscript).
 * It does NOT auto-run. Call `downloadxmlcss(options)` to execute.
 *
 * Exposes:
 *   - window.downloadxmlcss(options)
 *   - window.CPToolkit.downloadxmlcss(options)
 *
 * Options (optional):
 *   - autoConfirm: boolean (default: false) — if true, doesn't prompt when multiple downloads
 *
 * Note: This script expects to run in page context (so it can access page jQuery if present).
 */

(function () {
  'use strict';

  // safe namespace
  window.CPToolkit = window.CPToolkit || {};
  const TOOLKIT_NAME = '[CP Toolkit - Download XML/CSS]';

  // Utility: basic pageMatches (keeps original behavior)
  function pageMatches(patterns) {
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    return patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
      return regex.test(url) || regex.test(pathname);
    });
  }

  // Inject styles (replacement for GM_addStyle)
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

  // Helper: download given url/text as file. If url is same-origin or absolute, attempt to fetch it first.
  function triggerDownloadFilename(filename, href, isBlob = false, mimeType = 'text/plain;charset=utf-8') {
    return new Promise((resolve) => {
      try {
        // If href looks like a data or blob URL or absolute path, just use anchor download
        const a = document.createElement('a');
        a.href = href;
        a.download = filename;
        // Append to DOM to ensure click works in some browsers
        document.body.appendChild(a);
        a.click();
        a.remove();
        resolve({ ok: true, filename, url: href });
      } catch (err) {
        console.warn(TOOLKIT_NAME + ' triggerDownloadFilename failed', err);
        resolve({ ok: false, filename, err });
      }
    });
  }

  // Helper: fetch text, with fallback to relative path usage
  async function fetchText(url, timeoutMs = 15000) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timer = null;
      if (controller && timeoutMs) {
        timer = setTimeout(() => controller.abort(), timeoutMs);
      }
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

  // DOM helpers that prefer jQuery when available
  function $(sel, ctx) {
    if (window.jQuery) return window.jQuery(sel, ctx);
    return Array.from((ctx || document).querySelectorAll(sel));
  }

  // Main function (exported)
  async function downloadxmlcss(options = {}) {
    const cfg = Object.assign({ autoConfirm: false }, options || {});

    // Only run on Layouts page — same as original userscript
    if (!pageMatches(['/admin/designcenter/layouts'])) {
      console.log(TOOLKIT_NAME + ' Not on Layouts page — exiting');
      return { ok: false, reason: 'not-layouts-page' };
    }

    // Verify CivicPlus site if helper exists
    if (typeof window.CPToolkit !== 'undefined' && typeof window.CPToolkit.isCivicPlusSite === 'function') {
      try {
        const isCP = await window.CPToolkit.isCivicPlusSite();
        if (!isCP) {
          console.log(TOOLKIT_NAME + ' Not a CivicPlus site — exiting');
          return { ok: false, reason: 'not-cpsite' };
        }
      } catch (e) {
        // proceed if detection fails
        console.warn(TOOLKIT_NAME + ' CP site detection threw, proceeding anyway', e);
      }
    }

    console.log(TOOLKIT_NAME + ' Initializing...');

    // Ensure FontAwesome (reuse CPToolkit loader if present)
    if (typeof window.CPToolkit !== 'undefined' && typeof window.CPToolkit.ensureFontAwesome === 'function') {
      try {
        await window.CPToolkit.ensureFontAwesome();
      } catch (e) {
        console.warn(TOOLKIT_NAME + ' ensureFontAwesome threw', e);
      }
    } else {
      // Fallback: inject CDN link if no FA present
      try {
        const already = document.querySelector('.fa, .fas, .far, .fal, .fab') || document.getElementById('cp-toolkit-fontawesome');
        if (!already) {
          const link = document.createElement('link');
          link.id = 'cp-toolkit-fontawesome';
          link.rel = 'stylesheet';
          link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
          document.head.appendChild(link);
          // no await - best-effort
        }
      } catch (e) {
        console.warn(TOOLKIT_NAME + ' fallback FontAwesome injection failed', e);
      }
    }

    // Inject the styles (converted from your GM_addStyle)
    injectStyle(`
      .downloadXML, .downloadCSS {
          line-height: 33px;
          font-size: .75rem;
          font-weight: 400 !important;
          position: absolute;
          top: 4px;
      }
      .downloadXML { right: 221px; }
      .downloadCSS { right: 120px; }
      .downloadXML .fa, .downloadCSS .fa { color: #4f8ec0; }
      .listing .item { padding-right: 330px; }
      .listing .item>.status { right: 330px; }
      .listing .item h3 { width: calc(100% - 54px); }
      /* small responsive fix */
      @media (max-width: 800px) {
        .downloadXML { right: 160px; }
        .downloadCSS { right: 60px; }
      }
    `);

    try {
      // Use jQuery-style selection if available
      const layoutItems = window.jQuery ? window.jQuery('.item') : document.querySelectorAll('.item');
      const layouts = Array.isArray(layoutItems) ? layoutItems : (layoutItems && layoutItems.length ? Array.from(layoutItems) : []);

      const currentSite = window.location.host.replace(/[:\/]/g, '-');

      function downloadItemFileNameAndUrl(filename, url) {
        // If URL is relative, make absolute
        let finalUrl = url;
        try {
          finalUrl = new URL(url, document.baseURI).href;
        } catch (e) {
          finalUrl = url;
        }
        return triggerDownloadFilename(filename, finalUrl);
      }

      // If no layout items found, try a fallback: elements with class 'listing' -> 'item'
      let foundAny = layouts.length > 0;
      if (!foundAny) {
        const alt = document.querySelectorAll('.listing .item, .contentContainer .listing .item');
        if (alt && alt.length) {
          alt.forEach(el => layouts.push(el));
          foundAny = layouts.length > 0;
        }
      }

      if (!foundAny) {
        console.warn(TOOLKIT_NAME + ' No layout items found on page.');
        return { ok: false, reason: 'no-layout-items' };
      }

      // Create and append buttons for each layout element
      for (const itemEl of layouts) {
        // get element with heading / title
        let h3a;
        if (window.jQuery) {
          h3a = window.jQuery(itemEl).find('h3 a').first();
        } else {
          const el = itemEl.querySelector('h3 a');
          h3a = el;
        }
        const thisLayout = h3a ? (window.jQuery ? window.jQuery(h3a).text().trim() : h3a.textContent.trim()) : null;
        if (!thisLayout) continue;

        // Avoid adding duplicate buttons
        if (itemEl.querySelector && itemEl.querySelector('.downloadXML')) continue;

        // Create XML button
        const downloadXML = document.createElement('a');
        downloadXML.href = '#';
        downloadXML.className = 'button downloadXML';
        downloadXML.innerHTML = `<i class="fa fa-download" aria-hidden="true"></i> XML`;
        downloadXML.addEventListener('click', function (e) {
          e.preventDefault();
          const downloadUrl = `/App_Themes/${encodeURIComponent(thisLayout)}/${encodeURIComponent(thisLayout)}.xml`;
          const filename = `${currentSite}-${thisLayout}.xml`;
          downloadItemFileNameAndUrl(filename, downloadUrl);
        });

        // Find the "Layout Page" link for this item (fallback search)
        let thisLayoutPage = null;
        try {
          if (window.jQuery) {
            const lp = window.jQuery(itemEl).find("a:contains('Layout Page')").first();
            thisLayoutPage = lp && lp.length ? lp.attr('href') : null;
          } else {
            // naive scan for anchor whose text contains 'Layout Page'
            const anchors = itemEl.querySelectorAll('a');
            for (const a of anchors) {
              if ((a.textContent || '').trim().toLowerCase().includes('layout page')) {
                thisLayoutPage = a.getAttribute('href');
                break;
              }
            }
          }
        } catch (e) {
          thisLayoutPage = null;
        }

        // Create CSS button
        const downloadCSS = document.createElement('a');
        downloadCSS.href = '#';
        downloadCSS.className = 'button downloadCSS';
        downloadCSS.innerHTML = `<i class="fa fa-download" aria-hidden="true"></i> CSS`;
        downloadCSS.addEventListener('click', function (e) {
          e.preventDefault();
          if (!thisLayoutPage) {
            console.warn(TOOLKIT_NAME + ' layout page link not found for', thisLayout);
            return;
          }

          // Request the layout page to get the redirected css path, same approach as original
          const xhr = new XMLHttpRequest();
          xhr.open('GET', thisLayoutPage, true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                const redirectedURL = xhr.responseURL || thisLayoutPage;
                // fetch the content (bundle=off) to inspect for CSS path
                fetchText(redirectedURL + '?bundle=off', 10000).then((r) => {
                  if (r.ok && r.text) {
                    // find first match for /App_Themes/...Layout...
                    const m = r.text.match(/\/App_Themes\/[^"'\s]*Layout[^"'\s]*/i);
                    if (m && m[0]) {
                      const cssUrl = m[0];
                      const filename = `${currentSite}-${thisLayout}.css`;
                      downloadItemFileNameAndUrl(filename, cssUrl);
                    } else {
                      console.warn(TOOLKIT_NAME + ' CSS path not found in layout page for', thisLayout);
                    }
                  } else {
                    console.warn(TOOLKIT_NAME + ' Failed to fetch layout page content for CSS detection', thisLayout, r.err || r.status);
                  }
                });
              } else {
                console.warn(TOOLKIT_NAME + ' failed to load layout page', thisLayoutPage, xhr.status);
              }
            }
          };
          xhr.send();
        });

        // Append buttons to the item element (maintain same positioning as original)
        try {
          // prefer jQuery append if available to preserve CSS/layout
          if (window.jQuery) {
            window.jQuery(itemEl).append(downloadXML).append(downloadCSS);
          } else {
            itemEl.appendChild(downloadXML);
            itemEl.appendChild(downloadCSS);
          }
        } catch (e) {
          console.warn(TOOLKIT_NAME + ' failed to append buttons', e);
        }
      } // end for each layout

      // Add "Download All CSS and XML" button to sidebar (if present)
      try {
        const sidebarButtons = document.querySelector('.contentContainer .sidebar .buttons') || document.querySelector('.sidebar .buttons');
        if (sidebarButtons) {
          const li = document.createElement('li');
          const a = document.createElement('a');
          a.className = 'button bigButton nextAction';
          a.href = '#';
          a.innerHTML = '<span>Download All CSS and XML</span>';
          a.addEventListener('click', function (e) {
            e.preventDefault();
            // trigger all download buttons
            const allButtons = document.querySelectorAll('.downloadXML, .downloadCSS');
            for (const btn of allButtons) {
              try {
                btn.click();
              } catch (err) { /* ignore */ }
            }
          });
          li.appendChild(a);
          sidebarButtons.appendChild(li);
        }
      } catch (e) {
        console.warn(TOOLKIT_NAME + ' failed to add Download All button', e);
      }

      console.log(TOOLKIT_NAME + ' Successfully loaded');
      return { ok: true };
    } catch (err) {
      console.warn(TOOLKIT_NAME + ' Error:', err);
      return { ok: false, err };
    }
  }

  // Export on window and CPToolkit
  window.downloadxmlcss = window.downloadxmlcss || downloadxmlcss;
  window.CPToolkit = window.CPToolkit || {};
  window.CPToolkit.downloadxmlcss = window.CPToolkit.downloadxmlcss || downloadxmlcss;

  // also export a detect function if helpful
  window.CPToolkit.pageMatches = pageMatches;

  // end module
})();


