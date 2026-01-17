use chrysalis_core::SemanticAgent;

#[test]
fn test_valid_agent_passes() {
    let agent = SemanticAgent::default();
    let report = agent.validate();
    assert!(report.valid);
    assert_eq!(report.errors.len(), 0);
}

#[test]
fn test_schema_version_warning() {
    let mut agent = SemanticAgent::default();
    agent.schema_version = "1.0.0".to_string();

    let report = agent.validate();
    assert!(report.valid);
    // Has 2 warnings: schema version + no protocols
    assert!(report.warnings.iter().any(|w| w.contains("Schema version")));
}

#[test]
fn test_missing_identity_id() {
    let mut agent = SemanticAgent::default();
    agent.identity.id = String::new();

    let report = agent.validate();
    assert!(!report.valid);
    assert_eq!(report.errors.len(), 1);
    assert!(report.errors[0].contains("identity.id"));
}

#[test]
fn test_no_protocols_enabled_warning() {
    let agent = SemanticAgent::default();
    let report = agent.validate();

    // Default agent has no protocols enabled
    assert_eq!(report.warnings.len(), 1);
    assert!(report.warnings[0].contains("No protocols enabled"));
}
