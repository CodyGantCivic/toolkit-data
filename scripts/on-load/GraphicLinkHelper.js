// GraphicLinkHelper.js
// Version: 1.0.1
// Purpose: Normalize Graphic Links admin page handlers, remove duplicate CSS include, and add helpful notices.
// Safe wrapper: idempotent + waits for jQuery + DOM ready
(function globalGraphicLinkHelperWrapper() {
  'use strict';

  // Raw script id (used for idempotent guard)
  var SCRIPT_ID = 'CP_GraphicLinkHelper_v1_0_1';

  // Idempotent guard
  if (window.__CPToolkitLoaded && window.__CPToolkitLoaded[SCRIPT_ID]) {
    return;
  }
  window.__CPToolkitLoaded = window.__CPToolkitLoaded || {};
  // We'll set the flag once the script successfully starts running (below).

  // Utility: wait for condition with timeout
  function waitFor(conditionFn, cb, checkInterval = 50, timeout = 10000) {
    var waited = 0;
    (function _tick() {
      try {
        if (conditionFn()) return cb(null);
      } catch (err) {
        return cb(err);
      }
      waited += checkInterval;
      if (waited >= timeout) return cb(new Error('waitFor: timeout'));
      setTimeout(_tick, checkInterval);
    })();
  }

  // Main initialization function
  function init() {
    try {
      // mark loaded so re-injection is a no-op
      window.__CPToolkitLoaded[SCRIPT_ID] = true;

      var $ = window.jQuery;
      if (!$) return; // defensive

      // Run on DOM ready
      $(function () {
        try {
          // Remove any previously injected FancyButtonEditor.css link (avoid duplicates)
          try {
            $('link[href*="FancyButtonEditor.css"]').remove();
          } catch (e) {
            // swallow, non-critical
            console.error('GraphicLinkHelper: failed removing FancyButtonEditor.css', e);
          }

          // Add a small notice to any textarea with class .autoUpdate to help admins understand behavior
          try {
            $('textarea.autoUpdate').each(function () {
              var $ta = $(this);
              if ($ta.data('graphic-link-helper-noted')) return;
              $ta.data('graphic-link-helper-noted', true);
              var $note = $('<div>')
                .addClass('cp-graphiclink-notice')
                .css({ margin: '6px 0', fontSize: '12px', color: '#444' })
                .text('Note: This field is auto-saved by Graphic Links. Be sure to preview before publishing.');
              $ta.before($note);
            });
          } catch (e) {
            console.error('GraphicLinkHelper: failed adding textarea notice', e);
          }

          // Wrap/normalize handlers for modify / insertFancy buttons.
          // Some pages attach inline handlers multiple times or rely on fragile selectors.
          // We'll find existing handlers (if any) and wrap to ensure consistent behavior.
          try {
            function wrapButtonHandler($btn, handlerName) {
              if (!$btn || $btn.length === 0) return;
              // Avoid double-wrap
              if ($btn.data('graphiclink-wrapped')) return;
              $btn.data('graphiclink-wrapped', true);

              // Store previous click handlers (if any) and call them
              var prev = $._data($btn[0], 'events') && $._data($btn[0], 'events').click;
              // create new click handler
              $btn.off('click.__graphiclink_helper');
              $btn.on('click.__graphiclink_helper', function (ev) {
                try {
                  // Normalization step: replace any "fancyButtonN" classes with a stable "fancy-button" class
                  var $this = $(this);
                  var classes = $this.attr('class') || '';
                  if (/fancyButton\d+/.test(classes)) {
                    $this.removeClass(function (i, c) {
                      return (c.match(/fancyButton\d+/g) || []).join(' ');
                    }).addClass('fancy-button');
                  }
                  // Call previous handlers in order
                  if (prev && prev.length) {
                    for (var i = 0; i < prev.length; i++) {
                      try {
                        prev[i].handler.call(this, ev);
                      } catch (err) {
                        console.error('GraphicLinkHelper: previous handler error', err);
                      }
                    }
                  }
                } catch (err) {
                  console.error('GraphicLinkHelper: wrapper handler error', err);
                }
              });
            }

            // Find common button selectors used on the Graphic Links page
            var modifySelectors = [
              '.modify',                // markup used by control
              'a[data-action="modify"]',
              'input[name="modify"]'
            ];
            var insertFancySelectors = [
              '.insertFancy',
              'a.insertFancy',
              'button.insertFancy'
            ];

            // wrap matching elements
            modifySelectors.forEach(function (sel) {
              $(sel).each(function () { wrapButtonHandler($(this), 'modify'); });
            });
            insertFancySelectors.forEach(function (sel) {
              $(sel).each(function () { wrapButtonHandler($(this), 'insertFancy'); });
            });

            // Also observe DOM mutations for dynamically added buttons (to wrap them)
            try {
              var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mut) {
                  (mut.addedNodes || []).forEach(function (node) {
                    if (!node.querySelectorAll) return;
                    // check for our selectors
                    var nodes = node.querySelectorAll(modifySelectors.join(',') + ',' + insertFancySelectors.join(','));
                    if (nodes && nodes.length) {
                      $(nodes).each(function () { wrapButtonHandler($(this)); });
                    }
                  });
                });
              });
              observer.observe(document.body, { childList: true, subtree: true });
            } catch (e) {
              // MutationObserver may not be available in very old browsers; non-critical
            }
          } catch (e) {
            console.error('GraphicLinkHelper: failed wrapping handlers', e);
          }
        } catch (e) {
          console.error('GraphicLinkHelper: initialization error', e);
        }
      });
    } catch (err) {
      console.error('GraphicLinkHelper: init failed', err);
    }
  }

  // Wait for jQuery to be available, then init
  waitFor(
    function () { return !!(window.jQuery && document.readyState !== 'loading'); },
    function (err) {
      if (err) {
        // if no jQuery within timeout, try to init anyway after DOMContentLoaded
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function () {
            if (window.jQuery) init();
            else console.warn('GraphicLinkHelper: jQuery not found; aborting.');
          });
        } else {
          if (window.jQuery) init();
          else console.warn('GraphicLinkHelper: jQuery not found; aborting.');
        }
      } else {
        init();
      }
    },
    50,
    10000
  );

})();
