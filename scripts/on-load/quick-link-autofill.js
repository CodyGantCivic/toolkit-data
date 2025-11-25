(function loadTool() {
  var thisTool = "quick-link-autofill";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] && window.location.pathname.toLowerCase().startsWith("/admin/quicklinks.aspx")) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          $.getJSON(chrome.extension.getURL("/data/link-replacement-text.json"), function(linkReplacementText) {
            function findValToReplace(quickLinkText, quickLinkJson) {
              var link;
              $.each(quickLinkJson, function(key, value) {
                $(value).each(function() {
                  if (quickLinkText.toLowerCase() == this.toString().toLowerCase()) {
                    link = key;
                  }
                });
              });
              if (link) {
                return link;
              } else {
                return false;
              }
            }

            function replaceQuickLink() {
              if ($("#enableQuickLinkAutochange").is(":checked")) {
                if (findValToReplace($("#txtLinkText").val(), linkReplacementText)) {
                  if ($("#txtLink").val() !== findValToReplace($("#txtLinkText").val(), linkReplacementText)) {
                    $("#txtLink").val(findValToReplace($("#txtLinkText").val(), linkReplacementText));
                    $("#quickLinkChangeWarn").text(
                      "Notice: The link was autochanged by the CivicPlus Toolkit. You must save to actually update the URL."
                    );
                  }
                }
              }
            }

            var enableQuickLinkCheckbox = $(
              "<br><label class='check' style='width:47%' for='enableQuickLinkAutochange'><input type='checkbox' name='ysnNewWindow' id='enableQuickLinkAutochange'>[CP Toolkit] Enable quick link autochanger</label><div style='color: red;' id='quickLinkChangeWarn'>&nbsp;</div><br>"
            );

            $(document).ready(function() {
              $("#ysnNewWindow")
                .parent()
                .parent()
                .parent()
                .parent()
                .parent()
                .parent()
                .prepend(enableQuickLinkCheckbox);

              // Enable by default only if no link exists already
              if ($("#txtLinkText").val() == "" && $("#txtLink").val() == "") {
                $("#enableQuickLinkAutochange").prop("checked", true);
              }
              // Handle further changes of the checkbox
              $("#enableQuickLinkAutochange").change(function() {
                replaceQuickLink();
              });

              $("#txtLinkText").on("change keyup paste", function() {
                replaceQuickLink();
              });
              $("#enableQuickLinkAutochange").on("change keyup paste", function() {
                replaceQuickLink();
              });
            });
          });
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
