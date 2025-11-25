// ==UserScript==
// @name         CivicPlus - Graphic Link Helper
// @namespace    http://civicplus.com/
// @version      1.0.0
// @description  Advanced style helper for Graphic Links (Fancy Buttons)
// @author       CivicPlus
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    const TOOLKIT_NAME = '[CP Toolkit - Graphic Link Helper]';
    
    // Check if we're on the correct page
    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }
    
    // Only run on Graphic Links admin page
    if (!pageMatches(['/admin/graphiclinks.aspx'])) {
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
            $(document).ready(function() {
                if (!$(".actions").length) return;
                
                const modifyBtn = $(".modify")[0];
                if (!modifyBtn) return;
                
                const events = $._data(modifyBtn, "events");
                if (!events || !events.click || !events.click[0]) return;
                
                const oldModifyButtonFunction = events.click[0].handler;
                
                function newModifyButtonFunction() {
                    console.log(TOOLKIT_NAME + ' Bound to modify function.');
                    
                    oldModifyButtonFunction();
                    
                    $("link[href='/Areas/GraphicLinks/Assets/Styles/FancyButtonEditor.css']").remove();
                    
                    let currentButtonStyleSelector = "fancyButton1";
                    if ($(".fancyButtonContainer a.fancyButton").length) {
                        const classes = $(".fancyButtonContainer a.fancyButton").attr("class");
                        if (classes) {
                            const classList = classes.split(" ");
                            if (classList.length > 1) {
                                currentButtonStyleSelector = classList[1];
                            }
                        }
                    }
                    
                    console.log(TOOLKIT_NAME + ' This button is ' + currentButtonStyleSelector);
                    
                    $("textarea.autoUpdate").each(function() {
                        if (currentButtonStyleSelector === "fancyButton1") {
                            $(this).parent().prepend("<p style='color: red;'><i>Button not saved yet. Edit again after saving.</i></p>");
                        }
                        $(this).parent().prepend("<p>[CP Toolkit] <i>Use .fancyButton1 as selector.</i></p>");
                        let text = $(this).val();
                        text = text.replace(/fancyButton[0-9]+/g, "fancyButton1");
                        $(this).val(text);
                        $(this).change();
                    });
                    
                    const insertBtn = $(".insertFancy")[0];
                    if (!insertBtn) return;
                    
                    const insertEvents = $._data(insertBtn, "events");
                    if (!insertEvents || !insertEvents.click || !insertEvents.click[0]) return;
                    
                    const oldInsertFancyButtonFunction = insertEvents.click[0].handler;
                    
                    function newInsertFancyButton(e) {
                        $("textarea.autoUpdate").each(function() {
                            let text = $(this).val();
                            text = text.replace(/fancyButton[0-9]+/g, currentButtonStyleSelector);
                            $(this).val(text);
                            $(this).change();
                        });
                        
                        oldInsertFancyButtonFunction(e);
                        
                        const newClass = $(".fancyButtonContainer a.fancyButton")
                            .attr("class")
                            .replace(new RegExp("fancyButton1", "g"), currentButtonStyleSelector);
                        $(".fancyButtonContainer a.fancyButton").attr("class", newClass);
                    }
                    
                    $(".insertFancy").unbind("click").click(newInsertFancyButton);
                }
                
                $(".modify").unbind("click").click(newModifyButtonFunction);
                $(".fancyButtonContainer").unbind("click").click(newModifyButtonFunction);
                $("#insertFancyButton").unbind("click").click(newModifyButtonFunction);
                
                console.log(TOOLKIT_NAME + ' Successfully loaded');
            });
        } catch (err) {
            console.warn(TOOLKIT_NAME + ' Error:', err);
        }
    }
    
    init();
})();
