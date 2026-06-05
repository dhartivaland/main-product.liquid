/* ================================
   FIX: Shopify publish fallback
================================ */
window.publish = window.publish || function () {};
window.PUB_SUB_EVENTS = window.PUB_SUB_EVENTS || {
  optionValueSelectionChange: 'optionValueSelectionChange'
};

/* ================================
   FORMAT MONEY
================================ */
window.formatMoney = function (cents) {
  if (cents === null || cents === undefined || isNaN(cents)) return '';

  const amount = parseFloat(cents) / 100;

  if (window.Shopify?.formatMoney) {
    return window.Shopify.formatMoney(cents, window.Shopify.money_format);
  }

  const currency =
    window.Shopify?.currency?.active ||
    document.querySelector('[data-currency]')?.dataset.currency ||
    window.Shopify?.shop?.currency ||
    'INR';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    return currency + ' ' + amount.toFixed(2);
  }
};
/* ================================
   GET PRODUCT DATA
================================ */
window.getProductData = function (scope) {
  if (scope && scope !== document) {
    let el = scope.querySelector('[data-product-json]');
    if (!el) {
      let node = scope.parentElement;
      while (node) {
        el = node.querySelector('[data-product-json]');
        if (el) break;
        node = node.parentElement;
      }
    }
    if (el) { try { const d = JSON.parse(el.textContent); if (d?.variants) return d; } catch(e){} }
  }

  const root = (scope && scope !== document) ? scope : document;

  let el = root.querySelector('script[id^="ProductJson-"]');
  if (el) { try { const d = JSON.parse(el.textContent); if (d?.variants) return d; } catch(e){} }

  el = root.querySelector('[data-product-json]');
  if (el) { try { const d = JSON.parse(el.textContent); if (d?.variants) return d; } catch(e){} }

  for (const s of root.querySelectorAll('script[type="application/json"]')) {
    try { const d = JSON.parse(s.textContent); if (d?.variants?.length) return d; } catch(e){}
  }

  if (scope && scope !== document) return window.getProductData(null);
  return {};
};

/* ================================
   FIND VARIANT HIDDEN INPUT
================================ */
window._findVariantInput = function (scope) {
  const root = scope || document;
  return (
    root.querySelector('.product-variant-id')             ||
    root.querySelector('input[name="id"][type="hidden"]') ||
    root.querySelector('input[name="id"]')
  );
};

/* ================================
   SCOPE-AWARE FIND HELPER
================================ */
window._qvFind = function (id, scope) {
  if (scope) {
    const prefixed = scope.querySelector(`#qv-${id}`);
    if (prefixed) return prefixed;
    const plain = scope.querySelector(`#${id}`);
    if (plain) return plain;
  }
  return document.getElementById(id);
};

/* ================================
   RESOLVE MODAL SCOPE
================================ */
window._resolveScope = function (el) {
  if (!el) return null;
  return el.closest?.('.quick-view-product-wrapper') || el.closest?.('quick-add-modal') || null;
};

/* ================================
   UPDATE VARIANT INPUT
================================ */
window.updateVariantInput = function (productCard, variantId, scope) {
  if (!variantId || !productCard) return;

  const sectionId = productCard.dataset?.section;

  const hiddenInput =
    window._qvFind(`ProductVariantId-${sectionId}`, scope) ||
    window._findVariantInput(scope || productCard);

  if (hiddenInput) {
    hiddenInput.value = variantId;
    hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
};

/* ================================
   UPDATE PRICE
================================ */
window.updatePrice = function (productCard, variant, scope) {
  if (!variant || !productCard) return;
  if (!variant.price && variant.price !== 0) return;

  const sectionId  = productCard.dataset?.section;
  const searchRoot = scope || productCard || document;

  const priceContainer =
    window._qvFind(`price-${sectionId}`, scope) ||
    searchRoot.querySelector('.price__container') ||
    searchRoot.querySelector('.product-price')    ||
    searchRoot.querySelector('[id^="price-"]');

  if (!priceContainer) {
    return;
  }

  priceContainer.classList.remove('price--on-sale');

  if (variant.compare_at_price && variant.compare_at_price > variant.price) {
    priceContainer.classList.add('price--on-sale');

    const saleLabelEl    = priceContainer.querySelector('.price__sale .price-item--sale');
    const regularLabelEl = priceContainer.querySelector('.price__regular .price-item--regular');
    if (saleLabelEl)    saleLabelEl.textContent    = window.formatMoney(variant.price);
    if (regularLabelEl) regularLabelEl.textContent = window.formatMoney(variant.compare_at_price);

    const saleEl    = priceContainer.querySelector('.price-item--sale');
    const compareEl = priceContainer.querySelector('.price-compare') ||
                      priceContainer.querySelector('s.price__sale')  ||
                      priceContainer.querySelector('.price-item--regular:last-child');
    if (saleEl)    saleEl.textContent    = window.formatMoney(variant.price);
    if (compareEl) compareEl.textContent = window.formatMoney(variant.compare_at_price);

    const badgeEl = priceContainer.querySelector('.price__badge-sale');
    if (badgeEl) {
      const pct = Math.round(((variant.compare_at_price - variant.price) * 100) / variant.compare_at_price);
      badgeEl.textContent   = `${pct}% off`;
      badgeEl.style.display = 'inline-block';
    }

    searchRoot.querySelectorAll('[data-sale-price]').forEach(el    => { el.textContent = window.formatMoney(variant.price); });
    searchRoot.querySelectorAll('[data-compare-price]').forEach(el => { el.textContent = window.formatMoney(variant.compare_at_price); });

  } else {
    priceContainer.querySelectorAll('.price-item--regular').forEach(el => {
      el.textContent = window.formatMoney(variant.price);
    });

    const badgeEl = priceContainer.querySelector('.price__badge-sale');
    if (badgeEl) badgeEl.style.display = 'none';

    searchRoot.querySelectorAll('[data-sale-price]').forEach(el    => { el.textContent = window.formatMoney(variant.price); });
    searchRoot.querySelectorAll('[data-compare-price]').forEach(el => { el.textContent = ''; });
  }

  priceContainer.classList.toggle('price--sold-out', !variant.available);
};

/* ================================
   UPDATE BUY BUTTON
================================ */
window.updateBuyButton = function (productCard, variant, scope) {
  if (!productCard || !variant) return;

  const sectionId = productCard.dataset?.section;
  const button      = window._qvFind(`ProductSubmitButton-${sectionId}`, scope);
  const hiddenInput = window._qvFind(`ProductVariantId-${sectionId}`, scope);

  if (!button) return;

  const btnText = button.querySelector('.productbtn') || button.querySelector('span');

  if (!variant.available) {
    button.setAttribute('disabled', true);
    if (hiddenInput) hiddenInput.setAttribute('disabled', true);
    if (btnText) btnText.innerText = 'Notify Me';
  } else {
    button.removeAttribute('disabled');
    if (hiddenInput) hiddenInput.removeAttribute('disabled');
    if (btnText) btnText.innerText = 'Add to Cart';
  }
};

/* ================================
   UPDATE INVENTORY
================================ */
window.updateInventory = function (productCard, variant, scope) {
  if (!productCard || !variant) return;

  const sectionId          = productCard.dataset?.section;
  const inventoryContainer = window._qvFind(`Inventory-${sectionId}`, scope);
  if (!inventoryContainer) return;

  const threshold = parseInt(inventoryContainer.dataset.threshold || 10);
  const showCount = inventoryContainer.dataset.showCount === 'true';

  if (variant.inventory_management !== 'shopify') {
    inventoryContainer.classList.add('visibility-hidden');
    return;
  }

  inventoryContainer.classList.remove('visibility-hidden');
  const qty = variant.inventory_quantity;

  const dot = (color) =>
    `<span class="svg-wrapper" style="color:${color}">` +
    `<svg width="15" height="15"><circle cx="7.5" cy="7.5" r="5" fill="currentColor"/></svg>` +
    `</span>`;

  let html = '';
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
      html   = `${dot('rgb(200,200,200)')} Out of stock`;
    }
  }

  inventoryContainer.innerHTML = html;
};

/* ================================
   UPDATE URL — skipped inside QV
================================ */
window.updateURL = function (variantId, scope) {
  if (scope || !variantId) return;
  const url = new URL(window.location.href);
  url.searchParams.set('variant', variantId);
  window.history.replaceState({}, '', url);
};

/* ================================
   UPDATE QUANTITY SELECTOR
================================ */
window.updateQuantitySelector = function (scope) {
  const searchRoot = scope || document;
  const containers = searchRoot.querySelectorAll('.custom-quantity');

  containers.forEach(container => {
    if (container.dataset.qtyInitialized) return;
    container.dataset.qtyInitialized = 'true';

    const input = container.querySelector('input[name="quantity"], .qty-input');
    const minus = container.querySelector('.qty-minus, [name="minus"], [name="decrement"]');
    const plus  = container.querySelector('.qty-plus, [name="plus"], [name="increment"]');

    if (!input) return;

    const validateAndUpdate = (change) => {
      const min  = parseInt(input.getAttribute('min'))  || 1;
      const max  = parseInt(input.getAttribute('max'))  || Infinity;
      const step = parseInt(input.getAttribute('step')) || 1;
      const cur  = parseInt(input.value) || 1;
      input.value = Math.max(min, Math.min(max, cur + change * step));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };

    if (minus) minus.addEventListener('click', (e) => { e.preventDefault(); e.stopImmediatePropagation(); validateAndUpdate(-1); });
    if (plus)  plus.addEventListener('click',  (e) => { e.preventDefault(); e.stopImmediatePropagation(); validateAndUpdate(1);  });

    input.addEventListener('change', (e) => {
      if (!e.isTrusted) return;
      const min = parseInt(input.getAttribute('min')) || 1;
      const max = parseInt(input.getAttribute('max')) || Infinity;
      input.value = Math.max(min, Math.min(max, parseInt(input.value) || 1));
    });
  });
};

document.addEventListener('DOMContentLoaded', () => {
  window.updateQuantitySelector();
});

/* ================================
   UPDATE SLIDER FOR VARIANT
================================ */
window.updateSliderForVariant = function (variant, scope) {
  if (!variant) return;
  const searchRoot = scope || document;

  const mediaId = variant.featured_media?.id || variant.featured_image?.media_id || null;
  if (!mediaId) return;

  const gallery = searchRoot.querySelector('.product-gallery');
  if (gallery && typeof gallery._updateSlider === 'function') {
    const slides = gallery.querySelectorAll('.gallery-slide');
    const idx    = Array.from(slides).findIndex(s => s.dataset.mediaId == mediaId);
    if (idx !== -1) { gallery._updateSlider(idx); return; }
  }

  if (typeof window._galleryUpdateSlider === 'function') {
    const g2 = searchRoot.querySelector('.product-gallery');
    if (g2) {
      const slides = g2.querySelectorAll('.gallery-slide');
      const idx    = Array.from(slides).findIndex(s => s.dataset.mediaId == mediaId);
      if (idx !== -1) { window._galleryUpdateSlider(idx); return; }
    }
  }

  const slides = searchRoot.querySelectorAll('.gallery-slide');
  if (slides.length) {
    const idx = Array.from(slides).findIndex(s => s.dataset.mediaId == mediaId);
    if (idx !== -1) {
      slides.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      searchRoot.querySelectorAll('.thumb').forEach((t, i) => t.classList.toggle('active', i === idx));
      const track = searchRoot.querySelector('.gallery-track');
      if (track && slides[0]) {
        track.style.transition = 'transform 0.4s ease';
        track.style.transform  = `translate3d(-${slides[0].offsetWidth * idx}px, 0, 0)`;
      }
      const thumbTrack = searchRoot.querySelector('.gallery-thumbs');
      const thumbItems = searchRoot.querySelectorAll('.thumb');
      if (thumbTrack && thumbItems[idx]) {
        const t = thumbItems[idx].parentElement || thumbItems[idx];
        thumbTrack.scrollTo({ left: t.offsetLeft - (thumbTrack.offsetWidth / 2) + (t.offsetWidth / 2), behavior: 'smooth' });
      }
      return;
    }
  }

  searchRoot.querySelectorAll('media-gallery').forEach(mg => {
    if (typeof mg.setActiveMedia === 'function') mg.setActiveMedia(String(mediaId), true);
  });

  searchRoot.querySelectorAll('.swiper').forEach(swiperEl => {
    const swiper = swiperEl.swiper;
    if (!swiper) return;
    swiper.slides.forEach((slide, i) => {
      if (slide.dataset.mediaId == mediaId) {
        swiper.slideToLoop ? swiper.slideToLoop(i) : swiper.slideTo(i);
      }
    });
  });
};

/* ================================
   SIZE AVAILABILITY
================================ */
window.updateSizeAvailability = function (productCard, selectedColor, scope) {
  const productData = window.getProductData(scope || productCard);

  productCard.querySelectorAll('.size-option').forEach(opt => {
    const input = opt.querySelector('input[type="radio"]');
    const size  = input ? input.value : opt.dataset.size;

    const variant    = productData.variants?.find(v => v.options[0] === selectedColor && v.options[1] === size);
    const unavailable = !variant || !variant.available;

    opt.classList.toggle('disabled',    unavailable);
    opt.classList.toggle('unavailable', unavailable);

    if (input) {
      input.classList.toggle('disabled', unavailable);
      input.disabled = unavailable;
    }
  });
};

/* ================================
   SYNC RADIO INPUTS to match variant
================================ */
window._syncRadioToVariant = function (wrapper, variant) {
  if (!wrapper || !variant) return;
  const variantSelects = wrapper.querySelector('variant-selects');
  if (!variantSelects) return;

  variant.options.forEach((optionValue) => {
    const radio = variantSelects.querySelector(`input[type="radio"][value="${CSS.escape(optionValue)}"]`);
    if (radio && !radio.checked) radio.checked = true;

    const select = variantSelects.querySelector(`select option[value="${CSS.escape(optionValue)}"]`);
    if (select) select.selected = true;
  });
};

/* ================================
   SYNC SWATCH ACTIVE CLASSES
================================ */
window.syncSwatches = function (productCard, variant) {
  if (!productCard || !variant) return;
  const [color, size] = variant.options || [];

  if (color) {
    productCard.querySelectorAll('.color-option').forEach(opt =>
      opt.classList.toggle('active', opt.dataset.color === color)
    );
  }
  if (size) {
    productCard.querySelectorAll('.size-option').forEach(opt =>
      opt.classList.toggle('active', opt.dataset.size === size)
    );
  }

  const wrapper = productCard.closest('.quick-view-product-wrapper') || productCard;
  window._syncRadioToVariant(wrapper, variant);
};

/* ================================
   APPLY ALL VARIANT UI UPDATES
================================ */
window.applyVariant = function (productCard, variant, scope, options) {
  if (!productCard || !variant) return;

  const resolvedScope = scope || window._resolveScope(productCard) || null;

  window.updatePrice(productCard, variant, resolvedScope);
  window.updateBuyButton(productCard, variant, resolvedScope);
  window.updateInventory(productCard, variant, resolvedScope);
  if (!options?.skipURL) window.updateURL(variant.id, resolvedScope);
  window.updateVariantInput(productCard, variant.id, resolvedScope);
  window.syncSwatches(productCard, variant);
  window.updateSliderForVariant(variant, resolvedScope || productCard);
  // Quantity selector is NOT re-initialized here to avoid double-binding;
  // it is initialized once per wrapper open in reinitVariants.
};

/* ================================
   COLOR SWATCH INIT
   FIX: scope is always the wrapper itself when called from QV,
   so we resolve it from the wrapper directly (no extra .closest needed).
================================ */
window.colorSwatchUpdate = function (root) {
  const rootEl = root || document;
  rootEl.querySelectorAll('.collection-swatches').forEach(productCard => {
    // Clone to remove old listeners
    productCard.querySelectorAll('.color-option').forEach(o => o.replaceWith(o.cloneNode(true)));

    productCard.querySelectorAll('.color-option').forEach(option => {
      option.addEventListener('click', function () {
        // When called from QV, root IS the wrapper
        const resolvedScope = (root && root !== document)
          ? (root.classList.contains('quick-view-product-wrapper') ? root : root.closest('.quick-view-product-wrapper') || root)
          : null;

        const productData   = window.getProductData(resolvedScope || productCard);
        const selectedColor = this.dataset.color;

        productCard.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
        this.classList.add('active');

        const img = productCard.querySelector('.productImage');
        if (this.dataset.image && img) img.src = this.dataset.image;

        window.updateSizeAvailability(productCard, selectedColor, resolvedScope || productCard);

        const selectedSize = productCard.querySelector('.size-option.active')?.dataset.size;
        const variant      = productData.variants?.find(v =>
          v.options[0] === selectedColor && (!selectedSize || v.options[1] === selectedSize)
        );
        if (variant) window.applyVariant(productCard, variant, resolvedScope);
      });
    });
  });
};

/* ================================
   SIZE SWATCH INIT
================================ */
window.sizeSwatchUpdate = function (root) {
  const rootEl = root || document;
  rootEl.querySelectorAll('.collection-swatches').forEach(productCard => {
    productCard.querySelectorAll('.size-option').forEach(o => o.replaceWith(o.cloneNode(true)));

    productCard.querySelectorAll('.size-option').forEach(option => {
      option.addEventListener('click', function () {
        const resolvedScope = (root && root !== document)
          ? (root.classList.contains('quick-view-product-wrapper') ? root : root.closest('.quick-view-product-wrapper') || root)
          : null;

        const productData   = window.getProductData(resolvedScope || productCard);
        const selectedSize  = this.dataset.size;
        const selectedColor = productCard.querySelector('.color-option.active')?.dataset.color;

        productCard.querySelectorAll('.size-option').forEach(o => o.classList.remove('active'));
        this.classList.add('active');

        const variant = productData.variants?.find(v =>
          v.options[0] === selectedColor && v.options[1] === selectedSize
        );
        if (variant) window.applyVariant(productCard, variant, resolvedScope);
      });
    });
  });
};

/* ================================
   LOAD VARIANT FROM URL
================================ */
window.loadVariantFromURL = function (scope) {
  const params    = new URLSearchParams(window.location.search);
  const variantId = params.get('variant');
  if (!variantId) return;
  const productCard = (scope || document).querySelector('[data-section]');
  if (!productCard) return;
  const variant = window.getProductData(scope || productCard).variants?.find(v => v.id == variantId);
  if (variant) window.applyVariant(productCard, variant, scope);
};

/* ================================
   VARIANT SELECTS CUSTOM ELEMENT
   FIX: Guard against firing during _reinitComponents (before
   reinitVariants runs). We check for a data-qv-ready flag
   that reinitVariants sets, so the CE's change handler only
   applies user-driven changes after full initialization.
================================ */
if (!customElements.get('variant-selects')) {
  customElements.define('variant-selects', class VariantSelects extends HTMLElement {
    connectedCallback() {
      this.addEventListener('change', (event) => {
        // Only respond to trusted (user-driven) events, OR if QV is fully ready
        const qvWrapper = this.closest('.quick-view-product-wrapper') || this.closest('quick-add-modal');
        if (qvWrapper && !qvWrapper.dataset.qvReady) return; // still initializing

        const scope       = qvWrapper || null;
        const productCard = this.closest('[data-section]') || scope;
        if (!productCard) return;

        const selectedVariant = this._getSelectedVariant(scope);
        if (!selectedVariant) {
          return;
        }

        window.applyVariant(productCard, selectedVariant, scope);

        this.querySelectorAll('.product-form__input').forEach((fieldset, index) => {
          const span = fieldset.querySelector('[data-selected-value]');
          if (span) span.textContent = selectedVariant.options[index] || '';
        });

        publish(PUB_SUB_EVENTS.optionValueSelectionChange, {
          data: { event, selectedVariant }
        });
      });
    }

    _getSelectedVariant(scope) {
      const productData = window.getProductData(scope || this.closest('[data-section]') || this);
      if (!productData.variants) return null;

      const selectedOptions = Array.from(
        this.querySelectorAll('input[type="radio"]:checked, select')
      ).map(el => el.value);

      return productData.variants.find(v =>
        v.options.every((opt, i) => opt === selectedOptions[i])
      ) || null;
    }
  });
}

/* ================================
   QUICK VIEW RE-INIT ENTRY POINT
   FIX: This is the SINGLE source of truth for initial variant
   state in QV. The manual change dispatch in _reinitComponents
   Step 5 has been removed to prevent double-init races.
   After applying the initial variant, we set data-qv-ready
   so the variant-selects CE starts responding to user changes.
================================ */
window.reinitVariants = function (wrapper) {
  // Init swatches first (they clone elements to remove stale listeners)
  window.colorSwatchUpdate(wrapper);
  window.sizeSwatchUpdate(wrapper);

  // Init quantity selector once per wrapper
  window.updateQuantitySelector(wrapper);

  const productCard = wrapper.querySelector('[data-section]') || wrapper;
  const productData = window.getProductData(wrapper);

  if (!productData.variants?.length) {
    // No product data — mark ready anyway so CE responds to user changes
    wrapper.dataset.qvReady = 'true';
    return;
  }

  window.productVariants = productData.variants;

  // Determine initial variant: prefer the one matching checked radios,
  // then first available, then first overall.
  const variantSelects = wrapper.querySelector('variant-selects');
  let initialVariant   = variantSelects?._getSelectedVariant(wrapper) || null;

  if (!initialVariant) {
    initialVariant = productData.variants.find(v => v.available) || productData.variants[0];
    // Sync the radio/select inputs to match the resolved variant
    if (initialVariant && variantSelects) {
      window._syncRadioToVariant(wrapper, initialVariant);
    }
  }

    if (initialVariant) {
    window.applyVariant(productCard, initialVariant, wrapper, { skipURL: true });
  }

 
  wrapper.dataset.qvReady = 'true';
};

/* ================================
   MAIN PAGE — DOMContentLoaded
================================ */
document.addEventListener('DOMContentLoaded', function () {
  window.colorSwatchUpdate();
  window.sizeSwatchUpdate();

  const productCard = document.querySelector('[data-section]');
  if (productCard) {
    const productData    = window.getProductData();
    const variantSelects = document.querySelector('variant-selects');
    const initialVariant = variantSelects
      ? variantSelects._getSelectedVariant()
      : productData.variants?.[0];
   if (initialVariant) window.applyVariant(productCard, initialVariant, null, { skipURL: true });
  }

  window.loadVariantFromURL();
  window.updateQuantitySelector(document);
});

/* ════════════════════════════════════════════════════════════
   QUICK-ADD BUTTON → MODAL WIRING
════════════════════════════════════════════════════════════ */
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.quick-add__submit');
  if (!btn) return;
  e.preventDefault();
  const modal = document.querySelector(btn.getAttribute('data-modal'));
  if (modal?.show) modal.show(btn);
});

/* ════════════════════════════════════════════════════════════
   ADD TO CART → AUTO-CLOSE MODAL
════════════════════════════════════════════════════════════ */
document.addEventListener('submit', function (e) {
  const form = e.target;
  if (form.dataset.locked === 'true') return;
  form.dataset.locked = 'true';

  if (!form.matches('form[action*="/cart/add"], .ajax-add-to-cart-form, product-form form')) return;

  const modal = form.closest('quick-add-modal');

  e.preventDefault();
  e.stopImmediatePropagation();

  const button  = form.querySelector('button[name="add"], button[type="submit"]');
  const spinner = button?.querySelector('.loading-overlay__spinner, .cart-spinner');
  const btnText = button?.querySelector('span:not(.loading-overlay__spinner):not(.cart-spinner)');

  if (button)  button.disabled = true;
  if (btnText) btnText.hidden  = true;
  if (spinner) spinner.removeAttribute('hidden');


  const formData = new FormData(form);

  const qtyInput = form.querySelector('input[name="quantity"]');
  if (qtyInput) formData.set('quantity', qtyInput.value);

  const cartRoot = window.Shopify?.routes?.root || '/';

  fetch(`${cartRoot}cart/add.js`, {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    body: formData,
  })
    .then(res => res.json())
    .then(data => {
      if (data.status) {
        alert(data.description || 'Could not add to cart.');
        return;
      }

      if (qtyInput) {
        qtyInput.value = 1;
        qtyInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (modal) modal.hide();

      const cartDrawer = document.querySelector('cart-drawer');
      if (cartDrawer) {
        fetch(`${window.location.pathname}?sections=cart-drawer`)
          .then(r => r.json())
          .then(sections => {
            if (!sections['cart-drawer']) return;
            const parsed   = new DOMParser().parseFromString(sections['cart-drawer'], 'text/html');
            const newInner = parsed.querySelector('.cart-drawer__inner');
            const oldInner = cartDrawer.querySelector('.cart-drawer__inner');
            if (newInner && oldInner) oldInner.innerHTML = newInner.innerHTML;

            setTimeout(() => {
              if (typeof window.initCartRecSwiper === 'function') window.initCartRecSwiper();
              if (typeof cartDrawer.open === 'function') cartDrawer.open();
            }, 150);
          });
      }

      fetch(`${cartRoot}cart.js`)
        .then(r => r.json())
        .then(cart => {
          document.querySelectorAll('.cart-count-bubble').forEach(el => {
            el.textContent = cart.item_count;
            el.classList.toggle('hidden', cart.item_count === 0);
          });
        });
    })
    .catch(err => console.error('[Cart] Add to cart failed:', err))
    .finally(() => {
      form.dataset.locked = 'false';
      if (button)  button.disabled = false;
      if (btnText) btnText.hidden  = false;
      if (spinner) spinner.setAttribute('hidden', '');
    });
});





// QUICK VIEW MODEL CODE

if (!customElements.get('quick-add-modal')) {
  customElements.define('quick-add-modal', class QuickAddModal extends HTMLElement {
    constructor() {
      super();
      this.modalContent = this.querySelector('[id^="QuickAddInfo-"]');
      this.closeButton = this.querySelector('[id^="ModalClose-"]');

      if (this.closeButton) {
        this.closeButton.addEventListener('click', this.hide.bind(this));
      }

      this.addEventListener('click', (e) => {
        if (e.target === this) this.hide();
      });

      this._onKeydown = (e) => {
        if (e.key === 'Escape' && this.hasAttribute('opened')) {
          this.hide();
        }
      };
      document.addEventListener('keydown', this._onKeydown);
    }

    connectedCallback() {
      this.addEventListener('keydown', this._trapFocus.bind(this));
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this._onKeydown);
    }

    show(openerButton) {
      const productUrl = openerButton.getAttribute('data-product-url');
      if (!productUrl) return;

      if (!window._qvOpeningProducts) window._qvOpeningProducts = new Set();
      if (window._qvOpeningProducts.has(productUrl)) return;
      window._qvOpeningProducts.add(productUrl);

      if (this.hasAttribute('opened')) {
        window._qvOpeningProducts.delete(productUrl);
        return;
      }

      const myId = this.id;
      if (myId) {
        document.querySelectorAll(`quick-add-modal[id="${myId}"]`).forEach((el) => {
          if (el !== this) {
            el.removeAttribute('opened');
            el.classList.remove('active');
            el.remove();
          }
        });
      }

      this._opener = openerButton;
      this._origParent = this.parentNode;
      this._origNextSibling = this.nextSibling;

      const url = `${productUrl}${productUrl.includes('?') ? '&' : '?'}view=quick-view`;

      document.body.appendChild(this);
      this.setAttribute('opened', '');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.classList.add('active');
        });
      });

      document.body.classList.add('overflow-hidden');
      this.modalContent = this.querySelector('[id^="QuickAddInfo-"]');

      const spinner = openerButton.querySelector('.loading-overlay__spinner');
      if (spinner) spinner.classList.remove('hidden');

      if (this.modalContent) {
        this.modalContent.innerHTML = this._skeletonHTML();
      }

      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then(html => {
          const doc = new DOMParser().parseFromString(html, 'text/html');

          const content =
            doc.querySelector('#MainProduct') ||
            doc.querySelector('.section-main-product-template') ||
            doc.querySelector('.main-product-section') ||
            doc.querySelector('[id^="MainProduct"]') ||
            doc.querySelector('main') ||
            doc.body;

          if (!this.modalContent || !content) {
            throw new Error('Could not find product content in fetched HTML');
          }

          this.modalContent.innerHTML = '';

          const wrapper = document.createElement('div');
          wrapper.classList.add('quick-view-product-wrapper');
          wrapper.dataset.productUrl = productUrl;
          wrapper.innerHTML = content.innerHTML;

          const injectedIds = new Set();
          doc.querySelectorAll('script[type="application/json"]').forEach(s => {
            try {
              const d = JSON.parse(s.textContent);
              if (!d?.variants?.length) return;
              const key = s.id || s.textContent.slice(0, 40);
              if (injectedIds.has(key)) return;
              injectedIds.add(key);
              const clone = document.createElement('script');
              clone.type = 'application/json';
              if (s.id) clone.id = s.id;
              if (s.dataset.productJson !== undefined) clone.dataset.productJson = '';
              clone.textContent = s.textContent;
              wrapper.appendChild(clone);
            } catch (e) {}
          });

          if (injectedIds.size === 0) {
            doc.querySelectorAll('[data-product-json]').forEach(s => {
              wrapper.appendChild(s.cloneNode(true));
            });
          }

          this.modalContent.appendChild(wrapper);

          const jsUrl = (productUrl.split('?')[0].replace(/\/$/, '')) + '.js';
          fetch(jsUrl)
            .then(r => r.json())
            .then(data => {
              if (data.variants?.length) wrapper._productVariants = data.variants;
              this._reinitComponents(wrapper);
            })
            .catch(() => this._reinitComponents(wrapper));
        })
        .catch(() => {
          if (this.modalContent) {
            this.modalContent.innerHTML = `
              <div class="quick-view-error">
                <p>Product details could not be loaded.</p>
                <a href="${productUrl}" class="quick-view-error__link">View full page →</a>
              </div>`;
          }
        })
        .finally(() => {
          if (spinner) spinner.classList.add('hidden');
          const first = this.querySelector(
            'button:not([disabled]), [href], input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (first) first.focus();
        });
    }

    hide() {
      const productUrl = this._opener?.getAttribute('data-product-url');
      if (productUrl && window._qvOpeningProducts) {
        window._qvOpeningProducts.delete(productUrl);
      }

      this.classList.remove('active');

      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        this.removeEventListener('transitionend', cleanup);
        this.removeAttribute('opened');
        document.body.classList.remove('overflow-hidden');
        if (this.modalContent) this.modalContent.innerHTML = '';
        if (this._origParent) {
          if (this._origNextSibling) {
            this._origParent.insertBefore(this, this._origNextSibling);
          } else {
            this._origParent.appendChild(this);
          }
        }
        if (this._opener) this._opener.focus();
      };

      this.addEventListener('transitionend', cleanup);
      setTimeout(cleanup, 350);
    }

    _updatePrice(wrapper, variant) {
      if (!variant) return;

      const formatMoney = (cents) => {
        if (cents == null || cents === false) return '';
        if (window.Shopify?.formatMoney) {
          const fmt = window.Shopify.money_format || window.theme?.moneyFormat || window.theme?.money_format || '{{amount}}';
          return window.Shopify.formatMoney(cents, fmt);
        }
        const sample = wrapper.querySelector('.price-item--regular, .price-item--sale, .price-item')?.textContent?.trim() || '';
        const symbol = sample.match(/^[^\d\s]+/)?.[0] || '$';
        return symbol + (cents / 100).toFixed(2);
      };

      const price        = variant.price;
      const comparePrice = variant.compare_at_price;
      const isOnSale     = comparePrice > 0 && comparePrice > price;
      const isSoldOut    = variant.available === false;

      const priceEl = wrapper.querySelector('.price');
      if (priceEl) {
        priceEl.classList.toggle('price--on-sale',  isOnSale);
        priceEl.classList.toggle('price--sold-out', isSoldOut);
        priceEl.setAttribute('aria-label',
          isOnSale
            ? `Sale price ${formatMoney(price)}, regular price ${formatMoney(comparePrice)}`
            : `Price ${formatMoney(price)}`
        );
      }

      wrapper.querySelectorAll('.price__regular .price-item--regular').forEach(el => {
        el.textContent = formatMoney(price);
      });
      wrapper.querySelectorAll('.price__sale .price-item--sale, .price__sale .price-sale').forEach(el => {
        el.textContent = formatMoney(price);
      });

      if (isOnSale) {
        wrapper.querySelectorAll(
          '.price__sale .price-compare, .price__sale s .money, .price__regular .price-compare, .price__regular s .money'
        ).forEach(el => { el.textContent = formatMoney(comparePrice); });

        wrapper.querySelectorAll('.price__sale s.compare_price, .price__regular s.compare_price').forEach(el => {
          if (!el.querySelector('.money, .price-compare')) el.textContent = formatMoney(comparePrice);
        });

        const savePct = Math.round((comparePrice - price) / comparePrice * 100);
        wrapper.querySelectorAll('.price__badge-sale').forEach(el => { el.textContent = `${savePct}% off`; });
      }

      wrapper.querySelectorAll('.price__badge-sold-out').forEach(el => {
        el.style.display = isSoldOut ? '' : 'none';
      });

      const addBtn = wrapper.querySelector('button[name="add"], .product-form__submit, button[type="submit"]');
      if (addBtn && typeof variant.available !== 'undefined') {
        addBtn.disabled = !variant.available;
        const btnSpan = addBtn.querySelector('span:not(.loading-overlay__spinner):not(.visually-hidden)');
        const label   = variant.available ? 'Add to cart' : 'Notify Me';
        if (btnSpan) {
          btnSpan.textContent = label;
        } else if (!addBtn.querySelector('.loading-overlay__spinner')) {
          addBtn.textContent = label;
        }
      }
    }

    _initSlider(wrapper) {
      const galleryWrapper = wrapper.querySelector('.product-gallery-wrapper');
      const gallery = wrapper.querySelector('.product-gallery');
      if (!gallery || !galleryWrapper) return;

      const layout     = galleryWrapper.dataset.layout;
      const track      = gallery.querySelector('.gallery-track');
      const slides     = Array.from(gallery.querySelectorAll('.gallery-slide'));
      const thumbs     = Array.from(gallery.querySelectorAll('.thumb'));
      const thumbTrack = gallery.querySelector('.gallery-thumbs');
      const prevBtn    = gallery.querySelector('.gallery-arrow.prev');
      const nextBtn    = gallery.querySelector('.gallery-arrow.next');
      const topPrevBtn = gallery.querySelector('.gallery-nav.prev');
      const topNextBtn = gallery.querySelector('.gallery-nav.next');

      if (!slides.length) return;

      const totalSlides    = slides.length;
      const isSliderEnabled = !(layout === 'singel_column' || layout === 'two_column');
      let currentIndex     = 0;
      const variantMediaMap = {};

      const updateSlider = (index) => {
        if (index < 0 || index >= totalSlides) return;
        currentIndex = index;

        slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
        thumbs.forEach((thumb, i) => thumb.classList.toggle('active', i === index));

        if (isSliderEnabled && track) {
          const slideWidth = slides[0].offsetWidth;
          track.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
          track.style.transform  = `translate3d(-${slideWidth * index}px, 0, 0)`;
        } else if (track) {
          track.prepend(slides[index]);
        }

        if (thumbTrack && thumbs[index]) {
          const activeThumb = thumbs[index].parentElement || thumbs[index];
          thumbTrack.scrollTo({
            left: activeThumb.offsetLeft - thumbTrack.offsetWidth / 2 + activeThumb.offsetWidth / 2,
            behavior: 'smooth'
          });
        }

        [prevBtn, topPrevBtn].forEach(btn => {
          if (!btn) return;
          btn.classList.toggle('is-disabled', currentIndex === 0);
          btn.toggleAttribute('disabled', currentIndex === 0);
        });
        [nextBtn, topNextBtn].forEach(btn => {
          if (!btn) return;
          btn.classList.toggle('is-disabled', currentIndex === totalSlides - 1);
          btn.toggleAttribute('disabled', currentIndex === totalSlides - 1);
        });
      };

      if (prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); if (currentIndex > 0) updateSlider(currentIndex - 1); });
      if (nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); if (currentIndex < totalSlides - 1) updateSlider(currentIndex + 1); });
      if (topPrevBtn) topPrevBtn.addEventListener('click', (e) => { e.preventDefault(); if (currentIndex > 0) updateSlider(currentIndex - 1); });
      if (topNextBtn) topNextBtn.addEventListener('click', (e) => { e.preventDefault(); if (currentIndex < totalSlides - 1) updateSlider(currentIndex + 1); });

      thumbs.forEach((thumb, i) => thumb.addEventListener('click', () => updateSlider(i)));

      wrapper.addEventListener('qv:sync-slide', (e) => {
        const { variantId, mediaId: directMediaId } = e.detail || {};
        const resolvedMediaId = variantMediaMap[variantId] || directMediaId;
        if (!resolvedMediaId) return;
        const idx = slides.findIndex((s) => s.dataset.mediaId == resolvedMediaId);
        if (idx !== -1) updateSlider(idx);
      });

      const productUrl = wrapper.dataset.productUrl;
      if (productUrl) {
        fetch(productUrl.split('?')[0].replace(/\/$/, '') + '.js')
          .then(r => r.json())
          .then(data => {
            (data.variants || []).forEach(v => {
              if (v.featured_media?.id) variantMediaMap[v.id] = v.featured_media.id;
            });
            const activeVariantId = wrapper.querySelector('input[name="id"]')?.value;
            if (activeVariantId && variantMediaMap[activeVariantId]) {
              const idx = slides.findIndex(s => s.dataset.mediaId == variantMediaMap[activeVariantId]);
              if (idx !== -1) updateSlider(idx);
            }
          })
          .catch(() => {});
      }

      window.addEventListener('resize', () => updateSlider(currentIndex));
      updateSlider(0);
      gallery._qvUpdateSlider = updateSlider;
    }

    _initVariantSync(wrapper) {
      let allVariants = [];

      if (wrapper._productVariants?.length) {
        allVariants = wrapper._productVariants;
      }

      if (!allVariants.length) {
        const s = wrapper.querySelector('script[data-product-json]') || wrapper.querySelector('script[type="application/json"]');
        if (s) {
          try { allVariants = JSON.parse(s.textContent).variants || []; } catch (e) {}
        }
      }

      const productUrl = wrapper.dataset.productUrl;
      if (!allVariants.length && productUrl) {
        fetch(productUrl.split('?')[0].replace(/\/$/, '') + '.js')
          .then(r => r.json())
          .then(data => { if (data.variants?.length) allVariants = data.variants; })
          .catch(() => {});
      }

      let _syncTimer = null;
      const syncVariant = (variant) => {
        if (!variant) return;
        clearTimeout(_syncTimer);
        _syncTimer = setTimeout(() => {
          wrapper.dispatchEvent(new CustomEvent('qv:sync-slide', {
            bubbles: false,
            detail: { variantId: variant.id, mediaId: variant.featured_media?.id },
          }));
          this._updatePrice(wrapper, variant);
        }, 80);
      };

      const variantInput = wrapper.querySelector('input[name="id"]');
      if (variantInput) {
        const nativeDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        Object.defineProperty(variantInput, 'value', {
          configurable: true,
          enumerable: true,
          get() { return nativeDescriptor.get.call(this); },
          set(newValue) {
            const oldValue = nativeDescriptor.get.call(this);
            nativeDescriptor.set.call(this, newValue);
            const newId = parseInt(newValue, 10);
            const oldId = parseInt(oldValue, 10);
            if (newId && newId !== oldId) {
              const variant = allVariants.find(v => v.id === newId);
              if (variant) {
                syncVariant(variant);
              } else {
                setTimeout(() => {
                  const v = allVariants.find(vv => vv.id === newId);
                  if (v) syncVariant(v);
                }, 400);
              }
            }
          }
        });
      }

      wrapper.addEventListener('variant:change', (e) => {
        const variant = e.detail?.variant || e.detail;
        if (variant?.id) syncVariant(variant);
      });

      wrapper.addEventListener('change', (e) => {
        const el = e.target;
        const isVariantInput =
          (el.tagName === 'INPUT' && (el.type === 'radio' || el.type === 'hidden') && el.name !== 'quantity') ||
          el.tagName === 'SELECT';
        if (!isVariantInput) return;

        setTimeout(() => {
          const selectedOptions = [];
          wrapper.querySelectorAll('fieldset').forEach(field => {
            const checked = field.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
            if (checked) selectedOptions.push(checked.value);
          });

          if (!selectedOptions.length) {
            const idInput = wrapper.querySelector('input[name="id"]');
            if (idInput?.value) {
              const v = allVariants.find(v => v.id === parseInt(idInput.value, 10));
              if (v) syncVariant(v);
            }
            return;
          }

          const variant = allVariants.find(v => selectedOptions.every((opt, i) => v[`option${i + 1}`] === opt));
          if (variant) syncVariant(variant);
        }, 100);
      });

      wrapper.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-option-value]');
        if (!btn) return;
        const clickedValue   = btn.dataset.optionValue;
        const optionPosition = parseInt(btn.dataset.optionPosition, 10);
        if (!clickedValue || !optionPosition) return;

        setTimeout(() => {
          const selectedOptions = [];
          wrapper.querySelectorAll('fieldset').forEach((field, i) => {
            const checked = field.querySelector('input[type="radio"]:checked');
            selectedOptions[i] = checked ? checked.value : null;
          });
          selectedOptions[optionPosition - 1] = clickedValue;

          const variant = allVariants.find(v =>
            selectedOptions.every((opt, i) => !opt || v[`option${i + 1}`] === opt)
          );
          if (variant) syncVariant(variant);
        }, 50);
      });

      requestAnimationFrame(() => {
        const idInput = wrapper.querySelector('input[name="id"]');
        if (!idInput?.value) return;
        const variant = allVariants.find(v => v.id === parseInt(idInput.value, 10));
        if (variant) syncVariant(variant);
        else this._applyRenderedPrice(wrapper);
      });
    }

    _initCountdown(wrapper) {
      wrapper.querySelectorAll('.sale-countdown').forEach(timer => {
        const endDate = timer.dataset.endDate;
        if (!endDate) return;

        const end       = new Date(endDate).getTime();
        const daysEl    = timer.querySelector('.days');
        const hoursEl   = timer.querySelector('.hours');
        const minutesEl = timer.querySelector('.minutes');
        const secondsEl = timer.querySelector('.seconds');
        if (!daysEl || !hoursEl || !minutesEl || !secondsEl) return;

        if (timer._interval) clearInterval(timer._interval);

        const update = () => {
          const diff = end - Date.now();
          if (diff <= 0) {
            daysEl.textContent = hoursEl.textContent = minutesEl.textContent = secondsEl.textContent = '00';
            clearInterval(timer._interval);
            return;
          }
          daysEl.textContent    = String(Math.floor(diff / 86400000)).padStart(2, '0');
          hoursEl.textContent   = String(Math.floor((diff / 3600000) % 24)).padStart(2, '0');
          minutesEl.textContent = String(Math.floor((diff / 60000) % 60)).padStart(2, '0');
          secondsEl.textContent = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
        };

        update();
        timer._interval = setInterval(update, 1000);
      });
    }

    _applyRenderedPrice(wrapper) {
      const candidates = [
        wrapper.querySelector('.price__sale .price-item--sale'),
        wrapper.querySelector('.price__sale .price-sale'),
        wrapper.querySelector('.price__regular .price-item--regular'),
        wrapper.querySelector('[data-regular-price]'),
        wrapper.querySelector('[data-product-price]'),
      ];

      let renderedPrice = '';
      for (const el of candidates) {
        const txt = el?.textContent?.trim();
        if (txt) { renderedPrice = txt; break; }
      }

      if (renderedPrice) {
        wrapper.querySelectorAll(
          '.price__regular .price-item--regular,' +
          '.price__sale .price-item--sale,' +
          '.price__sale .price-sale'
        ).forEach(el => { if (!el.textContent.trim()) el.textContent = renderedPrice; });
        return;
      }

      const rawCents =
        this._opener?.closest('[data-price]')?.dataset?.price ||
        this._opener?.closest('.card-wrapper')?.querySelector('[data-price]')?.dataset?.price ||
        this._opener?.dataset?.price;

      if (rawCents) {
        const formatted = this._formatCents(parseInt(rawCents, 10));
        wrapper.querySelectorAll(
          '.price__regular .price-item--regular,' +
          '.price__sale .price-item--sale,' +
          '.price__sale .price-sale'
        ).forEach(el => { el.textContent = formatted; });
      }
    }

    _formatCents(cents) {
      if (cents == null) return '';
      if (window.Shopify?.formatMoney) {
        return window.Shopify.formatMoney(cents, window.Shopify.money_format || window.theme?.moneyFormat || '{{amount}}');
      }
      return '$' + (cents / 100).toFixed(2);
    }

    _initShareButton(wrapper) {
      wrapper.querySelectorAll('.share-button').forEach(container => {
        const rawUrl   = wrapper.dataset.productUrl || '';
        const shareUrl = rawUrl
          ? rawUrl.split('?')[0].replace(/\/$/, '')
          : (container.querySelector('input[type="text"]')?.value || window.location.href);

        const triggerBtn     = container.querySelector('.share-button__trigger');
        const detailsPanel   = container.querySelector('.share-button__details');
        const urlInput       = container.querySelector('input[type="text"]');
        const copyBtn        = container.querySelector('.share-button__copy');
        const closeBtn       = container.querySelector('.share-button__close');
        const successMessage = container.querySelector('[role="status"]');

        if (!triggerBtn || !detailsPanel) return;

        if (urlInput) urlInput.value = shareUrl;
        const freshTrigger = triggerBtn.cloneNode(true);
        triggerBtn.parentNode.replaceChild(freshTrigger, triggerBtn);
        freshTrigger.classList.remove('hidden');
        freshTrigger.setAttribute('aria-expanded', 'false');

        const openPanel  = () => { detailsPanel.removeAttribute('hidden'); detailsPanel.classList.add('is-open'); freshTrigger.setAttribute('aria-expanded', 'true'); };
        const closePanel = () => {
          detailsPanel.setAttribute('hidden', ''); detailsPanel.classList.remove('is-open');
          freshTrigger.setAttribute('aria-expanded', 'false');
          if (successMessage) { successMessage.classList.add('hidden'); successMessage.textContent = ''; }
          if (closeBtn) closeBtn.classList.add('hidden');
          freshTrigger.focus();
        };

        if (navigator.share) {
          detailsPanel.setAttribute('hidden', '');
          freshTrigger.addEventListener('click', () => navigator.share({ url: shareUrl, title: document.title }).catch(() => {}));
        } else {
          freshTrigger.addEventListener('click', () => detailsPanel.classList.contains('is-open') ? closePanel() : openPanel());

          if (closeBtn) {
            const freshClose = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(freshClose, closeBtn);
            freshClose.addEventListener('click', closePanel);
          }

          if (copyBtn) {
            const freshCopy = copyBtn.cloneNode(true);
            copyBtn.parentNode.replaceChild(freshCopy, copyBtn);
            freshCopy.addEventListener('click', () => {
              if (!urlInput) return;
              navigator.clipboard.writeText(urlInput.value)
                .then(() => {
                  if (successMessage) { successMessage.classList.remove('hidden'); successMessage.textContent = window.accessibilityStrings?.shareSuccess || 'Link copied!'; }
                  const cb = container.querySelector('.share-button__close');
                  if (cb) { cb.classList.remove('hidden'); cb.focus(); }
                })
                .catch(() => { urlInput.select(); document.execCommand('copy'); });
            });
          }
        }

        container.dataset.shareInit = shareUrl || 'qv-done';
      });
    }

    _reinitComponents(wrapper) {
      wrapper.querySelectorAll('.product-gallery a, .gallery a').forEach(link => {
        link.addEventListener('click', e => e.preventDefault());
      });

      wrapper.querySelectorAll('script:not([type="application/json"])').forEach(old => {
        if (old.src || old.getAttribute('src')) { old.remove(); return; }
        if (
          old.textContent.includes('quick-add') ||
          old.textContent.includes('QuickAdd') ||
          old.textContent.includes('quick-add-modal')
        ) return;
        const s = document.createElement('script');
        Array.from(old.attributes).forEach(a => s.setAttribute(a.name, a.value));
        s.textContent = old.textContent;
        old.parentNode.replaceChild(s, old);
      });

      ['product-info','product-form','variant-selects','variant-radios',
       'pickup-availability','product-recommendations','quantity-input',
       'media-gallery','slider-component'].forEach(tag => {
        wrapper.querySelectorAll(tag).forEach(el => {
          const clone = document.createElement(tag);
          Array.from(el.attributes).forEach(a => clone.setAttribute(a.name, a.value));
          while (el.firstChild) clone.appendChild(el.firstChild);
          el.parentNode.replaceChild(clone, el);
        });
      });

      const idMap = new Map();
      wrapper.querySelectorAll('[id]').forEach(el => {
        const oldId = el.id;
        const newId = 'qv-' + oldId;
        el.id = newId;
        idMap.set(oldId, newId);
      });
      wrapper.querySelectorAll('[for],[aria-labelledby],[aria-describedby],[aria-controls],[data-target]').forEach(ref => {
        ['for','aria-labelledby','aria-describedby','aria-controls'].forEach(attr => {
          if (ref.hasAttribute(attr)) {
            const v = ref.getAttribute(attr);
            if (idMap.has(v)) ref.setAttribute(attr, idMap.get(v));
          }
        });
        if (ref.hasAttribute('data-target')) {
          let v = ref.getAttribute('data-target');
          if (v.startsWith('#')) v = v.slice(1);
          if (idMap.has(v)) ref.setAttribute('data-target', '#' + idMap.get(v));
        }
      });

      if (window.ProductForm) {
        wrapper.querySelectorAll('product-form').forEach(el => {
          try { new window.ProductForm(el); } catch (e) {}
        });
      }

      requestAnimationFrame(() => {
        this._initSlider(wrapper);
        this._initVariantSync(wrapper);
        this._initCountdown(wrapper);
        if (typeof window.initProductGallery === 'function') window.initProductGallery(wrapper);
      });

      if (typeof window.QuantityInput !== 'undefined') {
        wrapper.querySelectorAll('quantity-input').forEach(el => {
          try { new window.QuantityInput(el); } catch (e) {}
        });
      }

      if (typeof window.PickupAvailability !== 'undefined') {
        wrapper.querySelectorAll('pickup-availability').forEach(el => {
          try { new window.PickupAvailability(el); } catch (e) {}
        });
      }

      wrapper.querySelectorAll('.quick-add-hidden').forEach(el => {
        if (el.classList.contains('product__description')) return;
        el.style.display = 'none';
      });

      document.dispatchEvent(new CustomEvent('quick-view:loaded', { detail: { wrapper } }));

      if (typeof window.reinitVariants === 'function') window.reinitVariants(wrapper);

      this._initShareButton(wrapper);
    }

    _skeletonHTML() {
      return `
        <div class="quick-view-skeleton" aria-busy="true" aria-label="Loading product…">
          <div class="qv-skeleton__gallery">
            <div class="qv-skeleton__main-img qv-skeleton__pulse"></div>
            <div class="qv-skeleton__thumbs">
              <div class="qv-skeleton__thumb qv-skeleton__pulse"></div>
              <div class="qv-skeleton__thumb qv-skeleton__pulse"></div>
              <div class="qv-skeleton__thumb qv-skeleton__pulse"></div>
            </div>
          </div>
          <div class="qv-skeleton__info">
            <div class="qv-skeleton__line qv-skeleton__pulse" style="width:40%;height:14px;margin-bottom:12px;"></div>
            <div class="qv-skeleton__line qv-skeleton__pulse" style="width:75%;height:26px;margin-bottom:10px;"></div>
            <div class="qv-skeleton__line qv-skeleton__pulse" style="width:30%;height:18px;margin-bottom:24px;"></div>
            <div class="qv-skeleton__line qv-skeleton__pulse" style="width:100%;height:12px;margin-bottom:8px;"></div>
            <div class="qv-skeleton__line qv-skeleton__pulse" style="width:85%;height:12px;margin-bottom:8px;"></div>
            <div class="qv-skeleton__line qv-skeleton__pulse" style="width:60%;height:12px;margin-bottom:24px;"></div>
            <div class="qv-skeleton__variants">
              <div class="qv-skeleton__line qv-skeleton__pulse" style="width:80px;height:36px;border-radius:4px;"></div>
              <div class="qv-skeleton__line qv-skeleton__pulse" style="width:80px;height:36px;border-radius:4px;"></div>
              <div class="qv-skeleton__line qv-skeleton__pulse" style="width:80px;height:36px;border-radius:4px;"></div>
            </div>
            <div class="qv-skeleton__line qv-skeleton__pulse" style="width:100%;height:48px;margin-top:20px;border-radius:4px;"></div>
          </div>
        </div>`;
    }

    _trapFocus(e) {
      if (e.key !== 'Tab' || !this.hasAttribute('opened')) return;
      const focusable = Array.from(this.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.closest('[hidden]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

window.bindQuickAddTrigger = function (button) {
  if (button._qvBound) return;
  button._qvBound = true;
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); 
    const modalId = button.getAttribute('data-modal') ||
                    button.closest('[data-product-id]')?.dataset.productId;
    const modal = document.getElementById('QuickAdd-' + modalId);
    if (modal) modal.show(button);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-quick-add-trigger]').forEach(window.bindQuickAddTrigger);
});

document.addEventListener('shopify:section:load', () => {
  document.querySelectorAll('[data-quick-add-trigger]').forEach(window.bindQuickAddTrigger);
});
