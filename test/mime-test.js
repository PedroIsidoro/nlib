'use strict';


var assert = require('assert'),
    vows = require('vows'),
    helpers = require('./helpers'),
    Mime = require('../lib/nodeca-lib/mime');


var well_known_mimes = {
  'application/javascript':         'js',
  'application/x-shockwave-flash':  'swf',

  'image/gif':                      'gif',
  'image/x-icon':                   'ico',
  'image/jpeg':                     'jpg',
  'image/png':                      'png',
  'image/svg+xml':                  'svg',
  'image/tiff':                     'tiff',

  'text/plain':                     'txt',
  'text/css':                       'css',
  'text/html':                      'html'
};


vows.describe('Mime').addBatch({
  "Type of unknown extension": {
    topic: new Mime,
    "is undefined": function (mime) {
      assert.isUndefined(mime.type('filename.unknownExtension'));
    }
  },
  "Extension of unknown type": {
    topic: new Mime,
    "is undefined": function (mime) {
      assert.isUndefined(mime.extension('foobar/bazbaz'));
    }
  },
  "New instance by default": helpers.knowNoMimes(new Mime, well_known_mimes),
  "Dummy instance": helpers.knowMimes(Mime, well_known_mimes)
}).export(module);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
