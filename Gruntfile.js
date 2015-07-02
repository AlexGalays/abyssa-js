module.exports = function(grunt) {

  var banner = '/* <%= pkg.name %> <%= pkg.version %> - <%= pkg.description %> */\n\n';

  var testedBrowsers = grunt.file.readJSON('test/browsers.json');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    browserify: {
      build: {
        files: {'target/abyssa.js': ['src/main.js'] },
        options: {
          bundleOptions: {
            standalone: 'Abyssa'
          }
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
      }
    },

    uglify: {
      options: {
        banner: banner
      },
      build: {
        src: 'target/abyssa.js',
        dest: 'target/abyssa.min.js'
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
          base: '',
          port: 9999
        }
      }
    },

    qunit: {
      all: {
        options: {
          urls: [
            'http://127.0.0.1:9999/test/unitTests.html',
            'http://127.0.0.1:9999/test/integrationTests.html'
          ]
        }
      }
    },

    'saucelabs-qunit': {
      all: {
        options: {
          username: 'bagonzago',
          testname: 'Abyssa',
          throttled: 2,
          build: +new Date(),
          testTimeout: 15 * 1000,
          urls: ['http://127.0.0.1:9999/test/unitTests.html', 'http://127.0.0.1:9999/test/integrationTests.html'],
          browsers: testedBrowsers
        }
      }
    }

  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-browserify');

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-saucelabs');

  grunt.registerTask('default', ['browserify', 'concat', 'uglify']);
  grunt.registerTask('dev', ['default', 'watch']);
  grunt.registerTask('saucelabs', ['connect', 'saucelabs-qunit']);
  grunt.registerTask('test', ['default', 'connect', 'qunit']);
};
