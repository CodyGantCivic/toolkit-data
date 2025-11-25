(function loadTool() {
  var thisTool = "cp-MultipleCategoryUpload";
  chrome.storage.local.get(thisTool, function(settings) {
    detect_if_cp_site(function() {
      if (settings[thisTool]) {
        console.log("[CP Toolkit] Loading " + thisTool);
        try {
          function appendCode() {
            $("body")
              .append(`<style>.block{display:block;width:100%;} .cp-button{background-color:#d3d657 !important;border-bottom-color:#b3b64a !important;} .MultipleCategoryUpload{overflow: scroll;height:800px !important;margin-top:-400px !important;margin-left:-250px !important;position:absolute !important;top:50% !important;left:50% !important;} .calendar-section{padding:10px;border-radius:10px;width:400px;margin-top:20px;} label{color:#0b5486;font-size:1.1rem;font-weight:400;margin:.5rem 0 .25rem;} .modal{display:none;position:fixed;z-index:1;left:0;top:0;width:100%;height:100%;overflow:auto;background-color:rgb(0,0,0);background-color:rgba(0,0,0,0.4);padding-top:60px;} .modal-content{background-color:#fefefe;margin:5% auto 15% auto;border:1px solid #888;width:80%;} .close{position:absolute;right:25px;top:0;color:#000;font-size:35px;font-weight:bold;} .close:hover, .close:focus{color:red;cursor:pointer;} .animate{-webkit-animation:animatezoom 0.6s;animation:animatezoom 0.6s } @-webkit-keyframes animatezoom{from{-webkit-transform:scale(0)} to{-webkit-transform:scale(1)} } @keyframes animatezoom{from{transform:scale(0)} to{transform:scale(1)} } @media screen and (max-width:300px){span.psw{display:block;float:none;} .cancelbtn{width:100%;} } #apiLogin{position: absolute;left: 50%;width: 482px;bottom: 73px !important;z-index: 100000;margin-left: -249px !important;text-align: center;background-color: #ffffff;border-top: 1px solid #0b5486;}#runAPI{position: absolute;left: 50%;width: 482px !important;z-index: 999999;bottom: 162px;background-color: #9fb5cb;border: none;margin-left: -249px !important;text-align: center;border-top: 1px solid #0b5486;text-transform: UPPERCASE;}
                  .category-section:last-of-type {padding-bottom: 120px;} #addNewSection{float: right;margin-right: 28px;} #removeSection{margin-left: 10px;}</style>`);

            // Modal Window
            var modalWindow = $(`
                    <div id="cp-MultipleCategoryUpload" class="modalContainer modalContainerCP MultipleCategoryUpload ui-draggable" style="display: none;">
                      <div id="cp-MultipleCategoryUpload-TitleBar" class="modalTitleLeft" style="cursor: move;">
                        <h3 id="cp-MultipleCategoryUpload-Title" class="modalTitle">Category - Multiple Upload</h3>
                        <a id="cp-MultipleCategoryUpload-CloseButton" class="modalClose" href="#" title="Close this window" tabindex="0">Close</a>
                        <input type="button" style="width: 108px;" id="addNewSection" value="Add">
                        <input type="button" style="width: 108px;" id="removeSection" value="Remove">
                      </div>
                      <div id="cp-MultipleCategoryUpload-ContentLeft" class="modalContentLeft">
                        <div id="cp-MultipleCategoryUpload-ContentRight" class="modalContentRight">
                          <div id="cp-MultipleCategoryUpload-Content" class="modalContent">
                            <div class="category-section" id="cs1">
                              <label for="category-Name">Category Name: </label>
                              <input type="text" name="category-Name" class="block">
                              <label for="category-Status">Category Status: </label>
                              <select name="category-Status" class="block">
                                <option value="Draft">Draft</option>
                                <option value="Published">Published</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div id="apiLogin" style="display: none;">
                      <input type="email" placeholder="Enter Username" name="uname" id="uname" autocomplete="on" style="display: block; width:100%">
                      <input type="password" placeholder="Enter Password" name="psw" id="psw" autocomplete="on" style="display: block; width:100%">
                    </div>
                    <button type="button" id="runAPI" class="submitBtn" style="display: none;">Submit</button>
                    `);
            var ajaxLoad =
              'ajaxPostBackStart("Please wait... This will only take a moment.");$("#divAjaxProgress").clone().attr("id", "toolkit-block").css("display", "none").appendTo("body");ajaxPostBackEnd();';
            var script = document.createElement("script");
            script.innerHTML = ajaxLoad;
            document.body.appendChild(script);

            $("body").append(modalWindow);

            $("#cp-MultipleCategoryUpload-CloseButton").click(function() {
              document.getElementById("cp-MultipleCategoryUpload").style.display = "none";
              document.getElementById("apiLogin").style.display = "none";
              document.getElementById("runAPI").style.display = "none";
              $("#cp-MultipleCategoryUpload-Content")
                .children(":not(#cs1)")
                .remove();
            });

            $("#removeSection").click(function() {
              $("#cp-MultipleCategoryUpload-Content")
                .children()
                .last()
                .remove();
            });

            $("#addNewSection").click(function() {
              var str = `<div class="calendar-section">
                      <label for="category-Name">Category Name: </label>
                      <input type="text" name="category-Name" class="block">
                      <label for="category-Status">Category Status: </label>
                      <select name="category-Status" class="block">
                        <option value="Draft">Draft</option>
                        <option value="Published">Published</option>
                      </select>
                    </div>`,
                div = document.getElementById("cp-MultipleCategoryUpload-Content");
              div.insertAdjacentHTML("beforeend", str);
            });

            // Post to Module
            $("#runAPI").click(function() {
              if (window.location.pathname.toLowerCase() == "/admin/infoii.aspx") {
                document.getElementById("toolkit-block").style.display = "block";
                var categoryName = document.getElementsByName("category-Name");
                var categoryStatus = document.getElementsByName("category-Status");
                for (i = 0; i < categoryName.length; i++) {
                  for (i = 0; i < categoryStatus.length; i++) {
                    if (categoryStatus[i].value == "Draft") {
                      var data = {
                        lngResourceID: 43,
                        strResourceType: "M",
                        ysnSave: 1,
                        intQLCategoryID: 0,
                        strAction: "qlCategorySave",
                        txtName: categoryName[i].value,
                        txtGroupViewList: 1
                      };

                      $.ajax({
                        type: "POST",
                        url: "https://" + document.location.hostname + "/Admin/infoii.aspx",
                        data: data
                      }).done(function() {
                        window.location.reload();
                      });
                    } else if (categoryStatus[i].value == "Published") {
                      var data = {
                        lngResourceID: 43,
                        strResourceType: "M",
                        ysnSave: 1,
                        intQLCategoryID: 0,
                        ysnPublishDetail: 1,
                        strAction: "qlCategorySave",
                        txtName: categoryName[i].value,
                        txtGroupViewList: 1
                      };

                      $.ajax({
                        type: "POST",
                        url: "https://" + document.location.hostname + "/Admin/infoii.aspx",
                        data: data
                      }).done(function() {
                        window.location.reload();
                      });
                    }
                  }
                }
              } else if (window.location.pathname.toLowerCase() == "/admin/graphiclinks.aspx") {
                document.getElementById("toolkit-block").style.display = "block";
                var categoryName = document.getElementsByName("category-Name");
                var categoryStatus = document.getElementsByName("category-Status");
                for (i = 0; i < categoryName.length; i++) {
                  for (i = 0; i < categoryStatus.length; i++) {
                    if (categoryStatus[i].value == "Draft") {
                      var data = {
                        lngResourceID: 43,
                        strResourceType: "M",
                        ysnSave: 1,
                        intQLCategoryID: 0,
                        strAction: "qlCategorySave",
                        txtName: categoryName[i].value,
                        txtGroupViewList: 1
                      };

                      $.ajax({
                        type: "POST",
                        url: "https://" + document.location.hostname + "/Admin/graphiclinks.aspx",
                        data: data
                      }).done(function() {
                        window.location.reload();
                      });
                    } else if (categoryStatus[i].value == "Published") {
                      var data = {
                        lngResourceID: 43,
                        strResourceType: "M",
                        ysnSave: 1,
                        intQLCategoryID: 0,
                        ysnPublishDetail: 1,
                        strAction: "qlCategorySave",
                        txtName: categoryName[i].value,
                        txtGroupViewList: 1
                      };

                      $.ajax({
                        type: "POST",
                        url: "https://" + document.location.hostname + "/Admin/graphiclinks.aspx",
                        data: data
                      }).done(function() {
                        window.location.reload();
                      });
                    }
                  }
                }
              } else if (window.location.pathname.toLowerCase() == "/admin/quicklinks.aspx") {
                document.getElementById("toolkit-block").style.display = "block";
                var categoryName = document.getElementsByName("category-Name");
                var categoryStatus = document.getElementsByName("category-Status");
                for (i = 0; i < categoryName.length; i++) {
                  for (i = 0; i < categoryStatus.length; i++) {
                    if (categoryStatus[i].value == "Draft") {
                      var data = {
                        lngResourceID: 43,
                        strResourceType: "M",
                        ysnSave: 1,
                        intQLCategoryID: 0,
                        strAction: "qlCategorySave",
                        txtName: categoryName[i].value,
                        txtGroupViewList: 1
                      };

                      $.ajax({
                        type: "POST",
                        url: "https://" + document.location.hostname + "/Admin/quicklinks.aspx",
                        data: data
                      }).done(function() {
                        window.location.reload();
                      });
                    } else if (categoryStatus[i].value == "Published") {
                      var data = {
                        lngResourceID: 43,
                        strResourceType: "M",
                        ysnSave: 1,
                        intQLCategoryID: 0,
                        ysnPublishDetail: 1,
                        strAction: "qlCategorySave",
                        txtName: categoryName[i].value,
                        txtGroupViewList: 1
                      };

                      $.ajax({
                        type: "POST",
                        url: "https://" + document.location.hostname + "/Admin/quicklinks.aspx",
                        data: data
                      }).done(function() {
                        window.location.reload();
                      });
                    }
                  }
                }
              } else {
                if ($('input[type="email"]')[0].value == "" || $('input[type="password"]')[0].value == "") {
                  alert("The requested resource requires your Username and Password below");
                  $('input[type="email"]')[0].focus();
                } else {
                  if (window.location.pathname.toLowerCase() == "/admin/formcenter") {
                    var module = "FormCenter";
                    document.getElementById("toolkit-block").style.display = "block";
                    chrome.storage.sync.get(["siteID"], function(result) {
                      var siteIdVal = JSON.stringify(result);
                      var siteID = JSON.parse(siteIdVal);
                      var partition = siteID.siteID;

                      chrome.storage.sync.get(["apiKey"], function(result) {
                        var apiKeyVal = JSON.stringify(result);
                        var key = JSON.parse(apiKeyVal);
                        var apiKey = key.apiKey;
                        // Run API to Post
                        try {
                          var username = document.getElementById("uname").value;
                          var password = document.getElementById("psw").value;

                          var tokenData = {
                            Username: username,
                            Password: password
                          };
                          $.ajax({
                            type: "POST",
                            url: "https://" + document.location.hostname + "/api/Authentication/v1/Authenticate",
                            beforeSend: function(request) {
                              request.setRequestHeader("partition", partition);
                              request.setRequestHeader("apiKey", apiKey);
                            },
                            data: tokenData
                          }).done(function(userToken) {
                            var userApiKey = userToken.APIKey;
                            console.log("User token: " + userApiKey);
                            // POST category to Calendar
                            var categoryName = document.getElementsByName("category-Name");
                            var categoryStatus = document.getElementsByName("category-Status");

                            var i;
                            for (i = 0; i < categoryName.length; i++) {
                              for (i = 0; i < categoryStatus.length; i++) {
                                var data = {
                                  Name: categoryName[i].value,
                                  Status: categoryStatus[i].value
                                };

                                $.ajax({
                                  type: "POST",
                                  url: "https://" + document.location.hostname + "/api/" + module + "/v1/Category",
                                  beforeSend: function(request) {
                                    request.setRequestHeader("partition", partition);
                                    request.setRequestHeader("apiKey", apiKey);
                                    request.setRequestHeader("userApiKey", userApiKey);
                                  },
                                  data: data
                                }).done(function(userToken) {
                                  document.getElementById("cp-MultipleCategoryUpload").style.display = "none";
                                  document.getElementById("toolkit-block").style.display = "none";
                                  document.getElementById("runAPI").style.display = "none";
                                  document.getElementById("apiLogin").style.display = "none";
                                  document.getElementById("runAPI").style.display = "none";
                                  document.getElementById("apiLogin").style.display = "none";
                                });
                              }
                            }
                          });
                        } catch (err) {
                          console.warn(err);
                        }
                      });
                    });
                  } else if (window.location.pathname.toLowerCase() == "/admin/civicalerts.aspx") {
                    var module = "NewsFlash";
                    document.getElementById("toolkit-block").style.display = "block";
                    chrome.storage.sync.get(["siteID"], function(result) {
                      var siteIdVal = JSON.stringify(result);
                      var siteID = JSON.parse(siteIdVal);
                      var partition = siteID.siteID;

                      chrome.storage.sync.get(["apiKey"], function(result) {
                        var apiKeyVal = JSON.stringify(result);
                        var key = JSON.parse(apiKeyVal);
                        var apiKey = key.apiKey;
                        // Run API to Post
                        try {
                          var username = document.getElementById("uname").value;
                          var password = document.getElementById("psw").value;

                          var tokenData = {
                            Username: username,
                            Password: password
                          };
                          $.ajax({
                            type: "POST",
                            url: "https://" + document.location.hostname + "/api/Authentication/v1/Authenticate",
                            beforeSend: function(request) {
                              request.setRequestHeader("partition", partition);
                              request.setRequestHeader("apiKey", apiKey);
                            },
                            data: tokenData
                          }).done(function(userToken) {
                            var userApiKey = userToken.APIKey;
                            console.log("User token: " + userApiKey);
                            // POST category to Calendar
                            var categoryName = document.getElementsByName("category-Name");
                            var categoryStatus = document.getElementsByName("category-Status");

                            var i;
                            for (i = 0; i < categoryName.length; i++) {
                              for (i = 0; i < categoryStatus.length; i++) {
                                var data = {
                                  Name: categoryName[i].value,
                                  Status: categoryStatus[i].value
                                };

                                $.ajax({
                                  type: "POST",
                                  url: "https://" + document.location.hostname + "/api/" + module + "/v1/Category",
                                  beforeSend: function(request) {
                                    request.setRequestHeader("partition", partition);
                                    request.setRequestHeader("apiKey", apiKey);
                                    request.setRequestHeader("userApiKey", userApiKey);
                                  },
                                  data: data
                                }).done(function(userToken) {
                                  document.getElementById("cp-MultipleCategoryUpload").style.display = "none";
                                  document.getElementById("toolkit-block").style.display = "none";
                                  document.getElementById("runAPI").style.display = "none";
                                  document.getElementById("apiLogin").style.display = "none";
                                });
                              }
                            }
                          });
                        } catch (err) {
                          console.warn(err);
                        }
                      });
                    });
                  } else if (window.location.pathname.toLowerCase() == "/admin/calendar.aspx") {
                    var module = "Calendar";
                    document.getElementById("toolkit-block").style.display = "block";
                    chrome.storage.sync.get(["siteID"], function(result) {
                      var siteIdVal = JSON.stringify(result);
                      var siteID = JSON.parse(siteIdVal);
                      var partition = siteID.siteID;

                      chrome.storage.sync.get(["apiKey"], function(result) {
                        var apiKeyVal = JSON.stringify(result);
                        var key = JSON.parse(apiKeyVal);
                        var apiKey = key.apiKey;
                        // Run API to Post
                        try {
                          var username = document.getElementById("uname").value;
                          var password = document.getElementById("psw").value;

                          var tokenData = {
                            Username: username,
                            Password: password
                          };
                          $.ajax({
                            type: "POST",
                            url: "https://" + document.location.hostname + "/api/Authentication/v1/Authenticate",
                            beforeSend: function(request) {
                              request.setRequestHeader("partition", partition);
                              request.setRequestHeader("apiKey", apiKey);
                            },
                            data: tokenData
                          }).done(function(userToken) {
                            var userApiKey = userToken.APIKey;
                            console.log("User token: " + userApiKey);
                            // POST category to Calendar
                            var categoryName = document.getElementsByName("category-Name");
                            var categoryStatus = document.getElementsByName("category-Status");

                            var i;
                            for (i = 0; i < categoryName.length; i++) {
                              for (i = 0; i < categoryStatus.length; i++) {
                                var data = {
                                  Name: categoryName[i].value,
                                  Status: categoryStatus[i].value
                                };

                                $.ajax({
                                  type: "POST",
                                  url: "https://" + document.location.hostname + "/api/" + module + "/v1/Category",
                                  beforeSend: function(request) {
                                    request.setRequestHeader("partition", partition);
                                    request.setRequestHeader("apiKey", apiKey);
                                    request.setRequestHeader("userApiKey", userApiKey);
                                  },
                                  data: data
                                }).done(function(userToken) {
                                  document.getElementById("cp-MultipleCategoryUpload").style.display = "none";
                                  document.getElementById("toolkit-block").style.display = "none";
                                  document.getElementById("runAPI").style.display = "none";
                                  document.getElementById("apiLogin").style.display = "none";
                                });
                              }
                            }
                          });
                        } catch (err) {
                          console.warn(err);
                        }
                      });
                    });
                  }
                }
              }
            });
          }
          // Create Button + Assign Handler

          if (window.location.href == "https://cp-support.civicplus.com/Admin/Calendar.aspx") {
            if (document.getElementById("btnCalendarBack")) {
              document.getElementById("btnCalendarBack").click();
            }
          }

          if ($("a:contains('Add Category')").length && window.location.pathname.toLowerCase() == "/admin/formcenter") {
            appendCode();
            var uploadMultiple = $(
              "<li><a href='#CPToolbox' class='button bigButton nextAction cp-button'><span>Add Multiple Categories</span></a></li>"
            );
            var thisButtonSection = $("a:contains('Add Category')")
              .parents()
              .eq(2)[0];
            thisButtonSection.prepend(uploadMultiple[0]);
            uploadMultiple.click(function() {
              document.getElementById("cp-MultipleCategoryUpload").style.display = "block";
              document.getElementById("apiLogin").style.display = "block";
              document.getElementById("runAPI").style.display = "block";
              var fields = $("#cp-MultipleCategoryUpload-Content .calendar-section input");
              var i;
              for (i = 0; i < fields.length; i++) {
                fields[i].value = "";
              }
            });
          } else if (
            $("input[value*='Add Category']").length &&
            window.location.pathname.toLowerCase() == "/admin/civicalerts.aspx"
          ) {
            appendCode();
            var uploadMultiple = $(
              '<input type="button" class="cp-button" value="Add Multiple Categories" style="margin-left: 5px;">'
            );
            var thisButtonSection = $("input[value*='Add Category']");
            thisButtonSection.after(uploadMultiple[0]);
            uploadMultiple.click(function() {
              document.getElementById("cp-MultipleCategoryUpload").style.display = "block";
              document.getElementById("apiLogin").style.display = "block";
              document.getElementById("runAPI").style.display = "block";
              var fields = $("#cp-MultipleCategoryUpload-Content .calendar-section input");
              var i;
              for (i = 0; i < fields.length; i++) {
                fields[i].value = "";
              }
            });
          } else if (
            $("a:contains('Add Calendar')").length &&
            window.location.pathname.toLowerCase() == "/admin/calendar.aspx"
          ) {
            appendCode();
            if (window.location.href.indexOf("CID=") > -1) {
            } else {
              var uploadMultiple = $(
                "<li><a href='#CPToolbox' class='button bigButton nextAction cp-button'><span>Add Multiple Calendars</span></a></li>"
              );
              var thisButtonSection = $("a:contains('Add Calendar')")
                .parents()
                .eq(2)[0];
              thisButtonSection.prepend(uploadMultiple[0]);
              uploadMultiple.click(function() {
                document.getElementById("cp-MultipleCategoryUpload").style.display = "block";
                document.getElementById("apiLogin").style.display = "block";
                document.getElementById("runAPI").style.display = "block";
                var fields = $("#cp-MultipleCategoryUpload-Content .calendar-section input");
                var i;
                for (i = 0; i < fields.length; i++) {
                  fields[i].value = "";
                }
              });
            }
          } else if (
            $("input[value*='Add Category']").length &&
            (window.location.pathname.toLowerCase() == "/admin/infoii.aspx" ||
              window.location.pathname.toLowerCase() == "/admin/graphiclinks.aspx" ||
              window.location.pathname.toLowerCase() == "/admin/quicklinks.aspx")
          ) {
            appendCode();
            var uploadMultiple = $(
              '<input type="button" class="cp-button" value="Add Multiple Categories" style="margin-left: 5px;">'
            );
            var thisButtonSection = $("input[value*='Add Category']");
            thisButtonSection.after(uploadMultiple[0]);
            uploadMultiple.click(function() {
              document.getElementById("runAPI").style.bottom = "88px";
              document.getElementById("cp-MultipleCategoryUpload").style.display = "block";
              document.getElementById("apiLogin").style.display = "none";
              document.getElementById("runAPI").style.display = "block";
              var fields = $("#cp-MultipleCategoryUpload-Content .calendar-section input");
              var i;
              for (i = 0; i < fields.length; i++) {
                fields[i].value = "";
              }
            });
          }
        } catch (err) {
          console.warn(err);
        }
      }
    });
  });
})();
