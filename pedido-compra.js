/* =====================================================================
   MEPEX — Pedir compra (pedido liviano · Fase 13.5)
   =====================================================================
   Atajo para pm y taller: "necesito que compren X". No abre el módulo Compras
   (taller no tiene acceso) — crea una NOTIFICACIÓN a administración (campana),
   con link a #compras para que admin lo gestione. Liviano y a prueba de torpes.
   Entrada única: PedidoCompra.open().
   ===================================================================== */

const PedidoCompra = {
    _stylesInjected: false,

    _esc(s) { return window.escHtml ? window.escHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

    open() {
        const user = Auth.getUser();
        if (!user) return;
        this._injectStyles();
        const body = `
            <div class="pcmp">
                <p class="pcmp-lead">Se le avisa a administración (campana). Sé claro con qué necesitás.</p>
                <label class="pcmp-lbl">¿Qué necesitás? *</label>
                <textarea id="pcmpDetalle" class="pcmp-in" rows="3" placeholder="Ej. 10 placas Fibroplus 3mm + tornillería"></textarea>
                <div class="pcmp-2">
                    <div><label class="pcmp-lbl">¿Para cuándo?</label><input type="date" id="pcmpFecha" class="pcmp-in"></div>
                    <div><label class="pcmp-lbl">Urgencia</label><select id="pcmpUrg" class="pcmp-in"><option value="normal">Normal</option><option value="alta">Urgente</option></select></div>
                </div>
            </div>`;
        const footer = `<button class="pcmp-btn pcmp-btn-ghost" data-modal-close>Cancelar</button><button class="pcmp-btn pcmp-btn-primary" id="pcmpSend">Enviar pedido</button>`;
        const inst = Modal.open({ title: '🛒 Pedir compra', body, footer, size: 'sm' });
        document.getElementById('pcmpSend')?.addEventListener('click', async () => {
            const detalle = document.getElementById('pcmpDetalle').value.trim();
            if (!detalle) { Toast.warning('Escribí qué necesitás'); return; }
            const fecha = document.getElementById('pcmpFecha').value;
            const urg = document.getElementById('pcmpUrg').value;
            const btn = document.getElementById('pcmpSend'); btn.disabled = true; btn.textContent = 'Enviando…';
            try {
                const r = await API.createNotification({
                    tipo: 'pedido_compra',
                    titulo: '🛒 Pedido de compra' + (urg === 'alta' ? ' (urgente)' : ''),
                    mensaje: `${detalle}${fecha ? ' · para ' + fecha : ''} — pide ${user.name}`,
                    targetRole: 'admin',
                    link: '#compras',
                    prioridad: urg === 'alta' ? 'alta' : 'normal',
                });
                if (r === null) throw new Error('no se pudo registrar');
                Toast.success('Pedido enviado a administración');
                Modal.close(inst.id);
            } catch (e) {
                console.error('[PedidoCompra]', e);
                Toast.error('No se pudo enviar el pedido');
                btn.disabled = false; btn.textContent = 'Enviar pedido';
            }
        });
    },

    _injectStyles() {
        if (this._stylesInjected || document.getElementById('pcmp-styles')) { this._stylesInjected = true; return; }
        const s = document.createElement('style');
        s.id = 'pcmp-styles';
        s.textContent = `
        .pcmp { display:flex; flex-direction:column; gap:2px; }
        .pcmp-lead { font-size:.84rem; color:var(--text-muted,#888); margin:0 0 8px; }
        .pcmp-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .pcmp-lbl { font-family:var(--font-mono,'Space Mono',monospace); font-size:.72rem; font-weight:700; color:var(--text-muted,#888); margin:10px 0 4px; display:block; }
        .pcmp-in { width:100%; background:#0c0c0c; border:1px solid var(--border,#2a2a2a); border-radius:8px; padding:10px 12px; color:var(--text-primary,#E8E8E8); font-family:var(--font-main,'Outfit',sans-serif); font-size:.95rem; box-sizing:border-box; }
        .pcmp-in:focus { outline:none; border-color:var(--primary,#00A9C1); }
        .pcmp-btn { font-family:var(--font-mono,'Space Mono',monospace); font-size:.82rem; font-weight:700; border-radius:8px; padding:10px 18px; cursor:pointer; border:1px solid var(--border,#2a2a2a); background:transparent; color:var(--text-primary,#E8E8E8); }
        .pcmp-btn-primary { background:var(--primary,#00A9C1); color:#050505; border-color:var(--primary,#00A9C1); }
        .pcmp-btn-ghost:hover { border-color:var(--primary,#00A9C1); color:var(--primary,#00A9C1); }
        `;
        document.head.appendChild(s);
        this._stylesInjected = true;
    },
};
