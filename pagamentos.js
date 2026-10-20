'use strict';
validarConfiguracaoCampolina(window.CAMPOLINA_FIREBASE_CONFIG);
firebase.initializeApp(window.CAMPOLINA_FIREBASE_CONFIG);
const payDb = firebase.firestore();
const payAuth = firebase.auth();
const core = PagamentosCore;
const $ = id => document.getElementById(id);
const dinheiro = centavos => (centavos / 100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
let usuario, linhas = [], resumo = [], fechamentos = [], tarifas = {}, periodo = null, fechamento = null, ocupado = false;
const hoje = new Date();
$('mes').value = hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0');
$('quinzena').value = hoje.getDate() <= 15 ? '1' : '2';
function avisar(texto='', erro=false){ $('feedback').textContent=texto; $('feedback').classList.toggle('error',erro); }
function ocupar(valor){ ocupado=valor; $('pay-app').setAttribute('aria-busy',String(valor)); }
function criar(tag,texto){ const node=document.createElement(tag); if(texto !== undefined) node.textContent=texto; return node; }
function chave(obra){ return encodeURIComponent(JSON.stringify([periodo.mes,periodo.quinzena,obra])); }
function render(){
  $('linhas').replaceChildren();
  const total=linhas.reduce((s,f)=>s+core.total(f),0), pago=linhas.filter(f=>f.pago).reduce((s,f)=>s+core.total(f),0);
  $('pessoas').textContent=linhas.length;
  $('liquido').textContent=dinheiro(total); $('pago').textContent=dinheiro(pago); $('pendente').textContent=dinheiro(total-pago);
  $('titulo').textContent=$('obra').value || 'Nenhuma obra com pontos';
  $('periodo').textContent=periodo ? periodo.mes.split('-').reverse().join('/')+' · '+periodo.quinzena+'ª quinzena' : '';
  $('situacao').textContent=fechamento ? 'Fechamento salvo. Valores preservados; registre os pagamentos abaixo.' : 'Prévia do ponto. Revise os valores e salve o fechamento para registrar pagamentos.';
  for(const f of linhas){
    const tr=criar('tr'), nome=criar('td',f.nome);
    nome.append(criar('small',f.funcao),criar('small','PIX: '+(f.pix || 'não cadastrado')));
    if(!fechamento){
      nome.append(criar('small',f.conferido ? 'Ponto conferido' : 'Ponto pendente de conferência'));
      if(f.horasReferencia) nome.append(criar('small',f.horasReferencia+' h extras no ponto (referência)'));
      if(f.horasAmbiguas) nome.append(criar('small','Atenção: extras em dia com duas obras. Confira a divisão.'));
    }
    tr.append(nome,criar('td',String(f.dias)));
    for(const campo of ['diaria','extras','adiant']){
      const td=criar('td'), input=criar('input'); input.type='number';input.min='0';input.max='1000000';input.step='0.01';input.value=f[campo];input.disabled=!!fechamento;
      input.setAttribute('aria-label',campo+' de '+f.nome);
      input.addEventListener('change',()=>{const v=Number(input.value);if(input.value===''||!Number.isFinite(v)||v<0||v>1000000){input.value=f[campo];avisar('Informe um valor entre 0 e 1.000.000.',true);return;}f[campo]=Math.round(v*100)/100;render();avisar();});td.append(input);tr.append(td);
    }
    const valor=criar('td',dinheiro(core.total(f)));valor.className='total';tr.append(valor);
    const status=criar('td'), pill=criar('span',f.pago ? 'Pago' : 'Pendente');pill.className='status'+(f.pago?' paid':'');status.append(pill);
    if(f.pagoEm) status.append(criar('small',new Date(f.pagoEm).toLocaleDateString('pt-BR')));
    tr.append(status);const acao=criar('td');acao.className='pay-action';
    if(fechamento){const botao=criar('button',f.pago?'Desfazer pagamento':'Marcar pago');botao.onclick=()=>registrarPagamento(f);acao.append(botao);}else acao.textContent='Salve para pagar';tr.append(acao);$('linhas').append(tr);
  }
  if(!linhas.length){const tr=criar('tr'),td=criar('td','Nenhum ponto lançado na obra e quinzena selecionadas.');td.colSpan=8;tr.append(td);$('linhas').append(tr);}
  $('fechar').disabled=!!fechamento||!linhas.length;
  $('csv').disabled=!linhas.length;$('imprimir').disabled=!linhas.length;
}
function selecionarObra(){
  const obra=$('obra').value;
  fechamento=fechamentos.find(f=>f.obra===obra)||null;
  linhas=fechamento ? structuredClone(fechamento.linhas) : resumo.filter(f=>f.obra===obra).map(f=>({...f,diaria:Number(tarifas[f.id]?.diaria)||0}));
  avisar();render();
}
async function carregar(){
  if(ocupado||!usuario)return;
  const mes=$('mes').value,quinzena=Number($('quinzena').value);
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes))return avisar('Selecione um mês válido.',true);
  ocupar(true);avisar('Carregando pontos e fechamentos…');linhas=[];fechamento=null;resumo=[];fechamentos=[];$('obra').replaceChildren();render();
  try{
    const [funcs, fechados, valores]=await Promise.all([
      payDb.collection('funcionarios').get({source:'server'}),
      payDb.collection('pagamentos').where('mes','==',mes).get({source:'server'}),
      payDb.collection('pagamentosTarifas').get({source:'server'})
    ]);
    const funcionarios=funcs.docs.map(d=>({...d.data(),id:d.id})),pontos={};
    await Promise.all(funcionarios.map(async f=>{const snap=await payDb.doc('funcionarios/'+f.id+'/pontos/'+mes).get({source:'server'});pontos[f.id]=snap.exists?snap.data():{};}));
    periodo={mes,quinzena};tarifas=Object.fromEntries(valores.docs.map(d=>[d.id,d.data()]));
    resumo=core.resumir(funcionarios,pontos,mes,quinzena);
    fechamentos=fechados.docs.map(d=>({...d.data(),docId:d.id})).filter(f=>f.quinzena===quinzena);
    const obras=[...new Set([...resumo.map(f=>f.obra),...fechamentos.map(f=>f.obra)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    for(const obra of obras){const option=criar('option',obra);option.value=obra;$('obra').append(option);}
    selecionarObra();
  }catch(e){periodo=null;linhas=[];resumo=[];fechamentos=[];fechamento=null;render();avisar('Não foi possível carregar. Confira a conexão e as permissões do administrador. Tente novamente.',true);}
  finally{ocupar(false);}
}
function confirmar(texto){
  return new Promise(resolve=>{
    const dialog=criar('dialog');dialog.style.cssText='max-width:520px;border:1px solid #d5ddeb;border-radius:16px;padding:24px;color:#172340';
    dialog.append(criar('h2','Confirmar ação'),criar('p',texto));const actions=criar('div');actions.className='actions';const sim=criar('button','Confirmar'),nao=criar('button','Cancelar');sim.className='primary';
    function terminar(v){dialog.close();dialog.remove();resolve(v);}
    sim.onclick=()=>terminar(true);nao.onclick=()=>terminar(false);dialog.addEventListener('cancel',e=>{e.preventDefault();terminar(false);});actions.append(nao,sim);dialog.append(actions);document.body.append(dialog);dialog.showModal();nao.focus();
  });
}
async function salvar(){
  if(ocupado||fechamento||!periodo)return;
  try{core.validar(linhas);}catch(e){return avisar(e.message,true);}
  const pendentes=linhas.filter(f=>!f.conferido).length;
  const texto='Salvar '+$('obra').value+' · '+periodo.mes+' · '+periodo.quinzena+'ª quinzena por '+dinheiro(linhas.reduce((s,f)=>s+core.total(f),0))+'? '+(pendentes?pendentes+' funcionário(s) com ponto ainda pendente de conferência. ':'')+'Os valores ficarão preservados neste fechamento.';
  if(!await confirmar(texto))return;
  ocupar(true);
  try{
    const ref=payDb.collection('pagamentos').doc(chave($('obra').value));
    const registro={...periodo,obra:$('obra').value,linhas:structuredClone(linhas),criadoPor:usuario.uid,criadoEm:new Date().toISOString(),versao:1};
    await payDb.runTransaction(async tx=>{
      const existente=await tx.get(ref);if(existente.exists)throw new Error('Já existe um fechamento desta obra e quinzena. Recarregue o período.');
      tx.set(ref,registro);
      for(const linha of linhas)tx.set(payDb.collection('pagamentosTarifas').doc(linha.id),{diaria:linha.diaria,atualizadoPor:usuario.uid},{merge:true});
    });
    fechamento={...registro,docId:ref.id};fechamentos.push(fechamento);render();avisar('Fechamento salvo no Firebase. Nenhuma transferência foi realizada.');
  }catch(e){avisar(e.message||'Não foi possível salvar. Recarregue e tente novamente.',true);}
  finally{ocupar(false);}
}
async function registrarPagamento(linha){
  if(ocupado||!fechamento)return;
  const estavaPago=!!linha.pago;
  if(!await confirmar((estavaPago?'Desfazer o registro de pagamento de ':'Confirmar que você já pagou ')+linha.nome+' · '+dinheiro(core.total(linha))+'? Nenhuma transferência será realizada.'))return;
  ocupar(true);
  try{
    const ref=payDb.collection('pagamentos').doc(fechamento.docId);
    const atualizado=await payDb.runTransaction(async tx=>{
      const snap=await tx.get(ref);if(!snap.exists)throw new Error('Fechamento não encontrado. Recarregue.');
      const registro=snap.data(),item=registro.linhas.find(f=>f.id===linha.id);
      if(!item||!!item.pago!==estavaPago)throw new Error('O pagamento mudou em outra sessão. Recarregue o período.');
      item.pago=!estavaPago;item.pagoEm=item.pago?new Date().toISOString():null;item.atualizadoPor=usuario.uid;
      tx.update(ref,{linhas:registro.linhas});return registro;
    });
    fechamento={...atualizado,docId:ref.id};fechamentos=fechamentos.map(f=>f.docId===ref.id?fechamento:f);linhas=structuredClone(fechamento.linhas);render();avisar('Situação do pagamento salva.');
  }catch(e){avisar(e.message||'Não foi possível registrar o pagamento.',true);}
  finally{ocupar(false);}
}
function exportar(){
  if(!linhas.length)return;
  const numero=v=>Number(v).toFixed(2).replace('.',',');
  const tabela=[[fechamento?'FECHAMENTO SALVO':'PRÉVIA — NÃO FECHADO'],['Mês',periodo.mes,'Quinzena',periodo.quinzena,'Obra',$('obra').value],['Funcionário','Função','PIX','Dias','Diária','Extras','Adiantamentos','A pagar','Situação','Pago em'],...linhas.map(f=>[f.nome,f.funcao,f.pix,f.dias,numero(f.diaria),numero(f.extras),numero(f.adiant),numero(core.total(f)/100),f.pago?'Pago':'Pendente',f.pagoEm||''])];
  // Prefixo evita fórmulas ao abrir nomes/chaves fornecidos pelo usuário no Excel.
  const escapar=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  const url=URL.createObjectURL(new Blob(['\uFEFF'+tabela.map(l=>l.map(escapar).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=criar('a');a.href=url;a.download='campolina-pagamentos-'+periodo.mes+'-q'+periodo.quinzena+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('carregar').onclick=carregar;$('obra').onchange=selecionarObra;$('fechar').onclick=salvar;$('csv').onclick=exportar;$('imprimir').onclick=()=>window.print();
for(const id of ['mes','quinzena'])$(id).onchange=()=>{linhas=[];fechamento=null;periodo=null;$('obra').replaceChildren();render();avisar('Clique em Carregar período para consultar a nova seleção.');};
payAuth.onAuthStateChanged(async user=>{
  usuario=null;$('pay-app').hidden=true;
  if(!user){$('auth-msg').textContent='Entre no painel Campolina e volte a Pagamentos por Obra.';return;}
  try{
    const perfil=await payDb.doc('usuarios/'+user.uid).get({source:'server'});
    if(!perfil.exists||perfil.data().role!=='admin'){$('auth-msg').textContent='Acesso disponível apenas para administradores.';return;}
    usuario=user;$('auth-msg').textContent='Administrador: '+(perfil.data().nome||user.email);$('pay-app').hidden=false;await carregar();
  }catch(e){$('auth-msg').textContent='Não foi possível verificar seu acesso. Confira a conexão e recarregue.';}
});
