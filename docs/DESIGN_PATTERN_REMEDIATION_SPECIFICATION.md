# Design Pattern Remediation Specification

**Status**: Requirements Elicitation Complete  
**Date**: 2026-01-11  
**Methodology**: Sequential Interrogation with Structured Decision Analysis  
**Scope**: Chrysalis Project Design Pattern Fidelity Enhancement

---

## Executive Summary

This specification documents architectural decisions for resolving seven critical design pattern implementation gaps and antipatterns identified through codebase analysis. Each decision was elicited through structured interrogation examining trade-offs, constraints, and architectural implications.

The remediation addresses three architectural layers:
1. **Terminal Protocol Layer**: Canvas rendering with heterogeneous node types
2. **Service Orchestration Layer**: Knowledge/Skill/Agent builder coupling
3. **UI Component Layer**: Type-unsafe rendering and state management

---

## Architectural Decisions

### Task 1: Visitor Pattern Completion for Canvas Node Traversal

**Problem Analysis**:
- Visitor interface defined in [`ui/src/components/JSONCanvas/visitors/CanvasNodeVisitor.ts`](ui/src/components/JSONCanvas/visitors/CanvasNodeVisitor.ts:51-139)
- Node types are TypeScript interfaces (not classes) in [`src/terminal/protocols/types.ts`](src/terminal/protocols/types.ts:183-230)
- Interfaces cannot implement `accept()` method for double-dispatch
- Nodes stored as plain data in YJS CRDT ([`ChrysalisTerminal.ts`](src/terminal/ChrysalisTerminal.ts:403))
- Current rendering uses switch statements ([`JSONCanvas.tsx`](ui/src/components/JSONCanvas/JSONCanvas.tsx:111-151))

**Root Cause**:  
Classic Visitor pattern requires classes with `accept()` methods. TypeScript interfaces are compile-time constructs that cannot carry runtime behavior. CRDT synchronization requires serializable plain objects, preventing class-based nodes.

**Decision**: **Wrapper Class Pattern at UI Boundary**

**Architecture**:
```typescript
// Node wrapper adding accept() method
class CanvasNodeWrapper<T extends CanvasNode> {
  constructor(private node: T) {}
  
  accept<R>(visitor: CanvasNodeVisitor<R>): R {
    const methodName = VISITOR_METHOD_MAP[this.node.type];
    return visitor[methodName](this.node as any);
  }
  
  unwrap(): T {
    return this.node;
  }
}

// Usage at rendering boundary
const wrapped = new CanvasNodeWrapper(plainNode);
const element = wrapped.accept(renderVisitor);
```

**Rationale**:
- Preserves classic Visitor double-dispatch semantics
- Nodes remain pure data structures for CRDT compatibility
- Wrapper lifecycle scoped to visitor operations (no persistent overhead)
- Type-safe visitor dispatch with existing `VISITOR_METHOD_MAP`
- Minimal changes to existing visitor implementations

**Trade-offs Accepted**:
- Object allocation overhead during visitor operations
- Wrap/unwrap ceremony at UI boundaries
- Wrapper classes add indirection layer

**Implementation Scope**:
- Create `CanvasNodeWrapper<T>` generic class
- Add factory function `wrapNode(node: CanvasNode): CanvasNodeWrapper<CanvasNode>`
- Update rendering logic to use wrapper pattern
- Preserve existing visitor interface unchanged

---

### Task 2: Builder Pattern Coupling in Service Layer

**Problem Analysis**:
- Three builder services: [`AgentBuilder`](projects/AgentBuilder/server.py), [`KnowledgeBuilder`](projects/KnowledgeBuilder/server.py), [`SkillBuilder`](projects/SkillBuilder/server.py)
- Identical dependency imports from `shared.api_core` (lines 21-36 in each)
- Duplicated middleware setup, error handling, pagination logic
- AgentBuilder couples to downstream services via HTTP (lines 127-158)
- All services share `_apply_filter()` and `_apply_sorting()` implementations

**Root Cause**:  
No abstraction layer for common builder service concerns. Each service independently constructs Flask app, imports dependencies, and implements identical query/pagination logic. Lack of template method or base class forces duplication.

**Decision**: **ServiceBuilder Base Class with Template Method Pattern**

**Architecture**:
```python
# shared/service_builder/base.py
class ServiceBuilder:
    """Base class for builder services using Template Method pattern."""
    
    def __init__(self, service_name: str, port: int, api_version: str = "v1"):
        self.app = Flask(service_name)
        self.service_name = service_name
        self.port = port
        self.api_version = api_version
        self._setup_middleware()
        self._setup_swagger()
        self._register_common_routes()
        
    def _setup_middleware(self):
        """Template method: Setup common middleware."""
        create_error_handler(self.app)
        create_all_middleware(self.app, api_version=self.api_version)
    
    def _setup_swagger(self):
        """Template method: Setup Swagger docs."""
        # Common Swagger configuration
        pass
    
    def _register_common_routes(self):
        """Template method: Register health/info routes."""
        @self.app.route('/health', methods=['GET'])
        def health():
            return self.health_check()
    
    # Hook methods for subclasses
    def health_check(self) -> dict:
        """Override: Service-specific health check."""
        raise NotImplementedError
    
    def register_routes(self):
        """Override: Register service-specific routes."""
        raise NotImplementedError
    
    # Common utilities
    def apply_filter(self, value, op, op_value) -> bool:
        """Shared filter logic."""
        # Implementation from current _apply_filter
        pass
    
    def apply_sorting(self, items, sort_params):
        """Shared sorting logic."""
        # Implementation from current _apply_sorting
        pass
    
    def run(self, debug: bool = True):
        """Run the service."""
        self.register_routes()
        print(f'--- {self.service_name} Server Starting ---')
        self.app.run(port=self.port, debug=debug)

# Usage in AgentBuilder
class AgentBuilderService(ServiceBuilder):
    def __init__(self):
        super().__init__("AgentBuilder", port=5000)
        self.agents_store = {}
        
    def health_check(self) -> dict:
        return {"status": "healthy", "service": "agentbuilder"}
    
    def register_routes(self):
        @self.app.route('/api/v1/agents', methods=['POST'])
        @require_auth
        def create_agent():
            # Agent-specific logic
            pass
```

**Rationale**:
- Eliminates duplication across all three builder services
- Template Method enforces consistent middleware/error handling setup
- Subclasses override only service-specific behavior
- Shared utilities (filtering, sorting, validation) centralized
- Preserves Flask request handling patterns

**Trade-offs Accepted**:
- Inheritance coupling between services and base class
- Base class changes affect all services
- Single inheritance limits composition flexibility

**Implementation Scope**:
- Create `shared/service_builder/base.py` with ServiceBuilder class
- Refactor AgentBuilder, KnowledgeBuilder, SkillBuilder to inherit
- Extract common utilities to base class
- Update tests to verify template method behavior

---

### Task 3: Primitive Obsession in Widget Type Handling

**Problem Analysis**:
- Widget type discrimination uses string literals in [`WidgetRenderer.tsx`](ui/src/components/JSONCanvas/WidgetRenderer.tsx:262-294)
- Switch statement on `widgetType` property (12+ cases)
- No compile-time validation preventing typos ('markdwon' vs 'markdown')
- `WidgetDefinition` interface exists but not used for type safety
- Runtime-only error detection for invalid widget types

**Root Cause**:  
String primitive used as type discriminator without type system enforcement. TypeScript cannot validate string literals at compile time without explicit union type. Adding new widget types silently fails if switch case omitted.

**Decision**: **TypeScript String Literal Union with Exhaustiveness Checking**

**Architecture**:
```typescript
// Define exhaustive widget type union
export type WidgetType = 
  | 'markdown'
  | 'code'
  | 'chart'
  | 'table'
  | 'image'
  | 'button'
  | 'input'
  | 'memory-viewer'
  | 'skill-executor'
  | 'conversation'
  | 'api-key-wallet'
  | 'settings';

// Const assertion for runtime validation
export const WIDGET_TYPES = [
  'markdown',
  'code',
  'chart',
  'table',
  'image',
  'button',
  'input',
  'memory-viewer',
  'skill-executor',
  'conversation',
  'api-key-wallet',
  'settings'
] as const;

// Update WidgetNode interface
export interface WidgetNode extends BaseCanvasNode {
  type: 'widget';
  widgetType: WidgetType;  // <-- Now type-safe
  widgetVersion: string;
  props: Record<string, unknown>;
  state: Record<string, unknown>;
  createdBy: ParticipantId;
}

// Type guard with exhaustiveness check
function isValidWidgetType(type: string): type is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(type);
}

// Exhaustive switch with never check
function renderWidget(widget: WidgetNode): ReactElement {
  switch (widget.widgetType) {
    case 'markdown': return <MarkdownWidget {...} />;
    case 'code': return <CodeWidget {...} />;
    case 'chart': return <ChartWidget {...} />;
    case 'table': return <TableWidget {...} />;
    case 'image': return <ImageWidget {...} />;
    case 'button': return <ButtonWidget {...} />;
    case 'input': return <InputWidget {...} />;
    case 'memory-viewer': return <MemoryViewerWidget {...} />;
    case 'skill-executor': return <SkillExecutorWidget {...} />;
    case 'conversation': return <ConversationWidget {...} />;
    case 'api-key-wallet': return <ApiKeyWalletWidget {...} />;
    case 'settings': return <SettingsWidget {...} />;
    default:
      // Exhaustiveness check
      const exhaustive: never = widget.widgetType;
      throw new Error(`Unhandled widget type: ${exhaustive}`);
  }
}
```

**Rationale**:
- Compile-time type checking prevents typos
- TypeScript enforces exhaustiveness via `never` type
- Adding new widget type causes compile error if switch case missing
- Zero runtime overhead beyond type checking
- Compatible with CRDT serialization (still plain strings at runtime)
- WidgetRegistry can validate against union type

**Trade-offs Accepted**:
- Adding new widget types requires code changes (not purely runtime extensible)
- Union type must be updated in protocol definition
- Const assertion duplicates type information

**Implementation Scope**:
- Define `WidgetType` union in `types.ts`
- Update `WidgetNode` interface with typed `widgetType`
- Add exhaustiveness check to switch statements
- Create runtime validation guard `isValidWidgetType()`
- Update WidgetRegistry to enforce type membership

---

### Task 4: Strategy Pattern for Validation Logic

**Problem Analysis**:
- Dual validation approaches: Imperative ([`RequestValidator`](shared/api_core/models.py:342-389)) and Declarative ([`Pydantic schemas`](shared/api_core/schemas.py:221))
- No abstraction allowing strategy selection
- Validation rules embedded in static methods (`require_string`, `require_integer`, `require_field`)
- Services choose validation approach at call sites inconsistently
- No mechanism for composing or extending validation rules

**Root Cause**:  
Validation logic coupled to specific implementation approaches. No common interface enables switching between imperative and declarative strategies. Cannot compose validations or add custom rules without modifying RequestValidator class.

**Decision**: **ValidationStrategy Interface with Strategy Pattern**

**Architecture**:
```python
# shared/api_core/validation/strategy.py
from abc import ABC, abstractmethod
from typing import Any, Dict, List

class ValidationStrategy(ABC):
    """Abstract validation strategy."""
    
    @abstractmethod
    def validate(self, data: Dict[str, Any], rules: Dict[str, Any]) -> 'ValidationResult':
        """Execute validation strategy."""
        pass

class ValidationResult:
    """Validation result container."""
    def __init__(self, valid: bool, errors: List[str], validated_data: Dict[str, Any]):
        self.valid = valid
        self.errors = errors
        self.validated_data = validated_data

class ImperativeValidationStrategy(ValidationStrategy):
    """Imperative validation using RequestValidator."""
    
    def validate(self, data: Dict[str, Any], rules: Dict[str, Any]) -> ValidationResult:
        errors = []
        validated = {}
        
        for field, constraints in rules.items():
            try:
                if constraints.get('type') == 'string':
                    validated[field] = RequestValidator.require_string(
                        data, field, 
                        min_length=constraints.get('min_length'),
                        max_length=constraints.get('max_length')
                    )
                elif constraints.get('type') == 'integer':
                    validated[field] = RequestValidator.require_integer(
                        data, field,
                        min_value=constraints.get('min_value'),
                        max_value=constraints.get('max_value')
                    )
            except ValidationError as e:
                errors.append(str(e))
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            validated_data=validated
        )

class DeclarativeValidationStrategy(ValidationStrategy):
    """Declarative validation using Pydantic."""
    
    def __init__(self, model_class):
        self.model_class = model_class
    
    def validate(self, data: Dict[str, Any], rules: Dict[str, Any]) -> ValidationResult:
        try:
            validated = validate_with_pydantic(self.model_class, data)
            return ValidationResult(
                valid=True,
                errors=[],
                validated_data=validated.model_dump()
            )
        except ValidationError as e:
            return ValidationResult(
                valid=False,
                errors=[str(e)],
                validated_data={}
            )

class ValidationContext:
    """Context for selecting validation strategy."""
    
    def __init__(self, strategy: ValidationStrategy):
        self._strategy = strategy
    
    def set_strategy(self, strategy: ValidationStrategy):
        self._strategy = strategy
    
    def validate(self, data: Dict[str, Any], rules: Dict[str, Any]) -> ValidationResult:
        return self._strategy.validate(data, rules)

# Configuration-driven selection
class ValidationStrategyFactory:
    """Factory for creating validation strategies."""
    
    @staticmethod
    def create(strategy_type: str, **kwargs) -> ValidationStrategy:
        if strategy_type == 'imperative':
            return ImperativeValidationStrategy()
        elif strategy_type == 'declarative':
            model_class = kwargs.get('model_class')
            if not model_class:
                raise ValueError("Declarative strategy requires model_class")
            return DeclarativeValidationStrategy(model_class)
        else:
            raise ValueError(f"Unknown validation strategy: {strategy_type}")
```

**Rationale**:
- Clean separation between imperative and declarative approaches
- Context object enables runtime strategy selection
- Factory pattern simplifies strategy instantiation
- Both existing validation approaches preserved
- Services can configure validation via dependency injection
- Extensible for future validation strategies (custom business rules)

**Trade-offs Accepted**:
- Strategy registration mechanism adds complexity
- Factory requires strategy type configuration
- Indirection layer between caller and validation logic

**Implementation Scope**:
- Create `shared/api_core/validation/strategy.py`
- Implement ValidationStrategy interface and concrete strategies
- Create ValidationContext and ValidationStrategyFactory
- Update service initialization to inject validation strategy
- Maintain backward compatibility with existing RequestValidator

---

### Task 5: Factory Pattern Centralization for Node Creation

**Problem Analysis**:
- Node creation scattered across [`ChrysalisTerminal`](src/terminal/ChrysalisTerminal.ts:403-456): `addNode<T>()`, `addWidget()`
- Helper methods in [`AgentTerminalClient.ts`](src/terminal/AgentTerminalClient.ts:300-347): `createMarkdownWidget()`, `createCodeWidget()`, etc.
- ID generation (`generateId()`) duplicated at creation sites
- Position/size defaults handled inconsistently
- No centralized validation of node properties
- Adding new node types requires modifying multiple locations

**Root Cause**:  
Factory responsibilities (construction, defaults, validation, ID generation) distributed across codebase. No single point of control for node instantiation. WidgetRegistry validates definitions but doesn't handle creation.

**Decision**: **Abstract Factory with Type-Specific Concrete Factories**

**Architecture**:
```typescript
// Abstract factory interface
interface NodeFactory<T extends CanvasNode> {
  createNode(params: NodeCreationParams): T;
  validateParams(params: NodeCreationParams): ValidationResult;
  getDefaultSize(): { width: number; height: number };
}

interface NodeCreationParams {
  position: { x: number; y: number };
  size?: { width: number; height: number };
  [key: string]: unknown;
}

// Concrete factories
class TextNodeFactory implements NodeFactory<TextNode> {
  createNode(params: NodeCreationParams & { text: string }): TextNode {
    return {
      id: generateId(),
      type: 'text',
      x: params.position.x,
      y: params.position.y,
      width: params.size?.width ?? this.getDefaultSize().width,
      height: params.size?.height ?? this.getDefaultSize().height,
      text: params.text
    };
  }
  
  validateParams(params: NodeCreationParams): ValidationResult {
    if (!params.text || typeof params.text !== 'string') {
      return { valid: false, errors: ['text is required'] };
    }
    return { valid: true, errors: [] };
  }
  
  getDefaultSize() {
    return { width: 200, height: 100 };
  }
}

class WidgetNodeFactory implements NodeFactory<WidgetNode> {
  constructor(
    private widgetRegistry: WidgetRegistry,
    private participantId: ParticipantId
  ) {}
  
  createNode(params: NodeCreationParams & { 
    widgetType: WidgetType; 
    props: Record<string, unknown> 
  }): WidgetNode {
    const definition = this.widgetRegistry.get(params.widgetType);
    if (!definition) {
      throw new Error(`Unknown widget type: ${params.widgetType}`);
    }
    
    const validation = this.widgetRegistry.validateProps(params.widgetType, params.props);
    if (!validation.valid) {
      throw new Error(`Invalid props: ${validation.errors.join(', ')}`);
    }
    
    return {
      id: generateId(),
      type: 'widget',
      x: params.position.x,
      y: params.position.y,
      width: params.size?.width ?? definition.defaultWidth,
      height: params.size?.height ?? definition.defaultHeight,
      widgetType: params.widgetType,
      widgetVersion: definition.version,
      props: params.props,
      state: {},
      createdBy: this.participantId
    };
  }
  
  validateParams(params: NodeCreationParams): ValidationResult {
    // Validation logic
    return { valid: true, errors: [] };
  }
  
  getDefaultSize() {
    return { width: 300, height: 200 };
  }
}

// Factory registry
class NodeFactoryRegistry {
  private factories: Map<CanvasNodeType, NodeFactory<any>> = new Map();
  
  register<T extends CanvasNode>(type: T['type'], factory: NodeFactory<T>): void {
    this.factories.set(type, factory);
  }
  
  getFactory<T extends CanvasNode>(type: T['type']): NodeFactory<T> | undefined {
    return this.factories.get(type);
  }
  
  createNode<T extends CanvasNode>(
    type: T['type'], 
    params: NodeCreationParams
  ): T {
    const factory = this.getFactory<T>(type);
    if (!factory) {
      throw new Error(`No factory registered for node type: ${type}`);
    }
    
    const validation = factory.validateParams(params);
    if (!validation.valid) {
      throw new Error(`Invalid params: ${validation.errors.join(', ')}`);
    }
    
    return factory.createNode(params as any);
  }
}
```

**Rationale**:
- Each node type has dedicated factory encapsulating creation logic
- Factory interface enforces validation, defaults, and construction protocol
- Registry enables extensibility - new node types register factories
- Type safety via generic constraints on factory interface
- Centralized ID generation and validation
- ChrysalisTerminal delegates to registry rather than implementing creation

**Trade-offs Accepted**:
- Verbose factory hierarchy (one factory per node type)
- Type-specific parameter interfaces required
- Factory registration overhead at initialization

**Implementation Scope**:
- Create `src/terminal/factories/` directory structure
- Implement `NodeFactory<T>` interface
- Create concrete factories: TextNodeFactory, FileNodeFactory, LinkNodeFactory, GroupNodeFactory, WidgetNodeFactory
- Implement NodeFactoryRegistry
- Refactor ChrysalisTerminal.addNode() to use registry
- Update AgentTerminalClient helper methods to delegate to factories

---

### Task 6: Observer Pattern Completion for State Synchronization

**Problem Analysis**:
- Event system exists in [`ChrysalisTerminal`](src/terminal/ChrysalisTerminal.ts:674-721): `emit()`, `on()`, `onAny()`
- Event handlers stored in Map without lifecycle tracking (line 52)
- YJS observers setup in `setupObservers()` (line 171)
- No memory leak prevention - handlers accumulate in long-lived terminals
- `destroy()` method doesn't clean up subscriptions (line 767)
- Async handlers have no ordering guarantees
- No subscription disposal tracking

**Root Cause**:  
Custom event emitter lacks subscription lifecycle management. Map-based handler storage prevents automatic cleanup. No mechanism to track subscription context or detect stale handlers. YJS observers not integrated with terminal cleanup.

**Decision**: **RxJS Observable Integration for Event Management**

**Architecture**:
```typescript
import { Subject, Observable, Subscription, merge } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

class ChrysalisTerminal {
  // Replace event handler Map with RxJS Subjects
  private eventSubjects: Map<TerminalEventType, Subject<TerminalEvent>> = new Map();
  private allEventsSubject: Subject<TerminalEvent> = new Subject();
  private destroySubject: Subject<void> = new Subject();
  private subscriptions: Subscription = new Subscription();
  
  constructor(config: Partial<TerminalConfig>) {
    // ... existing setup ...
    this.setupObservers();
  }
  
  /**
   * Emit event through RxJS subject
   */
  private emit(event: TerminalEvent): void {
    // Emit to specific event type subject
    const subject = this.eventSubjects.get(event.type);
    if (subject) {
      subject.next(event);
    }
    
    // Emit to all events subject
    this.allEventsSubject.next(event);
  }
  
  /**
   * Subscribe to specific event type
   * Returns Subscription with automatic cleanup
   */
  on(eventType: TerminalEventType, handler: TerminalEventHandler): Subscription {
    // Get or create subject for event type
    let subject = this.eventSubjects.get(eventType);
    if (!subject) {
      subject = new Subject<TerminalEvent>();
      this.eventSubjects.set(eventType, subject);
    }
    
    // Subscribe with automatic cleanup on destroy
    const subscription = subject
      .pipe(takeUntil(this.destroySubject))
      .subscribe({
        next: (event) => {
          try {
            handler(event);
          } catch (error) {
            console.error(`Event handler error for ${event.type}:`, error);
          }
        }
      });
    
    // Track subscription for cleanup
    this.subscriptions.add(subscription);
    return subscription;
  }
  
  /**
   * Subscribe to all events
   */
  onAny(handler: TerminalEventHandler): Subscription {
    const subscription = this.allEventsSubject
      .pipe(takeUntil(this.destroySubject))
      .subscribe({
        next: (event) => {
          try {
            handler(event);
          } catch (error) {
            console.error(`Event handler error:`, error);
          }
        }
      });
    
    this.subscriptions.add(subscription);
    return subscription;
  }
  
  /**
   * Observable for specific event type (composable)
   */
  observe(eventType: TerminalEventType): Observable<TerminalEvent> {
    let subject = this.eventSubjects.get(eventType);
    if (!subject) {
      subject = new Subject<TerminalEvent>();
      this.eventSubjects.set(eventType, subject);
    }
    return subject.asObservable().pipe(takeUntil(this.destroySubject));
  }
  
  /**
   * Observable for all events (composable)
   */
  observeAll(): Observable<TerminalEvent> {
    return this.allEventsSubject.asObservable().pipe(takeUntil(this.destroySubject));
  }
  
  /**
   * Destroy terminal with automatic cleanup
   */
  destroy(): void {
    // Signal all subscriptions to complete
    this.destroySubject.next();
    this.destroySubject.complete();
    
    // Unsubscribe all tracked subscriptions
    this.subscriptions.unsubscribe();
    
    // Complete all event subjects
    this.eventSubjects.forEach(subject => subject.complete());
    this.allEventsSubject.complete();
    
    // Cleanup YJS
    this.disconnect();
    this.doc.destroy();
  }
  
  /**
   * Setup YJS observers with RxJS integration
   */
  private setupObservers(): void {
    const leftMessages = this.yLeftPane.get('messages') as Y.Array<unknown>;
    
    // Convert YJS observer to RxJS observable
    const leftMessageObservable = new Observable<ChatMessage>(subscriber => {
      const observer = (event: Y.YArrayEvent<unknown>) => {
        if (event.changes.added.size > 0) {
          event.changes.added.forEach((item) => {
            const content = item.content as Y.ContentAny;
            if (content && 'arr' in content) {
              (content.arr as unknown[]).forEach((msg) => {
                subscriber.next(msg as ChatMessage);
              });
            }
          });
        }
      };
      
      leftMessages?.observe(observer);
      
      // Cleanup on unsubscribe
      return () => leftMessages?.unobserve(observer);
    });
    
    // Subscribe and emit terminal events
    const subscription = leftMessageObservable
      .pipe(takeUntil(this.destroySubject))
      .subscribe(msg => {
        this.emit({
          type: 'chat:message',
          sessionId: this.sessionId,
          participantId: msg.senderId,
          timestamp: Date.now(),
          payload: { frame: 'left', message: msg }
        });
      });
    
    this.subscriptions.add(subscription);
    
    // Similar setup for right pane, canvas nodes, etc.
  }
}
```

**Rationale**:
- RxJS Subject provides battle-tested Observable pattern
- Automatic subscription cleanup via `takeUntil(destroySubject)`
- Built-in memory leak prevention
- Composable via RxJS operators (filter, map, debounce, etc.)
- Integration with YJS observers via Observable wrapper
- Subscription objects provide explicit lifecycle control
- No manual handler tracking required

**Trade-offs Accepted**:
- External dependency on RxJS library
- Learning curve for RxJS operators
- Slightly larger bundle size
- Migration effort from custom event system

**Implementation Scope**:
- Add RxJS dependency to `package.json`
- Replace Map-based event handlers with Subject instances
- Implement `observe()` and `observeAll()` methods
- Integrate YJS observers with RxJS observables
- Update `destroy()` to complete subjects and unsubscribe all
- Add `takeUntil(destroySubject)` to all subscriptions
- Update existing event handler call sites

---

### Task 7: Dependency Inversion Through Interface Extraction

**Problem Analysis**:
- Builder services directly import concrete classes from [`shared.api_core`](shared/api_core/__init__.py:20-26)
- ChrysalisTerminal depends on concrete [`WebsocketProvider`](src/terminal/ChrysalisTerminal.ts:16), [`WidgetRegistry`](src/terminal/ChrysalisTerminal.ts:36)
- No abstraction between consumers and implementations
- AgentBuilder HTTP client uses concrete `requests` library (line 12)
- Interface Segregation violation: shared.api_core exports 30+ symbols as monolithic module
- Services cannot be tested in isolation without concrete dependencies

**Root Cause**:  
High-level modules depend on low-level modules violating Dependency Inversion Principle. No interface layer enables mocking or alternative implementations. Monolithic shared module forces clients to import entire API surface rather than focused interfaces.

**Decision**: **Ports and Adapters (Hexagonal) Architecture**

**Architecture**:
```
Chrysalis/
├── src/
│   ├── domain/                    # Business logic (domain layer)
│   │   ├── ports/                 # Port interfaces (dependency inversion)
│   │   │   ├── IValidationPort.ts
│   │   │   ├── IAuthenticationPort.ts
│   │   │   ├── IErrorHandlingPort.ts
│   │   │   ├── IPaginationPort.ts
│   │   │   ├── IHttpClientPort.ts
│   │   │   ├── ISyncProviderPort.ts
│   │   │   └── IWidgetRegistryPort.ts
│   │   ├── services/              # Domain services
│   │   │   ├── AgentBuilderService.ts
│   │   │   ├── KnowledgeBuilderService.ts
│   │   │   └── SkillBuilderService.ts
│   │   └── models/                # Domain models
│   │       ├── Agent.ts
│   │       ├── Knowledge.ts
│   │       └── Skill.ts
│   │
│   ├── adapters/                  # Infrastructure adapters
│   │   ├── validation/
│   │   │   ├── FlaskValidationAdapter.ts
│   │   │   └── PydanticValidationAdapter.ts
│   │   ├── auth/
│   │   │   └── FlaskAuthAdapter.ts
│   │   ├── http/
│   │   │   └── RequestsHttpAdapter.ts
│   │   ├── sync/
│   │   │   └── YjsWebsocketAdapter.ts
│   │   └── widgets/
│   │       └── DefaultWidgetRegistryAdapter.ts
│   │
│   └── infrastructure/            # Framework-specific code
│       ├── flask/
│       │   ├── FlaskApp.py
│       │   └── middleware/
│       └── web/
│           └── routes/

```

**Port Interface Examples**:
```typescript
// src/domain/ports/IValidationPort.ts
export interface IValidationPort {
  validate(data: Record<string, unknown>, rules: ValidationRules): ValidationResult;
  requireField(data: Record<string, unknown>, field: string): unknown;
  requireString(data: Record<string, unknown>, field: string, constraints?: StringConstraints): string;
}

// src/domain/ports/IHttpClientPort.ts
export interface IHttpClientPort {
  post<T>(url: string, data: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>>;
  get<T>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>>;
}

// src/domain/ports/ISyncProviderPort.ts
export interface ISyncProviderPort {
  connect(url: string, roomId: string): void;
  disconnect(): void;
  on(event: string, handler: (data: unknown) => void): void;
  get isConnected(): boolean;
}

// src/domain/services/AgentBuilderService.ts
export class AgentBuilderService {
  constructor(
    private validationPort: IValidationPort,
    private httpClientPort: IHttpClientPort,
    private knowledgeBuilderUrl: string,
    private skillBuilderUrl: string
  ) {}
  
  async buildAgent(request: AgentBuildRequest): Promise<Agent> {
    // Validate using port interface
    const validation = this.validationPort.validate(request, {
      role_model: { required: true, type: 'object' },
      agent_id: { required: true, type: 'string' }
    });
    
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }
    
    // Call downstream services via HTTP port
    const knowledgeResponse = await this.httpClientPort.post(
      `${this.knowledgeBuilderUrl}/api/v1/knowledge`,
      { identifier: request.role_model.name }
    );
    
    // Business logic independent of infrastructure
    return this.assembleAgent(request, knowledgeResponse.data);
  }
}

// Adapter implementation
class RequestsHttpAdapter implements IHttpClientPort {
  async post<T>(url: string, data: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    const response = await requests.post(url, {
      json: data,
      headers: headers
    });
    
    return {
      status: response.status,
      data: response.json() as T,
      headers: response.headers
    };
  }
}
```

**Dependency Injection Configuration**:
```python
# src/infrastructure/di_container.py
class DIContainer:
    """Dependency injection container for hexagonal architecture."""
    
    def __init__(self):
        self._bindings = {}
    
    def bind(self, port_interface, adapter_impl):
        """Bind port interface to concrete adapter."""
        self._bindings[port_interface] = adapter_impl
    
    def resolve(self, port_interface):
        """Resolve adapter for port interface."""
        return self._bindings.get(port_interface)

# Application startup
def create_agent_builder_app():
    container = DIContainer()
    
    # Register adapters for ports
    container.bind(IValidationPort, FlaskValidationAdapter())
    container.bind(IHttpClientPort, RequestsHttpAdapter())
    container.bind(IAuthenticationPort, FlaskAuthAdapter())
    
    # Create service with injected dependencies
    service = AgentBuilderService(
        validation_port=container.resolve(IValidationPort),
        http_client_port=container.resolve(IHttpClientPort),
        knowledge_builder_url=os.getenv('KNOWLEDGE_BUILDER_URL'),
        skill_builder_url=os.getenv('SKILL_BUILDER_URL')
    )
    
    return create_flask_app(service)
```

**Rationale**:
- Complete separation of domain logic from infrastructure
- Domain services depend only on port interfaces
- Adapters implement ports using framework-specific code
- Easy to swap implementations (testing, alternative frameworks)
- Services testable with mock port implementations
- Interface Segregation: each port represents single concern
- Follows Dependency Inversion: high-level doesn't depend on low-level

**Trade-offs Accepted**:
- Significant refactoring effort to extract domain layer
- Increased number of files and directories
- Port interface proliferation (one per external dependency)
- DI container adds configuration complexity
- Migration requires careful extraction to avoid breaking changes

**Implementation Scope**:
- Create `src/domain/ports/` directory with port interfaces
- Extract domain services to `src/domain/services/`
- Implement adapters in `src/adapters/` matching port interfaces
- Create DIContainer for binding ports to adapters
- Refactor AgentBuilder, KnowledgeBuilder, SkillBuilder to use ports
- Update ChrysalisTerminal to inject ISyncProviderPort and IWidgetRegistryPort
- Create test doubles implementing port interfaces
- Document port contracts and adapter responsibilities

---

## Implementation Sequencing

Based on dependency analysis, recommended implementation order:

### Phase 1: Foundation Patterns (Independent)
1. **Task 3: String Literal Union Types** - Prerequisite for Factory validation
2. **Task 4: ValidationStrategy Pattern** - Needed by ServiceBuilder and Ports

### Phase 2: Structural Patterns (Build on Phase 1)
3. **Task 5: Abstract Factory** - Uses WidgetType union, provides to Visitor
4. **Task 2: ServiceBuilder Base Class** - Uses ValidationStrategy

### Phase 3: Behavioral Patterns (Integration)
5. **Task 6: RxJS Observables** - Independent but extensive
6. **Task 1: Visitor Wrapper Pattern** - Uses Factory-created nodes

### Phase 4: Architectural Refactoring (Comprehensive)
7. **Task 7: Hexagonal Architecture** - Integrates all prior patterns

**Rationale**: Early tasks establish type safety and validation infrastructure required by later structural refactorings. Hexagonal architecture deferred until patterns stabilized to minimize rework.

---

## Testing Strategy

Each pattern implementation requires:

### Unit Tests
- **Visitor**: Wrapper correctly dispatches to visitor methods, unwrap returns original node
- **ServiceBuilder**: Template method hooks called in correct order, subclass overrides work
- **Union Types**: TypeScript compiler catches missing switch cases (compilation test)
- **ValidationStrategy**: Both strategies produce equivalent results for valid/invalid data
- **Abstract Factory**: Each factory creates valid nodes, validation rejects invalid params
- **RxJS Observers**: Subscriptions auto-cleanup on destroy, no memory leaks
- **Ports/Adapters**: Domain services work with mock ports, adapters satisfy port contracts

### Integration Tests
- **End-to-end**: Agent creation workflow through hexagonal architecture
- **CRDT Sync**: Node creation via factory syncs correctly through YJS
- **Event Flow**: RxJS events propagate through visitor operations
- **Validation**: Strategy pattern works with both builder base class and ports

### Performance Tests
- **Wrapper Overhead**: Measure allocation cost vs. switch statement baseline
- **Factory Registry**: Benchmark creation performance vs. direct instantiation
- **RxJS vs Custom**: Compare memory usage and subscription overhead

---

## Migration Strategy

### Backward Compatibility
- Maintain existing APIs during migration
- Deprecated methods delegate to new pattern implementations
- Feature flags for gradual rollout (e.g., `USE_HEXAGONAL_ARCH=true`)

### Incremental Migration
1. Implement patterns in isolation (Task 1-6)
2. Add tests verifying pattern behavior
3. Introduce compatibility layer calling new patterns
4. Migrate callers incrementally
5. Remove deprecated code after full migration
6. Hexagonal refactoring last (Task 7) with all patterns stable

### Risk Mitigation
- Each pattern implementation includes rollback plan
- Extensive test coverage before removing old code
- Monitor production metrics during migration
- Staged deployment (dev → staging → production)

---

## Architecture Documentation Deliverables

### Pattern Implementation Guides
- Visitor Pattern: Usage guide for creating new visitor operations
- Factory Pattern: Guide for registering new node type factories
- Strategy Pattern: Guide for implementing custom validation strategies
- Observer Pattern: Guide for RxJS subscription management
- Hexagonal Architecture: Port interface design guidelines

### Architecture Decision Records (ADRs)
- ADR-001: Wrapper Pattern for Visitor Accept Methods
- ADR-002: Template Method for Builder Service Coupling
- ADR-003: String Literal Unions for Type Safety
- ADR-004: Strategy Pattern for Validation Abstraction
- ADR-005: Abstract Factory for Node Creation
- ADR-006: RxJS Integration for Observer Pattern
- ADR-007: Hexagonal Architecture for Dependency Inversion

### Diagrams
- Class diagrams for each pattern implementation
- Sequence diagrams for Visitor wrapper dispatch
- Component diagram showing hexagonal architecture layers
- Dependency graph before/after refactoring

---

## Metrics and Success Criteria

### Code Quality Metrics
- **Cyclomatic Complexity**: Reduce switch statement complexity from 12+ to <5 per function
- **Coupling**: Reduce concrete dependencies by 60% through port interfaces
- **Duplication**: Eliminate 90% of duplicated code across builder services
- **Type Safety**: 100% compile-time validation for widget types and node operations

### Architecture Metrics
- **Pattern Fidelity**: All 7 patterns implemented per GoF specifications
- **Interface Segregation**: Average 3-5 methods per port interface (vs 30+ in monolithic module)
- **Testability**: 100% of domain services testable with mock ports
- **Extensibility**: New node types require 1 factory class (vs 5+ modification sites)

### Performance Metrics
- **Visitor Wrapper**: <5% overhead vs switch statement baseline
- **Factory Pattern**: <2ms average node creation time
- **RxJS Subscriptions**: Zero memory leaks in 24-hour stress test
- **Validation Strategy**: <1ms validation time for typical request

---

## Decision Rationale Summary

| Task | Pattern | Decision | Key Rationale |
|------|---------|----------|---------------|
| 1 | Visitor | Wrapper Class at UI Boundary | Preserves classic double-dispatch while maintaining CRDT-compatible plain data structures |
| 2 | Builder | ServiceBuilder Base + Template Method | Eliminates duplication across 3 services while preserving Flask patterns via inheritance |
| 3 | Type Safety | String Literal Union + Never Checks | Compile-time validation with zero runtime overhead, exhaustiveness checking prevents missing cases |
| 4 | Validation | ValidationStrategy Interface | Clean separation of imperative/declarative approaches with runtime selection via factory |
| 5 | Factory | Abstract Factory + Concrete Implementations | Type-safe creation with encapsulated validation, defaults, and ID generation per node type |
| 6 | Observer | RxJS Observable Integration | Battle-tested subscription management with automatic cleanup preventing memory leaks |
| 7 | Dependency Inversion | Hexagonal (Ports & Adapters) | Complete domain independence through port interfaces with adapter implementations |

---

## Next Steps

1. **Approval**: Review architectural decisions for alignment with project goals
2. **Prioritization**: Confirm implementation sequencing based on dependencies
3. **Resource Allocation**: Assign implementation tasks per phase
4. **Spike Solutions**: Prototype critical patterns (Hexagonal refactoring, RxJS integration)
5. **Implementation**: Execute Phase 1-4 sequencing with continuous testing
6. **Documentation**: Create ADRs, guides, and diagrams parallel to implementation
7. **Migration**: Gradual rollout with feature flags and backward compatibility
8. **Validation**: Measure metrics against success criteria

---

## Appendix A: Investigation Path Documentation

### Discovery Phase
- Searched for node type definitions across codebase
- Identified TypeScript interface-based node system
- Located existing Visitor interface implementation
- Found current switch-statement rendering approach

### Investigation Phase
- Examined CRDT synchronization constraints (YJS Y.Array storage)
- Analyzed builder service duplication patterns
- Traced validation logic through RequestValidator and Pydantic schemas
- Mapped event handler lifecycle in ChrysalisTerminal
- Identified concrete dependency injection points

### Synthesis Phase
- Recognized interface-vs-class impedance mismatch blocking Visitor pattern
- Connected builder coupling to lack of shared abstraction layer
- Linked primitive obsession to missing TypeScript union types
- Understood dual validation approaches as strategy variation point
- Identified scattered factory responsibilities across creation sites
- Diagnosed subscription lifecycle gap causing potential memory leaks
- Mapped dependency inversion violations to testability issues

### Decision Framework Applied
Each decision evaluated against:
- **CRDT Compatibility**: Preserves serializable data structures
- **Type Safety**: Leverages TypeScript compiler for validation
- **Extensibility**: Supports future additions without shotgun surgery
- **Testability**: Enables isolated testing with mocks/stubs
- **Performance**: Minimizes runtime overhead
- **Migration Risk**: Allows incremental adoption with backward compatibility

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-11T00:31:00Z  
**Status**: Ready for Implementation Planning
