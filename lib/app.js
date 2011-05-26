var path    = require('path'),
    fs      = require('fs'),
    yaml    = require('yaml'),
    railer  = require('express-railer');



var App = module.exports = function App(dirname) {
  this.__dirname = dirname;


  this.require = function require(file) {
    return require(path.join(dirname, 'lib', file));
  };


  this.model = function load_model(name) {
    return require(path.join(dirname, 'app/models', file));
  };
};



App.prototype.init = function init(config, callback) {
  if (undefined == callback) {
    callback = config;
    config   = false;
  }

  if (this.__config && false == config) {
    callback(null, this);
    return;
  }

  var file = path.join(this.__dirname, 'config', 'app.defaults.yml'),
      app  = this;

  fs.readFile(cfg_file, function (err, data) {
    if (err) {
      callback(err, app);
      return;
    }

    try {
      var defaults = yaml.eval(data.toString());
      app.__config = deep_merge(defaults, config || {});

      app.logger = require('winston');

      load_controllers(app);
      load_routes(app);

      callback(null, app);
    } catch (err) {
      callback(err, app);
    }
  });
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


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
