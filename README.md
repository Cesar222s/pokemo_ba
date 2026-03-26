# Backend Pokédex - API Express + MongoDB

## 📋 Descripción

Servidor backend para la aplicación Pokédex. Proporciona:
- Autenticación JWT
- Integración con PokéAPI
- Gestión de usuarios, favoritos, equipos, amigos y batallas
- Push notifications con Web Push API
- Base de datos MongoDB

## 🚀 Quick Start

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo .env
cp .env.example .env  # O copiar manualmente

# 3. Configurar variables de entorno
# Editar .env con:
# - MONGODB_URI
# - VAPID_PUBLIC_KEY
# - VAPID_PRIVATE_KEY

# 4. Iniciar servidor
npm start
# Abre http://localhost:3000
```

## ⚙️ Configuración

### Variables de Entorno (.env)

```env
PORT=3000
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/pokedex1
CLIENT_URL=http://localhost:5173
VAPID_PUBLIC_KEY=<tu-clave-publica>
VAPID_PRIVATE_KEY=<tu-clave-privada>
```

### VAPID Keys para Push Notifications

Las VAPID keys son necesarias para enviar notificaciones push.

#### Opción 1: Generar nuevas keys

```bash
# Instalar web-push globalmente
npm install -g web-push

# Generar claves
web-push generate-vapid-keys

# Output:
# Public Key: BMC5...something...
# Private Key: xyz...something...
```

Copiar las claves al archivo `.env`.

#### Opción 2: Usar claves existentes

Si ya tienes claves VAPID, simplemente pégalas en el `.env`.

⚠️ **IMPORTANTE:**
- Las claves privadas NUNCA debes compartirlas
- Usa `.gitignore` para no subir `.env` a GitHub
- En producción, usa variables de entorno del servidor

## 📚 Stack Tecnológico

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| Node.js | v16+ | Runtime |
| Express | ^5.2.1 | Framework HTTP |
| Mongoose | ^9.2.1 | ODM MongoDB |
| MongoDB | Cloud | Base de datos |
| Web Push | ^3.6.7 | Notificaciones push |
| CORS | ^2.8.5 | Cross-origin |
| Dotenv | ^17.3.1 | Variables de entorno |

## 🏗️ Estructura del Proyecto

```
backend_pokemon/
├── server.js              # Punto de entrada - todos los endpoints
├── package.json           # Dependencias
├── .env                   # Variables de entorno (no commitar)
├── .env.example           # Plantilla de .env
└── README.md              # Este archivo
```

## 📡 API Endpoints

### Autenticación
```
POST /auth/register
POST /auth/login
```

### Pokédex
```
GET /pokemon              # Listado con paginación
GET /pokemon/:id          # Detalles de un Pokémon
```

### Favoritos
```
GET /api/favorites/:userId                    # Mis favoritos
POST /api/favorites                           # Agregar
DELETE /api/favorites/:userId/:pokemonId      # Eliminar
```

### Equipos
```
GET /api/teams/:userId          # Mis equipos
POST /api/teams                 # Crear
PUT /api/teams/:teamId          # Actualizar
DELETE /api/teams/:teamId       # Eliminar
```

### Amigos
```
GET /api/friends/:userId                   # Mis amigos
POST /api/friends/add                      # Agregar por código
DELETE /api/friends/:userId/:friendId      # Eliminar amigo
```

### Solicitudes de Amistad
```
POST /api/friends/request                # Enviar solicitud
POST /api/friends/accept/:requestId      # Aceptar
POST /api/friends/reject/:requestId      # Rechazar
GET /api/friends/requests/:userId        # Mis solicitudes
```

### Batallas
```
POST /api/battles/request                 # Retar
POST /api/battles/:battleId/accept        # Aceptar reto
POST /api/battles/:battleId/reject        # Rechazar reto
POST /api/battles/:battleId/finish        # Finalizar
GET /api/battles/requests/:userId         # Mis retos
```

### Push Notifications
```
POST /api/push/subscribe    # Suscribirse a notificaciones
```

### Health Check
```
GET /health               # Estado del servidor
```

## 🗄️ Modelos de Base de Datos

### User
```javascript
{
  email: String (unique),
  passwordHash: String,
  passwordSalt: String,
  friendCode: String (8 dígitos),
  createdAt: Date
}
```

### Favorite
```javascript
{
  userId: String,
  pokemonId: Number,
  pokemonName: String,
  sprite: String,
  officialArt: String,
  types: [String],
  timestamp: Date
}
```

### Team
```javascript
{
  userId: String,
  name: String,
  pokemons: [
    {
      pokemonId: Number,
      pokemonName: String,
      sprite: String,
      officialArt: String
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Friend
```javascript
{
  userId: String,
  friendId: String,
  friendEmail: String,
  friendCode: String,
  createdAt: Date
}
```

### FriendRequest
```javascript
{
  fromUserId: String,
  fromEmail: String,
  toUserId: String,
  status: String (pending/accepted/rejected),
  createdAt: Date
}
```

### BattleRequest
```javascript
{
  fromUserId: String,
  toUserId: String,
  fromTeamId: String,
  status: String (pending/accepted/rejected/completed),
  result: String (win/lose/draw),
  createdAt: Date
}
```

### PushSubscription
```javascript
{
  userId: String (unique),
  subscription: Object,
  createdAt: Date
}
```

## 🔐 Autenticación

### Flujo JWT

1. **Registro**
   ```bash
   POST /auth/register
   {
     "email": "user@example.com",
     "password": "securePassword"
   }
   ```
   
   Response:
   ```json
   {
     "user": { "id": "...", "email": "..." },
     "token": "eyJhbGc..."
   }
   ```

2. **Login**
   ```bash
   POST /auth/login
   {
     "email": "user@example.com",
     "password": "securePassword"
   }
   ```

3. **Uso del Token**
   ```bash
   GET /api/favorites/userId
   Headers: {
     "Authorization": "Bearer eyJhbGc..."
   }
   ```

### Seguridad
- Contraseñas hasheadas con PBKDF2
- Salt aleatorio (16 bytes)
- 100,000 iteraciones PBKDF2

## 🔔 Sistema de Notificaciones Push

### Flujo

1. **Frontend suscribe**
   ```javascript
   navigator.serviceWorker.ready.then(reg => {
     reg.pushManager.subscribe(...)
       .then(subscription => {
         fetch('/api/push/subscribe', {
           method: 'POST',
           body: JSON.stringify({ userId, subscription })
         })
       })
   })
   ```

2. **Backend envía notificación**
   ```javascript
   // Cuando un amigo envía solicitud
   await sendPushNotification(
     friendId,
     '📨 Nueva solicitud',
     { body: 'Te envió una solicitud de amistad' }
   )
   ```

3. **Service Worker recibe y muestra**
   ```javascript
   self.addEventListener('push', event => {
     const { title, options } = event.data.json()
     registration.showNotification(title, options)
   })
   ```

## 🎮 Sistema de Batallas

### Cálculo de Ganador

El ganador se determina sumando las estadísticas base de todos los Pokémon:

```javascript
function calculateBattleWinner(team1Stats, team2Stats) {
  const score1 = team1Stats.reduce((sum, stat) => sum + stat.base, 0)
  const score2 = team2Stats.reduce((sum, stat) => sum + stat.base, 0)
  
  if (score1 > score2) return 'win'
  if (score2 > score1) return 'lose'
  return 'draw'
}
```

### Futuras Mejoras
- Batalla turno a turno
- Sistema de tipos (ventajas/desventajas)
- Movimientos especiales
- Random factor

## 🚨 Errores Comunes

### CORS Error
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solución:** Verificar `CLIENT_URL` en `.env` coincide con origen del frontend.

### MongoDB Connection Error
```
MongooseError: Cannot connect to MongoDB
```

**Solución:** Verificar `MONGODB_URI` en `.env`:
```
mongodb+srv://usuario:password@cluster.mongodb.net/nombre_bd
```

### VAPID Keys Invalid
```
Error: Invalid VAPID keys
```

**Solución:** Regenerar keys con `web-push generate-vapid-keys`

### Push Notifications no funcionan
1. Verificar `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` en `.env`
2. Verificar `PushSubscription` se guardó en MongoDB
3. Revisar logs del servidor

## 📈 Monitoreo

### Ver estado
```bash
curl http://localhost:3000/health
# Response: { "status": "ok", "mongodb": "connected" }
```

### Logs
```bash
# Con nodemon (desarrollo)
npm run dev
# Se verá todo en consola
```

### Debuggin MongoDB
```javascript
// En el server.js
mongoose.set('debug', true) // Activa logs de queries
```

## 🧪 Testing (WIP)

```bash
# Tests unitarios (próximamente)
npm test
```

## 📦 Deployment

### Heroku
```bash
# Crear app
heroku create mi-api-pokemon

# Configurar variables
heroku config:set MONGODB_URI="..."
heroku config:set VAPID_PUBLIC_KEY="..."
heroku config:set VAPID_PRIVATE_KEY="..."

# Deploy
git push heroku main
```

### Railway, Render, etc.
Seguir los mismos pasos para variables de entorno.

## 🔗 Links Útiles

- [Express Docs](https://expressjs.com)
- [MongoDB Docs](https://docs.mongodb.com)
- [Mongoose Docs](https://mongoosejs.com)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [PokéAPI](https://pokeapi.co/docs/v2)

## 📝 Licencia

MIT License

## 👨‍💻 Autor

Desarrollado como backend para la aplicación Pokédex fullstack.

---

**¿Dudas?** Abre un issue o contacta al equipo de desarrollo.
