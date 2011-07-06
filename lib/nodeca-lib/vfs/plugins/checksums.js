var crypto = require('crypto');


var hash = function hash(algorithm, buffer) {
  return crypto.createHash(algorithm).update(buffer).digest('hex');
};


module.exports = function checksums_plugin(path, data) {
  data.checksums = {
    md5: hash('md5', data.buffer),
    sha1: hash('sha1', data.buffer)
  };
};

////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
