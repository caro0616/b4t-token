# Pruebas automáticas en Polygon Amoy (rol 2)

Este programa ejecuta la matriz de pruebas A01–A18 de la propuesta sobre el contrato `contracts/B4T.sol`, en la red de pruebas Polygon Amoy (`evidencias/amoy/`) o en una red local simulada (`evidencias/simulada/`).

Solo corre en Amoy (chain ID 80002): si la red es otra, se detiene sin enviar nada.

## Modo simulado (sin POL)

Los faucets de Amoy exigen saldo en Ethereum mainnet, así que la matriz se ejecutó en una blockchain local con las mismas reglas de la EVM (Hardhat, `cancun`). Para repetirla:

```bash
cd pruebas
npm install
npm run pruebas:simulada
```

Tarda alrededor de un minuto, no necesita POL ni llaves y deja la evidencia en `evidencias/simulada/`. El caso A18 se resuelve recompilando el código fuente y comparando el bytecode desplegado.

## Cómo se usa en Amoy

```bash
cd pruebas
npm install          # una sola vez
npm run cuentas      # crea las 5 cuentas de prueba (D, I1–I4)
# -> pedir POL de Amoy en el faucet para la cuenta D
npm run pruebas      # despliega y ejecuta A01–A17
npm run verificar    # A18: verifica el código en el explorador
```

Las llaves privadas quedan solo en `pruebas/.env`, que Git ignora. Son cuentas de prueba sin valor; aun así, nunca se suben ni se comparten.

## Qué genera

| Archivo | Contenido |
| --- | --- |
| `evidencias/amoy/matriz_amoy.csv` | Una fila por caso o transacción: hash, estado, gas, costo, esperado, obtenido, aprobado y enlace a Polygonscan |
| `evidencias/amoy/saldos_amoy.csv` | Saldos de las 5 cuentas después de cada bloque de pruebas |
| `evidencias/amoy/resumen_pruebas.md` | Resumen con enlaces a cada transacción |
| `evidencias/amoy/despliegue.json` | Dirección del contrato, hash y configuración del compilador |
| `evidencias/amoy/cuentas.csv` | Direcciones públicas de D, I1–I4 |
| `evidencias/amoy/fondeo_pol.csv` | POL enviado desde D a I1–I4 para pagar gas (no es un caso de prueba) |
| `evidencias/amoy/verificacion/` | Entrada estándar del compilador (para A18) y ABI (para A16) |

## Qué prueba cada caso

| Caso | Qué se hace | Por qué importa |
| --- | --- | --- |
| A01 | Compilar con solc 0.8.24, optimización 200 y EVM cancun | Confirma que el código compila con la configuración acordada; la misma se usa para verificar |
| A02 | Desplegar desde D | La emisión ocurre una sola vez: totalSupply y el saldo de D deben ser 10^24 y debe existir un evento Transfer desde la dirección cero |
| A03 | Leer name, symbol y decimals | Los metadatos que muestran billeteras y exploradores |
| A04 | D envía 250 000 B4T a cada integrante | Distribución inicial; D queda en 0 |
| A05 | 12 transferencias, una por cada par ordenado | Cada cuenta envía y recibe al menos tres veces; incluye montos fraccionarios (1,5 y 0,25) |
| A06 | Transferir 1 unidad mínima (10^-18 B4T) | El contrato trabaja con enteros; la unidad más pequeña también se mueve exacta |
| A07 | I4 envía todo su saldo | El saldo puede quedar exactamente en cero |
| A08 | Transferir 0 B4T | El estándar ERC-20 exige aceptarlo y emitir el evento |
| A09 | Transferirse a sí misma | Se acepta y el saldo no cambia |
| A10 | Enviar más de lo que se tiene | Debe revertir con `ERC20InsufficientBalance` sin tocar saldos |
| A11 | Enviar a la dirección cero | OpenZeppelin lo bloquea con `ERC20InvalidReceiver`, para evitar perder tokens |
| A12 | I1 autoriza a I2 a gastar 100 B4T (approve) | Se crea la autorización y se emite Approval |
| A13 | I2 mueve 40 B4T de I1 a I3 (transferFrom) | Gasto delegado: la autorización baja a 60 |
| A14 | I2 intenta mover 61 B4T | Debe revertir con `ERC20InsufficientAllowance`: no se puede pasar del límite |
| A15 | Llevar la autorización a 0 y luego a 50 | Práctica recomendada por el estándar para evitar la condición de carrera de approve |
| A16 | Revisar el ABI | No existen funciones mint, burn, pause, owner ni administrativas |
| A17 | Sumar los saldos | La suma es igual a totalSupply (1 000 000): no se crearon ni perdieron tokens |
| A18 | Verificar el código fuente en el explorador | Cualquiera puede leer el código desplegado y auditar las pruebas |

Los casos que deben fallar (A10, A11, A14) se envían de verdad a la red para que quede la transacción fallida como evidencia; consumen un poco de gas, por eso solo se hacen en Amoy y no en mainnet.

## Si algo sale mal

| Mensaje | Qué hacer |
| --- | --- |
| `A la cuenta D le falta POL` | Pedir más POL en el faucet (o a un compañero) para la dirección de D y correr otra vez `npm run pruebas` |
| `Ya hay un despliegue registrado` | Las pruebas ya corrieron. Para repetir todo con un contrato nuevo: `npm run pruebas -- --nuevo` |
| `No encuentro contracts/B4T.sol` | Falta unir el pull request del contrato: `git pull` |
| Error de conexión o `timeout` | El RPC público de Amoy está congestionado. Esperar unos minutos y repetir con `--nuevo` |
