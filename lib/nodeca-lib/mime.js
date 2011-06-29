/**
 *  class Mime
 **/


'use strict';


var path = require('path'),
    $$ = require('./utilities');


var Mime = module.exports = function Mime(map) {
  var mime2ext = {}, // map of mime to extension
      ext2mime = {}; // map of extension to mime


  this.type = function type(file) {
    return ext2mime[path.extname(file).slice(1).toLowerCase()];
  };


  this.extension = function extension(type) {
    return mime2ext[type.toLowerCase()];
  };


  $$.each(map, function (type, extensions) {
    type = type.toLowerCase();

    extensions.forEach(function (ext) {
      ext2mime[ext.toLowerCase()] = type;
    });

    mime2ext[type] = extensions[0].toLowerCase();
  });
};


// instance of Mime with basic map suitable for most of situations
var dummy = new Mime({
  'application/javascript':         ['js'],
  'application/x-shockwave-flash':  ['swf'],

  'image/gif':                      ['gif'],
  'image/x-icon':                   ['ico'],
  'image/jpeg':                     ['jpg', 'jpeg'],
  'image/png':                      ['png'],
  'image/svg+xml':                  ['svg'],
  'image/tiff':                     ['tiff', 'tif'],

  'text/plain':                     ['txt'],
  'text/css':                       ['css'],
  'text/html':                      ['html', 'htm']
});


Mime.type = dummy.type;
Mime.extension = dummy.extension;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
