from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

SKILL_BUILDER_URL = "http://localhost:5001"
KNOWLEDGE_BUILDER_URL = "http://localhost:5002"

@app.route('/build', methods=['POST'])
def build_agent():
    data = request.get_json()
    role_model = data.get('roleModel')
    agent_id = data.get('agentId')
    deepening_cycles = data.get('deepeningCycles', 0)
    api_keys = data.get('apiKeys', {})

    if not role_model or not agent_id:
        return jsonify({'error': 'Missing roleModel or agentId'}), 400

    model_name = role_model.get('name')
    occupation = role_model.get('occupation')

    if not model_name or not occupation:
        return jsonify({'error': 'roleModel must include name and occupation'}), 400

    try:
        # Step 1: Build Skills
        skill_payload = {
            'occupation': occupation, 
            'deepening_cycles': deepening_cycles,
            'apiKeys': api_keys
        }
        skill_response = requests.post(f"{SKILL_BUILDER_URL}/skills", json=skill_payload)
        skill_response.raise_for_status()
        skills = skill_response.json().get('skills', [])

        # Step 2: Build Knowledge
        knowledge_payload = {
            'identifier': model_name, 
            'entity_type': 'Person',
            'deepening_cycles': deepening_cycles,
            'apiKeys': api_keys
        }
        knowledge_response = requests.post(f"{KNOWLEDGE_BUILDER_URL}/knowledge", json=knowledge_payload)
        knowledge_response.raise_for_status()
        knowledge_items = knowledge_response.json().get('knowledge_items', [])

        # In a real implementation, we would now pass this to the UnifiedMemoryClient
        # For now, we just return the collected data
        return jsonify({
            'agentId': agent_id,
            'roleModel': role_model,
            'generated_skills': skills,
            'generated_knowledge': knowledge_items
        })

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Failed to connect to a builder service: {e}'}), 500

if __name__ == '__main__':
    print('--- AgentBuilder Server Starting ---')
    app.run(port=5000, debug=True)
