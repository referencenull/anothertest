const inventoryList = document.querySelector('#inventory-list');
const productForm = document.querySelector('#product-form');
const formMessage = document.querySelector('#form-message');
const productTemplate = document.querySelector('#product-template');
const productCount = document.querySelector('#product-count');
const unitCount = document.querySelector('#unit-count');

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(data?.error || 'Something went wrong.');
  }

  return data;
}

function buildImageFallback(product) {
  const label = String(product.name || 'Bike').replace(/[<>&"']/g, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" role="img" aria-label="No image available">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#e9edf8" />
          <stop offset="100%" stop-color="#d9e0f4" />
        </linearGradient>
      </defs>
      <rect width="640" height="420" fill="url(#bg)" />
      <circle cx="210" cy="290" r="55" fill="none" stroke="#34415f" stroke-width="10" />
      <circle cx="430" cy="290" r="55" fill="none" stroke="#34415f" stroke-width="10" />
      <path d="M205 290 L280 250 L345 250 L430 290" fill="none" stroke="#1f2a44" stroke-width="12" stroke-linecap="round" />
      <path d="M280 250 L250 210 L315 210 L345 250" fill="none" stroke="#1f2a44" stroke-width="12" stroke-linecap="round" />
      <text x="320" y="355" text-anchor="middle" fill="#1f2a44" font-size="24" font-family="Arial, sans-serif">${label}</text>
      <text x="320" y="385" text-anchor="middle" fill="#4a5778" font-size="18" font-family="Arial, sans-serif">Motocross image unavailable</text>
    </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function updateSummary(products) {
  productCount.textContent = String(products.length);
  unitCount.textContent = String(
    products.reduce((total, product) => total + product.quantity, 0)
  );
}

function showFormMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle('error', isError);
}

async function loadProducts() {
  const { products } = await requestJson('/api/products');
  renderProducts(products);
}

function renderProducts(products) {
  // Rebuild the list after each change so the UI always reflects the latest inventory state.
  updateSummary(products);
  inventoryList.innerHTML = '';

  if (products.length === 0) {
    inventoryList.innerHTML = '<p class="empty-state">No bikes yet. Add your first motocross bike above.</p>';
    return;
  }

  for (const product of products) {
    const fragment = productTemplate.content.cloneNode(true);
    const item = fragment.querySelector('.inventory-item');
    const image = fragment.querySelector('.product-image');
    const name = fragment.querySelector('.product-name');
    const meta = fragment.querySelector('.product-meta');
    const price = fragment.querySelector('.price-badge');
    const quantityInput = fragment.querySelector('.quantity-input');
    const updateButton = fragment.querySelector('.update-button');
    const deleteButton = fragment.querySelector('.delete-button');

    image.src = product.imageUrl;
    image.alt = `${product.name} photo`;
    image.addEventListener('error', () => {
      image.src = buildImageFallback(product);
    }, { once: true });
    name.textContent = product.name;
    meta.textContent = `${product.category} • ID ${product.id}`;
    price.textContent = `$${product.price.toFixed(2)}`;
    quantityInput.value = String(product.quantity);

    updateButton.addEventListener('click', async () => {
      updateButton.disabled = true;

      try {
        await requestJson(`/api/products/${product.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: Number(quantityInput.value) })
        });

        await loadProducts();
      } catch (error) {
        window.alert(error.message);
      } finally {
        updateButton.disabled = false;
      }
    });

    deleteButton.addEventListener('click', async () => {
      const confirmed = window.confirm(`Delete ${product.name}?`);

      if (!confirmed) {
        return;
      }

      deleteButton.disabled = true;

      try {
        await requestJson(`/api/products/${product.id}`, { method: 'DELETE' });
        await loadProducts();
      } catch (error) {
        window.alert(error.message);
      } finally {
        deleteButton.disabled = false;
      }
    });

    item.dataset.productId = String(product.id);
    inventoryList.appendChild(fragment);
  }
}

productForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(productForm);

  try {
    await requestJson('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.get('name'),
        category: formData.get('category'),
        imageUrl: formData.get('imageUrl'),
        quantity: Number(formData.get('quantity')),
        price: Number(formData.get('price'))
      })
    });

    productForm.reset();
    productForm.querySelector('[name="quantity"]').value = '0';
    productForm.querySelector('[name="price"]').value = '0.00';
    showFormMessage('Bike added successfully.');
    await loadProducts();
  } catch (error) {
    showFormMessage(error.message, true);
  }
});

loadProducts().catch((error) => {
  inventoryList.innerHTML = `<p class="empty-state error">${error.message}</p>`;
});
