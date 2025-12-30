"""
ElizaOS Integration Bridge.

Enables ElizaOS characters to operate as Ludwig thinking partners,
optionally adopting evaluator modes (Tetlock, Shannon, Kata, Calibration).

Architecture:
- Character (ElizaOS personality/domain) × Mode (evaluator framework) = Hybrid
- Example: Philosophy character in Shannon mode = analyzes concept entropy
- Example: Research character in Tetlock mode = tracks belief updates
"""

import json
from pathlib import Path
from typing import Any, Optional

from ludwig.partners.base import (
    BaseThinkingPartner,
    InteractionStyle,
    PartnerCapability,
    PartnerConversation,
    PartnerType,
)


class ElizaOSCharacter:
    """
    Represents an ElizaOS character configuration.

    Loads character definitions from ElizaOS format (JSON).
    """

    def __init__(self, character_file: Path):
        """
        Load ElizaOS character from file.

        Args:
            character_file: Path to character JSON file
        """
        self.character_file = character_file
        with open(character_file, "r") as f:
            self.config = json.load(f)

        self.name = self.config.get("name", "Unknown")
        self.bio = self.config.get("bio", [])
        self.lore = self.config.get("lore", [])
        self.knowledge = self.config.get("knowledge", [])
        self.message_examples = self.config.get("messageExamples", [])
        self.post_examples = self.config.get("postExamples", [])
        self.topics = self.config.get("topics", [])
        self.style = self.config.get("style", {})
        self.adjectives = self.config.get("adjectives", [])

    def get_system_prompt(self) -> str:
        """
        Generate system prompt from character config.

        Returns:
            System prompt for LLM
        """
        prompt_parts = []

        # Name and bio
        prompt_parts.append(f"You are {self.name}.")
        if self.bio:
            prompt_parts.append("\n".join(self.bio))

        # Knowledge and expertise
        if self.knowledge:
            prompt_parts.append("\nYour knowledge areas:")
            prompt_parts.extend([f"- {k}" for k in self.knowledge])

        # Personality and style
        if self.adjectives:
            prompt_parts.append(f"\nYour personality: {', '.join(self.adjectives)}")

        if self.style:
            all_style = self.style.get("all", [])
            if all_style:
                prompt_parts.append("\nCommunication style:")
                prompt_parts.extend([f"- {s}" for s in all_style])

        # Topics of interest
        if self.topics:
            prompt_parts.append(f"\nTopics you discuss: {', '.join(self.topics)}")

        # Lore and background
        if self.lore:
            prompt_parts.append("\nBackground:")
            prompt_parts.extend([f"- {l}" for l in self.lore])

        return "\n".join(prompt_parts)

    def to_capabilities(self) -> list[PartnerCapability]:
        """
        Convert character knowledge/topics to partner capabilities.

        Returns:
            List of capabilities
        """
        capabilities = []

        # Knowledge areas as capabilities
        for k in self.knowledge:
            capabilities.append(
                PartnerCapability(
                    name=k.lower().replace(" ", "_"),
                    description=f"Expertise in {k}",
                    enabled=True,
                )
            )

        # Topics as capabilities
        for topic in self.topics:
            cap_name = topic.lower().replace(" ", "_")
            if not any(c.name == cap_name for c in capabilities):
                capabilities.append(
                    PartnerCapability(
                        name=cap_name,
                        description=f"Can discuss {topic}",
                        enabled=True,
                    )
                )

        return capabilities


class EvaluatorMode:
    """
    Evaluator mode that can be adopted by a thinking partner.

    Modes: Tetlock, Shannon, Kata, Calibration, None
    """

    def __init__(
        self,
        name: str,
        description: str,
        analytical_lens: str,
        system_prompt_addition: str,
    ):
        """
        Initialize evaluator mode.

        Args:
            name: Mode name (tetlock, shannon, kata, calibration)
            description: What this mode analyzes
            analytical_lens: Perspective to adopt
            system_prompt_addition: Additional instructions for LLM
        """
        self.name = name
        self.description = description
        self.analytical_lens = analytical_lens
        self.system_prompt_addition = system_prompt_addition


# Predefined evaluator modes
EVALUATOR_MODES = {
    "tetlock": EvaluatorMode(
        name="tetlock",
        description="Superforecasting and belief updating analysis",
        analytical_lens="probabilistic judgment, evidence integration, fox-hedgehog thinking",
        system_prompt_addition="""
In Tetlock mode, you analyze:
- How beliefs evolve over time
- Evidence integration patterns
- Probabilistic vs deterministic language
- Fox (multi-perspective) vs Hedgehog (single-framework) thinking
- Prediction tracking and accuracy

Ask questions like:
- "What would change your belief about this?"
- "On a scale of 0-100%, how confident are you?"
- "What evidence supports/contradicts this?"
""",
    ),
    "shannon": EvaluatorMode(
        name="shannon",
        description="Information theory and entropy analysis",
        analytical_lens="information density, redundancy, compression, signal-to-noise",
        system_prompt_addition="""
In Shannon mode, you analyze:
- Information density (unique relations per concept)
- Redundancy patterns (duplicate information)
- Entropy (diversity of relationship types)
- Compression opportunities (abstraction potential)
- Signal vs noise (meaningful vs trivial information)

Ask questions like:
- "Is this concept adding new information or repeating what's known?"
- "Could these concepts be compressed into a higher-level abstraction?"
- "What's the information density here?"
""",
    ),
    "kata": EvaluatorMode(
        name="kata",
        description="Incremental skill building and mastery progression",
        analytical_lens="skill gaps, depth, progression stages, deliberate practice",
        system_prompt_addition="""
In Kata mode, you analyze:
- Concept depth (number of relationships)
- Skill progression (foundation → integration → deepening → mastery)
- Practice opportunities (shallow concepts to develop)
- Mastery indicators (well-connected, deep concepts)

Ask questions like:
- "What concepts need more depth?"
- "Where are you in the learning progression?"
- "What would move you from integration to mastery?"
""",
    ),
    "calibration": EvaluatorMode(
        name="calibration",
        description="Epistemic confidence and evidence alignment",
        analytical_lens="confidence levels, evidence support, over/underconfidence",
        system_prompt_addition="""
In Calibration mode, you analyze:
- Evidence-to-confidence ratios
- Overconfidence (strong claims, weak evidence)
- Underconfidence (hedging on well-supported claims)
- Calibration health (alignment between confidence and accuracy)

Ask questions like:
- "How confident are you in this claim (0-100%)?"
- "What evidence supports this level of confidence?"
- "Could you be overconfident here?"
""",
    ),
}


class ElizaOSPartner(BaseThinkingPartner):
    """
    Thinking partner based on ElizaOS character.

    Can operate in:
    - Pure mode (character personality only)
    - Hybrid mode (character + evaluator analytical framework)

    Examples:
    - Philosophy character + Shannon mode = analyzes concept entropy
    - Research character + Tetlock mode = tracks belief updates
    - Science character + Calibration mode = assesses evidence-confidence
    """

    def __init__(
        self,
        character: ElizaOSCharacter,
        mode: Optional[str] = None,
        interaction_style: InteractionStyle = InteractionStyle.REACTIVE,
    ):
        """
        Initialize ElizaOS partner with optional evaluator mode.

        Args:
            character: ElizaOS character
            mode: Evaluator mode (tetlock, shannon, kata, calibration, or None)
            interaction_style: How partner interacts
        """
        self.character = character
        self.mode_name = mode
        self.evaluator_mode = EVALUATOR_MODES.get(mode) if mode else None

        # Determine partner type based on character and mode
        if self.evaluator_mode:
            partner_type = PartnerType.CONVERSATIONAL_AI  # Hybrid: character + analysis
        else:
            # Infer from character's knowledge areas
            if any("research" in k.lower() for k in character.knowledge):
                partner_type = PartnerType.RESEARCH_ASSISTANT
            elif any(
                word in " ".join(character.topics).lower()
                for word in ["philosophy", "science", "history"]
            ):
                partner_type = PartnerType.DOMAIN_EXPERT
            else:
                partner_type = PartnerType.CONVERSATIONAL_AI

        # Build description
        desc_parts = [character.name]
        if self.evaluator_mode:
            desc_parts.append(f"operating in {self.evaluator_mode.name} mode")
        desc_parts.append("-")
        if character.bio:
            desc_parts.append(character.bio[0])

        super().__init__(
            name=f"{character.name}{'_' + mode if mode else ''}",
            partner_type=partner_type,
            description=" ".join(desc_parts),
            capabilities=character.to_capabilities(),
            interaction_style=interaction_style,
        )

    def get_system_prompt(self) -> str:
        """
        Generate system prompt combining character and mode.

        Returns:
            Complete system prompt
        """
        parts = [self.character.get_system_prompt()]

        if self.evaluator_mode:
            parts.append("\n" + "=" * 50)
            parts.append(f"\n**EVALUATOR MODE: {self.evaluator_mode.name.upper()}**")
            parts.append(self.evaluator_mode.system_prompt_addition)
            parts.append("\nYou combine your character's personality and expertise")
            parts.append(f"with {self.evaluator_mode.name}'s analytical framework.")

        return "\n".join(parts)

    def respond(
        self,
        user_message: str,
        conversation: Optional[PartnerConversation] = None,
        context: dict[str, Any] = None,
    ) -> str:
        """
        Respond as ElizaOS character, optionally with evaluator mode.

        Args:
            user_message: User's message
            conversation: Conversation context
            context: Additional context

        Returns:
            Character's response
        """
        # TODO: Integrate with LLM using get_system_prompt()
        # For now, return a placeholder showing mode
        if self.evaluator_mode:
            return (
                f"[{self.character.name} in {self.evaluator_mode.name} mode]\n"
                f"Analyzing through lens of: {self.evaluator_mode.analytical_lens}\n\n"
                f"User: {user_message}\n\n"
                f"[LLM integration would generate response here using character personality + mode]"
            )
        else:
            return (
                f"[{self.character.name}]\n"
                f"User: {user_message}\n\n"
                f"[LLM integration would generate response here using character personality]"
            )


def load_eliza_character(character_path: Path) -> ElizaOSCharacter:
    """
    Load ElizaOS character from file.

    Args:
        character_path: Path to character JSON

    Returns:
        Loaded character
    """
    return ElizaOSCharacter(character_path)


def create_hybrid_partner(
    character_path: Path,
    mode: Optional[str] = None,
) -> ElizaOSPartner:
    """
    Create hybrid partner from ElizaOS character and optional mode.

    Args:
        character_path: Path to character JSON
        mode: Evaluator mode (tetlock, shannon, kata, calibration)

    Returns:
        Hybrid thinking partner
    """
    character = load_eliza_character(character_path)
    return ElizaOSPartner(character, mode=mode)
