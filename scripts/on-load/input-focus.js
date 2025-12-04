// Optimised Input Focus helper for CivicPlus Toolkit
//
// This refactoring removes the jQuery dependency and waitFor polling.  It
// uses native DOM APIs to focus the first meaningful input on admin
// pages once the DOM is ready, removes inline select‑on‑focus
// handlers, and ensures the toolbar does not capture the tab key.
// The helper runs only once per page when invoked by the Toolkit
// loader.

(function () {
  'use strict';

  const NS = 'InputFocus';
  if (window[NS] && window[NS].__loaded) {
    return;
  }

  /**
   * Initialise the input focus helper.  Should be invoked by the
   * Toolkit loader on admin pages.  It runs once per page and uses
   * native DOM methods (no jQuery).
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
    // Function to apply focus and adjust attributes
    function applyFocus() {
      try {
        const inputs = Array.from(document.querySelectorAll('.formline input'));
        if (inputs.length) {
          // Exclude date inputs
          const dateInputs = new Set(
            Array.from(document.querySelectorAll('.formline .date input'))
          );
          const inputsToSelect = inputs.filter((el) => !dateInputs.has(el));
          const active = document.activeElement;
          const nothingFocused =
            !active || active === document.body || active === document.documentElement;
          if (inputsToSelect.length && nothingFocused) {
            const linkField = document.getElementById('txtLinkText');
            if (linkField) {
              linkField.focus();
            } else {
              inputsToSelect[0].focus();
            }
          }
          // Remove inline select‑on‑focus handlers
          inputs.forEach((el) => {
            if (el.getAttribute('onfocus') === 'this.select()') {
              el.removeAttribute('onfocus');
            }
          });
        }
        // Prevent tabbing to text editor toolbar buttons
        const toolbarLinks = document.querySelectorAll('.reToolbar a');
        toolbarLinks.forEach((a) => {
          a.setAttribute('tabindex', '-1');
        });
      } catch (_) {
        // ignore errors
      }
    }
    // Run once when the DOM is ready
    if (document.readyState !== 'loading') {
      applyFocus();
    } else {
      document.addEventListener('DOMContentLoaded', applyFocus);
    }
  }

  // Expose the public API
  window[NS] = window[NS] || {};
  window[NS].init = init;
})();
