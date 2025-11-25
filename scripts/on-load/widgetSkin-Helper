// ==UserScript==
// @name         CivicPlus - Widget Skin Helper
// @namespace    http://civicplus.com/
// @version      1.0.3
// @description  Advanced style helper for Widget Skins in Theme Manager — exported for remote loader.
// @author       CivicPlus
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const TOOLKIT_NAME = '[CP Toolkit - Widget Skin Helper]';

    // Core helper implementation (returned as a function to export)
    function createWidgetSkinHelper() {
        // If already initialized, return the same function (idempotent)
        if (window.__cpToolkitWidgetSkinHelperInitialized) {
            console.debug(TOOLKIT_NAME + ' already initialized');
            return window.widgetSkinHelper;
        }

        function checkValidBracket_ts(text) {
            if (text.indexOf("}") > text.indexOf("{") || ((text.indexOf("}") === -1) && (text.indexOf("{") !== -1))) {
                alert("Invalid CSS detected. You appear to be using a { before using a }.");
            }
            var numLeftBracket = 0;
            var numRightBracket = 0;
            for (var i = 0; i < text.length; i++) {
                if (text[i] === "}") numRightBracket++;
                else if (text[i] === "{") numLeftBracket++;
            }
            var difference = Math.abs(numLeftBracket - numRightBracket);
            if (numLeftBracket > numRightBracket) {
                alert("Invalid CSS. You have " + difference + " extra {.");
            } else if (numLeftBracket < numRightBracket) {
                alert("Invalid CSS. You have " + difference + " extra }.");
            }
        }

        function hookInitializePopovers() {
            if (typeof window.$ === 'undefined' || typeof window.$.fn === 'undefined') {
                console.log(TOOLKIT_NAME + ' Waiting for jQuery...');
                setTimeout(hookInitializePopovers, 100);
                return;
            }

            if (typeof window.initializePopovers === 'undefined') {
                console.log(TOOLKIT_NAME + ' Waiting for initializePopovers...');
                setTimeout(hookInitializePopovers, 100);
                return;
            }

            console.log(TOOLKIT_NAME + ' jQuery and initializePopovers found, hooking...');

            // Avoid double-hooking: store original on first hook
            if (!window.__cpToolkit_original_initializePopovers) {
                window.__cpToolkit_original_initializePopovers = window.initializePopovers;
            }

            // Replace initializePopovers with wrapped version
            window.initializePopovers = function() {
                console.log(TOOLKIT_NAME + ' initializePopovers called');
                try {
                    // call original implementation
                    if (typeof window.__cpToolkit_original_initializePopovers === 'function') {
                        window.__cpToolkit_original_initializePopovers();
                    }
                } catch (err) {
                    console.warn(TOOLKIT_NAME + ' error calling original initializePopovers', err);
                }

                // When widget skin popover is present, apply helpers
                if (window.$(".cpPopOver #widgetSkinName").length) {
                    var skinId = window.$(".cpPopOver input#hdnSkinID").val();
                    if (typeof skinId === 'undefined') skinId = "-1";

                    if (skinId !== "-1") {
                        console.log(TOOLKIT_NAME + " Editing skin " + skinId);

                        // Remove stray focused classes from other skin entries after a moment
                        setTimeout(function() {
                            var shouldBeFocused = window.$(".skin" + skinId + " .focused");
                            window.$(".focused").not(shouldBeFocused).removeClass("focused");
                        }, 500);

                        var textAreas = window.$(".cpPopOver [id*='MiscellaneousStyles']");
                        textAreas.each(function() {
                            var elem = this;
                            // capture any existing change handler so we can call it after our modification
                            var existingEvents = window.$._data(elem, 'events');
                            var existingChangeFn = existingEvents && existingEvents.change && existingEvents.change[0] ? existingEvents.change[0].handler : null;

                            var text = window.$(elem).val() || '';
                            text = text.replace(/\.skin[0-9]+/g, ".skin" + skinId);
                            window.$(elem).val(text);

                            // Unbind previous wrapper if we already attached one (to avoid duplicates)
                            window.$(elem).off('.cpToolkitWidgetSkinHelper');

                            // Attach change handler namespaced so it is removable/identifiable
                            window.$(elem).on('change.cpToolkitWidgetSkinHelper', function() {
                                var originalText = window.$(this).text();
                                var text = window.$(this).val() || '';
                                text = text.replace(/\.skin[0-9]+/g, ".skin" + skinId);
                                if (text !== originalText) {
                                    window.$(this).val(text);
                                    if (typeof existingChangeFn === 'function') {
                                        try { existingChangeFn.call(this); } catch (e) { console.warn(TOOLKIT_NAME + ' existing change handler threw', e); }
                                    }
                                }
                                checkValidBracket_ts(text);
                            });
                        });

                    } else {
                        console.log(TOOLKIT_NAME + " Editing new skin.");
                        var textAreas = window.$(".cpPopOver [id*='MiscellaneousStyles']");
                        textAreas.each(function() {
                            // Unbind previous wrapper if we already attached one
                            window.$(this).off('.cpToolkitWidgetSkinHelper');
                            window.$(this).on('change.cpToolkitWidgetSkinHelper', function() {
                                var text = window.$(this).val() || '';
                                if (/\.skin[0-9]+/g.test(text)) {
                                    alert("You used a skin number. Save the skin first to get a number.");
                                }
                                checkValidBracket_ts(text);
                            });
                        });
                    }
                }
            };

            console.log(TOOLKIT_NAME + ' Successfully hooked initializePopovers');
        }

        // The exported callable function that sets things up (safe to call multiple times)
        function widgetSkinHelper() {
            try {
                // Only run on designcenter/themes pages
                var pathname = window.location.pathname.toLowerCase();
                if (!pathname.includes('/designcenter/themes/') && !pathname.includes('/designcenter/themes')) {
                    console.log(TOOLKIT_NAME + ' Not on Themes pages — aborting widgetSkinHelper.');
                    return;
                }

                hookInitializePopovers();
            } catch (err) {
                console.warn(TOOLKIT_NAME + ' widgetSkinHelper error', err);
            }
        }

        // mark initialized and expose on window
        window.__cpToolkitWidgetSkinHelperInitialized = true;
        window.widgetSkinHelper = widgetSkinHelper;
        window.initWidgetSkinHelper = widgetSkinHelper; // alternate name for loader compatibility

        return widgetSkinHelper;
    }

    // Export and auto-run when appropriate
    try {
        const exportedFn = createWidgetSkinHelper();
        // Auto-run immediately if page matches (preserves previous behavior)
        const path = window.location.pathname.toLowerCase();
        if (path.includes('/designcenter/themes/') || path.includes('/designcenter/themes')) {
            try {
                // Delay slightly to let page JS initialize in many cases
                setTimeout(function() {
                    try {
                        if (typeof window.widgetSkinHelper === 'function') {
                            window.widgetSkinHelper();
                            console.log(TOOLKIT_NAME + ' Auto-run executed.');
                        }
                    } catch (err) {
                        console.warn(TOOLKIT_NAME + ' auto-run failed', err);
                    }
                }, 250);
            } catch (e) {
                console.warn(TOOLKIT_NAME + ' scheduling auto-run failed', e);
            }
        } else {
            console.log(TOOLKIT_NAME + ' loaded but not a Themes page; exported function available for loader.');
        }
    } catch (ex) {
        console.warn(TOOLKIT_NAME + ' failed to initialize', ex);
    }

})();

