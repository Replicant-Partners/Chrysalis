# Crypto/Web3 Adapter Specification

## Overview

The Crypto/Web3 Adapter is designed to provide a standardized interface for interacting with blockchain and distributed ledger technologies, specifically focusing on Hedera, Internet Computer Protocol (ICP), and Agoric. It extends the Universal Adapter pattern to maintain consistency with the existing Chrysalis architecture while providing optimized access to Web3 infrastructure.

## Architecture Integration

### Protocol Support
- **Hedera**: Hashgraph-based distributed ledger with native smart contract support
- **ICP**: Internet Computer Protocol with canister-based smart contracts
- **Agoric**: JavaScript-based smart contract platform with object-capability security

### Adapter Position
The Crypto/Web3 Adapter sits between the Chrysalis core and external blockchain networks, providing a protocol-agnostic interface that can be accessed through the Universal Adapter framework.

## Interface Specification

### Core Operations

#### Wallet Management
- `createWallet(options: WalletOptions): Promise<Wallet>`
  - Creates a new wallet for a specific protocol
  - Returns wallet identifier and public address

- `importWallet(mnemonic: string, options: WalletOptions): Promise<Wallet>`
  - Imports an existing wallet from mnemonic phrase
  - Supports different derivation paths

- `exportWallet(walletId: string, password: string): Promise<ExportedWallet>`
  - Exports wallet data in encrypted format
  - Requires authentication

- `getWalletBalance(walletId: string): Promise<Balance>`
  - Retrieves current balance for a wallet
  - Supports multiple token types

#### Transaction Operations
- `sendTransaction(walletId: string, transaction: Transaction): Promise<TransactionResult>`
  - Sends a transaction from the specified wallet
  - Returns transaction hash and status

- `getTransactionStatus(transactionHash: string, protocol: string): Promise<TransactionStatus>`
  - Retrieves status of a specific transaction
  - Supports cross-protocol lookups

- `estimateTransactionCost(transaction: Transaction): Promise<CostEstimate>`
  - Estimates cost for a proposed transaction
  - Includes gas fees and protocol-specific costs

#### Smart Contract Operations
- `deployContract(walletId: string, contract: ContractDeployment): Promise<ContractInfo>`
  - Deploys a new smart contract
  - Returns contract address and deployment details

- `callContractFunction(contractAddress: string, functionName: string, params: any[], options?: CallOptions): Promise<CallResult>`
  - Calls a function on a deployed smart contract
  - Supports both read and write operations

- `queryContractState(contractAddress: string, query: string): Promise<QueryResult>`
  - Queries the state of a smart contract
  - Supports complex state retrieval patterns

### Protocol-Specific Features

#### Hedera Integration
- `createHederaAccount(walletId: string, initialBalance: number): Promise<HederaAccount>`
  - Creates a new Hedera account
  - Handles HBAR allocation

- `submitHederaConsensusMessage(topicId: string, message: string): Promise<MessageReceipt>`
  - Submits message to Hedera Consensus Service
  - Returns consensus timestamp

- `queryHederaMirrorNode(query: string): Promise<MirrorNodeResult>`
  - Queries Hedera mirror node for transaction data
  - Supports historical data retrieval

#### ICP Integration
- `deployCanister(walletId: string, wasmModule: Uint8Array, initArgs: any): Promise<CanisterInfo>`
  - Deploys a new canister smart contract
  - Handles cycles allocation

- `callCanisterMethod(canisterId: string, methodName: string, args: any): Promise<MethodResult>`
  - Calls a method on a deployed canister
  - Supports update and query calls

- `manageCycles(canisterId: string, operation: CycleOperation): Promise<CycleResult>`
  - Manages cycles for a canister
  - Supports top-up and withdrawal operations

#### Agoric Integration
- `createZoeInvitation(contractId: string, invitationDetails: any): Promise<Invitation>`
  - Creates a new Zoe invitation
  - Handles smart contract interaction setup

- `executeOffer(offer: Offer): Promise<OfferResult>`
  - Executes an Agoric offer
  - Handles escrow and payout operations

- `queryPurseBalance(purseId: string): Promise<PurseBalance>`
  - Queries balance of an Agoric purse
  - Supports multiple asset types

### Cross-Chain Operations

#### Token Management
- `transferTokens(sourceWallet: string, destinationAddress: string, amount: number, tokenType: string): Promise<TransferResult>`
  - Transfers tokens between wallets or addresses
  - Supports cross-chain transfers where available

- `approveTokenSpending(walletId: string, spender: string, amount: number, tokenType: string): Promise<ApprovalResult>`
  - Approves another address to spend tokens
  - Required for many DeFi operations

- `getTokenAllowance(owner: string, spender: string, tokenType: string): Promise<number>`
  - Retrieves current allowance for a spender
  - Supports ERC-20 style allowances

#### Bridge Operations
- `initiateCrossChainTransfer(transfer: CrossChainTransfer): Promise<BridgeTransaction>`
  - Initiates a cross-chain token transfer
  - Returns bridge transaction identifier

- `monitorBridgeTransaction(transactionId: string): Promise<BridgeStatus>`
  - Monitors status of a bridge transaction
  - Provides real-time updates

### Event Subscription

#### Blockchain Event Monitoring
- `subscribeToEvents(filter: EventFilter, callback: EventHandler): Promise<Subscription>`
  - Subscribes to blockchain events matching filter
  - Supports contract events, transactions, and system events

- `unsubscribeFromEvents(subscriptionId: string): Promise<void>`
  - Cancels an existing event subscription
  - Cleans up associated resources

#### Event Types
- `TRANSACTION_CONFIRMED` - A transaction has been confirmed
- `CONTRACT_EVENT` - A smart contract emitted an event
- `BALANCE_CHANGE` - A wallet balance has changed
- `BRIDGE_COMPLETED` - A cross-chain transfer has completed

### Security and Access Control

#### Key Management
- `generateKeyPair(protocol: string, options?: KeyOptions): Promise<KeyPair>`
  - Generates a new key pair for a specific protocol
  - Supports different key types and derivation paths

- `signMessage(walletId: string, message: string): Promise<Signature>`
  - Signs a message with a wallet's private key
  - Returns signature and recovery information

- `verifySignature(message: string, signature: string, publicKey: string, protocol: string): Promise<boolean>`
  - Verifies a signature against a message and public key
  - Supports multiple signature schemes

#### Authentication
- `authenticate(credentials: Credentials): Promise<AuthToken>`
  - Authenticates user/agent with the crypto system
  - Returns token for subsequent authorized operations

#### Authorization
- `authorize(token: AuthToken, operation: string, resourceId?: string): Promise<boolean>`
  - Checks if the authenticated entity is authorized for an operation
  - Supports resource-level and system-level permissions

### Performance Optimization Features

#### Caching
- `enableTransactionCaching(options: CacheOptions): Promise<void>`
  - Enables caching for transaction data
  - Configures cache expiration and invalidation policies

- `invalidateTransactionCache(pattern: string): Promise<void>`
  - Invalidates cached transaction entries
  - Supports selective and bulk cache invalidation

#### Batch Operations
- `batchTransactions(walletId: string, transactions: Transaction[]): Promise<BatchResult>`
  - Submits multiple transactions in a single batch
  - Optimizes for protocol-specific batching capabilities

- `batchContractCalls(calls: ContractCall[]): Promise<BatchResult>`
  - Executes multiple contract calls in a single batch
  - Handles atomicity and error propagation

## Protocol Integration

### Universal Adapter Compatibility
- Implements the standard Universal Adapter interface
- Registers with the protocol registry using semantic categories
- Provides protocol-specific hints for optimization
- Supports dynamic protocol negotiation

### Semantic Categories
- `crypto:wallet` - Wallet management operations
- `crypto:transaction` - Transaction operations
- `crypto:contract` - Smart contract operations
- `crypto:crosschain` - Cross-chain operations
- `crypto:events` - Event subscription and monitoring

### Protocol Hints
- `multi_signature: boolean` - Indicates if multi-signature transactions are supported
- `batching_supported: boolean` - Indicates if batch operations are optimized
- `realtime_events: boolean` - Indicates if real-time event monitoring is available
- `cross_chain: boolean` - Indicates if cross-chain operations are supported

## Error Handling

### Standard Error Types
- `WalletNotFoundError` - Requested wallet does not exist
- `InsufficientFundsError` - Not enough funds for transaction
- `TransactionFailedError` - Transaction execution failed
- `ContractExecutionError` - Smart contract execution failed
- `AuthenticationError` - Authentication failed
- `AuthorizationError` - Insufficient permissions

### Error Metadata
- Error codes for programmatic handling
- Contextual information for debugging
- Suggested recovery actions
- Transaction tracking identifiers

## Performance Considerations

### Latency Targets
- Simple wallet operations: < 50ms
- Transaction submission: < 100ms
- Contract calls: < 200ms
- Cross-chain operations: < 500ms

### Throughput Requirements
- Concurrent transactions: 100+ per second per protocol
- Event subscription scalability: 1000+ concurrent subscriptions
- Batch operation size: Up to 100 transactions

### Resource Management
- Connection pooling for blockchain nodes
- Efficient serialization/deserialization of blockchain data
- Streaming for large transaction sets
- Automatic cleanup of stale connections

## Implementation Strategy

### Phase 1: Core Interface
- Implement basic wallet management operations
- Add transaction submission and monitoring
- Integrate with protocol registry
- Create comprehensive test suite

### Phase 2: Protocol-Specific Features
- Implement Hedera integration
- Add ICP integration
- Implement Agoric integration
- Add smart contract deployment and interaction

### Phase 3: Advanced Features
- Implement cross-chain operations
- Add event subscription system
- Implement batch operations
- Add performance optimization features

### Phase 4: Security
- Implement key management
- Add authentication and authorization
- Implement audit logging
- Add secure communication channels

## Testing Requirements

### Unit Tests
- Individual operation testing
- Protocol-specific functionality verification
- Error condition testing
- Performance benchmarks

### Integration Tests
- End-to-end workflow testing
- Cross-protocol interaction testing
- Protocol compatibility verification
- Security boundary testing

### Load Testing
- Concurrent transaction testing
- Stress testing under high load
- Memory leak detection
- Resource consumption monitoring

## Monitoring and Observability

### Metrics Collection
- Transaction success/failure rates
- Protocol-specific performance metrics
- Resource utilization
- Cache hit/miss ratios

### Logging
- Transaction audit trails
- Performance profiling data
- Error and exception logging
- Debug information for troubleshooting

### Alerting
- Transaction failure rate alerts
- Performance degradation alerts
- Security incident notifications
- Bridge operation monitoring