// Optimised Widget Skin Default Override helper for CivicPlus Toolkit
//
// This refactoring removes the dependency on jQuery and replaces
// polling with a simple waitFor implementation.  It overrides the
// refreshContentContainersAsync function on DesignCenter theme pages to
// apply sensible defaults to new widget skins (those with negative
// WidgetSkinID values).  After applying defaults, it closes the modal,
// saves the theme, removes unsaved skins and reopens the manage skins
// view.  The helper exposes a single init() method and is idempotent.

(function (global) {
  'use strict';

  const NAME = 'WidgetSkinDefaultOverride';
  global[NAME] = global[NAME] || {};
  if (global[NAME].__loaded) {
    return;
  }

  /**
   * Wait for a condition to become true before resolving.  Resolves
   * false if the timeout expires.  This is used to wait for the
   * refreshContentContainersAsync function to become available.
   * @param {() => boolean} cond
   * @param {number} [timeout=5000]
   * @param {number} [interval=100]
   * @returns {Promise<boolean>}
   */
  function waitFor(cond, timeout = 5000, interval = 100) {
    const start = Date.now();
    return new Promise((resolve) => {
      (function check() {
        try {
          if (cond()) return resolve(true);
        } catch (_) {
          /* ignore errors */
        }
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  /**
   * Override refreshContentContainersAsync to apply defaults to new
   * widget skins.  Only executes once.  Uses native DOM APIs for
   * querying and clicking elements.  When a new skin is detected, the
   * user is prompted to confirm applying defaults.  If confirmed, it
   * applies font size, alignment and padding defaults, closes the
   * modal, saves the theme, removes unsaved skins and reopens Manage
   * Widget Skins.
   */
  function overrideRefresh() {
    try {
      const fn = global.refreshContentContainersAsync;
      if (typeof fn !== 'function') return;
      if (fn.__cpToolkit_widget_skin_override) return;
      const original = fn;
      global.refreshContentContainersAsync = function (...args) {
        // Always call the original function first
        try {
          original.apply(this, args);
        } catch (_) {
          /* ignore */
        }
        try {
          const themeJSON = (global.DesignCenter && global.DesignCenter.themeJSON) || {};
          const skins = themeJSON.WidgetSkins || [];
          let foundSkin = false;
          skins.forEach((skin) => {
            // New skins have negative IDs
            if (skin.WidgetSkinID < 0) {
              foundSkin = true;
              const shouldSetDefaults = confirm(
                '[CP Toolkit] Override default new widget skin options?\n\n' +
                  'Click Cancel if you are copying a skin or do not want to override default options. ' +
                  'Click OK to override the default new skin options.'
              );
              if (shouldSetDefaults) {
                // Apply default settings to the first component (wrapper)
                const comp0 = skin.Components && skin.Components[0];
                if (comp0) {
                  comp0.FontSize = null;
                  comp0.TextAlignment = 0;
                }
                // Apply padding defaults to the tabbed widget component (index 13)
                const comp13 = skin.Components && skin.Components[13];
                if (comp13) {
                  const paddingEms = { Value: '0.5', Unit: '0' };
                  comp13.PaddingTop = paddingEms;
                  comp13.PaddingLeft = paddingEms;
                  comp13.PaddingBottom = paddingEms;
                  comp13.PaddingRight = paddingEms;
                }
              }
            }
          });
          if (foundSkin) {
            // Close the modal if present
            try {
              const modalClose = document.querySelector('.modalClose');
              if (modalClose) modalClose.click();
            } catch (_) {}
            // Save the theme if available
            try {
              if (typeof global.saveTheme === 'function') {
                global.saveTheme();
              }
            } catch (_) {}
            // Remove unsaved skins in the preview area
            let removeInterval;
            const removeUnsaved = () => {
              try {
                const toRemove = document.querySelectorAll(
                  ".widget[class*='skin-'] .remove.widgetSkin"
                );
                toRemove.forEach((btn) => {
                  try {
                    btn.click();
                  } catch (_) {
                    /* ignore */
                  }
                });
              } catch (_) {
                /* ignore */
              }
            };
            removeInterval = setInterval(removeUnsaved, 100);
            // After 5 seconds, stop removing and reopen Manage Widget Skins
            setTimeout(() => {
              clearInterval(removeInterval);
              try {
                const links = Array.from(document.querySelectorAll('a'));
                const manageLink = links.find((a) =>
                  /Manage Widget Skins/i.test(a.textContent || '')
                );
                if (manageLink) {
                  manageLink.click();
                }
              } catch (_) {
                /* ignore */
              }
            }, 5000);
          }
        } catch (_) {
          // ignore errors during override logic
        }
      };
      global.refreshContentContainersAsync.__cpToolkit_widget_skin_override = true;
    } catch (_) {
      // ignore override errors
    }
  }

  /**
   * Initialise the helper.  Runs only on /designcenter/themes pages.
   * Waits for the refreshContentContainersAsync function to exist and
   * then applies the override.  Marks itself as loaded to avoid
   * duplicate execution.
   */
  function init() {
    if (global[NAME].__loaded) return;
    global[NAME].__loaded = true;
    try {
      const path = (global.location && global.location.pathname || '').toLowerCase();
      if (path.indexOf('/designcenter/themes') === -1) return;
    } catch (_) {
      return;
    }
    (async () => {
      const ok = await waitFor(
        () => typeof global.refreshContentContainersAsync === 'function',
        6000,
        100
      );
      if (!ok) return;
      overrideRefresh();
    })();
  }

  // Export init
  global[NAME].init = init;
})(window);
