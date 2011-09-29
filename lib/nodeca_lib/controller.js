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
var ActionController = module.exports = ActionController(app) {
  ExpressRailer.Controller.call(this);


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
   *  ##### Throws Error
   *
   *  - When permission with `name` not found.
   *  - When adding permission with duplicate name
   *
   *  ##### See Also
   *
   *  - [[Application.Permission]] constructor for `onFail` description
   **/
  this.permission = function permission(name, onFail) {
    if (undefined !== onFail) {
      if (undefined !== permissions[name]) {
        throw new Error("Duplicate permission name=" + name);
      }

      permissions[name] = new Permission(app.settings.get, onFail);
    }

    if (undefined === permissions[name]) {
      throw new Error("Permission '" + name + "' not found");
    }

    return permissions[name];
  };
};


ExpressRailer.Controller.adopts(ActionController);


// vim:ts=2:sw=2
