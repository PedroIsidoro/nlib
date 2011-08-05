'use strict';

var Server = module.exports = function Server(app) {
  if (!(this instanceof Server)) {
    return new Server(dirname, bootstrapper);
  }

  this.start = function start(config) {
    app.init(config, function (err) {
      // server will be started here
    });
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
