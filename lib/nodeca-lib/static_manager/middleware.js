var parse = require('url').parse,
    path = require('path');

// wipes out all Content-* headers, and send response without body
var send_status = function send_status(res, code) {
  // no content-type needed
  Object.keys(res._headers).forEach(function(field){
    if (0 == field.indexOf('content')) {
      res.removeHeader(field);
    }
  });

  res.statusCode = +code || 200;
  res.end();
};


// checks whenever request allows GZipped response
var gzip_is_allowed = function gzip_is_allowed(req) {
  return (0 <= (req.headers['accept-encoding'] || '').indexOf('gzip'));
};


// magic constant date. always in the past.
var LAST_MODIFIED = (new Date(191289600000)).toUTCString(); // January 24, 1976


module.exports = function static_manager_middleware(vfs, cachebuster_re) {
  return function (req, res, next) {
    var url = parse(req.url),
        pathname = path.join('/', path.normalize(decodeURIComponent(url.pathname))),
        data = vfs.get(pathname.replace(cachebuster_re, '$1'));

    // file not found or incompatable http method, skip
    if (!data || ('GET' !== req.method && 'HEAD' !== req.method)) {
      next();
      return;
    }

    // we do not support Range's yet
    if (req.headers.range) {
      send_status(res, 400);
      return;
    }

    var buffer = data.buffer;

    // if buffer has gzipped version and it's possible to send gzipped content
    if (data.gzipped && gzip_is_allowed(req)) {
      res.setHeader('Content-Encoding', 'gzip');
      buffer = data.gzipped;
    }

    res.setHeader('Vary', 'Accept-Encoding,User-Agent');
    res.setHeader('Cache-Control', 'public, max-age=0');
    res.setHeader('Last-Modified', LAST_MODIFIED);
    res.setHeader('Content-Length', buffer.length);

    // ETag is calculated on original buffer ALWAYS (even if we are sending
    // GZipped buffer in fact)
    res.setHeader('ETag', data.sha1 + '-' + data.buffer.length);

    // conditional GET support. 
    if (req.headers['if-modified-since'] || req.headers['if-none-match']) {
      send_status(res, 304);
      return;
    }

    // set content-type if it was not previously set
    if (!res.getHeader('content-type')) {
      res.setHeader('Content-Type', data.mime);
    }

    // transfer headers only.
    if ('HEAD' === req.method) {
      res.end();
      return;
    }

    res.end(buffer);
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
