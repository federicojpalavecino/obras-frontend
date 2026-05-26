with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# Reemplazar el useEffect de carga de presupuestos con uno que espera el token
# buscando el patron actual
import re

# Buscar el useEffect que carga presupuestos
old1 = '''  useEffect(() => {
    let attempts = 0;
    const tryFetch = () => {
      const tk = tokenProp || localStorage.getItem("obras_token") || "";
      if (!tk && attempts < 10) {
        attempts++;
        setTimeout(tryFetch, 200);
        return;
      }
      fetch(`${API}/portal/presupuestos`, { headers: { Authorization: `Bearer ${tk}` } })
        .then(r => r.ok ? r.json() : [])
        .then(d => {
          const pres = Array.isArray(d) ? d : [];
          setPresupuestos(pres);
          if (pres.length > 0) setPresSelec(pres[0]);
          setLoading(false);
        }).catch(() => setLoading(false));
    };
    tryFetch();
  }, [tokenProp]);'''

new_effect = '''  useEffect(() => {
    // Esperar un tick para que el token se propague al localStorage
    const doFetch = (tk) => {
      fetch(`${API}/portal/presupuestos`, { headers: { Authorization: `Bearer ${tk}` } })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => {
          const pres = Array.isArray(d) ? d : [];
          setPresupuestos(pres);
          if (pres.length > 0) setPresSelec(pres[0]);
          setLoading(false);
        }).catch(() => setLoading(false));
    };

    if (tokenProp) {
      // Token llegó como prop - usarlo directo
      localStorage.setItem("obras_token", tokenProp);
      doFetch(tokenProp);
    } else {
      // Token puede estar en localStorage pero con delay de React
      setTimeout(() => {
        const tk = localStorage.getItem("obras_token") || "";
        if (tk) {
          doFetch(tk);
        } else {
          setLoading(false);
        }
      }, 500);
    }
  }, [tokenProp]);'''

if old1 in c:
    c = c.replace(old1, new_effect)
    print("OK useEffect con delay fix")
else:
    # Buscar cualquier useEffect con portal/presupuestos
    idx = c.find("portal/presupuestos")
    if idx > 0:
        ue = c.rfind("useEffect", 0, idx)
        end = c.find("}, [", idx) + 20
        old_block = c[ue:end]
        print("Bloque actual:")
        print(repr(old_block[:300]))
        c = c[:ue] + new_effect + c[end:]
        print("OK reemplazado por busqueda directa")

with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Done")
