//  Each plugin must export `init([options])` method and instance with defaults
//  as module itself:
//
//      // file: plugins/dummy.js
//
//      var init_dummy = function init_dummy(options) {
//        var magic = +(options.magic || 42);
//
//        return function dummy_plugin(path, data) {
//          data.dummy = data.length * magic;
//        };
//      };
//
//      module.exports = init_dummy();
//      module.exports.init = init_dummy;

// TODO: Add API docks to all plugins

module.exports.checksums = require('./plugins/checksums');
module.exports.gzip = require('./plugins/gzip');
module.exports.stylus = require('./plugins/stylus');
module.exports.uglify = require('./plugins/uglify');


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
