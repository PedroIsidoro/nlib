/**
 *  NLib
 **/


'use strict';


exports.Application = require('./nlib/application');
exports.Permission = require('./nlib/permission');
exports.Settings = require('./nlib/settings');


/**
 *  NLib.Vendor
 **/
exports.Vendor = {
  /**
   *  NLib.Vendor.Async
   **/
  Async: require('async'),
  /**
   *  NLib.Vendor.FsTools
   **/
  FsTools: require('fs-tools'),
  /**
   *  NLib.Vendor.Underscore
   **/
  Underscore: require('underscore')
};
