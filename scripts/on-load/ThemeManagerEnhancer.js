(function () {
    'use strict';

    const TOOLKIT_NAME = '[CP Toolkit - Theme Manager Enhancer]';

    // Prevent double execution
    if (window.ThemeManagerEnhancer && window.ThemeManagerEnhancer.__loaded) {
        console.log(TOOLKIT_NAME, 'Already loaded, skipping.');
        return;
    }

    window.ThemeManagerEnhancer = {
        __loaded: false,

        init: async function () {
            if (window.ThemeManagerEnhancer.__loaded) return;
            window.ThemeManagerEnhancer.__loaded = true;

            const path = window.location.pathname.toLowerCase();
            const isThemeManager = path.includes('/designcenter/themes');
            const isWidgetManager = path.includes('/designcenter/widgets');
            const isAnimationManager = path.includes('/designcenter/animations');
            const isDesignCenter = isThemeManager || isWidgetManager || isAnimationManager;

            if (!isDesignCenter) {
                console.log(TOOLKIT_NAME, 'Not a supported Design Center page, exiting.');
                return;
            }

            // Validate CivicPlus site (if loader exposed validator)
            if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
                const isCP = await window.CPToolkit.isCivicPlusSite();
                if (!isCP) {
                    console.log(TOOLKIT_NAME, 'Not a CivicPlus site, exiting.');
                    return;
                }
            }

            console.log(TOOLKIT_NAME, 'Initializing…');

            // Style Injection (replaces GM_addStyle)
            function injectCSS(css) {
                const style = document.createElement('style');
                style.setAttribute('data-cp-tool', 'ThemeManagerEnhancer');
                style.textContent = css;
                document.head.appendChild(style);
            }

            try {
                // Apply CSS fixes ONLY on Theme Manager
                if (isThemeManager) {
                    injectCSS(`
                        .exploded [data-cprole$="Container"].focused {
                            outline-style: dashed !important;
                        }
                        .exploded .stickySticky {
                            position: relative;
                            top: auto !important;
                        }
                        .exploded #bodyWrapper {
                            padding-top: 47px !important;
                        }
                        .stickyStructuralContainer.stickySticky:hover,
                        .stickyStructuralContainer.stickyCollapsed:hover {
                            z-index: 100;
                        }
                        .modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li .status {
                            position: static;
                        }
                        .modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li .status:before {
                            content: "The skin above is ";
                        }
                        .modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li input[type=text] {
                            padding-right: .5rem !important;
                        }
                        .currentWidgetSkins li.rename[data-active="False"] input {
                            background: #DDD;
                        }
                        .exploded #bodyWrapper > .structuralContainer:before {
                            left: 0 !important;
                            right: 0 !important;
                        }
                        body:not(.exploded) .cpComponent:before {
                            left: 0 !important;
                            right: 0 !important;
                        }
                    `);

                    console.log(TOOLKIT_NAME, 'Theme Manager CSS fixes applied.');
                }

                // Enhance dropdown on all Design Center pages
                await waitFor(() => window.jQuery, 5000);

                jQuery(document).ready(function ($) {
                    const currentViewSelect = $(".cpToolbar select#currentView");

                    if (currentViewSelect.length) {
                        console.log(TOOLKIT_NAME, 'Adding Layout Manager to dropdown.');

                        const option = $('<option value="Layouts">Layout Manager</option>');
                        currentViewSelect.append(option);

                        currentViewSelect.change(function () {
                            if ($(this).val() === "Layouts") {
                                window.location.href = "/Admin/DesignCenter/Layouts";
                            }
                        });
                    }
                });

                console.log(TOOLKIT_NAME, 'Successfully loaded.');
            } catch (err) {
                console.warn(TOOLKIT_NAME, 'Error:', err);
            }
        }
    };

    // Auto-run after export
    window.ThemeManagerEnhancer.init();

    // Helper: wait for a condition
    function waitFor(testFn, timeout = 5000, interval = 100) {
        const start = Date.now();
        return new Promise(resolve => {
            const check = () => {
                if (testFn()) return resolve(true);
                if (Date.now() - start >= timeout) return resolve(false);
                setTimeout(check, interval);
            };
            check();
        });
    }

})();
