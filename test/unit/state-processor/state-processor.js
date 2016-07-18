'use strict';

var CaptureSession = require('lib/capture-session'),
    CaptureProcessor = require('lib/state-processor/capture-processor/capture-processor'),
    temp = require('lib/temp'),
    util = require('../../util'),
    errorUtils = require('lib/errors/utils'),
    proxyquire = require('proxyquire').noCallThru(),
    _ = require('lodash'),
    QEmitter = require('qemitter'),
    q = require('q');

describe('state-processor/state-processor', () => {
    var sandbox = sinon.sandbox.create(),
        job = sinon.stub(),
        captureProcessor;

    beforeEach(() => {
        sandbox.stub(temp);
        job.returns({});
    });

    afterEach(() => {
        sandbox.restore();
        job.reset();
    });

    describe('exec', () => {
        var browserSession;

        beforeEach(() => {
            browserSession = sinon.createStubInstance(CaptureSession);
            _.set(browserSession, 'browser.config', {
                getScreenshotPath: sinon.stub()
            });

            captureProcessor = sinon.createStubInstance(CaptureProcessor);
        });

        function exec_(opts) {
            opts = _.defaultsDeep(opts || {}, {
                captureProcessorInfo: {
                    module: '/some/default/module'
                },
                state: util.makeStateStub(),
                page: {}
            });

            var stubs = {
                'worker-farm': () => {
                    return (args, cb) => cb(null, job(args));
                }
            };
            stubs[opts.captureProcessorInfo.module] = {create: () => captureProcessor};

            var StateProcessor = proxyquire('lib/state-processor/state-processor', stubs),
                stateProcessor = new StateProcessor(opts.captureProcessorInfo);

            stateProcessor.prepare(new QEmitter());
            return stateProcessor.exec(opts.state, browserSession, opts.page);
        }

        it('should perform job', () => {
            return exec_()
                .then(() => assert.calledOnce(job));
        });

        it('should pass serialized browser session to job', () => {
            browserSession.serialize.returns('serialized-browser-session');

            return exec_()
                .then(() => assert.calledWithMatch(job, {
                    browserSession: 'serialized-browser-session'
                }));
        });

        it('should pass capture processor info to job', () => {
            var captureProcessorInfo = {
                module: '/some/module',
                constructorArg: {some: 'arg'}
            };

            return exec_({captureProcessorInfo})
                .then(() => assert.calledWithMatch(job, {captureProcessorInfo}));
        });

        it('should pass page disposition to job', () => {
            return exec_({
                page: {some: 'data'}
            })
                .then(() => assert.calledWithMatch(job, {
                    page: {some: 'data'}
                }));
        });

        it('should not pass coverage data to job', () => {
            return exec_({
                page: {
                    coverage: 'some-big-object'
                }
            }).then(() => assert.neverCalledWithMatch(job, {
                page: {
                    coverage: 'some-big-object'
                }
            }));
        });

        it('should pass serialized temp to job', () => {
            temp.serialize.returns('serialized-temp');

            return exec_()
                .then(() => assert.calledWithMatch(job, {
                    temp: 'serialized-temp'
                }));
        });

        it('should use browser config options in processing', () => {
            var state = util.makeStateStub();

            browserSession.browser.config.getScreenshotPath.returns('/some/path');
            browserSession.browser.config.tolerance = 100500;

            return exec_({state: state})
                .then(() => assert.calledWithMatch(job, {
                    execOpts: {
                        refPath: '/some/path',
                        tolerance: 100500
                    }
                }));
        });

        it('should use state tolerance if it set', () => {
            var state = util.makeStateStub();
            state.tolerance = 1;

            browserSession.browser.config.tolerance = 100500;

            return exec_({state: state})
                .then(() => assert.calledWithMatch(job, {
                    execOpts: {
                        tolerance: 1
                    }
                }));
        });

        it('should use state tolerance even if it set to 0', () => {
            var state = util.makeStateStub();
            state.tolerance = 0;

            browserSession.browser.config.tolerance = 100500;

            return exec_({state: state})
                .then(() => assert.calledWithMatch(job, {
                    execOpts: {
                        tolerance: 0
                    }
                }));
        });

        it('should use page pixel ratio', () => {
            const opts = {
                page: {
                    pixelRatio: 11
                }
            };

            return exec_(opts)
                .then(() => assert.calledWithMatch(job, {
                    execOpts: {
                        pixelRatio: 11
                    }
                }));
        });

        it('should restore error object inheritance', () => {
            sandbox.stub(q, 'nfcall').returns(q.reject({name: 'NoRefImageError'}));
            sandbox.stub(errorUtils, 'fromPlainObject')
                .withArgs({name: 'NoRefImageError'})
                .returns({restored: 'object'});

            return exec_()
                .fail((err) => {
                    assert.calledOnce(errorUtils.fromPlainObject);
                    assert.deepEqual(err, {restored: 'object'});
                });
        });
    });
});
