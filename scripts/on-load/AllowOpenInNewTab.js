// AllowOpenInNewTab.js - Sanitized CivicPlus Toolkit helper
//
// This helper ensures that anchor links marked with specific flags
// (data attribute, rel token or CSS class) will open in a new
// browser tab. It replaces legacy Chrome extension APIs with
// cross‑browser code, exposes a single `init()` function with an
// idempotent guard, and avoids auto‑running so that the loader
// controls when the helper executes.

(function () {
  'use strict';

  // If the helper has already been loaded on this page, do nothing.
  if (window.AllowOpenInNewTab && window.AllowOpenInNewTab.__loaded) {
    return;
  }

  /**
   * Set the appropriate attributes on an anchor element so that it
   * opens in a new tab with safe rel attributes. If the anchor
   * already targets a new tab, nothing is changed.
   * @param {HTMLElement} a The anchor element to modify.
   */
  function markAnchor(a) {
    if (!a || a.target === '_blank') return;
    try {
      a.setAttribute('target', '_blank');
      var rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
      if (rel.indexOf('noopener') === -1) rel.push('noopener');
      if (rel.indexOf('noreferrer') === -1) rel.push('noreferrer');
      a.setAttribute('rel', rel.join(' '));
    } catch (_) {
      // Silently ignore attribute errors.
    }
  }

  /**
   * Process a list of anchor elements and apply `markAnchor()` if
   * they have one of the recognised flags (`data-openinnewtab`,
   * `rel~="openinnewtab"` or class `allow-open-in-new-tab`).
   * @param {NodeList|Array<HTMLElement>} list
   */
  function handleAnchorsBatch(list) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (!a || !a.tagName || a.tagName.toLowerCase() !== 'a') continue;
      var rel = (a.getAttribute('rel') || '').split(/\s+/);
      var hasFlag = a.hasAttribute('data-openinnewtab') ||
                    rel.indexOf('openinnewtab') !== -1 ||
                    (a.classList && a.classList.contains('allow-open-in-new-tab'));
      if (hasFlag) {
        markAnchor(a);
      }
    }
  }

  /**
   * Install a delegated click handler on the document that opens
   * qualifying links in a new tab, even if site scripts intercept
   * click events. This handler runs in the capture phase to ensure
   * it fires before most other handlers.
   * @param {Document} doc
   */
  function installDelegatedClickHandler(doc) {
    if (doc.__cp_allow_open_delegated) return;
    doc.__cp_allow_open_delegated = true;
    doc.addEventListener('click', function (ev) {
      try {
        var el = ev.target;
        while (el && el !== doc) {
          if (el.tagName && el.tagName.toLowerCase() === 'a') break;
          el = el.parentNode;
        }
        if (!el || el === doc) return;
        var rel = (el.getAttribute('rel') || '').split(/\s+/);
        var hasFlag = el.hasAttribute('data-openinnewtab') ||
                      rel.indexOf('openinnewtab') !== -1 ||
                      (el.classList && el.classList.contains('allow-open-in-new-tab'));
        if (!hasFlag) return;
        if (el.target === '_blank') return;
        ev.preventDefault();
        ev.stopPropagation();
        var href = el.href || el.getAttribute('href') || '';
        if (href) {
          try {
            window.open(href, '_blank');
          } catch (_) {
            // Fallback: set target and simulate click
            el.setAttribute('target', '_blank');
            el.click();
          }
        }
      } catch (_) {
        // Ignore errors
      }
    }, true);
  }

  /**
   * Install a MutationObserver on the document to watch for anchors
   * being added or having attributes changed so that new links with
   * the flag are handled automatically.
   * @param {Document} doc
   */
  function installMutationObserver(doc) {
    if (!window.MutationObserver) return;
    if (doc.__cp_allow_open_observer_installed) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        try {
          if (m.type === 'attributes') {
            var tgt = m.target;
            if (tgt && tgt.tagName && tgt.tagName.toLowerCase() === 'a') {
              handleAnchorsBatch([tgt]);
            }
          } else if (m.addedNodes && m.addedNodes.length) {
            m.addedNodes.forEach(function (node) {
              if (!node) return;
              if (node.nodeType === 1) {
                if (node.tagName && node.tagName.toLowerCase() === 'a') {
                  handleAnchorsBatch([node]);
                } else if (node.querySelectorAll) {
                  var flagged = node.querySelectorAll('a[data-openinnewtab], a[rel~="openinnewtab"], a.allow-open-in-new-tab');
                  if (flagged && flagged.length) handleAnchorsBatch(flagged);
                }
              }
            });
          }
        } catch (_) {}
      });
    });
    observer.observe(doc.documentElement || doc.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'rel', 'class', 'data-openinnewtab']
    });
    doc.__cp_allow_open_observer_installed = true;
  }

  /**
   * Perform an initial scan of the document for existing anchors with
   * the open‑in‑new‑tab flag.
   */
  function initialScan() {
    var flagged = document.querySelectorAll && document.querySelectorAll(
      'a[data-openinnewtab], a[rel~="openinnewtab"], a.allow-open-in-new-tab'
    );
    if (flagged && flagged.length) {
      handleAnchorsBatch(flagged);
    }
  }

  /**
   * Public init function. Called by the loader. Installs the
   * delegated click handler, performs an initial scan, and
   * installs a MutationObserver to handle dynamically added links.
   */
  function init() {
    if (window.AllowOpenInNewTab.__loaded) return;
    window.AllowOpenInNewTab.__loaded = true;
    try {
      installDelegatedClickHandler(document);
      initialScan();
      installMutationObserver(document);
      // Also re-scan when the page becomes visible or the window
      // regains focus. This covers SPA pages that render after load.
      if (!document.__cp_allow_open_focus_hook) {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') initialScan();
        });
        window.addEventListener('focus', function () { initialScan(); });
        document.__cp_allow_open_focus_hook = true;
      }
    } catch (_) {
      // Ignore errors
    }
  }

  // Expose the helper on window
  window.AllowOpenInNewTab = window.AllowOpenInNewTab || {};
  window.AllowOpenInNewTab.init = init;

})();

