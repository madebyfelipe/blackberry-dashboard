/* Mock persistence is intentionally isolated here until a backend is introduced. */
const STORE_KEY = "blackberry-mvp-v1";
const initialState = {
  user: null,
  clients: [{ id: "c1", name: "Clínica Aurora", projects: 3 }, { id: "c2", name: "Halo Studio", projects: 2 }, { id: "c3", name: "Norte Design", projects: 1 }],
  batches: [
    { id: "b1", clientId: "c1", name: "Lote campanha primavera", date: "18 set 2026", items: [{ id: "i1", title: "Variação Halo Mono", status: "pending", decision: null, reason: "" }, { id: "i2", title: "Carrossel institucional", status: "approved", decision: "Aprovado em 17 set", reason: "" }] },
    { id: "b2", clientId: "c2", name: "Lote manifesto", date: "15 set 2026", items: [{ id: "i3", title: "Filme manifesto", status: "approved", decision: "Aprovado em 16 set", reason: "" }] }
  ]
};
const state = JSON.parse(localStorage.getItem(STORE_KEY) || JSON.stringify(initialState));
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const save = () => localStorage.setItem(STORE_KEY, JSON.stringify(state));
const clientName = id => state.clients.find(client => client.id === id)?.name || "Cliente";
const allItems = () => state.batches.flatMap(batch => batch.items.map(item => ({ ...item, batch, client: clientName(batch.clientId) })));
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
const notify = message => { toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2600); };
const statusLabel = status => ({ pending: "Aguardando", approved: "Aprovado", rejected: "Reprovado" }[status] || status);
const statusPill = status => `<span class="pill ${status}">${statusLabel(status)}</span>`;

function login() {
  app.innerHTML = `<main class="login"><form class="login-card" id="login-form"><div class="brand"><span class="brand-mark"></span>black berry</div><h1 style="font-size:20px;font-weight:600;margin-bottom:8px">Bem-vindo de volta</h1><p class="muted" style="margin-bottom:24px">Acesse sua conta para continuar no black berry</p><div class="field"><label for="email">E-mail</label><input id="email" type="email" placeholder="voce@empresa.com" required></div><div class="field"><label for="password">Senha</label><input id="password" type="password" minlength="4" placeholder="••••••••" required></div><button class="button lime" type="submit">Entrar</button></form></main>`;
  document.querySelector("#login-form").onsubmit = event => { event.preventDefault(); state.user = document.querySelector("#email").value; save(); location.hash = "#/dashboard"; };
}

function layout(content, active = "dashboard") {
  app.innerHTML = `<div class="shell"><aside class="sidebar"><a class="brand" href="#/dashboard"><span class="brand-mark"></span>black berry</a><div class="eyebrow">workspace</div><nav class="nav"><a class="${active === "dashboard" ? "active" : ""}" href="#/dashboard">Visão geral</a><a class="${active === "batches" ? "active" : ""}" href="#/batches">Lotes</a><a class="${active === "clients" ? "active" : ""}" href="#/clients">Clientes</a></nav><div class="user-chip"><span class="avatar">${(state.user || "U")[0].toUpperCase()}</span><div><strong>${escapeHtml((state.user || "user").split("@")[0])}</strong><small>admin</small></div></div></aside><main class="main">${content}</main></div>`;
}

function dashboard() {
  const items = allItems(), pending = items.filter(item => item.status === "pending").length;
  layout(`<header class="topbar"><div><p class="eyebrow">quinta, 18 setembro 2026</p><h1>Olá, ${escapeHtml((state.user || "time").split("@")[0])}.</h1><p class="muted">Tudo que precisa da sua atenção, em um só lugar.</p></div><button class="button lime" data-action="new-batch">+ Novo lote</button></header><section class="stats"><div class="stat"><span class="eyebrow">clientes ativos</span><strong>${state.clients.length}</strong><span class="muted">neste workspace</span></div><div class="stat"><span class="eyebrow">aguardando você</span><strong>${pending}</strong><span>para aprovar</span></div><div class="stat"><span class="eyebrow">lotes no mês</span><strong>${state.batches.length}</strong><span>conteúdo organizado</span></div><div class="stat"><span class="eyebrow">aprovação média</span><strong>1,8<span style="font-size:18px">d</span></strong><span>últimos 30 dias</span></div></section><div class="grid-2"><section class="card"><div class="section-head"><h2>Precisa de aprovação</h2><a class="muted mono" href="#/batches">ver todos →</a></div>${items.filter(item => item.status === "pending").slice(0, 4).map(item => `<div class="list-item"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.client)} · ${escapeHtml(item.batch.name)}</p></div><a class="button small secondary" href="#/approve/${item.id}">Abrir</a></div>`).join("") || '<div class="empty">Tudo em dia por aqui.</div>'}</section><section class="card"><div class="section-head"><h2>Clientes</h2><a class="muted mono" href="#/clients">gerenciar →</a></div><div class="list">${state.clients.map(client => `<div class="list-item"><div><strong>${escapeHtml(client.name)}</strong><p>${client.projects} lotes ativos</p></div><span class="avatar">${client.name[0]}</span></div>`).join("")}</div></section></div>`);
  bindCommon();
}

function batches() {
  layout(`<header class="topbar"><div><p class="eyebrow">workspace / conteúdo</p><h1>Lotes.</h1><p class="muted">Organize, envie e acompanhe as aprovações.</p></div><button class="button lime" data-action="new-batch">+ Novo lote</button></header><section class="card"><table class="table"><thead><tr><th>Lote</th><th>Cliente</th><th>Data</th><th>Status</th><th></th></tr></thead><tbody>${state.batches.map(batch => { const pending = batch.items.filter(item => item.status === "pending").length; return `<tr><td><strong>${escapeHtml(batch.name)}</strong><br><small class="muted">${batch.items.length} conteúdos</small></td><td>${escapeHtml(clientName(batch.clientId))}</td><td class="muted">${batch.date}</td><td>${pending ? statusPill("pending") : statusPill("approved")}</td><td><button class="button small secondary" data-copy="${batch.items[0]?.id || ""}">Link público</button></td></tr>`; }).join("")}</tbody></table></section>`);
  bindCommon();
  document.querySelectorAll("[data-copy]").forEach(button => button.onclick = () => { const link = `${location.origin}${location.pathname}#/approve/${button.dataset.copy}`; navigator.clipboard?.writeText(link); notify("Link público copiado."); });
}

function clients() {
  layout(`<header class="topbar"><div><p class="eyebrow">workspace / relacionamento</p><h1>Clientes.</h1><p class="muted">As pessoas para quem você cria.</p></div><button class="button lime" data-action="new-client">+ Novo cliente</button></header><section class="stats">${state.clients.map(client => `<div class="stat"><span class="eyebrow">cliente</span><strong style="font-size:25px">${escapeHtml(client.name)}</strong><span>${client.projects} lotes ativos</span></div>`).join("")}</section>`);
  bindCommon();
}

function publicApproval(id) {
  const item = allItems().find(candidate => candidate.id === id);
  if (!item) return renderNotFound();
  const decided = item.status !== "pending";
  app.innerHTML = `<main class="public"><div class="public-wrap"><header class="public-header"><a class="brand" href="#/dashboard"><span class="brand-mark"></span>black berry</a><span class="eyebrow">aprovação pública</span></header><article class="public-card"><p class="eyebrow">${escapeHtml(item.client)} / ${escapeHtml(item.batch.name)}</p><h1>${escapeHtml(item.title)}</h1><p class="muted">Revise o conteúdo abaixo e registre sua decisão. Este link é exclusivo para você.</p><div class="preview"><span>halo<br>mono</span></div><div class="eyebrow">progresso do lote</div><div class="progress"><span style="width:${Math.round(item.batch.items.filter(content => content.status !== "pending").length / item.batch.items.length * 100)}%"></span></div><small class="muted">${item.batch.items.filter(content => content.status !== "pending").length} de ${item.batch.items.length} conteúdos decididos</small>${decided ? `<div class="card" style="margin-top:25px;background:${item.status === "approved" ? "var(--green)" : "var(--danger)"}"><strong>${item.status === "approved" ? "Conteúdo aprovado." : "Conteúdo reprovado."}</strong><p style="margin:8px 0 0">${escapeHtml(item.decision || item.reason)}</p></div>` : `<div class="decision"><button class="button lime" data-approve="${id}">Aprovar conteúdo</button><button class="button danger" data-reject="${id}">Reprovar conteúdo</button></div>`}</article></div></main>`;
  document.querySelector("[data-approve]")?.addEventListener("click", () => decide(id, "approved"));
  document.querySelector("[data-reject]")?.addEventListener("click", () => rejectModal(id));
}

function decide(id, status, reason = "") {
  const item = allItems().find(candidate => candidate.id === id);
  if (!item) return;
  item.status = status; item.reason = reason; item.decision = status === "approved" ? `Aprovado em ${new Date().toLocaleDateString("pt-BR")}` : reason; save(); publicApproval(id); notify(status === "approved" ? "Aprovação registrada." : "Reprovação registrada.");
}
function rejectModal(id) {
  const modal = document.createElement("div"); modal.className = "modal-backdrop"; modal.innerHTML = `<form class="modal" id="reject-form"><div class="modal-head"><div><p class="eyebrow">feedback</p><h2>O que precisa mudar?</h2></div><button type="button" class="close" data-close>×</button></div><div class="field"><label for="reason">Motivo da reprovação <span class="muted">(obrigatório)</span></label><textarea id="reason" required placeholder="Descreva os ajustes necessários..."></textarea></div><div class="actions"><button type="button" class="button secondary" data-close>Cancelar</button><button class="button danger">Enviar reprovação</button></div></form>`; app.append(modal); modal.querySelectorAll("[data-close]").forEach(button => button.onclick = () => modal.remove()); modal.querySelector("form").onsubmit = event => { event.preventDefault(); decide(id, "rejected", modal.querySelector("#reason").value.trim()); modal.remove(); };
}
function newBatchModal() {
  const modal = document.createElement("div"); modal.className = "modal-backdrop"; modal.innerHTML = `<form class="modal" id="batch-form"><div class="modal-head"><div><p class="eyebrow">conteúdo</p><h2>Criar novo lote</h2></div><button type="button" class="close" data-close>×</button></div><div class="field"><label>Nome do lote</label><input name="name" required placeholder="Ex.: Campanha de outubro"></div><div class="field"><label>Cliente</label><select name="client">${state.clients.map(client => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join("")}</select></div><div class="field"><label>Conteúdo inicial</label><input name="item" required placeholder="Ex.: Post feed 01"></div><div class="actions"><button type="button" class="button secondary" data-close>Cancelar</button><button class="button lime">Criar lote</button></div></form>`; app.append(modal); modal.querySelectorAll("[data-close]").forEach(button => button.onclick = () => modal.remove()); modal.querySelector("form").onsubmit = event => { event.preventDefault(); const data = new FormData(event.target); state.batches.unshift({ id: `b${Date.now()}`, clientId: data.get("client"), name: data.get("name"), date: "18 set 2026", items: [{ id: `i${Date.now()}`, title: data.get("item"), status: "pending", decision: null, reason: "" }] }); save(); modal.remove(); location.hash = "#/batches"; notify("Lote criado com sucesso."); };
}
function bindCommon() { document.querySelector("[data-action='new-batch']")?.addEventListener("click", newBatchModal); document.querySelector("[data-action='new-client']")?.addEventListener("click", () => notify("Cadastro de cliente estará disponível em breve.")); }
function renderNotFound() { app.innerHTML = `<main class="login"><div class="login-card"><div class="brand"><span class="brand-mark"></span>blackberry</div><h1>Link não encontrado.</h1><a class="button" href="#/dashboard">Voltar ao início</a></div></main>`; }
function router() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  if (!state.user && parts[0] !== "approve") return login();
  if (parts[0] === "approve") return publicApproval(parts[1]);
  if (parts[0] === "batches") return batches();
  if (parts[0] === "clients") return clients();
  return dashboard();
}
window.addEventListener("hashchange", router);
router();
