// Sanitized Theme Manager Enhancer for the CivicPlus Toolkit
// This helper enhances the Design Center's Theme Manager and related pages.
// It follows the master specification: minimal logging, idempotent guard,
// exports an init() method without auto‑running it, and avoids side effects
// unless invoked explicitly by the loader.

(function() {
  'use strict';

  // Prevent double execution
  if (window.ThemeManagerEnhancer && window.ThemeManagerEnhancer.__loaded) {
    return;
  }

  window.ThemeManagerEnhancer = {
    __loaded: false,

    /**
     * Initializes the Theme Manager Enhancer.
     * This method is idempotent — calling it multiple times has no effect
     * after the first initialization. It performs three key tasks:
     * 1. Determine if the current page is a Design Center page (Themes, Widgets or Animations).
     * 2. Ensure the current site is CivicPlus (when available via CPToolkit.isCivicPlusSite()).
     * 3. Inject CSS fixes and augment the view selector for layout management.
     */
    init: async function() {
      if (window.ThemeManagerEnhancer.__loaded) return;
      window.ThemeManagerEnhancer.__loaded = true;

      const path = (window.location.pathname || '').toLowerCase();
      const isThemeManager = path.includes('/designcenter/themes');
      const isWidgetManager = path.includes('/designcenter/widgets');
      const isAnimationManager = path.includes('/designcenter/animations');
      const isDesignCenter = isThemeManager || isWidgetManager || isAnimationManager;
      if (!isDesignCenter) {
        return;
      }

      // Respect the loader's cached detection result. If explicitly false, exit.
      if (window.CPToolkit && window.CPToolkit.isCivicPlusSiteResult === false) {
        return;
      }

      // Helper to inject CSS into the document head
      function injectCSS(css) {
        const style = document.createElement('style');
        style.setAttribute('data-cp-tool', 'ThemeManagerEnhancer');
        style.textContent = css;
        document.head.appendChild(style);
      }

      try {
        // Apply CSS fixes ONLY on the Theme Manager page
        if (isThemeManager) {
          injectCSS(
            '.exploded [data-cprole$="Container"].focused {\n' +
            '    outline-style: dashed !important;\n' +
            '}\n' +
            '.exploded .stickySticky {\n' +
            '    position: relative;\n' +
            '    top: auto !important;\n' +
            '}\n' +
            '.exploded #bodyWrapper {\n' +
            '    padding-top: 47px !important;\n' +
            '}\n' +
            '.stickyStructuralContainer.stickySticky:hover,\n' +
            '.stickyStructuralContainer.stickyCollapsed:hover {\n' +
            '    z-index: 100;\n' +
            '}\n' +
            '.modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li .status {\n' +
            '    position: static;\n' +
            '}\n' +
            '.modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li .status:before {\n' +
            '    content: "The skin above is ";\n' +
            '}\n' +
            '.modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li input[type=text] {\n' +
            '    padding-right: .5rem !important;\n' +
            '}\n' +
            '.currentWidgetSkins li.rename[data-active="False"] input {\n' +
            '    background: #DDD;\n' +
            '}\n' +
            '.exploded #bodyWrapper > .structuralContainer:before {\n' +
            '    left: 0 !important;\n' +
            '    right: 0 !important;\n' +
            '}\n' +
            'body:not(.exploded) .cpComponent:before {\n' +
            '    left: 0 !important;\n' +
            '    right: 0 !important;\n' +
            '}\n'
          );
        }

        // Wait for jQuery to load before enhancing the dropdown
        await waitFor(() => window.jQuery, 5000);
        if (typeof window.jQuery !== 'undefined') {
          const $ = window.jQuery;
          $(document).ready(function() {
            const currentViewSelect = $('.cpToolbar select#currentView');
            if (currentViewSelect.length) {
              // Add Layout Manager option to the dropdown
              const option = $('<option value="Layouts">Layout Manager</option>');
              currentViewSelect.append(option);
              currentViewSelect.change(function() {
                if ($(this).val() === 'Layouts') {
                  window.location.href = '/Admin/DesignCenter/Layouts';
                }
              });
            }
          });
        }
      } catch (err) {
        // Only log errors
        console.warn('ThemeManagerEnhancer', 'Error:', err);
      }
    }
  };

  /**
   * Waits for a condition to become true. Resolved with true if the condition
   * is met within the timeout period; resolved with false otherwise.
   * @param {() => boolean} testFn Condition function that should return true
   *                               when ready.
   * @param {number} [timeout=5000] Maximum time to wait in milliseconds.
   * @param {number} [interval=100] Polling interval in milliseconds.
   */
  function waitFor(testFn, timeout = 5000, interval = 100) {
    const start = Date.now();
    return new Promise(resolve => {
      (function check() {
        try {
          if (testFn()) return resolve(true);
        } catch (_) {
          // swallow exceptions from testFn
        }
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }
})();
