module.exports = function(grunt) {

  var testedBrowsers = grunt.file.readJSON('test/browsers.json');

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

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

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-qunit');
  grunt.loadNpmTasks('grunt-saucelabs');

  grunt.registerTask('saucelabs', ['connect', 'saucelabs-qunit']);
  grunt.registerTask('test', ['connect', 'qunit']);
};
