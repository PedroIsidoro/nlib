var compress = require('compress-buffer').compress,
    $$ = require('../../utilities');


var init_gzip_plugin = function init_gzip_plugin(options) {
  options = $$.merge({throughput: 0.85}, options);

  // make sure throughput is number
  options.throughput = +options.throughput;

  return function gzip_plugin(path, data) {
    var gzipped = compress(data.buffer);

    // compress-buffer returns source buffer back in case if it's length less
    // than 32 bytes (egorFINE thinks that 32 looks better than minimal 18 bytes
    // defined by zlib). in this cse if compression fails we need to do nothing.
    if (gzipped === data.buffer) { return; }

    // do nothing if cmpression rate is lower than 15%
    if (options.throughput < (gzipped.length / data.buffer.length)) { return; }

    data.gzipped = gzipped;
  };
};


module.exports = init_gzip_plugin();
module.exports.init = init_gzip_plugin;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
