var compress = require('compress-buffer').compress,
    $$ = require('../../utilities');


var init_gzip_plugin = function init_gzip_plugin(options) {
  options = $$.merge({throughput: 0.85}, options);

  // make sure throughput is number
  options.throughput = +options.throughput;

  return function gzip_plugin(path, data) {
    var gzipped = compress(data.buffer);

    // save result ONLY if compression rate is 15% or higher
    if (options.throughput < (gzipped.length / data.buffer.length)) {
      data.gzipped = gzipped;
    }
  };
};


module.exports = init_gzip_plugin();
module.exports.init = init_gzip_plugin;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
