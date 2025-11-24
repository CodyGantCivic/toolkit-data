// ==UserScript==
// @name         CivicPlus - Download XML/CSS
// @namespace    http://civicplus.com/
// @version      1.0.0
// @description  Adds download buttons for XML and CSS files on Layout pages
// @author       CivicPlus
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    const TOOLKIT_NAME = '[CP Toolkit - Download XML/CSS]';
    
    // Check if we're on the correct page
    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }
    
    // Only run on Layouts page
    if (!pageMatches(['/admin/designcenter/layouts'])) {
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
            // Use shared FontAwesome loader if available, otherwise use local fallback
            if (typeof window.CPToolkit !== 'undefined' && typeof window.CPToolkit.ensureFontAwesome === 'function') {
                await window.CPToolkit.ensureFontAwesome();
            } else {
                // Fallback: Load FontAwesome directly
                console.log(TOOLKIT_NAME + ' Loading FontAwesome (fallback mode)');
                
                await new Promise((resolve) => {
                    // Check if FontAwesome is already loaded
                    if ($('.fa, .fas, .far, .fal, .fab').length > 0 || $('#cp-toolkit-fontawesome').length > 0) {
                        resolve();
                        return;
                    }
                    
                    // Load FontAwesome from CDN
                    const link = document.createElement('link');
                    link.id = 'cp-toolkit-fontawesome';
                    link.rel = 'stylesheet';
                    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
                    link.onload = () => {
                        console.log(TOOLKIT_NAME + ' FontAwesome loaded');
                        resolve();
                    };
                    link.onerror = () => {
                        console.warn(TOOLKIT_NAME + ' FontAwesome failed to load');
                        resolve();
                    };
                    document.head.appendChild(link);
                });
            }
            
            GM_addStyle(`
                .downloadXML, .downloadCSS {
                    line-height: 33px;
                    font-size: .75rem;
                    font-weight: 400 !important;
                    position: absolute;
                    top: 4px;
                }
                .downloadXML { right: 221px; }
                .downloadCSS { right: 120px; }
                .downloadXML .fa, .downloadCSS .fa { color: #4f8ec0; }
                .listing .item { padding-right: 330px; }
                .listing .item>.status { right: 330px; }
                .listing .item h3 { width: calc(100% - 54px); }
            `);
            
            const layouts = $(".item");
            const currentSite = document.location.host;
            
            function downloadItem(title, url) {
                const link = document.createElement("a");
                link.download = title;
                link.href = url;
                link.click();
            }
            
            layouts.each(function() {
                const $this = $(this);
                const thisLayout = $this.find("h3 a").text();
                
                const downloadXML = $("<a href='#' class='button downloadXML'><i class='fa fa-download'></i> XML</a>");
                downloadXML.click(function(e) {
                    e.preventDefault();
                    const downloadUrl = "/App_Themes/" + thisLayout + "/" + thisLayout + ".xml";
                    downloadItem(currentSite + "-" + thisLayout + ".xml", downloadUrl);
                });
                
                const thisLayoutPage = $this.find("a:contains('Layout Page')").attr("href");
                
                const downloadCSS = $("<a href='#' class='button downloadCSS'><i class='fa fa-download'></i> CSS</a>");
                downloadCSS.click(function(e) {
                    e.preventDefault();
                    const xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function() {
                        if (xhr.status === 200 && xhr.readyState === 4) {
                            const redirectedURL = xhr.responseURL;
                            $.get(redirectedURL + "?bundle=off", function(data) {
                                const cssMatch = data.match(/\/App_Themes\/[^"]*Layout[^"]*/);
                                if (cssMatch) {
                                    downloadItem(currentSite + "-" + thisLayout + ".css", cssMatch[0]);
                                }
                            }, "text");
                        }
                    };
                    xhr.open("GET", thisLayoutPage, true);
                    xhr.send();
                });
                
                $this.append(downloadXML, downloadCSS);
            });
            
            const downloadAll = $("<li><a class='button bigButton nextAction' href='#'><span>Download All CSS and XML</span></a></li>");
            downloadAll.click(function(e) {
                e.preventDefault();
                $(".downloadXML, .downloadCSS").each(function() { $(this).click(); });
            });
            
            $(".contentContainer .sidebar .buttons").append(downloadAll);
            
            console.log(TOOLKIT_NAME + ' Successfully loaded');
        } catch (err) {
            console.warn(TOOLKIT_NAME + ' Error:', err);
        }
    }
    
    init();
})();


