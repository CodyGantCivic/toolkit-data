// DownloadXMLCSS.js
// Version: 1.0.0
// Exports: window.DownloadXMLCSS.init()
// Purpose: Add download XML / CSS button UI on Layouts listing page.
// Idempotent, waits for jQuery/DOM, page-safe.

(function () {
  'use strict';

  var NAME = 'DownloadXMLCSS';
  var GUARD = '__CP_' + NAME + '_LOADED_v1';

  if (window[GUARD]) return;
  window.DownloadXMLCSS = window.DownloadXMLCSS || { __loaded: false };

  function waitFor(fn, timeout, interval) {
    timeout = typeof timeout === 'number' ? timeout : 5000;
    interval = typeof interval === 'number' ? interval : 100;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (fn()) return resolve(true);
        } catch (e) { /* ignore */ }
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  function createButton($container) {
    try {
      if (!$container || !$container.length) return null;
      // avoid duplicate
      if ($container.find('.cp-download-xml-css').length) return $container.find('.cp-download-xml-css');

      var $btn = $('<a class="button cp-download-xml-css" href="#" title="Download XML and CSS"><span>Download XML / CSS</span></a>');
      $btn.css({ marginLeft: '8px' });
      $container.append($btn);
      return $btn;
    } catch (e) {
      console.error('[DownloadXMLCSS] createButton error', e);
      return null;
    }
  }

  function downloadTextAsFile(filename, text) {
    try {
      var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        // IE fallback
        window.navigator.msSaveOrOpenBlob(blob, filename);
        return;
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        try { document.body.removeChild(a); } catch (e) { /* ignore */ }
      }, 150);
    } catch (e) {
      console.error('[DownloadXMLCSS] download error', e);
    }
  }

  async function init() {
    if (window[GUARD]) return;
    window[GUARD] = true;
    window.DownloadXMLCSS.__loaded = true;

    // quick page check: only run on layouts index page
    try {
      var path = (window.location.pathname || '').toLowerCase();
      if (path !== '/admin/designcenter/layouts' && path !== '/admin/designcenter/layouts/') {
        return;
      }
    } catch (e) {
      return;
    }

    var ok = await waitFor(function () { return !!window.jQuery && document.readyState !== 'loading'; }, 6000, 100);
    if (!ok) return;
    var $ = window.jQuery;

    try {
      // attach into any header / action toolbar present
      $(function () {
        try {
          // find a sensible container for action buttons
          var $toolbar = $('.buttons, .actions, .page-actions').first();
          if (!$toolbar || !$toolbar.length) {
            // fallback: header area
            $toolbar = $('h1, .page-header').first();
          }
          var $btn = createButton($toolbar);
          if (!$btn || !$btn.length) return;

          $btn.on('click', function (ev) {
            ev.preventDefault();
            try {
              // attempt to fetch XML and CSS from known endpoints (best-effort)
              var origin = window.location.origin;
              // Layouts export endpoint: example path assumptions — adjust if needed
              var layoutId = $('#ctl00_ContentPlaceHolder1_rcbLayouts input[type=hidden]').val() || '';
              // fallback: attempt to read any inline code block
              var xmlText = $('code').first().text() || '';
              // If xml empty, attempt to request the current layout's structure (best-effort)
              if (!xmlText && layoutId) {
                fetch(origin + '/Admin/DesignCenter/Layouts/GetXml?layoutId=' + encodeURIComponent(layoutId), { cache: 'no-store' })
                  .then(function (r) { return r.ok ? r.text() : ''; })
                  .then(function (txt) {
                    try {
                      downloadTextAsFile('layout-' + (layoutId || 'export') + '.xml', txt || xmlText || '');
                    } catch (errd) { console.error('[DownloadXMLCSS] fetch download failed', errd); }
                  }).catch(function (err) { console.error('[DownloadXMLCSS] fetch error', err); });
                // attempt CSS download separately (best-effort)
                try {
                  fetch(origin + '/Admin/DesignCenter/Layouts/GetCss?layoutId=' + encodeURIComponent(layoutId), { cache: 'no-store' })
                    .then(function (r) { return r.ok ? r.text() : ''; })
                    .then(function (css) {
                      if (css) downloadTextAsFile('layout-' + (layoutId || 'export') + '.css', css);
                    }).catch(function () { /* ignore */ });
                } catch (err) { /* ignore */ }
                return;
              }

              // If we have inline xmlText, download it directly
              if (xmlText) {
                downloadTextAsFile('layout-export.xml', xmlText);
              } else {
                alert('Unable to locate layout XML to download.');
              }
            } catch (err) {
              console.error('[DownloadXMLCSS] click handler error', err);
            }
          });
        } catch (err) {
          console.error('[DownloadXMLCSS] init error', err);
        }
      });
    } catch (e) {
      console.error('[DownloadXMLCSS] setup error', e);
    }
  }

  // expose init and auto-run
  try { window.DownloadXMLCSS = window.DownloadXMLCSS || {}; window.DownloadXMLCSS.init = init; } catch (e) { /* ignore */ }
  try { window.DownloadXMLCSS.init(); } catch (e) { console.error('[DownloadXMLCSS] autorun error', e); }

})();
