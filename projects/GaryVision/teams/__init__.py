"""
CrewAI Teams Package
All team crew definitions.
"""

__all__ = [
    'team_1_elder_ux',
    'team_2_ai_ml_vision',
    'team_3_backend_services',
    'team_4_frontend_elder',
    'team_5_family_features',
    'team_6_memory_verification',
    'team_7_infrastructure',
    'team_8_quality_testing',
    'team_9_coordination',
]

# Import all teams for easy access
try:
    from .team_1_elder_ux import elder_ux_crew
    from .team_2_ai_ml_vision import ai_ml_vision_crew
    from .team_3_backend_services import backend_services_crew
    from .team_4_frontend_elder import frontend_elder_crew
    from .team_5_family_features import family_features_crew
    from .team_6_memory_verification import memory_verification_crew
    from .team_7_infrastructure import infrastructure_crew
    from .team_8_quality_testing import quality_testing_crew
    from .team_9_coordination import coordination_crew
except ImportError as e:
    # Teams may not all be fully implemented yet
    # This is expected for skeleton implementations
    pass
