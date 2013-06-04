/* File manipulation scripts courtesy of http://blog.millermedeiros.com/node-js-as-a-build-script */ 

var FILE_ENCODING = 'utf-8',
  EOL = '\n',
  fs = require('fs');

function concatFiles(opts) {
  var fileList = opts.src,
      distPath = opts.dest,
      out = fileList.map(function(filePath) {
         return fs.readFileSync(filePath, FILE_ENCODING);
      });

  fs.writeFileSync(distPath, out.join(EOL), FILE_ENCODING);
  console.log(' ' + distPath + ' built.');
}

function uglify(srcPath, distPath) {
  var uglyfyJS = require('uglify-js'),
      jsp = uglyfyJS.parser,
      pro = uglyfyJS.uglify,
      ast = jsp.parse(fs.readFileSync(srcPath, FILE_ENCODING));

  ast = pro.ast_mangle(ast);
  ast = pro.ast_squeeze(ast);

  fs.writeFileSync(distPath, pro.gen_code(ast), FILE_ENCODING);
  console.log(' ' + distPath + ' built.');
}

var libFiles = [
  '../lib/signals.js',
  '../lib/crossroads.js',
  '../lib/when.js',
  '../lib/history.js',

  '../src/util.js',
  '../src/Transition.js',
  '../src/State.js',
  '../src/Router.js'
];

// Global build
concatFiles({
  src: ['header.js'].concat(libFiles).concat(['footer.js']),
  dest: '../target/abyssa-debug.js'
});

uglify('../target/abyssa-debug.js', '../target/abyssa-release.js');
concatFiles({
  src: ['libraryName.js', '../target/abyssa-release.js'],
  dest: '../target/abyssa-release.js'
});

// AMD build; No minification as it's usually done at a higher level.
concatFiles({
  src: ['libraryName.js', 'header-amd.js'].concat(libFiles).concat(['footer-amd.js']),
  dest: '../target/abyssa-amd-debug.js'
});