(function loadTool() {
  var thisTool = "auto-dismiss-help-welcome";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool]) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          var welcomeUrl = "?ShowWelcomeMessage=1";
          if (window.location.href.indexOf(welcomeUrl) !== -1) {
            window.location.href = window.location.href.replace(welcomeUrl, "");
          }
          $(` <style id="cp-toolkit_dismiss-help">
                            #widgetsTabTooltip, #workingCopyTooltip {
                                display: none !important;
                            }
                        </style>`).appendTo("body");
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
