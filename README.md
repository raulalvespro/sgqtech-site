# sgqtech-site

Landing page de marketing da **SGQ Tech** — software de gestão da qualidade para a indústria de alimentos.
Domínio: **sgqtech.com.br** · Deploy: **Cloudflare Pages** (serve a raiz como estático, **sem build**).

> Não confundir com `sgqtech-system` (o produto: `system.` e `central.`). Este repo é só o site institucional.

## Stack
HTML estático + CSS + JS vanilla. **Sem build, sem framework, sem npm** para subir.
Escolha por HTML estático (em vez de Vite/React) para: SEO/SSG de graça (texto já no HTML servido),
melhor Core Web Vitals e zero mudança na config da Cloudflare.

## Estrutura
```
index.html              ← a landing (home)
em-breve/index.html     ← página "em breve" PRESERVADA (ver abaixo)
assets/
  css/styles.css        ← design system + estilos (tokens da marca)
  js/app.js             ← captura de leads (Supabase) + calculadora de risco
  js/anim.js            ← animações (reveals, nav, FAQ, contadores, GSAP/anime)
  fonts/                ← Geist + Geist Mono (woff2, self-hosted)
  img/og-cover.svg      ← imagem de compartilhamento (Open Graph)
favicon.svg
robots.txt · sitemap.xml
_redirects · _headers   ← config da Cloudflare Pages
```

## ⚠️ Página de espera ("em breve")
- **Era** o `index.html` da raiz. Foi **movida para `em-breve/index.html`** (intacta).
- Fica sempre acessível em **`/em-breve`** (útil para pré-visualizar).
- **Como reativá-la em segundos:** no arquivo **`_redirects`**, descomente a linha
  `/    /em-breve    302` (remova o `# ` do início) e faça deploy. A home volta a mostrar a espera.
  Para voltar à landing, comente a linha de novo e faça deploy.

## Captura de leads (Supabase)
- Grava na tabela **`leads`** do projeto `sjfxtxwcirzppxgjiuya` via **publishable key** (exposta no front — a tabela só permite INSERT pelo `anon`).
- Configurado em `assets/js/app.js` (constantes no topo).
- ⚠️ O insert é **sem `.select()`** de propósito (o `anon` não tem SELECT). **Não adicione `.select()`** ou o form quebra.
- `source`: **`site_demo_form`** (formulário de demonstração) · **`site_calculadora`** (calculadora de risco).
- A calculadora grava também `risk_score` (0–100) e `risk_answers` (jsonb com as respostas).
- **`status`:** NÃO é enviado pelo front → usa o **default `'new'`** do banco. (O prompt pedia `'novo'`, mas o
  default real é `'new'`; mandar `'novo'` poderia quebrar filtros do admin. Se quiser `'novo'`, é 1 linha em `app.js`.)

## E-mail de aviso (futuro — Resend)
- Hoje o lead só fica garantido no banco.
- Há um gancho pronto: a função **`notifyNewLead(lead)`** em `app.js` (hoje é no-op com `TODO`).
  Quando houver chave do Resend, plugar ali o envio para **comercial@sgqtech.com.br** (ex.: Edge Function `send-email`).

## Imagens (trocar depois)
- **Placeholders elegantes** estão no lugar (não quebram layout). Troque por arquivos reais em `assets/img/`:
  - Categoria A (prints do sistema): painel, PDF de laudo, rastreabilidade, checklist no tablet, indicadores.
  - Categoria B (atmosfera): indústria, mesa de papel, auditor, retratos das personas.
- Mantenha `width/height`/`aspect-ratio` para não causar layout shift, e `alt` descritivo (SEO).
- **OG:** `assets/img/og-cover.svg`. Alguns leitores de link não renderizam SVG — recomendo exportar um
  **PNG 1200×630** e apontar as meta tags `og:image`/`twitter:image` para ele.

## Prova social (ativar quando houver clientes)
- Há uma seção **oculta** `#prova-social` no `index.html` (atributo `hidden`), com slots de logos, número de
  clientes e depoimentos. **Pré-lançamento: não há dados reais.** Quando tiver, remova o `hidden` e preencha com
  dados verdadeiros (não inventar).

## Rodar local
Qualquer servidor estático servindo a raiz. Ex.:
```
npx http-server . -p 8080 -c-1
```
Abra http://localhost:8080 . (Tem que ser via HTTP, não `file://`, por causa dos caminhos absolutos `/assets/...`.)

## Deploy (Cloudflare Pages)
- Build command: **(vazio)** · Output directory: **`/`** (raiz). Continua igual ao da página de espera.
- `_redirects` e `_headers` são lidos automaticamente pela Cloudflare Pages.

## SEO
- `<title>` keyword-first, meta description, Open Graph + Twitter cards, canonical.
- JSON-LD: Organization + SoftwareApplication + FAQPage (no `<head>`).
- `robots.txt` (libera tudo, bloqueia `/em-breve`) + `sitemap.xml`.
- Posicionamento: "software de gestão da qualidade para indústria de alimentos" (sal é só um caso de uso; **não** estreitar para salinas/RN).
