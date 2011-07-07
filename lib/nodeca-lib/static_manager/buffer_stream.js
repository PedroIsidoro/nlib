var Stream = require('stream').Stream,
    $$ = require('../utilities');


var BufferStream = module.exports = function BufferStream(buffer, options) {
  if (!(this instanceof BufferStream)) {
    return new BufferStream(buffer, options);
  }

  // call parent constructor
  Stream.call(this);

  options = $$.merge({bufferSize: 64 * 1024}, options);

  // buffer processor
  var push_data = function push_data(curr_idx) {
    process.nextTick(function () {
      var next_idx = curr_idx + options.bufferSize;

      if (buffer.length <= next_idx) {
        // last chunk. send and close stream
        self.end(buffer.slice(curr_idx));
      } else {
        // emit chunk write and run next round
        self.emit('data', buffer.slice(curr_idx, next_idx));
        push_data(next_idx);
      }
    });
  };

  // start buffer processor (on next tick).
  push_data(0);
};


require('util').inherits(BufferStream, Stream);


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
