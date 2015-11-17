/**
 * EidoGo -- Web-based SGF Editor
 * Copyright (c) 2007, Justin Kramer <jkkramer@gmail.com>
 * Code licensed under AGPLv3:
 * http://www.fsf.org/licensing/licenses/agpl-3.0.html
 *
 * Go board-related stuff
 */

/**
 * @class Keeps track of board state and passes off rendering to a renderer.
 * We can theoretically have any kind of renderer. The board state is
 * independent of its visual presentation.
 */
eidogo.Board = function() {
    this.init.apply(this, arguments);
};
eidogo.Board.prototype = {
    WHITE: 1,
    BLACK: -1,
    EMPTY: 0,

    /**
     * The cache is used to avoid rendering stones that were already rendered
     * the last move.
     * (if the stone is in the cache and in the current move, don't render it
     * again)
     */
    cache: null,
    /**
     * @constructor
     * @param {Object} The renderer to use to draw the board. Renderers must
     * have at least three methods: clear(), renderStone(), and renderMarker()
     * @param {Number} Board size -- theoretically could be any size,
     * but there's currently only CSS for 9, 13, and 19
     */
    init: function(renderer, boardSize) {
        this.boardSize = boardSize || 19;
        this.stones = this.makeBoardArray(this.EMPTY);
        this.markers = this.makeBoardArray(this.EMPTY);
        this.captures = {};
        this.captures.W = 0;
        this.captures.B = 0;
        this.cache = [];
        this.renderer = renderer || new eidogo.BoardRendererHtml();
        this.lastRender = {
            stones: this.makeBoardArray(null),
            markers: this.makeBoardArray(null)
        };
    },
    reset: function() {
        this.init(this.renderer, this.boardSize);
    },
    clear: function() {
        this.clearStones();
        this.clearMarkers();
        this.clearCaptures();
    },
    clearStones: function() {
        // we could use makeBoardArray(), but this is more efficient
        for (var i = 0; i < this.stones.length; i++) {
            this.stones[i] = this.EMPTY;
        }
    },
    clearMarkers: function() {
        for (var i = 0; i < this.markers.length; i++) {
            this.markers[i] = this.EMPTY;
        }
    },
    clearCaptures: function() {
        this.captures.W = 0;
        this.captures.B = 0;
    },
    makeBoardArray: function(val) {
        // We could use a multi-dimensional array but doing this avoids
        // the need for deep copying during commit, which is very slow.
        return [].setLength(this.boardSize * this.boardSize, val);
    },
    /**
     * Save the current state. This allows us to revert back
     * to previous states for, say, navigating backwards in a game.
     */
    commit: function() {
      // FIXME this method is getting called multiple times on start!!
      var areEqual = true;

      var lastCache = this.cache.last();
      if (lastCache) {
        areEqual = (this.captures.W === lastCache.captures.W
            && this.captures.B === lastCache.captures.B);
        for (var i=0, len = lastCache.stones.length; i < len && areEqual; i++) {
          if (this.stones[i] !== lastCache.stones[i]) {
            areEqual = false;
          }
        }
      } else {
        areEqual = false;
      }
      if (!areEqual) {
        this.cache.push({
            stones: this.stones.concat(),
            captures: {W: this.captures.W, B: this.captures.B}
        });
      }
    },
    /**
     * Undo any uncomitted changes.
     */
    rollback: function() {
        if (this.cache.length > 2) {
            var previousCache = this.cache[this.cache.length - 2];
            this.stones = previousCache.stones.concat();
            this.captures.W = previousCache.captures.W;
            this.captures.B = previousCache.captures.B;
        } else {
            this.clear();
        }
    },
    /**
     * Revert to a previous state.
     */
    revert: function(steps) {
        steps = steps || 1;
        for (var i = 0; i < steps; i++) {
            this.rollback();
            this.cache.pop();
        }
    },
    addStone: function(pt, color) {
        this.stones[pt.y * this.boardSize + pt.x] = color;
    },
    getStone: function(pt) {
        return this.stones[pt.y * this.boardSize + pt.x];
    },
    getRegion: function(t, l, w, h) {
        var region = [].setLength(w * h, this.EMPTY);
        var offset;
        for (var y = t; y < t + h; y++) {
            for (var x = l; x < l + w; x++) {
                offset = (y - t) * w + (x - l);
                region[offset] = this.getStone({x:x, y:y});
            }
        }
        return region;
    },
    addMarker: function(pt, type) {
        this.markers[pt.y * this.boardSize + pt.x] = type;
    },
    getMarker: function(pt) {
        return this.markers[pt.y * this.boardSize + pt.x];
    },
    render: function(complete) {
        var stones = this.makeBoardArray(null);
        var markers = this.makeBoardArray(null);
        var color, type;
        var len;
        if (!complete && this.cache.last()) {
            var lastCache = this.cache.last();
            len = this.stones.length;

            // render only points that have changed since the last render
            // and that don't have a marker (I need to know the color
            // of the stone underneath the marker).
            for (var i = 0; i < len; i++) {
                if (lastCache.stones[i] != this.lastRender.stones[i]
                  || (lastCache.stones[i] != 0 && this.markers[i] != 0)) {
                    stones[i] = lastCache.stones[i];
                }
            }
            markers = this.markers;
        } else {
            // render everything
            stones = this.stones;
            markers = this.markers;
        }
        var offset;
        for (var x = 0; x < this.boardSize; x++) {
            for (var y = 0; y < this.boardSize; y++) {
                offset = y * this.boardSize + x;
                if (stones[offset] != null) {
                    if (stones[offset] == this.EMPTY) {
                        color = "empty";
                    } else {
                        color = (stones[offset] == this.WHITE ? "white" : "black");
                    }
                    this.renderer.renderStone({x: x, y: y}, color);
                    this.lastRender.stones[offset] = stones[offset];
                }
                if (markers[offset] != null) {
                    var isOverStone = (this.lastRender.stones[offset] != this.EMPTY);
                    color = (stones[offset] == this.WHITE ? "white" : "black");
                    this.renderer.renderMarker({x: x, y: y}, markers[offset],
                        isOverStone, isOverStone? color : null);
                    this.lastRender.markers[offset] = markers[offset];
                }
            }
        }
    }
};

