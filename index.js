exports.App = require('./lib/app');

exports.start = function start(app) {
  app.init(function(err, app) {
    if (err) {
      console.error(err);
      process.exit(128);
      return;
    }
  });
};
