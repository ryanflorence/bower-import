exports.write = function() {
  console.log.apply(console, arguments);
};

exports.warn = function(msg) {
  console.log(msg);
};

