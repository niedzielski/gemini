'use strict';

var Calibrator = require('lib/calibrator'),
    ClientBridge = require('lib/browser/client-bridge'),
    Camera = require('lib/browser/camera'),
    WdErrors = require('lib/constants/wd-errors'),
    q = require('q'),
    wd = require('wd'),
    polyfillService = require('polyfill-service'),
    makeBrowser = require('../../util').makeBrowser;

describe('browser/new-browser', function() {
    beforeEach(function() {
        this.sinon = sinon.sandbox.create();
    });

    afterEach(function() {
        this.sinon.restore();
    });

    describe('properties', function() {
        it('should have browserName property', function() {
            var browser = makeBrowser({
                browserName: 'name'
            });

            assert.equal(browser.browserName, 'name');
        });

        it('should have version propery', function() {
            var browser = makeBrowser({
                version: '1.0'
            });

            assert.equal(browser.version, '1.0');
        });
    });

    describe('launch', function() {
        beforeEach(function() {
            this.wd = {
                configureHttp: sinon.stub().returns(q()),
                init: sinon.stub().returns(q({})),
                get: sinon.stub().returns(q({})),
                eval: sinon.stub().returns(q('')),
                setWindowSize: sinon.stub().returns(q({})),
                maximize: sinon.stub().returns(q()),
                windowHandle: sinon.stub().returns(q({})),
                on: sinon.stub()
            };

            this.sinon.stub(wd, 'promiseRemote').returns(this.wd);
            this.calibrator = sinon.createStubInstance(Calibrator);
            this.browser = makeBrowser({
                browserName: 'browser',
                version: '1.0'
            }, {calibrate: false});

            this.launchBrowser = function() {
                return this.browser.launch(this.calibrator);
            };

            this.sinon.stub(Camera.prototype);
        });

        it('should init browser with browserName and version capabilites', function() {
            var _this = this;
            return this.browser.launch(this.calibrator).then(function() {
                assert.calledWith(_this.wd.init, {
                    browserName: 'browser',
                    version: '1.0'
                });
            });
        });

        it('should set http options for browser instance', function() {
            var _this = this;
            this.browser.config.httpTimeout = 100;
            return this.browser.launch(this.calibrator).then(function() {
                assert.calledWith(_this.wd.configureHttp, {
                    timeout: 100,
                    retries: 'never'
                });
            });
        });

        describe('if config.calibrate=true', function() {
            beforeEach(function() {
                this.browser.config.calibrate = true;
            });

            it('should calibrate', function() {
                var _this = this;

                this.calibrator.calibrate.returns(q());
                return this.browser.launch(this.calibrator)
                    .then(function() {
                        assert.calledOnce(_this.calibrator.calibrate);
                    });
            });

            it('should calibrate camera object', function() {
                var calibration = {some: 'data'};

                this.calibrator.calibrate.returns(q(calibration));
                return this.browser.launch(this.calibrator)
                    .then(function() {
                        assert.calledOnce(Camera.prototype.calibrate);
                        assert.calledWith(Camera.prototype.calibrate, calibration);
                    });
            });
        });

        describe('if config.calibrate=false', function() {
            beforeEach(function() {
                this.browser.config.calibrate = false;
            });

            it('should not calibrate', function() {
                var _this = this;

                return this.browser.launch(this.calibrator)
                    .then(function() {
                        assert.notCalled(_this.calibrator.calibrate);
                    });
            });

            it('should not calibrate camera object', function() {
                return this.browser.launch(this.calibrator)
                    .then(function() {
                        assert.notCalled(Camera.prototype.calibrate);
                    });
            });
        });

        it('should maximize window if launching phantomjs', function() {
            var _this = this;

            this.browser = makeBrowser({
                browserName: 'phantomjs',
                version: '1.0'
            }, {calibrate: false});

            return this.launchBrowser().then(function() {
                assert.called(_this.wd.maximize);
            });
        });

        describe('with windowSize option', function() {
            beforeEach(function() {
                this.browser.config.windowSize = {width: 1024, height: 768};
            });

            it('should set window size', function() {
                var _this = this;
                return this.launchBrowser().then(function() {
                    assert.calledWith(_this.wd.setWindowSize, 1024, 768);
                });
            });

            it('should not maximize window', function() {
                var _this = this;
                return this.launchBrowser().then(function() {
                    assert.notCalled(_this.wd.maximize);
                });
            });

            it('should not fail if not supported in legacy Opera', function() {
                this.wd.setWindowSize.returns(q.reject({
                    cause: {
                        value: {
                            message: 'Not supported in OperaDriver yet'
                        }
                    }
                }));
                return assert.isFulfilled(this.launchBrowser());
            });

            it('should fail if setWindowSize fails with other error', function() {
                this.wd.setWindowSize.returns(q.reject(new Error('other')));
                return assert.isRejected(this.launchBrowser());
            });
        });
    });

    describe('URL opening', function() {
        beforeEach(function() {
            this.wd = {
                configureHttp: sinon.stub().returns(q({})),
                eval: sinon.stub().returns(q({})),
                get: sinon.stub().returns(q({})),
                init: sinon.stub().returns(q({})),
                on: sinon.stub(),
                setWindowSize: sinon.stub().returns(q({}))
            };

            this.sinon.stub(wd, 'promiseRemote').returns(this.wd);
            this.sinon.stub(ClientBridge.prototype, 'call').returns(q({}));
            this.sinon.stub(polyfillService, 'getPolyfillString').returns('function() {}');
        });

        describe('open', function() {
            function open_(browser, params) {
                params = params || {};

                return browser.launch()
                    .then(function() {
                        return browser.open(
                            params.url || 'http://www.example.com',
                            {resetZoom: params.resetZoom}
                        );
                    });
            }

            beforeEach(function() {
                this.browser = makeBrowser({browserName: 'browser', version: '1.0'});
            });

            it('should open URL', function() {
                var _this = this;

                return open_(this.browser, {url: 'http://www.example.com'})
                    .then(function() {
                        assert.calledWith(_this.wd.get, 'http://www.example.com');
                    });
            });

            it('should reset page zoom by default', function() {
                return open_(this.browser, {url: 'http://www.example.com'})
                    .then(function() {
                        assert.calledWith(ClientBridge.prototype.call, 'resetZoom');
                    });
            });

            it('should not reset page zoom if `resetZoom` param passed as false', function() {
                return open_(this.browser, {url: 'http://www.example.com', resetZoom: false})
                    .then(function() {
                        assert.neverCalledWith(ClientBridge.prototype.call, 'resetZoom');
                    });
            });
        });

        describe('openRelative', function() {
            beforeEach(function() {
                this.browser = makeBrowser({browserName: 'browser', version: '1.0'}, {
                    getAbsoluteUrl: sinon.stub().withArgs('/relative').returns('http://example.com/relative')
                });
            });

            it('should open relative URL using config', function() {
                var _this = this;
                return this.browser.launch()
                    .then(function() {
                        return _this.browser.openRelative('/relative');
                    })
                    .then(function() {
                        assert.calledWith(_this.wd.get, 'http://example.com/relative');
                    });
            });
        });
    });

    describe('reset', function() {
        beforeEach(function() {
            this.wd = {
                eval: sinon.stub().returns(q()),
                moveTo: sinon.stub().returns(q()),
                on: sinon.stub()
            };

            this.sinon.stub(wd, 'promiseRemote').returns(this.wd);

            this.browser = makeBrowser({browserName: 'browser', version: '1.0'});
            this.browser.chooseLocator();
        });

        it('should reset mouse position', function() {
            var _this = this,
                elem = {};
            this.wd.eval.returns(q(elem));
            return this.browser.reset()
                .then(function() {
                    assert.calledWith(_this.wd.moveTo, elem, 0, 0);
                });
        });

        it('should reject promise with browserId and sessionId if error happened', function() {
            this.browser.sessionId = 'test_session_id';
            this.wd.eval.returns(q.reject());

            return this.browser.reset()
                .fail(function(e) {
                    assert.deepEqual(e, {
                        browserId: 'id',
                        sessionId: 'test_session_id'
                    });
                });
        });
    });

    describe('captureViewportImage', function() {
        beforeEach(function() {
            this.sinon.stub(Camera.prototype);

            this.wd = {
                init: sinon.stub().returns(q({})),
                configureHttp: sinon.stub().returns(q()),
                eval: sinon.stub().returns(q('')),
                on: sinon.stub()
            };

            this.sinon.stub(wd, 'promiseRemote').returns(this.wd);

            this.browser = makeBrowser({browserName: 'browser', version: '1.0'}, {
                calibrate: true
            });
        });

        it('should delegate actual capturing to camera object', function() {
            this.browser = makeBrowser({browserName: 'browser', version: '1.0'}, {
                calibrate: false
            });

            Camera.prototype.captureViewportImage.returns(q({some: 'image'}));

            return this.browser.launch()
                .then(function() {
                    return this.browser.captureViewportImage();
                }.bind(this))
                .then(function(image) {
                    assert.calledOnce(Camera.prototype.captureViewportImage);
                    assert.deepEqual(image, {some: 'image'});
                });
        });
    });

    describe('buildScripts', function() {
        it('should include coverage script when coverage is on', function() {
            var browser = makeBrowser({browserName: 'browser', version: '1.0'}, {
                    system: {
                        coverage: {
                            enabled: true
                        }
                    }
                }),
                scripts = browser.buildScripts();
            return assert.eventually.include(scripts, 'exports.collectCoverage');
        });

        it('should not include coverage script when coverage is off', function() {
            var browser = makeBrowser({browserName: 'browser', version: '1.0'}, {
                    system: {
                        coverage: {
                            enabled: false
                        }
                    }
                }),
                scripts = browser.buildScripts();
            return assert.eventually.notInclude(scripts, 'exports.collectCoverage');
        });
    });

    describe('findElement', function() {
        beforeEach(function() {
            this.wd = {
                configureHttp: sinon.stub().returns(q()),
                init: sinon.stub().returns(q({})),
                get: sinon.stub().returns(q({})),
                eval: sinon.stub().returns(q('')),
                elementByCssSelector: sinon.stub().returns(q()),
                on: sinon.stub()
            };
            this.sinon.stub(wd, 'promiseRemote').returns(this.wd);
            this.browser = makeBrowser({browserName: 'bro'}, {
                calibrate: true
            });
        });

        describe('when browser supports CSS3 selectors', function() {
            beforeEach(function() {
                var calibrator = sinon.createStubInstance(Calibrator);
                calibrator.calibrate.returns(q({
                    hasCSS3Selectors: true
                }));
                return this.browser.launch(calibrator);
            });

            it('should return what wd.elementByCssSelector returns', function() {
                var element = {element: 'elem'};
                this.wd.elementByCssSelector.withArgs('.class').returns(q(element));
                return assert.eventually.equal(this.browser.findElement('.class'), element);
            });

            it('should add a selector property if element is not found', function() {
                var error = new Error('Element not found');
                error.status = WdErrors.ELEMENT_NOT_FOUND;
                this.wd.elementByCssSelector.returns(q.reject(error));

                return assert.isRejected(this.browser.findElement('.class'))
                    .then(function(error) {
                        assert.equal(error.selector, '.class');
                    });
            });
        });

        describe('when browser does not support CSS3 selectors', function() {
            beforeEach(function() {
                this.sinon.stub(ClientBridge.prototype, 'call').returns(q({}));
                var calibrator = sinon.createStubInstance(Calibrator);
                calibrator.calibrate.returns(q({
                    hasCSS3Selectors: false
                }));
                return this.browser.launch(calibrator);
            });

            it('should return what client method returns', function() {
                var element = {element: 'elem'};
                ClientBridge.prototype.call.withArgs('query.first', ['.class']).returns(q(element));
                return assert.eventually.equal(this.browser.findElement('.class'), element);
            });

            it('should reject with element not found error if client method returns null', function() {
                ClientBridge.prototype.call.returns(q(null));
                return assert.isRejected(this.browser.findElement('.class'))
                    .then(function(error) {
                        assert.equal(error.status, WdErrors.ELEMENT_NOT_FOUND);
                        assert.equal(error.selector, '.class');
                    });
            });
        });
    });

    describe('serialize', function() {
        it('should add config with browser id, gridUrl and httpTimeout to object', function() {
            var browser = makeBrowser({}, {
                id: 'someBrowser',
                gridUrl: 'http://grid.url',
                httpTimeout: 100500,
                screenshotMode: 'viewport',
                some: 'otherProperty'
            });

            var obj = browser.serialize();

            assert.deepEqual(obj.config, {
                id: 'someBrowser',
                gridUrl: 'http://grid.url',
                httpTimeout: 100500,
                screenshotMode: 'viewport'
            });
        });

        it('should add sessionId to object', function() {
            var browser = makeBrowser();
            browser.sessionId = 'some-session-id';

            var obj = browser.serialize();

            assert.property(obj, 'sessionId', 'some-session-id');
        });

        it('should add calibration results to object', function() {
            var wdRemote = {
                configureHttp: sinon.stub().returns(q()),
                init: sinon.stub().returns(q({})),
                eval: sinon.stub().returns(q('')),
                on: sinon.stub()
            };
            this.sinon.stub(wd, 'promiseRemote').returns(wdRemote);

            var calibrator = sinon.createStubInstance(Calibrator);
            calibrator.calibrate.returns(q({some: 'data'}));

            var browser = makeBrowser({}, {calibrate: true});
            return browser.launch(calibrator)
                .then(function() {
                    var obj = browser.serialize();

                    assert.deepEqual(obj.calibration, {some: 'data'});
                });
        });
    });

    describe('initSession', () => {
        let wdRemote;

        const settingOfTimeout = (timeout) =>
            wdRemote.configureHttp.withArgs({retries: 'never', timeout}).named('configureHttp');

        beforeEach(function() {
            wdRemote = {
                configureHttp: sinon.stub().returns(q()),
                init: sinon.stub().returns(q([])),
                on: sinon.stub()
            };

            this.sinon.stub(wd, 'promiseRemote').returns(wdRemote);
        });

        it('should init a browser session', () => {
            return makeBrowser({browserName: 'some-browser'})
                .initSession()
                .then(() => assert.calledWith(wdRemote.init, {browserName: 'some-browser'}));
        });

        it('should set session id after getting of a session', () => {
            wdRemote.init.returns(q(['100500']));

            const browser = makeBrowser();
            return browser.initSession()
                .then(() => assert.equal(browser.sessionId, '100500'));
        });

        it('should set session request timeout before getting of a session', () => {
            return makeBrowser(null, {sessionRequestTimeout: 100500})
                .initSession()
                .then(() => assert.callOrder(settingOfTimeout(100500), wdRemote.init));
        });

        it('should use http timeout for getting of a session if request session timeout is not specified', () => {
            return makeBrowser(null, {httpTimeout: 100500, sessionRequestTimeout: null})
                .initSession()
                .then(() => assert.callOrder(settingOfTimeout(100500), wdRemote.init));
        });

        it('should set http timeout for all other requests after getting of a session', () => {
            return makeBrowser(null, {httpTimeout: 100500})
                .initSession()
                .then(() => assert.callOrder(wdRemote.init, settingOfTimeout(100500)));
        });
    });
});
