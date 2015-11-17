var scripts= document.getElementsByTagName('script');
var path= scripts[scripts.length-1].src.split('?')[0];      // remove any ?query
var mydir= path.split('/').slice(0, -1).join('/')+'/';  // remove last filename part of path

/**
 * @class An HTML/DOM-based board renderer.
 */
eidogo.BoardRendererRaphael = function() {
    this.init.apply(this, arguments);
};
eidogo.BoardRendererRaphael.prototype = {

  SCRIPT_DIRECTORY: mydir,
  /**
   * Gradient fill for the stones.
   */
  STONE_FILL : {
    black : "r(0.3, 0.3)#777-#444:30-#111",
    white : "r(0.49, 0.56)#FFF:70-#ccc:95-#999"
    //    white : "r(0.47, 0.89)#FFF:70-#DDD:90-#777"
  },

  MARKER_TYPES : ["triangle", "square", "circle", "ex", "territory-white",
                  "territory-black", "dim", "current", "next-right",
                  "next-wrong", "next-right-target",
                  "next-wrong-target"], 

  /**
   * Star points for each board size.
   */
  STAR_POINTS : {
    19 : [
          {x: 3 ,y: 3},
          {x: 3 ,y: 9},
          {x: 3 ,y: 15},
          {x: 9 ,y: 3},
          {x: 9 ,y: 9},
          {x: 9 ,y: 15},
          {x: 15 ,y: 3},
          {x: 15 ,y: 9},
          {x: 15 ,y: 15}
         ],
    13 : [
          {x: 3 ,y: 3},
          {x: 3 ,y: 6},
          {x: 3 ,y: 9},
          {x: 6 ,y: 3},
          {x: 6 ,y: 6},
          {x: 6 ,y: 9},
          {x: 9 ,y: 3},
          {x: 9 ,y: 6},
          {x: 9 ,y: 9}
        ],
    9 : [
           {x: 2 ,y: 2},
           {x: 2 ,y: 6},
           {x: 4 ,y: 4},
           {x: 6 ,y: 2},
           {x: 6 ,y: 6}
       ]
  },

  /**
   * Board's size, 19 for, example. Default: 19.
   * @type Number
   */
  boardSize: null,

  /**
   * Stone's size, in pixels. Delfault: 30.
   * @type Number
   */
  stoneSize : null,

  /**
   * The Dom element that will contain the board.
   */
  $domContainer: null,

  /**
   * Eidogo's player.
   */
  player: null,

  /**
   * The unique id for the stones.
   */
  uniqueId: null,

  /**
   * Map used to store all the marker for later removal. Some markers are sets,
   * so I can't add an id to it's DOM node. I tried adding a class to the DOM
   * node, but IE8 does not support adding css classes to the elements.
   */
  markers: null,

  /**
   * Holds the map of stoneId vs raphael's element id, it is used to remove
   * stones without caring about the dom.
   */
  _raphaelStoneIdMap: null,

  /**
   * The raphael's elemnt id of the hover stone.
   */
  _raphaelHoverStoneId: null,

  /**
   * @constructor
   * @param {HTMLElement} domContainer Where to put the board.
   * @param {Number} boardSize Board's size, 19 for, example. Optional. Default: 19.
   * @param {eidogo.Player} player eidogo's player. Mandatory.
   * @param {Object} cropParams The parameters to crop the board. Optional
   * @param {Number} cropParams.width Width of the showed board.
   * @param {Number} cropParams.height Height of the showed board.
   * @param {Number} cropParams.left How many pixels to move to the left.
   * @param {Number} cropParams.top How many pixels to move up.
   * @param {Boolean} shrinkBoard True if the coordinates must be removed.
   * @param {Number} stoneSize Stone's size, in pixels. Optional. Default: 30.
   */
  init: function(domContainer, boardSize, player, crop, shrinkBoard, stoneSize) {
    if (!domContainer) {
      throw "No DOM container";
      return;
    }
    this._raphaelStoneIdMap = [];
    this.boardSize = parseInt(boardSize, 10) || 19;
    this.stoneSize = stoneSize || 30;
    this.$domContainer = $(domContainer);
    this.player = player;

    this.uniqueId = domContainer.id + "-";

    this.markers = {};
    this.renderBoard(crop, shrinkBoard);

    this.renderBackgroundBoard();

    this.$domContainer.mousedown($.proxy(this._handleMouseDown, this));
    this.$domContainer.mouseup($.proxy(this._handleMouseUp, this));
    this.$domContainer.mousemove($.proxy(this._handleMouseMove, this));
    this.$domContainer.mouseleave($.proxy(this._handlerMouseLeave, this));
  },

  /**
   * Renders the board.
   * @param crop Crops the board.
   * @param hideLabels if true it will hide the labels.
   */
  renderBoard: function(crop, hideLabels) {
    // Corrects the cropping with the padding.
    this.crop = this._calculateCrop(crop);

    var playgroundMargin = {
        left : 1.3 * this.stoneSize,
        right : 1.3 * this.stoneSize,
        top : 1.3 * this.stoneSize,
        bottom : 1.3 * this.stoneSize
    };

    if(this.crop) {
      if (this.crop.left != 0) {
        playgroundMargin.left -= this.stoneSize/4;
      }
      if (this.crop.top != 0) {
        playgroundMargin.top -= this.stoneSize/4;
      }
      if (this.crop.left + this.crop.width !== this.boardSize) {
        playgroundMargin.right -= this.stoneSize/4;
      }
      if (this.crop.top + this.crop.height !== this.boardSize) {
        playgroundMargin.bottom -= this.stoneSize/4;
      }
    }

    var boardDimension = {
        width : this.stoneSize * (this.boardSize-1) + playgroundMargin.left
            + playgroundMargin.right,
        height : this.stoneSize * (this.boardSize-1) + playgroundMargin.top
            + playgroundMargin.bottom
    };

    var playgroundOriginX = playgroundMargin.left;
    var playgroundOriginY = playgroundMargin.top;
    if (this.crop) {
      boardDimension.width = (this.crop.width-1) * this.stoneSize
          + playgroundMargin.left + playgroundMargin.right;
      boardDimension.height = (this.crop.height-1) * this.stoneSize
          + playgroundMargin.top + playgroundMargin.bottom;
      playgroundOriginX -= this.crop.left * this.stoneSize;
      playgroundOriginY -= this.crop.top * this.stoneSize;
    }

    this._createMarkerMethods();

    this.paper = new Raphael(this.$domContainer[0], boardDimension.width,
        boardDimension.height);

//    /* See Doc on method 'renderBackgroundBoard' to see the reason for this to be commented. */
//    var board = this.paper.rect(0, 0, boardDimension.width,
//        boardDimension.height);
//    board.attr({
//      fill: 'url("player/images/board/raphael/board.png")',
//      stroke: "black"
//    });

    this.playgroundSize = {
        x : playgroundOriginX,
        y : playgroundOriginY,
        width : boardDimension.width - (playgroundMargin.left
            + playgroundMargin.right),
        height : boardDimension.height - (playgroundMargin.top
            + playgroundMargin.bottom)
    };

    var fromX = playgroundMargin.left;
    var fromY = playgroundMargin.top;
    var toX = fromX + this.playgroundSize.width;
    var toY = fromY + this.playgroundSize.height;

    if (this.crop) {
      if (this.crop.left != 0) {
        fromX += this.stoneSize/2;
      }
      if (this.crop.top != 0) {
        fromY += this.stoneSize/2;
      }
      if (this.crop.left + this.crop.width !== this.boardSize) {
        toX -= this.stoneSize/2;
      }
      if (this.crop.top + this.crop.height !== this.boardSize) {
        toY -= this.stoneSize/2;
      }
    }
    for (var i = 0; i < this.boardSize; i++) {
      var positionX = playgroundMargin.left  + this.stoneSize * i;
      var positionY = playgroundMargin.top + this.stoneSize * i;
      /* X */
      var strokeWidthX = this._getStrokeWidth(i, this.crop, true);
      if (strokeWidthX > 0) {
        this.paper.path("M" + fromX + " " + positionY + "L" + toX + " " + positionY)
          .attr({
            stroke: "#665544",
            "stroke-width" : strokeWidthX + "px"
          });
      }
      /* Y */
      var strokeWidthY = this._getStrokeWidth(i, this.crop, false);
      if (strokeWidthY > 0) {
        this.paper.path("M" + positionX + " " + fromY + "L" + positionX + " " + toY)
          .attr({
            stroke: "#665544",
            "stroke-width" : strokeWidthY + "px"
          });
      }
    }

    if (!hideLabels) {
      var textElement;
      var textAttr = {
          "font-size" : this.stoneSize/2,
          fill : "#665544"
      };
      var char = "A".charCodeAt(0) + (this.crop? this.crop.left : 0);
      for (var i = 0; i < this.boardSize; i++) {
        var positionX = playgroundMargin.left + this.stoneSize * i;
        var positionY = playgroundMargin.top + this.stoneSize/5 + this.stoneSize * i;

        if (this._showsLabel(i, this.crop, true)) {
          var number = this.boardSize - i - (this.crop? this.crop.top : 0);
          textElement = this.paper.text(fromX - this.stoneSize/2
              - 0.3 * this.stoneSize, positionY ,number)
            .attr(textAttr);
          this._fixVerticalAlignBug(textElement);

          textElement = this.paper.text(toX
              + this.stoneSize/2 + 0.3 * this.stoneSize, positionY, number)
             .attr(textAttr);
          this._fixVerticalAlignBug(textElement);
        }
  
        var charNumber = char + i;
        if (charNumber >= "I".charCodeAt(0)) {
          charNumber++;
        }
        if (this._showsLabel(i, this.crop, false)) {
          var letter = String.fromCharCode(charNumber);
          textElement = this.paper.text(positionX, fromY - this.stoneSize/2
              - 0.2 * this.stoneSize, letter).attr(textAttr);
          this._fixVerticalAlignBug(textElement);

          textElement = this.paper.text(positionX, toY + this.stoneSize/2
            + 0.5 * this.stoneSize, letter)
            .attr(textAttr);
          this._fixVerticalAlignBug(textElement);
        }
      }
    }

    /* STAR POINTS */
    var starPoints = this.STAR_POINTS[this.boardSize] || [];
    for (var i = 0, len = starPoints.length; i < len; i++) {
      var starpoint = starPoints[i];
      if (!this.crop || (starpoint.x > this.crop.left
          && starpoint.x < this.crop.left + this.crop.width - 1)
          && (starpoint.y > this.crop.top
              && starpoint.y < this.crop.top + this.crop.height - 1)) {
        var coords = this._fromPointToCoord(starpoint);
        var width = this.stoneSize/6;
        var height = this.stoneSize/6;
        var x = coords.x - width/2;
        var y = coords.y - height/2;
        this.paper.rect(x, y, width, height)
          .attr({
            fill : "#665544",
            stroke : "#665544"
          });
      }
    }
  },

  /**
   * If the background of the board was rendered as the fill attribute of a
   * rectangle it happened some times that the image was not loaded, this
   * was fixed with this method, that adds a div with the proper background.
   */
  renderBackgroundBoard: function() {
    var $backgroundBoard = $("<div/>").css({
      position: "absolute",
      left: "10px",
      right: "10px",
      top: "10px",
      bottom: "10px",
      border: "1px solid black"
    }).addClass("board-background");
    this.$domContainer.append($backgroundBoard).css('position', 'relative');
    $(this.paper.canvas).css("z-index", 10);
  },

  /**
   * Renders a stone.
   * @param pt Coordinates of the stone.
   * @param color 'black'. 'white' or 'empty' (the last removes the stone).
   * @param isHover {Boolean} If true, then the stone will be marked as hover
   *     and it will be semi-transparent.
   */
  renderStone: function(pt, color, isHover) {
    var stoneId = this.uniqueId + "stone-" + pt.x + "-" + pt.y;
    if (!isHover) {
      var oldStone = this.paper.getById(this._raphaelStoneIdMap[stoneId]);
      if (oldStone) {
        this._raphaelStoneIdMap[stoneId] = null;
        oldStone.remove();
      }
    }

    if (color == "empty") {
      return;
    }
    
    var coords = this._fromPointToCoord(pt);
    var fillColor = this.STONE_FILL[color];
    if (color == "white" && isHover) {
      fillColor = "r(0.3, 0.3)#FFF-#DDD:30-#FFF";
    }
    var stone = this.paper.circle(coords.x, coords.y, this.stoneSize/2)
      .attr({
        fill : fillColor,
        //        stroke : "none",
        stroke : "#888",
        "stroke-opacity": 0.5,
        opacity : isHover? 0.3: 1
      });
    //    stone.glow({offsety: 1, offsetx: 1, width: 1, opacity: 0.12});
    $(stone.node).attr("id", stoneId);
    if (isHover) {
      this._raphaelHoverStoneId = stone.id;
    } else {
      this._raphaelStoneIdMap[stoneId] = stone.id;
    }
    $(stone.node).data("color", color);
    return stone;
  },

  /**
   * Renders a hover stone (transparent).
   * @param pt Coordinates of the stone.
   * @param color 'black'. 'white' or 'empty' (the last removes the stone).
   */
  renderHoverStone: function(pt, color) {
    var stoneId = this.uniqueId + "stone-" + pt.x + "-" + pt.y;

    if ($("#" + stoneId).length > 0) {
      return;
    }

    this.removeHoverStone();

    if (color != "empty") {
      var stone = this.renderStone(pt, color, true);
      stone.mouseout(function(a, b, c) {
        this.remove();
      });
    }
  },

  /**
   * Removes the hover stone, if present.
   */
  removeHoverStone: function () {
    var oldHoverStone = this.paper.getById(this._raphaelHoverStoneId);
    if (oldHoverStone) {
      oldHoverStone.remove();
      this._raphaelHoverStoneId = null;
    }
  },

  /**
   * Renders a marker on the board.
   * @param pt {Object} Point on the board where the marker is going to be
   *     rendered.
   * @param type {String} The type of marker or a text to insert as label.
   * @param isOverStone {String} True if the marker is over a stone.
   * @param stoneColor {String} The color of a stone if it's over one.
   *     Can be "white" or "black". Optional.
   */
  renderMarker: function(pt, type, isOverStone, stoneColor) {
    var markerId = this.uniqueId + "marker-" + pt.x + "-" + pt.y;
    var stoneId = this.uniqueId + "stone-" + pt.x + "-" + pt.y;
    if (this.markers[markerId]) {
      this.markers[markerId].remove();
      this.markers[markerId] = null;
    }

    var label;
    if ($.inArray(type, this.MARKER_TYPES) < 0) {
      if (type && type !== "empty") {
        label = type;
        type = "label";
      } else {
        return;
      }
    }
    var coords = this._fromPointToCoord(pt);

    var marker;
    if (type !== "label") {
      marker = this.paper.marker(coords.x, coords.y, type,
          this.stoneSize, isOverStone, stoneColor);
    } else {
      marker = this.paper.label(coords.x, coords.y, label,
          this.stoneSize, isOverStone, stoneColor);
    }
    if (marker) {
      // store the marker for later removal.
      this.markers[markerId] = marker;
    }
  },
  showRegion: function(bounds) {
    // functionality not implemented.
  },
  hideRegion: function() {
    // functionality not implemented.
  },
  setCursor: function(cursor) {
    this.$domContainer.attr("cursor", cursor);
  },
  /*----------------- Private methods ---------------------*/
  /**
   * Calculates the real cropping based on the original crop sent in the
   * constructor.
   * @param originalCrop The original cropping values. (top, left, height,
   *     width and padding).
   * @return The cropping values (top, left, height, width).
   */
  _calculateCrop : function (originalCrop) {
    if (!originalCrop) {
      return null;
    }
    var crop = {};
    if (originalCrop.padding) {
      crop.height = originalCrop.height + 2 * originalCrop.padding;
      if (crop.height > this.boardSize) {
        crop.height = this.boardSize;
      }
      crop.width = originalCrop.width + 2 * originalCrop.padding;
      if (crop.width > this.boardSize) {
        crop.width = this.boardSize;
      }

      crop.left = originalCrop.left - originalCrop.padding;
      if (crop.left < 0) {
        crop.left = 0;
      }
      crop.top = originalCrop.top - originalCrop.padding;
      if (crop.top < 0) {
        crop.top = 0;
      }
    }
    if (crop.height >= this.boardSize && crop.width >= this.boardSize) {
      // do not crop if the crop size if bigger than the board.
      return null;
    }
    if (crop.left + crop.width > this.boardSize) {
      crop.width = this.boardSize - crop.left;
    }
    if (crop.top + crop.height > this.boardSize) {
      crop.height = this.boardSize - crop.top;
    }
    return crop;
  },

  /**
   * Adds the marker method to Raphael's interface.
   */
  _createMarkerMethods: function() {
    var urlPathname = this.SCRIPT_DIRECTORY;
    var _fixVerticalAlignBug = this._fixVerticalAlignBug;
    Raphael.fn.label = function (x, y, label, stoneWidth, isOverStone,
        stoneColor) {

      var set = this.set();

      var color = "black";
      if (isOverStone && stoneColor == "black") {
        color = "white";
      }
      var text = this.text(x, y + stoneWidth/8, label)
      .attr({
        fill : color,
        stroke : "none",
        "font-size" : stoneWidth/2
      });
      _fixVerticalAlignBug(text);

      set.push(text);

      // TODO I might need to add this for IE, I have to check it, if not remove it.
      if (false && !isOverStone) {
        var textBBox = text.getBBox();
        // TODO waiting for Raphael 2.0 to work fine
        if (false && textBBox && isFinite(textBBox.width) && isFinite(textBBox.height)
            && isFinite(textBBox.x) && isFinite(textBBox.y)) {
          var rect = this.rect(textBBox.x, textBBox.y, textBBox.width,
              textBBox.height).attr({
            fill: 'url("' + urlPathname
                + '../images/board/raphael/board.png")',
            stroke : "none"
          });
          set.push(rect);
        } else {
          var rect = this.rect(x - stoneWidth/2, y - stoneWidth/2,
              stoneWidth, stoneWidth).attr({
            fill: 'url("' + urlPathname
                + '../images/board/raphael/board.png")',
            stroke : "none"
          });
          set.push(rect);
        }
      }

      text.toFront();
      return set;
    };

    Raphael.fn.marker = function (x, y, type, stoneWidth, isOverStone,
        stoneColor) {
      var color = "#303030";
      if (isOverStone && stoneColor == "black") {
        color = "#DFDFDF";
      }
      switch(type) {
      case "circle":
        return this.circle(x, y, stoneWidth/5)
            .attr({
              fill : color,
              stroke : "none"
            });
      case "triangle":
        var radious = stoneWidth/4;
        var path = "M" + x + " " + (y - radious);
        path += "L" + (x - 0.866 * radious) + " " + (y + radious/2);
        path += "L" + (x + 0.866 * radious) + " " + (y + radious/2);
        path += "z";
        return this.path(path).attr({
          fill : color,
          stroke : "none"
        });
      case "square":
        var x0 = x - stoneWidth/8;
        var y0 = y - stoneWidth/8;
        var width = stoneWidth/4;
        return this.rect(x0, y0, width, width).attr({
          fill : color,
          stroke : "none"
        });
      case "ex":
        var radious = stoneWidth/5;
        var path = "M" + (x - radious) + " " + (y - radious);
        path += "L" + (x + radious) + " " + (y + radious);
        path += "M" + (x - radious) + " " + (y + radious);
        path += "L" + (x + radious) + " " + (y - radious);
        return this.path(path).attr({
          stroke : color,
          "stroke-width": "2px"
        });
      case "territory-white":
        // not implemented
        return null;
      case "territory-black":
        // not implemented
        return null;
      case "dim":
        // not implemented
        return null;
      case "current":
        return this.circle(x, y, stoneWidth/5)
          .attr({
            fill : "none",
            stroke : "green",
            "stroke-width" : stoneWidth/10
          });
      case "next-right":
        return this.circle(x, y, stoneWidth/5)
          .attr({
            fill : "none",
            stroke : "#42e117",
            "stroke-width" : stoneWidth/20
          });
      case "next-wrong":
        return this.circle(x, y, stoneWidth/5)
          .attr({
            fill : "none",
            stroke : "red",
            "stroke-width" : stoneWidth/20
          });
      case "next-right-target":
        var circle1 = this.circle(x, y, stoneWidth/4)
        .attr({
          fill : "none",
          stroke : "#42e117",
          "stroke-width" : stoneWidth/20
        });
        var circle2 = this.circle(x, y, stoneWidth/8)
          .attr({
            fill : "#42e117",
            stroke : "none",
            "stroke-width" : stoneWidth/20
          });
        var set = this.set();
        set.push(circle1,circle2);
        return set;
      case "next-wrong-target":
        var circle1 = this.circle(x, y, stoneWidth/4)
        .attr({
          fill : "none",
          stroke : "red",
          "stroke-width" : stoneWidth/20
        });
        var circle2 = this.circle(x, y, stoneWidth/8)
          .attr({
            fill : "red",
            stroke : "none",
            "stroke-width" : stoneWidth/20
          });
        var set = this.set();
        set.push(circle1,circle2);
        return set;
      default:
        return null;
      }
    };
  },

  /**
   * Returns the stroke width for the Board's lines.
   *
   * @param i the line's position (from 0 to boardSize -1)
   * @param crop The crop values.
   * @param isX True if it an X line.
   * @return The stroke width (in pixels) 0, 1 or 2
   */
  _getStrokeWidth : function (i, crop, isX) {
    if (!crop) {
      return i === 0 || i === (this.boardSize-1)? 2 : 1;
    }
    if (isX) {
      if (i === 0) {
        if (crop.top === 0)
          return 2;
        else
          return 0;
      }
      if (crop.top + crop.height === this.boardSize && i === (crop.height-1)) {
        return 2;
      }
      if (i >= (crop.height-1)) {
        return 0;
      }
      return 1;
    } else {
      if (i === 0) {
        if (crop.left === 0)
          return 2;
        else
          return 0;
      }
      if (crop.left + crop.width === this.boardSize && i === (crop.width-1)) {
        return 2;
      }
      if (i >= (crop.width-1)) {
        return 0;
      }
      return 1;
    }
  },

  /**
   * Returns true if the label has to be show.
   * @param i The label's position (from 0 to boardSize -1 ).
   * @param crop The crop values.
   * @param isX True if its on the X axis.
   * @return true if the label has to be show.
   */
  _showsLabel : function (i, crop, isX) {
    if (!crop) {
      return true;
    }
    if (isX) {
      if (i === 0) {
        // If it-s on the top and the crop of the top is 0, the show.
        if (crop.top === 0)
          return true;
        else
          return false;
      }
      if (crop.top + crop.height === this.boardSize && i === (crop.height-1)) {
        return true;
      }
      if (i >= (crop.height-1)) {
        return false;
      }
      return true;
    } else {
      if (i === 0) {
        if (crop.left === 0)
          return true;
        else
          return false;
      }
      if (crop.left + crop.width === this.boardSize && i === (crop.width-1)) {
        return true;
      }
      if (i >= (crop.width-1)) {
        return false;
      }
      return true;
    }
  },

  /**
   * From point to coordinates in raphael's paper.
   */
  _fromPointToCoord: function(point) {
    var coord = {};
    coord.x = this.playgroundSize.x + this.stoneSize * point.x;
    coord.y = this.playgroundSize.y + this.stoneSize * point.y;
    return coord;
  },

  /**
   * From coordinates in raphael's paper to point in the board.
   * @returns null if the event is out of the cropping area.
   */
  _fromEventToPoint: function(event) {
    var x = event.pageX - $(event.currentTarget).offset().left - 10;
    var y = event.pageY - $(event.currentTarget).offset().top - 10;
    var point = {};
    point.x = Math.floor((x - this.playgroundSize.x + this.stoneSize/2 ) / this.stoneSize);
    point.y = Math.floor((y - this.playgroundSize.y + this.stoneSize/2 ) / this.stoneSize);
    point.originalX = x;
    point.originalY = y;

    if (this.crop) {
      var limit = this.crop.left + this.crop.width - 1;
      if (this.crop.left + this.crop.width === this.boardSize) {
        // correction when the hover is on the edge of the board.
        limit = this.boardSize;
      }
      if ((point.x <= this.crop.left && this.crop.left > 0)
          || point.x >= limit) {
        return null;
      }

      limit = this.crop.top + this.crop.height - 1;
      if (this.crop.top + this.crop.height === this.boardSize) {
        // correction when the hover is on the edge of the board.
        limit = this.boardSize;
      }
      if ((point.y <= this.crop.top && this.crop.top > 0)
          || point.y >= limit) {
        return null;
      }
    }
    return point;
  },

  /**
   * Handles mouse down events.
   */
  _handleMouseDown: function(event) {
    var point = this._fromEventToPoint(event);
    if (point) {
      this.player.handleBoardMouseDown(point.x, point.y, point.originalX,
          point.originalY, event);
    }
  },

  /**
   * Handles mouse up events.
   */
  _handleMouseUp: function(event) {
    var point = this._fromEventToPoint(event);
    if (point) {
      this.player.handleBoardMouseUp(point.x, point.y);
    }
  },

  /**
   * Handles mouse move events.
   */
  _handleMouseMove: function(event) {
    var point = this._fromEventToPoint(event);
    if (point) {
      this.player.handleBoardHover(point.x, point.y, point.originalX,
          point.originalY, event);
    }
  },

  /**
   * Handles mouse leave events.
   */
  _handlerMouseLeave: function(event) {
    this.removeHoverStone();
  },
  
  // TODO In IE9 and Chrome Raphaeljs was adding this attribute to the
  // text elements, breaking everything up. I don't know why.
  _fixVerticalAlignBug : function (textElement) {
    var $tspan = $(textElement.node).find("tspan");
    if ($tspan.attr("dy")) {
      $tspan.attr("dy", 0);
    }

  }
};

script = undefined;
path = undefined;
mydir = undefined;