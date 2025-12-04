// Optimised GraphicLinkHelper for the CivicPlus Toolkit
//
// This version eliminates the dependency on jQuery and polling.  It uses
// native DOM APIs and a capture‑phase click listener to adjust graphic link
// anchors safely.  When links contain invalid or javascript: href values,
// they are corrected asynchronously to avoid synchronous re‑entry into
// site handlers.  It also wraps selected FancyButton functions to defer
// their execution, mimicking the behaviour of the original extension but
// without jQuery.  The helper exports a single `init()` method and is
// idempotent (will run only once per page).

(function (global) {
  'use strict';

  const NAME = 'GraphicLinkHelper';
  // Expose a namespace on the window and guard against multiple loads
  global[NAME] = global[NAME] || {};
  if (global[NAME].__loaded) {
    return;
  }

  /**
   * Install a capture‑phase click lock on the document.  This prevents
   * synchronous re‑entry into site click handlers by ignoring repeated
   * clicks on the same anchor for a brief period.  It mirrors the logic
   * from the original helper using a WeakMap to track anchors that have
   * recently triggered.
   */
  function installCaptureLock() {
    try {
      if (document.__cp_graphic_capture_installed) return;
      document.__cp_graphic_capture_installed = true;
      const lockMap = new WeakMap();
      const LOCK_TTL = 600;
      document.addEventListener(
        'click',
        function (e) {
          try {
            let el = e.target;
            // Traverse up the DOM until we find an anchor
            while (el && el !== document) {
              if (el.tagName && el.tagName.toLowerCase() === 'a') break;
              el = el.parentNode;
            }
            if (!el || el === document) return;
            // If this anchor was recently clicked, block the event
            if (lockMap.get(el)) {
              e.stopImmediatePropagation();
              e.preventDefault();
              return;
            }
            lockMap.set(el, true);
            // Clear the lock after a small delay
            setTimeout(() => {
              try {
                lockMap.delete(el);
              } catch (_) {
                /* ignore */
              }
            }, LOCK_TTL);
          } catch (_) {
            // ignore errors silently
          }
        },
        true
      );
    } catch (_) {
      // ignore installation errors
    }
  }

  /**
   * Wrap a function on an object so that it executes asynchronously on the
   * next tick.  This helps prevent synchronous recursion when site code
   * calls these functions during DOM mutations.  If the function is
   * already wrapped, nothing happens.
   *
   * @param {Object} obj The object containing the function.
   * @param {string} name The name of the function to wrap.
   */
  function wrapIfFunction(obj, name) {
    try {
      if (!obj || typeof obj[name] !== 'function') return;
      if (obj[name].__cp_wrapped) return;
      const original = obj[name];
      obj[name] = function (...args) {
        setTimeout(() => {
          try {
            original.apply(this, args);
          } catch (_) {
            /* ignore */
          }
        }, 0);
      };
      obj[name].__cp_wrapped = true;
    } catch (_) {
      // ignore wrap errors
    }
  }

  /**
   * Attach a capture‑phase click handler that scans anchor elements for
   * invalid or missing `href` attributes.  If an anchor has no href or
   * a javascript: scheme, the handler schedules a change to set the
   * href to `#`.  It uses delegation by listening on the document and
   * traversing the target’s ancestors to find the anchor.  Because
   * modifications are deferred with `setTimeout`, this avoids
   * interfering with the site’s own event handling.
   */
  function attachSafeDelegatedHandlers() {
    try {
      if (document.__cp_graphic_handlers_attached) return;
      document.__cp_graphic_handlers_attached = true;
      document.addEventListener(
        'click',
        function (ev) {
          try {
            let el = ev.target;
            while (el && el !== document) {
              if (el.tagName && el.tagName.toLowerCase() === 'a') break;
              el = el.parentNode;
            }
            if (!el || el === document) return;
            const href = (el.getAttribute('href') || '').trim();
            const needsUpdate = !href || href.toLowerCase().startsWith('javascript:');
            if (needsUpdate) {
              // Defer the update to avoid synchronous recursion
              setTimeout(() => {
                try {
                  // Only update if the href is still invalid
                  const currentHref = (el.getAttribute('href') || '').trim();
                  if (!currentHref || currentHref.toLowerCase().startsWith('javascript:')) {
                    el.setAttribute('href', '#');
                  }
                } catch (_) {
                  /* ignore */
                }
              }, 0);
            }
          } catch (_) {
            // ignore errors
          }
        },
        true
      );
      // Wrap FancyButton functions (if present) to defer execution
      try {
          wrapIfFunction(global.FancyButton, 'triggerOnInsert');
          wrapIfFunction(global.FancyButton, 'updateDestinationElement');
      } catch (_) {}
      // Also wrap any global functions with these names
      wrapIfFunction(global, 'triggerOnInsert');
      wrapIfFunction(global, 'updateDestinationElement');
    } catch (_) {
      // ignore handler attachment errors
    }
  }

  /**
   * Initialise the GraphicLinkHelper.  Called by the Toolkit loader.  It
   * installs the capture‑lock and the safe anchor handler, then marks the
   * helper as loaded.
   */
  function init() {
    if (global[NAME].__loaded) return;
    global[NAME].__loaded = true;
    try {
      installCaptureLock();
      attachSafeDelegatedHandlers();
    } catch (_) {
      // ignore init errors
    }
  }

  // Export the init function
  global[NAME].init = init;
})(window);
