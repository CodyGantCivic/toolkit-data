// ==UserScript==
// @name         CivicPlus - Allow Open In New Tab
// @namespace    http://civicplus.com/
// @version      1.0.0
// @description  Allows admin module items to be opened in new tabs via right-click
// @author       CivicPlus
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    const TOOLKIT_NAME = '[CP Toolkit - Open In New Tab]';
    
    // Check if we're on the correct page
    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }
    
    // Only run on admin pages
    if (!pageMatches(['/admin/'])) {
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
            const moduleReferrer = window.location.pathname.toLowerCase().replace("/admin/", "");
            
            $(document).ready(function() {
                // Replace divs with onclicks with links
                $(".classicItems div[onclick]").each(function() {
                    this.outerHTML = this.outerHTML.replace("<div ", "<a href ").replace("</div>", "</a>");
                });
                
                // Find links with onclicks and convert them to hrefs
                $("a[onclick]").each(function() {
                    const $this = $(this);
                    const onclick = $this.attr("onclick");
                    const onclickFunction = onclick.split("(")[0];
                    const href = $this.attr("href");
                    
                    switch (onclickFunction) {
                        // Outermost, Category View
                        case "categoryDetails": // Quick Links
                        case "displayItemList":
                        case "CallAlertCategoryDetail": // News Flash
                        case "ModifyArchiveMaster": // Archives
                        case "BidCategoryModifyDelete": // Bids
                        case "CategoryModifyDelete": // Forms
                        case "ModifyBlogCategory": // Blog
                        case "FAQTopicModifyDelete": // FAQ's
                        case "NotifyMeListAction": // Notify Me
                        case "PollCategoryModifyDelete": // Opinion Polls
                        case "editPhoto": // Photo Gallery
                        case "goToSellerProperties": // Real Estate Locator
                        case "CRMCategoryModifyDelete": // Request Tracker
                        case "dirDetail": // Resource Directory
                            if (href === "" || href === "#") {
                                const newHref = "/Admin/Classic.aspx?fromURL=" + moduleReferrer + 
                                              "&toolkitRunfn=" + encodeURIComponent(onclick);
                                $this.attr("href", newHref);
                            } else {
                                console.log(TOOLKIT_NAME + " Link already has href (" + href + "), skipped.");
                            }
                            break;
                        
                        // Link view from category view
                        case "linkDetails":
                            if (href === "") {
                                // Inject script to get function and form
                                const extractScript = document.createElement('script');
                                extractScript.textContent = `
                                    $('<input id="toolkit-aoint-fn" type="hidden"></input>').appendTo("body");
                                    $("#toolkit-aoint-fn").val(linkDetails.toString());
                                `;
                                document.body.appendChild(extractScript);
                                
                                // Get the function
                                const supportFn = $("#toolkit-aoint-fn").val();
                                
                                // Extract form element name
                                const formElement = supportFn.split("theForm = document.")[1].split(";")[0];
                                
                                // Create simplified function
                                const simplifiedFn = `function linkDetails(id,el){theForm=document.` + 
                                    formElement + 
                                    `;theForm.strAction.value='qlLinkModify';theForm.ysnSave.value=0;theForm.ysnCopy.value=0;theForm.intQLLinkID.value=id;theForm.submit();}`;
                                
                                // Get form HTML
                                const getFormScript = document.createElement('script');
                                getFormScript.textContent = `
                                    $("#toolkit-aoint-fn").val($("form[name=` + formElement + `]")[0].outerHTML);
                                `;
                                document.body.appendChild(getFormScript);
                                
                                const formHtml = $("#toolkit-aoint-fn").val();
                                const appendFormFunction = '$("body").append(`' + formHtml + "`);";
                                
                                // Clean up
                                const cleanupScript = document.createElement('script');
                                cleanupScript.textContent = '$("#toolkit-aoint-fn").remove();';
                                document.body.appendChild(cleanupScript);
                                
                                const newHref = "/Admin/Classic.aspx?fromURL=" + moduleReferrer + 
                                              "&toolkitRunfn=" + 
                                              encodeURIComponent(simplifiedFn) + 
                                              encodeURIComponent(appendFormFunction) + 
                                              encodeURIComponent(onclick);
                                
                                $this.attr("href", newHref);
                                
                                // Make graphic buttons behave as expected
                                $this.parent("td")
                                    .find("a.fancyButton")
                                    .attr("href", newHref)
                                    .attr("onclick", onclick);
                            } else {
                                console.log(TOOLKIT_NAME + " Link already has href (" + href + "), skipped.");
                            }
                            break;
                        
                        // Alert view from category view (not yet implemented)
                        case "CallAlertDetail": // News Flash
                        case "ModifyArchiveItem": // Archives
                        case "ModifyBidItem": // Bids
                        case "ModifyBlogItem": // Blog
                        case "editEvent": // Calendar
                        case "FAQQuestionModifyDelete": // FAQ's
                        case "FormModifyDelete": // Forms
                        case "CallPollDetail": // Polls
                            if (href === "") {
                                console.log(TOOLKIT_NAME + ' Handler "' + onclickFunction + '" is not yet implemented.');
                            } else {
                                console.log(TOOLKIT_NAME + " Link already has href (" + href + "), skipped.");
                            }
                            break;
                        
                        default:
                            console.log(TOOLKIT_NAME + ' "' + onclickFunction + '" is not a recognized onclick function.');
                            break;
                    }
                });
            });
            
            // Handle pages opened in new tab - restore state
            if (document.referrer.indexOf("toolkitRunfn") !== -1) {
                $(document).ready(function() {
                    const encodedFn = qsReferrer("toolkitRunfn");
                    const fnToRun = decodeURIComponent(encodedFn).replace("return false;", "");
                    
                    console.log(TOOLKIT_NAME + " Detected page opened in new tab. Running function to restore state:");
                    console.log(fnToRun);
                    
                    const restoreScript = document.createElement('script');
                    restoreScript.textContent = 
                        "ajaxPostBackStart('[CP Toolkit] Detected a page opened in a new tab. Redirecting to correct page...');" + 
                        fnToRun;
                    document.body.appendChild(restoreScript);
                });
            }
            
            // Query string parser for referrer
            function qsReferrer(key) {
                key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&");
                const match = document.referrer.match(new RegExp("[?&]" + key + "=([^&]+)(&|$)"));
                return match && decodeURIComponent(match[1].replace(/\+/g, " "));
            }
            
            console.log(TOOLKIT_NAME + ' Successfully loaded');
            
        } catch (err) {
            console.warn(TOOLKIT_NAME + ' Error:', err);
        }
    }
    
    init();
})();
