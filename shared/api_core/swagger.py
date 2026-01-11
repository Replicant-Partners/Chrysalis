"""
Swagger/OpenAPI integration utilities for Chrysalis Flask services.

Provides helpers for setting up Swagger UI with flasgger.
"""

try:
    from flask import Flask
    from flasgger import Swagger
    FLASK_FLASGGER_AVAILABLE = True
except ImportError:
    FLASK_FLASGGER_AVAILABLE = False
    Flask = None
    Swagger = None


def create_swagger_config(
    title: str = "Chrysalis API",
    version: str = "1.0.0",
    description: str = "Chrysalis Unified API Standard",
    api_version: str = "v1"
) -> dict:
    """
    Create Swagger configuration for flasgger.

    Args:
        title: API title
        version: API version
        description: API description
        api_version: API version path

    Returns:
        Swagger configuration dictionary
    """
    return {
        "headers": [],
        "specs": [
            {
                "endpoint": "apispec",
                "route": "/api/{}/openapi.json".format(api_version),
                "rule_filter": lambda rule: True,
                "model_filter": lambda tag: True,
            }
        ],
        "static_url_path": "/flasgger_static",
        "swagger_ui": True,
        "specs_route": "/api/{}/docs".format(api_version),
        "info": {
            "title": title,
            "version": version,
            "description": description,
            "contact": {
                "name": "Chrysalis API Support",
                "url": "https://docs.chrysalis.dev",
            },
        },
        "securityDefinitions": {
            "bearerAuth": {
                "type": "apiKey",
                "name": "Authorization",
                "in": "header",
                "description": "JWT token or API key in Bearer format. Example: 'Bearer YOUR_TOKEN'"
            }
        },
        "security": [
            {
                "bearerAuth": []
            }
        ],
        "tags": [
            {
                "name": "Agents",
                "description": "Agent management endpoints"
            },
            {
                "name": "Knowledge",
                "description": "Knowledge management endpoints"
            },
            {
                "name": "Skills",
                "description": "Skill management endpoints"
            },
            {
                "name": "Health",
                "description": "Health check endpoints"
            }
        ],
        "schemes": ["http", "https"],
        "basePath": "/api/{}".format(api_version),
    }


def setup_swagger(app: Flask, config: dict = None) -> None:
    """
    Set up Swagger UI for Flask application.

    This function initializes flasgger with the Flask app and makes the Swagger UI
    available at the configured route (default: /api/v1/docs).

    Args:
        app: Flask application
        config: Optional Swagger configuration (defaults to create_swagger_config())

    Returns:
        None. The Swagger instance is attached to the Flask app and does not need
        to be returned. Access the Swagger UI at the configured docs route.
    """
    if not FLASK_FLASGGER_AVAILABLE:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning("flasgger not available - Swagger UI disabled. Install flasgger to enable API documentation.")
        return

    if config is None:
        config = create_swagger_config()

    Swagger(app, config=config)
