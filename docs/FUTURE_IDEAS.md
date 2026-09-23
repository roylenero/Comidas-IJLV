# Ideas para después de V1

No están implementadas a propósito. Cada una debería pasar la pregunta: *¿hace más rápido y confiable que un padre pida o que administración sepa cuánto preparar?*

## Operación
- **Aviso al marcar “Sin servicio” un día con pedidos activos**, con opción de cancelarlos en bloque. Hoy administración debe revisarlos manualmente.
- **Exportar a CSV** los pedidos de un día o de una semana (para contabilidad o cocina).
- **Resumen semanal por familia** (lo pedido y lo pendiente de pago) para enviar recordatorios.
- **Gestión de administradores desde la app** (hoy se hace en la consola de Firebase, a propósito, por seguridad).
- **Plantilla de menú**: copiar el menú de la semana anterior como punto de partida.

## Acceso
- **Enlace mágico por correo** si algún día se activa facturación (el límite de Spark es de 5 envíos diarios).
- **Acceso con Microsoft** para familias con Outlook/Hotmail (gratuito, requiere registrar una app en Azure).

## Pagos (V2)
- Pasarela de pago (Mercado Pago / Stripe) con un backend confiable que registre movimientos en una colección `payments`. Requiere Cloud Functions (plan Blaze) u otro servicio; decidirlo antes por costo.
- Saldo a favor por pedidos cancelados que ya estaban pagados.

## Comunicación
- Recordatorio opcional antes del cierre (push o correo). Requiere infraestructura adicional.

## Identidad
- Sustituir la identidad neutral por el logo y colores oficiales del IJLV (solo tokens e íconos; ver README → Identidad visual).
