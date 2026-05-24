// market-new.js - Version modifiée (plus de redirection automatique)
(function() {
    const SUPABASE_URL = 'https://emcsigvlopntwbfkkjkh.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY3NpZ3Zsb3BudHdiZmtramtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODE5MTgsImV4cCI6MjA5NDQ1NzkxOH0.YwYoV-azL3WEFtHoh4yoF7xTLrOwZILKCzJrGPsCs6I';

    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const mainContent = document.getElementById('mainContent');
    const toastEl = document.getElementById('toast');
    const searchContainer = document.getElementById('searchContainer');
    const cartBadge = document.getElementById('cartBadge');
    const notifBadge = document.getElementById('notifBadge');

    let currentUserId = null;
    let currentUserVerified = false;
    let promoProducts = [];
    let allVendors = [];
    let allNews = [];
    let currentNewsFilter = 'all';
    let allProducts = [];
    let categoriesList = [];
    let currentCategoryFilter = 'all';
    let newProducts = [];
    let topProducts = [];
    let productBoosts = {};
    let allCarouselIntervals = {};
    
    // Section FAQ
    const faqCards = [
        { id: 1, icon: 'fa-search', question: 'Vous ne trouvez pas un produit ?', answer: 'Tapez le nom du produit dans la barre de recherche en haut de la page.' },
        { id: 2, icon: 'fa-comment', question: 'Comment contacter un vendeur ?', answer: 'Cliquez sur le bouton WhatsApp ou Appeler sur la fiche produit.' },
        { id: 3, icon: 'fa-truck', question: 'Les livraisons sont-elles gratuites ?', answer: 'Cela dépend du vendeur. Les frais de livraison sont indiqués sur chaque produit.' },
        { id: 4, icon: 'fa-undo-alt', question: 'Puis-je retourner un produit ?', answer: 'Oui, consultez la politique de retour du vendeur sur la fiche produit.' },
        { id: 5, icon: 'fa-user-plus', question: 'Comment créer un compte ?', answer: 'Cliquez sur "Mon profil" puis "Créer un compte" et suivez les étapes.' },
        { id: 6, icon: 'fa-shield-alt', question: 'Les paiements sont-ils sécurisés ?', answer: 'Les échanges se font directement avec les vendeurs via WhatsApp. Megane Market ne stocke aucune donnée bancaire.' }
    ];
    
    let infiniteProductsList = [];
    let infiniteCurrentOffset = 0;
    let infiniteIsLoading = false;
    let infiniteHasMoreData = true;
    let infiniteObserver = null;
    
    let infoCards = [
        { id: 1, type: 'green', icon: 'fa-shield-alt', title: 'Sécurité et confiance', message: 'Megane Market protège vos données et vos échanges. Toutes les transactions sont sécurisées et vos informations personnelles ne sont jamais partagées.', footer: 'Merci de comprendre les messages' },
        { id: 2, type: 'orange', icon: 'fa-exclamation-triangle', title: 'Méfiez-vous des arnaques', message: 'Ne partagez jamais vos codes confidentiels. Les vendeurs officiels Megane Market ne vous demanderont jamais votre mot de passe ou vos identifiants bancaires.', footer: 'Merci de comprendre les messages' },
        { id: 3, type: 'red', icon: 'fa-sync-alt', title: 'Nouveautés à venir', message: 'Megane Market prépare de nouvelles fonctionnalités : suivi de commande en temps réel, messagerie instantanée et programme de fidélité. Restez connectés !', footer: 'Merci de comprendre les messages' }
    ];
    
    const extraInfoCards = [
        { id: 1, icon: 'fa-lock', title: 'Vos données sont protégées', message: 'Megane Market ne partage jamais vos informations personnelles. Vos échanges sont sécurisés.', buttons: [] },
        { id: 2, icon: 'fa-share-alt', title: 'Partagez vos trouvailles', message: 'Partagez vos produits préférés avec vos amis sur WhatsApp, Facebook ou Messenger.', buttons: [
            { text: 'WhatsApp', action: 'share', platform: 'whatsapp', color: 'green' },
            { text: 'Facebook', action: 'share', platform: 'facebook', color: 'blue' },
            { text: 'Copier le lien', action: 'copy', color: 'green' }
        ] },
        { id: 3, icon: 'fa-link', title: 'Liens rapides', message: 'Accédez directement aux pages importantes de Megane Market.', buttons: [
            { text: 'Aide', action: 'link', url: 'aide.html', color: 'blue' },
            { text: 'CGU', action: 'link', url: 'cgu.html', color: 'green' },
            { text: 'Contact', action: 'link', url: 'contact.html', color: 'blue' }
        ] }
    ];
    
    let currentInfoIndex = 0;
    let infoCarouselInterval = null;
    const cardColors = ['color-green', 'color-orange', 'color-red', 'color-blue', 'color-purple', 'color-yellow'];

    function getRandomColor() { return cardColors[Math.floor(Math.random() * cardColors.length)]; }

    function showToast(message, type = 'info') {
        toastEl.textContent = message;
        toastEl.className = `toast ${type} show`;
        setTimeout(() => toastEl.classList.remove('show'), 3000);
    }

    // NOUVELLE FONCTION : Vérifie la session sans rediriger
    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            currentUserId = null;
            currentUserVerified = false;
            return false;
        }
        currentUserId = session.user.id;
        const { data: verifData } = await supabase
            .from('email_verifications')
            .select('is_verified')
            .eq('user_id', currentUserId)
            .single();
        currentUserVerified = verifData?.is_verified === true;
        return true;
    }

    searchContainer.addEventListener('click', () => { window.location.href = 'search.html'; });

    async function loadCartCount() {
        if (!currentUserId) { cartBadge.style.display = 'none'; return; }
        const { data, error } = await supabase.from('cart').select('id', { count: 'exact', head: true }).eq('user_id', currentUserId);
        if (!error && data !== null) {
            const count = data.length || 0;
            cartBadge.style.display = count > 0 ? 'flex' : 'none';
            if (count > 0) cartBadge.textContent = count;
        }
    }

    async function loadNotificationsCount() { if (notifBadge) notifBadge.style.display = 'none'; }

    async function loadProductBoosts() {
        const { data } = await supabase.from('product_boosts').select('product_id, discount_percent').eq('is_active', true);
        productBoosts = {};
        for (const boost of data || []) { if (boost.discount_percent > 0) productBoosts[boost.product_id] = boost.discount_percent; }
    }

    function formatPrice(price) { return new Intl.NumberFormat('fr-FR').format(price); }
    function escapeHtml(text) { if (!text) return ''; const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }

    function formatDate(dateStr) {
        const date = new Date(dateStr);
        const diffMs = Date.now() - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours} h`;
        return `Il y a ${diffDays} j`;
    }

    function filterNewsByDate(news, filter) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(today); startOfWeek.setDate(today.getDate() - today.getDay());
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        return news.filter(item => {
            const itemDate = new Date(item.date);
            if (filter === 'today') return itemDate >= today;
            if (filter === 'week') return itemDate >= startOfWeek;
            if (filter === 'month') return itemDate >= startOfMonth;
            return true;
        });
    }

    async function loadNews() {
        const news = [];
        const { data: markets } = await supabase.from('markets').select('id, market_name, owner_name, city, avatar_url, announcement_text, show_announcement, updated_at').eq('market_active', true);
        if (markets) {
            for (const market of markets) {
                if (market.show_announcement && market.announcement_text) {
                    news.push({ id: `announcement_${market.id}_${market.updated_at}`, type: 'announcement', typeLabel: 'Annonce', typeIcon: 'fa-bullhorn', marketId: market.id, marketName: market.market_name || market.owner_name, marketCity: market.city || '', marketAvatar: market.avatar_url, message: market.announcement_text, date: market.updated_at });
                }
            }
        }
        const twoDaysAgo = new Date(); twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const { data: newProductsData } = await supabase.from('products').select('id, name, user_id, created_at, images').eq('active', true).gte('created_at', twoDaysAgo.toISOString());
        if (newProductsData) {
            for (const product of newProductsData) {
                const { data: market } = await supabase.from('markets').select('market_name, owner_name, city, avatar_url').eq('id', product.user_id).single();
                news.push({ id: `newproduct_${product.id}`, type: 'newproduct', typeLabel: 'Nouveau produit', typeIcon: 'fa-plus-circle', marketId: product.user_id, marketName: market?.market_name || market?.owner_name || 'Vendeur', marketCity: market?.city || '', marketAvatar: market?.avatar_url, message: `a ajouté le produit`, productId: product.id, productName: product.name, productImage: product.images?.[0] || null, date: product.created_at });
            }
        }
        const { data: disabledProducts } = await supabase.from('products').select('id, name, user_id, updated_at, images').eq('active', false).gte('updated_at', twoDaysAgo.toISOString());
        if (disabledProducts) {
            for (const product of disabledProducts) {
                const { data: market } = await supabase.from('markets').select('market_name, owner_name, city, avatar_url').eq('id', product.user_id).single();
                news.push({ id: `disabled_${product.id}`, type: 'disabled', typeLabel: 'Produit retiré', typeIcon: 'fa-eye-slash', marketId: product.user_id, marketName: market?.market_name || market?.owner_name || 'Vendeur', marketCity: market?.city || '', marketAvatar: market?.avatar_url, message: `a retiré le produit`, productId: product.id, productName: product.name, productImage: product.images?.[0] || null, date: product.updated_at });
            }
        }
        news.sort((a, b) => new Date(b.date) - new Date(a.date));
        return news;
    }

    async function loadAllProducts() { const { data: products } = await supabase.from('products').select('*').eq('active', true); allProducts = products || []; }

    async function loadNewProducts() {
        const { data: products } = await supabase.from('products').select('*').eq('active', true).order('created_at', { ascending: false }).limit(10);
        if (!products || products.length === 0) return [];
        const formatted = [];
        for (const product of products) {
            let marketName = 'Vendeur';
            if (product.user_id) {
                const { data: market } = await supabase.from('markets').select('market_name, owner_name').eq('id', product.user_id).single();
                marketName = market?.market_name || market?.owner_name || 'Vendeur';
            }
            formatted.push({ id: product.id, name: product.name, price: product.price, images: product.images || [], market_name: marketName, created_at: product.created_at });
        }
        return formatted;
    }

    async function loadTopProducts() {
        const { data: stats } = await supabase.from('product_stats').select('product_id, view_count');
        const viewCounts = {};
        for (const stat of stats || []) { viewCounts[stat.product_id] = (viewCounts[stat.product_id] || 0) + (stat.view_count || 0); }
        const sortedProductIds = Object.entries(viewCounts).filter(([_, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
        if (sortedProductIds.length === 0) return [];
        const { data: products } = await supabase.from('products').select('*').in('id', sortedProductIds).eq('active', true);
        if (!products) return [];
        const formatted = [];
        for (const product of products) {
            let marketName = 'Vendeur';
            if (product.user_id) {
                const { data: market } = await supabase.from('markets').select('market_name, owner_name').eq('id', product.user_id).single();
                marketName = market?.market_name || market?.owner_name || 'Vendeur';
            }
            formatted.push({ id: product.id, name: product.name, price: product.price, images: product.images || [], market_name: marketName, views: viewCounts[product.id] || 0 });
        }
        return formatted;
    }

    async function loadCategories() {
        await loadAllProducts();
        const categoriesMap = new Map();
        for (const product of allProducts) {
            if (product.category && product.category.trim()) { categoriesMap.set(product.category.trim(), (categoriesMap.get(product.category.trim()) || 0) + 1); }
        }
        const iconMap = { 'Vêtements': 'fa-tshirt', 'Chaussures': 'fa-shoe-prints', 'Électronique': 'fa-mobile-alt', 'Accessoires': 'fa-shopping-bag', 'Maison': 'fa-home', 'Beauté': 'fa-smile', 'Sport': 'fa-futbol', 'Livres': 'fa-book', 'Alimentation': 'fa-apple-alt', 'Autre': 'fa-tag' };
        categoriesList = Array.from(categoriesMap.entries()).map(([name, count]) => ({ name: name, count: count, icon: iconMap[name] || 'fa-tag' })).sort((a, b) => b.count - a.count);
    }

    async function loadPromoProducts() {
        const { data: boosts } = await supabase.from('product_boosts').select('*, products!inner(*)').eq('is_active', true).eq('products.active', true);
        if (!boosts || boosts.length === 0) return [];
        const productsWithBoost = [];
        for (const boost of boosts) {
            const product = boost.products;
            const { data: market } = await supabase.from('markets').select('market_name, owner_name, city').eq('id', product.user_id).single();
            productsWithBoost.push({ ...product, images: product.images || [], boost: { discount_percent: boost.discount_percent, boost_type: boost.boost_type, title: boost.title, description: boost.description, end_date: boost.end_date }, market_name: market?.market_name || market?.owner_name || 'Vendeur', market_city: market?.city || '' });
        }
        return productsWithBoost;
    }

    async function loadVendors() {
        const { data: markets } = await supabase.from('markets').select('id, market_name, owner_name, city, phone, avatar_url').eq('market_active', true).order('created_at', { ascending: false });
        if (!markets) return [];
        const vendorsWithCount = [];
        for (const market of markets) {
            const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('user_id', market.id).eq('active', true);
            vendorsWithCount.push({ ...market, products_count: error ? 0 : count || 0 });
        }
        return vendorsWithCount;
    }

    async function loadInfiniteProducts() {
        const { data: products } = await supabase.from('products').select('*').eq('active', true).order('created_at', { ascending: false });
        return products || [];
    }

    function initProductCarousel(container, images, productId) {
        if (!container || !images || images.length <= 1) return;
        const imgElement = container.querySelector('.carousel-img');
        const prevBtn = container.querySelector('.carousel-nav-prev');
        const nextBtn = container.querySelector('.carousel-nav-next');
        const dotsContainer = container.querySelector('.carousel-dots-container');
        if (!imgElement) return;
        let currentIndex = 0;
        imgElement.src = images[0];
        imgElement.classList.add('active');
        if (dotsContainer) {
            dotsContainer.innerHTML = '';
            images.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
                dot.addEventListener('click', (e) => { e.stopPropagation(); goToSlide(i); });
                dotsContainer.appendChild(dot);
            });
        }
        function goToSlide(index) {
            currentIndex = (index + images.length) % images.length;
            imgElement.src = images[currentIndex];
            if (dotsContainer) {
                const dots = dotsContainer.querySelectorAll('.carousel-dot');
                dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
            }
            resetInterval();
        }
        function nextSlide() { goToSlide(currentIndex + 1); }
        function prevSlide() { goToSlide(currentIndex - 1); }
        let interval = setInterval(nextSlide, 4000);
        function resetInterval() { clearInterval(interval); interval = setInterval(nextSlide, 4000); }
        if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevSlide(); });
        if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextSlide(); });
        allCarouselIntervals[productId] = interval;
        container.addEventListener('mouseenter', () => clearInterval(interval));
        container.addEventListener('mouseleave', () => { interval = setInterval(nextSlide, 4000); allCarouselIntervals[productId] = interval; });
    }

    function createProductCarouselHtml(images, productId) {
        if (!images || images.length === 0) return `<div class="product-carousel" data-product-id="${productId}"><div class="carousel-images-container"><img class="carousel-img active" src="" alt=""></div></div>`;
        if (images.length === 1) return `<div class="product-carousel" data-product-id="${productId}"><div class="carousel-images-container"><img class="carousel-img active" src="${escapeHtml(images[0])}" alt=""></div></div>`;
        return `<div class="product-carousel" data-product-id="${productId}"><div class="carousel-images-container"><img class="carousel-img active" src="${escapeHtml(images[0])}" alt=""></div><button class="carousel-nav-prev"><i class="fas fa-chevron-left"></i></button><button class="carousel-nav-next"><i class="fas fa-chevron-right"></i></button><div class="carousel-dots-container"></div></div>`;
    }

    function initAllCarousels() {
        document.querySelectorAll('.product-carousel').forEach(carousel => {
            const productId = carousel.getAttribute('data-product-id');
            if (!productId) return;
            let images = [];
            const product = [...promoProducts, ...newProducts, ...topProducts, ...infiniteProductsList].find(p => p.id == productId);
            if (product && product.images && product.images.length > 0) images = product.images;
            if (images.length > 1) initProductCarousel(carousel, images, productId);
        });
    }

    function renderPromoCarousel() {
        if (!promoProducts || promoProducts.length === 0) return '<div class="empty-state">Aucune offre promotionnelle pour le moment</div>';
        return `<div class="promo-carousel-container"><div class="promo-carousel-track" id="promoCarouselTrack">${promoProducts.map((product, idx) => { const images = product.images || []; const discount = product.boost.discount_percent; const newPrice = Math.round(product.price * (1 - discount / 100)); const marketName = product.market_name; const carouselHtml = createProductCarouselHtml(images, product.id); return `<div class="promo-card" data-product-id="${product.id}" data-carousel-idx="${idx}"><div class="promo-card-header"><div class="promo-card-image">${carouselHtml}</div><div class="promo-card-market"><h4>${escapeHtml(marketName)}</h4><p>${escapeHtml(product.market_city)}</p></div></div><div class="promo-card-body"><div class="product-name">${escapeHtml(product.name)}</div><div class="prices"><span class="original-price">${formatPrice(product.price)} FCFA</span><span class="promo-badge-large">-${discount}%</span><span class="promo-price">${formatPrice(newPrice)} FCFA</span></div></div><div class="promo-card-footer"><a href="viewproduct.html?id=${product.id}" class="promo-btn voir"><i class="fas fa-eye"></i> Voir</a><button class="promo-btn cart" data-id="${product.id}"><i class="fas fa-cart-plus"></i> Ajouter</button></div></div>`; }).join('')}</div><button class="promo-carousel-nav prev" id="promoPrev"><i class="fas fa-chevron-left"></i></button><button class="promo-carousel-nav next" id="promoNext"><i class="fas fa-chevron-right"></i></button><div class="promo-carousel-dots" id="promoDots"></div></div>`;
    }

    function initPromoCarousel() {
        const track = document.getElementById('promoCarouselTrack');
        const prevBtn = document.getElementById('promoPrev');
        const nextBtn = document.getElementById('promoNext');
        const dotsContainer = document.getElementById('promoDots');
        if (!track || !promoProducts.length) return;
        const totalSlides = promoProducts.length;
        dotsContainer.innerHTML = promoProducts.map((_, i) => `<div class="promo-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('');
        let currentIndex = 0;
        let interval = null;
        function goToSlide(index) { currentIndex = (index + totalSlides) % totalSlides; track.style.transform = `translateX(-${currentIndex * 100}%)`; document.querySelectorAll('.promo-dot').forEach((dot, i) => dot.classList.toggle('active', i === currentIndex)); }
        function nextSlide() { goToSlide(currentIndex + 1); resetTimer(); }
        function prevSlide() { goToSlide(currentIndex - 1); resetTimer(); }
        function resetTimer() { if (interval) clearInterval(interval); if (totalSlides > 1) interval = setInterval(nextSlide, 5000); }
        prevBtn.addEventListener('click', prevSlide); nextBtn.addEventListener('click', nextSlide);
        document.querySelectorAll('.promo-dot').forEach(dot => dot.addEventListener('click', () => { goToSlide(parseInt(dot.dataset.index)); resetTimer(); }));
        resetTimer();
        document.querySelectorAll('.promo-btn.cart').forEach(btn => btn.addEventListener('click', async (e) => { e.stopPropagation(); const productId = btn.getAttribute('data-id'); if (productId && currentUserId && currentUserVerified) await addToCart(productId); else { showToast('Connectez-vous pour ajouter au panier', 'error'); } }));
    }

    function renderInfoCards() {
        return `<div class="info-cards-section"><div class="info-cards-header"><h3><i class="fas fa-info-circle"></i> À savoir</h3></div><div class="info-cards-carousel"><div class="info-cards-track" id="infoCardsTrack">${infoCards.map(card => `<div class="info-card ${card.type}"><div class="info-card-header"><div class="info-card-icon"><i class="fas ${card.icon}"></i></div><div class="info-card-title"><h4>${escapeHtml(card.title)}</h4></div></div><div class="info-card-body"><div class="info-message">${escapeHtml(card.message)}</div></div><div class="info-card-footer"><div class="info-footer-text"><i class="fas fa-heart"></i> ${escapeHtml(card.footer)}</div></div></div>`).join('')}</div><button class="info-carousel-nav prev" id="infoPrev"><i class="fas fa-chevron-left"></i></button><button class="info-carousel-nav next" id="infoNext"><i class="fas fa-chevron-right"></i></button><div class="info-carousel-dots" id="infoDots"></div></div></div>`;
    }

    function initInfoCarousel() {
        const track = document.getElementById('infoCardsTrack');
        const prevBtn = document.getElementById('infoPrev');
        const nextBtn = document.getElementById('infoNext');
        const dotsContainer = document.getElementById('infoDots');
        if (!track || infoCards.length === 0) return;
        const totalSlides = infoCards.length;
        dotsContainer.innerHTML = infoCards.map((_, i) => `<div class="info-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>`).join('');
        let currentIndex = 0;
        let interval = null;
        function goToSlide(index) { currentIndex = (index + totalSlides) % totalSlides; track.style.transform = `translateX(-${currentIndex * 100}%)`; document.querySelectorAll('.info-dot').forEach((dot, i) => dot.classList.toggle('active', i === currentIndex)); }
        function nextSlide() { goToSlide(currentIndex + 1); resetTimer(); }
        function prevSlide() { goToSlide(currentIndex - 1); resetTimer(); }
        function resetTimer() { if (interval) clearInterval(interval); if (totalSlides > 1) interval = setInterval(nextSlide, 6000); }
        prevBtn.addEventListener('click', prevSlide); nextBtn.addEventListener('click', nextSlide);
        document.querySelectorAll('.info-dot').forEach(dot => dot.addEventListener('click', () => { goToSlide(parseInt(dot.dataset.index)); resetTimer(); }));
        resetTimer();
    }

    function renderCategoriesSection() {
        if (!categoriesList || categoriesList.length === 0) return `<div class="categories-section"><div class="categories-header"><h3><i class="fas fa-th-large"></i> Catégories populaires</h3></div><div class="empty-categories">Aucune catégorie disponible</div></div>`;
        return `<div class="categories-section"><div class="categories-header"><h3><i class="fas fa-th-large"></i> Catégories populaires</h3>${currentCategoryFilter !== 'all' ? '<button class="reset-filter-btn" id="resetCategoryFilter">Effacer le filtre</button>' : ''}</div><div class="categories-scroll"><div class="categories-track" id="categoriesTrack"><div class="category-card ${currentCategoryFilter === 'all' ? 'active' : ''}" data-category="all"><div class="category-icon"><i class="fas fa-star"></i></div><div class="category-name">Tous</div><div class="category-count">${allProducts.length}</div></div>${categoriesList.map(cat => `<div class="category-card ${currentCategoryFilter === cat.name ? 'active' : ''}" data-category="${escapeHtml(cat.name)}"><div class="category-icon"><i class="fas ${cat.icon}"></i></div><div class="category-name">${escapeHtml(cat.name)}</div><div class="category-count">${cat.count}</div></div>`).join('')}</div></div></div>`;
    }

    function initCategoriesFilter() {
        document.querySelectorAll('.category-card').forEach(card => card.addEventListener('click', () => { const category = card.getAttribute('data-category'); if (category === 'all') window.location.reload(); else window.location.href = `market.html?category=${encodeURIComponent(category)}`; }));
        const resetBtn = document.getElementById('resetCategoryFilter'); if (resetBtn) resetBtn.addEventListener('click', () => window.location.reload());
    }

    function renderNewProductsSection() {
        if (!newProducts || newProducts.length === 0) return `<div class="new-products-section"><div class="new-products-header"><h3><i class="fas fa-clock"></i> Nouveautés de la semaine</h3></div><div class="empty-state">Aucun nouveau produit cette semaine</div></div>`;
        return `<div class="new-products-section"><div class="new-products-header"><h3><i class="fas fa-clock"></i> Nouveautés de la semaine</h3></div><div class="new-products-scroll"><div class="new-products-track" id="newProductsTrack">${newProducts.map(product => { const randomColor = getRandomColor(); const discount = productBoosts[product.id] || 0; const originalPrice = product.price; const discountedPrice = discount > 0 ? Math.round(originalPrice * (1 - discount / 100)) : originalPrice; const carouselHtml = createProductCarouselHtml(product.images, product.id); return `<div class="new-product-card ${randomColor}" data-product-id="${product.id}">${carouselHtml}${discount > 0 ? `<div class="new-product-badge promo">-${discount}%</div>` : '<div class="new-product-badge">Nouveau</div>'}<div class="new-product-name">${escapeHtml(product.name)}</div><div class="new-product-market"><i class="fas fa-store"></i> ${escapeHtml(product.market_name)}</div><div class="new-product-price">${discount > 0 ? `<span class="original-price">${formatPrice(originalPrice)} FCFA</span><span class="discounted-price">${formatPrice(discountedPrice)} FCFA</span>` : `<span>${formatPrice(originalPrice)} FCFA</span>`}</div><div class="new-product-buttons"><a href="viewproduct.html?id=${product.id}" class="new-product-btn voir"><i class="fas fa-eye"></i> Voir</a><button class="new-product-btn cart" data-id="${product.id}"><i class="fas fa-cart-plus"></i> Ajouter</button></div></div>`; }).join('')}</div></div></div>`;
    }

    function initNewProductsButtons() {
        document.querySelectorAll('.new-product-btn.cart').forEach(btn => btn.addEventListener('click', async (e) => { e.stopPropagation(); const productId = btn.getAttribute('data-id'); if (productId && currentUserId && currentUserVerified) await addToCart(productId); else { showToast('Connectez-vous pour ajouter au panier', 'error'); } }));
    }

    function renderTopProductsSection() {
        if (!topProducts || topProducts.length === 0) return `<div class="top-products-section"><div class="top-products-header"><h3><i class="fas fa-chart-line"></i> Produits les plus vus</h3></div><div class="empty-state">Aucune donnée pour le moment</div></div>`;
        return `<div class="top-products-section"><div class="top-products-header"><h3><i class="fas fa-chart-line"></i> Produits les plus vus</h3></div><div class="top-products-grid" id="topProductsGrid">${topProducts.map(product => { const discount = productBoosts[product.id] || 0; const originalPrice = product.price; const discountedPrice = discount > 0 ? Math.round(originalPrice * (1 - discount / 100)) : originalPrice; const carouselHtml = createProductCarouselHtml(product.images, product.id); return `<div class="top-product-card" data-product-id="${product.id}">${carouselHtml}<div class="top-product-info"><div class="top-product-name">${escapeHtml(product.name)}</div><div class="top-product-market"><i class="fas fa-store"></i> ${escapeHtml(product.market_name)}</div><div class="top-product-price">${discount > 0 ? `<span class="original-price">${formatPrice(originalPrice)} FCFA</span><span class="discounted-price">${formatPrice(discountedPrice)} FCFA</span><span class="promo-badge-small">-${discount}%</span>` : `<span>${formatPrice(originalPrice)} FCFA</span>`}</div><div class="top-product-views"><i class="fas fa-eye"></i> ${product.views} vues</div><div class="top-product-buttons"><a href="viewproduct.html?id=${product.id}" class="top-product-btn voir"><i class="fas fa-eye"></i> Voir</a><button class="top-product-btn cart" data-id="${product.id}"><i class="fas fa-cart-plus"></i> Ajouter</button></div></div></div>`; }).join('')}</div></div>`;
    }

    function initTopProductsButtons() {
        document.querySelectorAll('.top-product-btn.cart').forEach(btn => btn.addEventListener('click', async (e) => { e.stopPropagation(); const productId = btn.getAttribute('data-id'); if (productId && currentUserId && currentUserVerified) await addToCart(productId); else { showToast('Connectez-vous pour ajouter au panier', 'error'); } }));
    }

    function renderNewsSection(news, filter) {
        const filteredNews = filterNewsByDate(news, filter);
        if (!filteredNews || filteredNews.length === 0) return `<div class="news-section"><div class="news-header"><h3><i class="fas fa-bell"></i> Actualités des vendeurs</h3><div class="news-filters"><button class="filter-date-btn ${filter === 'all' ? 'active' : ''}" data-filter="all">Tout</button><button class="filter-date-btn ${filter === 'today' ? 'active' : ''}" data-filter="today">Aujourd'hui</button><button class="filter-date-btn ${filter === 'week' ? 'active' : ''}" data-filter="week">Cette semaine</button><button class="filter-date-btn ${filter === 'month' ? 'active' : ''}" data-filter="month">Ce mois</button></div></div><div class="empty-news">Aucune actualité pour le moment</div></div>`;
        return `<div class="news-section"><div class="news-header"><h3><i class="fas fa-bell"></i> Actualités des vendeurs</h3><div class="news-filters"><button class="filter-date-btn ${filter === 'all' ? 'active' : ''}" data-filter="all">Tout</button><button class="filter-date-btn ${filter === 'today' ? 'active' : ''}" data-filter="today">Aujourd'hui</button><button class="filter-date-btn ${filter === 'week' ? 'active' : ''}" data-filter="week">Cette semaine</button><button class="filter-date-btn ${filter === 'month' ? 'active' : ''}" data-filter="month">Ce mois</button></div></div><div class="news-scroll"><div class="news-track" id="newsTrack">${filteredNews.map(item => { let typeClass = '', typeIcon = ''; switch(item.type) { case 'announcement': typeClass = 'announcement'; typeIcon = 'fa-bullhorn'; break; case 'newproduct': typeClass = 'product'; typeIcon = 'fa-plus-circle'; break; case 'disabled': typeClass = 'delete'; typeIcon = 'fa-eye-slash'; break; default: typeClass = 'update'; typeIcon = 'fa-edit'; } let messageHtml = (item.type === 'newproduct' || item.type === 'disabled') ? `<div class="news-message">${escapeHtml(item.message)} <a href="viewproduct.html?id=${item.productId}" class="product-name-link">${escapeHtml(item.productName)}</a></div>` : `<div class="news-message">${escapeHtml(item.message)}</div>`; return `<div class="news-card"><div class="news-card-header">${item.marketAvatar ? `<img src="${escapeHtml(item.marketAvatar)}" class="news-card-avatar" onerror="this.src=''">` : `<div class="news-card-avatar-placeholder"><i class="fas fa-store"></i></div>`}<div class="news-card-market-info"><div class="news-card-market-name">${escapeHtml(item.marketName)}</div><div class="news-card-market-city">${escapeHtml(item.marketCity)}</div></div></div><div class="news-card-body"><div class="news-type-badge ${typeClass}"><i class="fas ${typeIcon}"></i> ${item.typeLabel}</div>${messageHtml}</div><div class="news-card-footer"><i class="fas fa-clock"></i> ${formatDate(item.date)}</div></div>`; }).join('')}</div></div></div>`;
    }

    function initNewsFilters() { document.querySelectorAll('.filter-date-btn').forEach(btn => btn.addEventListener('click', () => { const filter = btn.getAttribute('data-filter'); currentNewsFilter = filter; updateNewsSection(); })); }
    async function updateNewsSection() { const newsSection = document.querySelector('.news-section'); if (newsSection) { const newHtml = renderNewsSection(allNews, currentNewsFilter); newsSection.outerHTML = newHtml; initNewsFilters(); } }

    function renderVendorsSection(vendors) {
        if (!vendors || vendors.length === 0) return `<div class="vendors-section"><div class="vendors-header"><h3><i class="fas fa-store"></i> Tous les vendeurs</h3></div><div class="empty-vendors">Aucun vendeur disponible pour le moment</div></div>`;
        return `<div class="vendors-section"><div class="vendors-header"><h3><i class="fas fa-store"></i> Tous les vendeurs</h3><div class="vendors-search"><i class="fas fa-search"></i><input type="text" id="vendorSearchInput" placeholder="Rechercher un vendeur..."></div></div><div class="vendors-scroll"><div class="vendors-track" id="vendorsTrack">${vendors.map(vendor => `<div class="vendor-card" data-id="${vendor.id}">${vendor.avatar_url ? `<img src="${escapeHtml(vendor.avatar_url)}" class="vendor-avatar" onerror="this.src=''">` : `<div class="vendor-avatar-placeholder"><i class="fas fa-store"></i></div>`}<div class="vendor-name">${escapeHtml(vendor.market_name || vendor.owner_name)}</div><div class="vendor-city"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(vendor.city || 'Localisation non précisée')}</div><div class="vendor-phone"><i class="fas fa-phone"></i> ${escapeHtml(vendor.phone || 'Non renseigné')}</div><button class="vendor-btn" data-id="${vendor.id}">Voir le marché</button></div>`).join('')}</div></div></div>`;
    }

    function initVendorsSection(vendors) {
        const searchInput = document.getElementById('vendorSearchInput'); const track = document.getElementById('vendorsTrack');
        if (!searchInput || !track) return;
        function filterVendors() { const term = searchInput.value.toLowerCase().trim(); const filtered = vendors.filter(v => (v.market_name || v.owner_name || '').toLowerCase().includes(term)); track.innerHTML = filtered.length === 0 ? '<div class="empty-vendors">Aucun vendeur trouvé</div>' : filtered.map(v => `<div class="vendor-card" data-id="${v.id}">${v.avatar_url ? `<img src="${escapeHtml(v.avatar_url)}" class="vendor-avatar">` : `<div class="vendor-avatar-placeholder"><i class="fas fa-store"></i></div>`}<div class="vendor-name">${escapeHtml(v.market_name || v.owner_name)}</div><div class="vendor-city"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(v.city || 'Localisation non précisée')}</div><div class="vendor-phone"><i class="fas fa-phone"></i> ${escapeHtml(v.phone || 'Non renseigné')}</div><button class="vendor-btn" data-id="${v.id}">Voir le marché</button></div>`).join(''); attachVendorEvents(); }
        function attachVendorEvents() { document.querySelectorAll('.vendor-btn').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); const id = btn.getAttribute('data-id'); if (id) window.location.href = `vendeur.html?id=${id}`; })); document.querySelectorAll('.vendor-card').forEach(card => card.addEventListener('click', (e) => { if (e.target.classList.contains('vendor-btn')) return; const id = card.getAttribute('data-id'); if (id) window.location.href = `vendeur.html?id=${id}`; })); }
        searchInput.addEventListener('input', filterVendors); attachVendorEvents();
    }

    function renderSearchBanner() { return `<div class="search-banner-section"><div class="search-banner-card"><div class="search-banner-icon"><i class="fas fa-search"></i></div><h3 class="search-banner-title">Vous cherchez quelque chose ?</h3><p class="search-banner-subtitle">Trouvez rapidement un produit, une marque ou un vendeur</p><button class="search-banner-btn" id="searchBannerBtn"><i class="fas fa-search"></i> Rechercher</button></div></div>`; }
    function initSearchBanner() { const btn = document.getElementById('searchBannerBtn'); if (btn) btn.addEventListener('click', () => window.location.href = 'search.html'); }

    function renderExtraInfoCards() { return `<div class="info-cards-grid-section"><div class="info-cards-header"><h3><i class="fas fa-info-circle"></i> Informations utiles</h3></div><div class="info-cards-grid" id="extraInfoGrid">${extraInfoCards.map(card => `<div class="info-card-nm" data-card-id="${card.id}"><div class="info-card-nm-icon"><i class="fas ${card.icon}"></i></div><div class="info-card-nm-title">${escapeHtml(card.title)}</div><div class="info-card-nm-message">${escapeHtml(card.message)}</div>${card.buttons && card.buttons.length > 0 ? `<div class="info-card-nm-buttons">${card.buttons.map(btn => `<button class="info-card-nm-btn ${btn.color}" data-action="${btn.action}" data-platform="${btn.platform || ''}" data-url="${btn.url || ''}"><i class="fas ${btn.action === 'share' ? 'fa-share-alt' : (btn.action === 'copy' ? 'fa-copy' : 'fa-link')}"></i> ${btn.text}</button>`).join('')}</div>` : ''}</div>`).join('')}</div></div>`; }
    function initExtraInfoCards() { document.querySelectorAll('.info-card-nm-btn').forEach(btn => btn.addEventListener('click', async (e) => { e.stopPropagation(); const action = btn.getAttribute('data-action'); const platform = btn.getAttribute('data-platform'); const url = btn.getAttribute('data-url'); const shareUrl = 'https://megane-market.online'; const shareText = 'Découvrez Megane Market - Votre marché de confiance !'; if (action === 'share') { if (platform === 'whatsapp') window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`, '_blank'); else if (platform === 'facebook') window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank'); } else if (action === 'copy') { try { await navigator.clipboard.writeText(shareUrl); showToast('Lien copié !', 'success'); } catch (err) { showToast('Erreur copie', 'error'); } } else if (action === 'link' && url) window.location.href = url; })); }

    async function addToCart(productId) {
        try {
            const { data: existing } = await supabase.from('cart').select('id, quantity').eq('user_id', currentUserId).eq('product_id', productId).maybeSingle();
            if (existing) { await supabase.from('cart').update({ quantity: existing.quantity + 1 }).eq('id', existing.id); showToast('Quantité augmentée', 'success'); }
            else { await supabase.from('cart').insert({ user_id: currentUserId, product_id: productId, quantity: 1 }); showToast('Produit ajouté au panier', 'success'); }
            await loadCartCount();
        } catch (err) { showToast('Erreur', 'error'); }
    }

    function renderInfiniteProduct(product) {
        const discount = productBoosts[product.id] || 0;
        const originalPrice = product.price;
        const discountedPrice = discount > 0 ? Math.round(originalPrice * (1 - discount / 100)) : originalPrice;
        const carouselHtml = createProductCarouselHtml(product.images, product.id);
        return `<div class="infinite-product-card" data-product-id="${product.id}">
            ${carouselHtml}
            <div class="product-info">
                <div class="product-name">${escapeHtml(product.name)}</div>
                <div class="product-price">${discount > 0 ? `<span class="original-price">${formatPrice(originalPrice)} FCFA</span><span class="discounted-price">${formatPrice(discountedPrice)} FCFA</span><span class="promo-badge-small">-${discount}%</span>` : `${formatPrice(originalPrice)} FCFA`}</div>
                <div class="product-buttons"><a href="viewproduct.html?id=${product.id}" class="infinite-product-btn voir"><i class="fas fa-eye"></i> Voir</a><button class="infinite-product-btn cart" data-id="${product.id}"><i class="fas fa-cart-plus"></i> Ajouter</button></div>
            </div>
        </div>`;
    }

    function attachInfiniteEvents() {
        document.querySelectorAll('.infinite-product-btn.cart').forEach(btn => btn.addEventListener('click', async (e) => { e.stopPropagation(); const id = btn.getAttribute('data-id'); if (id && currentUserId && currentUserVerified) await addToCart(id); else { showToast('Connectez-vous pour ajouter au panier', 'error'); } }));
        document.querySelectorAll('.infinite-product-card').forEach(card => card.addEventListener('click', (e) => { if (e.target.classList.contains('infinite-product-btn')) return; const id = card.getAttribute('data-id'); if (id) window.location.href = `viewproduct.html?id=${id}`; }));
    }

    async function loadMoreInfiniteProducts() {
        if (infiniteIsLoading || !infiniteHasMoreData) return;
        infiniteIsLoading = true;
        const trigger = document.getElementById('infiniteTrigger');
        if (trigger) trigger.style.display = 'flex';
        const start = infiniteCurrentOffset;
        const end = infiniteCurrentOffset + 10;
        const newProducts = infiniteProductsList.slice(start, end);
        if (newProducts.length === 0) { infiniteHasMoreData = false; if (trigger) trigger.style.display = 'none'; infiniteIsLoading = false; return; }
        const container = document.getElementById('infiniteProductsContainer');
        if (container) { newProducts.forEach(product => { container.insertAdjacentHTML('beforeend', renderInfiniteProduct(product)); }); }
        infiniteCurrentOffset = end;
        infiniteHasMoreData = end < infiniteProductsList.length;
        infiniteIsLoading = false;
        if (trigger) trigger.style.display = 'none';
        if (infiniteHasMoreData) {
            const lastCard = document.querySelector('#infiniteProductsContainer .infinite-product-card:last-child');
            if (lastCard && infiniteObserver) { infiniteObserver.unobserve(lastCard); infiniteObserver.observe(lastCard); }
        }
        attachInfiniteEvents();
        initAllCarousels();
    }

    function initInfiniteObserver() {
        if (infiniteObserver) infiniteObserver.disconnect();
        infiniteObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting && !infiniteIsLoading && infiniteHasMoreData) loadMoreInfiniteProducts(); }); }, { threshold: 0.1, rootMargin: '200px' });
        const trigger = document.getElementById('infiniteTrigger'); if (trigger) infiniteObserver.observe(trigger);
        const lastCard = document.querySelector('#infiniteProductsContainer .infinite-product-card:last-child'); if (lastCard) infiniteObserver.observe(lastCard);
    }

    function renderFaqSection() {
        return `<div class="faq-section"><div class="faq-header"><h3><i class="fas fa-question-circle"></i> Foire aux questions</h3></div><div class="faq-scroll"><div class="faq-track" id="faqTrack">${faqCards.map(faq => `<div class="faq-card"><div class="faq-icon"><i class="fas ${faq.icon}"></i></div><div class="faq-content"><div class="faq-question">${escapeHtml(faq.question)}</div><div class="faq-answer">${escapeHtml(faq.answer)}</div></div></div>`).join('')}</div></div></div>`;
    }

    function saveToCache() {
        const mainContentEl = document.getElementById('mainContent');
        if (mainContentEl && mainContentEl.innerHTML && !mainContentEl.innerHTML.includes('loader')) {
            sessionStorage.setItem('market_products_cache', mainContentEl.innerHTML);
            sessionStorage.setItem('market_cache_timestamp', Date.now().toString());
        }
    }

    window.initAfterCache = function() {
        initAllCarousels();
        attachInfiniteEvents();
        if (typeof initInfiniteObserver === 'function') initInfiniteObserver();
        if (typeof initPromoCarousel === 'function') initPromoCarousel();
        if (typeof initInfoCarousel === 'function') initInfoCarousel();
        if (typeof initCategoriesFilter === 'function') initCategoriesFilter();
        if (typeof initNewProductsButtons === 'function') initNewProductsButtons();
        if (typeof initNewsFilters === 'function') initNewsFilters();
        if (typeof initVendorsSection === 'function') initVendorsSection(allVendors);
        if (typeof initTopProductsButtons === 'function') initTopProductsButtons();
        if (typeof initSearchBanner === 'function') initSearchBanner();
        if (typeof initExtraInfoCards === 'function') initExtraInfoCards();
    };

    async function renderPage() {
        const cachedHTML = sessionStorage.getItem('market_products_cache');
        const cachedTimestamp = sessionStorage.getItem('market_cache_timestamp');
        const now = Date.now();
        
        if (cachedHTML && cachedTimestamp && (now - parseInt(cachedTimestamp)) < 300000) {
            mainContent.innerHTML = cachedHTML;
            setTimeout(() => { if (typeof window.initAfterCache === 'function') window.initAfterCache(); }, 100);
            return;
        }
        
        mainContent.innerHTML = '<div class="loader"><div class="spinner"></div><p>Chargement...</p></div>';
        await loadProductBoosts();
        await loadCategories();
        promoProducts = await loadPromoProducts();
        allVendors = await loadVendors();
        allNews = await loadNews();
        newProducts = await loadNewProducts();
        topProducts = await loadTopProducts();
        infiniteProductsList = await loadInfiniteProducts();
        infiniteCurrentOffset = 10;
        infiniteHasMoreData = infiniteProductsList.length > 10;
        const firstBatch = infiniteProductsList.slice(0, 10);
        
        mainContent.innerHTML = `
            <section class="promo-carousel-section"><div class="section-header"><h3><i class="fas fa-fire"></i> Offres du moment</h3></div>${renderPromoCarousel()}</section>
            ${renderInfoCards()}
            ${renderCategoriesSection()}
            ${renderNewProductsSection()}
            ${renderNewsSection(allNews, currentNewsFilter)}
            ${renderVendorsSection(allVendors)}
            ${renderTopProductsSection()}
            ${renderFaqSection()}
            ${renderSearchBanner()}
            ${renderExtraInfoCards()}
            <div class="infinite-products-section"><div class="section-header"><h3><i class="fas fa-infinity"></i> Découvrez encore plus</h3></div><div id="infiniteProductsContainer" class="infinite-products-grid">${firstBatch.map(p => renderInfiniteProduct(p)).join('')}</div><div id="infiniteTrigger" class="loading-trigger" style="display:none;"><div class="loading-spinner-small"></div><p>Chargement...</p></div></div>
        `;
        
        initPromoCarousel();
        initInfoCarousel();
        initCategoriesFilter();
        initNewProductsButtons();
        initNewsFilters();
        initVendorsSection(allVendors);
        initTopProductsButtons();
        initSearchBanner();
        initExtraInfoCards();
        attachInfiniteEvents();
        initInfiniteObserver();
        initAllCarousels();
        await loadCartCount();
        await loadNotificationsCount();
        saveToCache();
    }

    async function init() {
        await checkSession();
        await renderPage();
    }
    init();
})();