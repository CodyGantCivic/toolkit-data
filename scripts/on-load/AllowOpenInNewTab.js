// AllowOpenInNewTab.js
// CivicPlus - Allow open in new tab helper
// Exports: window.AllowOpenInNewTab.init()
// Auto-runs on CivicPlus sites when loaded by the loader

(function (global) {
  'use strict';

  const NS = 'AllowOpenInNewTab';
  const GUARD = '__CP_' + NS + '_LOADED_v1';

  if (global[GUARD]) return;
  global[GUARD] = true;

  // Minimal console wrappers (no noisy logs)
  function safeError() { try { console.error.apply(console, arguments); } catch (e) {} }

  // Utility: mark anchor to open in new tab (set attribute safely)
  function markAnchor($a) {
    try {
      if (!$a) return;
      // If already target blank, nothing to do
      if ($a.target === '_blank') return;
      // Set target attr
      $a.setAttribute('target', '_blank');
      // Add rel noopener/noreferrer if not present
      try {
        var rel = ($a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
        if (rel.indexOf('noopener') === -1) rel.push('noopener');
        if (rel.indexOf('noreferrer') === -1) rel.push('noreferrer');
        $a.setAttribute('rel', rel.join(' '));
      } catch (e) {}
    } catch (e) {
      safeError('[AllowOpenInNewTab] markAnchor error', e);
    }
  }

  // Handle a batch of anchor elements (NodeList or Array)
  function handleAnchorsBatch(list) {
    try {
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        try {
          var a = list[i];
          if (!a || !a.tagName || a.tagName.toLowerCase() !== 'a') continue;
          // conditions to consider this anchor as "should open in new tab"
          var hasFlag = a.hasAttribute('data-openinnewtab') ||
                        (a.getAttribute('rel') || '').split(/\s+/).indexOf('openinnewtab') !== -1 ||
                        (a.classList && a.classList.contains('allow-open-in-new-tab'));

          if (hasFlag) {
            markAnchor(a);
          }
        } catch (e) { /* continue */ }
      }
    } catch (e) {
      safeError('[AllowOpenInNewTab] handleAnchorsBatch error', e);
    }
  }

  // Delegated click fallback: for anchors that might be prevented from opening normally
  function installDelegatedClickHandler(doc) {
    try {
      if (doc.__cp_allow_open_delegated) return;
      doc.__cp_allow_open_delegated = true;

      doc.addEventListener('click', function (ev) {
        try {
          // find nearest anchor
          var el = ev.target;
          while (el && el !== doc) {
            if (el.tagName && el.tagName.toLowerCase() === 'a') break;
            el = el.parentNode;
          }
          if (!el || el === doc) return;
          // check the same flags as above
          var hasFlag = el.hasAttribute('data-openinnewtab') ||
                        (el.getAttribute('rel') || '').split(/\s+/).indexOf('openinnewtab') !== -1 ||
                        (el.classList && el.classList.contains('allow-open-in-new-tab'));
          if (!hasFlag) return;

          // If link has target blank already, let it proceed normally
          if (el.target === '_blank') return;

          // prevent default and open manually
          ev.preventDefault();
          ev.stopPropagation();
          try {
            var href = el.href || el.getAttribute('href') || '';
            if (!href) return;
            // allow relative URLs to open in same origin
            global.open(href, '_blank');
          } catch (e) {
            // fallback: set target and simulate click
            try { el.setAttribute('target', '_blank'); el.click(); } catch (_) {}
          }
        } catch (e) {
          // swallow non-fatal errors
        }
      }, true); // capture phase to get ahead of site handlers
    } catch (e) {
      safeError('[AllowOpenInNewTab] installDelegatedClickHandler error', e);
    }
  }

  // Mutation observer to watch for new anchors or attribute changes
  function installMutationObserver(root) {
    try {
      if (!window.MutationObserver) return;
      if (root.__cp_allow_open_observer_installed) return;
      var mo = new MutationObserver(function (mutations) {
        try {
          for (var i = 0; i < mutations.length; i++) {
            var m = mutations[i];
            if (m.type === 'attributes') {
              if (m.target && m.target.tagName && m.target.tagName.toLowerCase() === 'a') {
                // attribute changed on an anchor — handle it
                handleAnchorsBatch([m.target]);
              }
            } else {
              if (m.addedNodes && m.addedNodes.length) {
                for (var j = 0; j < m.addedNodes.length; j++) {
                  var node = m.addedNodes[j];
                  if (!node) continue;
                  if (node.nodeType === 1) {
                    if (node.tagName && node.tagName.toLowerCase() === 'a') handleAnchorsBatch([node]);
                    else {
                      // query anchors inside this node
                      var as = node.querySelectorAll && node.querySelectorAll('a[data-openinnewtab], a[rel~="openinnewtab"], a.allow-open-in-new-tab');
                      if (as && as.length) handleAnchorsBatch(as);
                    }
                  }
                }
              }
            }
          }
        } catch (e) { /* ignore */ }
      });

      mo.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['href', 'rel', 'class', 'data-openinnewtab']
      });

      root.__cp_allow_open_observer_installed = true;
    } catch (e) {
      safeError('[AllowOpenInNewTab] installMutationObserver error', e);
    }
  }

  // initial scan to mark existing anchors
  function initialScan() {
    try {
      var all = document.querySelectorAll && document.querySelectorAll('a[data-openinnewtab], a[rel~="openinnewtab"], a.allow-open-in-new-tab');
      if (all && all.length) handleAnchorsBatch(all);
    } catch (e) {
      safeError('[AllowOpenInNewTab] initialScan error', e);
    }
  }

  // The public init function (idempotent)
  function init() {
    try {
      if (init.__cp_done) return;
      init.__cp_done = true;

      // Attach delegated click handler (capture) so it works even if handler attached
      installDelegatedClickHandler(document);

      // Initial scan
      initialScan();

      // Install observer for dynamic content
      installMutationObserver(document);

      // Best-effort: also scan on visibility/focus in case SPA renders after load
      try {
        if (!document.__cp_allow_open_focus_hook) {
          document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') initialScan();
          });
          window.addEventListener('focus', function () { initialScan(); });
          document.__cp_allow_open_focus_hook = true;
        }
      } catch (e) {}

    } catch (e) {
      safeError('[AllowOpenInNewTab] init error', e);
    }
  }

  // Auto-run: only on CivicPlus sites if loader provided detection; otherwise run immediately but safe
  (function autorun() {
    try {
      // prefer loader detection
      if (global.CPToolkit && typeof global.CPToolkit.isCivicPlusSite === 'function') {
        Promise.resolve(global.CPToolkit.isCivicPlusSite()).then(function (ok) {
          if (ok) init();
        }).catch(function () { init(); });
      } else {
        // run quickly — helper is safe to run on any page
        init();
      }
    } catch (e) { /* ignore */ }
  })();

  // export
  try { global.AllowOpenInNewTab = global.AllowOpenInNewTab || {}; global.AllowOpenInNewTab.init = init; } catch (e) {}

})(window);

