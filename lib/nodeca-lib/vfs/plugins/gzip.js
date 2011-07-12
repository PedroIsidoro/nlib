var compress = require('compress-buffer').compress,
    $$ = require('../../utilities');


var gzip_plugin = function gzip_plugin(options) {
  options = $$.merge({throughput: 0.85}, options);

  // make sure throughput is number
  options.throughput = +options.throughput;

  return function gzip_plugin_handler(path, data) {
    var gzipped = compress(data.buffer);

    // compress-buffer returns source buffer back, when it's length < 32 bytes.
    // do nothing in this case.
    if (gzipped === data.buffer) { return; }

    // do nothing if compression rate is lower than 15%
    if (options.throughput < (gzipped.length / data.buffer.length)) { return; }

    data.gzipped = gzipped;
  };
};


module.exports = gzip_plugin();
module.exports.init = gzip_plugin;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
