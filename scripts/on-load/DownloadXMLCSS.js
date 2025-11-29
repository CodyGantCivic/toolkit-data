// DownloadXMLCSS.js - Sanitized CivicPlus Toolkit helper
//
// This helper adds quick download buttons for XML and CSS files to
// each layout item on the Design Center layouts page. It exposes
// a single `init()` function under `window.DownloadXMLCSS` and does
// not auto‑run on its own. The loader will call `init()` only on
// appropriate CivicPlus pages. The helper waits for jQuery to
// become available, loads FontAwesome from a CDN if necessary, and
// inserts per‑layout download links and a bulk download button. A
// simple idempotent guard prevents duplicate initialisation.

(function () {
  'use strict';

  // If already loaded, do nothing.
  if (window.DownloadXMLCSS && window.DownloadXMLCSS.__loaded) {
    return;
  }

  /**
   * Wait for jQuery to be available. Resolves with the jQuery
   * function or null if not found within the timeout.
   * @param {number} timeout Maximum time to wait in milliseconds.
   * @returns {Promise<any|null>}
   */
  function waitForJQuery(timeout) {
    timeout = timeout || 3000;
    return new Promise(function (resolve) {
      if (window.jQuery) return resolve(window.jQuery);
      var waited = 0;
      var handle = setInterval(function () {
        if (window.jQuery) {
          clearInterval(handle);
          resolve(window.jQuery);
        } else if ((waited += 200) >= timeout) {
          clearInterval(handle);
          resolve(null);
        }
      }, 200);
    });
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
   * Insert download buttons for each layout item and a bulk download
   * button on the layouts page. Requires jQuery and FontAwesome.
   */
  async function insertDownloadButtons() {
    // Only run once per page.
    if (window.__cp_downloadxmlcss_initialized) return;
    var $ = await waitForJQuery();
    if (!$) return;
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
      var layouts = $('.listing .items .item');
      var currentSite = document.location.host.replace(/[:\/]+/g, '-');
      // Helper to trigger a download by creating and clicking an anchor
      function downloadItem(title, url) {
        try {
          var a = document.createElement('a');
          a.href = /^(https?:)?\/\//i.test(url)
            ? url
            : window.location.origin.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
          a.download = title;
          a.click();
        } catch (_) {
          window.open(url, '_blank');
        }
      }
      layouts.each(function () {
        var $item = $(this);
        if ($item.data('cp-dl-added')) return;
        $item.data('cp-dl-added', true);
        var thisLayoutName = $item.find('h3 a').text().trim();
        if (!thisLayoutName) return;
        // Create XML button
        var downloadXML = $("<a href='#' class='button downloadXML'><i class='fa fa-download'></i><span>XML</span></a>");
        downloadXML.on('click', function (e) {
          e.preventDefault();
          var url = '/App_Themes/' + encodeURIComponent(thisLayoutName) + '/' + encodeURIComponent(thisLayoutName) + '.xml';
          downloadItem(currentSite + '-' + thisLayoutName + '.xml', url);
        });
        // Determine layout page link for CSS download
        var layoutPage =
          $item.find("a:contains('Layout Page'), a:contains('View Layout Page')").attr('href') ||
          $item.find('h3 a').attr('href');
        // Create CSS button
        var downloadCSS = $("<a href='#' class='button downloadCSS'><i class='fa fa-download'></i><span>CSS</span></a>");
        downloadCSS.on('click', function (e) {
          e.preventDefault();
          if (!layoutPage) return;
          var xhr = new XMLHttpRequest();
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
              var redirectedURL = xhr.responseURL;
              $.get(
                redirectedURL + '?bundle=off',
                function (data) {
                  var match = data.match(/\/App_Themes\/[^\"]*Layout[^\"]*/);
                  if (match) {
                    downloadItem(currentSite + '-' + thisLayoutName + '.css', match[0]);
                  }
                },
                'text'
              );
            }
          };
          xhr.open('GET', layoutPage, true);
          xhr.send();
        });
        // Append buttons
        $item.append(downloadXML, downloadCSS);
      });
      // Add bulk download button if not present
      var $sidebarButtons = $('.contentContainer .sidebar .buttons');
      if ($sidebarButtons.length && !$sidebarButtons.find('.cp-download-all').length) {
        var allBtn = $("<li class='cp-download-all'><a class='button bigButton nextAction' href='#'><span>Download All CSS and XML</span></a></li>");
        allBtn.on('click', function (e) {
          e.preventDefault();
          $('.downloadXML, .downloadCSS').each(function () {
            $(this).trigger('click');
          });
        });
        $sidebarButtons.append(allBtn);
      }
      window.__cp_downloadxmlcss_initialized = true;
    } catch (e) {
      // If any error occurs, fail silently to avoid breaking the page.
    }
  }

  /**
   * Public init function called by the loader. Ensures idempotent
   * initialisation and triggers insertion of download buttons.
   */
  function init() {
    if (window.DownloadXMLCSS.__loaded) return;
    window.DownloadXMLCSS.__loaded = true;
    insertDownloadButtons();
  }

  // Expose helper on the global object
  window.DownloadXMLCSS = window.DownloadXMLCSS || {};
  window.DownloadXMLCSS.__loaded = false;
  window.DownloadXMLCSS.init = init;

})();
