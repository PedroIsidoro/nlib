* Move server kickstarter into NodecaLib.Server
* Review config initialization
* Add app logger
* Logic of submodules initialization
* Statc assets merging
* Figure out WTF is wrong with module loading
* Add "delayed" methods calls to application so it will become call any of
  application methods before it was configured (like in mongoose)
* Add ability to register sub-app application_controller in main one:
    var baseCtrl = app.controller('application'),
        childCtrl = require('nodeca-users').controller('application');

    // call child app controller constructor with main app controller as
    // this context
    childCtrl.call(baseCtrl);
