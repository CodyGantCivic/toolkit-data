// Sanitized graphic link autofill helper for CivicPlus Toolkit
// This helper automatically replaces the URL on graphic link buttons based on
// the button text or image metadata. It exports a single init() function
// and includes an idempotent guard so it runs only once per page. It
// replaces the original Chrome extension implementation by loading
// configuration data from GitHub and using standard web APIs. The helper
// adds a checkbox to allow enabling/disabling the autochanger for each
// graphic link.

(function (global) {
  'use strict';

  var NAME = 'GraphicLinkAutofill';
  global[NAME] = global[NAME] || {};
  if (global[NAME].__loaded) {
    return;
  }

  /**
   * Wait for a condition to be true before resolving. Used to wait for
   * jQuery and DOM elements to exist.
   * @param {Function} cond Condition function
   * @param {number} [timeout=5000] Timeout in ms
   * @param {number} [interval=100] Polling interval in ms
   * @returns {Promise<boolean>} True if condition met, false otherwise
   */
  function waitFor(cond, timeout, interval) {
    timeout = typeof timeout === 'number' ? timeout : 5000;
    interval = typeof interval === 'number' ? interval : 100;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (cond()) {
            return resolve(true);
          }
        } catch (_) {}
        if (Date.now() - start >= timeout) {
          return resolve(false);
        }
        setTimeout(check, interval);
      })();
    });
  }

  /**
   * Initialise the graphic link autofill helper. Fetches the
   * replacement text mapping, attaches UI and event handlers, and
   * monitors the button for changes. Only runs on the Graphic Links
   * admin page.
   */
  function init() {
    if (global[NAME].__loaded) {
      return;
    }
    global[NAME].__loaded = true;
    try {
      var path = (global.location && global.location.pathname || '').toLowerCase();
      // Only run on the Graphic Links admin page
      if (!path.startsWith('/admin/graphiclinks.aspx')) {
        return;
      }
    } catch (_) {
      return;
    }
    // Wait until jQuery and the link URL input exist
    waitFor(function () {
      return global.jQuery && global.jQuery('#linkUrl').length > 0;
    }, 6000, 100).then(function (ready) {
      if (!ready) {
        return;
      }
      var $ = global.jQuery;
      // Fetch replacement mapping from GitHub
      var replacementMap = {};
      // Use the raw GitHub URL to load the JSON file; update the path
      var mappingUrl = 'https://raw.githubusercontent.com/CodyGantCivic/toolkit-data/main/data/link-replacement-text.json';
      fetch(mappingUrl, { cache: 'no-store' })
        .then(function (resp) {
          if (resp.ok) {
            return resp.json();
          }
          return {};
        })
        .catch(function () {
          return {};
        })
        .then(function (json) {
          replacementMap = json || {};
          setupUI();
          attachHandlers();
          // Initial checks
          checkFancyButton();
          checkRegularButton();
        });

      // Add the enable/disable checkbox and warning area to the form
      function setupUI() {
        try {
          var checkbox = $(
            "<br><label class='check' style='width:47%' for='enableGraphicButtonAutochange'>" +
              "<input type='checkbox' id='enableGraphicButtonAutochange'>[CP Toolkit] Enable graphic link autochanger" +
              "</label><br><br><div style='color: red;' id='graphicButtonChangeWarn'></div>"
          );
          // Append after the OpenInNewWindow field
          var targetParent = $('#GraphicLink_OpenInNewWindow').parent().parent();
          if (targetParent.length) {
            checkbox.appendTo(targetParent);
          }
          // If linkUrl is empty (new link), enable autochanger by default
          if ($('#linkUrl').val() === '') {
            $('#enableGraphicButtonAutochange').prop('checked', true);
          }
        } catch (_) {}
      }

      // Check given text for a replacement URL and update the linkUrl input
      function checkForLink(theText) {
        try {
          var enabled = $('#enableGraphicButtonAutochange').is(':checked');
          if (!enabled) {
            return;
          }
          if (!theText) {
            return;
          }
          var text = String(theText).trim().toLowerCase();
          var urlFromText = null;
          Object.keys(replacementMap).forEach(function (linkUrl) {
            var matches = replacementMap[linkUrl] || [];
            matches.forEach(function (match) {
              if (text === String(match).toLowerCase()) {
                urlFromText = linkUrl;
              }
            });
          });
          if (urlFromText && $('#linkUrl').val() !== urlFromText) {
            $('#linkUrl').val(urlFromText);
            $('#graphicButtonChangeWarn').text(
              'Notice: The link was autochanged by the CivicPlus Toolkit. You must save the button to actually update the URL.'
            );
          }
        } catch (_) {}
      }

      // Inspect the fancy button container for text and update linkUrl accordingly
      function checkFancyButton() {
        try {
          var enabled = $('#enableGraphicButtonAutochange').is(':checked');
          if (!enabled) {
            return;
          }
          var container = $('.fancyButtonContainer .text');
          if (!container.length) {
            return;
          }
          var raw = container.html();
          if (!raw) {
            return;
          }
          // Replace HTML tags with spaces, split into words
          var words = raw
            .replace(/([\s\n]*<[^>]*>[\s\n]*)+/g, ' ')
            .trim()
            .split(/\s+/);
          words.forEach(function (word) {
            checkForLink(word);
          });
        } catch (_) {}
      }

      // Inspect the regular button image (if any) and fetch its metadata
      function checkRegularButton() {
        try {
          var enabled = $('#enableGraphicButtonAutochange').is(':checked');
          if (!enabled) {
            return;
          }
          var imgElem = $('.imagePreview').first();
          if (!imgElem.length) {
            return;
          }
          var src = imgElem.attr('src') || '';
          var parts = src.split('=');
          if (parts.length < 2) {
            return;
          }
          var imageID = parts[1];
          // Request document details page to get alt text and file name
          fetch('/Admin/DocumentCenter/DocumentForModal/Edit/' + imageID + '?folderID=1')
            .then(function (resp) {
              return resp.text();
            })
            .then(function (html) {
              try {
                var wrapper = document.createElement('div');
                wrapper.innerHTML = html;
                var altInput = wrapper.querySelector('#txtAltText');
                var nameInput = wrapper.querySelector('#txtDocumentName');
                var altText = (altInput && altInput.value) || '';
                var displayName = (nameInput && nameInput.value) || '';
                checkForLink(displayName);
                checkForLink(altText);
              } catch (_) {}
            })
            .catch(function () {});
        } catch (_) {}
      }

      // Attach DOM observers and event handlers
      function attachHandlers() {
        try {
          var img = $('.imagePreview')[0];
          if (img) {
            var imageObserver = new MutationObserver(function () {
              checkRegularButton();
            });
            imageObserver.observe(img, { attributes: true });
          }
          $('.fancyButtonContainer').on('DOMSubtreeModified', function () {
            checkFancyButton();
          });
          $('#enableGraphicButtonAutochange').on('change', function () {
            // Reevaluate both types when toggled
            checkFancyButton();
            checkRegularButton();
          });
        } catch (_) {}
      }
    });
  }

  // Expose the init method
  global[NAME].init = init;
})(window);
