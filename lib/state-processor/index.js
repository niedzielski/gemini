'use strict';

var StateProcessor = require('./state-processor'),
    RunnerEvents = require('../constants/runner-events');

function create(captureProcessorName, jobDoneEvent, constructorArg) {
    return new StateProcessor({
        module: require.resolve('./capture-processor/' + captureProcessorName),
        constructorArg
    }, jobDoneEvent);
}

module.exports = {
    createTester: function(config) {
        return create('tester', RunnerEvents.END_TEST, config.system.diffColor);
    },

    createScreenUpdater: function(options) {
        return create('screen-updater', RunnerEvents.CAPTURE, options);
    }
};
