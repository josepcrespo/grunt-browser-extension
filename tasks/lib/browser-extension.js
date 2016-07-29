/*
 * grunt-browser-extension
 * https://github.com/addmitriev/grunt-browser-extension
 *
 * Copyright (c) 2015 Aleksey Dmitriev
 * Licensed under the MIT license.
 */
'use strict';

var grunt;
var fs = require('fs-extra');
var path = require('path');
var shell = require('shelljs');
var handlebars = require('handlebars');
handlebars.registerHelper('json', function(context) {
    return new handlebars.SafeString(JSON.stringify(context));
});


// Prototype for build extensions for each browser
var browserExtension = function(root, options) {
    this.root = root;
    this.options = options;
    this.browserFiles = {
        chrome: ['manifest.json'],
        firefox: ['package.json', 'lib/index.js'],
        safari: ['Info.plist']
    };
};

// Method for copy files of extension with replace of values
browserExtension.prototype.copyBrowserFiles = function() {
    var options = this.options;
    var pluginRoot = this.root;
    var browserFiles = this.browserFiles;

    // Process each file from skeletons
    Object.keys(browserFiles).forEach(function(browser) {
        browserFiles[browser].forEach(function(filename) {
            // Compile template from content of file
            var template = handlebars.compile(grunt.file.read(path.join(
                pluginRoot,
                'lib',
                browser,
                filename
            )));
            // Render template with a context and write to file
            grunt.file.write(path.join(
                'build',
                browser,
                filename
            ), template(options));
        });
    });
};

browserExtension.prototype.copyUserFiles = function() {
    var applicationDir = this.options.directory;
    var icon = this.options.icon;

    this._makeIcons(applicationDir, icon);
    if (this.options.chrome_url_overrides) {
        this._copyFiles(applicationDir, Object.values(this.options.chrome_url_overrides));
    }
    if (this.options.background && this.options.background.scripts) {
        this._copyFiles(applicationDir, this.options.background.scripts);
    }
    if (this.options.content_scripts) {
        var content_scripts_jsFiles = this.options.content_scripts.js;
        var content_scripts_cssFiles = this.options.content_scripts.css;
        if (content_scripts_jsFiles) {
            this._copyFiles(applicationDir, content_scripts_jsFiles);
        }
        if (content_scripts_cssFiles) {
            this._copyFiles(applicationDir, content_scripts_cssFiles);
        }
    }
};

browserExtension.prototype._copyFiles = function(applicationDir, files) {

    files.forEach(function(file) {
        grunt.file.expand({
            cwd: applicationDir
        }, file).forEach(function(fileName) {
            if (grunt.file.isDir(applicationDir + '/' + fileName)) {
                grunt.file.mkdir('build/chrome/' + fileName);
                grunt.file.mkdir('build/firefox/data/' + fileName);
                grunt.file.mkdir('build/safari/' + fileName);
            } else {
                grunt.file.copy(applicationDir + '/' + fileName, 'build/chrome/' + fileName);
                grunt.file.copy(applicationDir + '/' + fileName, 'build/firefox/data/' + fileName);
                grunt.file.copy(applicationDir + '/' + fileName, 'build/safari/' + fileName);
            }
        });
    });
};

browserExtension.prototype._makeIcons = function(applicationDir, icon) {
    var identifyArgs = ['identify',
        '-format',
        "'{ \"height\": %h, \"width\": %w}'",
        applicationDir + '/' + icon
    ].join(' ');

    var raw = shell.exec(identifyArgs, {
        silent: true
    }).output;
    var options = JSON.parse(raw);
    if (options.height !== 256 || options.width !== options.height) {
        grunt.log.warn("Icon must be 128px x 128px");
        grunt.fail.fatal('Your icon is: ' + options.height + 'px x ' + options.width + 'px');
    }

    var sizes = [16, 48, 64, 128, 256];

    fs.mkdir('build/icons');
    shell.cp(applicationDir + '/' + icon, 'build/icons/icon.png');

    sizes.forEach(function(size) {

        var resizeArgs = [
            'convert',
            applicationDir + '/' + icon,
            '-resize',
            size + 'x' + size,
            'build/icons/icon' + size + '.png'
        ].join(' ');

        shell.exec(resizeArgs, {
            silent: true
        });
    });


    this._copyFiles('build/icons', ['*.png']);

};

browserExtension.prototype.build = function() {
    /**
     * Building Firefox extension
     */


    var currentDir = shell.pwd();
    shell.cd('build/firefox/');
    var result = shell.exec('jpm xpi', {
        silent: true
    });
    if (result.code !== 0) {
        result = shell.exec('../../node_modules/.bin/jpm xpi', {
            silent: true
        });
        if (result.code !== 0) {
            grunt.fail.fatal('Can not run jpm for build xpi for Firefox');
        }
    }
    shell.cd(currentDir);

    /**
     * Prepare Safari extension
     */

    shell.mv('build/safari', 'build/safari.safariextension');
    shell.rm('-rf', 'build/icons');

    grunt.log.ok('Extensions are in build directory');

};


module.exports = function(gruntModule) {
    grunt = gruntModule;
    return browserExtension;
};
