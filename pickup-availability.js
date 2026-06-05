if (!customElements.get('pickup-availability')) {
  class PickupAvailability extends HTMLElement {
    constructor() {
      super();

      this.errorHtml = null;
      this.onClickRefreshList = this.onClickRefreshList.bind(this);

      if (!this.hasAttribute('available')) return;

      const template = this.querySelector('template');
      if (template) {
        this.errorHtml = template.content.firstElementChild.cloneNode(true);
      }

      this.fetchAvailability(this.dataset.variantId);
    }

    fetchAvailability(variantId) {
      if (!variantId) return;

      let rootUrl = this.dataset.rootUrl;
      if (!rootUrl.endsWith('/')) rootUrl += '/';

      const url = `${rootUrl}variants/${variantId}/?section_id=pickup-availability`;

      fetch(url)
        .then((res) => res.text())
        .then((text) => {
          const html = new DOMParser().parseFromString(text, 'text/html');
          const section = html.querySelector('.shopify-section');

          if (!section) return this.renderError();

          this.renderPreview(section);
        })
        .catch(() => this.renderError());
    }

    onClickRefreshList() {
      this.fetchAvailability(this.dataset.variantId);
    }

    update(variant) {
      if (variant && variant.available) {
        this.setAttribute('available', '');
        this.fetchAvailability(variant.id);
      } else {
        this.removeAttribute('available');
        this.innerHTML = '';
      }
    }

    renderError() {
      this.innerHTML = '';
      if (this.errorHtml) {
        this.appendChild(this.errorHtml);
        const btn = this.querySelector('button');
        if (btn) btn.addEventListener('click', this.onClickRefreshList);
      }
    }

    renderPreview(section) {
      const oldDrawer = document.querySelector('pickup-availability-drawer');
      if (oldDrawer) oldDrawer.remove();

      const preview = section.querySelector('pickup-availability-preview');
      const drawer = section.querySelector('pickup-availability-drawer');

      if (!preview) {
        this.innerHTML = '';
        this.removeAttribute('available');
        return;
      }

      this.innerHTML = preview.outerHTML;
      this.setAttribute('available', '');

      if (drawer) {
        document.body.appendChild(drawer);
      }

      if (drawer && this.dataset.productPageColorScheme) {
        this.dataset.productPageColorScheme.split(' ').forEach(cls => {
          drawer.classList.add(cls);
        });
      }

      const button = this.querySelector('button');

      if (button) {
        button.addEventListener('click', (e) => {
          e.preventDefault();

          const activeDrawer = document.querySelector('pickup-availability-drawer');

          if (!activeDrawer) {
            console.error('Drawer not found');
            return;
          }

          activeDrawer.show(button);
        });
      }
    }
  }

  customElements.define('pickup-availability', PickupAvailability);
}

if (!customElements.get('pickup-availability-drawer')) {
  class PickupAvailabilityDrawer extends HTMLElement {
    constructor() {
      super();

      this.focusElement = null;

      const closeBtn = this.querySelector('.pickup-availability-drawer-button');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.hide());
      }

      // ESC key close
      this.addEventListener('keyup', (e) => {
        if (e.code === 'Escape') this.hide();
      });

      // CLICK OUTSIDE FIX (ONLY outside .popup-modal__content)
      this.addEventListener('click', (evt) => {
        const content = this.querySelector('.popup-modal__content');
        if (!content) return;

        if (!content.contains(evt.target)) {
          this.hide();
        }
      });
    }

    show(focusElement) {
      this.focusElement = focusElement;

      this.setAttribute('open', '');
      document.body.classList.add('overflow-hidden');

      if (typeof trapFocus === 'function') {
        trapFocus(this);
      }
    }

    hide() {
      // Add closing class for animation
      this.classList.add('closing');
    
      // Wait for animation
      setTimeout(() => {
        this.removeAttribute('open');
        this.classList.remove('closing');
    
        document.body.classList.remove('overflow-hidden');
    
        if (typeof removeTrapFocus === 'function') {
          removeTrapFocus(this.focusElement);
        }
      }, 300); // match CSS duration
    }
  }

  customElements.define('pickup-availability-drawer', PickupAvailabilityDrawer);
}
