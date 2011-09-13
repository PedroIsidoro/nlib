/**
 *  class Controller
 *
 *  During request processing, each registered store is being compiled and
 *  built-in into request object providing easy API to request settings later by
 *  Permission#filter handler.
 **/


/**
 *  Controller#permission(name) -> Permission
 *  Controller#permission(name, onFail) -> Permission
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
 *  - [[Permission]] constructor for `onFail` description
 **/
Controller.prototype.permission = function permission(name, onFail) {
  throw Error("Not yet implemented");
};


// vim:ts=2:sw=2
