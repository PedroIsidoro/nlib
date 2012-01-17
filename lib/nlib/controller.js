/**
 *  class ActionController
 **/


'use strict';


// 3rd-party
var ExpressRailer = require('express-railer');


// internal
var Permission = require('./permission');


/**
 *  new ActionController(app)
 **/
var ActionController = module.exports = function ActionController(app) {
  ExpressRailer.Controller.call(this);


  // Application instance is essential
  if (!app) { throw Error("No application was provided."); }


  // Make sure each request knows about which application it belongs to
  this.before_filter(function (req, res, next) {
    req.app = app;
    next();
  });


  // hash of permissions
  var permissions = {};


  /**
   *  ActionController#permission(name) -> Application.Permission
   *  ActionController#permission(name, onFail) -> ApplicationPermission
   *
   *  Controller's permission accessor. 
   *
   *  ##### See Also
   *
   *  - [[Application.Permission]] constructor for `onFail` description
   **/
  this.permission = function permission(name, onFail) {
    if (undefined === permissions[name]) {
      app.logger.info("Adding new permission '" + name + "' into " + this.constructor.name);
      permissions[name] = new Permission(app, onFail);
    } else if (onFail) {
      app.logger.warn("Can't set onFail on existing '" + name + "' permission was created");
    }

    return permissions[name];
  };
};


ExpressRailer.Controller.adopts(ActionController);


// vim:ts=2:sw=2
