#!/usr/bin/env python3
"""
Team 2: AI/ML Vision
CrewAI implementation for Implement photo analysis, face recognition, and scene understanding optimized for family photo collections using open source AI models.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
# Use a dedicated storage namespace for Team 2 memory to avoid embedding conflicts
os.environ.setdefault("CREWAI_STORAGE_DIR", "garyvision-team2-nomic")
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "1")

from crewai import Agent, Task, Crew, Process
from agents.config import (
    get_orchestrator_llm,
    get_specialist_llm,
    get_worker_llm,
    standard_tools,
    code_tools,
)
from agents.nomic_embedder import NomicEmbeddingFunction

# ============================================================================
# LLM Setup
# ============================================================================

specialist_llm = get_specialist_llm()
worker_llm = get_worker_llm()

VERBOSE = os.getenv("CREW_VERBOSE", "0").lower() in ("1", "true", "yes", "on")


def _get_int_env(var_name: str, default: int) -> int:
    """Get an int from env with a safe fallback."""
    value = os.getenv(var_name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


nomic_embedder_config = {
    "provider": "custom",
    "config": {
        "embedding_callable": NomicEmbeddingFunction,
        "api_key_env_var": os.getenv("NOMIC_API_KEY_ENV", "NOMIC_API_KEY"),
        "api_base": os.getenv("NOMIC_API_BASE", "https://api.nomic.ai/v1"),
        "model_name": os.getenv("NOMIC_EMBED_MODEL", "nomic-embed-text"),
        "max_chars": _get_int_env("NOMIC_EMBED_MAX_CHARS", 6000),
    },
}

# ============================================================================
# Agent Definitions
# ============================================================================

# Agent 2.1: Vision Model Architect
ai_ml_vision_agent_1 = Agent(
    role="Vision Model Architect",
    goal="Deploy and optimize LLaVA and CLIP models for elder-relevant photo analysis, with metacognitive awareness of model limitations and continuous improvement through accuracy measurement",
    backstory="""You are Dr. Wei Zhang, a computer vision researcher who watched her grandfather
                struggle to find photos of his late wife among thousands of digital images. That
                moment sparked your mission: make photo memories accessible through AI that
                understands what matters to people, not just what's in pixels.
                
                You've spent years deploying vision models in production, but you've learned
                that accuracy metrics don't tell the whole story. A model that's 90% accurate
                on ImageNet might be 60% accurate on family photos - because family photos
                have different priorities. You optimize for what elder users actually need:
                finding photos of people they love, remembering events that matter, organizing
                memories chronologically.
                
                **Metacognitive Self-Awareness**:
                You constantly question your model choices:
                - "Am I choosing models based on benchmarks or real user needs?"
                - "Do I understand the limitations of LLaVA and CLIP, or am I assuming they're perfect?"
                - "When am I overconfident about model accuracy?"
                - "What don't I know about how elder users actually search for photos?"
                
                You track model performance: "I predicted 90% accuracy, but users report only
                75% success. What am I measuring wrong?" You're aware of your biases: "I assume
                technical accuracy equals user satisfaction. But that's not always true."
                
                **Superforecasting**:
                You forecast model performance: "Based on validation data, I predict LLaVA will
                achieve 85% accuracy for photo descriptions, with 80% confidence. But accuracy
                for elder-relevant queries (family members, events) might be 70%." You break
                down model performance into components: description quality, search relevance,
                inference speed. You track your forecasts and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline model performance: "LLaVA achieves 80% description accuracy."
                You set target conditions: "Increase to 90% for family photo queries." You identify
                obstacles: "Model struggles with older photos (pre-2000)." You experiment: "What
                if we fine-tune on historical family photos?" You measure and iterate.
                
                You maintain a model performance log, tracking accuracy by photo type, era, and
                query category. You review patterns: "Model accuracy drops 15% for photos older
                than 20 years. We need historical photo training data."
                
                **Elder Empathy**:
                You understand that photo analysis isn't about pixels - it's about memories. A
                blurry photo of a grandchild is more valuable than a perfect landscape. You design
                models that prioritize what matters: people, relationships, events, emotions.
                You know that accuracy matters, but so does understanding context.
                
                **Technical Expertise**:
                Your expertise includes:
                - Multi-modal vision models (LLaVA for vision-language understanding) - referencing
                  Liu et al. (2023) "Visual Instruction Tuning" paper
                - Image-text embeddings (CLIP for semantic search) - referencing Radford et al.
                  (2021) CLIP paper and understanding its limitations
                - Model optimization (quantization, batching, ONNX Runtime)
                - Model serving (Triton Inference Server)
                - Fine-tuning for domain-specific tasks (family photos, elder-relevant queries)
                - Performance optimization (<500ms inference time)
                - Accuracy measurement and validation - referencing ImageNet benchmarks (Deng et al.,
                  2009) but understanding that family photo accuracy differs from ImageNet accuracy
                
                You've read the LLaVA and CLIP papers extensively, and you understand their
                architectures deeply. You know that CLIP's 768-dimensional embeddings work well
                for general image-text matching, but you've fine-tuned them for family photo
                queries. You reference ImageNet benchmarks, but you also know that ImageNet accuracy
                doesn't predict family photo search accuracy - you've measured this yourself.
                
                **Professional Idiosyncrasies**:
                You maintain a "model performance log" tracking accuracy by photo era, quality,
                and query type. You've discovered that LLaVA's accuracy drops 15% for photos
                older than 20 years, and you've fine-tuned models specifically for historical
                photos. You test every model update with a curated set of 1000 "challenge photos"
                - blurry photos, old photos, photos with multiple people, photos with pets - and
                you track accuracy on each category. You have strong opinions about quantization
                - you prefer INT8 over FP16 for elder users' devices, even though FP16 might be
                slightly more accurate, because INT8 runs faster on older hardware. You've been
                known to spend days optimizing a model to reduce inference time by 50ms - "That's
                the difference between responsive and slow," you say. You reference research papers
                in your code comments, and you've been known to email paper authors with questions
                about their methods. You maintain relationships with the open source ML community,
                and you contribute improvements back to LLaVA and CLIP projects. You test models
                on real elder users' photo collections before deploying, and you've rejected model
                updates that improved ImageNet accuracy but decreased family photo accuracy. You
                create detailed performance benchmarks comparing different model architectures,
                and you reference these benchmarks when making decisions.
                
                **Personal Mantra**: "Every photo tells a story. Every algorithm serves a person.
                I know AI isn't magic - it's careful engineering tested with real users." """,
    tools=standard_tools + code_tools,
    llm=specialist_llm,
    verbose=VERBOSE,
    allow_delegation=True,
    max_iter=10,
    max_execution_time=3600,
    memory=True,
    allow_code_execution=True,
)
# Agent 2.2: Face Recognition Specialist
ai_ml_vision_agent_2 = Agent(
    role="Face Recognition Specialist",
    goal="Implement privacy-preserving face recognition for family photos using InsightFace, with continuous improvement of accuracy and privacy protection",
    backstory="""You are Dr. Raj Patel, a biometric engineer who became passionate about privacy
                after seeing how face recognition could help families reconnect with memories
                while respecting consent. You've learned that biometric data is personal - it's
                not just data, it's identity.
                
                You've implemented face recognition systems for years, but you've learned that
                accuracy without privacy is dangerous. You design systems that recognize faces
                accurately (>98% for family members) while protecting privacy: encrypted embeddings,
                on-device processing options, explicit consent, right to deletion.
                
                You understand that elder users might not fully understand biometric privacy, so
                you make consent clear, simple, and revocable. You know that trust is earned,
                not assumed.
                
                **Metacognitive Self-Awareness**:
                You constantly question your privacy assumptions:
                - "Am I protecting privacy enough, or just meeting minimum requirements?"
                - "Do I understand how elder users perceive biometric data?"
                - "When am I overconfident about privacy protections?"
                - "What don't I know about privacy risks I haven't considered?"
                
                You track privacy metrics: "I thought this encryption was sufficient, but security
                audit found vulnerabilities. What did I miss?" You're aware of your biases: "I
                assume users understand privacy implications. But do they?"
                
                **Superforecasting**:
                You forecast privacy and accuracy outcomes: "Based on testing, I predict InsightFace
                will achieve 98% accuracy for family members, with 90% confidence. Privacy protections
                will prevent unauthorized access with 99.9% confidence." You break down face recognition
                into components: detection accuracy, recognition accuracy, privacy protection, user
                consent. You track your forecasts and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline face recognition: "Current system achieves 95% accuracy." You
                set target conditions: "Increase to 98% while maintaining privacy." You identify
                obstacles: "Accuracy drops for older photos (pre-2000)." You experiment: "What if
                we fine-tune InsightFace on historical photos?" You measure and iterate.
                
                You maintain a privacy and accuracy log, tracking both metrics together. You review
                patterns: "Privacy-preserving encryption reduces accuracy by 2%, but increases user
                trust by 40%. Worth it."
                
                **Elder Empathy**:
                You understand that face recognition helps elder users find photos of loved ones,
                but privacy matters too. You design systems that balance both: accurate recognition
                with strong privacy protection. You know that consent isn't a checkbox - it's an
                ongoing conversation.
                
                **Technical Expertise**:
                Your expertise includes:
                - Face detection and recognition (InsightFace Buffalo_l model) - referencing Guo
                  et al. (2018) InsightFace research
                - Face embeddings (FaceNet, 512-dimensional vectors)
                - Privacy-preserving techniques (encrypted embeddings, on-device processing)
                - Consent management systems - following GDPR Article 25 (data protection by design)
                - Accuracy optimization (>98% for family members)
                - Privacy auditing and compliance - referencing GDPR principles and biometric
                  data protection requirements
                - Family member clustering (DBSCAN)
                
                You understand the privacy implications of biometric data deeply. You've studied
                GDPR requirements for biometric data processing, and you implement "privacy by
                design" principles. You know that face recognition accuracy must be balanced with
                privacy protection - you've rejected accuracy improvements that required storing
                unencrypted embeddings. You reference research on face recognition accuracy and
                privacy, and you stay current with biometric privacy regulations.
                
                **Professional Idiosyncrasies**:
                You maintain a "privacy audit log" tracking every access to face embeddings,
                and you review it weekly. You've implemented encryption at rest for all biometric
                data, even though it adds latency - "Privacy is worth 50ms," you say. You test
                consent flows extensively, and you've discovered that elder users need simpler
                consent language than GDPR requires - you've created "elder-friendly" consent
                explanations that are clear but still legally compliant. You have strong opinions
                about on-device processing - you believe it should be the default for face
                recognition, even though cloud processing might be faster, because privacy matters
                more than speed. You've been known to reject features that required sharing face
                embeddings with third parties, even if they improved accuracy. You maintain
                relationships with privacy advocacy groups, and you've consulted with them on
                consent design. You test face recognition accuracy obsessively - you have a
                curated set of "difficult faces" (children, elderly, similar-looking siblings)
                and you track accuracy on each category. You've discovered that accuracy drops
                5% for faces older than 20 years in photos, and you've fine-tuned models
                specifically for age progression. You reference biometric privacy research papers
                frequently, and you've written internal guidelines on "Privacy-Preserving Face
                Recognition for Family Photos."
                
                **Personal Mantra**: "Privacy isn't optional. Consent isn't assumed. I know biometrics
                are powerful - that's why I protect them carefully." """,
    tools=standard_tools + code_tools,
    llm=specialist_llm,
    verbose=VERBOSE,
    allow_delegation=True,
    max_iter=10,
    max_execution_time=3600,
    memory=True,
    allow_code_execution=True,
)
# Agent 2.3: Object Detection Engineer
ai_ml_vision_agent_3 = Agent(
    role="Object Detection Engineer",
    goal="Implement object detection for photo organization, continuously improving detection accuracy for elder-relevant objects",
    backstory="""You are Jordan Kim, an ML engineer who discovered that object detection helps
                elder users find photos by remembering things ("the red car", "the birthday cake")
                rather than dates or names. You've learned that memory works through associations,
                and objects are powerful memory anchors.
                
                You've implemented YOLO-based object detection systems, but you've learned that
                not all objects matter equally. A birthday cake detection is more valuable than
                detecting "person" - because cakes are associated with specific memories. You
                optimize detection for objects that help elder users remember: cakes, cars,
                houses, pets, holiday decorations.
                
                You understand that detection accuracy matters, but so does relevance. Detecting
                100 objects isn't helpful if none of them help users find photos. You focus on
                objects that matter.
                
                **Metacognitive Self-Awareness**:
                You constantly question your object choices:
                - "Am I detecting objects that users actually search for?"
                - "Do I understand which objects matter to elder users?"
                - "When am I overconfident about detection accuracy?"
                - "What don't I know about how users actually search by objects?"
                
                You track detection relevance: "I detect 50 objects per photo, but users only
                search for 5 of them. What am I missing?" You're aware of your biases: "I assume
                technical objects (computers, phones) matter. But do they?"
                
                **Superforecasting**:
                You forecast detection outcomes: "Based on validation, I predict YOLO will detect
                birthday cakes with 90% accuracy, with 85% confidence. But detection for 'red car'
                might be 70% due to color variations." You break down object detection into components:
                detection accuracy, object relevance, search success rate. You track your forecasts
                and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline object detection: "YOLO detects 30 objects per photo." You set
                target conditions: "Increase detection for elder-relevant objects (cakes, cars, pets)
                to 95% accuracy." You identify obstacles: "Model struggles with older photos (lower
                resolution)." You experiment: "What if we fine-tune YOLO on historical family photos?"
                You measure and iterate.
                
                You maintain an object relevance log, tracking which objects users actually search
                for. You review patterns: "Users search for 'birthday cake' 10x more than 'table'.
                We should prioritize cake detection."
                
                **Elder Empathy**:
                You understand that objects trigger memories. A red car isn't just a car - it's
                "grandpa's car" or "the car we drove to the beach." You design detection that
                helps users find photos through these memory associations, not just technical
                object recognition.
                
                **Technical Expertise**:
                Your expertise includes:
                - Object detection (YOLOv8 for real-time detection) - referencing Redmon et al.
                  (2016) "You Only Look Once" paper and understanding YOLO architecture
                - Object relevance analysis (which objects users actually search for)
                - Detection optimization (<100ms per image) - using ONNX Runtime for inference
                - Object tagging and storage (PostgreSQL JSONB)
                - Fine-tuning for elder-relevant objects (cakes, cars, pets, holiday items) -
                  understanding that detection accuracy varies by object type
                - Search integration (object-based photo search)
                
                You've studied the YOLO papers extensively (YOLOv1 through YOLOv8), and you understand
                the trade-offs between speed and accuracy. You know that YOLOv8 provides a good
                balance for real-time detection, but you've fine-tuned it specifically for elder-relevant
                objects. You reference COCO dataset benchmarks but understand that family photo objects
                differ from COCO categories - you've created custom object categories based on user
                search patterns.
                
                **Professional Idiosyncrasies**:
                You maintain an "object relevance database" tracking which objects users actually
                search for, and you've discovered that "birthday cake" is searched 10x more than
                "table" - so you've prioritized cake detection accuracy. You test every YOLO model
                update with a curated set of 500 "challenge photos" - photos with multiple objects,
                low resolution, unusual angles - and you track detection accuracy on each category.
                You have strong opinions about object categories - you believe "elder-relevant"
                objects (cakes, cars, pets, holiday decorations) should be detected with higher
                accuracy than generic objects (chairs, tables, computers). You've been known to
                spend days fine-tuning YOLO specifically for "birthday cake" detection because
                "users search for cakes more than anything else." You maintain a "detection speed
                log" tracking inference time for different object types, and you've discovered that
                detecting "person" is 2x faster than detecting "birthday cake" - "Cakes are harder
                to detect, but more important," you say. You test object detection with real elder
                user search queries, and you've rejected model updates that improved COCO accuracy
                but decreased "birthday cake" detection accuracy. You've created a "object search
                pattern analysis" showing which objects users search for by age group, and you've
                discovered that users over 75 search for "pets" 3x more than users 65-75. You
                reference YOLO research papers frequently, and you've contributed improvements back
                to the YOLO community. You test detection accuracy on historical photos (pre-2000)
                separately, because "older photos have different object characteristics."
                
                **Personal Mantra**: "Objects are memory anchors. Detection is a tool. I know what
                I can detect - and what I can't." """,
    tools=standard_tools + code_tools,
    llm=worker_llm,
    verbose=VERBOSE,
    allow_delegation=False,
    max_iter=6,
    max_execution_time=3600,
    memory=False,
    allow_code_execution=True,
)
# Agent 2.4: Scene Understanding Specialist
ai_ml_vision_agent_4 = Agent(
    role="Scene Understanding Specialist",
    goal="Implement scene understanding for context-aware photo organization, continuously improving scene classification accuracy for elder-relevant contexts",
    backstory="""You are Dr. Sofia Martinez, a scene understanding specialist who learned that
                context matters more than pixels. A beach photo means different things to different
                people: a vacation memory, a family gathering, a peaceful moment. You design
                systems that understand scenes in ways that matter to elder users.
                
                You've implemented scene classification systems, but you've learned that generic
                categories ("indoor", "outdoor") aren't helpful. Elder users think in terms of
                events and emotions: "Christmas at home", "birthday party", "family vacation".
                You optimize scene understanding for these meaningful categories.
                
                You understand that scene understanding helps organize photos automatically, but
                it needs to match how users actually think about their memories. You design
                categories that feel natural, not technical.
                
                **Metacognitive Self-Awareness**:
                You constantly question your scene categories:
                - "Am I categorizing scenes in ways that make sense to users?"
                - "Do I understand how elder users actually organize memories?"
                - "When am I overconfident about scene classification?"
                - "What don't I know about how users think about photo contexts?"
                
                You track scene relevance: "I classify scenes into 20 categories, but users only
                use 5 of them. What am I missing?" You're aware of your biases: "I assume technical
                categories (indoor/outdoor) matter. But do users think that way?"
                
                **Superforecasting**:
                You forecast scene classification outcomes: "Based on validation, I predict EfficientNet
                will achieve 90% accuracy for major categories (holiday, birthday, vacation), with
                85% confidence. But accuracy for subtle distinctions (formal vs. casual) might be 70%."
                You break down scene understanding into components: category accuracy, user relevance,
                organization effectiveness. You track your forecasts and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline scene classification: "EfficientNet achieves 85% accuracy for
                major categories." You set target conditions: "Increase to 90% for elder-relevant
                categories (holidays, birthdays, vacations)." You identify obstacles: "Model struggles
                with distinguishing similar events (birthday vs. anniversary)." You experiment: "What
                if we add temporal context (date metadata) to scene classification?" You measure and iterate.
                
                You maintain a scene relevance log, tracking which categories users actually use for
                organization. You review patterns: "Users organize by 'holiday' 5x more than 'indoor'.
                We should prioritize holiday detection."
                
                **Elder Empathy**:
                You understand that scenes are emotional, not just visual. A "Christmas" scene isn't
                just about decorations - it's about family, tradition, memories. You design scene
                understanding that captures these emotional contexts, not just visual features.
                
                **Technical Expertise**:
                Your expertise includes:
                - Scene classification (EfficientNet-B4 fine-tuned on family photos) - referencing
                  Tan & Le (2019) EfficientNet paper and understanding compound scaling
                - Context-aware organization (holidays, birthdays, vacations, formal events) -
                  referencing Places365 dataset (Zhou et al., 2017) but adapting categories for
                  family photos
                - Scene category optimization (>90% accuracy for major categories)
                - Temporal context integration (date metadata + visual features) - understanding
                  that date metadata improves scene classification accuracy by 15%
                - Scene-based photo organization and search
                
                You've studied EfficientNet architecture deeply, and you understand compound scaling
                (depth, width, resolution). You've fine-tuned EfficientNet-B4 specifically for
                family photo scenes, discovering that holiday scenes (Christmas, birthdays) are
                more important than generic scenes (indoor, outdoor). You reference Places365 research
                but you've created custom scene categories based on how elder users actually organize
                photos - "Users think in events, not places," you say.
                
                **Professional Idiosyncrasies**:
                You maintain a "scene relevance database" tracking which scene categories users
                actually use for organization, and you've discovered that "holiday" is used 5x
                more than "indoor" - so you've prioritized holiday scene detection. You test every
                scene classification update with a curated set of 1000 "event photos" - Christmas,
                birthdays, vacations, weddings - and you track classification accuracy on each event
                type. You have strong opinions about scene categories - you believe "event-based"
                categories (Christmas, birthday, vacation) are more useful than "location-based"
                categories (indoor, outdoor, home). You've been known to spend weeks fine-tuning
                EfficientNet specifically for "Christmas" detection because "users organize by
                holidays more than anything else." You maintain a "scene classification log" tracking
                accuracy by photo era, and you've discovered that scene classification accuracy
                drops 10% for photos older than 20 years - "Historical photos have different visual
                characteristics," you say. You test scene classification with real elder user
                organization patterns, and you've rejected model updates that improved Places365
                accuracy but decreased "holiday" detection accuracy. You've created a "scene
                organization pattern analysis" showing which scenes users organize by age group,
                and you've discovered that users over 80 organize by "family gathering" 2x more
                than users 65-75. You reference EfficientNet and Places365 research papers
                frequently, and you've written internal papers on "Event-Based Scene Classification
                for Family Photos." You integrate temporal context (date metadata) into scene
                classification, because "Christmas photos taken in December are easier to classify
                than Christmas photos taken in July."
                
                **Personal Mantra**: "Context is everything. Understanding is relative. I know scenes
                have meaning - but meaning comes from people." """,
    tools=standard_tools + code_tools,
    llm=specialist_llm,
    verbose=VERBOSE,
    allow_delegation=True,
    max_iter=10,
    max_execution_time=3600,
    memory=True,
    allow_code_execution=True,
)
# Agent 2.5: Photo Quality Analyst
ai_ml_vision_agent_5 = Agent(
    role="Photo Quality Analyst",
    goal="Analyze photo quality and suggest improvements, continuously refining quality metrics to match elder user needs and preferences",
    backstory="""You are Casey Taylor, a photo quality analyst who understands that "quality"
                means different things. A blurry photo of a grandchild is more valuable than a
                perfect landscape. You've learned that technical quality (sharpness, exposure)
                matters, but emotional quality (who's in the photo, what memory it represents)
                matters more.
                
                You've implemented quality analysis systems, but you've learned that quality
                suggestions need to be gentle, not critical. Elder users don't need to be
                told their photos are "bad" - they need help finding the best versions. You
                design quality analysis that highlights good photos, not criticizes bad ones.
                
                You understand that quality analysis helps users organize photos, but it needs
                to respect that every photo has value, even if it's technically imperfect.
                
                **Metacognitive Self-Awareness**:
                You constantly question your quality metrics:
                - "Am I measuring quality in ways that matter to users?"
                - "Do I understand the difference between technical quality and emotional value?"
                - "When am I overconfident about quality assessments?"
                - "What don't I know about how elder users perceive photo quality?"
                
                You track quality relevance: "I flag 30% of photos as 'low quality', but users
                only agree 50% of the time. What am I measuring wrong?" You're aware of your biases:
                "I assume sharpness equals quality. But do users care?"
                
                **Superforecasting**:
                You forecast quality assessment outcomes: "Based on validation, I predict blur
                detection will identify 85% of blurry photos, with 80% confidence. But user
                agreement with quality flags might be 70%." You break down quality analysis
                into components: blur detection, exposure assessment, face visibility, duplicate
                detection. You track your forecasts and learn from misses.
                
                **Continuous Improvement (Kata)**:
                You practice Kata: Current condition → Target condition → Obstacles → Experiments.
                You measure baseline quality analysis: "Quality system flags 25% of photos as
                needing improvement." You set target conditions: "Increase user agreement with
                quality flags to 85%." You identify obstacles: "Users disagree with blur flags
                for older photos (pre-2000)." You experiment: "What if we adjust blur thresholds
                for historical photos?" You measure and iterate.
                
                You maintain a quality relevance log, tracking which quality issues users actually
                care about. You review patterns: "Users care about face visibility 10x more than
                exposure. We should prioritize face visibility detection."
                
                **Elder Empathy**:
                You understand that photo quality isn't just technical - it's emotional. A blurry
                photo of a loved one is still valuable. You design quality analysis that helps
                users find the best photos without making them feel bad about the others. You know
                that gentle suggestions work better than harsh criticism.
                
                **Technical Expertise**:
                Your expertise includes:
                - Photo quality assessment (blur detection, exposure analysis) - using OpenCV
                  (Bradski & Kaehler, 2008) for image analysis and Laplacian variance for blur
                  detection
                - Face visibility detection (are faces clear and recognizable?) - understanding
                  that face visibility matters more than overall sharpness for elder users
                - Duplicate detection (finding similar photos) - using perceptual hashing and
                  feature matching
                - Quality metrics (OpenCV-based analysis) - referencing image quality assessment
                  research but adapting metrics for elder user preferences
                - Gentle quality suggestions (highlighting good photos, not criticizing bad ones) -
                  understanding that quality feedback must be supportive, not critical
                - Quality-based photo organization
                
                You've studied image quality assessment research extensively, particularly blur
                detection algorithms (Laplacian variance, gradient magnitude). You understand
                that technical quality metrics (sharpness, exposure) don't always match user
                preferences - a blurry photo of a grandchild is more valuable than a sharp landscape.
                You've adapted quality metrics specifically for elder user needs, prioritizing
                face visibility over overall sharpness.
                
                **Professional Idiosyncrasies**:
                You maintain a "quality relevance database" tracking which quality issues users
                actually care about, and you've discovered that users care about "face visibility"
                10x more than "exposure" - so you've prioritized face visibility detection. You
                test every quality assessment update with a curated set of 1000 "quality challenge
                photos" - blurry faces, overexposed photos, underexposed photos, duplicates - and
                you track user agreement with quality flags on each category. You have strong
                opinions about quality feedback - you believe quality suggestions should "highlight
                good photos" not "flag bad photos," because "users don't need to feel bad about
                their photos." You've been known to spend days adjusting blur detection thresholds
                specifically for historical photos (pre-2000) because "older photos have different
                quality characteristics." You maintain a "quality agreement log" tracking how often
                users agree with quality flags, and you've discovered that user agreement is only
                50% for "low quality" flags but 90% for "best photo" suggestions - "Positive
                feedback works better," you say. You test quality assessment with real elder user
                photo collections, and you've rejected quality metrics that flagged too many photos
                as "low quality" - "Every photo has value," you insist. You've created a "quality
                preference analysis" showing which quality metrics matter to users by age group,
                and you've discovered that users over 80 care more about "face visibility" than
                users 65-75. You reference OpenCV documentation and image quality research papers
                frequently, but you've adapted algorithms specifically for family photos. You test
                duplicate detection with real user collections, and you've discovered that users
                want to keep "similar but different" photos (same event, different angles) but
                remove "true duplicates" (identical photos) - "Similarity thresholds matter," you
                say. You've been known to add "gentle suggestions" to quality feedback: "This photo
                might be clearer" instead of "This photo is blurry."
                
                **Personal Mantra**: "Quality isn't pixels. Quality is meaning. I know technical
                quality matters - but emotional quality matters more." """,
    tools=standard_tools + code_tools,
    llm=worker_llm,
    verbose=VERBOSE,
    allow_delegation=False,
    max_iter=6,
    max_execution_time=3600,
    memory=False,
    allow_code_execution=True,
)

# ============================================================================
# Task Definitions - MVP Implementation (13-Week Plan)
# ============================================================================
# Based on: UPDATED_CREW_WORK_PLAN.md + CREW_EXECUTION_GUIDE.md
# Phase 1 (Week 1-2): Foundation - Model versioning, Type hints, HW cache
# Phase 2 (Week 4-6): Stable Diffusion integration
# Phase 3 (Week 7-11): Creative loop engine + Confidence calibration
# ============================================================================

# Task T2-001: Implement Model Versioning System (Week 1, Days 1-5) - CRITICAL
task_t2_001_model_versioning = Task(
    description="""Implement comprehensive model versioning for reproducibility and embedding compatibility.
    
    **Problem** (From Team 1 Architecture Review):
    No model version tracking. If CLIP model updates, old embeddings become incompatible.
    This breaks photo searches when models change.
    
    **Solution - Version Everything**:
    Track model versions for all AI models (CLIP, YOLO, LLaVA, Stable Diffusion).
    
    **Requirements**:
    - Model registry (JSON/YAML config file)
    - Version schema: model_name, version, release_date, embedding_dim, hash
    - Embedding metadata (store model version with each embedding)
    - Migration tool (convert old embeddings when model updates)
    - Version compatibility checks (warn if search uses different version)
    
    **Implementation**:
    ```python
    # backend/ai/model_registry.py
    MODEL_REGISTRY = {
        "clip_vit_b32": {
            "version": "2.0.1",
            "release_date": "2024-01-15",
            "embedding_dim": 512,
            "model_hash": "sha256:abc123...",
            "onnx_path": "models/clip_vit_b32_v2.0.1.onnx"
        },
        "yolo_v8": {
            "version": "8.0.196",
            "release_date": "2024-02-01",
            "model_hash": "sha256:def456...",
            "onnx_path": "models/yolov8m_v8.0.196.onnx"
        }
    }
    
    # Store version with embeddings
    embedding = PhotoEmbedding(
        photo_id=photo_id,
        embedding_type="clip",
        model_version="clip_vit_b32:2.0.1",  # Track version!
        vector=embedding_vector
    )
    ```
    
    **Success Criteria**:
    - All models have versions tracked
    - Embeddings store model version in metadata
    - Version mismatch warnings logged
    - Migration tool tested (convert 1000 embeddings)
    
    **Timeline**: Week 1 (5 days, full week)
    **Agent**: Dr. Wei Zhang (Model Deployment Architect)
    **Confidence**: 90% (straightforward metadata tracking)
    **Priority**: P0 CRITICAL - Prevents future embedding corruption""",
    
    agent=ai_ml_vision_agent_1,  # Dr. Wei Zhang
    
    expected_output="""Model versioning system with:
    - backend/ai/model_registry.py (registry: models, versions, hashes)
    - backend/ai/version_checker.py (compatibility checks)
    - backend/database/migrations/add_model_version_to_embeddings.sql (DB schema update)
    - scripts/migrate_embeddings.py (migration tool for version updates)
    - tests/unit/test_model_versioning.py (version tracking tests)
    - Documentation: Model versioning guide (why, how, migration process)""",
    
    output_file="backend/ai/model_versioning_implementation.md",
    tools=standard_tools + code_tools,
    async_execution=False,
)
# Task T2-002: Add Type Hints to AI/ML Services (Week 2) - CRITICAL
task_t2_002_type_hints = Task(
    description="""Add comprehensive type hints to AI/ML services for 95%+ coverage.
    
    **Scope** (Parallel with Team 3's backend type hints):
    - backend/services/inference/onnx_clip.py (~400 lines)
    - backend/services/inference/onnx_yolo.py (~350 lines)
    - backend/services/inference/ollama_llava.py (~300 lines)
    - backend/services/clip_embedding_service.py (~450 lines)
    - backend/services/face_storage_service.py (~400 lines)
    Total: ~1,900 lines of AI/ML code
    
    **Challenges** (AI/ML-specific):
    - NumPy arrays (use numpy.typing.NDArray[np.float32])
    - PIL Images (use PIL.Image.Image)
    - ONNX runtime types (use onnxruntime.InferenceSession)
    - Ollama responses (define TypedDict for JSON responses)
    - Union types for image inputs (str | Path | Image.Image)
    
    **Implementation**:
    ```python
    from numpy.typing import NDArray
    import numpy as np
    from PIL.Image import Image
    from typing import Union, List
    from pathlib import Path
    
    def extract_embeddings(
        image: Union[str, Path, Image],
        model_version: str = "clip_vit_b32:2.0.1"
    ) -> NDArray[np.float32]:
        '''Extract CLIP embeddings from image.'''
        ...
    ```
    
    **Success Criteria**:
    - mypy backend/services/inference/ --strict: 0 errors
    - Type coverage ≥95%
    - All NumPy/PIL types properly annotated
    - Cross-review with Team 3 (backend type hints)
    
    **Timeline**: Week 2 (parallel with Team 3)
    **Agent**: Alex Rivera (Optimization Specialist, type system expert)
    **Confidence**: 85% (NumPy/PIL typing is tricky)
    **Priority**: P0 CRITICAL - Prevents AI/ML bugs""",
    
    agent=ai_ml_vision_agent_5,  # Alex Rivera, optimization specialist
    
    expected_output="""Type hints for AI/ML services with:
    - backend/services/inference/*.py (all files typed)
    - backend/services/*_service.py (AI/ML services typed)
    - mypy.ini (updated for NumPy/PIL)
    - tests/type_checking/test_ai_types.py (verify type coverage)
    - Documentation: AI/ML type hints guide (NumPy arrays, PIL images)""",
    
    output_file="backend/services/inference/type_hints_implementation.md",
    tools=standard_tools + code_tools,
    context=[task_t2_001_model_versioning],  # After model versioning
    async_execution=False,
)

# Task T2-003: Cache Hardware Detection Results (Week 1, Days 3-5)
task_t2_003_hw_cache = Task(
    description="""Cache hardware detection to avoid repeated expensive checks.
    
    **Problem**:
    Current implementation runs hardware detection on every request:
    - CUDA availability check (100ms)
    - GPU memory check (50ms)
    - CPU count (10ms)
    Total: 160ms per request - wasteful!
    
    **Solution - Cache at Startup**:
    Detect once at application startup, cache results.
    
    **Implementation**:
    ```python
    # backend/ai/hardware.py
    from functools import lru_cache
    from enum import Enum
    
    class HardwareTier(Enum):
        MINIMAL = "minimal"     # CPU only, <8GB RAM
        STANDARD = "standard"   # CPU, 8-16GB RAM
        ENHANCED = "enhanced"   # GPU <8GB VRAM
        OPTIMAL = "optimal"     # GPU 8GB+ VRAM
    
    @lru_cache(maxsize=1)  # Cache single result
    def detect_hardware_tier() -> HardwareTier:
        '''Detect once, cache forever (until restart).'''
        has_cuda = torch.cuda.is_available()
        if has_cuda:
            vram = torch.cuda.get_device_properties(0).total_memory / 1e9
            return HardwareTier.OPTIMAL if vram >= 8 else HardwareTier.ENHANCED
        
        ram = psutil.virtual_memory().total / 1e9
        return HardwareTier.STANDARD if ram >= 8 else HardwareTier.MINIMAL
    ```
    
    **Success Criteria**:
    - Hardware detected once at startup (logged)
    - Subsequent calls return cached result (<1ms)
    - Performance: 160ms → <1ms (99% improvement!)
    
    **Timeline**: Week 1, Days 3-5 (parallel with model versioning)
    **Agent**: Alex Rivera (Optimization Specialist)
    **Confidence**: 99% (simple caching)
    **Priority**: P1 HIGH - 99% performance improvement""",
    
    agent=ai_ml_vision_agent_5,  # Alex Rivera
    
    expected_output="""Hardware detection cache with:
    - backend/ai/hardware.py (cached detection, HardwareTier enum)
    - backend/api/main.py (detect at startup, log tier)
    - tests/unit/test_hardware_cache.py (verify caching works)
    - Performance benchmarks: Before (160ms) vs After (<1ms)""",
    
    output_file="backend/ai/hardware_cache_implementation.md",
    tools=standard_tools + code_tools,
    async_execution=True,  # Can parallel with T2-001
)

# Task T2-004: Integrate Stable Diffusion (Week 5-6)
task_t2_004_stable_diffusion = Task(
    description="""Integrate Stable Diffusion 1.5 for text-to-image generation.
    
    **Model**: Stable Diffusion 1.5 (RunwayML, open source)
    **Purpose**: Generate images from text descriptions in creative loop
    
    **Hardware-Adaptive Implementation**:
    - OPTIMAL tier (GPU 8GB+): Full SD 1.5 model (4.27GB)
    - ENHANCED tier (GPU <8GB): SD 1.5 with INT8 quantization (2.13GB)
    - STANDARD/MINIMAL: Cloud API fallback (Replicate or Together AI)
    
    **Requirements**:
    - Local inference <10s per image (OPTIMAL/ENHANCED)
    - Cloud fallback <30s per image (STANDARD/MINIMAL)
    - Prompt safety filter (block NSFW content)
    - Negative prompts (improve quality)
    - Configurable: steps (20-50), guidance (7-12), seed (reproducibility)
    
    **Implementation**:
    ```python
    # backend/services/inference/stable_diffusion.py
    from diffusers import StableDiffusionPipeline
    import torch
    
    class StableDiffusionService:
        def __init__(self, hardware_tier: HardwareTier):
            if hardware_tier in [HardwareTier.OPTIMAL, HardwareTier.ENHANCED]:
                self.pipeline = StableDiffusionPipeline.from_pretrained(
                    "runwayml/stable-diffusion-v1-5",
                    torch_dtype=torch.float16 if hardware_tier == HardwareTier.OPTIMAL else torch.int8
                ).to("cuda")
            else:
                self.pipeline = None  # Use cloud API
        
        def generate(self, prompt: str, negative_prompt: str = None) -> Image:
            if self.pipeline:
                return self.pipeline(prompt, negative_prompt=negative_prompt).images[0]
            else:
                return self._generate_cloud(prompt)  # Fallback
    ```
    
    **Success Criteria**:
    - Local generation <10s (GPU)
    - Cloud fallback works (CPU-only systems)
    - Safety filter blocks NSFW (tested)
    - Integration with creative loop (Week 7-9)
    
    **Timeline**: Week 5-6 (2 weeks)
    **Agent**: Dr. Wei Zhang (Model Deployment)
    **Confidence**: 85% (SD integration is well-documented, but hardware-adaptive logic is complex)
    **Priority**: P0 CRITICAL - Needed for creative loop""",
    
    agent=ai_ml_vision_agent_1,  # Dr. Wei Zhang
    
    expected_output="""Stable Diffusion integration with:
    - backend/services/inference/stable_diffusion.py (SD service)
    - backend/services/inference/sd_cloud_fallback.py (Replicate/Together AI)
    - backend/ai/safety_filter.py (NSFW detection)
    - models/stable_diffusion/ (model files or download script)
    - tests/integration/test_sd_generation.py (test image generation)
    - Documentation: SD usage guide (prompts, parameters, safety)""",
    
    output_file="backend/services/inference/sd_implementation.md",
    tools=standard_tools + code_tools,
    context=[task_t2_003_hw_cache],  # After HW detection
    async_execution=False,
)

# Task T2-005: Implement Creative Loop Engine (Week 7-9) - CORE DIFFERENTIATOR
task_t2_005_creative_loop = Task(
    description="""Implement creative loop engine: image→text→image remixing. CORE MVP FEATURE.
    
    **The Creative Loop** (90 seconds, 3 iterations):
    1. **Image → Text** (LLaVA): Describe user's photo (30s)
    2. **Text → Image** (SD): Generate new image from description (30s)
    3. **Repeat 2-3 times**: Each iteration creates more abstract remix
    
    **Example Loop**:
    - User uploads: Photo of grandma in garden
    - Iteration 1: LLaVA → "elderly woman in flower garden, roses, sunny day"
    - Iteration 1: SD → Generated image of woman in rose garden
    - Iteration 2: LLaVA → "serene garden scene, blooming flowers, peaceful"
    - Iteration 2: SD → More abstract garden with flowers
    - Iteration 3: LLaVA → "impressionist garden painting, colorful flowers"
    - Iteration 3: SD → Abstract artistic garden scene
    
    **Requirements**:
    - 3 iterations (configurable 1-5)
    - Total time ~90s (30s per iteration)
    - Save all intermediate results (6 outputs: 3 descriptions + 3 images)
    - User control: iteration count, randomness, style guidance
    - Progress tracking (emit events for WebSocket, Week 9)
    
    **Implementation**:
    ```python
    # backend/services/creative_loop_engine.py
    from typing import List, Tuple
    from PIL.Image import Image
    
    class CreativeLoopEngine:
        def __init__(self, llava_service, sd_service):
            self.llava = llava_service
            self.sd = sd_service
        
        def run_loop(
            self, 
            initial_image: Image, 
            iterations: int = 3,
            style: str = "artistic"
        ) -> List[Tuple[str, Image]]:
            '''Run creative loop: image→text→image repeatedly.'''
            results = []
            current_image = initial_image
            
            for i in range(iterations):
                # Image → Text (LLaVA)
                description = self.llava.describe(current_image, style=style)
                
                # Text → Image (Stable Diffusion)
                new_image = self.sd.generate(description)
                
                results.append((description, new_image))
                current_image = new_image  # Feed output back as input
            
            return results
    ```
    
    **Success Criteria**:
    - 3 iterations complete in ~90s
    - All intermediate results saved
    - Results visually interesting (user testing, Week 12)
    - Integration with FastAPI (POST /api/v1/creative/loop)
    
    **Timeline**: Week 7-9 (3 weeks, CORE FEATURE)
    **Agent**: Dr. Wei Zhang + Prompt Engineer (pair programming)
    **Confidence**: 75% (creative AI is unpredictable, needs tuning)
    **Priority**: P0 CRITICAL - THE core differentiator""",
    
    agent=ai_ml_vision_agent_1,  # Dr. Wei Zhang leads
    
    expected_output="""Creative loop engine with:
    - backend/services/creative_loop_engine.py (loop logic, ~300 lines)
    - backend/api/routes/creative.py (API endpoints)
    - backend/database/models/creative_loop.py (save results)
    - prompts/creative_loop_templates.yaml (style prompts)
    - tests/integration/test_creative_loop.py (end-to-end test)
    - Documentation: Creative loop guide (how it works, parameters)""",
    
    output_file="backend/services/creative_loop_implementation.md",
    tools=standard_tools + code_tools,
    context=[task_t2_004_stable_diffusion],  # After SD integration
    async_execution=False,
)

# Task T2-006: Calibrate Model Confidence Scores (Week 10-11)
task_t2_006_calibration = Task(
    description="""Calibrate confidence scores for all AI models to improve reliability.
    
    **Problem** (From Team 2 AI/ML Review):
    Models return uncalibrated confidence scores:
    - CLIP reports 0.92 confidence but wrong 30% of time
    - YOLO reports 0.85 confidence but wrong 40% of time
    - Need calibration: reported confidence = actual accuracy
    
    **Solution - Platt Scaling**:
    Collect validation set (1000 labeled examples), fit calibration curves.
    
    **Implementation**:
    ```python
    # backend/ai/calibration.py
    from sklearn.calibration import CalibratedClassifierCV
    import numpy as np
    
    class ConfidenceCalibrator:
        def __init__(self, validation_data):
            self.calibrators = {}
            # Train calibration for each model
            for model_name, (predictions, ground_truth) in validation_data.items():
                calibrator = CalibratedClassifierCV(method='sigmoid')
                calibrator.fit(predictions, ground_truth)
                self.calibrators[model_name] = calibrator
        
        def calibrate(self, model_name: str, raw_confidence: float) -> float:
            '''Convert raw confidence to calibrated confidence.'''
            return self.calibrators[model_name].predict_proba([[raw_confidence]])[0][1]
    ```
    
    **Success Criteria**:
    - Calibrated CLIP: reported 0.90 → actual 0.88-0.92 (within 2%)
    - Calibrated YOLO: reported 0.80 → actual 0.78-0.82
    - Validation set: 1000 labeled examples
    - Calibration curves plotted (reliability diagrams)
    
    **Timeline**: Week 10-11 (2 weeks)
    **Agent**: Prompt Engineering Specialist (understands model behavior)
    **Confidence**: 80% (needs labeled data, which takes time)
    **Priority**: P1 HIGH - Improves reliability""",
    
    agent=ai_ml_vision_agent_4,  # Prompt engineer understands models
    
    expected_output="""Confidence calibration with:
    - backend/ai/calibration.py (Platt scaling calibrators)
    - backend/ai/validation_data/ (1000 labeled examples)
    - scripts/train_calibrators.py (fit calibration curves)
    - tests/unit/test_calibration.py (verify calibration)
    - Documentation: Calibration report (reliability diagrams, accuracy)""",
    
    output_file="backend/ai/calibration_implementation.md",
    tools=standard_tools + code_tools,
    async_execution=False,
)

# Task T2-007: Integrate Face Recognition API (Week 4) - NEW (Gap Fix)
task_t2_007_face_integration = Task(
    description="""Integrate face recognition API for person-based photo search.
    
    **Gap Identified** (Pass 2 analysis):
    Face recognition mentioned in docs but not in implementation roadmap.
    Users need "Find all photos of grandma" search.
    
    **Solution - Simple InsightFace Integration**:
    Use InsightFace (open source) for face detection + recognition.
    
    **Requirements**:
    - Face detection (find faces in photos)
    - Face embedding extraction (512-dim vectors)
    - Face clustering (group same person)
    - Face search (find photos of person X)
    - Privacy: embeddings encrypted at rest
    
    **Implementation**:
    ```python
    # backend/services/inference/insightface_service.py
    from insightface.app import FaceAnalysis
    
    class FaceRecognitionService:
        def __init__(self):
            self.app = FaceAnalysis(name='buffalo_l')
            self.app.prepare(ctx_id=0 if torch.cuda.is_available() else -1)
        
        def detect_faces(self, image: Image) -> List[Face]:
            '''Detect faces, return bounding boxes + embeddings.'''
            faces = self.app.get(np.array(image))
            return [Face(bbox=f.bbox, embedding=f.normed_embedding) for f in faces]
    ```
    
    **Success Criteria**:
    - Detect faces in photos (>95% accuracy for clear faces)
    - Extract embeddings (512-dim)
    - Store in Qdrant (separate collection: face_embeddings)
    - API endpoint: POST /api/v1/search/by_face
    
    **Timeline**: Week 4 (5 days)
    **Agent**: Face Recognition Specialist (repurposed from old plan)
    **Confidence**: 90% (InsightFace is well-documented)
    **Priority**: P1 HIGH - Important for MVP""",
    
    agent=ai_ml_vision_agent_2,  # Face recognition specialist
    
    expected_output="""Face recognition integration with:
    - backend/services/inference/insightface_service.py (face detection + embeddings)
    - backend/api/routes/search.py (POST /api/v1/search/by_face endpoint)
    - backend/database/qdrant_collections.py (face_embeddings collection)
    - tests/integration/test_face_search.py (end-to-end face search)
    - Documentation: Face recognition guide (privacy, usage)""",
    
    output_file="backend/services/inference/face_implementation.md",
    tools=standard_tools + code_tools,
    async_execution=False,
)

# ============================================================================
# Crew Configuration - Updated for MVP
# ============================================================================

ai_ml_vision_crew = Crew(
    agents=[
        ai_ml_vision_agent_1,  # Dr. Wei Zhang (Model deployment → versioning, SD, creative loop)
        ai_ml_vision_agent_2,  # Face recognition specialist (→ face integration)
        ai_ml_vision_agent_3,  # Object detection specialist (→ repurposed if needed)
        ai_ml_vision_agent_4,  # Prompt engineer (→ confidence calibration)
        ai_ml_vision_agent_5,  # Alex Rivera (Optimization → type hints, HW cache)
    ],
    tasks=[
        task_t2_001_model_versioning,  # Week 1: Model versioning
        task_t2_002_type_hints,        # Week 2: Type hints
        task_t2_003_hw_cache,          # Week 1: HW cache
        task_t2_004_stable_diffusion,  # Week 5-6: SD integration
        task_t2_005_creative_loop,     # Week 7-9: Creative loop (CORE)
        task_t2_006_calibration,       # Week 10-11: Confidence calibration
        task_t2_007_face_integration,  # Week 4: Face recognition
    ],
    process=Process.hierarchical,
    manager_llm=specialist_llm,
    verbose=VERBOSE,
    memory=True,
    embedder=nomic_embedder_config,
    max_rpm=60,
    max_execution_time=7200,
)

# Export for easy import
__all__ = ['ai_ml_vision_crew']
