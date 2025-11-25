// DownloadXMLCSS.js
// CivicPlus - Download XML/CSS (remote, injector-friendly)
// Exposes window.insertDownloadButtons() and window.downloadxmlcss()
// Auto-runs when on /admin/designcenter/layouts and on a CivicPlus site.

(function(global) {
    'use strict';

    const TOOLKIT_NAME = '[CP Toolkit - Download XML/CSS]';

    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }

    // Lightweight CivicPlus site detection (same logic as toolkit)
    async function isCivicPlusSite() {
        try {
            const resp = await fetch('/Assets/Mystique/Shared/Components/ModuleTiles/Templates/cp-Module-Tile.html', { method: 'HEAD' });
            return resp && resp.status === 200;
        } catch (e) {
            return false;
        }
    }

    // Ensure Font Awesome loaded (best-effort)
    function ensureFontAwesome() {
        return new Promise((resolve) => {
            try {
                if (document.querySelector('.fa, .fas, .far, .fal, .fab')) {
                    resolve();
                    return;
                }
                if (document.getElementById('cp-toolkit-fontawesome')) {
                    // small delay to allow load to complete if in progress
                    setTimeout(resolve, 200);
                    return;
                }
                const link = document.createElement('link');
                link.id = 'cp-toolkit-fontawesome';
                link.rel = 'stylesheet';
                link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
                link.onload = () => resolve();
                link.onerror = () => resolve();
                document.head.appendChild(link);
            } catch (e) { resolve(); }
        });
    }

    // Add CSS into page (safe for injection)
    function addStyles(cssText) {
        try {
            if (document.getElementById('cp-toolkit-downloadxmlcss-styles')) return;
            const s = document.createElement('style');
            s.id = 'cp-toolkit-downloadxmlcss-styles';
            s.textContent = cssText;
            (document.head || document.documentElement).appendChild(s);
        } catch (e) { /* ignore */ }
    }

    // main function, idempotent
    async function insertDownloadButtons(options) {
        // allow callers to pass options if needed later
        options = options || {};

        try {
            // if already initialized, do nothing
            if (window.__cp_downloadxmlcss_initialized) {
                console.info(TOOLKIT_NAME + ' already initialized');
                return;
            }

            // Only proceed when we have jQuery available; if not, wait a bit
            if (typeof window.jQuery === 'undefined') {
                // wait up to ~3 seconds for jQuery (site uses jQuery normally)
                await new Promise((resolve) => {
                    let waited = 0;
                    const t = setInterval(() => {
                        if (typeof window.jQuery !== 'undefined' || waited > 3000) {
                            clearInterval(t);
                            resolve();
                        }
                        waited += 200;
                    }, 200);
                });
            }
            if (typeof window.jQuery === 'undefined') {
                console.warn(TOOLKIT_NAME + ' jQuery not found; aborting button insertion.');
                return;
            }
            const $ = window.jQuery;

            // ensure Font Awesome
            await ensureFontAwesome();

            addStyles(`
                .downloadXML, .downloadCSS {
                    line-height: 33px;
                    font-size: .75rem;
                    font-weight: 400 !important;
                    position: absolute;
                    top: 4px;
                    z-index: 5;
                }
                .downloadXML { right: 221px; }
                .downloadCSS { right: 120px; }
                .downloadXML .fa, .downloadCSS .fa { color: #4f8ec0; margin-right:6px; }
                .listing .item { padding-right: 330px; }
                .listing .item>.status { right: 330px; }
                .listing .item h3 { width: calc(100% - 54px); }
                /* small responsive tweak if layout names are long */
                .downloadXML, .downloadCSS { white-space: nowrap; overflow: visible; }
            `);

            const layouts = $(".listing .items .item");
            if (!layouts || layouts.length === 0) {
                console.info(TOOLKIT_NAME + ' No layout items found on page right now.');
            }

            const currentSite = document.location.host.replace(/[:\/]+/g, '-');

            function downloadItem(title, url) {
                try {
                    // Build anchor and click to prompt download
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = title;
                    // If the URL is relative, make absolute
                    if (!/^(https?:)?\/\//i.test(url)) {
                        a.href = window.location.origin.replace(/\/$/,'') + (url.startsWith('/') ? '' : '/') + url;
                    }
                    // For same-origin blob or resource, click; otherwise open in new tab as fallback
                    try { a.click(); }
                    catch(e) { window.open(a.href, '_blank'); }
                } catch (e) {
                    console.warn(TOOLKIT_NAME + ' downloadItem failed:', e);
                }
            }

            layouts.each(function() {
                const $this = $(this);
                // don't add twice
                if ($this.data('cp-dl-added')) return;
                $this.data('cp-dl-added', true);

                const thisLayout = $this.find("h3 a").text().trim();
                if (!thisLayout) return;

                const downloadXML = $("<a href='#' class='button downloadXML'><i class='fa fa-download'></i><span>XML</span></a>");
                downloadXML.on('click', function(e) {
                    e.preventDefault();
                    const downloadUrl = "/App_Themes/" + encodeURIComponent(thisLayout) + "/" + encodeURIComponent(thisLayout) + ".xml";
                    downloadItem(currentSite + "-" + thisLayout + ".xml", downloadUrl);
                });

                // find layout page link (the "View Layout Page" anchor)
                const thisLayoutPage = $this.find("a:contains('Layout Page'), a:contains('View Layout Page')").attr("href") || $this.find("h3 a").attr("href");

                const downloadCSS = $("<a href='#' class='button downloadCSS'><i class='fa fa-download'></i><span>CSS</span></a>");
                downloadCSS.on('click', function(e) {
                    e.preventDefault();
                    if (!thisLayoutPage) {
                        console.warn(TOOLKIT_NAME + ' no layout page link found for layout', thisLayout);
                        return;
                    }
                    const xhr = new XMLHttpRequest();
                    xhr.onreadystatechange = function() {
                        if (xhr.readyState === 4) {
                            if (xhr.status === 200) {
                                const redirectedURL = xhr.responseURL;
                                // fetch layout page with bundle off to find actual theme CSS path
                                window.jQuery.get(redirectedURL + "?bundle=off", function(data) {
                                    const cssMatch = data.match(/\/App_Themes\/[^"]*Layout[^"]*/);
                                    if (cssMatch) {
                                        downloadItem(currentSite + "-" + thisLayout + ".css", cssMatch[0]);
                                    } else {
                                        console.warn(TOOLKIT_NAME + ' Could not locate Layout CSS URL in the layout page response.');
                                    }
                                }, "text").fail(function() {
                                    console.warn(TOOLKIT_NAME + ' $.get failed for layout page.');
                                });
                            } else {
                                console.warn(TOOLKIT_NAME + ' XHR to layout page returned status', xhr.status);
                            }
                        }
                    };
                    try {
                        xhr.open("GET", thisLayoutPage, true);
                        xhr.send();
                    } catch (err) {
                        console.warn(TOOLKIT_NAME + ' error fetching layout page', err);
                    }
                });

                $this.append(downloadXML, downloadCSS);
            });

            // Add a "Download All" button to the sidebar if not already present
            const $sidebarButtons = $(".contentContainer .sidebar .buttons");
            if ($sidebarButtons.length) {
                if ($sidebarButtons.find('.cp-download-all').length === 0) {
                    const downloadAll = $("<li class='cp-download-all'><a class='button bigButton nextAction' href='#'><span>Download All CSS and XML</span></a></li>");
                    downloadAll.on('click', function(e) {
                        e.preventDefault();
                        $(".downloadXML, .downloadCSS").each(function() { $(this).trigger('click'); });
                    });
                    $sidebarButtons.append(downloadAll);
                }
            }

            window.__cp_downloadxmlcss_initialized = true;
            console.info(TOOLKIT_NAME + ' Buttons inserted (or attempted).');
        } catch (err) {
            console.warn(TOOLKIT_NAME + ' Error in insertDownloadButtons:', err);
        }
    }

    // Provide alias/exports
    global.insertDownloadButtons = insertDownloadButtons;
    global.downloadxmlcss = insertDownloadButtons;

    // Auto-run path detection: only run when on Layouts page and (best-effort) CivicPlus site
    (async function autoRun() {
        try {
            if (!pageMatches(['/admin/designcenter/layouts'])) return;
            const isCP = await isCivicPlusSite();
            if (!isCP) return;
            // slight delay to allow page DOM to settle
            setTimeout(() => {
                try { insertDownloadButtons(); }
                catch (e) { console.warn(TOOLKIT_NAME + ' autoRun failed', e); }
            }, 300);
        } catch (e) {
            // ignore
        }
    })();

})(window);
