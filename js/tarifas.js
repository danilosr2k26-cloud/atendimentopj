
'use strict';
BN.garanteLogin(); BN.initTema();
(function(){
const $=id=>document.getElementById(id);
const TEXT_FIELDS=["matricula","ag","produto","pag","conta","nome","doc","datahora","tarifa_tipo","percentual","justificativa","prazo","status_ped"];
const STORE="netempresa_isencao_v1";
const term=BN_Terminal.create($('preview'),{
  warning:'',
  exportName:'isencao-tarifa-monitor.png',
  fields:()=>model.fields,
  footerLabel:'PROCESSANDO PEDIDO _',
  footerKeys:['F01 - AJUDA','F03 - RETORNAR','F05 - DETALHE','ENTER - PROSSEGUIR'],
  afterRender(){$('accessible').textContent=buildText();}
});
function v(id){return String($(id).value||'').trim();}
let model;
function buildModel(){
  const has=s=>s!=='';
  const fields=[];
  const add=(key,label,x,y,cols,pink)=>{fields.push({key,label,x,y,cols,lines:term.wrapText(label+(v(key)||'—'),cols),pink});};
  add('matricula','MATRICULA: ',56,152,60,false);
  add('datahora','',872,152,19,false);
  add('ag','AG: ',56,178,22,false);
  add('produto','PRODUTO: ',300,178,22,false);
  add('conta','CONTA: ',548,178,23,false);
  add('pag','PAG: ',840,178,19,false);
  add('nome','NOME: ',56,204,88,false);
  add('doc','CNPJ: ',56,228,44,false);
  fields.push({label:'',x:56,y:284,lines:['#SOLICITACAO_ISENCAO']});
  add('tarifa_tipo','SERVICO: ',56,308,44,true);
  add('percentual','ISENCAO APLICADA: ',56,332,44,false);
  add('prazo','VIGENCIA: ',56,356,44,false);
  add('status_ped','STATUS: ',56,380,44,true);
  fields.push({label:'',x:56,y:416,lines:['JUSTIFICATIVA TECNICA:']});
  if(has(v('justificativa')))fields.push({label:'',x:56,y:440,lines:term.wrapText(v('justificativa'),100).slice(0,4)});
  return {fields};
}
function buildText(){
  const get=id=>v(id)||'—';
  return ['DADOS INSERIDOS MANUALMENTE; NÃO REPRESENTAM CONSULTA AO BANCO.','',
    'MATRÍCULA: '+get('matricula'),'DATA/HORA: '+get('datahora'),'AGÊNCIA: '+get('ag'),
    'PRODUTO: '+get('produto'),'CONTA: '+get('conta'),'PÁGINA: '+get('pag'),
    'RAZÃO SOCIAL: '+get('nome'),'CNPJ: '+get('doc'),'SERVIÇO: '+get('tarifa_tipo'),
    'ISENÇÃO APLICADA: '+get('percentual'),'VIGÊNCIA: '+get('prazo'),'STATUS DO PEDIDO: '+get('status_ped'),
    'JUSTIFICATIVA TÉCNICA: '+get('justificativa'),
    'OBSERVAÇÕES: SOLICITAÇÃO VIA NET EMPRESA - PRIORIDADE ALTA'
  ].join('\n');
}
let timer;
function changed(){clearTimeout(timer);timer=setTimeout(()=>{saveDraft();model=buildModel();term.render();},65);}
function saveDraft(){try{const d={};TEXT_FIELDS.forEach(f=>{d[f]=$(f).value;});localStorage.setItem(STORE,JSON.stringify(d));}catch(e){}}
function loadDraft(){try{const raw=localStorage.getItem(STORE);if(!raw)return;const d=JSON.parse(raw);TEXT_FIELDS.forEach(f=>{if(typeof d[f]==='string')$(f).value=d[f];});}catch(e){}}
function status(msg){$('status').textContent=msg||'';}
loadDraft();
TEXT_FIELDS.forEach(f=>$(f).addEventListener('input',changed));
$('btnCarregar').onclick=()=>{
  let d={};try{d=BN.parseDadosCliente($('textoCliente').value);}catch(e){status('Não foi possível interpretar o texto colado.');return;}
  const put=(id,val)=>{if(val){$(id).value=String(val);}};
  put('nome',d.nome);put('doc',d.cnpj);put('ag',d.ag);put('conta',d.conta);
  changed();
  status('Dados do cliente carregados.');
};
$('limpar').onclick=()=>{
  TEXT_FIELDS.forEach(f=>{$(f).value='';if($(f).tagName==='SELECT'&&$(f).options&&$(f).options[0])$(f).selectedIndex=0;});
  $('textoCliente').value='';
  try{localStorage.removeItem(STORE);}catch(e){}
  model=buildModel();term.render();
};
$('download').onclick=()=>{if(!term.ready())return;$('download').disabled=true;term.exportPNG('isencao-tarifa-monitor.png',ok=>{$('download').disabled=false;status(ok?'PNG exportado com a identificação de simulação.':'Não foi possível exportar a imagem.');});};
$('copy').onclick=async()=>{const text=buildText();try{await navigator.clipboard.writeText(text);status('Texto copiado.');}catch(error){const area=document.createElement('textarea');area.value=text;document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();status(ok?'Texto copiado.':'O navegador bloqueou a cópia. Tente abrir o HTML em outro navegador.');}};
$('form').onsubmit=e=>e.preventDefault();
model=buildModel();
term.init().then(()=>$('download').disabled=false).catch(error=>{status('Não foi possível carregar os recursos incorporados. Reabra o arquivo.');console.error(error);});
})();
