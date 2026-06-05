document.addEventListener('DOMContentLoaded', () => {
  const galleryWrapper = document.querySelector('.product-gallery-wrapper');
  const gallery = document.querySelector('.product-gallery');

  if (!gallery || !galleryWrapper) return;

  const layout = galleryWrapper.dataset.layout;

  const track = gallery.querySelector('.gallery-track');
  const slides = gallery.querySelectorAll('.gallery-slide');

  const thumbs = gallery.querySelectorAll('.thumb');
  const thumbTrack = gallery.querySelector('.gallery-thumbs');

  // Bottom arrows
  const prevBtn = gallery.querySelector('.gallery-arrow.prev');
  const nextBtn = gallery.querySelector('.gallery-arrow.next');

  // Top arrows (IMPORTANT 🔥)
  const topPrevBtn = gallery.querySelector('.gallery-nav.prev');
  const topNextBtn = gallery.querySelector('.gallery-nav.next');

  let currentIndex = 0;
  const totalSlides = slides.length;

  const isSliderEnabled = !(layout === 'singel_column' || layout === 'two_column');

  function updateSlider(index) {
    if (index < 0 || index >= totalSlides) return;

    currentIndex = index;

    // Active states
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
    });

    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });

    // Move main slider
    if (isSliderEnabled && track && slides[0]) {
      const slideWidth = slides[0].offsetWidth;
      track.style.transition = 'transform 0.4s ease';
      track.style.transform = `translate3d(-${slideWidth * index}px, 0, 0)`;
    } else if (track) {
      track.prepend(slides[index]);
    }

    // Scroll thumbnails
    if (thumbTrack && thumbs[index]) {
      const activeThumb = thumbs[index].parentElement;
      const scrollPos =
        activeThumb.offsetLeft -
        thumbTrack.offsetWidth / 2 +
        activeThumb.offsetWidth / 2;

      thumbTrack.scrollTo({
        left: scrollPos,
        behavior: 'smooth',
      });
    }

    // Disable/enable arrows (bottom)
    if (prevBtn) {
      prevBtn.toggleAttribute('disabled', currentIndex === 0);
      prevBtn.classList.toggle('is-disabled', currentIndex === 0);
    }
    
    if (nextBtn) {
      nextBtn.toggleAttribute('disabled', currentIndex === totalSlides - 1);
      nextBtn.classList.toggle('is-disabled', currentIndex === totalSlides - 1);
    }
    if (topPrevBtn) {
  topPrevBtn.toggleAttribute('disabled', currentIndex === 0);
  topPrevBtn.classList.toggle('is-disabled', currentIndex === 0);
}

if (topNextBtn) {
  topNextBtn.toggleAttribute('disabled', currentIndex === totalSlides - 1);
  topNextBtn.classList.toggle('is-disabled', currentIndex === totalSlides - 1);
}
  }

  // -----------------------
  // Bottom arrow controls
  // -----------------------
  if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentIndex < totalSlides - 1) {
        updateSlider(currentIndex + 1);
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        updateSlider(currentIndex - 1);
      }
    });
  }

  // -----------------------
  // TOP arrow controls 🔥
  // -----------------------
  if (topNextBtn) {
    topNextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentIndex < totalSlides - 1) {
        updateSlider(currentIndex + 1);
      }
    });
  }

  if (topPrevBtn) {
    topPrevBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentIndex > 0) {
        updateSlider(currentIndex - 1);
      }
    });
  }

  // -----------------------
  // Thumbnail click
  // -----------------------
  thumbs.forEach((thumb, index) => {
    thumb.addEventListener('click', () => {
      updateSlider(index);
    });
  });

  // Initial load
  updateSlider(0);

  // -----------------------
  // Variant change sync
  // -----------------------
  document.addEventListener('change', function (e) {
    const container = e.target.closest('variant-selects');
    if (!container) return;

    const productData = window.productVariants;
    if (!productData) return;

    const selectedOptions = Array.from(
      container.querySelectorAll('select, input:checked')
    ).map((el) => el.value);

    const matchedVariant = productData.find((variant) =>
      variant.options.every((opt, i) => opt === selectedOptions[i])
    );

    if (matchedVariant && matchedVariant.featured_media) {
      const mediaId = matchedVariant.featured_media.id;

      const index = Array.from(slides).findIndex(
        (s) => s.dataset.mediaId == mediaId
      );

      if (index !== -1) {
        updateSlider(index);
      }
    }
  });

  // -----------------------
  // Resize fix
  // -----------------------
  window.addEventListener('resize', () => {
    updateSlider(currentIndex);
  });
});
