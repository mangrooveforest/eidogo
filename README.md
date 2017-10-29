EidoGo
======

EidoGo is two things:

1. A site ([eidogo.com](http://eidogo.com/)) for refining your Go techniques, viewing games, and sharing games. The source for which is here, at the top level of this repo. It includes server-side PHP code and database data.

2. An embeddable HTML/CSS/JS SGF viewer. The source for that is in the [player directory](https://github.com/jkk/eidogo/tree/master/player) of this repo. It does not depend on any server-side code or data.

Goproblems EidoGo
=================

Modified to work specifically with goproblems.com. This means:

1. Understanding right and wrong variations
2. Showing a move tree
3. Sending results of problems to the server
4. How to show/add comments
5. Time trial support
6. Some other stuff I'm probably forgetting
7. Todo: verify submitted problems
8. Todo: problem search
