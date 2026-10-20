(function(root){
  'use strict';
  const marcadores = new Set(['SÁBADO','SABADO','DOMINGO','FERIADO','FALTA']);
  const centavos = valor => Math.round(Number(valor) * 100);
  function total(linha){ return Math.round(linha.dias * centavos(linha.diaria)) + centavos(linha.extras) - centavos(linha.adiant); }
  function validar(linhas){
    if(!linhas.length) throw new Error('Não há pontos nesta obra e quinzena.');
    for(const f of linhas){
      if(!Number.isFinite(f.dias) || f.dias <= 0) throw new Error('Dias inválidos: ' + f.nome);
      for(const campo of ['diaria','extras','adiant']){
        if(!Number.isFinite(f[campo]) || f[campo] < 0 || f[campo] > 1000000) throw new Error('Revise os valores de ' + f.nome);
      }
      if(f.diaria <= 0) throw new Error('Preencha a diária de ' + f.nome);
      if(total(f) < 0) throw new Error('Adiantamentos superam o valor devido: ' + f.nome);
    }
  }
  function resumir(funcionarios, pontos, mes, quinzena){
    const grupos = new Map();
    const [ano, numeroMes] = mes.split('-').map(Number);
    const inicio = quinzena === 1 ? 1 : 16;
    const fim = quinzena === 1 ? 15 : new Date(ano, numeroMes, 0).getDate();
    for(const funcionario of funcionarios){
      const info = pontos[funcionario.id] || {};
      for(let dia = inicio; dia <= fim; dia++){
        const registro = (info.dias || {})[dia] || {};
        const obras = [registro.m, registro.t].filter(v => typeof v === 'string' && v.trim() && !marcadores.has(v.toUpperCase()));
        for(const obra of new Set(obras)){
          const chave = JSON.stringify([obra, funcionario.id]);
          if(!grupos.has(chave)) grupos.set(chave, {id:funcionario.id,nome:funcionario.nome,funcao:funcionario.funcao || '',pix:funcionario.pix || '',obra,dias:0,diaria:0,extras:0,adiant:0,pago:false,horasReferencia:0,horasAmbiguas:false,conferido:typeof info.statusConferencia === 'string' ? info.statusConferencia === 'Conferido' : info.statusConferencia?.['q'+quinzena] === 'Conferido'});
          const grupo = grupos.get(chave);
          grupo.dias += obras.filter(v => v === obra).length * 0.5;
          const horas = Number(registro.horasExtras) || 0;
          if(horas > 0 && new Set(obras).size === 1) grupo.horasReferencia += horas;
          if(horas > 0 && new Set(obras).size > 1) grupo.horasAmbiguas = true;
        }
      }
    }
    return [...grupos.values()].sort((a,b) => a.nome.localeCompare(b.nome,'pt-BR'));
  }
  const api = {total, validar, resumir};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PagamentosCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
