/**
 * EidoGo -- Web-based SGF Editor
 * Copyright (c) 2007, Justin Kramer <jkkramer@gmail.com>
 * Code licensed under AGPLv3:
 * http://www.fsf.org/licensing/licenses/agpl-3.0.html
 *
 * This file contains GameNode and GameCursor.
 */

/**
 * For uniquely identifying nodes. Should work even if we have
 * multiple Player instantiations. Setting this to 100000 is kind of a hack
 * to avoid overlap with ids of as-yet-unloaded trees.
 */
eidogo.gameNodeIdCounter = 100000;

/**
 * @class GameNode holds SGF-like data containing things like moves, labels
 * game information, and so on. Each GameNode has children and (usually) a
 * parent. The first child is the main line.
 */
eidogo.GameNode = function() {
    this.init.apply(this, arguments);
};
eidogo.GameNode.prototype = {
    _id: null,
    _parent: null,
    _children: null,
    _preferredChild: null,

    /**
     * The number of external comments in the node.
     * @type Number
     */
    _externalCommentCount: null,

    /**
     * The list of iso nodes.
     * @type eidogo.GameNode[]
     */
    _isoNodes: null,

    /**
     * @constructor
     * @param {GameNode} parent Parent of the node
     * @param {Object} properties SGF-like JSON object to load into the node
     */
    init: function(parent, properties, id) {
        this.depth = {};
        this._id = (typeof id != "undefined" ? id : eidogo.gameNodeIdCounter++);
        this._children = [];
        this._preferredChild = 0;
        this._externalCommentCount = 0;
        this._isoNodes = [];
        this.setParent(parent || null);
        if (properties) {
            this.loadJson(properties);
        }
    },
    /**
     * Adds a property to this node without replacing existing values. If
     * the given property already exists, it will make the value an array
     * containing the given value and any existing values.
    **/
    pushProperty: function(prop, value) {
        if (this[prop]) {
            if (!(this[prop] instanceof Array))
                this[prop] = [this[prop]];
            if (!this[prop].contains(value))
                this[prop].push(value);
        } else {
            this[prop] = value;
        }
    },
    /**
     * Check whether this node contains the given property with the given
     * value
    **/
    hasPropertyValue: function(prop, value) {
        if (!this[prop]) return false;
        var values = (this[prop] instanceof Array ? this[prop] : [this[prop]]);
        return values.contains(value);
    },
    /**
     * Removes a value from property or properties. If the value is the only
     * one for the property, removes the property also. Value can be a RegExp
     * or a string
    **/
    deletePropertyValue: function(prop, value) {
        var test = (value instanceof RegExp) ?
            function(v) { return value.test(v); } :
            function(v) { return value == v; };
        var props = (prop instanceof Array ? prop : [prop]);
        for (var i = 0; prop = props[i]; i++) {
            if (this[prop] instanceof Array) {
                this[prop] = this[prop].filter(function(v) { return !test(v); });
                if (!this[prop].length) delete this[prop];
            } else if (test(this.prop)) {
                delete this[prop];
            }
        }
    },
    /**
     * Loads SGF-like data given in JSON format:
     *      {PROP1: VALUE, PROP2: VALUE, _children: [...]}
     * Node properties will be overwritten if they exist or created if they
     * don't.
     *
     * We use a stack instead of recursion to avoid recursion limits.
    **/
    loadJson: function(data, afterGameParse) {
        var jsonStack = [data], gameStack = [this];
        var jsonNode, gameNode;
        var i, len;
        while (jsonStack.length) {
            jsonNode = jsonStack.pop();
            gameNode = gameStack.pop();
            gameNode.loadJsonNode(jsonNode);
            len = (jsonNode._children ? jsonNode._children.length : 0);
            for (i = 0; i < len; i++) {
                jsonStack.push(jsonNode._children[i]);
                if (!gameNode._children[i])
                    gameNode._children[i] = new eidogo.GameNode(gameNode);
                gameStack.push(gameNode._children[i]);
            }
        }
    },
    /**
     * Adds properties to the current node from a JSON object
    **/
    loadJsonNode: function(data) {
        for (var prop in data) {
            if (prop == "_id") {
                this[prop] = data[prop].toString();
                eidogo.gameNodeIdCounter = Math.max(eidogo.gameNodeIdCounter,
                                                    parseInt(data[prop], 10));
                continue;
            }
            if (prop.charAt(0) != "_")
                this[prop] = data[prop];
        }
        if (this.W) {
          this.color = "white";
        } else if (this.B) {
          this.color = "black";
        }

        if (this.color && this._parent && !this._parent.color) {
          this._parent.color = this.color === "black"? "white" : "black";
        }
    },
    /**
     * Sets the parent node.
     * @param parent
     * @returns
     */
    setParent: function (parent) {
      this._parent = parent;
      if (this._parent && !isNaN(parseFloat(this._parent.depth.x))
          && isFinite(this._parent.depth.x)) {
        this.depth.x = this._parent.depth.x + 1;
      }
      if (this._parent) {
        this.lookForIsos();
      }
    },

    /**
     * Returns the parent node.
     * @returns
     */
    getParent: function () {
      return this._parent;
    },

    /**
     * Returns all the children nodes.
     * @returns
     */
    getChildren: function () {
      return this._children;
    },

    /**
     * Add a new child (variation)
    **/
    appendChild: function(node) {
        node.setParent(this);
        this._children.push(node);
    },
    /**
     * Returns all the properties for this node
    **/
    getProperties: function() {
        var properties = {}, propName, isReserved, isString, isArray;
        for (propName in this) {
            isPrivate = (propName.charAt(0) == "_");
            isString = (typeof this[propName] == "string");
            isArray = (this[propName] instanceof Array);
            if (!isPrivate && (isString || isArray))
                properties[propName] = this[propName];
        }
        return properties;
    },
    /**
     * Applies a function to this node and all its children, recursively
     * (although we use a stack instead of actual recursion)
     **/
    walk: function(fn, thisObj) {
        var stack = [this];
        var node;
        var i, len;
        while (stack.length) {
            node = stack.pop();
            var doContinue = fn.call(thisObj || this, node);
            if (doContinue === false) {
              break;
            }
            len = (node._children ? node._children.length : 0);
            for (i = 0; i < len; i++)
                stack.push(node._children[i]);
        }
    },
    /**
     * Applies a function to this node and all its children, recursively
     * (although we use a stack instead of actual recursion). It walks
     * only the first children.
     * If the function returns false the walk stops.
     **/
    walkFirstChildren: function(fn, thisObj) {
        var stack = [this];
        var node;
        var i, len;
        while (stack.length) {
            node = stack.pop();
            var doContinue = fn.call(thisObj || this, node);
            if (doContinue === false) {
              break;
            }
            len = (node._children ? node._children.length : 0);
            if (len > 0) {
              stack.push(node._children[0]);
            }
        }
    },
    /**
     * Applies a function to this node and all its parents. The calling stops
     * when the root node has been reached or when 'false' is returned by
     * the function.
     **/
    walkUp: function(fn) {
        var node = this;
        var doContinue = fn.call(node, node);
        while (node._parent && doContinue) {
            node = node._parent;
            var doContinue = fn.call(node, node);
        }
    },
    /**
     * Get the current black or white move as a raw SGF coordinate
    **/
    getMove: function() {
        if (typeof this.W != "undefined")
            return this.W;
        else if (typeof this.B != "undefined")
            return this.B;
        else if (typeof this.color != "undefined") {
          return "";
        } else {
          return null;
        }
    },
    /**
     * Empty the current node of any black or white stones (played or added)
    **/
    emptyPoint: function(coord) {
        var props = this.getProperties();
        var deleted = null;
        for (var propName in props) {
            if (propName == "AW" || propName == "AB" || propName == "AE") {
                if (!(this[propName] instanceof Array))
                    this[propName] = [this[propName]];
                this[propName] = this[propName].filter(function(val) {
                    if (val == coord) {
                        deleted = val;
                        return false;
                    }
                    return true;
                });
                if (!this[propName].length)
                    delete this[propName];
            } else if ((propName == "B" || propName == "W") && this[propName] == coord) {
                deleted = this[propName];
                delete this[propName];
            }
        }
        return deleted;
    },
    /**
     * Returns the node's position in its parent's _children array
    **/
    getPosition: function() {
        if (!this._parent) return null;
        var siblings = this._parent._children;
        for (var i = 0; i < siblings.length; i++)
            if (siblings[i]._id == this._id) {
                return i;
            }
        return null;
    },
    /**
     * Converts this node and all children to SGF
    **/
    toSgf: function() {
        var sgf = (this._parent ? "(" : "");
        var node = this;
        
        function propsToSgf(props) {
            if (!props) return "";
            var sgf = ";", key, val;
            for (key in props) {
                if (props[key] instanceof Array) {
                    val = props[key].map(function (val) {
                        return val.toString().replace(/\]/g, "\\]");
                    }).join("][");
                } else {
                    val = props[key].toString().replace(/\]/g, "\\]");
                }
                sgf += key + "[" + val  + "]";
            }
            return sgf;
        }
        
        sgf += propsToSgf(node.getProperties());
        
        // Follow main line until we get to a node with multiple variations
        while (node._children.length == 1) {
            node = node._children[0];
            sgf += propsToSgf(node.getProperties());
        }
        
        // Variations
        for (var i = 0; i < node._children.length; i++) {
            sgf += node._children[i].toSgf();
        }
        
        sgf += (this._parent ? ")" : "");

        return sgf;
    },

    /**
     * Utility function that returns all the leafs of a given node.
     * author: matias.niklison
     */
    getLeafs : function (theNode) {
        var node = theNode || this;
        var childrens = node._children;
        var leafs = [];

        for (var i = 0, len = childrens.length; i<len; i++) {
            if (childrens[i]._children.length === 0) {
                leafs.push(childrens[i]); 
            } else {
                var returned = this.getLeafs(childrens[i]);
                leafs = leafs.concat(returned);
            }
        }
        return leafs;
    },

    /**
     * Returns the color of a node using it's inmediate children. If it can't
     * it returns 'x'.
     */
    getOwnColorByChildrens : function (theNode) {
      var node = theNode || this;
      var color;
      if (!node._children || node._children.length === 0) {
        color = 'x';
      } else  if (node._children[0].W) {
        return 'b';
      } else if (node._children[0].B) {
        return 'w';
      } else {
        return 'x';
      }
    },

    /**
     * Sets if the node is offpath.
     */
    setOffPath : function (isOffPath) {
      this.offPath = isOffPath;
    },

    /**
     * Returns true if the node is off path, i.e., it was created by the user.
     */
    isOffPath : function () {
      return this.offPath;
    },

    hasComments: function () {
      return !!this.commentType;
    },

    /**
     * Get the moves that lead to this node. Caches the result.
     */
    getPathMoves: function () {
      if (this._pathMoves) {
        return this._pathMoves;
      }
      var path = [];
      var cur = new eidogo.GameCursor(this);
      path.push(cur.node.getMove());
      while (cur.previous()) {
          var move = cur.node.getMove();
          if (move) path.push(move);
      }
      this._pathMoves = path.reverse();
      return this._pathMoves;
    },

    /**
     * Get the moves that lead to this node, with the color in front.
     * The format is "(B|W)xx", with B or W the color of the stone and
     * xx the move.
     * Caches the result.
     */
    _getColorPathMoves: function () {
      if (this._colorPathMoves) {
        return this._colorPathMoves.slice(0);
      }
      var path = [];
      var cur = new eidogo.GameCursor(this);
      var color = cur.node.color == "black"? 'B' : 'W';
      var move = cur.node.getMove();
      if (move == null) {
        // This is not a valid node, we don't want to cache it.
        return [];
      }
      path.push(color + move);
      while (cur.previous()) {
          move = cur.node.getMove();
          if (move) {
            color = cur.node.color == "black"? 'B' : 'W';
            path.push(color + move);
          }
      }
      this._colorPathMoves = path.reverse();
      return this._colorPathMoves.slice(0);
    },

    /**
     * Returns the variation path, caches the result.
     * @returns
     */
    getPath: function () {
      if (this._path) {
        return this._path;
      }
      var cursor = new eidogo.GameCursor(this);
      this._path = cursor.getPath();
      return this._path;
    },

    /**
     * Returns true if this node in the path that the given node played.
     * @param node
     */
    onSamePath: function (node) {
      var myPath = this.getPathMoves().join("");
      var hisPath = node.getPathMoves().join("");
      return hisPath.indexOf(myPath) === 0;
    },

    /**
     * Returns true if this node is in the first variation path of the given
     * node.
     * @param node
     */
    onFirstVariationPath: function (node) {
      var myPath = this.getPathMoves().join("");
      var onFirstVariationPath = false;
      node.walkFirstChildren(function (childNode) {
        var childPath = childNode.getPathMoves().join("");
        if (childPath === myPath) {
          onFirstVariationPath = true;
          return false;
        }
        return true;
      });
      return onFirstVariationPath;
    },

    equals: function(node) {
      var myPath = this.getPathMoves().join("");
      var hisPath = node.getPathMoves().join("");
      return myPath === hisPath;
    },

    /**
     * Increases the number of external comments in numberOfComments.
     * @returns
     */
    increaseExternalCommentCount: function (numberOfComments) {
      this._externalCommentCount += numberOfComments;
    },

    /**
     * Returns the number of external comments in the node.
     */
    getExternalCommentCount: function () {
      return this._externalCommentCount;
    },

    isRoot: function () {
      // Checking _parent of _parent is to prevent returning to root
      return this._parent && !this._parent._parent;
    },

    getIsoNodes: function () {
      return this._isoNodes;
    },

    /**
     * Adds a node as it's iso node. (the board looks the same)
     * The node is only added if the target node doesn't already have this node
     * as an iso node.
     * @param node The node.
     */
    _addIsoNode: function (node) {
      var isoNodes = node.getIsoNodes();
      for (var i=0, len=isoNodes.length; i<len; i++) {
        if (isoNodes[i]._id === this._id) {
          return;
        }
      }
      this._isoNodes.push(node);
    },

    /**
     * Looks for other nodes that are the same as this.
     * As this method is called when the node is loaded only one
     * of the two nodes will have the reference to the other. This simplifies
     * the drawing.
     */
    lookForIsos: function () {
      if (!this.color) {
        // it's not a real stone, or it is the first stone, that has no iso.
        return;
      }
      var root = new eidogo.GameCursor(this).getGameRoot();
      var pathMoves = this._getColorPathMoves().sort();
      var pathMovesLength = pathMoves.length;
      var stringPathMoves = pathMoves.join("");
      var thisMove = this.getMove();

      root.walk($.proxy(function (node) {
        if (node._id == this._id) {
          return true;
        }

        var otherPathMoves = node._getColorPathMoves();
        // then I check if they have the same number of moves, and finally
        // if those moves are all the same, the order doesn't matter (that's
        // why I sorted them)
        if (otherPathMoves.length === pathMovesLength
            && otherPathMoves.sort().join("") == stringPathMoves) {
          this._getColorPathMoves();
          this._addIsoNode(node);
        }
      }, this));
    }
};

/**
 * @class GameCursor is used to navigate among the nodes of a game tree.
 */
eidogo.GameCursor = function() {
    this.init.apply(this, arguments);
};
eidogo.GameCursor.prototype = {
    /**
     * @constructor
     * @param {eidogo.GameNode} A node to start with
     */
    init: function(node) {
        this.node = node;
    },
    next: function(varNum) {
        if (!this.hasNext()) return false;
        varNum = (typeof varNum == "undefined" || varNum == null ?
            this.node._preferredChild : varNum);
        this.node = this.node._children[varNum];
        return true;
    },
    previous: function() {
        if (!this.hasPrevious()) return false;
        this.node = this.node._parent;
        return true;
    },
    /**
     * Return the next node to be played.
     * @param varNum The variation number. If null or undefined, the prefered
     *     child will be used.
     * @return The node to be played next. Null if it has no child.
     */
    getNext : function (varNum) {
      if (!this.hasNext()) return null;
      varNum = (typeof varNum == "undefined" || varNum == null ?
          this.node._preferredChild : varNum);
      return this.node._children[varNum];
    },
    hasNext: function(ignoreComments) {
      if (!ignoreComments) {
        return this.node && this.node._children.length > 0;
      } else {
        if (this.node && this.node._children.length > 0) {
          for (var i = 0, len = this.node._children.length; i < len; i++) {
            if (!this.node._children[i].commentType) {
              return true;
            }
          }
          return false;
        } else {
         return false;
        }
      }
    },
    hasPrevious: function() {
        // Checking _parent of _parent is to prevent returning to root
        return this.node && this.node._parent && this.node._parent._parent;
    },
    getNextMoves: function() {
        if (!this.hasNext()) return null;
        var moves = {};
        var i, node;
        for (i = 0; node = this.node._children[i]; i++)
            moves[node.getMove()] = i;
        return moves;
    },
    getNextColor: function() {
        var currentColor = this.getColor();
        if (currentColor) {
          return currentColor === "W" ? "B" : "W";
        }
        return null;
    },
    getNextNodeWithVariations: function() {
        var node = this.node;
        while (node._children.length == 1)
            node = node._children[0];
        return node;
    },
    getPath: function() {
        var n = this.node,
            rpath = [],
            mn = 0;
        while (n && n._parent && n._parent._children.length == 1 && n._parent._parent) {
            mn++;
            n = n._parent;
        }
        rpath.push(mn);
        while (n) {
            if (n._parent && (n._parent._children.length > 1 || !n._parent._parent))
                rpath.push(n.getPosition() || 0);
            n = n._parent;
        }
        return rpath.reverse();
    },
    getPathMoves: function() {
        var path = [];
        var cur = new eidogo.GameCursor(this.node);
        path.push(cur.node.getMove());
        while (cur.previous()) {
            var move = cur.node.getMove();
            if (move) path.push(move);
        }
        return path.reverse();
    },
    getMoveNumber: function() {
        var num = 0,
            node = this.node;
        while (node) {
            if (node.W || node.B) num++;
            node = node._parent;
        }
        return num;
    },
    getColor: function() {
      if (this.node.W || this.node.B) {
        return this.node.W ? "W" : "B";
      }
      for (var i = 0, node; node = this.node._children[i]; i++) {
        if (node.W || node.B) {
          return node.W ? "B" : "W";
        }
      }
      if (this.node._parent && (this.node._parent.W || this.node._parent.B)) {
        return this.node._parent.W ? "B" : "W";
      }
      return null;
    },
    getGameRoot: function() {
        if (!this.node) return null;
        var cur = new eidogo.GameCursor(this.node);
        // If we're on the tree root, return the first game
        if (!this.node._parent && this.node._children.length)
            return this.node._children[0];
        while (cur.previous()) {};
        return cur.node;
    },
    lookForIsosFromRoot: function () {
      var root = this.getGameRoot();
      root.walk(function (node) {
        node.lookForIsos();
      });
    }
};

