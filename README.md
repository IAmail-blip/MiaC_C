# 🛒 La Compra Diaria

> Tu lista de la compra inteligente — offline, sin registro, sin servidores.

Una PWA móvil pensada para gestionar una lista de productos permanente donde marcas la urgencia de cada uno según lo vayas necesitando. Sin crear y borrar listas cada vez: creas los productos una sola vez y gestionas su prioridad día a día.

---

## ✨ Cómo funciona

La idea es simple: tienes una lista fija de todo lo que sueles comprar. Cada producto tiene tres estados de urgencia:

| Color | Estado | Significado |
|-------|--------|-------------|
| 🔴 | Urgente | Se está acabando, hay que comprarlo ya |
| 🟡 | Normal | Toca comprarlo pronto |
| 🟢 | Sin prisa | Queda suficiente, no hay urgencia |

En la **pantalla de Compra** solo ves los productos agrupados por urgencia y ordenados por sección. Cuando lo compras, marcas el check. Cuando se empieza a agotar, cambias su urgencia con un toque.

---

## 📱 Pantallas

### 🛒 Compra
Lista de todos los productos agrupada en tres grupos plegables (🔴 Urgente / 🟡 Normal / 🟢 Sin prisa) y una sección de ✅ Comprados. Los productos se ordenan automáticamente por sección (Frutería juntos, Carnicería juntos…).

- **Tap en el círculo de color** → cambia la urgencia al instante
- **Tap en el check** → marca como comprado (o desmarca)
- Los comprados permanecen visibles en su propio grupo plegable

### 📂 Secciones
Vista de todas tus secciones con barra de progreso y contador de urgentes. Pulsa una sección para ver y gestionar sus productos.

- Desde aquí puedes cambiar la urgencia de cada producto con un tap en la pill de color (cicla automáticamente 🔴→🟡→🟢→🔴)
- Editar nombre, icono y sección de cualquier producto

### 🗂️ Panel
Vista de control general:
- Estadísticas rápidas (total, urgentes, normales, sin prisa)
- Barra de progreso de la compra actual
- Tabla completa de todos los productos por sección con botones de urgencia inline
- Acciones rápidas: **Reiniciar compra** (todos a pendiente) / **Todo sin prisa** (todo a 🟢)

### ⚙️ Gestión
- Crear, editar y eliminar secciones
- Toggle modo oscuro / claro
- Añadir iconos personalizados (pega cualquier emoji)
- Exportar e importar la base de datos completa en JSON
- Borrar todos los datos

---

## 🚀 Instalación en GitHub Pages

### 1. Sube los archivos a GitHub

Copia los 6 archivos en la raíz de un repositorio nuevo (sin subcarpetas):

```
tu-repo/
├── index.html
├── app.js
├── tailwind.css
├── favicon.svg
├── sw.js
└── manifest.json
```

```bash
git init
git add .
git commit -m "La Compra Diaria v3"
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

### 2. Activa GitHub Pages

Ve a tu repositorio → **Settings → Pages → Source: Deploy from branch → main / (root)** → Guardar.

En 1–2 minutos estará disponible en:
```
https://TU_USUARIO.github.io/TU_REPO/
```

---

## 📲 Instalar como app en el móvil

### Android (Chrome)
1. Abre la URL en Chrome
2. Toca el banner *"Añadir a pantalla de inicio"* o menú (⋮) → *Instalar app*

### iOS (Safari)
1. Abre la URL en Safari
2. Toca el botón compartir → *"Añadir a pantalla de inicio"*

Una vez instalada funciona **100% sin conexión**.

---

## 📁 Archivos del proyecto

| Archivo | Tamaño | Descripción |
|---------|--------|-------------|
| `index.html` | ~14 KB | Shell de la app, estructura HTML y estilos propios |
| `app.js` | ~63 KB | Toda la lógica, estado, renders y eventos |
| `tailwind.css` | ~37 KB | CSS de Tailwind compilado (sin CDN) |
| `sw.js` | ~7 KB | Service Worker — estrategia offline Cache-First |
| `favicon.svg` | <1 KB | Icono de la app |
| `manifest.json` | ~1.5 KB | Configuración PWA |

**Stack:** HTML5 · CSS (Tailwind compilado) · Vanilla JS · localStorage · Service Worker  
**Sin backend · Sin dependencias npm en producción · Apto para GitHub Pages**

---

## 💾 Datos y privacidad

- Todo se guarda en el `localStorage` de tu navegador, en tu dispositivo
- Nadie más tiene acceso a tus datos
- Puedes hacer una copia de seguridad en cualquier momento desde **Gestión → Exportar**
- El fichero exportado es un JSON legible que puedes importar en otro dispositivo

---

## 🔑 Claves de localStorage

| Clave | Contenido |
|-------|-----------|
| `lcd_secciones` | Array de secciones |
| `lcd_productos` | Array de productos |
| `lcd_dark_mode` | Preferencia de tema |
| `lcd_custom_icons` | Emojis personalizados |
| `lcd_grupos_state` | Estado plegado/desplegado de grupos |
| `lcd_initialized` | Flag de primera carga |

---

## 📋 Estructura de datos

```js
// Sección
{ id: string, nombre: string, icono: string }

// Producto
{
  id:        string,
  sectionId: string,              // referencia a Sección
  nombre:    string,
  icono:     string,
  urgencia:  'rojo' | 'amarillo' | 'verde',
  estado:    'pendiente' | 'comprado'
}
```

---

## 🌐 Soporte offline

El Service Worker implementa tres estrategias:

- **Cache-First** para los 6 assets propios → funciona sin conexión desde la primera visita
- **Stale-While-Revalidate** para Google Fonts → sirve desde caché y actualiza en segundo plano
- **Network-First con timeout de 3s** para cualquier otra petición

Al detectar actualización disponible, la app muestra un toast avisando de que hay que recargar.

---

*Hecho con ❤️ — sin tracking, sin anuncios, sin servidores*
