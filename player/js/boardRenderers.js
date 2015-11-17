/**
 * @class An HTML/DOM-based board renderer.
 */
eidogo.BoardRendererHtml = function() {
    this.init.apply(this, arguments);
}
eidogo.BoardRendererHtml.prototype = {
    /**
     * The board width.
     */
    boardWidth : null,
    /**
     * @constructor
     * @param {HTMLElement} domContainer Where to put the board
     */
    init: function(domContainer, boardSize, player, crop, shrinkBoard) {
        if (!domContainer) {
            throw "No DOM container";
            return;
        }
        this.boardSize = boardSize || 19;

        this.detectDimensions();

        this.boardCoords = {
          top: document.createElement('div'),
          left: document.createElement('div'),
          right: document.createElement('div'),
          bottom: document.createElement('div')
        }

        this.boardCoords.top.className = "coords top size" + this.boardSize;
        this.boardCoords.left.className = "coords sides size" + this.boardSize;
        this.boardCoords.right.className = "coords sides size" + this.boardSize;
        this.boardCoords.bottom.className = "coords bottom size" + this.boardSize;

        var domGutter = document.createElement('div');
        domGutter.className = "board-gutter with-coords";
        domGutter.style.width = this.boardWidth + "px";
        domGutter.style.height = this.boardWidth + "px";

        domContainer.appendChild(this.boardCoords.top);
        domContainer.appendChild(this.boardCoords.left);
        domContainer.appendChild(domGutter);
        domContainer.appendChild(this.boardCoords.right);
        domContainer.appendChild(this.boardCoords.bottom);

        var domBoard = document.createElement('div');
        domBoard.className = "board size" + this.boardSize;
        domBoard.style.position = "relative";
        domGutter.appendChild(domBoard);
        this.domNode = domBoard;
        this.domGutter = domGutter;
        this.domContainer = domContainer;
        this.player = player;
        this.uniq = domContainer.id + "-";
        this.renderCache = {
            stones: [].setLength(this.boardSize, 0).addDimension(this.boardSize, 0),
            markers: [].setLength(this.boardSize, 0).addDimension(this.boardSize, 0)
        }

        // needed to accommodate IE's broken layout engine
        this.scrollX = 0;
        this.scrollY = 0;
        
        if (crop) {
            this.crop(crop, shrinkBoard);
        }
        
        // add the search region selection box for later use
        this.dom = {};
        this.dom.searchRegion = document.createElement('div');
        this.dom.searchRegion.id = this.uniq + "search-region";
        this.dom.searchRegion.className = "search-region";
        this.domNode.appendChild(this.dom.searchRegion);
        
        eidogo.util.addEvent(this.domNode, "mousemove", this.handleHover, this, true);
        eidogo.util.addEvent(this.domNode, "mousedown", this.handleMouseDown, this, true);
        eidogo.util.addEvent(this.domNode, "mouseup", this.handleMouseUp, this, true);
        $(this.domNode).mouseleave(this.handlerMouseLeave);
    },

    /**
     * Sets this.pointWidth, this.pointHeight, this.boardWidth and
     * this.coordinatesSize
     * @return
     */
    detectDimensions : function () {
      var $temporalContainer = $('<div class="eidogo-player">').hide()
          .appendTo('body');
      
      // As we are loading all the dom on memory IE has a problem reading the
      // applied properties via css, so we need to append it and then remove
      // it.
      var $stone = $(this.createStoneElement({x:10,y:10}, "black"));
      $stone.appendTo($temporalContainer);
      this.pointWidth = this.pointHeight = $stone.outerWidth();
      $stone.remove();

      this.createStoneElement({x:0,y:0}, "black"); // just for image caching
      this.createStoneElement({x:0,y:0}, "white"); // just for image caching
      this.createStoneElement({x:0,y:0}, "current"); // just for image caching

      // As we are loading all the dom on memory IE has a problem reading the
      // applied properties via css, so we need to hardcode it.
      var $board = $('<div class="board size' + this.boardSize + '">');
      $board.appendTo($temporalContainer);
      this.boardWidth = ($board.outerWidth());
      $board.remove();

      this.margin = (this.boardWidth - (this.boardSize * this.pointWidth)) / 2;

      var $coordinates = $('<div class="coords sides size' + this.boardSize +'">');
      $coordinates.appendTo($temporalContainer);
      this.coordinatesSize = $coordinates.outerWidth();
      $coordinates.remove();

      $temporalContainer.remove();
    },

    showRegion: function(bounds) {
        this.dom.searchRegion.style.top = (this.margin + this.pointHeight * bounds[0]) + "px";
        this.dom.searchRegion.style.left = (this.margin + this.pointWidth * bounds[1]) + "px";
        this.dom.searchRegion.style.width = this.pointWidth * bounds[2] + "px";
        this.dom.searchRegion.style.height = this.pointHeight * bounds[3] + "px";
        eidogo.util.show(this.dom.searchRegion);
    },
    hideRegion: function() {
        eidogo.util.hide(this.dom.searchRegion);  
    },
    clear: function() {
        this.domNode.innerHTML = "";
    },
    renderStone: function(pt, color) {
        var stone = document.getElementById(this.uniq + "stone-" + pt.x + "-" + pt.y);
        if (stone) {
            stone.parentNode.removeChild(stone);
        }
        if (color != "empty") {
            var div = this.createStoneElement(pt, color);
            div.css({
                left : (pt.x * this.pointWidth + this.margin - this.scrollX) + "px",
                top : (pt.y * this.pointHeight + this.margin - this.scrollY) + "px"
            });
            $(this.domNode).append(div);
        }
    },
    renderHoverStone: function(pt, color) {
        var stone = document.getElementById(this.uniq + "stone-" + pt.x + "-" + pt.y);
        if (stone) {
            return;
        }
        
        if (this.hoverPoint) {
          var hoverStone = $("#" + this.uniq + "stone-" + this.hoverPoint.x + "-" + this.hoverPoint.y);
          
          if (hoverStone.hasClass("hover")) {
            hoverStone.remove();
          }
          
        }
        
        if (color != "empty") {
            var div = this.createStoneElement(pt, color);
            div.addClass("hover");
            div.css({
                left : (pt.x * this.pointWidth + this.margin - this.scrollX) + "px",
                top : (pt.y * this.pointHeight + this.margin - this.scrollY) + "px"
            });
            $(div).mouseout(function() {
              $(this).remove();
              this.hoverPoint = null;
            });
            this.hoverPoint = pt;
            $(this.domNode).append(div);
        }
    },
    createStoneElement : function(pt, color) {
        var div = $("<div/>");
        div.attr({
            'class' : "point stone " + color,
            id :  this.uniq + "stone-" + pt.x + "-" + pt.y
        });
        return div;
    },
    renderMarker: function(pt, type) {
        if (this.renderCache.markers[pt.x][pt.y]) {
            var marker = document.getElementById(this.uniq + "marker-" + pt.x + "-" + pt.y);
            if (marker) {
                marker.parentNode.removeChild(marker);
            }
        }
        if (type == "empty" || !type) { 
            this.renderCache.markers[pt.x][pt.y] = 0;
            return null;
        }
        this.renderCache.markers[pt.x][pt.y] = 1;
        if (type) {
            var text = "";
            switch (type) {
                case "triangle":
                case "square":
                case "circle":
                case "ex":
                case "territory-white":
                case "territory-black":
                case "dim":
                case "current":
                    break;
                default:
                    if (type.indexOf("var:") == 0) {
                        text = type.substring(4);
                        type = "variation";
                    } else {
                        text = type;
                        type = "label";
                    }
                    break;
            }
            var div = document.createElement("div");
            div.id = this.uniq + "marker-" + pt.x + "-" + pt.y;
            div.className = "point marker " + type;
            try {
                div.style.left = (pt.x * this.pointWidth + this.margin - this.scrollX) + "px";
                div.style.top = (pt.y * this.pointHeight + this.margin - this.scrollY) + "px";
            } catch (e) {}
            div.appendChild(document.createTextNode(text));
            this.domNode.appendChild(div);
            return div;
        }
        return null;
    },
    setCursor: function(cursor) {
        this.domNode.style.cursor = cursor;
    },
    handleHover: function(e) {
        var xy = this.getXY(e);
        this.player.handleBoardHover(xy[0], xy[1], xy[2], xy[3], e);
    },
    handleMouseDown: function(e) {
        var xy = this.getXY(e);
        this.player.handleBoardMouseDown(xy[0], xy[1], xy[2], xy[3], e);
    },
    handleMouseUp: function(e) {
        var xy = this.getXY(e);
        this.player.handleBoardMouseUp(xy[0], xy[1]);
    },
    handlerMouseLeave: function(event) {
      $(".point.stone.hover").remove();
    },
    /**
     *  Gets the board coordinates (0-18) for a mouse event
    **/
    getXY: function(e) {
        var clickXY = eidogo.util.getElClickXY(e, this.domNode);
        
        var m = this.margin;
        var pw = this.pointWidth;
        var ph = this.pointHeight;
        
        var x = Math.round((clickXY[0] - m - (pw / 2)) / pw);
        var y = Math.round((clickXY[1] - m - (ph / 2)) / ph);
    
        return [x, y, clickXY[0], clickXY[1]];
    },
    crop: function(crop, shrinkBoard) {
        if (shrinkBoard) {
          eidogo.util.addClass(this.domContainer, "shrunk");
        }
        this.domGutter.style.overflow = "hidden";
        var width = crop.width * this.pointWidth + (this.margin * 2);
        var height = crop.height * this.pointHeight + (this.margin * 2);

        // This prevents the gutter to be bigger than the board.
        if (width > this.boardWidth) {
          width = this.boardWidth;//$(this.domNode).width();
        }
        // This prevents the gutter to be bigger than the board.
        if (height > this.boardWidth) {
          height = this.boardWidth;
        }

        this.domGutter.style.width = width + "px";
        this.domGutter.style.height = height + "px";

        var domNodeTop = (crop.top * this.pointHeight);
        var viewPortTop = this.boardWidth - height;
        // This prevents the board to be smaller than the viewport.
        if (viewPortTop >= 0 && domNodeTop > viewPortTop) {
          domNodeTop = viewPortTop;
        }

        var domNodeLeft = (crop.left * this.pointWidth);
        var viewPortLeft = this.boardWidth - width;
        // This prevents the board to be smaller than the viewport.
        if (viewPortLeft >= 0 && domNodeLeft > viewPortLeft) {
          domNodeLeft = viewPortLeft;
        }

        this.domNode.style.left = -1 * domNodeLeft + "px";
        this.domNode.style.top = -1 * domNodeTop + "px";

        this.boardCoords.top.style.width = width + "px";
        this.boardCoords.bottom.style.width = width + "px";
        this.boardCoords.left.style.height = height + "px";
        this.boardCoords.right.style.height = height + "px";

        /*
         * The coordinates from the sides needs an initial position because
         * they where constructed for a 19x19 board.
         */
        var initialSidesPosition = (19 - this.boardSize) * this.pointWidth;
        var topOffset = parseInt(this.domNode.style.top.match(/-?\d+/g)[0]);
        var sidesPosition = topOffset - initialSidesPosition + "px";

        this.boardCoords.top.style.backgroundPosition =
            this.domNode.style.left + " 0";
        this.boardCoords.bottom.style.backgroundPosition =
            this.domNode.style.left + " 0";
        this.boardCoords.left.style.backgroundPosition = "0 "
            + sidesPosition;
        this.boardCoords.right.style.backgroundPosition = "0 "
            + sidesPosition;

        this.domContainer.style.width = (width +
            (this.coordinatesSize * 2)) + "px";
        this.domContainer.style.height = (height +
            (this.coordinatesSize * 2)) + "px";
    }
}

/**
 * Flash board renderer
**/
eidogo.BoardRendererFlash = function() {
    this.init.apply(this, arguments);
}
eidogo.BoardRendererFlash.prototype = {
    /**
     * @constructor
     * @param {HTMLElement} domContainer Where to put the board
     */
    init: function(domContainer, boardSize, player, crop) {
        if (!domContainer) {
            throw "No DOM container";
            return;
        }
        this.ready = false;
        this.swf = null;
        this.unrendered = [];
        var swfId = domContainer.id + "-board";
        var so = new SWFObject(eidogo.playerPath + "/swf/board.swf", swfId,
            "421", "421", "8", "#665544");
        so.addParam("allowScriptAccess", "sameDomain");
        so.write(domContainer);
        var elapsed = 0;
        var initBoard = function() {
            swf = eidogo.util.byId(swfId);
            if (!swf || !swf.init) {
                if (elapsed > 2000) {            
                    throw "Error initializing board";
                    return;
                }
                setTimeout(arguments.callee.bind(this), 10);
                elapsed += 10;
                return;
            }
            this.swf = swf;
            this.swf.init(player.uniq, boardSize);
            this.ready = true;
        }.bind(this);
        initBoard();
    },
    showRegion: function(bounds) {
    },
    hideRegion: function() {
    },
    clear: function() {
        if (!this.swf) return;
        this.swf.clear();
    },
    renderStone: function(pt, color) {
        if (!this.swf) {
            this.unrendered.push(['stone', pt, color]);
            return;
        }
        for (var i = 0; i < this.unrendered.length; i++) {
            if (this.unrendered[i][0] == "stone") {
                this.swf.renderStone(this.unrendered[i][1], this.unrendered[i][2]);
            }
        }
        this.unrendered = [];
        this.swf.renderStone(pt, color);
    },
    renderMarker: function(pt, type) {
        if (!type) return;
        if (!this.swf) {
            this.unrendered.push(['marker', pt, type]);
            return;
        }
        for (var i = 0; i < this.unrendered.length; i++) {
            if (this.unrendered[i][0] == "marker") {
                this.swf.renderMarker(this.unrendered[i][1], this.unrendered[i][2]);
            }
        }
        this.unrendered = [];
        this.swf.renderMarker(pt, type);
    },
    setCursor: function(cursor) {
    },
    crop: function() {
    }
}

/**
 * @class ASCII board renderer! Kinda broken.
 */
eidogo.BoardRendererAscii = function(domNode, boardSize) {
    this.init(domNode, boardSize);
}
eidogo.BoardRendererAscii.prototype = {
    pointWidth: 2,
    pointHeight: 1,
    margin: 1,
    blankBoard: "+-------------------------------------+\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "|. . . . . . . . . . . . . . . . . . .|\n" +
                "+-------------------------------------+",
    init: function(domNode, boardSize) {
        this.domNode = domNode || null;
        this.boardSize = boardSize || 19;
        this.content = this.blankBoard;
    },
    clear: function() {
        this.content = this.blankBoard;
        this.domNode.innerHTML = "<pre>" + this.content + "</pre>";
    },
    renderStone: function(pt, color) {
        var offset = (this.pointWidth * this.boardSize + this.margin * 2)
            * (pt.y * this.pointHeight + 1)
            + (pt.x * this.pointWidth) + 2;
        this.content = this.content.substring(0, offset-1) + "."
            + this.content.substring(offset);
        if (color != "empty") {
            this.content = this.content.substring(0, offset-1) +
                (color == "white" ? "O" : "#") + this.content.substring(offset);
        }
        this.domNode.innerHTML = "<pre>" + this.content + "</pre>";
    },
    renderMarker: function(pt, type) {
        // I don't think this is possible
    }
}
