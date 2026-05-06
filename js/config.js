/* ═══════════════════════════════════════════════════════════════
   CONFIG.JS — Configuration globale de l'application
   Contient : Supabase, données hôtels, formules, menu nourriture
   Ce fichier doit être chargé EN PREMIER avant tous les autres JS
   (les autres fichiers utilisent ses constantes globales)
   ═══════════════════════════════════════════════════════════════ */

// ─── SUPABASE ──────────────────────────────────────────────────
// Vos clés Supabase (récupérées depuis app_config.dart)
// SUPABASE_URL : URL de votre projet Supabase (visible dans le dashboard)
// SUPABASE_ANON_KEY : clé publique anonyme (peut être exposée côté client)
// ⚠️ La sécurité repose sur les politiques RLS configurées dans Supabase
const SUPABASE_URL     = 'https://nvlsynwvvniizduizyjf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9V4GQKzU3T1VLuj7G5DY_g_DKwm8KUB';

// ─── COULEURS (correspondant à AppColors dans Flutter) ─────────
// Utilisées en JS pour colorer dynamiquement certains éléments
// (ex: graphiques admin, status badges)
// Les mêmes couleurs sont définies en CSS sous forme de variables --navy, --gold...
const COLORS = {
  navy:    '#0F1E3F',  // Bleu marine profond (texte, accents sombres)
  blue:    '#213A56',  // Bleu secondaire
  gold:    '#CDAA80',  // Doré (boutons CTA, accents luxe)
  bronze:  '#997953',  // Bronze (variante du doré)
  cream:   '#F5EFE6',  // Crème (fonds clairs)
  green:   '#4ADE80',  // Vert (succès, statuts confirmés)
  red:     '#EF4444',  // Rouge (erreurs, statuts annulés)
};

// ─── FORMULES ET PRIX (= AppConst.formulaPrices) ───────────────
// Prix supplémentaire par nuit par personne selon la formule choisie
// Ex: 2 personnes × 3 nuits × All Inclusive = 2 × 3 × 500 = 3000 DT en plus
const FORMULA_PRICES = {
  'All Inclusive':       500,  // Tout compris : repas + boissons + activités
  'All Inclusive Soft':  300,  // Tout compris sans alcool
  'Half Board':          150,  // Demi-pension : petit-déj + dîner
  'Bed & Breakfast':     0,    // Petit-déj uniquement (inclus dans le tarif)
};

// Prix des services extras pour les chambres (par personne, pour tout le séjour)
const EXTRA_PRICES = {
  sport: 800,   // DT par personne — accès aux installations sportives
  spa:   1200,  // DT par personne — accès au spa & massages
};

// ─── MENU NOURRITURE (pour la commande en Smart Room) ──────────
// Liste utilisée par renderFoodMenu() dans smartroom.js
// Chaque item devient une ligne dans le menu de l'onglet Requests > Food
const FOOD_MENU = [
  { name: 'Club Sandwich',       price: 18 },  // Plat
  { name: 'Caesar Salad',        price: 15 },  // Plat
  { name: 'Grilled Salmon',      price: 35 },  // Plat principal
  { name: 'Burger & Fries',      price: 22 },  // Plat
  { name: 'Pasta Carbonara',     price: 20 },  // Plat
  { name: 'Fruit Platter',       price: 12 },  // Dessert / sain
  { name: 'Sparkling Water 1L',  price: 6  },  // Boisson
  { name: 'Fresh Orange Juice',  price: 8  },  // Boisson
  { name: 'Espresso',            price: 5  },  // Boisson chaude
  { name: 'Wine Bottle',         price: 45 },  // Boisson alcoolisée
];

// ─── DONNÉES DES HÔTELS ────────────────────────────────────────
// Reproduit exactement le HotelProvider de Flutter avec les 3 hôtels
// Ces données sont CODÉES EN DUR (pas dans Supabase) — c'est un catalogue statique
// Pour ajouter un hôtel, il suffit d'ajouter un objet dans HOTELS

// Icônes emoji + couleurs pour les dégradés de fond
// "from"/"to" = dégradé CSS, "emoji" = fallback sans image, "cover" = image de fond
const HOTEL_COLORS = {
  seaside:  { from: '#1a3a5c', to: '#2d6a9f', emoji: '🌊', cover: 'images/seaside_cover.jpg' },   // Bleu mer
  evergreen:{ from: '#1a3a1a', to: '#2d6a2d', emoji: '🏔️', cover: 'images/evergreen_cover.jpg' },  // Vert forêt
  sahara:   { from: '#5c3a0a', to: '#9f6a1a', emoji: '🌙', cover: 'images/sahara_cover.jpg' },    // Sable / désert
};

const HOTELS = [
  {
    id: 'seaside',
    name: 'Seaside Hotel',
    location: 'Mediterranean Coast',
    rating: 4.8,
    description:
      'Nestled along the shimmering Mediterranean shoreline, Seaside Hotel offers breathtaking ocean views, world-class dining, and unparalleled relaxation.',
    services: [
      { id: 's1', name: 'Sea View Room',      description: 'Panoramic ocean views with floor-to-ceiling windows, king-size bed, marble bathroom and private balcony.', price: 4500, category: 'room',          bookable: 'room',     image: 'images/seaside_room.jpg' },
      { id: 's2', name: 'Premium Suite',      description: 'Spacious luxury suite with living area, jacuzzi, butler service and sea-facing terrace.', price: 7200, category: 'room',          bookable: 'room',     image: 'images/seaside_suite.jpg' },
      { id: 's3', name: 'Outdoor Pool',       description: 'Infinity pool overlooking the Mediterranean with sun loungers and poolside bar.', price: 180, category: 'pool',          bookable: 'activity', image: 'images/seaside_pool_ext.jpg' },
      { id: 's4', name: 'Indoor Pool',        description: 'Year-round heated indoor pool with spa jets, sauna and steam room.', price: 150, category: 'pool',          bookable: 'activity', image: 'images/seaside_pool_int.jpg' },
      { id: 's5', name: 'Le Rivage Restaurant', description: 'Fine dining with Mediterranean seafood, local wines and sea views.', price: 280, category: 'dining',        bookable: 'dining',   image: 'images/seaside_restau.jpg' },
      { id: 's6', name: 'Grand Buffet',       description: 'International buffet with 150+ dishes and live cooking stations.', price: 220, category: 'dining',        bookable: 'dining',   image: 'images/seaside_buffet.jpg' },
      { id: 's7', name: 'Tennis Court',       description: 'Professional clay courts with floodlights and coaching.', price: 140, category: 'sport',         bookable: 'activity', image: 'images/seaside_tennis.jpg' },
      { id: 's8', name: 'Beach Party',        description: 'Beachfront events with live DJs, fire shows and cocktails.', price: 320, category: 'entertainment', bookable: 'event',    image: 'images/seaside_party.jpg' },
    ],
  },
  {
    id: 'evergreen',
    name: 'Evergreen Hotel',
    location: 'Forest & Mountains',
    rating: 4.9,
    description:
      'Surrounded by ancient forests and majestic peaks. Eco-luxury meets adventure in this breathtaking mountain retreat.',
    services: [
      { id: 'e1', name: 'Forest View Room',   description: 'Elegant room with forest views, natural wood finishes and private balcony.', price: 4200, category: 'room',          bookable: 'room',     image: 'images/evergreen_room.jpg' },
      { id: 'e2', name: 'Panoramic Suite',    description: 'Mountain suite with fireplace, rain shower and terrace with hot tub.', price: 6800, category: 'room',          bookable: 'room',     image: 'images/evergreen_suite.jpg' },
      { id: 'e3', name: 'Mountain Pool',      description: 'Heated outdoor infinity pool with mountain panorama.', price: 170, category: 'pool',          bookable: 'activity', image: 'images/evergreen_pool.jpg' },
      { id: 'e4', name: 'Wellness Pool',      description: 'Therapeutic indoor pool with mineral water and grotto.', price: 160, category: 'pool',          bookable: 'activity', image: 'images/evergreen_pool_int.jpg' },
      { id: 'e5', name: 'Canopy Restaurant',  description: 'Farm-to-table dining in treehouse setting with organic ingredients.', price: 300, category: 'dining',        bookable: 'dining',   image: 'images/evergreen_restau.jpg' },
      { id: 'e6', name: 'Organic Buffet',     description: 'Sustainable buffet with organic produce and artisan breads.', price: 240, category: 'dining',        bookable: 'dining',   image: 'images/evergreen_buffet.jpg' },
      { id: 'e7', name: 'Spa & Jacuzzi',      description: 'Alpine spa with hot stone therapy, aromatherapy and sauna.', price: 350, category: 'spa',           bookable: 'activity', image: 'images/evergreen_spa.jpg' },
      { id: 'e8', name: 'Basketball Court',   description: 'Professional indoor court with equipment provided.', price: 120, category: 'sport',         bookable: 'activity', image: 'images/evergreen_basket.jpg' },
      { id: 'e9', name: 'Garden Gala',        description: 'Garden parties with lanterns, live jazz and premium cocktails.', price: 290, category: 'entertainment', bookable: 'event',    image: 'images/evergreen_party.jpg' },
    ],
  },
  {
    id: 'sahara',
    name: 'Sahara Hotel',
    location: 'Desert & Oasis',
    rating: 4.7,
    description:
      'Where golden dunes meet timeless elegance. A mystical desert experience with luxurious amenities and cultural immersion.',
    services: [
      { id: 'sa1', name: 'Desert Room',       description: 'Saharan-style room with handcrafted furnishings and desert views.', price: 4800, category: 'room',          bookable: 'room',     image: 'images/sahara_room.jpg' },
      { id: 'sa2', name: 'Oasis Suite',       description: 'Lavish suite with dune views, private plunge pool and butler.', price: 8500, category: 'room',          bookable: 'room',     image: 'images/sahara_suite.jpg' },
      { id: 'sa3', name: 'Desert Pool',       description: 'Oasis-style pool with cabanas and sunset cocktail service.', price: 190, category: 'pool',          bookable: 'activity', image: 'images/sahara_pool.jpg' },
      { id: 'sa4', name: 'Grotto Pool',       description: 'Underground pool in a cave with ambient lighting and springs.', price: 170, category: 'pool',          bookable: 'activity', image: 'images/sahara_pool_int.jpg' },
      { id: 'sa5', name: 'Cave Restaurant',   description: 'Dining inside a natural cave with Saharan cuisine and oud music.', price: 320, category: 'dining',        bookable: 'dining',   image: 'images/sahara_restau.jpg' },
      { id: 'sa6', name: 'Desert Feast',      description: 'Outdoor buffet under the stars with traditional Tunisian dishes.', price: 260, category: 'dining',        bookable: 'dining',   image: 'images/sahara_buffet.jpg' },
      { id: 'sa7', name: 'Sand Spa',          description: 'Desert spa with sand therapy, hammam, rose oil treatments.', price: 380, category: 'spa',           bookable: 'activity', image: 'images/sahara_spa.jpg' },
      { id: 'sa8', name: 'Sunrise Yoga',      description: 'Morning yoga on the dunes with panoramic desert views.', price: 90,  category: 'sport',         bookable: 'activity', image: 'images/sahara_yoga.jpg' },
      { id: 'sa9', name: 'Desert Night Party',description: 'Bedouin tent celebration with local music, fire shows and mezze.', price: 350, category: 'entertainment', bookable: 'event',    image: 'images/sahara_party.jpg' },
    ],
  },
];

// ─── ICÔNES DE CATÉGORIES ──────────────────────────────────────
// Identique à categoryIcon dans models.dart
// Utilisées pour afficher l'icône à côté de chaque service (page hôtel)
const CATEGORY_ICONS = {
  room:          '🛏️',  // Chambre
  pool:          '🏊',  // Piscine
  dining:        '🍽️',  // Restaurant / buffet
  sport:         '🎾',  // Sport (tennis, basket, yoga)
  spa:           '💆',  // Spa / wellness
  entertainment: '🎉',  // Soirées / événements
};

// ─── UTILITAIRES DE FORMATAGE ──────────────────────────────────

/**
 * Formate un nombre avec des séparateurs de milliers
 * Exemple : formatNum(4500) → "4,500"
 * Utilisé pour afficher les prix de manière lisible
 */
function formatNum(n) {
  // Number(n || 0) : convertit en nombre, défaut 0 si null/undefined
  // .toLocaleString('en-US') : applique les séparateurs (virgules pour US)
  return Number(n || 0).toLocaleString('en-US');
}

/**
 * Calcule le total d'une réservation de chambre
 * Même logique que PriceCalc.roomTotal() dans Flutter
 *
 * Formule :
 *   total = (prix/nuit × nuits)
 *         + (formule × nuits × personnes)
 *         + (sport ? 800 × personnes : 0)
 *         + (spa   ? 1200 × personnes : 0)
 *
 * @param {number} perNight  - Prix par nuit de la chambre
 * @param {number} nights    - Nombre de nuits
 * @param {number} adults    - Nombre d'adultes
 * @param {number} children  - Nombre d'enfants (compte comme adulte ici)
 * @param {string} formula   - Formule choisie (ex: "All Inclusive")
 * @param {boolean} sport    - Sport package activé
 * @param {boolean} spa      - Spa package activé
 * @returns {number}         - Prix total en DT
 */
function calcRoomTotal({ perNight, nights, adults, children, formula, sport, spa }) {
  const persons = adults + children;                // Total occupants
  // [formula] : accès dynamique à la propriété (ex: FORMULA_PRICES['Half Board'])
  // || 0 : si la formule n'existe pas, on utilise 0 par défaut
  const formulaPrice = FORMULA_PRICES[formula] || 0;
  return (
    nights * perNight +                             // Coût de base de la chambre
    nights * persons * formulaPrice +               // Supplément formule
    // Opérateur ternaire : si sport activé alors prix×personnes, sinon 0
    (sport ? persons * EXTRA_PRICES.sport : 0) +
    (spa   ? persons * EXTRA_PRICES.spa   : 0)
  );
}

/**
 * Retourne un label de statut coloré en HTML
 * Utilisé dans les listes admin pour afficher le statut visuel
 * Exemple : statusBadge("in_progress") → <span class="...">IN PROGRESS</span>
 *
 * @param {string} status - "confirmed" | "active" | "completed" | "cancelled" | "pending" | "in_progress"
 */
function statusBadge(status) {
  // Si status absent → "pending" par défaut
  const s = status || 'pending';
  // Template literal : génère le HTML avec la classe CSS appropriée
  // .replace('_', ' ') : "in_progress" → "in progress"
  // .toUpperCase() : tout en majuscules pour le badge
  return `<span class="status-badge status-${s}">${s.replace('_', ' ').toUpperCase()}</span>`;
}
