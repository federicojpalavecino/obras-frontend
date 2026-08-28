# Mails a los estudios

Los dos mails de siempre son distintos entre sí, y conviene que sigan siendo dos:

| Archivo | Qué es | A quién | Cada cuánto |
|---|---|---|---|
| `bienvenida.html` | Qué es el sistema y por dónde arrancar | Al que abre una cuenta | Evergreen: se manda siempre igual |
| `novedades.html` | Qué se sumó desde la última vez | A los que ya lo usan | Fechado: se reescribe en cada envío |
| `ajuste-pk.html` | Aviso de cambio de fecha de cobro y de valor | Solo a PK Arquitectura | Puntual: se manda una vez |

`ajuste-pk.html` es de otra naturaleza: un aviso administrativo, a un solo
estudio, con fechas y montos que hay que revisar antes de mandarlo (están
anotados arriba del `.md`).

Mezclarlos fue el primer intento y no funciona: al que recién entra las novedades
no le dicen nada porque no conoce lo viejo, y al que ya lo usa la bienvenida le
hace scrollear cosas que sabe. Si alguien se acaba de dar de alta, le llega la
bienvenida y nada más — el mail de novedades siguiente ya lo agarra al día.

Los dos están en HTML de correo —tablas, estilos inline, sin fuentes externas—
que es lo que sobrevive en Gmail y en Outlook, que descartan las hojas de estilo
y no entienden flex ni grid.

Cada uno tiene su `.md` con el mismo contenido en texto, y el asunto y el
preheader arriba, para revisar la redacción sin pelear con el HTML. **Si cambia
uno, cambia el otro.**

`imagenes.html` es el taller donde se dibujan las imágenes (`hero` y `gantt`).
Se exportan a 1200×560 y se sirven desde `public/mail/`.

## Por qué no va como imagen

Tentador y equivocado. Un mail que es una sola imagen:

- Dispara los filtros de spam, que miran la proporción imagen/texto.
- **Outlook bloquea imágenes por defecto**: se ve un rectángulo vacío.
- No se puede seleccionar, ni buscar, ni leer con lector de pantalla.
- No tiene preheader — el renglón que se lee en la bandeja sale de texto real.

Por eso el mail es texto real con **tablas y colores de fondo**, y las dos
imágenes son decoración: van con `width`, `height` y `alt` que dice lo mismo que
la imagen, para que el mail se entienda igual con las imágenes bloqueadas.

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
- Revisar que la imagen cargue: la bienvenida usa `/mail/hero.png` y las
  novedades `/mail/gantt.png`, servidas desde `public/mail/`. Si el deploy no
  está hecho, el mail sale con un hueco.
- En novedades, releer el bloque «Y además» contra los commits desde el último
  envío y borrar lo que ya se contó. Es el que más rápido queda desactualizado.
- **Cuidar el registro.** Trato de vos, sin modismos: el que lee es un
  profesional evaluando una herramienta de trabajo, no un conocido. Cada `.md`
  arriba tiene la nota de registro y los ejemplos de lo que no va.
- Mirar quién está con el plan vencido: le va a llegar un mail entusiasta y
  cuando entre ve el paywall. Puede servir para reactivarlo, pero que sea a
  propósito.
