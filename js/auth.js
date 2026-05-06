/* ═══════════════════════════════════════════════════════════════
   AUTH.JS — Gestion de l'état d'authentification
   Équivalent de lib/providers/auth_provider.dart (Flutter)

   Gère : connexion, déconnexion, profil utilisateur, séjour actif
   ═══════════════════════════════════════════════════════════════ */

// ─── ÉTAT GLOBAL DE L'AUTHENTIFICATION ────────────────────────
// Cet objet est la "source de vérité" pour l'état de l'utilisateur
// (Équivalent du ChangeNotifier en Flutter)
// Toutes les pages lisent et écrivent dans Auth via les méthodes ci-dessous

const Auth = {
  user:               null,    // Objet user Supabase brut (id, email, metadata)
  profile:            null,    // Profil DB (first_name, last_name, is_admin, cin, etc.)
  isLoggedIn:         false,   // true si user + session valides
  isAdmin:            false,   // true si profile.is_admin === true
  hasActiveStay:      false,   // L'utilisateur est-il actuellement en séjour ?
  activeReservationId:null,    // ID de la réservation active (UUID)
  activeHotelName:    null,    // Nom de l'hôtel du séjour actif (pour navbar/header)
  loading:            false,   // true pendant les requêtes (pour spinner)
  error:              null,    // Dernier message d'erreur (affiché aux formulaires)

  // ── Connexion ────────────────────────────────────────────────
  // Prend un CIN + mot de passe, contacte Supabase et met à jour l'état
  async signIn(cin, password) {
    this.loading = true;       // Active le spinner
    this.error   = null;       // Réinitialise les erreurs précédentes
    updateNavbar();            // Met à jour la navbar (état "loading")

    // Appel à l'API Supabase (défini dans api.js)
    const result = await apiSignIn(cin, password);

    // Cas 1 : Erreur (mauvais CIN/mdp, réseau, etc.)
    if (result.error) {
      this.error   = result.error;
      this.loading = false;
      updateNavbar();
      return false;            // Retour false → le formulaire affiche l'erreur
    }

    // Cas 2 : Succès — mise à jour de l'état avec les données reçues
    this.user      = result.user;
    this.profile   = result.profile;
    this.isLoggedIn = true;
    // === true (et pas == true) = vérification stricte du booléen
    this.isAdmin   = result.profile?.is_admin === true;
    this.loading   = false;

    updateNavbar(); // Affiche l'avatar à la place des boutons Sign In

    // Redirection admin : on quitte index.html pour aller sur admin.html
    if (this.isAdmin) {
      window.location.href = 'admin.html';
      return true;
    }

    return true; // Connexion réussie pour un user normal
  },

  // ── Inscription ──────────────────────────────────────────────
  // Crée un nouveau compte + connecte automatiquement après
  async signUp(formData) {
    this.loading = true;
    this.error   = null;
    updateNavbar();

    // formData contient : cin, first_name, last_name, address, date_of_birth, password
    const result = await apiSignUp(formData);

    // Erreur (CIN déjà pris, mot de passe trop court, etc.)
    if (result.error) {
      this.error   = result.error;
      this.loading = false;
      updateNavbar();
      return false;
    }

    // Après inscription, on connecte automatiquement l'utilisateur
    if (result.user) {
      // Récupère le profil que la trigger Supabase vient de créer
      const profileResult = await apiGetProfile(result.user.id);
      this.user      = result.user;
      this.profile   = profileResult;
      this.isLoggedIn = true;
      this.isAdmin   = false; // Un nouveau compte n'est jamais admin
    }

    this.loading = false;
    updateNavbar();
    return true;
  },

  // ── Déconnexion ──────────────────────────────────────────────
  // Vide totalement l'état Auth + déconnecte côté Supabase
  async signOut() {
    await apiSignOut();        // Supprime la session Supabase
    // Réinitialisation complète des champs Auth
    this.user                = null;
    this.profile             = null;
    this.isLoggedIn          = false;
    this.isAdmin             = false;
    this.hasActiveStay       = false;
    this.activeReservationId = null;
    this.activeHotelName     = null;

    // Réinitialisation du Smart Room (lumière, temp, etc.)
    SmartRoom.reset();
    updateNavbar();            // Réaffiche les boutons Sign In/Up
  },

  // ── Séjour actif (appelé après paiement d'une chambre) ──────
  // Marque que l'utilisateur a un check-in possible (bouton "My Stay")
  setActiveStay(active, reservationId = null, hotelName = null) {
    this.hasActiveStay       = active;
    // Si on désactive, on efface aussi les autres champs
    this.activeReservationId = active ? reservationId : null;
    this.activeHotelName     = active ? hotelName : null;
    updateNavbar();            // Affiche/cache le bouton "My Stay"
  },

  // ── Efface les erreurs ───────────────────────────────────────
  // Appelée quand l'utilisateur tape dans un input (pour nettoyer le message)
  clearError() {
    this.error = null;
  }
};

// ─── INITIALISATION AU DÉMARRAGE ──────────────────────────────
// Vérifie si une session existe déjà (utilisateur déjà connecté)
// Permet de "rester connecté" entre les rechargements de page
async function initAuth() {
  // getSession() lit le token JWT stocké dans localStorage par Supabase
  const session = await apiGetSession();
  if (session) {
    // Session valide → on restaure l'état Auth
    Auth.user      = session.user;
    Auth.profile   = await apiGetProfile(session.user.id);
    Auth.isLoggedIn = true;
    Auth.isAdmin   = Auth.profile?.is_admin === true;
  }
  updateNavbar(); // Premier affichage de la navbar selon l'état
}

// ─── MISE À JOUR DE LA NAVBAR ─────────────────────────────────
// Cette fonction synchronise l'affichage de la navbar avec l'état Auth
// Appelée à chaque changement d'état (connexion, déconnexion, etc.)
function updateNavbar() {
  // Récupération des éléments DOM de la navbar
  const authButtons = document.getElementById('auth-buttons'); // Sign In / Sign Up
  const userMenu    = document.getElementById('user-menu');    // Avatar + dropdown
  const userAvatar  = document.getElementById('user-avatar');  // Lettre dans le rond
  const dropdownName= document.getElementById('dropdown-name');// Nom dans le menu
  const btnAdmin    = document.getElementById('btn-admin-panel'); // Bouton admin
  const myStayBtn   = document.getElementById('nav-mystay-btn');  // "My Stay"

  // Si pas de navbar → on est sur admin.html, pas index.html
  if (!authButtons) return;

  if (Auth.isLoggedIn && Auth.profile) {
    // Cas connecté → afficher avatar, cacher les boutons Sign In/Up
    authButtons.style.display = 'none';
    userMenu.style.display    = 'block';

    // Première lettre du prénom dans l'avatar (ex: "Marie" → "M")
    // [0] = premier caractère, .toUpperCase() = majuscule
    const initial = (Auth.profile.first_name || '?')[0].toUpperCase();
    userAvatar.textContent  = initial;
    dropdownName.textContent = Auth.profile.first_name || 'User';

    // Bouton "Admin Panel" visible uniquement si admin
    if (btnAdmin) {
      btnAdmin.style.display = Auth.isAdmin ? 'block' : 'none';
    }

    // Bouton "My Stay" visible si séjour actif (après paiement)
    if (myStayBtn) {
      myStayBtn.style.display = Auth.hasActiveStay ? 'inline-flex' : 'none';
    }

  } else {
    // Cas non connecté → afficher Sign In / Sign Up
    authButtons.style.display = 'flex';
    userMenu.style.display    = 'none';
    if (myStayBtn) myStayBtn.style.display = 'none';
  }
}

// ─── ÉVÉNEMENTS DE LA NAVBAR ──────────────────────────────────
// Ces listeners sont attachés une fois que le DOM est prêt (depuis app.js)
// Chaque bouton de la navbar a son listener ici
function initNavbarEvents() {
  // Logo "OPHELIA HOTELS" → retour à l'accueil
  // Le ?. évite l'erreur si le bouton n'existe pas
  document.getElementById('nav-logo')
    ?.addEventListener('click', () => Router.go('home'));

  // Bouton "Home" (visible quand on n'est pas sur l'accueil)
  document.getElementById('nav-home-btn')
    ?.addEventListener('click', () => Router.go('home'));

  // Bouton "Contact" → scroll vers le footer (depuis n'importe quelle page)
  document.getElementById('nav-contact-btn')
    ?.addEventListener('click', () => {
      // 1) S'assurer que la page d'accueil est visible (footer y est rattaché)
      Router.go('home');
      // 2) Petit délai pour laisser le DOM s'afficher avant le scroll
      // 80ms = juste assez pour que la page soit rendue
      setTimeout(() => {
        const footer = document.getElementById('site-footer');
        // scrollIntoView : fait défiler la page jusqu'à l'élément
        // 'smooth' = animation douce, 'start' = aligne en haut
        if (footer) footer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    });

  // Bouton "My Stay" → va à la page check-in
  document.getElementById('nav-mystay-btn')
    ?.addEventListener('click', () => Router.go('checkin'));

  // Bouton "Sign In" → page de connexion
  document.getElementById('nav-signin-btn')
    ?.addEventListener('click', () => Router.go('signin'));

  // Bouton "Sign Up" → page d'inscription
  document.getElementById('nav-signup-btn')
    ?.addEventListener('click', () => Router.go('signup'));

  // Bouton "Admin Panel" (depuis le menu déroulant) → va sur admin.html
  document.getElementById('btn-admin-panel')
    ?.addEventListener('click', () => {
      window.location.href = 'admin.html';
    });

  // Bouton "Sign Out" → déconnexion + retour home
  document.getElementById('btn-signout')
    ?.addEventListener('click', async () => {
      await Auth.signOut();
      Router.go('home');
    });

  // Clic sur l'avatar → ouvre/ferme le menu déroulant
  document.getElementById('user-avatar')
    ?.addEventListener('click', (e) => {
      // stopPropagation évite que le clic remonte au document
      // (sinon le listener "fermer le menu" se déclencherait juste après)
      e.stopPropagation();
      // Toggle : si visible → cache, si caché → affiche
      document.getElementById('user-dropdown').style.display =
        document.getElementById('user-dropdown').style.display === 'block' ? 'none' : 'block';
    });

  // Clic ailleurs sur la page → ferme le menu déroulant (UX classique)
  document.addEventListener('click', () => {
    const dd = document.getElementById('user-dropdown');
    if (dd) dd.style.display = 'none';
  });
}
