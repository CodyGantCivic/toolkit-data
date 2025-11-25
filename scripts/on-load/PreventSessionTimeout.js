(function () {
    'use strict';

    const TOOLKIT_NAME = '[CP Toolkit - Prevent Timeout]';

    // Idempotency guard
    if (window.PreventSessionTimeout && window.PreventSessionTimeout.__loaded) {
        return;
    }

    window.PreventSessionTimeout = {
        __loaded: false,

        // public init callable by loader
        init: async function () {
            if (window.PreventSessionTimeout.__loaded) return;
            window.PreventSessionTimeout.__loaded = true;

            // Only run on admin/designcenter pages
            const path = window.location.pathname.toLowerCase();
            const isAdmin = path.startsWith('/admin') || path.startsWith('/designcenter') ||
                            path.startsWith('/admin/') || path.startsWith('/designcenter/');

            if (!isAdmin) {
                return;
            }

            // If loader exposes CP check, prefer it
            if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
                try {
                    const isCP = await window.CPToolkit.isCivicPlusSite();
                    if (!isCP) return;
                } catch (e) {
                    // fallthrough — continue if CP check errors
                }
            }

            // Small helper to wait for a condition (jQuery)
            const waitFor = (testFn, timeout = 5000, interval = 100) => {
                const start = Date.now();
                return new Promise(resolve => {
                    const check = () => {
                        try {
                            if (testFn()) return resolve(true);
                        } catch (e) {
                            // ignore
                        }
                        if (Date.now() - start >= timeout) return resolve(false);
                        setTimeout(check, interval);
                    };
                    check();
                });
            };

            // Wait briefly for jQuery to exist
            const hasJQ = await waitFor(() => !!window.jQuery, 4000);
            if (!hasJQ) {
                // jQuery not present; can't reliably run DOM selectors — exit quietly
                return;
            }

            const $ = window.jQuery;

            try {
                function checkForTimeoutAndPrevent() {
                    // message node used by CP UI (existing script used ".cp-UIMessage-text")
                    const timeoutMessage = $(".cp-UIMessage-text");
                    if (timeoutMessage.length && timeoutMessage.text().trim().startsWith("You will be signed out in")) {
                        // find any stay signed in button inside that message
                        const staySignedInButton = timeoutMessage.find(".cp-Btn, button, a").first();
                        if (staySignedInButton && staySignedInButton.length) {
                            try {
                                staySignedInButton[0].click();
                                // only lightweight console log when activated
                                console.log(TOOLKIT_NAME, 'Activated: clicked "Stay signed in" button.');
                            } catch (err) {
                                console.warn(TOOLKIT_NAME, 'Click failed:', err);
                            }
                        } else {
                            // no button found — keep quiet unless debugging needed
                        }
                    }
                }

                // initial run
                checkForTimeoutAndPrevent();

                // interval: every 2 minutes (120k ms)
                // store handle so other scripts can clear if necessary
                window.PreventSessionTimeout._intervalHandle = setInterval(checkForTimeoutAndPrevent, 2 * 60 * 1000);

            } catch (err) {
                console.warn(TOOLKIT_NAME, 'Error:', err);
            }
        },

        // optional helper to stop the periodic checks
        stop: function () {
            if (window.PreventSessionTimeout._intervalHandle) {
                clearInterval(window.PreventSessionTimeout._intervalHandle);
                delete window.PreventSessionTimeout._intervalHandle;
            }
        }
    };

    // Auto-run
    window.PreventSessionTimeout.init();

})();
