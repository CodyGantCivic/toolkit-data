// XMLMajorChangeAlert.js
// Version: 1.0.1
// Exports: window.XMLMajorChangeAlert.init()
// Purpose: Warn when importing XML will remove content containers and validate XML structure.
// Idempotent, waits for jQuery/DOM, auto-runs, errors go to console.error.

(function () {
  'use strict';

  var N = 'XMLMajorChangeAlert';
  var GUARD = '__CP_' + N + '_LOADED_v1';

  if (window[GUARD]) return;

  window.XMLMajorChangeAlert = window.XMLMajorChangeAlert || { __loaded: false };

  function waitFor(fn, timeout, interval) {
    timeout = typeof timeout === 'number' ? timeout : 5000;
    interval = typeof interval === 'number' ? interval : 100;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (fn()) return resolve(true);
        } catch (e) {
          // ignore
        }
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  function extractIdsFromXmlString(xmlString) {
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(xmlString, 'text/xml');
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('*'));
      var ids = [];
      nodes.forEach(function (n) {
        try {
          var id = n.getAttribute && n.getAttribute('id');
          if (id) ids.push(id);
        } catch (e) { /* ignore */ }
      });
      return ids;
    } catch (e) {
      return [];
    }
  }

  function extractContentContainerInfo(xmlString) {
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(xmlString, 'text/xml');
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('[cpRole="contentContainer"]'));
      return nodes.map(function (n) {
        return {
          id: n.getAttribute('id') || '',
          childCount: n.children ? n.children.length : 0
        };
      });
    } catch (e) {
      return [];
    }
  }

  function ensureAlertContainer() {
    var el = document.getElementById('toolkitAlert');
    if (!el) {
      try {
        var $ = window.jQuery;
        if ($) {
          var $parent = $('#structureFile').parent();
          if ($parent && $parent.length) {
            $parent.append('<div id="toolkitAlert" style="margin:6px 0;font-size:13px"></div>');
            el = document.getElementById('toolkitAlert');
          }
        }
      } catch (e) {
        // fallback
      }
      if (!el) {
        el = document.createElement('div');
        el.id = 'toolkitAlert';
        el.style.margin = '6px 0';
        el.style.fontSize = '13px';
        (document.body || document.documentElement).insertBefore(el, (document.body || document.documentElement).firstChild);
      }
    }
    return el;
  }

  function init() {
    if (window[GUARD]) return;
    window[GUARD] = true;
    window.XMLMajorChangeAlert.__loaded = true;

    (function run() {
      try {
        // only on Layout Modify page - accept multiple casings/variants
        var path = (window.location.pathname || '').toLowerCase();
        if (path.indexOf('/admin/designcenter/layouts') === -1) return;

        // If loader exposes civicplus detection, prefer it (but continue if not present)
        (function checkCPSiteAndContinue() {
          if (window.CPToolkit && typeof window.CPToolkit.isCivicPlusSite === 'function') {
            try {
              // call but don't block forever
              Promise.resolve(window.CPToolkit.isCivicPlusSite()).then(function (ok) {
                if (!ok) return;
                setup();
              }).catch(function () {
                // proceed anyway
                setup();
              });
            } catch (e) {
              setup();
            }
          } else {
            setup();
          }
        })();

        function setup() {
          waitFor(function () { return !!window.jQuery && document.readyState !== 'loading'; }, 6000, 100)
            .then(function (hasJQ) {
              if (!hasJQ) return;
              var $ = window.jQuery;

              $(function () {
                try {
                  var $alert = $(ensureAlertContainer());

                  // Original page XML snapshot (may be in <code> or similar)
                  var originalXmlRaw = ($('code').first().text() || '').trim();
                  var originalIds = extractIdsFromXmlString(originalXmlRaw);
                  originalIds = originalIds.sort();

                  // Check original for malformed content containers
                  try {
                    var origContainers = extractContentContainerInfo(originalXmlRaw || '');
                    origContainers.forEach(function (c) {
                      if (c.childCount && c.childCount > 0) {
                        // surface alert once
                        alert('The current XML is malformed:\n\n' + c.id + ' is a content container that contains additional elements. Content containers should not contain any elements. Please change this to a structural container or remove the following elements from this container.\n\nThis may cause unexpected issues when saving the theme.');
                      }
                    });
                  } catch (e) {
                    // ignore
                  }

                  // Error message -> popup behavior
                  try {
                    $('#ErrorMessage').off('.XMLMajorChangeAlert').on('DOMSubtreeModified.XMLMajorChangeAlert', function (e) {
                      try {
                        var text = $(this).text().trim();
                        if (text) alert(text);
                      } catch (err) { /* ignore */ }
                    });
                  } catch (e) {
                    // ignore
                  }

                  // Move breakpoint and error message up (best effort)
                  try {
                    var $mainMenuBreakpoint = $('#mainMenuBreakpoint');
                    if ($mainMenuBreakpoint && $mainMenuBreakpoint.length) {
                      var $li = $mainMenuBreakpoint.parents('li.left').first();
                      if ($li && $li.length) {
                        $('ol.cpForm > li.left:nth-child(4)').after($li);
                      }
                    }
                    var $err = $('#ErrorMessage');
                    if ($err && $err.length) {
                      var $errLi = $err.parents('li.left').first();
                      if ($errLi && $errLi.length) {
                        $('ol.cpForm > li.left:nth-child(5)').after($errLi);
                      }
                    }
                  } catch (e) { /* ignore */ }

                  // Add View Layout Page button (best-effort)
                  try {
                    var layoutName = ($('#txtStructureName').val() || '').toString();
                    if (layoutName) {
                      var pagesUrl = '/Pages/LayoutPage/?name=' + encodeURIComponent(layoutName);
                      var $pagesLink = $("<li><a class='button bigButton nextAction' href='" + pagesUrl + "' target='_blank'><span>View Layout Page</span></a></li>");
                      $('.buttons li a.save').parent('li').after($pagesLink);
                    }
                  } catch (e) { /* ignore */ }

                  // Add title to auto-save
                  try {
                    $('#autoSaveThemeStyles').attr('title', 'Rebuilds the CSS for all themes that use this layout.');
                  } catch (e) { /* ignore */ }

                  // File change handler
                  try {
                    $('#structureFile').off('.XMLMajorChangeAlert').on('change.XMLMajorChangeAlert', function () {
                      try {
                        var file = this.files && this.files[0];
                        if (!file) {
                          $('#toolkitAlert').text('');
                          return;
                        }
                        var reader = new FileReader();
                        reader.onload = function (ev) {
                          try {
                            var data = ev.target && ev.target.result ? ev.target.result : '';
                            // find xml start
                            var idx = data.indexOf('<?xml');
                            var newXml = idx >= 0 ? data.slice(idx) : data;

                            var newIds = extractIdsFromXmlString(newXml);
                            newIds = newIds.sort();

                            // compute removed ids (in original but not in new)
                            var removed = originalIds.filter(function (id) {
                              return newIds.indexOf(id) < 0;
                            });

                            if (removed && removed.length) {
                              var diffText = removed.join(', ');
                              $alert.html('Warning: There are containers in the old XML that are not in the new XML. This will cause any widgets or styles applied to the following to be lost:<br><br>' + diffText)
                                .css('color', 'red');

                              $('a.button.save').css('background-color', '#B33A3A').css('border-bottom-color', '#792327').css('color', '#fff');
                              $('a.button.save span').text('Save ignoring XML warning');
                            } else {
                              $alert.text('This XML has all the containers that the old XML had.').css('color', 'green');
                              $('a.button.save').css('background-color', '').css('border-bottom-color', '').css('color', '');
                              $('a.button.save span').text('Save');
                            }

                            // check malformed content containers in new xml
                            var newContainers = extractContentContainerInfo(newXml);
                            newContainers.forEach(function (c) {
                              if (c.childCount && c.childCount > 0) {
                                alert('The chosen XML is malformed:\n\n' + c.id + ' is a content container that contains additional elements. Content containers should not contain any elements. Please change this to a structural container or remove the following elements from this container.\n\nThis may cause unexpected issues when saving the theme.');
                              }
                            });

                          } catch (errInner) {
                            console.error('[XMLMajorChangeAlert] file processing error', errInner);
                          }
                        };
                        reader.readAsText(file);
                      } catch (errFile) {
                        console.error('[XMLMajorChangeAlert] file read error', errFile);
                      }
                    });
                  } catch (e) { console.error('[XMLMajorChangeAlert] attach handler error', e); }

                } catch (err) {
                  console.error('[XMLMajorChangeAlert] init inner error', err);
                }
              });
            });
        } // end setup
      }()); // end run
    } catch (e) {
      console.error('[XMLMajorChangeAlert] init failed', e);
    }
  }

  // expose init
  window.XMLMajorChangeAlert.init = init;

  // auto-run
  try { window.XMLMajorChangeAlert.init(); } catch (e) { console.error('[XMLMajorChangeAlert] autorun error', e); }

})();
