#!/bin/bash
# Documentation Inventory Generator
# Extracts metadata from all markdown files for systematic classification

OUTPUT_FILE="docs/ARTIFACT_INVENTORY_2026-01-17.csv"

echo "Generating comprehensive documentation inventory..."

# CSV Header
echo "Path,Size_Bytes,Last_Modified,First_Line,Has_Date_2026,Has_Date_2025,Has_TODO,Has_Status,Has_Diagram,Word_Count" > "$OUTPUT_FILE"

# Find all markdown files (excluding tool directories)
find . -type f -name "*.md" \
  ! -path "*/node_modules/*" \
  ! -path "*/.venv/*" \
  ! -path "*/.git/*" \
  ! -path "*/htmlcov/*" \
  ! -path "*/.pytest_cache/*" \
  ! -path "*/.chrysalis/*" \
  ! -path "*/.cursor/*" \
  ! -path "*/.windsurf/*" \
  ! -path "*/.kilocode/*" \
  ! -path "*/.clinerules/*" \
  ! -path "*/.claude/*" \
  ! -path "*/.giga/*" \
  ! -path "*/.qodo/*" \
  ! -path "*/.lsp/*" \
  ! -path "*/.clj-kondo/*" \
  ! -path "*/.fireproof/*" \
  ! -path "*/.github/*" \
  -print0 | while IFS= read -r -d '' file; do
  
  # Extract metadata
  size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
  modified=$(stat -c%y "$file" 2>/dev/null | cut -d' ' -f1 || stat -f%Sm -t%F "$file" 2>/dev/null)
  first_line=$(head -n 1 "$file" | tr ',' ' ' | tr '\n' ' ' | cut -c1-80)
  has_2026=$(grep -c "2026" "$file" || echo "0")
  has_2025=$(grep -c "2025" "$file" || echo "0")
  has_todo=$(grep -ci "TODO\|FIXME\|XXX" "$file" || echo "0")
  has_status=$(grep -ci "status:\|✅\|⚠️\|❌\|🔄" "$file" || echo "0")
  has_diagram=$(grep -ci "```mermaid\|```diagram" "$file" || echo "0")
  word_count=$(wc -w < "$file" 2>/dev/null || echo "0")
  
  # Escape path and first line for CSV
  escaped_path=$(echo "$file" | sed 's/,/;/g')
  escaped_first=$(echo "$first_line" | sed 's/,/;/g')
  
  echo "$escaped_path,$size,$modified,$escaped_first,$has_2026,$has_2025,$has_todo,$has_status,$has_diagram,$word_count"
done >> "$OUTPUT_FILE"

echo "Inventory generated: $OUTPUT_FILE"
echo "Total files processed: $(wc -l < "$OUTPUT_FILE" | xargs echo)"
