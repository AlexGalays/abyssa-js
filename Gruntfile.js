module.exports = function(grunt) {

  var banner = '/* <%= pkg.name %> <%= pkg.version %> - <%= pkg.description %> */\n\n';

  var libFiles = [
    'lib/signals.js',
    'lib/crossroads.js',
    'lib/when.js',
    'lib/history.iegte8.js',
  ];

  var srcFiles = [
    'src/header.js',
    'src/util.js',
    'src/Transition.js',
    'src/State.js',
    'src/Router.js',
    'src/anchorClicks.js',
    'src/footer.js'
  ];

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        banner: banner
      },
      buildWithDeps: {
        src: libFiles.concat(srcFiles),
        dest: 'target/<%= pkg.name %>.js'
      },
      buildWithoutDeps: {
        src: srcFiles,
        dest: 'target/<%= pkg.name %>-nodeps.js'
      }
    },
    uglify: {
      options: {
        banner: banner
      },
      buildWithDeps: {
        src: 'target/<%= pkg.name %>.js',
        dest: 'target/<%= pkg.name %>.min.js'
      },
      buildWithoutDeps: {
        src: 'target/<%= pkg.name %>-nodeps.js',
        dest: 'target/<%= pkg.name %>-nodeps.min.js'
      }
    },
    watch: {
      all: {
        files: ['src/*.js'],
        tasks: ['default']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['concat', 'uglify']);
  grunt.registerTask('dev', ['default', 'watch']);
};