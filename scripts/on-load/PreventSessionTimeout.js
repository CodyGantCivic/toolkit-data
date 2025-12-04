// Optimised PreventSessionTimeout helper for CivicPlus Toolkit
//
// This refactoring removes the jQuery dependency and polling.  It
// uses native DOM APIs to detect the timeout warning message and
// automatically clicks the "Stay signed in" button to keep the
// session active.  The helper runs only on CivicPlus admin or
// DesignCenter pages and exposes a stop function to clear the
// interval.

(function () {
  'use strict';

  // Guard against multiple initialisations
  if (window.PreventSessionTimeout && window.PreventSessionTimeout.__loaded) {
    return;
  }

  window.PreventSessionTimeout = {
    __loaded: false,
    /**
     * Initialises the helper.  Installs an interval that checks for the
     * sign‑out warning every two minutes and clicks the Stay Signed In
     * button when found.
     */
    init: function () {
      if (window.PreventSessionTimeout.__loaded) return;
      window.PreventSessionTimeout.__loaded = true;
      try {
        const path = (window.location.pathname || '').toLowerCase();
        // Only run on admin or designcenter pages
        const isAdmin = path.startsWith('/admin') || path.startsWith('/admin/');
        const isDC = path.startsWith('/designcenter') || path.startsWith('/designcenter/');
        if (!isAdmin && !isDC) return;
        // Respect CivicPlus detection if available
        if (window.CPToolkit && window.CPToolkit.isCivicPlusSiteResult === false) return;
        // Helper to check the timeout warning and click Stay Signed In
        function preventTimeout() {
          try {
            const msg = document.querySelector('.cp-UIMessage-text');
            if (!msg) return;
            const text = (msg.textContent || '').trim();
            if (text.startsWith('You will be signed out in')) {
              const button = msg.querySelector('.cp-Btn, button, a');
              if (button) {
                try {
                  button.click();
                } catch (_) {
                  /* ignore click errors */
                }
              }
            }
          } catch (_) {
            /* ignore errors */
          }
        }
        // Run once when the DOM is ready
        if (document.readyState !== 'loading') {
          preventTimeout();
        } else {
          document.addEventListener('DOMContentLoaded', preventTimeout);
        }
        // Run periodically every 2 minutes
        window.PreventSessionTimeout._intervalHandle = setInterval(
          preventTimeout,
          120000
        );
      } catch (_) {
        // ignore init errors
      }
    },
    /**
     * Clears the periodic interval if running.
     */
    stop: function () {
      if (window.PreventSessionTimeout._intervalHandle) {
        clearInterval(window.PreventSessionTimeout._intervalHandle);
        delete window.PreventSessionTimeout._intervalHandle;
      }
    },
  };
})();
