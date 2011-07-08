var crypto = require('crypto'),
    $$ = require('../../utilities');


// simple wrapper over digest calculation
var hash = function hash(algorithm, buffer) {
  return crypto.createHash(algorithm).update(buffer).digest('hex');
};


var init_checksums_plugin = function init_checksums_plugin(options) {
  options = $$.merge({no_md5: false, no_sha1: false}, options);

  if (options.no_md5 && options.no_sha1) {
    throw Error("You must leave at least one checksum backend enabled");
  }

  return function checksums_plugin(path, data) {
    data.checksums = {};

    if (!options.no_md5) {
      data.checksums.md5 = hash('md5', data.buffer);
    }

    if (!options.no_sha1) {
      data.checksums.sha1 = hash('sha1', data.buffer);
    }
  };
};


module.exports = init_checksums_plugin();
module.exports.init = init_checksums_plugin;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
