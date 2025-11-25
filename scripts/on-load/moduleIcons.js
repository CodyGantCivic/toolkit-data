// Sanitized Module Icons helper for the CivicPlus Toolkit
//
// This script adds FontAwesome icons to favorite modules in the CivicPlus
// admin interface. The original version relied on Chrome extension APIs
// (chrome.storage and chrome.extension) and executed automatically.
// In accordance with the CivicPlus Toolkit Master Specification, this
// version removes all Chrome extension dependencies, avoids auto‑running
// outside the loader, and exports a single idempotent `init()` function.
//
// The helper works by fetching the `modules.json` file from the
// repository, identifying modules that are marked as default favorites
// and have a default icon, and then injecting the appropriate icon
// before the module’s link. The loader will call `ModuleIcons.init()`
// when appropriate (on CivicPlus pages, after jQuery and the module
// list are available).

(function () {
  'use strict';

  // Prevent multiple initialisations
  if (window.ModuleIcons && window.ModuleIcons.__loaded) {
    return;
  }

  window.ModuleIcons = {
    __loaded: false,

    /**
     * Initialise the Module Icons helper.
     *
     * This function is called by the loader. It waits for jQuery to be
     * available, checks that the page belongs to a CivicPlus site via
     * the loader’s `isCivicPlusSite()` helper, fetches the module
     * definitions, and then injects icons into the module list. Icons
     * are only added for modules marked as default favorites and with
     * a non‑empty default icon in `modules.json`.
     */
    init: async function () {
      if (window.ModuleIcons.__loaded) return;
      window.ModuleIcons.__loaded = true;

      // If the loader exposes CivicPlus detection, use it. Without it,
      // we proceed anyway since the loader itself guards by site.
      if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
        try {
          const isCP = await window.CPToolkit.isCivicPlusSite();
          if (!isCP) return;
        } catch {
          // ignore detection errors
        }
      }

      // Helper: wait for a condition (e.g. jQuery availability)
      const waitFor = (testFn, timeout = 5000, interval = 100) => {
        const start = Date.now();
        return new Promise(resolve => {
          (function check() {
            try {
              if (testFn()) return resolve(true);
            } catch {
              // ignore
            }
            if (Date.now() - start >= timeout) return resolve(false);
            setTimeout(check, interval);
          })();
        });
      };

      // Wait for jQuery
      const hasJQ = await waitFor(() => !!window.jQuery, 4000, 100);
      if (!hasJQ) return;
      const $ = window.jQuery;

      // Fetch modules.json from the repository. If fetch fails, abort.
      let modules;
      try {
        const resp = await fetch('https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/data/modules.json', { cache: 'no-store' });
        if (!resp.ok) throw new Error('modules.json fetch failed');
        modules = await resp.json();
      } catch {
        // Do not proceed if we cannot load module definitions
        return;
      }

      // Function to load FontAwesome CSS if not already loaded
      function loadFontAwesome() {
        if (document.getElementById('fontawesome_css')) return;
        const css = document.createElement('link');
        css.id = 'fontawesome_css';
        css.href = 'https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/css/external/fontawesome-all.min.css';
        css.rel = 'stylesheet';
        css.type = 'text/css';
        (document.head || document.documentElement).appendChild(css);
      }

      // Add icons to modules after ensuring the module list exists
      let attempts = 0;
      function maybeAddIcons() {
        if ($('.cp-ModuleList-item').length) {
          loadFontAwesome();
          addIcons();
        } else if (attempts < 20) {
          attempts++;
          setTimeout(maybeAddIcons, 200);
        }
      }

      function addIcons() {
        try {
          // Iterate through module classes and modules
          for (const moduleClass in modules) {
            const classObj = modules[moduleClass];
            for (const modName in classObj) {
              const modObj = classObj[modName];
              const faClass = modObj['default-icon'];
              const isFav = modObj['default-favorite'];
              if (!isFav || !faClass) continue;
              const url = modObj['url'];
              // For each matching link, prepend the icon if not already present
              $('.cp-Tabs-panel')
                .find(".cp-ModuleList-itemLink[href*='" + url + "']")
                .each(function () {
                  const link = $(this);
                  if (link.data('module-icons-added')) return;
                  link.prepend('<i class="' + faClass + '"></i>&nbsp;&nbsp;&nbsp;');
                  link.css('font-weight', 'bold');
                  link.data('module-icons-added', true);
                });
            }
          }
        } catch {
          // ignore errors
        }
      }

      maybeAddIcons();
    }
  };
})();
