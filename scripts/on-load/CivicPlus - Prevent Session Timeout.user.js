// ==UserScript==
// @name         CivicPlus - Prevent Session Timeout
// @namespace    http://civicplus.com/
// @version      1.0.0
// @description  Automatically prevents session timeout by clicking "Stay signed in" button
// @author       CivicPlus
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    const TOOLKIT_NAME = '[CP Toolkit - Prevent Timeout]';
    
    // Check if we're on a CP admin page
    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }
    
    // Only run on admin pages where timeout is relevant
    if (!pageMatches(['/admin/', '/designcenter/'])) {
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
            function checkForTimeoutAndPrevent() {
                // Check if timeout warning is visible
                const timeoutMessage = $(".cp-UIMessage-text");
                
                if (timeoutMessage.length && timeoutMessage.text().startsWith("You will be signed out in")) {
                    // Click the "Stay signed in" button
                    const staySignedInButton = timeoutMessage.find(".cp-Btn");
                    
                    if (staySignedInButton.length) {
                        staySignedInButton.click();
                        console.log(TOOLKIT_NAME + ' Login timeout prevented! Clicked "Stay signed in" button.');
                    } else {
                        console.warn(TOOLKIT_NAME + ' Timeout message found but button not found');
                    }
                }
            }
            
            // Check every 2 minutes (120,000 milliseconds)
            setInterval(checkForTimeoutAndPrevent, 2 * 60 * 1000);
            
            console.log(TOOLKIT_NAME + ' Successfully loaded - checking for timeout every 2 minutes');
            
        } catch (err) {
            console.warn(TOOLKIT_NAME + ' Error:', err);
        }
    }
    
    init();
})();
