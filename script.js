/* ================= STATE ================= */
  // Paste your deployed Apps Script Web App URL here — it must end in /exec.
  // Deploy → Manage deployments → copy the "Web app" URL.
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxFs4r8arCJy_amenug8kxhO7uM5YuvbmhOldrOrFAjuWjZa1gNwr-Z9JT3h_fnKc05/exec';

  let allProducts = [];
  let cart = [];        // [{id, qty}]
  let wishlist = [];    // [id, id, ...]
  let whatsappNumber = '';
  let filters = {
    search: '',
    gender: 'all',
    brand: 'all',
    category: 'all',
    sort: 'default'
  };

  /* ================= INIT ================= */
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('year').textContent = new Date().getFullYear();
    loadCartAndWishlistFromMemory();
    fetchProducts();
    bindStaticEvents();
  });

  function fetchProducts() {
    fetch(APPS_SCRIPT_URL + '?action=getProducts')
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed with status ' + res.status);
        return res.json();
      })
      .then(onProductsLoaded)
      .catch(onLoadError);
  }

  function onProductsLoaded(data) {
    allProducts = data.products || [];
    whatsappNumber = data.whatsappNumber || '';

    // Update store name placeholders
    var nameEls = [
      document.getElementById('storeNameText'),
      document.getElementById('footerStoreName')
    ];
    nameEls.forEach(function (el) { if (el && data.storeName) el.textContent = data.storeName; });

    var phoneEl = document.getElementById('contactPhone');
    if (phoneEl) phoneEl.textContent = whatsappNumber;

    var waFloat = document.getElementById('whatsappFloat');
    if (waFloat) {
      waFloat.href = 'https://wa.me/' + whatsappNumber + '?text=' +
        encodeURIComponent('Hi! I have a question about your products.');
    }

    populateFilterOptions();
    renderBrandPills();
    renderFeatured();
    applyFiltersAndRender();
    updateCartUI();
    updateWishlistUI();
    hidePreloader();
  }

  function onLoadError(error) {
    hidePreloader();
    var grid = document.getElementById('productGrid');
    grid.innerHTML = '<p class="no-results">Could not load products. Please refresh the page.<br><small>' +
      escapeHtml(error && error.message ? error.message : String(error)) + '</small></p>';
    console.error('getProducts failed:', error);
  }

  function hidePreloader() {
    var pre = document.getElementById('preloader');
    if (pre) {
      pre.classList.add('fade-out');
      setTimeout(function () { pre.style.display = 'none'; }, 500);
    }
  }

  /* ================= FILTER OPTIONS ================= */
  function populateFilterOptions() {
    var brands = Array.from(new Set(allProducts.map(function (p) { return p.brand; }).filter(Boolean))).sort();
    var categories = Array.from(new Set(allProducts.map(function (p) { return p.category; }).filter(Boolean))).sort();

    var brandSelect = document.getElementById('brandFilter');
    brands.forEach(function (b) {
      var opt = document.createElement('option');
      opt.value = b; opt.textContent = b;
      brandSelect.appendChild(opt);
    });

    var categorySelect = document.getElementById('categoryFilter');
    categories.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      categorySelect.appendChild(opt);
    });
  }

  function renderBrandPills() {
    var brands = Array.from(new Set(allProducts.map(function (p) { return p.brand; }).filter(Boolean))).sort();
    var container = document.getElementById('brandPills');
    if (!container) return;

    if (brands.length === 0) {
      container.innerHTML = '<p class="empty-msg">No brands yet.</p>';
      return;
    }

    container.innerHTML = brands.map(function (b) {
      var isActive = filters.brand === b;
      return '<button class="brand-pill' + (isActive ? ' active' : '') + '" data-brand="' + escapeHtml(b) + '">' + escapeHtml(b) + '</button>';
    }).join('');
  }

  /* ================= STATIC EVENT BINDINGS ================= */
  function bindStaticEvents() {
    // Search (debounced)
    var searchTimer;
    document.getElementById('searchInput').addEventListener('input', function (e) {
      clearTimeout(searchTimer);
      var val = e.target.value;
      searchTimer = setTimeout(function () {
        filters.search = val.trim().toLowerCase();
        applyFiltersAndRender();
      }, 200);
    });

    // Gender chips
    document.getElementById('genderFilters').addEventListener('click', function (e) {
      var btn = e.target.closest('.filter-chip');
      if (!btn) return;
      setGenderFilter(btn.dataset.gender);
    });

    // Brand / Category / Sort
    document.getElementById('brandFilter').addEventListener('change', function (e) {
      filters.brand = e.target.value;
      renderBrandPills();
      applyFiltersAndRender();
    });
    document.getElementById('categoryFilter').addEventListener('change', function (e) {
      filters.category = e.target.value;
      applyFiltersAndRender();
    });
    document.getElementById('sortFilter').addEventListener('change', function (e) {
      filters.sort = e.target.value;
      applyFiltersAndRender();
    });

    // Mobile menu toggle
    document.getElementById('menuToggle').addEventListener('click', function () {
      document.getElementById('filtersBar').classList.toggle('open');
    });

    // "All Brands" pills
    document.getElementById('brandPills').addEventListener('click', function (e) {
      var pill = e.target.closest('.brand-pill');
      if (!pill) return;
      var brand = pill.dataset.brand;
      filters.brand = (filters.brand === brand) ? 'all' : brand;
      document.getElementById('brandFilter').value = filters.brand;
      renderBrandPills();
      applyFiltersAndRender();
      document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
    });

    // Cart sidebar
    document.getElementById('cartBtn').addEventListener('click', function () { openSidebar('cart'); });
    document.getElementById('closeCart').addEventListener('click', function () { closeSidebar('cart'); });
    document.getElementById('cartOverlay').addEventListener('click', function () { closeSidebar('cart'); });

    // Wishlist sidebar
    document.getElementById('wishlistBtn').addEventListener('click', function () { openSidebar('wishlist'); });
    document.getElementById('closeWishlist').addEventListener('click', function () { closeSidebar('wishlist'); });
    document.getElementById('wishlistOverlay').addEventListener('click', function () { closeSidebar('wishlist'); });

    // Quick view modal
    document.getElementById('closeQuickView').addEventListener('click', closeQuickView);
    document.getElementById('quickViewOverlay').addEventListener('click', function (e) {
      if (e.target.id === 'quickViewOverlay') closeQuickView();
    });

    // Checkout
    document.getElementById('checkoutBtn').addEventListener('click', checkoutViaWhatsApp);

    // Delegated clicks: product grid buttons (add to cart / wishlist / quick view)
    document.getElementById('featuredGrid').addEventListener('click', handleGridClick);
    document.getElementById('productGrid').addEventListener('click', handleGridClick);

    // Delegated clicks: cart & wishlist sidebars
    document.getElementById('cartItems').addEventListener('click', handleCartClick);
    document.getElementById('wishlistItems').addEventListener('click', handleWishlistClick);

    // Delegated clicks: quick view content
    document.getElementById('quickViewContent').addEventListener('click', handleQuickViewClick);
  }

  /* ================= FILTER + SORT + RENDER ================= */
  function setGenderFilter(gender) {
    filters.gender = gender;
    document.querySelectorAll('#genderFilters .filter-chip').forEach(function (c) {
      c.classList.toggle('active', c.dataset.gender === gender);
    });
    applyFiltersAndRender();
  }

  function applyFiltersAndRender() {
    var result = allProducts.filter(function (p) {
      var matchesSearch = !filters.search ||
        p.name.toLowerCase().indexOf(filters.search) !== -1 ||
        p.brand.toLowerCase().indexOf(filters.search) !== -1 ||
        p.category.toLowerCase().indexOf(filters.search) !== -1;

      var matchesGender = filters.gender === 'all' || p.gender === filters.gender;
      var matchesBrand = filters.brand === 'all' || p.brand === filters.brand;
      var matchesCategory = filters.category === 'all' || p.category === filters.category;

      return matchesSearch && matchesGender && matchesBrand && matchesCategory;
    });

    result = sortProducts(result, filters.sort);

    var grid = document.getElementById('productGrid');
    var noResults = document.getElementById('noResults');
    var resultsCount = document.getElementById('resultsCount');

    resultsCount.textContent = result.length + (result.length === 1 ? ' item' : ' items');

    if (result.length === 0) {
      grid.innerHTML = '';
      noResults.classList.remove('hidden');
      return;
    }
    noResults.classList.add('hidden');
    grid.innerHTML = result.map(renderProductCard).join('');
  }

  function sortProducts(list, sortKey) {
    var sorted = list.slice();
    switch (sortKey) {
      case 'price-asc':
        sorted.sort(function (a, b) { return effectivePrice(a) - effectivePrice(b); });
        break;
      case 'price-desc':
        sorted.sort(function (a, b) { return effectivePrice(b) - effectivePrice(a); });
        break;
      case 'name-asc':
        sorted.sort(function (a, b) { return a.name.localeCompare(b.name); });
        break;
      case 'name-desc':
        sorted.sort(function (a, b) { return b.name.localeCompare(a.name); });
        break;
    }
    return sorted;
  }

  function effectivePrice(p) { return p.onSale ? p.salePrice : p.price; }

  function heartIcon(filled) {
    return '<svg viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.5"><path d="M12 20.5s-7.5-4.6-10-9.3C.6 8 2 4.5 5.4 4c2-.3 3.9.6 5 2.2C11.5 4.6 13.4 3.7 15.4 4c3.4.5 4.8 4 3.4 7.2-2.5 4.7-10 9.3-10 9.3z"/></svg>';
  }

  function renderFeatured() {
    var featured = allProducts.filter(function (p) { return p.featured; }).slice(0, 8);
    var grid = document.getElementById('featuredGrid');
    var section = grid.closest('.featured-section');
    if (featured.length === 0) {
      if (section) section.classList.add('hidden');
      return;
    }
    if (section) section.classList.remove('hidden');
    grid.innerHTML = featured.map(renderProductCard).join('');
  }

  /* ================= PRODUCT CARD TEMPLATE ================= */
  function renderProductCard(p) {
    var isWished = wishlist.indexOf(p.id) !== -1;
    var priceHtml = p.onSale
      ? '<span class="price-original">$' + p.price.toFixed(2) + '</span><span class="price-sale">$' + p.salePrice.toFixed(2) + '</span>'
      : '<span class="price-regular">$' + p.price.toFixed(2) + '</span>';

    return '' +
      '<div class="product-card" data-id="' + p.id + '">' +
        '<div class="product-img-wrap">' +
          '<img class="product-img" src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" onerror="this.src=\'https://placehold.co/400x400/efe1cb/5c3a21?text=No+Image\'">' +
          (p.onSale ? '<span class="sale-badge">Sale</span>' : '') +
          '<span class="stock-badge ' + (p.inStock ? '' : 'out') + '">' + (p.inStock ? 'In Stock' : 'Out of Stock') + '</span>' +
          '<button class="quick-view-btn" data-action="quick-view" data-id="' + p.id + '">Quick View</button>' +
          '<button class="wishlist-icon-btn ' + (isWished ? 'active' : '') + '" data-action="toggle-wishlist" data-id="' + p.id + '" title="Wishlist">' + heartIcon(isWished) + '</button>' +
        '</div>' +
        '<div class="product-info">' +
          '<span class="product-brand">' + escapeHtml(p.brand) + '</span>' +
          '<span class="product-name">' + escapeHtml(p.name) + '</span>' +
          '<div class="product-price">' + priceHtml + '</div>' +
          '<button class="add-to-cart-btn" data-action="add-to-cart" data-id="' + p.id + '" ' + (p.inStock ? '' : 'disabled') + '>' +
            (p.inStock ? 'Add to Cart' : 'Out of Stock') +
          '</button>' +
        '</div>' +
      '</div>';
  }

  /* ================= GRID CLICK HANDLING ================= */
  function handleGridClick(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var id = btn.dataset.id;
    var action = btn.dataset.action;

    if (action === 'add-to-cart') addToCart(id);
    else if (action === 'toggle-wishlist') toggleWishlist(id);
    else if (action === 'quick-view') openQuickView(id);
  }

  /* ================= CART ================= */
  function addToCart(id) {
    var product = allProducts.find(function (p) { return p.id === id; });
    if (!product || !product.inStock) return;

    var existing = cart.find(function (c) { return c.id === id; });
    if (existing) {
      if (existing.qty < product.stock) existing.qty += 1;
      else { showToast('Max stock reached for this item'); return; }
    } else {
      cart.push({ id: id, qty: 1 });
    }
    updateCartUI();
    showToast('Added "' + product.name + '" to cart');
  }

  function changeQty(id, delta) {
    var item = cart.find(function (c) { return c.id === id; });
    var product = allProducts.find(function (p) { return p.id === id; });
    if (!item || !product) return;

    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(function (c) { return c.id !== id; });
    } else if (item.qty > product.stock) {
      item.qty = product.stock;
    }
    updateCartUI();
  }

  function removeFromCart(id) {
    cart = cart.filter(function (c) { return c.id !== id; });
    updateCartUI();
  }

  function updateCartUI() {
    var count = cart.reduce(function (sum, c) { return sum + c.qty; }, 0);
    document.getElementById('cartCount').textContent = count;

    var container = document.getElementById('cartItems');
    if (cart.length === 0) {
      container.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
      document.getElementById('cartTotal').textContent = '$0.00';
      // Re-render grids so any disabled add-to-cart states reflect correctly
      applyFiltersAndRender();
      renderFeatured();
      return;
    }

    var total = 0;
    container.innerHTML = cart.map(function (c) {
      var p = allProducts.find(function (prod) { return prod.id === c.id; });
      if (!p) return '';
      var price = effectivePrice(p);
      total += price * c.qty;
      return '' +
        '<div class="cart-item" data-id="' + p.id + '">' +
          '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" onerror="this.src=\'https://placehold.co/100x100/efe1cb/5c3a21?text=No+Image\'">' +
          '<div class="cart-item-info">' +
            '<h4>' + escapeHtml(p.name) + '</h4>' +
            '<span class="item-price">$' + price.toFixed(2) + '</span>' +
            '<div class="qty-controls">' +
              '<button data-action="dec" data-id="' + p.id + '">−</button>' +
              '<span>' + c.qty + '</span>' +
              '<button data-action="inc" data-id="' + p.id + '">+</button>' +
            '</div>' +
            '<button class="remove-item-btn" data-action="remove" data-id="' + p.id + '">Remove</button>' +
          '</div>' +
        '</div>';
    }).join('');

    document.getElementById('cartTotal').textContent = '$' + total.toFixed(2);
  }

  function handleCartClick(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var id = btn.dataset.id;
    var action = btn.dataset.action;
    if (action === 'inc') changeQty(id, 1);
    else if (action === 'dec') changeQty(id, -1);
    else if (action === 'remove') removeFromCart(id);
  }

  function checkoutViaWhatsApp() {
    if (cart.length === 0) { showToast('Your cart is empty'); return; }
    if (!whatsappNumber) { showToast('WhatsApp number not configured'); return; }

    var lines = ['Hello! I would like to order:'];
    var total = 0;
    cart.forEach(function (c) {
      var p = allProducts.find(function (prod) { return prod.id === c.id; });
      if (!p) return;
      var price = effectivePrice(p);
      total += price * c.qty;
      lines.push('• ' + p.name + ' (x' + c.qty + ') — $' + (price * c.qty).toFixed(2));
    });
    lines.push('');
    lines.push('Total: $' + total.toFixed(2));

    var url = 'https://wa.me/' + whatsappNumber + '?text=' + encodeURIComponent(lines.join('\n'));
    window.open(url, '_blank');
  }

  /* ================= WISHLIST ================= */
  function toggleWishlist(id) {
    var product = allProducts.find(function (p) { return p.id === id; });
    if (!product) return;

    var idx = wishlist.indexOf(id);
    if (idx === -1) {
      wishlist.push(id);
      showToast('Added "' + product.name + '" to wishlist');
    } else {
      wishlist.splice(idx, 1);
      showToast('Removed "' + product.name + '" from wishlist');
    }
    updateWishlistUI();
    applyFiltersAndRender();
    renderFeatured();
  }

  function updateWishlistUI() {
    document.getElementById('wishlistCount').textContent = wishlist.length;

    var container = document.getElementById('wishlistItems');
    if (wishlist.length === 0) {
      container.innerHTML = '<p class="empty-msg">Your wishlist is empty.</p>';
      return;
    }

    container.innerHTML = wishlist.map(function (id) {
      var p = allProducts.find(function (prod) { return prod.id === id; });
      if (!p) return '';
      var priceHtml = p.onSale
        ? '<span class="price-original">$' + p.price.toFixed(2) + '</span> <span class="price-sale">$' + p.salePrice.toFixed(2) + '</span>'
        : '$' + p.price.toFixed(2);
      return '' +
        '<div class="wishlist-item" data-id="' + p.id + '">' +
          '<img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" onerror="this.src=\'https://placehold.co/100x100/efe1cb/5c3a21?text=No+Image\'">' +
          '<div class="wishlist-item-info">' +
            '<h4>' + escapeHtml(p.name) + '</h4>' +
            '<span class="item-price">' + priceHtml + '</span>' +
            '<button class="remove-wishlist-btn" data-action="remove" data-id="' + p.id + '">Remove</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  function handleWishlistClick(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'remove') toggleWishlist(btn.dataset.id);
  }

  /* ================= QUICK VIEW ================= */
  function openQuickView(id) {
    var p = allProducts.find(function (prod) { return prod.id === id; });
    if (!p) return;

    var isWished = wishlist.indexOf(p.id) !== -1;
    var priceHtml = p.onSale
      ? '<span class="price-original">$' + p.price.toFixed(2) + '</span><span class="price-sale">$' + p.salePrice.toFixed(2) + '</span>'
      : '<span class="price-regular">$' + p.price.toFixed(2) + '</span>';

    document.getElementById('quickViewContent').innerHTML = '' +
      '<div class="qv-img"><img src="' + escapeHtml(p.image) + '" alt="' + escapeHtml(p.name) + '" onerror="this.src=\'https://placehold.co/500x500/efe1cb/5c3a21?text=No+Image\'"></div>' +
      '<div class="qv-info">' +
        '<span class="product-brand">' + escapeHtml(p.brand) + '</span>' +
        '<h2>' + escapeHtml(p.name) + '</h2>' +
        '<div class="product-price">' + priceHtml + '</div>' +
        '<p class="qv-desc">' + escapeHtml(p.description || 'No description available.') + '</p>' +
        '<p class="qv-meta"><strong>Category:</strong> ' + escapeHtml(p.category) + ' &nbsp;&nbsp;<strong>Gender:</strong> ' + escapeHtml(p.gender) + '</p>' +
        '<p class="qv-stock ' + (p.inStock ? 'in-stock' : 'out-of-stock') + '">' + (p.inStock ? 'In Stock (' + p.stock + ' available)' : 'Out of Stock') + '</p>' +
        '<div class="qv-actions">' +
          '<button class="btn-gold" data-action="add-to-cart" data-id="' + p.id + '" ' + (p.inStock ? '' : 'disabled') + '>' + (p.inStock ? 'Add to Cart' : 'Out of Stock') + '</button>' +
          '<button class="btn-outline ' + (isWished ? 'active' : '') + '" data-action="toggle-wishlist" data-id="' + p.id + '">' + (isWished ? 'Remove from Wishlist' : 'Add to Wishlist') + '</button>' +
        '</div>' +
      '</div>';

    document.getElementById('quickViewOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeQuickView() {
    document.getElementById('quickViewOverlay').classList.remove('show');
    document.body.style.overflow = '';
  }

  function handleQuickViewClick(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var id = btn.dataset.id;
    var action = btn.dataset.action;
    if (action === 'add-to-cart') addToCart(id);
    else if (action === 'toggle-wishlist') {
      toggleWishlist(id);
      openQuickView(id); // refresh modal to reflect new wishlist state
    }
  }

  /* ================= SIDEBARS ================= */
  function openSidebar(type) {
    var sidebar = document.getElementById(type + 'Sidebar');
    var overlay = document.getElementById(type + 'Overlay');
    sidebar.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar(type) {
    var sidebar = document.getElementById(type + 'Sidebar');
    var overlay = document.getElementById(type + 'Overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  /* ================= TOAST ================= */
  var toastTimer;
  function showToast(msg) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  /* ================= HELPERS ================= */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Cart/wishlist are session-only (no localStorage in some hosting contexts).
  // This function exists as a single hook in case you later want to wire up
  // persistence (e.g. an additional Apps Script API endpoint + PropertiesService).
  function loadCartAndWishlistFromMemory() {
    cart = [];
    wishlist = [];
  }
