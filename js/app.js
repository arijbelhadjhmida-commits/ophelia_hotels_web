/* ═══════════════════════════════════════════════════════════════
   APP.JS — Routeur SPA et logique de toutes les pages
   Équivalent de lib/screens/main_wrapper.dart + toutes les pages

   Ce fichier est chargé en dernier et orchestre toute l'application.
   Il gère :
   - Le routeur (navigation entre les pages)
   - L'affichage/masquage de la navbar
   - La logique de chaque page (Home, Hotel, Booking, Payment, etc.)
   ═══════════════════════════════════════════════════════════════ */

// ─── ÉTAT DE L'APPLICATION ─────────────────────────────────────
// Données partagées entre les pages (comme les variables de _MainWrapperState)
// Cet objet est mémorisé EN MÉMOIRE seulement (perdu au refresh F5)
const AppState = {
  currentHotel:   null,    // HotelModel sélectionné (depuis HOTELS dans config.js)
  currentService: null,    // ServiceModel sélectionné (chambre, spa, restaurant...)
  paymentData:    null,    // Données du formulaire de paiement (en cours)
  activeFilter:   'all',   // Filtre de catégorie sur la page hôtel ('all','room',etc.)
};

// ─── ROUTEUR ──────────────────────────────────────────────────
// Contrôle quelle "page" (section) est visible
// Pas de framework router : on cache/affiche des div manuellement
const Router = {
  // Liste des pages qui masquent la navbar (immersives, plein écran)
  // Pour ces pages, l'utilisateur sort de l'expérience "site web"
  FULLSCREEN_PAGES: ['smartroom', 'checkin', 'checkout', 'quiz'],

  /**
   * Navigue vers une page
   * @param {string} page - Nom de la page : 'home','hotel','signin','signup', etc.
   */
  go(page) {
    // ÉTAPE 1 : Cacher TOUTES les pages (toutes ont la classe "page")
    // querySelectorAll retourne toutes les correspondances
    document.querySelectorAll('.page').forEach(el => {
      el.style.display = 'none';
    });

    // ÉTAPE 2 : Afficher la page cible
    // Convention de nommage : id="page-XXX" pour la page XXX
    // Template literal `page-${page}` = chaîne avec variable interpolée
    const target = document.getElementById(`page-${page}`);
    if (target) {
      target.style.display = 'block';

      // Footer visible uniquement sur la home (caché ailleurs)
      const footer = document.getElementById('site-footer');
      if (footer) footer.style.display = page === 'home' ? 'block' : 'none';

      // Gestion de la navbar : visible sauf pour les pages fullscreen
      const navbar = document.getElementById('navbar');
      // .includes() : vérifie si page est dans le tableau FULLSCREEN_PAGES
      if (this.FULLSCREEN_PAGES.includes(page)) {
        navbar.style.display = 'none';   // Mode immersif, pas de navbar
      } else {
        navbar.style.display = 'flex';
        // Bouton "Home" visible sauf sur la page accueil (sinon doublon)
        const homeBtn = document.getElementById('nav-home-btn');
        if (homeBtn) homeBtn.style.display = page !== 'home' ? 'block' : 'none';
      }

      // ÉTAPE 3 : Remonter en haut de la page (UX : éviter de garder le scroll)
      window.scrollTo(0, 0);
    }

    // Activer/désactiver la musique d'ambiance selon la page
    // typeof !== 'undefined' : vérifie qu'Ambient est bien défini
    if (typeof Ambient !== 'undefined') Ambient.onPageChange(page);

    // ÉTAPE 4 : Exécuter le code d'initialisation propre à cette page
    // (chaque page a sa logique, voir _onPageEnter ci-dessous)
    this._onPageEnter(page);
  },

  // Logique d'initialisation au moment où on arrive sur une page
  // Aiguille vers la fonction render/init correspondante
  _onPageEnter(page) {
    // switch = équivalent d'une chaîne de if/else if
    switch (page) {
      case 'home':
        renderHomePage();           // Affiche les 3 hôtels
        break;                       // break = arrête le switch
      case 'hotel':
        renderHotelPage();          // Détail d'un hôtel + ses services
        break;
      case 'roombook':
        renderRoomBookingPage();    // Réservation de chambre (dates, formule)
        break;
      case 'servicebook':
        renderServiceBookingPage(); // Réservation d'un service (spa, sport)
        break;
      case 'payment':
        renderPaymentPage();        // Formulaire de paiement par carte
        break;
      case 'signin':
        initSignInPage();           // Formulaire de connexion
        break;
      case 'signup':
        initSignUpPage();           // Formulaire d'inscription
        break;
      case 'checkin':
        renderCheckinPage();        // Scan QR pour entrer dans l'hôtel
        break;
      case 'smartroom':
        initSmartRoomPage();        // Contrôles de la chambre intelligente
        updateSmartRoomHeader();    // En-tête (numéro chambre, hôtel)
        SmartRoom._updateUI();      // Synchronise l'UI avec l'état
        break;
      case 'checkout':
        renderCheckoutPage();       // Scan QR de sortie
        break;
      case 'quiz':
        renderQuizPage();           // Quiz de satisfaction (5 questions)
        break;
    }
  }
};

// ════════════════════════════════════════════════════════════════
// MUSIQUE D'AMBIANCE — boucle sur la page d'accueil
// Note : les navigateurs interdisent la lecture audio sans interaction
// utilisateur, donc on attend un click/touch avant de démarrer
// ════════════════════════════════════════════════════════════════
const Ambient = {
  audio:        null,     // Référence à l'élément <audio>
  toggle:       null,     // Référence au bouton mute/unmute
  loopDuration: 30,       // Durée de la boucle en secondes
  enabled:      true,     // État souhaité par l'utilisateur (par défaut on)
  ready:        false,    // Un premier geste utilisateur a-t-il eu lieu ?

  // Initialisation : appelée une seule fois au DOMContentLoaded
  init() {
    // Récupération des éléments DOM
    this.audio  = document.getElementById('ambient-audio');
    this.toggle = document.getElementById('music-toggle');
    if (!this.audio || !this.toggle) return; // Sécurité

    this.audio.volume = 0.35; // Volume doux (35%)

    // Boucle : à chaque mise à jour de currentTime, si on dépasse loopDuration
    // on revient à 0 → effet boucle infinie
    this.audio.addEventListener('timeupdate', () => {
      if (this.audio.currentTime >= this.loopDuration) {
        this.audio.currentTime = 0;
      }
    });

    // Restaurer la préférence sauvegardée dans localStorage
    // localStorage = stockage persistant côté navigateur (survit au refresh)
    const saved = localStorage.getItem('ambientMusic');
    if (saved === 'off') {
      this.enabled = false;
      this.toggle.classList.add('muted');  // Affiche l'icône "mute"
    }

    // Click sur le bouton : bascule on/off
    this.toggle.addEventListener('click', () => this.userToggle());

    // Astuce navigateur : la lecture audio nécessite un geste utilisateur
    // On écoute le PREMIER click ou touche, puis on lance la lecture
    const onFirstGesture = () => {
      this.ready = true;
      // Si on est sur la home et que la musique est activée → démarrer
      if (this.shouldPlay()) this.play();
      // On retire les listeners (plus nécessaires)
      document.removeEventListener('pointerdown', onFirstGesture);
      document.removeEventListener('keydown', onFirstGesture);
    };
    // pointerdown = click ou touche tactile
    document.addEventListener('pointerdown', onFirstGesture, { once: false });
    document.addEventListener('keydown',     onFirstGesture, { once: false });
  },

  // Détermine si la musique DOIT jouer (3 conditions)
  shouldPlay() {
    // Active uniquement sur la home, si l'utilisateur le veut, et si geste fait
    const homeVisible = document.getElementById('page-home')?.style.display !== 'none';
    return this.enabled && homeVisible && this.ready;
  },

  // Appelée par le router à chaque changement de page
  onPageChange(page) {
    if (!this.audio) return;
    if (page === 'home') {
      this.toggle.style.display = 'flex';   // Bouton visible
      if (this.shouldPlay()) this.play();   // Reprend la musique
    } else {
      this.toggle.style.display = 'none';   // Bouton caché
      this.pause();                          // Mise en pause
    }
  },

  // Toggle déclenché par l'utilisateur (click sur le bouton)
  userToggle() {
    this.enabled = !this.enabled;
    // Ajoute/enlève la classe "muted" selon l'état
    this.toggle.classList.toggle('muted', !this.enabled);
    // Sauvegarde dans localStorage pour la prochaine visite
    localStorage.setItem('ambientMusic', this.enabled ? 'on' : 'off');
    if (this.enabled) {
      this.ready = true; // Ce click compte comme interaction utilisateur
      this.play();
    } else {
      this.pause();
    }
  },

  // Lance la lecture (avec gestion d'erreur pour autoplay refusé)
  play() {
    if (!this.audio) return;
    // .play() retourne une Promise qui peut échouer si autoplay bloqué
    const p = this.audio.play();
    // .catch() : on ignore silencieusement l'erreur autoplay
    if (p && p.catch) p.catch(() => { /* autoplay refusé : on attend une interaction */ });
  },

  // Met en pause
  pause() {
    if (this.audio) this.audio.pause();
  },
};

// Rejoue les animations "reveal" en réinitialisant la classe
// Astuce : pour relancer une animation CSS, il faut forcer un "reflow" du DOM
// rootEl = élément parent (ou tout le document si non fourni)
function replayReveals(rootEl) {
  const root = rootEl || document;
  // Sélectionne tous les éléments avec la classe "reveal"
  const els = root.querySelectorAll('.reveal');
  els.forEach(el => {
    el.classList.remove('revealed');
    // void el.offsetWidth = lit la propriété pour forcer le reflow
    // sans cette ligne, le navigateur regroupe remove + add et l'anim ne joue pas
    void el.offsetWidth;
    el.classList.add('revealed');
  });
}

// ════════════════════════════════════════════════════════════════
// PAGE ACCUEIL — renderHomePage()
// Équivalent de home_screen.dart
// Affiche les 3 cartes d'hôtels en grille
// ════════════════════════════════════════════════════════════════
function renderHomePage() {
  const grid = document.getElementById('hotels-grid');
  if (!grid) return; // Sécurité : la grille doit exister

  // Affiche le footer (caché sur les autres pages)
  const footer = document.getElementById('site-footer');
  if (footer) footer.style.display = 'block';

  // Génère les cartes des 3 hôtels depuis HOTELS (config.js)
  // .map() transforme chaque hôtel en HTML, .join('') concatène le tout
  grid.innerHTML = HOTELS.map(hotel => {
    // Récupère les couleurs/image associées à cet hôtel
    const colors = HOTEL_COLORS[hotel.id];
    // Template literal HTML retourné pour chaque hôtel
    // --d:Xms = délai d'animation (effet stagger : chacun apparaît après l'autre)
    // onclick appelle selectHotel(...) avec l'ID de l'hôtel
    return `
      <div class="hotel-card reveal" style="--d:${HOTELS.indexOf(hotel) * 150}ms" onclick="selectHotel('${hotel.id}')">
        <div class="hotel-card-img" style="background-image: url('${colors.cover}'); background-size: cover; background-position: center;">
          <div class="card-rating">★ ${hotel.rating}</div>
        </div>
        <div class="hotel-card-body">
          <div class="hotel-card-name">${hotel.name}</div>
          <div class="hotel-card-location">📍 ${hotel.location}</div>
          <div class="hotel-card-desc">${hotel.description}</div>
          <div class="hotel-card-cta">DISCOVER →</div>
        </div>
      </div>
    `;
  }).join('');

  // Lancer les animations d'apparition après 30ms (laisser le DOM se construire)
  setTimeout(() => replayReveals(document.getElementById('page-home')), 30);
}

// Sélectionner un hôtel et aller sur la page de détail
// Appelée depuis l'onclick des cartes hôtel
function selectHotel(hotelId) {
  // .find() : retourne le premier hôtel dont l'id correspond
  AppState.currentHotel = HOTELS.find(h => h.id === hotelId);
  AppState.activeFilter = 'all'; // Reset du filtre catégorie
  Router.go('hotel');             // Navigation vers la page hôtel
}

// ════════════════════════════════════════════════════════════════
// PAGE DÉTAIL HÔTEL — renderHotelPage()
// Équivalent de hotel_detail_screen.dart
// Affiche le détail d'un hôtel + ses services (chambres, spa, etc.)
// ════════════════════════════════════════════════════════════════
function renderHotelPage() {
  const hotel = AppState.currentHotel;
  // Si aucun hôtel sélectionné → retour à la home (cas d'erreur)
  if (!hotel) { Router.go('home'); return; }

  const colors = HOTEL_COLORS[hotel.id];

  // En-tête de l'hôtel : nom, localisation, description, rating
  // textContent (pas innerHTML) = sécurité contre injection XSS
  document.getElementById('hotel-detail-name').textContent     = hotel.name;
  document.getElementById('hotel-detail-location').textContent = hotel.location;
  document.getElementById('hotel-detail-desc').textContent     = hotel.description;
  document.getElementById('hotel-rating-badge').textContent    = `★ ${hotel.rating} / 5`;

  // Fond de l'en-tête : image de couverture nette (sans filtre)
  // .cssText = définit plusieurs propriétés CSS d'un coup
  document.getElementById('hotel-hero-bg').style.cssText =
    `background-image: url('${colors.cover}'); background-size: cover; background-position: center;`;

  // Génération des filtres de catégories
  // new Set(...) supprime les doublons (catégories uniques)
  // ...spread étale les valeurs du Set dans le tableau
  // Exemple : ['all', 'room', 'pool', 'dining', 'sport', ...]
  const categories = ['all', ...new Set(hotel.services.map(s => s.category))];
  const filterTabs = document.getElementById('hotel-filter-tabs');
  // Génère un bouton par catégorie, marque "active" celle sélectionnée
  filterTabs.innerHTML = categories.map(cat => `
    <button class="filter-tab ${cat === AppState.activeFilter ? 'active' : ''}"
            onclick="filterServices('${cat}')">
      ${cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
    </button>
  `).join('');

  // Affichage des services filtrés selon le filtre actif
  renderServicesGrid(hotel, AppState.activeFilter);

  // Bouton retour vers la home
  // onclick = (méthode de définition d'événement, équivalente à addEventListener)
  document.getElementById('hotel-back-btn').onclick = () => Router.go('home');

  // Cacher le footer sur les pages internes (visible uniquement sur la home)
  const footer = document.getElementById('site-footer');
  if (footer) footer.style.display = 'none';

  // Animations reveal après que le DOM soit construit
  setTimeout(() => replayReveals(document.getElementById('page-hotel')), 30);
}

// Filtre les services par catégorie
// Appelée par les boutons d'onglets (onclick)
function filterServices(category) {
  AppState.activeFilter = category;
  // Mise à jour de l'onglet actif (visuellement)
  document.querySelectorAll('.filter-tab').forEach(tab => {
    // .toggle(class, condition) : ajoute si vrai, enlève si faux
    tab.classList.toggle('active', tab.textContent.trim() === (
      // Première lettre en majuscule pour matcher le contenu du bouton
      category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)
    ));
  });
  // Réaffiche la grille avec le nouveau filtre
  renderServicesGrid(AppState.currentHotel, category);
}

// Génère la grille des services (cartes cliquables)
// hotel = hôtel courant, filter = catégorie ('all' = tous)
function renderServicesGrid(hotel, filter) {
  const grid = document.getElementById('services-grid');
  // Si filter === 'all' on prend tous les services, sinon on filtre
  const services = filter === 'all'
    ? hotel.services
    : hotel.services.filter(s => s.category === filter);

  // Génère le HTML de chaque service
  // i = index pour décaler les animations
  grid.innerHTML = services.map((service, i) => `
    <div class="service-card reveal" style="--d:${i * 80}ms" onclick="selectService('${service.id}')">
      ${service.image ? `<div class="service-card-img" style="background-image: url('${service.image}')"></div>` : ''}
      <div class="service-card-body">
        <div class="service-card-header">
          <span class="service-category">${service.category}</span>
        </div>
        <div class="service-name">${service.name}</div>
        <div class="service-desc">${service.description}</div>
        <div class="service-footer">
          <span class="service-price">
            ${formatNum(service.price)} DT${service.bookable === 'room' ? '/night' : '/pers'}
          </span>
          <button class="service-book-btn">BOOK</button>
        </div>
      </div>
    </div>
  `).join('');

  // Lance les animations reveal
  setTimeout(() => replayReveals(grid), 20);
}

// Sélectionner un service et aller vers la bonne page de réservation
// Aiguille vers roombook (chambres) ou servicebook (autres)
function selectService(serviceId) {
  const service = AppState.currentHotel.services.find(s => s.id === serviceId);
  AppState.currentService = service;

  // Vérification de la connexion AVANT toute réservation
  if (!Auth.isLoggedIn) {
    // Pas connecté → on force l'inscription
    Router.go('signup');
    return;
  }

  // Choix de la page selon le type de service
  // bookable === 'room' : chambre (a besoin de dates check-in/check-out)
  // sinon : service ponctuel (juste une date + nombre de personnes)
  if (service.bookable === 'room') {
    Router.go('roombook');
  } else {
    Router.go('servicebook');
  }
}

// ════════════════════════════════════════════════════════════════
// PAGE RÉSERVATION CHAMBRE — renderRoomBookingPage()
// Équivalent de room_booking_screen.dart
// Formulaire complet : dates, personnes, formule, extras + calcul du prix
// ════════════════════════════════════════════════════════════════
function renderRoomBookingPage() {
  const hotel   = AppState.currentHotel;
  const service = AppState.currentService;
  // Sécurité : si données manquantes, retour à la home
  if (!hotel || !service) { Router.go('home'); return; }

  // Résumé du service en haut de la page (image + nom + prix)
  document.getElementById('roombook-summary').innerHTML = `
    ${service.image ? `<div class="summary-img" style="background-image: url('${service.image}')"></div>` : ''}
    <div class="service-summary-name">${service.name}</div>
    <div class="hotel-card-location">${hotel.name}</div>
    <div class="service-summary-price">${formatNum(service.price)} DT/night</div>
  `;

  // Date minimale = aujourd'hui + 1 jour (impossible de réserver pour aujourd'hui)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  // toISOString → "2026-05-06T..." puis split('T')[0] → "2026-05-06"
  // Format YYYY-MM-DD attendu par les inputs type="date"
  const minDate = tomorrow.toISOString().split('T')[0];

  // Configuration des inputs date
  document.getElementById('checkin-date').min    = minDate;  // Date minimum
  document.getElementById('checkin-date').value  = '';        // Vide au départ
  document.getElementById('checkout-date').min   = minDate;
  document.getElementById('checkout-date').value = '';

  // Réinitialisation des compteurs (valeurs par défaut)
  document.getElementById('adults-count').textContent   = '2'; // 2 adultes
  document.getElementById('children-count').textContent = '0'; // 0 enfants
  document.getElementById('sport-check').checked = false;
  document.getElementById('spa-check').checked   = false;
  // Cache le résumé prix tant qu'aucune date n'est choisie
  document.getElementById('price-summary').style.display = 'none';

  // Chips (badges cliquables) de formule
  // Object.keys() = retourne les clés ['All Inclusive', 'Half Board', ...]
  const formulaKeys = Object.keys(FORMULA_PRICES);
  document.getElementById('formula-chips').innerHTML = formulaKeys.map(f => `
    <span class="chip ${f === 'All Inclusive' ? 'active' : ''}"
          onclick="selectFormula('${f}', this)">${f}</span>
  `).join('');

  // ── Compteurs adultes ──
  // Max 10 adultes, Min 1 (au moins 1 personne)
  document.getElementById('adults-minus').onclick = () => {
    const el = document.getElementById('adults-count');
    el.textContent = Math.max(1, parseInt(el.textContent) - 1);
    updateRoomPrice(); // Recalcule le prix
  };
  document.getElementById('adults-plus').onclick = () => {
    const el = document.getElementById('adults-count');
    el.textContent = Math.min(10, parseInt(el.textContent) + 1);
    updateRoomPrice();
  };

  // ── Compteurs enfants ──
  // Max 10 enfants, Min 0 (les enfants sont optionnels)
  document.getElementById('children-minus').onclick = () => {
    const el = document.getElementById('children-count');
    el.textContent = Math.max(0, parseInt(el.textContent) - 1);
    updateRoomPrice();
  };
  document.getElementById('children-plus').onclick = () => {
    const el = document.getElementById('children-count');
    el.textContent = Math.min(10, parseInt(el.textContent) + 1);
    updateRoomPrice();
  };

  // Recalcul du prix à chaque changement de date
  document.getElementById('checkin-date').onchange  = updateRoomPrice;
  document.getElementById('checkout-date').onchange = updateRoomPrice;

  // Recalcul à chaque changement d'extra (sport/spa)
  document.getElementById('sport-check').onchange = updateRoomPrice;
  document.getElementById('spa-check').onchange   = updateRoomPrice;

  // Bouton retour vers la liste des services de l'hôtel
  document.getElementById('roombook-back-btn').onclick = () => Router.go('hotel');

  // Bouton "Procéder au paiement"
  document.getElementById('roombook-pay-btn').onclick = proceedRoomPayment;
}

// Sélectionner une formule (chips)
// formula = nom de la formule, el = élément cliqué
function selectFormula(formula, el) {
  // Désactive toutes les chips
  document.querySelectorAll('#formula-chips .chip').forEach(c => c.classList.remove('active'));
  // Active celle cliquée
  el.classList.add('active');
  updateRoomPrice(); // Recalcule
}

// Calcule et affiche le prix de la réservation chambre
// Appelée à chaque changement (date, personnes, formule, extras)
function updateRoomPrice() {
  // Lecture des valeurs du formulaire
  const ci = new Date(document.getElementById('checkin-date').value);    // Check-in
  const co = new Date(document.getElementById('checkout-date').value);   // Check-out
  const adults   = parseInt(document.getElementById('adults-count').textContent);
  const children = parseInt(document.getElementById('children-count').textContent);
  // Récupère le texte de la chip active, défaut 'All Inclusive'
  const formula  = document.querySelector('#formula-chips .chip.active')?.textContent || 'All Inclusive';
  const sport    = document.getElementById('sport-check').checked;
  const spa      = document.getElementById('spa-check').checked;

  // Validation : si dates invalides ou check-out avant check-in, on cache le prix
  // isNaN = "is Not a Number" (dates invalides deviennent NaN)
  if (isNaN(ci) || isNaN(co) || co <= ci) {
    document.getElementById('price-summary').style.display = 'none';
    return;
  }

  // Calcul du nombre de nuits = différence en ms / 86 400 000 (ms par jour)
  // 1000 (ms→s) × 60 (s→min) × 60 (min→h) × 24 (h→jour) = 86 400 000
  const nights  = Math.round((co - ci) / (1000 * 60 * 60 * 24));
  const persons = adults + children;
  const fPrice  = FORMULA_PRICES[formula] || 0;
  const perNight = AppState.currentService.price;

  // Construction des lignes de prix (détail visible à l'utilisateur)
  const lines = [];
  // Ligne de base : prix chambre × nuits
  lines.push({ label: `Room (${nights} nights × ${formatNum(perNight)} DT)`, amount: nights * perNight });
  // Ligne formule (seulement si > 0, donc pas pour Bed & Breakfast)
  if (fPrice > 0)
    lines.push({ label: `${formula} (${nights}n × ${persons}p × ${fPrice} DT)`, amount: nights * persons * fPrice });
  // Ligne extras
  if (sport)
    lines.push({ label: `Sport (${persons} pers × 800 DT)`, amount: persons * 800 });
  if (spa)
    lines.push({ label: `Spa (${persons} pers × 1,200 DT)`, amount: persons * 1200 });

  // Calcul du total via la fonction helper de config.js
  const total = calcRoomTotal({ perNight, nights, adults, children, formula, sport, spa });

  // Affichage du résumé prix
  document.getElementById('price-summary').style.display = 'block';
  // Génère une ligne HTML par ligne de prix
  document.getElementById('price-lines').innerHTML =
    lines.map(l => `<div class="price-line"><span>${l.label}</span><span>${formatNum(l.amount)} DT</span></div>`).join('');
  document.getElementById('price-total').textContent = `${formatNum(total)} DT`;
  // Met à jour le texte du bouton paiement avec le montant
  document.getElementById('roombook-pay-btn').textContent = `PROCEED TO PAYMENT — ${formatNum(total)} DT`;
}

// Aller au paiement pour une chambre
// Valide le formulaire puis remplit AppState.paymentData
function proceedRoomPayment() {
  // Récupération + validation des dates
  const ci = document.getElementById('checkin-date').value;
  const co = document.getElementById('checkout-date').value;
  if (!ci || !co || new Date(co) <= new Date(ci)) {
    alert('Please select valid check-in and check-out dates.');
    return; // Stoppe la fonction
  }

  // Lecture finale du formulaire
  const adults   = parseInt(document.getElementById('adults-count').textContent);
  const children = parseInt(document.getElementById('children-count').textContent);
  const formula  = document.querySelector('#formula-chips .chip.active')?.textContent || 'All Inclusive';
  const sport    = document.getElementById('sport-check').checked;
  const spa      = document.getElementById('spa-check').checked;
  // Recalcul du nombre de nuits (sécurité : ne fait pas confiance à l'UI)
  const nights   = Math.round((new Date(co) - new Date(ci)) / (1000 * 60 * 60 * 24));
  const total    = calcRoomTotal({
    perNight: AppState.currentService.price,
    nights, adults, children, formula, sport, spa
  });

  // Stockage temporaire des données pour la page paiement
  // (sera consommé par renderPaymentPage et processPayment)
  AppState.paymentData = {
    type:             'room',                            // Type pour distinguer room vs service
    hotel:            AppState.currentHotel.name,        // Nom hôtel (pour affichage)
    hotel_id:         AppState.currentHotel.id,          // ID hôtel (pour DB)
    service:          AppState.currentService.name,
    service_id:       AppState.currentService.id,
    service_category: AppState.currentService.category,
    price:            total,                              // Total à payer
    check_in:         ci,
    check_out:        co,
    adults,
    children,
    formula,
    sport,
    spa,
    nights,
  };

  Router.go('payment'); // Redirige vers la page de paiement
}

// ════════════════════════════════════════════════════════════════
// PAGE RÉSERVATION SERVICE — renderServiceBookingPage()
// Équivalent de service_booking_screen.dart
// Pour les services NON-chambre (spa, restaurant, sport, etc.)
// Plus simple que la chambre : juste une date + nombre de personnes
// ════════════════════════════════════════════════════════════════
function renderServiceBookingPage() {
  const hotel   = AppState.currentHotel;
  const service = AppState.currentService;
  if (!hotel || !service) { Router.go('home'); return; }

  // Résumé en haut (image + nom + prix)
  document.getElementById('servicebook-summary').innerHTML = `
    ${service.image ? `<div class="summary-img" style="background-image: url('${service.image}')"></div>` : ''}
    <div class="service-summary-name">${service.name}</div>
    <div class="hotel-card-location">${hotel.name}</div>
    <div class="service-summary-price">${formatNum(service.price)} DT/pers</div>
  `;

  // Date minimale = demain
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('service-booking-date').min   = tomorrow.toISOString().split('T')[0];
  document.getElementById('service-booking-date').value = '';
  document.getElementById('service-persons-count').textContent = '1'; // 1 par défaut

  // Fonction interne : recalcule le prix
  // Définie ici pour avoir accès à "service" via closure
  const updateServicePrice = () => {
    const persons = parseInt(document.getElementById('service-persons-count').textContent);
    const total = service.price * persons; // Calcul simple : prix × personnes
    document.getElementById('service-price-total').textContent = `${formatNum(total)} DT`;
    document.getElementById('servicebook-pay-btn').textContent = `PROCEED TO PAYMENT — ${formatNum(total)} DT`;
  };

  // Compteur personnes : Min 1, Max 20
  document.getElementById('service-persons-minus').onclick = () => {
    const el = document.getElementById('service-persons-count');
    el.textContent = Math.max(1, parseInt(el.textContent) - 1);
    updateServicePrice();
  };
  document.getElementById('service-persons-plus').onclick = () => {
    const el = document.getElementById('service-persons-count');
    el.textContent = Math.min(20, parseInt(el.textContent) + 1);
    updateServicePrice();
  };

  updateServicePrice(); // Affichage initial

  // Bouton retour
  document.getElementById('servicebook-back-btn').onclick = () => Router.go('hotel');

  // Bouton paiement : valide puis redirige
  document.getElementById('servicebook-pay-btn').onclick = () => {
    const date    = document.getElementById('service-booking-date').value;
    const persons = parseInt(document.getElementById('service-persons-count').textContent);
    if (!date) { alert('Please select a booking date.'); return; }

    // Stockage des données pour la page paiement
    AppState.paymentData = {
      type:             'service',                  // Distingue de 'room'
      hotel:            hotel.name,
      hotel_id:         hotel.id,
      service:          service.name,
      service_id:       service.id,
      service_category: service.category,
      price:            service.price * persons,
      booking_date:     date,                        // Une seule date (pas de nuits)
      persons,
    };
    Router.go('payment');
  };
}

// ════════════════════════════════════════════════════════════════
// PAGE PAIEMENT — renderPaymentPage()
// Équivalent de payment_screen.dart
// Formulaire de carte bancaire (paiement SIMULÉ, aucune vraie transaction)
// ════════════════════════════════════════════════════════════════
function renderPaymentPage() {
  const data = AppState.paymentData;
  if (!data) { Router.go('home'); return; } // Sécurité

  // Réinitialiser les 3 vues : formulaire / succès / erreur
  document.getElementById('payment-form-view').style.display    = 'block';
  document.getElementById('payment-success-view').style.display = 'none';
  document.getElementById('payment-error').style.display        = 'none';

  // Afficher le total à payer (lu depuis paymentData)
  document.getElementById('payment-total').textContent = `${formatNum(data.price)} DT`;
  document.getElementById('pay-btn').textContent = `PAY ${formatNum(data.price)} DT`;

  // Effacer tous les champs du formulaire (au cas où on revient sur la page)
  ['card-name', 'card-number', 'card-expiry', 'card-cvv'].forEach(id => {
    document.getElementById(id).value = '';
  });

  // Formatage automatique du numéro de carte au fur et à mesure de la frappe
  // Format : "XXXX XXXX XXXX XXXX" (ajout d'espaces tous les 4 chiffres)
  document.getElementById('card-number').oninput = (e) => {
    // \D = tout ce qui n'est PAS un chiffre → on les supprime
    // .substring(0, 16) = limite à 16 chiffres (longueur d'une CB)
    let v = e.target.value.replace(/\D/g, '').substring(0, 16);
    // (.{4}) capture 4 caractères, $1 = ce qu'on a capturé, ajout d'un espace
    // .trim() enlève l'espace final éventuel
    e.target.value = v.replace(/(.{4})/g, '$1 ').trim();
  };

  // Formatage automatique de la date d'expiration : "MM/YY"
  document.getElementById('card-expiry').oninput = (e) => {
    let v = e.target.value.replace(/\D/g, '').substring(0, 4);
    // Après les 2 premiers chiffres (mois), on insère le "/"
    if (v.length >= 2) v = v.substring(0, 2) + '/' + v.substring(2);
    e.target.value = v;
  };

  // Bouton retour : revient à la bonne page selon le type de réservation
  document.getElementById('payment-back-btn').onclick = () => {
    Router.go(data.type === 'room' ? 'roombook' : 'servicebook');
  };

  // Bouton de paiement : déclenche processPayment()
  document.getElementById('pay-btn').onclick = processPayment;
}

// Traitement du paiement
// Valide la carte, crée la réservation dans Supabase, affiche le succès
// async = fonction asynchrone (utilise await pour les requêtes)
async function processPayment() {
  // Lecture des champs de la carte
  const name   = document.getElementById('card-name').value.trim();
  // .replace(/\s/g, '') : enlève tous les espaces (formatage retiré)
  const card   = document.getElementById('card-number').value.replace(/\s/g, '');
  const expiry = document.getElementById('card-expiry').value.trim();
  const cvv    = document.getElementById('card-cvv').value.trim();

  // Validation simple : tous les champs doivent être remplis correctement
  if (!name || card.length < 16 || expiry.length < 5 || cvv.length < 3) {
    showPaymentError('Please fill in all card details correctly.');
    return;
  }

  // Vérification : utilisateur connecté
  if (!Auth.isLoggedIn || !Auth.user) {
    showPaymentError('Please sign in to complete payment.');
    return;
  }

  // Désactiver le bouton et afficher le chargement (UX)
  const btn = document.getElementById('pay-btn');
  btn.disabled = true;
  btn.textContent = 'Processing...';
  document.getElementById('payment-error').style.display = 'none';

  const data = AppState.paymentData;
  const isRoom = data.type === 'room'; // Booléen : chambre ou service ?

  // Construction du payload de réservation pour Supabase
  // Champs communs aux deux types
  const payload = {
    user_id:           Auth.user.id,             // FK vers auth.users
    hotel_id:          data.hotel_id,
    hotel_name:        data.hotel,
    service_id:        data.service_id,
    service_name:      data.service,
    service_category:  data.service_category,
    reservation_type:  data.type,                 // 'room' ou 'service'
    total_price:       data.price,
    status:            'confirmed',               // Statut initial
  };

  // Object.assign(cible, source) : copie les propriétés de source dans cible
  // On ajoute les champs spécifiques selon le type
  if (isRoom) {
    // Champs spécifiques aux chambres
    Object.assign(payload, {
      check_in:      data.check_in,
      check_out:     data.check_out,
      adults:        data.adults,
      children:      data.children,
      formula:       data.formula,
      sport_package: data.sport,
      spa_package:   data.spa,
      nights:        data.nights,
    });
  } else {
    // Champs spécifiques aux services ponctuels
    Object.assign(payload, {
      booking_date: data.booking_date,
      persons:      data.persons,
    });
  }

  // Variables de tracking de l'opération
  let reservationId = null;
  let errorNote = null;

  // try/catch : gestion d'erreur réseau gracieuse
  try {
    // Insertion en DB et récupération de l'ID
    reservationId = await apiCreateReservation(payload);
  } catch (e) {
    // En cas d'échec on continue quand même (UX) mais on note l'erreur
    errorNote = `Payment saved locally but not synced: ${e.message}`;
  }

  // Passer de la vue "formulaire" à la vue "succès"
  document.getElementById('payment-form-view').style.display    = 'none';
  document.getElementById('payment-success-view').style.display = 'flex';

  // Message de confirmation différent selon le type de résa
  document.getElementById('payment-success-sub').textContent =
    isRoom ? 'QR Code sent to your email for check-in' : 'Confirmation saved to the database';

  // Si erreur de sync → afficher la note d'erreur (mais paiement validé)
  if (errorNote) {
    const errNote = document.getElementById('payment-error-note');
    errNote.textContent = errorNote;
    errNote.style.display = 'block';
  }

  // Si c'est une chambre → activer le séjour (active le bouton "My Stay")
  if (isRoom) {
    Auth.setActiveStay(true, reservationId, data.hotel);
  }

  // Bouton "Back to Home"
  document.getElementById('payment-home-btn').onclick = () => {
    AppState.paymentData = null; // Nettoie les données de paiement
    Router.go('home');
  };
}

// Affiche un message d'erreur dans le formulaire de paiement
function showPaymentError(msg) {
  const el = document.getElementById('payment-error');
  el.textContent     = msg;
  el.style.display   = 'block';
}

// ════════════════════════════════════════════════════════════════
// PAGE SIGN IN — initSignInPage()
// Équivalent de sign_in_screen.dart
// Formulaire de connexion (CIN + mot de passe)
// ════════════════════════════════════════════════════════════════
function initSignInPage() {
  // Réinitialiser les champs (sécurité au cas où on revient sur la page)
  document.getElementById('signin-cin').value = '';
  document.getElementById('signin-pw').value  = '';
  document.getElementById('signin-error').style.display = 'none';

  // Listener du bouton "Sign In"
  document.getElementById('signin-btn').onclick = async () => {
    const cin      = document.getElementById('signin-cin').value.trim();
    const password = document.getElementById('signin-pw').value;

    // Validation : champs obligatoires
    if (!cin || !password) {
      showSignInError('Please enter your CIN and password.');
      return;
    }
    // Validation : CIN doit être "admin" OU 8 chiffres exacts
    // /^\d{8}$/ : regex = ligne entière de 8 chiffres
    if (cin !== 'admin' && !/^\d{8}$/.test(cin)) {
      showSignInError('CIN must be exactly 8 digits.');
      return;
    }

    // UX : désactivation du bouton + texte "Signing in..."
    document.getElementById('signin-btn').disabled = true;
    document.getElementById('signin-btn').textContent = 'Signing in...';

    // Appel à Auth.signIn (qui appelle Supabase via api.js)
    const ok = await Auth.signIn(cin, password);

    // Réactivation du bouton (succès ou échec)
    document.getElementById('signin-btn').disabled = false;
    document.getElementById('signin-btn').textContent = 'SIGN IN';

    if (!ok) {
      // Échec : affiche le message d'erreur stocké dans Auth.error
      showSignInError(Auth.error || 'Invalid credentials.');
    } else if (!Auth.isAdmin) {
      // Succès user normal : retour à la home
      Router.go('home');
    }
    // Si admin → redirection vers admin.html gérée dans Auth.signIn()
  };

  // Lien "No account? Sign Up"
  document.getElementById('go-signup').onclick = () => Router.go('signup');
}

// Affiche un message d'erreur dans la page sign in
function showSignInError(msg) {
  const el = document.getElementById('signin-error');
  el.textContent   = msg;
  el.style.display = 'block';
}

// ════════════════════════════════════════════════════════════════
// PAGE SIGN UP — initSignUpPage()
// Équivalent de sign_up_screen.dart
// Formulaire d'inscription (CIN, nom, prénom, adresse, date naissance, mdp)
// ════════════════════════════════════════════════════════════════
function initSignUpPage() {
  // Réinitialiser tous les champs (boucle sur les IDs)
  ['signup-cin','signup-first','signup-last','signup-address','signup-pw','signup-pw2'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('signup-dob').value = '';
  document.getElementById('signup-error').style.display = 'none';

  // Bouton "Submit"
  document.getElementById('signup-btn').onclick = async () => {
    // Lecture de tous les champs
    const cin    = document.getElementById('signup-cin').value.trim();
    const first  = document.getElementById('signup-first').value.trim();
    const last   = document.getElementById('signup-last').value.trim();
    const addr   = document.getElementById('signup-address').value.trim();
    const dob    = document.getElementById('signup-dob').value;       // Date de naissance
    const pw     = document.getElementById('signup-pw').value;
    const pw2    = document.getElementById('signup-pw2').value;       // Confirmation mdp

    // Validations identiques à Flutter
    // 1) CIN : 8 chiffres exacts
    if (!/^\d{8}$/.test(cin)) {
      showSignUpError('CIN must be exactly 8 digits.'); return;
    }
    // 2) Prénom + Nom obligatoires
    if (!first || !last) {
      showSignUpError('Please enter your full name.'); return;
    }
    // 3) Mot de passe : minimum 6 caractères
    if (pw.length < 6) {
      showSignUpError('Password must be at least 6 characters.'); return;
    }
    // 4) Les deux mots de passe doivent correspondre
    if (pw !== pw2) {
      showSignUpError('Passwords do not match.'); return;
    }

    // UX : bouton désactivé pendant la requête
    document.getElementById('signup-btn').disabled = true;
    document.getElementById('signup-btn').textContent = 'Creating account...';

    // Appel à Auth.signUp (qui appelle Supabase Auth)
    // address et date_of_birth sont optionnels → || null si vides
    const ok = await Auth.signUp({
      cin,
      first_name:    first,
      last_name:     last,
      address:       addr || null,
      date_of_birth: dob || null,
      password:      pw,
    });

    // Réactivation du bouton
    document.getElementById('signup-btn').disabled = false;
    document.getElementById('signup-btn').textContent = 'SUBMIT';

    if (!ok) {
      showSignUpError(Auth.error || 'Registration failed.');
    } else {
      // Succès : Auth.signUp connecte automatiquement l'utilisateur
      Router.go('home');
    }
  };

  // Bouton "Reset" : vide tous les champs
  document.getElementById('signup-reset-btn').onclick = () => {
    ['signup-cin','signup-first','signup-last','signup-address','signup-pw','signup-pw2'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('signup-dob').value = '';
    document.getElementById('signup-error').style.display = 'none';
  };

  // Lien "Have an account? Sign In"
  document.getElementById('go-signin').onclick = () => Router.go('signin');
}

// Affiche une erreur dans la page sign up
function showSignUpError(msg) {
  const el = document.getElementById('signup-error');
  el.textContent   = msg;
  el.style.display = 'block';
}

// ════════════════════════════════════════════════════════════════
// PAGE CHECK-IN — renderCheckinPage()
// Équivalent de check_in_screen.dart
// Simulation de scan QR + activation de la Smart Room dans Supabase
// ════════════════════════════════════════════════════════════════
function renderCheckinPage() {
  // Réinitialiser les vues : scan / succès / erreur
  document.getElementById('checkin-scan-view').style.display    = 'flex';
  document.getElementById('checkin-success-view').style.display = 'none';
  document.getElementById('checkin-error').style.display        = 'none';

  // Bouton "Scan QR Code"
  document.getElementById('checkin-scan-btn').onclick = async () => {
    const btn = document.getElementById('checkin-scan-btn');
    btn.disabled    = true;
    btn.textContent = 'Processing...';
    document.getElementById('checkin-error').style.display = 'none';

    // Simulation du scan QR (délai de 2.5 secondes comme dans Flutter)
    // new Promise + setTimeout = "attendre X ms" dans une fonction async
    await new Promise(res => setTimeout(res, 2500));

    // Vérification de la connexion (sécurité)
    if (!Auth.isLoggedIn || !Auth.user) {
      showCheckinError('Please sign in first.');
      btn.disabled = false;
      btn.textContent = 'SCAN QR CODE';
      return;
    }

    try {
      // Génération d'un numéro de chambre aléatoire entre 101 et 500
      // Math.random() donne 0..1, ×399 donne 0..399, +101 donne 101..500
      // Math.floor arrondit à l'inférieur, String() convertit en chaîne
      const roomNumber = String(101 + Math.floor(Math.random() * 399));

      // Activation de la Smart Room dans Supabase (nouvelle ligne)
      const smartRoomId = await apiActivateSmartRoom({
        user_id:        Auth.user.id,
        reservation_id: Auth.activeReservationId,    // Lie à la réservation active
        room_number:    roomNumber,
        hotel_name:     Auth.activeHotelName || 'Ophelia Hotel',
        // État initial de la chambre (valeurs par défaut)
        light_on:       SmartRoom.lightOn,
        temperature:    SmartRoom.temperature,
        blinds_open:    SmartRoom.blindsOpen,
        mode:           SmartRoom.mode,
        is_active:      true,
      });

      // Mise à jour de l'état local SmartRoom
      SmartRoom.smartRoomId = smartRoomId;             // ID DB pour les futures syncs
      SmartRoom.roomNumber  = roomNumber;
      SmartRoom.checkinTime = new Date().toISOString(); // Date ISO actuelle

      // Mettre à jour le statut de la réservation → "active"
      // (passe de "confirmed" à "active" quand l'utilisateur fait le check-in)
      if (Auth.activeReservationId) {
        await apiUpdateReservationStatus(Auth.activeReservationId, 'active');
      }

      // Transition vers l'écran de succès
      document.getElementById('checkin-scan-view').style.display    = 'none';
      document.getElementById('checkin-success-view').style.display = 'flex';
      // Affichage du numéro de chambre + hôtel
      document.getElementById('checkin-room-info').textContent =
        `Room ${roomNumber} — ${Auth.activeHotelName || 'Ophelia Hotel'}`;

      // Bouton "Enter Smart Room" → page de contrôle
      document.getElementById('checkin-continue-btn').onclick = () => Router.go('smartroom');

    } catch (e) {
      // En cas d'erreur Supabase
      showCheckinError(`Failed to activate smart room: ${e.message}`);
      btn.disabled = false;
      btn.textContent = 'SCAN QR CODE';
    }
  };
}

// Affiche une erreur dans la page check-in
function showCheckinError(msg) {
  const el = document.getElementById('checkin-error');
  el.textContent   = msg;
  el.style.display = 'block';
}

// ════════════════════════════════════════════════════════════════
// PAGE CHECK-OUT — renderCheckoutPage()
// Équivalent de check_out_screen.dart
// Désactive la Smart Room + réservation, puis propose le quiz
// ════════════════════════════════════════════════════════════════
function renderCheckoutPage() {
  // Réinitialise les vues
  document.getElementById('checkout-scan-view').style.display    = 'flex';
  document.getElementById('checkout-success-view').style.display = 'none';
  document.getElementById('checkout-error').style.display        = 'none';

  // Bouton "Scan QR Code" pour check-out
  document.getElementById('checkout-scan-btn').onclick = async () => {
    const btn = document.getElementById('checkout-scan-btn');
    btn.disabled    = true;
    btn.textContent = 'Processing...';

    // Simulation du scan (2 secondes — un peu plus court que le check-in)
    await new Promise(res => setTimeout(res, 2000));

    let errorNote = null;

    try {
      // 1) Désactiver la Smart Room dans Supabase (is_active=false + checked_out_at)
      if (SmartRoom.smartRoomId) {
        await apiDeactivateSmartRoom(SmartRoom.smartRoomId);
      }

      // 2) Mettre le statut de la réservation à "completed"
      // (active → completed une fois le séjour terminé)
      if (Auth.activeReservationId) {
        await apiUpdateReservationStatus(Auth.activeReservationId, 'completed');
      }

    } catch (e) {
      // En cas d'erreur on continue (UX : l'utilisateur a quand même fait son check-out)
      errorNote = `Checkout sync failed: ${e.message}`;
    }

    // Réinitialiser les états locaux
    SmartRoom.reset();              // Lumière, temp, etc. à zéro
    Auth.setActiveStay(false);      // Cache le bouton "My Stay"

    // Afficher l'écran de succès
    document.getElementById('checkout-scan-view').style.display    = 'none';
    document.getElementById('checkout-success-view').style.display = 'flex';

    // Si erreur → afficher la note (mais succès quand même)
    if (errorNote) {
      const el = document.getElementById('checkout-error-note');
      el.textContent   = errorNote;
      el.style.display = 'block';
    }

    // Bouton "Share your experience" → quiz de satisfaction
    document.getElementById('checkout-quiz-btn').onclick = () => {
      Router.go('quiz');
    };
  };
}

// ════════════════════════════════════════════════════════════════
// PAGE QUIZ DE SATISFACTION — renderQuizPage()
// 5 questions, chaque réponse vaut : Perfect=1★, Not bad=0.5★, Poor=0★
// Total maximum : 5 étoiles (5 × 1.0)
// ════════════════════════════════════════════════════════════════

// Liste des 5 questions affichées au quiz
const QUIZ_QUESTIONS = [
  "How would you rate your overall stay?",
  "How would you rate the comfort and cleanliness of your room?",
  "How did you find the Smart Room experience?",
  "How would you rate the welcome and professionalism of our team?",
  "How was your dining experience at the hotel?",
];

// Les 3 options de réponse (avec leur valeur en étoiles)
const QUIZ_OPTIONS = [
  { label: 'Perfect',  value: 1.0 },   // 1 étoile
  { label: 'Not bad',  value: 0.5 },   // demi-étoile
  { label: 'Poor',     value: 0.0 },   // 0 étoile
];

// État du quiz : tableau de 5 réponses (null si pas encore répondu)
const QuizState = {
  answers: [],   // valeur sélectionnée (1, 0.5, 0 ou null) par question
};

function renderQuizPage() {
  // Réinitialiser : crée un tableau de 5 null (5 questions)
  // .map(() => null) : génère [null, null, null, null, null]
  QuizState.answers = QUIZ_QUESTIONS.map(() => null);
  // Affiche le formulaire, cache les résultats
  document.getElementById('quiz-form-view').style.display   = 'block';
  document.getElementById('quiz-result-view').style.display = 'none';
  updateQuizProgress();

  // Construire les questions dans le DOM
  const container = document.getElementById('quiz-questions');
  // qi = question index, oi = option index
  container.innerHTML = QUIZ_QUESTIONS.map((q, qi) => `
    <div class="quiz-question reveal" style="--d:${qi * 100}ms" data-q="${qi}">
      <div class="quiz-q-number">Question ${qi + 1} / 5</div>
      <p class="quiz-q-text">${q}</p>
      <div class="quiz-options">
        ${QUIZ_OPTIONS.map((opt, oi) => `
          <button class="quiz-option" data-q="${qi}" data-v="${opt.value}">
            <span class="quiz-option-label">${opt.label}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Listener sur chaque bouton de réponse
  container.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      // parseInt pour les indices, parseFloat pour les valeurs (0.5 etc.)
      const qi = parseInt(btn.dataset.q);
      const v  = parseFloat(btn.dataset.v);
      // Enregistre la réponse à la question qi
      QuizState.answers[qi] = v;

      // Mise à jour visuelle : marque la sélection (et dé-sélectionne les autres)
      // [data-q="X"] : sélecteur d'attribut (toutes les options de la question X)
      container.querySelectorAll(`.quiz-option[data-q="${qi}"]`).forEach(b => {
        b.classList.toggle('selected', parseFloat(b.dataset.v) === v);
      });
      updateQuizProgress();
    });
  });

  // Bouton submit
  document.getElementById('quiz-submit-btn').onclick = submitQuiz;

  // Bouton retour accueil (sans soumettre)
  document.getElementById('quiz-home-btn').onclick = () => {
    updateNavbar();
    Router.go('home');
  };

  // Animations reveal après que le DOM soit construit
  setTimeout(() => replayReveals(document.getElementById('page-quiz')), 50);
}

// Met à jour la barre de progression du quiz
// (% de questions répondues sur le total)
function updateQuizProgress() {
  // .filter(a => a !== null) : garde les réponses non-null
  // .length : nombre de réponses données
  const answered = QuizState.answers.filter(a => a !== null).length;
  const pct = (answered / QUIZ_QUESTIONS.length) * 100;
  const bar = document.getElementById('quiz-progress-bar');
  if (bar) bar.style.width = `${pct}%`;
}

// Soumet le quiz et affiche les résultats
function submitQuiz() {
  // .some(condition) : vrai si AU MOINS une réponse est null
  if (QuizState.answers.some(a => a === null)) {
    alert('Please answer all 5 questions before submitting.');
    return;
  }

  // Total = somme de toutes les valeurs (max 5)
  // .reduce((acc, val) => ...) : itère et accumule
  const total = QuizState.answers.reduce((s, v) => s + v, 0);

  // Affichage des étoiles : pleines (1), demi (0.5), vides (0)
  // Algorithme : on parcourt 5 fois, on compte combien de "displayed"
  // - Si total - displayed >= 1 → étoile pleine
  // - Si >= 0.5 → demi-étoile
  // - Sinon → vide
  const starsContainer = document.getElementById('quiz-stars-final');
  starsContainer.innerHTML = '';
  let displayed = 0;
  for (let i = 0; i < 5; i++) {
    let star;
    if (total - displayed >= 1) {
      star = '<span class="star full">★</span>';
      displayed += 1;
    } else if (total - displayed >= 0.5) {
      // Demi-étoile : star-bg en arrière-plan, star-fg masqué à 50%
      star = '<span class="star half"><span class="star-bg">★</span><span class="star-fg">★</span></span>';
      displayed += 0.5;
    } else {
      star = '<span class="star empty">★</span>';
    }
    starsContainer.innerHTML += star;
  }

  document.getElementById('quiz-score').textContent = `${total} / 5`;

  // Message personnalisé selon le score
  const msg = document.getElementById('quiz-thanks-msg');
  if (total >= 4.5) {
    // Excellent (>= 4.5/5)
    msg.textContent = 'We are deeply honoured. Your enthusiasm fuels our pursuit of excellence.';
  } else if (total >= 3) {
    // Bon (3-4.5)
    msg.textContent = 'Thank you for your kind words. We will keep refining every detail of your experience.';
  } else {
    // Médiocre (< 3)
    msg.textContent = 'Thank you for your honesty. Every comment helps us elevate the Ophelia experience.';
  }

  // Transition vers la vue résultats
  document.getElementById('quiz-form-view').style.display   = 'none';
  document.getElementById('quiz-result-view').style.display = 'flex';
}

// ════════════════════════════════════════════════════════════════
// INITIALISATION GLOBALE (point d'entrée de l'application)
// 'DOMContentLoaded' = événement déclenché quand le HTML est totalement chargé
// (équivalent du jQuery $(document).ready())
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialiser l'authentification (vérifie la session existante)
  // await = attend que la fonction async termine avant de continuer
  await initAuth();

  // 2. Attacher les événements de la navbar (boutons, dropdown, etc.)
  initNavbarEvents();

  // 3. Initialiser la musique d'ambiance
  Ambient.init();

  // 4. Afficher la page d'accueil par défaut
  Router.go('home');
});
