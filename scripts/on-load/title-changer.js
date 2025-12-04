// CivicPlus Toolkit: Title Changer Helper (refactored)
//
// This helper updates the page title based on breadcrumbs or the selected
// view on admin and design center pages.  It has been refactored to
// eliminate the jQuery dependency and avoid polling.  The helper runs
// automatically after the DOM is ready and performs a second pass
// shortly thereafter to catch asynchronously loaded elements.

(function () {
  'use strict';

  const NS = 'TitleChanger';
  // Prevent multiple initialisations
  if (window[NS] && window[NS].__loaded) {
    return;
  }

  /**
   * Set the document title, preserving the original title if possible. If
   * there is no original title, attempt to read a fallback from the
   * toolbar label. This function is idempotent and silently ignores
   * errors.
   * @param {string} prefix The prefix to prepend to the title.
   */
  function setTitle(prefix) {
    try {
      let originalTitle = document.title || '';
      // If the current title is empty, try to get a meaningful label
      if (!originalTitle) {
        const toolbarLabel = document.querySelector('.cp-Toolbar-menu strong.ng-binding');
        if (toolbarLabel) {
          originalTitle = toolbarLabel.textContent.trim();
        }
      }
      if (!originalTitle) {
        originalTitle = document.title;
      }
      if (prefix && originalTitle) {
        document.title = `${prefix} | ${originalTitle}`;
      }
    } catch (_) {
      // ignore
    }
  }

  /**
   * Determine a suitable title for admin pages. This looks at the
   * breadcrumb trail ('.wayfinder'), falling back to the page header
   * ('.header h1') if necessary.  It also fixes the header for the
   * Graphic Links page when no meaningful header is present.
   */
  function applyTitleForAdmin() {
    const path = (window.location.pathname || '').toLowerCase();
    // Special case for Graphic Links: ensure header text exists
    if (path.startsWith('/admin/graphiclinks.aspx')) {
      const headerTitle = document.getElementById('ctl00_ctl00_adminHeader_headerTitle');
      if (headerTitle) {
        headerTitle.textContent = 'Graphic Links';
      }
    }
    let titleCandidate = '';
    const wayfinder = document.querySelector('.wayfinder');
    if (wayfinder) {
      // Prefer an <em> inside the wayfinder
      const em = wayfinder.querySelector('em');
      if (em && em.textContent && em.textContent.trim()) {
        titleCandidate = em.textContent.trim();
      } else {
        // Otherwise take the last breadcrumb link
        const links = wayfinder.querySelectorAll('a');
        if (links && links.length) {
          const last = links[links.length - 1];
          if (last && last.textContent && last.textContent.trim()) {
            titleCandidate = last.textContent.trim();
          }
        }
      }
    }
    if (!titleCandidate) {
      // Fallback to the first H1 in the header
      const header = document.querySelector('.header h1');
      if (header && header.textContent && header.textContent.trim()) {
        titleCandidate = header.textContent.trim();
      }
    }
    if (titleCandidate) {
      setTitle(titleCandidate);
    }
  }

  /**
   * Determine a suitable title for Design Center pages.  It reads the
   * selected option from the #currentView dropdown.
   */
  function applyTitleForDesignCenter() {
    let titleCandidate = '';
    const currentView = document.getElementById('currentView');
    if (currentView && currentView.options && currentView.options.length) {
      const selectedIndex = currentView.selectedIndex;
      if (selectedIndex >= 0) {
        const selectedOption = currentView.options[selectedIndex];
        if (selectedOption && selectedOption.text && selectedOption.text.trim()) {
          titleCandidate = selectedOption.text.trim();
        }
      }
    }
    if (titleCandidate) {
      setTitle(titleCandidate);
    }
  }

  /**
   * Run the appropriate title update based on the current URL path.
   */
  function updateTitle() {
    const path = (window.location.pathname || '').toLowerCase();
    if (path.startsWith('/admin/')) {
      applyTitleForAdmin();
    } else if (path.startsWith('/designcenter/')) {
      applyTitleForDesignCenter();
    }
  }

  /**
   * Initialise the TitleChanger helper. Attaches update logic after the DOM
   * is ready, then runs a second pass shortly thereafter to handle
   * asynchronously loaded elements.  Subsequent calls are ignored.
   */
  function init() {
    if (window[NS] && window[NS].__loaded) {
      return;
    }
    window[NS] = window[NS] || {};
    window[NS].__loaded = true;
    const runUpdate = () => {
      try {
        updateTitle();
      } catch (_) {
        // ignore errors
      }
    };
    if (document.readyState !== 'loading') {
      runUpdate();
    } else {
      document.addEventListener('DOMContentLoaded', runUpdate);
    }
    // Run a second update after a short delay to catch dynamic content
    setTimeout(runUpdate, 2000);
  }

  // Expose the helper API
  window[NS] = window[NS] || {};
  window[NS].init = init;
})();
