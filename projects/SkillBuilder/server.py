import os
from flask import Flask, request, jsonify
from skill_builder.pipeline.models import FrontendSpec
from skill_builder.pipeline.runner import run_pipeline

app = Flask(__name__)

@app.route('/skills', methods=['POST'])
def get_skills():
    data = request.get_json()
    occupation = data.get('occupation')
    deepening_cycles = data.get('deepening_cycles', 0)
    api_keys = data.get('apiKeys', {})

    if not occupation:
        return jsonify({'error': 'Missing occupation'}), 400

    # Set API keys as environment variables
    for key, value in api_keys.items():
        os.environ[key] = value

    spec = FrontendSpec(
        mode_name=occupation.replace(' ', '-'),
        purpose=f'Skills for {occupation}',
        deepening_cycles=deepening_cycles
    )
    result = run_pipeline(spec)
    
    # Combine skills and their embeddings into a single response object
    response_skills = []
    for skill, embedding in zip(result.skills, result.embeddings):
        response_skills.append({
            "skill": skill.to_yaml_block(),
            "embedding": embedding
        })
        
    return jsonify({'skills': response_skills})

if __name__ == '__main__':
    print('--- SkillBuilder Server Starting ---')
    app.run(port=5001, debug=True)
