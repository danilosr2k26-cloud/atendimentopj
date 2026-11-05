/* ============================================================
   BRADESCO NET EMPRESA · FUNÇÕES COMPARTILHADAS
   - Autuação / sessão (login)
   - Toggle de tema claro/escuro
   - Parser de "dados do cliente" para preenchimento automático
   ============================================================ */
(function (global) {
  "use strict";

  /* ---------- Autuação / sessão ---------- */
  var KEY = "login_atendimentopj_session";

  // ⚠️ Altere aqui as credenciais de acesso ao sistema.
  var CRED = { usuario: "admin", senha: "admin123" };

  function estaLogado() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }
  function autenticar(usuario, senha) {
    if (CRED && String(usuario) === String(CRED.usuario) && String(senha) === String(CRED.senha)) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ usuario: usuario, em: new Date().toISOString() }));
        return true;
      } catch (e) { return false; }
    }
    return false;
  }
  function fazerSair() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    global.location.href = "login.html";
  }
  // Chamar no topo de cada tela protegida (antes do body renderizar).
  function garanteLogin() {
    if (!estaLogado()) global.location.href = "login.html";
  }
  function logoutNoNav() {
    var nav = global.document.querySelector(".cc-nav a.sair");
    if (nav) {
      nav.href = "#";
      nav.addEventListener("click", function (e) { e.preventDefault(); if (confirm("Deseja sair do sistema?")) fazerSair(); });
    }
  }

  /* ---------- Toggle de tema ---------- */
  function initTema() {
    var STORE = "login_atendimentopj_theme";
    var btn = global.document.querySelector(".theme-btn");
    function aplicar(tema) {
      try { global.document.documentElement.dataset.theme = tema; localStorage.setItem(STORE, tema); } catch (e) {}
    }
    var atual = (function () {
      try { return localStorage.getItem(STORE); } catch (e) { return null; }
    })();
    if (atual) aplicar(atual);
    else if (global.window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) aplicar("dark");
    if (btn) {
      btn.addEventListener("click", function () {
        var t = global.document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        aplicar(t); btn.textContent = t === "dark" ? "Tema claro" : "Tema escuro";
      });
      btn.textContent = global.document.documentElement.dataset.theme === "dark" ? "Tema claro" : "Tema escuro";
    }
  }

  /* ---------- Parser de dados do cliente ---------- */
  function limparTextos(v) {
    return String(v == null ? "" : v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  }
  function formatarTelef(v) {
    var nums = String(v).replace(/\D/g, "");
    if (nums.length === 10) return "(" + nums.slice(0, 2) + ") " + nums.slice(2, 7) + "-" + nums.slice(7);
    if (nums.length === 11) return "(" + nums.slice(0, 2) + ") " + nums.slice(2, 8) + "-" + nums.slice(8);
    return v ? String(v).trim() : "";
  }
  // Retorna objeto com todos os campos encontrados (os que faltam ficam vazios).
  function parseDadosCliente(texto) {
    var out = {
      nome: "", cnpj: "", usuario: "", ag: "", conta: "", situacao: "",
      segmento: "", capital: "", telefone: "", email: "", cidade: "", uf: "",
      socio: { nome: "", cpf: "", telefone: "", cartoespj: "", status: "" }
    };
    if (!texto) return out;
    var linhas = String(texto).replace(/\r/g, "").split("\n");

    // Nome da empresa: primeira linha de texto entre separadores "===="
    for (var i = 0; i < linhas.length; i++) {
      if (/={2,}/.test(linhas[i])) {
        for (var j = i + 1; j < linhas.length; j++) {
          var n = linhas[j].trim();
          if (n && !/={2,}|\.+\]/.test(n) && /[A-Z0-9]/.test(n)) { out.nome = n; break; }
          if (n && /={2,}/.test(n)) break;
        }
        if (out.nome) break;
      }
    }

    var noSocio = false;
    for (var k = 0; k < linhas.length; k++) {
      var raw = linhas[k].replace(/^[─=\.\[\]]+/, "").trim();
      if (/♚/.test(raw) && /SOCIO/i.test(raw)) { noSocio = true; }
      var m = raw.match(/[➤♚►>»-]\s*([A-Za-zá-ú\-\s\/]+?)\s*[:：]\s*(.*)$/i);
      if (!m) continue;
      var label = limparTextos(m[1]);
      var valor = m[2].trim();
      var entreColchetes = valor.match(/^\[(.*)\]$/);
      var valorLimpo = entreColchetes ? entreColchetes[1] : valor;

      if (label === "CNPJ") out.cnpj = valorLimpo;
      else if (label === "USUARIO") out.usuario = valorLimpo;
      else if (label === "AG/CONTA") {
        var partes = valor.split("/");
        out.ag = (partes[0] || "").trim();
        out.conta = (partes[1] || "").trim();
      }
      else if (label === "SITUACAO") out.situacao = valorLimpo;
      else if (label === "SEGMENTO") out.segmento = valorLimpo;
      else if (label === "CAPITAL") out.capital = valorLimpo;
      else if (label === "EMAIL") out.email = valorLimpo.toUpperCase();
      else if (label === "CIDADE/UF") {
        var cu = valor.split("/");
        out.cidade = (cu[0] || "").trim();
        out.uf = (cu[1] || "").trim();
      }
      else if (label === "TELEFONE" && !noSocio) {
        out.telefone = formatarTelef((valor.split(/\s+/)[0]) || valor);
      }
      else if (label === "NOME" && noSocio) out.socio.nome = valorLimpo;
      else if (label === "CPF" && noSocio) out.socio.cpf = valorLimpo;
      else if (label === "TELEFONE" && noSocio) out.socio.telefone = formatarTelef((valor.split(/\s+/)[0]) || valor);
      else if (label === "CARTOESPJ" || label === "CARTOES") out.socio.cartoespj = limparTextos(valorLimpo);
      else if (label === "STATUS" && noSocio) out.socio.status = valorLimpo;
    }
    return out;
  }
  // Preenche os inputs/selects do formulário a partir dos dados parseados.
  function preencherCampos(dados, mapeamento) {
    // mapeamento: { idDoInput: function(dados){ return valor } }
    var ids = {};
    Object.keys(mapeamento).forEach(function (id) { ids[id] = global.document.getElementById(id); });
    Object.keys(mapeamento).forEach(function (id) {
      var el = ids[id];
      if (!el) return;
      var val = mapeamento[id](dados);
      if (val == null || val === "") return;
      if (el.tagName === "SELECT") {
        // busca case-insensitive
        for (var i = 0; i < el.options.length; i++) {
          if (String(el.options[i].value).toUpperCase() === String(val).toUpperCase()) { el.selectedIndex = i; break; }
        }
      } else {
        el.value = val;
      }
    });
  }

  global.BN = {
    estaLogado: estaLogado, autenticar: autenticar, fazerSair: fazerSair,
    garanteLogin: garanteLogin, logoutNoNav: logoutNoNav, initTema: initTema,
    parseDadosCliente: parseDadosCliente, preencherCampos: preencherCampos
  };
})(window);
