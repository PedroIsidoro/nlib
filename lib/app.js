var path    = require('path'),
    fs      = require('fs'),
    yaml    = require('yaml'),
    railer  = require('express-railer');


var App = module.exports = function App(dirname) {
  this.__dirname    = dirname;
  this.__dispatcher = null;
  this.__router     = null;
};



Object.defineProperties(App.prototype, {
  dispatcher: {
    get: function get_dispatcher() {
      if (!this.__dispatcher) {
        this.__dispatcher = new railer.Dispatcher();
      }

      return this.__dispatcher;
    }
  },
  router: {
    get: function get_router() {
      if (!this.__router) {
        this.__router = new railer.Router(this.dispatcher);
      }

      return this.__router;
    }
  }
});



App.prototype.init = function init(callback) {
  if (this.__config) {
    callback();
    return;
  }

  var cfg_defaults = path.join(this.__dirname, 'config', 'app.defaults.yml'),
      application  = this;

  fs.readFile(cfg_defaults, function (err, data) {
    if (err) {
      callback(err, application);
      return;
    }

    try {
      application.__config = yaml.eval(data.toString());
      callback(null, application);
    } catch (err) {
      callback(err, application);
    }
  });
};
