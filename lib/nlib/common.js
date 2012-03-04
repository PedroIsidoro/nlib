'use strict';


var Fs = require('fs');
var JsYaml = require('js-yaml');
var _ = require('underscore');


var Common = module.exports = {};


JsYaml.addConstructor('!clean', function (node) {
  var result = this.constructMapping(node);
  result['!!'] = 'clean';
});



Common.mergeConfigs = function (dst, src) {
  if (!!src) {
    _.each(src, function (v, k) {
      if (!_.isObject(v)) {
        dst[k] = v;
        return;
      }

      if (v['!!'] && 'clean' === v['!!']) {
        dst[k] = {};
        delete v['!!'];
      }

      if (!_.isObject(dst[k])) {
        dst[k] = {};
      }

      Common.mergeConfigs(dst[k], v);
    });
  }

  return dst;
};
