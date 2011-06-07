var I18n = module.exports = function I18n(app, master) {
  var logger = app.logger;

  this.__ = function __(locale, str, obj, ctx) {
    return str;
  };

  this.__defineGetter__('middleware', function () {
    var self = this, master_locale = master;

    return function i18n_middleware(req, res, next) {
      if (!req.locale) {
        logger.error("Locale was not mixed into request before. Using master.");
        req.locale = master_locale;
      }

      res.local('__', function __(str, obj, ctx) {
        self.__(req.locale, str, obj, ctx);
      });

      next();
    };
  });
};
