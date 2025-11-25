(function () {
    'use strict';

    const TOOLKIT_NAME = '[CP Toolkit - XML Major Change Alert]';

    // --- Avoid double-injection ---
    if (window.XMLMajorChangeAlert && window.XMLMajorChangeAlert.__loaded) {
        console.log(TOOLKIT_NAME, 'Already loaded, skipping');
        return;
    }

    // Exported object
    window.XMLMajorChangeAlert = {
        __loaded: false,

        init: async function () {
            // Do not run twice
            if (window.XMLMajorChangeAlert.__loaded) return;
            window.XMLMajorChangeAlert.__loaded = true;

            // Only run on Layout Modify page
            const url = window.location.pathname.toLowerCase();
            if (!url.includes('/admin/designcenter/layouts/modify')) {
                console.log(TOOLKIT_NAME, 'Not on Layout Modify page, exiting');
                return;
            }

            // Optional CivicPlus validator (if loader exposed it)
            if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
                const isCP = await window.CPToolkit.isCivicPlusSite();
                if (!isCP) {
                    console.log(TOOLKIT_NAME + ' Not a CivicPlus site, exiting');
                    return;
                }
            }

            console.log(TOOLKIT_NAME, 'Initializing…');

            try {
                // Wait for jQuery
                await waitFor(() => window.jQuery, 5000);

                jQuery(document).ready(function ($) {
                    function arrayDiff(oldArray, newArray) {
                        return oldArray.filter(i => newArray.indexOf(i) < 0);
                    }

                    // Prepare alert container
                    $("#structureFile").parent().append("<div id='toolkitAlert'></div>");

                    const originalXml = $("code").text();

                    // Validate original XML for malformed content containers
                    $(originalXml).find("*[cpRole='contentContainer']").each(function () {
                        if ($(this).children().length) {
                            let badIds = "";
                            $(this).children().each(function () {
                                badIds += this.id + "\n";
                            });

                            alert(
                                "The current XML is malformed:\n\n" +
                                this.id +
                                " is a content container that contains additional elements.\n" +
                                "Content containers should not contain any elements.\n\n" +
                                "Invalid children:\n\n" +
                                badIds +
                                "\nThis may cause layout/theme save errors."
                            );
                        }
                    });

                    // Convert built-in error DIV into alert()
                    $("#ErrorMessage").bind("DOMSubtreeModified", function (e) {
                        if (e.target.innerHTML.length > 0) {
                            alert($("#ErrorMessage").text().trim());
                        }
                    });

                    // UI adjustments
                    $("ol.cpForm > li.left:nth-child(4)").after($("#mainMenuBreakpoint").parents("li.left"));
                    $("ol.cpForm > li.left:nth-child(5)").after($("#ErrorMessage").parents("li.left"));

                    // Add "View Layout Page" button
                    const pagesUrl = "/Pages/LayoutPage/?name=" + $("#txtStructureName").val();
                    const pagesLink = $("<li><a class='button bigButton nextAction' href='" + pagesUrl + "'><span>View Layout Page</span></a></li>");
                    $(".buttons li a.save").parent("li").after(pagesLink);

                    // Tooltip
                    $("#autoSaveThemeStyles").attr("title", "Rebuilds CSS for all themes using this layout.");

                    // Monitor XML file input
                    $("#structureFile").change(function () {
                        const file = $("#structureFile")[0].files[0];

                        if (file) {
                            console.log(TOOLKIT_NAME + " Change detected, checking differences…");
                            const reader = new FileReader();

                            reader.readAsText(file);
                            reader.onloadend = function (e) {
                                const data = e.target.result;
                                const newXml = data.replace(/[\s\S]+<\?xml/, "<?xml");

                                let originalIds = [];
                                let newIds = [];

                                $(originalXml).find("*").each(function () {
                                    if (this.id) originalIds.push(this.id);
                                });

                                $(newXml).find("*").each(function () {
                                    if (this.id) newIds.push(this.id);
                                });

                                originalIds.sort();
                                newIds.sort();

                                const differences = arrayDiff(originalIds, newIds);
                                let differenceString = differences.join(", ");

                                if (differences.length) {
                                    $("#toolkitAlert")
                                        .html(
                                            "Warning: The new XML is missing containers that exist in the original layout.<br><br>" +
                                            differenceString +
                                            "<br><br>Widgets/styles applied to these containers will be lost."
                                        )
                                        .css("color", "red");

                                    $("a.button.save")
                                        .css("background-color", "#B33A3A")
                                        .css("border-bottom-color", "#792327")
                                        .css("color", "#fff");

                                    $("a.button.save span").text("Save ignoring XML warning");
                                } else {
                                    $("#toolkitAlert")
                                        .text("The new XML preserves all existing containers.")
                                        .css("color", "green");

                                    $("a.button.save")
                                        .css("background-color", "")
                                        .css("border-bottom-color", "")
                                        .css("color", "");

                                    $("a.button.save span").text("Save");
                                }

                                // Validate malformed new XML content containers
                                $(newXml).find("*[cpRole='contentContainer']").each(function () {
                                    if ($(this).children().length) {
                                        let badIds = "";
                                        $(this).children().each(function () {
                                            badIds += this.id + "\n";
                                        });

                                        alert(
                                            "The chosen XML is malformed:\n\n" +
                                            this.id +
                                            " is a content container with children.\n\n" +
                                            "Invalid children:\n\n" +
                                            badIds +
                                            "\nThis may cause layout/theme save errors."
                                        );
                                    }
                                });
                            };
                        } else {
                            console.log(TOOLKIT_NAME + " No file picked.");
                            $("#toolkitAlert").text("");
                        }
                    });

                    console.log(TOOLKIT_NAME, "Successfully loaded");
                });
            } catch (err) {
                console.warn(TOOLKIT_NAME, "Error:", err);
            }
        }
    };

    // Auto-run after export
    window.XMLMajorChangeAlert.init();

    // Simple waiter helper
    async function waitFor(testFn, timeout = 5000, interval = 100) {
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
