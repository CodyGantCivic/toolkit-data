(function loadTool() {
  var thisTool = "cp-MultipleItemUpload";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool]) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          // When you are on the main News Flash Page, get all category ID's + Names and post them to Chromes local storage for future use
          if (
            $("td:contains('Published Categories')").length &&
            window.location.pathname.toLowerCase() == "/admin/civicalerts.aspx"
          ) {
            var callAlertCategoryDetails = $(".adminthin a");
            var allCategoryIDs = [];
            var i;
            for (i = 0; i < callAlertCategoryDetails.length; i++) {
              var onClick = $(".adminthin a")[i].getAttributeNode("onclick").nodeValue;
              var res = onClick.slice(24);
              var categoryID = res.substring(0, res.indexOf(","));
              var categoryName = $(".adminthin a")[i].innerText;
              allCategoryIDs.push({
                categoryName,
                categoryID
              });
            }
            localStorage.setItem("callAlertCategories", JSON.stringify(allCategoryIDs));
            console.log("[CPToolkit] Posting Category List to Chromes Local Storage");
          }
          // If you are on the Item creation (not modify) page, add the Save to Multiple Categories Button and Related Categories section + run function
          if (
            $("input[value*='Save and Publish']").length &&
            window.location.pathname.toLowerCase() == "/admin/civicalerts.aspx"
          ) {
            var uploadMultiple = $(
              '<input type="button" class="cp-button" value="Save to Multiple Categories" style="margin-left: 5px;"><textarea id="completedResults" style="display: none;margin: 0px 921px 0px 0px; height: 356px; width: 362px;"></textarea>'
            );
            var thisButtonSection = $("input[value*='Save and Publish']");
            thisButtonSection.after(uploadMultiple[0]);
            thisButtonSection.after(uploadMultiple[1]);
            var relatedCats = $(`
              <div class="formline selfClear relatedCategories">
            		<label id="lblRelatedCategories">Related Categories<span>(CPToolkit Extension)</span></label>
            		<div>
            			<div class="listing categories relataedCategoriesNewsFlash_cl">
            				<div>
            					<ul class="items selfClear" id="relataedCategoriesNewsFlash_ts">
            					</ul>
            				</div>
            			</div>
            		</div>
            	</div>
              `);
            var relatedCatsSection = $("#advanced");
            relatedCatsSection.after(relatedCats[0]);
            // Add CSS for related calendars section
            var css = `.relataedCategoriesNewsFlash_cl > label {
                margin-top: .75rem;
                padding-left: .75rem;
                padding-left: calc(.75rem + 1px); }
                .relatedCalendarList > label > input[type="checkbox"] {
                  top: 2px; }

              .relataedCategoriesNewsFlash_cl .items {
                border-left: 1px solid #b0c0d0;
                border-top: 1px solid #b0c0d0;
                list-style: none;
                margin: .5rem 0;
                padding: 0; }

              .relataedCategoriesNewsFlash_cl .item {
                border-left: 0;
                float: left;
                padding-left: .75rem;
                width: 50%; }
                .relataedCategoriesNewsFlash_cl .item label {
                  width: 100%; }
                .relataedCategoriesNewsFlash_cl .item input[type="checkbox"] {
                  top: 0; }
                .relataedCategoriesNewsFlash_cl .item .status {
                  position: absolute;
                  right: .75rem;
                  top: .75rem; }`,
              head = document.head || document.getElementsByTagName("head")[0],
              style = document.createElement("style");

            style.type = "text/css";
            if (style.styleSheet) {
              // This is required for IE8 and below.
              style.styleSheet.cssText = css;
            } else {
              style.appendChild(document.createTextNode(css));
            }
            head.appendChild(style);

            // Append Related Calendars to List
            var allCats = JSON.parse(localStorage.getItem("callAlertCategories"));
            for (var category in allCats) {
              var newLI = document.createElement("li");
              newLI.className = "item";
              var newLABEL = document.createElement("label");
              newLABEL.className = "check";
              newLABEL.setAttribute("for", "relataedCategoriesNewsFlash_ts_" + allCats[category].categoryID);
              newLABEL.innerHTML = allCats[category].categoryName;
              newLI.appendChild(newLABEL);
              var newInput = document.createElement("input");
              newInput.className = "nfCategory_cl";
              newInput.id = "relataedCategoriesNewsFlash_ts_" + allCats[category].categoryID;
              newInput.value = allCats[category].categoryID;
              newInput.type = "checkbox";
              newInput.name = "relataedCategoriesNewsFlash_ts_" + allCats[category].categoryID;
              newLABEL.appendChild(newInput);
              document.getElementById("relataedCategoriesNewsFlash_ts").appendChild(newLI);
            }

            // Get selected categories and post to those categories
            uploadMultiple.click(function() {
              var ajaxLoad =
                'ajaxPostBackStart("Please wait... This will only take a moment.");$("#divAjaxProgress").clone().attr("id", "toolkit-block").css("display", "none").appendTo("body");ajaxPostBackEnd();';
              var script = document.createElement("script");
              script.innerHTML = ajaxLoad;
              document.body.appendChild(script);
              var categoryList = [];
              var selectedCategories = document.getElementsByClassName("nfCategory_cl");
              var i;
              for (i = 0; i < selectedCategories.length; i++) {
                if (selectedCategories[i].checked) {
                  categoryList.push(selectedCategories[i].value);
                }
              }
              var categoryCount = 0;
              categoryList.forEach(function(element) {
                // var status = prompt("Publish or Draft? (0 for Draft, 1 for Published)", "1");
                var altURLAction = 0;
                if (document.getElementById("altURLAction").checked == false) {
                  altURLAction = 0;
                } else {
                  altURLAction = 1;
                }
                var data = {
                  strResourceType: "M",
                  lngResourceID: 1,
                  ysnPublishDetail: 1,
                  ysnSave: 1,
                  strPage: "CivicAlertItemList",
                  curPage: "CivicAlertForm",
                  lngOldCivicAlertCategoryID: element,
                  lngCivicAlertCategoryID: element,
                  dtiBeginningDate: document.getElementById("dtiBeginningDate").value,
                  dtiBeginningTime: document.getElementById("dtiBeginningTime").value,
                  dtiEndingDate: document.getElementById("dtiEndingDate").value,
                  dtiEndingTime: document.getElementById("dtiEndingTime").value,
                  txtTitle: document.getElementById("txtTitle").value,
                  hdnBriefDescription: document.getElementById("ctl01_txtBriefDesc").value,
                  ctl01$txtBriefDesc: document.getElementById("ctl01_txtBriefDesc").value,
                  txtPageContent: document.getElementById("txtPageContent").value,
                  txtLinkTitle1: document.getElementById("txtLinkTitle1").value,
                  txtAlternateURL: document.getElementById("txtAlternateURL").value,
                  txtLinkTitle2: document.getElementById("txtLinkTitle2").value,
                  altURLAction: altURLAction,
                  ysnArchive: document.getElementById("ysnArchive").value,
                  imgSrc: document.getElementById("imgSrc").value,
                  mynewimage: "/ImageRepository/Document?documentID=" + document.getElementById("imgSrc").value,
                  ImageDocumentId: document.getElementById("imgSrc").value,
                  ysnImageAlignLeft: document.getElementById("ysnImageAlignLeft").value
                };

                $.ajax({
                  type: "POST",
                  url: "https://" + document.location.hostname + "/Admin/civicalerts.aspx",
                  data: data
                }).done(function() {
                  categoryCount++;
                  document.getElementById("completedResults").value = categoryCount;
                  if (categoryCount == categoryList.length) {
                    document.getElementById("toolkit-block").style.display = "none";
                    $('input[value="Back"]').click();
                  }
                });
              });
            });
          }
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
