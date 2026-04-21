import { test } from "node:test";
import assert from "node:assert/strict";

import {
  esCedulaValida,
  formatearCedula,
  limpiarCedula,
  validarCedula,
} from "@/lib/validaciones/cedula-do";

// Cédula dominicana válida conocida (generada con el algoritmo JCE para test).
// 001-0000001-8 → suma: 1*1 + 0*2 + 0*1 + 1*2 = 3 → dv = (10 - 3%10) % 10 = 7? revisar.
// Mejor generamos una con función auxiliar.
function generarCedulaValida(first10: string): string {
  const digitos = first10.split("").map(Number);
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    const peso = i % 2 === 0 ? 1 : 2;
    let prod = digitos[i] * peso;
    if (prod > 9) prod -= 9;
    suma += prod;
  }
  const dv = (10 - (suma % 10)) % 10;
  return first10 + dv;
}

test("limpiarCedula elimina guiones y espacios", () => {
  assert.equal(limpiarCedula("001-1234567-8"), "00112345678");
  assert.equal(limpiarCedula("  001 12345678 "), "00112345678");
});

test("formatearCedula aplica guiones", () => {
  assert.equal(formatearCedula("00112345678"), "001-1234567-8");
});

test("esCedulaValida acepta cédulas correctas", () => {
  const cedula = generarCedulaValida("0010000001");
  assert.equal(esCedulaValida(cedula), true);
  assert.equal(esCedulaValida(formatearCedula(cedula)), true);
});

test("esCedulaValida rechaza dígito verificador incorrecto", () => {
  const base = generarCedulaValida("0010000001");
  const corrupta = base.slice(0, 10) + ((Number(base[10]) + 1) % 10);
  assert.equal(esCedulaValida(corrupta), false);
});

test("esCedulaValida rechaza longitud inválida", () => {
  assert.equal(esCedulaValida("001"), false);
  assert.equal(esCedulaValida("001000000123"), false);
});

test("validarCedula devuelve error específico", () => {
  assert.deepEqual(validarCedula(""), { ok: false, error: "vacia" });
  assert.deepEqual(validarCedula("001"), { ok: false, error: "largo" });

  const base = generarCedulaValida("4020012345");
  assert.deepEqual(validarCedula(base), { ok: true, formato: formatearCedula(base) });
});
