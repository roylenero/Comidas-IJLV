# IJLV Comidas

PWA para registrar y controlar los **desayunos y comidas** del Instituto Juan Luis Vives.

- **Padres y madres**: consultan el menú semanal, piden desayuno y/o comida para uno o varios hijos con anticipación, cancelan antes del cierre y consultan el estado de pago.
- **Administración**: ve cuántos desayunos y comidas preparar cada día (en tiempo real), la lista de alumnos, registra pedidos por teléfono (incluso después del cierre), gestiona menú, imagen semanal, familias, alumnos, precios y pagos.

Costo de infraestructura: **$0 MXN** (plan Spark de Firebase, sin tarjeta, sin Cloud Functions ni Cloud Storage).

---

## Índice

1. [Stack](#stack)
2. [Reglas del negocio](#reglas-del-negocio)
3. [Acceso de padres: decisión importante](#acceso-de-padres-decisión-importante)
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

## Acceso de padres: decisión importante

El requerimiento original prefería **enlace mágico por correo** (email link). En el plan gratuito Spark, Firebase limita el envío de enlaces de acceso a **5 correos por día** para todo el proyecto; ampliarlo exige agregar facturación. Con ~70 familias y varios dispositivos eso haría inviable la puesta en marcha, así que V1 usa:

1. **Continuar con Google** (un toque, sin límite de envíos). Funciona para cualquier correo que sea cuenta de Google (Gmail o correos institucionales en Google Workspace).
2. **Correo y contraseña** para quien no use Google: la primera vez el padre crea una contraseña y confirma su correo con un enlace de verificación.

En ambos casos **no hay registro de datos**: el sistema reconoce el correo (debe estar dado de alta por administración) y muestra automáticamente a sus hijos. La sesión queda guardada en el dispositivo, así que normalmente se inicia sesión una sola vez. Un correo que no está dado de alta ve: *“No encontramos alumnos asociados a este correo. Comunícate con el Instituto para verificar tus datos.”*

La seguridad no depende del método: las reglas exigen un **correo verificado** (`email_verified`) y lo comparan con los correos autorizados.

> Los límites de correos de verificación y de restablecimiento de contraseña del plan Spark son distintos (mayores) que los del enlace mágico, pero Google los cambia de vez en cuando. Consulta la tabla vigente en <https://firebase.google.com/docs/auth/limits> antes de la puesta en marcha.

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

Abre <http://localhost:5173>. Cuentas DEMO (contraseña `demo1234`, opción “Ya tengo cuenta”):

| Correo | Rol |
|---|---|
| `admin.demo@ijlv.test` | Administración (también tutor de “Familia Demo 2”) |
| `familia1.demo@ijlv.test` | Familia Demo 1: Mateo Demo y Sofía Demo |
| `familia2.demo@ijlv.test` | Familia Demo 2: Lucía Demo |
| `sinalumnos.demo@ijlv.test` | Correo sin alumnos (pantalla de “no encontramos alumnos”) |

Los datos DEMO **solo existen en el emulador**: el script se niega a ejecutarse contra un proyecto que no empiece con `demo-`. Se borran solos al detener el emulador.

## Pruebas

```bash
npm test            # unitarias y de componentes (fechas/cierres, CSV, compresión, offline, multihijo)
npm run test:rules  # reglas de seguridad contra el emulador de Firestore
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

---

## Puesta en marcha en Firebase (paso a paso)

Nada de esto requiere tarjeta ni activar facturación.

### 1. Crear el proyecto

1. Entra a <https://console.firebase.google.com> con la cuenta de Google del Instituto → **Agregar proyecto**.
2. Nombre sugerido: `ijlv-comidas`. Anota el **ID del proyecto** (p. ej. `ijlv-comidas-1a2b3`).
3. Google Analytics: no es necesario.
4. El proyecto queda en plan **Spark** (gratuito). No lo cambies a Blaze.

### 2. Registrar la app web

1. Configuración del proyecto (⚙️) → **Tus apps** → ícono `</>` → nombre `IJLV Comidas`. **No** marques Hosting aquí.
2. Copia los valores de `firebaseConfig` a un archivo `.env.production.local` (usa `.env.example` como guía):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=TU-PROYECTO.web.app
VITE_FIREBASE_PROJECT_ID=TU-PROYECTO
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
```

> Estos valores son públicos por diseño (van dentro de la app). La seguridad la dan las reglas de Firestore. **Nunca** pongas en el proyecto credenciales de *service account*.

### 3. Authentication

1. **Authentication → Comenzar → Método de acceso**:
   - Habilita **Google** (elige el correo de soporte del Instituto).
   - Habilita **Correo electrónico/contraseña** (deja *desactivado* “Vínculo del correo electrónico”).
2. **Authentication → Configuración → Dominios autorizados**: verifica que estén `TU-PROYECTO.web.app` y `TU-PROYECTO.firebaseapp.com` (y tu dominio propio si lo agregas).
3. **Authentication → Plantillas**: cambia el idioma a **Español** y personaliza el remitente de los correos de verificación y restablecimiento.

#### Acceso con Google en iPhone

Safari bloquea el almacenamiento de terceros; para que “Continuar con Google” funcione bien usa como `VITE_FIREBASE_AUTH_DOMAIN` el **mismo dominio donde se publica la app** (`TU-PROYECTO.web.app`) y agrega en Google Cloud Console → *APIs y servicios* → *Credenciales* → cliente OAuth “Web client (auto created by Google Service)” el URI de redirección autorizado `https://TU-PROYECTO.web.app/__/auth/handler`.

### 4. Firestore

1. **Firestore Database → Crear base de datos** → modo **producción**.
2. Región: una cercana (por ejemplo `nam5`). No se puede cambiar después.

### 5. Instalar la CLI y vincular el proyecto

```bash
npm install            # incluye firebase-tools
npx firebase login
npx firebase use --add # elige tu proyecto y ponle alias "default"
```

(Esto reemplaza el marcador `FIREBASE_PROJECT_ID` de `.firebaserc`.)

### 6. Desplegar reglas e índices

```bash
npx firebase deploy --only firestore:rules,firestore:indexes
```

Los índices tardan unos minutos en construirse (Consola → Firestore → Índices).

### 7. Crear el primer administrador

Por seguridad **ningún usuario puede hacerse administrador desde la app**; se hace en la consola (solo quien administra el proyecto de Firebase tiene acceso):

1. Firestore Database → **Iniciar colección** → ID: `admins`.
2. ID del documento: el correo del administrador **en minúsculas**, p. ej. `direccion@ijlv.edu.mx`.
3. Agrega un campo `createdAt` de tipo *timestamp* (cualquier fecha) → Guardar.

Repite para cada administrador. Para quitar a alguien, borra su documento.

### 8. Publicar la app

```bash
npm run build
npx firebase deploy --only hosting
```

La app queda en `https://TU-PROYECTO.web.app`.

### 9. Configuración inicial dentro de la app

1. Entra con el correo de administrador (Google o correo y contraseña).
2. **Precios** → revisa $55 / $70 → **Guardar precios** (crea `settings/app`; sin esto las familias no pueden pedir).
3. **Familias** → **Importar CSV** (ver siguiente sección).
4. **Menú** → captura la semana → **Publicar menú de la semana**; opcionalmente sube la imagen.

### 10. Dominio propio (opcional)

Hosting → **Agregar dominio personalizado** (p. ej. `comidas.ijlv.edu.mx`), sigue las instrucciones de DNS y agrégalo también en *Authentication → Dominios autorizados*. Si lo usas, cambia `VITE_FIREBASE_AUTH_DOMAIN` a ese dominio, agrega su `/__/auth/handler` al cliente OAuth, recompila y vuelve a desplegar.

### Cada actualización

```bash
npm run check
npx firebase deploy --only hosting,firestore:rules,firestore:indexes
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
