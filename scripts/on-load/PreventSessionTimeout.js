// Updated PreventSessionTimeout helper for CivicPlus Toolkit
// This helper ensures a session stays active by clicking the "Stay signed in" button
// when the timeout warning appears. It follows the Master Specification rules:
// - idempotent guard
// - exports window.PreventSessionTimeout.init()
// - minimal logging (no console messages except on errors)
// - page-context safe and no auto-run outside the loader

(function () {
  'use strict';

  // Prevent multiple initialisations
  if (window.PreventSessionTimeout && window.PreventSessionTimeout.__loaded) {
    return;
  }

  window.PreventSessionTimeout = {
    __loaded: false,

    // Called by the loader to activate the helper
    init: async function () {
      if (window.PreventSessionTimeout.__loaded) return;
      window.PreventSessionTimeout.__loaded = true;

      // Only run on CivicPlus admin or designcenter pages
      const path = (window.location.pathname || '').toLowerCase();
      const isAdminPage =
        path.startsWith('/admin') ||
        path.startsWith('/designcenter') ||
        path.startsWith('/admin/') ||
        path.startsWith('/designcenter/');
      if (!isAdminPage) return;

      // Respect the loader's cached detection result. If explicitly false, do nothing.
      if (window.CPToolkit && window.CPToolkit.isCivicPlusSiteResult === false) {
        return;
      }

      // Helper: wait for a condition (e.g. jQuery existence)
      const waitFor = (testFn, timeout = 5000, interval = 100) => {
        const start = Date.now();
        return new Promise(resolve => {
          (function check() {
            try {
              if (testFn()) return resolve(true);
            } catch {
              // Ignore
            }
            if (Date.now() - start >= timeout) return resolve(false);
            setTimeout(check, interval);
          })();
        });
      };

      // Wait for jQuery
      const hasJQ = await waitFor(() => !!window.jQuery, 4000);
      if (!hasJQ) return;
      const $ = window.jQuery;

      // Checks for a timeout warning and clicks "Stay signed in" if present
      function preventTimeout() {
        const message = $('.cp-UIMessage-text');
        if (
          message.length &&
          message
            .text()
            .trim()
            .startsWith('You will be signed out in')
        ) {
          const button = message.find('.cp-Btn, button, a').first();
          if (button && button.length) {
            try {
              button[0].click();
            } catch {
              // Ignore click errors
            }
          }
        }
      }

      // Run immediately and then periodically
      preventTimeout();
      window.PreventSessionTimeout._intervalHandle = setInterval(preventTimeout, 120000);
    },

    // Optional stop function
    stop: function () {
      if (window.PreventSessionTimeout._intervalHandle) {
        clearInterval(window.PreventSessionTimeout._intervalHandle);
        delete window.PreventSessionTimeout._intervalHandle;
      }
    },
  };
})();
