/**
 *  class Mime
 *
 *  Collection of helper functions used by nodeca-lib and apps.
 **/


'use strict';


var path = require('path'),
    $$ = require('./utilities');


var mime2ext = {}, // map of mime to extension
    ext2mime = {}; // map of extension to mime


exports.type = function type(file) {
  return ext2mime[path.extname(file).slice(1).toLowerCase()];
};


exports.extension = function extension(type) {
  return mime2ext[type.toLowerCase()];
};


// prefill maps
$$.each({
  'application/javascript':         ['js'],
  'application/octet-stream':       ['bin', 'dms', 'lha', 'lrf', 'lzh', 'so', 'iso', 'dmg', 'dist', 'distz', 'pkg', 'bpk', 'dump', 'elc', 'deploy'],
  'application/x-shockwave-flash':  ['swf'],
  'audio/midi':                     ['mid', 'midi', 'kar', 'rmi'],
  'audio/mp4':                      ['mp4a'],
  'audio/mpeg':                     ['mpga', 'mp2', 'mp2a', 'mp3', 'm2a', 'm3a'],
  'audio/ogg':                      ['oga', 'ogg', 'spx'],
  'image/jpeg':                     ['jpeg', 'jpg', 'jpe'],
  'image/png':                      ['png'],
  'image/svg+xml':                  ['svg', 'svgz'],
  'image/tiff':                     ['tiff', 'tif'],
  'image/bmp':                      ['bmp'],
  'image/gif':                      ['gif'],
  'image/x-icon':                   ['ico'],
  'text/css':                       ['css'],
  'text/html':                      ['html', 'htm'],
  'text/plain':                     ['txt', 'text', 'conf', 'def', 'list', 'log', 'in'],
  'video/mp4':                      ['mp4', 'mp4v', 'mpg4'],
  'video/ogg':                      ['ogv'],
  'video/quicktime':                ['qt', 'mov'],
  'video/webm':                     ['webm'],
  'video/x-flv':                    ['flv'],
  'video/x-ms-wmv':                 ['wmv'],
  'video/x-msvideo':                ['avi']
}, function (type, exts) {
  type = type.toLowerCase();
  mime2ext[type] = exts[0].toLowerCase();
  exts.forEach(function (ext) {
    ext2mime[ext.toLowerCase()] = type;
  });
});



////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
