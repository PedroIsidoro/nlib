var uglify = require('uglify-js');


// for possible options see:
// https://github.com/mishoo/UglifyJS/blob/master/uglify-js.js
var uglify_plugin = function uglify_plugin(options) {
  return function uglify_plugin_handler(path, data) {
    var uglified = uglify(data.buffer.toString(), options);
    data.buffer = new Buffer(uglified);
  };
};


module.exports = uglify_plugin();
module.exports.init = uglify_plugin;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
