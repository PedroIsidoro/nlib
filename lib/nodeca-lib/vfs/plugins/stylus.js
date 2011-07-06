var Renderer = require('stylus/lib/renderer'),
    Visitor = require('stylus/lib/visitor'),
    Evaluator = require('stylus/lib/visitor/evaluator'),
    Compiler = require('stylus/lib/visitor/compiler'),
    Parser = require('stylus/lib/parser'),
    nodes = require('stylus/lib/nodes'),
    utils = require('stylus/lib/utils'),
    dirname = require('path').dirname;


var lookup = function(vfs, path, paths, ignore){
  var lookup
    , i = paths.length;

  // Absolute
  if ('/' == path[0] && vfs.has(path)) {
    return path;
  }

  // Relative
  while (i--) {
    lookup = paths[i] + '/' + path;
    if (ignore == lookup) continue;
    if (vfs.has(lookup)) {
      return lookup;
    }
  }
};


var init_evaluator = function init_evaluator(vfs, root, options) {
  var evaluator = new Evaluator(root, options);
  var visit = Visitor.prototype.visit;

  evaluator.visit = function (node) {
    try {
      return visit.call(this, node);
    } catch (err) {
      if (err.filename) throw err;
      err.lineno = node.lineno;
      err.filename = node.filename;
      err.stylusStack = evaluator.stack.toString();
      try {
        err.input = vfs.get(err.filename).toString();
      } catch (err) {
        // ignore
      }
      throw err;
    }
  }

  var visitImportReal = evaluator.visitImport;
  var visitImportPatched = function visitImportPatched(import) {
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

    // Throw if import failed
    if (!found) throw new Error('failed to locate @import file ' + path);

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

  evaluator.visitImport = function (import) {
    try { return visitImportPatched.call(this, import); }
    catch (err) { /* ignore */ }
    return visitImportReal.call(this, import);
  }

  return evaluator;
};


var init_renderer = function init_renderer(vfs, path, options) {
  var renderer = new Renderer(vfs.get(path).buffer.toString(), options);

  renderer.render = function renderPatched() {
    nodes.filename = this.options.filename;

    var parser = this.parser = new Parser(this.str, this.options);
    var ast = parser.parse();

    this.evaluator = init_evaluator(vfs, ast, this.options);
    ast = this.evaluator.evaluate();

    return new Buffer(new Compiler(ast, this.options).compile());
  };

  return renderer;
}

module.exports = function stylus_processor(path, data) {
  data.buffer.css = init_renderer(this, path, {
    filename: path,
    compress: true
  }).render();
};


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////
