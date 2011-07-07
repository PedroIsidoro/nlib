var compress = require('compress-buffer').compress;


module.exports = function gzip_plugin(path, data) {
  var gzipped = compress(data.buffer);

  // save result ONLY if compression rate is 15% or higher
  if (0.85 < (gzipped.length / data.buffer.length)) {
    data.buffer.gzipped = gzipped;
  }
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
