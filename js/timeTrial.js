/**
 * Time trial widget.
 * @param configuration {Object} The configuration object.
 * @param configuration.trialId {String} The trial Id. Mandatory.
 * @param configuration.lives  {String} The number of lives left. Mandatory.
 * @param configuration.goproblems {go.problems.Player} The player. Mandatory.
 * @param configuration.totalTime {Integer} Total time to play the exercise,
 *   in seconds. Mandatory.
 * @returns {go.problems.TimeTrial}
 * @author Matias Niklison &lt;matias.niklison@gmail.com&gt;
 */
go.problems.TimeTrial = function (configuration) {
  this.init(configuration);
};

go.problems.TimeTrial.prototype = {

  /**
   * Time, in seconds, when the blink starts.
   */
  BLINK_TIME: 10,

  /**
   * The dom elements:
   */
  dom: null,

  /**
   * Database's id for the trial.
   */
  trialId: null,

  /**
   * Number of lives left.
   */
  lives: null,

  /**
   * Reference to the goproblem application.
   */
  goproblems: null,

  /**
   * Interval ID for the timer.
   */
  timerIntervalId: null,

  /**
   * Interval ID for the blink.
   */
  blinkIntervalId: null,

  /**
   * Total time to play the exercise, in seconds.
   */
  totalTime: null,

  /**
   * True when the game is over.
   */
  gameIsOver: null,

  problemId: null,

  trialResultHandlerURL: null,

  /**
   * Constructor.
   * @param configuration
   */
  init: function (configuration) {
    this.trialId = configuration.trialId;
    this.lives = configuration.lives;
    this.goproblems = configuration.goproblems;
    this.totalTime = configuration.totalTime;
    this.problemId = configuration.dbId;
    this.trialResultHandlerURL = configuration.trialResultHandlerURL;
    this.gameIsOver = false;

    this.dom = {};

    this.createDom();

    $(this.goproblems.player.dom.controlFirst).bind('click.timeTrial',
        this.onResetGame.bind(this));
    this.hideGoProblemsButtons();
  },

  /**
   * Creates the dom.
   */
  createDom: function () {
    this.dom.container = $(''
        + '<div id="time-trial-container" class="time-trial-container">'
        + '  <h3>Time Trial</h3>'
        + '  <div class="lives-container container">'
        + '    <h4>Lives left:</h4>'
        + '    <div class="lives-left">'
        + '      <div class="clear"></div>'
        + '    </div>'
        + '  </div>'
        + '  <div class="time-left container">'
        + '    <h4>Time left:</h4>'
        + '    <div class="timer">'
        + '      ' + this.getTimeString(this.totalTime)
        + '    </div>'
        + '    <div class="result-message">'
        + '      <div class="game-over">'
        + '        Game over'
        + '      </div>'
        + '    </div>'
        + '  </div>'
        + '</div>');
    this.dom.timer = this.dom.container.find(".timer");
    this.dom.livesLeft = this.dom.container.find(".lives-left");
    this.dom.success = this.dom.container.find(".result-message .success");
    this.dom.gameOver = this.dom.container.find(".result-message .game-over");

    var lifes = "";
    for (var life = 0; life < this.lives; life++) {
      lifes += '      <div class="live"></div>';
    }
    this.dom.livesLeft.prepend(lifes);
  },

  /**
   * Returns the dom.
   * @returns
   */
  getDom: function () {
    return this.dom.container;
  },

  /**
   * Returns the number of lives.
   * @returns
   */
  getLives: function () {
    return this.lives;
  },

  /**
   * Returns the time left as a string: "mm:ss"
   * @param timeLeft
   * @returns {String}
   */
  getTimeString: function (timeLeft) {
    var minutes = Math.floor(timeLeft / 60);
    var seconds = Math.floor(timeLeft % 60);
    if (seconds < 10) {
      seconds = "0" + seconds;
    }

    return minutes + ":" + seconds;
  },

  /**
   * Starts the timer. Won't start it the game is over.
   */
  startTimer: function () {
    if (this.gameIsOver) {
      // no timer when the game has finished.
      return;
    }

    this.stopBlink();
    this.dom.timer.removeClass("blink");
    this.startTime = new Date().getTime();
    this.updateTimer();
    this.timerIntervalId = setInterval(this.updateTimer.bind(this), 1000);
  },

  /**
   * Updates the timer clock.
   */
  updateTimer: function () {
    var timeLeft = this.totalTime - this.currentTime();
    if (timeLeft < 0) {
      this.looseLife(true);
      return;
    }
    if (timeLeft <= this.BLINK_TIME && this.blinkIntervalId == null) {
      this.dom.timer.addClass("blink");
      this.blinkIntervalId = setInterval(this.blink.bind(this), 500);
    }
    this.dom.timer.text(this.getTimeString(timeLeft));
  },

  /**
   * Called when the user restarts the exercise.
   */
  onResetGame: function () {
    if (this.timerIntervalId == null) {
      // this means that the timer is not running, so I should restart it and
      // the user won't loose a life.
      this.startTimer();
    } else {
      this.looseLife(true);
    }
  },

  /**
   * Called when the user loses a life.
   */
  looseLife: function (restartTimer) {
    this.lives--;
    this.updateResults(false);
    clearInterval(this.timerIntervalId);
    this.timerIntervalId = null;
    this.dom.livesLeft.find(".live:visible:last").hide();
    if (this.lives === 0) {
      this.gameOver(false);
    } else {
      if (restartTimer) {
        this.startTimer();
      }
    }
  },

  /**
   * Called whhen the user finishes the exercise, whether good or bad.
   * @param success
   */
  endGame: function (success) {
    clearInterval(this.timerIntervalId);
    if (success) {
      this.gameOver(success);
    } else {
      this.looseLife(false);
    }
  },

  /**
   * Called when there are no more lives.
   */
  gameOver: function (success) {
    if (success) {
      this.updateResults(success);
      this.dom.success.show();
    } else {
      this.dom.gameOver.show();
    }
    this.gameIsOver = true;
    $(this.goproblems.player.dom.controlFirst).unbind('click.timeTrial');
    this.showGoProblemsButtons();
    this.stopBlink();
  },

  /**
   * Hides the goproblems buttons that can't be used in the time trial.
   */
  hideGoProblemsButtons: function () {
    $(this.goproblems.player.dom.controlBack).hide();
    this.goproblems.showResultsLi.hide();
  },

  /**
   * Show the hidden goproblems buttons.
   */
  showGoProblemsButtons: function () {
    $(this.goproblems.player.dom.controlBack).show();
    this.goproblems.showResultsLi.show();
  },

  /**
   * Changes the timer color.
   */
  blink: function () {
    this.dom.timer.toggleClass("blink");
  },

  /**
   * Stops the blinking, if active.
   */
  stopBlink: function () {
    if (this.blinkIntervalId !== null) {
      clearInterval(this.blinkIntervalId);
      this.blinkIntervalId = null;
      this.dom.timer.addClass("blink");
    }
  },

  /**
   * Returns the seconds elapsed since the beginning of the exercise,
   * in seconds.
   */
  currentTime: function () {
    return parseInt((new Date().getTime() - this.startTime) / 1000);
  },

  updateResults: function (success) {
    let self = this;
    let lives = ((this.lives * this.problemId) << 8) + 91;
    fetch(self.trialResultHandlerURL,
        {
          method: 'POST',
          body: JSON.stringify({status: success, lives: lives}),
        }
    )
        .then(data => data.json())
        .then(function (data) {
          if (!data.active) {
            document.dispatchEvent(new CustomEvent('app_time_trial_finished', {
              detail: {
                id: data.id,
                solved: data.solved
              }
            }));
          } else if (data.lastProblemSolved && data.active) {
            document.dispatchEvent(new Event('app_time_trial_passed'));
          }
        })
        .catch(function (error) {
          console.log(error);
        });
  }
};
