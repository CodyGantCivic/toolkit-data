(function loadTool() {
  var thisTool = "graphic-link-autofill";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] && window.location.pathname.toLowerCase().startsWith("/admin/graphiclinks.aspx")) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          $.getJSON(chrome.extension.getURL("/data/link-replacement-text.json"), function(linkReplacementText) {
            // If we are on a page with a link field
            if ($("#linkUrl").length) {
              // Initialize
              // Add a checkbox to enable/disable tool for this link
              var enableGraphicButtonCheckbox = $(
                "<br><label class='check' style='width:47%' for='enableGraphicButtonAutochange'><input type='checkbox' name='ysnNewWindow' id='enableGraphicButtonAutochange'>[CP Toolkit] Enable graphic link autochanger</label><br><br><div style='color: red;' id='graphicButtonChangeWarn'></div>"
              );
              $("#GraphicLink_OpenInNewWindow")
                .parent()
                .parent()
                .append(enableGraphicButtonCheckbox);

              // If there is no link (new graphic button), enable the autochanger
              if ($("#linkUrl").val() == "") {
                $("#enableGraphicButtonAutochange").prop("checked", true);
              }

              // Get text from fancy button
              function checkFancyButton() {
                if ($("#enableGraphicButtonAutochange").is(":checked") && $(".fancyButtonContainer .text").html()) {
                  $(
                    $(".fancyButtonContainer .text")
                      .html()
                      .replace(/([\s\n]*<[^>]*>[\s\n]*)+/g, " ")
                      .trim()
                      .split(" ")
                  ).each(function() {
                    checkForLink(this.toString());
                  });
                }
              }

              // Get text from regular button
              function checkRegularButton() {
                var imageID = $(".imagePreview")
                  .first()
                  .attr("src")
                  .split("=")[1];
                if (typeof imageID !== "undefined") {
                  var imageInfoURL = "/Admin/DocumentCenter/DocumentForModal/Edit/" + imageID + "?folderID=1";
                  $.get(imageInfoURL, function(response) {
                    var responseObject = $(response);
                    var altText = responseObject.find("#txtAltText").val();
                    var displayName = responseObject.find("#txtDocumentName").val();
                    checkForLink(displayName);
                    checkForLink(altText);
                  });
                }
              }

              // Check given text for matched link and replace it if match found
              function checkForLink(theText) {
                if ($("#enableGraphicButtonAutochange").is(":checked")) {
                  console.log("[CP Toolkit](" + thisTool + ") Detected graphic link text: " + theText);

                  var urlFromText = false;
                  // Lookup URL from the text
                  $.each(linkReplacementText, function(linkUrl, matchingText) {
                    $(matchingText).each(function() {
                      if (theText.toLowerCase() == this.toString().toLowerCase()) {
                        urlFromText = linkUrl;
                      }
                    });
                  });

                  if (urlFromText) {
                    if ($("#linkUrl").val() !== urlFromText) {
                      $("#linkUrl").val(urlFromText);
                      $("#graphicButtonChangeWarn").text(
                        "Notice: The link was autochanged by the CivicPlus Toolkit. You must save the button to actually update the URL."
                      );
                    }
                  }
                }
              }

              // HANDLE CHANGES
              // Image changed on regular Graphic Link
              imageChangeObserver = new MutationObserver(function(mutation) {
                checkRegularButton();
              });
              imageChangeObserver.observe($(".imagePreview")[0], { attributes: true });

              // Fancy Button modified
              $(".fancyButtonContainer").bind("DOMSubtreeModified", function() {
                checkFancyButton();
              });

              // Checkbox modified
              $("#enableGraphicButtonAutochange").change(function() {
                // Check if fancy button link needs changed
                checkFancyButton();

                // Check if regular button link needs changed
                checkRegularButton();
              });
            }
          });
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
