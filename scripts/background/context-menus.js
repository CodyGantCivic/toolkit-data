// Stuff for analytics
(function(i, s, o, g, r, a, m) {
  i["GoogleAnalyticsObject"] = r;
  (i[r] =
    i[r] ||
    function() {
      (i[r].q = i[r].q || []).push(arguments);
    }),
    (i[r].l = 1 * new Date());
  (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m);
})(window, document, "script", "https://www.google-analytics.com/analytics.js", "ga");

ga("create", "UA-118042537-1", "auto");
ga("set", "checkProtocolTask", function() {});
ga("send", "screenview", {
  appName: "CivicPlus Internal Toolkit Extension",
  screenName: "Background Page",
  appVersion: chrome.runtime.getManifest().version
});

// Function to create a context menu item
function createToolMenuItem(theTitle, theUrlPatterns, theHelp, theHelpPages, toolCode, parentId) {
  chrome.contextMenus.create({
    title: theTitle,
    parentId: parentId,
    contexts: ["all"],
    id: theTitle,
    documentUrlPatterns: theUrlPatterns,
    onclick: function(info, tab) {
      console.log(
        "Running on-demand tool '" + theTitle + "' on tab " + tab.id + " (" + tab.title + " <" + tab.url + ">)"
      );

      // Encoding and decoding to handle escaped characters correctly
      chrome.tabs.executeScript(tab.id, {
        code:
          "console.log('On demand tool running...');var toolCode = decodeURI(`" +
          encodeURI(toolCode) +
          "`);var scriptElement = document.createElement('script');scriptElement.innerHTML = toolCode;document.body.appendChild(scriptElement);"
      });
      // Analytics for on-demand tools
      ga("send", "event", "On-Demand Tool Run", theTitle, tab.url);
    }
  });
  chrome.contextMenus.create({
    title: theTitle,
    parentId: "tool-about-menu",
    contexts: ["all"],
    id: theTitle + "-help",
    documentUrlPatterns: theUrlPatterns,
    onclick: function() {
      alert("Tool Name:\n" + theTitle + "\n\nDescription:\n" + theHelp + "\n\nWill run on:\n" + theHelpPages);
    }
  });
}

// Since this could run at any time, remove all old context menus before adding any new ones.
chrome.contextMenus.removeAll(function() {
  // About menu, always make this first
  chrome.contextMenus.create({
    title: "About a tool",
    id: "tool-about-menu",
    contexts: ["all"]
  });

  // All Tools help
  chrome.contextMenus.create({
    title: "All Tools (tools you can run on this page appear below)",
    parentId: "tool-about-menu",
    id: "tool-about-all",
    contexts: ["all"],
    onclick: function() {
      chrome.tabs.query({ active: true }, function(tabs) {
        chrome.tabs.create({ openerTabId: tabs[0].id, url: chrome.runtime.getURL("/html/help.html#on-demand-tools") });
      });
    }
  });

  // Get the tools to add
  $.getJSON("/data/on-demand-tools.json", function(contextTools) {
    // We need to make sure they are in alphabetical order, to do so we won't add them until they have all loaded.
    let remaining = Object.keys(contextTools).length;
    const toolsToAdd = {};

    // For each tool
    for (const toolID of Object.keys(contextTools)) {
      const tool = contextTools[toolID];
      fetch(`/js/tools/on-demand/${tool.file}`)
        .then((resp) => resp.text())
        .then((toolCode) => {
          // Add it to the array of tools to add
          toolsToAdd[toolID] = {
            urlPatterns: tool.urlPatterns,
            help: tool.help,
            helpPages: tool.helpPages,
            toolCode: toolCode
          };
        })
        .catch((err) => {
          console.error(`[CP Toolkit]: Failed to load "${toolID}"`);
        })
        .then(() => {
          remaining -= 1;
          if (remaining === 0) {
            const keys = Object.keys(toolsToAdd);
            keys.sort();

            // For each tool, actually add its menu item
            $.each(keys, function(key, value) {
              createToolMenuItem(
                value,
                toolsToAdd[value].urlPatterns,
                toolsToAdd[value].help,
                toolsToAdd[value].helpPages,
                toolsToAdd[value].toolCode,
                null
              );
            });
          }
        });
    }
  });
  chrome.storage.local.get("mavenlink-import-export", function(settings) {
    if (settings["mavenlink-import-export"]) {
      console.log("Mavenlink import/export tools enabled.");

      $.getJSON("/data/mavenlink-import-export-tools.json", function(mavenlinkImportExportTools) {
        // Create the outer-level menu
        chrome.contextMenus.create({
          title: "Mavenlink Import/Export",
          id: "mavenlink-import-export",
          contexts: ["all"],
          documentUrlPatterns: ["*://*.mavenlink.com/*"]
        });

        // We need to make sure they are in alphabetical order, to do so we won't add them until they have all loaded.
        var numMavenlinkTools = Object.keys(mavenlinkImportExportTools).length;
        var numMavenlinkToolsLoaded = 0;
        var mavenlinkToolsToAdd = {};

        // For each tool
        $.each(mavenlinkImportExportTools, function(key, value) {
          // Get the tool's code
          $.get(
            "/js/tools/mavenlink-import-export/" + value.file,
            function(toolCode) {
              $.get(
                "/js/tools/mavenlink-import-export/shared.js",
                function(sharedCode) {
                  toolCode = sharedCode + toolCode;

                  numMavenlinkToolsLoaded++;

                  // Add it to the array of tools to add
                  mavenlinkToolsToAdd[key] = {
                    urlPatterns: value.urlPatterns,
                    help: value.help,
                    helpPages: value.helpPages,
                    toolCode: toolCode
                  };

                  // If this was the last tool to add
                  if (numMavenlinkToolsLoaded == numMavenlinkTools) {
                    // Get the tools' keys and sort them
                    var keys = Object.keys(mavenlinkToolsToAdd);
                    keys.sort();

                    // For each tool, actually add its menu item
                    $.each(keys, function(key, value) {
                      createToolMenuItem(
                        value,
                        mavenlinkToolsToAdd[value].urlPatterns,
                        mavenlinkToolsToAdd[value].help,
                        mavenlinkToolsToAdd[value].helpPages,
                        mavenlinkToolsToAdd[value].toolCode,
                        "mavenlink-import-export"
                      );
                    });
                  }
                },
                "text"
              );
            },
            "text"
          );
        });
      });
    }
  });
});
