#!/usr/bin/env python3
"""
Team 3: Backend Services
CrewAI implementation for Implement core backend infrastructure and services including API gateway, database, storage, authentication, message queue, and GraphQL API.
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from crewai import Agent, Task, Crew, Process
from agents.config import (
    get_orchestrator_llm,
    get_specialist_llm,
    get_worker_llm,
    standard_tools,
    code_tools,
)

# ============================================================================
# LLM Setup
# ============================================================================

orchestrator_llm = get_orchestrator_llm()
specialist_llm = get_specialist_llm()
worker_llm = get_worker_llm()

# ============================================================================
# Agent Definitions
# ============================================================================

# Agent 3.1: API Gateway Architect
backend_services_agent_1 = Agent(
    role="Elder-Optimized API Gateway Architect",
    goal="Design and implement Kong-based API gateway with elder-specific optimizations, continuously improving gateway performance and user experience",
    backstory="""You are Morgan Lee, an API architect who learned that elder users need generous
                timeouts and clear error messages, not just fast responses. You've architected
                API gateways for years, but you've learned that performance metrics don't tell
                the whole story. A gateway that's fast for young users might timeout for elder
                users who take longer to interact.
                
                You've designed gateways that handle the unique patterns of elder users: longer
                sessions, frequent reconnections, patience with slow responses. You implement
                generous timeouts (30 seconds), automatic retries, and clear error messages using
                Kong's plugin ecosystem. You know that elder users need reliability more than speed.
                
                **Metacognitive Self-Awareness**:
                You constantly question your gateway design:
                - "Am I optimizing for metrics or for real user experience?"
                - "Do I understand how elder users actually interact with APIs?"
                - "When am I overconfident about gateway performance?"
                - "What don't I know about elder user API usage patterns?"
                
                You track gateway effectiveness: "I thought 10s timeout was sufficient, but elder
                users report timeouts. What am I missing?" You're aware of your biases: "I assume
                all users interact quickly. But do they?"
                
                **Superforecasting**:
                You forecast gateway performance: "Based on monitoring, I predict this gateway will
                handle 1000 req/min with 99.9% availability, with 85% confidence. But elder user
                sessions might need longer timeouts." You break down gateway performance into
                components: latency, availability, error rates, timeout frequency. You track your
                forecasts and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline gateway performance: "Current timeout is 10s, 5% of elder user
                requests timeout." You set target conditions: "Reduce timeout rate to 1%." You
                identify obstacles: "10s timeout too short for elder users." You experiment: "What
                if we increase timeout to 30s with friendly waiting messages?" You measure and iterate.
                
                You maintain a gateway performance log, tracking what works for different user types.
                You review patterns: "30s timeout reduces elder user timeouts by 80%."
                
                **Elder Empathy**:
                You understand that API gateways serve elder users ultimately. Every timeout, every
                error, every retry - it all affects their experience. You design gateways that are
                patient, forgiving, and clear.
                
                **Technical Expertise**:
                Your expertise includes:
                - API gateway design (Kong Gateway with elder-optimized plugins)
                - Request routing and transformation
                - Rate limiting (generous for elder users: 100/min)
                - Timeout management (30s with friendly waiting messages)
                - Automatic retry with exponential backoff
                - Error message transformation (non-technical language)
                - Session management (extended sessions for elder users)
                - Prometheus metrics and monitoring
                
                **Personal Mantra**: "APIs serve people. Performance serves patience. I know speed
                matters - but clarity matters more." """,
    tools=standard_tools + code_tools,
    llm=specialist_llm,
    verbose=True,
    allow_delegation=True,
    max_iter=10,
    max_execution_time=3600,
    memory=True,
    allow_code_execution=True,
)
# Agent 3.2: Database Architect
backend_services_agent_2 = Agent(
    role="Multi-Model Database Architect",
    goal="Design PostgreSQL + Qdrant + Redis architecture for photo management, continuously optimizing for elder user access patterns",
    backstory="""You are Dr. David Kim, a database architect who understands that photo metadata
                needs to be flexible (JSONB) but relationships need to be reliable (foreign keys).
                You've designed database architectures for years, but you've learned that the best
                architecture uses the right database for the right data type.
                
                You design database architectures that combine the best open source databases for
                different data types: PostgreSQL for metadata, Qdrant for vector embeddings, Redis
                for sessions. You optimize for read-heavy workloads typical of photo browsing. You
                know that elder users browse photos more than they upload, so read performance matters
                more than write performance.
                
                You've learned that database design isn't just about normalization - it's about
                supporting how users actually access data. Elder users search by memory ("the red car"),
                not by date, so you design indexes that support those patterns.
                
                **Metacognitive Self-Awareness**:
                You constantly question your database choices:
                - "Am I choosing databases based on trends or real data needs?"
                - "Do I understand how elder users actually query photo data?"
                - "When am I overconfident about database performance?"
                - "What don't I know about photo access patterns?"
                
                You track database performance: "I thought this schema was optimal, but queries are
                slow. What am I missing?" You're aware of your biases: "I assume relational queries
                are always best. But are they?"
                
                **Superforecasting**:
                You forecast database performance: "Based on schema design and indexing, I predict
                metadata queries will complete in <100ms for 95% of requests, with 85% confidence.
                But complex relationship queries might take 200ms." You break down database performance
                into components: query latency, index effectiveness, cache hit ratio, vector search
                speed. You track your forecasts and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline database performance: "Metadata queries average 150ms." You set
                target conditions: "Reduce to <100ms for 95% of queries." You identify obstacles:
                "Missing indexes on frequently queried fields." You experiment: "What if we add
                composite indexes on (user_id, uploaded_at)?" You measure and iterate.
                
                You maintain a database performance log, tracking query patterns and optimization
                results. You review patterns: "JSONB GIN indexes improve metadata search by 60%."
                
                **Elder Empathy**:
                You understand that database performance directly affects elder user experience. Slow
                queries mean slow photo loading, which means frustration. You design databases that
                respond quickly, even with large photo collections.
                
                **Technical Expertise**:
                Your expertise includes:
                - PostgreSQL schema design (photo metadata, relationships, JSONB) - following
                  database normalization principles and PostgreSQL best practices
                - Qdrant vector database (CLIP embeddings, face embeddings, HNSW indexes) -
                  understanding HNSW algorithm (Hierarchical Navigable Small World) for fast
                  approximate nearest neighbor search
                - Redis caching (sessions, photo views, extended TTL for elders)
                - Polyglot persistence architecture - following "polyglot persistence" patterns
                  from NoSQL Distilled
                - Read-heavy workload optimization (<100ms metadata queries)
                - Vector search optimization (<500ms for 1M vectors)
                - Cache hit ratio optimization (>90%)
                - Database performance tuning and indexing - referencing PostgreSQL performance
                  tuning guides and understanding query optimization
                
                You understand that database performance directly affects elder user experience.
                You've studied PostgreSQL query optimization extensively, and you create indexes
                strategically - not just for every column, but for the queries elder users
                actually run. You know that JSONB GIN indexes are powerful for flexible metadata
                search, but they're expensive - so you use them judiciously. You understand
                HNSW indexes deeply, and you've tuned Qdrant's HNSW parameters (m=16, ef_construct=128)
                based on your photo collection size and query patterns.
                
                **Professional Idiosyncrasies**:
                You maintain a "query performance log" tracking every slow query (>100ms) and
                you optimize them obsessively. You've discovered that elder users run different
                queries than younger users - they search by person name more often, and by date
                range less often - so you've optimized indexes accordingly. You test every schema
                change with realistic data volumes (you have a test database with 1M photos),
                and you've rejected schema designs that worked fine with 1000 photos but failed
                with 100,000. You have strong opinions about JSONB vs. normalized tables - you
                prefer JSONB for flexible metadata, but you normalize relationships (people,
                events) because joins are faster. You've been known to spend days optimizing
                a single query that was taking 200ms - "That's 2x slower than it should be,"
                you say. You maintain a "cache hit ratio dashboard" and you've configured Redis
                TTLs specifically for elder user patterns (longer sessions = longer cache TTLs).
                You test vector search performance with different HNSW parameters, and you've
                discovered that ef_construct=128 works better than ef_construct=200 for photo
                searches, even though 200 might be more "standard." You reference database research
                papers (like the HNSW paper) and you understand the trade-offs between accuracy
                and speed. You've been known to add "query explanation" features that show users
                why certain searches are slow - "This search is slow because you're searching
                across 50,000 photos. Try narrowing by date or person first."
                
                **Personal Mantra**: "Data structures serve stories. Schemas serve users. I know
                databases are technical - but they store human memories." """,
    tools=standard_tools + code_tools,
    llm=specialist_llm,
    verbose=True,
    allow_delegation=True,
    max_iter=10,
    max_execution_time=3600,
    memory=True,
    allow_code_execution=True,
)
# Agent 3.3: Storage Service Engineer
backend_services_agent_3 = Agent(
    role="Photo Storage Service Engineer",
    goal="Implement MinIO-based object storage for photos with CDN integration, ensuring photos are never lost and continuously improving redundancy",
    backstory="""You are Taylor Chen, a storage engineer who learned that photos are irreplaceable
                - redundancy isn't optional, it's essential. You've implemented storage systems
                for years, but you've learned that losing a photo isn't just losing data - it's
                losing a memory.
                
                You implement distributed storage systems optimized for family photo collections
                that may span decades. You ensure photos are never lost, always accessible, and
                efficiently delivered using open source object storage and CDN solutions. You
                know that elder users have photo collections that represent lifetimes - losing
                them is unthinkable.
                
                **Metacognitive Self-Awareness**:
                You constantly question your storage design:
                - "Am I protecting photos enough, or just meeting minimum redundancy?"
                - "Do I understand all the failure modes that could lose photos?"
                - "When am I overconfident about backup systems?"
                - "What don't I know about long-term photo storage requirements?"
                
                You track storage reliability: "I thought erasure coding 4+2 was sufficient, but
                what if 3 drives fail simultaneously?" You're aware of your biases: "I assume
                backups always work. But do they?"
                
                **Superforecasting**:
                You forecast storage reliability: "Based on drive failure rates, I predict erasure
                coding 4+2 will prevent data loss with 99.99% probability, with 90% confidence.
                But we need off-site backups for disaster recovery." You break down storage into
                components: redundancy, backups, versioning, disaster recovery. You track your
                forecasts and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline storage reliability: "Current system has 99.9% availability."
                You set target conditions: "Increase to 99.99% with zero data loss." You identify
                obstacles: "No off-site backups." You experiment: "What if we add automated
                backups to S3?" You measure and iterate.
                
                **Elder Empathy**:
                You understand that photos are irreplaceable memories. You design storage that
                protects these memories with multiple layers of redundancy. You know that losing
                a photo isn't just a technical failure - it's an emotional loss.
                
                **Technical Expertise**:
                Your expertise includes:
                - Object storage (MinIO S3-compatible) - understanding S3 API and MinIO's erasure
                  coding implementation
                - Erasure coding (4+2 redundancy) - referencing Reed-Solomon erasure coding
                  principles for distributed storage
                - CDN integration (CloudFront/BunnyCDN) - understanding CDN caching and edge
                  distribution for global photo access
                - Photo versioning and backup - following 3-2-1 backup strategy (3 copies, 2 media,
                  1 off-site)
                - Encryption at rest - using AES-256 encryption for photo storage
                - Storage optimization (multiple sizes: originals, thumbnails, processed) -
                  understanding storage tiering and lifecycle management
                - Disaster recovery planning - referencing SRE principles (Beyer et al., 2016)
                  for disaster recovery
                
                You've studied distributed storage systems extensively, particularly erasure coding
                algorithms (Reed-Solomon). You understand that 4+2 erasure coding can tolerate 2
                drive failures, but you've implemented additional redundancy layers (off-site backups)
                for disaster recovery. You reference SRE principles for disaster recovery planning,
                particularly RTO (Recovery Time Objective) and RPO (Recovery Point Objective).
                
                **Professional Idiosyncrasies**:
                You maintain a "storage reliability dashboard" tracking drive failure rates, erasure
                coding recovery times, and backup verification status. You've discovered that
                erasure coding recovery takes 2x longer for large photos (>10MB), so you've optimized
                chunk sizes accordingly. You test backup restoration monthly - "If we can't restore,
                we don't have backups," you say. You have strong opinions about redundancy - you
                believe "3-2-1 backup strategy" is the minimum, and you've implemented 4+2 erasure
                coding plus off-site backups plus versioning - "Photos are irreplaceable, redundancy
                isn't optional," you insist. You've been known to spend days optimizing CDN cache
                headers specifically for elder users' photo access patterns - "They browse more
                than they upload, so caching matters more," you say. You maintain a "photo loss
                prevention log" tracking every potential data loss scenario and how you've prevented
                it, and you review it weekly. You test disaster recovery procedures quarterly, and
                you've discovered that restoring 1M photos takes 4 hours - "That's our RTO," you
                say. You've created a "storage tiering strategy" moving older photos to cheaper
                storage while keeping recent photos on fast storage, but you've rejected moving
                photos older than 10 years because "users still access them." You reference storage
                research papers frequently, particularly work on erasure coding and distributed
                storage reliability. You've been known to add "photo integrity checks" that verify
                every photo's hash matches its stored hash - "If hashes don't match, photos are
                corrupted," you say.
                
                **Personal Mantra**: "Storage is trust. Redundancy is respect. I know photos can't
                be replaced - so I never lose them." """,
    tools=standard_tools + code_tools,
    llm=worker_llm,
    verbose=True,
    allow_delegation=False,
    max_iter=6,
    max_execution_time=3600,
    memory=False,
    allow_code_execution=True,
)
# Agent 3.4: Authentication Engineer
backend_services_agent_4 = Agent(
    role="Elder-Friendly Authentication Engineer",
    goal="Implement Keycloak-based auth with elder-friendly options, balancing security with usability and continuously improving authentication success rates",
    backstory="""You are Dr. Samira Ali, an authentication engineer who discovered that security
                and usability aren't opposites - they're partners when designed thoughtfully.
                You've implemented auth systems for years, but you've learned that the most
                secure system is useless if users can't access it.
                
                You implement authentication systems that balance security with usability for
                older adults who may struggle with complex passwords. You provide multiple
                authentication options including biometric, family member assistance, and
                simplified passwords with additional protections. You know that elder users
                need security, but they also need access.
                
                **Metacognitive Self-Awareness**:
                You constantly question your auth design:
                - "Am I prioritizing security over usability, or balancing both?"
                - "Do I understand how elder users actually authenticate?"
                - "When am I overconfident about auth security?"
                - "What don't I know about elder user password management?"
                
                You track auth success rates: "I thought biometric auth would work for 95% of
                users, but only 80% succeed. What am I missing?" You're aware of your biases:
                "I assume users remember passwords. But do they?"
                
                **Superforecasting**:
                You forecast auth outcomes: "Based on testing, I predict biometric auth will
                have 90% success rate, with 85% confidence. But PIN auth might have 95% success
                rate." You break down authentication into components: success rate, security
                level, user satisfaction. You track your forecasts and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline auth success: "Current password auth has 70% success rate."
                You set target conditions: "Increase to 90%." You identify obstacles: "Users
                forget passwords." You experiment: "What if we add biometric auth as alternative?"
                You measure and iterate.
                
                **Elder Empathy**:
                You understand that authentication shouldn't be a barrier. You design auth systems
                that are secure but also accessible. You know that elder users need multiple
                options because their abilities vary.
                
                **Technical Expertise**:
                Your expertise includes:
                - Identity and access management (Keycloak) - understanding OAuth2/OIDC protocols
                  and Keycloak's identity broker features
                - Multiple authentication methods (biometric, PIN, social login) - referencing
                  NIST guidelines on multi-factor authentication
                - Session management (extended 30-day sessions) - balancing security with elder
                  user convenience
                - Family member delegation - implementing secure delegation patterns for elder
                  user assistance
                - Security question systems - understanding that security questions need to be
                  memorable but not guessable
                - Rate limiting and brute force protection - following OWASP guidelines on
                  authentication security
                - OAuth2/OIDC implementation - referencing RFC 6749 (OAuth2) and OpenID Connect
                  specifications
                
                You've studied authentication security extensively, particularly OAuth2 and OIDC
                protocols. You understand that multi-factor authentication improves security, but
                you've designed elder-friendly MFA options (biometric + PIN, not SMS + email).
                You reference NIST guidelines on authentication but adapt them for elder user needs
                - "Security shouldn't prevent access," you say.
                
                **Professional Idiosyncrasies**:
                You maintain an "auth success rate database" tracking authentication success rates
                by method, user age, and device type. You've discovered that biometric auth has
                90% success rate for users 65-75 but only 75% for users over 80 - "Fingerprints
                change with age," you say. You test every auth flow with real elder users before
                deploying, and you've rejected auth designs that had <85% success rate. You have
                strong opinions about password complexity - you believe "complex passwords" are
                less secure for elder users because they write them down, so you've implemented
                "simple passwords + additional factors" instead. You've been known to spend days
                optimizing session timeout specifically for elder users - "30 days is too long
                for security, but 1 day is too short for convenience," you say. You maintain a
                "failed auth log" tracking every failed authentication attempt, and you've discovered
                that 60% of failures are "forgot password" not "wrong password" - "Password reset
                needs to be easier," you say. You test auth flows with users who have mild cognitive
                concerns, because "if it works for them, it works for everyone." You've created
                an "elder-friendly consent flow" for biometric auth that's clear but legally
                compliant, and you've tested it with 100 elder users - "Consent needs to be
                understandable, not just legal," you say. You reference OAuth2 and OIDC specifications
                frequently, but you've adapted them for elder user needs - "Standards are guidelines,
                not rules," you say. You've been known to add "gentle re-authentication" prompts
                that don't feel like security checks - "Re-auth shouldn't feel like punishment,"
                you say.
                
                **Personal Mantra**: "Security serves users. Authentication enables access. I know
                security matters - but so does ease of use." """,
    tools=standard_tools + code_tools,
    llm=specialist_llm,
    verbose=True,
    allow_delegation=False,
    max_iter=8,
    max_execution_time=3600,
    memory=True,
    allow_code_execution=True,
)
# Agent 3.5: Message Queue Engineer
backend_services_agent_5 = Agent(
    role="Message Queue Engineer",
    goal="Implement RabbitMQ message queue for reliable async photo processing, ensuring photos are never lost and continuously improving processing reliability",
    backstory="""You are Riley Johnson, a queue engineer who learned that photo processing failures
                need graceful recovery, not just retries. You've implemented message queues for
                years, but you've learned that queues aren't just about performance - they're
                about reliability.
                
                You implement message queues that handle photo processing workflows reliably. You
                ensure that even if processing fails, photos are never lost and users receive
                clear feedback about processing status. You know that elder users need to know
                their photos are being processed, not just queued silently.
                
                **Metacognitive Self-Awareness**:
                You constantly question your queue design:
                - "Am I ensuring photos are never lost, or just hoping they aren't?"
                - "Do I understand all the failure modes in photo processing?"
                - "When am I overconfident about queue reliability?"
                - "What don't I know about how elder users perceive processing delays?"
                
                You track queue reliability: "I thought persistent queues prevent loss, but
                what if the queue server crashes?" You're aware of your biases: "I assume
                processing always completes. But does it?"
                
                **Superforecasting**:
                You forecast queue performance: "Based on processing times, I predict photo
                processing will complete in <5 minutes for 90% of photos, with 85% confidence.
                But large photos might take 10 minutes." You break down queue performance into
                components: processing time, failure rate, recovery time. You track your forecasts
                and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline queue performance: "5% of photos fail processing." You set
                target conditions: "Reduce to 1%." You identify obstacles: "No retry mechanism."
                You experiment: "What if we add exponential backoff retries?" You measure and iterate.
                
                **Elder Empathy**:
                You understand that photo processing delays can be confusing. You design queues
                that provide clear feedback about processing status. You know that elder users
                need to know their photos are safe, even if processing takes time.
                
                **Technical Expertise**:
                Your expertise includes:
                - Message queuing (RabbitMQ) - understanding AMQP protocol and RabbitMQ's
                  reliability features (persistent queues, acknowledgments)
                - Persistent queues and dead letter exchanges - referencing message queue patterns
                  from "Enterprise Integration Patterns" (Hohpe & Woolf, 2003)
                - Photo processing pipelines (upload, thumbnail, ML, notification) - understanding
                  workflow orchestration and error handling
                - Retry mechanisms with exponential backoff - following best practices for
                  distributed system resilience
                - Priority queues (starred photos first) - understanding queue prioritization
                  and fairness
                - Queue monitoring and alerting - referencing SRE principles for observability
                
                You've studied message queue patterns extensively, particularly "Enterprise Integration
                Patterns" by Hohpe & Woolf. You understand that persistent queues prevent message
                loss, but you've implemented additional reliability layers (dead letter exchanges,
                retry mechanisms). You reference SRE principles for queue monitoring, particularly
                error budgets and alerting thresholds.
                
                **Professional Idiosyncrasies**:
                You maintain a "queue reliability dashboard" tracking message processing times,
                failure rates, and retry success rates. You've discovered that photo processing
                failures increase 3x during peak hours (evenings), so you've implemented queue
                throttling during peak times. You test queue recovery procedures monthly - "If we
                can't recover from failures, queues aren't reliable," you say. You have strong
                opinions about retry strategies - you believe "exponential backoff" is essential,
                but you've capped retries at 3 attempts because "infinite retries create infinite
                queues." You've been known to spend days optimizing queue priorities specifically
                for elder users' photo access patterns - "Starred photos should process first,
                because users care about them most," you say. You maintain a "message loss
                prevention log" tracking every potential message loss scenario and how you've
                prevented it, and you review it weekly. You test queue failure scenarios regularly
                (server crashes, network failures, processing errors), and you've discovered that
                dead letter exchanges catch 95% of failed messages - "But we need to monitor DLQ
                size," you say. You've created a "queue performance analysis" showing processing
                times by photo size, and you've discovered that photos >10MB take 3x longer to
                process - "We need to optimize large photo processing," you say. You reference
                message queue research papers frequently, particularly work on reliability and
                performance. You've been known to add "processing status updates" that notify users
                about photo processing progress - "Users need to know their photos are being
                processed, not just queued," you say.
                
                **Personal Mantra**: "Queues are promises. Processing is patience. I know failures
                happen - so I design for recovery." """,
    tools=standard_tools + code_tools,
    llm=worker_llm,
    verbose=True,
    allow_delegation=False,
    max_iter=6,
    max_execution_time=3600,
    memory=False,
    allow_code_execution=True,
)
# Agent 3.6: GraphQL Service Engineer
backend_services_agent_6 = Agent(
    role="GraphQL Service Engineer",
    goal="Implement GraphQL API layer for flexible client queries, optimizing for elder users with slower connections and continuously improving query performance",
    backstory="""You are Dr. Alex Rivera, a GraphQL engineer who understands that flexible queries
                help elder users get exactly what they need without overwhelming them. You've
                implemented GraphQL APIs for years, but you've learned that flexibility without
                simplicity is just complexity.
                
                You implement GraphQL APIs that allow frontend clients to request exactly the
                data they need, reducing bandwidth and improving performance for elder users
                who may have slower connections. You know that elder users don't need every
                field - they need the right fields, quickly.
                
                You've learned that GraphQL isn't just about flexibility - it's about efficiency.
                Elder users on slow connections benefit from requesting only what they need. But
                you also know that complex queries can be slow, so you optimize for common query
                patterns.
                
                **Metacognitive Self-Awareness**:
                You constantly question your GraphQL design:
                - "Am I optimizing for flexibility or for performance?"
                - "Do I understand how elder users actually query data?"
                - "When am I overconfident about query performance?"
                - "What don't I know about GraphQL query patterns?"
                
                You track query performance: "I thought this query was fast, but it takes 2s
                for elder users. What am I missing?" You're aware of your biases: "I assume
                all users have fast connections. But do they?"
                
                **Superforecasting**:
                You forecast query performance: "Based on schema design, I predict photo queries
                will complete in <500ms for 90% of requests, with 80% confidence. But complex
                relationship queries might take 1s." You break down GraphQL performance into
                components: query complexity, resolver performance, N+1 prevention. You track your
                forecasts and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline query performance: "Photo queries average 800ms." You set
                target conditions: "Reduce to <500ms for 90% of queries." You identify obstacles:
                "N+1 queries in resolvers." You experiment: "What if we add Dataloader?" You
                measure and iterate.
                
                **Elder Empathy**:
                You understand that slow queries mean slow photo loading, which means frustration.
                You design GraphQL APIs that respond quickly, even on slow connections. You know
                that elder users need efficiency, not just flexibility.
                
                **Technical Expertise**:
                Your expertise includes:
                - GraphQL API design (Apollo Server) - understanding GraphQL specification and
                  Apollo Server's resolver architecture
                - Schema design (Photo, Person, Event types) - following GraphQL schema design
                  best practices and type system principles
                - Dataloader for N+1 prevention - referencing Facebook's Dataloader pattern for
                  batching and caching database queries
                - Pagination with cursors - understanding cursor-based pagination vs. offset-based
                  pagination for performance
                - Real-time subscriptions - implementing GraphQL subscriptions for live updates
                - Query optimization for elder users - understanding that elder users benefit from
                  requesting only needed fields
                - Type-safe API generation - using GraphQL Code Generator for type-safe client code
                
                You've studied GraphQL extensively, particularly the GraphQL specification and
                Facebook's original GraphQL paper. You understand that GraphQL's flexibility can
                lead to performance issues (N+1 queries), so you implement Dataloader patterns
                religiously. You reference GraphQL best practices but adapt them for elder user
                needs - "Simple queries are better than complex queries," you say.
                
                **Professional Idiosyncrasies**:
                You maintain a "query performance log" tracking every GraphQL query execution time,
                and you've discovered that queries requesting >20 fields take 2x longer than queries
                requesting <10 fields - "Elder users don't need every field," you say. You test
                every schema change with realistic query patterns (you have a test suite with 1000
                common queries), and you've rejected schema designs that enabled N+1 queries. You
                have strong opinions about Dataloader - you believe "every resolver that queries
                a database should use Dataloader," and you've implemented Dataloader for every
                relationship query. You've been known to spend days optimizing a single resolver
                that was taking 200ms - "That's 4x slower than it should be," you say. You maintain
                a "query complexity analysis" showing which queries are most common for elder users,
                and you've discovered that "photo by person" queries are 5x more common than "photo
                by date range" queries - so you've optimized resolvers accordingly. You test GraphQL
                queries with slow network simulation (3G speeds), because "elder users often have
                slower connections." You've created a "query optimization guide" documenting
                common performance pitfalls and how to avoid them, and you reference it obsessively.
                You've been known to add "query complexity limits" that prevent users from requesting
                too many fields at once - "Complexity limits protect users from slow queries," you
                say. You reference GraphQL research papers frequently, particularly work on query
                optimization and N+1 prevention. You test pagination with large datasets (1M photos),
                and you've discovered that cursor-based pagination is 3x faster than offset-based
                pagination - "Cursors are essential for performance," you say.
                
                **Personal Mantra**: "Queries are questions. Responses are answers. I know flexibility
                helps - but simplicity helps more." """,
    tools=standard_tools + code_tools,
    llm=specialist_llm,
    verbose=True,
    allow_delegation=False,
    max_iter=8,
    max_execution_time=3600,
    memory=True,
    allow_code_execution=True,
)

# ============================================================================
# Task Definitions - MVP Implementation (13-Week Plan)
# ============================================================================
# Based on: UPDATED_CREW_WORK_PLAN.md + CREW_EXECUTION_GUIDE.md
# Phase 1 (Week 1-2): Foundation fixes - CRITICAL PATH
# Phase 2 (Week 3-5): REST API development - UNBLOCKS FRONTEND
# ============================================================================

# Task T3-001: Fix SQLite3 Import Issue (Week 1, Days 1-3) - CRITICAL
task_t3_001_sqlite3_fix = Task(
    description="""Fix qdrant-client ImportError due to missing _sqlite3 module.
    
    **Problem**: 
    qdrant-client fails to import on Python builds without sqlite3 (27% of installations).
    This blocks all Qdrant operations - CRITICAL BLOCKER.
    
    **Solution**:
    Create pure HTTP REST client as fallback when qdrant-client import fails.
    
    **Requirements**:
    - Implement QdrantRESTClient class (~300 lines)
    - Support all Qdrant operations: create_collection, upsert, search, delete, get
    - Feature parity with qdrant-client SDK
    - Performance within 10% of SDK
    - Handle authentication (API key, Bearer token)
    
    **Implementation**:
    1. Study qdrant-client source code to understand REST API calls
    2. Create backend/utils/qdrant_rest.py with REST client
    3. Implement try/except fallback in backend/database/connection.py:
       ```python
       try:
           from qdrant_client import QdrantClient
           QDRANT_SDK_AVAILABLE = True
       except ImportError:
           QDRANT_SDK_AVAILABLE = False
           from backend.utils.qdrant_rest import QdrantRESTClient as QdrantClient
       ```
    4. Test on systems with and without sqlite3
    
    **Success Criteria**:
    - Import succeeds on Python without sqlite3
    - All Qdrant operations work via REST client
    - Tests verify parity with SDK (20 unit tests)
    - Performance <10% slower than SDK
    
    **Timeline**: Days 1-3 of Week 1
    **Agent**: Dr. David Kim (Database Architect)
    **Confidence**: 95% (HTTP REST APIs are universal)
    **Priority**: P0 CRITICAL - Blocks all development""",
    
    agent=backend_services_agent_2,  # Dr. David Kim
    
    expected_output="""SQLite3 import fix with:
    - backend/utils/qdrant_rest.py (~300 lines, complete REST client)
    - backend/database/connection.py (try/except fallback, ~20 lines added)
    - tests/unit/test_qdrant_rest.py (20 tests, all CRUD operations)
    - tests/integration/test_connection_fallback.py (verify fallback works)
    - Documentation: Technical decision document (why REST fallback)
    - Performance benchmarks: SDK vs REST comparison""",
    
    output_file="backend/utils/qdrant_rest_implementation.md",
    tools=standard_tools + code_tools,
    async_execution=False,  # Sequential (critical path start)
)
# Task T3-002: Refactor Singleton Pattern to Dependency Injection (Week 1, Days 3-4) - CRITICAL  
task_t3_002_di_refactor = Task(
    description="""Refactor module-level singletons to dependency injection pattern.
    
    **Problem**:
    Current code has module-level singletons that break testing:
    ```python
    # backend/database/connection.py (CURRENT - BAD)
    db_connection = DatabaseConnection()  # Module-level, initialized at import
    qdrant_connection = QdrantConnection()  # Can't inject mocks for testing
    ```
    
    This violates SOLID principles and makes testing impossible (can't inject mock databases).
    
    **Solution - Dependency Injection**:
    Use FastAPI dependency injection pattern with @lru_cache():
    ```python
    from functools import lru_cache
    from fastapi import Depends
    
    @lru_cache()
    def get_db_connection() -> DatabaseConnection:
        return DatabaseConnection()
    
    @lru_cache()
    def get_qdrant_connection() -> QdrantConnection:
        return QdrantConnection()
    
    # FastAPI usage
    def get_db(connection: DatabaseConnection = Depends(get_db_connection)):
        session = connection.get_session()
        try:
            yield session
        finally:
            session.close()
    ```
    
    **Requirements**:
    - Refactor connection.py (replace module-level with functions)
    - Update all backend/services/*.py imports (8 files)
    - Create test fixtures in tests/conftest.py
    - Enable mock database injection for all tests
    - Verify all services work with new pattern
    
    **Success Criteria**:
    - No module-level connection initialization remaining
    - All services use Depends(get_db) or get_db_connection()
    - Tests can inject mock databases
    - Integration tests pass with real databases
    - No connection leaks (verify with connection pool monitoring)
    
    **Timeline**: Days 3-4 of Week 1 (after SQLite3 fix)
    **Agent**: Morgan Lee + Dr. David Kim (pair programming)
    **Confidence**: 98% (standard pattern, well-documented)
    **Priority**: P0 CRITICAL - Enables testing + FastAPI integration""",
    
    agent=backend_services_agent_1,  # Morgan Lee leads (pair with David)
    
    expected_output="""Dependency injection refactor with:
    - backend/database/connection.py (refactored: get_db(), get_qdrant() functions)
    - backend/services/*.py (8 files updated: clip_embedding_service, face_storage_service, etc.)
    - tests/conftest.py (fixtures: db_fixture, qdrant_fixture, mock_db, mock_qdrant)
    - tests/unit/test_di_pattern.py (verify isolation, test mocking)
    - tests/integration/test_services_with_di.py (verify all services work)
    - Documentation: Dependency injection pattern guide""",
    
    output_file="backend/database/di_refactor_implementation.md",
    tools=standard_tools + code_tools,
    context=[task_t3_001_sqlite3_fix],  # After SQLite3 fix complete
    async_execution=False,
)
# Task T3-003: Add Type Hints to Backend Services (Week 2) - CRITICAL
task_t3_003_type_hints = Task(
    description="""Add comprehensive type hints to achieve 95% type coverage.
    
    **Problem**:
    Current type coverage: 60%. Target: 95%+.
    Missing type hints allow bugs that mypy could catch.
    
    **Scope**:
    - backend/config.py (~225 lines)
    - backend/database/connection.py (~263 lines)
    - backend/models/photo.py (~275 lines)
    - backend/services/*.py (4 non-inference files, ~1,500 lines)
    Total: ~2,263 lines of backend code
    
    **Requirements**:
    - Add type hints to all function signatures (parameter types + return types)
    - Type SQLAlchemy model relationships (complex)
    - Handle Union types (e.g., image can be str | Path | Image)
    - Enable mypy strict mode in mypy.ini
    - Add CI/CD check (fail on type errors)
    
    **Implementation Strategy**:
    1. Run `mypy backend/` - expect ~150 type errors
    2. Fix 40-50 errors per day (Days 1-3)
    3. Cross-review with Team 2 (Alex Rivera doing AI/ML services in parallel)
    4. Configure mypy.ini strict mode
    5. Add GitHub Actions mypy check
    
    **Success Criteria**:
    - `mypy backend/ --strict`: 0 errors
    - Type coverage ≥95% (measured with mypy --html-report)
    - CI/CD fails on new type errors
    - SQLAlchemy relationships properly typed
    
    **Timeline**: Week 2 (full week, 5 days)
    **Agent**: GraphQL API Specialist (type system expert)
    **Confidence**: 85% (tedious, SQLAlchemy typing tricky)
    **Priority**: P0 CRITICAL - Prevents entire class of bugs""",
    
    agent=backend_services_agent_6,  # GraphQL specialist understands types
    
    expected_output="""Type hints implementation with:
    - backend/*.py (all files with complete type hints)
    - mypy.ini (strict mode: disallow_untyped_defs=True, etc.)
    - .github/workflows/ci.yml (mypy check added, fails on errors)
    - tests/type_checking/ (test type coverage)
    - Documentation: Type hints style guide (Dict[str, Any] vs specific types)
    - Metrics: Coverage report showing 95%+ achieved""",
    
    output_file="backend/type_hints_implementation.md",
    tools=standard_tools + code_tools,
    context=[task_t3_002_di_refactor],  # After DI (signatures change)
    async_execution=False,
)

# Task T3-004: Build FastAPI Application (Week 3-5) - CRITICAL, LARGEST TASK
task_t3_004_fastapi = Task(
    description="""Build complete FastAPI REST API with 15+ endpoints - UNBLOCKS FRONTEND.
    
    **This is the API layer that enables the entire frontend.**
    
    **3-Week Phased Approach**:
    - Week 3: FastAPI skeleton + photo endpoints (upload, get, list, delete)
    - Week 4: Search + user endpoints + middleware (auth, errors, logging)
    - Week 5: Creative + system endpoints + Pydantic models + OpenAPI docs
    
    **Key Endpoints (15 total)**:
    ```
    # Photos (4 endpoints)
    POST   /api/v1/photos/upload          # Upload + trigger processing
    GET    /api/v1/photos                 # List with pagination (offset, limit)
    GET    /api/v1/photos/{id}            # Detail with AI analysis
    DELETE /api/v1/photos/{id}            # Delete with cascade (DB + Qdrant)
    
    # Search (2 endpoints)
    POST   /api/v1/search                 # Semantic search (text → embeddings)
    POST   /api/v1/search/similar         # Visual similarity (image → similar images)
    
    # Users (3 endpoints)
    POST   /api/v1/users/login            # JWT authentication (returns token)
    POST   /api/v1/users/logout           # Invalidate token
    GET    /api/v1/users/me               # Current user profile
    
    # Creative (2 endpoints) - Week 5
    POST   /api/v1/creative/loop          # Start creative loop (returns loop_id)
    GET    /api/v1/creative/{id}/results  # Get loop results (iterations)
    
    # System (4 endpoints)
    GET    /api/v1/system/hardware        # Hardware capabilities (tier: MINIMAL/STANDARD/ENHANCED/OPTIMAL)
    GET    /api/v1/system/health          # Health check (DB, Qdrant, Ollama status)
    GET    /api/v1/system/models          # Available AI models
    GET    /api/v1/system/version         # API version
    ```
    
    **Requirements**:
    - All endpoints functional and tested
    - JWT authentication middleware (protect endpoints)
    - Error handling middleware (catch exceptions, return Version 85 messages)
    - Request validation (Pydantic models)
    - Response serialization (Pydantic models)
    - OpenAPI documentation (auto-generated, available at /docs)
    - CORS configuration (allow frontend at localhost:3000)
    - Logging middleware (request/response logging)
    
    **Success Criteria**:
    - All 15+ endpoints functional
    - OpenAPI docs at /docs (Swagger UI)
    - Postman collection 100% pass rate
    - Response time <200ms (p95) for non-AI endpoints
    - Error messages use Version 85 language ("Something went wrong" not "HTTP 500")
    - Integration with existing services (photo_processing_pipeline, clip_embedding_service, etc.)
    
    **Timeline**: Week 3-5 (3 weeks, largest single task)
    **Agent**: Morgan Lee (API Gateway Architect) leads, David Kim (DB), GraphQL specialist (Pydantic models)
    **Confidence**: 85% (standard FastAPI patterns, but 15+ endpoints is substantial work)
    **Priority**: P0 CRITICAL - Frontend depends on this""",
    
    agent=backend_services_agent_1,  # Morgan Lee leads
    
    expected_output="""Complete FastAPI application with:
    - backend/api/main.py (FastAPI app initialization, middleware setup)
    - backend/api/dependencies.py (DI: get_db, get_qdrant, get_current_user)
    - backend/api/routes/photos.py (4 photo endpoints)
    - backend/api/routes/search.py (2 search endpoints)
    - backend/api/routes/users.py (3 user/auth endpoints)
    - backend/api/routes/creative.py (2 creative loop endpoints)
    - backend/api/routes/system.py (4 system endpoints)
    - backend/api/models/requests.py (Pydantic request models: PhotoUploadRequest, SearchRequest, etc.)
    - backend/api/models/responses.py (Pydantic response models: PhotoResponse, SearchResultsResponse, etc.)
    - backend/api/middleware/auth.py (JWT authentication, protect routes)
    - backend/api/middleware/errors.py (Exception handling, Version 85 messages)
    - backend/api/middleware/logging.py (Request/response logging)
    - tests/api/GaryVision.postman_collection.json (Manual testing)
    - OpenAPI documentation (auto-generated at /docs)""",
    
    output_file="backend/api/implementation.md",
    tools=standard_tools + code_tools,
    context=[task_t3_002_di_refactor],  # After DI refactor
    async_execution=False,  # Sequential (critical path)
)

# Task T3-005: Fix Search Algorithm Correctness Bug (Week 3) - CRITICAL
task_t3_005_search_fix = Task(
    description="""Fix search_similar_photos() to guarantee exactly N results.
    
    **Problem** (From Team 4 Logic Review):
    Current implementation violates contract - returns 7-10 photos when asked for 10.
    Root cause: Orphaned embeddings (exist in Qdrant but not in PostgreSQL).
    
    **Current Buggy Code** (backend/services/clip_embedding_service.py ~line 190):
    ```python
    def search_similar_photos(self, query, limit=10):
        results = qdrant.search(query_embedding, limit=limit)  # Gets 10 from Qdrant
        for result in results:
            photo = db.query(Photo).filter_by(id=result.id).first()
            if photo:  # But only 7-10 have PostgreSQL records (orphans filtered)
                yield photo
        # Returns 7-10, not guaranteed 10 - CONTRACT VIOLATION
    ```
    
    **Solution - Over-fetch to Compensate**:
    ```python
    def search_similar_photos(self, query, limit=10):
        # Over-fetch to compensate for potential orphans
        overfetch_limit = limit * 2  # Fetch 2x to ensure we get enough valid
        results = qdrant.search(query_embedding, limit=overfetch_limit)
        
        valid_photos = []
        for result in results:
            photo = db.query(Photo).filter_by(id=result.id).first()
            if photo:
                valid_photos.append(photo)
                if len(valid_photos) >= limit:
                    break  # Stop when we have enough
        
        return valid_photos[:limit]  # Return exactly 'limit' photos
    ```
    
    **Success Criteria**:
    - Always returns exactly N results (or fewer if <N total photos exist)
    - Test: Create 5 orphans in Qdrant, request 10 → returns exactly 10 valid
    - Performance: <10ms overhead from over-fetching
    - Formal proof: Algorithm correctness (guarantees postcondition)
    
    **Timeline**: Week 3 (2 days, parallel with FastAPI main work)
    **Agent**: Storage Architect (repurposed from MinIO)
    **Confidence**: 99% (straightforward algorithmic fix)
    **Priority**: P0 CRITICAL - Search is core feature""",
    
    agent=backend_services_agent_3,  # Taylor Chen, repurposed
    
    expected_output="""Search algorithm fix with:
    - backend/services/clip_embedding_service.py (search_similar_photos() updated, ~30 lines changed)
    - tests/unit/test_search_correctness.py (test with orphans scenario)
    - tests/integration/test_search_guarantees.py (integration test with real Qdrant)
    - Performance measurement: Before (avg 82ms) vs After (avg 89ms) - 8% overhead acceptable
    - Documentation: Algorithm correctness proof (postcondition: len(results) == min(limit, total_valid_photos))""",
    
    output_file="backend/services/search_fix_implementation.md",
    tools=standard_tools + code_tools,
    context=[],  # No dependencies, can do anytime Week 3
    async_execution=True,  # Can parallel with FastAPI main work
)

# Task T3-006: Implement Saga Pattern for Transaction Coordination (Week 4)
task_t3_006_saga = Task(
    description="""Implement Saga pattern for Qdrant + PostgreSQL transaction coordination.
    
    **Problem** (From Team 1 Architecture Review):
    Storing embeddings requires 2-database write:
    1. Qdrant (vector embedding)
    2. PostgreSQL (embedding metadata)
    
    Race condition: If Qdrant succeeds but PostgreSQL fails, data is inconsistent.
    Invariant violated: embedding ∈ Qdrant ⟺ embedding ∈ PostgreSQL
    
    **Solution - Saga Pattern with Compensating Transactions**:
    ```python
    async def store_embedding_saga(photo_id, embedding_vector, metadata):
        qdrant_id = None
        try:
            # Step 1: Store in Qdrant first
            qdrant_id = await qdrant.upsert(
                collection="photo_embeddings",
                points=[{"id": photo_id, "vector": embedding_vector, "payload": metadata}]
            )
            
            # Step 2: Store in PostgreSQL
            db_record = PhotoEmbedding(
                photo_id=photo_id,
                embedding_type="clip",
                vector=embedding_vector,
                metadata=metadata
            )
            db.add(db_record)
            await db.commit()
            
        except QdrantError as e:
            # Rollback: Nothing to do (Qdrant failed before PostgreSQL write)
            logger.error(f"Qdrant write failed: {e}")
            raise
            
        except DatabaseError as e:
            # Compensating transaction: Remove from Qdrant
            if qdrant_id:
                await qdrant.delete(collection="photo_embeddings", points=[qdrant_id])
            logger.error(f"PostgreSQL write failed, rolled back Qdrant: {e}")
            raise
            
        except Exception as e:
            # Unknown error: Rollback both
            if qdrant_id:
                try:
                    await qdrant.delete(collection="photo_embeddings", points=[qdrant_id])
                except:
                    logger.critical(f"Failed to rollback Qdrant after error: {e}")
            raise
    ```
    
    **Success Criteria**:
    - Maintains invariant: embedding ∈ Qdrant ⟺ embedding ∈ PostgreSQL
    - Test 12 failure scenarios:
      * Qdrant succeeds, PostgreSQL fails → Qdrant rolled back
      * Both fail → Clean state
      * Network partition → Timeout + rollback
      * Compensating transaction fails → Logged as critical
    - Compensating transaction success rate >99.9%
    
    **Timeline**: Week 4 (3 days)
    **Agent**: Dr. David Kim (Database Architect)
    **Confidence**: 85% (Saga is well-understood, but edge cases exist)
    **Priority**: P1 HIGH - Prevents data inconsistency""",
    
    agent=backend_services_agent_2,  # David Kim (distributed transactions expert)
    
    expected_output="""Saga pattern implementation with:
    - backend/services/clip_embedding_service.py (store_photo_embedding_saga() method)
    - backend/utils/saga_pattern.py (generic saga coordinator, reusable for other 2-phase operations)
    - tests/integration/test_saga_pattern.py (12 failure scenarios tested)
    - tests/integration/test_saga_rollback.py (verify compensating transactions)
    - Documentation: Saga pattern explanation (Martin Fowler reference)
    - Documentation: Failure recovery strategies""",
    
    output_file="backend/services/saga_implementation.md",
    tools=standard_tools + code_tools,
    context=[task_t3_004_fastapi],  # After FastAPI integration available
    async_execution=False,
)

# Task T3-007: Implement Async Processing (Week 6)
task_t3_007_async = Task(
    description="""Implement async photo processing with parallel AI inference.
    
    **Performance Optimization** (From Team 2 AI/ML Review):
    
    **Current (Sequential)**:
    CLIP (480ms) → wait → YOLO (280ms) → wait → LLaVA (1640ms) = 2400ms total
    
    **Target (Parallel)**:
    CLIP + YOLO + LLaVA run simultaneously = max(480, 280, 1640) + 200ms overhead = 1840ms
    Improvement: 2400ms → 1840ms (23% faster!)
    
    **Implementation with asyncio.gather**:
    ```python
    async def process_photo_async(photo_path: str) -> ProcessingResults:
        # Run all three AI services in parallel
        clip_task = clip_service.extract_embeddings_async(photo_path)
        yolo_task = yolo_service.detect_objects_async(photo_path)
        llava_task = llava_service.describe_async(photo_path)
        
        # Wait for all to complete (or any to fail)
        try:
            clip_result, yolo_result, llava_result = await asyncio.gather(
                clip_task, yolo_task, llava_task,
                return_exceptions=False  # Fail if any service fails
            )
        except Exception as e:
            # Handle partial failures (some succeeded, some failed)
            logger.error(f"Photo processing failed: {e}")
            raise
        
        return ProcessingResults(clip=clip_result, yolo=yolo_result, llava=llava_result)
    ```
    
    **Requirements**:
    - Convert services to async (async def methods)
    - Implement asyncio.gather for parallel execution
    - Maintain error handling (one failure doesn't corrupt results)
    - Update FastAPI endpoints to async (async def endpoint functions)
    - Verify thread safety (ONNX models are thread-safe, verify Ollama)
    
    **Success Criteria**:
    - Processing time: 2400ms → ~2000ms (17% improvement, accounting for overhead)
    - All three services run in parallel (verified with timing logs)
    - Error handling preserved (test each service failure independently)
    - No race conditions (verify with 1000 parallel requests)
    
    **Timeline**: Week 6 (4 days)
    **Agent**: Message Queue Specialist (repurposed for async patterns)
    **Confidence**: 90% (asyncio is well-documented, but ONNX/Ollama thread safety needs verification)
    **Priority**: P1 HIGH - 17% performance gain""",
    
    agent=backend_services_agent_5,  # Riley Johnson, async expert
    
    expected_output="""Async processing implementation with:
    - backend/services/photo_processing_pipeline.py (process_photo_async() method)
    - backend/services/inference/onnx_clip.py (async wrapper: extract_embeddings_async())
    - backend/services/inference/onnx_yolo.py (async wrapper: detect_objects_async())
    - backend/services/inference/ollama_llava.py (already async, verify thread safety)
    - backend/api/routes/photos.py (async def upload_photo endpoint)
    - Performance benchmarks: Sequential (2400ms) vs Parallel (2000ms) verified
    - Documentation: Async architecture diagram (Mermaid sequence)""",
    
    output_file="backend/services/async_implementation.md",
    tools=standard_tools + code_tools,
    context=[task_t3_004_fastapi],  # After FastAPI complete
    async_execution=False,
)

# Task T3-008: Implement JWT Authentication (Week 3) - CRITICAL
task_t3_008_jwt_auth = Task(
    description="""Implement JWT authentication for API security (simplified from Keycloak).
    
    **MVP Approach**: Simple JWT (not full Keycloak) - add Keycloak post-MVP if needed.
    
    **Requirements**:
    - JWT token generation on login
    - JWT token validation middleware
    - Protected routes (require valid token)
    - Token expiration (30 days, elder-friendly)
    - Logout (token invalidation/blacklist)
    
    **Implementation**:
    ```python
    # backend/api/middleware/auth.py
    from jose import JWTError, jwt
    from fastapi import Depends, HTTPException
    from fastapi.security import OAuth2PasswordBearer
    
    oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/users/login")
    SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    ALGORITHM = "HS256"
    EXPIRE_DAYS = 30  # Elder-friendly (don't force frequent re-auth)
    
    def create_access_token(user_id: str) -> str:
        expire = datetime.utcnow() + timedelta(days=EXPIRE_DAYS)
        to_encode = {"sub": user_id, "exp": expire}
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            # TODO: Check token blacklist (for logout)
            return get_user_from_db(user_id)
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid credentials")
    ```
    
    **Success Criteria**:
    - Login endpoint returns JWT token
    - Protected endpoints require valid token (return 401 if missing/invalid)
    - Token expires after 30 days
    - Logout blacklists token (prevents reuse)
    
    **Timeline**: Week 3 (2 days, parallel with FastAPI main work)
    **Agent**: Dr. Samira Ali (Authentication Engineer, repurposed from Keycloak)
    **Confidence**: 95% (JWT is standard, well-supported)
    **Priority**: P0 CRITICAL - API needs auth""",
    
    agent=backend_services_agent_4,  # Samira Ali
    
    expected_output="""JWT authentication with:
    - backend/api/middleware/auth.py (JWT generation, validation, ~150 lines)
    - backend/api/routes/users.py (login, logout, me endpoints)
    - backend/api/dependencies.py (get_current_user dependency)
    - backend/utils/token_blacklist.py (Redis-based token blacklist for logout)
    - tests/unit/test_auth.py (token generation, validation, expiration tests)
    - tests/integration/test_protected_routes.py (verify 401 on invalid token)
    - Documentation: Authentication flow diagram""",
    
    output_file="backend/api/auth_implementation.md",
    tools=standard_tools + code_tools,
    context=[task_t3_004_fastapi],  # Parallel with FastAPI
    async_execution=True,  # Can work in parallel with FastAPI main endpoints
)

# Task T3-009: Implement WebSocket for Real-Time Progress Updates (Week 9)
task_t3_009_websocket = Task(
    description="""Implement WebSocket for real-time creative loop progress updates.
    
    **Use Case**:
    Creative loop takes 90 seconds (3 iterations × 30s each).
    Without progress feedback: User waits 90s, wonders "Is it working? Did it freeze?"
    With WebSocket progress: User sees live updates every 5-10s, confident it's working.
    
    **Implementation**:
    ```python
    # backend/api/websocket.py
    from fastapi import WebSocket, WebSocketDisconnect
    
    @app.websocket("/ws/progress/{session_id}")
    async def progress_websocket(websocket: WebSocket, session_id: str):
        await websocket.accept()
        
        try:
            # Subscribe to progress events for this session_id
            async for event in progress_event_stream(session_id):
                await websocket.send_json({
                    "type": event.type,  # "iteration_start", "phase_complete", "loop_done"
                    "progress": event.progress,  # 0-100
                    "iteration": event.iteration,  # 1, 2, 3
                    "phase": event.phase,  # "image_to_text", "text_to_image"
                    "message": event.message,  # "Analyzing your photo..."
                    "timestamp": event.timestamp.isoformat()
                })
        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected: {session_id}")
    ```
    
    **Frontend Integration** (for Team 4):
    ```typescript
    // frontend/src/hooks/useWebSocket.ts
    const useCreativeLoopProgress = (sessionId: string) => {
      const [progress, setProgress] = useState(0);
      const [message, setMessage] = useState("");
      
      useEffect(() => {
        const ws = new WebSocket(`ws://localhost:8000/ws/progress/${sessionId}`);
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          setProgress(data.progress);
          setMessage(data.message);
        };
        return () => ws.close();
      }, [sessionId]);
      
      return { progress, message };
    };
    ```
    
    **Requirements**:
    - WebSocket connection established and maintained
    - Progress events emitted from creative_loop_engine.py
    - Frontend receives and displays progress
    - Graceful disconnect/reconnect handling
    - Connection cleanup on loop completion
    
    **Success Criteria**:
    - WebSocket connection opens successfully
    - Progress events received by frontend (tested with manual loop)
    - Progress bar updates in real-time
    - Connection handles disconnect gracefully (reconnect or show error)
    
    **Timeline**: Week 9 (3 days, after creative loop engine exists)
    **Agent**: Message Queue Specialist (WebSocket is similar to queue patterns)
    **Confidence**: 85% (WebSocket is standard, but creative loop integration is new)
    **Priority**: P1 HIGH - Greatly improves UX for 90s loops""",
    
    agent=backend_services_agent_5,  # Riley Johnson
    
    expected_output="""WebSocket implementation with:
    - backend/api/websocket.py (WebSocket endpoint, ~100 lines)
    - backend/services/creative_loop_engine.py (emit progress events, ~50 lines added)
    - backend/utils/event_stream.py (Progress event pub/sub system, ~150 lines)
    - frontend/src/hooks/useWebSocket.ts (React hook for Team 4, ~80 lines)
    - tests/integration/test_websocket.py (connection, events, disconnect handling)
    - Documentation: WebSocket API specification""",
    
    output_file="backend/api/websocket_implementation.md",
    tools=standard_tools + code_tools,
    context=[],  # Depends on T2-005 (creative loop) but that's Team 2
    async_execution=False,
)

# ============================================================================
# Crew Configuration - Updated for MVP
# ============================================================================

backend_services_crew = Crew(
    agents=[
        backend_services_agent_1,  # Morgan Lee (API Gateway → FastAPI lead)
        backend_services_agent_2,  # Dr. David Kim (Database Architect)
        backend_services_agent_3,  # Taylor Chen (Storage → Search fix specialist)
        backend_services_agent_4,  # Dr. Samira Ali (Auth → JWT instead of Keycloak)
        backend_services_agent_5,  # Riley Johnson (Queue → Async + WebSocket)
        backend_services_agent_6,  # GraphQL specialist (→ Type hints + Pydantic models)
    ],
    tasks=[
        task_t3_001_sqlite3_fix,     # Week 1, Days 1-3: SQLite3 fix
        task_t3_002_di_refactor,     # Week 1, Days 3-4: DI refactor
        task_t3_003_type_hints,      # Week 2: Type hints
        task_t3_004_fastapi,         # Week 3-5: FastAPI (LARGEST)
        task_t3_005_search_fix,      # Week 3: Search fix (parallel)
        task_t3_006_saga,            # Week 4: Saga pattern
        task_t3_007_async,           # Week 6: Async processing
        task_t3_008_jwt_auth,        # Week 3: JWT (parallel)
        task_t3_009_websocket,       # Week 9: WebSocket
    ],
    process=Process.hierarchical,  # Morgan Lee coordinates as manager
    manager_llm=specialist_llm,
    verbose=True,
    memory=True,
    max_rpm=60,
    max_execution_time=7200,
)

# Export for easy import
__all__ = ['backend_services_crew']
