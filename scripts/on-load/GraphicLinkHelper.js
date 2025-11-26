// Sanitized GraphicLinkHelper for CivicPlus Toolkit
// Purpose: Safely handle graphic link / FancyButton interactions without recursion
// Exports: window.GraphicLinkHelper.init()

(function (global) {
  'use strict';

  // Namespace and idempotent guard
  var NAME = 'GraphicLinkHelper';
  global[NAME] = global[NAME] || {};
  if (global[NAME].__loaded) return;

  // Simple waitFor implementation: resolves when cond() is true or timeout reached
  function waitFor(cond, timeout, interval) {
    timeout = typeof timeout === 'number' ? timeout : 5000;
    interval = typeof interval === 'number' ? interval : 100;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (cond()) return resolve(true);
        } catch (e) {
          // ignore condition errors
        }
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  // runGuarded helper: ensures function fn is only executed once per element at a time
  // and defers DOM mutations to avoid synchronous re-entry
  function runGuarded($el, key, fn) {
    try {
      if (!$el || !$el.length) return;
      if ($el.data && $el.data(key)) return;
      if ($el.data) $el.data(key, true);
      try {
        fn(function scheduleDomUpdate(updater) {
          setTimeout(function () {
            try { updater(); } catch (_) {}
          }, 0);
        });
      } finally {
        setTimeout(function () {
          try { if ($el.removeData) $el.removeData(key); } catch (_) {}
        }, 0);
      }
    } catch (_) {
      // swallow errors silently
      try { if ($el.removeData) $el.removeData(key); } catch (_) {}
    }
  }

  // Capture-phase click lock to prevent synchronous re-entry from site scripts
  function installCaptureLock() {
    try {
      if (document.__cp_graphic_capture_installed) return;
      document.__cp_graphic_capture_installed = true;
      var lockMap = new WeakMap();
      var LOCK_TTL = 600;
      document.addEventListener('click', function (e) {
        try {
          var el = e.target;
          while (el && el !== document) {
            if (el.tagName && el.tagName.toLowerCase() === 'a') break;
            el = el.parentNode;
          }
          if (!el || el === document) return;
          if (lockMap.get(el)) {
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
          }
          lockMap.set(el, true);
          setTimeout(function () { try { lockMap.delete(el); } catch (_) {} }, LOCK_TTL);
        } catch (_) {
          // ignore capture errors
        }
      }, true);
    } catch (_) {
      // ignore installation errors
    }
  }

  // Attach delegated click handlers to adjust graphic link anchors safely
  function attachSafeDelegatedHandlers($) {
    try {
      if ($(document.body).data('__cp_graphic_handlers_attached')) return;
      $(document.body).data('__cp_graphic_handlers_attached', true);
      var containerSelector = '.listing,.contentContainer';
      var anchorSelector = 'a';
      $(document).on('click.' + NAME, containerSelector + ' ' + anchorSelector, function () {
        var $a = $(this);
        // Skip if already processed
        if ($a.data && $a.data('__cp_graphic_skip')) return;
        runGuarded($a, 'cp-graphic-handler', function (scheduleDomUpdate) {
          try {
            var href = $a.attr('href') || '';
            var needsUpdate = false;
            try {
              if (!href || href.indexOf('javascript:') === 0) {
                needsUpdate = true;
              }
            } catch (_) {}
            if (needsUpdate) {
              scheduleDomUpdate(function () {
                try {
                  var currentHref = $a.attr('href') || '#';
                  if (!currentHref || currentHref.indexOf('javascript:') === 0) {
                    $a.attr('href', '#');
                  }
                } catch (_) {}
              });
            }
          } catch (_) {
            // swallow errors silently
          }
        });
      });
      // Wrap site functions that might cause synchronous recursion
      var wrapIfFunction = function (obj, name) {
        try {
          if (!obj || typeof obj[name] !== 'function') return;
          if (obj[name].__cp_wrapped) return;
          var original = obj[name];
          obj[name] = function () {
            var args = Array.prototype.slice.call(arguments);
            var ctx = this;
            setTimeout(function () {
              try { original.apply(ctx, args); } catch (_) {}
            }, 0);
          };
          obj[name].__cp_wrapped = true;
        } catch (_) {
          // ignore wrapping errors
        }
      };
      try {
        if (global.FancyButton && typeof global.FancyButton === 'object') {
          wrapIfFunction(global.FancyButton, 'triggerOnInsert');
          wrapIfFunction(global.FancyButton, 'updateDestinationElement');
        }
        wrapIfFunction(global, 'triggerOnInsert');
        wrapIfFunction(global, 'updateDestinationElement');
      } catch (_) {}
    } catch (_) {
      // ignore errors
    }
  }

  // Main initialiser
  function init() {
    if (global[NAME].__loaded) return;
    global[NAME].__loaded = true;
    waitFor(function () { return !!global.jQuery; }, 6000, 100).then(function (ok) {
      if (!ok) return;
      var $ = global.jQuery;
      try {
        installCaptureLock();
        attachSafeDelegatedHandlers($);
      } catch (_) {
        // ignore initialisation errors
      }
    }).catch(function () {
      // ignore waitFor errors
    });
  }

  // Export init
  global[NAME].init = init;

})(window);
