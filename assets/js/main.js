/**
 * TIRANGA PAY - MODERN FINTECH LANDING PAGE JAVASCRIPT
 * Standalone Interactions & Micro-Animations
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. STICKY / SCROLLED HEADER EFFECT
  const header = document.querySelector('.header');
  const backToTopBtn = document.getElementById('backToTop');

  const handleScroll = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    
    if (header) {
      if (scrollY > 20) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    if (backToTopBtn) {
      if (scrollY > 400) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // 2. MOBILE NAVIGATION DRAWER
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');
  const mobileOverlay = document.getElementById('mobileDrawerOverlay');
  const mobileLinks = document.querySelectorAll('.mobile-drawer .nav-link, .mobile-drawer .btn');

  const openMobileMenu = () => {
    if (mobileToggle) mobileToggle.classList.add('open');
    if (mobileDrawer) mobileDrawer.classList.add('open');
    if (mobileOverlay) mobileOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeMobileMenu = () => {
    if (mobileToggle) mobileToggle.classList.remove('open');
    if (mobileDrawer) mobileDrawer.classList.remove('open');
    if (mobileOverlay) mobileOverlay.classList.remove('open');
    document.body.style.overflow = '';
  };

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      if (mobileDrawer && mobileDrawer.classList.contains('open')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
  }

  mobileLinks.forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  // 3. SMOOTH SCROLLING & ACTIVE SECTION HIGHLIGHTING
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-desktop .nav-link');

  const highlightNavOnScroll = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    
    sections.forEach(section => {
      const sectionHeight = section.offsetHeight;
      const sectionTop = section.offsetTop - 120;
      const sectionId = section.getAttribute('id');

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  };

  window.addEventListener('scroll', highlightNavOnScroll, { passive: true });

  // 4. ACCORDION FAQ INTERACTION
  const faqCards = document.querySelectorAll('.faq-card');

  faqCards.forEach(card => {
    const header = card.querySelector('.faq-card-header');
    if (header) {
      header.addEventListener('click', () => {
        const isActive = card.classList.contains('active');
        
        // Close all other open FAQs
        faqCards.forEach(otherCard => {
          if (otherCard !== card) {
            otherCard.classList.remove('active');
          }
        });

        // Toggle current card
        if (isActive) {
          card.classList.remove('active');
        } else {
          card.classList.add('active');
        }
      });
    }
  });

  // 5. INTERACTIVE REFERRAL EARNINGS CALCULATOR
  const friendsSlider = document.getElementById('friendsSlider');
  const friendsCountDisplay = document.getElementById('friendsCountDisplay');
  const calculatedEarningsDisplay = document.getElementById('calculatedEarnings');

  if (friendsSlider && friendsCountDisplay && calculatedEarningsDisplay) {
    const updateCalculator = () => {
      const count = parseInt(friendsSlider.value, 10);
      friendsCountDisplay.textContent = `${count} Active Members`;
      
      // Indicative formula: Platform rewards estimation tier
      // Base calculation: Estimated platform commission points based on average activity
      const estimatedTierBonus = count * 280;
      
      // Animate or set the number
      calculatedEarningsDisplay.textContent = `₹${estimatedTierBonus.toLocaleString('en-IN')}`;
    };

    friendsSlider.addEventListener('input', updateCalculator);
    updateCalculator();
  }

  // 6. COPY TO CLIPBOARD HELPER & TOAST NOTICE
  const copyBtns = document.querySelectorAll('[data-copy-text]');
  const toastNotice = document.getElementById('toastNotice');
  let toastTimeout;

  const showToast = (message) => {
    if (!toastNotice) return;
    toastNotice.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>${message}</span>
    `;
    toastNotice.classList.add('show');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastNotice.classList.remove('show');
    }, 3200);
  };

  copyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const textToCopy = btn.getAttribute('data-copy-text') || location.origin + location.pathname.replace(/\/+$/, '') + '/user-app/register.html?ref=GET20';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          showToast('Referral link copied successfully!');
        }).catch(() => {
          fallbackCopy(textToCopy);
        });
      } else {
        fallbackCopy(textToCopy);
      }
    });
  });

  const fallbackCopy = (text) => {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
      showToast('Referral link copied successfully!');
    } catch (e) {
      showToast('Referral Code: GET20');
    }
    document.body.removeChild(tempInput);
  };

  // 7. BACK TO TOP SMOOTH SCROLL
  if (backToTopBtn) {
    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
});
