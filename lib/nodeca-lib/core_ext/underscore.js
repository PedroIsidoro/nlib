var _ = require('underscore');


if (_.delete) {
  warn("_.delete got merged into upstream");
} else {
  exports.delete = function(obj, key) {
    var val = obj[key];
    delete obj[key];
    return val;
  };
};


if (_.uncamelize) {
  warn("_.uncamelize got merged into upstream");
} else {
  exports.uncamelize = function uncamelize(str) {
    // RegExps are copy-pasted from RoR's ActiveSupport
    return str.replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2')
              .replace(/([a-z\d])([A-Z])/g,'$1 $2');
  };
}


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
