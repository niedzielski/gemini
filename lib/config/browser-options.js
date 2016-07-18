'use strict';
var _ = require('lodash'),
    GeminiError = require('../errors/gemini-error'),
    util = require('./util'),

    option = require('gemini-configparser').option,
    is = util.is,
    assertNonNegative = util.assertNonNegative,
    resolveWithProjectRoot = util.resolveWithProjectRoot,
    booleanOption = util.booleanOption,
    positiveIntegerOption = util.positiveIntegerOption;

function getTopLevel() {
    var defaults = {
        gridUrl: 'http://localhost:4444/wd/hub',
        calibrate: true,
        httpTimeout: 'default',
        sessionRequestTimeout: null,
        screenshotsDir: 'gemini/screens',
        tolerance: 2.3,
        sessionsPerBrowser: 1,
        suitesPerSession: Infinity,
        windowSize: null,
        retry: 0,
        screenshotMode: 'auto',
        compositeImage: false
    };

    function provideDefault(key) {
        return defaults[key];
    }

    return buildBrowserOptions(provideDefault, {
        desiredCapabilities: option({
            defaultValue: null,
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            validate: function(value) {
                if (!isOptionalObject(value)) {
                    throw new GeminiError('Top-level desiredCapabilities should be null or object');
                }
            }
        })
    });
}

function getPerBrowser() {
    return buildBrowserOptions(provideTopLevelDefault, {
        desiredCapabilities: option({
            parseEnv: JSON.parse,
            parseCli: JSON.parse,
            defaultValue: null,
            validate: function(value, config) {
                if (value === null && config.desiredCapabilities === null) {
                    throw new GeminiError('Browser must have desired capabilities set');
                }

                if (!isOptionalObject(value)) {
                    throw new GeminiError('desiredCapabilities should be null or object');
                }
            },
            map: function(value, config) {
                return _.extend({}, config.desiredCapabilities, value);
            }
        })
    });
}

function isOptionalObject(value) {
    return value === null || _.isPlainObject(value);
}

function provideTopLevelDefault(name) {
    return function(config) {
        var value = config[name];
        if (_.isUndefined(value)) {
            throw new GeminiError(name + ' should be set at top level or per-browser option');
        }
        return value;
    };
}

function buildBrowserOptions(defaultFactory, extra) {
    return _.extend(extra, {
        rootUrl: option({
            validate: is('string'),
            defaultValue: defaultFactory('rootUrl')
        }),

        gridUrl: option({
            validate: is('string'),
            defaultValue: defaultFactory('gridUrl')
        }),

        calibrate: booleanOption(defaultFactory('calibrate')),

        httpTimeout: option({
            parseEnv: parseTimeout,
            parseCli: parseTimeout,
            validate: function(value) {
                if (value === 'default') {
                    return;
                }
                assertNonNegative(value, 'httpTimeout');
            },
            defaultValue: defaultFactory('httpTimeout')
        }),

        sessionRequestTimeout: option({
            parseEnv: Number,
            parseCli: Number,
            validate: (value) => {
                if (_.isNull(value)) {
                    return;
                }
                assertNonNegative(value, 'sessionRequestTimeout');
            },
            defaultValue: defaultFactory('sessionRequestTimeout')
        }),

        screenshotsDir: option({
            validate: is('string'),
            defaultValue: defaultFactory('screenshotsDir'),
            map: resolveWithProjectRoot
        }),

        tolerance: option({
            defaultValue: defaultFactory('tolerance'),
            parseEnv: Number,
            parseCli: Number,
            validate: is('number')
        }),

        windowSize: option({
            defaultValue: defaultFactory('windowSize'),
            validate: function(value) {
                if (_.isObject(value) && _.isNumber(value.width) && _.isNumber(value.height)) {
                    return;
                }

                if (value === null) {
                    //null is valid value for this option, skip any other checks
                    return;
                }

                if (!_.isString(value)) {
                    throw new GeminiError('"windowSize" must be string or null');
                }

                if (!/^\d+x\d+$/.test(value)) {
                    throw new GeminiError('"windowSize" should have form of <width>x<height> (i.e. 1600x1200)');
                }
            },

            map: function(value) {
                if (value === null) {
                    return null;
                }

                if (_.isObject(value)) {
                    // object with "width" and "height" numeric properties
                    // which does not needs mapping. Any other object won't
                    // pass validation.
                    return value;
                }

                var size = value.split('x');
                return {
                    width: parseInt(size[0], 10),
                    height: parseInt(size[1], 10)
                };
            }
        }),

        sessionsPerBrowser: positiveIntegerOption(defaultFactory('sessionsPerBrowser')),
        suitesPerSession: positiveIntegerOption(defaultFactory('suitesPerSession')),

        retry: option({
            defaultValue: defaultFactory('retry'),
            parseEnv: Number,
            parseCli: Number,
            validate: function(value) {
                is('number')(value);
                if (value < 0) {
                    throw new GeminiError('"retry" must be non-negative');
                }
            }
        }),

        screenshotMode: option({
            defaultValue: defaultFactory('screenshotMode'),
            validate: function(value) {
                is('string')(value);
                if (!_.includes(['fullpage', 'viewport', 'auto'], value)) {
                    throw new GeminiError('"screenshotMode" must be one of "fullpage", "viewport" or "auto"');
                }
            }
        }),

        compositeImage: booleanOption(defaultFactory('compositeImage'))
    });
}

function parseTimeout(value) {
    return value === 'default' ? value : Number(value);
}

exports.getTopLevel = getTopLevel;
exports.getPerBrowser = getPerBrowser;
