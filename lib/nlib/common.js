'use strict';


var Fs = require('fs');
var JsYaml = require('js-yaml');
var _ = require('underscore');


var Common = module.exports = {};


// provide custom `!clean` tag constructor to JsYAML
// constructs mapping object with `!! => clean` pair
// that is used to decide whenever keys should be
// merged or overriden
JsYaml.addConstructor('!clean', function (node) {
  var result = this.constructMapping(node);
  result['!!'] = 'clean';
  return result;
});


// merge to configs. respects `!! => clean` instructions.
Common.mergeConfigs = function (dst, src) {
  _.each(src || {}, function (v, k) {
    if (v && 'clean' === v['!!']) {
      delete v['!!'];
      dst[k] = v;
      return;
    }

    if ((!_.isObject(v) && !_.isArray(v)) || (!_.isObject(dst[k]) && !_.isArray(dst[k]))) {
      dst[k] = v;
      return;
    }

    // both dst and src are obj or arr - merge recursively
    Common.mergeConfigs(dst[k], v);
  });

  return dst;
};
