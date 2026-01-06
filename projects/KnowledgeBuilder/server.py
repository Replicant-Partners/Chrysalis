import os
from flask import Flask, request, jsonify
from src.pipeline.simple_pipeline import run_knowledge_pipeline

app = Flask(__name__)

@app.route('/knowledge', methods=['POST'])
def get_knowledge():
    data = request.get_json()
    identifier = data.get('identifier')
    entity_type = data.get('entity_type')
    deepening_cycles = data.get('deepening_cycles', 0)
    api_keys = data.get('apiKeys', {})

    if not identifier:
        return jsonify({'error': 'Missing identifier'}), 400

    # Set API keys as environment variables
    for key, value in api_keys.items():
        os.environ[key] = value

    results = run_knowledge_pipeline(identifier, entity_type, deepening_cycles)
    
    return jsonify({'knowledge_items': results})

if __name__ == '__main__':
    print('--- KnowledgeBuilder Server Starting ---')
    app.run(port=5002, debug=True)
