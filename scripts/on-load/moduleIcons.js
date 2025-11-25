/ Sanitized Module Icons helper for the CivicPlus Toolkit
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

// Updated Module Icons helper for the CivicPlus Toolkit
//
// This script injects FontAwesome icons into the module list on CivicPlus admin
// pages. It replaces the original Chrome extension version with a
// Tampermonkey‑compatible implementation that runs quickly and avoids
// repeated polling. Icons are only added for modules marked as default
// favorites and with a non‑empty default icon defined in `modules.json`.
//
// Key improvements:
// 1. Uses a single waitFor call to detect the presence of jQuery and the
//    module list, eliminating repeated timeouts.
// 2. Loads FontAwesome from a CDN (cdnjs) to avoid slow or blocked
//    requests to raw.githubusercontent.com.
// 3. Runs on all CivicPlus pages (the loader still applies CivicPlus
//    detection) and re-runs once after a short delay to catch any
//    dynamically injected modules.

(function () {
  'use strict';

  // Prevent multiple initialisations
  if (window.ModuleIcons && window.ModuleIcons.__loaded) return;

  window.ModuleIcons = {
    __loaded: false,

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

      // Helper to wait for a condition (e.g., jQuery availability or module list)
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

      // Wait for jQuery to load
      const hasJQ = await waitFor(() => !!window.jQuery, 4000);
      if (!hasJQ) return;
      const $ = window.jQuery;

      // Fetch modules.json from the repository
      let modules;
      try {
        const resp = await fetch('https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/data/modules.json', { cache: 'no-store' });
        if (!resp.ok) throw new Error('modules.json fetch failed');
        modules = await resp.json();
      } catch {
        return;
      }

      // Load FontAwesome from a CDN if not already loaded
      function loadFontAwesome() {
        if (document.getElementById('fontawesome_css')) return;
        const css = document.createElement('link');
        css.id = 'fontawesome_css';
        css.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        css.rel = 'stylesheet';
        css.type = 'text/css';
        (document.head || document.documentElement).appendChild(css);
      }

      // Inject icons into the module list
      function addIcons() {
        try {
          loadFontAwesome();
          for (const moduleClass in modules) {
            const classObj = modules[moduleClass];
            for (const modName in classObj) {
              const modObj = classObj[modName];
              if (!modObj['default-favorite']) continue;
              const faClass = modObj['default-icon'];
              if (!faClass) continue;
              const url = modObj['url'];
              $('.cp-ModuleList-itemLink[href*="' + url + '"]').each(function () {
                const link = $(this);
                if (link.data('module-icons-added')) return;
                link.prepend('<i class="' + faClass + '"></i>&nbsp;&nbsp;');
                link.css('font-weight', 'bold');
                link.data('module-icons-added', true);
              });
            }
          }
        } catch {
          // ignore errors
        }
      }

      // Wait for the module list to appear
      const hasList = await waitFor(() => $('.cp-ModuleList-itemLink').length > 0, 5000);
      if (hasList) addIcons();
      // Re-run once after a short delay to catch dynamic changes
      setTimeout(addIcons, 2000);
    }
  };
})();
