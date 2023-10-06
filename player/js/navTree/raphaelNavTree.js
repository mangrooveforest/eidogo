/**
 * Raphael Nav tree constructor.
 *
 * @param navTreeContainer {DOMElement} The container.
 * @param gameCursor The game cursor
 * @param callbacks The callbacks.
 * @param callbacks.onHtmlTreeNode
 * @param callbacks.beforeShowNavTreeCurrent
 * @param callbacks.onTargetLeafChange
 * @returns
 */
eidogo.RaphaelNavTree = function (navTreeContainer, gameCursor, callbacks,
    options) {
  this.init(navTreeContainer, gameCursor, callbacks, options);
};

eidogo.RaphaelNavTree.prototype = {

  /**
   * TODAVIA NO SE BIEN Q ES.
   * FIXME this comment.
   */
  PIXEL_WIDTH: 32,

  /**
   * The radius of a stone.
   */
  STONE_RADIUS: 9,

  COMMENT_COLORS: {
    correct: "#588C52",
    wrong: "#c8856e",
    question: "#28a1af",
    comment: "#665544"
  },

  ACTIVE_STROKE: {
    "stroke-width": 4,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  },
  INACTIVE_STROKE: {
    "stroke-width": 1,
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  },
  OFF_PATH_STROKE_ACTIVE: {
    "stroke-width": 4,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-miterlimit": 1,
    "stroke-dasharray": "-"
  },
  OFF_PATH_STROKE_INACTIVE: {
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "stroke-miterlimit": 1,
    "stroke-dasharray": "-"
  },
  COMMENT_STROKE_ACTIVE: {
    "stroke-width": 3,
    "stroke-linecap": "square",
    "stroke-linejoin": "round",
    "stroke-miterlimit": 1,
    "stroke-dasharray": "-"
  },
  COMMENT_STROKE_INACTIVE: {
    "stroke-width": 2,
    "stroke-linecap": "square",
    "stroke-linejoin": "round",
    "stroke-miterlimit": 1,
    "stroke-dasharray": "-"
  },

  /**
   * Gradient fill for the stones.
   */
  STONE_FILL : {
    black : "r(0.3, 0.3)#777-#444:30-#111",
    white : "r(0.47, 0.89)#FFF:70-#DDD:90-#777"
  },

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

  /**
   * Method to be called when the user clicks on a stone.
   * It expects the path to the stone.
   * @type function
   */
  onClick: null,

  /**
   * Called when the target leaf changes. It passes the new target leaf.
   * @type function
   */
  onTargetLeafChange: null,

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
   * @type eidogo.GameCursor
   */
  cursor: null,

  /**
   * The x and y boundaries of the draw.
   */
  _boundaries: null,

  /**
   * The color of the path.
   * @type String.
   */
  _pathColor: null,

  /**
   * The stroke of the path.
   * @type String.
   */
  _pathStroke: null,

  /**
   * The stone with focus.
   * @type Object
   */
  _focusPoint: null,

  /**
   * True if the user wants to show the isomorphic lines.
   * @type Boolean
   */
  _showIsoLines: null,

  /**
   * The target leaf for the active path.
   */
  _targetLeaf: null,

  /**
   * The list of SVG Raphael elements corresponding to the lines.
   */
  _lines: null,

  /**
   * The list of SVG Raphael elements corresponding to the active lines.
   */
  _activeLines: null,

  /**
   * The list of SVG Raphael elements corresponding to the stones.
   */
  _stones: null,

  /**
   * Constructor
   * @param navTreeContainer {DOMElement} The container.
   * @param gameCursor The game cursor
   * @param callbacks The callbacks.
   * @param callbacks.onHtmlTreeNode
   * @param callbacks.beforeShowNavTreeCurrent
   * @returns
   */
  init: function (navTreeContainer, gameCursor, callbacks, options) {
    this._lines = [];
    this._stones = [];
    this._activeLines = [];

    this.$navTreeContainer = $(navTreeContainer);
    this.cursor = gameCursor;

    var showIsoLines;
    if (callbacks) {
      if (typeof callbacks.beforeShowNavTreeCurrent === "function") {
        this.beforeShowNavTreeCurrent = callbacks.beforeShowNavTreeCurrent;
      }
      if (typeof callbacks.onClick === "function") {
        this.onClick = callbacks.onClick;
      }
      // The user may have decided not to send the callbacks, but send the
      // options.
      showIsoLines = callbacks.showIsoLines;
      if (typeof callbacks.onTargetLeafChange === "function") {
        this.onTargetLeafChange = callbacks.onTargetLeafChange;
      }
    }
    if (options) {
      showIsoLines = options.showIsoLines;
    }

    this._showIsoLines = showIsoLines? true : false;

    this._boundaries = {};
    this._resetCanvas();
    this._listenToKeyboardEvents();
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
    this._scrollToCurrentStone();
  },

  /**
   * Hides the nav tree.
   */
  hide: function () {
    this.$navTreeContainer.hide();
  },

  isVisible: function () {
    return this.$navTreeContainer.is(":visible");
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
  updateNavTree: function() {
    this._lines = [];
    this._stones = [];
    this._activeLines = [];

    var root = this.cursor.getGameRoot();
    if (!root) {
      // return if the game is not loaded yet.
      return;
    }

    if (this.beforeShowNavTreeCurrent) {
      this.beforeShowNavTreeCurrent();
    }

    this._resetCanvas();
    // Apply to all games.
    var rootLeafs = root.getLeafs();
    for (var j=0, len2=rootLeafs.length; j<len2; j++) {
      rootLeafs[j].walkUp(function(node) {
        delete node.onChosenPath;
        if (!node.depth.ySetted) {
          node.depth.y = j;
          node.depth.ySetted = true;
          return true;
        } else {
          return false;
        }
      });
    }

    // If target leaf is null or it's not in the same path as the current node,
    // then we should reset it to the first leaf.
    if (this._targetLeaf == null
        || !this.cursor.node.onSamePath(this._targetLeaf)) {
      if (this.cursor.node.getChildren().length > 0) {
        var currentNodeLeafs = this.cursor.node.getLeafs();
        this._setTargetLeaf(currentNodeLeafs[0]);
      } else {
        this._setTargetLeaf(this.cursor.node);
      }
    }
    // mark nodes that are on the chosen path.
    this._targetLeaf.walkUp(function(node) {
      node.onChosenPath = true;
      return true;
    });
    this._drawTargetLeaf();

    // draw the nav tree.
    root.walk($.proxy(this._drawNavTree, this));

    for (var i=0,len=this._lines.length; i<len; i++) {
      var isSuccessPath = this._lines[i].data("isSuccessPath");
      if (isSuccessPath) {
        this._lines[i].toFront();
      }
    }

    for (i=0,len=this._activeLines.length; i<len; i++) {
      this._activeLines[i].toFront();
    }

    for (i=0,len=this._stones.length; i<len; i++) {
      this._stones[i].toFront();
    }

    // I do this in another walk because I need them to be in front of the
    // stones.
    if (this._showIsoLines) {
      root.walk($.proxy(this._drawIsoLines, this));
    }

    this._drawBackground();
    this._resizeCanvas(this._boundaries.x, this._boundaries.y);

    this._scrollToCurrentStone();
  },

  /**
   * Sets the max-width css property on the container, so that the width
   * of the navigation tree reaches the end of the eidogo-player container.
   * FIXME: Strictly speaking, this method should be in player.js, instead
   * of raphaelNavTree.js, but player.js is already to bloated with unused
   * methods, it really needs a big clean up.
   * Matias Niklison, Feb 23, 2012.
   */
  setNavTreeMaxWidth : function () {
    var navTreeContainerId = "#" + this.$navTreeContainer.attr("id");
    var $player = this.$navTreeContainer.parents(".eidogo-player");
    var $columns = $player.children(".column");
    var maxWidth = $player.width();
    $columns.each(function(index, element) {
      if ($(element).children(navTreeContainerId).length === 0) {
        maxWidth -= $(element).outerWidth(true);
      } else {
        maxWidth -= ($(element).outerWidth(true) - $(element).width());
      }
    });
    maxWidth -= (this.$navTreeContainer.outerWidth(true) - this.$navTreeContainer.width());
    this.$navTreeContainer.css("max-width", maxWidth);
  },

  _setTargetLeaf: function (theTargetLeaf) {
    this._targetLeaf = theTargetLeaf;
    if (this.onTargetLeafChange) {
      this.onTargetLeafChange(this._targetLeaf);
    }
  },

  /**
   * Draws the navigation tree.
   * @param node {eidogo.GameNode}
   * @returns
   */
  _drawNavTree: function (node){
    // Remove all the flags used to calculate the depth.
    delete node.depth.ySetted;

    var point = this._getNodePoint(node);
    this._lines = this._lines.concat(this._drawLines(node, point));
    this._stones = this._stones.concat(this._drawStone(node, point));
  },

  /**
   * Draws the lines between a node and it's parent node.
   * @param node {eidogo.GameNode}
   * @param point {Object} The (x, y) coordinates of the node.
   * @returns {SVGElement[]} The list of single or double lines.
   */
  _drawLines: function (node, point) {
    var lines = [];

    var parentNode = node.getParent();
    var parentPoint = this._getNodePoint(parentNode);

    var targetPoint = {};

    // It will be used to send the success paths to the front of the
    // graph.
    var isSuccessPath = false;
    // The active path shoul be above all other paths.
    var isActivePath = false;
    /* Set color */
    if (node.success) {
      this._setPathColor("#00FF00");
      isSuccessPath = true;
    } else {
      this._setPathColor("#FF0000");
      isSuccessPath = false;
    }
    if (node.isOffPath()) {
      this._setPathColor("#FF0000");
      isSuccessPath = false;
    }
    if (node.commentType && this.COMMENT_COLORS[node.commentType]) {
      this._setPathColor(this.COMMENT_COLORS[node.commentType]);
      isSuccessPath = false;
    }

    var onChosenPath = node.onChosenPath;

    /* Set Stroke */
    if (onChosenPath) {
      if (node.commentType) {
        this._setPathStroke(this.COMMENT_STROKE_ACTIVE);
      } else if (node.isOffPath()) {
        this._setPathStroke(this.OFF_PATH_STROKE_ACTIVE);
      } else {
        this._setPathStroke(this.ACTIVE_STROKE);
        isActivePath = true;
      }
    } else {
      if (node.commentType) {
        this._setPathStroke(this.COMMENT_STROKE_INACTIVE);
      } else if (node.isOffPath()) {
        this._setPathStroke(this.OFF_PATH_STROKE_INACTIVE);
      } else {
        this._setPathStroke(this.INACTIVE_STROKE);
      }
    }

    // if there's a big vertical drop, we don't want to make a
    // slanted line all the way, so we drop vertically until just
    // before this node
    if (node.depth.y >= parentNode.depth.y + 2) {
      var middlePont = this._getPointOnCanvas({
        x: node.depth.x - 1,
        y: node.depth.y - 1
      });
      lines = lines.concat(this._drawLine(middlePont, parentPoint, node.hasComments())); // drop
      lines = lines.concat(this._drawLine(middlePont, point, node.hasComments())); // slant
      targetPoint.x = (middlePont.x + point.x) / 2;
      targetPoint.y = (middlePont.y + point.y) / 2;
    }
    else {
      lines = lines.concat(this._drawLine(point, parentPoint, node.hasComments()));
      targetPoint.x = (parentPoint.x + point.x) / 2;
      targetPoint.y = (parentPoint.y + point.y) / 2;
    }

    if (node.goproblems && node.goproblems.notThis) {
      var radious = onChosenPath? 3 : 2;
      lines.push(this._doDrawCircle(targetPoint.x - radious,
          targetPoint.y - radious, radious* 2, {fill: 'red'}));
    } else if (!node.hasComments() && parentNode.goproblems
        && parentNode.goproblems.force) {
      // moves from mommy are forced: maternal tough-love
      var radious = 2;
      lines.push(this._doDrawCircle(targetPoint.x - radious, targetPoint.y,
          radious* 2, {fill: 'black'}));
    }

    for (var i=0, len=lines.length; i<len; i++) {
      lines[i].data("isSuccessPath", isSuccessPath);
    }

    if (isActivePath) {
      this._activeLines = this._activeLines.concat(lines);
    }
    return lines;
  },

  /**
   * Draws a stone with it's proper references.
   * @param node
   * @param point
   * @returns {SVGElement[]} The list of stone related SVG elements.
   */
  _drawStone: function (node, point) {
    var stones = [];
    if(!point) {
      point = this._getNodePoint(node);
    }
    var stoneColor = node.color;

    // current move? if so, indicate this
    if (this.cursor.node.equals(node)) {
        var r = this.STONE_RADIUS + 2;
        if (node.success) {
            r += 1;
        }
        stones.push(this._doDrawCircle(point.x, point.y, r, {fill: "yellow"}));
        this._focusPoint = point;
    }

    if (this.onClick) {
      var onClick = $.proxy(function () {
          var path = node.getPath().slice(0);
          this.onClick(path);
        }, this);
    }

    if (node.isRoot()) {
      stones = stones.concat(this._doDrawYingYang(point.x, point.y,
          this.STONE_RADIUS, !!node.C, onClick));
    } else {
      stones.push(this._doDrawCircle(point.x, point.y, this.STONE_RADIUS,
          {fill: this.STONE_FILL[stoneColor], onClick: onClick}));
      // SGF commented?
      if (node.C) {
        stones.push(this._doDrawCircle(point.x, point.y, this.STONE_RADIUS/3,
            {
              fill: (stoneColor === "white" ? "black" : "white"),
              onClick: onClick
            }));
      }
    }

    // user commented?
    if (node.getExternalCommentCount() > 0 && !this._rootOnce) {
      // we draw a 'T' sized according to number of comments
      var fontSize = 12;
      fontSize += Math.sqrt(node.getExternalCommentCount() - 1) * 2;
      var offset = this.STONE_RADIUS + fontSize/6;

      stones.push(this._doDrawLetterT(Math.round(point.x + offset),
          Math.round(point.y + offset), Math.round(fontSize)));
    }

    if (node.isRoot() && this._rootOnce) {
      delete this._rootOnce;
    }

    return stones;
  },

  /**
   * Draws the target leaf node external circle.
   * @returns The SVGElement
   */
  _drawTargetLeaf: function () {
    var targetLeafColor = null;
    if (this._targetLeaf.success) {
      targetLeafColor = "#00FF00";
    } else {
      targetLeafColor = "#FF0000";
    }
    if (this._targetLeaf.isOffPath()) {
      targetLeafColor = "#FF0000";
    }
    if (this._targetLeaf.commentType
        && this.COMMENT_COLORS[this._targetLeaf.commentType]) {
      targetLeafColor = this.COMMENT_COLORS[this._targetLeaf.commentType];
    }
    var targetLeafPoint = this._getNodePoint(this._targetLeaf);
    var targetLeaf = this._doDrawCircle(targetLeafPoint.x, targetLeafPoint.y,
        this.STONE_RADIUS + 2, {fill: targetLeafColor});
    this._lines.push(targetLeaf);
    return targetLeaf;
  },

  /**
   * Draws all the iso lines between this node and all other.
   * @returns {SVGElements[]} The SVG Elements.
   */
  _drawIsoLines: function (node) {
    var isoLines = [];

    var point = this._getNodePoint(node);
    var path = node.getPath().slice(0);

    var isoNodes = node.getIsoNodes();
    var isCurrentNode = this.cursor.node.equals(node);
    for (var i=0, len=isoNodes.length; i<len; i++) {
      var isoPoint = this._getNodePoint(isoNodes[i]);
      var isoPath = isoNodes[i].getPath().slice(0);

      var isCurrentIsoNode = this.cursor.node.equals(isoNodes[i]);

      isoLines.push(this._drawQuadraticCurve(point, isoPoint,
          isCurrentNode || isCurrentIsoNode, path, isoPath));
    }
    return isoLines;
  },
  
  /**
   * Draws a quadratic curve between point 1 and point 2.
   * @param point1
   * @param point2
   * @returns The SVG Element
   */
  _drawQuadraticCurve: function (point1, point2, highlight, path1, path2) {

    var control = {};
    control.x = point1.x + 50;
    if (point1.y > point2.y) {
      control.y = point2.y + (point1.y - point2.y)/2;
    } else if (point1.y < point2.y) {
      control.y = point1.y + (point2.y - point1.y)/2;
    }

    var control = {};

    // the distance between the two points.
    var distance = Math.sqrt((point1.x - point2.x) * (point1.x - point2.x) 
        + (point1.y - point2.y) * (point1.y - point2.y));
    // the angle between the line that point1 and point2 make and the x axis.
    var omega = Math.atan2((point1.y - point2.y),(point1.x - point2.x));
    // the angle I want the quadratic curve to have.
    var theta = 10;

    // the correction if point1 is to the right of point2.
    var cuadrantCorrection = point1.y < point2.y? 1 : -1;

    // This are the control point if I want it to be in the middle of both
    // points and the angle of the curve is theta.
    control.x = point1.x + Math.round(distance/2.0*(Math.cos(omega) - Math.sin(omega)*Math.sin(theta)));
    control.y = point1.y + cuadrantCorrection * Math.round(distance/2.0*(Math.sin(omega) + Math.cos(omega)*Math.sin(theta)));

    var onClick = null;
    if (this.onClick) {
      // the middle point between point1 and point2
      var middle = {};
      middle.x = (point1.x + point2.x)/2;
      middle.y = (point1.y + point2.y)/2;

      onClick = $.proxy(function (event) {
        var middleX = middle.x;
        var middleY = middle.y;
        var controlX = control.x;
        var controlY = control.y;
        var thePath1 = path1.slice(0);
        var thePath2 = path2.slice(0);

        if ((event.offsetY - middleY) * (controlX - middleX) < (controlY - middleY) * (event.offsetX - middleX)) {
          this.onClick(thePath2);
        } else {
          this.onClick(thePath1);
        }
      }, this);
    }

    return this._doDrawQuadraticCurve(point1, point2, control, highlight,
        onClick);
  },

  /**
   * Draws a line between two points.
   * @returns {SVGElement[]} The Raphael SVG Elements of the lines (one if
   *     single, two if double).
   */
  _drawLine: function (theStartPoint, theEndPoint, isDouble) {
    var lines = [];
    if (isDouble) {
      // draw double lines here
      var sz = 2;
      var dx = 0, dy = 0;
      if (theEndPoint.x == theStartPoint.x) {
        dx = sz;
      } else if (theEndPoint.y == theStartPoint.y) {
        dy = sz;
      } else {
        dy = sz;
        dx = -1;
      }
      lines[0] = this._doDrawLine(theEndPoint.x + dx, theEndPoint.y + dy,
          theStartPoint.x + dx, theStartPoint.y + dy); // normal
      lines[1] = this._doDrawLine(theEndPoint.x - dx, theEndPoint.y - dy,
          theStartPoint.x - dx, theStartPoint.y - dy); // normal
    } else {
      lines[0] = this._doDrawLine(theEndPoint.x, theEndPoint.y,
            theStartPoint.x, theStartPoint.y); // normal
    }
    return lines;
  },

  /**
   * Returns the location of the node in the drawing area.
   * @param node
   * @returns
   */
  _getNodePoint: function (node) {
    return this._getPointOnCanvas(node.depth);
  },

  _getPointOnCanvas: function (thePoint) {
    var x = (thePoint.x + 1) * this.PIXEL_WIDTH;
    var y = (thePoint.y + 1) * this.PIXEL_WIDTH;
    return {x: x, y: y};
  },

  _setPathColor: function (color) {
    this._pathColor = color;
  },

  _setPathStroke: function (stroke) {
    this._pathStroke = stroke;
  },

  /**
   * Checks that the maximum coordinates are still the same
   * @param box
   * @returns
   */
  _updateBoundaries: function (box) {
    this._boundaries.x = Math.max(this._boundaries.x, box.x + box.width);
    this._boundaries.y = Math.max(this._boundaries.y, box.y + box.height);
  },

  /**
   * Binds the keyboard listeners.
   * @returns
   */
  _listenToKeyboardEvents: function () {
    $(document).keyup($.proxy(this._onKeyUp, this));
    $(document).keydown($.proxy(this._onKeyDown, this));
  },

  /**
   * Called when the user types, it prevents scrolling when the arrow keys are
   * pressed.
   * @param event
   * @returns
   */
  _onKeyDown: function (event) {
      var key = event.keyCode;
       if(key==37 || key == 38 || key == 39 || key == 40) {
         event.preventDefault();
           return false;
       }
       return true;
  },

  /**
   * Navigates thru the navigation tree.
   * Left and right move thru the first variation of the current move.
   * Up and down switch between variations.
   * @param event
   */
  _onKeyUp: function (event) {
    if (!this.$navTreeContainer.is(":visible")) {
      return;
    }

    switch (event.keyCode) {
    case 37: // left key
      if (this.cursor.hasPrevious()) {
        var path = this.cursor.node.getParent().getPath().slice(0);
        this.onClick(path);
      }
      event.preventDefault();
      return false;
      break;
    case 39: // right key
      if (this.cursor.hasNext()) {
        var path = null;
        var children = this.cursor.node.getChildren();
        for (var i=0, len=children.length; i < len; i++) {
          if (children[i].onSamePath(this._targetLeaf)) {
            path = children[i].getPath().slice(0);
            break;
          }
        }
        if (path == null) {
          path = children[0].getPath().slice(0);
        }

        this.onClick(path);
      }
      event.preventDefault();
      return false;
      break;
    case 40: // down key
    case 38: // up key
      var direction = +1;
      if (event.keyCode === 38) {
        // if the key is up we must move up.
        direction = -1;
      }
      var newTargetLeaf = null;

      var currentNodeChildren = this.cursor.node.getChildren();
      for (var i=0, len=currentNodeChildren.length; i < len; i++) {
        if (currentNodeChildren[i].onSamePath(this._targetLeaf)) {
          var newTargetChildrenIndex = i + direction;
          if (newTargetChildrenIndex < len && newTargetChildrenIndex >= 0) {
            var leafs = currentNodeChildren[newTargetChildrenIndex].getLeafs();
            newTargetLeaf = leafs.length > 0? leafs[0] : currentNodeChildren[newTargetChildrenIndex];
          }
          break;
        }
      }

      if (newTargetLeaf) {
        this._setTargetLeaf(newTargetLeaf);
        this.updateNavTree();
      }
      event.preventDefault();
      return false;
      break;
    default:
      break;
    }
  },

  /* RENDERER */
  _scrollTop: null,
  _scrollLeft: null,

  _resetCanvas: function(){
    this._scrollTop = this.$navTreeContainer.scrollTop();
    this._scrollLeft = this.$navTreeContainer.scrollLeft();
    this._boundaries = {
        x : 0,
        y : 0
    };
    if (this.paper) {
      var paperDom = this.paper.canvas;
      paperDom.parentNode.removeChild(paperDom);
    }
    this.paper = new Raphael(this.$navTreeContainer.get(0),
        this.$navTreeContainer.width(),
        this.$navTreeContainer.height());
    $(this.paper.canvas).css("z-index", 10);
  },

  /**
   * Scrolls to the current stone. It doesn't use this.paper, but it's renderer
   * dependant, as the implementation requieres the conteainer to be deleted
   * every time it will be drawn again, so the current scroll needs to be
   * stored.
   * @returns
   */
  _scrollToCurrentStone: function () {
    if (this.$navTreeContainer.is(":visible")) {
      var parentWidth = this.$navTreeContainer.width();
      var parentHeight = this.$navTreeContainer.height();

      var scrollBarCorrection = 5;
      var horizontalScrollBarCorrection = 0;
      var verticalScrollBarCorrection = 0;

      if ($(this.paper.canvas).width() > parentWidth) {
        horizontalScrollBarCorrection = scrollBarCorrection;
        
      }
      if ($(this.paper.canvas).height() > parentHeight) {
        verticalScrollBarCorrection = scrollBarCorrection;
      }

      
      
      
      if (this._focusPoint.y - 1.2 * this.STONE_RADIUS < this._scrollTop) {
        this._scrollTop = this._focusPoint.y - 1.2 * this.STONE_RADIUS;
      } else if (this._focusPoint.y + 2.5 * this.STONE_RADIUS > parentHeight + this._scrollTop - horizontalScrollBarCorrection) {
        this._scrollTop = this._focusPoint.y + 2.5 * this.STONE_RADIUS - parentHeight + horizontalScrollBarCorrection;
      }

      if (this._focusPoint.x - 1.2 * this.STONE_RADIUS < this._scrollWidth) {
        this._scrollLeft = this._focusPoint.x - 1.2 * this.STONE_RADIUS;
      } else if (this._focusPoint.x + 2.5 * this.STONE_RADIUS > parentWidth + this._scrollLeft - verticalScrollBarCorrection) {
        this._scrollLeft = this._focusPoint.x + 2.5 * this.STONE_RADIUS - parentWidth + verticalScrollBarCorrection;
      }
    }

    this.$navTreeContainer.scrollTop(this._scrollTop);
    this.$navTreeContainer.scrollLeft(this._scrollLeft);
  },

  /**
   * Draws a line, using the current color, between the points (x1, y1)
   * and (x2, y2) in this graphics context's coordinate system.
   *
   * @param x1 {Number} The first point's x coordinate.
   * @param y1 {Number} The first point's y coordinate.
   * @param x2 {Number} The second point's x coordinate.
   * @param y2 {Number} The second point's y coordinate.
   * @returns {SVGElement} the Raphael svg element.
   */
  _doDrawLine: function (x1, y1, x2, y2) {
    var attrs = $.extend({}, this._pathStroke);
    attrs.stroke = this._pathColor;
    var line = this.paper.path("M" + x1 + " " + y1 + "L" + x2 + " " + y2)
    .attr(attrs)/*.toBack() Commented on 4/9/2012, checking if needed. */;

    this._updateBoundaries(line.getBBox());

    return line;
  },

  /**
   * 
   * @param x
   * @param y
   * @param r
   * @param attr
   * @returns {SVGElement} the Raphael svg element.
   */
  _doDrawCircle: function (x, y, r, attr) {
    var circle = this.paper.circle(x, y, r).attr({
      fill : attr.fill,
      stroke : attr.stroke || "none",
      opacity: attr.opacity
    });

    if (attr.onClick && typeof attr.onClick === "function") {
      circle.click(attr.onClick);
    }

    this._updateBoundaries(circle.getBBox());
    return circle;
  },

  /**
   * 
   * @param x
   * @param y
   * @param r
   * @param withDots
   * @param onClick
   * @returns {SVGElement[]} the Raphael svg elements.
   */
  _doDrawYingYang: function(x, y, r, withDots, onClick) {
    var elements = [];
    var centerX = x;
    var centerY = y;

    var yingYangRadius = 126.406754;
    
    var yingX = centerX - 0.744495;
    var yangX = centerX + 0.744495;

    var yingY = centerY + yingYangRadius;
    var yangY = centerY - yingYangRadius;

    var yingPath = "M " + yingX + "," + yingY + " c -34.69714,-0.389439999999922 -62.85714,-28.5494399999999 -62.85714,-63.2465799999999 c 0,-34.69714 28.16,-62.85715 62.85714,-63 c 34.69714,-0.142860000000042 62.85714,-28.30286 62.85714,-63 c 0,-34.69714 -28.16,-62.85715 -62.85714,-63.56047 c -66.99522,-0.703320000000019 -121.36815,56.083 -121.36815,126.05186 c 0,69.96887 54.37293,126.75519 121.36815,126.75519 z";
    var ying = this.paper.path(yingPath).attr({
      stroke: 'none',
      'stroke-linecap': 'butt',
      'stroke-linejoin': 'miter',
      fill: "315-#777-#444:30-#111"
    });

    var yangPath = "M " + yangX + "," + yangY + "   c 34.69714,0.389439999999979 62.85714,28.54944 62.85714,63.24658 c 0,34.69714 -28.16,62.85715 -62.85714,63 c -34.69714,0.142859999999985 -62.85714,28.30286 -62.85714,63 c 0,34.69714 28.16,62.8571500000001 62.85714,63.56047 c 66.99522,0.703319999999962 121.36815,-56.083 121.36815,-126.05186 c 0,-69.96887 -54.37293,-126.75519 -121.36815,-126.75519 z";
    var yang = this.paper.path(yangPath).attr({
      stroke: 'none',
      'stroke-linecap': 'butt',
      'stroke-linejoin': 'miter',
      fill: '315-#FFF:60-#DDD:80-#777'
    });

    var set = this.paper.set();
    set.push(ying, yang);
    elements.push(ying, yang);

    if (withDots) {
      var dotPath1 = " c -6.28554,5.40058 -10.34391,8.73078 -18.05271,11.23752 -8.90245,3.84454 -14.65777,4.21973 -24.10354,4.66873 -10.48928,0.812 -16.92878,2.20871 -25.84375,5.40625 -6.33869,2.745 -10.22203,6.46114 -16.0625,10.4375 l -1.0625,0.40625 c 0.0316,0.0829 0.0618,0.16743 0.0937,0.25 -0.096,0.0633 -0.18411,0.12405 -0.28125,0.1875 l 0.3125,-0.125 c 9.02439,23.19649 35.01279,34.86565 58.34375,26.125 23.47235,-8.79362 35.39437,-34.89828 26.71875,-58.40625 -0.0231,-0.0627 -0.0391,-0.12488 -0.0625,-0.1875 z";
      var dot1 = this.paper.path("m " + (centerX + yingYangRadius/3.2) + "," + (centerY - yingYangRadius/7.5) + dotPath1)
          .attr({
        stroke : "none",
        fill: "315-#777-#444:30-#111"
      });
      var dotPath2 = " c 6.28554,-5.40058 10.34391,-8.73078 18.05271,-11.23752 8.90245,-3.84454 14.65777,-4.21973 24.10354,-4.66873 10.48928,-0.812 16.92878,-2.20871 25.84375,-5.40625 6.33869,-2.745 10.22203,-6.46114 16.0625,-10.4375 l 1.0625,-0.40625 c -0.0316,-0.0829 -0.0618,-0.16743 -0.0937,-0.25 0.096,-0.0633 0.18411,-0.12405 0.28125,-0.1875 l -0.3125,0.125 c -9.02439,-23.19649 -35.01279,-34.86565 -58.34375,-26.125 -23.47235,8.79362 -35.39437,34.89828 -26.71875,58.40625 0.0231,0.0627 0.0391,0.12488 0.0625,0.1875 z";
      var dot2 = this.paper.path("m " + (centerX - yingYangRadius/2.8) + "," + (centerY + yingYangRadius/8) + dotPath2)
          .attr({
        stroke : "none",
        fill: "315-#FFF:60-#DDD:80-#777"
      });

      set.push(dot1);
      set.push(dot2);
      elements.push(dot1, dot2);
    }

    set.scale(r/yingYangRadius, r/yingYangRadius, centerX, centerY);
    if (onClick && typeof onClick === "function") {
      set.click(onClick);
    }
    return elements;
  },

  /**
   * Draws an itallic letter T centered in (x, y) with the given font size.
   * @returns {SVGElement} the Raphael svg element.
   */
  _doDrawLetterT: function (x, y, fontSize) {
    if (fontSize > 25) {
      fontSize = 25;
    }

    var strokeWidth = 1;
    if (fontSize > 15) {
      strokeWidth = 2;
    }

    // Size correction
    fontSize -= 4;

    var path = "M" + x + " " + (y - fontSize/2);
    path += "L" + (x - strokeWidth) + " " + (y + fontSize/2);
    path += "M" + (x - fontSize*0.8/2) + " " + (y - fontSize/2);
    path += "L" + (x + fontSize*0.8/2) + " " + (y - fontSize/2);
    var letter = this.paper.path(path).attr({
      stroke : "#A758B0",
      "stroke-width": strokeWidth + "px"
    });
    this._updateBoundaries(letter.getBBox());
    return letter;
  },

  /**
   * Draws a quadratic Bézier curveto from point1 to point2 using control as
   * control point.
   * @param point1
   * @param point2
   * @param control
   * @returns {SVGElement} the Raphael svg element.
   */
  _doDrawQuadraticCurve: function (point1, point2, control, highlight, onClick) {
    var curve = this.paper.path("M" + point1.x + "," + point1.y + " Q" + control.x + "," + control.y + " " + point2.x + "," + point2.y)
      .attr({
        stroke: "#A758B0",
        "stroke-width": highlight? "2px": "1px"
      }).toFront();
    if (onClick) {
      curve.click(onClick);
    }
    this._updateBoundaries(curve.getBBox());
    return curve;
  },

  _resizeCanvas: function(width, height) {
    this.paper.setSize(width, height);
    $(this.paper.canvas).parent().css({
      width: Math.ceil(width) + 20 +"px",
      height: Math.ceil(height) + 20 + "px"
    });
  },

  /**
   * If the background of the board was rendered as the fill attribute of a
   * rectangle it happened some times that the image was not loaded, this
   * was fixed with this method, that adds a div with the proper background.
   */
  _drawBackground: function () {
    //nothing to do here
  }
};
