var Renderer = require('stylus/lib/renderer'),
    Visitor = require('stylus/lib/visitor'),
    Evaluator = require('stylus/lib/visitor/evaluator'),
    Compiler = require('stylus/lib/visitor/compiler'),
    Parser = require('stylus/lib/parser'),
    nodes = require('stylus/lib/nodes'),
    utils = require('stylus/lib/utils'),
    dirname = require('path').dirname,
    inherits = require('util').inherits,
    $$ = require('../../utilities');


var VFSEvaluator = function VFSEvaluator(vfs) {
  Evaluator.apply(this, Array.prototype.slice.call(arguments, 1));


  var visit = Visitor.prototype.visit,
      self = this;


  var lookup = function lookupPatched(vfs, path, paths, ignore){
    var lookup_path, i = paths.length;

    // Absolute
    if ('/' == path[0] && vfs.has(path)) {
      return path;
    }

    // Relative
    while (i--) {
      lookup_path = paths[i] + '/' + path;
      if (ignore == lookup_path) continue;
      if (vfs.has(lookup_path)) {
        return lookup_path;
      }
    }
  };


  this.visit = function visitPatched(node) {
    try {
      return visit.call(this, node);
    } catch (err) {
      if (err.filename) throw err;
      err.lineno = node.lineno;
      err.filename = node.filename;
      err.stylusStack = self.stack.toString();
      try {
        err.input = vfs.get(err.filename).toString();
      } catch (err) {
        // ignore
      }
      throw err;
    }
  }

  // keep old visitImport for built-in functions
  this.visitImportOriginal = this.visitImport;


  this.visitImport = function visitImportPatched(import) {
    var found,
        root = this.root,
        path = this.visit(import.path).first;

    // Enusre string
    if (!path.string) throw new Error('@import string expected');
    var name = path = path.string;

    // Literal
    if (/\.css$/.test(path)) return import;
    path += '.styl';

    // Lookup
    found = lookup(vfs, path, this.paths, this.filename);
    found = found || lookup(vfs, name + '/index.styl', this.paths, this.filename);

    // Stylus needs access for their built-in `functions/index.styl`, so if we
    // failed find the import in our vfs, try original visitImport method.
    if (!found) { return this.visitImportOriginal(import); }

    // Expose imports
    import.path = found;
    import.dirname = dirname(found);
    this.paths.push(import.dirname);
    if (this.options._imports) this.options._imports.push(import);

    // Parse the file
    this.importStack.push(found);
    nodes.filename = found;

    var str = vfs.get(found).buffer.toString(),
        block = new nodes.Block,
        parser = new Parser(str, utils.merge({ root: block }, this.options));

    try {
      block = parser.parse();
    } catch (err) {
      err.filename = found;
      err.lineno = parser.lexer.lineno;
      err.input = str;
      throw err;
    }

    // Evaluate imported "root"
    block.parent = root;
    block.scope = false;
    var ret = this.visit(block);
    this.paths.pop();
    this.importStack.pop();

    return ret;
  };
};


inherits(VFSEvaluator, Evaluator);


// patched version of Renderer
var VFSRenderer = function VFSRenderer(vfs) {
  Renderer.apply(this, Array.prototype.slice.call(arguments, 1));


  this.render = function renderPatched() {
    var parser = this.parser = new Parser(this.str, this.options);

    try {
      // global cache - see above;
      nodes.filename = this.options.filename;

      var ast = parser.parse();

      this.evaluator = new VFSEvaluator(vfs, ast, this.options);
      ast = this.evaluator.evaluate();

      return new Buffer(new Compiler(ast, this.options).compile());
    } catch (err) {
      var options = {};

      options.input = err.input || this.str;
      options.filename = err.filename || this.options.filename;
      options.lineno = err.lineno || parser.lexer.lineno;

      throw utils.formatException(err, options);
    }
  };
};


inherits(VFSRenderer, Renderer);


// plugin factory
var stylus_plugin = function stylus_plugin(options) {
  options = $$.merge({compress: true}, options);

  return function stylus_plugin_handler(path, data) {
    var renderer = new VFSRenderer(this, data.buffer.toString(), {
      filename: path,
      compress: options.compress
    });

    data.css = renderer.render();
  };
};



module.exports = stylus_plugin();
module.exports.init = stylus_plugin;


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
