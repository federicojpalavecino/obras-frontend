with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# Reemplazar el useEffect que carga presupuestos para que espere el token
old_effect = '''  useEffect(() => {
    fetch(`${API}/portal/presupuestos`, { headers: getH() })
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        const pres = Array.isArray(d) ? d : [];
        setPresupuestos(pres);
        if (pres.length > 0) setPresSelec(pres[0]);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);'''

new_effect = '''  useEffect(() => {
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

if old_effect in c:
    c = c.replace(old_effect, new_effect)
    print("OK useEffect con retry")
else:
    print("FAIL - buscando patron alternativo...")
    idx = c.find("portal/presupuestos")
    if idx > 0:
        # find the useEffect containing this
        ue_start = c.rfind("useEffect", 0, idx)
        print(repr(c[ue_start:idx+100]))

with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Done")
