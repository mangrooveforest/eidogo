/**
 * Simple HTML Nav tree constructor.
 *
 * @param navTreeContainer {DOMElement} The container.
 * @param gameCursor The game cursor
 * @param callbacks The callbacks.
 * @param callbacks.onHtmlTreeNode
 * @param callbacks.beforeShowNavTreeCurrent
 * @returns
 */
eidogo.HtmlNavTree = function (navTreeContainer, gameCursor, callbacks) {
  this.init(navTreeContainer, gameCursor, callbacks);
};

eidogo.HtmlNavTree.prototype = {

  /**
   * The container.
   * @type jQuery.
   */
  $navTreeContainer: null,

  /**
   * Called before the nav tree shows the current movement.
   * @type Function
   */
  beforeShowNavTreeCurrent: null,

  onClick: null,

  /**
   * If false, then the tree needs to be updated.
   */
  updatedNavTree: null,

  /**
   * Timeout Id.
   */
  navTreeTimeout: null,

  /**
   * Game Cursor.
   */
  cursor: null,

  prevNavTreeCurrent: null,

  prevNavTreeCurrentClass: null,

  /**
   * Constructor
   * @param navTreeContainer {DOMElement} The container.
   * @param gameCursor The game cursor
   * @param callbacks The callbacks.
   * @param callbacks.onHtmlTreeNode
   * @param callbacks.beforeShowNavTreeCurrent
   * @returns
   */
  init: function (navTreeContainer, gameCursor, callbacks) {
    this.$navTreeContainer = $(navTreeContainer);
    this.cursor = gameCursor;

    if (callbacks) {
      if (typeof callbacks.beforeShowNavTreeCurrent === "function") {
        this.beforeShowNavTreeCurrent = callbacks.beforeShowNavTreeCurrent;
      }
      if (typeof callbacks.onClick === "function") {
        this.onClick = callbacks.onClick;
      }
    }

    this.$navTreeContainer.click($.proxy(this._onNavTreeClick, this));
  },

  /**
   * Schedules the nav tree to be updated.
   * @returns
   */
  scheduleToUpdate: function () {
    this.updatedNavTree = false;
  },

  /**
   * Sets the game cursor.
   * @param cursor
   * @returns
   */
  setCursor: function (cursor) {
    this.cursor = cursor;
  },

  /**
   * Shows the nav tree.
   */
  show: function () {
    this.$navTreeContainer.show();
  },

  /**
   * Hides the nav tree.
   */
  hide: function () {
    this.$navTreeContainer.hide();
  },

  /**
   * Construct a navigation tree from scratch, assuming it hasn't been done
   * already and no unsaved additions have been made.
   *
   * We do this in two passes:
   *    1) Construct a 2D array, navGrid, containing all nodes and where
   *       to display them horizontally and vertically (adjustments are
   *       made to avoid overlapping lines of play)
   *    2) Based on navGrid, construct an HTML table to actually display
   *       the nav tree
   *
   * We use a timeout to limit how often the intense calculations happen,
   * and to provide a more responsive UI.
  **/
  updateNavTree: function(update) {
      if (this.updatedNavTree) {
          this._showNavTreeCurrent();
          return;
      }
      // Reconstruct the nav tree a max of once per second (if multiple
      // moves are played quickly in a row, it will wait until one second
      // after the last one is played). The timeout also has the benefit
      // of updating the rest of the UI first, so it seems more responsive.
      if (!update) {
          if (this.navTreeTimeout)
              clearTimeout(this.navTreeTimeout);
          this.navTreeTimeout = setTimeout(function() {
              this.updateNavTree(true);
          }.bind(this), eidogo.browser.ie ? 1000 : 500);
          return;
      }
      this.updatedNavTree = true;
      // Construct 2D nav grid
      var navGrid = [],
          gameRoot = this.cursor.getGameRoot();
          path = [gameRoot.getPosition()],
          cur = new eidogo.GameCursor(),
          maxx = 0;
      var traverse = function(node, startx, starty) {
          var y = starty, x = startx;
          var n = node, width = 1;
          while (n && n._children.length == 1) {
              width++;
              n = n._children[0];
          }
          // If we'll overlap any future moves, skip down a row
          while (navGrid[y] && navGrid[y].slice(x).some(function(el) {
              return (typeof el != "undefined");
          })) {
              y++;
          }
          do {   
              if (!navGrid[y])
                  navGrid[y] = [];
              cur.node = node;
              node._pathStr = path.join('-') + "-" + (x - startx);
              navGrid[y][x] = node;
              if (x > maxx)
                  maxx = x;
              x++;
              if (node._children.length != 1) break;
              node = node._children[0];
          } while (node);
          for (var i = 0; i < node._children.length; i++) {
              path.push(i);
              traverse(node._children[i], x, y);
              path.pop();
          }
      };

      traverse(gameRoot, 0, 0);
      // Construct HTML
      var html = ["<div id='nav-tree' class='nav-tree'>",
                  "<table class='nav-tree'>"],
          node, td, cur = new eidogo.GameCursor(),
          x, y, showLine,
          ELBOW = 1, LINE = 2, FORK = 3;
      for (x = 0; x < maxx; x++) {
          showLine = false;
          for (y = navGrid.length - 1; y > 0; y--) {
              if (!navGrid[y][x]) {
                  if (typeof navGrid[y][x + 1] == "object") {
                      navGrid[y][x] = ELBOW;
                      showLine = true;
                      if (y < navGrid.length - 1
                          && ( navGrid[y + 1][x] === LINE
                          || navGrid[y + 1][x] === ELBOW
                          || navGrid[y + 1][x] === FORK)) {
                        navGrid[y][x] = FORK;
                      }
                  } else if (showLine) {
                      navGrid[y][x] = LINE;
                  }
              } else {
                  showLine = false;
              }
          }    
      }
      for (y = 0; y < navGrid.length; y++) {
          html.push("<tr>");
          for (x = 0; x < navGrid[y].length; x++) {
              node = navGrid[y][x];
              if (node == ELBOW) {
                  td = "<td class='elbow'></td>";
              } else if (node == FORK) {
                  td = "<td class='fork'></td>";
              } else if (node == LINE) {
                  td = "<td class='line'></td>";
              } else if (node) {
                  td = ["<td class='stone'>",
                        "<a href='#' id='navtree-node-",
                        node._pathStr,
                        "' class='",
                        (typeof node.W != "undefined" ? 'w' :
                        (typeof node.B != "undefined" ? 'b' :
                        node.getOwnColorByChildrens())),
                        "'>",
                        //x,
                        "</a>",
                        "</td>"].join("");
              } else {
                  td = "<td class='empty'></td>";
              }

              /**
               * Searches for all the real node objects that immediatly
               * follow this one on of the tree, and return them.
               */
              var searchRealNodes = function(x, y) {
                if (navGrid[y][x] == ELBOW) {
                  return [navGrid[y][x+1]];

                } else if (navGrid[y][x] == FORK) {
                  var nodes = [navGrid[y][x+1]];
                  return nodes.concat(searchRealNodes(x, y+1));

                } else if (navGrid[y][x] == LINE) {
                  return searchRealNodes(x, y+1);

                } else if (navGrid[y][x]) {
                  // A stone.
                  return [navGrid[y][x]];
                } else {
                  return [];
                }
              };
              td = this._addMetadataToTreeNode({
                htmlTreeNode : td,
                nodes : searchRealNodes(x, y)
              });

              html.push(td);
          }
          html.push("</tr>");
      }
      html.push("</table>");
      html.push("</div>");
      this.$navTreeContainer.html(html.join(""));
      setTimeout(function() {
          this._showNavTreeCurrent();
      }.bind(this), 0);
  },

  /*---------- PRIVATE METHODS ----------------------------*/

  /**
   * Called when the user clicks on the nav tree.
   */
  _onNavTreeClick: function(event) {
    if (this.onClick) {
      var target = event.target || event.srcElement;
      if (!target || !target.id) return;
      var path = target.id.replace(/^navtree-node-/, "").split("-");
      // FIXME: if the path is invalid (the user clicks in a part of the nav
      // tree that doesn't have a stone), then the method shouldn't be called.
      this.onClick(path);
    }

    return false;
  },

  _showNavTreeCurrent: function() {
    var id = "navtree-node-" + this.cursor.getPath().join("-"),
        current = eidogo.util.byId(id);// FIXME
    if (!current) return;

    if (this.beforeShowNavTreeCurrent) {
      this.beforeShowNavTreeCurrent();
    }
    
    // Highlight node
    if (this.prevNavTreeCurrent) {
        this.prevNavTreeCurrent.className = this.prevNavTreeCurrentClass;
    }
    this.prevNavTreeCurrent = current;
    this.prevNavTreeCurrentClass = current.className;
    $(current).addClass("current");
    // Scroll into view if necessary
    var w = $(current).outerWidth(),
        h = $(current).outerHeight(),
        xy = eidogo.util.getElXY(current),
        navxy = eidogo.util.getElXY(this.$navTreeContainer
            .children(".nav-tree").get(0)),
        l = xy[0] - navxy[0],
        t = xy[1] - navxy[1],
        // ntc stands for nav tree container.
        ntc = this.$navTreeContainer.get(0),
        maxl = ntc.scrollLeft,
        maxr = maxl + $(ntc).outerWidth() - 100;
        maxt = ntc.scrollTop,
        maxb = maxt + $(ntc).outerHeight() - 30;
    if (l < maxl)
        ntc.scrollLeft -= (maxl - l);
    if (l + w > maxr)
        ntc.scrollLeft += ((l + w) - maxr);
    if (t < maxt)
        ntc.scrollTop -= (maxt - t);
    if (t + h > maxb)
        ntc.scrollTop += ((t + h) - maxb);
  },

  /**
   * Adds all the metadata to a tree node.
   */
  _addMetadataToTreeNode : function (params) {
    if (params.nodes && params.nodes.length > 0) {
      var $treeNode = $(params.htmlTreeNode);

      var classes = [];
      if (params.nodes[0].success) {
        classes.push('success');
      }
      if (params.nodes[0].commentType) {
        classes.push("comment-" + params.nodes[0].commentType);
      }
      if (params.nodes.length > 1) {
        // its a fork!
        var success = false;
        var addCommentClass = true;
        for (var i=1, len = params.nodes.length; i<len; i++) {
          if (!success && params.nodes[i].success) {
            success=true;
          }
          if (addCommentClass && !params.nodes[i].commentType) {
          // if some of the son nodes doesn't have a comment, then don't use the
          // commented class.
            addCommentClass = false;
          }
        }
        if (success) {
          classes.push('fork-success');
        }
        if (addCommentClass && params.nodes[1].commentType) {
          classes.push("comment-fork-" + params.nodes[1].commentType);
        }
      }

      if($treeNode.hasClass('stone')) {
        // mark commented stones.
        if (params.nodes[0].C) {
          var $htmlStone = $treeNode.children().addClass("with-comment");
        }
      }

      $treeNode.addClass(classes.join(" "));

      return $('<div>').append($treeNode.clone()).remove().html();
    }
    return params.htmlTreeNode;
  }
};
