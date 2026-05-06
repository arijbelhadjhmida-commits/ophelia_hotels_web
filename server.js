/* ═══════════════════════════════════════════════════════════════
   SERVER.JS — Serveur Node.js avec Express

   Ce serveur a deux rôles :
   1. Servir les fichiers statiques du site web (HTML, CSS, JS)
   2. Fournir une API minimale si besoin (tout le reste est géré
      directement par Supabase côté client)

   DÉMARRAGE : node server.js
   Le site sera accessible sur http://localhost:4000

   ⚠️ Ce serveur ne contient AUCUNE logique métier
   Toute la logique est côté client + Supabase
   ═══════════════════════════════════════════════════════════════ */

// ─── IMPORTS ──────────────────────────────────────────────────
// require() = chargement des modules Node.js (équivalent de import)
const express = require('express');   // Framework web (routes, middleware)
const path    = require('path');      // Gestion des chemins de fichiers (cross-platform)
const cors    = require('cors');      // Autorise les requêtes cross-origin (CORS)

// ─── CONFIGURATION ────────────────────────────────────────────
// Création de l'application Express
const app  = express();
// Port d'écoute : variable d'environnement PORT ou 4000 par défaut
// process.env.PORT permet à un hébergeur (Heroku, etc.) d'imposer un port
const PORT = process.env.PORT || 4000;

// ─── MIDDLEWARES ──────────────────────────────────────────────
// Les middlewares s'exécutent pour CHAQUE requête, dans l'ordre

// CORS : permet au frontend (Supabase SDK) de faire des requêtes
// Sans cors(), les requêtes vers d'autres domaines seraient bloquées
app.use(cors());

// Parser JSON pour les requêtes POST/PUT
// Permet d'accéder à req.body en tant qu'objet JS
app.use(express.json());

// Servir les fichiers statiques depuis le dossier courant
// Cela inclut index.html, admin.html, css/, js/, images/, audio/
// __dirname = dossier où se trouve ce fichier server.js
app.use(express.static(path.join(__dirname)));

// ─── ROUTES ───────────────────────────────────────────────────

/**
 * Route principale → index.html
 * GET / → renvoie la page d'accueil
 */
app.get('/', (req, res) => {
  // sendFile envoie un fichier au navigateur
  // path.join() construit un chemin valide selon l'OS (\ Windows ou / Unix)
  res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Route admin → admin.html
 * GET /admin → renvoie le dashboard administrateur
 */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

/**
 * Health check — utile pour vérifier que le serveur est actif
 * GET /api/health → { status: "ok", timestamp: "..." }
 * Utilisé par les services de monitoring (UptimeRobot, etc.)
 */
app.get('/api/health', (req, res) => {
  // res.json() : sérialise l'objet en JSON et l'envoie avec le bon Content-Type
  res.json({
    status:    'ok',
    app:       'Ophelia Hotels',
    version:   '1.0.0',
    timestamp: new Date().toISOString(), // Date actuelle ISO 8601
  });
});

/**
 * Fallback SPA : toutes les routes inconnues renvoient index.html
 * Cela permet la navigation directe vers une URL (ex: /hotel/seaside)
 * Sans cela, /hotel renverrait une 404
 *
 * '*' = match toutes les routes (qui n'ont pas matché les routes précédentes)
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── DÉMARRAGE DU SERVEUR ─────────────────────────────────────
// app.listen() démarre le serveur HTTP sur le port indiqué
// Le callback s'exécute une fois le serveur prêt à recevoir des requêtes
app.listen(PORT, () => {
  // Affichage d'une bannière dans la console pour confirmer le démarrage
  // Les ${PORT} = interpolation de variable dans la chaîne (template literal)
  console.log(`
  ┌────────────────────────────────────────┐
  │       OPHELIA HOTELS — SERVER          │
  │                                        │
  │  ✓ Running at http://localhost:${PORT}   │
  │  ✓ Admin Panel : http://localhost:${PORT}/admin │
  │                                        │
  │  Backend : Node.js + Express           │
  │  Database: Supabase (PostgreSQL)       │
  └────────────────────────────────────────┘
  `);
});

// Gestion des erreurs non capturées (sécurité)
// Empêche le crash du serveur si une Promise rejette sans .catch()
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});
