// XMLMajorChangeAlert.js
// Version: fixed for loader (exports init, idempotent, safe DOM handling)

(function () {
  'use strict';

  var NAMESPACE = 'XMLMajorChangeAlert';
  var GUARD = '__CP_' + NAMESPACE + '_LOADED_v1';

  if (window[GUARD]) return;
  window[NAMESPACE] = window[NAMESPACE] || { __loaded: false };

  function waitFor(conditionFn, timeoutMs, intervalMs) {
    timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 5000;
    intervalMs = typeof intervalMs === 'number' ? intervalMs : 100;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (conditionFn()) return resolve(true);
        } catch (e) {
          // ignore
        }
        if (Date.now() - start >= timeoutMs) return resolve(false);
        setTimeout(check, intervalMs);
      })();
    });
  }

  function parseXmlToDoc(xmlString) {
    try {
      return new DOMParser().parseFromString(xmlString, 'text/xml');
    } catch (e) {
      return null;
    }
  }

  function extractIdsFromXml(xmlString) {
    try {
      var doc = parseXmlToDoc(xmlString || '');
      if (!doc) return [];
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('*'));
      var ids = nodes.map(function (n) {
        try { return n.getAttribute && n.getAttribute('id'); } catch (e) { return null; }
      }).filter(Boolean);
      return ids;
    } catch (e) {
      return [];
    }
  }

  function extractContentContainers(xmlString) {
    try {
      var doc = parseXmlToDoc(xmlString || '');
      if (!doc) return [];
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('[cpRole="contentContainer"]'));
      return nodes.map(function (n) {
        try {
          return { id: n.getAttribute('id') || '', childCount: n.children ? n.children.length : 0 };
        } catch (e) {
          return { id: '', childCount: 0 };
        }
      });
    } catch (e) {
      return [];
    }
  }

  function ensureAlertContainerJQ() {
    try {
      if (window.jQuery) {
        var $ = window.jQuery;
        var $parent = $('#structureFile').parent();
        if ($parent && $parent.length) {
          if ($('#toolkitAlert').length === 0) {
            $parent.append('<div id="toolkitAlert" style="margin:6px 0;font-size:13px"></div>');
          }
          return $('#toolkitAlert');
        }
      }
    } catch (e) {
      // fallthrough to DOM fallback
    }
    // DOM fallback
    try {
      var el = document.getElementById('toolkitAlert');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toolkitAlert';
        el.style.margin = '6px 0';
        el.style.fontSize = '13px';
        try {
          (document.body || document.documentElement).insertBefore(el, (document.body || document.documentElement).firstChild);
        } catch (err) {
          // ignore insertion error
        }
      }
      return window.jQuery ? window.jQuery(el) : null;
    } catch (e) {
      return null;
    }
  }

  function init() {
    if (window[GUARD]) return;
    window[GUARD] = true;
    window[NAMESPACE].__loaded = true;

    // quick page check – only run on layouts modify pages
    try {
      var path = (window.location.pathname || '').toLowerCase();
      if (path.indexOf('/admin/designcenter/layouts') === -1) return;
    } catch (e) {
      return;
    }

    // If loader exposes detection, prefer it but continue if absent
    (function startIfCivicPlus() {
      try {
        if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
          Promise.resolve(window.CPToolkit.isCivicPlusSite()).then(function (ok) {
            if (ok) runSetup();
          }).catch(function () {
            runSetup();
          });
        } else {
          runSetup();
        }
      } catch (e) {
        runSetup();
      }
    })();

    function runSetup() {
      waitFor(function () { return !!window.jQuery && document.readyState !== 'loading'; }, 6000, 100)
        .then(function (hasJQ) {
          if (!hasJQ) return;
          var $ = window.jQuery;

          try {
            $(function () {
              var $alert = ensureAlertContainerJQ();
              var originalXmlRaw = ($('code').first().text() || '').trim();
              var originalIds = extractIdsFromXml(originalXmlRaw).sort();

              // check original content containers for malformed children
              try {
                var origContainers = extractContentContainers(originalXmlRaw);
                (origContainers || []).forEach(function (c) {
                  try {
                    if (c && c.childCount && c.childCount > 0) {
                      alert('The current XML is malformed:\n\n' + c.id + ' is a content container that contains additional elements. Content containers should not contain any elements. Please change this to a structural container or remove those elements. This may cause issues when saving the theme.');
                    }
                  } catch (inner) {
                    // ignore per-container errors
                  }
                });
              } catch (e) {
                console.error('[XMLMajorChangeAlert] original container check failed', e);
              }

              // show ErrorMessage contents as alerts
              try {
                $('#ErrorMessage').off('.XMLMajorChangeAlert').on('DOMSubtreeModified.XMLMajorChangeAlert', function () {
                  try {
                    var t = $(this).text().trim();
                    if (t) alert(t);
                  } catch (err) { /* ignore */ }
                });
              } catch (e) {
                console.error('[XMLMajorChangeAlert] ErrorMessage binding failed', e);
              }

              // best-effort DOM rearrangements (non-fatal)
              try {
                var $mainMenuBreakpoint = $('#mainMenuBreakpoint');
                if ($mainMenuBreakpoint && $mainMenuBreakpoint.length) {
                  var $li = $mainMenuBreakpoint.parents('li.left').first();
                  if ($li && $li.length) $('ol.cpForm > li.left:nth-child(4)').after($li);
                }
                var $err = $('#ErrorMessage');
                if ($err && $err.length) {
                  var $errLi = $err.parents('li.left').first();
                  if ($errLi && $errLi.length) $('ol.cpForm > li.left:nth-child(5)').after($errLi);
                }
              } catch (e) {
                // ignore layout adjustments
              }

              // Add "View Layout Page" button
              try {
                var layoutName = ($('#txtStructureName').val() || '').toString();
                if (layoutName) {
                  var pagesUrl = '/Pages/LayoutPage/?name=' + encodeURIComponent(layoutName);
                  var $pagesLink = $("<li><a class='button bigButton nextAction' href='" + pagesUrl + "' target='_blank'><span>View Layout Page</span></a></li>");
                  $('.buttons li a.save').parent('li').after($pagesLink);
                }
              } catch (e) { /* ignore */ }

              // auto-save title helper
              try {
                $('#autoSaveThemeStyles').attr('title', 'Rebuilds the CSS for all themes that use this layout.');
              } catch (e) { /* ignore */ }

              // File change handling: read file, compare ids, show warnings
              try {
                $('#structureFile').off('.XMLMajorChangeAlert').on('change.XMLMajorChangeAlert', function () {
                  try {
                    var file = this.files && this.files[0];
                    if (!file) {
                      try { if ($alert) $alert.text(''); } catch (e) { /* ignore */ }
                      return;
                    }

                    var reader = new FileReader();
                    reader.onload = function (ev) {
                      try {
                        var data = ev && ev.target && ev.target.result ? ev.target.result : '';
                        var idx = data.indexOf('<?xml');
                        var newXml = idx >= 0 ? data.slice(idx) : data;

                        var newIds = extractIdsFromXml(newXml).sort();
                        var removed = originalIds.filter(function (id) { return newIds.indexOf(id) < 0; });

                        if (removed && removed.length) {
                          try {
                            var diffText = removed.join(', ');
                            if ($alert) {
                              $alert.html('Warning: There are containers in the old XML that are not in the new XML. This will cause any widgets or styles applied to the following to be lost:<br><br>' + diffText)
                                .css('color', 'red');
                            }
                            $('a.button.save').css('background-color', '#B33A3A').css('border-bottom-color', '#792327').css('color', '#fff');
                            $('a.button.save span').text('Save ignoring XML warning');
                          } catch (uiErr) {
                            // ignore UI update failures
                          }
                        } else {
                          try {
                            if ($alert) $alert.text('This XML has all the containers that the old XML had.').css('color', 'green');
                            $('a.button.save').css('background-color', '').css('border-bottom-color', '').css('color', '');
                            $('a.button.save span').text('Save');
                          } catch (uiErr2) {
                            // ignore
                          }
                        }

                        // validate new content containers for malformed children
                        try {
                          var newContainers = extractContentContainers(newXml);
                          (newContainers || []).forEach(function (c) {
                            try {
                              if (c && c.childCount && c.childCount > 0) {
                                alert('The chosen XML is malformed:\n\n' + c.id + ' is a content container that contains additional elements. Content containers should not contain any elements. Please change this to a structural container or remove those elements. This may cause unexpected issues when saving the theme.');
                              }
                            } catch (inner2) { /* ignore per-container errors */ }
                          });
                        } catch (validateErr) {
                          console.error('[XMLMajorChangeAlert] new container check failed', validateErr);
                        }

                      } catch (procErr) {
                        console.error('[XMLMajorChangeAlert] file processing error', procErr);
                      }
                    };
                    reader.readAsText(file);
                  } catch (fileErr) {
                    console.error('[XMLMajorChangeAlert] file read error', fileErr);
                  }
                });
              } catch (attachErr) {
                console.error('[XMLMajorChangeAlert] attach handler error', attachErr);
              }

            } catch (innerInitErr) {
              console.error('[XMLMajorChangeAlert] init inner error', innerInitErr);
            }
          });
        } catch (outerErr) {
          console.error('[XMLMajorChangeAlert] setup outer error', outerErr);
        }
      });
    } // end runSetup
  } // end init

  // expose for loader to call
  window.XMLMajorChangeAlert = window.XMLMajorChangeAlert || {};
  window.XMLMajorChangeAlert.init = init;

  // safe auto-run (idempotent)
  try { window.XMLMajorChangeAlert.init(); } catch (e) { console.error('[XMLMajorChangeAlert] autorun error', e); }

})();
