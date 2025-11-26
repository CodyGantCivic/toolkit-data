// CivicPlus Toolkit: Keyboard Shortcuts Helper (sanitised)
// This helper registers a small set of keyboard shortcuts on admin pages.
// - Ctrl+S (or Cmd+S on mac) triggers the Save button.
// - Ctrl+Shift+S triggers the Save and Publish button when present.
// - Ctrl+I triggers the Add Item button when present.
// The helper is designed to run once per page when called by the Toolkit
// loader. It avoids polling and logs, uses jQuery if available, and
// gracefully handles pages without these buttons.

;(function () {
  'use strict';

  const NS = 'KeyboardShortcuts';
  // Idempotent guard: if already initialised, do nothing
  if (window[NS] && window[NS].__loaded) {
    return;
  }

  /**
   * Wait for a condition to be true or until a timeout elapses.
   * @param {() => boolean} testFn Function that returns true when ready.
   * @param {number} timeout Maximum time to wait in ms.
   * @param {number} interval How often to check in ms.
   * @returns {Promise<boolean>}
   */
  function waitFor(testFn, timeout = 5000, interval = 50) {
    const start = Date.now();
    return new Promise((resolve) => {
      (function check() {
        try {
          if (testFn()) {
            return resolve(true);
          }
        } catch {
          // ignore
        }
        if (Date.now() - start > timeout) {
          return resolve(false);
        }
        setTimeout(check, interval);
      })();
    });
  }

  /**
   * Initialise the keyboard shortcuts. Should be called by the Toolkit loader
   * on admin pages once the site is identified as CivicPlus. This method
   * registers event listeners on the window to intercept certain key combos.
   */
  function init() {
    if (window[NS] && window[NS].__loaded) {
      return;
    }
    // Mark as loaded
    window[NS] = window[NS] || {};
    window[NS].__loaded = true;

    (async () => {
      // Wait for jQuery; if not available after timeout, still proceed with
      // vanilla selectors
      await waitFor(() => window.jQuery || document.readyState !== 'loading');
      const $ = window.jQuery;
      // Only run on admin pages; extra guard
      const path = (window.location.pathname || '').toLowerCase();
      if (!path.startsWith('/admin/')) {
        return;
      }

      // Use a simple flag to debounce rapid successive saves
      let saveTimeoutFlag = false;
      const onKeyDown = function (event) {
        // Support both Ctrl and Meta (Cmd on Mac)
        if (event.ctrlKey || event.metaKey) {
          const key = event.key || String.fromCharCode(event.which || 0);
          // Normalize to lower case
          const keyLower = key.toLowerCase();
          if (keyLower === 's') {
            event.preventDefault();
            if (saveTimeoutFlag) {
              return;
            }
            saveTimeoutFlag = true;
            // Reset the flag after 1 second to prevent accidental double saves
            setTimeout(() => {
              saveTimeoutFlag = false;
            }, 1000);
            const shift = event.shiftKey;
            if (shift) {
              // Ctrl+Shift+S: Save and Publish
              // Try to click common Save and Publish button variations
              let published = false;
              if ($) {
                const btn1 = $("input[value='Save and Publish']");
                if (btn1.length) {
                  btn1.first().click();
                  published = true;
                } else {
                  const anchor = $("a.saveAndPush");
                  if (anchor.length) {
                    anchor[0].click();
                    published = true;
                  }
                }
              } else {
                // Vanilla fallback
                const btn1 = document.querySelector("input[value='Save and Publish']");
                if (btn1) {
                  btn1.click();
                } else {
                  const anchor = document.querySelector('a.saveAndPush');
                  if (anchor) {
                    anchor.click();
                  }
                }
              }
            } else {
              // Ctrl+S: Save
              if ($) {
                const btn = $("input[value='Save']");
                if (btn.length) {
                  btn.first().click();
                } else {
                  const anchor = $("a.save");
                  if (anchor.length) {
                    anchor[0].click();
                  }
                }
              } else {
                const btn = document.querySelector("input[value='Save']");
                if (btn) {
                  btn.click();
                } else {
                  const anchor = document.querySelector('a.save');
                  if (anchor) {
                    anchor.click();
                  }
                }
              }
            }
          } else if (keyLower === 'i') {
            // Ctrl+I: Add Item (if no Shift pressed)
            if (!event.shiftKey) {
              if ($) {
                const addBtn = $("input[value*='Add']");
                if (addBtn.length) {
                  event.preventDefault();
                  addBtn.first().click();
                }
              } else {
                const addBtn = Array.from(document.querySelectorAll("input[value*='Add']"));
                if (addBtn.length) {
                  event.preventDefault();
                  addBtn[0].click();
                }
              }
            }
          }
        }
      };
      window.addEventListener('keydown', onKeyDown, true);
    })();
  }

  // Expose the API
  window[NS] = window[NS] || {};
  window[NS].init = init;
})();
