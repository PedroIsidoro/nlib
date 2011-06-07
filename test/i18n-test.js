var assert = require('assert'),
    vows = require('vows'),
    I18n = require('../lib/i18n'),
    app = new (require('../lib/application'))(__dirname);


vows.describe('I18n').addBatch({
  "When middleware in use": {
    topic: function () {
      var i18n = new I18n(app, 'en'),
          callback = this.callback,
          req = {},
          res = {
            local: function (key, val) {
              res[key] = val;
            }
          };
      i18n.middleware(req, res, function () {
        callback(null, req, res);
      });
    },
    "response got extended with __ method accepting 3 arguments": function (nil, req, res) {
      assert.isFunction(res.__);
      assert.length(res.__, 3);
    },
    "master locale is used if request had none": function (nil, req, res) {
      assert.equal(req.locale, 'en');
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
