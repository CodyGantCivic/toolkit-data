// CivicPlus Toolkit - Auto Dismiss Help/Welcome Helper
// This helper automatically hides certain help or welcome tooltips on CivicPlus sites
// and removes the "?ShowWelcomeMessage=1" query parameter from the URL. It is
// adapted from an older Chrome extension and refactored for the CivicPlus
// Toolkit. The helper:
// - Runs only on CivicPlus sites (when CPToolkit.isCivicPlusSite() returns true).
// - Removes the ShowWelcomeMessage parameter from the URL to prevent help
//   overlays from showing.
// - Injects a small CSS block to hide tooltips (#widgetsTabTooltip and
//   #workingCopyTooltip).
// - Uses an idempotent guard and exposes an init() method.

(function () {
  'use strict';

  // Prevent multiple initialisations
  if (window.AutoDismissHelpWelcome && window.AutoDismissHelpWelcome.__loaded) {
    return;
  }

  window.AutoDismissHelpWelcome = {
    __loaded: false,
    init: async function () {
      if (window.AutoDismissHelpWelcome.__loaded) return;
      window.AutoDismissHelpWelcome.__loaded = true;
      try {
        // Ensure we are on a CivicPlus site if detection is available
        if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
          try {
            const isCP = await window.CPToolkit.isCivicPlusSite();
            if (!isCP) {
              return;
            }
          } catch (_) {
            // ignore detection errors; proceed regardless
          }
        }
        // Remove the ShowWelcomeMessage query parameter if present
        const welcomeParam = '?ShowWelcomeMessage=1';
        const currentUrl = window.location.href;
        const idx = currentUrl.indexOf(welcomeParam);
        if (idx !== -1) {
          const newUrl = currentUrl.replace(welcomeParam, '');
          window.location.href = newUrl;
          return;
        }
        // Inject a CSS style to hide tooltips (only once)
        const styleId = 'cp-toolkit_dismiss-help';
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = '#widgetsTabTooltip, #workingCopyTooltip { display: none !important; }';
          document.body.appendChild(style);
        }
      } catch (err) {
        // Surface any errors quietly
        console.warn('[CP Toolkit] AutoDismissHelpWelcome init error', err);
      }
    }
  };
})();
