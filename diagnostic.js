// diagnostic.js - Script de diagnóstico para TalkFlow
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('========================================');
console.log('   DIAGNÓSTICO DE SISTEMA TALKFLOW');
console.log('========================================\n');

// 1. Verificar Variables de Entorno
console.log('1. VARIABLES DE ENTORNO');
console.log('------------------------');
const envVars = [
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_AGENT_ID',
  'ELEVENLABS_PHONE_NUMBER_ID',
  'ELEVENLABS_CALLER_NUMBER',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'TWILIO_BYOC_TRUNK_SID',
  'DEFAULT_TO_PHONE_NUMBER',
  'PORT',
  'COOKIE_SECRET'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    // Ocultar valores sensibles
    let displayValue = value;
    if (varName.includes('KEY') || varName.includes('TOKEN') || varName.includes('SECRET')) {
      displayValue = value.substring(0, 8) + '...' + value.substring(value.length - 4);
    }
    console.log(`✓ ${varName}: ${displayValue}`);
  } else {
    console.log(`✗ ${varName}: NO CONFIGURADO`);
  }
});

// 2. Verificar package.json y versiones
console.log('\n\n2. DEPENDENCIAS Y VERSIONES');
console.log('-----------------------------');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  const criticalDeps = [
    'elevenlabs',
    'twilio',
    'fastify',
    '@fastify/websocket'
  ];

  criticalDeps.forEach(dep => {
    const version = packageJson.dependencies[dep];
    if (version) {
      console.log(`✓ ${dep}: ${version}`);
    } else {
      console.log(`✗ ${dep}: NO INSTALADO`);
    }
  });
} catch (error) {
  console.log('✗ Error leyendo package.json:', error.message);
}

// 3. Buscar configuración de ElevenLabs en el código
console.log('\n\n3. CONFIGURACIÓN DE ELEVENLABS');
console.log('---------------------------------');
try {
  const elevenLabsService = fs.readFileSync('services/elevenLabsService.js', 'utf8');

  // Buscar uso de SDK
  if (elevenLabsService.includes('conversationalAi')) {
    console.log('✓ Usando Conversational AI API');
  }

  if (elevenLabsService.includes('phone.create') || elevenLabsService.includes('createPhoneCall')) {
    console.log('✓ Usando Phone API');
  } else {
    console.log('✗ No se detecta uso de Phone API');
  }

  // Buscar configuración del agente
  const agentIdMatch = elevenLabsService.match(/agentId:\s*([A-Za-z0-9_]+)/);
  if (agentIdMatch) {
    console.log(`✓ Agent ID configurado: ${agentIdMatch[1]}`);
  }

} catch (error) {
  console.log('✗ Error leyendo elevenLabsService.js:', error.message);
}

// 4. Verificar configuración de Twilio
console.log('\n\n4. CONFIGURACIÓN DE TWILIO');
console.log('----------------------------');
try {
  const twilioConfig = fs.readFileSync('services/twilio/twilioConfig.js', 'utf8');

  // Verificar si los números son iguales
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  const defaultTo = process.env.DEFAULT_TO_PHONE_NUMBER;

  if (twilioPhone && defaultTo) {
    if (twilioPhone === defaultTo) {
      console.log('⚠️  PROBLEMA: TWILIO_PHONE_NUMBER === DEFAULT_TO_PHONE_NUMBER');
      console.log(`   Ambos están configurados como: ${twilioPhone}`);
    } else {
      console.log('✓ Números de origen y destino son diferentes');
    }
  }

} catch (error) {
  console.log('✗ Error verificando configuración de Twilio:', error.message);
}

// 5. Buscar referencias a números de ElevenLabs
console.log('\n\n5. BÚSQUEDA DE REFERENCIAS A NÚMEROS');
console.log('--------------------------------------');
async function searchInFiles(pattern, directory = '.') {
  try {
    const { stdout } = await execAsync(`grep -r "${pattern}" ${directory} --include="*.js" --include="*.env*" || true`);
    if (stdout.trim()) {
      console.log(`Referencias a "${pattern}":`);
      console.log(stdout.trim().split('\n').slice(0, 5).join('\n'));
      if (stdout.trim().split('\n').length > 5) {
        console.log('... y más referencias');
      }
    } else {
      console.log(`No se encontraron referencias a "${pattern}"`);
    }
  } catch (error) {
    console.log(`Error buscando "${pattern}":`, error.message);
  }
}

await searchInFiles('ELEVENLABS_PHONE');
await searchInFiles('phone_number_id');
await searchInFiles('caller_number');

// 6. Verificar archivos .env
console.log('\n\n6. ARCHIVOS DE CONFIGURACIÓN');
console.log('-------------------------------');
const envFiles = ['.env', '.env.local', '.env.production'];
envFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✓ ${file} existe`);

    // Buscar configuraciones de ElevenLabs
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('ELEVENLABS_PHONE')) {
      console.log(`  → Contiene configuración de teléfono ElevenLabs`);
    }
  } else {
    console.log(`✗ ${file} no existe`);
  }
});

// 7. Verificar estructura de integración
console.log('\n\n7. TIPO DE INTEGRACIÓN DETECTADA');
console.log('----------------------------------');
try {
  const hasPhoneAPI = fs.existsSync('services/elevenLabsPhoneService.js');
  const hasTwilioIntegration = fs.existsSync('services/twilioService.js');

  if (hasPhoneAPI) {
    console.log('✓ Detectada integración con ElevenLabs Phone API');
  }

  if (hasTwilioIntegration) {
    console.log('✓ Detectada integración con Twilio');
  }

  if (hasTwilioIntegration && !hasPhoneAPI) {
    console.log('\n📌 ARQUITECTURA ACTUAL: Twilio (carrier) + ElevenLabs (IA conversacional)');
    console.log('   - Twilio maneja la telefonía');
    console.log('   - ElevenLabs procesa la conversación vía WebSocket');
  }

} catch (error) {
  console.log('✗ Error detectando tipo de integración:', error.message);
}

// 8. Recomendaciones
console.log('\n\n8. RECOMENDACIONES');
console.log('--------------------');

// Verificar si necesita cambios
const needsPhoneAPI = !process.env.TWILIO_PHONE_NUMBER && 
                     (process.env.ELEVENLABS_PHONE_NUMBER_ID || process.env.ELEVENLABS_CALLER_NUMBER);

if (needsPhoneAPI) {
  console.log('⚠️  Parece que quieres usar ElevenLabs Phone API');
  console.log('   Necesitarás modificar la implementación actual');
  console.log('   que está diseñada para usar Twilio como carrier.');
}

if (process.env.TWILIO_PHONE_NUMBER === process.env.DEFAULT_TO_PHONE_NUMBER) {
  console.log('\n⚠️  PROBLEMA CRÍTICO: Los números de origen y destino son iguales');
  console.log('   Twilio no permite llamar del mismo número al mismo número.');
  console.log('   Solución: Configura DEFAULT_TO_PHONE_NUMBER con un número diferente.');
}

console.log('\n========================================');
console.log('   FIN DEL DIAGNÓSTICO');
console.log('========================================');

// Generar resumen para compartir
console.log('\n📋 RESUMEN PARA COMPARTIR:');
console.log('---------------------------');
const summary = {
  elevenlabs: {
    apiKey: !!process.env.ELEVENLABS_API_KEY,
    agentId: !!process.env.ELEVENLABS_AGENT_ID,
    phoneNumberId: !!process.env.ELEVENLABS_PHONE_NUMBER_ID,
    callerNumber: !!process.env.ELEVENLABS_CALLER_NUMBER
  },
  twilio: {
    configured: !!process.env.TWILIO_ACCOUNT_SID,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER ? 'Configurado' : 'NO configurado',
    sameAsDefault: process.env.TWILIO_PHONE_NUMBER === process.env.DEFAULT_TO_PHONE_NUMBER
  },
  architecture: 'Twilio + ElevenLabs WebSocket'
};

console.log(JSON.stringify(summary, null, 2));