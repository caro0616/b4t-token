// Funciones compartidas por los scripts de pruebas.
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const DIR_PRUEBAS = __dirname;
const MODO_SIMULADO = process.env.MODO_SIMULADO === '1';
const SUFIJO = MODO_SIMULADO ? 'simulada' : 'amoy';
const DIR_EVID = path.join(RAIZ, 'evidencias', SUFIJO);
const ARCHIVO_ENV = path.join(DIR_PRUEBAS, '.env');
const ARCHIVO_CONTRATO = path.join(RAIZ, 'contracts', 'B4T.sol');
const UNIDAD_CONTRATO = 'contracts/B4T.sol';

const AMOY = {
  chainId: 80002n,
  rpc: 'https://polygon-amoy.drpc.org',
  explorador: 'https://amoy.polygonscan.com',
};

// Configuración de compilación acordada (contracts/README.md)
const COMPILADOR = {
  version: 'v0.8.24+commit.e11b9ed9',
  optimizer: { enabled: true, runs: 200 },
  evmVersion: 'cancun',
};

const CUENTAS = ['D', 'I1', 'I2', 'I3', 'I4'];

function leerEnv() {
  const env = {};
  if (!fs.existsSync(ARCHIVO_ENV)) return { ...process.env };
  for (const linea of fs.readFileSync(ARCHIVO_ENV, 'utf8').split('\n')) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { ...env, ...process.env };
}

function escribirCSV(archivo, filas, columnas) {
  const esc = v => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const txt = [columnas.join(','), ...filas.map(f => columnas.map(c => esc(f[c])).join(','))].join('\n') + '\n';
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, txt);
}

// Compila B4T.sol con solc 0.8.24. Los imports "@openzeppelin/contracts@5.6.1/..."
// se conservan como nombres de unidad (igual que en Remix) y se leen de node_modules.
function compilar() {
  const solc = require('solc');
  if (!fs.existsSync(ARCHIVO_CONTRATO)) {
    throw new Error('No encuentro contracts/B4T.sol. ¿Ya se unió el pull request de Valeria? (git pull)');
  }
  const fuentes = {};
  const leerImport = ruta => {
    const m = ruta.match(/^@openzeppelin\/contracts(@[^/]+)?\/(.*)$/);
    if (!m) return { error: 'Import no soportado: ' + ruta };
    if (m[1] && m[1] !== '@5.6.1') return { error: 'Versión de OpenZeppelin distinta a 5.6.1: ' + ruta };
    const archivo = path.join(DIR_PRUEBAS, 'node_modules', '@openzeppelin', 'contracts', m[2]);
    if (!fs.existsSync(archivo)) return { error: 'No existe ' + archivo };
    const contenido = fs.readFileSync(archivo, 'utf8');
    fuentes[ruta] = { content: contenido };
    return { contents: contenido };
  };
  const entrada = {
    language: 'Solidity',
    sources: { [UNIDAD_CONTRATO]: { content: fs.readFileSync(ARCHIVO_CONTRATO, 'utf8') } },
    settings: {
      optimizer: COMPILADOR.optimizer,
      evmVersion: COMPILADOR.evmVersion,
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'metadata'] } },
    },
  };
  const salida = JSON.parse(solc.compile(JSON.stringify(entrada), { import: leerImport }));
  const errores = (salida.errors || []).filter(e => e.severity === 'error');
  const advertencias = (salida.errors || []).filter(e => e.severity === 'warning');
  if (errores.length) throw new Error('Error de compilación:\n' + errores.map(e => e.formattedMessage).join('\n'));
  const c = salida.contracts[UNIDAD_CONTRATO].B4T;
  // Entrada estándar completa (con todas las fuentes) para verificar en Polygonscan
  const entradaEstandar = {
    language: 'Solidity',
    sources: { ...entrada.sources, ...fuentes },
    settings: { optimizer: COMPILADOR.optimizer, evmVersion: COMPILADOR.evmVersion, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'metadata'] } } },
  };
  return { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object, advertencias, versionSolc: solc.version(), entradaEstandar };
}

module.exports = { MODO_SIMULADO, SUFIJO, RAIZ, DIR_PRUEBAS, DIR_EVID, ARCHIVO_ENV, AMOY, COMPILADOR, CUENTAS, UNIDAD_CONTRATO, leerEnv, escribirCSV, compilar };
