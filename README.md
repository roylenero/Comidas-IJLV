# IJLV Comidas

PWA para registrar y controlar los **desayunos y comidas** del Instituto Juan Luis Vives.

- **Padres y madres**: consultan el menú semanal, piden desayuno y/o comida para uno o varios hijos con anticipación, cancelan antes del cierre y consultan el estado de pago.
- **Administración**: ve cuántos desayunos y comidas preparar cada día (en tiempo real), la lista de alumnos, registra pedidos por teléfono (incluso después del cierre), gestiona menú, imagen semanal, familias, alumnos, precios y pagos.

Costo de infraestructura: **$0 MXN** (plan Spark de Firebase, sin tarjeta, sin Cloud Functions ni Cloud Storage).

---

## Índice

1. [Stack](#stack)
2. [Reglas del negocio](#reglas-del-negocio)
3. [Acceso de padres y seguridad](#acceso-de-padres-y-seguridad)
4. [Desarrollo local](#desarrollo-local)
5. [Pruebas](#pruebas)
6. [Puesta en marcha en Firebase (paso a paso)](#puesta-en-marcha-en-firebase-paso-a-paso)
7. [Carga inicial de familias y alumnos](#carga-inicial-de-familias-y-alumnos)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Solución de problemas](#solución-de-problemas)

Documentación técnica: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Ideas fuera de V1: [`docs/FUTURE_IDEAS.md`](docs/FUTURE_IDEAS.md)

---

## Stack

React 19 · Vite · TypeScript · Firebase Authentication · Cloud Firestore · Firebase Hosting · vite-plugin-pwa · Luxon · Vitest · Firebase Emulator Suite.

Zona horaria oficial `America/Mexico_City`, locale `es-MX`, moneda MXN.

## Reglas del negocio

| Regla | Dónde se aplica |
|---|---|
| Desayuno: los padres crean/cancelan/vuelven a pedir **antes de las 10:00:00**; comida, **antes de las 11:00:00** (hora de Ciudad de México). | Reglas de Firestore con `request.time` (hora del servidor). La interfaz solo lo muestra. |
| Administración puede registrar, modificar o cancelar a cualquier hora. | Reglas de Firestore |
| Un alumno no puede tener dos desayunos ni dos comidas el mismo día. | ID determinista `{fecha}_{alumno}_{servicio}` + reglas + transacción |
| Precios editables (iniciales $55 / $70). Cada pedido guarda `priceAtOrder`; cambiar el precio no altera pedidos anteriores. | `settings/app` + reglas |
| Días “Sin servicio”: visibles, sin pedidos. | Reglas + interfaz |
| Pagos: solo `pending`/`paid`; solo administración los cambia. | Reglas |
| Un pedido se muestra como “confirmado” solo cuando el servidor lo aceptó. Sin internet no se envían pedidos. | Transacciones de Firestore + caché solo en memoria |
| Pedidos fuera de horario: teléfono **222 914 4408** (tocable en el celular). | `src/config/business.ts` |

Horarios, teléfono y zona horaria están centralizados en [`src/config/business.ts`](src/config/business.ts). Los precios **no** están ahí: viven en Firestore.

## Acceso de padres y seguridad

**Autenticarse no equivale a estar autorizado.** V1 separa dos preguntas:

1. **¿Quién eres?** (autenticación) — dos métodos:
   - **Continuar con Google**.
   - **Entrar con correo** (correo y contraseña de Firebase), con **verificación del correo obligatoria**.
2. **¿Qué puedes ver?** (autorización) — **una sola capa, igual para ambos métodos**: el correo debe estar **verificado**, estar **previamente cargado por el IJLV** en una familia y esa familia debe estar **activa**. Se evalúa en las reglas de Firestore en *cada* petición, con el correo actual de la sesión.

El padre nunca registra hijos ni crea familias: si su correo verificado no está cargado por el IJLV, ve *“No encontramos alumnos asociados a este correo. Comunícate con el Instituto para verificar tus datos.”* y no obtiene ningún dato.

V1 **no usa enlace mágico** (en el plan gratuito solo permite 5 envíos al día para todo el proyecto).

### Primera activación con correo

1. Pantalla inicial → **Entrar con correo** → **¿Primera vez? Crear contraseña**.
2. Escribe el correo que tiene registrado el IJLV y una contraseña (mínimo 8 caracteres).
3. Llega un mensaje de verificación. Mientras no lo abra, la app solo muestra **“Verifica tu correo”** con tres opciones: *Ya verifiqué mi correo*, *Reenviar correo de verificación* y *Cerrar sesión*. No se consulta ni se muestra ninguna familia, alumno, pedido o pago (y las reglas lo impiden aunque se manipule la app).
4. Abre el enlace del mensaje y toca **Ya verifiqué mi correo**: la app vuelve a consultar el estado real de la cuenta, obtiene una sesión nueva y entonces comprueba si el correo está autorizado.
5. Si lo está, ve a sus hijos. La sesión queda guardada en el dispositivo.

Si al crear la contraseña aparece *“Este correo ya tiene una contraseña”*, debe usar **Olvidé mi contraseña** (ver siguiente punto).

### Olvidé mi contraseña

Envía un mensaje para crear una contraseña nueva. La respuesta es siempre la misma (*“Si hay una cuenta con ese correo…”*), para no revelar qué correos existen. Abrir ese enlace también prueba que el buzón es suyo, por lo que el correo queda verificado.

### Si alguien se adelanta a crear la cuenta con el correo de un padre

- Esa cuenta queda **sin verificar** → las reglas no le dan acceso a nada (probado).
- Cuando el padre real usa **Olvidé mi contraseña**, la contraseña del intruso deja de servir (probado) y, en Firebase real, sus sesiones abiertas se revocan (ver *Prueba obligatoria en Firebase real*).
- Riesgo residual: si el padre abre un correo de verificación **que él no pidió**, verificaría la cuenta del intruso. Por eso la plantilla del correo debe decir que lo ignore si no creó una contraseña (paso 3 de la puesta en marcha) y, ante cualquier duda, basta con usar *Olvidé mi contraseña*. Para quienes tengan cuenta de Google, **Continuar con Google** evita este escenario.

### Cambio de correo

La autorización siempre usa el correo **actual y verificado** de la sesión. Si una cuenta cambia de correo, pierde en la siguiente petición el acceso de la familia anterior y solo obtendría otra si el nuevo correo está autorizado **y** verificado (probado). La app vuelve a validar automáticamente cuando cambia el correo.

### Administradores

Solo lo es quien tenga documento en `admins/{correo}` **y** el correo verificado. Esa colección no se puede escribir desde la app (ni siquiera por un administrador): se gestiona en la consola de Firebase. Cambiar el correo, editar la app, `localStorage` o las peticiones no da ese rol (probado).

### Prueba obligatoria en Firebase real

Procedimiento completo y script de verificación: [`docs/PRUEBAS_FIREBASE_REAL.md`](docs/PRUEBAS_FIREBASE_REAL.md) (prueba I: `node scripts/verify-real.mjs sesion-reset`).

El emulador no reproduce dos comportamientos de Firebase real. Antes de abrir la app a las familias:

1. **Revocación de sesión tras restablecer contraseña.** En el navegador A, crea una cuenta con un correo de prueba autorizado (sin verificarla). En el navegador B, usa *Olvidé mi contraseña* con ese correo, abre el enlace y crea otra contraseña. Vuelve al navegador A y recarga: debe quedar en la pantalla de acceso o en “Verifica tu correo”, **nunca** ver alumnos.
2. **Google.** Entrar con una cuenta de Google autorizada (ve a sus hijos) y con una no autorizada (ve “No encontramos alumnos…”).

---

## Desarrollo local

Requisitos: Node.js 20+ y Java 11+ (para el emulador de Firestore).

```bash
npm install

# Terminal 1: emuladores de Auth y Firestore (no tocan datos reales)
npm run emulators

# Terminal 2: datos DEMO en el emulador
npm run seed:demo

# Terminal 3: la app contra los emuladores
echo "VITE_USE_EMULATORS=true" > .env.development.local
npm run dev
```

Abre <http://localhost:5173>. Cuentas DEMO (contraseña `demo1234`, botón “Entrar con correo”):

| Correo | Rol |
|---|---|
| `admin.demo@ijlv.test` | Administración (también tutor de “Familia Demo 2”) |
| `familia1.demo@ijlv.test` | Familia Demo 1: Mateo Demo y Sofía Demo |
| `familia2.demo@ijlv.test` | Familia Demo 2: Lucía Demo |
| `sinalumnos.demo@ijlv.test` | Correo verificado sin alumnos (pantalla de “no encontramos alumnos”) |
| `sinverificar.demo@ijlv.test` | Correo de la Familia Demo 1 **sin verificar**: solo ve “Verifica tu correo”. El enlace aparece en la terminal de los emuladores al tocar “Reenviar”. |

Los datos DEMO **solo existen en el emulador**: el script se niega a ejecutarse contra un proyecto que no empiece con `demo-`. Se borran solos al detener el emulador.

## Pruebas

```bash
npm test            # unitarias y de componentes (fechas/cierres, CSV, compresión, offline, multihijo)
npm run test:rules  # reglas de seguridad + flujo real de Auth contra los emuladores
npm run lint
npm run typecheck
npm run build
npm run check       # todo lo anterior
```

Cobertura de los escenarios críticos del proyecto:

| # | Escenario | Prueba |
|---|---|---|
| 1–5 | Aislamiento entre familias, no autoasignarse admin, no cambiar precios ni pagos | `tests/rules` |
| 6–9 | 09:59:59 / 10:00:00 / 10:59:59 / 11:00:00 | `src/lib/dates.test.ts` (cálculo del instante) + `tests/rules` (abierto/cerrado con hora del servidor) |
| 10 | Manipular el reloj local no evita el cierre | `tests/rules` (hora falsificada rechazada) |
| 11–12 | Admin registra después del cierre | `tests/rules` |
| 13–14 | Sin duplicados, incluso con dos tutores a la vez | `tests/rules` (transacciones simultáneas) |
| 15–19 | Pedido futuro, cancelaciones, día sin servicio | `tests/rules` |
| 20 | Sin internet nunca “Pedido confirmado” | `src/features/parent/OrderSheet.test.tsx`, `src/lib/errors.test.ts` |
| 21 | Cambio de precio no altera históricos | `tests/rules` |
| 22 | Padre con dos hijos | `tests/rules` + `OrderSheet.test.tsx` |

Endurecimiento de acceso (autenticado ≠ autorizado):

| Caso | Prueba |
|---|---|
| A. Correo+contraseña sin verificar (correo de una familia real): no lee familia, alumnos, pedidos, pagos ni crea pedidos | `tests/rules/firestore.rules.test.ts`, `tests/rules/auth-flow.test.ts` (emulador de Auth real), `SessionProvider.test.tsx` |
| B. Verificado y autorizado: solo su familia | ídem |
| C. Verificado pero no registrado | ídem |
| D. Suplantación: cuenta sin verificar con el correo de un padre; el dueño la recupera con “Olvidé mi contraseña” | `firestore.rules.test.ts`, `auth-flow.test.ts` |
| E/F. Otra familia / studentId de otra familia | `firestore.rules.test.ts` |
| G. Google autorizado / no autorizado / no verificado (misma capa de permisos) | `firestore.rules.test.ts` (token de proveedor `google.com`), `SessionProvider.test.tsx`; inicio de sesión con Google real: prueba manual |
| H. Cambio de correo | `firestore.rules.test.ts`, `auth-flow.test.ts` (`verifyBeforeUpdateEmail` real), `SessionProvider.test.tsx` |
| Familia desactivada pierde el acceso; nadie se autoasigna admin | `firestore.rules.test.ts` |
| Pantallas de acceso y “Verifica tu correo” | `AuthScreens.test.tsx` |

---

## Puesta en marcha en Firebase (paso a paso)

Nada de esto requiere tarjeta ni activar facturación.

### 1. Crear el proyecto

1. Entra a <https://console.firebase.google.com> con la cuenta de Google del Instituto → **Agregar proyecto**.
2. Proyecto creado: **`ijlv-comidas`** (plan Spark, Firestore `(default)` en `nam5`, modo producción).
3. Google Analytics: no es necesario.
4. El proyecto queda en plan **Spark** (gratuito). No lo cambies a Blaze.

### 2. Registrar la app web

1. Configuración del proyecto (⚙️) → **Tus apps** → ícono `</>` → nombre `IJLV Comidas`. **No** marques Hosting aquí.
2. Copia los valores de `firebaseConfig` a un archivo `.env.production.local` (usa `.env.example` como guía):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=ijlv-comidas.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ijlv-comidas
VITE_FIREBASE_STORAGE_BUCKET=ijlv-comidas.firebasestorage.app   # la app NO usa Storage; no se lee
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_USE_EMULATORS=false
```

`.env.production.local` **no se sube al repositorio** (`.gitignore`); cada computadora que publique la app necesita su propia copia. `npm run build` se detiene con un error si falta la configuración o si `VITE_USE_EMULATORS=true`, para no publicar una app rota.

> Estos valores son públicos por diseño (van dentro de la app). La seguridad la dan las reglas de Firestore. **Nunca** pongas en el proyecto credenciales de *service account*.

### 3. Authentication

1. En la consola del proyecto, menú izquierdo **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Método de acceso (Sign-in method)**:
   - **Agregar proveedor → Correo electrónico/contraseña** → activa **solo** el primer interruptor (“Correo electrónico/contraseña”). El segundo, **“Vínculo del correo electrónico (acceso sin contraseña)”, debe quedar desactivado** → Guardar.
   - **Agregar proveedor → Google** → Habilitar → elige el correo de asistencia del Instituto → Guardar.
3. Pestaña **Configuración (Settings)**:
   - **Dominios autorizados**: deben aparecer `ijlv-comidas.web.app` y `ijlv-comidas.firebaseapp.com` (y tu dominio propio si lo agregas).
   - **Acciones de usuario / Protección contra la enumeración de correos**: déjala **activada** (es el valor predeterminado en proyectos nuevos).
4. Pestaña **Plantillas (Templates)**:
   - Botón de idioma (lápiz junto a “Idioma de la plantilla”) → **Español**.
   - **Verificación de dirección de correo electrónico**: nombre del remitente “IJLV Comidas”. Si la consola permite editar el mensaje, agrega: *“Si tú no creaste una contraseña en IJLV Comidas, no abras este enlace e ignora este mensaje.”*
   - **Restablecimiento de contraseña**: mismo remitente.

#### Acceso con Google en iPhone

V1 usa el `authDomain` que entrega Firebase (`ijlv-comidas.firebaseapp.com`), que funciona sin configuración adicional y abre Google en ventana emergente. **Solo si** en la prueba real “Continuar con Google” falla en iPhone (Safari o app instalada), cambia `VITE_FIREBASE_AUTH_DOMAIN` a `ijlv-comidas.web.app`, agrega en Google Cloud Console → *APIs y servicios* → *Credenciales* → cliente OAuth “Web client (auto created by Google Service)” el URI de redirección `https://ijlv-comidas.web.app/__/auth/handler`, recompila y vuelve a publicar.

### 4. Firestore

1. **Firestore Database → Crear base de datos** → modo **producción**.
2. Región: una cercana (por ejemplo `nam5`). No se puede cambiar después.

### 5. Preparar tu computadora (una sola vez)

Requisitos: [Node.js 22 LTS](https://nodejs.org) y Git.

```bash
git clone https://github.com/roylenero/Comidas-IJLV.git
cd Comidas-IJLV
git checkout claude/zealous-volta-vo2fsl
npm ci
```

Crea en esa carpeta el archivo `.env.production.local` (ver paso 2) y luego:

```bash
npx firebase login            # abre el navegador: entra con la cuenta dueña del proyecto
npx firebase projects:list    # debe aparecer ijlv-comidas
```

El proyecto ya está fijado en `.firebaserc` (`ijlv-comidas`); no hace falta `firebase use`.

### 6. Publicar reglas, índices y la app

Desde la carpeta `Comidas-IJLV`:

```bash
npx firebase deploy --only firestore:rules,firestore:indexes,hosting
```

- Antes de publicar el Hosting se ejecuta `npm run build` automáticamente (`predeploy` en `firebase.json`).
- No uses `--force`.
- Los índices tardan unos minutos en construirse (Consola → Firestore → Índices).

### 7. Crear el primer administrador

Por seguridad **ningún usuario puede hacerse administrador desde la app**; se hace en la consola (solo quien administra el proyecto de Firebase tiene acceso):

1. Firestore Database → pestaña **Datos** → **+ Iniciar colección** → ID de la colección: `admins` → Siguiente.
2. **ID del documento**: el correo del administrador exactamente, **en minúsculas** (no uses “ID automático”).
3. Campo: nombre `createdAt`, tipo **timestamp**, valor: la fecha y hora actuales → **Guardar**.

Ese correo debe poder entrar con Google o con correo y contraseña **verificado**; si no está verificado, las reglas no le dan el rol.

Repite para cada administrador. Para quitar a alguien, borra su documento.

### 8. Pruebas con datos DEMO

La app queda en `https://ijlv-comidas.web.app`. Antes de cargar familias reales, sigue [`docs/PRUEBAS_FIREBASE_REAL.md`](docs/PRUEBAS_FIREBASE_REAL.md) (cuentas DEMO, pruebas A–I, Hosting/PWA y limpieza).

### 9. Configuración inicial dentro de la app

1. Entra con el correo de administrador (Google o correo y contraseña).
2. **Precios** → revisa $55 / $70 → **Guardar precios** (crea `settings/app`; sin esto las familias no pueden pedir).
3. **Familias** → **Importar CSV** (ver siguiente sección).
4. **Menú** → captura la semana → **Publicar menú de la semana**; opcionalmente sube la imagen.

### 10. Dominio propio (opcional)

Hosting → **Agregar dominio personalizado** (p. ej. `comidas.ijlv.edu.mx`), sigue las instrucciones de DNS y agrégalo también en *Authentication → Dominios autorizados*. Si lo usas, cambia `VITE_FIREBASE_AUTH_DOMAIN` a ese dominio, agrega su `/__/auth/handler` al cliente OAuth, recompila y vuelve a desplegar.

### Cada actualización

```bash
git pull
npm ci
npx firebase deploy --only firestore:rules,firestore:indexes,hosting
```

Los usuarios verán “Hay una nueva versión disponible → Actualizar”.

---

## Carga inicial de familias y alumnos

Administración → **Familias** → **Importar CSV**. Plantilla: [`docs/plantilla-importacion.csv`](docs/plantilla-importacion.csv).

```csv
studentName,parentEmail,familyIdentifier
Mateo López,papa.lopez@gmail.com,Familia López
Sofía López,papa.lopez@gmail.com,Familia López
Ana Pérez,mama.perez@gmail.com|papa.perez@hotmail.com,Familia Pérez
```

- Una fila por alumno. Acepta separador `,` o `;` (Excel en español) y encabezados en español (`alumno`, `correo`, `familia`).
- Filas que comparten correo **o** identificador de familia quedan en la **misma familia**.
- Varios correos para una familia: sepáralos con `|` en la misma celda.
- Antes de guardar se muestra una vista previa y los errores por número de fila; si hay errores no se importa nada.
- La importación es “todo o nada” y se puede repetir: no duplica alumnos ni correos ya existentes.
- Desde Excel: *Guardar como → CSV UTF-8* para conservar acentos.

No se piden datos personales adicionales (ni CURP, ni domicilio, ni datos médicos).

---

## Estructura del proyecto

```
firestore.rules            Reglas de seguridad (la pieza crítica)
firestore.indexes.json     Índices compuestos
firebase.json              Hosting, emuladores
scripts/seed-demo.mjs      Datos DEMO para el emulador
tests/rules/               Pruebas de reglas con el emulador
docs/                      Arquitectura, ideas futuras, plantilla CSV
src/
  config/business.ts       Horarios, teléfono, zona horaria, límites (centralizado)
  firebase/                Inicialización y nombres de colecciones
  types/models.ts          Tipos del dominio
  lib/                     Fechas (Luxon), dinero, CSV, compresión de imagen, errores
  services/                Acceso a Firestore/Auth (pedidos, menú, familias, precios)
  hooks/                   Sesión, suscripciones en tiempo real, conectividad
  components/              Piezas de UI compartidas
  features/auth/           Login, verificación de correo, sin acceso
  features/parent/         Menú semanal, pedido, Mis pedidos
  features/admin/          Dashboard, detalle, pedido manual, menú, familias, pagos, precios
  styles/                  tokens.css (colores reemplazables), base, componentes, páginas
```

### Identidad visual

No existe todavía logo ni colores oficiales en el repositorio, así que se usa una identidad **neutral provisional**:

- Colores: variables `--brand-*` en [`src/styles/tokens.css`](src/styles/tokens.css) (y `THEME_COLOR` en `vite.config.ts`).
- Íconos de la PWA: `public/pwa-192x192.png`, `pwa-512x512.png`, `maskable-512x512.png`, `apple-touch-icon.png`, `favicon.svg`.
- Marca en la app: [`src/components/Brand.tsx`](src/components/Brand.tsx) y [`src/features/auth/AuthShell.tsx`](src/features/auth/AuthShell.tsx).

---

## Solución de problemas

| Síntoma | Causa probable / solución |
|---|---|
| Un padre ve “No encontramos alumnos asociados a este correo”. | Su correo no está en *Familias* (o la familia está inactiva, o no tiene alumnos activos). Agrega el correo exacto con el que inicia sesión. |
| “Continuar con Google” no hace nada en iPhone. | Revisa [Acceso con Google en iPhone](#acceso-con-google-en-iphone). Mientras tanto, puede usar correo y contraseña. |
| El correo de verificación no llega. | Revisar “Spam”. Tocar “Reenviar correo”. Confirmar límites vigentes del plan Spark. |
| Las familias no pueden pedir y ven “Los precios aún no están configurados”. | Administración → Precios → Guardar. |
| Error “la consulta requiere un índice”. | `npx firebase deploy --only firestore:indexes` y esperar a que terminen de construirse. |
| “No fue posible guardar: la operación no está permitida”. | El horario cerró (según la hora del servidor), el día no tiene servicio o el menú no está publicado. |
| Un padre necesita pedir tarde. | Llama al 222 914 4408; administración usa **Pedido manual**. |
| Se marcó “Sin servicio” en un día que ya tenía pedidos. | Los pedidos no se cancelan solos: revísalos en el dashboard de ese día y cancélalos. |
| No aparece la versión nueva. | La app muestra “Actualizar”; o cerrar y abrir la app. |
| El emulador no arranca. | Requiere Java 11+. Puertos 8080, 9099 y 4000 libres. |
