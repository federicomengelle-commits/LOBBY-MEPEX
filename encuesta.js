// Encuesta pública MEPEX — lógica de la página standalone encuesta.html.
// Externalizado de encuesta.html (2026-07-14) para cumplir la CSP enforcing
// (script-src sin 'unsafe-inline'). No cambia comportamiento.

// Aspectos valorados (mismos keys que proyecto-detalle.js _encuestaAspectos).
const ASPECTOS = [
    { key: 'calidad',  label: 'Calidad y terminación' },
    { key: 'tiempos',  label: 'Cumplimiento de los tiempos' },
    { key: 'atencion', label: 'Atención y comunicación' },
    { key: 'armado',   label: 'Armado y desarme' },
];

// Logo MEPEX real (SVG inline, mismo vector de la marca).
const LOGO = '<svg class="brand-logo" viewBox="0 0 13238.69 5669.29" role="img" aria-label="MEPEX"><use href="#mepexLogo"/></svg>';

(async () => {
    const card = document.getElementById('card');
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    const renderError = (msg) => {
        card.innerHTML = `
            <div class="state-screen">
                ${LOGO}
                <div class="state-icon" style="font-size: 2rem; color: var(--text-dim); margin: 16px 0 10px;">✕</div>
                <h2>Este link no está disponible</h2>
                <p>${esc(msg)}</p>
                <p style="margin-top: 14px; font-size: 0.82rem;">¿Dudas? Escribinos a <a href="mailto:mepex@mepex.com.ar">mepex@mepex.com.ar</a></p>
            </div>`;
    };
    // Reseña en Google SOLO para clientes contentos (NPS >= 8). A un cliente
    // disconforme no lo mandamos a dejar una reseña pública ("review gating").
    const GOOGLE_REVIEW_URL = 'https://g.page/r/CaGIbYy0d0XEEBM/review';
    const renderThanks = (nps) => {
        if (nps >= 8) {
            card.innerHTML = `
                <div class="state-screen" style="padding-bottom: 6px;">
                    ${LOGO}
                    <div class="state-icon">🎉</div>
                    <h2>¡Gracias${nps === 10 ? ' por el 10' : ''}!</h2>
                    <p>Que te hayas ido contento con el stand es exactamente lo que buscamos. Un equipo como el nuestro se alimenta de esto.</p>
                </div>
                <div class="review-box">
                    <p>¿Nos regalás 30 segundos? Contá en Google cómo estuvo. A las marcas que nos están buscando les ayuda a decidirse — y a nosotros nos hace el día.</p>
                    <a class="review-btn" href="${GOOGLE_REVIEW_URL}" target="_blank" rel="noopener">★&nbsp;&nbsp;Dejar mi reseña en Google</a>
                </div>
                <p style="text-align:center; margin-top: 18px; color: var(--brand); font-family: 'Space Mono'; font-size: 0.8rem;">— Equipo MEPEX</p>
                <div class="footer">MEPEX · MONTAJE Y EQUIPAMIENTO PARA EXPOSICIONES</div>`;
        } else {
            card.innerHTML = `
                <div class="state-screen">
                    ${LOGO}
                    <div class="state-icon">🤝</div>
                    <h2>Gracias por tu sinceridad</h2>
                    <p>Sentimos que algo no estuvo a la altura. Tu comentario le llega directo al equipo y nos vamos a poner en contacto para resolverlo.</p>
                    <p style="margin-top: 16px; color: var(--brand); font-family: 'Space Mono'; font-size: 0.8rem;">— Equipo MEPEX</p>
                </div>
                <div class="footer">MEPEX · MONTAJE Y EQUIPAMIENTO PARA EXPOSICIONES</div>`;
        }
    };

    const params = new URLSearchParams(window.location.search);
    const token = params.get('t');
    if (!token) { renderError('Falta el código de la encuesta en el link.'); return; }

    try {
        // Todo el acceso pasa por RPCs SECURITY DEFINER que validan el token
        // server-side (anon ya no lee encuestas_evento/eventos/clientes directo).
        // El RPC resuelve el fallback evento/cliente para encuestas viejas.
        const { data: enc, error: encErr } = await supabaseClient
            .rpc('fn_encuesta_publica_get', { p_token: token });
        if (encErr) throw encErr;
        if (!enc) { renderError('El link de encuesta no es válido o ya expiró.'); return; }
        if (enc.respondida_at) { renderThanks(enc.nps); return; }

        const titulo = enc.titulo || enc.evento_nombre || 'tu stand';
        const subtitulo = enc.subtitulo || enc.cliente_nombre || '';

        card.innerHTML = `
            <svg class="card-wmk" viewBox="0 0 9024.99 9024.99" aria-hidden="true"><use href="#mepexIso"/></svg>
            <div class="header">
                ${LOGO}
                <h1>¿Cómo estuvo tu experiencia?</h1>
                <p>Contanos cómo te fue con el stand — son 30 segundos.</p>
            </div>
            <div class="ctx">
                <div class="proj">${esc(titulo)}</div>
                ${subtitulo ? `<div class="sub">${esc(subtitulo)}</div>` : ''}
            </div>
            <form id="encForm">
                <label class="q-label">¿Qué tan probable es que nos recomiendes?</label>
                <div class="nps-scale" id="npsScale">
                    ${Array.from({ length: 11 }, (_, i) => `<button type="button" class="nps-btn" data-score="${i}">${i}</button>`).join('')}
                </div>
                <div class="nps-labels"><span>Nada probable</span><span>Totalmente</span></div>

                <div class="sec-title">Valorá cada aspecto · opcional</div>
                ${ASPECTOS.map(a => `
                    <div class="dim">
                        <span class="dim-label">${a.label}</span>
                        <div class="stars" data-dim="${a.key}">
                            ${[1, 2, 3, 4, 5].map(v => `<button type="button" class="star" data-v="${v}">★</button>`).join('')}
                        </div>
                    </div>`).join('')}

                <div class="sec-title">Algo más que quieras contarnos · opcional</div>
                <textarea id="comentario" placeholder="Lo que quieras compartir con nosotros…"></textarea>

                <button type="submit" class="btn" id="submitBtn" disabled>Enviar respuesta</button>
            </form>`;

        // NPS
        let npsSelected = null;
        const npsBtns = document.querySelectorAll('.nps-btn');
        const submitBtn = document.getElementById('submitBtn');
        npsBtns.forEach(btn => btn.addEventListener('click', () => {
            npsSelected = parseInt(btn.dataset.score);
            npsBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            submitBtn.disabled = false;
        }));

        // Estrellas por aspecto
        const respuestas = {};
        document.querySelectorAll('.stars').forEach(group => {
            const dim = group.dataset.dim;
            const stars = [...group.querySelectorAll('.star')];
            stars.forEach(star => star.addEventListener('click', () => {
                const v = parseInt(star.dataset.v);
                respuestas[dim] = v;
                stars.forEach(s => s.classList.toggle('on', parseInt(s.dataset.v) <= v));
            }));
        });

        // Submit
        document.getElementById('encForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (npsSelected === null) return;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';
            const comentario = document.getElementById('comentario').value.trim() || null;
            const payloadResp = Object.keys(respuestas).length ? respuestas : null;
            try {
                const { data: res, error } = await supabaseClient
                    .rpc('fn_encuesta_publica_responder', {
                        p_token: token, p_nps: npsSelected,
                        p_respuestas: payloadResp, p_comentario: comentario
                    });
                if (error) throw error;
                // 'ya_respondida' = alguien mandó antes (doble tab) → mostrar gracias igual.
                if (!res?.ok && res?.error !== 'ya_respondida') throw new Error(res?.error || 'rpc_fail');
                renderThanks(npsSelected);
            } catch (err) {
                console.error(err);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Reintentar';
                alert('No pudimos guardar tu respuesta. ¿Probás de nuevo?');
            }
        });
    } catch (err) {
        console.error('[Encuesta] error:', err);
        renderError('Hubo un error al cargar la encuesta. Por favor, contactá a MEPEX.');
    }
})();
