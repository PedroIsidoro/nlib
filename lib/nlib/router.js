'use strict';


var Underscore = require('underscore');
var Crossroads = require('crossroads');
var JsYaml = require('js-yaml');


function string_to_api_method(nodeca, str) {
  var method = nodeca.server, parts = str.split('.');

  while (parts.length) {
    if (method.hasPropertyName(parts[0])) {
      method = method[parts.shift()];
    } else {
      /*jshint loopfunc:true*/
      return function () {
        var cb = Underscore.toArray(arguments).pop();
        cb(new Error("Method '" + str + "' not found"));
      };
    }
  }

  if ('function' !== typeof method) {
    return function () {
      var cb = Underscore.toArray(arguments).pop();
      cb(new Error("Calling scope '" + str + "' as method."));
    };
  }

  return method;
}


var Router = module.exports = function Router(nodeca) {
  this._nodeca = nodeca;
  this._routes = {};
};
