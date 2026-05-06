/* ═══════════════════════════════════════════════════════════════
   SMARTROOM.JS — Gestion de l'état de la chambre intelligente
   Équivalent de lib/providers/smart_room_provider.dart (Flutter)

   Gère : lumière, température, stores, mode, synchronisation Supabase
   ═══════════════════════════════════════════════════════════════ */

// ─── ÉTAT GLOBAL DE LA SMART ROOM ─────────────────────────────
// Objet "singleton" qui contient toutes les infos de la chambre intelligente
// Toutes les pages peuvent y accéder via la variable globale "SmartRoom"
const SmartRoom = {
  lightOn:     true,    // true = lumière allumée, false = éteinte
  temperature: 22,      // Température en °C (valeur par défaut au check-in)
  blindsOpen:  false,   // true = stores ouverts, false = fermés
  mode:        'night', // Mode actif : 'night' | 'sleep' | 'work'
  smartRoomId: null,    // UUID de la ligne dans la table Supabase smart_room_states
  roomNumber:  '312',   // Numéro de chambre affiché à l'écran (factice)
  checkinTime: null,    // Date/heure du check-in (ISO string)

  // Minuterie de "debounce" : évite d'envoyer trop de requêtes Supabase
  // quand l'utilisateur modifie rapidement la température (clic répété)
  // On attend 500ms après le DERNIER clic avant d'envoyer la requête
  _debounceTimer: null,

  // ── Réinitialisation (au moment du check-out) ────────────────
  // Remet toutes les valeurs à leur état par défaut
  // Appelé depuis Auth.signOut() et après le check-out
  reset() {
    this.lightOn     = true;       // Réactive la lumière
    this.temperature = 22;         // Température neutre par défaut
    this.blindsOpen  = false;      // Stores fermés
    this.mode        = 'night';    // Mode "nuit" par défaut
    this.smartRoomId = null;       // Plus de chambre liée
    this.roomNumber  = '312';      // Numéro factice par défaut
    this.checkinTime = null;       // Pas de check-in actif
    clearTimeout(this._debounceTimer); // Annule toute synchro en attente
  },

  // ── Setters qui déclenchent la synchronisation ───────────────
  // Chaque setter : 1) modifie l'état, 2) met à jour l'UI, 3) sync Supabase

  // Allume/éteint la lumière (basculement)
  toggleLight() {
    this.lightOn = !this.lightOn;  // Inverse l'état actuel
    this._updateUI();              // Rafraîchit les éléments DOM
    this._sync();                  // Envoie le changement à Supabase
  },

  // Modifie la température en respectant les limites physiques
  setTemperature(t) {
    // Limites : entre 16°C et 30°C (sécurité)
    // Math.max(16, ...) → minimum 16, Math.min(30, ...) → maximum 30
    this.temperature = Math.max(16, Math.min(30, t));
    this._updateUI();
    this._sync();
  },

  // Ouvre/ferme les stores (basculement)
  toggleBlinds() {
    this.blindsOpen = !this.blindsOpen;
    this._updateUI();
    this._sync();
  },

  // ── Modes intelligents ───────────────────────────────────────
  // Identique à setMode() dans SmartRoomProvider Flutter
  // Chaque mode applique un preset prédéfini (lumière + temp + stores)
  setMode(m) {
    this.mode = m;  // Enregistre le nouveau mode
    switch (m) {
      case 'night':                    // Mode nuit (relax)
        this.lightOn     = false;      //   → lumière éteinte
        this.temperature = 20;         //   → temp légèrement fraîche
        this.blindsOpen  = false;      //   → stores fermés (intimité)
        break;
      case 'sleep':                    // Mode sommeil (plus froid)
        this.lightOn     = false;      //   → lumière éteinte
        this.temperature = 19;         //   → optimal pour dormir
        this.blindsOpen  = false;      //   → stores fermés (obscurité)
        break;
      case 'work':                     // Mode travail (productif)
        this.lightOn     = true;       //   → lumière allumée
        this.temperature = 22;         //   → température confortable
        this.blindsOpen  = true;       //   → stores ouverts (lumière naturelle)
        break;
    }
    this._updateUI();  // Rafraîchit l'écran après le changement
    this._sync();      // Synchronise avec Supabase
  },

  // ── Mise à jour de l'interface Smart Room ───────────────────
  // Appelée à chaque changement d'état pour mettre à jour les éléments DOM
  // Le préfixe "_" signifie "méthode privée" (convention JS)
  _updateUI() {
    // Récupération de tous les éléments de la page (peuvent ne pas exister)
    const tempDisplay   = document.getElementById('temp-display');   // "22°C"
    const lightDisplay  = document.getElementById('light-display');  // "On"/"Off"
    const blindsDisplay = document.getElementById('blinds-display'); // "Open"/"Closed"
    const lightToggle   = document.getElementById('light-toggle');   // <input type=checkbox>
    const blindsToggle  = document.getElementById('blinds-toggle');  // <input type=checkbox>
    const infoTemp      = document.getElementById('info-temp');      // Onglet "Info"
    const infoMode      = document.getElementById('info-mode');      // Onglet "Info"

    // Mise à jour de chaque élément SI il existe (?. évite les erreurs)
    if (tempDisplay)   tempDisplay.textContent   = `${this.temperature}°C`;
    if (lightDisplay)  lightDisplay.textContent  = this.lightOn ? 'On' : 'Off';
    if (blindsDisplay) blindsDisplay.textContent = this.blindsOpen ? 'Open' : 'Closed';
    if (lightToggle)   lightToggle.checked        = this.lightOn;   // checkbox cochée ?
    if (blindsToggle)  blindsToggle.checked       = this.blindsOpen;
    if (infoTemp)      infoTemp.textContent       = `${this.temperature}°C`;
    // Première lettre en majuscule : "night" → "Night"
    if (infoMode)      infoMode.textContent       = this.mode.charAt(0).toUpperCase() + this.mode.slice(1);

    // Mise à jour des boutons de mode (active/inactive)
    // On ajoute la classe "active" sur le bouton du mode courant uniquement
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === this.mode);
    });
  },

  // ── Synchronisation avec Supabase (avec debounce 500ms) ─────
  // Évite de surcharger l'API si l'utilisateur change la temp rapidement
  // Exemple : 5 clics sur +/- en 1 seconde = 1 seule requête envoyée
  _sync() {
    if (!this.smartRoomId) return; // Pas de smart room active → on ne sync rien

    // Annule la requête précédente si elle n'a pas encore été envoyée
    clearTimeout(this._debounceTimer);

    // Programme une nouvelle requête dans 500ms
    this._debounceTimer = setTimeout(async () => {
      try {
        // Envoi à Supabase via la fonction définie dans api.js
        await apiUpdateSmartRoom(this.smartRoomId, {
          light_on:    this.lightOn,
          temperature: this.temperature,
          blinds_open: this.blindsOpen,
          mode:        this.mode,
        });
      } catch {
        // Erreur silencieuse — les contrôles continuent de fonctionner hors ligne
        // L'UI reste réactive même sans connexion réseau
        console.warn('Smart Room sync failed (offline mode)');
      }
    }, 500);
  }
};

// ─── INITIALISATION DE LA PAGE SMART ROOM ─────────────────────
// Attache tous les événements aux boutons et toggles du Smart Room
// Appelée par le router quand on entre sur la page 'smartroom'
function initSmartRoomPage() {
  // ── Contrôle de la température ──────────────────────────────
  // Bouton "−" : diminue d'1°C (le ?. évite l'erreur si le bouton n'existe pas)
  document.getElementById('temp-minus')
    ?.addEventListener('click', () => SmartRoom.setTemperature(SmartRoom.temperature - 1));

  // Bouton "+" : augmente d'1°C
  document.getElementById('temp-plus')
    ?.addEventListener('click', () => SmartRoom.setTemperature(SmartRoom.temperature + 1));

  // ── Toggle de la lumière ─────────────────────────────────────
  // 'change' = quand l'utilisateur clique sur la checkbox/switch
  document.getElementById('light-toggle')
    ?.addEventListener('change', () => SmartRoom.toggleLight());

  // ── Toggle des stores ────────────────────────────────────────
  document.getElementById('blinds-toggle')
    ?.addEventListener('change', () => SmartRoom.toggleBlinds());

  // ── Boutons de modes intelligents ────────────────────────────
  // querySelectorAll = sélectionne TOUS les boutons avec class="mode-btn"
  // forEach = pour chaque bouton, on attache un click qui lit data-mode
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => SmartRoom.setMode(btn.dataset.mode));
  });

  // ── Boutons d'onglets (Controls / Requests / Info) ───────────
  // 3 onglets dans la page Smart Room — un seul visible à la fois
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab; // ex: "controls", "requests" ou "info"

      // Mise à jour visuelle des boutons d'onglets
      // 1) On enlève "active" de tous les boutons
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      // 2) On ajoute "active" sur celui cliqué
      btn.classList.add('active');

      // Affichage du bon panneau (les autres sont cachés)
      document.getElementById('tab-controls').style.display  = tabId === 'controls'  ? 'block' : 'none';
      document.getElementById('tab-requests').style.display  = tabId === 'requests'  ? 'block' : 'none';
      document.getElementById('tab-info').style.display      = tabId === 'info'      ? 'block' : 'none';
    });
  });

  // ── Sélecteur de type de requête (Cleaning / Complaint / Food) ──
  // 3 sous-onglets dans l'onglet "Requests"
  document.querySelectorAll('.req-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type; // "cleaning" | "complaint" | "food_order"

      // Boutons actifs : même logique que les onglets ci-dessus
      document.querySelectorAll('.req-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Affichage du bon panneau de requête
      // On parcourt les 3 types et on n'affiche que celui qui correspond
      ['cleaning', 'complaint', 'food_order'].forEach(t => {
        const panel = document.getElementById(`req-panel-${t}`);
        if (panel) panel.style.display = t === type ? 'block' : 'none';
      });

      // Cache le message de succès si on change de type (UX propre)
      const successMsg = document.getElementById('req-success-msg');
      if (successMsg) successMsg.style.display = 'none';
    });
  });

  // ── Bouton de nettoyage ──────────────────────────────────────
  // Envoie une requête simple sans formulaire (juste un click)
  document.getElementById('cleaning-btn')
    ?.addEventListener('click', () => sendRoomServiceRequest('cleaning', {
      subject: 'Cleaning request'
    }));

  // ── Bouton de plainte ────────────────────────────────────────
  // Récupère sujet + détails depuis le formulaire avant d'envoyer
  document.getElementById('complaint-btn')
    ?.addEventListener('click', () => {
      // .trim() enlève les espaces inutiles au début/fin
      const subject = document.getElementById('complaint-subject').value.trim();
      const details = document.getElementById('complaint-details').value.trim();
      // Validation : sujet obligatoire
      if (!subject) { alert('Please enter a subject.'); return; }
      sendRoomServiceRequest('complaint', { subject, details });
    });

  // ── Bouton commande de nourriture ─────────────────────────────
  document.getElementById('food-order-btn')
    ?.addEventListener('click', () => {
      // Récupère les items du panier depuis le DOM (data-qty)
      const cartItems = [];
      document.querySelectorAll('.food-item').forEach(el => {
        // parseInt convertit "3" (string) en 3 (number)
        const qty = parseInt(el.dataset.qty || '0');
        if (qty > 0) {
          // Seuls les items avec quantité > 0 sont ajoutés
          cartItems.push({
            name:  el.dataset.name,
            price: parseInt(el.dataset.price),
            qty
          });
        }
      });

      // Validation : au moins un item dans le panier
      if (cartItems.length === 0) {
        alert('Please add items to your order.');
        return;
      }

      // Envoi de la commande à Supabase
      sendRoomServiceRequest('food_order', {
        subject: 'Food order',
        items:   cartItems
      });
    });

  // ── Boutons de check-out ─────────────────────────────────────
  // 2 boutons dans la page (en haut + dans onglet Info) → même action
  document.getElementById('smartroom-checkout-btn')
    ?.addEventListener('click', () => Router.go('checkout'));

  document.getElementById('smartroom-checkout-btn-2')
    ?.addEventListener('click', () => Router.go('checkout'));

  // ── Génération du menu nourriture ────────────────────────────
  // Crée dynamiquement les <div> du menu à partir de FOOD_MENU
  renderFoodMenu();

  // ── Mise à jour initiale de l'interface ──────────────────────
  // Affiche les valeurs courantes (au cas où on revient sur la page)
  SmartRoom._updateUI();
  updateSmartRoomHeader();
}

// ─── GÉNÉRATION DU MENU NOURRITURE ────────────────────────────
// Crée dynamiquement les éléments du menu à partir de FOOD_MENU (config.js)
// Appelée une seule fois lors de l'init de la page smartroom
function renderFoodMenu() {
  const menuEl = document.getElementById('food-menu');
  if (!menuEl) return; // Sécurité si l'élément n'existe pas

  // .map() transforme chaque item en HTML, .join('') concatène le tout
  // data-* = attributs personnalisés pour stocker les infos sur l'élément
  menuEl.innerHTML = FOOD_MENU.map((item, i) => `
    <div class="food-item" data-name="${item.name}" data-price="${item.price}" data-qty="0" id="food-item-${i}">
      <div>
        <div class="food-item-name">${item.name}</div>
        <div class="food-item-price">${item.price} DT</div>
      </div>
      <div class="food-item-controls">
        <button class="food-qty-btn" onclick="updateFoodQty(${i}, -1)">−</button>
        <span class="food-qty" id="food-qty-${i}">0</span>
        <button class="food-qty-btn" onclick="updateFoodQty(${i}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

// ─── MISE À JOUR DE LA QUANTITÉ D'UN ITEM ─────────────────────
// Appelée par les boutons +/- du menu (delta = +1 ou -1)
function updateFoodQty(index, delta) {
  const item = document.getElementById(`food-item-${index}`);
  const qtyEl = document.getElementById(`food-qty-${index}`);
  if (!item || !qtyEl) return; // Sécurité

  // Lit la quantité actuelle, ajoute le delta
  let qty = parseInt(item.dataset.qty || '0') + delta;
  qty = Math.max(0, qty);          // Empêche les valeurs négatives
  item.dataset.qty = qty;          // Sauvegarde dans le DOM
  qtyEl.textContent = qty;         // Met à jour l'affichage

  updateCartSummary();             // Recalcule le total
}

// ─── MISE À JOUR DU RÉSUMÉ DU PANIER ──────────────────────────
// Recalcule le total et affiche le récapitulatif si panier non vide
function updateCartSummary() {
  const cartSummary = document.getElementById('cart-summary');
  const cartItemsEl = document.getElementById('cart-items');
  const cartTotal   = document.getElementById('cart-total-amount');

  let total = 0;       // Total cumulé
  const lines = [];    // Lignes HTML à afficher

  // Parcourt tous les items du menu
  document.querySelectorAll('.food-item').forEach(el => {
    const qty = parseInt(el.dataset.qty || '0');
    if (qty > 0) {
      const price = parseInt(el.dataset.price);
      total += qty * price;  // Ajoute au total
      // Crée une ligne HTML : "Pizza ×2    36 DT"
      lines.push(`<div class="price-line"><span>${el.dataset.name} ×${qty}</span><span>${qty * price} DT</span></div>`);
    }
  });

  // Affiche ou cache le résumé selon qu'il y a des items
  if (lines.length > 0) {
    cartSummary.style.display = 'block';
    cartItemsEl.innerHTML = lines.join('');
    cartTotal.textContent = `${total} DT`;
  } else {
    cartSummary.style.display = 'none'; // Panier vide → résumé caché
  }
}

// ─── ENVOI D'UNE REQUÊTE DE SERVICE ───────────────────────────
// Fonction commune pour les 3 types : cleaning, complaint, food_order
// Le {} après les paramètres permet une "destructuration" avec valeurs par défaut
async function sendRoomServiceRequest(type, { subject = null, details = null, items = null } = {}) {
  // Vérification : utilisateur connecté ?
  if (!Auth.isLoggedIn || !Auth.user) {
    alert('Please sign in to send a request.');
    return;
  }

  // Désactivation des boutons pendant l'envoi (évite les doubles clics)
  // Cas spécial pour "food_order" qui a un id différent
  const btn = document.getElementById(`${type.replace('_order','')}-btn`) ||
              document.getElementById('food-order-btn');
  if (btn) btn.disabled = true;

  try {
    // Insertion dans la table room_service_requests via Supabase
    await apiCreateRoomServiceRequest({
      user_id:       Auth.user.id,         // FK vers profiles
      smart_room_id: SmartRoom.smartRoomId, // FK vers smart_room_states
      request_type:  type,                  // 'cleaning' | 'complaint' | 'food_order'
      subject,
      details,
      // JSON.stringify pour stocker un tableau dans une colonne TEXT
      items:         items ? JSON.stringify(items) : null,
      status:        'pending',             // Toujours "pending" à la création
    });

    // Afficher le message de succès pendant 3 secondes
    const msg = document.getElementById('req-success-msg');
    if (msg) {
      msg.style.display = 'block';
      // setTimeout = exécute la fonction après 3000ms (3s)
      setTimeout(() => { msg.style.display = 'none'; }, 3000);
    }

    // Réinitialiser les champs selon le type de requête
    if (type === 'complaint') {
      // Vide les inputs de plainte
      document.getElementById('complaint-subject').value = '';
      document.getElementById('complaint-details').value = '';
    }
    if (type === 'food_order') {
      // Vider le panier (remettre toutes les quantités à 0)
      document.querySelectorAll('.food-item').forEach(el => {
        el.dataset.qty = '0';
        const i = el.id.replace('food-item-', ''); // Récupère l'index
        const qtyEl = document.getElementById(`food-qty-${i}`);
        if (qtyEl) qtyEl.textContent = '0';
      });
      updateCartSummary(); // Cache le résumé du panier
    }

  } catch (e) {
    // Erreur réseau / Supabase → message à l'utilisateur
    alert(`Failed to send request: ${e.message}`);
  } finally {
    // "finally" s'exécute TOUJOURS (succès ou erreur)
    // Réactive le bouton pour permettre de réessayer
    if (btn) btn.disabled = false;
  }
}

// ─── MISE À JOUR DE L'EN-TÊTE DE LA SMART ROOM ────────────────
// Affiche le numéro de chambre, le nom de l'hôtel et l'heure de check-in
function updateSmartRoomHeader() {
  // Récupération des éléments DOM (peuvent ne pas exister selon la page)
  const nameEl  = document.getElementById('smartroom-name');
  const hotelEl = document.getElementById('smartroom-hotel');
  const infoRoom = document.getElementById('info-room');
  const infoHotel = document.getElementById('info-hotel');
  const infoCheckin = document.getElementById('info-checkin-time');

  // En-tête principal
  if (nameEl)  nameEl.textContent  = `Room ${SmartRoom.roomNumber}`;
  if (hotelEl) hotelEl.textContent = Auth.activeHotelName || 'Ophelia Hotel';

  // Onglet "Info" (détails de séjour)
  if (infoRoom)  infoRoom.textContent  = SmartRoom.roomNumber;
  if (infoHotel) infoHotel.textContent = Auth.activeHotelName || 'Ophelia Hotel';

  // Affiche la date/heure de check-in formatée selon la locale du navigateur
  if (infoCheckin && SmartRoom.checkinTime) {
    infoCheckin.textContent = new Date(SmartRoom.checkinTime).toLocaleString();
  }
}
