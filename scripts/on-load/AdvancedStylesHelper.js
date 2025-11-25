// ==UserScript==
// @name         CivicPlus - Enforce Advanced Styles Text Limits (Remote)
// @namespace    http://civicplus.com/
// @version      1.0.0
// @description  Adds character limits to advanced style textareas to prevent save errors
// @author       CivicPlus
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function(exports) {
    'use strict';

    const TOOLKIT_NAME = '[CP Toolkit - Text Limits]';

    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }

    // Core function: idempotent and safe to call multiple times
    async function enforceAdvancedStyles(options = {}) {
        options = Object.assign({
            themeMax: 1000,
            widgetMax: 255,
            themePathPattern: '/designcenter/themes/',
            widgetPathPattern: '/designcenter/widgets/'
        }, options);

        const isThemeManager = pageMatches([options.themePathPattern]);
        const isWidgetManager = pageMatches([options.widgetPathPattern]);

        if (!isThemeManager && !isWidgetManager) {
            console.log(TOOLKIT_NAME + ' Not on Theme or Widget manager page — nothing to do.');
            return;
        }

        // Helper to inject small script into page context (so we can override page functions defined in page JS)
        function runInPageContext(fn) {
            try {
                const script = document.createElement('script');
                script.type = 'text/javascript';
                script.textContent = '(' + fn.toString() + ')();';
                (document.head || document.documentElement).appendChild(script);
                script.remove();
            } catch (err) {
                console.warn(TOOLKIT_NAME + ' failed to run in page context:', err);
            }
        }

        try {
            if (isThemeManager) {
                // Replace/augment initializePopovers so that popovers get maxlength added
                runInPageContext(function() {
                    try {
                        if (typeof window.initializePopovers === 'undefined') {
                            // If initializePopovers not present yet, wrap a DOMContentLoaded fallback
                            document.addEventListener('DOMContentLoaded', function() {
                                var ta = document.querySelectorAll('.cpPopOver textarea');
                                ta.forEach(function(t) { t.setAttribute('maxlength', 1000); });
                            }, { once: true });
                            return;
                        }

                        var originalInitializePopovers = window.initializePopovers;
                        window.initializePopovers = function() {
                            try {
                                originalInitializePopovers();
                            } catch (e) {
                                console.warn('[CP Toolkit] error calling original initializePopovers', e);
                            }
                            try {
                                var textAreas = document.querySelectorAll('.cpPopOver textarea');
                                textAreas.forEach(function(el) { el.setAttribute('maxlength', 1000); });
                            } catch (e2) {
                                console.warn('[CP Toolkit] error applying maxlength to popover textareas', e2);
                            }
                        };

                        // Also proactively set maxlength for any existing popover textareas already present
                        var existing = document.querySelectorAll('.cpPopOver textarea');
                        existing.forEach(function(el) { el.setAttribute('maxlength', 1000); });

                        console.log('[CP Toolkit] Advanced styles text limit enforced (Theme Manager: 1000 chars)');
                    } catch (err) {
                        console.warn('[CP Toolkit] Theme manager enforcement failed', err);
                    }
                });
            } else if (isWidgetManager) {
                // Replace/augment InitializeWidgetOptionsModal so it sets maxlength on #MiscAdvStyles
                runInPageContext(function() {
                    try {
                        if (typeof window.InitializeWidgetOptionsModal === 'undefined') {
                            // fallback: observe DOM for the element
                            var observer = new MutationObserver(function(mutations, obs) {
                                var el = document.querySelector('#MiscAdvStyles');
                                if (el) {
                                    el.setAttribute('maxlength', 255);
                                    obs.disconnect();
                                }
                            });
                            observer.observe(document.documentElement, { childList: true, subtree: true });
                            return;
                        }

                        var oldInitOptionsModal = window.InitializeWidgetOptionsModal;
                        window.InitializeWidgetOptionsModal = function() {
                            try {
                                oldInitOptionsModal();
                            } catch (e) {
                                console.warn('[CP Toolkit] error calling original InitializeWidgetOptionsModal', e);
                            }
                            try {
                                var el = document.querySelector('#MiscAdvStyles');
                                if (el) el.setAttribute('maxlength', 255);
                            } catch (e2) {
                                console.warn('[CP Toolkit] error applying maxlength to #MiscAdvStyles', e2);
                            }
                        };

                        // If the element is already present, set maxlength now
                        var existing = document.querySelector('#MiscAdvStyles');
                        if (existing) existing.setAttribute('maxlength', 255);

                        console.log('[CP Toolkit] Advanced styles text limit enforced (Widget Manager: 255 chars)');
                    } catch (err) {
                        console.warn('[CP Toolkit] Widget manager enforcement failed', err);
                    }
                });
            }
        } catch (err) {
            console.warn(TOOLKIT_NAME + ' Error in enforceAdvancedStyles():', err);
        }
    }

    // Expose publicly
    exports = exports || window;
    exports.enforceAdvancedStyles = enforceAdvancedStyles;

    // Auto-run if this is already the correct page and within a CivicPlus site (note: the loader also calls the function)
    // We only auto-run the local check (page path) here; CivicPlus detection is performed by the loader.
    if (pageMatches(['/DesignCenter/Themes/Index', '/designcenter/themes/'])) {
        // small timeout to let page scripts initialize
        setTimeout(function() {
            try {
                enforceAdvancedStyles();
                console.log(TOOLKIT_NAME + ' Auto-run executed.');
            } catch (e) {
                console.warn(TOOLKIT_NAME + ' Auto-run failed:', e);
            }
        }, 600);
    }

})(window);
