/* ════════════════════════════════════════════════════════════════════════════
   STEP 1 — INVENTORY MERGE
════════════════════════════════════════════════════════════════════════════ */
window._mergeVariantInventory = function (fullVariants) {
  let pageVariants = [];

  document.querySelectorAll('script[type="application/json"], script[data-product-json]').forEach(s => {
    if (pageVariants.length) return;
    try {
      const d = JSON.parse(s.textContent);
      if (d?.variants?.[0]?.inventory_quantity !== undefined) {
        pageVariants = d.variants;
      }
    } catch (e) {}
  });

  if (!pageVariants.length) return fullVariants;

  return fullVariants.map(fv => {
    const pv = pageVariants.find(p => p.id === fv.id);
    if (!pv) return fv;
    return {
      ...fv,
      inventory_quantity:   pv.inventory_quantity,
      inventory_management: pv.inventory_management,
      inventory_policy:     pv.inventory_policy,
    };
  });
};

/* ════════════════════════════════════════════════════════════════════════════
   STEP 2 — LOAD FULL VARIANTS
════════════════════════════════════════════════════════════════════════════ */
window._fullVariantCache = null;

window._loadFullVariants = function () {
  return new Promise((resolve) => {
    if (window._fullVariantCache) { resolve(window._fullVariantCache); return; }

    const canonical   = document.querySelector('link[rel="canonical"]')?.href;
    const productPath = canonical
      ? new URL(canonical).pathname
      : window.location.pathname.split('?')[0];

    if (!productPath.includes('/products/')) { resolve(null); return; }

    fetch(productPath.replace(/\/$/, '') + '.js')
      .then(r => r.json())
      .then(data => {
        if (data.variants?.length) {
          const merged = window._mergeVariantInventory(data.variants);
          window._fullVariantCache = merged;
          resolve(merged);
        } else {
          resolve(null);
        }
      })
      .catch(() => resolve(null));
  });
};


window.publish = window.publish || function () {};

window.PUB_SUB_EVENTS = window.PUB_SUB_EVENTS || {
  optionValueSelectionChange: 'optionValueSelectionChange'
};

/* ════════════════════════════════════════════════════════════════════════════
   UTILITY — MONEY FORMATTING
════════════════════════════════════════════════════════════════════════════ */

window.formatMoney = function (cents) {
  if (cents === null || cents === undefined || isNaN(cents)) return '';

  const amount = parseFloat(cents) / 100;

  if (window.Shopify && window.Shopify.formatMoney) {
    return window.Shopify.formatMoney(cents, window.Shopify.money_format || '{{amount}}');
  }

  const currency = window.Shopify?.currency?.active
    || window.theme?.currency
    || 'USD';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch (e) {
    return currency + ' ' + amount.toFixed(2);
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   UTILITY — PRODUCT DATA
════════════════════════════════════════════════════════════════════════════ */

window.getProductData = function (scope) {
  let el = null;

  if (scope && scope !== document) {
    el = scope.querySelector('[data-product-json]');
    if (!el) {
      let node = scope.parentElement;
      while (node) {
        el = node.querySelector('[data-product-json]');
        if (el) break;
        node = node.parentElement;
      }
    }
  }

  if (!el) el = document.querySelector('[data-product-json]');

  try {
    return JSON.parse(el?.textContent || '{}');
  } catch (e) {
    return {};
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   UTILITY — SCOPE-AWARE ELEMENT FINDER
════════════════════════════════════════════════════════════════════════════ */

window._qvFind = function (id, scope) {
  if (scope) {
    const prefixed = scope.querySelector(`#qv-${id}`);
    if (prefixed) return prefixed;
    const plain = scope.querySelector(`#${id}`);
    if (plain) return plain;
  }
  return document.getElementById(id);
};

/* ════════════════════════════════════════════════════════════════════════════
   UTILITY — GET CURRENTLY SELECTED OPTIONS
════════════════════════════════════════════════════════════════════════════ */

window._getSelectedOptions = function (scope) {
  const root = scope || document;
  const options = [];

  const inputs = root.querySelectorAll(
    'variant-selects input[type="radio"]:checked, variant-selects select'
  );

  if (inputs.length) {
    inputs.forEach(el => options.push(el.value));
    return options;
  }

  const activeColor = root.querySelector('.color-option.active');
  const activeSize  = root.querySelector('.size-option.active');

  if (activeColor) options.push(activeColor.dataset.color);
  if (activeSize)  options.push(activeSize.dataset.size);

  return options;
};

/* ════════════════════════════════════════════════════════════════════════════
   UTILITY — FIND VARIANT FROM SELECTED OPTIONS
════════════════════════════════════════════════════════════════════════════ */

window._findVariantFromOptions = function (variants, selectedOptions) {
  if (!variants || !selectedOptions.length) return null;

  return variants.find(variant =>
    selectedOptions.every((val, i) => variant.options[i] === val)
  ) || null;
};

/* ════════════════════════════════════════════════════════════════════════════
   GALLERY SLIDER SYNC
════════════════════════════════════════════════════════════════════════════ */

window._syncSliderToVariant = function (variant, scope) {
  if (!variant) return;

  const variantId = variant.id;
  const mediaId   = variant?.featured_media?.id;

  const wrapper =
    (scope && scope.classList?.contains('quick-view-product-wrapper'))
      ? scope
      : scope?.closest?.('.quick-view-product-wrapper') ||
        scope?.querySelector?.('.quick-view-product-wrapper') ||
        scope;

  if (!wrapper) return;

  wrapper.dispatchEvent(
    new CustomEvent('qv:sync-slide', {
      bubbles: false,
      detail: { variantId, mediaId }
    })
  );
};

/* ════════════════════════════════════════════════════════════════════════════
   PRICE UPDATE
════════════════════════════════════════════════════════════════════════════ */

window.updatePrice = function (productCard, variant, scope) {
  if (!variant) return;
  if (!variant.price && variant.price !== 0) return;

  const newPrice   = window.formatMoney(variant.price);
  const compare    = variant.compare_at_price;
  const onSale     = compare && compare > variant.price;
  const compareStr = onSale ? window.formatMoney(compare) : '';

  const sectionId  = productCard?.dataset?.section;
  const searchRoot = scope || (sectionId ? productCard : null) || document;

  const priceWrapper =
    (sectionId ? document.querySelector(`#price-${sectionId}, #qv-price-${sectionId}`) : null) ||
    searchRoot.querySelector('.price')      ||
    searchRoot.querySelector('[id^="price-"]');

  if (!priceWrapper) return;

  const priceContainer = priceWrapper.querySelector('.price__container') || priceWrapper;

  priceWrapper.classList.toggle('price--on-sale',  onSale);
  priceWrapper.classList.toggle('price--sold-out', !variant.available);

  priceWrapper.classList.add('price--show-badge');

  priceContainer.querySelectorAll('.price__regular .price-item--regular').forEach(el => {
    el.textContent = newPrice;
  });

  priceContainer.querySelectorAll(
    '.price__sale .price-item--sale, .price__sale .price-sale'
  ).forEach(el => {
    el.textContent = newPrice;
  });

  priceContainer.querySelectorAll(
    '.price__sale .price-compare, .price__sale s .money'
  ).forEach(el => {
    el.textContent = onSale ? compareStr : '';
  });

  priceContainer.querySelectorAll(
    '.price__regular .price-compare, .price__regular s .money'
  ).forEach(el => {
    el.textContent = onSale ? compareStr : '';
  });

    let badge = priceWrapper.querySelector('.price__badge-sale');

    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'badge price__badge-sale';
      const salePriceDiv = priceWrapper.querySelector('.price__sale');
      if (salePriceDiv) {
        salePriceDiv.appendChild(badge);   
      } else {
        priceWrapper.appendChild(badge);
      }
    }

    if (onSale) {
      const pct         = Math.round(((compare - variant.price) / compare) * 100);
      badge.textContent = `${pct}% off`;
      badge.style.display = '';
      badge.removeAttribute('hidden');
      badge.classList.remove('hidden', 'visibility-hidden');
      priceWrapper.classList.add('price--show-badge');   
    } else {
      badge.style.display = 'none';
      priceWrapper.classList.remove('price--show-badge'); 
    }

      const soldOutBadge = priceWrapper.querySelector('.price__badge-sold-out');
      if (soldOutBadge) {
        soldOutBadge.style.display = variant.available ? 'none' : '';
      }

      const addBtn = searchRoot.querySelector(
        'button[name="add"], .product-form__submit, button[type="submit"]'
      );
      if (addBtn) {
        addBtn.disabled = !variant.available;
        const btnSpan   = addBtn.querySelector(
          'span:not(.loading-overlay__spinner):not(.visually-hidden)'
        );
        const label = variant.available ? 'Add to cart' : 'Notify Me';
        if (btnSpan) btnSpan.textContent = label;
      }
};


/* ════════════════════════════════════════════════════════════════════════════
   BUY BUTTON
════════════════════════════════════════════════════════════════════════════ */

window.updateBuyButton = function (productCard, variant, scope) {
  if (!productCard || !variant) return;

  const sectionId   = productCard.dataset.section;
  const button      = window._qvFind(`ProductSubmitButton-${sectionId}`, scope);
  const hiddenInput = window._qvFind(`ProductVariantId-${sectionId}`, scope);

  if (!button) return;

  const btnText = button.querySelector('.productbtn');

  if (!variant.available) {
    button.setAttribute('disabled', 'true');
    if (hiddenInput) hiddenInput.setAttribute('disabled', 'true');
    if (btnText) btnText.innerText = 'Notify Me';
  } else {
    button.removeAttribute('disabled');
    if (hiddenInput) hiddenInput.removeAttribute('disabled');
    if (btnText) btnText.innerText = 'Add to Cart';
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   INVENTORY DISPLAY
════════════════════════════════════════════════════════════════════════════ */

window.updateInventory = function (productCard, variant, scope) {
  if (!productCard || !variant) return;

  const sectionId  = productCard.dataset?.section;
  const searchRoot = scope || document;

  const inventoryContainer =
    (sectionId ? window._qvFind(`Inventory-${sectionId}`, scope) : null) ||
    searchRoot.querySelector(`#Inventory-${sectionId}`)                   ||
    searchRoot.querySelector('[id^="Inventory-"]')                        ||
    searchRoot.querySelector('.product__inventory')                       ||
    searchRoot.querySelector('[data-inventory]');

  if (!inventoryContainer) return;
  const setStatus = (status) => {
    inventoryContainer.classList.remove('inventory--in-stock', 'inventory--low-stock', 'inventory--out-of-stock');
    if (status) inventoryContainer.classList.add(status);
  };

  if (!variant.inventory_management || variant.inventory_management !== 'shopify') {
    setStatus('');
    inventoryContainer.classList.add('visibility-hidden');
    return;
  }

  inventoryContainer.classList.remove('visibility-hidden');

  const threshold = parseInt(inventoryContainer.dataset.threshold || 10);
  const showCount = inventoryContainer.dataset.showCount === 'true';
  const qty       = variant.inventory_quantity ?? 0;

  const dot = (color) =>
    `<span class="svg-wrapper" style="color:${color}">` +
    `<svg width="15" height="15"><circle cx="7.5" cy="7.5" r="5" fill="currentColor"/></svg>` +
    `</span>`;

  let html   = '';
  let status = '';

  if (qty > 0) {
    if (qty <= threshold) {
      status = 'inventory--low-stock';
      html   = `${dot('rgb(238,148,65)')} ${showCount ? `Low stock: ${qty} left` : 'Low stock'}`;
    } else {
      status = 'inventory--in-stock';
      html   = `${dot('rgb(62,214,96)')} ${showCount ? `${qty} in stock` : 'In stock'}`;
    }
  } else {
    if (variant.inventory_policy === 'continue') {
      status = 'inventory--in-stock';
      html   = `${dot('rgb(62,214,96)')} In stock`;
    } else {
      status = 'inventory--out-of-stock';
      html   = `${dot('#ee00003b')} Out of stock`;
    }
  }

  setStatus(status);
  inventoryContainer.innerHTML = html;
};
/* ════════════════════════════════════════════════════════════════════════════
   URL UPDATE
════════════════════════════════════════════════════════════════════════════ */

window.updateURL = function (variantId) {
  if (!variantId) return;
  const url = new URL(window.location.href);
  url.searchParams.set('variant', variantId);
  window.history.replaceState({}, '', url);
};

/* ════════════════════════════════════════════════════════════════════════════
   VARIANT INPUT UPDATE
════════════════════════════════════════════════════════════════════════════ */

window.updateVariantInput = function (productCard, variantId, scope) {
  if (!variantId || !productCard) return;

  const sectionId   = productCard.dataset.section;
  const hiddenInput =
    window._qvFind(`ProductVariantId-${sectionId}`, scope) ||
    productCard.querySelector('input[name="id"]');

  if (hiddenInput) {
    hiddenInput.value = variantId;
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   SIZE AVAILABILITY FILTERING
════════════════════════════════════════════════════════════════════════════ */

window.updateSizeAvailability = function (productCard, selectedColor, scope) {
  const productData = window.getProductData(scope || productCard);

  productCard.querySelectorAll('.size-option').forEach((option) => {
    const size    = option.dataset.size;
    const variant = productData.variants?.find(
      v => v.options[0] === selectedColor && v.options[1] === size
    );

    if (!variant || !variant.available) {
      option.classList.add('disabled');
      const input = option.querySelector('input[type="radio"]');
      if (input) { input.classList.add('disabled'); input.disabled = true; }
    } else {
      option.classList.remove('disabled');
      const input = option.querySelector('input[type="radio"]');
      if (input) { input.classList.remove('disabled'); input.disabled = false; }
    }
  });
};

/* ════════════════════════════════════════════════════════════════════════════
   SWATCH ACTIVE STATE SYNC
════════════════════════════════════════════════════════════════════════════ */

window.syncSwatches = function (productCard, variant) {
  if (!productCard || !variant) return;

  const [color, size] = variant.options;

  productCard.querySelectorAll('.color-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.color === color);
  });

  productCard.querySelectorAll('.size-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.size === size);
  });
};

/* ════════════════════════════════════════════════════════════════════════════
   MAIN VARIANT UPDATE — applyVariant
════════════════════════════════════════════════════════════════════════════ */

window.applyVariant = function (productCard, variant, scope, options) {
  if (!productCard || !variant || typeof variant !== 'object') return;

  const fullVariant   = window._fullVariantCache?.find(v => v.id === variant.id) || variant;
  const resolvedScope = scope || window._resolveScope?.(productCard) || null;

  window.updatePrice(productCard, fullVariant, resolvedScope);

  const form   = (resolvedScope || productCard).querySelector('form');
  const addBtn = form?.querySelector('[type="submit"]');
  if (addBtn) {
    addBtn.disabled    = !fullVariant.available;
    addBtn.textContent = fullVariant.available ? 'Add to cart' : 'Notify Me';
  }
  const idInput = form?.querySelector('input[name="id"]');
  if (idInput) idInput.value = fullVariant.id;

  window.updateBuyButton(productCard, fullVariant, resolvedScope);
  window.updateInventory(productCard, fullVariant, resolvedScope);
 if (!options?.skipURL) window.updateURL(fullVariant.id, resolvedScope);
  window.updateVariantInput(productCard, fullVariant.id, resolvedScope);
  window.syncSwatches(productCard, fullVariant);

  if (resolvedScope) window._syncSliderToVariant?.(fullVariant, resolvedScope);
};

/* ════════════════════════════════════════════════════════════════════════════
   COLOR SWATCH INITIALIZATION
════════════════════════════════════════════════════════════════════════════ */

window.colorSwatchUpdate = function (root) {
  const rootEl = root || document;

  rootEl.querySelectorAll('.collection-swatches').forEach((productCard) => {
    productCard.querySelectorAll('.color-option').forEach(option => {
      option.replaceWith(option.cloneNode(true));
    });

    productCard.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', function () {
        const scope = root
          || this.closest('.quick-view-product-wrapper')
          || this.closest('product-info')
          || this.closest('[data-section]')
          || null;

        const productData   = window.getProductData(scope || productCard);
        const selectedColor = this.dataset.color;

        productCard.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
        this.classList.add('active');

        const productImage = productCard.querySelector('.productImage');
        if (this.dataset.image && productImage) productImage.src = this.dataset.image;

        window.updateSizeAvailability(productCard, selectedColor, scope || productCard);

        const selectedOptions = window._getSelectedOptions(scope || productCard);
        selectedOptions[0] = selectedColor;

        const variant =
          window._findVariantFromOptions(productData.variants, selectedOptions) ||
          productData.variants?.find(v => v.options[0] === selectedColor && v.available) ||
          productData.variants?.find(v => v.options[0] === selectedColor);

        if (variant) {
          window.applyVariant(productCard, variant, scope);
          window.updatePrice(productCard, variant, scope);
        }
      });
    });
  });
};

/* ════════════════════════════════════════════════════════════════════════════
   SIZE SWATCH INITIALIZATION
════════════════════════════════════════════════════════════════════════════ */

window.sizeSwatchUpdate = function (root) {
  const rootEl = root || document;

  rootEl.querySelectorAll('.collection-swatches').forEach((productCard) => {
    const productData = window.getProductData(productCard);

    function updateSizes() {
      const selectedColor = productCard.querySelector('.color-option.active')?.dataset.color;

      productCard.querySelectorAll('.size-option').forEach(option => {
        const size    = option.dataset.size;
        const variant = productData.variants?.find(
          v => v.options[0] === selectedColor && v.options[1] === size && v.available
        );
        option.classList.toggle('disabled', !variant);
        if (!variant) option.classList.remove('active');
      });
    }

    productCard.querySelectorAll('.size-option').forEach(option => {
      option.replaceWith(option.cloneNode(true));
    });

    productCard.querySelectorAll('.size-option').forEach(option => {
      option.addEventListener('click', function () {
        if (this.classList.contains('disabled')) return;

        productCard.querySelectorAll('.size-option').forEach(o => o.classList.remove('active'));
        this.classList.add('active');

        const selectedSize  = this.dataset.size;
        const selectedColor = productCard.querySelector('.color-option.active')?.dataset.color;

        const scope = root
          || this.closest('.quick-view-product-wrapper')
          || this.closest('product-info')
          || this.closest('[data-section]')
          || null;

        const variant = productData.variants?.find(
          v => v.options[0] === selectedColor && v.options[1] === selectedSize
        );

        if (variant) {
          window.applyVariant(productCard, variant, scope);
          window.updatePrice(productCard, variant, scope);
        }
      });
    });

    productCard.querySelectorAll('.color-option').forEach(color => {
      color.addEventListener('click', function () {
        productCard.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        updateSizes();
      });
    });

    updateSizes();
  });
};

/* ════════════════════════════════════════════════════════════════════════════
   LOAD VARIANT FROM URL
════════════════════════════════════════════════════════════════════════════ */

window.loadVariantFromURL = function (scope) {
  const params    = new URLSearchParams(window.location.search);
  const variantId = params.get('variant');
  if (!variantId) return;

  const productCard = (scope || document).querySelector('[data-section]');
  if (!productCard) return;

  const productData = window.getProductData(scope || productCard);
  const variant     = productData.variants?.find(v => v.id == variantId);

  if (variant) window.applyVariant(productCard, variant, scope);
};

/* ════════════════════════════════════════════════════════════════════════════
   VARIANT-SELECTS CUSTOM ELEMENT
════════════════════════════════════════════════════════════════════════════ */

if (!customElements.get('variant-selects')) {
  customElements.define(
    'variant-selects',
    class VariantSelects extends HTMLElement {
      connectedCallback() {
        this.addEventListener('change', (event) => {
          const scope       = this.closest('.quick-view-product-wrapper') || null;
          const productCard = this.closest('[data-section]') || this;
          const productData = window.getProductData(scope || productCard);

          if (!productData?.variants) return;

          const selectedVariant = this._getSelectedVariant(scope || productCard);
          if (!selectedVariant) return;

          const fullVariant = window._fullVariantCache?.find(v => v.id === selectedVariant.id)
            || selectedVariant;

          window.updateVariantAvailability(this, productData);
          window.applyVariant(productCard, fullVariant, scope);

          const fieldsets = this.querySelectorAll('.product-form__input');
          fullVariant.options?.forEach((value, index) => {
            const span = fieldsets[index]?.querySelector('[data-selected-value]');
            if (span) span.textContent = value;
          });

          publish(window.PUB_SUB_EVENTS.optionValueSelectionChange, {
            data: { event, selectedVariant: fullVariant }
          });
        });
      }

      _getSelectedVariant(scope) {
        const productData = window.getProductData(scope || this);
        if (!productData?.variants) return null;

        const selectedOptions = window._getSelectedOptions(scope || this);
        if (!selectedOptions.length) return null;

        const variants = window._fullVariantCache || productData.variants;
        return window._findVariantFromOptions(variants, selectedOptions);
      }
    }
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VARIANT AVAILABILITY CHECKER
════════════════════════════════════════════════════════════════════════════ */

window.updateVariantAvailability = function (container, productData) {
  const fieldsets = container.querySelectorAll('.product-form__input');

  fieldsets.forEach((fieldset, optionIndex) => {
    const inputs = fieldset.querySelectorAll('input[type="radio"], option');

    inputs.forEach(input => {
      const value           = input.value;
      const selectedOptions = Array.from(
        container.querySelectorAll('input[type="radio"]:checked, select')
      ).map(el => el.value);

      selectedOptions[optionIndex] = value;

      const isAvailable = productData.variants.some(
        variant =>
          variant.options.every((opt, i) => opt === selectedOptions[i]) && variant.available
      );

      input.disabled = !isAvailable;
      if (input.tagName !== 'OPTION') {
        input.classList.toggle('disabled', !isAvailable);
      }
    });
  });
};

/* ════════════════════════════════════════════════════════════════════════════
   QUICK VIEW RE-INIT
════════════════════════════════════════════════════════════════════════════ */

window.reinitVariants = function (wrapper) {
  window.colorSwatchUpdate(wrapper);
  window.sizeSwatchUpdate(wrapper);

  const productCard = wrapper.querySelector('[data-section]');
  if (!productCard) return;

  const productData = window.getProductData(wrapper);
  if (!productData.variants?.length) return;

  const variantSelects = wrapper.querySelector('variant-selects');
  let initialVariant   = variantSelects
    ? variantSelects._getSelectedVariant(wrapper)
    : null;

  if (!initialVariant) {
    const selectedOptions = window._getSelectedOptions(wrapper);
    initialVariant =
      window._findVariantFromOptions(productData.variants, selectedOptions) ||
      productData.variants.find(v => v.available) ||
      productData.variants[0];
  }

  if (initialVariant) {
    requestAnimationFrame(() => {
      window.applyVariant(productCard, initialVariant, wrapper);
    });
  }
};

/* ════════════════════════════════════════════════════════════════════════════
   PAGE LOAD INIT
════════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {
  window.colorSwatchUpdate();
  window.sizeSwatchUpdate();

  const productCard = document.querySelector('[data-section]');
  if (!productCard) {
    window.loadVariantFromURL();
    return;
  }

  window._loadFullVariants().then(fullVariants => {
    const productData    = window.getProductData();
    const variantSelects = document.querySelector('variant-selects');
    const variants       = fullVariants || productData.variants || [];
    const selectedOptions = window._getSelectedOptions(document);

    const initialVariant =
      (variantSelects ? variantSelects._getSelectedVariant() : null) ||
      window._findVariantFromOptions(variants, selectedOptions)       ||
      variants.find(v => v.available)                                 ||
      variants[0];

   if (initialVariant) window.applyVariant(productCard, initialVariant, null, { skipURL: true });

    window.loadVariantFromURL();
  });
});

/* ════════════════════════════════════════════════════════════════════════════
  SWATCH SELECT DROPDOWN
════════════════════════════════════════════════════════════════════════════ */

document.addEventListener('change', function (e) {
  if (!e.target.classList.contains('swatch-dropdown-select')) return;

  const select = e.target;
  const wrapper = select.closest('.swatch-dropdown-wrapper');
  if (!wrapper) return;

  const swatch = wrapper.querySelector('.dropdown-swatch');
  if (!swatch) return;

  const selectedOption = select.options[select.selectedIndex];

  const color = selectedOption?.dataset?.color;
  const image = selectedOption?.dataset?.image;

  swatch.style.backgroundImage = '';
  swatch.style.backgroundColor = '';

  if (image) {
    swatch.style.backgroundImage = `url(${image})`;
    swatch.style.backgroundSize = 'cover';
    swatch.style.backgroundRepeat = 'no-repeat';
  } else if (color) {
    swatch.style.backgroundColor = color;
  }
});
