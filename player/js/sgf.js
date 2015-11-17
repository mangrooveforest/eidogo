/**
 * EidoGo -- Web-based SGF Editor
 * Copyright (c) 2007, Justin Kramer <jkkramer@gmail.com>
 * Code licensed under AGPLv3:
 * http://www.fsf.org/licensing/licenses/agpl-3.0.html
 *
 * Quick and dirty SGF parser.
 */

/**
 * @class Returns an SGF-like JSON object of the form:
 *      { PROP1: value,  PROP2: value, ..., _children: [...]}
 */
eidogo.SgfParser = function() {
    this.init.apply(this, arguments);
};
eidogo.SgfParser.prototype = {

    /**
     * Properties that add a stone to the board.
     */
    STONE_ADDED_PROPERTIES : ['B', 'W', 'AB', 'AW'],

    firstNode : null,

    /**
     * @constructor
     * @param {String} sgf Raw SGF data to parse
     */
    init: function(sgf, completeFn) {
        completeFn = (typeof completeFn == "function") ? completeFn : null;
        this.sgf = sgf;
        this.index = 0;
        this.firstNode = true;
        this.root = {_children: []};
        this.parseTree(this.root);
        completeFn && completeFn.call(this);
    },
    parseTree: function(curnode) {
        while (this.index < this.sgf.length) {
            var c = this.curChar();
            this.index++;
            switch (c) {
                case ';':
                    curnode = this.parseNode(curnode);
                    break;
                case '(':
                    this.parseTree(curnode);
                    break;
                case ')':
                    return;
                    break;
            }
        }
    },
    parseNode: function(parent) {
        var node = {_children: []};
        if (parent)
            parent._children.push(node);
        else
            this.root = node;
        node = this.parseProperties(node);

        return node;
    },
    parseProperties: function(node) {
        var key = "";
        var values = [];
        var i = 0;
        // stonePlayed flag: If there is a node that only has a comment (or
        // some another non played stone (W or B)), it keeps
        // adding info to the same node until the next move is a played a stone.
        var stonePlayed = false;
        // stonesAdded flag: If there is a bunch of comments and information
        // before the first stone is placed (AB, AW, B, or W), it keeps
        // adding info to the same node until a stone is added.
        // If this.firstNode is false, it is assumed that a stone has been
        // added.
        var stonesAdded = !this.firstNode;

        while (this.index < this.sgf.length) {
            var c = this.curChar();
            if (c == ';' || c == '(' || c == ')') {
                if (c == ';' && ((this.firstNode && !stonesAdded)
                    || (!this.firstNode && !stonePlayed))) {
                    // If it is the first node I must parse until a stone is
                    // added.
                    // If it's not the first node I must parse until a stone is
                    // played.
                    this.index++;
                    continue;
                }
                this.firstNode = false;
                break;
            }
            if (this.curChar() == '[') {
                if (this.firstNode &&
                    $.inArray(key, this.STONE_ADDED_PROPERTIES) !== -1) {
                  // a stone has been added, parse of the next node will not be
                  // stopped.
                  stonesAdded = true;
                }
                if (key === "B" || key == "W") {
                  // a stone has been played
                  stonePlayed = true;
                }
                while (this.curChar() == '[') {
                    this.index++;
                    values[i] = "";
                    while (this.curChar() != ']' && this.index < this.sgf.length) {
                        if (this.curChar() == '\\') {
                            this.index++;
                            // not technically correct, but works in practice
                            while (this.curChar() == "\r" || this.curChar() == "\n") {
                                this.index++;
                            }
                        }
                        values[i] += this.curChar();
                        this.index++;
                    }
                    // if it has the format KEY[xy][xy][xy][xy] the with 'i'
                    // we add all of them into 'values'
                    i++;
                    while (this.curChar() == ']' || this.curChar() == "\n" || this.curChar() == "\r") {
                        this.index++;
                    }
                }
                if (node[key]) {
                    if (!(node[key] instanceof Array)) {
                        node[key] = [node[key]];
                    }
                    node[key] = node[key].concat(values);
                } else {
                    node[key] = values.length > 1 ? values : values[0];
                }
                key = "";
                values = [];
                i = 0;
                continue;
            }
            if (c != " " && c != "\n" && c != "\r" && c != "\t") {
                key += c;
            }
            this.index++;
        }
        node.goproblems = {};
        if (node.C) {
          if (!(node.C instanceof Array)) {
            node.C = [node.C];
          }
          for (var i=0, len=node.C.length; i<len; i++) {
            if (/RIGHT/.test(node.C[i])) {
              node.C[i] = node.C[i].replace(/RIGHT/, "");
              node.goproblems.right = true;
            }
            if (/CHOICE/.test(node.C[i])) {
              node.C[i] = node.C[i].replace(/CHOICE/, "");
              node.goproblems.choice = true;
            }
            if (/NOTTHIS/.test(node.C[i])) {
              node.C[i] = node.C[i].replace(/NOTTHIS/, "");
              node.goproblems.notThis = true;
            }
            if (/FORCE/.test(node.C[i])) {
              node.C[i] = node.C[i].replace(/FORCE/, "");
              node.goproblems.force = true;
            }
            node.C[i] = $.trim(node.C[i]);
            if (!node.C[i]) {
              node.C.splice(i, 1);
            }
            if (node.C.length === 0) {
              delete node.C;
            }
          }
        }
        return node;
    },
    curChar: function() {
        return this.sgf.charAt(this.index);
    }
};
