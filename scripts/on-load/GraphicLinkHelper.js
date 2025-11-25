// GraphicLinkHelper.js
// Patched: defensive guards to prevent recursive DOM-triggered handler loops
// Exports: window.GraphicLinkHelper.init()
// Purpose: Make FancyButton/Graphic Link fixes safe against re-entrancy and infinite recursion

(function (global) {
  'use strict';

  var N = 'GraphicLinkHelper';
  var GUARD = '__CP_' + N + '_LOADED_v1';

  if (global[GUARD]) return;
  global[N] = global[N] || { __loaded: false };

  // small utility: safe console wrapper
  function safeLog() {
    try { if (console && console.log) console.log.apply(console, arguments); } catch (e) {}
  }
  function safeError() {
    try { if (console && console.error) console.error.apply(console, arguments); } catch (e) {}
  }

  // Wait-for helper
  function waitFor(cond, timeout, interval) {
    timeout = typeof timeout === 'number' ? timeout : 5000;
    interval = typeof interval === 'number' ? interval : 100;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (cond()) return resolve(true);
        } catch (e) { /* ignore */ }
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  // runGuarded: element-level reentrancy guard + deferred DOM updates helper
  function runGuarded($el, key, fn) {
    try {
      if (!$el || !$el.length) return;
      if ($el.data && $el.data(key)) return; // already running -> skip
      try { $el.data && $el.data(key, true); } catch (e) {}
      try {
        // fn receives scheduleDomUpdate(updater) helper
        fn(function scheduleDomUpdate(updater) {
          // defer to next tick to avoid re-entrancy during same call stack
          setTimeout(function () {
            try { updater(); } catch (err) { safeError('[GraphicLinkHelper] deferred updater failed', err); }
          }, 0);
        });
      } finally {
        // ensure removal after a tick so other events can still run later
        setTimeout(function () { try { $el.removeData && $el.removeData(key); } catch (_) {} }, 0);
      }
    } catch (err) {
      safeError('[GraphicLinkHelper] runGuarded error', err);
      try { $el.removeData && $el.removeData(key); } catch (_) {}
    }
  }

  // Quick runtime hotfix for anchors: capture-phase lock to prevent synchronous re-entry
  // This prevents immediate re-triggering of click handlers when other code modifies the DOM synchronously.
  function installCaptureLock() {
    try {
      // handler uses a WeakMap to avoid leaking memory for many elements
      var lockMap = new WeakMap();
      var LOCK_TTL = 600; // ms

      function onCaptureClick(e) {
        try {
          var el = e.target;
          // find nearest anchor or element we care about
          while (el && el !== document) {
            if (el.tagName && el.tagName.toLowerCase() === 'a') break;
            el = el.parentNode;
          }
          if (!el || el === document) return;
          // if locked, stop the event now
          if (lockMap.get(el)) {
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
          }
          // set lock for this element for a short period
          lockMap.set(el, true);
          setTimeout(function () { try { lockMap.delete(el); } catch (_) {} }, LOCK_TTL);
        } catch (err) {
          // swallow capture errors
        }
      }

      // add capture-phase listener once (idempotent)
      if (!document.__cp_graphic_capture_installed) {
        document.addEventListener('click', onCaptureClick, true);
        document.__cp_graphic_capture_installed = true;
      }
    } catch (e) {
      safeError('[GraphicLinkHelper] installCaptureLock failed', e);
    }
  }

  // Ensure handlers are attached idempotently and safely
  function attachSafeDelegatedHandlers($) {
    try {
      // Guard so we only attach once
      if ($(document.body).data('__cp_graphic_handlers_attached')) return;
      $(document.body).data('__cp_graphic_handlers_attached', true);

      // Example: fix up fancy button anchors inside listing items.
      // Use delegated handler on container; adjust selector to match site structure.
      var containerSelector = '.listing,.contentContainer';
      var anchorSelector = 'a'; // narrow selector if you have more specific class, replace here

      // Delegated click handler wrapped with runGuarded to avoid recursion
      $(document).on('click.GraphicLinkHelper', containerSelector + ' ' + anchorSelector, function (ev) {
        var $a = $(this);
        // Only operate on anchors that look like the ones we target (safeguard)
        try {
          // Skip if anchor already processed flag present
          if ($a.data && $a.data('__cp_graphic_skip')) return;
        } catch (err) {}

        // Wrap the original logic in guarded runner
        runGuarded($a, 'cp-graphic-handler', function (scheduleDomUpdate) {
          try {
            // Preserve original semantics: call original site handlers (do nothing here),
            // but perform any DOM adjustments in deferred updater.
            // Example adjustments that previously caused recursion:
            // - moving elements via .append/.html
            // - calling FancyButton.triggerOnInsert or updateDestinationElement that use .html()
            //
            // If you have existing helper logic, move DOM-updating lines into scheduleDomUpdate.
            //
            // If there is specific code to run here (the previous GraphicLinkHelper had small fixes),
            // perform read-only checks now and defer DOM writes:

            // READ-ONLY: inspect attributes / compute targets synchronously
            var href = $a.attr('href') || '';
            var needsUpdate = false;
            // detect some condition where you want to switch href or add class
            try {
              // example: if href contains 'javascript:' or is missing, we may want to update a destination
              if (!href || href.indexOf('javascript:') === 0) {
                needsUpdate = true;
              }
            } catch (e) { /* ignore detection errors */ }

            // If we need to perform DOM mutation, do it deferred
            if (needsUpdate) {
              scheduleDomUpdate(function () {
                try {
                  // Example mutation: set a safe fallback href (this is an example; adapt to your logic)
                  if (!($a.attr && $a.attr('href'))) return;
                  var currentHref = $a.attr('href') || '#';
                  if (!currentHref || currentHref.indexOf('javascript:') === 0) {
                    $a.attr('href', '#');
                  }
                  // If you need to call site functions that internally use .html() or inject markup:
                  // call them here (deferred) so they cannot retrigger our handler synchronously.
                  // e.g. if (typeof window.triggerOnInsert === 'function') window.triggerOnInsert(someElement);
                } catch (mutErr) {
                  safeError('[GraphicLinkHelper] deferred mutation error', mutErr);
                }
              });
            }

            // If nothing to change, let default handlers run
          } catch (handlerErr) {
            safeError('GraphicLinkHelper: wrapper handler error', handlerErr);
          }
        });
      });

      // Additionally: wrap possible site functions that caused recursion if they exist
      // (best-effort, non-breaking): create a safe wrapper around known functions
      // e.g., FancyButton.triggerOnInsert or updateDestinationElement — detect and wrap
      try {
        var wrapIfFunction = function (obj, name) {
          try {
            if (!obj || typeof obj[name] !== 'function') return;
            if (obj[name].__cp_wrapped) return;
            var original = obj[name];
            obj[name] = function () {
              var args = Array.prototype.slice.call(arguments);
              var ctx = this;
              // defer invocation to avoid synchronous recursion into jQuery.html-prefilter
              setTimeout(function () {
                try { original.apply(ctx, args); } catch (e) { safeError('[GraphicLinkHelper] wrapped ' + name + ' error', e); }
              }, 0);
            };
            obj[name].__cp_wrapped = true;
          } catch (e) { /* ignore wrapping errors */ }
        };

        // Common patterns: FancyButton object or global functions
        if (global.FancyButton && typeof global.FancyButton === 'object') {
          wrapIfFunction(global.FancyButton, 'triggerOnInsert');
          wrapIfFunction(global.FancyButton, 'updateDestinationElement');
        }
        // If functions exist globally by name, attempt to wrap them too (non-breaking)
        wrapIfFunction(global, 'triggerOnInsert');
        wrapIfFunction(global, 'updateDestinationElement');
      } catch (wrapErr) {
        safeError('[GraphicLinkHelper] function-wrap error', wrapErr);
      }

    } catch (e) {
      safeError('[GraphicLinkHelper] attachSafeDelegatedHandlers failed', e);
    }
  }

  // Main init: wait for jQuery then install protections and attach handlers
  function init() {
    if (global[GUARD]) return;
    global[GUARD] = true;
    global[N].__loaded = true;

    waitFor(function () { return !!global.jQuery; }, 6000, 100).then(function (ok) {
      if (!ok) {
        safeError('[GraphicLinkHelper] jQuery not available, aborting handler install');
        return;
      }
      var $ = global.jQuery;
      try {
        installCaptureLock();              // prevent immediate re-entry (capture-phase)
        attachSafeDelegatedHandlers($);    // attach delegated click handlers (guarded)
        safeLog('GraphicLinkHelper: handlers installed safely');
      } catch (err) {
        safeError('[GraphicLinkHelper] init failed', err);
      }
    }).catch(function (err) {
      safeError('[GraphicLinkHelper] waitFor error', err);
    });
  }

  // Expose init and auto-run (safe)
  try { global.GraphicLinkHelper = global.GraphicLinkHelper || {}; global.GraphicLinkHelper.init = init; } catch (e) {}
  try { init(); } catch (e) { safeError('[GraphicLinkHelper] autorun failed', e); }

})(window);
