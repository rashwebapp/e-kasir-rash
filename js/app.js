/**
 * ============================================================================
 * E-Kasir By Rash Studio - Frontend Client Engine
 * ============================================================================
 * Lisensi & Hak Cipta: RASH Studio (https://lynk.id/rashstudio | WA: 085174273313)
 * Standar: Vanilla JS Modular, PWA Standalone, Dynamic QRIS EMVCo, Thermal Print
 * ============================================================================
 */

(function () {
  'use strict';

  // 1. STATE MANAGEMENT APLIKASI
  const state = {
    webAppUrl: localStorage.getItem('EKASIR_GAS_URL') || '',
    secretKey: localStorage.getItem('EKASIR_SECRET_KEY') || '',
    currentStaff: JSON.parse(localStorage.getItem('EKASIR_CURRENT_STAFF') || 'null'),
    activeShift: JSON.parse(localStorage.getItem('EKASIR_ACTIVE_SHIFT') || 'null'),
    config: {
      store_name: 'E-Kasir Store',
      store_tagline: 'Solusi Kasir Pintar UMKM',
      store_address: 'Jl. Bisnis UMKM Juara No. 1',
      store_phone: '085174273313',
      receipt_footer: 'Terima kasih atas kunjungan Anda!',
      qris_static_string: '',
      bank_name: 'BCA',
      bank_account_number: '1234567890',
      bank_account_holder: 'RASH Studio',
      enable_tax: 'false',
      tax_rate: '11',
      enable_points: 'true',
      point_earn_rate: '10000',
      point_redeem_value: '100',
      enable_kasbon: 'true',
      allow_overselling: 'false'
    },
    products: [],
    customers: [],
    staffList: [],
    cart: JSON.parse(localStorage.getItem('EKASIR_CART') || '[]'),
    selectedCustomer: null,
    holdCarts: JSON.parse(localStorage.getItem('EKASIR_HOLD_CARTS') || '[]'),
    transactions: [],
    currentView: 'kasir',
    activeCategory: 'ALL',
    searchKeyword: '',
    activePayMethod: 'TUNAI',
    lastTransaction: null,
    pwaPrompt: null,
    html5QrCode: null
  };

  // 2. INISIALISASI SAAT DOM READY
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initPWA();
    initLucide();
    checkUrlPairing();
    bindNavigation();
    bindPosEvents();
    bindModals();
    bindSettingsEvents();
    checkInitialConnection();
    updateOnlineStatus();
  });

  // ==========================================================================
  // MAGIC PAIRING VIA URL PARAMETER (?pair=... atau ?url=...&key=...)
  // ==========================================================================
  function checkUrlPairing() {
    try {
      const params = new URLSearchParams(window.location.search);
      const pairToken = params.get('pair');
      const paramUrl = params.get('url');
      const paramKey = params.get('key');

      let paired = false;
      if (pairToken) {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(pairToken))));
        if (decoded && decoded.u && decoded.k) {
          state.webAppUrl = decoded.u;
          state.secretKey = decoded.k;
          localStorage.setItem('EKASIR_GAS_URL', decoded.u);
          localStorage.setItem('EKASIR_SECRET_KEY', decoded.k);
          paired = true;
        }
      } else if (paramUrl && paramKey) {
        state.webAppUrl = paramUrl;
        state.secretKey = paramKey;
        localStorage.setItem('EKASIR_GAS_URL', paramUrl);
        localStorage.setItem('EKASIR_SECRET_KEY', paramKey);
        paired = true;
      }

      if (paired) {
        // Bersihkan URL agar Secret Key tidak terlihat di address bar
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => {
          showToast('Perangkat berhasil disambungkan otomatis ke database toko!', 'success');
        }, 300);
      }
    } catch (err) {
      console.warn('Gagal memproses link pairing:', err);
    }
  }

  function generatePairingUrl() {
    if (!state.webAppUrl || !state.secretKey) {
      showToast('Sambungkan database terlebih dahulu sebelum membuat link pairing.', 'warning');
      return null;
    }
    const payload = JSON.stringify({ u: state.webAppUrl, k: state.secretKey });
    const encoded = btoa(unescape(encodeURIComponent(payload)));
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?pair=${encodeURIComponent(encoded)}`;
  }

  // ==========================================================================
  // THEME MANAGEMENT (LIGHT MODE DEFAULT + TOGGLE DARK MODE)
  // ==========================================================================
  function initTheme() {
    const savedTheme = localStorage.getItem('EKASIR_THEME') || 'light';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    const btnToggle = document.getElementById('btn-toggle-theme');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('EKASIR_THEME', isDark ? 'dark' : 'light');
      });
    }
  }

  // ==========================================================================
  // PWA REGISTRATION & ONLINE/OFFLINE INDICATOR
  // ==========================================================================
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('[PWA] Service Worker terdaftar:', reg.scope))
          .catch((err) => console.warn('[PWA] Pendaftaran SW gagal:', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.pwaPrompt = e;
      const btnInstall = document.getElementById('btn-install-pwa');
      if (btnInstall) {
        btnInstall.classList.remove('hidden');
        btnInstall.classList.add('flex');
        btnInstall.addEventListener('click', () => {
          if (state.pwaPrompt) {
            state.pwaPrompt.prompt();
            state.pwaPrompt.userChoice.then((choice) => {
              if (choice.outcome === 'accepted') {
                btnInstall.classList.add('hidden');
              }
              state.pwaPrompt = null;
            });
          }
        });
      }
    });

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    const badge = document.getElementById('badge-network');
    if (badge) {
      if (isOnline) {
        badge.innerHTML = '<span class="badge-dot bg-emerald-400 animate-pulse"></span> Online';
        badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      } else {
        badge.innerHTML = '<span class="badge-dot bg-amber-400"></span> Offline (Lokal)';
        badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20';
      }
    }
  }

  function initLucide() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // ==========================================================================
  // API CLIENT DENGAN PROTEKSI SECRET KEY
  // ==========================================================================
  async function callApi(action, data = {}, method = 'POST') {
    if (!state.webAppUrl) {
      showToast('Koneksi Google Apps Script belum dikonfigurasi.', 'error');
      openModal('modal-setup-connection');
      return { success: false, message: 'URL backend belum disetel.' };
    }

    const payload = {
      action: action,
      secret_key: state.secretKey,
      ...data
    };

    try {
      let response;
      if (method === 'GET') {
        const queryParams = new URLSearchParams(payload).toString();
        response = await fetch(`${state.webAppUrl}?${queryParams}`, {
          method: 'GET',
          mode: 'cors'
        });
      } else {
        response = await fetch(state.webAppUrl, {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // GAS POST payload text
          body: JSON.stringify(payload)
        });
      }

      const result = await response.json();
      return result;
    } catch (err) {
      console.error(`API Error [${action}]:`, err);
      return { success: false, message: 'Gagal menghubungi server GAS. Periksa jaringan Anda.' };
    }
  }

  // ==========================================================================
  // CEK KONEKSI & LOAD INITIAL DATA
  // ==========================================================================
  async function checkInitialConnection() {
    if (!state.webAppUrl || !state.secretKey) {
      openModal('modal-setup-connection');
      return;
    }

    renderStaffAuthUI();

    const res = await callApi('getInitialData', {
      staff_id: state.currentStaff ? state.currentStaff.staff_id : ''
    }, 'GET');

    if (res && res.success) {
      if (res.config) state.config = { ...state.config, ...res.config };
      if (res.products) state.products = res.products;
      if (res.customers) state.customers = res.customers;
      if (res.staff_list) state.staffList = res.staff_list;
      if (res.active_shift) {
        state.activeShift = res.active_shift;
        localStorage.setItem('EKASIR_ACTIVE_SHIFT', JSON.stringify(res.active_shift));
      }

      applyStoreConfigToUI();
      renderCategoryPills();
      renderProductGrid();
      renderCartUI();
      renderStaffAuthUI();
      renderShiftUI();
    } else {
      showToast(res.message || 'Gagal sinkronisasi data awal.', 'error');
      // Jika secret key salah, minta setup ulang
      if (res.message && res.message.includes('Secret Key')) {
        openModal('modal-setup-connection');
      }
    }
  }

  function applyStoreConfigToUI() {
    document.getElementById('header-store-name').textContent = state.config.store_name || 'E-Kasir Store';
    document.getElementById('header-store-tagline').textContent = state.config.store_tagline || 'Solusi Kasir Pintar UMKM';

    // Isi form settings
    document.getElementById('cfg-store-name').value = state.config.store_name || '';
    document.getElementById('cfg-store-tagline').value = state.config.store_tagline || '';
    document.getElementById('cfg-store-address').value = state.config.store_address || '';
    document.getElementById('cfg-store-phone').value = state.config.store_phone || '';
    document.getElementById('cfg-receipt-footer').value = state.config.receipt_footer || '';
    document.getElementById('cfg-qris-static').value = state.config.qris_static_string || '';
    document.getElementById('cfg-bank-name').value = state.config.bank_name || '';
    document.getElementById('cfg-bank-account-num').value = state.config.bank_account_number || '';
    document.getElementById('cfg-bank-account-holder').value = state.config.bank_account_holder || '';

    document.getElementById('cfg-enable-tax').checked = state.config.enable_tax === 'true';
    document.getElementById('cfg-enable-points').checked = state.config.enable_points === 'true';
    document.getElementById('cfg-enable-kasbon').checked = state.config.enable_kasbon === 'true';
    document.getElementById('cfg-allow-overselling').checked = state.config.allow_overselling === 'true';

    // Transfer bank di checkout
    document.getElementById('transfer-bank-name').textContent = state.config.bank_name || 'BCA';
    document.getElementById('transfer-bank-acc').textContent = state.config.bank_account_number || '1234567890';
    document.getElementById('transfer-bank-holder').textContent = state.config.bank_account_holder || 'RASH Studio';
  }

  // ==========================================================================
  // NAVIGASI APLIKASI
  // ==========================================================================
  function bindNavigation() {
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-btn');
    navLinks.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetView = btn.getAttribute('data-view');
        switchView(targetView);
      });
    });

    // Mobile floating cart trigger
    const mobileCartBar = document.getElementById('mobile-cart-bar');
    if (mobileCartBar) {
      mobileCartBar.addEventListener('click', () => {
        // Pada layar mobile, memicu checkout modal langsung
        handleCheckoutOpen();
      });
    }

    // Tombol Sync Manual
    document.getElementById('btn-sync-data').addEventListener('click', async () => {
      showToast('Menyinkronkan data dengan Google Sheets...', 'info');
      await checkInitialConnection();
      showToast('Data berhasil diperbarui!', 'success');
    });
  }

  function switchView(viewName) {
    state.currentView = viewName;
    document.querySelectorAll('.view-panel').forEach((el) => {
      el.classList.add('hidden');
      el.classList.remove('block');
    });

    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) {
      targetEl.classList.remove('hidden');
      targetEl.classList.add('block');
    }

    // Update style desktop sidebar
    document.querySelectorAll('.nav-link').forEach((link) => {
      const v = link.getAttribute('data-view');
      if (v === viewName) {
        link.className = 'nav-link w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-brand-600 to-teal-600 shadow-md shadow-brand-600/20 transition';
      } else {
        link.className = 'nav-link w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition';
      }
    });

    // Update style mobile nav
    document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
      const v = btn.getAttribute('data-view');
      if (v === viewName) {
        btn.classList.add('text-brand-600', 'dark:text-brand-400', 'font-bold');
        btn.classList.remove('text-slate-400', 'font-semibold');
      } else {
        btn.classList.remove('text-brand-600', 'dark:text-brand-400', 'font-bold');
        btn.classList.add('text-slate-400', 'font-semibold');
      }
    });

    if (viewName === 'produk') renderProductTable();
    if (viewName === 'member') renderCustomerTable();
    if (viewName === 'karyawan') renderStaffTable();
    if (viewName === 'laporan') renderReportsUI();

    initLucide();
  }

  // ==========================================================================
  // MODUL KASIR POS & PENCARIAN
  // ==========================================================================
  function bindPosEvents() {
    // Search input
    const searchInput = document.getElementById('pos-search-input');
    searchInput.addEventListener('input', (e) => {
      state.searchKeyword = e.target.value.toLowerCase().trim();
      renderProductGrid();
    });

    // USB Barcode Scanner Fast Enter Key
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = searchInput.value.trim();
        if (val) {
          const match = state.products.find(
            (p) => (p.sku && p.sku.toLowerCase() === val.toLowerCase()) || p.nama_produk.toLowerCase() === val.toLowerCase()
          );
          if (match) {
            addToCart(match);
            searchInput.value = '';
            state.searchKeyword = '';
            renderProductGrid();
            showToast(`Ditambahkan: ${match.nama_produk}`, 'success');
          }
        }
      }
    });

    // Filter Kategori
    const catPills = document.querySelectorAll('.cat-pill');
    catPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        catPills.forEach((p) => {
          p.className = 'cat-pill px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand-400 whitespace-nowrap shadow-sm transition';
        });
        pill.className = 'cat-pill px-4 py-2 rounded-full bg-brand-600 text-white whitespace-nowrap shadow-sm shadow-brand-600/25 transition';
        state.activeCategory = pill.getAttribute('data-category');
        renderProductGrid();
      });
    });

    // Clear Cart
    document.getElementById('btn-clear-cart').addEventListener('click', () => {
      if (state.cart.length === 0) return;
      if (confirm('Kosongkan semua item di keranjang belanja?')) {
        state.cart = [];
        saveCartLocal();
        renderCartUI();
      }
    });

    // Hold Cart
    document.getElementById('btn-hold-cart').addEventListener('click', handleHoldCart);
    document.getElementById('btn-view-hold-cart').addEventListener('click', showHoldCartsModal);

    // Checkout Trigger
    document.getElementById('btn-checkout').addEventListener('click', handleCheckoutOpen);

    // Camera Scan Trigger
    document.getElementById('btn-scan-camera').addEventListener('click', startCameraScanner);
    document.getElementById('btn-close-camera').addEventListener('click', stopCameraScanner);
  }

  function renderCategoryPills() {
    const container = document.getElementById('category-pills');
    if (!container) return;

    const uniqueCats = [...new Set(state.products.filter((p) => p.is_active && p.kategori).map((p) => p.kategori))];
    const categories = ['ALL', ...uniqueCats];

    container.innerHTML = '';
    categories.forEach((cat) => {
      const btn = document.createElement('button');
      const isActive = state.activeCategory === cat;
      btn.setAttribute('data-category', cat);
      btn.textContent = cat === 'ALL' ? 'Semua Menu' : cat;
      btn.className = isActive
        ? 'cat-pill px-4 py-2 rounded-full bg-brand-600 text-white whitespace-nowrap shadow-sm shadow-brand-600/25 transition'
        : 'cat-pill px-4 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand-400 whitespace-nowrap shadow-sm transition';

      btn.addEventListener('click', () => {
        state.activeCategory = cat;
        renderCategoryPills();
        renderProductGrid();
      });
      container.appendChild(btn);
    });
  }

  function getCategoryVisual(category) {
    const cat = (category || '').toLowerCase();
    if (cat.includes('template') || cat.includes('digital')) {
      return {
        bg: 'bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-500/20 dark:to-indigo-500/10',
        iconColor: 'text-violet-600 dark:text-violet-400',
        icon: 'file-code-2'
      };
    }
    if (cat.includes('website') || cat.includes('landing')) {
      return {
        bg: 'bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-500/20 dark:to-blue-500/10',
        iconColor: 'text-sky-600 dark:text-sky-400',
        icon: 'globe'
      };
    }
    if (cat.includes('webapp') || cat.includes('pos') || cat.includes('sistem')) {
      return {
        bg: 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/10',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
        icon: 'laptop'
      };
    }
    if (cat.includes('add-on') || cat.includes('addon') || cat.includes('fitur')) {
      return {
        bg: 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/10',
        iconColor: 'text-amber-600 dark:text-amber-400',
        icon: 'puzzle'
      };
    }
    if (cat.includes('minum') || cat.includes('kopi') || cat.includes('drink')) {
      return {
        bg: 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/10',
        iconColor: 'text-amber-600 dark:text-amber-400',
        icon: 'coffee'
      };
    }
    if (cat.includes('makan') || cat.includes('roti') || cat.includes('food') || cat.includes('snack')) {
      return {
        bg: 'bg-gradient-to-br from-rose-100 to-orange-100 dark:from-rose-500/20 dark:to-orange-500/10',
        iconColor: 'text-rose-600 dark:text-rose-400',
        icon: 'utensils'
      };
    }
    if (cat.includes('pakai') || cat.includes('baju') || cat.includes('fashion') || cat.includes('kaos')) {
      return {
        bg: 'bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-500/20 dark:to-violet-500/10',
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        icon: 'shirt'
      };
    }
    if (cat.includes('jasa') || cat.includes('servis') || cat.includes('laundry')) {
      return {
        bg: 'bg-gradient-to-br from-sky-100 to-cyan-100 dark:from-sky-500/20 dark:to-cyan-500/10',
        iconColor: 'text-sky-600 dark:text-sky-400',
        icon: 'sparkles'
      };
    }
    return {
      bg: 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      icon: 'shopping-bag'
    };
  }

  function renderProductGrid() {
    const container = document.getElementById('pos-product-grid');
    const emptyState = document.getElementById('pos-empty-product');
    container.innerHTML = '';

    const filtered = state.products.filter((p) => {
      if (!p.is_active) return false;
      const matchCat = state.activeCategory === 'ALL' || p.kategori === state.activeCategory;
      const matchSearch =
        !state.searchKeyword ||
        p.nama_produk.toLowerCase().includes(state.searchKeyword) ||
        (p.sku && p.sku.toLowerCase().includes(state.searchKeyword));
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
      emptyState.classList.add('flex');
      return;
    }
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');

    filtered.forEach((prod) => {
      const card = document.createElement('div');
      card.className =
        'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-brand-500 dark:hover:border-brand-500/50 rounded-2xl p-3 flex flex-col justify-between cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] group';

      const isFisik = prod.tipe_stok === 'FISIK';
      const isOutOfStock = isFisik && prod.stok <= 0;
      const stockBadgeColor = prod.stok <= 5
        ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/25'
        : 'bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

      const visual = getCategoryVisual(prod.kategori);

      card.innerHTML = `
        <div class="space-y-2.5">
          <div class="w-full h-24 sm:h-28 rounded-xl ${prod.foto_url ? 'bg-slate-100 dark:bg-slate-800' : visual.bg} overflow-hidden flex items-center justify-center relative">
            ${
              prod.foto_url
                ? `<img src="${prod.foto_url}" alt="${prod.nama_produk}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />`
                : `<i data-lucide="${visual.icon}" class="w-9 h-9 ${visual.iconColor} group-hover:scale-110 transition duration-300"></i>`
            }
            ${
              isFisik
                ? `<span class="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm ${stockBadgeColor}">Stok: ${prod.stok}</span>`
                : `<span class="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25 backdrop-blur-sm">Made-to-Order</span>`
            }
          </div>
          <div>
            <div class="text-[10px] text-slate-400 uppercase tracking-wider font-bold">${prod.kategori || 'Umum'}</div>
            <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">${prod.nama_produk}</h4>
          </div>
        </div>
        <div class="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div class="font-extrabold text-xs sm:text-sm text-brand-700 dark:text-emerald-400 font-mono">Rp ${formatNumber(prod.harga_jual)}</div>
          <button class="w-7 h-7 rounded-xl bg-brand-50 dark:bg-brand-600/20 text-brand-600 dark:text-brand-400 group-hover:bg-brand-600 group-hover:text-white flex items-center justify-center transition shadow-sm">
            <i data-lucide="plus" class="w-4 h-4"></i>
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        if (isOutOfStock && state.config.allow_overselling !== 'true') {
          showToast(`Stok ${prod.nama_produk} habis!`, 'error');
          return;
        }
        addToCart(prod);
      });

      container.appendChild(card);
    });

    initLucide();
  }

  // ==========================================================================
  // MANAJEMEN KERANJANG BELANJA
  // ==========================================================================
  function addToCart(prod) {
    const existingIndex = state.cart.findIndex((item) => item.product_id === prod.product_id);

    if (existingIndex > -1) {
      const item = state.cart[existingIndex];
      if (prod.tipe_stok === 'FISIK' && state.config.allow_overselling !== 'true') {
        if (item.qty + 1 > prod.stok) {
          showToast(`Maksimal stok tersedia hanya ${prod.stok} pcs`, 'warning');
          return;
        }
      }
      item.qty += 1;
    } else {
      state.cart.push({
        product_id: prod.product_id,
        sku: prod.sku || '',
        nama_produk: prod.nama_produk,
        harga_modal: prod.harga_modal,
        harga_jual: prod.harga_jual,
        qty: 1,
        tipe_stok: prod.tipe_stok,
        stok: prod.stok,
        discount: 0,
        note: ''
      });
    }

    saveCartLocal();
    renderCartUI();
  }

  function updateCartQty(index, delta) {
    const item = state.cart[index];
    if (!item) return;

    if (delta > 0 && item.tipe_stok === 'FISIK' && state.config.allow_overselling !== 'true') {
      if (item.qty + delta > item.stok) {
        showToast(`Stok tidak mencukupi (Tersisa: ${item.stok})`, 'warning');
        return;
      }
    }

    item.qty += delta;
    if (item.qty <= 0) {
      state.cart.splice(index, 1);
    }

    saveCartLocal();
    renderCartUI();
  }

  function saveCartLocal() {
    localStorage.setItem('EKASIR_CART', JSON.stringify(state.cart));
  }

  function calculateCartTotals() {
    let subtotal = 0;
    let totalDiscount = 0;

    state.cart.forEach((item) => {
      const itemTotal = item.harga_jual * item.qty;
      subtotal += itemTotal;
      totalDiscount += item.discount || 0;
    });

    const isTaxEnabled = state.config.enable_tax === 'true';
    const taxRate = Number(state.config.tax_rate || 11);
    const tax = isTaxEnabled ? Math.round((subtotal - totalDiscount) * (taxRate / 100)) : 0;
    const grandTotal = Math.max(0, subtotal - totalDiscount + tax);

    return { subtotal, totalDiscount, tax, grandTotal, taxRate };
  }

  function renderCartUI() {
    const container = document.getElementById('cart-items-container');
    container.innerHTML = '';

    const { subtotal, totalDiscount, tax, grandTotal, taxRate } = calculateCartTotals();

    // Update Totals di Desktop Panel
    document.getElementById('cart-subtotal').textContent = `Rp ${formatNumber(subtotal)}`;
    document.getElementById('cart-grand-total').textContent = `Rp ${formatNumber(grandTotal)}`;

    const rowTax = document.getElementById('row-tax');
    if (state.config.enable_tax === 'true') {
      rowTax.classList.remove('hidden');
      rowTax.classList.add('flex');
      document.getElementById('cart-tax-rate').textContent = taxRate;
      document.getElementById('cart-tax').textContent = `Rp ${formatNumber(tax)}`;
    } else {
      rowTax.classList.add('hidden');
      rowTax.classList.remove('flex');
    }

    const rowDiscount = document.getElementById('row-discount');
    if (totalDiscount > 0) {
      rowDiscount.classList.remove('hidden');
      rowDiscount.classList.add('flex');
      document.getElementById('cart-discount').textContent = `- Rp ${formatNumber(totalDiscount)}`;
    } else {
      rowDiscount.classList.add('hidden');
      rowDiscount.classList.remove('flex');
    }

    // Update Mobile Floating Cart Bar
    const totalItems = state.cart.reduce((sum, item) => sum + item.qty, 0);
    const mobileCartBar = document.getElementById('mobile-cart-bar');
    if (mobileCartBar) {
      if (totalItems > 0) {
        mobileCartBar.classList.remove('translate-y-24');
        mobileCartBar.classList.add('translate-y-0');
        document.getElementById('mobile-cart-badge').textContent = totalItems;
        document.getElementById('mobile-cart-total').textContent = `Rp ${formatNumber(grandTotal)}`;
      } else {
        mobileCartBar.classList.remove('translate-y-0');
        mobileCartBar.classList.add('translate-y-24');
      }
    }

    // Customer di Cart
    const custNameEl = document.getElementById('cart-customer-name');
    const custPointsEl = document.getElementById('cart-customer-points');
    if (state.selectedCustomer) {
      custNameEl.textContent = state.selectedCustomer.nama;
      custPointsEl.textContent = `Poin: ${state.selectedCustomer.total_poin || 0} Pts`;
    } else {
      custNameEl.textContent = 'Pelanggan Umum';
      custPointsEl.textContent = 'Poin: 0 Pts';
    }

    // Render Items
    if (state.cart.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-xs">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2.5">
            <i data-lucide="shopping-bag" class="w-6 h-6 text-slate-400"></i>
          </div>
          <div class="font-semibold text-slate-500 dark:text-slate-400">Keranjang masih kosong</div>
          <div class="text-[11px] text-slate-400 mt-0.5">Klik produk di sebelah kiri untuk menambahkan</div>
        </div>
      `;
      initLucide();
      return;
    }

    state.cart.forEach((item, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2 text-xs';
      itemEl.innerHTML = `
        <div class="flex items-start justify-between gap-2">
          <div class="overflow-hidden">
            <h5 class="font-bold text-slate-900 dark:text-white truncate">${item.nama_produk}</h5>
            <div class="text-[11px] text-brand-600 dark:text-emerald-400 font-mono font-semibold">Rp ${formatNumber(item.harga_jual)}</div>
          </div>
          <div class="font-mono font-bold text-slate-900 dark:text-white">Rp ${formatNumber(item.harga_jual * item.qty)}</div>
        </div>
        <div class="flex items-center justify-between pt-1.5 border-t border-slate-200/70 dark:border-slate-700/40">
          <div class="flex items-center gap-1.5">
            <button class="btn-qty-minus w-7 h-7 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold shadow-sm" data-index="${index}">-</button>
            <span class="w-7 text-center font-mono font-bold text-slate-900 dark:text-white">${item.qty}</span>
            <button class="btn-qty-plus w-7 h-7 rounded-lg bg-white dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold shadow-sm" data-index="${index}">+</button>
          </div>
          <button class="btn-remove-item text-slate-400 hover:text-red-500 p-1 transition" data-index="${index}">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      `;

      itemEl.querySelector('.btn-qty-minus').addEventListener('click', () => updateCartQty(index, -1));
      itemEl.querySelector('.btn-qty-plus').addEventListener('click', () => updateCartQty(index, 1));
      itemEl.querySelector('.btn-remove-item').addEventListener('click', () => updateCartQty(index, -item.qty));

      container.appendChild(itemEl);
    });

    initLucide();
  }

  // ==========================================================================
  // HOLD CART (SIMPAN & PANGGIL SEMENTARA)
  // ==========================================================================
  function handleHoldCart() {
    if (state.cart.length === 0) {
      showToast('Keranjang masih kosong untuk ditahan.', 'warning');
      return;
    }

    const holdId = 'HOLD-' + Date.now();
    const customer = state.selectedCustomer ? state.selectedCustomer.nama : 'Pelanggan Umum';
    state.holdCarts.push({
      id: holdId,
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      customer: customer,
      items: [...state.cart],
      selectedCustomer: state.selectedCustomer
    });

    localStorage.setItem('EKASIR_HOLD_CARTS', JSON.stringify(state.holdCarts));
    state.cart = [];
    state.selectedCustomer = null;
    saveCartLocal();
    renderCartUI();
    updateHoldCartCount();
    showToast('Pesanan berhasil ditahan sementara.', 'info');
  }

  function updateHoldCartCount() {
    const el = document.getElementById('hold-cart-count');
    if (el) el.textContent = state.holdCarts.length;
  }

  function showHoldCartsModal() {
    if (state.holdCarts.length === 0) {
      showToast('Tidak ada antrean keranjang yang ditahan.', 'info');
      return;
    }
    // Sederhanakan dengan memilih keranjang tertahan terakhir
    const lastHold = state.holdCarts.pop();
    state.cart = lastHold.items;
    state.selectedCustomer = lastHold.selectedCustomer;
    localStorage.setItem('EKASIR_HOLD_CARTS', JSON.stringify(state.holdCarts));
    saveCartLocal();
    renderCartUI();
    updateHoldCartCount();
    showToast(`Keranjang atas nama ${lastHold.customer} dipulihkan!`, 'success');
  }

  // ==========================================================================
  // ALGORITMA KONVERSI QRIS STATIS KE QRIS DINAMIS MANDIRI (EMVCo)
  // ==========================================================================
  function generateDynamicQrisPayload(staticQris, grandTotal) {
    if (!staticQris || staticQris.length < 20) {
      return null;
    }

    let payload = staticQris.trim();

    // 1. Hapus 4 karakter CRC lama jika ada di akhir (Tag 6304XXXX)
    if (payload.includes('6304')) {
      payload = payload.substring(0, payload.lastIndexOf('6304'));
    }

    // 2. Ubah Tag Point of Initiation Method: 010211 (Statis) -> 010212 (Dinamis)
    payload = payload.replace('010211', '010212');

    // 3. Susun Tag 54 (Transaction Amount)
    const amountStr = Math.round(grandTotal).toString();
    const lenStr = amountStr.length < 10 ? '0' + amountStr.length : amountStr.length.toString();
    const tag54 = '54' + lenStr + amountStr;

    // 4. Sisipkan Tag 54 tepat sebelum Tag 5802ID (Country Code Indonesia)
    const targetTag = '5802ID';
    const insertPos = payload.indexOf(targetTag);
    if (insertPos > -1) {
      payload = payload.substring(0, insertPos) + tag54 + payload.substring(insertPos);
    } else {
      payload = payload + tag54;
    }

    // 5. Tambahkan identifier Tag 63
    payload = payload + '6304';

    // 6. Hitung Checksum CRC16-CCITT (Polinomial 0x1021, Init 0xFFFF)
    const crcHex = calculateCrc16(payload);

    return payload + crcHex;
  }

  function calculateCrc16(str) {
    let crc = 0xffff;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }
    let hex = crc.toString(16).toUpperCase();
    while (hex.length < 4) hex = '0' + hex;
    return hex;
  }

  // ==========================================================================
  // MODAL CHECKOUT & PROSES PEMBAYARAN
  // ==========================================================================
  function handleCheckoutOpen() {
    if (state.cart.length === 0) {
      showToast('Keranjang masih kosong.', 'warning');
      return;
    }

    const { grandTotal } = calculateCartTotals();
    document.getElementById('checkout-total-bill').textContent = `Rp ${formatNumber(grandTotal)}`;

    const memberBadge = document.getElementById('checkout-member-badge');
    if (state.selectedCustomer) {
      const earnRate = Number(state.config.point_earn_rate || 10000);
      const estPoin = earnRate > 0 ? Math.floor(grandTotal / earnRate) : 0;
      memberBadge.innerHTML = `
        <div class="font-bold text-slate-900 dark:text-white">${state.selectedCustomer.nama}</div>
        <div class="text-[10px] text-brand-600 dark:text-brand-400">Poin Belanja: +${estPoin} Pts</div>
      `;
    } else {
      memberBadge.innerHTML = `
        <div class="font-bold text-slate-900 dark:text-white">Pelanggan Umum</div>
        <div class="text-[10px] text-slate-500 dark:text-slate-400">Non-Member</div>
      `;
    }

    // Default ke Tunai
    switchPaymentMethod('TUNAI');

    // Input nominal tunai default pas
    const cashInput = document.getElementById('input-cash-received');
    cashInput.value = grandTotal;
    updateCashChange();

    openModal('modal-checkout');
  }

  function switchPaymentMethod(method) {
    state.activePayMethod = method;

    document.querySelectorAll('.pay-method-tab').forEach((tab) => {
      if (tab.getAttribute('data-method') === method) {
        tab.className = 'pay-method-tab py-2.5 rounded-xl bg-brand-600 text-white border border-brand-600 shadow-sm transition text-center';
      } else {
        tab.className = 'pay-method-tab py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition text-center';
      }
    });

    document.querySelectorAll('.pay-content').forEach((el) => {
      el.classList.add('hidden');
      el.classList.remove('block');
    });

    const activeContent = document.getElementById(`pay-content-${method.toLowerCase()}`);
    if (activeContent) {
      activeContent.classList.remove('hidden');
      activeContent.classList.add('block');
    }

    const btnSubmitLabel = document.getElementById('btn-submit-payment-label');

    if (method === 'QRIS') {
      btnSubmitLabel.textContent = 'Konfirmasi Pembayaran Lunas';
      renderQrisModal();
    } else if (method === 'TUNAI') {
      btnSubmitLabel.textContent = 'Selesaikan Transaksi Tunai';
    } else if (method === 'TRANSFER') {
      btnSubmitLabel.textContent = 'Konfirmasi Transfer Masuk';
    } else if (method === 'KASBON') {
      btnSubmitLabel.textContent = 'Catat Piutang (Kasbon)';
    }
  }

  function renderQrisModal() {
    const qrisContainer = document.getElementById('qris-code-container');
    qrisContainer.innerHTML = '';

    const { grandTotal } = calculateCartTotals();
    const staticString = state.config.qris_static_string || '';

    if (!staticString) {
      qrisContainer.innerHTML = `
        <div class="text-xs text-red-500 p-2">
          String QRIS Toko belum disetel di Control Panel Admin.
        </div>
      `;
      return;
    }

    const dynamicPayload = generateDynamicQrisPayload(staticString, grandTotal);
    if (!dynamicPayload) {
      qrisContainer.innerHTML = '<div class="text-xs text-red-500">Format String QRIS Statis tidak valid.</div>';
      return;
    }

    new QRCode(qrisContainer, {
      text: dynamicPayload,
      width: 180,
      height: 180,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  function updateCashChange() {
    const { grandTotal } = calculateCartTotals();
    const cashInput = document.getElementById('input-cash-received');
    const cash = Number(cashInput.value || 0);
    const change = Math.max(0, cash - grandTotal);
    document.getElementById('cash-change-display').textContent = `Rp ${formatNumber(change)}`;
  }

  // ==========================================================================
  // EKSEKUSI PEMBAYARAN KE BACKEND
  // ==========================================================================
  async function submitTransaction() {
    const { subtotal, totalDiscount, tax, grandTotal } = calculateCartTotals();
    const method = state.activePayMethod;
    let cashReceived = grandTotal;
    let change = 0;

    if (method === 'TUNAI') {
      cashReceived = Number(document.getElementById('input-cash-received').value || 0);
      if (cashReceived < grandTotal) {
        showToast('Nominal uang tunai kurang dari total tagihan!', 'error');
        return;
      }
      change = cashReceived - grandTotal;
    }

    if (method === 'KASBON') {
      if (!state.selectedCustomer) {
        showToast('Metode Kasbon wajib memilih data member/pelanggan terdaftar!', 'warning');
        return;
      }
    }

    const btnSubmit = document.getElementById('btn-submit-payment');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i><span>Memproses...</span>';
    initLucide();

    const itemsPayload = state.cart.map((item) => ({
      product_id: item.product_id,
      nama_produk: item.nama_produk,
      harga_modal: item.harga_modal,
      harga_jual: item.harga_jual,
      qty: item.qty,
      subtotal_item: item.harga_jual * item.qty
    }));

    const res = await callApi('createTransaction', {
      shift_id: state.activeShift ? state.activeShift.shift_id : '',
      staff_id: state.currentStaff ? state.currentStaff.staff_id : 'STF-001',
      customer_id: state.selectedCustomer ? state.selectedCustomer.customer_id : 'CUST-001',
      items: itemsPayload,
      subtotal: subtotal,
      diskon: totalDiscount,
      pajak: tax,
      grand_total: grandTotal,
      metode_bayar: method,
      uang_diterima: cashReceived,
      kembalian: change
    });

    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5"></i><span>Konfirmasi Pembayaran</span>';
    initLucide();

    if (res && res.success) {
      state.lastTransaction = {
        trx_id: res.trx_id,
        items: [...state.cart],
        subtotal: subtotal,
        diskon: totalDiscount,
        pajak: tax,
        grand_total: grandTotal,
        metode_bayar: method,
        uang_diterima: cashReceived,
        kembalian: change,
        tanggal_waktu: res.tanggal_waktu || new Date().toLocaleString('id-ID'),
        customer: state.selectedCustomer ? state.selectedCustomer.nama : 'Pelanggan Umum',
        customer_phone: state.selectedCustomer ? state.selectedCustomer.no_wa : ''
      };

      // Reset Keranjang
      state.cart = [];
      state.selectedCustomer = null;
      saveCartLocal();
      renderCartUI();
      closeModal('modal-checkout');

      // Buka Modal Struk Sukses
      showReceiptModal(state.lastTransaction);
      showToast('Transaksi Berhasil Disimpan!', 'success');
      
      // Sinkronkan data background
      checkInitialConnection();
    } else {
      showToast(res.message || 'Gagal memproses transaksi.', 'error');
    }
  }

  // ==========================================================================
  // STRUK BELANJA THERMAL (@media print) & WHATSAPP NOTA
  // ==========================================================================
  function showReceiptModal(trx) {
    document.getElementById('receipt-modal-trx-id').textContent = trx.trx_id;
    const previewBox = document.getElementById('receipt-preview-box');
    const printArea = document.getElementById('receipt-print-area');

    const htmlContent = `
      <div style="text-align: center; margin-bottom: 6px;">
        <div style="font-size: 13px; font-weight: bold;">${state.config.store_name}</div>
        <div style="font-size: 10px;">${state.config.store_address}</div>
        <div style="font-size: 10px;">WA: ${state.config.store_phone}</div>
      </div>
      <div class="receipt-divider"></div>
      <div>No. Struk : ${trx.trx_id}</div>
      <div>Tanggal   : ${trx.tanggal_waktu}</div>
      <div>Kasir     : ${state.currentStaff ? state.currentStaff.nama : 'Admin'}</div>
      <div>Pelanggan : ${trx.customer}</div>
      <div class="receipt-divider"></div>
      ${trx.items
        .map(
          (itm) => `
        <div style="display: flex; justify-content: space-between;">
          <span>${itm.nama_produk} x${itm.qty}</span>
          <span>${formatNumber(itm.harga_jual * itm.qty)}</span>
        </div>
      `
        )
        .join('')}
      <div class="receipt-divider"></div>
      <div style="display: flex; justify-content: space-between;">
        <span>Subtotal</span><span>${formatNumber(trx.subtotal)}</span>
      </div>
      ${
        trx.diskon > 0
          ? `<div style="display: flex; justify-content: space-between;"><span>Diskon</span><span>-${formatNumber(trx.diskon)}</span></div>`
          : ''
      }
      ${
        trx.pajak > 0
          ? `<div style="display: flex; justify-content: space-between;"><span>PPN</span><span>${formatNumber(trx.pajak)}</span></div>`
          : ''
      }
      <div style="display: flex; justify-content: space-between; font-weight: bold; margin-top: 3px;">
        <span>TOTAL</span><span>Rp ${formatNumber(trx.grand_total)}</span>
      </div>
      <div class="receipt-divider"></div>
      <div style="display: flex; justify-content: space-between;">
        <span>Metode</span><span>${trx.metode_bayar}</span>
      </div>
      ${
        trx.metode_bayar === 'TUNAI'
          ? `
        <div style="display: flex; justify-content: space-between;"><span>Bayar</span><span>${formatNumber(trx.uang_diterima)}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>Kembali</span><span>${formatNumber(trx.kembalian)}</span></div>
      `
          : ''
      }
      <div class="receipt-divider-double"></div>
      <div style="text-align: center; font-size: 10px; margin-top: 5px;">
        ${state.config.receipt_footer}
      </div>
    `;

    previewBox.innerHTML = htmlContent;
    printArea.innerHTML = htmlContent;

    openModal('modal-receipt');
  }

  function handlePrintReceipt() {
    window.print();
  }

  function handleSendWhatsAppReceipt() {
    if (!state.lastTransaction) return;
    const trx = state.lastTransaction;
    let phone = trx.customer_phone || prompt('Masukkan nomor WhatsApp tujuan (contoh: 08123456789):');
    if (!phone) return;

    phone = phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('08')) phone = '628' + phone.substring(2);

    let msg = `*NOTA PEMBAYARAN - ${state.config.store_name}*\n`;
    msg += `------------------------------------\n`;
    msg += `No: ${trx.trx_id}\n`;
    msg += `Waktu: ${trx.tanggal_waktu}\n`;
    msg += `Pelanggan: ${trx.customer}\n`;
    msg += `------------------------------------\n`;
    trx.items.forEach((itm) => {
      msg += `${itm.nama_produk} x${itm.qty} = Rp ${formatNumber(itm.harga_jual * itm.qty)}\n`;
    });
    msg += `------------------------------------\n`;
    msg += `*TOTAL: Rp ${formatNumber(trx.grand_total)}* (${trx.metode_bayar})\n\n`;
    msg += `${state.config.receipt_footer}\n`;

    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  }

  // ==========================================================================
  // MANAJEMEN SHIFT KASIR
  // ==========================================================================
  function renderShiftUI() {
    const shiftPill = document.getElementById('shift-status-pill');
    const shiftText = document.getElementById('shift-status-text');
    const detailStatus = document.getElementById('shift-detail-status');
    const infoId = document.getElementById('shift-info-id');
    const infoTime = document.getElementById('shift-info-time');
    const infoModal = document.getElementById('shift-info-modal');
    const actionContainer = document.getElementById('shift-action-btn-container');

    if (state.activeShift) {
      shiftPill.classList.remove('hidden');
      shiftPill.classList.add('flex');
      shiftText.textContent = `Shift: Aktif (#${state.activeShift.shift_id.substring(4, 10)})`;

      detailStatus.textContent = 'Shift Sedang Aktif';
      detailStatus.className = 'text-sm font-bold text-emerald-400';
      infoId.textContent = state.activeShift.shift_id;
      infoTime.textContent = state.activeShift.waktu_buka;
      infoModal.textContent = `Rp ${formatNumber(state.activeShift.modal_awal)}`;

      actionContainer.innerHTML = `
        <button id="btn-close-shift-modal" class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition">
          Tutup Shift Kasir
        </button>
      `;
      document.getElementById('btn-close-shift-modal').addEventListener('click', () => {
        openModal('modal-close-shift');
      });
    } else {
      shiftPill.classList.add('hidden');
      shiftPill.classList.remove('flex');

      detailStatus.textContent = 'Shift Belum Dibuka';
      detailStatus.className = 'text-sm font-bold text-slate-400';
      infoId.textContent = '-';
      infoTime.textContent = '-';
      infoModal.textContent = 'Rp 0';

      actionContainer.innerHTML = `
        <button id="btn-open-shift-modal" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition">
          Buka Shift Baru
        </button>
      `;
      document.getElementById('btn-open-shift-modal').addEventListener('click', () => {
        openModal('modal-open-shift');
      });
    }
  }

  // ==========================================================================
  // AUTENTIKASI STAF & LOGIN PIN
  // ==========================================================================
  function renderStaffAuthUI() {
    const currentNameEl = document.getElementById('current-user-name');
    const currentRoleEl = document.getElementById('current-user-role');
    const btnAuth = document.getElementById('btn-auth-action');
    const btnLabel = document.getElementById('auth-btn-label');

    if (state.currentStaff) {
      currentNameEl.textContent = state.currentStaff.nama;
      currentRoleEl.textContent = state.currentStaff.role;
      btnLabel.textContent = 'Logout';
      btnAuth.onclick = handleLogout;
    } else {
      currentNameEl.textContent = 'Guest';
      currentRoleEl.textContent = 'Kasir';
      btnLabel.textContent = 'Login';
      btnAuth.onclick = () => openStaffLoginModal();
    }
  }

  function openStaffLoginModal() {
    const selectEl = document.getElementById('login-staff-select');
    selectEl.innerHTML = '';
    state.staffList.forEach((stf) => {
      const opt = document.createElement('option');
      opt.value = stf.staff_id;
      opt.textContent = `${stf.nama} (${stf.role})`;
      selectEl.appendChild(opt);
    });

    document.getElementById('login-pin-input').value = '';
    openModal('modal-login-staff');
  }

  function handleLogout() {
    if (confirm('Keluar dari sesi kasir saat ini?')) {
      state.currentStaff = null;
      localStorage.removeItem('EKASIR_CURRENT_STAFF');
      renderStaffAuthUI();
      showToast('Anda telah keluar.', 'info');
    }
  }

  // ==========================================================================
  // SCANNER BARCODE KAMERA (HTML5-QRCode)
  // ==========================================================================
  function startCameraScanner() {
    openModal('modal-camera-scan');
    if (!state.html5QrCode) {
      state.html5QrCode = new Html5Qrcode('qr-reader');
    }
    state.html5QrCode
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          stopCameraScanner();
          // Cari produk berdasarkan SKU / Barcode
          const match = state.products.find(
            (p) => (p.sku && p.sku.toLowerCase() === decodedText.toLowerCase()) || p.product_id === decodedText
          );
          if (match) {
            addToCart(match);
            showToast(`Scan Berhasil: ${match.nama_produk}`, 'success');
          } else {
            showToast(`Barcode tidak dikenali: ${decodedText}`, 'warning');
          }
        },
        () => {}
      )
      .catch((err) => {
        console.warn('Gagal akses kamera:', err);
        showToast('Kamera tidak dapat diakses atau izin ditolak.', 'error');
        stopCameraScanner();
      });
  }

  function stopCameraScanner() {
    if (state.html5QrCode && state.html5QrCode.isScanning) {
      state.html5QrCode.stop().then(() => {
        closeModal('modal-camera-scan');
      });
    } else {
      closeModal('modal-camera-scan');
    }
  }

  // ==========================================================================
  // EVENT BINDING MODAL & ACTION HANDLERS
  // ==========================================================================
  function bindModals() {
    // Tutup checkout
    document.getElementById('btn-close-checkout').addEventListener('click', () => closeModal('modal-checkout'));
    
    // Tab metode bayar
    document.querySelectorAll('.pay-method-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        switchPaymentMethod(tab.getAttribute('data-method'));
      });
    });

    // Input nominal tunai & tombol cepat
    const cashInput = document.getElementById('input-cash-received');
    cashInput.addEventListener('input', updateCashChange);
    document.querySelectorAll('.quick-cash-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-cash');
        const { grandTotal } = calculateCartTotals();
        if (val === 'PAS') {
          cashInput.value = grandTotal;
        } else {
          cashInput.value = Number(val);
        }
        updateCashChange();
      });
    });

    // Eksekusi bayar
    document.getElementById('btn-submit-payment').addEventListener('click', submitTransaction);

    // Modal Struk Actions
    document.getElementById('btn-print-receipt').addEventListener('click', handlePrintReceipt);
    document.getElementById('btn-wa-receipt').addEventListener('click', handleSendWhatsAppReceipt);
    document.getElementById('btn-next-transaction').addEventListener('click', () => closeModal('modal-receipt'));

    // Keypad PIN Login
    const pinInput = document.getElementById('login-pin-input');
    document.querySelectorAll('.pin-digit').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (pinInput.value.length < 6) pinInput.value += btn.getAttribute('data-digit');
      });
    });
    document.getElementById('btn-pin-clear').addEventListener('click', () => (pinInput.value = ''));
    document.getElementById('btn-pin-submit').addEventListener('click', async () => {
      const staffId = document.getElementById('login-staff-select').value;
      const pin = pinInput.value;
      if (!pin) return showToast('Masukkan PIN Anda.', 'warning');

      const res = await callApi('loginStaff', { staff_id: staffId, pin_code: pin });
      if (res && res.success) {
        state.currentStaff = res.staff;
        localStorage.setItem('EKASIR_CURRENT_STAFF', JSON.stringify(res.staff));
        renderStaffAuthUI();
        closeModal('modal-login-staff');
        showToast(`Selamat bekerja, ${res.staff.nama}!`, 'success');
      } else {
        showToast(res.message || 'Login gagal.', 'error');
      }
    });

    // Customer Lookup
    document.getElementById('btn-select-customer').addEventListener('click', openCustomerLookupModal);
    document.getElementById('btn-close-customer-lookup').addEventListener('click', () => closeModal('modal-customer-lookup'));
    document.getElementById('btn-select-guest').addEventListener('click', () => {
      state.selectedCustomer = null;
      renderCartUI();
      closeModal('modal-customer-lookup');
    });

    // Open Shift Submission
    document.getElementById('btn-close-open-shift').addEventListener('click', () => closeModal('modal-open-shift'));
    document.getElementById('btn-submit-open-shift').addEventListener('click', async () => {
      const modalAwal = Number(document.getElementById('input-open-shift-modal').value || 0);
      const res = await callApi('openShift', {
        staff_id: state.currentStaff ? state.currentStaff.staff_id : 'STF-001',
        modal_awal: modalAwal
      });
      if (res && res.success) {
        state.activeShift = {
          shift_id: res.shift_id,
          staff_id: state.currentStaff ? state.currentStaff.staff_id : 'STF-001',
          waktu_buka: res.waktu_buka,
          modal_awal: res.modal_awal
        };
        localStorage.setItem('EKASIR_ACTIVE_SHIFT', JSON.stringify(state.activeShift));
        renderShiftUI();
        closeModal('modal-open-shift');
        showToast('Shift kasir berhasil dibuka!', 'success');
      } else {
        showToast(res.message || 'Gagal membuka shift.', 'error');
      }
    });

    // Close Shift Submission
    document.getElementById('btn-close-modal-shift').addEventListener('click', () => closeModal('modal-close-shift'));
    document.getElementById('btn-submit-close-shift').addEventListener('click', async () => {
      const fisikKas = Number(document.getElementById('input-close-physical-cash').value || 0);
      const res = await callApi('closeShift', {
        shift_id: state.activeShift.shift_id,
        uang_fisik_laci: fisikKas
      });
      if (res && res.success) {
        state.activeShift = null;
        localStorage.removeItem('EKASIR_ACTIVE_SHIFT');
        renderShiftUI();
        closeModal('modal-close-shift');
        showToast('Shift berhasil ditutup dan direkap!', 'success');
      } else {
        showToast(res.message || 'Gagal menutup shift.', 'error');
      }
    });

    // Void Trx Modal
    document.getElementById('btn-close-void').addEventListener('click', () => closeModal('modal-void-trx'));
    document.getElementById('btn-confirm-void-submit').addEventListener('click', async () => {
      const trxId = document.getElementById('void-target-trx-id').value;
      const pin = document.getElementById('void-admin-pin').value;
      if (!pin) return showToast('Masukkan PIN Admin.', 'warning');

      const res = await callApi('voidTransaction', { trx_id: trxId, admin_pin: pin });
      if (res && res.success) {
        closeModal('modal-void-trx');
        showToast(res.message, 'success');
        checkInitialConnection();
      } else {
        showToast(res.message || 'Gagal membatalkan transaksi.', 'error');
      }
    });

    // Product Modal Handlers
    document.getElementById('btn-add-product').addEventListener('click', () => {
      document.getElementById('product-form-title').textContent = 'Tambah Produk Baru';
      document.getElementById('prod-form-id').value = '';
      document.getElementById('prod-form-name').value = '';
      document.getElementById('prod-form-sku').value = '';
      document.getElementById('prod-form-category').value = 'Makanan';
      document.getElementById('prod-form-cost').value = '';
      document.getElementById('prod-form-price').value = '';
      document.getElementById('prod-form-stock').value = '50';
      document.getElementById('prod-form-type').value = 'FISIK';
      openModal('modal-product-form');
    });
    document.getElementById('btn-close-product-form').addEventListener('click', () => closeModal('modal-product-form'));
    document.getElementById('btn-save-product-submit').addEventListener('click', handleSaveProductSubmit);
  }

  // ==========================================================================
  // CRM LOOKUP MODAL
  // ==========================================================================
  function openCustomerLookupModal() {
    const listContainer = document.getElementById('member-lookup-list');
    const searchMemberInput = document.getElementById('input-search-member');
    searchMemberInput.value = '';

    const renderList = (filter = '') => {
      listContainer.innerHTML = '';
      const filtered = state.customers.filter(
        (c) => c.nama.toLowerCase().includes(filter) || c.no_wa.includes(filter)
      );

      if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="text-xs text-slate-500 p-3 text-center">Pelanggan tidak ditemukan.</div>';
        return;
      }

      filtered.forEach((cust) => {
        const item = document.createElement('div');
        item.className = 'p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/50 cursor-pointer flex items-center justify-between transition';
        item.innerHTML = `
          <div>
            <div class="font-bold text-slate-900 dark:text-white text-xs">${cust.nama}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-mono">${cust.no_wa}</div>
          </div>
          <div class="text-right text-xs">
            <div class="text-amber-600 dark:text-amber-400 font-bold">${cust.total_poin || 0} Pts</div>
            <div class="text-[10px] text-slate-500 dark:text-slate-400">${cust.tier || 'Reguler'}</div>
          </div>
        `;
        item.addEventListener('click', () => {
          state.selectedCustomer = cust;
          renderCartUI();
          closeModal('modal-customer-lookup');
          showToast(`Pelanggan terpilih: ${cust.nama}`, 'success');
        });
        listContainer.appendChild(item);
      });
    };

    searchMemberInput.oninput = (e) => renderList(e.target.value.toLowerCase().trim());
    renderList();

    openModal('modal-customer-lookup');
  }

  // ==========================================================================
  // MANAJEMEN PRODUK (SIMPAN & BASE64 UPLOAD)
  // ==========================================================================
  async function handleSaveProductSubmit() {
    const pId = document.getElementById('prod-form-id').value;
    const name = document.getElementById('prod-form-name').value.trim();
    const sku = document.getElementById('prod-form-sku').value.trim();
    const category = document.getElementById('prod-form-category').value.trim();
    const cost = Number(document.getElementById('prod-form-cost').value || 0);
    const price = Number(document.getElementById('prod-form-price').value || 0);
    const stock = Number(document.getElementById('prod-form-stock').value || 0);
    const type = document.getElementById('prod-form-type').value;

    if (!name || price <= 0) {
      showToast('Nama dan harga jual wajib diisi dengan benar.', 'warning');
      return;
    }

    const fileInput = document.getElementById('prod-form-image');
    let imageBase64 = '';
    if (fileInput.files && fileInput.files[0]) {
      imageBase64 = await readFileAsBase64(fileInput.files[0]);
    }

    const btn = document.getElementById('btn-save-product-submit');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const res = await callApi('saveProduct', {
      product_id: pId,
      sku: sku,
      nama_produk: name,
      kategori: category,
      harga_modal: cost,
      harga_jual: price,
      stok: stock,
      tipe_stok: type,
      image_base64: imageBase64
    });

    btn.disabled = false;
    btn.textContent = 'Simpan Produk';

    if (res && res.success) {
      closeModal('modal-product-form');
      showToast(res.message, 'success');
      checkInitialConnection();
    } else {
      showToast(res.message || 'Gagal menyimpan produk.', 'error');
    }
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  function renderProductTable() {
    const tbody = document.getElementById('product-table-body');
    tbody.innerHTML = '';
    state.products.forEach((prod) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition';
      tr.innerHTML = `
        <td class="p-3.5">
          <div class="font-bold text-slate-900 dark:text-white">${prod.nama_produk}</div>
          <div class="text-[10px] text-slate-400 font-mono">${prod.sku || '-'}</div>
        </td>
        <td class="p-3.5 text-slate-600 dark:text-slate-300">${prod.kategori}</td>
        <td class="p-3.5 font-semibold ${prod.tipe_stok === 'FISIK' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}">${prod.tipe_stok}</td>
        <td class="p-3.5 text-right font-mono text-slate-500 dark:text-slate-400">Rp ${formatNumber(prod.harga_modal)}</td>
        <td class="p-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">Rp ${formatNumber(prod.harga_jual)}</td>
        <td class="p-3.5 text-center font-mono ${prod.stok <= 5 && prod.tipe_stok === 'FISIK' ? 'text-red-500 dark:text-red-400 font-bold' : 'text-slate-700 dark:text-slate-300'}">${prod.tipe_stok === 'FISIK' ? prod.stok : '-'}</td>
        <td class="p-3.5 text-center">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${prod.is_active ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}">
            ${prod.is_active ? 'Aktif' : 'Nonaktif'}
          </span>
        </td>
        <td class="p-3.5 text-center">
          <button class="btn-edit-prod p-1.5 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition" data-id="${prod.product_id}"><i data-lucide="edit-3" class="w-4 h-4"></i></button>
        </td>
      `;

      tr.querySelector('.btn-edit-prod').addEventListener('click', () => {
        document.getElementById('product-form-title').textContent = 'Edit Data Produk';
        document.getElementById('prod-form-id').value = prod.product_id;
        document.getElementById('prod-form-name').value = prod.nama_produk;
        document.getElementById('prod-form-sku').value = prod.sku;
        document.getElementById('prod-form-category').value = prod.kategori;
        document.getElementById('prod-form-cost').value = prod.harga_modal;
        document.getElementById('prod-form-price').value = prod.harga_jual;
        document.getElementById('prod-form-stock').value = prod.stok;
        document.getElementById('prod-form-type').value = prod.tipe_stok;
        openModal('modal-product-form');
      });

      tbody.appendChild(tr);
    });
    initLucide();
  }

  function renderCustomerTable() {
    const tbody = document.getElementById('customer-table-body');
    tbody.innerHTML = '';
    state.customers.forEach((cust) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition';
      tr.innerHTML = `
        <td class="p-3.5 font-bold text-slate-900 dark:text-white">${cust.nama}</td>
        <td class="p-3.5 font-mono text-slate-600 dark:text-slate-300">${cust.no_wa}</td>
        <td class="p-3.5"><span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 dark:bg-slate-800 text-brand-700 dark:text-brand-400 font-bold">${cust.tier}</span></td>
        <td class="p-3.5 text-center font-mono font-bold text-amber-600 dark:text-amber-400">${cust.total_poin || 0}</td>
        <td class="p-3.5 text-right font-mono text-slate-700 dark:text-slate-300">Rp ${formatNumber(cust.total_belanja || 0)}</td>
        <td class="p-3.5 text-right font-mono ${cust.total_piutang > 0 ? 'text-red-500 dark:text-red-400 font-bold' : 'text-slate-400'}">Rp ${formatNumber(cust.total_piutang || 0)}</td>
        <td class="p-3.5 text-center text-slate-400 font-mono text-[11px]">${cust.customer_id}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderStaffTable() {
    const tbody = document.getElementById('staff-table-body');
    tbody.innerHTML = '';
    state.staffList.forEach((stf) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/40 transition';
      tr.innerHTML = `
        <td class="p-3.5 font-mono text-slate-500 dark:text-slate-400">${stf.staff_id}</td>
        <td class="p-3.5 font-bold text-slate-900 dark:text-white">${stf.nama}</td>
        <td class="p-3.5"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${stf.role === 'ADMIN' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">${stf.role}</span></td>
        <td class="p-3.5 text-center text-emerald-600 dark:text-emerald-400 font-bold">${stf.status}</td>
        <td class="p-3.5 text-center text-slate-400 text-xs">Tersedia</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderReportsUI() {
    // Estimasi metrik dari transaksi lokal
    let omzet = 0;
    let profit = 0;
    let kasbon = 0;

    state.customers.forEach((c) => (kasbon += Number(c.total_piutang || 0)));

    document.getElementById('rep-kasbon-total').textContent = `Rp ${formatNumber(kasbon)}`;
    document.getElementById('rep-omzet-today').textContent = `Rp ${formatNumber(omzet)}`;
    document.getElementById('rep-profit-today').textContent = `Rp ${formatNumber(profit)}`;
  }

  // ==========================================================================
  // CONTROL PANEL PENGATURAN TOKO
  // ==========================================================================
  function bindSettingsEvents() {
    // Setup Koneksi Awal
    document.getElementById('btn-test-connection').addEventListener('click', async () => {
      const url = document.getElementById('setup-gas-url').value.trim();
      const secret = document.getElementById('setup-gas-secret').value.trim();
      if (!url || !secret) return showToast('Isi URL dan Secret Key terlebih dahulu.', 'warning');

      try {
        const res = await fetch(`${url}?action=ping&secret_key=${encodeURIComponent(secret)}`);
        const data = await res.json();
        if (data && data.success) {
          showToast('Koneksi Berhasil & Secret Key Valid!', 'success');
        } else {
          showToast(data.message || 'Koneksi ditolak oleh backend.', 'error');
        }
      } catch (err) {
        showToast('Gagal menghubungi GAS URL. Pastikan deployment berizin "Anyone".', 'error');
      }
    });

    document.getElementById('btn-save-connection').addEventListener('click', () => {
      const url = document.getElementById('setup-gas-url').value.trim();
      const secret = document.getElementById('setup-gas-secret').value.trim();
      if (!url || !secret) return showToast('Isi URL dan Secret Key.', 'warning');

      state.webAppUrl = url;
      state.secretKey = secret;
      localStorage.setItem('EKASIR_GAS_URL', url);
      localStorage.setItem('EKASIR_SECRET_KEY', secret);

      closeModal('modal-setup-connection');
      showToast('Koneksi disimpan. Mengambil data toko...', 'success');
      checkInitialConnection();
    });

    // Simpan Config Toko
    document.getElementById('btn-save-store-config').addEventListener('click', async () => {
      const configObj = {
        store_name: document.getElementById('cfg-store-name').value.trim(),
        store_tagline: document.getElementById('cfg-store-tagline').value.trim(),
        store_address: document.getElementById('cfg-store-address').value.trim(),
        store_phone: document.getElementById('cfg-store-phone').value.trim(),
        receipt_footer: document.getElementById('cfg-receipt-footer').value.trim(),
        qris_static_string: document.getElementById('cfg-qris-static').value.trim(),
        bank_name: document.getElementById('cfg-bank-name').value.trim(),
        bank_account_number: document.getElementById('cfg-bank-account-num').value.trim(),
        bank_account_holder: document.getElementById('cfg-bank-account-holder').value.trim(),
        enable_tax: document.getElementById('cfg-enable-tax').checked ? 'true' : 'false',
        enable_points: document.getElementById('cfg-enable-points').checked ? 'true' : 'false',
        enable_kasbon: document.getElementById('cfg-enable-kasbon').checked ? 'true' : 'false',
        allow_overselling: document.getElementById('cfg-allow-overselling').checked ? 'true' : 'false'
      };

      const fonnteToken = document.getElementById('cfg-fonnte-token').value.trim();

      const res = await callApi('updateStoreConfig', {
        config: configObj,
        fonnte_api_token: fonnteToken
      });

      if (res && res.success) {
        state.config = { ...state.config, ...configObj };
        applyStoreConfigToUI();
        showToast('Pengaturan toko berhasil disimpan ke database!', 'success');
      } else {
        showToast(res.message || 'Gagal menyimpan pengaturan.', 'error');
      }
    });

    // Ekspor CSV
    document.getElementById('btn-export-csv').addEventListener('click', async () => {
      showToast('Membuat arsip laporan CSV di Google Drive...', 'info');
      const res = await callApi('exportReportCsv', {});
      if (res && res.success) {
        showToast('Laporan CSV berhasil diarsipkan di Google Drive!', 'success');
        if (res.download_url) window.open(res.download_url, '_blank');
      } else {
        showToast(res.message || 'Gagal ekspor laporan.', 'error');
      }
    });

    // Magic Pairing Perangkat Kasir Baru
    document.getElementById('btn-copy-pairing-link').addEventListener('click', async () => {
      const pairingUrl = generatePairingUrl();
      if (!pairingUrl) return;
      try {
        await navigator.clipboard.writeText(pairingUrl);
        showToast('Link Setup Kasir disalin! Silakan kirim ke WhatsApp perangkat baru.', 'success');
      } catch (err) {
        prompt('Salin link berikut dan buka di perangkat kasir baru:', pairingUrl);
      }
    });

    document.getElementById('btn-show-pairing-qr').addEventListener('click', () => {
      const pairingUrl = generatePairingUrl();
      if (!pairingUrl) return;
      const qrContainer = document.getElementById('qr-pairing-container');
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: pairingUrl,
        width: 192,
        height: 192,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      openModal('modal-qr-pairing');
    });

    document.getElementById('btn-close-qr-pairing').addEventListener('click', () => {
      closeModal('modal-qr-pairing');
    });
  }

  // ==========================================================================
  // HELPER UTILITIES: MODAL, FORMATTER & TOAST
  // ==========================================================================
  function openModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
      m.classList.remove('hidden');
      m.classList.add('flex');
    }
  }

  function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
      m.classList.remove('flex');
      m.classList.add('hidden');
    }
  }

  function formatNumber(num) {
    return Number(num || 0).toLocaleString('id-ID');
  }

  function showToast(message, type = 'info') {
    const existing = document.getElementById('app-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'app-toast';
    let bg = 'bg-slate-800 text-white border-slate-700';
    let icon = 'info';

    if (type === 'success') {
      bg = 'bg-emerald-600 text-white border-emerald-500';
      icon = 'check-circle';
    } else if (type === 'error') {
      bg = 'bg-red-600 text-white border-red-500';
      icon = 'alert-circle';
    } else if (type === 'warning') {
      bg = 'bg-amber-600 text-white border-amber-500';
      icon = 'alert-triangle';
    }

    toast.className = `fixed bottom-20 lg:bottom-6 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-semibold ${bg} transition-all duration-300 transform translate-y-4 opacity-0`;
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    initLucide();

    setTimeout(() => {
      toast.classList.remove('translate-y-4', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
})();
