# Mails a los estudios

`bienvenida-novedades.html` es el mail de novedades. Está en HTML de correo:
tablas, estilos inline, sin fuentes externas ni imágenes remotas. Es lo que
sobrevive en Gmail y en Outlook, que descartan las hojas de estilo y no entienden
flex ni grid.

`bienvenida-novedades.md` es el mismo contenido en texto, para revisar la
redacción sin pelear con el HTML.

## Por qué no va como imagen

Tentador y equivocado. Un mail que es una sola imagen:

- Dispara los filtros de spam, que miran la proporción imagen/texto.
- **Outlook bloquea imágenes por defecto**: se ve un rectángulo vacío.
- No se puede seleccionar, ni buscar, ni leer con lector de pantalla.
- No tiene preheader — el renglón que se lee en la bandeja sale de texto real.

Por eso los bloques visuales del mail (el mini Gantt, la tabla de movimientos,
los chips) están armados con **tablas y colores de fondo**. Dan aspecto sin
depender de que carguen imágenes.

## Cómo enviarlo

### Hoy, a los estudios que ya tienen cuenta

Son pocos y ya te conocen: alcanza con mandarlo desde tu casilla.

1. Abrí el HTML en el navegador, `Ctrl+A`, `Ctrl+C`.
2. Pegalo en el cuerpo del mail (Gmail conserva el formato al pegar).
3. Mandá **en copia oculta (CCO)**. Si los ponés en «Para», cada estudio ve la
   dirección de los demás — les estás filtrando tu lista de clientes.
4. Antes de mandar, probá con vos mismo y abrilo en el celular.

Ojo: los subusuarios sin mail no reciben nada. Tienen usuario, no casilla.

### Cuando la lista crezca

Ahí sí conviene un proveedor de envío: Brevo, MailerLite, Mailchimp o Resend.
Todos tienen plan gratis para volúmenes chicos — verificá el límite vigente, que
cambia seguido. En cualquiera de ellos se crea una campaña, se elige «pegar tu
propio HTML» y va el contenido del archivo tal cual.

**Lo que no se puede saltear es autenticar el dominio.** Hay que cargar en el DNS
de faimobras.com los registros que indique el proveedor:

| Registro | Para qué |
|---|---|
| **SPF** | Dice qué servidores pueden mandar en nombre del dominio |
| **DKIM** | Firma cada mail para probar que no fue alterado |
| **DMARC** | Le dice a Gmail qué hacer si SPF o DKIM fallan |

Sin eso, a partir de cierto volumen los correos caen en spam o se rechazan. Es
lo más importante de todo el asunto y es puramente de configuración: se hace una
vez y queda.

El proveedor además agrega el link de desuscripción —que en un envío masivo hace
falta— y procesa los rebotes, para que mandar a una casilla que ya no existe no
te ensucie la reputación del dominio.

## Antes de cada envío

- Probarlo con vos mismo y abrirlo en **Gmail y en el celular**, que es donde lo
  van a leer.
- Revisar que los links funcionen. El botón apunta a
  `faimobras.com/novedades.html`, que se sirve desde `public/`.
- Mirar quién está con el plan vencido: le va a llegar un mail entusiasta y
  cuando entre ve el paywall. Puede servir para reactivarlo, pero que sea a
  propósito.
