import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calcularDeuda,
  calcularFechaVencimiento,
  diasHastaVencimiento,
  semaforoVencimiento,
  sugerirMontoPrestamo,
} from "@/lib/calc/intereses";

test("calcularDeuda: un mes exacto con 10% = capital + 10%", () => {
  const r = calcularDeuda({
    monto_prestado: 10_000,
    tasa_interes_mensual: 0.1,
    fecha_inicio: new Date("2026-01-01"),
    fecha_calculo: new Date("2026-01-31"),
  });
  assert.equal(r.capital_pendiente, 10_000);
  assert.equal(r.intereses_acumulados, 1_000);
  assert.equal(r.deuda_total, 11_000);
});

test("calcularDeuda: intereses pagados reducen intereses pendientes", () => {
  const r = calcularDeuda({
    monto_prestado: 10_000,
    tasa_interes_mensual: 0.1,
    fecha_inicio: new Date("2026-01-01"),
    fecha_calculo: new Date("2026-02-28"),
    pagos: [{ fecha: "2026-01-31", tipo: "interes", monto: 1_000 }],
  });
  // ~1.9 meses → ~1_900 intereses acumulados, 1_000 pagados
  assert.equal(r.capital_pendiente, 10_000);
  assert.equal(r.intereses_pagados, 1_000);
  assert.ok(r.deuda_total > 10_000 && r.deuda_total < 12_000);
});

test("calcularDeuda: abono al capital lo reduce", () => {
  const r = calcularDeuda({
    monto_prestado: 10_000,
    tasa_interes_mensual: 0.1,
    fecha_inicio: new Date("2026-01-01"),
    fecha_calculo: new Date("2026-01-15"),
    pagos: [{ fecha: "2026-01-10", tipo: "abono_capital", monto: 3_000 }],
  });
  assert.equal(r.capital_pendiente, 7_000);
});

test("calcularFechaVencimiento: suma meses calendario", () => {
  const v = calcularFechaVencimiento({
    fecha_inicio: "2026-01-15",
    plazo_meses: 3,
  });
  assert.equal(v.getFullYear(), 2026);
  assert.equal(v.getMonth(), 3); // abril (0-indexed)
  assert.equal(v.getDate(), 15);
});

test("diasHastaVencimiento: positivo si futuro, negativo si pasado", () => {
  const hoy = "2026-04-18";
  assert.equal(diasHastaVencimiento("2026-04-25", hoy), 7);
  assert.equal(diasHastaVencimiento("2026-04-10", hoy), -8);
  assert.equal(diasHastaVencimiento("2026-04-18", hoy), 0);
});

test("semaforoVencimiento clasifica por urgencia", () => {
  const hoy = "2026-04-18";
  assert.equal(semaforoVencimiento("2026-04-18", hoy), "vence_hoy");
  assert.equal(semaforoVencimiento("2026-04-20", hoy), "vence_pronto");
  assert.equal(semaforoVencimiento("2026-05-20", hoy), "activo");
  assert.equal(semaforoVencimiento("2026-04-10", hoy), "vencido");
});

test("sugerirMontoPrestamo redondea a múltiplos de 100", () => {
  assert.equal(sugerirMontoPrestamo(8_750, 0.6), 5_200);
  assert.equal(sugerirMontoPrestamo(10_000, 0.7), 7_000);
});
