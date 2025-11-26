// Sanitized AdvancedStylesHelper for CivicPlus Toolkit
// This helper enforces maximum lengths on advanced styles text areas
// in the DesignCenter Theme and Widget managers. It exports a single
// `init()` function and includes an idempotent guard so it runs only
// once per page. All auto‑run logic and console logging from the
// original script have been removed. Instead, the loader will call
// `init()` on appropriate pages.

(function (global) {
  'use strict';

  var NAME = 'AdvancedStylesHelper';
  global[NAME] = global[NAME] || {};
  // If already initialised, do nothing
  if (global[NAME].__loaded) {
    return;
  }

  /**
   * Inject a function into the page context. This is necessary to
   * override page‑defined functions like initializePopovers and
   * InitializeWidgetOptionsModal, since Tampermonkey userscripts run in
   * a sandbox separate from the page’s JavaScript context.
   * @param {Function} fn The function to run in page context.
   */
  function runInPageContext(fn) {
    try {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.textContent = '(' + fn.toString() + ')();';
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (err) {
      // Ignore injection errors
    }
  }

  /**
   * Apply maximum length enforcement on the Theme Manager. This
   * overrides initializePopovers (if present) to set maxlength on
   * textareas inside .cpPopOver. If initializePopovers does not yet
   * exist, it adds a DOMContentLoaded fallback. It also ensures that
   * existing popover textareas have the maxlength applied.
   */
  function enforceThemeManager() {
    runInPageContext(function () {
      try {
        // If the page has not defined initializePopovers yet, fall
        // back to applying maxlength on DOMContentLoaded
        if (typeof window.initializePopovers === 'undefined') {
          document.addEventListener(
            'DOMContentLoaded',
            function () {
              try {
                var ta = document.querySelectorAll('.cpPopOver textarea');
                ta.forEach(function (t) {
                  t.setAttribute('maxlength', 1000);
                });
              } catch (_) {}
            },
            { once: true }
          );
          return;
        }
        // Save the original implementation once
        var originalInitializePopovers = window.initializePopovers;
        // Avoid double wrapping
        if (!window.initializePopovers.__cpToolkit_override) {
          window.initializePopovers = function () {
            try {
              // Call the original
              if (typeof originalInitializePopovers === 'function') {
                originalInitializePopovers.apply(this, arguments);
              }
            } catch (_) {}
            // Apply maxlength to any textareas in newly created popovers
            try {
              var textAreas = document.querySelectorAll('.cpPopOver textarea');
              textAreas.forEach(function (el) {
                el.setAttribute('maxlength', 1000);
              });
            } catch (_) {}
          };
          window.initializePopovers.__cpToolkit_override = true;
        }
        // Apply maxlength on any existing popover textareas
        var existing = document.querySelectorAll('.cpPopOver textarea');
        existing.forEach(function (el) {
          el.setAttribute('maxlength', 1000);
        });
      } catch (_) {
        // Ignore errors
      }
    });
  }

  /**
   * Apply maximum length enforcement on the Widget Manager. This
   * overrides InitializeWidgetOptionsModal (if present) to set
   * maxlength on the #MiscAdvStyles textarea. If the function is not
   * defined, it uses a MutationObserver fallback to watch for the
   * element. It also sets maxlength on an existing textarea if it
   * already exists.
   */
  function enforceWidgetManager() {
    runInPageContext(function () {
      try {
        if (typeof window.InitializeWidgetOptionsModal === 'undefined') {
          // Fallback: observe DOM until the element appears
          var observer = new MutationObserver(function (mutations, obs) {
            try {
              var el = document.querySelector('#MiscAdvStyles');
              if (el) {
                el.setAttribute('maxlength', 255);
                obs.disconnect();
              }
            } catch (_) {}
          });
          observer.observe(document.documentElement, { childList: true, subtree: true });
        } else {
          var oldModal = window.InitializeWidgetOptionsModal;
          // Avoid double wrapping
          if (!window.InitializeWidgetOptionsModal.__cpToolkit_override) {
            window.InitializeWidgetOptionsModal = function () {
              try {
                if (typeof oldModal === 'function') {
                  oldModal.apply(this, arguments);
                }
              } catch (_) {}
              try {
                var el = document.querySelector('#MiscAdvStyles');
                if (el) {
                  el.setAttribute('maxlength', 255);
                }
              } catch (_) {}
            };
            window.InitializeWidgetOptionsModal.__cpToolkit_override = true;
          }
        }
        // Set maxlength immediately if element already exists
        var existing = document.querySelector('#MiscAdvStyles');
        if (existing) {
          existing.setAttribute('maxlength', 255);
        }
      } catch (_) {
        // Ignore errors
      }
    });
  }

  /**
   * Main initialiser function. Determines whether the current page
   * corresponds to the Theme Manager or Widget Manager and applies
   * appropriate maximum length enforcement.
   */
  function init() {
    if (global[NAME].__loaded) {
      return;
    }
    global[NAME].__loaded = true;
    try {
      var pathname = (global.location && global.location.pathname) || '';
      var path = pathname.toLowerCase();
      var isTheme = path.indexOf('/designcenter/themes') !== -1;
      var isWidget = path.indexOf('/designcenter/widgets') !== -1;
      if (!isTheme && !isWidget) {
        return;
      }
      if (isTheme) {
        enforceThemeManager();
      }
      if (isWidget) {
        enforceWidgetManager();
      }
    } catch (_) {
      // ignore errors
    }
  }

  // Expose the init method on the global object
  global[NAME].init = init;
})(window);
