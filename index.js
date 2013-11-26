var fs = require('fs');
var path = require('path');
var bower = require('bower');
var detectAmd = require('detect-amd');
var detectGlobals = require('detect-globals');
var prompt = require('sync-prompt').prompt;
var color = require('cli-color');

exports.project = function() {
  bower.commands.list().on('end', function(data) {
    var pkgs = makeArray(flatten(data.dependencies));
    pkgs.forEach(single);
  });
};

var single = exports.single = function(pkg) {
  if (isIgnored(pkg)) return;
  var main = getMain(pkg);
  var mainPath = pkg.canonicalDir+'/'+main;
  var amd = detectAmd.fromFile(mainPath);
  if (amd === false) {
    createShimModule(pkg, mainPath);
  } else if (amd.hasRelativeDeps) {
    createAdapterModule(pkg);
  } else {
    copyMain(pkg);
  }
};

function isIgnored(pkg) {
  return pkg.endpoint.name === 'requirejs';
}

function createShimModule(pkg, mainPath) {
  var name = pkg.endpoint.name;
  console.log('# creating shim module for '+name);
  var globals = detectGlobals.fromFile(mainPath);
  var filtered = globals.filter(function(global) {
    return global && global.toLowerCase() === name.replace(/\.js$/, '');
  });
  var global;
  if (filtered.length) {
    global = filtered[0];
  } else {
    global = prompt(color.blue('> what global does '+name+' export? ('+name+'): '));
    if (global === '') global = name;
  }
  var dependencies = Object.keys(pkg.dependencies);
  var code = fs.readFileSync(pkg.canonicalDir+'/'+getMain(pkg)).toString();
  var src = "// wrapped by bower-import\n";
  src += 'define('+JSON.stringify(dependencies)+', function() {\n';
  src += code;
  src += '\n\n// exported by bower-import\nreturn window.'+global+' = '+global+';\n})';
  writePackageFile(pkg, src);
}

function writePackageFile(pkg, src) {
  var id = pkg.endpoint.name;
  var base = pkg.canonicalDir.replace(new RegExp(pkg.endpoint.name + '$'), '');
  if (hasRidiculousName(id)) {
    id = id.replace(/\.js$/, '-js');
    console.log(color.red("> '"+id+"' will need to be imported with the id '"+id+"'"));
  }
  fs.writeFileSync(base+'/'+id+'.js', src);
}

function hasRidiculousName(name) {
  return name.match(/\.js$/);
}

function createAdapterModule(pkg) {
  var name = pkg.canonicalDir.split(path.sep).reverse()[0];
  console.log('# creating adapter module for '+name);
  var main = getMain(pkg).replace(/\.js$/, '');
  var src = 'define(["'+name+'/'+main+'"], function(module) { return module; });';
  writePackageFile(pkg, src);
}

function copyMain(pkg) {
  console.log('# copying module '+pkg.endpoint.name);
  var src = fs.readFileSync(pkg.canonicalDir+'/'+getMain(pkg)).toString();
  writePackageFile(pkg, src);
}

function getMain(dep) {
  var main;
  if (Array.isArray(dep.pkgMeta.main)) {
    main = dep.pkgMeta.main[0];
  } else if (dep.pkgMeta.main) {
    main = dep.pkgMeta.main;
  } else {
    main = findMainFromPackageJson(dep) ||
           findMainFromPackageFiles(dep) ||
           promptForMain(dep);
  }
  if (!main.match(/\.js$/)) {
    main = main+'.js';
  }
  return main;
}

function findMainFromPackageJson(dep) {
  var filePath = dep.canonicalDir+'/package.json';
  if (fs.existsSync(filePath)) {
    var json = JSON.parse(fs.readFileSync(filePath));
    if (json.main) {
      // cjs maybe? can just wrap in define(['require', 'module', 'exports'] ...)
      return json.main;
    }
  }
  return false;
}

function findMainFromPackageFiles(dep) {
  var name = dep.endpoint.name.replace(/\.js/, '');
  var files = fs.readdirSync(dep.canonicalDir);
  for (var i = 0, l = files.length; i < l; i++) {
    if (files[i].toLowerCase() === name+'.js') {
      return files[i];
    }
  }
  return false;
}

function promptForMain(dep) {
  var userFile = prompt(color.blue('> no main file detected for '+dep.endpoint.name+', which file is it?: '));
  if (fs.existsSync(dep.canonicalDir+'/'+userFile)) {
    // yeah yeah, mutating state, but now we won't ask for it twice
    dep.pkgMeta.main = userFile;
    return userFile;
  }
  return promptForMain(dep);
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
