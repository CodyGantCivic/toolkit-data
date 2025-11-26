// CivicPlus Toolkit: Title Changer Helper (sanitised)
// This helper updates the page title based on breadcrumbs or selected view,
// providing better context for administrators. It runs only once per page
// when invoked by the Toolkit loader. All Chrome extension calls and
// console logging have been removed.

;(function () {
  'use strict';

  const NS = 'TitleChanger';
  // Idempotent guard: if this helper has already been loaded on the page, do nothing
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
        } catch {
          // ignore errors
        }
        if (Date.now() - start > timeout) {
          return resolve(false);
        }
        setTimeout(check, interval);
      })();
    });
  }

  /**
   * Internal function to set the document title, preserving the original title
   * or, if absent, using the CP toolbar menu text as the fallback.
   * @param {string} titleToSet The new title prefix to set.
   */
  function setTitle(titleToSet) {
    try {
      let originalTitle = document.title || '';
      if (!originalTitle) {
        const toolbarLabel = document.querySelector('.cp-Toolbar-menu strong.ng-binding');
        if (toolbarLabel) {
          originalTitle = toolbarLabel.textContent.trim();
        }
      }
      if (!originalTitle) {
        originalTitle = document.title;
      }
      if (titleToSet) {
        document.title = `${titleToSet} | ${originalTitle}`;
      }
    } catch {
      // ignore any errors
    }
  }

  /**
   * Initialise the title changer. Should be invoked by the Toolkit loader on
   * admin or design center pages. Determines an appropriate title based on
   * breadcrumbs, headers or selected view.
   */
  function init() {
    if (window[NS] && window[NS].__loaded) {
      return;
    }
    window[NS] = window[NS] || {};
    window[NS].__loaded = true;

    (async () => {
      // Wait for jQuery and the DOM to be ready; fallback to vanilla if jQuery isn't present
      await waitFor(() => window.jQuery || document.readyState !== 'loading');
      const $ = window.jQuery;

      // Determine current path
      const path = (window.location.pathname || '').toLowerCase();
      // Only run on admin or design center pages
      if (!path.startsWith('/admin/') && !path.startsWith('/designcenter/')) {
        return;
      }

      const applyTitleForAdmin = () => {
        // Special-case: Graphic Links admin page has no meaningful title; set one
        if (path.startsWith('/admin/graphiclinks.aspx')) {
          const headerTitle = document.getElementById('ctl00_ctl00_adminHeader_headerTitle');
          if (headerTitle) {
            headerTitle.textContent = 'Graphic Links';
          }
        }
        // Look for breadcrumb labels inside the wayfinder
        let titleCandidate = '';
        if ($) {
          const breadcrumbEm = $('.wayfinder').find('em').first();
          if (breadcrumbEm.length && breadcrumbEm.text().trim()) {
            titleCandidate = breadcrumbEm.text().trim();
          } else {
            const breadcrumbLink = $('.wayfinder a').last();
            if (breadcrumbLink.length && breadcrumbLink.text().trim()) {
              titleCandidate = breadcrumbLink.text().trim();
            } else {
              const header = $('.header').find('h1').first();
              if (header.length && header.text().trim()) {
                titleCandidate = header.text().trim();
              }
            }
          }
        } else {
          // Vanilla fallback
          const wayfinder = document.querySelector('.wayfinder');
          if (wayfinder) {
            const em = wayfinder.querySelector('em');
            if (em && em.textContent.trim()) {
              titleCandidate = em.textContent.trim();
            } else {
              const links = wayfinder.querySelectorAll('a');
              if (links.length) {
                const last = links[links.length - 1];
                if (last && last.textContent.trim()) {
                  titleCandidate = last.textContent.trim();
                }
              }
            }
          }
          if (!titleCandidate) {
            const header = document.querySelector('.header h1');
            if (header && header.textContent.trim()) {
              titleCandidate = header.textContent.trim();
            }
          }
        }
        if (titleCandidate) {
          setTitle(titleCandidate);
        }
      };

      const applyTitleForDesignCenter = () => {
        let titleCandidate = '';
        if ($) {
          const selected = $('#currentView option:selected').first();
          if (selected.length && selected.text().trim()) {
            titleCandidate = selected.text().trim();
          }
        } else {
          const currentView = document.getElementById('currentView');
          if (currentView) {
            const selectedOption = currentView.options[currentView.selectedIndex];
            if (selectedOption && selectedOption.text.trim()) {
              titleCandidate = selectedOption.text.trim();
            }
          }
        }
        if (titleCandidate) {
          setTitle(titleCandidate);
        }
      };

      if (path.startsWith('/admin/')) {
        applyTitleForAdmin();
      } else if (path.startsWith('/designcenter/')) {
        applyTitleForDesignCenter();
      }
    })();
  }

  // Expose the helper's API
  window[NS] = window[NS] || {};
  window[NS].init = init;
})();
