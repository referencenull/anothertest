const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const publicDir = path.join(__dirname, 'public');
const imageUrlCache = new Map();
let motocrossImagePoolPromise;
const FALLBACK_MOTOCROSS_IMAGES = [
  'https://live.staticflickr.com/65535/55275707460_d01ed6ccb2_z.jpg',
  'https://live.staticflickr.com/65535/55275511990_0357f2ac51_z.jpg',
  'https://live.staticflickr.com/65535/55275057051_6185e16c40_z.jpg',
  'https://live.staticflickr.com/65535/55275426565_6fa6a2ed98_z.jpg',
  'https://live.staticflickr.com/65535/55273363609_ff406c9abd_z.jpg',
  'https://live.staticflickr.com/65535/55272211227_54ef338da4_z.jpg',
  'https://live.staticflickr.com/65535/55273363619_2825f7e0bd_z.jpg',
  'https://live.staticflickr.com/65535/55273131016_15c18c3cc2_z.jpg'
];

function normalizeImageKeyword(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function computeImageSignature(seed) {
  let hash = 0;

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1000;
  }

  return hash + 1;
}

function buildProductImageUrl(name, category = '') {
  const safeName = encodeURIComponent(String(name || '').trim());
  const safeCategory = encodeURIComponent(String(category || '').trim());
  return `/api/product-image?name=${safeName}&category=${safeCategory}`;
}

function httpsGetText(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'motocross-inventory-demo/1.0'
        }
      },
      (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`Image provider request failed (${response.statusCode})`));
            return;
          }

          resolve(body);
        });
      }
    );

    request.on('error', reject);
  });
}

async function resolveMotocrossImageUrl(name, category) {
  const normalizedName = normalizeImageKeyword(name || 'motocross bike');
  const normalizedCategory = normalizeImageKeyword(category || 'dirt bike');
  const cacheKey = `${normalizedName}|${normalizedCategory}`;

  if (imageUrlCache.has(cacheKey)) {
    return imageUrlCache.get(cacheKey);
  }

  if (!motocrossImagePoolPromise) {
    const feedUrl =
      'https://www.flickr.com/services/feeds/photos_public.gne?' +
      'format=json&nojsoncallback=1&tags=motocross,dirtbike,mx';
    motocrossImagePoolPromise = httpsGetText(feedUrl)
      .then((payloadText) => {
        const payload = JSON.parse(payloadText);
        const items = Array.isArray(payload.items) ? payload.items : [];

        return items
          .map((item) => String(item?.media?.m || ''))
          .filter((url) => /^https:\/\//i.test(url));
      })
      .catch(() => FALLBACK_MOTOCROSS_IMAGES);
  }

  const imagePool = await motocrossImagePoolPromise;

  if (imagePool.length === 0) {
    throw new Error('No motocross images available.');
  }

  const signature = computeImageSignature(cacheKey);
  const imageUrl = imagePool[signature % imagePool.length];
  const finalUrl = imageUrl.replace(/_m\./, '_z.');
  imageUrlCache.set(cacheKey, finalUrl);
  return finalUrl;
}

function createInitialProducts() {
  // Seed data keeps the demo usable immediately after startup.
  return [
    ['Yamaha YZ125', '125cc', 3, 6999.0],
    ['KTM 125 SX', '125cc', 2, 7699.0],
    ['Husqvarna TC 125', '125cc', 2, 7799.0],
    ['Honda CRF250R', '250cc', 4, 8299.0],
    ['Yamaha YZ250F', '250cc', 3, 8399.0],
    ['Kawasaki KX250', '250cc', 2, 8199.0],
    ['Suzuki RM-Z250', '250cc', 1, 7999.0],
    ['KTM 250 SX-F', '250cc', 2, 9499.0],
    ['GasGas MC 250F', '250cc', 2, 8999.0],
    ['Honda CRF450R', '450cc', 3, 9599.0],
    ['Yamaha YZ450F', '450cc', 2, 9799.0],
    ['Kawasaki KX450', '450cc', 2, 9499.0],
    ['Suzuki RM-Z450', '450cc', 1, 9099.0],
    ['KTM 450 SX-F', '450cc', 2, 10899.0],
    ['Husqvarna FC 450', '450cc', 2, 10999.0],
    ['GasGas MC 450F', '450cc', 1, 10299.0],
    ['Yamaha YZ250', '2-stroke', 2, 7899.0],
    ['KTM 250 SX', '2-stroke', 2, 9099.0],
    ['Kawasaki KX112', 'Mini', 4, 5399.0],
    ['Honda CRF110F', 'Mini', 5, 2699.0]
  ].map(([name, category, quantity, price], index) => ({
    id: index + 1,
    name,
    category,
    quantity,
    price,
    imageUrl: buildProductImageUrl(name, category)
  }));
}

function createAppState() {
  return {
    nextId: 21,
    products: createInitialProducts()
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;

      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error('Request body too large'));
      }
    });

    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    request.on('error', reject);
  });
}

function sanitizeNewProduct(payload) {
  const name = String(payload.name || '').trim();
  const category = String(payload.category || '').trim();
  const quantity = Number(payload.quantity);
  const price = Number(payload.price);
  const imageUrl = String(payload.imageUrl || '').trim();

  if (!name || !category) {
    return { error: 'Name and category are required.' };
  }

  if (!Number.isInteger(quantity) || quantity < 0) {
    return { error: 'Quantity must be a non-negative whole number.' };
  }

  if (!Number.isFinite(price) || price < 0) {
    return { error: 'Price must be a non-negative number.' };
  }

  if (imageUrl) {
    const isHttpImage = /^https?:\/\//i.test(imageUrl);

    if (!isHttpImage) {
      return { error: 'Image URL must start with http:// or https://.' };
    }
  }

  return {
    product: {
      name,
      category,
      quantity,
      price: Number(price.toFixed(2)),
      imageUrl: imageUrl || buildProductImageUrl(name, category)
    }
  };
}

function sanitizeQuantityUpdate(payload) {
  const quantity = Number(payload.quantity);

  if (!Number.isInteger(quantity) || quantity < 0) {
    return { error: 'Quantity must be a non-negative whole number.' };
  }

  return { quantity };
}

function serveStaticFile(filePath, response) {
  const extension = path.extname(filePath);
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8'
  }[extension] || 'text/plain; charset=utf-8';

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'Content-Type': contentType });
    response.end(contents);
  });
}

function createServer(appState = createAppState()) {
  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    const { pathname } = requestUrl;

    if (pathname === '/api/product-image' && request.method === 'GET') {
      try {
        const name = requestUrl.searchParams.get('name') || 'motocross bike';
        const category = requestUrl.searchParams.get('category') || 'dirt bike';
        const imageUrl = await resolveMotocrossImageUrl(name, category);

        response.writeHead(302, {
          Location: imageUrl,
          'Cache-Control': 'public, max-age=86400'
        });
        response.end();
      } catch (error) {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Image not available');
      }
      return;
    }

    if (pathname === '/api/products' && request.method === 'GET') {
      sendJson(response, 200, { products: appState.products });
      return;
    }

    if (pathname === '/api/products' && request.method === 'POST') {
      try {
        const body = await parseBody(request);
        const { product, error } = sanitizeNewProduct(body);

        if (error) {
          sendJson(response, 400, { error });
          return;
        }

        const newProduct = { id: appState.nextId++, ...product };
        appState.products.unshift(newProduct);
        sendJson(response, 201, { product: newProduct });
      } catch (error) {
        sendJson(response, 400, { error: error.message });
      }
      return;
    }

    const productMatch = pathname.match(/^\/api\/products\/(\d+)$/);

    if (productMatch && request.method === 'PATCH') {
      try {
        const productId = Number(productMatch[1]);
        const product = appState.products.find((item) => item.id === productId);

        if (!product) {
          sendJson(response, 404, { error: 'Product not found.' });
          return;
        }

        const body = await parseBody(request);
        const { quantity, error } = sanitizeQuantityUpdate(body);

        if (error) {
          sendJson(response, 400, { error });
          return;
        }

        product.quantity = quantity;
        sendJson(response, 200, { product });
      } catch (error) {
        sendJson(response, 400, { error: error.message });
      }
      return;
    }

    if (productMatch && request.method === 'DELETE') {
      const productId = Number(productMatch[1]);
      const productIndex = appState.products.findIndex((item) => item.id === productId);

      if (productIndex === -1) {
        sendJson(response, 404, { error: 'Product not found.' });
        return;
      }

      appState.products.splice(productIndex, 1);
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === 'GET') {
      const targetPath = pathname === '/' ? 'index.html' : pathname.slice(1);
      const normalizedPath = path.resolve(publicDir, targetPath);
      const relativePath = path.relative(publicDir, normalizedPath);

      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Forbidden');
        return;
      }

      serveStaticFile(normalizedPath, response);
      return;
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  const server = createServer();

  server.listen(port, () => {
    console.log(`Inventory app running at http://localhost:${port}`);
  });
}

module.exports = {
  createAppState,
  createInitialProducts,
  createServer
};
