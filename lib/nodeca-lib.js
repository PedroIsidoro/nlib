// export 3rd-party libs first
exports.Express = require('express');
exports.Express.View = require('express/lib/view');
exports.ExpressRailer = require('express-railer');
exports.SimplePromise = require('simple-promise');

exports.Underscore = exports._ = require('underscore');
exports.Underscore.mixin(require('underscore.string'));
exports.Underscore.mixin(require('./nodeca-lib/core_ext/underscore'));

// export intenal components after
exports.Application = require('./nodeca-lib/application');
exports.ActionController = require('./nodeca-lib/controller');
exports.Settings = require('./nodeca-lib/settings');
exports.Utilities = require('./nodeca-lib/utilities');


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
