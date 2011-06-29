var assert = require('assert'),
    vows = require('vows'),
    mime = require('../lib/nodeca-lib/mime');


vows.describe('Mime').addBatch({
  "When getting type": {
    "for unknown extension Undefined is returned": function () {
      assert.isUndefined(mime.type('filename.unknownExtension'));
    }
  },
  "When getting extension": {
    "for unknown mime-type Undefined is returned": function () {
      assert.isUndefined(mime.extension('foobar/bazbaz'));
    }
  }
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
