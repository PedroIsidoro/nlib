var uglify = require('uglify-js');


module.exports = function gzip_plugin(path, data) {
  var uglified = uglify(data.buffer.toString());
  data.buffer.uglified = new Buffer(uglified);
};


module.exports.DEFAULT_PATTERN = /\.js$/;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
