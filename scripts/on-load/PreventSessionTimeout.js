// scripts/on-load/PreventSessionTimeout.js

(function () {
  'use strict';

  // Idempotent guard: if already loaded, exit early
  if (window.PreventSessionTimeout && window.PreventSessionTimeout.__loaded) {
    return;
  }

  window.PreventSessionTimeout = {
    __loaded: false,

    // Public initializer called by the loader
    init: async function () {
      if (window.PreventSessionTimeout.__loaded) return;
      window.PreventSessionTimeout.__loaded = true;

      // Only run on admin or designcenter pages
      const path = (window.location.pathname || '').toLowerCase();
      const isAdminPage =
        path.startsWith('/admin') ||
        path.startsWith('/designcenter') ||
        path.startsWith('/admin/') ||
        path.startsWith('/designcenter/');
      if (!isAdminPage) return;

      // CivicPlus site detection – if available from the loader
      if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
        try {
          const isCP = await window.CPToolkit.isCivicPlusSite();
          if (!isCP) return;
        } catch {
          // Ignore detection errors and continue
        }
      }

      // Helper to wait for a condition (e.g., jQuery availability)
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

      // Wait for jQuery to load
      const hasJQ = await waitFor(() => !!window.jQuery, 4000);
      if (!hasJQ) return;
      const $ = window.jQuery;

      // Clicks “Stay signed in” when the timeout message appears
      function checkForTimeoutAndPrevent() {
        const message = $('.cp-UIMessage-text');
        if (message.length && message.text().trim().startsWith('You will be signed out in')) {
          const stayButton = message.find('.cp-Btn, button, a').first();
          if (stayButton && stayButton.length) {
            try {
              stayButton[0].click();
            } catch {
              // Ignore click errors
            }
          }
        }
      }

      // Run immediately
      checkForTimeoutAndPrevent();
      // Then run every 2 minutes
      window.PreventSessionTimeout._intervalHandle = setInterval(checkForTimeoutAndPrevent, 120000);
    },

    // Optional helper to stop the periodic checks
    stop: function () {
      if (window.PreventSessionTimeout._intervalHandle) {
        clearInterval(window.PreventSessionTimeout._intervalHandle);
        delete window.PreventSessionTimeout._intervalHandle;
      }
    },
  };
})();
