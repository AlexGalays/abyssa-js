module.exports = function(grunt) {

  var banner = '/* <%= pkg.name %> <%= pkg.version %> - <%= pkg.description %> */\n\n';

  var dependencies = [
    'q',
    'signals',
    'crossroads'
  ];

  var supportedBrowsers = grunt.file.readJSON('test/supportedBrowsers.json');
  var supportedBrowsersWithShims = supportedBrowsers.concat(grunt.file.readJSON('test/supportedBrowsersWithShims.json'));

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    browserify: {
      build: {
        files: {'target/abyssa.js': ['src/main.js']},
        options: {
          ignore: dependencies,

          bundleOptions: {
            standalone: 'Abyssa'
          }
        }
      },
      buildWithDeps: {
        files: {'target/abyssa-with-deps.js': ['src/main.js'] },
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

    qunit: {
      all: {
        options: {
          urls: [
            'http://127.0.0.1:9999/test/unitTests.html',
            'http://127.0.0.1:9999/test/unitTestsWithShims.html',
            'http://127.0.0.1:9999/test/integrationTests.html',
            'http://127.0.0.1:9999/test/integrationTestsWithShims.html'
          ]
        }
      }
    },

    'saucelabs-qunit': {
      normal: {
        options: {
          username: 'bagonzago',
          key: process.env.SAUCE_KEY || '',
          testname: 'Abyssa without shims',
          tags: ['master'],
          build: +new Date(),
          concurrency: 2,
          testTimeout: 15 * 1000,
          urls: ['http://127.0.0.1:9999/test/unitTests.html', 'http://127.0.0.1:9999/test/integrationTests.html'],
          browsers: supportedBrowsers
        }
      },
      withShims: {
        options: {
          username: 'boubiyeah',
          key: process.env.SAUCE_KEY_WITH_SHIMS || '',
          testname: 'Abyssa with shims',
          tags: ['master'],
          build: +new Date(),
          concurrency: 2,
          testTimeout: 15 * 1000,
          urls: ['http://127.0.0.1:9999/test/unitTestsWithShims.html', 'http://127.0.0.1:9999/test/integrationTestsWithShims.html'],
          browsers: supportedBrowsersWithShims
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
