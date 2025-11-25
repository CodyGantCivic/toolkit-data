(function loadTool() {
  var thisTool = "keyboard-shortcuts";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool]) {
        console.log("[CP Toolkit] Loading " + thisTool);
        var saveTimeout = false;
        $(window).bind("keydown", function(event) {
          if (event.ctrlKey || event.metaKey) {
            if (event.which == 83) {
              // 83 = 's'
              event.preventDefault();
              if (saveTimeout) {
                console.log("[CP Toolkit](" + thisTool + ") Second save detected too fast, ignoring.");
              } else {
                saveTimeout = true;
                setTimeout(function() {
                  saveTimeout = false;
                }, 1000);
                if (event.shiftKey) {
                  // CTRL + SHIFT + S (Save and Publish)
                  console.log(
                    "[CP Toolkit](" + thisTool + ") CTRL+SHIFT+S detected, attempting to save and push/publish."
                  );
                  if ($("input[value='Save and Publish']").length) {
                    // Graphic Links, Quick Links, Info Advanced, FAQs, etc.
                    $("input[value='Save and Publish']").click();
                  } else if ($("a.saveAndPush").length) {
                    // Theme
                    $("a.saveAndPush")[0].click();
                  }
                } else {
                  console.log("[CP Toolkit](" + thisTool + ") CTRL+S detected, attempting to save.");
                  // CTRL + S (Save)
                  if ($("input[value='Save']").length) {
                    // Graphic Links, Quick Links, Info Advanced, FAQs, etc.
                    $("input[value='Save']").click();
                  } else if ($("a.save").length) {
                    // Theme
                    $("a.save")[0].click();
                  }
                }
              }
            } else if (event.which == 73) {
              // 73 = 'i'
              if ($("input[value*='Add']").length && !event.shiftKey) {
                // If there is an "Add Item" button
                event.preventDefault();
                $("input[value*='Add']").click();
              }
            }
          }
        });
      }
    });
  });
})();
