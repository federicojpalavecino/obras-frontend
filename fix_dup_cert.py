with open(r"C:\obras-frontend\src\pages\Obra.jsx", "r", encoding="utf-8") as f:
    c = f.read()

dup = (
    "  const [certificados, setCertificados] = useState([]);\n"
    "  const [showVincularCobro, setShowVincularCobro] = useState(null); // cert id\n"
    "  const [certificados, setCertificados] = useState([]);\n"
    "  const [showVincularCobro, setShowVincularCobro] = useState(null); // cert id"
)
fix = (
    "  const [certificados, setCertificados] = useState([]);\n"
    "  const [showVincularCobro, setShowVincularCobro] = useState(null); // cert id"
)

if dup in c:
    c = c.replace(dup, fix)
    print("OK - duplicado eliminado")
else:
    # contar ocurrencias
    count = c.count("const [certificados, setCertificados]")
    print(f"Ocurrencias de certificados: {count}")
    if count > 1:
        # eliminar segunda ocurrencia
        idx = c.find("const [certificados, setCertificados]")
        idx2 = c.find("const [certificados, setCertificados]", idx + 1)
        # buscar inicio de la linea
        line_start = c.rfind("\n", 0, idx2) + 1
        line_end = c.find("\n", idx2)
        c = c[:line_start] + c[line_end+1:]
        # hacer lo mismo con showVincularCobro duplicado
        count2 = c.count("const [showVincularCobro")
        if count2 > 1:
            idx3 = c.find("const [showVincularCobro]")
            idx4 = c.find("const [showVincularCobro", idx3 + 1) if idx3 >= 0 else c.find("const [showVincularCobro")
            if idx4 >= 0:
                ls = c.rfind("\n", 0, idx4) + 1
                le = c.find("\n", idx4)
                c = c[:ls] + c[le+1:]
        print("OK - duplicado eliminado manualmente")

with open(r"C:\obras-frontend\src\pages\Obra.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Done")
