var fs = require('fs');
var path = require('path');
var bower = require('bower');
var detectAmd = require('detect-amd');
var prompt = require('sync-prompt').prompt;

exports.project = function() {
  bower.commands.list().on('end', function(data) {
    var pkgs = makeArray(flatten(data.dependencies));
    pkgs.forEach(single);
  });
};

var single = exports.single = function(pkg) {
  if (isIgnored(pkg)) return;
  var main = getMain(pkg);
  var amd = detectAmd.fromFile(pkg.canonicalDir+'/'+main);
  if (amd === false) {
    createShimModule(pkg);
  } else if (amd.hasRelativeDeps) {
    createAdapterModule(pkg);
  } else {
    copyMain(pkg);
  }
};

function isIgnored(pkg) {
  return pkg.endpoint.name === 'requirejs';
}

function createShimModule(pkg) {
  var name = pkg.endpoint.name;
  console.log('# creating shim module for '+name);
  var global = prompt('What global does '+name+' export? ('+name+'): ');
  if (global === '') global = name;
  var dependencies = Object.keys(pkg.dependencies);
  var code = fs.readFileSync(pkg.canonicalDir+'/'+getMain(pkg)).toString();
  var src = "// wrapped by bower-import\n";
  src += 'define('+JSON.stringify(dependencies)+', function() {\n';
  src += code;
  src += '\n\n// exported by bower-import\nreturn window.'+global+' = '+global+';\n})';
  var location = pkg.canonicalDir+'.js';
  fs.writeFileSync(location, src);
}

function createAdapterModule(pkg) {
  var name = pkg.canonicalDir.split(path.sep).reverse()[0];
  console.log('# creating adapter module for '+name);
  var main = getMain(pkg).replace(/\.js$/, '');
  var src = 'define(["'+name+'/'+main+'"], function(module) { return module; });';
  var location = pkg.canonicalDir+'.js';
  fs.writeFileSync(location, src);
}

function copyMain(pkg) {
  console.log('# copying module '+pkg.endpoint.name);
  var src = pkg.canonicalDir+'/'+getMain(pkg);
  var dest = pkg.canonicalDir+'.js';
  fs.createReadStream(src).pipe(fs.createWriteStream(dest));
}

function getMain(dep) {
  if ('string' == typeof dep.pkgMeta.main) {
    return dep.pkgMeta.main;
  } else {
    // TODO: prompt for which one to use
    return dep.pkgMeta.main[0];
  }
}

function flatten(deps, list) {
  var dep;
  list = list || {};
  for (var name in deps) {
    dep = deps[name];
    list[name] = dep;
    if (dep.dependencies) {
      flatten(dep.dependencies, list);
    }
  }
  return list;
}

function makeArray(obj) {
  var arr = [];
  for (var key in obj) {
    arr.push(obj[key]);
  }
  return arr;
}
