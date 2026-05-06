/* ═══════════════════════════════════════════════════════════════
   API.JS — Toutes les fonctions d'accès à Supabase
   Équivalent de lib/services/supabase_service.dart

   IMPORTANT : Ce fichier initialise le client Supabase une seule
   fois et expose toutes les fonctions async nécessaires.

   Toutes les fonctions sont préfixées par "api" pour bien les
   distinguer du reste de l'application.
   ═══════════════════════════════════════════════════════════════ */

// ─── INITIALISATION DU CLIENT SUPABASE ────────────────────────
// Le SDK Supabase est chargé depuis CDN dans index.html / admin.html
// La variable globale "supabase" vient du SDK CDN
// createClient utilise les constantes définies dans config.js
// "db" est notre référence courte vers le client Supabase

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ════════════════════════════════════════════════════════════════
// AUTHENTIFICATION
// ════════════════════════════════════════════════════════════════

/**
 * Connexion avec CIN et mot de passe
 * Le CIN sert d'email sous la forme "cin@ophelia.local"
 * Sauf pour l'admin qui utilise admin@ophelia-hotels.com
 *
 * @param {string} cin      - CIN 8 chiffres ou "admin"
 * @param {string} password - Mot de passe
 * @returns {{ user, profile, error }}
 */
async function apiSignIn(cin, password) {
  try {
    // Construction de l'email à partir du CIN (même logique que Flutter)
    // L'opérateur ternaire : condition ? siVrai : siFaux
    const email = cin === 'admin'
      ? 'admin@ophelia-hotels.com'    // Cas spécial admin
      : `${cin}@ophelia.local`;        // Sinon : "12345678@ophelia.local"

    // Authentification Supabase via l'API Auth
    // Si succès : data contient { user, session }
    // Si échec : error contient { message, status }
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    // En cas d'erreur on retourne juste le message (utilisé par le formulaire)
    if (error) return { error: error.message };

    // Récupération du profil DB (contient is_admin, first_name, etc.)
    // Ce profil est créé par une trigger Supabase à l'inscription
    const profile = await apiGetProfile(data.user.id);
    return { user: data.user, profile };

  } catch (e) {
    // Erreur inattendue (réseau, etc.)
    return { error: e.message };
  }
}

/**
 * Inscription d'un nouvel utilisateur
 * La trigger Supabase "handle_new_user" crée automatiquement
 * une ligne dans la table profiles à partir de options.data
 *
 * @param {object} data - { cin, first_name, last_name, address, date_of_birth, password }
 * @returns {{ user, error }}
 */
async function apiSignUp({ cin, first_name, last_name, address, date_of_birth, password }) {
  try {
    // Génération de l'email à partir du CIN (8 chiffres)
    const email = `${cin}@ophelia.local`;

    // Inscription via Supabase Auth
    // options.data : metadata stockées dans auth.users.user_metadata
    // Notre trigger Postgres lit ces metadata pour créer le profil
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: { cin, first_name, last_name, address, date_of_birth }
      }
    });

    if (error) return { error: error.message };
    return { user: data.user };

  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Déconnexion : supprime le token JWT du localStorage
 * et invalide la session côté Supabase
 */
async function apiSignOut() {
  await db.auth.signOut();
}

/**
 * Écoute les changements d'état d'authentification
 * Utile pour réagir à une connexion/déconnexion en temps réel
 * (pas utilisé actuellement mais disponible)
 * @param {function} callback - (session) => void
 */
function apiOnAuthChange(callback) {
  db.auth.onAuthStateChange((event, session) => {
    // event peut être : SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
    callback(session);
  });
}

/**
 * Récupère la session courante (token JWT en localStorage)
 * Utilisée à l'init de l'app pour "rester connecté"
 * @returns {object|null} session ou null si pas connecté
 */
async function apiGetSession() {
  const { data } = await db.auth.getSession();
  return data.session;
}

// ════════════════════════════════════════════════════════════════
// PROFILS UTILISATEURS
// ════════════════════════════════════════════════════════════════

/**
 * Récupère le profil d'un utilisateur par son ID
 * @param {string} userId - UUID de l'utilisateur (data.user.id)
 * @returns {object|null} profile (first_name, last_name, cin, is_admin, etc.)
 */
async function apiGetProfile(userId) {
  try {
    // .from('profiles') = SELECT FROM profiles
    // .select('*') = SELECT toutes les colonnes
    // .eq('id', userId) = WHERE id = userId
    // .single() = retourne un objet unique (pas un tableau)
    const { data } = await db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  } catch {
    // Profil pas encore créé (entre signUp et la trigger) → null
    return null;
  }
}

/**
 * Récupère TOUS les profils (admin uniquement, protégé par RLS)
 * RLS = Row Level Security : Supabase bloque la requête si pas admin
 * @returns {Array} liste des profils, plus récent en premier
 */
async function apiGetAllProfiles() {
  const { data } = await db
    .from('profiles')
    .select('*')
    // Tri décroissant par date de création (plus récent en haut)
    .order('created_at', { ascending: false });
  // || [] : si data est null, on retourne un tableau vide (sécurité)
  return data || [];
}

// ════════════════════════════════════════════════════════════════
// RÉSERVATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Crée une réservation dans Supabase
 * @param {object} payload - { user_id, hotel_id, service_id, total_price, ... }
 * @returns {string} ID (UUID) de la réservation créée
 */
async function apiCreateReservation(payload) {
  // INSERT INTO reservations + SELECT id de la nouvelle ligne
  const { data, error } = await db
    .from('reservations')
    .insert(payload)
    .select('id')   // Ne sélectionne que la colonne id (économie de bande passante)
    .single();      // Retourne un seul objet, pas un tableau

  // throw au lieu de return pour propager l'erreur au caller
  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Récupère toutes les réservations (admin uniquement)
 * Inclut le profil de l'utilisateur (first_name, last_name, cin)
 * Le * dans select('*, profiles(...)') = jointure avec la table profiles
 * @returns {Array}
 */
async function apiGetAllReservations() {
  const { data } = await db
    .from('reservations')
    // Jointure : récupère aussi les colonnes du profil lié
    // Équivalent SQL : LEFT JOIN profiles ON reservations.user_id = profiles.id
    .select('*, profiles(first_name, last_name, cin)')
    .order('created_at', { ascending: false });
  return data || [];
}

/**
 * Met à jour le statut d'une réservation
 * Utilisée par l'admin pour confirmer/annuler une résa
 * @param {string} id     - UUID de la réservation
 * @param {string} status - "confirmed" | "cancelled" | "completed" | "pending"
 */
async function apiUpdateReservationStatus(id, status) {
  // UPDATE reservations SET status = ? WHERE id = ?
  await db
    .from('reservations')
    .update({ status })
    .eq('id', id);
}

// ════════════════════════════════════════════════════════════════
// SMART ROOM STATES
// ════════════════════════════════════════════════════════════════

/**
 * Active une Smart Room (au moment du check-in)
 * Crée une nouvelle ligne dans smart_room_states
 * @param {object} data - { user_id, reservation_id, room_number, ... }
 * @returns {string} ID de la smart room créée
 */
async function apiActivateSmartRoom(data) {
  const { data: result, error } = await db
    .from('smart_room_states')
    .insert(data)
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return result.id;
}

/**
 * Met à jour l'état d'une Smart Room (température, lumière, etc.)
 * Appelée toutes les 500ms par SmartRoom._sync() (via debounce)
 * @param {string} id   - UUID de la smart room
 * @param {object} data - Champs à mettre à jour (light_on, temperature, etc.)
 */
async function apiUpdateSmartRoom(id, data) {
  await db
    .from('smart_room_states')
    // ...data : "spread operator" = copie tous les champs de data
    // + on ajoute updated_at avec la date courante
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);
}

/**
 * Désactive une Smart Room (au moment du check-out)
 * Ne supprime PAS la ligne, juste passe is_active à false
 * Permet de garder l'historique des séjours
 * @param {string} smartRoomId - UUID
 */
async function apiDeactivateSmartRoom(smartRoomId) {
  await db
    .from('smart_room_states')
    .update({
      is_active: false,                          // Marque comme inactive
      checked_out_at: new Date().toISOString(),  // Date de check-out
    })
    .eq('id', smartRoomId);
}

/**
 * Récupère toutes les Smart Rooms actives (admin)
 * Avec jointure profil pour afficher qui occupe la chambre
 * @returns {Array}
 */
async function apiGetAllActiveSmartRooms() {
  const { data } = await db
    .from('smart_room_states')
    .select('*, profiles(first_name, last_name, cin)')
    .eq('is_active', true)                      // Seulement les actives
    .order('updated_at', { ascending: false }); // Plus récente en premier
  return data || [];
}

// ════════════════════════════════════════════════════════════════
// ROOM SERVICE REQUESTS (cleaning, complaint, food_order)
// ════════════════════════════════════════════════════════════════

/**
 * Crée une requête de service depuis la Smart Room
 * @param {object} data - { user_id, smart_room_id, request_type, subject, ... }
 */
async function apiCreateRoomServiceRequest(data) {
  const { error } = await db
    .from('room_service_requests')
    .insert(data);
  if (error) throw new Error(error.message);
}

/**
 * Récupère toutes les requêtes (admin uniquement)
 * Avec jointure profil pour afficher l'utilisateur
 * @returns {Array}
 */
async function apiGetAllRoomServiceRequests() {
  const { data } = await db
    .from('room_service_requests')
    .select('*, profiles(first_name, last_name, cin)')
    .order('created_at', { ascending: false });
  return data || [];
}

/**
 * Met à jour le statut d'une requête (pending → in_progress → completed)
 * Utilisée par l'admin dans l'onglet Requests
 * @param {string} id     - UUID de la requête
 * @param {string} status - "pending" | "in_progress" | "completed"
 */
async function apiUpdateRequestStatus(id, status) {
  await db
    .from('room_service_requests')
    .update({ status })
    .eq('id', id);
}

// ════════════════════════════════════════════════════════════════
// STATISTIQUES ADMIN (Dashboard Overview)
// ════════════════════════════════════════════════════════════════

/**
 * Calcule les statistiques globales pour l'onglet Overview
 * Équivalent de getAdminStats() dans supabase_service.dart
 * @returns {{ total_reservations, active_stays, pending_requests, total_users, total_revenue }}
 */
async function apiGetAdminStats() {
  // On fait 4 requêtes EN PARALLÈLE pour la performance
  // Promise.all attend que toutes finissent (au lieu de les enchaîner)
  // Sinon : 4 requêtes × 200ms = 800ms vs 200ms en parallèle
  const [reservations, activeRooms, pendingRequests, users] = await Promise.all([
    db.from('reservations').select('total_price, status'),                  // Pour le revenu
    db.from('smart_room_states').select('id').eq('is_active', true),        // Séjours actifs
    db.from('room_service_requests').select('id').eq('status', 'pending'),  // Requêtes en attente
    db.from('profiles').select('id').eq('is_admin', false),                 // Users (sans admins)
  ]);

  // Calcul du revenu total : somme des total_price de toutes les réservations
  const resList = reservations.data || [];
  // .reduce((accumulateur, élément) => ...) : itère et accumule
  // Le 0 à la fin = valeur initiale de l'accumulateur
  // r.total_price || 0 : si null, utilise 0 (évite NaN)
  const totalRevenue = resList.reduce((sum, r) => sum + (r.total_price || 0), 0);

  // Retour d'un objet avec toutes les stats agrégées
  return {
    total_reservations: resList.length,                          // Nombre total
    active_stays:       (activeRooms.data  || []).length,        // Séjours en cours
    pending_requests:   (pendingRequests.data || []).length,     // Requêtes en attente
    total_users:        (users.data || []).length,               // Utilisateurs inscrits
    total_revenue:      totalRevenue,                            // Revenu en DT
  };
}
