// ============================================
// BACKEND SERVER - Express + MongoDB
// ============================================
// Este archivo es un ejemplo de backend para conectar con MongoDB
// Guárdalo como 'server.js' en la raíz del proyecto

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// ============================================
// CONEXIÓN A MONGODB
// ============================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokedex';

mongoose.connect(MONGODB_URI)
.then(async () => {
  console.log('✅ Conectado a MongoDB');
  
  // Limpiar índices problemáticos si existen
  try {
    const indexes = await mongoose.connection.collection('users').getIndexes();
    if (indexes.friendCode_1) {
      await mongoose.connection.collection('users').dropIndex('friendCode_1');
      console.log('🧹 Índice friendCode_1 eliminado');
    }
  } catch (err) {
    console.log('ℹ️ Sin índices problemáticos para limpiar');
  }
})
.catch((err) => console.error('❌ Error conectando a MongoDB:', err));

// ============================================
// SCHEMAS DE EJEMPLO
// ============================================

// Schema para Usuarios (auth)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  passwordSalt: { type: String, required: true },
  friendCode: { type: String, unique: true, sparse: true, index: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

// Schema para Favoritos
const favoriteSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  pokemonId: { type: Number, required: true },
  pokemonName: { type: String, required: true },
  sprite: { type: String },
  officialArt: { type: String },
  types: [String],
  timestamp: { type: Date, default: Date.now }
});
const Favorite = mongoose.model('Favorite', favoriteSchema);

// Schema para Equipos
const teamSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  pokemons: [{
    pokemonId: Number,
    pokemonName: String,
    sprite: String,
    officialArt: String
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
const Team = mongoose.model('Team', teamSchema);

// Schema para Batallas
const battleSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  opponentTeam: [{ pokemonId: Number, pokemonName: String }],
  userTeam: [{ pokemonId: Number, pokemonName: String }],
  result: { type: String, enum: ['win', 'lose', 'draw'] },
  timestamp: { type: Date, default: Date.now }
});
const Battle = mongoose.model('Battle', battleSchema);

// Schema para Amigos
const friendSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  friendId: { type: String, required: true },
  friendEmail: { type: String, required: true },
  friendCode: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const Friend = mongoose.model('Friend', friendSchema);

// Schema para Push Subscriptions
const pushSubscriptionSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  subscription: { type: Object, required: true },
  createdAt: { type: Date, default: Date.now }
});
const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);

// Schema para Solicitudes de Amistad
const friendRequestSchema = new mongoose.Schema({
  fromUserId: { type: String, required: true, index: true },
  fromEmail: { type: String, required: true },
  toUserId: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});
const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);

// Schema para Retos de Batalla
const battleRequestSchema = new mongoose.Schema({
  fromUserId: { type: String, required: true, index: true },
  toUserId: { type: String, required: true, index: true },
  fromTeamId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed'], default: 'pending' },
  result: { type: String, enum: ['win', 'lose', 'draw', null], default: null },
  createdAt: { type: Date, default: Date.now }
});
const BattleRequest = mongoose.model('BattleRequest', battleRequestSchema);

// ============================================
// RUTAS - AUTH
// ============================================

app.post('/auth/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const friendCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    const user = await User.create({ email, passwordHash, passwordSalt: salt, friendCode });

    const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');
    res.status(201).json({ user: { id: user._id.toString(), email: user.email }, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const passwordHash = hashPassword(password, user.passwordSalt);
    if (passwordHash !== user.passwordHash) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');
    res.json({ user: { id: user._id.toString(), email: user.email }, token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// RUTAS - FAVORITOS
// ============================================

// Obtener todos los favoritos de un usuario
app.get('/api/favorites/:userId', async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.params.userId });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar favorito
app.post('/api/favorites', async (req, res) => {
  try {
    const { userId, pokemonId, pokemonName, sprite, officialArt, types } = req.body;
    
    // Verificar si ya existe
    const existing = await Favorite.findOne({ userId, pokemonId });
    if (existing) {
      return res.status(400).json({ error: 'Ya está en favoritos' });
    }
    
    const favorite = new Favorite({ userId, pokemonId, pokemonName, sprite, officialArt, types });
    await favorite.save();
    res.status(201).json(favorite);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar favorito
app.delete('/api/favorites/:userId/:pokemonId', async (req, res) => {
  try {
    await Favorite.deleteOne({ 
      userId: req.params.userId, 
      pokemonId: req.params.pokemonId 
    });
    res.json({ message: 'Eliminado de favoritos' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS - EQUIPOS
// ============================================

// Obtener equipos de un usuario
app.get('/api/teams/:userId', async (req, res) => {
  try {
    const teams = await Team.find({ userId: req.params.userId });
    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear equipo
app.post('/api/teams', async (req, res) => {
  try {
    const { userId, name, pokemons } = req.body;
    const team = new Team({ userId, name, pokemons });
    await team.save();
    res.status(201).json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar equipo
app.put('/api/teams/:teamId', async (req, res) => {
  try {
    const { name, pokemons } = req.body;
    const team = await Team.findByIdAndUpdate(
      req.params.teamId,
      { name, pokemons, updatedAt: Date.now() },
      { new: true }
    );
    res.json(team);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar equipo
app.delete('/api/teams/:teamId', async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.teamId);
    res.json({ message: 'Equipo eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS - BATALLAS
// ============================================

// Registrar batalla
app.post('/api/battles', async (req, res) => {
  try {
    const { userId, opponentTeam, userTeam, result } = req.body;
    const battle = new Battle({ userId, opponentTeam, userTeam, result });
    await battle.save();
    res.status(201).json(battle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de batallas
app.get('/api/battles/:userId', async (req, res) => {
  try {
    const battles = await Battle.find({ userId: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(battles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS - AMIGOS
// ============================================

// Obtener amigos de un usuario
app.get('/api/friends/:userId', async (req, res) => {
  try {
    const friends = await Friend.find({ userId: req.params.userId });
    res.json(friends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar amigo por código
app.post('/api/friends/add', async (req, res) => {
  try {
    const { userId, friendCode } = req.body;
    
    if (!userId || !friendCode) {
      return res.status(400).json({ error: 'userId y friendCode son requeridos' });
    }
    
    // Buscar usuario con este friendCode
    const friendUser = await User.findOne({ friendCode });
    if (!friendUser) {
      return res.status(404).json({ error: 'Código de amigo no encontrado' });
    }
    
    // Verificar si ya son amigos
    const existing = await Friend.findOne({ userId, friendId: friendUser._id });
    if (existing) {
      return res.status(400).json({ error: 'Ya son amigos' });
    }
    
    // Crear amistad bidireccional
    const friend1 = new Friend({ userId, friendId: friendUser._id, friendEmail: friendUser.email, friendCode });
    const friend2 = new Friend({ userId: friendUser._id.toString(), friendId: userId, friendEmail: (await User.findById(userId)).email, friendCode: await User.findById(userId).then(u => u.friendCode) });
    
    await friend1.save();
    await friend2.save();
    
    res.status(201).json(friend1);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar amigo
app.delete('/api/friends/:userId/:friendId', async (req, res) => {
  try {
    await Friend.deleteMany({
      $or: [
        { userId: req.params.userId, friendId: req.params.friendId },
        { userId: req.params.friendId, friendId: req.params.userId }
      ]
    });
    res.json({ message: 'Amigo eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// RUTAS - PUSH NOTIFICATIONS
// ============================================

// Suscribirse a notificaciones push
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) {
      return res.status(400).json({ error: 'userId y subscription requeridos' });
    }
    
    await PushSubscription.findOneAndUpdate(
      { userId },
      { userId, subscription },
      { upsert: true }
    );
    
    res.json({ message: 'Suscripción guardada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Enviar notificación (uso interno)
async function sendPushNotification(userId, title, options = {}) {
  try {
    const subDoc = await PushSubscription.findOne({ userId });
    if (!subDoc) return;
    
    const webpush = require('web-push');
    webpush.setVapidDetails(
      'mailto:admin@pokedex.app',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    
    const payload = JSON.stringify({ title, options });
    await webpush.sendNotification(subDoc.subscription, payload);
  } catch (error) {
    console.error('Error enviando push:', error);
  }
}

// ============================================
// RUTAS - SOLICITUDES DE AMISTAD
// ============================================

// Enviar solicitud de amistad
app.post('/api/friends/request', async (req, res) => {
  try {
    const { userId, friendCode } = req.body;
    if (!userId || !friendCode) {
      return res.status(400).json({ error: 'userId y friendCode requeridos' });
    }
    
    const friendUser = await User.findOne({ friendCode });
    if (!friendUser) {
      return res.status(404).json({ error: 'Código no encontrado' });
    }
    
    if (friendUser._id.toString() === userId) {
      return res.status(400).json({ error: 'No puedes agregarte a ti mismo' });
    }
    
    const existingRequest = await FriendRequest.findOne({
      fromUserId: userId,
      toUserId: friendUser._id.toString(),
      status: 'pending'
    });
    
    if (existingRequest) {
      return res.status(400).json({ error: 'Solicitud ya existe' });
    }
    
    const user = await User.findById(userId);
    const request = new FriendRequest({
      fromUserId: userId,
      fromEmail: user.email,
      toUserId: friendUser._id.toString()
    });
    await request.save();
    
    // Enviar notificación
    await sendPushNotification(
      friendUser._id.toString(),
      '📨 Nueva solicitud de amistad',
      { body: `${user.email} te envió una solicitud de amistad` }
    );
    
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aceptar solicitud de amistad
app.post('/api/friends/accept/:requestId', async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    
    // Crear amistad bidireccional
    const friend1 = new Friend({
      userId: request.fromUserId,
      friendId: request.toUserId,
      friendEmail: (await User.findById(request.toUserId)).email,
      friendCode: (await User.findById(request.toUserId)).friendCode
    });
    
    const friend2 = new Friend({
      userId: request.toUserId,
      friendId: request.fromUserId,
      friendEmail: request.fromEmail,
      friendCode: (await User.findById(request.fromUserId)).friendCode
    });
    
    await friend1.save();
    await friend2.save();
    request.status = 'accepted';
    await request.save();
    
    res.json({ message: 'Solicitud aceptada', friend: friend1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener solicitudes pendientes
app.get('/api/friends/requests/:userId', async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      toUserId: req.params.userId,
      status: 'pending'
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Rechazar solicitud de amistad
app.post('/api/friends/reject/:requestId', async (req, res) => {
  try {
    const request = await FriendRequest.findByIdAndUpdate(
      req.params.requestId,
      { status: 'rejected' },
      { new: true }
    )
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' })
    res.json({ message: 'Solicitud rechazada' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
});
// ============================================
// RUTAS - BATALLAS EN TIEMPO REAL
// ============================================

// Calcular ganador basado en estadísticas
function calculateBattleWinner(team1Stats, team2Stats) {
  const score1 = team1Stats.reduce((sum, stat) => sum + (stat.base || 0), 0);
  const score2 = team2Stats.reduce((sum, stat) => sum + (stat.base || 0), 0);
  
  if (score1 > score2) return 'win';
  if (score2 > score1) return 'lose';
  return 'draw';
}

// Enviar reto de batalla
app.post('/api/battles/request', async (req, res) => {
  try {
    const { userId, friendId, teamId } = req.body;
    if (!userId || !friendId || !teamId) {
      return res.status(400).json({ error: 'userId, friendId y teamId requeridos' });
    }
    
    // Verificar que son amigos
    const friendship = await Friend.findOne({
      userId,
      friendId
    });
    
    if (!friendship) {
      return res.status(400).json({ error: 'No son amigos' });
    }
    
    const request = new BattleRequest({
      fromUserId: userId,
      toUserId: friendId,
      fromTeamId: teamId
    });
    await request.save();
    
    // Enviar notificación
    const user = await User.findById(userId);
    await sendPushNotification(
      friendId,
      '⚔️ Reto de batalla',
      { body: `${user.email} te retó a una batalla` }
    );
    
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aceptar reto de batalla
app.post('/api/battles/:battleId/accept', async (req, res) => {
  try {
    const { opponentTeamId } = req.body;
    const battleDoc = await BattleRequest.findById(req.params.battleId);
    
    if (!battleDoc) {
      return res.status(404).json({ error: 'Batalla no encontrada' });
    }
    
    battleDoc.status = 'accepted';
    await battleDoc.save();
    
    res.json({ message: 'Batalla aceptada', battle: battleDoc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener retos pendientes
app.get('/api/battles/requests/:userId', async (req, res) => {
  try {
    const requests = await BattleRequest.find({
      toUserId: req.params.userId,
      status: 'pending'
    }).populate('fromUserId');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Rechazar reto de batalla
app.post('/api/battles/:battleId/reject', async (req, res) => {
  try {
    const battleDoc = await BattleRequest.findByIdAndUpdate(
      req.params.battleId,
      { status: 'rejected' },
      { new: true }
    )
    if (!battleDoc) return res.status(404).json({ error: 'Batalla no encontrada' })
    res.json({ message: 'Reto rechazado' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
});
// Finalizar batalla
app.post('/api/battles/:battleId/finish', async (req, res) => {
  try {
    const { result } = req.body;
    const battleDoc = await BattleRequest.findByIdAndUpdate(
      req.params.battleId,
      { status: 'completed', result },
      { new: true }
    );
    
    // Registrar en historial
    const battle = new Battle({
      userId: battleDoc.fromUserId,
      opponentTeam: [],
      userTeam: [],
      result
    });
    await battle.save();
    
    res.json({ message: 'Batalla finalizada', battle: battleDoc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' 
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📦 Base de datos: ${MONGODB_URI}`);
});
