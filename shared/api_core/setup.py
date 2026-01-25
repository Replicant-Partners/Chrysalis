"""
Setup script for Chrysalis API Core shared library.
"""


from setuptools import setup, find_packages
from pathlib import Path

# Read README if it exists
readme_file = Path(__file__).parent / "README.md"
long_description = readme_file.read_text() if readme_file.exists() else ""
setup(
    name="chrysalis-api-core",
    version="1.0.0",
    description="Unified API core library for Chrysalis services",
    long_description=long_description,
    long_description_content_type="text/markdown",
    author="Chrysalis Team",
    author_email="dev@chrysalis.dev",
    url="https://github.com/chrysalis/chrysalis",
    packages=find_packages(where="."),
    package_dir={"": "."},
    python_requires=">=3.8",
    install_requires=[
        "flask>=2.0.0",
        "flask-cors>=3.0.10",
    ],
    extras_require={
        "jwt": ["PyJWT>=2.0.0"],
        "pydantic": ["pydantic>=2.0.0"],  # Optional: for request validation schemas
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
            "pydantic>=2.0.0",  # Include in dev for testing
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
    ],
)
