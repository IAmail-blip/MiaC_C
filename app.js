/* ============================================================
   app.js — La Compra Diaria  v3.0
   ============================================================ */
'use strict';

// ══════════════════════════════════════════════════════════════
// 1. LOCALSTORAGE KEYS
// ══════════════════════════════════════════════════════════════
const LS = {
  SECCIONES:    'lcd_secciones',
  PRODUCTOS:    'lcd_productos',
  DARK_MODE:    'lcd_dark_mode',
  INITIALIZED:  'lcd_initialized',
  CUSTOM_ICONS: 'lcd_custom_icons',
  GRUPOS_STATE: 'lcd_grupos_state'  // qué grupos están colapsados
};

// ══════════════════════════════════════════════════════════════
// 2. ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════
const State = {
  secciones:    [],
  productos:    [],
  darkMode:     false,  // false = dark (por defecto), true = light
  activeTab:    'compra',
  subSectionId: null,
  customIcons:  [],     // emojis añadidos por el usuario
  gruposState:  {}      // { rojo: false, amarillo: false, verde: false } → false = expandido
};

// ══════════════════════════════════════════════════════════════
// 3. DATOS POR DEFECTO
// ══════════════════════════════════════════════════════════════
function buildDefaultSecciones() {
  return [
    { nombre:'Supermercado', icono:'🏪' },
    { nombre:'Frutería',     icono:'🍎' },
    { nombre:'Carnicería',   icono:'🥩' },
    { nombre:'Embutidos',    icono:'🥓' },  // bacon
    { nombre:'Quesos',       icono:'🧀' },
    { nombre:'Conservas',    icono:'🥫' },
    { nombre:'Especias',     icono:'🌶️' },
    { nombre:'Encurtidos',   icono:'🫙' },
    { nombre:'Pescadería',   icono:'🐟' },
    { nombre:'Congelados',   icono:'❄️' },
    { nombre:'Droguería',    icono:'🧴' },
    { nombre:'Casa',         icono:'🏠' }
  ].map(d => ({ id: uid(), ...d }));
}

const ICONOS_BASE_SECCION = ['🏪','🍎','🥩','🥓','🧀','🥫','🌶️','🫙','🐟','❄️','🧴','🏠',
  '🥦','🥐','🍷','🧹','🐾','👶','💊','🌿','🫒','🥚','🧺','🪣','🛁','🌸','🍞','🥗'];

const ICONOS_BASE_PRODUCTO = ['🍎','🍋','🍌','🍇','🫐','🥑','🍅','🥕','🧅','🧄','🥦','🌽',
  '🥜','🥩','🥓','🍗','🧀','🥚','🥛','🍞','🧈','🍯','🥫','🐟','🦐','🫙','🌶️',
  '🍷','☕','🧃','💊','🧴','🧼','🪥','🧻','🫧','🛒','🌿','🫒','❄️'];

// ══════════════════════════════════════════════════════════════
// 4. UTILIDADES
// ══════════════════════════════════════════════════════════════
function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,7);
}
function lsGet(k) {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch { return null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.error('[LCD]', e); }
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let _toastTimer = null;
function showToast(msg, ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ══════════════════════════════════════════════════════════════
// 5. PERSISTENCIA
// ══════════════════════════════════════════════════════════════
function saveState() {
  lsSet(LS.SECCIONES,    State.secciones);
  lsSet(LS.PRODUCTOS,    State.productos);
  lsSet(LS.DARK_MODE,    State.darkMode);
  lsSet(LS.CUSTOM_ICONS, State.customIcons);
  lsSet(LS.GRUPOS_STATE, State.gruposState);
}

function loadState() {
  const secciones   = lsGet(LS.SECCIONES);
  const productos   = lsGet(LS.PRODUCTOS);
  const dark        = lsGet(LS.DARK_MODE);
  const custom      = lsGet(LS.CUSTOM_ICONS);
  const grupos      = lsGet(LS.GRUPOS_STATE);

  if (!lsGet(LS.INITIALIZED)) {
    State.secciones  = buildDefaultSecciones();
    State.productos  = [];
    State.darkMode   = false;   // dark por defecto
    State.customIcons = [];
    State.gruposState = {};
    lsSet(LS.INITIALIZED, true);
    saveState();
  } else {
    State.secciones   = Array.isArray(secciones) ? secciones : [];
    State.productos   = Array.isArray(productos)  ? productos  : [];
    State.darkMode    = dark === true;
    State.customIcons = Array.isArray(custom) ? custom : [];
    State.gruposState = (grupos && typeof grupos === 'object') ? grupos : {};
  }
}

// ══════════════════════════════════════════════════════════════
// 6. TEMA (dark/light — invertido: false=dark, true=light)
// ══════════════════════════════════════════════════════════════
function applyTheme(isLight) {
  document.documentElement.classList.toggle('light', isLight);
  document.getElementById('meta-theme-color').content = isLight ? '#ffffff' : '#0f172a';
}

function toggleDarkMode() {
  State.darkMode = !State.darkMode;
  applyTheme(State.darkMode);
  lsSet(LS.DARK_MODE, State.darkMode);
  showToast(State.darkMode ? '☀️ Modo claro' : '🌙 Modo oscuro');
  if (State.activeTab === 'gestion') renderGestion();
}

// ══════════════════════════════════════════════════════════════
// 7. MODAL CONFIRMACIÓN
// ══════════════════════════════════════════════════════════════
function showConfirm({ title, body, confirmLabel = 'Confirmar', confirmStyle = 'danger' }) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML    = body || '';
    const actEl = document.getElementById('modal-actions');
    actEl.innerHTML = '';
    [
      { label:'Cancelar', cls:'flex-1 py-2.5 rounded-xl text-sm font-bold bg-slate-700 text-slate-300', val:false },
      { label:confirmLabel, cls:'flex-1 py-2.5 rounded-xl text-sm font-bold ' +
          (confirmStyle==='danger' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'), val:true }
    ].forEach(({ label, cls, val }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className   = cls;
      btn.onclick = () => { overlay.classList.remove('open'); resolve(val); };
      actEl.appendChild(btn);
    });
    overlay.classList.add('open');
  });
}

// ══════════════════════════════════════════════════════════════
// 8. BOTTOM SHEET
// ══════════════════════════════════════════════════════════════
function showSheet({ title, html, onSubmit, submitLabel='Guardar', submitStyle='primary' }) {
  return new Promise(resolve => {
    const overlay  = document.getElementById('sheet-overlay');
    const box      = document.getElementById('sheet-box');
    const submitEl = document.getElementById('sheet-submit');
    const cancelEl = document.getElementById('sheet-cancel');
    const cancelX  = document.getElementById('sheet-cancel-x');

    document.getElementById('sheet-title').textContent = title;
    document.getElementById('sheet-body').innerHTML    = html;
    submitEl.textContent = submitLabel;
    submitEl.className = `flex-1 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all ${
      submitStyle==='danger' ? 'bg-red-600 text-white hover:bg-red-700'
                             : 'bg-blue-600 text-white hover:bg-blue-700'}`;

    overlay.style.display = 'flex';
    requestAnimationFrame(() => {
      overlay.classList.add('open');
      box.classList.add('open');
    });

    setTimeout(() => {
      const first = document.getElementById('sheet-body').querySelector('input,select,textarea');
      if (first) first.focus();
    }, 340);

    function close(result) {
      overlay.classList.remove('open');
      box.classList.remove('open');
      setTimeout(() => { overlay.style.display = 'none'; }, 340);
      resolve(result);
    }

    submitEl.onclick = () => {
      const form = document.getElementById('sheet-body').querySelector('form');
      if (form && !form.checkValidity()) { form.reportValidity(); return; }
      const result = onSubmit ? onSubmit() : true;
      if (result !== false) close(result);
    };
    cancelEl.onclick = () => close(null);
    cancelX.onclick  = () => close(null);
    overlay.onclick  = e => { if (e.target === overlay) close(null); };
  });
}

// ══════════════════════════════════════════════════════════════
// 9. ICON PICKER (sin renderizar todos de golpe — virtual scroll ligero)
// ══════════════════════════════════════════════════════════════
function allIcons(type) {
  const base = type === 'seccion' ? ICONOS_BASE_SECCION : ICONOS_BASE_PRODUCTO;
  return [...new Set([...base, ...State.customIcons])];
}

function buildIconPicker(pickerId, selected, type) {
  // Renderizar en chunks para no bloquear el hilo
  return `
  <div class="icon-grid" id="igrid-${pickerId}" data-selected="${esc(selected)}" data-picker="${esc(pickerId)}"></div>
  <input type="hidden" id="ihidden-${pickerId}" value="${esc(selected)}" />
  <p class="text-[11px] text-slate-500 mt-1">Pulsa un icono para seleccionarlo</p>`;
}

function mountIconGrid(pickerId, type) {
  const grid = document.getElementById(`igrid-${pickerId}`);
  if (!grid) return;
  const icons   = allIcons(type);
  const selected = grid.dataset.selected;
  // Usar fragment para un solo reflow
  const frag = document.createDocumentFragment();
  icons.forEach(ic => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-btn' + (ic === selected ? ' selected' : '');
    btn.textContent = ic;
    btn.setAttribute('data-ic', ic);
    btn.onclick = () => {
      grid.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById(`ihidden-${pickerId}`).value = ic;
    };
    frag.appendChild(btn);
  });
  grid.appendChild(frag);
}

function buildUrgenciaPicker(selected = 'amarillo') {
  const opts = [
    { v:'rojo',     label:'🔴 Urgente',   cls:'bg-red-700 text-white',    sel:'bg-red-600 text-white ring-2 ring-red-400 ring-offset-1 ring-offset-slate-900' },
    { v:'amarillo', label:'🟡 Normal',    cls:'bg-amber-800 text-amber-200', sel:'bg-amber-600 text-white ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900' },
    { v:'verde',    label:'🟢 Sin prisa', cls:'bg-emerald-900 text-emerald-300', sel:'bg-emerald-700 text-white ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-900' }
  ];
  return `
  <div class="flex gap-2 mt-1" id="urg-picker">
    ${opts.map(o => `
    <button type="button"
      class="urg-opt flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${o.v===selected ? o.sel : o.cls}"
      data-urg="${o.v}" data-sel="${o.sel}" data-def="${o.cls}"
      onclick="pickUrg(this)">${o.label}</button>`).join('')}
  </div>
  <input type="hidden" id="uhidden" value="${selected}" />`;
}

function pickUrg(btn) {
  document.querySelectorAll('#urg-picker .urg-opt').forEach(b => {
    b.className = `urg-opt flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${b.dataset.def}`;
  });
  btn.className = `urg-opt flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${btn.dataset.sel}`;
  document.getElementById('uhidden').value = btn.dataset.urg;
}

const INP  = `w-full px-3 py-2.5 rounded-xl text-sm border border-slate-700 bg-slate-800 text-slate-100
              placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
              autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false"`;
const LBL  = 'block text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 mt-3 first:mt-0';

// ══════════════════════════════════════════════════════════════
// 10. CRUD SECCIONES
// ══════════════════════════════════════════════════════════════
async function anadirSeccion() {
  const result = await showSheet({
    title: 'Nueva sección',
    submitLabel: 'Crear',
    html: `<form id="fsec" onsubmit="return false" class="space-y-1">
      <label class="${LBL}">Nombre</label>
      <input id="snombre" type="text" maxlength="32" placeholder="Ej: Panadería"
        class="${INP}" required autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" />
      <label class="${LBL}">Icono</label>
      ${buildIconPicker('sec','🏪','seccion')}
    </form>`,
    onSubmit() {
      const nombre = document.getElementById('snombre').value.trim();
      const icono  = document.getElementById('ihidden-sec').value;
      if (!nombre) return false;
      return { nombre, icono };
    }
  });
  if (!result) return;
  // Montar grid después de que el sheet esté en DOM (ya se desmontó — montarlo antes del close es ok)
  State.secciones.push({ id: uid(), nombre: result.nombre, icono: result.icono });
  saveState();
  renderGestion();
  showToast(`✅ "${result.nombre}" creada`);
}

// Montar el grid cuando el sheet abre
function onSheetOpen(pickerId, type) {
  mountIconGrid(pickerId, type);
}

async function editarSeccion(id) {
  const sec = State.secciones.find(s => s.id === id);
  if (!sec) return;
  const result = await showSheet({
    title: 'Editar sección',
    submitLabel: 'Guardar',
    html: `<form id="fsec" onsubmit="return false" class="space-y-1">
      <label class="${LBL}">Nombre</label>
      <input id="snombre" type="text" maxlength="32" value="${esc(sec.nombre)}"
        class="${INP}" required autocomplete="off" autocorrect="off" spellcheck="false" />
      <label class="${LBL}">Icono</label>
      ${buildIconPicker('sec', sec.icono, 'seccion')}
    </form>`,
    onSubmit() {
      const nombre = document.getElementById('snombre').value.trim();
      const icono  = document.getElementById('ihidden-sec').value;
      if (!nombre) return false;
      return { nombre, icono };
    }
  });
  if (!result) return;
  sec.nombre = result.nombre;
  sec.icono  = result.icono;
  saveState();
  renderGestion();
  if (State.subSectionId === id) {
    document.getElementById('sub-icon').textContent  = sec.icono;
    document.getElementById('sub-title').textContent = sec.nombre;
  }
  showToast('✏️ Sección actualizada');
}

async function eliminarSeccion(id) {
  const sec  = State.secciones.find(s => s.id === id);
  if (!sec) return;
  const n = State.productos.filter(p => p.sectionId === id).length;
  const ok = await showConfirm({
    title: `Eliminar "${sec.nombre}"`,
    body:  `<p class="mt-1">Se eliminarán sus <strong>${n} producto${n!==1?'s':''}</strong>. No se puede deshacer.</p>`,
    confirmLabel: 'Eliminar'
  });
  if (!ok) return;
  State.secciones = State.secciones.filter(s => s.id !== id);
  State.productos  = State.productos.filter(p => p.sectionId !== id);
  saveState();
  renderGestion();
  showToast(`🗑️ "${sec.nombre}" eliminada`);
}

// ══════════════════════════════════════════════════════════════
// 11. CRUD PRODUCTOS
// ══════════════════════════════════════════════════════════════
function secOptions(current) {
  return State.secciones.map(s =>
    `<option value="${esc(s.id)}" ${s.id===current?'selected':''}>${esc(s.icono)} ${esc(s.nombre)}</option>`
  ).join('');
}

async function anadirProducto(sectionId) {
  if (!State.secciones.length) { showToast('⚠️ Crea una sección primero'); return; }
  const result = await showSheet({
    title: 'Nuevo producto',
    submitLabel: 'Añadir',
    html: `<form id="fprod" onsubmit="return false" class="space-y-1">
      <label class="${LBL}">Nombre</label>
      <input id="pnombre" type="text" maxlength="48" placeholder="Ej: Leche entera"
        class="${INP}" required autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false" />
      <label class="${LBL}">Icono</label>
      ${buildIconPicker('prod','🛒','producto')}
      <label class="${LBL}">Sección</label>
      <select id="pseccion" class="${INP}">${secOptions(sectionId)}</select>
      <label class="${LBL}">Urgencia inicial</label>
      ${buildUrgenciaPicker('verde')}
    </form>`,
    onSubmit() {
      const nombre    = document.getElementById('pnombre').value.trim();
      const icono     = document.getElementById('ihidden-prod').value;
      const sectionId = document.getElementById('pseccion').value;
      const urgencia  = document.getElementById('uhidden').value;
      if (!nombre) return false;
      return { nombre, icono, sectionId, urgencia };
    }
  });
  if (!result) return;
  State.productos.push({
    id: uid(), sectionId: result.sectionId, nombre: result.nombre,
    icono: result.icono, urgencia: result.urgencia, estado: 'pendiente'
  });
  saveState();
  if (State.subSectionId) renderSubScreen(State.subSectionId);
  if (State.activeTab === 'compra') renderCompra();
  showToast(`✅ "${result.nombre}" añadido`);
}

async function editarProducto(id) {
  const p = State.productos.find(x => x.id === id);
  if (!p) return;
  const result = await showSheet({
    title: 'Editar producto',
    submitLabel: 'Guardar',
    html: `<form id="fprod" onsubmit="return false" class="space-y-1">
      <label class="${LBL}">Nombre</label>
      <input id="pnombre" type="text" maxlength="48" value="${esc(p.nombre)}"
        class="${INP}" required autocomplete="off" autocorrect="off" spellcheck="false" />
      <label class="${LBL}">Icono</label>
      ${buildIconPicker('prod', p.icono, 'producto')}
      <label class="${LBL}">Sección</label>
      <select id="pseccion" class="${INP}">${secOptions(p.sectionId)}</select>
      <label class="${LBL}">Urgencia</label>
      ${buildUrgenciaPicker(p.urgencia)}
    </form>`,
    onSubmit() {
      const nombre    = document.getElementById('pnombre').value.trim();
      const icono     = document.getElementById('ihidden-prod').value;
      const sectionId = document.getElementById('pseccion').value;
      const urgencia  = document.getElementById('uhidden').value;
      if (!nombre) return false;
      return { nombre, icono, sectionId, urgencia };
    }
  });
  if (!result) return;
  p.nombre    = result.nombre;
  p.icono     = result.icono;
  p.sectionId = result.sectionId;
  p.urgencia  = result.urgencia;
  saveState();
  if (State.subSectionId) renderSubScreen(State.subSectionId);
  if (State.activeTab === 'compra') renderCompra();
  showToast(`✏️ "${p.nombre}" actualizado`);
}

async function eliminarProducto(id) {
  const p = State.productos.find(x => x.id === id);
  if (!p) return;
  const ok = await showConfirm({
    title: `Eliminar "${p.nombre}"`,
    body:  '<p class="mt-1">Se eliminará permanentemente.</p>',
    confirmLabel: 'Eliminar'
  });
  if (!ok) return;
  State.productos = State.productos.filter(x => x.id !== id);
  saveState();
  if (State.subSectionId) renderSubScreen(State.subSectionId);
  if (State.activeTab === 'compra') renderCompra();
  showToast(`🗑️ "${p.nombre}" eliminado`);
}

// ══════════════════════════════════════════════════════════════
// 12. TOGGLE ESTADO (comprado/pendiente) y CAMBIO RÁPIDO URGENCIA
// ══════════════════════════════════════════════════════════════
function toggleProducto(id) {
  const p = State.productos.find(x => x.id === id);
  if (!p) return;
  p.estado = p.estado === 'pendiente' ? 'comprado' : 'pendiente';
  saveState();
  // Actualizar solo la tarjeta sin re-renderizar todo
  _patchCardEstado(id, p);
  if (State.subSectionId === p.sectionId) renderSubScreen(p.sectionId);
}

function _patchCardEstado(id, p) {
  const card = document.querySelector(`[data-pid="${id}"]`);
  if (!card) { renderCompra(); return; }
  const isComprado = p.estado === 'comprado';
  const check = card.querySelector('.check-circle');
  if (check) {
    check.innerHTML = isComprado
      ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 5.5 10.5 12 3"/></svg>'
      : '';
    check.className = `check-circle w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
      isComprado
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'border-slate-600 text-transparent'}`;
  }
  card.classList.toggle('prod-comprado', isComprado);
}

// Cambio rápido de urgencia desde la pantalla Compra
function cambiarUrgenciaRapida(id) {
  const p = State.productos.find(x => x.id === id);
  if (!p) return;
  showSheet({
    title: 'Cambiar urgencia',
    submitLabel: 'Aplicar',
    html: `<div class="py-2">
      <p class="text-sm text-slate-400 mb-4">Producto: <strong class="text-slate-200">${esc(p.nombre)}</strong></p>
      ${buildUrgenciaPicker(p.urgencia)}
    </div>`,
    onSubmit() {
      return { urgencia: document.getElementById('uhidden').value };
    }
  }).then(result => {
    if (!result) return;
    p.urgencia = result.urgencia;
    saveState();
    renderCompra();
    showToast(`🔄 Urgencia actualizada`);
  });
}

// Cambio rápido desde sub-pantalla (pill de urgencia)
function cambiarUrgenciaSub(id) {
  const p = State.productos.find(x => x.id === id);
  if (!p) return;
  const ciclo = { rojo:'amarillo', amarillo:'verde', verde:'rojo' };
  p.urgencia = ciclo[p.urgencia] || 'amarillo';
  saveState();
  renderSubScreen(State.subSectionId);
  if (State.activeTab === 'compra') renderCompra();
  const labels = { rojo:'🔴 Urgente', amarillo:'🟡 Normal', verde:'🟢 Sin prisa' };
  showToast(`${labels[p.urgencia]}`);
}

// ══════════════════════════════════════════════════════════════
// 13. NAVEGACIÓN
// ══════════════════════════════════════════════════════════════
function switchTab(tab) {
  State.activeTab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${tab}`)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  const titles = { compra:'La Compra Diaria', categorias:'Secciones', resumen:'Panel', gestion:'Gestión' };
  document.getElementById('header-title').textContent = titles[tab] || '';
  const fab = document.getElementById('fab-add');
  fab.style.display = (tab === 'categorias' || tab === 'gestion') ? 'flex' : 'none';
  renderScreen(tab);
}

function renderScreen(tab) {
  switch(tab) {
    case 'compra':     renderCompra();     break;
    case 'categorias': renderCategorias(); break;
    case 'resumen':    renderPanel();      break;
    case 'gestion':    renderGestion();    break;
  }
}

// ══════════════════════════════════════════════════════════════
// 14. SUB-SCREEN
// ══════════════════════════════════════════════════════════════
function openSubScreen(sectionId) {
  const sec = State.secciones.find(s => s.id === sectionId);
  if (!sec) return;
  State.subSectionId = sectionId;
  document.getElementById('sub-icon').textContent  = sec.icono;
  document.getElementById('sub-title').textContent = sec.nombre;
  renderSubScreen(sectionId);
  document.getElementById('sub-screen').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSubScreen() {
  document.getElementById('sub-screen').classList.remove('open');
  document.body.style.overflow = '';
  State.subSectionId = null;
  if (State.activeTab === 'categorias') renderCategorias();
  if (State.activeTab === 'compra') renderCompra();
}

// ══════════════════════════════════════════════════════════════
// 15. RENDER — PANTALLA COMPRA
//     Agrupada por urgencia (plegable), luego por sección,
//     mostrando comprados con check sin eliminarlos
// ══════════════════════════════════════════════════════════════
function renderCompra() {
  const list  = document.getElementById('compra-list');
  const empty = document.getElementById('compra-empty');

  // Separar: primero pendientes, luego comprados; cada grupo ordenado por sección
  const pendientes = State.productos.filter(p => p.estado === 'pendiente');
  const comprados  = State.productos.filter(p => p.estado === 'comprado');

  if (!pendientes.length && !comprados.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    empty.classList.add('flex');
    return;
  }
  empty.classList.add('hidden');
  empty.classList.remove('flex');

  // Orden de urgencia
  const URG_ORD = { rojo:0, amarillo:1, verde:2 };
  const SEC_IDX = {};
  State.secciones.forEach((s,i) => { SEC_IDX[s.id] = i; });

  // Función: ordenar por sección y luego nombre
  const sortBySec = arr => [...arr].sort((a,b) => {
    const si = (SEC_IDX[a.sectionId] ?? 99) - (SEC_IDX[b.sectionId] ?? 99);
    if (si !== 0) return si;
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  // Agrupar pendientes por urgencia
  const grupos = [
    { key:'rojo',     label:'🔴 Urgente',   color:'#dc2626', items: sortBySec(pendientes.filter(p => p.urgencia==='rojo')) },
    { key:'amarillo', label:'🟡 Normal',    color:'#d97706', items: sortBySec(pendientes.filter(p => p.urgencia==='amarillo')) },
    { key:'verde',    label:'🟢 Sin prisa', color:'#059669', items: sortBySec(pendientes.filter(p => p.urgencia==='verde')) },
  ].filter(g => g.items.length > 0);

  const compradosSorted = sortBySec(comprados);

  let html = '';

  // ── Grupos plegables ────────────────────────────────────────
  grupos.forEach(g => {
    const collapsed = State.gruposState[g.key] === true;
    const maxH = collapsed ? '0px' : `${g.items.length * 80}px`;
    html += `
    <div class="mb-3">
      <!-- Cabecera grupo -->
      <button class="w-full flex items-center justify-between px-3 py-2 rounded-xl
                     bg-slate-800 border border-slate-700 mb-1.5 transition-colors
                     hover:bg-slate-750 active:opacity-80"
              onclick="toggleGrupo('${g.key}')" style="user-select:none;">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${g.color};"></span>
          <span class="text-sm font-bold text-slate-200">${g.label}</span>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">${g.items.length}</span>
        </div>
        <svg class="flex-shrink-0 text-slate-500 transition-transform duration-300 ${collapsed ? '-rotate-90' : ''}"
             id="arrow-${g.key}" width="16" height="16" viewBox="0 0 16 16" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>
      <!-- Tarjetas -->
      <div class="grupo-content space-y-2" id="grupo-${g.key}"
           style="max-height:${maxH}; ${collapsed ? 'overflow:hidden;' : ''}">
        ${g.items.map(p => cardCompra(p, false)).join('')}
      </div>
    </div>`;
  });

  // ── Comprados al final ───────────────────────────────────────
  if (compradosSorted.length) {
    const collC = State.gruposState['comprados'] === true;
    const maxHC = collC ? '0px' : `${compradosSorted.length * 80}px`;
    html += `
    <div class="mb-3">
      <button class="w-full flex items-center justify-between px-3 py-2 rounded-xl
                     bg-slate-800/60 border border-slate-700/50 mb-1.5
                     hover:bg-slate-800 active:opacity-80 transition-colors"
              onclick="toggleGrupo('comprados')" style="user-select:none;">
        <div class="flex items-center gap-2">
          <span class="text-base">✅</span>
          <span class="text-sm font-bold text-slate-400">Comprados</span>
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-500">${compradosSorted.length}</span>
        </div>
        <svg class="flex-shrink-0 text-slate-600 transition-transform duration-300 ${collC ? '-rotate-90' : ''}"
             id="arrow-comprados" width="16" height="16" viewBox="0 0 16 16" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>
      <div class="grupo-content space-y-2" id="grupo-comprados"
           style="max-height:${maxHC}; ${collC ? 'overflow:hidden;' : ''}">
        ${compradosSorted.map(p => cardCompra(p, true)).join('')}
      </div>
    </div>`;
  }

  list.innerHTML = html;
}

function cardCompra(p, isComprado) {
  const sec  = State.secciones.find(s => s.id === p.sectionId);
  const DOT  = { rojo:'#dc2626', amarillo:'#d97706', verde:'#059669' };
  const dotC = DOT[p.urgencia] || DOT.verde;
  return `
  <div class="flex items-center gap-3 px-3 py-3
              bg-slate-800 rounded-xl border border-slate-700
              active:scale-[.98] transition-transform select-none
              ${isComprado ? 'prod-comprado opacity-60' : ''}"
       data-pid="${esc(p.id)}">

    <!-- Dot urgencia (grande, clicable para cambiar) -->
    <button class="flex-shrink-0 w-5 h-5 rounded-full border-2 border-white/20 transition-transform active:scale-90"
            style="background:${dotC};"
            onclick="cambiarUrgenciaRapida('${esc(p.id)}')"
            title="Cambiar urgencia"></button>

    <!-- Sección + nombre -->
    <div class="flex-1 min-w-0 cursor-pointer" onclick="toggleProducto('${esc(p.id)}')">
      <div class="flex items-baseline gap-1.5 flex-wrap">
        ${sec ? `<span class="text-xs font-bold text-slate-400 flex-shrink-0">${esc(sec.icono)} ${esc(sec.nombre)}</span>` : ''}
        <span class="prod-nombre text-base font-bold text-slate-100 leading-tight">${esc(p.nombre)}</span>
      </div>
    </div>

    <!-- Check círculo -->
    <button class="check-circle w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                   ${isComprado ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-600 text-transparent'}"
            onclick="toggleProducto('${esc(p.id)}')"
            aria-label="Marcar comprado">
      ${isComprado
        ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 7 5.5 10.5 12 3"/></svg>'
        : ''}
    </button>
  </div>`;
}

function toggleGrupo(key) {
  State.gruposState[key] = !(State.gruposState[key] === true);
  lsSet(LS.GRUPOS_STATE, State.gruposState);
  const content = document.getElementById(`grupo-${key}`);
  const arrow   = document.getElementById(`arrow-${key}`);
  if (!content) return;
  const collapsed = State.gruposState[key];
  if (collapsed) {
    content.style.maxHeight = content.scrollHeight + 'px';
    requestAnimationFrame(() => { content.style.maxHeight = '0px'; content.style.overflow = 'hidden'; });
  } else {
    content.style.overflow = '';
    content.style.maxHeight = content.scrollHeight + 'px';
    setTimeout(() => { content.style.maxHeight = 'none'; }, 320);
  }
  arrow?.classList.toggle('-rotate-90', collapsed);
}

// ══════════════════════════════════════════════════════════════
// 16. RENDER — PANTALLA CATEGORÍAS
// ══════════════════════════════════════════════════════════════
function renderCategorias() {
  const list = document.getElementById('categorias-list');
  if (!State.secciones.length) {
    list.innerHTML = `<div class="flex flex-col items-center justify-center py-24 text-center">
      <div class="text-5xl mb-3">📂</div>
      <p class="text-sm font-semibold text-slate-500">Sin secciones todavía</p>
      <p class="text-xs text-slate-600 mt-1">Crea una desde Gestión o pulsa ＋</p>
    </div>`;
    return;
  }
  list.innerHTML = State.secciones.map(sec => {
    const total     = State.productos.filter(p => p.sectionId === sec.id).length;
    const pendientes= State.productos.filter(p => p.sectionId === sec.id && p.estado === 'pendiente').length;
    const urgentes  = State.productos.filter(p => p.sectionId === sec.id && p.urgencia === 'rojo' && p.estado === 'pendiente').length;
    const pct = total > 0 ? Math.round(((total-pendientes)/total)*100) : 0;
    return `
    <button class="w-full flex items-center gap-3 px-4 py-3.5
                   bg-slate-800 rounded-xl border border-slate-700
                   text-left transition-all active:scale-[.98]
                   hover:border-blue-700"
            onclick="openSubScreen('${esc(sec.id)}')">
      <span class="text-2xl flex-shrink-0">${esc(sec.icono)}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="text-sm font-bold text-slate-100 truncate">${esc(sec.nombre)}</p>
          ${urgentes > 0 ? `<span class="flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-700 text-white">${urgentes} 🔴</span>` : ''}
        </div>
        <div class="flex items-center gap-2 mt-1.5">
          <div class="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div class="h-full rounded-full bg-blue-500 transition-all duration-500" style="width:${pct}%"></div>
          </div>
          <span class="text-xs text-slate-500 flex-shrink-0">${pendientes} pend.</span>
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" class="text-slate-600 flex-shrink-0">
        <path d="M6 4l4 4-4 4"/>
      </svg>
    </button>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════
// 17. RENDER — SUB-SCREEN (productos de sección)
// ══════════════════════════════════════════════════════════════
function renderSubScreen(sectionId) {
  const content  = document.getElementById('sub-content');
  const productos = State.productos.filter(p => p.sectionId === sectionId);

  if (!productos.length) {
    content.innerHTML = `<div class="flex flex-col items-center justify-center py-24 text-center">
      <div class="text-5xl mb-3">🛍️</div>
      <p class="text-sm font-semibold text-slate-500">Sección vacía</p>
      <p class="text-xs text-slate-600 mt-1">Pulsa ＋ para añadir un producto</p>
    </div>`;
    return;
  }

  // Ordenar: urgencia → nombre
  const URG = { rojo:0, amarillo:1, verde:2 };
  const sorted = [...productos].sort((a,b) =>
    (URG[a.urgencia]??1) - (URG[b.urgencia]??1) || a.nombre.localeCompare(b.nombre,'es'));

  const DOT = { rojo:'#dc2626', amarillo:'#d97706', verde:'#059669' };
  const URG_LABEL = { rojo:'🔴 Urgente', amarillo:'🟡 Normal', verde:'🟢 Sin prisa' };
  const URG_CLS = {
    rojo:     'bg-red-900/60 text-red-300 border border-red-800',
    amarillo: 'bg-amber-900/60 text-amber-300 border border-amber-800',
    verde:    'bg-emerald-900/60 text-emerald-300 border border-emerald-800'
  };

  content.innerHTML = sorted.map(p => `
  <div class="flex items-center gap-3 px-3 py-3
              bg-slate-800 rounded-xl border border-slate-700
              ${p.estado==='comprado' ? 'opacity-50' : ''}">
    <!-- Dot -->
    <span class="w-4 h-4 rounded-full flex-shrink-0" style="background:${DOT[p.urgencia]||DOT.verde};"></span>
    <!-- Icono producto -->
    <span class="text-xl flex-shrink-0">${esc(p.icono)}</span>
    <!-- Info -->
    <div class="flex-1 min-w-0">
      <p class="text-sm font-bold text-slate-100 truncate ${p.estado==='comprado'?'line-through text-slate-500':''}">${esc(p.nombre)}</p>
      <!-- Pill urgencia clicable (cicla) -->
      <button class="urg-pill ${URG_CLS[p.urgencia]||URG_CLS.verde} mt-1"
              onclick="cambiarUrgenciaSub('${esc(p.id)}')"
              title="Pulsa para cambiar urgencia">
        ${URG_LABEL[p.urgencia]||p.urgencia}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 4l3 3 3-3"/></svg>
      </button>
    </div>
    <!-- Acciones -->
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <button onclick="toggleProducto('${esc(p.id)}')"
        class="p-1.5 rounded-lg text-xs font-bold ${p.estado==='comprado'
          ? 'bg-slate-700 text-slate-400' : 'bg-blue-700 text-white'}
               hover:opacity-80 transition-opacity">
        ${p.estado==='comprado' ? '↩️' : '✅'}
      </button>
      <button onclick="editarProducto('${esc(p.id)}')"
        class="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 2l2 2-7 7H3v-2l7-7z"/>
        </svg>
      </button>
      <button onclick="eliminarProducto('${esc(p.id)}')"
        class="p-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/70 transition-colors">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="2 4 12 4"/><path d="M5 4V2h4v2M5 6v5M9 6v5"/><rect x="3" y="4" width="8" height="8" rx="1"/>
        </svg>
      </button>
    </div>
  </div>`).join('');
}

// ══════════════════════════════════════════════════════════════
// 18. RENDER — PANEL (antes Resumen) — gestión visual de productos
// ══════════════════════════════════════════════════════════════
function renderPanel() {
  const el = document.getElementById('resumen-content');
  const total     = State.productos.length;
  const comprados = State.productos.filter(p => p.estado === 'comprado').length;
  const urgentes  = State.productos.filter(p => p.urgencia === 'rojo' && p.estado === 'pendiente').length;
  const normales  = State.productos.filter(p => p.urgencia === 'amarillo' && p.estado === 'pendiente').length;
  const sinPrisa  = State.productos.filter(p => p.urgencia === 'verde' && p.estado === 'pendiente').length;

  // Todas las secciones con sus productos, agrupados
  const seccionesConProds = State.secciones.map(sec => ({
    ...sec,
    productos: State.productos
      .filter(p => p.sectionId === sec.id)
      .sort((a,b) => {
        const URG={rojo:0,amarillo:1,verde:2};
        return (URG[a.urgencia]??1)-(URG[b.urgencia]??1) || a.nombre.localeCompare(b.nombre,'es');
      })
  })).filter(s => s.productos.length > 0);

  const DOT = { rojo:'#dc2626', amarillo:'#d97706', verde:'#059669' };
  const URG_LABEL = { rojo:'🔴', amarillo:'🟡', verde:'🟢' };

  el.innerHTML = `
  <!-- Resumen rápido -->
  <div class="grid grid-cols-2 gap-2 mb-5">
    ${miniCard('📦','Total prod.',total,'bg-slate-800 border-slate-700')}
    ${miniCard('🔴','Urgentes',urgentes,'bg-red-950 border-red-800')}
    ${miniCard('🟡','Normales',normales,'bg-amber-950 border-amber-800')}
    ${miniCard('🟢','Sin prisa',sinPrisa,'bg-emerald-950 border-emerald-800')}
  </div>

  <!-- Barra de progreso de compra -->
  ${total > 0 ? `
  <div class="bg-slate-800 rounded-xl p-4 border border-slate-700 mb-5">
    <div class="flex justify-between items-center mb-2">
      <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">Progreso de compra</span>
      <span class="text-sm font-bold text-blue-400">${Math.round(comprados/total*100)}%</span>
    </div>
    <div class="h-2.5 bg-slate-700 rounded-full overflow-hidden">
      <div class="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700"
           style="width:${Math.round(comprados/total*100)}%"></div>
    </div>
    <p class="text-xs text-slate-500 mt-1.5 text-right">${comprados} de ${total} comprados</p>
  </div>` : ''}

  <!-- Acción rápida global -->
  <div class="flex gap-2 mb-5">
    <button onclick="resetearCompra()"
      class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
             bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300
             hover:border-blue-600 hover:text-blue-400 transition-colors">
      🔄 Reiniciar compra
    </button>
    <button onclick="marcarTodoPendiente()"
      class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
             bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-300
             hover:border-emerald-600 hover:text-emerald-400 transition-colors">
      🟢 Todo sin prisa
    </button>
  </div>

  <!-- Tabla de productos por sección -->
  <p class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 px-1">
    Todos los productos por sección
  </p>

  ${seccionesConProds.length === 0 ? `
    <p class="text-sm text-slate-600 text-center py-8">Aún no hay productos.<br>Crea secciones y añade productos desde "Secciones".</p>
  ` : seccionesConProds.map(sec => `
  <div class="mb-4 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
    <!-- Cabecera sección -->
    <div class="flex items-center gap-2 px-4 py-2.5 bg-slate-750 border-b border-slate-700">
      <span class="text-lg">${esc(sec.icono)}</span>
      <span class="text-sm font-bold text-slate-200">${esc(sec.nombre)}</span>
      <span class="ml-auto text-xs text-slate-500">${sec.productos.length} prod.</span>
    </div>
    <!-- Filas de productos -->
    ${sec.productos.map(p => `
    <div class="flex items-center gap-3 px-3 py-2.5 border-b border-slate-700/50 last:border-0">
      <span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${DOT[p.urgencia]||DOT.verde};"></span>
      <span class="text-base flex-shrink-0">${esc(p.icono)}</span>
      <span class="flex-1 text-sm text-slate-200 truncate ${p.estado==='comprado'?'line-through text-slate-500':''}">${esc(p.nombre)}</span>
      <!-- Botones urgencia rápida inline -->
      <div class="flex gap-1 flex-shrink-0">
        ${['rojo','amarillo','verde'].map(u => `
        <button onclick="setUrgenciaPanel('${esc(p.id)}','${u}')"
          class="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center
                 transition-all border-2 ${p.urgencia===u ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-80'}"
          style="background:${DOT[u]};"
          title="${{rojo:'Urgente',amarillo:'Normal',verde:'Sin prisa'}[u]}">
        </button>`).join('')}
      </div>
    </div>`).join('')}
  </div>`).join('')}`;
}

function miniCard(icon, label, val, cls) {
  return `<div class="flex flex-col items-center py-3.5 rounded-xl ${cls} border">
    <span class="text-2xl mb-0.5">${icon}</span>
    <span class="text-2xl font-bold text-slate-100">${val}</span>
    <span class="text-xs text-slate-400 font-semibold">${label}</span>
  </div>`;
}

function setUrgenciaPanel(id, urgencia) {
  const p = State.productos.find(x => x.id === id);
  if (!p) return;
  p.urgencia = urgencia;
  saveState();
  renderPanel();
  if (State.activeTab === 'compra') renderCompra();
  const L = {rojo:'🔴 Urgente', amarillo:'🟡 Normal', verde:'🟢 Sin prisa'};
  showToast(L[urgencia]);
}

async function marcarTodoPendiente() {
  if (!State.productos.length) { showToast('ℹ️ No hay productos'); return; }
  const ok = await showConfirm({
    title: 'Marcar todo como Sin prisa',
    body:  '<p class="mt-1">Todos los productos pasarán a urgencia 🟢 Sin prisa y estado pendiente.</p>',
    confirmLabel: 'Aplicar',
    confirmStyle: 'primary'
  });
  if (!ok) return;
  State.productos.forEach(p => { p.urgencia = 'verde'; p.estado = 'pendiente'; });
  saveState();
  renderPanel();
  if (State.activeTab === 'compra') renderCompra();
  showToast('🟢 Todo marcado como Sin prisa');
}

// ══════════════════════════════════════════════════════════════
// 19. RENDER — GESTIÓN
// ══════════════════════════════════════════════════════════════
function renderGestion() {
  const el = document.getElementById('gestion-content');
  el.innerHTML = `
  <div class="space-y-3">

    <!-- Toggle Modo -->
    <div class="flex items-center justify-between px-4 py-3.5
                bg-slate-800 rounded-xl border border-slate-700">
      <div class="flex items-center gap-3">
        <span class="text-xl">${State.darkMode ? '☀️' : '🌙'}</span>
        <span class="text-sm font-semibold text-slate-200">
          ${State.darkMode ? 'Modo claro activo' : 'Modo oscuro activo'}
        </span>
      </div>
      <button onclick="toggleDarkMode()"
        class="relative w-12 h-6 rounded-full transition-colors duration-300
               ${State.darkMode ? 'bg-blue-500' : 'bg-slate-600'}"
        role="switch" aria-checked="${State.darkMode}">
        <span class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300
                     ${State.darkMode ? 'translate-x-6' : 'translate-x-0'}"></span>
      </button>
    </div>

    <!-- Secciones -->
    <div class="flex items-center justify-between px-1 pt-2">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Secciones (${State.secciones.length})</p>
      <button onclick="anadirSeccion()"
        class="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors">+ Añadir</button>
    </div>

    ${State.secciones.length === 0 ? `
    <p class="text-sm text-slate-600 px-1 text-center py-4">Sin secciones. Pulsa "+ Añadir" o el botón ＋.</p>` : ''}

    ${State.secciones.map(sec => {
      const n = State.productos.filter(p => p.sectionId === sec.id).length;
      return `
      <div class="flex items-center gap-3 px-4 py-3 bg-slate-800 rounded-xl border border-slate-700">
        <span class="text-xl">${esc(sec.icono)}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-slate-200 truncate">${esc(sec.nombre)}</p>
          <p class="text-xs text-slate-500">${n} producto${n!==1?'s':''}</p>
        </div>
        <button onclick="editarSeccion('${esc(sec.id)}')"
          class="p-1.5 rounded-lg bg-slate-700 text-slate-400 hover:bg-blue-900 hover:text-blue-300 transition-colors">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2l2 2-7 7H3v-2l7-7z"/></svg>
        </button>
        <button onclick="eliminarSeccion('${esc(sec.id)}')"
          class="p-1.5 rounded-lg bg-red-950 text-red-500 hover:bg-red-900/60 transition-colors">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 4 12 4"/><path d="M5 4V2h4v2M5 6v5M9 6v5"/><rect x="3" y="4" width="8" height="8" rx="1"/></svg>
        </button>
      </div>`;
    }).join('')}

    <!-- Iconos personalizados -->
    <div class="flex items-center justify-between px-1 pt-2">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Iconos personalizados</p>
    </div>
    <div class="bg-slate-800 rounded-xl border border-slate-700 px-4 py-4">
      <p class="text-xs text-slate-400 mb-3">Añade emojis adicionales para usar como icono en secciones y productos.</p>
      <div class="flex gap-2 mb-3">
        <input id="custom-icon-input" type="text" maxlength="4"
          placeholder="Pega un emoji 🍕"
          class="flex-1 px-3 py-2 rounded-xl text-sm border border-slate-600 bg-slate-700 text-slate-100
                 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autocomplete="off" autocorrect="off" spellcheck="false" />
        <button onclick="addCustomIcon()"
          class="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
          Añadir
        </button>
      </div>
      ${State.customIcons.length > 0 ? `
      <div class="flex flex-wrap gap-2">
        ${State.customIcons.map(ic => `
        <div class="relative group">
          <span class="text-2xl cursor-default">${ic}</span>
          <button onclick="removeCustomIcon('${esc(ic)}')"
            class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[9px]
                   flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
            title="Eliminar">✕</button>
        </div>`).join('')}
      </div>` : `<p class="text-xs text-slate-600">Sin iconos personalizados todavía.</p>`}
    </div>

    <!-- Datos -->
    <div class="px-1 pt-2">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Datos</p>
    </div>
    <button onclick="exportarDB()"
      class="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-800 rounded-xl border border-slate-700
             text-left hover:border-blue-600 transition-colors">
      <span class="text-xl">📤</span>
      <div>
        <p class="text-sm font-semibold text-slate-200">Exportar base de datos</p>
        <p class="text-xs text-slate-500">Descarga un JSON con todo</p>
      </div>
    </button>
    <label class="w-full flex items-center gap-3 px-4 py-3.5 bg-slate-800 rounded-xl border border-slate-700
                  text-left hover:border-blue-600 transition-colors cursor-pointer">
      <span class="text-xl">📥</span>
      <div class="flex-1">
        <p class="text-sm font-semibold text-slate-200">Importar base de datos</p>
        <p class="text-xs text-slate-500">Carga un JSON exportado</p>
      </div>
      <input type="file" accept=".json" class="hidden" onchange="importarDB(event)"/>
    </label>

    <!-- Zona peligrosa -->
    <div class="px-1 pt-2">
      <p class="text-xs font-bold uppercase tracking-wider text-red-500">Zona peligrosa</p>
    </div>
    <button onclick="resetearTodo()"
      class="w-full flex items-center gap-3 px-4 py-3.5 bg-red-950 rounded-xl border border-red-900
             text-left hover:bg-red-900/50 transition-colors">
      <span class="text-xl">🗑️</span>
      <div>
        <p class="text-sm font-semibold text-red-400">Borrar todos los datos</p>
        <p class="text-xs text-red-600">Restaura la app al estado inicial</p>
      </div>
    </button>

  </div>`;
}

// ══════════════════════════════════════════════════════════════
// 20. ICONOS PERSONALIZADOS
// ══════════════════════════════════════════════════════════════
function addCustomIcon() {
  const input = document.getElementById('custom-icon-input');
  const val   = (input?.value || '').trim();
  if (!val) return;
  // Validar que es un emoji (caracteres non-ASCII básicos)
  if ([...val].every(c => c.charCodeAt(0) < 128)) {
    showToast('⚠️ Pega un emoji, no texto'); return;
  }
  const icon = [...val][0]; // solo el primer carácter/emoji
  if (State.customIcons.includes(icon)) { showToast('Ya existe ese icono'); return; }
  State.customIcons.push(icon);
  saveState();
  renderGestion();
  showToast(`✅ Icono ${icon} añadido`);
}

function removeCustomIcon(ic) {
  State.customIcons = State.customIcons.filter(x => x !== ic);
  saveState();
  renderGestion();
}

// ══════════════════════════════════════════════════════════════
// 21. ACCIONES GLOBALES
// ══════════════════════════════════════════════════════════════
async function resetearCompra() {
  const n = State.productos.filter(p => p.estado === 'comprado').length;
  if (!n) { showToast('ℹ️ Nada comprado aún'); return; }
  const ok = await showConfirm({
    title: 'Reiniciar compra',
    body:  `<p class="mt-1">${n} producto${n!==1?'s':''} volverán a estar pendientes.</p>`,
    confirmLabel: 'Reiniciar', confirmStyle: 'primary'
  });
  if (!ok) return;
  State.productos.forEach(p => { p.estado = 'pendiente'; });
  saveState();
  renderScreen(State.activeTab);
  showToast('🔄 Compra reiniciada');
}

function exportarDB() {
  const data = { version:3, exportedAt:new Date().toISOString(), secciones:State.secciones, productos:State.productos, customIcons:State.customIcons };
  const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'),{href:url, download:`compra-diaria-${new Date().toISOString().slice(0,10)}.json`});
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📤 Exportado');
}

async function importarDB(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.secciones) || !Array.isArray(data.productos)) throw new Error();
    const ok = await showConfirm({
      title: 'Importar datos',
      body:  `<p class="mt-1">Reemplazará todos los datos actuales con los de <strong>${esc(file.name)}</strong>.</p>`,
      confirmLabel: 'Importar', confirmStyle: 'primary'
    });
    if (!ok) { event.target.value=''; return; }
    State.secciones   = data.secciones;
    State.productos   = data.productos;
    State.customIcons = Array.isArray(data.customIcons) ? data.customIcons : [];
    saveState();
    renderScreen(State.activeTab);
    showToast('📥 Datos importados');
  } catch { showToast('❌ Fichero inválido'); }
  event.target.value = '';
}

async function resetearTodo() {
  const ok = await showConfirm({
    title: '⚠️ Borrar todos los datos',
    body:  '<p class="mt-1">Se eliminarán <strong>todas</strong> las secciones y productos. No se puede deshacer.</p>',
    confirmLabel: 'Borrar todo'
  });
  if (!ok) return;
  localStorage.removeItem(LS.INITIALIZED);
  loadState();
  renderScreen(State.activeTab);
  showToast('🗑️ Datos restablecidos');
}

// ══════════════════════════════════════════════════════════════
// 22. AVISO AL SALIR (beforeunload)
// ══════════════════════════════════════════════════════════════
window.addEventListener('beforeunload', e => {
  e.preventDefault();
  e.returnValue = '¿Seguro que quieres salir? Los datos están guardados localmente.';
});

// ══════════════════════════════════════════════════════════════
// 23. SERVICE WORKER
// ══════════════════════════════════════════════════════════════
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js')
    .then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw.addEventListener('statechange', () => {
          if (nw.state==='installed' && navigator.serviceWorker.controller)
            showToast('🔄 Actualización disponible — recarga', 4000);
        });
      });
    }).catch(e => console.error('[SW]', e));
}

// ══════════════════════════════════════════════════════════════
// 24. EVENTOS DOM
// ══════════════════════════════════════════════════════════════
function initEvents() {
  // Tabs
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // FAB principal
  document.getElementById('fab-add').addEventListener('click', () => {
    if (State.activeTab === 'gestion') anadirSeccion();
    else if (State.activeTab === 'categorias') {
      if (!State.secciones.length) { showToast('⚠️ Crea una sección primero'); return; }
      anadirProducto(State.secciones[0].id);
    }
  });

  // FAB sub-screen
  document.getElementById('fab-sub-add').addEventListener('click', () => {
    if (State.subSectionId) anadirProducto(State.subSectionId);
  });

  // Volver sub-screen
  document.getElementById('sub-back').addEventListener('click', closeSubScreen);

  // Cerrar modal al pulsar fuera
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
  });

  // Offline
  const badge = document.getElementById('offline-badge');
  const upd   = () => badge.classList.toggle('hidden', navigator.onLine);
  window.addEventListener('online',  upd);
  window.addEventListener('offline', upd);
  upd();

  // Swipe-back en sub-screen
  let startX = 0;
  const sub = document.getElementById('sub-screen');
  sub.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive:true});
  sub.addEventListener('touchend',   e => {
    if (e.changedTouches[0].clientX - startX > 80 && startX < 60) closeSubScreen();
  }, {passive:true});

  // Montar icon grids cuando el sheet tiene contenido
  // (observer ligero sobre sheet-body)
  const obs = new MutationObserver(() => {
    const body = document.getElementById('sheet-body');
    if (!body) return;
    const g1 = body.querySelector('#igrid-sec');
    const g2 = body.querySelector('#igrid-prod');
    if (g1 && !g1.hasChildNodes()) mountIconGrid('sec',  g1.closest('[data-picker]')?.dataset.pickerType || 'seccion');
    if (g2 && !g2.hasChildNodes()) mountIconGrid('prod', 'producto');
  });
  obs.observe(document.getElementById('sheet-body') || document.body, {childList:true, subtree:true});
}

// ══════════════════════════════════════════════════════════════
// 25. INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════
function init() {
  loadState();
  applyTheme(State.darkMode);
  registerSW();
  initEvents();

  setTimeout(() => {
    const splash = document.getElementById('splash');
    const shell  = document.getElementById('app-shell');
    splash.classList.add('hidden');
    shell.style.display = 'flex';
    switchTab('compra');
    setTimeout(() => splash.remove(), 600);
  }, 1700);
}

document.addEventListener('DOMContentLoaded', init);
