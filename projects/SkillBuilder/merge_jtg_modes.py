import os
import math
import glob
import yaml
from collections import defaultdict
from typing import Dict, List, Any


# Heuristic: split basename on dashes/underscores, keep first 1-2 tokens as key
def derive_key(filename: str) -> str:
    base = os.path.basename(filename)
    name, _ = os.path.splitext(base)
    tokens = [t for t in name.replace("_", "-").split("-") if t]
    if not tokens:
        return name
    if len(tokens) == 1:
        return tokens[0]
    return "-".join(tokens[:2])


def load_yaml_files(src_dir: str) -> List[Dict[str, Any]]:
    files = sorted(glob.glob(os.path.join(src_dir, "*.yml")) + glob.glob(os.path.join(src_dir, "*.yaml")))
    data = []
    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            content = yaml.safe_load(f) or {}
        data.append({"path": path, "content": content})
    return data


def cluster_files(files: List[Dict[str, Any]], max_clusters: int = 75, max_cluster_size: int = 11) -> List[List[Dict[str, Any]]]:
    buckets: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for item in files:
        key = derive_key(item["path"])
        buckets[key].append(item)

    # Split oversized clusters to respect max_cluster_size
    clusters: List[List[Dict[str, Any]]] = []
    for bucket_files in buckets.values():
        for i in range(0, len(bucket_files), max_cluster_size):
            clusters.append(bucket_files[i : i + max_cluster_size])

    # Cap clusters to max_clusters (drop overflow if any)
    return clusters[:max_clusters]


def merge_cluster(cluster: List[Dict[str, Any]]) -> Dict[str, Any]:
    merged: Dict[str, Any] = {
        "slug": None,
        "name": None,
        "description": "",
        "roleDefinition": "",
        "whenToUse": "",
        "customInstructions": "",
        "groups": set(),
        "autoGovernance": False,
        "executionPolicy": False,
        "sourceFiles": [],
    }

    # Pick representative slug/name from first file that has them
    for item in cluster:
        content = item["content"] or {}
        # Handle customModes wrapper structure
        mode_data = content
        if "customModes" in content and isinstance(content["customModes"], list) and len(content["customModes"]) > 0:
            mode_data = content["customModes"][0]
        
        if merged["slug"] is None and mode_data.get("slug"):
            merged["slug"] = mode_data.get("slug")
        if merged["name"] is None and mode_data.get("name"):
            merged["name"] = mode_data.get("name")
        merged["sourceFiles"].append(os.path.basename(item["path"]))

    # Concatenate textual fields
    def append_field(field: str, value: Any):
        if not value:
            return
        text = value if isinstance(value, str) else str(value)
        if merged[field]:
            merged[field] += "\n\n" + text
        else:
            merged[field] = text

    for item in cluster:
        content = item["content"] or {}
        # Handle customModes wrapper structure
        mode_data = content
        if "customModes" in content and isinstance(content["customModes"], list) and len(content["customModes"]) > 0:
            mode_data = content["customModes"][0]
            
        append_field("description", mode_data.get("description"))
        append_field("roleDefinition", mode_data.get("roleDefinition"))
        append_field("whenToUse", mode_data.get("whenToUse"))
        append_field("customInstructions", mode_data.get("customInstructions"))

        groups = mode_data.get("groups")
        if isinstance(groups, list):
            merged["groups"].update(groups)

        if mode_data.get("autoGovernance"):
            merged["autoGovernance"] = True
        if mode_data.get("executionPolicy"):
            merged["executionPolicy"] = True

    # Convert groups to sorted list for determinism
    merged["groups"] = sorted(merged["groups"])

    # Fallback slug/name if missing
    if merged["slug"] is None:
        merged["slug"] = "merged-cluster"
    if merged["name"] is None:
        merged["name"] = merged["slug"].replace("-", " ").title()

    return merged


def write_clusters(clusters: List[List[Dict[str, Any]]], dest_dir: str):
    os.makedirs(dest_dir, exist_ok=True)
    for idx, cluster in enumerate(clusters, start=1):
        merged = merge_cluster(cluster)
        # Use the slug for filename, fallback to merged-{idx} if no slug
        filename = merged.get("slug", f"merged-{idx}")
        out_path = os.path.join(dest_dir, f"{filename}.yaml")
        with open(out_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(merged, f, sort_keys=False, allow_unicode=True)


def main():
    src_dir = os.path.join("ExistingModes", "JTG")
    dest_dir = os.path.join("ExistingModes", "MergedJTG")

    files = load_yaml_files(src_dir)
    clusters = cluster_files(files)
    write_clusters(clusters, dest_dir)

    print(f"Loaded {len(files)} files")
    print(f"Wrote {len(clusters)} merged clusters to {dest_dir}")


if __name__ == "__main__":
    main()
