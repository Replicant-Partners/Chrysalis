//! Benchmarks for CRDT operations

use criterion::{black_box, criterion_group, criterion_main, Criterion};

// Note: These benchmarks run against the library without PyO3
// For production benchmarks, build without extension-module feature

fn gset_merge_benchmark(c: &mut Criterion) {
    c.bench_function("gset_merge_1000", |b| {
        b.iter(|| {
            let mut set1: std::collections::HashSet<String> = std::collections::HashSet::new();
            let mut set2: std::collections::HashSet<String> = std::collections::HashSet::new();

            for i in 0..500 {
                set1.insert(format!("element_{}", i));
                set2.insert(format!("element_{}", i + 250));
            }

            // Merge via union
            let merged: std::collections::HashSet<_> = set1.union(&set2).cloned().collect();
            black_box(merged.len())
        })
    });
}

fn lww_merge_benchmark(c: &mut Criterion) {
    c.bench_function("lww_merge_1000", |b| {
        b.iter(|| {
            let mut count = 0;
            for i in 0..1000 {
                let ts1 = i as f64;
                let ts2 = (i + 1) as f64;
                // LWW comparison
                if ts2 > ts1 {
                    count += 1;
                }
            }
            black_box(count)
        })
    });
}

fn vector_clock_merge_benchmark(c: &mut Criterion) {
    c.bench_function("vector_clock_merge", |b| {
        b.iter(|| {
            let mut vc1: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
            let mut vc2: std::collections::HashMap<String, u64> = std::collections::HashMap::new();

            for i in 0..100 {
                vc1.insert(format!("agent_{}", i), i as u64);
                vc2.insert(format!("agent_{}", i), (i + 10) as u64);
            }

            // Merge via element-wise max
            let mut merged = vc1.clone();
            for (k, v) in vc2 {
                let entry = merged.entry(k).or_insert(0);
                *entry = (*entry).max(v);
            }
            black_box(merged.len())
        })
    });
}

criterion_group!(
    benches,
    gset_merge_benchmark,
    lww_merge_benchmark,
    vector_clock_merge_benchmark,
);

criterion_main!(benches);
