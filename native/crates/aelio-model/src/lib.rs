//! AELIO Native model configurations and exact parameter accounting.
//!
//! Architecture (all versions): decoder-only transformer, pre-norm blocks,
//! RMSNorm (weight only, no bias), rotary position embeddings (no parameters),
//! grouped-query attention (n_kv_heads == n_heads means ordinary multi-head),
//! SwiGLU feed-forward, no bias terms anywhere, input embedding tied to the
//! output head.
//!
//! `param_shapes()` is the single list of weight tensors the model constructor
//! will allocate. Parameter counts are computed by summing those shapes, and
//! the tests check that sum against an independent closed-form formula and
//! against pinned numbers produced by `native/tools/param_count_check.py`.

use std::fmt;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ModelConfig {
    pub name: &'static str,
    pub n_layers: usize,
    pub d_model: usize,
    pub n_heads: usize,
    pub n_kv_heads: usize,
    pub vocab_size: usize,
    pub context: usize,
    /// SwiGLU hidden width = ceil(8/3 * d_model) rounded up to this multiple.
    pub ffn_multiple: usize,
    pub tied_embeddings: bool,
}

#[derive(Debug, PartialEq, Eq)]
pub enum ConfigError {
    HeadsDontDivideWidth { d_model: usize, n_heads: usize },
    KvHeadsDontDivideHeads { n_heads: usize, n_kv_heads: usize },
    OddHeadDim { head_dim: usize },
    Zero(&'static str),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{self:?}")
    }
}

/// Parameter totals grouped the way the proposal reports them.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Breakdown {
    pub embedding: u64,
    pub attn_q: u64,
    pub attn_k: u64,
    pub attn_v: u64,
    pub attn_o: u64,
    pub ffn_gate: u64,
    pub ffn_up: u64,
    pub ffn_down: u64,
    pub norms: u64,
    pub lm_head_untied: u64,
}

impl Breakdown {
    pub fn attention(&self) -> u64 {
        self.attn_q + self.attn_k + self.attn_v + self.attn_o
    }
    pub fn ffn(&self) -> u64 {
        self.ffn_gate + self.ffn_up + self.ffn_down
    }
    pub fn total(&self) -> u64 {
        self.embedding + self.attention() + self.ffn() + self.norms + self.lm_head_untied
    }
    /// Everything except the token embedding table (and an untied head).
    pub fn non_embedding(&self) -> u64 {
        self.attention() + self.ffn() + self.norms
    }
}

impl ModelConfig {
    pub fn head_dim(&self) -> usize {
        self.d_model / self.n_heads
    }

    pub fn ffn_hidden(&self) -> usize {
        let raw = (8 * self.d_model).div_ceil(3);
        raw.div_ceil(self.ffn_multiple) * self.ffn_multiple
    }

    pub fn validate(&self) -> Result<(), ConfigError> {
        for (v, n) in [
            (self.n_layers, "n_layers"),
            (self.d_model, "d_model"),
            (self.n_heads, "n_heads"),
            (self.n_kv_heads, "n_kv_heads"),
            (self.vocab_size, "vocab_size"),
            (self.context, "context"),
            (self.ffn_multiple, "ffn_multiple"),
        ] {
            if v == 0 {
                return Err(ConfigError::Zero(n));
            }
        }
        if self.d_model % self.n_heads != 0 {
            return Err(ConfigError::HeadsDontDivideWidth { d_model: self.d_model, n_heads: self.n_heads });
        }
        if self.n_heads % self.n_kv_heads != 0 {
            return Err(ConfigError::KvHeadsDontDivideHeads { n_heads: self.n_heads, n_kv_heads: self.n_kv_heads });
        }
        if self.head_dim() % 2 != 0 {
            return Err(ConfigError::OddHeadDim { head_dim: self.head_dim() });
        }
        Ok(())
    }

    /// Every weight tensor, in allocation order, with its shape [out, in].
    pub fn param_shapes(&self) -> Vec<(String, Vec<usize>)> {
        let d = self.d_model;
        let kv = self.n_kv_heads * self.head_dim();
        let h = self.ffn_hidden();
        let mut v = vec![("tok_embeddings.weight".to_string(), vec![self.vocab_size, d])];
        for i in 0..self.n_layers {
            let p = format!("layers.{i}");
            v.push((format!("{p}.attn_norm.weight"), vec![d]));
            v.push((format!("{p}.attn.wq"), vec![d, d]));
            v.push((format!("{p}.attn.wk"), vec![kv, d]));
            v.push((format!("{p}.attn.wv"), vec![kv, d]));
            v.push((format!("{p}.attn.wo"), vec![d, d]));
            v.push((format!("{p}.ffn_norm.weight"), vec![d]));
            v.push((format!("{p}.ffn.w_gate"), vec![h, d]));
            v.push((format!("{p}.ffn.w_up"), vec![h, d]));
            v.push((format!("{p}.ffn.w_down"), vec![d, h]));
        }
        v.push(("final_norm.weight".to_string(), vec![d]));
        if !self.tied_embeddings {
            v.push(("lm_head.weight".to_string(), vec![self.vocab_size, d]));
        }
        v
    }

    /// Breakdown computed by summing `param_shapes()`.
    pub fn breakdown(&self) -> Breakdown {
        let mut b = Breakdown::default();
        for (name, shape) in self.param_shapes() {
            let n: u64 = shape.iter().map(|&x| x as u64).product();
            let slot = if name == "tok_embeddings.weight" {
                &mut b.embedding
            } else if name == "lm_head.weight" {
                &mut b.lm_head_untied
            } else if name.ends_with("norm.weight") {
                &mut b.norms
            } else if name.ends_with(".wq") {
                &mut b.attn_q
            } else if name.ends_with(".wk") {
                &mut b.attn_k
            } else if name.ends_with(".wv") {
                &mut b.attn_v
            } else if name.ends_with(".wo") {
                &mut b.attn_o
            } else if name.ends_with(".w_gate") {
                &mut b.ffn_gate
            } else if name.ends_with(".w_up") {
                &mut b.ffn_up
            } else if name.ends_with(".w_down") {
                &mut b.ffn_down
            } else {
                panic!("unclassified parameter {name}");
            };
            *slot += n;
        }
        b
    }

    pub fn total_params(&self) -> u64 {
        self.breakdown().total()
    }

    /// Parameters in one transformer block.
    pub fn params_per_layer(&self) -> u64 {
        let b = self.breakdown();
        (b.attention() + b.ffn() + b.norms - self.d_model as u64) / self.n_layers as u64
    }

    /// Independent closed-form count (does not use `param_shapes`).
    pub fn closed_form_total(&self) -> u64 {
        let (l, d, v) = (self.n_layers as u64, self.d_model as u64, self.vocab_size as u64);
        let kv = (self.n_kv_heads * (self.d_model / self.n_heads)) as u64;
        let h = self.ffn_hidden() as u64;
        let per_layer = 2 * d * d + 2 * d * kv + 3 * d * h + 2 * d;
        let head = if self.tied_embeddings { 0 } else { v * d };
        l * per_layer + v * d + d + head
    }

    /// Training FLOPs per token: 6 x (matmul parameters, including the output
    /// head) + attention-score FLOPs 6 x L x context x d (Kaplan et al. 2020).
    pub fn train_flops_per_token(&self) -> u64 {
        let b = self.breakdown();
        let head = self.vocab_size as u64 * self.d_model as u64; // tied head still costs a matmul
        let matmul = b.attention() + b.ffn() + head;
        6 * matmul + 6 * (self.n_layers * self.context * self.d_model) as u64
    }

    /// Bytes for weights + gradients + AdamW (fp32 master, m, v) + bf16 copy.
    pub fn train_state_bytes(&self) -> u64 {
        // fp32 master 4 + fp32 grad 4 + m 4 + v 4 + bf16 weights 2 = 18 bytes
        self.total_params() * 18
    }
}

pub const AELIO_0_1: ModelConfig = ModelConfig {
    name: "aelio-native-0.1",
    n_layers: 8,
    d_model: 256,
    n_heads: 4,
    n_kv_heads: 4,
    vocab_size: 16_384,
    context: 512,
    ffn_multiple: 64,
    tied_embeddings: true,
};

pub const AELIO_0_2: ModelConfig = ModelConfig {
    name: "aelio-native-0.2",
    n_layers: 12,
    d_model: 768,
    n_heads: 12,
    n_kv_heads: 12,
    vocab_size: 32_768,
    context: 1024,
    ffn_multiple: 64,
    tied_embeddings: true,
};

pub const AELIO_0_3: ModelConfig = ModelConfig {
    name: "aelio-native-0.3",
    n_layers: 27,
    d_model: 1280,
    n_heads: 20,
    n_kv_heads: 4,
    vocab_size: 32_768,
    context: 2048,
    ffn_multiple: 64,
    tied_embeddings: true,
};

pub const AELIO_1_0: ModelConfig = ModelConfig {
    name: "aelio-native-1.0",
    n_layers: 20,
    d_model: 2048,
    n_heads: 16,
    n_kv_heads: 4,
    vocab_size: 65_536,
    context: 4096,
    ffn_multiple: 64,
    tied_embeddings: true,
};

pub const AELIO_2_0: ModelConfig = ModelConfig {
    name: "aelio-native-2.0",
    n_layers: 28,
    d_model: 3072,
    n_heads: 24,
    n_kv_heads: 8,
    vocab_size: 65_536,
    context: 4096,
    ffn_multiple: 64,
    tied_embeddings: true,
};

pub const PRESETS: [&ModelConfig; 5] = [&AELIO_0_1, &AELIO_0_2, &AELIO_0_3, &AELIO_1_0, &AELIO_2_0];

#[cfg(test)]
mod tests {
    use super::*;

    /// Pinned totals. Produced independently by native/tools/param_count_check.py
    /// (closed form, no shared code). Changing a preset must change these on purpose.
    const PINNED: [(&str, u64, u64); 5] = [
        ("aelio-native-0.1", 10_621_184, 4_194_304),
        ("aelio-native-0.2", 110_119_680, 25_165_824),
        ("aelio-native-0.3", 506_499_840, 41_943_040),
        ("aelio-native-1.0", 1_020_348_416, 134_217_728),
        ("aelio-native-2.0", 3_020_073_984, 201_326_592),
    ];

    #[test]
    fn presets_are_valid() {
        for c in PRESETS {
            c.validate().unwrap_or_else(|e| panic!("{}: {e}", c.name));
        }
    }

    #[test]
    fn shape_sum_matches_closed_form() {
        for c in PRESETS {
            assert_eq!(c.total_params(), c.closed_form_total(), "{}", c.name);
        }
    }

    #[test]
    fn totals_match_pinned_values() {
        for (c, (name, total, emb)) in PRESETS.iter().zip(PINNED) {
            assert_eq!(c.name, name);
            assert_eq!(c.total_params(), total, "{name} total");
            assert_eq!(c.breakdown().embedding, emb, "{name} embedding");
        }
    }

    #[test]
    fn totals_are_near_targets() {
        // Targets from the founder brief: 10M, 100M, 500M, 1B, 3B (within 12%).
        let targets = [10e6, 100e6, 500e6, 1e9, 3e9];
        for (c, t) in PRESETS.iter().zip(targets) {
            let r = c.total_params() as f64 / t;
            assert!((0.88..=1.12).contains(&r), "{} is {:.3}x its target", c.name, r);
        }
    }

    #[test]
    fn allocating_0_1_gives_the_same_count() {
        // Actually allocate every tensor of the smallest model and count elements.
        let tensors: Vec<Vec<f32>> = AELIO_0_1
            .param_shapes()
            .iter()
            .map(|(_, s)| vec![0.0f32; s.iter().product()])
            .collect();
        let n: usize = tensors.iter().map(|t| t.len()).sum();
        assert_eq!(n as u64, AELIO_0_1.total_params());
    }

    #[test]
    fn tied_head_is_not_double_counted() {
        let mut untied = AELIO_0_1.clone();
        untied.tied_embeddings = false;
        let diff = untied.total_params() - AELIO_0_1.total_params();
        assert_eq!(diff, (AELIO_0_1.vocab_size * AELIO_0_1.d_model) as u64);
    }

    #[test]
    fn gqa_shrinks_only_k_and_v() {
        let mut mha = AELIO_1_0.clone();
        mha.n_kv_heads = mha.n_heads;
        let (a, b) = (mha.breakdown(), AELIO_1_0.breakdown());
        assert_eq!(a.attn_q, b.attn_q);
        assert_eq!(a.attn_o, b.attn_o);
        assert_eq!(a.attn_k, 4 * b.attn_k); // 16 heads vs 4 kv heads
        assert_eq!(a.ffn(), b.ffn());
    }

    #[test]
    fn ffn_hidden_widths() {
        let got: Vec<usize> = PRESETS.iter().map(|c| c.ffn_hidden()).collect();
        assert_eq!(got, vec![704, 2048, 3456, 5504, 8192]);
    }

    #[test]
    fn invalid_configs_are_rejected() {
        let mut c = AELIO_0_1.clone();
        c.n_heads = 3;
        assert!(matches!(c.validate(), Err(ConfigError::HeadsDontDivideWidth { .. })));
        let mut c = AELIO_0_1.clone();
        c.n_kv_heads = 3;
        assert!(matches!(c.validate(), Err(ConfigError::KvHeadsDontDivideHeads { .. })));
        let mut c = AELIO_0_1.clone();
        c.d_model = 252; // 4 heads of 63: odd head dim breaks RoPE pairs
        assert!(matches!(c.validate(), Err(ConfigError::OddHeadDim { .. })));
    }

    #[test]
    fn layer_count_reconciles() {
        for c in PRESETS {
            let b = c.breakdown();
            let rebuilt = b.embedding + c.params_per_layer() * c.n_layers as u64 + c.d_model as u64;
            assert_eq!(rebuilt, b.total(), "{}", c.name);
        }
    }
}
