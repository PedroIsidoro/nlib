var uglify = require('uglify-js');


// for possible options see:
// https://github.com/mishoo/UglifyJS/blob/master/uglify-js.js
var init_uglify_plugin = function init_uglify_plugin(options) {
  return function uglify_plugin(path, data) {
    var uglified = uglify(data.buffer.toString(), options);
    data.buffer = new Buffer(uglified);
  };
};


module.exports = init_uglify_plugin();
module.exports.init = init_uglify_plugin;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
