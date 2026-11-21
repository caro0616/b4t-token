// Paso 3 (A18): verifica el código fuente del contrato en el explorador de Amoy
// usando la API de Etherscan (v2, multichain). Necesita una API key gratuita en pruebas/.env:
//   ETHERSCAN_API_KEY=tu_clave
const fs = require('fs');
const path = require('path');
const { DIR_EVID, COMPILADOR, UNIDAD_CONTRATO, leerEnv, escribirCSV } = require('./lib');

const API = 'https://api.etherscan.io/v2/api';
const ARCH_MATRIZ = path.join(DIR_EVID, 'matriz_amoy.csv');

function leerCSV(texto) {
  const filas = []; let fila = [], campo = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === ',') { fila.push(campo); campo = ''; }
    else if (ch === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas;
  return { cab, filas: resto.map(f => Object.fromEntries(cab.map((c, i) => [c, f[i] ?? '']))) };
}

function actualizarA18(obtenido, aprobado) {
  if (!fs.existsSync(ARCH_MATRIZ)) return;
  const { cab, filas } = leerCSV(fs.readFileSync(ARCH_MATRIZ, 'utf8'));
  const f = filas.find(x => x.ID === 'A18');
  if (!f) return;
  f['Fecha y hora'] = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });
  f.Estado = aprobado ? 'Verificado' : 'Pendiente';
  f.Obtenido = obtenido;
  f.Aprobado = aprobado ? 'Sí' : '';
  escribirCSV(ARCH_MATRIZ, filas, cab);
  const resumen = path.join(DIR_EVID, 'resumen_pruebas.md');
  if (fs.existsSync(resumen) && aprobado) {
    fs.writeFileSync(resumen, fs.readFileSync(resumen, 'utf8').replace(/\| A18 \| - \| verificación \| Pendiente \| Pendiente \|/, '| A18 | - | verificación | Verificado | Sí |'));
  }
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const env = leerEnv();
  const desp = JSON.parse(fs.readFileSync(path.join(DIR_EVID, 'despliegue.json'), 'utf8'));
  const entrada = fs.readFileSync(path.join(DIR_EVID, 'verificacion', 'standard_input.json'), 'utf8');
  const enlace = `https://amoy.polygonscan.com/address/${desp.contrato}#code`;

  if (!env.ETHERSCAN_API_KEY) {
    console.log('No hay ETHERSCAN_API_KEY en pruebas/.env.\n');
    console.log('Opción A (automática): crea una cuenta gratis en https://etherscan.io/register, ve a API Keys,');
    console.log('crea una clave y agrégala al final de pruebas/.env así:  ETHERSCAN_API_KEY=tu_clave');
    console.log('Luego corre otra vez: npm run verificar\n');
    console.log('Opción B (manual) en ' + `https://amoy.polygonscan.com/verifyContract?a=${desp.contrato}`);
    console.log('  Compiler Type: Solidity (Standard-Json-Input)');
    console.log('  Compiler Version: ' + COMPILADOR.version);
    console.log('  License: MIT');
    console.log('  Archivo a subir: evidencias/amoy/verificacion/standard_input.json');
    return;
  }

  const comun = { chainid: desp.chainId, apikey: env.ETHERSCAN_API_KEY };
  const consulta = async params => {
    const r = await fetch(`${API}?${new URLSearchParams({ ...comun, ...params })}`);
    return r.json();
  };

  const fuente = await consulta({ module: 'contract', action: 'getsourcecode', address: desp.contrato });
  if (fuente.status === '1' && fuente.result?.[0]?.SourceCode) {
    console.log('El contrato ya estaba verificado: ' + enlace);
    actualizarA18(`Código fuente verificado (${fuente.result[0].ContractName}, ${fuente.result[0].CompilerVersion}) · ${enlace}`, true);
    return;
  }

  console.log('Enviando el código fuente para verificación…');
  const r = await fetch(`${API}?chainid=${desp.chainId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      apikey: env.ETHERSCAN_API_KEY, module: 'contract', action: 'verifysourcecode',
      contractaddress: desp.contrato, sourceCode: entrada, codeformat: 'solidity-standard-json-input',
      contractname: `${UNIDAD_CONTRATO}:B4T`, compilerversion: COMPILADOR.version, constructorArguements: '',
    }),
  }).then(x => x.json());
  if (r.status !== '1') {
    if (/already verified/i.test(r.result)) { actualizarA18(`Código fuente verificado · ${enlace}`, true); console.log('Ya estaba verificado: ' + enlace); return; }
    throw new Error('El explorador rechazó la solicitud: ' + r.result);
  }
  for (let i = 0; i < 20; i++) {
    await esperar(5000);
    const e = await consulta({ module: 'contract', action: 'checkverifystatus', guid: r.result });
    console.log('  estado: ' + e.result);
    if (/pass|already verified/i.test(e.result)) {
      actualizarA18(`Código fuente verificado (solc ${COMPILADOR.version}, optimización ${COMPILADOR.optimizer.runs}, ${COMPILADOR.evmVersion}) · ${enlace}`, true);
      console.log('\nVerificado. Abre ' + enlace + ' y toma la captura A18_verificacion.png');
      return;
    }
    if (/fail|unable/i.test(e.result)) throw new Error('La verificación falló: ' + e.result);
  }
  console.log('Sigue en cola. Espera un par de minutos y vuelve a correr npm run verificar');
}

main().catch(e => { console.error('Se detuvo: ' + e.message); process.exit(1); });
