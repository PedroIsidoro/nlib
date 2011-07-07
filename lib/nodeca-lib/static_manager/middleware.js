var BufferStream = require('./buffer_stream');


var parseRange = function parseRange(size, str) {
  return str.substr(6).split(',').map(function (range) {
    var range = range.split('-'),
        start = parseInt(range[0], 10),
        end = parseInt(range[1], 10);

    // -500
    if (isNaN(start)) {
      start = size - end;
      end = size - 1;
    // 500-
    } else if (isNaN(end)) {
      end = size - 1;
    }

    // Invalid
    if (isNaN(start) || isNaN(end) || start > end) {
      return;
    }

    return {start: start, end: end};
  });
};


var invalidRange = function invalidRange(res) {
  var body = 'Requested Range Not Satisfiable';
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Length', body.length);
  res.statusCode = 416;
  res.end(body);
};


var notModified = function notModified(res) {
  Object.keys(res._headers).forEach(function(field){
    if (0 == field.indexOf('content')) {
      res.removeHeader(field);
    }
  });

  res.statusCode = 304;
  res.end();
};


var LAST_MODIFIED = (new Date(0)).toUTCString();


module.exports = function static_manager_middleware(vfs, cachebuster_re) {
  return function (req, res, next) {
    var url = parse(req.url),
        pathname = join('/', normalize(decodeURIComponent(url.pathname))),
        data = vfs.get(pathname.replace(cachebuster_re, '$1'));

    // file not found or incompatable http method, skip
    if (!data || ('GET' !== req.method && 'HEAD' !== req.method)) {
      next();
      return;
    }

    var ranges = null, opts = {};

    // We have a Range request
    if (req.headers.range) {
      if (ranges = parseRange(req.headers.range, data.buffer.length)) {
        // valid range
        opts.start = ranges[0].start;
        opts.end = ranges[0].end;

        res.statusCode = 206;
        res.setHeader('Content-Range',
                      'bytes ' + opts.start + '-' + opts.end + '/' + stat.size);
      } else {
        // invalid range
        invalidRange(res);
        return;
      }
    // stream the entire file
    } else {
      res.setHeader('Content-Length', data.buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=0');
      res.setHeader('Last-Modified', LAST_MODIFIED);
      res.setHeader('ETag', data.checksums.sha1 + '-' + data.buffer.length);

      // conditional GET support
      if (req.headers['if-modified-since'] || req.headers['if-none-match']) {
        notModified(res);
        return;
      }
    }

    // set content-type if it was not previously set
    if (!res.getHeader('content-type')) {
      res.setHeader('Content-Type', data.mime);
    }

    // notify that we accept ranges requests.
    // must be enabled, once buffer_stream will be able to serve it
    // res.setHeader('Accept-Ranges', 'bytes');
    // also res.end should be rewritten with chunk-streaming technique

    // transfer
    if ('HEAD' === req.method) {
      res.end();
      return;
    }

    res.end(data.buffer);
  };
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
