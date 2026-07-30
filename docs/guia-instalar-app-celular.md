# Instalar MEPEX en el celular

**Son 2 minutos. Hay que hacerlo una sola vez.**

Después de esto te van a llegar los avisos importantes al celular, aunque no tengas la app abierta.

> **Importante:** en iPhone, si entrás a la página por Safari **sin instalarla**, NO te llega ningún aviso.
> No es un problema del sistema: Apple lo hace así. Por eso este paso es obligatorio.

---

## 📱 Si tenés iPhone

1. Abrí **Safari** (tiene que ser Safari, no Chrome) y entrá a:
   **app.mepex.com.ar**
2. Tocá el botón **Compartir** — el cuadradito con la flecha para arriba, abajo en el medio de la pantalla.
3. Deslizá para abajo en el menú y tocá **"Agregar a pantalla de inicio"**.
4. Tocá **Agregar** arriba a la derecha.
5. **Cerrá Safari** y abrí la app desde el ícono nuevo (la X celeste) que quedó en tu pantalla.
6. Entrá con tu usuario y contraseña.
7. Andá a **tu nombre (arriba a la derecha) → Mi Perfil**.
8. Tocá **"Activar notificaciones"** y después **Permitir**.

Listo. Tiene que quedar en verde: **● Activadas**.

> Necesitás iPhone con iOS 16.4 o más nuevo. Si es más viejo, avisale a Fede.

---

## 🤖 Si tenés Android

1. Abrí **Chrome** y entrá a **app.mepex.com.ar**
2. Tocá los **tres puntitos** arriba a la derecha.
3. Tocá **"Instalar aplicación"** (a veces dice *"Agregar a pantalla principal"*).
4. Confirmá.
5. Abrí la app desde el ícono nuevo (la X celeste).
6. Entrá con tu usuario y contraseña.
7. Andá a **tu nombre (arriba a la derecha) → Mi Perfil**.
8. Tocá **"Activar notificaciones"** y después **Permitir**.

Listo. Tiene que quedar en verde: **● Activadas**.

---

## ¿Qué avisos me van a llegar?

Al celular, **solo lo urgente**. Si algo no puede esperar a que abras la app, suena el celular.

Todo lo demás —lo normal del día— aparece en **la campanita** 🔔 arriba a la derecha cuando entrás. No te molesta el celular por eso.

---

## Si algo no funciona

| Qué pasa | Qué hacer |
|---|---|
| No aparece "Agregar a pantalla de inicio" | Estás usando Chrome en iPhone. Tiene que ser **Safari**. |
| No aparece "Instalar aplicación" en Android | Probá **"Agregar a pantalla principal"** en el mismo menú. |
| El botón dice "Activar" pero no pasa nada | Cerrá la app del todo y abrila de nuevo **desde el ícono**, no desde el navegador. |
| Dice que están bloqueadas | Tocá el **candado** al lado de la dirección → Notificaciones → Permitir. |
| Borré el ícono sin querer | Volvé a hacer todos los pasos. Se pierde la configuración. |
| No me llega nada igual | Avisale a Fede, no lo pelees vos. |

---

## Para el que lo instala con el equipo (Fede)

- Hacelo **con todos juntos, en 10 minutos**. Si se deja librado a que cada uno lo haga por su cuenta, la mitad no lo hace y el sistema queda a medias.
- Verificá persona por persona que quede en **● Activadas** verde.
- Para comprobar que llega de verdad: desde tu perfil (superadmin) tenés el botón **"Probar"** al lado del toggle, que te manda un push a vos mismo.
- Anotá quién quedó instalado. En la base se puede chequear:
  ```sql
  SELECT p.name, count(*) AS dispositivos, max(s.created_at) AS ultimo
    FROM push_subscriptions s
    JOIN profiles p ON p.id = s.user_id
   GROUP BY p.name ORDER BY p.name;
  ```
