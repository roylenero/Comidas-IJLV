# Arquitectura — IJLV Comidas

Aplicación pequeña (≈70 alumnos, ≈50 familias, 1–3 administradores). Todo corre en el navegador contra Firebase en plan **Spark**: sin servidores propios, sin Cloud Functions, sin Cloud Storage. Toda la lógica que debe ser confiable (horarios, precios, aislamiento, duplicados) se hace cumplir en **`firestore.rules`**; la interfaz solo refleja esas reglas.

```
Navegador (React PWA)
  ├─ Firebase Auth ── Google / correo+contraseña → token con email y email_verified
  └─ Cloud Firestore ── reglas de seguridad (hora del servidor, rol por correo)
Firebase Hosting ── sirve la PWA (app shell cacheada por el service worker)
```

## 1. Identidad, autorización y roles

**Autenticarse no equivale a estar autorizado.**

- **Autenticación** (quién eres): Firebase Auth con **Google** o **correo y contraseña**. El correo debe estar verificado; en correo+contraseña la verificación es obligatoria (pantalla “Verifica tu correo”). No se usa enlace mágico.
- **Autorización** (qué puedes ver): **una sola capa para ambos métodos**, en `firestore.rules` y replicada en `services/access.ts` solo para decidir qué pantalla mostrar:
  - `verified()`: hay sesión, el token trae `email` y `email_verified == true`.
  - `isParent()`: `verified()` + existe `authorizedEmails/{correo del token en minúsculas}` (cargado por el IJLV) + la familia a la que apunta está `active == true`.
  - `isAdmin()`: `verified()` + existe `admins/{correo}`.
- Todo se evalúa en **cada petición** con el correo **actual** del token. No hay vínculo guardado entre la cuenta (uid) y la familia, así que un cambio de correo no hereda nada: la cuenta pierde el acceso anterior y solo obtiene otro si el nuevo correo está autorizado y verificado. El cliente vuelve a validar cuando cambia uid, correo o verificación (`SessionProvider`).
- **La tabla correo → familia no es enumerable**: cada usuario solo puede hacer `get` de *su propio* `authorizedEmails/{correo}` y `admins/{correo}`; `list` solo lo hace un administrador. Una familia no puede consultar otras familias, otros correos ni alumnos ajenos; tampoco puede sondear pedidos de alumnos ajenos (ni los existentes ni los inexistentes).
- Nunca se confía en `familyId`, `studentId` o `studentName` enviados por el cliente: se contrastan con `students/{id}` y con la familia del token.
- **Administrador**: solo desde la consola de Firebase (`admins/{correo}`); ninguna escritura de cliente llega a esa colección.

### Correo + contraseña: amenazas consideradas

| Amenaza | Defensa |
|---|---|
| Alguien crea primero una cuenta con el correo de un padre | La cuenta no está verificada → sin acceso. El padre usa “Olvidé mi contraseña”: el enlace llega a su buzón, reemplaza la contraseña (la del intruso deja de servir) y deja el correo verificado. En Firebase real, el cambio de contraseña revoca las sesiones previas (el emulador no lo reproduce → prueba manual obligatoria). |
| El padre abre un correo de verificación que no pidió | Riesgo residual: verificaría la cuenta del intruso. Mitigación: texto de la plantilla (“si no creaste una contraseña, ignóralo”) y “Olvidé mi contraseña” en cualquier duda; Google evita el caso. Endurecimiento posible: `docs/FUTURE_IDEAS.md`. |
| Descubrir qué correos o alumnos existen | “Olvidé mi contraseña” responde igual siempre; protección contra enumeración de correos activada; `authorizedEmails` no enumerable. |
| Cambiar el correo de la cuenta | La autorización usa siempre el correo actual y verificado. |
| Hacerse administrador | `admins` sin escrituras de cliente; exige correo verificado. |

## 2. Colecciones

| Colección | ID | Campos | Quién lee | Quién escribe |
|---|---|---|---|---|
| `admins` | correo | `createdAt` | cada usuario solo el suyo | nadie (consola) |
| `authorizedEmails` | correo en minúsculas | `familyId`, `createdAt` | el propio correo; admin | admin |
| `families` | auto | `name`, `active`, `createdAt`, `updatedAt` | su familia; admin | admin |
| `students` | auto | `name`, `familyId`, `active`, `createdAt`, `updatedAt` | alumnos de su familia; admin | admin |
| `settings` | `app` | `prices: { breakfast, lunch }`, `updatedAt` | miembros | admin |
| `menuWeeks` | lunes `YYYY-MM-DD` | `weekStart`, `hasImage`, `imageUpdatedAt`, `updatedAt` | miembros | admin |
| `menuDays` | fecha `YYYY-MM-DD` | `date`, `weekId`, `noService`, `breakfast`/`lunch`: `{ available, description, cutoffAt }`, `updatedAt` | miembros | admin |
| `menuAssets` | lunes `YYYY-MM-DD` | `dataUrl`, `mimeType`, `width`, `height`, `bytes`, `updatedAt` | miembros | admin |
| `orders` | `{fecha}_{studentId}_{servicio}` | ver abajo | su familia; admin | ver reglas |

“Miembros” = administradores y padres con correo **verificado**, autorizado por el IJLV y de una familia activa.

### Pedido (`orders`)

```
date           "2026-09-29"          fecha del servicio (zona México)
studentId      "abc123"
studentName    "Mateo López"          copia para listas rápidas (se valida contra students)
familyId       "fam1"
service        "breakfast" | "lunch"
priceAtOrder   55                     precio congelado al pedir
status         "active" | "cancelled"
paymentStatus  "pending" | "paid"
source         "parent" | "admin"     quién lo originó
createdAt / updatedAt                 serverTimestamp (== request.time)
createdBy / updatedBy                 uid
```

Nunca se borra un pedido: se cancela (historial y pagos intactos). Volver a pedir reactiva el mismo documento con el precio vigente.

### Relaciones y consultas

- Familia 1—N alumnos (`students.familyId`), familia 1—N correos (`authorizedEmails.familyId`).
- Padres: `students where familyId == X`; `orders where familyId == X and date in [desde, hasta] orderBy date`.
- Menú: `menuDays where weekId == lunes`; `menuWeeks/{lunes}`; la imagen (`menuAssets/{lunes}`) solo se descarga al tocar “Ver menú semanal”.
- Dashboard: `orders where date == D` (en tiempo real, conteo en el cliente: son decenas de documentos).
- Pagos: `orders where paymentStatus == 'pending' orderBy date`.

Índices compuestos (`firestore.indexes.json`): `orders(familyId, date)` y `orders(paymentStatus, date)`. `menuAssets.dataUrl` está excluido de índices.

Con este volumen, el uso diario queda muy por debajo de las cuotas gratuitas (50 000 lecturas / 20 000 escrituras por día).

## 3. Horarios y zona horaria

- Todas las fechas de negocio son cadenas `YYYY-MM-DD` en `America/Mexico_City` (Luxon con zona por defecto). México no usa horario de verano desde 2022, pero no se asume: siempre se calcula con la base de zonas.
- Al guardar un día del menú, la app calcula `cutoffAt` (Timestamp absoluto) para cada servicio: 10:00 y 11:00 hora de México (`SERVICE_CUTOFFS`).
- Las reglas comparan **`request.time < cutoffAt`**. `request.time` es la hora del servidor de Google: el reloj del teléfono no interviene. Además `createdAt`/`updatedAt` deben ser `== request.time` (serverTimestamp), así que no se pueden falsificar.
- La interfaz usa el reloj del dispositivo solo para *mostrar* abierto/cerrado; si el reloj está mal, el servidor rechaza y la app lo explica.
- Si en el futuro cambian los horarios: editar `SERVICE_CUTOFFS` y volver a guardar las semanas futuras en el editor de menú (recalcula `cutoffAt`).

## 4. Anti-duplicados

1. **ID determinista** `{fecha}_{studentId}_{servicio}`: las reglas exigen ese ID exacto, también para administración. Solo puede existir un documento por alumno/fecha/servicio.
2. Si el documento ya existe, un segundo “crear” es un *update* y las reglas solo permiten `active → cancelled` o `cancelled → active`; `active → active` se rechaza.
3. La app usa **transacciones**: lee el documento; si está activo reporta “ya solicitado”, si está cancelado lo reactiva, si no existe lo crea. Con dos tutores pidiendo a la vez, Firestore serializa y solo queda un pedido (probado).
4. Para permitir esa lectura previa, las reglas dejan leer un pedido **inexistente** solo si el alumno del ID pertenece a la familia del usuario.

## 5. Seguridad (resumen de `firestore.rules`)

Padres pueden **crear** un pedido solo si: correo verificado y autorizado; alumno activo de su familia activa; `familyId` y `studentName` coinciden con el alumno; `status = active`, `paymentStatus = pending`, `source = parent`; `priceAtOrder` = precio vigente en `settings/app`; el día existe en el menú, no es “sin servicio”, el servicio está disponible y `request.time < cutoffAt`; campos exactos (sin campos extra).

Padres pueden **actualizar** solo para cancelar (antes del cierre, tocando únicamente `status/updatedAt/updatedBy`) o reactivar (mismas condiciones que crear, con el precio vigente). Nunca pueden tocar `paymentStatus`, precio de otro modo, fecha, alumno o familia.

Administración: sin restricción de horario, pero con forma validada, ID determinista y campos inmutables (`date`, `studentId`, `familyId`, `service`, `source`, `createdAt`, `createdBy`). Nadie borra pedidos. Configuración, menú, familias y alumnos: solo admin, con validación de forma.

Ruta no declarada → denegada. 33 pruebas en `tests/rules/firestore.rules.test.ts`.

## 6. Confirmación real y modo sin conexión

- Firestore se inicializa con **caché solo en memoria** (sin persistencia offline).
- **Todas las escrituras** pasan por `serverWrite()` (una transacción): a diferencia de `setDoc`, una transacción **no se encola** sin red; o el servidor la acepta, o falla. Se aborta antes si `navigator.onLine === false` y hay un límite de 15 s; si vence, se dice “no confirmado, revisa Mis pedidos” (nunca “confirmado”).
- “Pedido confirmado” solo se muestra cuando la transacción regresó con éxito.
- El service worker (Workbox) cachea solo la interfaz (JS/CSS/HTML/íconos). Firestore y Auth son de otro origen y no pasan por él. Las actualizaciones se aplican cuando el usuario toca “Actualizar”.

## 7. Imagen semanal sin Cloud Storage

- El admin elige JPG/PNG/WebP; en el navegador se corrige orientación, se reduce a máx. 1600 px por lado y se codifica en **WebP** (o JPEG si el navegador no codifica WebP) bajando calidad y luego tamaño hasta quedar **≤ 600 KB** como Data URL. Si no es posible, se rechaza con explicación.
- Se guarda en `menuAssets/{lunes}` (documento aparte, nunca junto al menú estructurado; límite de Firestore 1 MiB por documento; las reglas topan el campo en ~700 000 bytes).
- `menuWeeks.hasImage` indica si existe, para no descargar la imagen hasta que se pida.
- Los pedidos dependen solo de los datos estructurados; la imagen es complementaria.

## 8. Pagos (V1) y camino a V2

V1: `paymentStatus` pending/paid, editable solo por admin, con vista por familia. Para una pasarela en V2 bastaría con agregar una colección `payments` (movimientos) escrita por un backend confiable (esto sí requeriría Functions/Blaze o un servicio externo) que marque pedidos como pagados; el modelo de pedidos no cambia.

## 9. Frontend

- `config/` constantes de negocio; `services/` único lugar que habla con Firebase; `hooks/useSubscription` para datos en tiempo real; `features/` por rol.
- Administración se carga en un bloque aparte (lazy) para que la app de padres sea más ligera.
- Accesibilidad: textos ≥ 16 px, objetivos táctiles ≥ 44 px, foco visible, `<dialog>` nativo, estados con texto e ícono (no solo color), etiquetas reales.
