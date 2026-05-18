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
    const name = fragment.querySelector('.product-name');
    const meta = fragment.querySelector('.product-meta');
    const price = fragment.querySelector('.price-badge');
    const quantityInput = fragment.querySelector('.quantity-input');
    const updateButton = fragment.querySelector('.update-button');
    const deleteButton = fragment.querySelector('.delete-button');

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
