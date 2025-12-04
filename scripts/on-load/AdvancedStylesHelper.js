// CivicPlus Toolkit - Advanced Styles Helper (Optimised)
// This helper enforces maximum lengths on advanced styles text areas in the
// DesignCenter’s Theme Manager and Widget Manager.  It has been modified
// to use MutationObservers as a fallback for detecting dynamically created
// popover text areas when no page functions are present, while keeping
// the original page‑context injection needed to override functions defined
// by the site.  The helper retains idempotent initialisation and exports
// an `init()` function that the CP Toolkit loader will call.

(function (global) {
  'use strict';

  var NAME = 'AdvancedStylesHelper';
  global[NAME] = global[NAME] || {};
  // Guard: avoid multiple runs
  if (global[NAME].__loaded) {
    return;
  }

  /**
   * Inject code into the page context.  Tampermonkey scripts run in a
   * sandbox, so to override page functions we must insert a script tag
   * into the DOM.  This helper wraps a function and runs it in the
   * page’s global scope.
   * @param {Function} fn
   */
  function runInPageContext(fn) {
    try {
      var script = document.createElement('script');
      script.type = 'text/javascript';
      script.textContent = '(' + fn.toString() + ')();';
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (_) {
      // Silently ignore any injection errors
    }
  }

  /**
   * Enforce maximum lengths in the Theme Manager.  This helper overrides
   * the `initializePopovers` function when defined, or uses a
   * MutationObserver fallback when it isn’t.  In both cases it sets
   * `maxlength="1000"` on any textarea inside `.cpPopOver` elements.
   */
  function enforceThemeManager() {
    runInPageContext(function () {
      try {
        // Helper to apply maxlength to all popover textareas
        function applyMaxLength() {
          try {
            var textAreas = document.querySelectorAll('.cpPopOver textarea');
            textAreas.forEach(function (el) {
              el.setAttribute('maxlength', 1000);
            });
          } catch (_) {}
        }
        // If initializePopovers is not yet defined, use DOMContentLoaded and
        // MutationObserver fallback to ensure future popovers also get the maxlength
        if (typeof window.initializePopovers === 'undefined') {
          // Apply on DOMContentLoaded for initial popovers
          document.addEventListener(
            'DOMContentLoaded',
            function () {
              applyMaxLength();
            },
            { once: true }
          );
          // Observe additions of cpPopOver elements to handle dynamically
          // generated popovers when there is no initializePopovers function
          var themeObs = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
              m.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) {
                  if (node.matches && node.matches('.cpPopOver textarea')) {
                    node.setAttribute('maxlength', 1000);
                  }
                  var textAreas = node.querySelectorAll ? node.querySelectorAll('.cpPopOver textarea') : [];
                  textAreas.forEach(function (ta) {
                    ta.setAttribute('maxlength', 1000);
                  });
                }
              });
            });
          });
          themeObs.observe(document.documentElement, { childList: true, subtree: true });
          return;
        }
        // Otherwise, override initializePopovers once
        var originalInitializePopovers = window.initializePopovers;
        if (!window.initializePopovers.__cpToolkit_override) {
          window.initializePopovers = function () {
            try {
              if (typeof originalInitializePopovers === 'function') {
                originalInitializePopovers.apply(this, arguments);
              }
            } catch (_) {}
            applyMaxLength();
          };
          window.initializePopovers.__cpToolkit_override = true;
        }
        // Apply maxlength to any existing popover textareas immediately
        applyMaxLength();
      } catch (_) {
        // ignore errors in theme manager enforcement
      }
    });
  }

  /**
   * Enforce maximum lengths in the Widget Manager.  This helper overrides
   * `InitializeWidgetOptionsModal` when defined, or uses a MutationObserver
   * fallback.  It sets `maxlength="255"` on the #MiscAdvStyles textarea.
   */
  function enforceWidgetManager() {
    runInPageContext(function () {
      try {
        // Helper to set maxlength on #MiscAdvStyles when present
        function setMaxLength() {
          try {
            var el = document.querySelector('#MiscAdvStyles');
            if (el) {
              el.setAttribute('maxlength', 255);
            }
          } catch (_) {}
        }
        if (typeof window.InitializeWidgetOptionsModal === 'undefined') {
          // Use MutationObserver to watch for the textarea when
          // InitializeWidgetOptionsModal has not been defined yet
          var obs = new MutationObserver(function (mutations, observer) {
            setMaxLength();
            var target = document.querySelector('#MiscAdvStyles');
            if (target) {
              observer.disconnect();
            }
          });
          obs.observe(document.documentElement, { childList: true, subtree: true });
          return;
        }
        var oldModal = window.InitializeWidgetOptionsModal;
        if (!window.InitializeWidgetOptionsModal.__cpToolkit_override) {
          window.InitializeWidgetOptionsModal = function () {
            try {
              if (typeof oldModal === 'function') {
                oldModal.apply(this, arguments);
              }
            } catch (_) {}
            setMaxLength();
          };
          window.InitializeWidgetOptionsModal.__cpToolkit_override = true;
        }
        // Apply maxlength on any existing textarea immediately
        setMaxLength();
      } catch (_) {
        // ignore errors in widget manager enforcement
      }
    });
  }

  /**
   * Main initialiser.  Determines whether we are on the Theme Manager or
   * Widget Manager pages and applies the appropriate enforcement.  Once
   * executed, it sets a __loaded flag to prevent multiple runs.
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
      // ignore any errors in init
    }
  }

  // Expose init on the global helper
  global[NAME].init = init;
})(window);
