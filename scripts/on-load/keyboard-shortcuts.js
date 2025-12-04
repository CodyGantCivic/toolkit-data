// Optimised Keyboard Shortcuts helper for CivicPlus Toolkit
//
// This refactoring removes the dependency on jQuery and simplifies the
// keyboard shortcut handling using native DOM APIs.  It registers
// keyboard shortcuts on admin pages:
//   - Ctrl+S (or Cmd+S) triggers the Save button.
//   - Ctrl+Shift+S triggers the Save and Publish button.
//   - Ctrl+I triggers the Add Item button.
// The helper is idempotent and runs only once per page when invoked.

(function () {
  'use strict';

  const NS = 'KeyboardShortcuts';
  // Idempotent guard: if already initialised, do nothing
  if (window[NS] && window[NS].__loaded) {
    return;
  }

  /**
   * Initialise the keyboard shortcuts.  Registers an event listener on
   * the window to intercept certain key combinations.  Only runs on
   * admin pages.
   */
  function init() {
    if (window[NS] && window[NS].__loaded) {
      return;
    }
    window[NS] = window[NS] || {};
    window[NS].__loaded = true;
    try {
      const path = (window.location.pathname || '').toLowerCase();
      if (!path.startsWith('/admin/')) {
        return;
      }
    } catch (_) {
      return;
    }
    // Debounce flag to prevent rapid successive saves
    let saveTimeoutFlag = false;
    const onKeyDown = function (event) {
      // Support both Ctrl and Meta (Cmd on Mac)
      if (event.ctrlKey || event.metaKey) {
        const key = event.key || String.fromCharCode(event.which || 0);
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
            let target;
            target = document.querySelector("input[value='Save and Publish']");
            if (!target) {
              target = document.querySelector('a.saveAndPush');
            }
            if (target) {
              try {
                target.click();
              } catch (_) {
                /* ignore click errors */
              }
            }
          } else {
            // Ctrl+S: Save
            let target;
            target = document.querySelector("input[value='Save']");
            if (!target) {
              target = document.querySelector('a.save');
            }
            if (target) {
              try {
                target.click();
              } catch (_) {
                /* ignore click errors */
              }
            }
          }
        } else if (keyLower === 'i') {
          // Ctrl+I: Add Item (if no Shift pressed)
          if (!event.shiftKey) {
            // Look for an input button whose value contains 'Add'
            const addBtn = Array.from(
              document.querySelectorAll("input[type='button'], input[type='submit'], input[type='image']")
            ).find((el) => {
              const val = (el.value || '').toLowerCase();
              return val.indexOf('add') !== -1;
            });
            if (addBtn) {
              event.preventDefault();
              try {
                addBtn.click();
              } catch (_) {
                /* ignore click errors */
              }
            }
          }
        }
      }
    };
    // Attach the keydown handler once the DOM is ready
    const attachListener = () => {
      window.addEventListener('keydown', onKeyDown, true);
    };
    if (document.readyState !== 'loading') {
      attachListener();
    } else {
      document.addEventListener('DOMContentLoaded', attachListener);
    }
  }

  // Expose the API
  window[NS] = window[NS] || {};
  window[NS].init = init;
})();
