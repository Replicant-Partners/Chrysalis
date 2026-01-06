// Skip optional backend tests when deps are missing
// Note: Qdrant removed - using LanceDB/ArangoDB instead
const optionalDeps = [
  { name: 'hnswlib-node', flag: 'HAS_HNSW' },
  { name: 'lancedb', flag: 'HAS_LANCE' }
];

optionalDeps.forEach(dep => {
  try {
    require.resolve(dep.name);
    global[dep.flag] = true;
  } catch {
    global[dep.flag] = false;
  }
});
