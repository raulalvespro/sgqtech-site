/* ════════════════════════════════════════════════════════════════════
   SGQ Tech — app.js (módulo)
   Captura de leads (formulário de demonstração + calculadora de risco)
   → grava na tabela `leads` do Supabase via publishable/anon key.

   ⚠️ REGRA CRÍTICA: o role anon SÓ pode INSERIR (sem SELECT).
   Por isso o insert é SEM .select() — supabase-js então usa
   "Prefer: return=minimal" e o RLS de insert-only não quebra.
   NUNCA adicionar .select() aqui.
   ════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://sjfxtxwcirzppxgjiuya.supabase.co';
// Publishable key — pode ficar exposta no front (padrão Supabase; a tabela
// `leads` está travada para o anon SÓ inserir). Mapeia para o role `anon`.
const SUPABASE_KEY = 'sb_publishable_s0u6AvxLC5HOndmgXF93hA_kkqqLWzy';

const WHATSAPP_URL = 'https://wa.me/5584988504395?text=Ol%C3%A1%2C%20quero%20saber%20mais%20sobre%20o%20SGQ%20Tech';

/* ── Cliente Supabase (carregado sob demanda, com cache) ───────────── */
let _client = null;
async function getClient() {
  if (_client) return _client;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  _client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/* ── Ponto de extensão futuro (Resend) ─────────────────────────────────
   Quando houver chave do Resend, plugar aqui o envio do aviso de novo lead
   para comercial@sgqtech.com.br (ex.: via Edge Function `send-email`).
   Hoje é um no-op: o lead já fica garantido no banco. NÃO bloqueia o fluxo. */
function notifyNewLead(lead) {
  try {
    // TODO(Resend): chamar Edge Function de notificação aqui.
    // Ex.: fetch(`${SUPABASE_URL}/functions/v1/send-email`, { ... })
    //   to: 'comercial@sgqtech.com.br', subject: `Novo lead: ${lead.name}`
    if (window && window.console) {
      console.info('[SGQ Tech] novo lead capturado (origem: %s)', lead.source);
    }
  } catch (_) { /* nunca deixar a notificação quebrar o fluxo do lead */ }
}

/* ── Insert do lead (SEM .select()) ────────────────────────────────── */
async function submitLead(payload) {
  const client = await getClient();
  // ⚠️ sem .select() — apenas insert. Checamos só o `error`.
  const { error } = await client.from('leads').insert(payload);
  if (error) throw error;
  notifyNewLead(payload);
  return true;
}

/* limpa campos vazios para não gravar strings em branco onde pode ser null */
function clean(obj) {
  const out = {};
  for (const k in obj) {
    const v = obj[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = typeof v === 'string' ? v.trim() : v;
  }
  return out;
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* ── Toast ─────────────────────────────────────────────────────────── */
const ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
};
function toast(type, title, msg) {
  const wrap = document.getElementById('toastContainer');
  if (!wrap) { alert(title + (msg ? '\n' + msg : '')); return; }
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `${ICONS[type] || ''}<div><div class="toast__title">${title}</div>${msg ? `<div class="toast__msg">${msg}</div>` : ''}</div>`;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  const kill = () => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 350);
  };
  setTimeout(kill, type === 'error' ? 7000 : 5500);
  el.addEventListener('click', kill);
}

function setLoading(btn, loading, labelWhenLoading) {
  if (!btn) return;
  if (loading) {
    btn.dataset._label = btn.textContent;
    btn.disabled = true;
    btn.style.opacity = '0.75';
    btn.textContent = labelWhenLoading || 'Enviando…';
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    if (btn.dataset._label) btn.textContent = btn.dataset._label;
  }
}

/* ════════════════════════ FORM DE DEMONSTRAÇÃO ════════════════════════ */
function initDemoForm() {
  const form = document.getElementById('demoForm');
  if (!form) return;
  const btn = document.getElementById('demoSubmit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    if (!data.name || !data.name.trim()) {
      toast('error', 'Informe seu nome', 'Precisamos saber com quem falar.');
      form.querySelector('#df-name')?.focus();
      return;
    }
    if (!isEmail(data.email || '')) {
      toast('error', 'E-mail inválido', 'Confira o endereço de e-mail.');
      form.querySelector('#df-email')?.focus();
      return;
    }

    const payload = clean({
      name: data.name,
      email: data.email,
      company: data.company,
      phone: data.phone,
      plan_interest: data.plan_interest,
      message: data.message,
      source: 'site_demo_form',
      // status omitido → usa o default 'new' do banco
    });

    setLoading(btn, true);
    try {
      await submitLead(payload);
      form.reset();
      toast('success', 'Recebemos seu pedido!', 'Nossa equipe entra em contato no mesmo dia útil.');
    } catch (err) {
      console.error('[SGQ Tech] erro ao gravar lead (demo):', err);
      toast('error', 'Não foi possível enviar', 'Tente novamente ou fale direto no WhatsApp (84) 98850-4395.');
    } finally {
      setLoading(btn, false);
    }
  });
}

/* ════════════════════════ CALCULADORA DE RISCO ════════════════════════ */
function initCalculator() {
  const calc = document.getElementById('calc');
  if (!calc) return;

  const qSteps = Array.from(calc.querySelectorAll('.calc__step'))
    .filter((s) => /^\d+$/.test(s.dataset.step))
    .sort((a, b) => a.dataset.step - b.dataset.step);
  const captureStep = calc.querySelector('[data-step="capture"]');
  const resultStep = calc.querySelector('[data-step="result"]');
  const bar = document.getElementById('calcBar');
  const TOTAL = qSteps.length; // 7
  const answers = new Array(TOTAL).fill(null);
  let current = 0;

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'calc__back';
  back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg> Voltar';
  back.style.marginBottom = '16px';
  back.hidden = true;
  calc.querySelector('.calc__inner').prepend(back);

  function hideAll() {
    qSteps.forEach((s) => (s.hidden = true));
    if (captureStep) captureStep.hidden = true;
    if (resultStep) resultStep.hidden = true;
  }
  function setBar(pct) { if (bar) bar.style.width = pct + '%'; }

  function showQ(i) {
    hideAll();
    current = i;
    qSteps[i].hidden = false;
    back.hidden = i === 0;
    setBar(Math.round((i / (TOTAL + 1)) * 100));
  }
  function showCapture() {
    hideAll();
    current = TOTAL;
    if (captureStep) captureStep.hidden = false;
    back.hidden = false;
    setBar(Math.round((TOTAL / (TOTAL + 1)) * 100));
  }

  back.addEventListener('click', () => {
    if (current === TOTAL) showQ(TOTAL - 1);
    else if (current > 0) showQ(current - 1);
  });

  qSteps.forEach((step, idx) => {
    step.querySelectorAll('.calc__yn').forEach((btn) => {
      btn.addEventListener('click', () => {
        answers[idx] = Number(btn.dataset.yes);
        if (idx + 1 < TOTAL) showQ(idx + 1);
        else showCapture();
      });
    });
  });

  function score() { return answers.reduce((a, v) => a + (v ? 1 : 0), 0); }
  function band(s) {
    if (s <= 2) return { label: 'Sob controle', color: 'var(--teal-deep)', verdict: 'Sua gestão de qualidade está bem encaminhada. A SGQ Tech ajuda a manter esse nível e a crescer sem sustos.' };
    if (s <= 4) return { label: 'Risco moderado', color: '#0F8A7E', verdict: 'Já há pontos frágeis que viram problema na hora errada. Dá para blindar a operação rápido.' };
    return { label: 'Risco alto', color: '#D85A37', verdict: 'Sua operação depende de papel e memória em pontos críticos. Uma fiscalização ou um recall exporiam isso. Vale agir agora.' };
  }

  function reveal() {
    hideAll();
    current = TOTAL + 1;
    resultStep.hidden = false;
    back.hidden = true;
    setBar(100);
    const s = score();
    const b = band(s);
    const numEl = document.getElementById('calcScore');
    document.getElementById('calcBand').textContent = b.label;
    document.getElementById('calcBand').style.color = b.color;
    document.getElementById('calcVerdict').textContent = b.verdict;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || s === 0) { numEl.textContent = String(s); return; }
    let n = 0;
    numEl.textContent = '0';
    const stepUp = () => { n++; numEl.textContent = String(n); if (n < s) setTimeout(stepUp, 170); };
    setTimeout(stepUp, 200);
  }

  // captura ANTES do resultado: grava o lead e só então revela
  const cForm = document.getElementById('calcForm');
  const cBtn = document.getElementById('calcSubmit');
  if (cForm) {
    cForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(cForm).entries());
      if (!data.name || !data.name.trim()) {
        toast('error', 'Informe seu nome', 'Precisamos saber com quem falar.');
        cForm.querySelector('#cf-name')?.focus();
        return;
      }
      if (!isEmail(data.email || '')) {
        toast('error', 'E-mail inválido', 'Confira o endereço de e-mail.');
        cForm.querySelector('#cf-email')?.focus();
        return;
      }
      const s = score();
      const b = band(s);
      const riskAnswers = {};
      answers.forEach((v, i) => { riskAnswers['p' + (i + 1)] = v ? 'sim' : 'nao'; });
      riskAnswers._score = s;
      riskAnswers._band = b.label;

      const payload = clean({
        name: data.name,
        email: data.email,
        company: data.company,
        source: 'site_calculadora',
        risk_score: s,
        risk_answers: riskAnswers,
        message: `Calculadora de risco: ${s}/7 sinais (${b.label}).`,
      });

      setLoading(cBtn, true);
      try {
        await submitLead(payload);
        reveal();
        toast('success', 'Diagnóstico pronto!', 'Enviamos uma cópia e nossa equipe vai falar com você.');
      } catch (err) {
        console.error('[SGQ Tech] erro ao gravar lead (calculadora):', err);
        toast('error', 'Não foi possível enviar', 'Tente novamente ou fale no WhatsApp (84) 98850-4395.');
      } finally {
        setLoading(cBtn, false);
      }
    });
  }

  setBar(0);
}

/* ── Boot ──────────────────────────────────────────────────────────── */
function boot() {
  initDemoForm();
  initCalculator();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
