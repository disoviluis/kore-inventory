const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { emitMatiasInvoice, lookupMatiasDocument } = require('../dist/platform/matias/matias.client');

test('invoice request includes client_uuid in the JSON body and query', async () => {
  const originalRequest = https.request;
  let capturedUrl;
  let capturedBody;

  https.request = (url, options, callback) => {
    capturedUrl = url;
    const request = new EventEmitter();
    request.end = (body) => {
      capturedBody = body;
      const response = new EventEmitter();
      response.statusCode = 200;
      response.setEncoding = () => {};
      callback(response);
      process.nextTick(() => {
        response.emit('data', '{"success":true}');
        response.emit('end');
      });
    };
    request.destroy = (error) => request.emit('error', error);
    return request;
  };

  try {
    const result = await emitMatiasInvoice(
      'https://sandbox-api.matias-api.com/api/ubl2.1',
      'test-pat',
      'sandbox-client-uuid',
      { uuid: 'test-document-uuid' }
    );

    assert.equal(result.ok, true);
    assert.equal(capturedUrl.pathname, '/api/ubl2.1/invoice');
    assert.equal(capturedUrl.searchParams.get('client_uuid'), 'sandbox-client-uuid');
    assert.deepEqual(JSON.parse(capturedBody), {
      uuid: 'test-document-uuid',
      client_uuid: 'sandbox-client-uuid'
    });
  } finally {
    https.request = originalRequest;
  }
});

test('invoice request is not sent without client_uuid', async () => {
  const originalRequest = https.request;
  https.request = () => {
    throw new Error('Request should not be sent');
  };

  try {
    const result = await emitMatiasInvoice(
      'https://sandbox-api.matias-api.com/api/ubl2.1',
      'test-pat',
      ' ',
      { uuid: 'test-document-uuid' }
    );

    assert.equal(result.ok, false);
    assert.match(result.error, /client_uuid/);
  } finally {
    https.request = originalRequest;
  }
});

test('provider lookup uses GET and does not treat invalid responses as confirmed absence', async () => {
  const original = https.request;
  try {
    for (const [status, text, ok] of [[200, '{"success":true,"dataRecord":null}', true],
      [200, '<html>error</html>', false], [200, '{"success":false}', false], [500, '{"success":true,"dataRecord":null}', false]]) {
      https.request = (url, options, callback) => {
        assert.equal(options.method, 'GET');
        assert.equal(url.pathname, '/api/ubl2.1/documents/old-uuid');
        assert.equal(url.searchParams.get('client_uuid'), 'client');
        const request = new EventEmitter();
        request.end = () => {
          const response = new EventEmitter();
          response.statusCode = status;
          response.setEncoding = () => {};
          callback(response);
          process.nextTick(() => { response.emit('data', text); response.emit('end'); });
        };
        return request;
      };
      const result = await lookupMatiasDocument('https://sandbox-api.matias-api.com/api/ubl2.1', 'fake-test-pat', 'client', 'old-uuid');
      assert.equal(result.ok, ok);
    }
  } finally { https.request = original; }
});
