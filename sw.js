// ============ SERVICE WORKER PWA ============
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW enregistré:', reg))
            .catch(err => console.log('Erreur SW:', err));
    });
}

// ============ INSTALLATION PWA ============
(function setupPWA() {
    let deferredPrompt;
    const installBanner = document.getElementById('installBanner');
    const installBtn = document.getElementById('installBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBanner) installBanner.classList.add('show');
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted' && installBanner) {
                    installBanner.classList.remove('show');
                }
                deferredPrompt = null;
            }
        });
    }
})();

// ============ CONFIGURATION SUPABASE ============
const MY_SUPABASE_URL = 'https://emcsigvlopntwbfkkjkh.supabase.co';
const MY_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtY3NpZ3Zsb3BudHdiZmtramtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODE5MTgsImV4cCI6MjA5NDQ1NzkxOH0.YwYoV-azL3WEFtHoh4yoF7xTLrOwZILKCzJrGPsCs6I';

const supabaseClient = window.supabase.createClient(MY_SUPABASE_URL, MY_SUPABASE_ANON_KEY);

let currentUserId = null;
let carouselInterval = null;
let currentCarouselIndex = 0;
let carouselProducts = [];

// ============ SESSION & PROFIL ============
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUserId = session.user.id;
        const { data: buyer } = await supabaseClient.from('buyers').select('full_name').eq('id', currentUserId).single();
        return buyer?.full_name || null;
    }
    return null;
}

async function showWelcome() {
    const userName = await checkSession();
    const titleEl = document.getElementById('welcomeTitle');
    const textEl = document.getElementById('welcomeText');
    
    if (userName) {
        titleEl.textContent = `Bonjour ${userName} 👋`;
        textEl.textContent = 'Content de vous revoir sur Megane Market. Découvrez les nouveautés du moment.';
    } else {
        titleEl.textContent = 'Bienvenue sur Megane Market';
        textEl.textContent = 'Créez un compte ou connectez-vous pour profiter de toutes les fonctionnalités.';
    }
}

// ============ BANNIÈRE CARROUSEL (3 produits aléatoires, changement 5s) ============
async function loadCarouselProducts() {
    try {
        const { data: activeMarkets } = await supabaseClient
            .from('markets')
            .select('id')
            .eq('market_active', true);
        
        const activeMarketIds = activeMarkets.map(m => m.id);
        
        const { data: products } = await supabaseClient
            .from('products')
            .select('*, markets!inner(market_name, owner_name)')
            .eq('active', true)
            .in('user_id', activeMarketIds);
        
        if (!products || products.length === 0) return [];
        
        // Mélanger et prendre 3 produits aléatoires
        const shuffled = [...products];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, 3);
    } catch (err) {
        console.error('Erreur chargement carrousel:', err);
        return [];
    }
}

function renderCarousel(products) {
    const container = document.getElementById('carouselSlides');
    const dotsContainer = document.getElementById('carouselDots');
    if (!container || !dotsContainer) return;
    
    if (products.length === 0) {
        container.innerHTML = '<div class="carousel-slide"><div class="info"><h3>Aucun produit disponible</h3></div></div>';
        return;
    }
    
    container.innerHTML = products.map(product => `
        <div class="carousel-slide" data-id="${product.id}">
            ${product.images?.[0] ? `<img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.name)}">` : `<div class="image-placeholder"><i class="fas fa-image"></i></div>`}
            <div class="info">
                <div class="badge">✨ À la une</div>
                <h3>${escapeHtml(product.name)}</h3>
                <div class="price">${formatPrice(product.price)} FCFA</div>
                <div class="seller"><i class="fas fa-store"></i> ${escapeHtml(product.markets?.market_name || product.markets?.owner_name || 'Vendeur')}</div>
            </div>
        </div>
    `).join('');
    
    // Dots
    dotsContainer.innerHTML = products.map((_, i) => `
        <div class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>
    `).join('');
    
    // Événements clic sur slides
    document.querySelectorAll('.carousel-slide').forEach(slide => {
        slide.addEventListener('click', () => {
            const id = slide.dataset.id;
            if (id) window.location.href = `viewproduct.html?id=${id}`;
        });
    });
    
    // Événements dots
    document.querySelectorAll('.carousel-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const index = parseInt(dot.dataset.index);
            goToCarouselSlide(index);
        });
    });
}

function goToCarouselSlide(index) {
    const container = document.getElementById('carouselSlides');
    const dots = document.querySelectorAll('.carousel-dot');
    if (!container || !carouselProducts.length) return;
    
    currentCarouselIndex = Math.min(Math.max(0, index), carouselProducts.length - 1);
    container.style.transform = `translateX(-${currentCarouselIndex * 100}%)`;
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentCarouselIndex);
    });
}

function nextCarouselSlide() {
    if (!carouselProducts.length) return;
    const nextIndex = (currentCarouselIndex + 1) % carouselProducts.length;
    goToCarouselSlide(nextIndex);
}

function prevCarouselSlide() {
    if (!carouselProducts.length) return;
    const prevIndex = (currentCarouselIndex - 1 + carouselProducts.length) % carouselProducts.length;
    goToCarouselSlide(prevIndex);
}

function startCarouselAuto() {
    if (carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(() => {
        nextCarouselSlide();
    }, 5000); // 5 secondes pour le test
}

async function initCarouselBanner() {
    carouselProducts = await loadCarouselProducts();
    renderCarousel(carouselProducts);
    
    if (carouselProducts.length > 1) {
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');
        
        if (prevBtn) prevBtn.addEventListener('click', () => { prevCarouselSlide(); resetCarouselTimer(); });
        if (nextBtn) nextBtn.addEventListener('click', () => { nextCarouselSlide(); resetCarouselTimer(); });
        
        startCarouselAuto();
    }
}

function resetCarouselTimer() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
        startCarouselAuto();
    }
}

// ============ PRODUITS TENDANCES ============
async function loadTrendingProducts() {
    try {
        const { data: stats } = await supabaseClient
            .from('product_stats')
            .select('product_id, view_count, click_count')
            .gte('viewed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        
        const productScores = {};
        for (const stat of stats || []) {
            const score = (stat.view_count || 0) + (stat.click_count || 0) * 3;
            productScores[stat.product_id] = (productScores[stat.product_id] || 0) + score;
        }
        
        const topProductIds = Object.entries(productScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([id]) => id);
        
        if (topProductIds.length === 0) return [];
        
        const { data: products } = await supabaseClient
            .from('products')
            .select('*')
            .in('id', topProductIds)
            .eq('active', true);
        
        return products || [];
    } catch (err) {
        console.error('Erreur chargement tendances:', err);
        return [];
    }
}

function renderTrendingCarousel(products) {
    const track = document.getElementById('trendingTrack');
    if (!track) return;
    
    if (products.length === 0) {
        track.innerHTML = '<div class="empty-state">Aucun produit tendance pour le moment</div>';
        return;
    }
    
    track.innerHTML = products.map(product => `
        <div class="trending-item" data-id="${product.id}">
            ${product.images?.[0] ? `<img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.name)}">` : `<div class="image-placeholder"><i class="fas fa-image"></i></div>`}
            <div class="info">
                <div class="name">${escapeHtml(product.name)}</div>
                <div class="price">${formatPrice(product.price)} FCFA</div>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.trending-item').forEach(item => {
        item.addEventListener('click', () => {
            window.location.href = `viewproduct.html?id=${item.dataset.id}`;
        });
    });
}

// ============ NOUVEAUX MARCHÉS ============
async function loadNewMarkets() {
    try {
        const { data } = await supabaseClient
            .from('markets')
            .select('id, market_name, owner_name, city, avatar_url')
            .eq('market_active', true)
            .order('created_at', { ascending: false })
            .limit(6);
        return data || [];
    } catch (err) {
        console.error('Erreur chargement marchés:', err);
        return [];
    }
}

function renderMarkets(markets) {
    const grid = document.getElementById('marketsGrid');
    if (!grid) return;
    
    if (markets.length === 0) {
        grid.innerHTML = '<div class="empty-state">Aucun nouveau marché</div>';
        return;
    }
    
    grid.innerHTML = markets.map(market => `
        <div class="market-card" data-id="${market.id}">
            <i class="fas fa-store"></i>
            <h4>${escapeHtml(market.market_name || market.owner_name || 'Marché')}</h4>
            <p>${escapeHtml(market.city || 'Localisation')}</p>
        </div>
    `).join('');
    
    document.querySelectorAll('.market-card').forEach(card => {
        card.addEventListener('click', () => {
            window.location.href = `vendeur.html?id=${card.dataset.id}`;
        });
    });
}

// ============ COUP DE CŒUR ============
async function loadRandomFeaturedProduct() {
    try {
        const { data: activeMarkets } = await supabaseClient
            .from('markets')
            .select('id')
            .eq('market_active', true);
        
        const activeMarketIds = activeMarkets.map(m => m.id);
        
        const { data: products } = await supabaseClient
            .from('products')
            .select('*, markets!inner(market_name, owner_name)')
            .eq('active', true)
            .in('user_id', activeMarketIds);
        
        if (!products || products.length === 0) return null;
        
        const randomIndex = Math.floor(Math.random() * products.length);
        return products[randomIndex];
    } catch (err) {
        console.error('Erreur chargement coup de cœur:', err);
        return null;
    }
}

function renderFeaturedProduct(product) {
    const container = document.getElementById('featuredProduct');
    if (!container) return;
    
    if (!product) {
        container.innerHTML = '<div class="empty-state">Aucun produit pour le moment</div>';
        return;
    }
    
    const imageUrl = product.images?.[0] || null;
    const sellerName = product.markets?.market_name || product.markets?.owner_name || 'Vendeur';
    
    container.innerHTML = `
        ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}">` : `<div class="image-placeholder"><i class="fas fa-image"></i></div>`}
        <div class="info">
            <div class="badge">⭐ Coup de cœur</div>
            <h3>${escapeHtml(product.name)}</h3>
            <div class="price">${formatPrice(product.price)} FCFA</div>
            <div class="seller"><i class="fas fa-store"></i> ${escapeHtml(sellerName)}</div>
        </div>
    `;
    
    container.addEventListener('click', () => {
        window.location.href = `viewproduct.html?id=${product.id}`;
    });
}

// ============ FLUX ACTUALITÉS (lecture seule, pas de clic) ============
async function loadNews() {
    try {
        const { data: markets } = await supabaseClient
            .from('markets')
            .select('id, market_name, city, avatar_url, announcement_text, show_announcement, updated_at')
            .eq('market_active', true);
        
        if (!markets || markets.length === 0) {
            const newsFeed = document.getElementById('newsFeed');
            if (newsFeed) newsFeed.innerHTML = '<div class="empty-state">Aucune actualité</div>';
            return;
        }
        
        const activeMarketIds = markets.map(m => m.id);
        const { data: products } = await supabaseClient
            .from('products')
            .select('*, markets!inner(market_name, city)')
            .eq('active', true)
            .in('user_id', activeMarketIds)
            .order('created_at', { ascending: false })
            .limit(10);
        
        const news = [];
        
        for (const product of products || []) {
            news.push({
                type: 'product',
                title: product.name,
                subtitle: product.markets?.market_name || 'Nouveau produit',
                image: product.images?.[0]
            });
        }
        
        for (const market of markets) {
            if (market.show_announcement && market.announcement_text) {
                news.push({
                    type: 'announcement',
                    title: market.market_name,
                    subtitle: market.announcement_text.substring(0, 100),
                    image: market.avatar_url
                });
            }
        }
        
        news.sort(() => Math.random() - 0.5);
        
        renderNewsReadOnly(news.slice(0, 10));
    } catch (err) {
        console.error('Erreur chargement actualités:', err);
    }
}

function renderNewsReadOnly(news) {
    const container = document.getElementById('newsFeed');
    if (!container) return;
    
    if (news.length === 0) {
        container.innerHTML = '<div class="empty-state">Aucune actualité pour le moment</div>';
        return;
    }
    
    container.innerHTML = news.map(item => `
        <div class="news-card readonly">
            ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">` : `<div class="image-placeholder"><i class="fas fa-${item.type === 'product' ? 'box' : 'bullhorn'}"></i></div>`}
            <div class="content">
                <div class="type">${item.type === 'product' ? '📦 Nouveau produit' : '📢 Annonce'}</div>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.subtitle)}</p>
            </div>
        </div>
    `).join('');
}

// ============ CARROUSEL TENDANCES NAVIGATION ============
function initTrendingCarousel() {
    const track = document.getElementById('trendingTrack');
    const prevBtn = document.getElementById('trendingPrev');
    const nextBtn = document.getElementById('trendingNext');
    
    if (!track || !prevBtn || !nextBtn) return;
    
    prevBtn.addEventListener('click', () => {
        track.scrollBy({ left: -200, behavior: 'smooth' });
    });
    
    nextBtn.addEventListener('click', () => {
        track.scrollBy({ left: 200, behavior: 'smooth' });
    });
}

// ============ UTILITAIRES ============
function formatPrice(price) {
    return new Intl.NumberFormat('fr-FR').format(price);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ INITIALISATION ============
async function init() {
    await showWelcome();
    await initCarouselBanner();
    
    const trendingProducts = await loadTrendingProducts();
    renderTrendingCarousel(trendingProducts);
    
    const newMarkets = await loadNewMarkets();
    renderMarkets(newMarkets);
    
    const featuredProduct = await loadRandomFeaturedProduct();
    renderFeaturedProduct(featuredProduct);
    
    await loadNews();
    
    initTrendingCarousel();
}

init();