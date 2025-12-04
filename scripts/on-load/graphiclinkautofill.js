// Optimised GraphicLinkAutofill helper for CivicPlus Toolkit
//
// This version removes the jQuery dependency and heavy DOM polling.  It
// uses native DOM APIs and MutationObservers to monitor the graphic link
// form, fetches the replacement map once and caches it, and provides
// a checkbox to enable or disable automatic URL updates based on button
// text or image metadata.  The helper runs only on the Graphic Links
// admin page and exposes a single `init()` method.

(function (global) {
  'use strict';

  const NAME = 'GraphicLinkAutofill';
  global[NAME] = global[NAME] || {};
  if (global[NAME].__loaded) {
    return;
  }

  // Replacement map loaded from GitHub
  let replacementMap = {};
  // Whether the mapping has been loaded
  let mappingLoaded = false;

  /**
   * Wait for a DOM element matching a selector to appear.  Returns a
   * promise that resolves with the element or null if the timeout
   * expires.
   * @param {string} selector
   * @param {number} timeout
   * @returns {Promise<Element|null>}
   */
  function waitForElement(selector, timeout = 6000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Load the replacement mapping from the repository.  Caches it on
   * window.CPToolkit if available to avoid refetching.
   * @returns {Promise<void>}
   */
  async function loadMapping() {
    try {
      if (mappingLoaded) return;
      // Check if already cached on CPToolkit
      if (global.CPToolkit && global.CPToolkit.linkReplacementMap) {
        replacementMap = global.CPToolkit.linkReplacementMap;
        mappingLoaded = true;
        return;
      }
      const url =
        'https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/data/link-replacement-text.json';
      const resp = await fetch(url, { cache: 'no-store' });
      if (resp.ok) {
        const json = await resp.json();
        replacementMap = json || {};
        mappingLoaded = true;
        if (global.CPToolkit) {
          global.CPToolkit.linkReplacementMap = replacementMap;
        }
      }
    } catch (_) {
      // ignore fetch errors; mapping remains empty
    }
  }

  /**
   * Create the UI elements: a checkbox to enable/disable autochange and
   * a warning area.  Inserts them after the OpenInNewWindow control.
   */
  function setupUI() {
    try {
      const parent = document.getElementById('GraphicLink_OpenInNewWindow');
      if (!parent) return;
      // Prevent duplicate insertion
      if (document.getElementById('enableGraphicButtonAutochange')) return;
      // Build the wrapper with the checkbox and warning div
      const wrapper = document.createElement('div');
      wrapper.innerHTML =
        "<label class='check' style='width:47%' for='enableGraphicButtonAutochange'>" +
        "<input type='checkbox' id='enableGraphicButtonAutochange'>[CP Toolkit] Enable graphic link autochanger" +
        '</label>' +
        "<div style='color: red;' id='graphicButtonChangeWarn'></div>";
      // Insert the wrapper immediately after the OpenInNewWindow input.  This
      // preserves the original position of the label relative to the existing
      // controls, matching the pre-refactor layout.
      parent.parentNode.insertBefore(wrapper, parent.nextSibling);
      // If linkUrl is empty (new link), enable autochanger by default
      const linkInput = document.getElementById('linkUrl');
      const checkbox = document.getElementById('enableGraphicButtonAutochange');
      if (linkInput && checkbox && linkInput.value === '') {
        checkbox.checked = true;
      }
    } catch (_) {
      // ignore UI errors
    }
  }

  /**
   * Check the provided text for a replacement URL.  If found, update
   * the link URL input and display a warning message.
   * @param {string} theText
   */
  function checkForLink(theText) {
    try {
      const checkbox = document.getElementById('enableGraphicButtonAutochange');
      if (!checkbox || !checkbox.checked) return;
      if (!theText) return;
      const text = String(theText).trim().toLowerCase();
      let urlFromText = null;
      Object.keys(replacementMap).forEach((linkUrl) => {
        const matches = replacementMap[linkUrl] || [];
        matches.forEach((match) => {
          if (text === String(match).toLowerCase()) {
            urlFromText = linkUrl;
          }
        });
      });
      const linkInput = document.getElementById('linkUrl');
      if (urlFromText && linkInput && linkInput.value !== urlFromText) {
        linkInput.value = urlFromText;
        const warn = document.getElementById('graphicButtonChangeWarn');
        if (warn) {
          warn.textContent =
            'Notice: The link was autochanged by the CivicPlus Toolkit. You must save the button to actually update the URL.';
        }
      }
    } catch (_) {
      // ignore match errors
    }
  }

  /**
   * Inspect the fancy button container for text and update the link
   * accordingly.  Removes HTML tags and checks each word.
   */
  function checkFancyButton() {
    try {
      const container = document.querySelector('.fancyButtonContainer .text');
      if (!container) return;
      const raw = container.innerHTML;
      if (!raw) return;
      const words = raw
        .replace(/([\s\n]*<[^>]*>[\s\n]*)+/g, ' ')
        .trim()
        .split(/\s+/);
      words.forEach((word) => {
        checkForLink(word);
      });
    } catch (_) {
      // ignore
    }
  }

  /**
   * Inspect the regular button image preview and fetch its metadata to
   * determine a replacement URL.  Uses fetch() to request the document
   * details page and then parses the alt text and display name.
   */
  function checkRegularButton() {
    try {
      const imgElem = document.querySelector('.imagePreview');
      if (!imgElem) return;
      const src = imgElem.getAttribute('src') || '';
      const parts = src.split('=');
      if (parts.length < 2) return;
      const imageID = parts[1];
      // Request document details page to get alt text and file name
      fetch('/Admin/DocumentCenter/DocumentForModal/Edit/' + imageID + '?folderID=1')
        .then((resp) => resp.text())
        .then((html) => {
          try {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = html;
            const altInput = wrapper.querySelector('#txtAltText');
            const nameInput = wrapper.querySelector('#txtDocumentName');
            const altText = (altInput && altInput.value) || '';
            const displayName = (nameInput && nameInput.value) || '';
            checkForLink(displayName);
            checkForLink(altText);
          } catch (_) {
            /* ignore parse errors */
          }
        })
        .catch(() => {
          /* ignore network errors */
        });
    } catch (_) {
      // ignore errors
    }
  }

  /**
   * Attach observers and event handlers.  Uses MutationObservers to
   * monitor changes to the image preview and fancy button container.
   */
  function attachHandlers() {
    try {
      const imgElem = document.querySelector('.imagePreview');
      if (imgElem && !imgElem.__cp_image_observer) {
        const imageObserver = new MutationObserver(() => {
          checkRegularButton();
        });
        imageObserver.observe(imgElem, { attributes: true });
        imgElem.__cp_image_observer = imageObserver;
      }
      const fancyContainer = document.querySelector('.fancyButtonContainer');
      if (fancyContainer && !fancyContainer.__cp_fancy_observer) {
        const fancyObserver = new MutationObserver(() => {
          checkFancyButton();
        });
        fancyObserver.observe(fancyContainer, { childList: true, subtree: true });
        fancyContainer.__cp_fancy_observer = fancyObserver;
      }
      const checkbox = document.getElementById('enableGraphicButtonAutochange');
      if (checkbox && !checkbox.__cp_change_handler) {
        checkbox.addEventListener('change', () => {
          checkFancyButton();
          checkRegularButton();
        });
        checkbox.__cp_change_handler = true;
      }
    } catch (_) {
      // ignore observer errors
    }
  }

  /**
   * Initialise the graphic link autofill helper.  This runs only on
   * /admin/graphiclinks.aspx and sets up the UI, loads the mapping,
   * attaches observers and checks both fancy and regular buttons.
   */
  function init() {
    if (global[NAME].__loaded) return;
    global[NAME].__loaded = true;
    try {
      const path = (global.location && global.location.pathname || '').toLowerCase();
      if (!path.startsWith('/admin/graphiclinks.aspx')) return;
    } catch (_) {
      return;
    }
    (async () => {
      const linkInput = await waitForElement('#linkUrl', 6000);
      if (!linkInput) return;
      await loadMapping();
      setupUI();
      attachHandlers();
      // Initial checks
      checkFancyButton();
      checkRegularButton();
    })();
  }

  // Export init
  global[NAME].init = init;
})(window);
