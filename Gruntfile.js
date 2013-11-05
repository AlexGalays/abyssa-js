module.exports = function(grunt) {

  var banner = '/* <%= pkg.name %> <%= pkg.version %> - <%= pkg.description %> */\n\n';

  var dependencies = [
    'when',
    'signals',
    'crossroads',
    'html5-history-api/history.iegte8'
  ];

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    browserify: {
      build: {
        files: {'target/abyssa.js': ['src/main.js']},
        options: {
          standalone: 'Abyssa',
          ignore: dependencies
        }
      },
      buildWithDeps: {
        files: {'target/abyssa-with-deps.js': ['src/main.js'] },
        options: {
          standalone: 'Abyssa'
        }
      }
    },

    concat: {
      options: {
        banner: banner
      },
      build: {
        src: ['target/abyssa.js'],
        dest: 'target/abyssa.js'
      },
      buildWithDeps: {
        src: ['target/abyssa-with-deps.js'],
        dest: 'target/abyssa-with-deps.js'
      }
    },

    uglify: {
      options: {
        banner: banner
      },
      build: {
        src: 'target/abyssa.js',
        dest: 'target/abyssa.min.js'
      },
      buildWithDeps: {
        src: 'target/abyssa-with-deps.js',
        dest: 'target/abyssa-with-deps.min.js'
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
  grunt.loadNpmTasks('grunt-browserify');

  grunt.registerTask('default', ['browserify', 'concat', 'uglify']);
  grunt.registerTask('dev', ['default', 'watch']);
};