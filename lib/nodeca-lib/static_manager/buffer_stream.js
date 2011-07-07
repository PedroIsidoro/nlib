/** internal
 *  class BufferStream
 *
 *  Provides wrapper over Stream in order to provide stream features for
 *  buffers.
 **/


// WARNING: Most likely this code will not work. Need to copy-paste parts of
// WriteStream from fs core module


var Stream = require('stream').Stream,
    $$ = require('../utilities');


var BufferStream = module.exports = function BufferStream(buffer, options) {
  if (!(this instanceof BufferStream)) {
    return new BufferStream(buffer, options);
  }

  // call parent constructor
  Stream.call(this);

  options = $$.merge({
    bufferSize: 64 * 1024,
    start:      0,
    end:        buffer.length
  }, options);

  // self reference
  var self = this;

  // writes dta (if given) and closes the stream
  var close = function close(data) {
    if (data) {
      self.emit('data', data);
    }

    self.emit('end');
    self.emit('close');
  };

  // check given start/end ranges
  if (buffer.length < options.end || options.start >= options.end) {
    this.emit('error', Error('Invalid start/end range'));
    close();
    return;
  }

  // buffer processor
  var push_data = function push_data(curr_idx) {
    process.nextTick(function () {
      var next_idx = curr_idx + options.bufferSize;

      if (options.end <= next_idx) {
        // last chunk. send and close stream
        self.end(buffer.slice(curr_idx, options.end));
        close();
      } else {
        // emit chunk write and run next round
        self.emit('data', buffer.slice(curr_idx, next_idx));
        push_data(next_idx);
      }
    });
  };

  // start buffer processor (on next tick).
  push_data(options.start);
};


require('util').inherits(BufferStream, Stream);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
