'use strict';


var Fs = require('fs');
var JsYaml = require('js-yaml');
var Underscore = require('underscore');


var Common = module.exports = {};


JsYaml.addConstructor('!clean', function (node) {
  var result = this.constructMapping(node);
  result['!!'] = 'clean';
});



Common.mergeConfigs = function (dst, src) {
  if (!src) { return; }

  Underscore.each(src, function (v, k) {
    if (!Underscore.isObject(v)) {
      dst[k] = v;
      return;
    }

    if (v['!!'] && 'clean' === v['!!']) {
      dst[k] = {};
      delete v['!!'];
    }

    Common.mergeConfigs(dst, v);
  });
};


Common.readConfigFile = function (file, callback) {
  Fs.readFile(file, function (err, data) {
    var config = {};

    if (err) {
      callback(err);
      return;
    }

    Underscore.each(JsYaml.load(data).shift(), function (obj, key) {
      if ('^' === key[0] && key.substr(1).toLower() === global.nodeca.env) {
        Underscore.extend(config, obj);
      } else if ('^' !== key[0]) {
        config[key] = obj;
      }
    });

    callback(null, config);
  });
};
