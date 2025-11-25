// XMLMajorChangeAlert.js
// Aggressive init: runs immediately on CivicPlus + /Admin/DesignCenter/Layouts/Modify/
// Exports: window.XMLMajorChangeAlert.init()
// Idempotent, safe, SPA-friendly.

(function () {
  'use strict';

  const NS = 'XMLMajorChangeAlert';
  const GUARD = '__CP_' + NS + '_LOADED_v4';

  if (window[GUARD]) return;
  window[GUARD] = true;

  window.XMLMajorChangeAlert = window.XMLMajorChangeAlert || { __loaded: false };

  function safeLog() { try { /* silent by default */ } catch (e) {} }
  function safeErr() { try { console.error.apply(console, arguments); } catch (e) {} }

  function waitFor(test, timeout = 5000, interval = 80) {
    const start = Date.now();
    return new Promise(resolve => {
      (function check() {
        try {
          if (test()) return resolve(true);
        } catch (e) {}
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  function parseXml(xml) {
    try { return new DOMParser().parseFromString(xml || '', 'text/xml'); } catch (e) { return null; }
  }
  function extractIds(xml) {
    const doc = parseXml(xml);
    if (!doc) return [];
    return Array.from(doc.querySelectorAll('*')).map(n => {
      try { return n.getAttribute && n.getAttribute('id'); } catch (e) { return null; }
    }).filter(Boolean);
  }
  function findMalformed(xml) {
    const doc = parseXml(xml);
    if (!doc) return [];
    return Array.from(doc.querySelectorAll('[cpRole="contentContainer"]'))
      .filter(n => n.children && n.children.length)
      .map(n => ({ id: n.getAttribute('id') || '(no id)', childIds: Array.from(n.children).map(c => c.id || '(no id)') }));
  }

  // UI helpers
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
    // fallback
    try {
      var el = document.getElementById('toolkitAlert');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toolkitAlert';
        el.style.margin = '6px 0';
        el.style.fontSize = '13px';
        (document.body || document.documentElement).insertBefore(el, (document.body || document.documentElement).firstChild);
      }
      return window.jQuery ? window.jQuery(el) : null;
    } catch (e) {
      return null;
    }
  }

  // Internal state
  let originalXml = '';
  let originalIds = [];

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
      const file = el && el.files && el.files[0];
      if (!file) {
        try { $('#toolkitAlert').text(''); } catch (_) {}
        return;
      }
      const reader = new FileReader();
      reader.onload = function (ev) {
        try {
          const raw = ev.target && ev.target.result ? ev.target.result : '';
          const idx = raw.indexOf('<?xml');
          const newXml = idx >= 0 ? raw.slice(idx) : raw;
          const newIds = extractIds(newXml).sort();
          const removed = originalIds.filter(id => !newIds.includes(id));

          const $alert = ensureAlert($);
          if (removed.length) {
            const diff = removed.join(', ');
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

          // malformed new containers
          const mal = findMalformed(newXml);
          mal.forEach(m => {
            try {
              alert('The chosen XML is malformed:\n\n' + m.id + ' contains:\n\n' + m.childIds.join('\n') + '\n\nContent containers must not contain elements.');
            } catch (err) {}
          });

        } catch (e) {
          safeErr('[XMLMajorChangeAlert] file processing error', e);
        }
      };
      reader.readAsText(file);
    } catch (e) {
      safeErr('[XMLMajorChangeAlert] handleFileInput error', e);
    }
  }

  function attachHandlers($) {
    try {
      if ($(document.body).data('__cp_xml_handlers')) return;
      $(document.body).data('__cp_xml_handlers', true);

      // delegated change handler - works if input is replaced later
      $(document).on('change.XMLMajorChangeAlert', '#structureFile', function () { handleFileInput(this, window.jQuery); });

      // show errors immediately
      $(document).on('DOMSubtreeModified.XMLMajorChangeAlert', '#ErrorMessage', function () {
        try {
          const t = $(this).text().trim();
          if (t) alert(t);
        } catch (_) {}
      });

      refreshOriginal($);
    } catch (e) {
      safeErr('[XMLMajorChangeAlert] attachHandlers error', e);
    }
  }

  function installMutationObserver($) {
    try {
      const root = document.body || document.documentElement;
      if (!root || root.__cp_xml_observer_installed) return;
      const mo = new MutationObserver(function (mutations) {
        try {
          for (let m of mutations) {
            if (m.addedNodes && m.addedNodes.length) {
              for (let node of m.addedNodes) {
                if (!node) continue;
                if (node.id === 'structureFile' || (node.querySelector && node.querySelector('#structureFile'))) {
                  refreshOriginal($);
                  attachHandlers($);
                  return;
                }
              }
            }
          }
        } catch (e) {}
      });
      mo.observe(root, { childList: true, subtree: true });
      root.__cp_xml_observer_installed = true;
    } catch (e) {
      safeErr('[XMLMajorChangeAlert] installMutationObserver error', e);
    }
  }

  // A small aggressive fallback so the moment the element exists we attach (no refresh)
  function rafAndIntervalFallback($) {
    try {
      let attempts = 0;
      (function loop() {
        try {
          if (document.querySelector('#structureFile')) { refreshOriginal($); attachHandlers($); return; }
        } catch (e) {}
        attempts++;
        if (attempts < 200) {
          requestAnimationFrame(loop);
        } else {
          const id = setInterval(function () {
            try {
              if (document.querySelector('#structureFile')) { refreshOriginal($); attachHandlers($); clearInterval(id); }
            } catch (e) {}
          }, 200);
        }
      })();
    } catch (e) {
      safeErr('[XMLMajorChangeAlert] raf fallback error', e);
    }
  }

  async function run() {
    // Only run on the target path
    try {
      const path = (location.pathname || '').toLowerCase();
      if (!path.includes('/admin/designcenter/layouts/modify')) return;
    } catch (e) { return; }

    // If loader gives detection, use it; otherwise proceed.
    try {
      if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
        try {
          const ok = await window.CPToolkit.isCivicPlusSite();
          if (!ok) return;
          // minimal log from loader already prints "CivicPlus detected"
        } catch (e) {
          // fallthrough
        }
      }
    } catch (e) {}

    // Wait for jQuery, but short timeout — we fallback aggressively
    const ok = await waitFor(() => !!window.jQuery && document.readyState !== 'loading', 3000, 80);
    if (!ok) {
      // still attempt fallback: attach later when jQuery becomes available
      (function pollJQ() {
        const t = setInterval(function () {
          if (window.jQuery) {
            clearInterval(t);
            try { attachHandlers(window.jQuery); } catch (e) { safeErr(e); }
          }
        }, 200);
      })();
    } else {
      attachHandlers(window.jQuery);
    }

    // add mutation observer + fallback to ensure immediate attachment
    try { installMutationObserver(window.jQuery || window.$); } catch (e) {}
    try { rafAndIntervalFallback(window.jQuery || window.$); } catch (e) {}

    // also re-run on visibility/focus (helps SPA)
    if (!document.__cp_xml_visibility_hook) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          try { refreshOriginal(window.jQuery || window.$); attachHandlers(window.jQuery || window.$); } catch (e) {}
        }
      });
      window.addEventListener('focus', function () {
        try { refreshOriginal(window.jQuery || window.$); attachHandlers(window.jQuery || window.$); } catch (e) {}
      });
      document.__cp_xml_visibility_hook = true;
    }
  }

  // Expose
  window.XMLMajorChangeAlert.init = run;

  // Auto-run (immediate)
  try { run(); } catch (e) { safeErr('[XMLMajorChangeAlert] autorun error', e); }

})();
