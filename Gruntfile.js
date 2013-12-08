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
    },

    connect: {
      server: {
        options: {
          base: '.',
          port: 9999
        }
      }
    },

    'saucelabs-qunit': {
      all: {
        options: {
          testname: 'Abyssa',
          tags: ['master'],
          build: +new Date(),
          concurrency: 1,
          testTimeout: 15 * 1000,
          urls: ['http://127.0.0.1:9999/test/unitTestRunner.html', 'http://127.0.0.1:9999/test/integrationTestRunner.html'],
          browsers: grunt.file.readJSON('saucelabsBrowsers.json')
        }
      }
    }

  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-browserify');

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-saucelabs');

  grunt.registerTask('default', ['browserify', 'concat', 'uglify']);
  grunt.registerTask('dev', ['default', 'watch']);
  grunt.registerTask('saucelabs', ['connect', 'saucelabs-qunit']);
};