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

  const steps = Array.from(calc.querySelectorAll('.calc__step'));
  const questionSteps = steps.filter((s) => s.dataset.step !== 'result');
  const resultStep = calc.querySelector('[data-step="result"]');
  const bar = document.getElementById('calcBar');
  const total = questionSteps.length;
  const answers = {};
  let current = 0;

  // botão "voltar" injetado (some na 1ª pergunta e no resultado)
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'calc__back';
  back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg> Voltar';
  back.style.marginBottom = '16px';
  back.hidden = true;
  calc.querySelector('.calc__inner').prepend(back);
  back.addEventListener('click', () => { if (current > 0) show(current - 1); });

  function updateBar() {
    const pct = Math.round((current / total) * 100);
    if (bar) bar.style.width = pct + '%';
  }
  function show(i) {
    steps.forEach((s) => (s.hidden = true));
    current = i;
    if (i < total) {
      questionSteps[i].hidden = false;
      back.hidden = i === 0;
      updateBar();
    }
  }

  // clique em opção → grava resposta e avança
  calc.querySelectorAll('.calc__opt').forEach((opt) => {
    opt.addEventListener('click', () => {
      answers[opt.dataset.q] = { value: opt.dataset.val, score: Number(opt.dataset.score) };
      if (current + 1 < total) {
        show(current + 1);
      } else {
        finish();
      }
    });
  });

  function computeScore() {
    const keys = Object.keys(answers);
    if (!keys.length) return 0;
    const sum = keys.reduce((a, k) => a + (answers[k].score || 0), 0);
    return Math.round(sum / keys.length);
  }

  function band(score) {
    if (score <= 25) return { label: 'Sob controle', color: 'var(--teal-deep)', verdict: 'Sua gestão de qualidade já está madura. A SGQ Tech ajuda a manter esse nível com menos esforço e a escalar com segurança.' };
    if (score <= 50) return { label: 'Atenção', color: '#0F8A7E', verdict: 'Há pontos frágeis que costumam virar problema na hora errada. Dá para blindar a operação rapidamente.' };
    if (score <= 75) return { label: 'Risco alto', color: '#E8845C', verdict: 'Sua operação ainda depende de papel e memória em pontos críticos. Uma fiscalização ou um recall exporiam isso.' };
    return { label: 'Risco crítico', color: '#D85A37', verdict: 'A qualidade está exposta. O custo de uma autuação ou recall é muito maior que o de organizar tudo isso agora.' };
  }

  function finish() {
    if (bar) bar.style.width = '100%';
    back.hidden = true;
    steps.forEach((s) => (s.hidden = true));
    resultStep.hidden = false;
    current = total;

    const score = computeScore();
    const b = band(score);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const numEl = document.getElementById('calcScore');
    const bandEl = document.getElementById('calcBand');
    const verdictEl = document.getElementById('calcVerdict');
    const arc = document.getElementById('gaugeArc');

    bandEl.textContent = b.label;
    bandEl.style.color = b.color;
    verdictEl.textContent = b.verdict;
    if (arc) arc.style.stroke = b.color;

    const ARC_LEN = 283;
    const targetOffset = ARC_LEN - (ARC_LEN * score) / 100;

    if (reduced) {
      numEl.textContent = score;
      if (arc) arc.style.strokeDashoffset = targetOffset;
    } else {
      // contador + preenchimento do medidor
      const dur = 900;
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        numEl.textContent = Math.round(score * eased);
        if (arc) arc.style.strokeDashoffset = ARC_LEN - ((ARC_LEN * score) / 100) * eased;
        if (p < 1) requestAnimationFrame(tick);
        else numEl.textContent = score;
      };
      requestAnimationFrame(tick);
    }

    // expõe os dados pro submit
    resultStep.dataset.score = score;
    resultStep.dataset.band = b.label;
  }

  // form de captura no resultado
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

      const score = Number(resultStep.dataset.score || computeScore());
      // risk_answers (jsonb): respostas + score + faixa
      const riskAnswers = {};
      for (const k in answers) riskAnswers[k] = answers[k].value;
      riskAnswers._score = score;
      riskAnswers._band = resultStep.dataset.band || band(score).label;

      const payload = clean({
        name: data.name,
        email: data.email,
        company: data.company,
        source: 'site_calculadora',
        risk_score: score,
        risk_answers: riskAnswers,
        message: `Calculadora de risco: ${score}/100 (${riskAnswers._band}).`,
        // status omitido → default 'new'
      });

      setLoading(cBtn, true);
      try {
        await submitLead(payload);
        cForm.innerHTML = '<div style="text-align:center;padding:8px 0"><div style="font-weight:700;font-size:1.1rem;color:var(--ink);margin-bottom:6px">Pronto! Diagnóstico a caminho.</div><p style="color:var(--muted)">Nossa equipe vai te enviar o diagnóstico completo e como reduzir esse risco. Quer adiantar? <a href="' + WHATSAPP_URL + '" target="_blank" rel="noopener" style="color:var(--teal-deep);font-weight:600;text-decoration:underline">Fale no WhatsApp</a>.</p></div>';
        toast('success', 'Diagnóstico solicitado!', 'Vamos te enviar o resultado completo em breve.');
      } catch (err) {
        console.error('[SGQ Tech] erro ao gravar lead (calculadora):', err);
        toast('error', 'Não foi possível enviar', 'Tente novamente ou fale no WhatsApp (84) 98850-4395.');
      } finally {
        setLoading(cBtn, false);
      }
    });
  }

  updateBar();
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
