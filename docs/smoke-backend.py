# -*- coding: utf-8 -*-
"""Smoke de todo lo que se toco hoy.

Fueron muchos deploys sobre el mismo archivo; esto verifica que nada de lo
anterior se haya roto por lo siguiente. Todo lectura salvo lo que dice
"escribe", que se limpia al final.
"""
import io, json, requests

API = "https://obras-backend-production.up.railway.app"
S = requests.Session()
S.headers.update({"Authorization": "Bearer " + io.open("sim.tok").read().strip(),
                  "Content-Type": "application/json"})
P = 164
ok, mal = 0, []

def probar(nombre, cond, detalle=""):
    global ok
    if cond: ok += 1
    else: mal.append(nombre)
    print(("  ok    " if cond else "  MAL   ") + nombre + ("   " + detalle if detalle else ""))

def get(ruta):
    r = S.get(API + ruta, timeout=60)
    return r.status_code, (r.json() if r.status_code == 200 else r.text[:120])

print("-- OBRA 164, el circuito entero --")
c, cc = get("/presupuestos/%d/cuenta-corriente" % P)
probar("cuenta corriente responde", c == 200, str(c))
if c == 200:
    probar("devengado sale del avance", abs(cc.get("total_devengado", 0) - 27930526.97) < 1,
           "$ %s" % round(cc.get("total_devengado", 0)))
    probar("saldo pendiente correcto", abs(cc.get("saldo_pendiente", 0) - 9310175.97) < 1,
           "$ %s" % round(cc.get("saldo_pendiente", 0)))
    probar("no figura a favor del cliente", cc.get("a_favor_cliente", 1) == 0)
    probar("3 desembolsos que cierran", len(cc.get("desembolsos", [])) == 3)

c, ct = get("/presupuestos/%d/contrato" % P)
probar("contrato existe", c == 200 and ct.get("monto_total"), "$ %s" % (ct or {}).get("monto_total"))
c, ce = get("/presupuestos/%d/certificados" % P)
probar("certificado emitido", c == 200 and len(ce) >= 1, "%d" % len(ce or []))
c, ad = get("/presupuestos/%d/adicionales" % P)
probar("adicional cerrado", c == 200 and any((x.get("estado") or "").lower() == "cerrado" for x in ad))
c, asi = get("/asistente/obra/%d" % P)
probar("el asistente ve la obra", c == 200 and asi.get("cobros", {}).get("saldo", 0) > 0,
       "te deben $ %s" % round(asi.get("cobros", {}).get("saldo", 0)) if c == 200 else str(c))

print("\n-- CONTROL FINANCIERO --")
c, sem = get("/cf/semanas")
probar("los periodos responden", c == 200, str(c))
if c == 200:
    cobros = set()
    for s in sem:
        for x in (s.get("ingresos", []) + s.get("egresos", [])):
            if x.get("origen_tipo") == "cobro":
                cobros.add(x.get("origen_id"))
    probar("los 7 cobros son visibles", len(cobros) == 7, "%d visibles" % len(cobros))
    jul = [s for s in sem if s.get("fecha_inicio") == "2026-07-01"]
    probar("el cobro de julio cae en julio",
           bool(jul) and any(x.get("origen_tipo") == "cobro" for x in jul[0].get("ingresos", [])))
    ranges = [(s["id"], s.get("fecha_inicio"), s.get("fecha_fin")) for s in sem if s.get("fecha_inicio")]
    iguales = [(a[0], b[0]) for i, a in enumerate(ranges) for b in ranges[i+1:]
               if a[1] == b[1] and a[2] == b[2]]
    probar("no hay periodos identicos", not iguales, str(iguales))

print("\n-- CATALOGO: lo de cada estudio se queda en su estudio --")
c, mo = get("/analisis/mo")
probar("la lista de mano de obra responde", c == 200, "%d unidades" % len(mo or []))
probar("sin filas sin nombre", c == 200 and not [m for m in mo if not (m.get("nombre") or "").strip()])
c, maq = get("/analisis/maquinaria")
probar("la lista de maquinaria responde", c == 200, "%d" % len(maq or []))
r = S.delete(API + "/maestros/mo/1", timeout=60)
probar("no se puede bajar del catalogo general", r.status_code == 403, str(r.status_code))
r = S.post(API + "/maestros/mo", data=json.dumps({"nombre": " ", "costo_hora": 1}), timeout=60)
probar("no se puede crear sin nombre", r.status_code == 400, str(r.status_code))

print("\n-- PANOL Y DEPOSITO: no se duplican --")
c, a = get("/asistente/datos")
if c == 200:
    her = [h["nombre"] for h in a.get("panol", {}).get("herramientas", [])]
    dep = [d["nombre"] for d in a.get("deposito", {}).get("items", [])]
    probar("sin herramientas repetidas", len(her) == len(set(her)), ", ".join(her))
    probar("sin materiales repetidos", len(dep) == len(set(dep)), ", ".join(dep))

print("\n-- ESCRIBE: duplicar un item de catalogo --")
r = S.post(API + "/analisis/items/1057/duplicar?nuevo_codigo=ZZTEST1", timeout=60)
nid = (r.json() or {}).get("id") if r.status_code < 300 else None
probar("duplicar responde", r.status_code in (200, 201), str(r.status_code))
if nid:
    c, it = get("/analisis/items/%d" % nid)
    probar("la copia es del estudio, no del catalogo general",
           c == 200 and it.get("es_propio") is True, "es_propio=%s" % (it or {}).get("es_propio"))

print("\n" + "=" * 60)
print("%d ok, %d mal" % (ok, len(mal)))
for m in mal: print("  falla:", m)
if nid: print("\n(queda por limpiar el item de prueba %d)" % nid)
