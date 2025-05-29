import { ElevenLabsClient } from "elevenlabs";

// Configuración
const AGENT_ID = "KmPa2LWqjFasERSKkFsg";
const client = new ElevenLabsClient();

// Colores para output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Helper para logging
const log = {
    success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
    failure: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠ ${msg}${colors.reset}`)
};

// Función helper para esperar entre pruebas
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para ejecutar una simulación
async function runSimulation(testCase) {
    try {
        log.info(`Ejecutando prueba: ${testCase.name}`);

        const response = await client.conversationalAi.agents.simulateConversation(
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

        return {
            testName: testCase.name,
            success: true,
            response: response,
            results: response.analysis?.evaluation_criteria_results || {}
        };
    } catch (error) {
        return {
            testName: testCase.name,
            success: false,
            error: error.message
        };
    }
}

// Definición de todos los casos de prueba
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

// Función principal para ejecutar todas las pruebas
async function runAllTests() {
    console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}INICIANDO SUITE DE PRUEBAS - ENERFLEX SALES BOT${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

    const results = {
        total: testCases.length,
        passed: 0,
        failed: 0,
        details: []
    };

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`\n${colors.yellow}[${i + 1}/${testCases.length}] ${testCase.name}${colors.reset}`);
        console.log(`${'-'.repeat(50)}`);

        const result = await runSimulation(testCase);

        if (result.success) {
            // Analizar los criterios de evaluación
            let allCriteriaPassed = true;
            const criteriaResults = result.results;

            for (const criteria of testCase.evaluationCriteria) {
                const criteriaResult = criteriaResults[criteria.id];
                if (criteriaResult) {
                    if (criteriaResult.result === 'success') {
                        log.success(`${criteria.name}: PASÓ`);
                    } else {
                        log.failure(`${criteria.name}: FALLÓ - ${criteriaResult.rationale}`);
                        allCriteriaPassed = false;
                    }
                } else {
                    log.warning(`${criteria.name}: Sin resultado`);
                    allCriteriaPassed = false;
                }
            }

            if (allCriteriaPassed) {
                results.passed++;
                log.success(`Test completado exitosamente`);
            } else {
                results.failed++;
                log.failure(`Test falló en algunos criterios`);
            }

            results.details.push({
                testName: testCase.name,
                status: allCriteriaPassed ? 'PASSED' : 'FAILED',
                criteria: criteriaResults
            });

        } else {
            results.failed++;
            log.failure(`Error en la prueba: ${result.error}`);
            results.details.push({
                testName: testCase.name,
                status: 'ERROR',
                error: result.error
            });
        }

        // Esperar entre pruebas para no sobrecargar la API
        if (i < testCases.length - 1) {
            log.info('Esperando 2 segundos antes de la siguiente prueba...');
            await sleep(2000);
        }
    }

    // Resumen final
    console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}RESUMEN DE RESULTADOS${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}\n`);

    console.log(`Total de pruebas: ${results.total}`);
    console.log(`${colors.green}Exitosas: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}Fallidas: ${results.failed}${colors.reset}`);
    console.log(`Tasa de éxito: ${((results.passed / results.total) * 100).toFixed(2)}%`);

    // Guardar resultados en archivo
    const fs = await import('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results-${timestamp}.json`;

    await fs.promises.writeFile(filename, JSON.stringify(results, null, 2));
    log.info(`Resultados guardados en: ${filename}`);

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

    const result = await runSimulation(testCase);

    if (result.success) {
        console.log('\nResultados de criterios:');
        for (const [criteriaId, criteriaResult] of Object.entries(result.results)) {
            console.log(`\n${colors.yellow}${criteriaId}:${colors.reset}`);
            console.log(`Estado: ${criteriaResult.result === 'success' ? colors.green + 'ÉXITO' : colors.red + 'FALLO'}${colors.reset}`);
            console.log(`Razón: ${criteriaResult.rationale}`);
        }

        // Mostrar resumen de la conversación si está disponible
        if (result.response.analysis?.transcript_summary) {
            console.log(`\n${colors.blue}Resumen de la conversación:${colors.reset}`);
            console.log(result.response.analysis.transcript_summary);
        }
    } else {
        log.failure(`Error: ${result.error}`);
    }
}

// Exportar funciones y datos para uso modular
export {
    runAllTests,
    runSingleTest,
    testCases,
    runSimulation
};

// Si se ejecuta directamente desde línea de comandos
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (process.argv[1] === __filename) {
    // Parsear argumentos de línea de comandos
    const args = process.argv.slice(2);

    if (args.length === 0) {
        // Ejecutar todas las pruebas
        runAllTests().catch(console.error);
    } else if (args[0] === '--test' && args[1]) {
        // Ejecutar prueba individual
        const testIndex = parseInt(args[1]);
        runSingleTest(testIndex).catch(console.error);
    } else if (args[0] === '--list') {
        // Listar todas las pruebas
        console.log('\nPruebas disponibles:');
        testCases.forEach((test, index) => {
            console.log(`${index}: ${test.name}`);
        });
    } else {
        console.log('\nUso:');
        console.log('  node testSet.js              # Ejecutar todas las pruebas');
        console.log('  node testSet.js --test <n>   # Ejecutar prueba específica');
        console.log('  node testSet.js --list        # Listar todas las pruebas');
    }
}