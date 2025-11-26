// CivicPlus Toolkit: Input Focus Helper (sanitised)
// This helper automatically places focus on the first meaningful input on admin
// pages once jQuery and the DOM are ready. It also removes any inline
// "select all" handlers from inputs and prevents the toolbar from capturing
// the tab key. The helper runs once per page when invoked by the Toolkit
// loader.

;(function () {
  'use strict';

  // Namespace and idempotent guard. If the script has already run on this
  // page, do nothing.
  const NS = 'InputFocus';
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
        } catch (err) {
          // ignore errors during checking
        }
        if (Date.now() - start > timeout) {
          return resolve(false);
        }
        setTimeout(check, interval);
      })();
    });
  }

  /**
   * Initialise the input focus helper. Should be invoked by the Toolkit loader
   * on admin pages. Ensures jQuery and the document are ready before
   * applying focus and adjustments.
   */
  function init() {
    // Guard against multiple initialisations
    if (window[NS] && window[NS].__loaded) {
      return;
    }
    // Mark as loaded immediately to avoid duplicate scheduling
    window[NS] = window[NS] || {};
    window[NS].__loaded = true;

    (async () => {
      // Wait for jQuery to be available
      const ready = await waitFor(() => window.jQuery && document.readyState !== 'loading');
      if (!ready) {
        return;
      }
      const $ = window.jQuery;
      // Use jQuery's document ready wrapper
      $(function () {
        try {
          // Only run on admin pages; rely on pathname rather than loader (extra guard)
          const path = (window.location.pathname || '').toLowerCase();
          if (!path.startsWith('/admin/')) {
            return;
          }
          const inputs = $('.formline input');
          // Exclude date inputs
          const inputsToSelect = inputs.not('.formline .date input');
          const nothingFocused = $(document.activeElement).length === 0 || $(document.activeElement).is('body');
          if (inputsToSelect.length && nothingFocused) {
            // Prefer the txtLinkText field if present
            const linkField = $('#txtLinkText');
            if (linkField.length) {
              linkField.focus();
            } else {
              inputsToSelect.first().focus();
            }
          }
          // Remove inline "select all" focus handlers
          if (inputs.length) {
            inputs.each(function () {
              const $el = $(this);
              if ($el.attr('onfocus') === 'this.select()') {
                $el.removeAttr('onfocus');
              }
            });
          }
          // Prevent tabbing to text editor toolbar buttons
          $('.reToolbar a').attr('tabindex', '-1');
        } catch (err) {
          // Silently ignore errors to avoid interfering with page
        }
      });
    })();
  }

  // Expose the public API
  window[NS] = window[NS] || {};
  window[NS].init = init;
})();
