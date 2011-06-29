var assert = require('assert'),
    vows = require('vows'),
    helpers = require('./helpers'),
    Mime = require('../lib/nodeca-lib/mime');


var well_known_mimes = {
  'application/javascript':         'js',
  'application/x-shockwave-flash':  'swf',
  'application/octet-stream':       'bin',

  'audio/ogg':                      'ogg',
  'audio/midi':                     'mid',
  'audio/mpeg':                     'mp3',
  'audio/webm':                     'weba',
  'audio/x-ms-wma':                 'wma',
  'audio/x-wav':                    'wav',

  'image/gif':                      'gif',
  'image/x-icon':                   'ico',
  'image/jpeg':                     'jpg',
  'image/png':                      'png',
  'image/svg+xml':                  'svg',
  'image/tiff':                     'tiff',

  'text/plain':                     'txt',
  'text/css':                       'css',
  'text/html':                      'html',

  'video/x-flv':                    'flv',
  'video/ogg':                      'ogv',
  'video/quicktime':                'mov',
  'video/mpeg':                     'mpg',
  'video/x-msvideo':                'avi',
  'video/x-ms-wmv':                 'wmv',
  'video/webm':                     'webm'
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
