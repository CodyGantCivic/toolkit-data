// ==UserScript==
// @name         CivicPlus - Theme Manager Enhancer
// @namespace    http://civicplus.com/
// @version      1.0.0
// @description  UI fixes and enhancements for Theme Manager, Widget Manager, and Animation Manager
// @author       CivicPlus
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    const TOOLKIT_NAME = '[CP Toolkit - Theme Manager Enhancer]';
    
    // Check if we're on the correct page
    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }
    
    const isThemeManager = pageMatches(['/designcenter/themes/']);
    const isWidgetManager = pageMatches(['/designcenter/widgets/']);
    const isAnimationManager = pageMatches(['/designcenter/animations/']);
    const isDesignCenter = isThemeManager || isWidgetManager || isAnimationManager;
    
    // Only run on Design Center pages
    if (!isDesignCenter) {
        return;
    }
    
    // Wait for CP site detection
    async function init() {
        if (typeof window.CPToolkit !== 'undefined' && typeof window.CPToolkit.isCivicPlusSite === 'function') {
            const isCPSite = await window.CPToolkit.isCivicPlusSite();
            if (!isCPSite) {
                console.log(TOOLKIT_NAME + ' Not a CivicPlus site, exiting');
                return;
            }
        }
        
        console.log(TOOLKIT_NAME + ' Initializing...');
        
        try {
            // Add CSS fixes for Theme Manager
            if (isThemeManager) {
                GM_addStyle(`
                    /* Change outline when focused in exploded view */
                    .exploded [data-cprole$="Container"].focused {
                        outline-style: dashed !important;
                    }
                    /* Unfix stickyStructural on exploded view */
                    .exploded .stickySticky {
                        position: relative;
                        top: auto !important;
                    }
                    /* Fix padding when unfixed stickySticky on exploded view */
                    .exploded #bodyWrapper {
                        padding-top: 47px !important;
                    }
                    /* Fix z-index issue with stickyStructural hover */
                    .stickyStructuralContainer.stickySticky:hover, 
                    .stickyStructuralContainer.stickyCollapsed:hover {
                        z-index: 100;
                    }
                    /* Fix Widget Skin cut-off */
                    .modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li .status {
                        position: static;
                    }
                    .modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li .status:before {
                        content: "The skin above is "
                    }
                    .modalContainer.modalContainerCP.manageWidgetSkins .cpForm>li input[type=text] {
                        padding-right: .5rem !important;
                    }
                    .currentWidgetSkins li.rename[data-active="False"] input {
                        background: #DDD;
                    }
                    /* Fix horizontal scroll bar */
                    .exploded #bodyWrapper > .structuralContainer:before {
                        left: 0 !important;
                        right: 0 !important;
                    }
                    body:not(.exploded) .cpComponent:before {
                        left: 0 !important;
                        right: 0 !important;
                    }
                `);
                
                console.log(TOOLKIT_NAME + ' Theme Manager CSS fixes applied');
            }
            
            // Add Layout Manager to dropdown (for all Design Center pages)
            $(document).ready(function() {
                const currentViewSelect = $(".cpToolbar select#currentView");
                
                if (currentViewSelect.length) {
                    console.log(TOOLKIT_NAME + ' Adding Layout Manager to dropdown');
                    
                    const layoutManagerOption = $('<option value="Layouts">Layout Manager</option>');
                    currentViewSelect.append(layoutManagerOption);
                    
                    currentViewSelect.change(function() {
                        if ($(this).val() === "Layouts") {
                            window.location.href = "/Admin/DesignCenter/Layouts";
                        }
                    });
                }
            });
            
            console.log(TOOLKIT_NAME + ' Successfully loaded');
            
        } catch (err) {
            console.warn(TOOLKIT_NAME + ' Error:', err);
        }
    }
    
    init();
})();
