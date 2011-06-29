/**
 *  class Mime
 *
 *  Collection of helper functions used by nodeca-lib and apps.
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
  'application/octet-stream':       ['bin', 'iso'],

  'audio/ogg':                      ['ogg', 'oga'],
  'audio/midi':                     ['mid', 'midi', 'kar'],
  'audio/mpeg':                     ['mp3'],
  'audio/webm':                     ['weba'],
  'audio/x-ms-wma':                 ['wma'],
  'audio/x-wav':                    ['wav'],

  'image/gif':                      ['gif'],
  'image/x-icon':                   ['ico'],
  'image/jpeg':                     ['jpg', 'jpeg', 'jpe'],
  'image/png':                      ['png'],
  'image/svg+xml':                  ['svg', 'svgz'],
  'image/tiff':                     ['tiff', 'tif'],

  'text/plain':                     ['txt', 'conf', 'list', 'log', 'ini', 'in'],
  'text/css':                       ['css'],
  'text/html':                      ['html', 'htm'],

  'video/x-flv':                    ['flv'],
  'video/ogg':                      ['ogv'],
  'video/quicktime':                ['mov', 'qt'],
  'video/mpeg':                     ['mpg'],
  'video/x-msvideo':                ['avi'],
  'video/x-ms-wmv':                 ['wmv'],
  'video/webm':                     ['webm']
});


Mime.type = dummy.type;
Mime.extension = dummy.extension;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
