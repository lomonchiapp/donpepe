import { test } from "node:test";
import assert from "node:assert/strict";

import {
  derivarPreciosPorKilataje,
  purezaDeKilataje,
  tasarOro,
} from "@/lib/calc/oro";

test("purezaDeKilataje: 24K = 1, 18K = 0.75, 14K ≈ 0.583", () => {
  assert.equal(purezaDeKilataje(24), 1);
  assert.equal(purezaDeKilataje(18), 0.75);
  assert.ok(Math.abs(purezaDeKilataje(14) - 14 / 24) < 1e-9);
  assert.ok(Math.abs(purezaDeKilataje(10) - 10 / 24) < 1e-9);
});

test("tasarOro: precio bruto = peso * precio, sin descuento por defecto", () => {
  const r = tasarOro({ kilataje: 18, peso_gramos: 10, precio_dop_gramo: 5_000 });
  assert.equal(r.precio_bruto, 50_000);
  assert.equal(r.precio_final, 50_000);
  assert.equal(r.descuento_aplicado, 0);
});

test("tasarOro aplica descuento porcentual", () => {
  const r = tasarOro({
    kilataje: 14,
    peso_gramos: 5,
    precio_dop_gramo: 4_000,
    descuento: 0.1,
  });
  assert.equal(r.precio_bruto, 20_000);
  assert.equal(r.precio_final, 18_000);
  assert.equal(r.descuento_aplicado, 2_000);
});

test("derivarPreciosPorKilataje aplica pureza y margen de compra", () => {
  const tabla = derivarPreciosPorKilataje({
    precio_spot_24k_gramo: 8_000,
    margen_compra: 0.25,
  });
  // 24K: 8000 * 1 * 0.75 = 6000
  assert.equal(tabla[24], 6_000);
  // 18K: 8000 * 0.75 * 0.75 = 4500
  assert.equal(tabla[18], 4_500);
  // 14K: 8000 * (14/24) * 0.75 = 3500
  assert.equal(tabla[14], 3_500);
});
