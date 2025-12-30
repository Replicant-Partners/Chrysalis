#!/usr/bin/env node

/**
 * Cryptographic Primitives MCP Server
 * 
 * Provides foundational cryptographic operations:
 * - Hash functions (SHA-256, SHA-384, SHA-512, BLAKE3)
 * - Merkle trees (construction, proofs, verification)
 * - Ed25519 signatures (generate, sign, verify)
 * - BLS signatures (generate, sign, verify, aggregate)
 * - Cryptographic random (bytes, integers, selection)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import * as hashOps from './hash.js';
import * as merkleOps from './merkle.js';
import * as sigOps from './signatures.js';
import * as randomOps from './random.js';

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: Tool[] = [
  // Hash operations
  {
    name: 'hash',
    description: 'Compute cryptographic hash of data. Supports SHA-256, SHA-384, SHA-512, BLAKE3.',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'Data to hash (hex-encoded or UTF-8 string)'
        },
        algorithm: {
          type: 'string',
          enum: ['SHA-256', 'SHA-384', 'SHA-512', 'BLAKE3'],
          description: 'Hash algorithm (default: SHA-256)',
          default: 'SHA-256'
        },
        encoding: {
          type: 'string',
          enum: ['hex', 'utf8'],
          description: 'Input encoding (default: utf8)',
          default: 'utf8'
        }
      },
      required: ['data']
    }
  },
  {
    name: 'verify_hash',
    description: 'Verify data matches expected hash',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'string',
          description: 'Data to verify'
        },
        expectedHash: {
          type: 'string',
          description: 'Expected hash (hex-encoded)'
        },
        algorithm: {
          type: 'string',
          enum: ['SHA-256', 'SHA-384', 'SHA-512', 'BLAKE3'],
          default: 'SHA-256'
        },
        encoding: {
          type: 'string',
          enum: ['hex', 'utf8'],
          default: 'utf8'
        }
      },
      required: ['data', 'expectedHash']
    }
  },
  
  // Merkle tree operations
  {
    name: 'merkle_root',
    description: 'Build Merkle tree from leaves and return root hash',
    inputSchema: {
      type: 'object',
      properties: {
        leaves: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of leaf data (hex-encoded or UTF-8)'
        },
        algorithm: {
          type: 'string',
          enum: ['SHA-256', 'SHA-384', 'SHA-512', 'BLAKE3'],
          default: 'SHA-256'
        },
        encoding: {
          type: 'string',
          enum: ['hex', 'utf8'],
          default: 'utf8'
        }
      },
      required: ['leaves']
    }
  },
  {
    name: 'merkle_proof',
    description: 'Generate Merkle proof for leaf at index',
    inputSchema: {
      type: 'object',
      properties: {
        leaves: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of leaf data'
        },
        leafIndex: {
          type: 'number',
          description: 'Index of leaf to prove'
        },
        algorithm: {
          type: 'string',
          enum: ['SHA-256', 'SHA-384', 'SHA-512', 'BLAKE3'],
          default: 'SHA-256'
        },
        encoding: {
          type: 'string',
          enum: ['hex', 'utf8'],
          default: 'utf8'
        }
      },
      required: ['leaves', 'leafIndex']
    }
  },
  {
    name: 'verify_merkle_proof',
    description: 'Verify Merkle proof',
    inputSchema: {
      type: 'object',
      properties: {
        proof: {
          type: 'object',
          description: 'Merkle proof object from merkle_proof tool'
        },
        algorithm: {
          type: 'string',
          enum: ['SHA-256', 'SHA-384', 'SHA-512', 'BLAKE3'],
          default: 'SHA-256'
        }
      },
      required: ['proof']
    }
  },
  
  // Ed25519 operations
  {
    name: 'ed25519_keygen',
    description: 'Generate Ed25519 keypair (32-byte keys, 64-byte signatures)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'ed25519_sign',
    description: 'Sign message with Ed25519 private key',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to sign'
        },
        privateKey: {
          type: 'string',
          description: 'Private key (hex-encoded)'
        },
        encoding: {
          type: 'string',
          enum: ['hex', 'utf8'],
          default: 'utf8'
        }
      },
      required: ['message', 'privateKey']
    }
  },
  {
    name: 'ed25519_verify',
    description: 'Verify Ed25519 signature',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message that was signed'
        },
        signature: {
          type: 'string',
          description: 'Signature (hex-encoded)'
        },
        publicKey: {
          type: 'string',
          description: 'Public key (hex-encoded)'
        },
        encoding: {
          type: 'string',
          enum: ['hex', 'utf8'],
          default: 'utf8'
        }
      },
      required: ['message', 'signature', 'publicKey']
    }
  },
  
  // BLS operations
  {
    name: 'bls_keygen',
    description: 'Generate BLS12-381 keypair (supports signature aggregation)',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'bls_sign',
    description: 'Sign message with BLS private key',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to sign'
        },
        privateKey: {
          type: 'string',
          description: 'Private key (hex-encoded)'
        },
        encoding: {
          type: 'string',
          enum: ['hex', 'utf8'],
          default: 'utf8'
        }
      },
      required: ['message', 'privateKey']
    }
  },
  {
    name: 'bls_verify',
    description: 'Verify BLS signature',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message that was signed'
        },
        signature: {
          type: 'string',
          description: 'Signature (hex-encoded)'
        },
        publicKey: {
          type: 'string',
          description: 'Public key (hex-encoded)'
        },
        encoding: {
          type: 'string',
          enum: ['hex', 'utf8'],
          default: 'utf8'
        }
      },
      required: ['message', 'signature', 'publicKey']
    }
  },
  {
    name: 'bls_aggregate_signatures',
    description: 'Aggregate multiple BLS signatures into one',
    inputSchema: {
      type: 'object',
      properties: {
        signatures: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of signatures (hex-encoded)'
        }
      },
      required: ['signatures']
    }
  },
  {
    name: 'bls_aggregate_publickeys',
    description: 'Aggregate multiple BLS public keys',
    inputSchema: {
      type: 'object',
      properties: {
        publicKeys: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of public keys (hex-encoded)'
        }
      },
      required: ['publicKeys']
    }
  },
  
  // Random operations
  {
    name: 'random_bytes',
    description: 'Generate cryptographically secure random bytes',
    inputSchema: {
      type: 'object',
      properties: {
        length: {
          type: 'number',
          description: 'Number of bytes to generate'
        }
      },
      required: ['length']
    }
  },
  {
    name: 'random_int',
    description: 'Generate random integer in range [0, max)',
    inputSchema: {
      type: 'object',
      properties: {
        max: {
          type: 'number',
          description: 'Upper bound (exclusive)'
        }
      },
      required: ['max']
    }
  },
  {
    name: 'random_select',
    description: 'Select random element from array',
    inputSchema: {
      type: 'object',
      properties: {
        array: {
          type: 'array',
          items: {},
          description: 'Array to select from'
        }
      },
      required: ['array']
    }
  },
  {
    name: 'random_sample',
    description: 'Select k random elements from array without replacement',
    inputSchema: {
      type: 'object',
      properties: {
        array: {
          type: 'array',
          items: {},
          description: 'Array to sample from'
        },
        k: {
          type: 'number',
          description: 'Number of elements to select'
        }
      },
      required: ['array', 'k']
    }
  },
  {
    name: 'random_uuid',
    description: 'Generate random UUID v4',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// ============================================================================
// Helper Functions
// ============================================================================

function parseData(data: string, encoding: string = 'utf8'): Uint8Array {
  if (encoding === 'hex') {
    return hashOps.fromHex(data);
  } else {
    return new TextEncoder().encode(data);
  }
}

// ============================================================================
// Server Implementation
// ============================================================================

const server = new Server(
  {
    name: 'crypto-primitives',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error('Arguments are required');
  }
  
  try {
    switch (name) {
      // Hash operations
      case 'hash': {
        const data = parseData(args.data as string, args.encoding as string);
        const result = hashOps.hash(data, (args.algorithm as hashOps.HashAlgorithm) || 'SHA-256');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              hash: hashOps.toHex(result),
              algorithm: (args.algorithm as string) || 'SHA-256'
            }, null, 2)
          }]
        };
      }
      
      case 'verify_hash': {
        const data = parseData(args.data as string, args.encoding as string);
        const expectedHash = hashOps.fromHex(args.expectedHash as string);
        const result = hashOps.verifyHash(data, expectedHash, (args.algorithm as hashOps.HashAlgorithm) || 'SHA-256');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ valid: result }, null, 2)
          }]
        };
      }
      
      // Merkle operations
      case 'merkle_root': {
        const leaves = (args.leaves as string[]).map((leaf: string) => parseData(leaf, args.encoding as string));
        const root = merkleOps.merkleRoot(leaves, (args.algorithm as hashOps.HashAlgorithm) || 'SHA-256');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              root: hashOps.toHex(root),
              algorithm: (args.algorithm as string) || 'SHA-256',
              leafCount: leaves.length
            }, null, 2)
          }]
        };
      }
      
      case 'merkle_proof': {
        const leaves = (args.leaves as string[]).map((leaf: string) => parseData(leaf, args.encoding as string));
        const proof = merkleOps.merkleProof(leaves, args.leafIndex as number, (args.algorithm as hashOps.HashAlgorithm) || 'SHA-256');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              leaf: hashOps.toHex(proof.leaf),
              leafIndex: proof.leafIndex,
              siblings: proof.siblings.map(s => hashOps.toHex(s)),
              root: hashOps.toHex(proof.root),
              treeSize: proof.treeSize
            }, null, 2)
          }]
        };
      }
      
      case 'verify_merkle_proof': {
        // Reconstruct proof with Uint8Arrays
        const proofArg = args.proof as any;
        const proof = {
          leaf: hashOps.fromHex(proofArg.leaf),
          leafIndex: proofArg.leafIndex,
          siblings: proofArg.siblings.map((s: string) => hashOps.fromHex(s)),
          root: hashOps.fromHex(proofArg.root),
          treeSize: proofArg.treeSize
        };
        const result = merkleOps.verifyMerkleProof(proof, (args.algorithm as hashOps.HashAlgorithm) || 'SHA-256');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ valid: result }, null, 2)
          }]
        };
      }
      
      // Ed25519 operations
      case 'ed25519_keygen': {
        const keypair = await sigOps.ed25519GenerateKeypair();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              privateKey: hashOps.toHex(keypair.privateKey),
              publicKey: hashOps.toHex(keypair.publicKey),
              algorithm: 'Ed25519'
            }, null, 2)
          }]
        };
      }
      
      case 'ed25519_sign': {
        const message = parseData(args.message as string, args.encoding as string);
        const privateKey = hashOps.fromHex(args.privateKey as string);
        const signature = await sigOps.ed25519Sign(message, privateKey);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              signature: hashOps.toHex(signature)
            }, null, 2)
          }]
        };
      }
      
      case 'ed25519_verify': {
        const message = parseData(args.message as string, args.encoding as string);
        const signature = hashOps.fromHex(args.signature as string);
        const publicKey = hashOps.fromHex(args.publicKey as string);
        const valid = await sigOps.ed25519Verify(message, signature, publicKey);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ valid }, null, 2)
          }]
        };
      }
      
      // BLS operations
      case 'bls_keygen': {
        const keypair = sigOps.blsGenerateKeypair();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              privateKey: hashOps.toHex(keypair.privateKey),
              publicKey: hashOps.toHex(keypair.publicKey),
              algorithm: 'BLS12-381'
            }, null, 2)
          }]
        };
      }
      
      case 'bls_sign': {
        const message = parseData(args.message as string, args.encoding as string);
        const privateKey = hashOps.fromHex(args.privateKey as string);
        const signature = sigOps.blsSign(message, privateKey);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              signature: hashOps.toHex(signature)
            }, null, 2)
          }]
        };
      }
      
      case 'bls_verify': {
        const message = parseData(args.message as string, args.encoding as string);
        const signature = hashOps.fromHex(args.signature as string);
        const publicKey = hashOps.fromHex(args.publicKey as string);
        const valid = sigOps.blsVerify(message, signature, publicKey);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ valid }, null, 2)
          }]
        };
      }
      
      case 'bls_aggregate_signatures': {
        const signatures = (args.signatures as string[]).map((s: string) => hashOps.fromHex(s));
        const aggregated = sigOps.blsAggregateSignatures(signatures);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              aggregated: hashOps.toHex(aggregated),
              count: signatures.length
            }, null, 2)
          }]
        };
      }
      
      case 'bls_aggregate_publickeys': {
        const publicKeys = (args.publicKeys as string[]).map((pk: string) => hashOps.fromHex(pk));
        const aggregated = sigOps.blsAggregatePublicKeys(publicKeys);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              aggregated: hashOps.toHex(aggregated),
              count: publicKeys.length
            }, null, 2)
          }]
        };
      }
      
      // Random operations
      case 'random_bytes': {
        const bytes = randomOps.randomBytes(args.length as number);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              bytes: hashOps.toHex(bytes),
              length: bytes.length
            }, null, 2)
          }]
        };
      }
      
      case 'random_int': {
        const value = randomOps.randomInt(args.max as number);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              value,
              range: `[0, ${args.max})`
            }, null, 2)
          }]
        };
      }
      
      case 'random_select': {
        const selected = randomOps.randomSelect(args.array as any[]);
        return {
          content: [{
            type: 'text',
          text: JSON.stringify({
            selected,
            arrayLength: (args.array as any[]).length
          }, null, 2)
        }]
      };
      }
      
      case 'random_sample': {
        const sample = randomOps.randomSample(args.array as any[], args.k as number);
        return {
          content: [{
            type: 'text',
          text: JSON.stringify({
            sample,
            sampleSize: sample.length,
            arrayLength: (args.array as any[]).length
          }, null, 2)
        }]
      };
      }
      
      case 'random_uuid': {
        const uuid = randomOps.randomUUID();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ uuid }, null, 2)
          }]
        };
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: errorMessage }, null, 2)
      }],
      isError: true
    };
  }
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Cryptographic Primitives MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
