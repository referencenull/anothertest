const test = require('node:test');
const assert = require('node:assert/strict');

const { createAppState, createServer } = require('../server');

async function withServer(run) {
  const server = createServer(createAppState());

  await new Promise((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('GET /api/products returns the seeded inventory list', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/products`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.products.length, 20);
    assert.equal(payload.products[0].name, 'Yamaha YZ125');
  });
});

test('POST, PATCH, and DELETE support the core inventory workflow', async () => {
  await withServer(async (baseUrl) => {
    const createResponse = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'KTM 85 SX',
        category: 'Mini',
        quantity: 4,
        price: 6499
      })
    });
    const createPayload = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createPayload.product.name, 'KTM 85 SX');

    const updateResponse = await fetch(`${baseUrl}/api/products/${createPayload.product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 12 })
    });
    const updatePayload = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updatePayload.product.quantity, 12);

    const deleteResponse = await fetch(`${baseUrl}/api/products/${createPayload.product.id}`, {
      method: 'DELETE'
    });

    assert.equal(deleteResponse.status, 204);

    const listResponse = await fetch(`${baseUrl}/api/products`);
    const listPayload = await listResponse.json();

    assert.equal(listPayload.products.some((product) => product.id === createPayload.product.id), false);
  });
});
