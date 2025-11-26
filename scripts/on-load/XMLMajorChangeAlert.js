// Sanitized XMLMajorChangeAlert helper for CivicPlus Toolkit
// Purpose: alert administrators when uploading an XML that removes or misplaces content containers.
// Exports: window.XMLMajorChangeAlert.init()

(function (global) {
  'use strict';

  var NAME = 'XMLMajorChangeAlert';
  global[NAME] = global[NAME] || {};
  if (global[NAME].__loaded) return;

  // waitFor: resolves when condition is true or timeout reached
  function waitFor(test, timeout, interval) {
    timeout = typeof timeout === 'number' ? timeout : 5000;
    interval = typeof interval === 'number' ? interval : 80;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (test()) return resolve(true);
        } catch (e) {}
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  // XML parsing utilities
  function parseXml(xml) {
    try { return new DOMParser().parseFromString(xml || '', 'text/xml'); } catch (e) { return null; }
  }
  function extractIds(xml) {
    var doc = parseXml(xml);
    if (!doc) return [];
    return Array.from(doc.querySelectorAll('*'))
      .map(function (n) { try { return n.getAttribute && n.getAttribute('id'); } catch (_) { return null; } })
      .filter(Boolean);
  }
  function findMalformed(xml) {
    var doc = parseXml(xml);
    if (!doc) return [];
    return Array.from(doc.querySelectorAll('[cpRole="contentContainer"]'))
      .filter(function (n) { return n.children && n.children.length; })
      .map(function (n) {
        return {
          id: n.getAttribute('id') || '(no id)',
          childIds: Array.from(n.children).map(function (c) { return c.id || '(no id)'; })
        };
      });
  }

  // Create or find the alert element near the XML structure input
  function ensureAlert($) {
    try {
      var $parent = $('#structureFile').parent();
      if ($parent && $parent.length) {
        if ($('#toolkitAlert').length === 0) {
          $parent.append('<div id="toolkitAlert" style="margin:6px 0;font-size:13px"></div>');
        }
        return $('#toolkitAlert');
      }
    } catch (e) {}
    // fallback: create a bare element if jQuery is not available yet
    try {
      var el = document.getElementById('toolkitAlert');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toolkitAlert';
        el.style.margin = '6px 0';
        el.style.fontSize = '13px';
        (document.body || document.documentElement).insertBefore(el, (document.body || document.documentElement).firstChild);
      }
      return global.jQuery ? global.jQuery(el) : null;
    } catch (e) {
      return null;
    }
  }

  // Track original XML and container IDs
  var originalXml = '';
  var originalIds = [];
  function refreshOriginal($) {
    try {
      originalXml = ($('code').first().text() || '').trim();
      originalIds = extractIds(originalXml).sort();
    } catch (e) {
      originalXml = '';
      originalIds = [];
    }
  }

  function handleFileInput(el, $) {
    try {
      var file = el && el.files && el.files[0];
      if (!file) {
        try { $('#toolkitAlert').text(''); } catch (_) {}
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var raw = ev.target && ev.target.result ? ev.target.result : '';
          var idx = raw.indexOf('<?xml');
          var newXml = idx >= 0 ? raw.slice(idx) : raw;
          var newIds = extractIds(newXml).sort();
          var removed = originalIds.filter(function (id) { return newIds.indexOf(id) < 0; });
          var $alert = ensureAlert($);
          if (removed.length) {
            var diff = removed.join(', ');
            if ($alert && $alert.length) {
              $alert.html('Warning: The new XML is missing containers:<br><br>' + diff).css('color', 'red');
            }
            $('a.button.save').css({ backgroundColor: '#B33A3A', borderBottomColor: '#792327', color: '#fff' });
            $('a.button.save span').text('Save ignoring XML warning');
          } else {
            if ($alert && $alert.length) $alert.text('This XML keeps all existing containers.').css('color', 'green');
            $('a.button.save').css({ backgroundColor: '', borderBottomColor: '', color: '' });
            $('a.button.save span').text('Save');
          }
          // Check for malformed containers in the new XML
          var mal = findMalformed(newXml);
          mal.forEach(function (m) {
            try {
              alert('The chosen XML is malformed:\n\n' + m.id + ' contains:\n\n' + m.childIds.join('\n') + '\n\nContent containers must not contain elements.');
            } catch (_) {}
          });
        } catch (e) {}
      };
      reader.readAsText(file);
    } catch (e) {}
  }

  function attachHandlers($) {
    try {
      if ($(document.body).data('__cp_xml_handlers')) return;
      $(document.body).data('__cp_xml_handlers', true);
      $(document).on('change.XMLMajorChangeAlert', '#structureFile', function () { handleFileInput(this, global.jQuery || global.$); });
      $(document).on('DOMSubtreeModified.XMLMajorChangeAlert', '#ErrorMessage', function () {
        try {
          var t = $(this).text().trim();
          if (t) alert(t);
        } catch (_) {}
      });
      refreshOriginal($);
    } catch (e) {}
  }

  function installMutationObserver($) {
    try {
      var root = document.body || document.documentElement;
      if (!root || root.__cp_xml_observer_installed) return;
      var mo = new MutationObserver(function (mutations) {
        try {
          for (var i = 0; i < mutations.length; i++) {
            var m = mutations[i];
            if (m.addedNodes && m.addedNodes.length) {
              for (var j = 0; j < m.addedNodes.length; j++) {
                var node = m.addedNodes[j];
                if (!node) continue;
                try {
                  if (node.id === 'structureFile' || (node.querySelector && node.querySelector('#structureFile'))) {
                    refreshOriginal($);
                    attachHandlers($);
                    return;
                  }
                } catch (_) {}
              }
            }
          }
        } catch (e) {}
      });
      mo.observe(root, { childList: true, subtree: true });
      root.__cp_xml_observer_installed = true;
    } catch (e) {}
  }

  // Fallback: attempt to attach handlers as soon as the structure input appears
  function rafAndIntervalFallback($) {
    try {
      var attempts = 0;
      (function loop() {
        try {
          if (document.querySelector('#structureFile')) { refreshOriginal($); attachHandlers($); return; }
        } catch (e) {}
        attempts++;
        if (attempts < 200) {
          requestAnimationFrame(loop);
        } else {
          var id = setInterval(function () {
            try {
              if (document.querySelector('#structureFile')) { refreshOriginal($); attachHandlers($); clearInterval(id); }
            } catch (e) {}
          }, 200);
        }
      })();
    } catch (e) {}
  }

  // The init function called by the loader
  async function init() {
    if (global[NAME].__loaded) return;
    global[NAME].__loaded = true;
    // Only run on DesignCenter layout modify page
    try {
      var p = (location.pathname || '').toLowerCase();
      if (p.indexOf('/admin/designcenter/layouts/modify') === -1) return;
    } catch (e) { return; }
    // Wait for jQuery for up to 3 seconds; fallback if not ready
    var ok = await waitFor(function () { return !!global.jQuery && document.readyState !== 'loading'; }, 3000, 80);
    var $ = global.jQuery || global.$;
    if (ok) {
      attachHandlers($);
    } else {
      // Poll for jQuery; attach when available
      (function poll() {
        var poller = setInterval(function () {
          if (global.jQuery) {
            clearInterval(poller);
            try { attachHandlers(global.jQuery); } catch (e) {}
          }
        }, 200);
      })();
    }
    // Install mutation observer and fallback to catch dynamic insertion
    installMutationObserver($ || global.jQuery);
    rafAndIntervalFallback($ || global.jQuery);
    // Re-run on visibility or focus to refresh original
    if (!document.__cp_xml_visibility_hook) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          try { refreshOriginal(global.jQuery || global.$); attachHandlers(global.jQuery || global.$); } catch (e) {}
        }
      });
      window.addEventListener('focus', function () {
        try { refreshOriginal(global.jQuery || global.$); attachHandlers(global.jQuery || global.$); } catch (e) {}
      });
      document.__cp_xml_visibility_hook = true;
    }
  }

  // Export init
  global[NAME].init = init;

})(window);
