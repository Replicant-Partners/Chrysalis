//! Core FFI bindings for SemanticAgent

use napi_derive::napi;
use chrysalis_core::SemanticAgent;

#[napi(object)]
pub struct JsValidationReport {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Parse agent JSON and return parsed JSON string
#[napi]
pub fn parse_agent_json(json: String) -> napi::Result<String> {
    let agent = SemanticAgent::from_json(&json)
        .map_err(|e| napi::Error::from_reason(format!("Parse error: {}", e)))?;

    agent.to_json()
        .map_err(|e| napi::Error::from_reason(format!("Serialize error: {}", e)))
}

/// Validate agent JSON
#[napi]
pub fn validate_agent_json(json: String) -> napi::Result<JsValidationReport> {
    let agent = SemanticAgent::from_json(&json)
        .map_err(|e| napi::Error::from_reason(format!("Parse error: {}", e)))?;

    let report = agent.validate();

    Ok(JsValidationReport {
        valid: report.valid,
        errors: report.errors,
        warnings: report.warnings,
    })
}

/// Create new agent
#[napi]
pub fn create_agent(id: String, name: String, designation: String) -> napi::Result<String> {
    let agent = SemanticAgent::new(id, name, designation);
    agent.to_json()
        .map_err(|e| napi::Error::from_reason(format!("Serialize error: {}", e)))
}

/// Serialize agent to pretty JSON
#[napi]
pub fn format_agent_json(json: String) -> napi::Result<String> {
    let agent = SemanticAgent::from_json(&json)
        .map_err(|e| napi::Error::from_reason(format!("Parse error: {}", e)))?;

    agent.to_json_pretty()
        .map_err(|e| napi::Error::from_reason(format!("Serialize error: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_agent() {
        let json = r#"{"schema_version":"2.0.0","identity":{"id":"test","name":"Test","designation":"Test","bio":"Bio","fingerprint":"","created":"2026-01-01T00:00:00Z","version":"1.0.0"},"personality":{"core_traits":[],"values":[],"quirks":[]},"communication":{"style":{"all":[]}},"capabilities":{"primary":[],"secondary":[],"domains":[]},"knowledge":{"facts":[],"topics":[],"expertise":[]},"memory":{"type":"hybrid","provider":"default","settings":{}},"beliefs":{"who":[],"what":[],"why":[],"how":[]},"instances":{"active":[],"terminated":[]},"experience_sync":{"enabled":false,"default_protocol":"streaming","merge_strategy":{"conflict_resolution":"latest_wins","memory_deduplication":true,"skill_aggregation":"max","knowledge_verification_threshold":0.7}},"protocols":{},"execution":{"llm":{"provider":"anthropic","model":"claude-sonnet-4.5","temperature":0.7,"max_tokens":4096},"runtime":{"timeout":300000,"max_iterations":25,"error_handling":"graceful"}},"metadata":{"version":"1.0.0","schema_version":"2.0.0","created":"2026-01-01T00:00:00Z","updated":"2026-01-01T00:00:00Z"}}"#;

        let result = parse_agent_json(json.to_string());
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_agent() {
        let result = create_agent(
            "test-id".to_string(),
            "Test Agent".to_string(),
            "Testing".to_string(),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_agent() {
        let agent = SemanticAgent::default();
        let json = agent.to_json().unwrap();

        let result = validate_agent_json(json);
        assert!(result.is_ok());

        let report = result.unwrap();
        assert!(report.valid);
    }
}
