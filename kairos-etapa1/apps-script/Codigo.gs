/**
 * KAIRÓS — motor do app do GC (Etapa 1)
 * Fica dentro da planilha "Kairós — dados". Não precisa editar nada aqui.
 *
 * Abas criadas pela função configurar():
 *  Membros   — quem está no GC (status: pendente / ativo / recusado; funcao: membro / lider)
 *  Config    — nome do GC, local, bairro, dia da semana (0=dom … 3=qua) e hora
 *  Presencas — quem vai ou não vai em cada encontro
 *  Papeis    — quem faz o quê em cada encontro (definido pelo líder)
 *  Lanche    — o que cada um vai levar
 *  Palavra   — lista de versículos (referência + texto), um por dia, em rodízio
 */

var TZ = 'America/Sao_Paulo';

var ABAS = {
  Membros: ['id', 'nome', 'whatsapp', 'aniversario', 'casado', 'conjuge_id', 'pin_salt', 'pin_hash', 'status', 'funcao', 'criado_em'],
  Config: ['chave', 'valor'],
  Presencas: ['data', 'membro_id', 'resposta', 'atualizado_em'],
  Papeis: ['data', 'papel', 'membro_id'],
  Lanche: ['data', 'membro_id', 'comida', 'bebida', 'atualizado_em'],
  Palavra: ['referencia', 'texto']
};

var PAPEIS = ['Quebra-gelo', 'Louvor', 'Oração', 'Palavra'];

var CONFIG_PADRAO = {
  nome_gc: 'Kairós',
  local: 'Casa da Laíse Maciel',
  bairro: 'Vila Redenção',
  dia_semana: '3',
  hora: '20:00'
};

/* ---------- 1. Rode esta função uma vez ---------- */
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ABAS).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    sh.getRange('A:Z').setNumberFormat('@'); // tudo como texto: datas e "18/11" não viram outra coisa
    if (sh.getLastRow() === 0) {
      sh.appendRow(ABAS[nome]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, ABAS[nome].length).setFontWeight('bold');
    }
  });
  var cfg = lerConfig_();
  Object.keys(CONFIG_PADRAO).forEach(function (k) {
    if (!(k in cfg)) ss.getSheetByName('Config').appendRow([k, CONFIG_PADRAO[k]]);
  });
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SEGREDO')) props.setProperty('SEGREDO', Utilities.getUuid() + Utilities.getUuid());
  ['Planilha1', 'Página1', 'Sheet1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
  return 'Pronto! Agora faça a implantação como App da Web.';
}

/* ---------- Entrada das chamadas do app ---------- */
function doGet(e) { return responder_((e && e.parameter) || {}); }

function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (x) { p = {}; }
  return responder_(p);
}

function responder_(p) {
  var out;
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var rota = ROTAS[p.acao];
    if (!rota) throw new Error('Ação desconhecida.');
    out = { ok: true, dados: rota(p) };
  } catch (err) {
    out = { ok: false, erro: err.message || String(err) };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

var ROTAS = {
  ping: function () { return { gc: lerConfig_().nome_gc || 'Kairós' }; },
  nomes: rotaNomes_,
  cadastrar: rotaCadastrar_,
  entrar: rotaEntrar_,
  painel: rotaPainel_,
  presenca: rotaPresenca_,
  lanche: rotaLanche_,
  aprovar: rotaAprovar_,
  papel: rotaPapel_
};

/* ---------- Rotas ---------- */
function rotaNomes_() {
  return ativos_().map(function (m) { return { id: m.id, nome: m.nome, casado: m.casado, conjuge_id: m.conjuge_id }; })
    .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
}

function rotaCadastrar_(p) {
  var nome = limpar_(p.nome, 60);
  var whatsapp = limpar_(p.whatsapp, 25);
  var aniversario = limpar_(p.aniversario, 5);
  var pin = String(p.pin || '');
  if (nome.length < 3) throw new Error('Escreva seu nome e sobrenome.');
  if (!/^\d{4}$/.test(pin)) throw new Error('O código precisa ter 4 números.');
  if (aniversario && !/^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])$/.test(aniversario)) throw new Error('Aniversário no formato DD/MM, ex.: 26/12.');
  var membros = linhas_('Membros');
  var existe = membros.some(function (m) { return m.status !== 'recusado' && normal_(m.nome) === normal_(nome); });
  if (existe) throw new Error('Já existe alguém com esse nome. Use "Entrar".');

  var primeiro = membros.filter(function (m) { return m.status !== 'recusado'; }).length === 0;
  var id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  var salt = Utilities.getUuid();
  var casado = p.casado === 'sim' ? 'sim' : 'nao';
  var conjuge = casado === 'sim' ? String(p.conjugeId || '') : '';
  var registro = {
    id: id, nome: nome, whatsapp: whatsapp, aniversario: aniversario, casado: casado, conjuge_id: conjuge,
    pin_salt: salt, pin_hash: hash_(salt, pin),
    status: primeiro ? 'ativo' : 'pendente',
    funcao: primeiro ? 'lider' : 'membro',
    criado_em: agora_()
  };
  aba_('Membros').appendRow(ABAS.Membros.map(function (c) { return registro[c]; }));
  if (conjuge) {
    var c = linhas_('Membros').filter(function (m) { return m.id === conjuge; })[0];
    if (c && !c.conjuge_id) atualizar_('Membros', c, { conjuge_id: id, casado: 'sim' });
  }
  return primeiro ? { status: 'ativo', token: token_(id) } : { status: 'pendente' };
}

function rotaEntrar_(p) {
  var m = linhas_('Membros').filter(function (x) { return x.id === String(p.id || ''); })[0];
  if (!m || m.status === 'recusado') throw new Error('Perfil não encontrado.');
  if (hash_(m.pin_salt, String(p.pin || '')) !== m.pin_hash) throw new Error('Código errado. Tente de novo.');
  if (m.status !== 'ativo') throw new Error('Seu perfil está esperando a aprovação do líder.');
  return { token: token_(m.id) };
}

function rotaPainel_(p) {
  var eu = quem_(p.token);
  var cfg = lerConfig_();
  var data = proximoEncontro_(cfg);
  var ativos = ativos_();
  var porId = {};
  ativos.forEach(function (m) { porId[m.id] = m; });

  var pres = linhas_('Presencas').filter(function (x) { return x.data === data; });
  var resp = {};
  pres.forEach(function (x) { resp[x.membro_id] = x.resposta; });
  var lista = ativos.map(function (m) {
    return { id: m.id, nome: m.nome, iniciais: iniciais_(m.nome), resposta: resp[m.id] || '' };
  }).sort(function (a, b) {
    var ordem = { sim: 0, '': 1, nao: 2 };
    return (ordem[a.resposta] - ordem[b.resposta]) || a.nome.localeCompare(b.nome, 'pt-BR');
  });

  var pap = linhas_('Papeis').filter(function (x) { return x.data === data; });
  var papeis = PAPEIS.map(function (nomePapel) {
    var r = pap.filter(function (x) { return x.papel === nomePapel; })[0];
    var m = r && porId[r.membro_id];
    return { papel: nomePapel, membro_id: m ? m.id : '', nome: m ? m.nome : '', meu: !!(m && m.id === eu.id) };
  });

  var lanche = linhas_('Lanche').filter(function (x) { return x.data === data && porId[x.membro_id] && (x.comida || x.bebida); })
    .map(function (x) { return { membro_id: x.membro_id, nome: porId[x.membro_id].nome, comida: x.comida, bebida: x.bebida }; });
  var meuLanche = lanche.filter(function (x) { return x.membro_id === eu.id; })[0] || null;

  var dados = {
    eu: { id: eu.id, nome: eu.nome, funcao: eu.funcao },
    gc: { nome: cfg.nome_gc, local: cfg.local, bairro: cfg.bairro, hora: cfg.hora, dia_semana: cfg.dia_semana },
    encontro: { data: data },
    palavra: palavraDoDia_(),
    presenca: { minha: resp[eu.id] || '', lista: lista, total: ativos.length },
    papeis: papeis,
    lanche: lanche,
    meuLanche: meuLanche
  };
  if (eu.funcao === 'lider') {
    dados.lider = {
      pendentes: linhas_('Membros').filter(function (m) { return m.status === 'pendente'; })
        .map(function (m) { return { id: m.id, nome: m.nome, whatsapp: m.whatsapp, aniversario: m.aniversario, criado_em: m.criado_em }; }),
      membros: ativos.map(function (m) { return { id: m.id, nome: m.nome }; })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); })
    };
  }
  return dados;
}

function rotaPresenca_(p) {
  var eu = quem_(p.token);
  var resposta = p.resposta === 'sim' ? 'sim' : (p.resposta === 'nao' ? 'nao' : '');
  var data = proximoEncontro_(lerConfig_());
  upsert_('Presencas', function (x) { return x.data === data && x.membro_id === eu.id; },
    { data: data, membro_id: eu.id, resposta: resposta, atualizado_em: agora_() });
  return rotaPainel_(p);
}

function rotaLanche_(p) {
  var eu = quem_(p.token);
  var data = proximoEncontro_(lerConfig_());
  upsert_('Lanche', function (x) { return x.data === data && x.membro_id === eu.id; },
    { data: data, membro_id: eu.id, comida: limpar_(p.comida, 60), bebida: limpar_(p.bebida, 60), atualizado_em: agora_() });
  return rotaPainel_(p);
}

function rotaAprovar_(p) {
  var eu = quem_(p.token);
  if (eu.funcao !== 'lider') throw new Error('Só o líder pode aprovar.');
  var m = linhas_('Membros').filter(function (x) { return x.id === String(p.id || ''); })[0];
  if (!m) throw new Error('Perfil não encontrado.');
  atualizar_('Membros', m, { status: p.aprovar ? 'ativo' : 'recusado' });
  return rotaPainel_(p);
}

function rotaPapel_(p) {
  var eu = quem_(p.token);
  if (eu.funcao !== 'lider') throw new Error('Só o líder define os papéis.');
  if (PAPEIS.indexOf(p.papel) < 0) throw new Error('Papel desconhecido.');
  var membroId = String(p.membroId || '');
  if (membroId && !ativos_().some(function (m) { return m.id === membroId; })) throw new Error('Pessoa não encontrada.');
  var data = proximoEncontro_(lerConfig_());
  upsert_('Papeis', function (x) { return x.data === data && x.papel === p.papel; },
    { data: data, papel: p.papel, membro_id: membroId });
  return rotaPainel_(p);
}

/* ---------- Ajudantes ---------- */
function aba_(nome) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome); }

function linhas_(nome) {
  var sh = aba_(nome);
  if (!sh) throw new Error('Rode a função configurar() primeiro.');
  var v = sh.getDataRange().getValues();
  var cab = v.shift() || [];
  return v.map(function (r, i) {
    var o = { _linha: i + 2 };
    cab.forEach(function (c, j) { o[c] = r[j] === null || r[j] === undefined ? '' : String(r[j]); });
    return o;
  });
}

function atualizar_(nome, registro, mudancas) {
  var cab = ABAS[nome];
  var linha = cab.map(function (c) { return c in mudancas ? mudancas[c] : registro[c]; });
  aba_(nome).getRange(registro._linha, 1, 1, cab.length).setValues([linha]);
}

function upsert_(nome, achar, valores) {
  var achou = linhas_(nome).filter(achar)[0];
  if (achou) atualizar_(nome, achou, valores);
  else aba_(nome).appendRow(ABAS[nome].map(function (c) { return c in valores ? valores[c] : ''; }));
}

function lerConfig_() {
  var sh = aba_('Config');
  var o = {};
  if (!sh) return o;
  sh.getDataRange().getValues().slice(1).forEach(function (r) { if (r[0]) o[String(r[0])] = String(r[1]); });
  return o;
}

function ativos_() { return linhas_('Membros').filter(function (m) { return m.status === 'ativo'; }); }

function quem_(token) {
  if (!token) throw new Error('SESSAO: entre de novo.');
  var id = String(token).split('.')[0];
  if (token_(id) !== token) throw new Error('SESSAO: entre de novo.');
  var m = linhas_('Membros').filter(function (x) { return x.id === id; })[0];
  if (!m || m.status !== 'ativo') throw new Error('SESSAO: seu perfil não está ativo.');
  return m;
}

function token_(id) {
  var s = PropertiesService.getScriptProperties().getProperty('SEGREDO');
  if (!s) throw new Error('Rode a função configurar() primeiro.');
  return id + '.' + Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(id, s)).replace(/=+$/, '');
}

function hash_(salt, pin) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pin, Utilities.Charset.UTF_8));
}

function agora_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }

function proximoEncontro_(cfg) {
  var alvo = Number(cfg.dia_semana || 3);
  var hoje = new Date();
  for (var i = 0; i < 8; i++) {
    var d = new Date(hoje.getTime() + i * 86400000);
    var dow = Number(Utilities.formatDate(d, TZ, 'u')) % 7; // 0 = domingo … 3 = quarta
    if (dow !== alvo) continue;
    if (i === 0 && Utilities.formatDate(hoje, TZ, 'HH:mm') >= '23:30') continue; // depois do encontro, já mostra o próximo
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  }
  return Utilities.formatDate(hoje, TZ, 'yyyy-MM-dd');
}

function palavraDoDia_() {
  var l = linhas_('Palavra').filter(function (x) { return x.referencia; });
  if (!l.length) return null;
  var hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd').split('-');
  var dia = Math.floor((Date.UTC(+hoje[0], +hoje[1] - 1, +hoje[2]) - Date.UTC(2026, 0, 1)) / 86400000);
  var v = l[((dia % l.length) + l.length) % l.length];
  return { referencia: v.referencia, texto: v.texto };
}

function iniciais_(nome) {
  var p = String(nome).trim().split(/\s+/);
  return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : (p[0] || '').charAt(1))).toUpperCase();
}

function limpar_(t, max) { return String(t || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max); }

function normal_(t) { return String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
