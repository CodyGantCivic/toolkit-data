// CivicPlus Toolkit - Widget Skin Helper (Optimised)
// This helper enhances the widget skin editing experience in the Design
// Center Theme Manager.  It has been refactored to remove repeated
// polling loops; instead, it waits asynchronously for jQuery and
// initializePopovers to become available before hooking.  The helper
// exports an idempotent `init()` method that the CP Toolkit loader
// invokes on appropriate pages.  The core logic for replacing skin
// numbers in the miscellaneous styles textareas and checking bracket
// validity is preserved from the original userscript.

(function () {
  'use strict';

  // Prevent duplicate loading
  if (window.WidgetSkinHelper && window.WidgetSkinHelper.__loaded) {
    return;
  }

  window.WidgetSkinHelper = {
    __loaded: false,
    init: async function () {
      if (window.WidgetSkinHelper.__loaded) return;
      window.WidgetSkinHelper.__loaded = true;
      try {
        const path = (window.location.pathname || '').toLowerCase();
        if (!path.includes('/designcenter/themes')) {
          return;
        }
        // Helper to wait for a condition using a simple polling mechanism with
        // timeout.  This avoids nested setTimeout calls and runs only once.
        function waitFor(testFn, timeout = 6000, interval = 100) {
          const start = Date.now();
          return new Promise(resolve => {
            (function check() {
              try {
                if (testFn()) return resolve(true);
              } catch (_) {}
              if (Date.now() - start >= timeout) return resolve(false);
              setTimeout(check, interval);
            })();
          });
        }
        // Wait for jQuery and initializePopovers
        const ready = await waitFor(() => {
          return (
            typeof window.$ !== 'undefined' &&
            typeof window.$.fn !== 'undefined' &&
            typeof window.initializePopovers !== 'undefined'
          );
        }, 6000, 100);
        if (!ready) {
          return;
        }
        // If we've already hooked, do not hook again
        if (window.__cpToolkit_original_initializePopovers) {
          return;
        }
        // Utility to alert on bracket mismatches
        function checkValidBracket(text) {
          if (text.indexOf('}') > text.indexOf('{') || ((text.indexOf('}') === -1) && (text.indexOf('{') !== -1))) {
            alert('Invalid CSS detected. You appear to be using a { before using a }.');
          }
          var numLeft = 0;
          var numRight = 0;
          for (var i = 0; i < text.length; i++) {
            if (text[i] === '}') numRight++;
            else if (text[i] === '{') numLeft++;
          }
          var diff = Math.abs(numLeft - numRight);
          if (numLeft > numRight) {
            alert('Invalid CSS. You have ' + diff + ' extra {.');
          } else if (numLeft < numRight) {
            alert('Invalid CSS. You have ' + diff + ' extra }.');
          }
        }
        // Save original initializePopovers and hook it
        window.__cpToolkit_original_initializePopovers = window.initializePopovers;
        window.initializePopovers = function () {
          try {
            if (typeof window.__cpToolkit_original_initializePopovers === 'function') {
              window.__cpToolkit_original_initializePopovers();
            }
          } catch (_) {}
          // Ensure jQuery is available
          var $ = window.$;
          if (!$) return;
          // When widget skin popover is present, apply helpers
          if ($('.cpPopOver #widgetSkinName').length) {
            var skinId = $('.cpPopOver input#hdnSkinID').val();
            if (typeof skinId === 'undefined') skinId = '-1';
            // Editing existing skin
            if (skinId !== '-1') {
              // Remove stray focused classes from other skin entries after a moment
              setTimeout(function () {
                var shouldBeFocused = $('.skin' + skinId + ' .focused');
                $('.focused').not(shouldBeFocused).removeClass('focused');
              }, 500);
              var textAreas = $('.cpPopOver [id*="MiscellaneousStyles"]');
              textAreas.each(function () {
                var elem = this;
                // Capture any existing change handler (if attached via jQuery)
                var existingEvents = $.fn ? $.fn.data ? undefined : undefined : undefined;
                var existingChangeFn = null;
                try {
                  existingEvents = $._data(elem, 'events');
                  existingChangeFn = existingEvents && existingEvents.change && existingEvents.change[0] ? existingEvents.change[0].handler : null;
                } catch (_) {}
                var currentVal = $(elem).val() || '';
                currentVal = currentVal.replace(/\.skin[0-9]+/g, '.skin' + skinId);
                $(elem).val(currentVal);
                // Remove any previous cpToolkit handler
                $(elem).off('.cpToolkitWidgetSkinHelper');
                // Attach a namespaced change handler
                $(elem).on('change.cpToolkitWidgetSkinHelper', function () {
                  var originalText = $(this).text();
                  var text = $(this).val() || '';
                  text = text.replace(/\.skin[0-9]+/g, '.skin' + skinId);
                  if (text !== originalText) {
                    $(this).val(text);
                    if (typeof existingChangeFn === 'function') {
                      try {
                        existingChangeFn.call(this);
                      } catch (e) {
                        console.warn('[WidgetSkinHelper] existing change handler threw', e);
                      }
                    }
                  }
                  checkValidBracket(text);
                });
              });
            } else {
              // New skin: alert if user uses a skin number
              var areas = $('.cpPopOver [id*="MiscellaneousStyles"]');
              areas.each(function () {
                $(this).off('.cpToolkitWidgetSkinHelper');
                $(this).on('change.cpToolkitWidgetSkinHelper', function () {
                  var text = $(this).val() || '';
                  if (/\.skin[0-9]+/g.test(text)) {
                    alert('You used a skin number. Save the skin first to get a number.');
                  }
                  checkValidBracket(text);
                });
              });
            }
          }
        };
      } catch (err) {
        console.warn('[WidgetSkinHelper] init error', err);
      }
    }
  };
})();
