# Pruebas en Firebase real (solo datos DEMO)

Objetivo: comprobar en el proyecto real `ijlv-comidas` lo que el emulador no puede demostrar, **antes** de cargar familias reales. No se usan correos de padres reales en ningún paso.

## 0. Cuentas de prueba

Todas las cuentas de correo y contraseña pueden llegar a **un solo buzón** que controles, usando alias con `+` (funciona en Gmail y en Google Workspace). Si tu buzón es `nombre@gmail.com`:

| Cuenta | Método | Se autoriza en | Estado esperado |
|---|---|---|---|
| `nombre+demo1@gmail.com` | Correo y contraseña | Familia Demo 1 | Verificada |
| `nombre+demo1b@gmail.com` | Correo y contraseña | Familia Demo 1 | **Nunca** verificar (prueba A) |
| `nombre+demo2@gmail.com` | Correo y contraseña | Familia Demo 2 | Verificada |
| `nombre+reset@gmail.com` | Correo y contraseña | Familia Demo 1 | Para la prueba I |
| `nombre+demo9@gmail.com` | Correo y contraseña | **Ninguna** | Verificada (no autorizada) |
| Una cuenta de Google tuya | Google | Familia Demo 2 | Prueba C |
| Otra cuenta de Google | Google | **Ninguna** | Prueba D |

## 1. Datos DEMO (se crean desde la app, con el administrador)

Requisitos: reglas y app publicadas, y el documento de administrador creado en la consola (ver README → *Crear el primer administrador*).

1. Entra a <https://ijlv-comidas.web.app> con la cuenta de administrador.
2. **Precios** → deja $55 / $70 → **Guardar precios**.
3. **Familias → Nueva familia**:
   - Nombre `Familia Demo 1` · correos: `nombre+demo1@…`, `nombre+demo1b@…`, `nombre+reset@…` · alumnos: `Mateo Demo` y `Sofía Demo` (una línea cada uno).
   - Nombre `Familia Demo 2` · correos: `nombre+demo2@…` y la cuenta de Google autorizada · alumno: `Lucía Demo`.
4. **Menú** → semana actual y siguiente, descripciones con la palabra “DEMO” → **Publicar**.

Crear las contraseñas: en otra ventana privada abre la app → *Entrar con correo* → *¿Primera vez? Crear contraseña* para `+demo1`, `+demo1b`, `+demo2`, `+reset` y `+demo9`. Verifica **solo** `+demo1`, `+demo2` y `+demo9` (abre sus correos). **No** abras el correo de `+demo1b` ni el de `+reset`.

## 2. Pruebas

Anota el resultado en la última columna.

| # | Prueba | Cómo | Resultado esperado | Resultado |
|---|---|---|---|---|
| A | Cuenta de familia **sin verificar** | Entrar con `+demo1b` en la app; luego script `aislamiento` (A1–A5) | Solo ve “Verifica tu correo”; el script marca A1–A5 como rechazados | |
| B | Tras verificar | Entrar con `+demo1`; script (B1–B4) | Ve solo a Mateo Demo y Sofía Demo | |
| C | Google autorizado | “Continuar con Google” con la cuenta autorizada | Ve a Lucía Demo | |
| D | Google no autorizado | “Continuar con Google” con la otra cuenta | “No encontramos alumnos asociados a este correo…”; sin datos | |
| E | Familia 1 no consulta Familia 2 | Script (E1–E8) | Todo rechazado | |
| F | Familia 1 no pide para alumno de Familia 2 | Script (F1–F2) | Rechazado | |
| G | Pedido DEMO | `+demo1` pide comida de un día futuro para ambos hijos; el admin tiene el dashboard abierto en otra ventana | “Pedido confirmado” aparece solo después de “Enviando pedido…”; el contador del admin sube de inmediato. Con el navegador en modo sin conexión, el botón se bloquea | |
| H | Cancelar dentro del horario | `+demo1` → Mis pedidos → Cancelar | Queda “Cancelado”; el contador del admin baja | |
| I | Sesión anterior tras restablecer contraseña | Script `sesion-reset` con `+reset` | I1 y I2 en ✅ (la sesión anterior no se renueva ni ve datos) | |

### Script de verificación (desde la carpeta del proyecto)

```bash
node scripts/verify-real.mjs aislamiento
```
Pide, en este orden: correo y contraseña de `+demo1`, de `+demo2`, de `+demo1b` y, opcionalmente, de `+demo9`. Solo lee; todas las escrituras que intenta deben ser rechazadas. Al final muestra `Resultado: X/X`.

```bash
node scripts/verify-real.mjs sesion-reset
```
Inicia sesión con `+reset` (sin verificar), te pide restablecer la contraseña desde el correo **sin cerrar el script** y luego comprueba si esa sesión anterior puede renovarse o ver datos. Si ves ⚠️, anota el resultado exacto.

## 3. Hosting y PWA

| Revisión | Cómo | Esperado | Resultado |
|---|---|---|---|
| Carga directa | Abrir `https://ijlv-comidas.web.app` | Pantalla de acceso, candado HTTPS | |
| Rutas internas | Con sesión, abrir `/pedidos` y recargar (F5) | Carga la misma página, no un 404 | |
| Manifest y service worker | Chrome escritorio → F12 → Application → Manifest / Service workers | Nombre “Instituto Juan Luis Vives — Comidas”, SW activo | |
| Instalación | Android Chrome: menú → Instalar app. iPhone Safari: Compartir → Agregar a inicio | Se abre como app | |
| Google en iPhone | Continuar con Google desde Safari y desde la app instalada | Entra correctamente | |
| Móvil y escritorio | Recorrer menú, pedido y Mis pedidos; admin en escritorio | Sin cortes ni desbordes | |

## 4. Limpieza antes de cargar datos reales

Las reglas no permiten borrar pedidos desde la app. Para limpiar la demo, en la consola de Firebase:

1. **Firestore Database**: elimina los documentos DEMO de `orders`, `students`, `authorizedEmails`, `families`, `menuDays`, `menuWeeks` y `menuAssets` (los de las semanas de prueba).
2. **Authentication → Usuarios**: elimina las cuentas `+demo…`, `+reset` y las cuentas de Google de prueba.
3. Conserva `admins` y `settings/app`.
