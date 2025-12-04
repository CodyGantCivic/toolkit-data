// Optimised XMLMajorChangeAlert helper for CivicPlus Toolkit
//
// This refactoring removes the dependency on jQuery and expensive DOM
// polling.  It uses native DOM APIs and MutationObservers to detect when
// the XML upload input appears and to watch for error messages.  The
// helper warns administrators if a new layout XML removes existing
// containers or if content containers are malformed (contain nested
// elements).  It also updates the Save button’s style and text to
// indicate when the warning is active.  The helper exposes a single
// `init()` method and is idempotent.

(function (global) {
  'use strict';

  const NAME = 'XMLMajorChangeAlert';
  global[NAME] = global[NAME] || {};
  if (global[NAME].__loaded) {
    return;
  }

  // Store the original XML and its element IDs
  let originalIds = [];

  /**
   * Parse an XML string into a DOM Document.  Returns null on failure.
   * @param {string} xml
   * @returns {Document|null}
   */
  function parseXml(xml) {
    try {
      return new DOMParser().parseFromString(xml || '', 'text/xml');
    } catch (_) {
      return null;
    }
  }

  /**
   * Extract all element IDs from the given XML string.
   * @param {string} xml
   * @returns {string[]}
   */
  function extractIds(xml) {
    const doc = parseXml(xml);
    if (!doc) return [];
    return Array.from(doc.querySelectorAll('*'))
      .map((n) => {
        try {
          return n.getAttribute && n.getAttribute('id');
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
  }

  /**
   * Find any content containers (elements with cpRole="contentContainer")
   * that incorrectly contain children.  Returns an array of objects with
   * the container id and its child ids.
   * @param {string} xml
   */
  function findMalformed(xml) {
    const doc = parseXml(xml);
    if (!doc) return [];
    return Array.from(doc.querySelectorAll('[cprole="contentContainer"]'))
      .filter((n) => n.children && n.children.length)
      .map((n) => {
        return {
          id: n.getAttribute('id') || '(no id)',
          childIds: Array.from(n.children).map((c) => c.id || '(no id)'),
        };
      });
  }

  /**
   * Create or locate the alert element used to display warnings.  It
   * attempts to append to the file input’s parent if available, falling
   * back to the top of the body.  Returns the alert element.
   * @returns {HTMLElement}
   */
  function ensureAlert() {
    let alertEl = document.getElementById('toolkitAlert');
    if (alertEl) return alertEl;
    alertEl = document.createElement('div');
    alertEl.id = 'toolkitAlert';
    alertEl.style.margin = '6px 0';
    alertEl.style.fontSize = '13px';
    alertEl.style.whiteSpace = 'pre-line';
    // Try to insert after the file input’s parent if present
    const fileInput = document.getElementById('structureFile');
    if (fileInput && fileInput.parentNode) {
      fileInput.parentNode.appendChild(alertEl);
    } else {
      // Otherwise insert at the beginning of the body
      const parent = document.body || document.documentElement;
      parent.insertBefore(alertEl, parent.firstChild);
    }
    return alertEl;
  }

  /**
   * Update the Save button’s appearance and text depending on whether
   * there are removed container IDs.  If there are removed IDs, set a
   * red background and change the label to warn about ignoring the XML
   * warning; otherwise restore the original styling.
   * @param {boolean} hasRemoved Whether any containers were removed.
   */
  function updateSaveButton(hasRemoved) {
    try {
      const saveBtn = document.querySelector('a.button.save');
      if (!saveBtn) return;
      const span = saveBtn.querySelector('span');
      if (hasRemoved) {
        saveBtn.style.backgroundColor = '#B33A3A';
        saveBtn.style.borderBottomColor = '#792327';
        saveBtn.style.color = '#fff';
        if (span) span.textContent = 'Save ignoring XML warning';
      } else {
        saveBtn.style.backgroundColor = '';
        saveBtn.style.borderBottomColor = '';
        saveBtn.style.color = '';
        if (span) span.textContent = 'Save';
      }
    } catch (_) {
      // silently ignore style errors
    }
  }

  /**
   * Refresh the stored original XML IDs by reading the first <code>
   * element’s text content.  Called on initialisation and whenever the
   * page becomes visible or gains focus.  If no <code> element exists,
   * originalIds is reset to an empty array.
   */
  function refreshOriginal() {
    try {
      const code = document.querySelector('code');
      const xmlText = code ? code.textContent.trim() : '';
      originalIds = extractIds(xmlText).sort();
    } catch (_) {
      originalIds = [];
    }
  }

  /**
   * Handle a file input change event.  Reads the selected file as text,
   * compares its container IDs to the original, displays warnings for
   * removed containers, updates the Save button styling, and alerts
   * about malformed containers.
   * @param {HTMLInputElement} input
   */
  function handleFileInput(input) {
    try {
      const file = input && input.files && input.files[0];
      const alertEl = ensureAlert();
      if (!file) {
        // Clear alert and reset button if no file selected
        alertEl.textContent = '';
        updateSaveButton(false);
        return;
      }
      const reader = new FileReader();
      reader.onload = function (ev) {
        try {
          const raw = ev.target && ev.target.result ? ev.target.result : '';
          const idx = raw.indexOf('<?xml');
          const newXml = idx >= 0 ? raw.slice(idx) : raw;
          const newIds = extractIds(newXml).sort();
          // Determine which IDs have been removed
          const removed = originalIds.filter((id) => newIds.indexOf(id) < 0);
          if (removed.length) {
            alertEl.innerHTML =
              'Warning: The new XML is missing containers:\n\n' + removed.join(', ');
            alertEl.style.color = 'red';
            updateSaveButton(true);
          } else {
            alertEl.textContent = 'This XML keeps all existing containers.';
            alertEl.style.color = 'green';
            updateSaveButton(false);
          }
          // Check for malformed containers
          const mal = findMalformed(newXml);
          mal.forEach((m) => {
            try {
              alert(
                'The chosen XML is malformed:\n\n' +
                  m.id +
                  ' contains:\n\n' +
                  m.childIds.join('\n') +
                  '\n\nContent containers must not contain elements.'
              );
            } catch (_) {}
          });
        } catch (_) {
          // ignore errors during file read
        }
      };
      reader.readAsText(file);
    } catch (_) {
      // ignore handler errors
    }
  }

  /**
   * Attach event listeners to the structure file input and error message
   * element (if present).  Refreshes the original XML IDs when called.
   */
  function attachHandlers() {
    try {
      const fileInput = document.getElementById('structureFile');
      if (fileInput && !fileInput.__cp_xml_handlers_attached) {
        fileInput.__cp_xml_handlers_attached = true;
        fileInput.addEventListener('change', function () {
          handleFileInput(fileInput);
        });
        // On initial attachment, refresh original IDs
        refreshOriginal();
      }
      const errorMsg = document.getElementById('ErrorMessage');
      if (errorMsg && !errorMsg.__cp_xml_error_observer) {
        const errObserver = new MutationObserver(() => {
          try {
            const text = (errorMsg.textContent || '').trim();
            if (text) {
              alert(text);
            }
          } catch (_) {}
        });
        errObserver.observe(errorMsg, { childList: true, subtree: true });
        errorMsg.__cp_xml_error_observer = errObserver;
      }
    } catch (_) {
      // ignore attaching errors
    }
  }

  /**
   * Watch the document for insertion of the structureFile input.  When
   * it appears, attach handlers and refresh the original XML.  This
   * uses a MutationObserver on the body to catch dynamic content
   * insertion without polling.
   */
  function watchForStructureFile() {
    try {
      const root = document.body || document.documentElement;
      if (!root || root.__cp_xml_observer_installed) return;
      const mo = new MutationObserver((mutations) => {
        try {
          for (const m of mutations) {
            if (m.addedNodes && m.addedNodes.length) {
              for (const node of m.addedNodes) {
                if (!node) continue;
                try {
                  if (
                    node.id === 'structureFile' ||
                    (node.querySelector && node.querySelector('#structureFile'))
                  ) {
                    // Found the file input; attach handlers
                    attachHandlers();
                    return;
                  }
                } catch (_) {}
              }
            }
          }
        } catch (_) {
          /* ignore */
        }
      });
      mo.observe(root, { childList: true, subtree: true });
      root.__cp_xml_observer_installed = mo;
    } catch (_) {
      // ignore observer setup errors
    }
  }

  /**
   * Initialise the XMLMajorChangeAlert helper.  Runs only on the
   * DesignCenter layout modify page.  Sets up initial handlers and
   * watchers and hooks into visibility/focus events to refresh the
   * original XML IDs when the page becomes active again.
   */
  function init() {
    if (global[NAME].__loaded) return;
    global[NAME].__loaded = true;
    // Check the URL path
    try {
      const path = (global.location && global.location.pathname || '').toLowerCase();
      if (path.indexOf('/admin/designcenter/layouts/modify') === -1) return;
    } catch (_) {
      return;
    }
    try {
      // Attach handlers if the structureFile input already exists
      attachHandlers();
      // Start observing for the input if not yet present
      watchForStructureFile();
      // Refresh original XML and attach on visibility/focus
      if (!document.__cp_xml_visibility_hook) {
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') {
            refreshOriginal();
            attachHandlers();
          }
        });
        window.addEventListener('focus', function () {
          refreshOriginal();
          attachHandlers();
        });
        document.__cp_xml_visibility_hook = true;
      }
    } catch (_) {
      // ignore init errors
    }
  }

  // Expose the init function
  global[NAME].init = init;

})(window);
