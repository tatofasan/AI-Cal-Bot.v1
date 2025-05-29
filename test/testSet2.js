import { ElevenLabsClient } from "elevenlabs";

// Configuración
const AGENT_ID = "KmPa2LWqjFasERSKkFsg";
const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY || "tu_api_key_aqui"
});

// Configuración de timeouts y concurrencia
const CONFIG = {
    TIMEOUT_MS: 120000, // 2 minutos por prueba
    MAX_RETRIES: 2,     // Reintentos si falla por timeout
    BATCH_SIZE: 5,      // Número de pruebas simultáneas
    RETRY_DELAY: 5000   // 5 segundos entre reintentos
};

// Colores para output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

// Helper para logging con timestamp
const log = {
    success: (msg) => console.log(`${new Date().toLocaleTimeString()} ${colors.green}✓ ${msg}${colors.reset}`),
    failure: (msg) => console.log(`${new Date().toLocaleTimeString()} ${colors.red}✗ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${new Date().toLocaleTimeString()} ${colors.blue}ℹ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${new Date().toLocaleTimeString()} ${colors.yellow}⚠ ${msg}${colors.reset}`),
    progress: (msg) => console.log(`${new Date().toLocaleTimeString()} ${colors.cyan}► ${msg}${colors.reset}`)
};

// Helper para crear timeout promise
const withTimeout = (promise, timeoutMs, testName) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout después de ${timeoutMs/1000}s para: ${testName}`)), timeoutMs)
        )
    ]);
};

// Función para ejecutar una simulación con reintentos
async function runSimulationWithRetry(testCase, retryCount = 0) {
    const attemptNumber = retryCount + 1;

    if (attemptNumber > 1) {
        log.warning(`Reintento ${attemptNumber}/${CONFIG.MAX_RETRIES + 1} para: ${testCase.name}`);
    }

    try {
        const simulationPromise = client.conversationalAi.agents.simulateConversation(
            AGENT_ID,
            {
                simulation_specification: {
                    simulated_user_config: {
                        first_message: testCase.firstMessage,
                        language: "es",
                        prompt: {
                            prompt: testCase.userPrompt
                        }
                    }
                },
                extra_evaluation_criteria: testCase.evaluationCriteria
            }
        );

        const response = await withTimeout(simulationPromise, CONFIG.TIMEOUT_MS, testCase.name);

        return {
            testName: testCase.name,
            success: true,
            response: response,
            results: response.analysis?.evaluation_criteria_results || {},
            attempts: attemptNumber
        };
    } catch (error) {
        if (error.message.includes('Timeout') && retryCount < CONFIG.MAX_RETRIES) {
            log.warning(`Timeout detectado para: ${testCase.name}. Esperando ${CONFIG.RETRY_DELAY/1000}s antes de reintentar...`);
            await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
            return runSimulationWithRetry(testCase, retryCount + 1);
        }

        return {
            testName: testCase.name,
            success: false,
            error: error.message,
            attempts: attemptNumber
        };
    }
}

// Función para mostrar progreso en tiempo real
function createProgressTracker(totalTests) {
    let completed = 0;
    let passed = 0;
    let failed = 0;

    return {
        update: (testName, status) => {
            completed++;
            if (status === 'passed') passed++;
            else failed++;

            const percentage = ((completed / totalTests) * 100).toFixed(1);
            console.log(`\n${colors.magenta}[PROGRESO] ${completed}/${totalTests} (${percentage}%) | ✓ ${passed} | ✗ ${failed}${colors.reset}`);
        }
    };
}

// Procesador de resultados en tiempo real
function processResult(result, testCase) {
    console.log(`\n${colors.yellow}════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.yellow}Prueba: ${testCase.name}${colors.reset}`);

    if (result.attempts > 1) {
        log.info(`Completado después de ${result.attempts} intentos`);
    }

    if (result.success) {
        let allCriteriaPassed = true;
        const criteriaResults = result.results;

        for (const criteria of testCase.evaluationCriteria) {
            const criteriaResult = criteriaResults[criteria.id];
            if (criteriaResult) {
                if (criteriaResult.result === 'success') {
                    log.success(`${criteria.name}: PASÓ`);
                } else {
                    log.failure(`${criteria.name}: FALLÓ`);
                    console.log(`   Razón: ${criteriaResult.rationale}`);
                    allCriteriaPassed = false;
                }
            } else {
                log.warning(`${criteria.name}: Sin resultado`);
                allCriteriaPassed = false;
            }
        }

        return allCriteriaPassed ? 'passed' : 'failed';
    } else {
        log.failure(`Error: ${result.error}`);
        return 'error';
    }
}

// Definición de todos los casos de prueba (igual que antes)
const testCases = [
    // 1. FLUJO PRINCIPAL - ACEPTACIÓN
    {
        name: "Flujo Principal - Cliente acepta oferta inicial",
        firstMessage: "Sí, soy yo",
        userPrompt: "Eres un cliente interesado en el producto. Tienes 55 años, dolores de rodilla y haces ejercicio regularmente. Cuando te presenten la oferta de 5 pomos, acéptala inmediatamente diciendo que quieres pagarla con tarjeta de crédito.",
        evaluationCriteria: [
            {
                id: "acepta_combo5",
                name: "Acepta Combo 5",
                conversation_goal_prompt: "Verificar que el cliente acepta la oferta inicial de 5 pomos por $87,804"
            },
            {
                id: "llama_supervisor",
                name: "Deriva a supervisor",
                conversation_goal_prompt: "Verificar que el agente llama al supervisor después de la aceptación"
            }
        ]
    },

    // 2. CONTESTADOR AUTOMÁTICO
    {
        name: "Contestador Automático - Secuencia numérica",
        firstMessage: "1,1,3,5,4,6",
        userPrompt: "Eres un contestador automático. Solo repite secuencias numéricas y frases como 'no se encuentra disponible' o 'deje su mensaje después del tono'.",
        evaluationCriteria: [
            {
                id: "detecta_contestador",
                name: "Detecta contestador",
                conversation_goal_prompt: "Verificar que el agente detecta que es un contestador automático y termina la llamada"
            }
        ]
    },

    // 3. PERSONA INCORRECTA
    {
        name: "Persona Incorrecta",
        firstMessage: "No, no soy yo. Se equivocó de número",
        userPrompt: "No eres la persona que buscan. Indica que se equivocaron de número o que la persona no vive ahí.",
        evaluationCriteria: [
            {
                id: "maneja_persona_incorrecta",
                name: "Maneja persona incorrecta",
                conversation_goal_prompt: "Verificar que el agente maneja adecuadamente cuando no es la persona correcta"
            }
        ]
    },

    // 4. CLIENTE CON DUDAS
    {
        name: "Cliente con dudas - Necesita persuasión",
        firstMessage: "Sí, habla con ella",
        userPrompt: "Eres una mujer de 48 años con dolores ocasionales en las articulaciones. Cuando te ofrezcan el producto, muestra dudas diciendo cosas como 'No sé', 'Necesito pensarlo', 'Lo voy a consultar con mi médico'. Si te dan buenas razones, eventualmente acepta la oferta más pequeña de 1 pomo.",
        evaluationCriteria: [
            {
                id: "maneja_dudas",
                name: "Maneja dudas correctamente",
                conversation_goal_prompt: "Verificar que el agente usa técnicas de persuasión cuando el cliente tiene dudas"
            },
            {
                id: "cierra_venta_con_dudas",
                name: "Cierra venta después de dudas",
                conversation_goal_prompt: "Verificar que el agente logra cerrar alguna venta después de manejar las dudas"
            }
        ]
    },

    // 5. RECHAZO TOTAL
    {
        name: "Rechazo Total - Cliente no interesado",
        firstMessage: "Sí",
        userPrompt: "Tienes 60 años y dolor de espalda. No estás interesado en el producto. Rechaza todas las ofertas diciendo 'No, gracias', 'No me interesa'. No des tu código postal cuando te lo pidan.",
        evaluationCriteria: [
            {
                id: "sigue_flujo_rechazos",
                name: "Sigue flujo de rechazos",
                conversation_goal_prompt: "Verificar que el agente pasa por los 3 niveles de ofertas antes de derivar"
            },
            {
                id: "deriva_supervisor_final",
                name: "Deriva tras tercer rechazo",
                conversation_goal_prompt: "Verificar que deriva al supervisor después del tercer rechazo"
            }
        ]
    },

    // 6. SOLICITUD NO LLAMAR
    {
        name: "Solicitud No Llamar",
        firstMessage: "Sí, pero no me llamen más por favor",
        userPrompt: "Eres la persona correcta pero inmediatamente pides que no te llamen más, que eliminen tu número de la base de datos.",
        evaluationCriteria: [
            {
                id: "respeta_no_llamar",
                name: "Respeta solicitud no llamar",
                conversation_goal_prompt: "Verificar que el agente respeta la solicitud de no ser contactado y termina la llamada apropiadamente"
            }
        ]
    },

    // 7. MENCIÓN DE CELEBRIDADES
    {
        name: "Mención de Celebridades",
        firstMessage: "Sí, soy yo",
        userPrompt: "Tienes 45 años. Cuando te pregunten sobre dolencias, menciona que Lionel Messi te recomendó un producto similar y pregunta si Enerflex es mejor.",
        evaluationCriteria: [
            {
                id: "detecta_celebridad",
                name: "Detecta mención de celebridad",
                conversation_goal_prompt: "Verificar que el agente detecta la mención de celebridad y actúa según el protocolo"
            }
        ]
    },

    // 8. CONSULTA DE PRECIOS
    {
        name: "Cliente pregunta precios repetidamente",
        firstMessage: "Sí, soy yo",
        userPrompt: "Tienes 52 años con dolor en las rodillas. Haces ejercicio 2 veces por semana. Cuando te den el precio, pide que te lo repitan varias veces porque no escuchaste bien. Pregunta '¿Cuánto dijiste?' al menos 2 veces.",
        evaluationCriteria: [
            {
                id: "repite_precios",
                name: "Repite precios cuando se solicita",
                conversation_goal_prompt: "Verificar que el agente repite los precios cuando el cliente lo solicita"
            }
        ]
    },

    // 9. PEDIDO MAYOR A 5 UNIDADES
    {
        name: "Pedido mayorista",
        firstMessage: "Sí, habla",
        userPrompt: "Tienes 58 años y dolor crónico en varias articulaciones. No haces ejercicio. Cuando te ofrezcan 5 pomos, di que necesitas más, que quieres comprar 10 unidades para tu familia.",
        evaluationCriteria: [
            {
                id: "detecta_pedido_mayor",
                name: "Detecta pedido mayor a 5",
                conversation_goal_prompt: "Verificar que deriva al supervisor cuando piden más de 5 unidades"
            }
        ]
    },

    // 10. RECLAMO DE PRODUCTO
    {
        name: "Cliente con reclamo",
        firstMessage: "Sí, soy yo, pero tengo un reclamo",
        userPrompt: "Inmediatamente menciona que compraste Enerflex hace 2 meses y nunca llegó. Estás muy molesto y quieres saber dónde está tu pedido.",
        evaluationCriteria: [
            {
                id: "maneja_reclamo",
                name: "Maneja reclamo correctamente",
                conversation_goal_prompt: "Verificar que deriva a igalfer.com/reclamos y termina la llamada"
            }
        ]
    },

    // 11. FLUJO COMPLETO - ACEPTA COMBO 4
    {
        name: "Acepta oferta regional",
        firstMessage: "Sí",
        userPrompt: "Tienes 50 años, dolor en las muñecas, haces ejercicio ocasionalmente. Rechaza la primera oferta de 5 pomos. Cuando te pidan el código postal, da '1234'. Acepta la oferta del COMBO 4.",
        evaluationCriteria: [
            {
                id: "acepta_combo4",
                name: "Acepta Combo 4",
                conversation_goal_prompt: "Verificar que el cliente acepta la oferta regional de 4 unidades"
            }
        ]
    },

    // 12. ACEPTA OFERTA MÍNIMA
    {
        name: "Acepta solo 1 pomo",
        firstMessage: "Hola",
        userPrompt: "Eres un comprador. Te llaman para venderte Enerflex. Tienes 43 años, dolor leve en las rodillas, haces ejercicio 3 veces por semana. Quieres comprar una sola unidad, pero no lo dices hasta que te lo ofrezcan. Debes negar todas las ofertas hasta que te ofrezcan comprar una sola.",
        evaluationCriteria: [
            {
                id: "acepta_unidad",
                name: "Acepta 1 unidad",
                conversation_goal_prompt: "Verificar que efectivamente compre una sola unidad con 50% de descuento"
            }
        ]
    },

    // 13. PREGUNTAS FUERA DE CONTEXTO
    {
        name: "Preguntas irrelevantes",
        firstMessage: "Sí, soy yo",
        userPrompt: "Tienes 47 años. Cuando te pregunten sobre dolencias, empieza a hacer preguntas irrelevantes como '¿Cómo está el clima?', '¿De dónde llamas?', '¿Eres un robot?'. Eventualmente responde las preguntas del agente.",
        evaluationCriteria: [
            {
                id: "ignora_irrelevantes",
                name: "Maneja preguntas irrelevantes",
                conversation_goal_prompt: "Verificar que el agente ignora preguntas irrelevantes y continúa con el flujo"
            }
        ]
    },

    // 14. CONSULTA SOBRE EL PRODUCTO
    {
        name: "Preguntas sobre el producto",
        firstMessage: "Sí",
        userPrompt: "Tienes 56 años, dolor de cadera. Antes de decidir, haz varias preguntas: '¿Es una crema o pastillas?', '¿Tiene efectos secundarios?', '¿Sirve para la artritis?'. Si las respuestas te satisfacen, acepta comprar 1 unidad.",
        evaluationCriteria: [
            {
                id: "responde_consultas_producto",
                name: "Responde consultas del producto",
                conversation_goal_prompt: "Verificar que el agente responde las consultas sobre el producto"
            }
        ]
    },

    // 15. TRANSCRIPCIÓN CONFUSA
    {
        name: "Respuestas confusas",
        firstMessage: "Sí... creo... no sé",
        userPrompt: "Responde de manera confusa e incoherente. Murmura, da respuestas que no tienen sentido como 'el gato verde vuela' cuando te pregunten tu edad.",
        evaluationCriteria: [
            {
                id: "maneja_confusion",
                name: "Maneja transcripción confusa",
                conversation_goal_prompt: "Verificar que el agente pide aclaración cuando las respuestas son confusas"
            }
        ]
    }
];

// Función principal para ejecutar pruebas en paralelo
async function runAllTestsParallel() {
    console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}INICIANDO SUITE DE PRUEBAS EN PARALELO - ENERFLEX${colors.reset}`);
    console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}\n`);
    console.log(`${colors.cyan}Configuración:${colors.reset}`);
    console.log(`  • Timeout por prueba: ${CONFIG.TIMEOUT_MS/1000}s`);
    console.log(`  • Reintentos máximos: ${CONFIG.MAX_RETRIES}`);
    console.log(`  • Pruebas simultáneas: ${CONFIG.BATCH_SIZE}`);
    console.log(`  • Total de pruebas: ${testCases.length}\n`);

    const startTime = Date.now();
    const progressTracker = createProgressTracker(testCases.length);
    const results = {
        total: testCases.length,
        passed: 0,
        failed: 0,
        errors: 0,
        details: []
    };

    // Procesar pruebas en lotes
    for (let i = 0; i < testCases.length; i += CONFIG.BATCH_SIZE) {
        const batch = testCases.slice(i, i + CONFIG.BATCH_SIZE);
        console.log(`\n${colors.magenta}Iniciando lote ${Math.floor(i/CONFIG.BATCH_SIZE) + 1}/${Math.ceil(testCases.length/CONFIG.BATCH_SIZE)}${colors.reset}`);

        // Ejecutar lote en paralelo
        const batchPromises = batch.map(async (testCase, index) => {
            const testNumber = i + index + 1;
            log.progress(`[${testNumber}/${testCases.length}] Iniciando: ${testCase.name}`);

            const result = await runSimulationWithRetry(testCase);
            const status = processResult(result, testCase);

            progressTracker.update(testCase.name, status);

            return {
                testName: testCase.name,
                status: status,
                result: result
            };
        });

        // Esperar a que termine el lote
        const batchResults = await Promise.all(batchPromises);

        // Procesar resultados del lote
        batchResults.forEach(({ testName, status, result }) => {
            if (status === 'passed') results.passed++;
            else if (status === 'failed') results.failed++;
            else results.errors++;

            results.details.push({
                testName: testName,
                status: status.toUpperCase(),
                attempts: result.attempts || 1,
                criteria: result.results || {},
                error: result.error
            });
        });
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // Resumen final
    console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}RESUMEN DE RESULTADOS${colors.reset}`);
    console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}\n`);

    console.log(`Total de pruebas: ${results.total}`);
    console.log(`${colors.green}Exitosas: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}Fallidas: ${results.failed}${colors.reset}`);
    console.log(`${colors.yellow}Errores: ${results.errors}${colors.reset}`);
    console.log(`Tasa de éxito: ${((results.passed / results.total) * 100).toFixed(2)}%`);
    console.log(`Tiempo total: ${totalTime}s`);
    console.log(`Tiempo promedio por prueba: ${(totalTime / results.total).toFixed(1)}s`);

    // Guardar resultados
    const fs = await import('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results-parallel-${timestamp}.json`;

    await fs.promises.writeFile(filename, JSON.stringify(results, null, 2));
    log.info(`Resultados guardados en: ${filename}`);

    // Mostrar pruebas fallidas
    if (results.failed > 0 || results.errors > 0) {
        console.log(`\n${colors.red}PRUEBAS CON PROBLEMAS:${colors.reset}`);
        results.details
            .filter(d => d.status !== 'PASSED')
            .forEach(d => {
                console.log(`\n• ${d.testName}`);
                console.log(`  Estado: ${d.status}`);
                console.log(`  Intentos: ${d.attempts}`);
                if (d.error) console.log(`  Error: ${d.error}`);
            });
    }

    return results;
}

// Función para ejecutar una prueba individual
async function runSingleTest(testIndex) {
    if (testIndex < 0 || testIndex >= testCases.length) {
        log.failure(`Índice de prueba inválido. Debe estar entre 0 y ${testCases.length - 1}`);
        return;
    }

    const testCase = testCases[testIndex];
    console.log(`\n${colors.blue}Ejecutando prueba individual: ${testCase.name}${colors.reset}\n`);

    const result = await runSimulationWithRetry(testCase);
    const status = processResult(result, testCase);

    if (result.response?.analysis?.transcript_summary) {
        console.log(`\n${colors.blue}Resumen de la conversación:${colors.reset}`);
        console.log(result.response.analysis.transcript_summary);
    }

    console.log(`\n${colors.blue}Estado final: ${status.toUpperCase()}${colors.reset}`);
}

// Exportar funciones
export {
    runAllTestsParallel,
    runSingleTest,
    testCases,
    runSimulationWithRetry
};

// Si se ejecuta directamente
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        runAllTestsParallel().catch(console.error);
    } else if (args[0] === '--test' && args[1]) {
        const testIndex = parseInt(args[1]);
        runSingleTest(testIndex).catch(console.error);
    } else if (args[0] === '--list') {
        console.log('\nPruebas disponibles:');
        testCases.forEach((test, index) => {
            console.log(`${index}: ${test.name}`);
        });
    } else if (args[0] === '--help') {
        console.log('\nUso:');
        console.log('  node testSet.js              # Ejecutar todas las pruebas en paralelo');
        console.log('  node testSet.js --test <n>   # Ejecutar prueba específica');
        console.log('  node testSet.js --list        # Listar todas las pruebas');
        console.log('  node testSet.js --help        # Mostrar esta ayuda');
        console.log('\nConfiguración de timeout (variables de entorno):');
        console.log('  TIMEOUT_MS=180000            # Timeout en milisegundos (default: 120000)');
        console.log('  MAX_RETRIES=3                # Número de reintentos (default: 2)');
        console.log('  BATCH_SIZE=10                # Pruebas simultáneas (default: 5)');
    }
}