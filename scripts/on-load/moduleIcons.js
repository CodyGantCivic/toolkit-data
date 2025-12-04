// ModuleIcons.js - Optimised CivicPlus Toolkit helper
//
// This script injects FontAwesome icons into the module list on CivicPlus admin
// pages.  It replaces the original jQuery-based implementation with a
// native‑DOM version that runs quickly and avoids repeated polling.  Icons are
// only added for modules marked as default favorites with a non‑empty default
// icon defined in `modules.json`.

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

      /**
       * Ensure FontAwesome icons are loaded.  Returns a promise that
       * resolves once the stylesheet has loaded or if icons already
       * exist on the page.  Uses a CDN to avoid slow raw GitHub fetches.
       */
      function ensureFontAwesome() {
        return new Promise(function (resolve) {
          try {
            // If any FA classes are present, assume it is loaded.
            if (document.querySelector('.fa, .fas, .far, .fal, .fab')) {
              resolve();
              return;
            }
            // If the stylesheet is already injected, wait briefly and resolve.
            if (document.getElementById('moduleicons-fa')) {
              setTimeout(resolve, 200);
              return;
            }
            var link = document.createElement('link');
            link.id = 'moduleicons-fa';
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
            link.onload = resolve;
            link.onerror = resolve;
            document.head.appendChild(link);
          } catch (e) {
            resolve();
          }
        });
      }

      /**
       * Wait for a selector to appear in the DOM. Uses MutationObserver
       * and times out after the specified milliseconds.
       * @param {string} selector CSS selector to wait for.
       * @param {number} timeout Maximum time to wait in ms.
       * @returns {Promise<Element|null>} Resolves with the element or null.
       */
      function waitForElement(selector, timeout) {
        timeout = timeout || 4000;
        return new Promise(function (resolve) {
          const existing = document.querySelector(selector);
          if (existing) {
            resolve(existing);
            return;
          }
          let timer;
          const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
              clearTimeout(timer);
              observer.disconnect();
              resolve(el);
            }
          });
          observer.observe(document.documentElement, { childList: true, subtree: true });
          timer = setTimeout(() => {
            observer.disconnect();
            resolve(null);
          }, timeout);
        });
      }

      // Load the modules JSON.  Reuse cached data on window.CPToolkit if present.
      async function getModules() {
        if (window.CPToolkit && window.CPToolkit.modulesJson) {
          return window.CPToolkit.modulesJson;
        }
        try {
          const resp = await fetch('https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/data/modules.json', { cache: 'no-store' });
          if (!resp.ok) throw new Error('modules.json fetch failed');
          const data = await resp.json();
          if (window.CPToolkit) {
            window.CPToolkit.modulesJson = data;
          }
          return data;
        } catch {
          return null;
        }
      }

      // Inject icons into the module list
      async function addIcons() {
        const modules = await getModules();
        if (!modules) return;
        await ensureFontAwesome();
        try {
          for (const moduleClass in modules) {
            const classObj = modules[moduleClass];
            for (const modName in classObj) {
              const modObj = classObj[modName];
              if (!modObj['default-favorite']) continue;
              const faClass = modObj['default-icon'];
              if (!faClass) continue;
              const url = modObj['url'];
              const links = document.querySelectorAll('.cp-ModuleList-itemLink[href*="' + url + '"]');
              links.forEach(function (link) {
                if (link.dataset.moduleIconsAdded) return;
                // Create the icon element
                const icon = document.createElement('i');
                icon.className = faClass;
                // Insert icon at beginning of link
                link.insertBefore(icon, link.firstChild);
                // Add spacing after the icon
                const spacer = document.createTextNode('\u00A0\u00A0');
                link.insertBefore(spacer, link.firstChild.nextSibling);
                // Bold the text
                link.style.fontWeight = 'bold';
                link.dataset.moduleIconsAdded = 'true';
              });
            }
          }
        } catch {
          // ignore errors
        }
      }

      // Wait for the module list to appear
      const listEl = await waitForElement('.cp-ModuleList-itemLink', 4000);
      if (listEl) {
        addIcons();
      }
      // Re-run once after a short delay to catch dynamic changes
      setTimeout(addIcons, 2000);
    }
  };
})();

