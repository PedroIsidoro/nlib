var crypto = require('crypto');


// simple wrapper over digest calculation
var sha1 = function sha1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
};


var sha1_plugin = function sha1_plugin() {
  return function sha1_plugin_handler(path, data) {
    data.sha1 = sha1(data.buffer);
  };
};


module.exports = sha1_plugin();
module.exports.init = sha1_plugin;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
