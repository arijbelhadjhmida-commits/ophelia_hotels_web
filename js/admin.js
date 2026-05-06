/* ═══════════════════════════════════════════════════════════════
   ADMIN.JS — Logique complète du tableau de bord administrateur
   Équivalent de lib/screens/admin_dashboard.dart (Flutter)

   Gère les 5 onglets :
   1. Overview   — statistiques globales (stat cards + 4 graphiques)
   2. Reservations — liste de toutes les réservations
   3. Smart Rooms — chambres actuellement actives
   4. Requests   — requêtes de service (cleaning, food, complaints)
   5. Users      — liste de tous les utilisateurs
   ═══════════════════════════════════════════════════════════════ */

// ─── DONNÉES CHARGÉES ─────────────────────────────────────────
// Stockées en mémoire après le premier chargement
// "let" (au lieu de "const") car on remplace l'objet entier au refresh
let adminData = {
  stats:        null,    // Statistiques globales (revenu, totaux)
  reservations: [],      // Toutes les réservations
  smartRooms:   [],      // Smart Rooms actives uniquement
  requests:     [],      // Toutes les requêtes de service
  users:        [],      // Tous les profils (admins inclus)
};

// ─── ONGLET ACTIF ─────────────────────────────────────────────
// Mémorise l'onglet actuellement affiché (pour le re-render au refresh)
let activeTab = 'overview';

// ════════════════════════════════════════════════════════════════
// CHARGEMENT DES DONNÉES ADMIN
// Équivalent de _load() dans _AdminDashboardState
// ════════════════════════════════════════════════════════════════
async function loadAdminData() {
  showLoading(true);   // Affiche le spinner
  hideError();         // Cache les erreurs précédentes

  try {
    // Chargement en parallèle de 5 endpoints (identique à Future.wait())
    // Promise.all attend que TOUTES les requêtes terminent
    // Avantage : 5 requêtes × 200ms = 200ms (parallèle) vs 1000ms (séquentiel)
    // La destructuration [a, b, c] récupère les résultats dans l'ordre
    const [stats, reservations, smartRooms, requests, users] = await Promise.all([
      apiGetAdminStats(),                   // Stats agrégées
      apiGetAllReservations(),              // Toutes les résa
      apiGetAllActiveSmartRooms(),          // Smart rooms actives uniquement
      apiGetAllRoomServiceRequests(),       // Toutes les requêtes
      apiGetAllProfiles(),                  // Tous les profils
    ]);

    // Stockage en mémoire pour le re-render rapide entre les onglets
    adminData.stats        = stats;
    adminData.reservations = reservations;
    adminData.smartRooms   = smartRooms;
    adminData.requests     = requests;
    adminData.users        = users;

    // Affiche l'onglet actif avec les données fraîches
    renderActiveTab();

  } catch (e) {
    // Erreur réseau / Supabase → bannière d'erreur
    showError(`Failed to load admin data: ${e.message}`);
  } finally {
    // Toujours cacher le spinner (succès ou échec)
    showLoading(false);
  }
}

// ─── RENDU DE L'ONGLET ACTIF ──────────────────────────────────
// Aiguillage vers la bonne fonction de rendu selon activeTab
function renderActiveTab() {
  switch (activeTab) {
    case 'overview':      renderOverview();      break;  // Stats + graphiques
    case 'reservations':  renderReservations();  break;  // Liste résa
    case 'smartrooms':    renderSmartRooms();    break;  // Liste smart rooms
    case 'requests':      renderRequests();      break;  // Liste requêtes
    case 'users':         renderUsers();         break;  // Liste users
  }
}

// ════════════════════════════════════════════════════════════════
// ONGLET 1 : OVERVIEW — renderOverview()
// Équivalent de _OverviewTab dans admin_dashboard.dart
// Affiche : 5 cartes de stats + 4 graphiques (donut, bars, hbars, stack)
// ════════════════════════════════════════════════════════════════
function renderOverview() {
  const s = adminData.stats;
  if (!s) return; // Sécurité si stats pas encore chargées

  showPanel('overview'); // Affiche le panneau et cache les autres

  // Animation : compte progressif de 0 → valeur cible (effet "comptage")
  // Le 2ème arg de animateCount est la valeur, le 3ème un suffixe
  animateCount('stat-reservations', s.total_reservations);
  animateCount('stat-stays',        s.active_stays);
  animateCount('stat-requests',     s.pending_requests);
  animateCount('stat-users',        s.total_users);
  animateCount('stat-revenue',      s.total_revenue, ' DT');

  // Rejoue les animations reveal-up et bar-fill à chaque rendu
  // Astuce : mettre animation à 'none' puis à '' force un reset
  document.querySelectorAll('#panel-overview .reveal-up').forEach(el => {
    el.style.animation = 'none';
    void el.offsetWidth;        // Force reflow (sinon l'anim ne rejoue pas)
    el.style.animation = '';    // Restaure l'animation depuis CSS
  });
  document.querySelectorAll('#panel-overview .stat-bar-fill').forEach(el => {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  });

  // Rendu des 4 graphiques SVG
  renderCharts();
}

// ════════════════════════════════════════════════════════════════
// GRAPHIQUES DU DASHBOARD
// 4 graphiques faits main en SVG (pas de bibliothèque externe)
// ════════════════════════════════════════════════════════════════

// Palette de couleurs pour les graphiques (par hôtel)
const CHART_COLORS = {
  seaside:   '#4D0E13',  // Bordeaux pour Seaside
  evergreen: '#CDAA80',  // Doré pour Evergreen
  sahara:    '#C8A49F',  // Rose poudré pour Sahara
  fallback:  '#A8884E',  // Couleur par défaut si hôtel inconnu
};

// Lance le rendu des 4 graphiques (appelée par renderOverview)
function renderCharts() {
  renderRevenueDonut();         // Donut : revenu par hôtel
  renderReservationsBars();     // Bars verticaux : nb réservations par hôtel
  renderRequestsHBars();        // Bars horizontaux : requêtes par type
  renderStatusStack();          // Stacked bar : statuts des résa
}

/**
 * Donut : revenu par hôtel
 * Affiche un cercle SVG divisé en arcs proportionnels au revenu
 */
function renderRevenueDonut() {
  // Agrège les revenus par hôtel : { seaside: 12000, evergreen: 8500, ... }
  const byHotel = {};
  for (const r of adminData.reservations) {
    // r.hotel_id en priorité, sinon hotel_name, sinon 'unknown'
    const key = r.hotel_id || r.hotel_name || 'unknown';
    // (byHotel[key] || 0) : si key n'existe pas encore, démarre à 0
    byHotel[key] = (byHotel[key] || 0) + (r.total_price || 0);
  }

  // Object.entries → [['seaside', 12000], ['evergreen', 8500], ...]
  const entries = Object.entries(byHotel);
  // .reduce + destructuration [, v] (on ignore la clé) pour calculer le total
  const total = entries.reduce((s, [, v]) => s + v, 0);

  // Récupération des éléments DOM du graphique
  const segs = document.getElementById('donut-segments');
  const legend = document.getElementById('donut-legend');
  const totalEl = document.getElementById('donut-total');
  if (!segs) return;

  // Reset des contenus avant rendu
  segs.innerHTML = '';
  legend.innerHTML = '';
  totalEl.textContent = formatNum(total);

  // Cas : aucun revenu → affiche un message
  if (total === 0) {
    legend.innerHTML = '<div class="admin-empty" style="padding:1rem">No revenue yet</div>';
    return;
  }

  // Circonférence du cercle : 2πr avec r=80 (rayon SVG)
  // = 502.65 (utilisé pour le calcul des stroke-dasharray)
  const CIRC = 2 * Math.PI * 80;
  let offset = 0; // Décalage cumulé pour positionner chaque segment

  // Pour chaque hôtel, on crée un segment de cercle
  entries.forEach(([key, val], i) => {
    const pct = val / total;        // Pourcentage du total
    const len = pct * CIRC;          // Longueur de l'arc en pixels
    const color = CHART_COLORS[key] || CHART_COLORS.fallback;
    // Nom avec première lettre majuscule : "seaside" → "Seaside"
    const hotelName = (HOTELS_NAMES[key] || key).replace(/^\w/, c => c.toUpperCase());

    // Création du segment SVG (cercle avec stroke partiel)
    // createElementNS = pour SVG il faut le namespace XML SVG
    const seg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    seg.setAttribute('class', 'donut-segment');
    seg.setAttribute('cx', '100');           // Centre X
    seg.setAttribute('cy', '100');           // Centre Y
    seg.setAttribute('r', '80');             // Rayon
    seg.setAttribute('stroke', color);
    // Variables CSS personnalisées (--len et --d)
    // Lues depuis le CSS pour animer le segment
    seg.style.setProperty('--len', len);
    seg.style.setProperty('--d', `${i * 200}ms`); // Délai stagger
    // strokeDashoffset négatif = décale le segment dans le cercle
    seg.style.strokeDashoffset = `-${offset}`;
    segs.appendChild(seg);

    offset += len; // Le prochain segment commence où celui-ci finit

    // Ligne de légende (couleur + nom + montant)
    legend.innerHTML += `
      <div class="legend-row">
        <span class="legend-swatch" style="background:${color}"></span>
        <span class="legend-name">${hotelName}</span>
        <span class="legend-value">${formatNum(val)} DT</span>
      </div>
    `;
  });
}

// Map ID → Display name (fallback dynamique depuis HOTELS si dispo)
// .reduce sur HOTELS pour construire { seaside: 'Seaside Hotel', ... }
// (acc[h.id] = h.name, acc) : assigne puis retourne acc (virgule = séquence)
const HOTELS_NAMES = (typeof HOTELS !== 'undefined' && HOTELS)
  ? HOTELS.reduce((acc, h) => (acc[h.id] = h.name, acc), {})
  : { seaside: 'Seaside', evergreen: 'Evergreen', sahara: 'Sahara' };

/**
 * Bar chart vertical : nombre de réservations par hôtel
 * Hauteur des barres proportionnelle au max (75% pour le numéro au-dessus)
 */
function renderReservationsBars() {
  // Compte les réservations par hôtel
  const byHotel = {};
  for (const r of adminData.reservations) {
    const key = r.hotel_id || r.hotel_name || 'unknown';
    byHotel[key] = (byHotel[key] || 0) + 1;
  }

  const entries = Object.entries(byHotel);
  // Math.max(1, ...) : évite la division par 0 si toutes valeurs = 0
  // ...spread : étale le tableau de valeurs en arguments
  const max = Math.max(1, ...entries.map(([, v]) => v));

  const wrap = document.getElementById('bars-reservations');
  if (!wrap) return;

  // Si aucune réservation
  if (entries.length === 0) {
    wrap.innerHTML = '<div class="admin-empty" style="margin:auto">No reservations yet</div>';
    return;
  }

  // Génère une colonne par hôtel
  wrap.innerHTML = entries.map(([key, val], i) => {
    // Hauteur en % : 75% max pour laisser place à la valeur en haut
    const heightPct = (val / max) * 75;
    // Limite à 9 caractères pour éviter le débordement
    const name = (HOTELS_NAMES[key] || key).slice(0, 9);
    return `
      <div class="bar-col">
        <div class="bar-fill" style="--h:${heightPct}%; --d:${i * 150}ms">
          <span class="bar-value" style="--d:${i * 150}ms">${val}</span>
        </div>
        <span class="bar-label">${name}</span>
      </div>
    `;
  }).join('');
}

/**
 * Bars horizontales : nombre de requêtes par type
 * cleaning / complaint / food_order
 */
function renderRequestsHBars() {
  // Compte par type — initialise les 3 types à 0
  const byType = { cleaning: 0, complaint: 0, food_order: 0 };
  for (const r of adminData.requests) {
    // !== undefined : on n'incrémente que si le type est connu
    if (byType[r.request_type] !== undefined) byType[r.request_type]++;
  }

  // Max parmi les 3 valeurs (pour normaliser les barres)
  const max = Math.max(1, ...Object.values(byType));
  const wrap = document.getElementById('hbars-requests');
  if (!wrap) return;

  // Génère une ligne par type
  wrap.innerHTML = Object.entries(byType).map(([type, val], i) => {
    const widthPct = (val / max) * 100;
    // "food_order" → "food order" pour l'affichage
    const label = type.replace('_', ' ');
    return `
      <div class="hbar-row">
        <span class="hbar-label">${label}</span>
        <div class="hbar-track">
          <div class="hbar-fill" style="--w:${widthPct}%; --d:${i * 200}ms"></div>
        </div>
        <span class="hbar-value">${val}</span>
      </div>
    `;
  }).join('');
}

/**
 * Status stack bar : répartition des réservations par statut
 * Une barre horizontale avec un segment coloré par statut
 */
function renderStatusStack() {
  // Compte les statuts (objet { confirmed: 12, active: 5, ... })
  const counts = {};
  for (const r of adminData.reservations) {
    const s = r.status || 'pending';
    counts[s] = (counts[s] || 0) + 1;
  }

  // Total pour calculer les pourcentages
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const stack = document.getElementById('status-bar-stack');
  const legend = document.getElementById('status-legend');
  if (!stack) return;

  // Cas vide
  if (total === 0) {
    stack.innerHTML = '';
    legend.innerHTML = '<div class="admin-empty" style="padding:0.5rem">No reservations</div>';
    return;
  }

  // Ordre fixe d'affichage des statuts (gauche → droite)
  const order = ['confirmed', 'active', 'completed', 'pending', 'in_progress', 'cancelled'];
  // Couleur dédiée à chaque statut
  const colorMap = {
    confirmed:   '#2563EB',  // Bleu
    active:      '#16A34A',  // Vert (en cours)
    completed:   '#4D0E13',  // Bordeaux (fini)
    pending:     '#A8884E',  // Doré (en attente)
    in_progress: '#C8A49F',  // Rose poudré
    cancelled:   '#B91C1C',  // Rouge foncé
  };
  // .filter : ne garde que les statuts qui ont au moins 1 résa
  const visible = order.filter(s => counts[s] > 0);

  // Génération de la barre empilée (un segment par statut)
  stack.innerHTML = visible.map((s, i) => {
    const pct = (counts[s] / total) * 100;
    // title="..." = tooltip natif du navigateur au survol
    return `<div class="status-segment" data-status="${s}" style="--w:${pct}%; --d:${i * 150}ms" title="${s}: ${counts[s]}"></div>`;
  }).join('');

  // Légende sous la barre
  legend.innerHTML = visible.map(s => `
    <div class="legend-row">
      <span class="legend-swatch" style="background:${colorMap[s]}"></span>
      <span class="legend-name">${s.replace('_', ' ')}</span>
      <span class="legend-value">${counts[s]}</span>
    </div>
  `).join('');
}

/**
 * Anime un compteur de 0 jusqu'à `target` sur ~1.2s
 * Utilise requestAnimationFrame pour une animation fluide (60fps)
 * @param {string} id     - ID de l'élément à animer
 * @param {number} target - Valeur finale
 * @param {string} suffix - Suffixe à coller (" DT", "%", etc.)
 */
function animateCount(id, target, suffix = '') {
  const el = document.getElementById(id);
  if (!el) return;
  const duration = 1200;          // 1.2 secondes
  const start    = performance.now(); // Timestamp de début (ms haute précision)
  const startVal = 0;             // Démarre à 0

  // Fonction appelée ~60 fois par seconde
  // 'now' = timestamp actuel fourni par requestAnimationFrame
  function step(now) {
    // t = progression de 0 à 1 (jamais > 1)
    const t = Math.min(1, (now - start) / duration);
    // easing "cubic out" : démarre vite, ralentit à la fin (effet naturel)
    // 1 - (1-t)^3 = courbe d'easing classique
    const eased = 1 - Math.pow(1 - t, 3);
    // Valeur courante = interpolation linéaire avec easing appliqué
    const value = Math.round(startVal + (target - startVal) * eased);
    el.textContent = formatNum(value) + suffix;
    // Si pas fini → re-planifie une frame
    if (t < 1) requestAnimationFrame(step);
    // Sinon → s'assure d'afficher exactement la valeur cible
    else el.textContent = formatNum(target) + suffix;
  }
  requestAnimationFrame(step); // Lance la première frame
}

// ════════════════════════════════════════════════════════════════
// ONGLET 2 : RÉSERVATIONS — renderReservations()
// Équivalent de _ReservationsTab dans admin_dashboard.dart
// Liste de cartes : hôtel/service, statut, client, dates, prix
// ════════════════════════════════════════════════════════════════
function renderReservations() {
  const list = document.getElementById('reservations-list');

  // Cas vide
  if (adminData.reservations.length === 0) {
    list.innerHTML = '<div class="admin-empty">No reservations found</div>';
    showPanel('reservations');
    return;
  }

  // Génère une carte par réservation
  list.innerHTML = adminData.reservations.map(r => {
    // Nom complet de l'invité (depuis le join profiles)
    // r.profiles vient de la jointure dans apiGetAllReservations
    const profile  = r.profiles || {};
    // .filter(Boolean) : enlève les valeurs falsy (null, undefined, '')
    // Permet d'avoir "Marie" si le nom manque, "Marie Dupont" si tout est là
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown';

    // Dates ou infos selon le type de réservation
    // Pour 'room' : check-in → check-out
    // Pour autre  : date + nombre de personnes
    const dateInfo = r.reservation_type === 'room'
      ? `${r.check_in || ''} → ${r.check_out || ''}`
      : `${r.booking_date || ''} (${r.persons || 0} pers.)`;

    // Génération du HTML de la carte
    // statusBadge() vient de config.js
    return `
      <div class="res-card">
        <div class="res-card-header">
          <div>
            <div class="res-hotel">${r.hotel_name || '—'} — ${r.service_name || '—'}</div>
          </div>
          ${statusBadge(r.status)}
        </div>
        <div class="res-guest">${fullName} • CIN: ${profile.cin || '—'}</div>
        <div class="res-footer">
          <span class="res-dates">${dateInfo}</span>
          <span class="res-price">${formatNum(r.total_price)} DT</span>
        </div>
      </div>
    `;
  }).join('');

  showPanel('reservations');
}

// ════════════════════════════════════════════════════════════════
// ONGLET 3 : SMART ROOMS — renderSmartRooms()
// Équivalent de _SmartRoomsTab dans admin_dashboard.dart
// Liste des chambres connectées en temps réel (lumière, temp, etc.)
// ════════════════════════════════════════════════════════════════
function renderSmartRooms() {
  const list = document.getElementById('smartrooms-list');

  // Cas vide : aucune chambre active actuellement
  if (adminData.smartRooms.length === 0) {
    list.innerHTML = '<div class="admin-empty">No active smart rooms</div>';
    showPanel('smartrooms');
    return;
  }

  // Une carte par smart room active
  list.innerHTML = adminData.smartRooms.map(r => {
    const profile  = r.profiles || {};
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown';

    // Carte avec point vert (active) + chips d'état (temp, lumière, etc.)
    return `
      <div class="sr-card">
        <div class="sr-card-header">
          <span class="sr-room-name">Room ${r.room_number || '—'} — ${r.hotel_name || '—'}</span>
          <div class="sr-active-dot"></div>
        </div>
        <div class="sr-guest">${fullName} • CIN: ${profile.cin || '—'}</div>
        <div class="sr-chips">
          <span class="sr-chip">${r.temperature || '—'}°C</span>
          <span class="sr-chip">Light: ${r.light_on ? 'On' : 'Off'}</span>
          <span class="sr-chip">Blinds: ${r.blinds_open ? 'Open' : 'Closed'}</span>
          <span class="sr-chip">Mode: ${r.mode || 'normal'}</span>
        </div>
      </div>
    `;
  }).join('');

  showPanel('smartrooms');
}

// ════════════════════════════════════════════════════════════════
// ONGLET 4 : REQUESTS — renderRequests()
// Équivalent de _RequestsTab dans admin_dashboard.dart
// Liste des requêtes de service (cleaning, complaint, food_order)
// avec boutons pour changer le statut
// ════════════════════════════════════════════════════════════════
function renderRequests() {
  const list = document.getElementById('requests-list');

  // Cas vide
  if (adminData.requests.length === 0) {
    list.innerHTML = '<div class="admin-empty">No service requests</div>';
    showPanel('requests');
    return;
  }

  list.innerHTML = adminData.requests.map(r => {
    const profile  = r.profiles || {};
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unknown';

    // Lettre selon le type de requête (au lieu d'emoji pour cohérence design)
    const letters = { cleaning: 'C', complaint: 'X', food_order: 'F' };
    const icon  = letters[r.request_type] || '•';

    // Affichage des items de commande si c'est une commande de nourriture
    // r.items est stocké en JSON (chaîne) dans Supabase → on parse
    let itemsHtml = '';
    if (r.request_type === 'food_order' && r.items) {
      try {
        // Parser : si chaîne JSON, parser ; sinon utiliser tel quel (déjà objet)
        const items = typeof r.items === 'string' ? JSON.parse(r.items) : r.items;
        if (Array.isArray(items)) {
          // Format : "Pizza ×2, Coca ×3"
          itemsHtml = `<div class="req-details">${items.map(i => `${i.name} ×${i.qty}`).join(', ')}</div>`;
        }
      } catch { /* ignore JSON parse error — données malformées */ }
    }

    // Date de création formatée selon la locale du navigateur
    const createdAt = r.created_at
      ? new Date(r.created_at).toLocaleString()
      : '—';

    // HTML de la carte avec boutons d'actions conditionnels
    return `
      <div class="req-card" id="req-${r.id}">
        <div class="req-icon-circle">${icon}</div>
        <div class="req-body">
          <div class="req-type">${(r.request_type || '').replace('_', ' ')}</div>
          <div class="req-subject">${r.subject || '(no subject)'}</div>
          <div class="req-guest">${fullName} • ${createdAt}</div>
          ${r.details ? `<div class="req-details">${r.details}</div>` : ''}
          ${itemsHtml}
          <div class="req-actions">
            ${statusBadge(r.status)}
            <!-- Boutons pour changer le statut -->
            <!-- "Mark In Progress" : visible uniquement si statut = pending -->
            ${r.status === 'pending' ? `
              <button class="req-action-btn in-progress"
                      onclick="updateRequest('${r.id}', 'in_progress')">
                Mark In Progress
              </button>
            ` : ''}
            <!-- "Complete" et "Cancel" : visibles tant que pas terminé -->
            ${r.status !== 'completed' && r.status !== 'cancelled' ? `
              <button class="req-action-btn complete"
                      onclick="updateRequest('${r.id}', 'completed')">
                Complete
              </button>
              <button class="req-action-btn cancel"
                      onclick="updateRequest('${r.id}', 'cancelled')">
                Cancel
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  showPanel('requests');
}

/**
 * Met à jour le statut d'une requête et re-render
 * Appelée par les boutons d'action des cartes (onclick)
 * @param {string} id     - UUID de la requête
 * @param {string} status - Nouveau statut ('in_progress' | 'completed' | 'cancelled')
 */
async function updateRequest(id, status) {
  try {
    // Met à jour Supabase via api.js
    await apiUpdateRequestStatus(id, status);

    // Mise à jour locale (évite un rechargement complet de toutes les données)
    // .find() retourne la requête modifiée (référence vers l'objet dans le tableau)
    const req = adminData.requests.find(r => r.id === id);
    if (req) req.status = status; // Mutation directe : OK car même référence
    renderRequests(); // Re-render avec le nouveau statut

  } catch (e) {
    alert(`Failed to update request: ${e.message}`);
  }
}

// ════════════════════════════════════════════════════════════════
// ONGLET 5 : USERS — renderUsers()
// Équivalent de _UsersTab dans admin_dashboard.dart
// Liste de tous les utilisateurs avec badge "ADMIN" pour les admins
// ════════════════════════════════════════════════════════════════
function renderUsers() {
  const list = document.getElementById('users-list');

  if (adminData.users.length === 0) {
    list.innerHTML = '<div class="admin-empty">No users found</div>';
    showPanel('users');
    return;
  }

  list.innerHTML = adminData.users.map(u => {
    // Première lettre du prénom en MAJUSCULE pour l'avatar
    const initial  = (u.first_name || '?')[0].toUpperCase();
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'Unknown';
    // === true : vérification stricte (true seulement, pas truthy)
    const isAdmin  = u.is_admin === true;

    return `
      <div class="user-item">
        <!-- Avatar avec initiale et couleur selon le rôle -->
        <div class="user-avatar-circle ${isAdmin ? 'admin' : 'regular'}">
          ${initial}
        </div>
        <div class="user-info">
          <div class="user-name">${fullName}</div>
          <div class="user-cin">CIN: ${u.cin || '—'}</div>
        </div>
        ${isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}
      </div>
    `;
  }).join('');

  showPanel('users');
}

// ════════════════════════════════════════════════════════════════
// GESTION DE LA NAVIGATION PAR ONGLETS
// ════════════════════════════════════════════════════════════════

/**
 * Affiche un panneau et cache tous les autres
 * @param {string} tabId - "overview" | "reservations" | "smartrooms" | "requests" | "users"
 */
function showPanel(tabId) {
  // Cacher tous les panneaux (panel-overview, panel-reservations, etc.)
  document.querySelectorAll('.admin-panel').forEach(p => {
    p.style.display = 'none';
  });

  // Afficher le panneau actif (id="panel-XXX")
  const panel = document.getElementById(`panel-${tabId}`);
  if (panel) panel.style.display = 'block';
}

// ─── ÉTATS D'INTERFACE ─────────────────────────────────────────

// Affiche/cache le spinner de chargement
function showLoading(show) {
  // 'flex' (au lieu de 'block') pour centrer avec flexbox
  document.getElementById('admin-loading').style.display = show ? 'flex' : 'none';
  // Cacher tous les panneaux pendant le chargement (UX propre)
  if (show) document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
}

// Affiche la bannière rouge d'erreur en haut
function showError(msg) {
  const banner = document.getElementById('admin-error');
  document.getElementById('admin-error-msg').textContent = msg;
  banner.style.display = 'flex';
}

// Cache la bannière d'erreur
function hideError() {
  document.getElementById('admin-error').style.display = 'none';
}

// ─── VÉRIFICATION DE L'ACCÈS ADMIN ────────────────────────────
// Si l'utilisateur n'est pas connecté ou n'est pas admin → redirection
// Utilisée au chargement de admin.html pour bloquer l'accès non autorisé
async function checkAdminAccess() {
  // Vérifier la session Supabase (token JWT en localStorage)
  const session = await db.auth.getSession();

  if (!session.data.session) {
    // Pas de session → utilisateur non connecté
    window.location.href = 'index.html'; // Redirection vers l'accueil
    return false;
  }

  // Vérifier que c'est bien un admin (lecture du profil)
  // .single() : retourne UN objet, pas un tableau
  const { data: profile } = await db
    .from('profiles')
    .select('is_admin')
    .eq('id', session.data.session.user.id)
    .single();

  // ?. : optional chaining (évite erreur si profile est null)
  if (!profile?.is_admin) {
    // User connecté mais pas admin → redirection
    window.location.href = 'index.html';
    return false;
  }

  return true; // Accès autorisé
}

// ════════════════════════════════════════════════════════════════
// INITIALISATION AU CHARGEMENT DU DOM (admin.html)
// Point d'entrée du dashboard admin
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Vérifier l'accès admin (sinon redirection automatique)
  const hasAccess = await checkAdminAccess();
  if (!hasAccess) return; // Stoppe l'init si pas autorisé

  // 2. Attacher les événements des onglets (5 onglets en haut)
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Mise à jour visuelle : "active" sur l'onglet cliqué uniquement
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Changer d'onglet et re-render
      activeTab = tab.dataset.tab;       // Lit l'attribut data-tab
      renderActiveTab();
    });
  });

  // 3. Bouton de rafraîchissement (en haut à droite)
  document.getElementById('admin-refresh-btn').addEventListener('click', loadAdminData);

  // 4. Bouton de déconnexion → signOut puis redirection
  document.getElementById('admin-logout-btn').addEventListener('click', async () => {
    await db.auth.signOut();
    window.location.href = 'index.html';
  });

  // 5. Bouton "Retry" en cas d'erreur de chargement
  document.getElementById('admin-retry-btn').addEventListener('click', loadAdminData);

  // 6. Charger les données admin (5 endpoints en parallèle)
  await loadAdminData();
});
