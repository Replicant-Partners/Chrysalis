// Skip optional backend tests when deps are missing
const optionalDeps = [
  { name: 'hnswlib-node', flag: 'HAS_HNSW' },
  { name: 'lancedb', flag: 'HAS_LANCE' },
  { name: '@qdrant/js-client-rest', flag: 'HAS_QDRANT' }
];

optionalDeps.forEach(dep => {
  try {
    require.resolve(dep.name);
    global[dep.flag] = true;
  } catch {
    global[dep.flag] = false;
  }
});
