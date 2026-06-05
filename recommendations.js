if (!customElements.get('product-recommendations')) {
  customElements.define(
    'product-recommendations',
    class ProductRecommendations extends HTMLElement {
      constructor() {
        super();

        const observer = new IntersectionObserver(
          (entries, observer) => {
            if (!entries[0].isIntersecting) return;
            observer.unobserve(this);
            this.loadRecommendations();
          },
          { rootMargin: '0px 0px 400px 0px' }
        );

        observer.observe(this);
      }

      async loadRecommendations() {
        try {
          const response = await fetch(this.dataset.url);
          if (!response.ok) return;

          const html = await response.text();
          const outerDiv = document.createElement('div');
          outerDiv.innerHTML = html;

          let content = outerDiv.querySelector('product-recommendations');

          if (!content) {
            content = outerDiv.querySelector('.complementary-products');
          }

          const hasProducts =
            content &&
            (content.innerHTML.trim().length > 0) &&
            content.querySelectorAll('.swiper-slide').length > 0;

          if (hasProducts) {
            this.innerHTML = content.innerHTML;
            this.initSwiper();
          } else {
            this.style.display = 'none';
          }
        } catch (error) {
          console.error('Error fetching recommendations:', error);
          this.style.display = 'none';
        }
      }

      initSwiper() {
        const swiperEl = this.querySelector('.complementary-swiper');
        if (!swiperEl) return;

        const blockId = swiperEl.dataset.blockId;
        const enableNav = swiperEl.dataset.navigation === 'true';

        const initFn = () => {
          new Swiper(swiperEl, {
            slidesPerView: 'auto',
            spaceBetween: 0,
            loop: false,

            ...(enableNav && {
              navigation: {
                nextEl: this.querySelector(`.swiper-button-next--${blockId}`),
                prevEl: this.querySelector(`.swiper-button-prev--${blockId}`),
              },
            }),

            pagination: {
              el: this.querySelector('.swiper-pagination'),
              clickable: true,
            },
          });
        };

        if (typeof Swiper !== 'undefined') {
          initFn();
        } else {
          window.addEventListener('load', initFn, { once: true });
        }
      }
    }
  );
}
