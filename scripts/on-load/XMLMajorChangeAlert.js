// ==UserScript==
// @name         CivicPlus - XML Major Change Alert
// @namespace    http://civicplus.com/
// @version      1.0.0
// @description  Alerts when XML changes will remove containers and validates XML structure
// @author       CivicPlus
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';
    
    const TOOLKIT_NAME = '[CP Toolkit - XML Major Change Alert]';
    
    // Check if we're on the correct page
    function pageMatches(patterns) {
        const url = window.location.href.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        
        return patterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
            return regex.test(url) || regex.test(pathname);
        });
    }
    
    // Only run on Layout Modify page
    if (!pageMatches(['/admin/designcenter/layouts/modify'])) {
        return;
    }
    
    // Wait for CP site detection from On-Demand Tools
    // If window.CPToolkit.isCivicPlusSite doesn't exist, assume we should run anyway
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
            function arrayDiff(oldArray, newArray) {
                return oldArray.filter(function(i) {
                    return newArray.indexOf(i) < 0;
                });
            }
            
            // Add an area for alerts
            $("#structureFile")
                .parent()
                .append("<div id='toolkitAlert'></div>");
            
            const originalXml = $("code").text();
            
            // Check for malformed XML on the original XML
            $(originalXml)
                .find("*[cpRole='contentContainer']")
                .each(function() {
                    if ($(this).children().length) {
                        let badIds = "";
                        $(this)
                            .children()
                            .each(function() {
                                badIds += this.id + "\n";
                            });
                        alert(
                            "The current XML is malformed:\n\n" +
                            this.id +
                            " is a content container that contains additional elements. Content containers should not contain any elements. Please change this to a structural container or remove the following elements from this container: \n\n" +
                            badIds +
                            "\nIf you continue to use this XML, you may run into unexpected issues, such as 404 errors when saving the theme."
                        );
                    }
                });
            
            // Monitor for alerts on save and do an alert box instead
            $("#ErrorMessage").bind("DOMSubtreeModified", function(e) {
                if (e.target.innerHTML.length > 0) {
                    alert(
                        $("#ErrorMessage")
                            .text()
                            .trim()
                    );
                }
            });
            
            // Move breakpoint and error message up
            $("ol.cpForm > li.left:nth-child(4)").after($("#mainMenuBreakpoint").parents("li.left"));
            $("ol.cpForm > li.left:nth-child(5)").after($("#ErrorMessage").parents("li.left"));
            
            // Add button to view layout page
            const pagesUrl = "/Pages/LayoutPage/?name=" + $("#txtStructureName").val();
            const pagesLink = $(
                "<li><a class='button bigButton nextAction' href='" + pagesUrl + "'><span>View Layout Page</span></a></li>"
            );
            $(".buttons li a.save")
                .parent("li")
                .after(pagesLink);
            
            // Add title to auto-save button for help text
            $("#autoSaveThemeStyles").attr("title", "Rebuilds the CSS for all themes that use this layout.");
            
            $("#structureFile").change(function() {
                const file = $("#structureFile")[0].files[0];
                if (typeof file != "undefined") {
                    console.log(TOOLKIT_NAME + " Change detected, checking for differences.");
                    const reader = new FileReader();
                    reader.readAsText(file);
                    reader.onloadend = function(e) {
                        const data = e.target.result;
                        const newXml = data.replace(/[\s\S]+<\?xml/, "<?xml");
                        
                        // Get all of the ID's from each
                        let originalIds = [];
                        let newIds = [];
                        
                        $(originalXml)
                            .find("*")
                            .each(function() {
                                if (this.id != "") {
                                    originalIds.push(this.id);
                                }
                            });
                        $(newXml)
                            .find("*")
                            .each(function() {
                                if (this.id != "") {
                                    newIds.push(this.id);
                                }
                            });
                        
                        originalIds = originalIds.sort();
                        newIds = newIds.sort();
                        
                        const differences = arrayDiff(originalIds, newIds);
                        let differenceString = "";
                        
                        if (differences.length) {
                            $(differences).each(function(index, value) {
                                if (differenceString == "") {
                                    differenceString += value;
                                } else {
                                    differenceString += ", " + value;
                                }
                            });
                            $("#toolkitAlert")
                                .html(
                                    "Warning: There are containers in the old XML that are not in the new XML. This will cause any widgets or styles applied to the following to be lost:<br><br>" +
                                    differenceString
                                )
                                .css("color", "red");
                            $("a.button.save")
                                .css("background-color", "#B33A3A")
                                .css("border-bottom-color", "#792327")
                                .css("color", "#fff");
                            $("a.button.save span").text("Save ignoring XML warning");
                        } else {
                            $("#toolkitAlert")
                                .text("This XML has all the containers that the old XML had.")
                                .css("color", "green");
                            $("a.button.save")
                                .css("background-color", "")
                                .css("border-bottom-color", "")
                                .css("color", "");
                            $("a.button.save span").text("Save");
                        }
                        
                        // Check for malformed XML
                        $(newXml)
                            .find("*[cpRole='contentContainer']")
                            .each(function() {
                                if ($(this).children().length) {
                                    let badIds = "";
                                    $(this)
                                        .children()
                                        .each(function() {
                                            badIds += this.id + "\n";
                                        });
                                    alert(
                                        "The chosen XML is malformed:\n\n" +
                                        this.id +
                                        " is a content container that contains additional elements. Content containers should not contain any elements. Please change this to a structural container or remove the following elements from this container: \n\n" +
                                        badIds +
                                        "\nIf you continue to use this XML, you may run into unexpected issues, such as 404 errors when saving the theme."
                                    );
                                }
                            });
                    };
                } else {
                    console.log(TOOLKIT_NAME + " No file picked.");
                    $("#toolkitAlert").text("");
                }
            });
            
            console.log(TOOLKIT_NAME + ' Successfully loaded');
        });
    } catch (err) {
        console.warn(TOOLKIT_NAME + ' Error:', err);
    }
}

init();
})();
