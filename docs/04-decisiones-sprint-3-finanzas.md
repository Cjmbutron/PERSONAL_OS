# PERSONAL OS — Decisiones del Sprint 3 (finanzas personales)

**Cierra:** 17.5 (validación de moneda), 17.6 (transferencias atómicas) y 17.9 para finanzas.
**Estado:** aprobadas por el Product Owner el 2026-11-05. Propuestas aceptadas con estas respuestas: **solo BOB** al inicio, obligaciones **con recurrencia mensual** y presupuestos **por categoría más tope total del mes**.
**No modifica** DEC-001 a DEC-004. Respeta DEC-003 (varias cuentas por workspace) y las reglas 4.3 (7 a 10).

| Paso | Contenido | Estado |
|---|---|---|
| 1 | Cuentas y categorías (migración 7) | Implementado |
| 2 | Movimientos y transferencias (migración 8) | Implementado |
| 3 | Presupuestos, obligaciones y reportes (migración 9) | Implementado |

Notas del paso 1: `currency` y `kind` (tipo de categoría) no se pueden modificar tras crear el registro, ni siquiera sin movimientos; es más estricto que D-40 y suficiente mientras solo exista BOB. Las categorías por defecto (D-49) se siembran con un trigger al crear el workspace y se rellenaron para los workspaces existentes. Hasta el paso 2 la pantalla de cuentas muestra el **saldo inicial**; el saldo calculado (D-44) llega con los movimientos.

## 1. Moneda (17.5)

| ID | Decisión |
|---|---|
| D-40 | Cada cuenta tiene una moneda ISO 4217 que **no cambia** una vez que tiene movimientos. Monedas habilitadas al inicio: **solo BOB**. Añadir otra es una migración que amplía la restricción, sin tocar el resto del modelo. |
| D-41 | Cada movimiento guarda su moneda y la base de datos exige que coincida con la de su cuenta (clave foránea compuesta `(workspace_id, account_id, currency)`, como D-03). |
| D-42 | Sin conversión de monedas: totales y reportes se muestran por moneda y nunca se suman monedas distintas. |

## 2. Cuentas y movimientos

| ID | Decisión |
|---|---|
| D-43 | Tipos de cuenta: efectivo, banco, ahorro, otra. Sin tarjetas de crédito en el MVP. |
| D-44 | El saldo se calcula (saldo inicial + ingresos − gastos ± transferencias); no se almacena. |
| D-45 | Las cuentas se archivan, no se borran (regla 8). Una cuenta archivada no admite movimientos nuevos y conserva su historial. |
| D-46 | Importes `NUMERIC(14,2)` siempre positivos; el tipo (`income`, `expense`, `transfer_in`, `transfer_out`) da el signo. |
| D-47 | La fecha del movimiento es `DATE` (día de calendario) y no puede ser futura. Lo futuro se registra como obligación. |
| D-48 | Un ingreso solo admite categorías de ingreso y un gasto solo de gasto, impuesto por la base de datos. Las transferencias no llevan categoría. |
| D-49 | Categorías por workspace, editables y archivables; sembradas por defecto (gasto: Alimentación, Transporte, Vivienda, Salud, Educación, Ocio, Otros gastos; ingreso: Sueldo, Otros ingresos). |

## 3. Transferencias (17.6)

| ID | Decisión |
|---|---|
| D-50 | Función transaccional `create_transfer`: valida cuentas distintas, mismo workspace, misma moneda e importes iguales, y crea los dos movimientos (`transfer_out`, `transfer_in`) con el mismo `transfer_group_id`, o ninguno. |
| D-51 | Una transferencia no se edita: se archiva completa (ambos movimientos) y se vuelve a crear. |

## 4. Presupuestos, obligaciones y reportes

| ID | Decisión |
|---|---|
| D-52 | Presupuesto mensual (`period_month`, primer día del mes) por categoría de gasto, más un tope opcional del total del mes. Acción "Copiar al mes siguiente". Un presupuesto activo por mes y categoría (y uno de total por mes). |
| D-53 | Semáforo fijo: menos de 80 % normal, de 80 a 100 % aviso, más de 100 % excedido. |
| D-54 | Obligación: nombre, importe, moneda, vencimiento y estado (`pending`, `paid`, `cancelled`); recurrencia `none` o `monthly`. "Marcar como pagada" puede crear el gasto en una cuenta en la misma operación; si es mensual, crea la del mes siguiente. Vencida = vencimiento anterior a hoy en la zona del perfil. |
| D-55 | Reportes del mes por moneda: ingresos, gastos, balance, gastos por categoría y saldo por cuenta; tendencia de 6 meses. Las transferencias no cuentan como ingreso ni gasto. |
| D-56 | Dashboard: saldo por moneda, gastos del mes y obligaciones próximas o vencidas. |

## 5. Fuera del MVP

Tarjetas de crédito, conversión de monedas, importación bancaria, metas y fondo de emergencia, movimientos recurrentes automáticos.

## 6. Detalles del paso 2 (movimientos y transferencias)

- El saldo (D-44) lo entrega la vista `account_balances` (`security_invoker`, aplica la RLS de quien consulta): saldo inicial + movimientos **activos**. Archivar un movimiento o una transferencia revierte su efecto en el saldo.
- El cliente solo inserta y modifica **ingresos y gastos** (política RLS por tipo). Las patas de una transferencia no son escribibles por el cliente; `create_transfer` y `archive_transfer` son `SECURITY DEFINER` y comprueban `owns_workspace` de forma explícita.
- Cuenta, moneda, tipo y grupo de un movimiento no cambian tras crearlo; se pueden editar importe, fecha, categoría y descripción (solo ingresos y gastos). Para mover un movimiento de cuenta: archivarlo y crear otro.
- La moneda del movimiento la deriva el servidor de la cuenta, no el formulario (D-41). No se admiten movimientos en cuentas o con categorías archivadas, ni con fecha futura (zona del perfil).
- Restaurar una transferencia falla con aviso si alguna de sus cuentas quedó archivada.
- La pantalla de movimientos muestra un mes con navegación, filtro por cuenta, vista de archivados y el resumen del mes por moneda (ingresos, gastos, balance; sin transferencias). Se muestran hasta 1 000 movimientos por mes; si se alcanza, la pantalla avisa.

## 7. Detalles del paso 3 (presupuestos, obligaciones y reportes)

- **Presupuestos.** Una fila por mes, categoría de gasto y moneda, más una de total del mes (`category_id` nulo). La base de datos exige que la categoría sea de gasto. El semáforo (D-53) y el gasto se calculan al mostrar: gasto de la categoría o total de gastos del mes (sin transferencias ni archivados). "Copiar al mes siguiente" (`copy_budgets`) omite los que ya existen. Solo se edita el importe.
- **Obligaciones.** Estados `pending`, `paid`, `cancelled`; no se borran. El cliente solo puede dejar una obligación en pendiente o cancelada: **pagarla** solo es posible con `pay_obligation`, que en una transacción registra el gasto (con la categoría de la obligación o la elegida al pagar), la marca como pagada y, si es mensual, crea la siguiente. La cuenta de pago debe estar activa y ser de la misma moneda. Las pagadas no se editan.
- **Recurrencia sin deriva.** Cada obligación guarda su `anchor_day`: una del 31 vence el 28 en febrero y vuelve al 31 en marzo.
- **Si se paga por error:** archiva el gasto en Movimientos; la obligación seguirá como pagada (reabrir pagos queda fuera del MVP).
- **Reportes.** Las vistas `monthly_totals` y `monthly_category_totals` (`security_invoker`) suman ingresos y gastos activos por mes y moneda, sin transferencias. La pantalla muestra, por moneda: resumen del mes, gastos por categoría (gráfico + tabla), tendencia de 6 meses (gráfico + tabla) y saldo por cuenta.
- **Dashboard (D-56).** Tarjeta con saldo por moneda, gastos del mes y obligaciones vencidas o que vencen en 7 días.

**Estado del Sprint 3:** completo.
