#!/usr/bin/env node
/**
 * Direct Ollama API Test
 * Tests Ollama connectivity and basic inference
 */

async function testOllama() {
  console.log('Testing Ollama API connectivity...\n');

  // Test 1: Version check
  try {
    const versionRes = await fetch('http://localhost:11434/api/version');
    const version = await versionRes.json();
    console.log('✅ Ollama version:', version.version);
  } catch (error) {
    console.error('❌ Version check failed:', error.message);
    process.exit(1);
  }

  // Test 2: Simple generation
  console.log('\nTesting simple generation with mistral:latest...\n');
  
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral:latest',
        prompt: 'Say hello in exactly 5 words.',
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 50
        }
      })
    });

    if (!response.ok) {
      console.error('❌ HTTP Error:', response.status, response.statusText);
      process.exit(1);
    }

    const data = await response.json();
    const latency = Date.now() - startTime;

    console.log('✅ Generation successful!');
    console.log('   Latency:', latency, 'ms');
    console.log('   Response:', data.response);
    console.log('   Tokens in:', data.prompt_eval_count);
    console.log('   Tokens out:', data.eval_count);
    console.log('   Done:', data.done);

  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }

  console.log('\n✅ All tests passed!');
}

testOllama();
