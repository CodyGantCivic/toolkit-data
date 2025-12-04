// DownloadXMLCSS.js - Optimised CivicPlus Toolkit helper
//
// This helper adds quick download buttons for XML and CSS files to
// each layout item on the Design Center layouts page.  It exposes
// a single `init()` function under `window.DownloadXMLCSS` and does
// not auto‑run on its own.  The loader will call `init()` only on
// appropriate CivicPlus pages.
//
// This version removes the dependency on jQuery and polling for
// availability.  It uses a MutationObserver-based `waitForElement()`
// to detect when the layout list is present, caches FontAwesome
// loading, and performs all DOM operations with native APIs.  A
// simple idempotent guard prevents duplicate initialisation.

(function () {
  'use strict';

  // If already loaded, do nothing.
  if (window.DownloadXMLCSS && window.DownloadXMLCSS.__loaded) {
    return;
  }

  /**
   * Ensure FontAwesome icons are loaded. Returns a promise that
   * resolves once the stylesheet has loaded or if icons already
   * exist on the page. Uses a CDN to avoid slow raw GitHub fetches.
   */
  function ensureFontAwesome() {
    return new Promise(function (resolve) {
      try {
        // If any FA classes are present, assume it is loaded.
        if (document.querySelector('.fa, .fas, .far, .fal, .fab')) {
          resolve();
          return;
        }
        // If the stylesheet is already injected, wait briefly and resolve.
        if (document.getElementById('cp-toolkit-fontawesome')) {
          setTimeout(resolve, 200);
          return;
        }
        var link = document.createElement('link');
        link.id = 'cp-toolkit-fontawesome';
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        link.onload = resolve;
        link.onerror = resolve;
        document.head.appendChild(link);
      } catch (e) {
        resolve();
      }
    });
  }

  /**
   * Inject page styles used by the download buttons. This runs
   * once per page.
   * @param {string} cssText CSS to inject.
   */
  function addStyles(cssText) {
    try {
      if (document.getElementById('cp-toolkit-downloadxmlcss-styles')) return;
      var s = document.createElement('style');
      s.id = 'cp-toolkit-downloadxmlcss-styles';
      s.textContent = cssText;
      (document.head || document.documentElement).appendChild(s);
    } catch (_) {
      // ignore failures
    }
  }

  /**
   * Wait for a selector to appear in the DOM. Uses MutationObserver
   * and times out after the specified milliseconds.
   * @param {string} selector CSS selector to wait for.
   * @param {number} timeout Maximum time to wait in ms.
   * @returns {Promise<Element|null>} Resolves with the element or null.
   */
  function waitForElement(selector, timeout) {
    timeout = timeout || 3000;
    return new Promise(function (resolve) {
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }
      let timer;
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          clearTimeout(timer);
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Insert download buttons for each layout item and a bulk download
   * button on the layouts page.  Requires FontAwesome loaded.
   */
  async function insertDownloadButtons() {
    // Only run once per page.
    if (window.__cp_downloadxmlcss_initialized) return;
    await ensureFontAwesome();
    // Inject CSS styles
    addStyles(
      [
        '.downloadXML, .downloadCSS {',
        '  line-height: 33px;',
        '  font-size: .75rem;',
        '  font-weight: 400 !important;',
        '  position: absolute;',
        '  top: 4px;',
        // Ensure buttons do not overlap other CMS controls by
        // placing them beneath native buttons (z-index 1)
        '  z-index: 1;',
        '}',
        '.downloadXML { right: 221px; }',
        '.downloadCSS { right: 120px; }',
        '.downloadXML .fa, .downloadCSS .fa { color: #4f8ec0; margin-right:6px; }',
        '.listing .item { padding-right: 330px; }',
        '.listing .item>.status { right: 330px; }',
        '.listing .item h3 { width: calc(100% - 54px); }',
        '.downloadXML, .downloadCSS { white-space: nowrap; overflow: visible; }'
      ].join('\n')
    );
    try {
      const items = document.querySelectorAll('.listing .items .item');
      const currentSite = document.location.host.replace(/[:\/]+/g, '-');
      // Helper to trigger a download by creating and clicking an anchor
      function downloadItem(title, url) {
        try {
          var a = document.createElement('a');
          a.href = /^(https?:)?\/\//i.test(url)
            ? url
            : window.location.origin.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
          a.download = title;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (_) {
          window.open(url, '_blank');
        }
      }
      items.forEach(function (item) {
        if (item.dataset.cpDlAdded) return;
        item.dataset.cpDlAdded = 'true';
        const nameAnchor = item.querySelector('h3 a');
        const thisLayoutName = nameAnchor ? nameAnchor.textContent.trim() : '';
        if (!thisLayoutName) return;
        // Create XML button
        const downloadXML = document.createElement('a');
        downloadXML.href = '#';
        downloadXML.className = 'button downloadXML';
        downloadXML.innerHTML = "<i class='fa fa-download'></i><span>XML</span>";
        downloadXML.addEventListener('click', function (e) {
          e.preventDefault();
          const url = '/App_Themes/' + encodeURIComponent(thisLayoutName) + '/' + encodeURIComponent(thisLayoutName) + '.xml';
          downloadItem(currentSite + '-' + thisLayoutName + '.xml', url);
        });
        // Determine layout page link for CSS download
        let layoutPage = null;
        // Try to find link containing 'Layout Page' or 'View Layout Page'
        const anchors = Array.from(item.querySelectorAll('a'));
        const pageLink = anchors.find(a => /Layout Page|View Layout Page/i.test(a.textContent));
        if (pageLink) {
          layoutPage = pageLink.href;
        } else if (nameAnchor) {
          layoutPage = nameAnchor.href;
        }
        // Create CSS button
        const downloadCSS = document.createElement('a');
        downloadCSS.href = '#';
        downloadCSS.className = 'button downloadCSS';
        downloadCSS.innerHTML = "<i class='fa fa-download'></i><span>CSS</span>";
        downloadCSS.addEventListener('click', async function (e) {
          e.preventDefault();
          if (!layoutPage) return;
          try {
            const resp = await fetch(layoutPage);
            if (resp.ok) {
              const text = await resp.text();
              const match = text.match(/\/App_Themes\/[^\"]*Layout[^\"]*/);
              if (match) {
                downloadItem(currentSite + '-' + thisLayoutName + '.css', match[0]);
              }
            }
          } catch (_) {
            // ignore errors
          }
        });
        // Append buttons
        item.appendChild(downloadXML);
        item.appendChild(downloadCSS);
      });
      // Add bulk download button if not present
      const sidebarButtons = document.querySelector('.contentContainer .sidebar .buttons');
      if (sidebarButtons && !sidebarButtons.querySelector('.cp-download-all')) {
        const li = document.createElement('li');
        li.className = 'cp-download-all';
        const a = document.createElement('a');
        a.className = 'button bigButton nextAction';
        a.href = '#';
        a.innerHTML = '<span>Download All CSS and XML</span>';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          document.querySelectorAll('.downloadXML, .downloadCSS').forEach(btn => {
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          });
        });
        li.appendChild(a);
        sidebarButtons.appendChild(li);
      }
      window.__cp_downloadxmlcss_initialized = true;
    } catch (e) {
      // If any error occurs, fail silently to avoid breaking the page.
    }
  }

  /**
   * Public init function called by the loader. Ensures idempotent
   * initialisation and triggers insertion of download buttons when
   * the layout list becomes available.
   */
  function init() {
    if (window.DownloadXMLCSS.__loaded) return;
    window.DownloadXMLCSS.__loaded = true;
    waitForElement('.listing .items', 3000).then(function () {
      insertDownloadButtons();
    });
  }

  // Expose helper on the global object
  window.DownloadXMLCSS = window.DownloadXMLCSS || {};
  window.DownloadXMLCSS.__loaded = false;
  window.DownloadXMLCSS.init = init;

})();
