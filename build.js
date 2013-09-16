
var FILE_ENCODING = 'utf-8',
    SRC_DIR = 'src',
    LIB_DIR = 'lib',
    DIST_DIR = 'dist',
    
    DIST_NAME = 'abyssa.js',
    DIST_MIN_NAME = 'abyssa.min.js',
    DIST_DEPS_NAME = 'abyssa-with-deps.js',
    DIST_DEPS_MIN_NAME = 'abyssa-with-deps.min.js',
    
    DIST_PATH = DIST_DIR +'/'+ DIST_NAME,
    DIST_MIN_PATH = DIST_DIR +'/'+ DIST_MIN_NAME,
    DIST_DEPS_PATH = DIST_DIR +'/'+ DIST_DEPS_NAME,
    DIST_DEPS_MIN_PATH = DIST_DIR +'/'+ DIST_DEPS_MIN_NAME,
    
    DIST_EXPORT_VAR_NAME = 'Abyssa',
    DIST_EXPORT_MODULE_NAME = 'abyssa',
    
    LOG_PREFIX = 'build: ';


var _fs = require('fs'),
    _path = require('path'),
    _pkg = JSON.parse(readFile('package.json')),
    _now = new Date(),
    _projectInfo = {
        NAME : _pkg.name,
        AUTHOR : _pkg.author.name,
        VERSION_NUMBER : _pkg.version,
        HOMEPAGE : _pkg.homepage,
        LICENSE : _pkg.licenses[0].type,
        BUILD_DATE : _now.toISOString()
    },
    _includes = {
        LICENSE: tmpl( readFile(SRC_DIR + '/license.txt'), _projectInfo ),
        
        SIGNALS_JS: readFile(LIB_DIR + '/signals.js'),
        CROSSROADS_JS: readFile(LIB_DIR + '/crossroads.js'),
        WHEN_JS: readFile(LIB_DIR + '/when.js'),
        HISTORY_JS: readFile(LIB_DIR + '/history.js'),
        
        UTIL_JS: readFile(SRC_DIR + '/util.js'),
        TRANSITION_JS: readFile(SRC_DIR + '/Transition.js'),
        STATE_JS: readFile(SRC_DIR + '/State.js'),
        ROUTER_JS: readFile(SRC_DIR + '/Router.js'),
        ANCHOR_CLICKS_JS: readFile(SRC_DIR + '/anchorClicks.js')
    },
    _depsList = [
        "signals",
        "crossroads",
        "when",
        "history"
    ],
    _depsCode = [
        _includes.SIGNALS_JS,
        _includes.CROSSROADS_JS,
        _includes.WHEN_JS,
        _includes.HISTORY_JS
    ],
    _buildCode = [
        _includes.UTIL_JS,
        _includes.TRANSITION_JS,
        _includes.STATE_JS,
        _includes.ROUTER_JS,
        _includes.ANCHOR_CLICKS_JS
    ];


function purge() {
    [DIST_PATH, DIST_MIN_PATH, DIST_DEPS_PATH].forEach(function (filePath) {
        if ( _fs.existsSync(filePath) ) {
            _fs.unlinkSync(filePath);
        }
    });
    console.log(LOG_PREFIX + 'purged.');
}


function build(depsCode, depsList, buildCode, outputPath) {
    var code,
        depsArgs = depsList.join(", "),
        depsRequires = depsList.join("'), require('"),
        depsGlobals = depsList.join("'], window['"),
        i, ic;
    
    depsRequires = (depsRequires ? "require('" + depsRequires + "')" : "");
    depsGlobals = (depsGlobals ? "window['" + depsGlobals + "']" : "");
    
    code = (depsCode.length ? depsCode.join("\n\n") + "\n" : "") +
        _includes.LICENSE +
        "(function () {\n" +
        "var factory = function (" + depsArgs + ") {\n" +
        "var " + DIST_EXPORT_VAR_NAME + " = {};\n" +
        (buildCode.length ? buildCode.join("\n") + "\n" : "") +
        "return " + DIST_EXPORT_VAR_NAME + ";\n" +
        "};\n" +
        "if (typeof define === 'function' && define.amd) {\n" +
        "define(['" + DIST_EXPORT_MODULE_NAME + "'], factory);\n" +
        "} else if (typeof module !== 'undefined' && module.exports) { //Node\n" +
        "module.exports = factory(" + depsRequires + ");\n" +
        "} else {\n" +
        "/*jshint sub:true */" +
        "window['" + DIST_EXPORT_VAR_NAME + "'] = factory(" + depsGlobals + ");\n" +
        "}\n" +
        "}());\n";
    
    _fs.writeFileSync(outputPath, code, FILE_ENCODING);
    console.log(LOG_PREFIX + outputPath + ' built.');
}


function readFile(filePath) {
    return _fs.readFileSync(filePath, FILE_ENCODING);
}


function tmpl(template, data, regexp) {
    function replaceFn(match, prop) {
        return (prop in data)? data[prop] : '';
    }
    return template.replace(regexp || /::(\w+)::/g, replaceFn);
}


function uglify_v2(srcPath) {
    var uglifyJS = require('uglify-js'),
        srcCode = readFile(srcPath),
        result = uglifyJS.minify(srcCode, {
            fromString: true,
            output: {
                comments: function(node, comment) {
                    var text = comment.value;
                    var type = comment.type;
                    if (type == "comment2") {
                        // multiline comment
                        return /@preserve|@license|@cc_on/i.test(text);
                    }
                }
            }
        });

    return result.code;
}
function uglify_v1(srcPath) {
    var uglifyJS = require('uglify-js'),
        jsp = uglifyJS.parser,
        pro = uglifyJS.uglify,
        ast = jsp.parse(readFile(srcPath));

    ast = pro.ast_mangle(ast);
    ast = pro.ast_squeeze(ast);

    return pro.gen_code(ast);
}
function uglify(srcPath) {
    var uglifyJS = require('uglify-js'),
        minifiedCode;

    if (uglifyJS.parser) {
        // Uglify v1 does not preserve the license comments, so we at least add this project license:
        minifiedCode = (_includes.LICENSE + uglify_v1(srcPath));
    }
    else {
        // Uglify v2 is able to preserve the license comments by itself.
        minifiedCode = uglify_v2(srcPath);
    }
    
    return minifiedCode;
}


function minify(srcPath, outputPath) {
    _fs.writeFileSync(outputPath, uglify(srcPath), FILE_ENCODING);
    console.log(LOG_PREFIX + outputPath + ' built minified.');
}


function pad(val) {
    val = String(val);
    if (val.length < 2) {
        return '0'+ val;
    } else {
        return val;
    }
}


// --- run ---
purge();
build([], _depsList, _buildCode, DIST_PATH);
minify(DIST_PATH, DIST_MIN_PATH);
build(_depsCode, [], _buildCode, DIST_DEPS_PATH);
minify(DIST_DEPS_PATH, DIST_DEPS_MIN_PATH);
