// CivicPlus Toolkit - Theme Manager Enhancer (Optimised)
// This helper augments the Design Center’s Theme Manager and related pages.
// It has been refactored to remove the jQuery dependency and the polling
// wait loop.  Instead, it uses native DOM APIs and a MutationObserver
// helper to detect when the view selector is available.  CSS fixes are
// injected only on the Theme Manager page.  The helper exports an
// idempotent `init()` method and respects the CPToolkit CivicPlus
// detection cache.

(function () {
  'use strict';

  // Prevent multiple initialisations
  if (window.ThemeManagerEnhancer && window.ThemeManagerEnhancer.__loaded) {
    return;
  }

  window.ThemeManagerEnhancer = {
    __loaded: false,
    init: async function () {
      if (window.ThemeManagerEnhancer.__loaded) return;
      window.ThemeManagerEnhancer.__loaded = true;
      try {
        const path = (window.location.pathname || '').toLowerCase();
        const isThemeManager = path.includes('/designcenter/themes');
        const isWidgetManager = path.includes('/designcenter/widgets');
        const isAnimationManager = path.includes('/designcenter/animations');
        const isDesignCenter = isThemeManager || isWidgetManager || isAnimationManager;
        if (!isDesignCenter) {
          return;
        }
        // Respect CivicPlus detection cache
        if (window.CPToolkit && window.CPToolkit.isCivicPlusSiteResult === false) {
          return;
        }
        // Helper to inject CSS fixes
        function injectCSS(css) {
          const style = document.createElement('style');
          style.setAttribute('data-cp-tool', 'ThemeManagerEnhancer');
          style.textContent = css;
          document.head.appendChild(style);
        }
        // CSS adjustments for Theme Manager only
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
        /**
         * Wait for a DOM element matching the selector using MutationObserver.
         * Resolves with the element or null after timeout milliseconds.
         * @param {string} selector
         * @param {number} timeout
         */
        function waitForElement(selector, timeout = 5000) {
          return new Promise(resolve => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            const observer = new MutationObserver(() => {
              const found = document.querySelector(selector);
              if (found) {
                observer.disconnect();
                resolve(found);
              }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
            setTimeout(() => {
              observer.disconnect();
              resolve(null);
            }, timeout);
          });
        }
        // Add Layout Manager option once the dropdown appears
        const select = await waitForElement('.cpToolbar select#currentView', 7000);
        if (select && select instanceof HTMLSelectElement) {
          // Check if option already exists to avoid duplicates
          const exists = Array.from(select.options).some(opt => opt.value === 'Layouts');
          if (!exists) {
            const option = document.createElement('option');
            option.value = 'Layouts';
            option.textContent = 'Layout Manager';
            select.appendChild(option);
            select.addEventListener('change', function (event) {
              const value = event.target.value;
              if (value === 'Layouts') {
                window.location.href = '/Admin/DesignCenter/Layouts';
              }
            });
          }
        }
      } catch (err) {
        console.warn('ThemeManagerEnhancer', 'Error:', err);
      }
    }
  };
})();
