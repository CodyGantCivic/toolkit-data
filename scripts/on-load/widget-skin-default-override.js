// Sanitized widget-skin-default-override helper for CivicPlus Toolkit
// This helper overrides the refreshContentContainersAsync function in the
// DesignCenter Theme Manager to apply sensible defaults to new widget
// skins. It ensures idempotent behaviour, exports a single init() method
// and performs all work only after the page has loaded the required
// functions and jQuery. It does not rely on Chrome extension APIs and
// therefore works in Tampermonkey.

(function (global) {
  'use strict';

  var NAME = 'WidgetSkinDefaultOverride';
  global[NAME] = global[NAME] || {};
  // If this helper has already been initialised, do nothing
  if (global[NAME].__loaded) {
    return;
  }

  /**
   * Wait for a condition to become true. Resolves with true if the
   * condition becomes true before the timeout, otherwise resolves false.
   * @param {Function} cond Condition function to test
   * @param {number} [timeout=5000] Maximum wait time in ms
   * @param {number} [interval=100] Polling interval in ms
   * @returns {Promise<boolean>} Whether the condition was met
   */
  function waitFor(cond, timeout, interval) {
    timeout = typeof timeout === 'number' ? timeout : 5000;
    interval = typeof interval === 'number' ? interval : 100;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (cond()) {
            return resolve(true);
          }
        } catch (_) {
          // ignore errors
        }
        if (Date.now() - start >= timeout) {
          return resolve(false);
        }
        setTimeout(check, interval);
      })();
    });
  }

  /**
   * Override the refreshContentContainersAsync function to inspect the
   * theme JSON for unsaved skins and apply default properties when a
   * new skin is created. Once applied, it closes the modal and
   * triggers a save and cleanup of unsaved skins.
   */
  function overrideRefresh() {
    // Ensure jQuery is available
    var $ = global.jQuery || global.$;
    if (!$) {
      return;
    }
    // If the function does not exist, abort
    if (typeof global.refreshContentContainersAsync !== 'function') {
      return;
    }
    // Prevent overriding multiple times
    if (global.refreshContentContainersAsync.__cpToolkit_widget_skin_override) {
      return;
    }
    // Preserve reference to the original implementation
    var originalRefresh = global.refreshContentContainersAsync;
    // Define the new implementation
    global.refreshContentContainersAsync = function (reset) {
      try {
        // Call the original function first
        originalRefresh.apply(this, arguments);
      } catch (_) {
        // ignore errors
      }
      // Wrap in try/catch to protect against unexpected errors
      try {
        var themeJSON = (global.DesignCenter && global.DesignCenter.themeJSON) || {};
        var skins = themeJSON.WidgetSkins || [];
        var foundSkin = false;
        skins.forEach(function (skin) {
          // New skins have negative IDs
          if (skin.WidgetSkinID < 0) {
            foundSkin = true;
            // Prompt the user before applying defaults
            var shouldSetDefaults = confirm(
              '[CP Toolkit] Override default new widget skin options?\n\n' +
                'Click Cancel if you are copying a skin or do not want to override default options. ' +
                'Click OK to override the default new skin options.'
            );
            if (shouldSetDefaults) {
              // Apply default settings to the first component (wrapper)
              var comp0 = skin.Components && skin.Components[0];
              if (comp0) {
                comp0.FontSize = null;
                comp0.TextAlignment = 0;
              }
              // Apply padding defaults to the tabbed widget component (index 13)
              var comp13 = skin.Components && skin.Components[13];
              if (comp13) {
                var paddingEms = { Value: '0.5', Unit: '0' };
                comp13.PaddingTop = paddingEms;
                comp13.PaddingLeft = paddingEms;
                comp13.PaddingBottom = paddingEms;
                comp13.PaddingRight = paddingEms;
              }
            }
          }
        });
        // If we modified any skin, close modal, save theme and clean up
        if (foundSkin) {
          try {
            $('.modalClose').click();
          } catch (_) {}
          // Save the theme if the function exists
          try {
            if (typeof global.saveTheme === 'function') {
              global.saveTheme();
            }
          } catch (_) {}
          // Remove any unsaved skins in the preview area
          var clearIntervalHandle = setInterval(function () {
            try {
              var $widgets = $(".widget[class*='skin-'] .remove.widgetSkin");
              if ($widgets.length > 0) {
                $widgets.click();
              }
            } catch (_) {}
          }, 100);
          // After a delay, stop removing and open the manage skins link again
          setTimeout(function () {
            clearInterval(clearIntervalHandle);
            try {
              $("a:contains('Manage Widget Skins')").click();
            } catch (_) {}
          }, 5000);
        }
      } catch (_) {
        // ignore errors
      }
    };
    // Mark our override to prevent repeated replacements
    global.refreshContentContainersAsync.__cpToolkit_widget_skin_override = true;
  }

  /**
   * Initialise the helper. Called by the loader when appropriate.
   */
  function init() {
    if (global[NAME].__loaded) {
      return;
    }
    global[NAME].__loaded = true;
    // Only run on design center themes pages
    try {
      var path = (global.location && global.location.pathname || '').toLowerCase();
      if (path.indexOf('/designcenter/themes') === -1) {
        return;
      }
    } catch (_) {
      return;
    }
    // Wait for jQuery and the target function to exist
    waitFor(function () {
      return global.refreshContentContainersAsync && (global.jQuery || global.$);
    }, 6000, 100).then(function (ok) {
      if (!ok) {
        return;
      }
      try {
        overrideRefresh();
      } catch (_) {}
    });
  }

  // Expose the init method on the global object
  global[NAME].init = init;
})(window);
