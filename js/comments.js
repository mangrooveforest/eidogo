
function tx(s) {
    if (eidogo.p18n[s]) return eidogo.p18n[s];
    return s;
}

go.problems.Comments = function(configuration) {
  this.init(configuration);
};

go.problems.Comments.prototype = {

  /**
   * The types of comments with their labels,
   */
  TYPES_OF_COMMENTS : {
        comment : tx("comment type"),
        question : tx("question"),
        correct : tx("correct type"),
        wrong : tx("wrong type")
  },

  /**
   * Default text for the textarea.
   */
  TEXTAREA_DEFAULT_TEXT : tx("add hint"),

  /**
   * Default text for the textarea when the user is not logged in.
   */
  TEXTAREA_NO_USER_TEXT : tx("need reg for comments"),

  /**
   * Method to be called to go to the comment's path. Never null.
   */
  goToPath : null,

  /**
   * The URL where the comments are retrieved.
   */
  commentsURL : null,

  /**
   * The URL where the comments are posted.
   */
  postCommentsURL : null,

  /**
   * To be called when the comments are loaded, with a map of the path and the
   * jsonComment as parameter. If the call fails, it will be called with an
   * empty map and a second parameter with 'true' as value.
   */
  onCommentsLoaded : null,

  /**
   * The dom elements:
   * <p>
   * {
   *   commentsContainer : main container,
   *   localComments : ,
   *   allComments : 
   * }
   * </p>
   */
  dom : null,

  /**
   * Map containing all the comments for a certain path.
   */
  pathCommentsMap : null,

  /**
   * The number of comments.
   */
  numberOfComments : null,

  /**
   * The number of active comments.
   */
  numberOfActiveComments : null,

  init : function(configuration) {
    if (!configuration.goToPath ||
        typeof configuration.goToPath !== "function") {
      throw "The goToPath Method cannot be undefined or null.";
    }
    this.goToPath = configuration.goToPath;
    this.pathCommentsMap = {};
    this.pathJsonCommentsMap = {};

    if (configuration.debugMode) {
      this.commentsURL = "mock/mockComments.json";
    } else if (!configuration.demoMode){
      if (!configuration.commentsURL) {
        throw "The comments Url cannot be undefined or null.";
      }
      this.commentsURL = configuration.commentsURL;
    }

    if (!configuration.demoMode){
      this.postCommentsURL = configuration.postCommentsURL;
    }

    if (!configuration.dbId) {
      throw "The dbId cannot be undefined or null.";
    }
    this.dbId = configuration.dbId;
    this.userId = configuration.userId;

    if (configuration.onCommentsLoaded &&
        typeof configuration.onCommentsLoaded == "function") {
      this.onCommentsLoaded = configuration.onCommentsLoaded;
    }

    this.dom = {};

    this.createDom();
  },

  createDom : function() {
    this.dom.commentsContainer = $("<div>");
    this.dom.commentsContainer.attr({
      id : 'comments-container',
      'class' : 'comments-container'
    });

    // TABS
    var tabsContainer = $('<ul class="tabs-container"/>')
        .appendTo(this.dom.commentsContainer);
    this.dom.localCommentsTab = $('<li id="local-comments-tab" class="local-comments"/>')
        .appendTo(tabsContainer);
    this.dom.localCommentsTab.text(tx("local comments"));
    this.dom.allCommentsTab = $('<li id="all-comments-tab" class="all-comments"/>')
        .appendTo(tabsContainer);
    this.dom.allCommentsTab.text(tx("all comments"));

    // SHOW DISABLED COMMENTS CHECKBOX
    $('<label class="disabled-comments">' +
      '<input type="checkbox"/> ' + tx("disabled comments") + '</label>')
        .appendTo(this.dom.commentsContainer).find('input')
        .change(function() {
          var disabledComment = $('#comments-container .comment.disabled');
          if(this.checked) {
            disabledComment.show();
          } else {
            disabledComment.hide();
          }
        });

    // CONTENT
    var content = $('<div class="content"/>').appendTo(this.dom.commentsContainer);

    this.dom.localComments = $('<div id="local-comments" class="local-comments"/>')
        .append('<div class="the-comments">').appendTo(content);
    this.dom.allComments = $('<div id="all-comments" class="all-comments"/>')
        .appendTo(content);

    this.dom.localCommentsTab.click(this.showLocalComments.bind(this));
    this.dom.allCommentsTab.click(this.showAllComments.bind(this));

    this.initAddComments();

    this.showLocalComments();

    this.requestComments();
  },

  /**
   * Initialices the add comments section.
   */
  initAddComments : function() {
    $('<from class="add-comment">' +
      '<span>' + tx("add header") + '</span>' +
        '<textarea></textarea>' +
        '<div>' +
          '<select></select>' +
      '<input type="submit" value="' + tx("submit") + '"/>' +
          '<div class="loading-image" style="display: none;"/>' +
          '<input type="hidden" class="path"/>' +
        '</div>' +
      '</form>'
    ).appendTo(this.dom.localComments);

    var $commentsDropdown = this.dom.localComments.find(".add-comment select");
    for (var key in this.TYPES_OF_COMMENTS) {
      if (this.TYPES_OF_COMMENTS.hasOwnProperty(key)) {
        $('<option value="' + key + '">').text(this.TYPES_OF_COMMENTS[key])
            .appendTo($commentsDropdown);
      }
    }

    var $textarea = this.dom.localComments.find(".add-comment textarea");
    var $submit = this.dom.localComments.find(".add-comment input");

    if (this.userId) {
      $textarea.attr('title', this.TEXTAREA_DEFAULT_TEXT);
      go.problems.utils.addDefaultValue($textarea);
      $submit.click($.proxy(this.sendComment, this));
    } else {
      $textarea.val(this.TEXTAREA_NO_USER_TEXT).attr('disabled', 'disabled');
      $submit.attr('disabled', 'disabled');
      $commentsDropdown.attr('disabled', 'disabled');
    }

  },

  getDom : function () {
    return this.dom.commentsContainer;
  },

  /**
   * Shows the local comments, hidding the other section.
   *
   * @param path {String} The path of the local comment to be shown. If not
   *     specified no comments will be added or removed.
   */
  showLocalComments : function (path) {
    this.dom.allCommentsTab.removeClass("selected");
    this.dom.allComments.hide();

    if (typeof(path) == 'string') {
      this.updateLocalComments(path);
    }

    this.dom.localCommentsTab.addClass("selected");
    this.dom.localComments.show();
  },

  /**
   * Shows the all the comments, hidding the other section.
   */
  showAllComments : function () {
    this.dom.localCommentsTab.removeClass("selected");
    this.dom.localComments.hide();

    this.dom.allCommentsTab.addClass("selected");
    this.dom.allComments.show();
  },

  /**
   * Updates the local comments.
   * @param path The path of the comment, if null or undefined the last path
   *     will be used-
   */
  updateLocalComments : function (path) {
    if (typeof(path) == 'string') {
      this.currentPath = path;
    }

    var comments = this.dom.localComments.find("div.the-comments");

    comments.html("");
    var localComments = this.pathCommentsMap[this.currentPath];
    if (localComments && localComments.length) {
      for (var i = 0, len = localComments.length; i < len; i++) {
        comments.append(localComments[i].clone());
      }
    }
  },

  /**
   * Populates the comments.
   */
  populate : function(jsonComments) {
    this.pathCommentsMap = {};
    this.pathJsonCommentsMap = {};

    for (var i=0, len=jsonComments.length; i<len; i++) {
      var jsonComment = jsonComments[i];

      if (!this.jsoncommentIsValid(jsonComment)) {
        continue;
      }

      var comment = $('<div class="comment">');

      var info = $('<div class="info">').appendTo(comment);
      
      $('<div class="left author">').text(jsonComment.author).appendTo(info);

      var entered = $('<div class="right entered">').text(jsonComment.entered).appendTo(info);
      if (jsonComment.genre) {
        entered.addClass(jsonComment.genre);
      }
      

      if (jsonComment.strength) {
        $('<div class="right strength">').text("/" + jsonComment.strength)
            .appendTo(info);
      }
      
      if (jsonComment.solveage) {
        $('<div class="right solveage">').text(jsonComment.solveage).appendTo(info);
      }

      var text = $('<div class="text">').text(jsonComment.text).appendTo(comment);
      if (jsonComment.alive != '1') {
        text.addClass("not-alive");
        comment.addClass("disabled");
        comment.hide();
        this.numberOfActiveComments--;
      }

      if (!this.pathCommentsMap[jsonComment.path]) {
        this.pathCommentsMap[jsonComment.path] = [];
        this.pathJsonCommentsMap[jsonComment.path] = [];
      }
      this.pathCommentsMap[jsonComment.path].push(comment.clone());
      this.pathJsonCommentsMap[jsonComment.path].push(jsonComment);

      var goToPositionButton = $(
                                 '<input type="button" value="' + tx("goto pos") + '" data-path="' +
          jsonComment.path + '" class="go-to-button">').appendTo(comment);

      var self = this;
      goToPositionButton.click (function (event) {
        self.goToPath($(event.target).attr("data-path"));
      });

      this.dom.allComments.append(comment);
    }
  },

  /**
   * Returns false if a json comment is invalid, true otherwise.
   *
   * @param jsonComment {Object} The json comment to validate.
   * @return Returns false if a json comment is invalid, true otherwise.
   */
  jsoncommentIsValid : function(jsonComment) {
    if (!jsonComment || jsonComment.author == null ||
        jsonComment.entered == null || jsonComment.text == null) {
      return false;
    } else {
      return true;
    }
  },

  requestComments : function (callback) {
    if (this.commentsURL) {
      var self = this;
      $.getJSON(this.commentsURL, {
          id : this.dbId
        }, $.proxy(function(data) {
          this.requestCommentsCallback(data, callback);
        }, this)).error(function() {
          self.pathCommentsMap = {};
          self.onCommentsLoaded(self.pathJsonCommentsMap, 0, true);
          if (callback) {
            callback(true);
          }
      });
    } else {
      this.requestCommentsCallback([], callback);
    }
  },

  requestCommentsCallback: function(data, callback) {
    this.numberOfComments = data.length;
    this.numberOfActiveComments = data.length;
    this.populate(data);
    if (this.onCommentsLoaded) {
      this.onCommentsLoaded(this.pathJsonCommentsMap,
          this.numberOfActiveComments);
    }
    if (callback) {
      callback();
    }
  },

  sendComment : function (theEvent) {
    var self = this;
    var $submit = $(theEvent.currentTarget);
    var $commentForm = $(theEvent.currentTarget).parent().parent();
    var $loading = $commentForm.find('.loading-image');

    if ($commentForm.find('textarea').hasClass("default-text")) {
      go.problems.utils.showMessageDialog(tx("empty comment error"));
      return false;
    }

    $submit.attr('disabled', 'disabled');
    $loading.show();
    if (this.postCommentsURL) {
      $.post(this.postCommentsURL, {
        prob : this.dbId,
        authorid : this.userId,
        comment : $commentForm.find('textarea').val().trim(),
        genre : $commentForm.find('select').val(),
        path : $commentForm.find('input.path').val()
        }, function(data) {
            self.requestComments(function() {
              $submit.removeAttr('disabled');
              $loading.hide();
              self.updateLocalComments();
            });
        }).error(function() {
          go.problems.utils.showMessageDialog("We are sorry but there was a " +
              "problem saving your comment, please try again later.");
          $submit.removeAttr('disabled');
          $loading.hide();
      });
    }
  }
};

