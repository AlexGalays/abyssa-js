module.exports = function(grunt) {

  grunt.initConfig({

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
    }
  });

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-qunit');

  grunt.registerTask('test', ['connect', 'qunit']);
};
