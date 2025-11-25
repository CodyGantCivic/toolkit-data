(function loadTool() {
  var thisTool = "module-icons";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool]) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          $.getJSON(chrome.extension.getURL("/data/modules.json"), function(modules) {
            // Counter to check number of attempts to load
            var attemptToLoadIconsCounter = 0;

            // Function to check if the tabs panel is on the current page
            function checkIfTabsPanel() {
              if ($(".cp-ModuleList-item").length) {
                // If the tabs panel is on the current page, load Font Awesome
                (function() {
                  if ($("#fontawesome_css").length == 0) {
                    var css = document.createElement("link");
                    css.id = "fontawesome_css";
                    css.href = chrome.extension.getURL("/css/external/fontawesome-all.min.css");
                    css.rel = "stylesheet";
                    css.type = "text/css";
                    document.getElementsByTagName("head")[0].appendChild(css);
                  }
                })();
                addIconsToModules();
              } else {
                // Retry 10 times
                if (attemptToLoadIconsCounter < 20) {
                  setTimeout(checkIfTabsPanel, 200);
                } else {
                  console.log("[CP Toolkit](" + thisTool + ") This page appears to not have a module list.");
                }
                attemptToLoadIconsCounter++;
              }
            }

            // Function to loop through and add all icons
            function addIconsToModules() {
              console.log("[CP Toolkit](" + thisTool + ") Adding icons to favorite modules.");
              chrome.storage.sync.get(null, function(result) {
                $.each(result, function(moduleClassKey, moduleClassValue) {
                  $.each(moduleClassValue, function(key, value) {
                    addIconToModule(key, moduleClassKey, value);
                  });
                });
              });
            }

            // Function to add an individual icon
            function addIconToModule(moduleName, moduleClass, faClass) {
              var urlOfModule = modules[moduleClass][moduleName].url;
              $(".cp-Tabs-panel")
                .find(".cp-ModuleList-itemLink[href*='" + urlOfModule + "']")
                .prepend('<i class="' + faClass + '"></i>&nbsp;&nbsp;&nbsp;')
                .css("font-weight", "bold");
            }
            $(document).ready(function() {
              checkIfTabsPanel();
            });
          });
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
