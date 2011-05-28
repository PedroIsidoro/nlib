var deepMerge = exports.deepMerge = function deepMerge(a, b) {
  Object.getOwnPropertyNames(b).forEach(function (prop) {
    if (a[prop] === b[prop]) {
      return;
    }

    if ('object' == typeof b[prop] && 'object' === typeof a[prop]) {
      deepMerge(a[prop], b[prop]);
    } else {
      a[prop] = b[prop];
    }
  });

  return a;
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
