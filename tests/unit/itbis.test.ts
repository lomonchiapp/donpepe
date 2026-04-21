import { test } from "node:test";
import assert from "node:assert/strict";

import {
  codigoTipoComprobante,
  desglosarItem,
  formatearNcf,
  redondearDOP,
  totalizarFactura,
} from "@/lib/calc/itbis";

test("redondearDOP redondea a 2 decimales", () => {
  assert.equal(redondearDOP(8474.576271186441), 8474.58);
  assert.equal(redondearDOP(1525.4237288135593), 1525.42);
  assert.equal(redondearDOP(10000), 10000);
});

test("desglosarItem con precio 10,000 bruto → base 8474.58 + itbis 1525.42", () => {
  const r = desglosarItem({
    precio_unitario_bruto: 10000,
    cantidad: 1,
  });
  assert.equal(r.precio_unitario, 8474.58);
  assert.equal(r.subtotal, 8474.58);
  assert.equal(r.itbis_monto, 1525.42);
  assert.equal(r.total, 10000);
});

test("desglosarItem absorbe drift de redondeo en ITBIS para mantener total bruto exacto", () => {
  // 3 piezas × 10,000 = 30,000 (cliente paga exacto).
  // base unitaria 8474.58, subtotal = 25,423.74, itbis = 30,000 − 25,423.74 = 4,576.26.
  const r = desglosarItem({
    precio_unitario_bruto: 10000,
    cantidad: 3,
  });
  assert.equal(r.total, 30000);
  assert.equal(r.subtotal + r.itbis_monto, 30000);
});

test("desglosarItem con itbis_aplica=false deja ITBIS en 0", () => {
  const r = desglosarItem({
    precio_unitario_bruto: 500,
    cantidad: 1,
    itbis_aplica: false,
  });
  assert.equal(r.itbis_monto, 0);
  assert.equal(r.subtotal, 500);
  assert.equal(r.total, 500);
  assert.equal(r.itbis_tasa, 0);
});

test("desglosarItem aplica descuento unitario antes de desglosar", () => {
  const r = desglosarItem({
    precio_unitario_bruto: 10000,
    cantidad: 1,
    descuento_unitario: 2000,
  });
  // bruto neto = 8000; base = 8000/1.18 = 6779.66; itbis = 1220.34
  assert.equal(r.total, 8000);
  assert.equal(r.precio_unitario, 6779.66);
  assert.equal(r.itbis_monto, redondearDOP(8000 - 6779.66));
});

test("desglosarItem con cantidad 0 o precio negativo lanza error", () => {
  assert.throws(() => desglosarItem({ precio_unitario_bruto: 100, cantidad: 0 }));
  assert.throws(() =>
    desglosarItem({ precio_unitario_bruto: -1, cantidad: 1 }),
  );
});

test("desglosarItem con descuento mayor al precio lanza", () => {
  assert.throws(() =>
    desglosarItem({
      precio_unitario_bruto: 100,
      cantidad: 1,
      descuento_unitario: 200,
    }),
  );
});

test("totalizarFactura suma items con y sin ITBIS", () => {
  const item1 = desglosarItem({ precio_unitario_bruto: 10000, cantidad: 1 });
  const item2 = desglosarItem({
    precio_unitario_bruto: 500,
    cantidad: 2,
    itbis_aplica: false,
  });
  const totales = totalizarFactura([item1, item2]);
  assert.equal(totales.total, 11000);
  assert.equal(totales.base_exenta, 1000);
  assert.equal(totales.base_itbis, 8474.58);
  assert.equal(totales.itbis_monto, 1525.42);
  assert.equal(totales.subtotal, 9474.58);
});

test("formatearNcf produce 13 chars para serie E y 11 para B", () => {
  assert.equal(formatearNcf("E", "31", 1), "E310000000001");
  assert.equal("E310000000001".length, 13);
  assert.equal(formatearNcf("B", "02", 5), "B0200000005");
  assert.equal("B0200000005".length, 11);
});

test("codigoTipoComprobante mapea enums a códigos DGII", () => {
  assert.equal(codigoTipoComprobante("factura_credito_fiscal"), "01");
  assert.equal(codigoTipoComprobante("factura_consumo"), "02");
  assert.equal(codigoTipoComprobante("nota_credito"), "04");
  assert.equal(codigoTipoComprobante("compra"), "11");
  assert.equal(codigoTipoComprobante("foo"), null);
});
