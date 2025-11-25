(function loadTool() {
  var thisTool = "widget-skin-default-override";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool] && window.location.pathname.toLowerCase().startsWith("/designcenter/themes")) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          $(
            "<script>" +
              `
                        // Override refreshContentContainersAsync to determine when a skin is saved
                        var originalRefreshContentContainersfn = refreshContentContainersAsync;
                        refreshContentContainersAsync = function(reset) {
                        	originalRefreshContentContainersfn(reset);

                        	var foundSkin = false;

                        	$.each(DesignCenter.themeJSON.WidgetSkins, function() {
                                if (this.WidgetSkinID < 0) {
                                    console.log("[CP Toolkit](` +
              thisTool +
              `) Found unsaved widget skin. Forcing save...")
                        			foundSkin = true;
                                    var shouldSetDefaults = confirm("[CP Toolkit] Overriding Default New Widget Skin Options\\n\\nClick Cancel if you are copying a skin, or if you don't want to override the default new skin options. Click OK to override the default new skin options.");
                                    if (shouldSetDefaults) {
                                        console.log("[CP Toolkit](` +
              thisTool +
              `) Overriding defaults.");
                                        // Wrapper
                                        this.Components[0].FontSize = null;
                                        this.Components[0].TextAlignment = 0;

                                        // Tabbed Widget
                                        var paddingEms = {Value: "0.5", Unit: "0"};
                                        this.Components[13].PaddingTop = paddingEms;
                                        this.Components[13].PaddingLeft = paddingEms;
                                        this.Components[13].PaddingBottom = paddingEms;
                                        this.Components[13].PaddingRight = paddingEms;
                                    } else {
                                        console.log("[CP Toolkit](` +
              thisTool +
              `) Not overriding defaults.");
                                    }
                                }
                            });
                        	if (foundSkin) {
                        		$(".modalClose").click();
                        		saveTheme();
                        		var clearSkin = setInterval(function() {
                        			$(".widget[class*='skin-'] .remove.widgetSkin").click();
                        		}, 100);
                        		setTimeout(function() {
                        			clearInterval(clearSkin);
                        			$("a:contains('Manage Widget Skins')").click();
                        		}, 5000);
                        	}
                        };
                    ` +
              "</script>"
          ).appendTo("body");
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
