//! Prints the per-layer parameter breakdown for every AELIO Native preset.
//! `cargo run -p aelio-model --bin param-report` (markdown) or `-- --json`.

use aelio_model::PRESETS;

fn m(x: u64) -> String {
    format!("{:.2}M", x as f64 / 1e6)
}

fn main() {
    let json = std::env::args().any(|a| a == "--json");
    if json {
        let rows: Vec<String> = PRESETS
            .iter()
            .map(|c| {
                let b = c.breakdown();
                format!(
                    "{{\"name\":\"{}\",\"n_layers\":{},\"d_model\":{},\"n_heads\":{},\"n_kv_heads\":{},\"vocab_size\":{},\"context\":{},\"ffn_hidden\":{},\"embedding\":{},\"attention\":{},\"ffn\":{},\"norms\":{},\"per_layer\":{},\"non_embedding\":{},\"total\":{},\"train_flops_per_token\":{},\"train_state_bytes\":{}}}",
                    c.name, c.n_layers, c.d_model, c.n_heads, c.n_kv_heads, c.vocab_size, c.context,
                    c.ffn_hidden(), b.embedding, b.attention(), b.ffn(), b.norms, c.params_per_layer(),
                    b.non_embedding(), b.total(), c.train_flops_per_token(), c.train_state_bytes()
                )
            })
            .collect();
        println!("[{}]", rows.join(","));
        return;
    }
    println!("| Model | Shape | Per layer (attn + FFN + norms) | Embedding (tied) | Non-embedding | Total |");
    println!("|---|---|---|---|---|---|");
    for c in PRESETS {
        let b = c.breakdown();
        let l = c.n_layers as u64;
        println!(
            "| {} | {}L, d{}, {}q/{}kv heads, FFN {}, vocab {} | {} + {} + {} = {} | {} | {} | {} ({}) |",
            c.name, c.n_layers, c.d_model, c.n_heads, c.n_kv_heads, c.ffn_hidden(), c.vocab_size,
            m(b.attention() / l), m(b.ffn() / l), (b.norms - c.d_model as u64) / l, m(c.params_per_layer()),
            m(b.embedding), m(b.non_embedding()), m(b.total()), b.total()
        );
    }
}
